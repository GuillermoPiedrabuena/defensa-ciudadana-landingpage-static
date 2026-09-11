/**
 * WhatsApp: mensaje prellenado (⚖️) + evento GTM whatsapp_click para conversiones.
 */
(function (window, document) {
    'use strict';

    var WHATSAPP_PHONE = '56930509306';
    var GTM_EVENT = 'whatsapp_click';

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
        float_whatsapp: 'Usé el botón flotante de WhatsApp.'
    };

    function isWhatsAppLink(link) {
        var href = (link.getAttribute('href') || '').toLowerCase();
        return (
            href.indexOf('wa.me/') !== -1 ||
            href.indexOf('api.whatsapp.com') !== -1 ||
            href.indexOf('web.whatsapp.com') !== -1
        );
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

        if (section) {
            parts.push(section);
        } else {
            parts.push('Interés en herencias.');
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

    function applyWhatsAppMessages() {
        document.querySelectorAll('a[href*="wa.me"]').forEach(function (link) {
            link.href = buildWhatsAppHref(link);
        });
    }

    function onWhatsAppClick(event) {
        var link = event.target.closest('a');
        if (!link || !isWhatsAppLink(link)) {
            return;
        }
        pushWhatsAppClickEvent(link);
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
