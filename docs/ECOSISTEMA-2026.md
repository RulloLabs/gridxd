# GridXD Ecosistema 2026

## Núcleo activo
**Extractor de iconos** es el flujo principal y no debe depender de servicios externos para entregar el resultado básico.

Flujo: imagen → detección de regiones → ajuste opcional → extracción → vista previa → ZIP.

### Resultado mínimo
- Vista previa visual inmediata de cada icono.
- PNG HD/2K.
- SVG vectorial.
- ZIP descargable desde el navegador.
- Nombre automático seguro.
- Renombrado manual opcional, nunca bloqueante.
- Control de fondo: cuadrícula, blanco, negro y transparente.
- Descarga individual SVG.

### Detección
La detección automática es asistida, no infalible. GridXD debe priorizar evitar cajas gigantes y duplicadas, ordenar las regiones y permitir corrección manual.

## APIs
**API REST / FastAPI**: útil para procesamiento premium, integración externa y documentación técnica. Mantener `/health` y Swagger solo mientras la API siga desplegada y mantenida. No es requisito para el flujo gratuito/local.

**Figma Plugin**: viable como siguiente integración si se confirma demanda. No debe anunciarse como funcional hasta existir un plugin instalable/probado.

**CLI Tool**: viable para procesamiento masivo local, pero es una extensión de segunda fase. No debe ocupar espacio visual principal si todavía no existe una versión publicada y verificable.

## Regla de producto
Las funciones anunciadas en la landing deben existir y funcionar. Las que estén en beta se etiquetan como beta. Las ideas futuras se trasladan a roadmap y no se presentan como disponibles.
