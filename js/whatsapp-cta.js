/**
 * WhatsApp: mensaje prellenado (⚖️) + evento GTM whatsapp_click para conversiones.
 * Los botones de la página no abren el chat ni envían la conversión: muestran un aviso
 * y, si la persona confirma, el simulador de costos.
 * La conversión se envía una sola vez, al escribir desde ese simulador.
 * Un segundo intento de WhatsApp abre un aviso y no vuelve a convertir.
 */
(function (window, document) {
    'use strict';

    var WHATSAPP_PHONE = '56930509306';
    var GTM_EVENT = 'whatsapp_click';
    var CONVERSION_STORAGE_KEY = 'dc_whatsapp_ads_conversion';
    var pendingWhatsAppHref = '';
    var pendingIntentSource = '';
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

        if (section) {
            parts.push(section);
        } else if (!detail) {
            parts.push('Interés en herencias.');
        }

        if (detail) {
            parts.push(detail);
        }

        return parts.join(' ');
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
            return false;
        }
    }

    function recordConversion() {
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
                '<p class="wa-repeat-modal__eyebrow">Antes de escribirnos otra vez</p>' +
                '<h2 id="wa-repeat-title"><span>Usted ya nos</span> <span>contactó una vez</span></h2>' +
                '<p id="wa-repeat-text" class="wa-repeat-modal__text">¿Está seguro de que necesita un abogado? Recuerde que <strong>somos abogados privados y la asesoría tiene un costo.</strong> Si aun así quiere que lo orientemos, puede continuar con toda confianza.</p>' +
                '<div class="wa-repeat-modal__actions">' +
                    '<button type="button" class="wa-repeat-modal__confirm" data-wa-repeat-confirm>Sí, sé lo que hago</button>' +
                    '<button type="button" class="wa-repeat-modal__cancel" data-wa-repeat-cancel>Cancelar</button>' +
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
        var confirm = event.target.closest('[data-wa-repeat-confirm]');

        if (confirm) {
            confirmRepeatContact();
            return;
        }

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

    function openRepeatContactModal(href) {
        var modal = ensureRepeatModal();
        pendingWhatsAppHref = href;
        lastFocusedElement = document.activeElement;
        modal.hidden = false;
        document.body.classList.add('wa-repeat-modal-open');
        var confirmButton = modal.querySelector('[data-wa-repeat-confirm]');
        if (confirmButton) {
            confirmButton.focus();
        }
    }

    function closeRepeatModal() {
        var modal = getRepeatModal();
        if (!modal || modal.hidden) {
            return;
        }

        modal.hidden = true;
        pendingWhatsAppHref = '';
        document.body.classList.remove('wa-repeat-modal-open');

        if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
            lastFocusedElement.focus();
        }
        lastFocusedElement = null;
    }

    function confirmRepeatContact() {
        var href = pendingWhatsAppHref;
        closeRepeatModal();
        if (!href) {
            return;
        }

        var opened = window.open(href, '_blank', 'noopener,noreferrer');
        if (!opened) {
            window.location.href = href;
        }
    }

    function isSimulatorWhatsApp(link) {
        return Boolean(link.closest('#costSimulatorModal'));
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
                '<p id="wa-intent-text" class="wa-repeat-modal__text">Lo atendemos con gusto. Este paso es para cotizar un servicio legal de herencia o juicio de partición. <strong>Somos abogados privados y la asesoría tiene un costo.</strong> Si sabe lo que necesita y quiere seguir, le mostramos una estimación antes de escribirnos.</p>' +
                '<div class="wa-repeat-modal__actions">' +
                    '<button type="button" class="wa-repeat-modal__confirm" data-wa-intent-confirm>Sí, sé lo que hago y necesito un servicio legal de herencia o partición</button>' +
                    '<button type="button" class="wa-repeat-modal__cancel" data-wa-intent-cancel>No por ahora</button>' +
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
        if (event.target.closest('[data-wa-intent-confirm]')) {
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
        var confirmButton = modal.querySelector('[data-wa-intent-confirm]');
        if (confirmButton) {
            confirmButton.focus();
        }
    }

    function closeIntentModal(skipFocusRestore) {
        var modal = getIntentModal();
        if (!modal || modal.hidden) {
            return;
        }

        modal.hidden = true;
        pendingIntentSource = skipFocusRestore ? pendingIntentSource : '';
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
        window.requestAnimationFrame(function () {
            openCostSimulator(source);
        });
    }

    function applyWhatsAppMessages() {
        document.querySelectorAll('a[data-conversion-source], a[href*="wa.me"]').forEach(function (link) {
            if (!isSimulatorWhatsApp(link)) {
                neutralizeWhatsAppLink(link);
                return;
            }

            var detail = (link.getAttribute('data-whatsapp-detail') || '').trim();

            if (!detail) {
                neutralizeWhatsAppLink(link);
                return;
            }

            link.href = buildWhatsAppHref(link);
        });
    }

    function onWhatsAppClick(event) {
        var link = event.target.closest('a');
        if (!link || !isWhatsAppLink(link)) {
            return;
        }

        if (isSimulatorWhatsApp(link)) {
            var quoteIsComplete =
                typeof window.validateCostSimulatorSend === 'function' &&
                window.validateCostSimulatorSend(
                    link.getAttribute('data-conversion-source')
                ) === true;

            if (!quoteIsComplete) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }

            link.href = buildWhatsAppHref(link);

            if (hasRecordedConversion()) {
                event.preventDefault();
                event.stopPropagation();
                openRepeatContactModal(link.href);
                return;
            }

            pushWhatsAppClickEvent(link);
            recordConversion();
            return;
        }

        neutralizeWhatsAppLink(link);
        event.preventDefault();
        event.stopPropagation();
        openIntentModal(link.getAttribute('data-conversion-source') || '');
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
