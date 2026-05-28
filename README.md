# Defensa Ciudadana — Landing

## Google Tag Manager — conversión WhatsApp

El sitio envía un evento al hacer clic en cualquier botón de WhatsApp:

```js
dataLayer.push({ event: 'whatsapp_click', conversion_source: '...' });
```

### Configuración en GTM (GTM-P993MRNH)

1. **Activadores → Nuevo**
   - Tipo: **Evento personalizado**
   - Nombre del evento: `whatsapp_click`

2. **Etiquetas → `Landingpage whatsapp button`**
   - Activación: activador **`whatsapp_click`** (no uses activadores de clic en enlace)
   - Tipo: **Seguimiento de conversiones de Google Ads**
   - ID: `AW-16553991216` + tu **Conversion Label**

3. Mantén también:
   - **Etiqueta de Google** → Initialization / All Pages
   - **Conversion Linker** → All Pages

4. **Enviar → Publicar**

5. Prueba en **Vista previa**: clic en WhatsApp → evento **`whatsapp_click`** → etiqueta **`Landingpage whatsapp button`** en “Etiquetas activadas”.

### Dominios monitorizados (diagnóstico GTM)

- `defensa-ciudadana.cl`
- `www.defensa-ciudadana.cl`
- `defensa-ciudadana-landingpage-static.fly.dev` (opcional, pruebas)

## WhatsApp — mensaje desde la web

Los enlaces se arman en `js/whatsapp-cta.js` con mensaje que empieza con **⚖️** y texto según la sección (`data-conversion-source`).
