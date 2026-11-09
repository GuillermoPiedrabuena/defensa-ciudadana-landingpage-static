/**
 * WhatsApp: mensaje prellenado (⚖️) + evento GTM whatsapp_click para conversiones.
 * Los botones de WhatsApp muestran un aviso con las opciones para continuar,
 * simular costos o cancelar. Cada persona puede iniciar hasta dos contactos.
 */
(function (window, document) {
    'use strict';

    var WHATSAPP_PHONE = '56930509306';
    var GTM_EVENT = 'whatsapp_click';
    var CONVERSION_STORAGE_KEY = 'dc_whatsapp_ads_conversion';
    var CONTACT_COUNT_STORAGE_KEY = 'dc_whatsapp_contact_count';
    var contactCountFallback = 0;
    var conversionRecordedFallback = false;
    var pendingIntentSource = '';
    var pendingIntentLink = null;
    var lastFocusedElement = null;
    var intentFocusedElement = null;

    var WHATSAPP_INTRO =
        '⚖️ Hola, me contacto desde la página web de Defensa Ciudadana.';

    var SECTION_MESSAGES = {
        hero_whatsapp: 'Vi el banner principal (herencias).',
        sabias_que_whatsapp: 'Vi la sección «¿Sabías que…?».',
        por_que_elegirnos_whatsapp: 'Vi «¿Por qué elegirnos?» (herencias).',
        servicio_particion_whatsapp: 'Consulta por Juicio de Partición.',
        servicio_posesion_whatsapp: 'Consulta por Posesión Efectiva.',
        servicio_corretaje_whatsapp: 'Consulta por Corretaje de Propiedad.',
        como_trabajamos_whatsapp: 'Vi «Cómo trabajamos».',
        simulador_particion_whatsapp: 'Cotice en el simulador de Juicio de Partición.',
        simulador_posesion_whatsapp: 'Cotice en el simulador de Posesión Efectiva.'
    };

    function isWhatsAppLink(link) {
        if (link.getAttribute('data-conversion-source')) {
            return true;
        }

        var href = (
            link.getAttribute('data-wa-href') ||
            link.getAttribute('href') ||
            ''
        ).toLowerCase();
        return (
            href.indexOf('wa.me/') !== -1 ||
            href.indexOf('api.whatsapp.com') !== -1 ||
            href.indexOf('web.whatsapp.com') !== -1
        );
    }

    function neutralizeWhatsAppLink(link) {
        var href = link.getAttribute('href') || '';

        if (href.indexOf('wa.me/') !== -1 || href.indexOf('api.whatsapp.com') !== -1) {
            link.setAttribute('data-wa-href', href);
        }

        link.setAttribute('href', '#simulador-costos');
    }

    function getConversionSource(link) {
        return (
            link.getAttribute('data-conversion-source') ||
            link.getAttribute('aria-label') ||
            'whatsapp_click'
        );
    }

    function buildMessage(link) {
        var parts = [WHATSAPP_INTRO];
        var source = link.getAttribute('data-conversion-source');
        var section = source && SECTION_MESSAGES[source];
        var detail = (link.getAttribute('data-whatsapp-detail') || '').trim();

        if (section && !link.hasAttribute('data-simulator-no-quote')) {
            parts.push(section);
        } else if (!detail) {
            parts.push('Interés en herencias.');
        }

        if (detail) {
            parts.push(detail);
        }

        return parts.join(detail.indexOf('\n') !== -1 ? '\n' : ' ');
    }

    function buildWhatsAppHref(link) {
        return (
            'https://wa.me/' +
            WHATSAPP_PHONE +
            '?text=' +
            encodeURIComponent(buildMessage(link))
        );
    }

    function pushWhatsAppClickEvent(link) {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            event: GTM_EVENT,
            conversion_source: getConversionSource(link),
            click_url: link.href || '',
            page_location: window.location.href,
            page_path: window.location.pathname,
            landing: 'herencias'
        });
    }

    function hasRecordedConversion() {
        try {
            return Boolean(window.localStorage.getItem(CONVERSION_STORAGE_KEY));
        } catch (err) {
            return conversionRecordedFallback;
        }
    }

    function getContactCount() {
        try {
            var storedCount = window.localStorage.getItem(CONTACT_COUNT_STORAGE_KEY);
            if (storedCount !== null) {
                var parsedCount = Number(storedCount);
                return Number.isInteger(parsedCount) && parsedCount >= 0
                    ? parsedCount
                    : 0;
            }

            return window.localStorage.getItem(CONVERSION_STORAGE_KEY) ? 1 : 0;
        } catch (err) {
            return contactCountFallback;
        }
    }

    function recordConversion() {
        conversionRecordedFallback = true;
        try {
            window.localStorage.setItem(
                CONVERSION_STORAGE_KEY,
                JSON.stringify({
                    action: 'whatsapp_ads_conversion',
                    at: new Date().toISOString()
                })
            );
        } catch (err) {
            // Si el navegador bloquea localStorage, el clic igual puede enviar la conversión.
        }
    }

    function recordContact(link) {
        contactCountFallback = getContactCount() + 1;
        try {
            window.localStorage.setItem(
                CONTACT_COUNT_STORAGE_KEY,
                String(contactCountFallback)
            );
        } catch (err) {
            // Se mantiene el límite durante la sesión si el navegador bloquea localStorage.
        }

        if (!hasRecordedConversion()) {
            pushWhatsAppClickEvent(link);
            recordConversion();
        }
    }

    function getRepeatModal() {
        return document.getElementById('wa-repeat-modal');
    }

    function ensureRepeatModal() {
        var existing = getRepeatModal();
        if (existing) {
            return existing;
        }

        var root = document.createElement('div');
        root.id = 'wa-repeat-modal';
        root.className = 'wa-repeat-modal';
        root.hidden = true;
        root.innerHTML =
            '<div class="wa-repeat-modal__backdrop" data-wa-repeat-cancel></div>' +
            '<div class="wa-repeat-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="wa-repeat-title" aria-describedby="wa-repeat-text">' +
            '<p class="wa-repeat-modal__eyebrow">Límite de cotizaciones</p>' +
            '<h2 id="wa-repeat-title">Ya se ha cotizado 2 veces</h2>' +
            '<p id="wa-repeat-text" class="wa-repeat-modal__text">No enviaremos este nuevo contacto a WhatsApp.</p>' +
            '<div class="wa-repeat-modal__actions">' +
                '<button type="button" class="wa-repeat-modal__cancel" data-wa-repeat-cancel>Entendido</button>' +
            '</div>' +
            '</div>';

        document.body.appendChild(root);
        root.addEventListener('click', onRepeatModalClick);
        document.addEventListener('keydown', onRepeatModalKeydown);
        return root;
    }

    function isRepeatModalOpen() {
        var modal = getRepeatModal();
        return Boolean(modal && !modal.hidden);
    }

    function onRepeatModalClick(event) {
        var cancel = event.target.closest('[data-wa-repeat-cancel]');

        if (cancel) {
            closeRepeatModal();
        }
    }

    function onRepeatModalKeydown(event) {
        if (!isRepeatModalOpen()) {
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            closeRepeatModal();
            return;
        }

        trapModalTab(event, getRepeatModal());
    }

    function openRepeatContactModal() {
        var modal = ensureRepeatModal();
        lastFocusedElement = document.activeElement;
        modal.hidden = false;
        document.body.classList.add('wa-repeat-modal-open');
        var closeButton = modal.querySelector('[data-wa-repeat-cancel]');
        if (closeButton) {
            closeButton.focus();
        }
    }

    function closeRepeatModal() {
        var modal = getRepeatModal();
        if (!modal || modal.hidden) {
            return;
        }

        modal.hidden = true;
        document.body.classList.remove('wa-repeat-modal-open');

        if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
            lastFocusedElement.focus();
        }
        lastFocusedElement = null;
    }

    function getIntentModal() {
        return document.getElementById('wa-intent-modal');
    }

    function ensureIntentModal() {
        var existing = getIntentModal();
        if (existing) {
            return existing;
        }

        var root = document.createElement('div');
        root.id = 'wa-intent-modal';
        root.className = 'wa-repeat-modal wa-intent-modal';
        root.hidden = true;
        root.innerHTML =
            '<div class="wa-repeat-modal__backdrop" data-wa-intent-cancel></div>' +
            '<div class="wa-repeat-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="wa-intent-title" aria-describedby="wa-intent-text">' +
                '<p class="wa-repeat-modal__eyebrow">Antes de contactarnos</p>' +
                '<h2 id="wa-intent-title"><span>¿Está seguro de que</span> <span>necesita un abogado?</span></h2>' +
                '<p id="wa-intent-text" class="wa-repeat-modal__text">Lo atendemos con gusto. Este paso es para cotizar un servicio legal de herencia o juicio de partición. <strong>Somos abogados privados y la asesoría tiene un costo.</strong> Si sabe lo que necesita y quiere seguir, elija cómo desea continuar.</p>' +
                '<div class="wa-repeat-modal__actions">' +
                    '<button type="button" class="wa-repeat-modal__cancel" data-wa-intent-cancel>No por ahora</button>' +
                    '<button type="button" class="wa-repeat-modal__simulate" data-wa-intent-simulate>Simular costos</button>' +
                    '<button type="button" class="wa-repeat-modal__confirm" data-wa-intent-contact>Hablar con un abogado</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(root);
        root.addEventListener('click', onIntentModalClick);
        document.addEventListener('keydown', onIntentModalKeydown);
        return root;
    }

    function isIntentModalOpen() {
        var modal = getIntentModal();
        return Boolean(modal && !modal.hidden);
    }

    function onIntentModalClick(event) {
        if (event.target.closest('[data-wa-intent-contact]')) {
            contactLawyer();
            return;
        }

        if (event.target.closest('[data-wa-intent-simulate]')) {
            confirmIntent();
            return;
        }

        if (event.target.closest('[data-wa-intent-cancel]')) {
            closeIntentModal(false);
        }
    }

    function trapModalTab(event, modal) {
        if (event.key !== 'Tab') {
            return;
        }

        var focusable = modal.querySelectorAll('button');
        if (!focusable.length) {
            return;
        }

        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function onIntentModalKeydown(event) {
        if (!isIntentModalOpen()) {
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            closeIntentModal(false);
            return;
        }

        trapModalTab(event, getIntentModal());
    }

    function openIntentModal(source) {
        var modal = ensureIntentModal();
        pendingIntentSource = source || '';
        intentFocusedElement = document.activeElement;
        modal.hidden = false;
        document.body.classList.add('wa-intent-modal-open');
        var cancelButton = modal.querySelector('[data-wa-intent-cancel]');
        if (cancelButton) {
            cancelButton.focus();
        }
    }

    function closeIntentModal(skipFocusRestore) {
        var modal = getIntentModal();
        if (!modal || modal.hidden) {
            return;
        }

        modal.hidden = true;
        if (!skipFocusRestore) {
            pendingIntentSource = '';
            pendingIntentLink = null;
        }
        document.body.classList.remove('wa-intent-modal-open');

        if (!skipFocusRestore && intentFocusedElement && typeof intentFocusedElement.focus === 'function') {
            intentFocusedElement.focus();
        }
        intentFocusedElement = null;
    }

    function openCostSimulator(source) {
        var type = source && source.indexOf('posesion') !== -1 ? 'posesion' : 'particion';
        var tab = document.querySelector('.cost-simulator-tab[data-type="' + type + '"]');
        if (tab) {
            tab.click();
        }

        var modalEl = document.getElementById('costSimulatorModal');
        if (!modalEl || !window.bootstrap || !window.bootstrap.Modal) {
            return;
        }

        window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }

    function confirmIntent() {
        var source = pendingIntentSource;
        closeIntentModal(true);
        pendingIntentSource = '';
        pendingIntentLink = null;
        window.requestAnimationFrame(function () {
            openCostSimulator(source);
        });
    }

    function contactLawyer() {
        var link = pendingIntentLink;
        var href = link ? buildWhatsAppHref(link) : '';
        closeIntentModal(false);

        if (!href) {
            return;
        }

        if (getContactCount() >= 2) {
            openRepeatContactModal();
            return;
        }

        recordContact(link);
        var opened = window.open(href, '_blank', 'noopener,noreferrer');
        if (!opened) {
            window.location.href = href;
        }
    }

    function applyWhatsAppMessages() {
        document.querySelectorAll('a[data-conversion-source], a[href*="wa.me"]').forEach(function (link) {
            neutralizeWhatsAppLink(link);
            link.href = buildWhatsAppHref(link);
        });
    }

    function onWhatsAppClick(event) {
        var link = event.target.closest('a');
        if (!link || !isWhatsAppLink(link)) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        pendingIntentLink = link;
        pendingIntentSource = link.getAttribute('data-conversion-source') || '';
        openIntentModal(pendingIntentSource);
    }

    function init() {
        applyWhatsAppMessages();
        document.addEventListener('click', onWhatsAppClick, true);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.buildWhatsAppMessage = buildMessage;
    window.refreshWhatsAppLinks = applyWhatsAppMessages;
    window.pushWhatsAppClickEvent = pushWhatsAppClickEvent;
})(window, document);
