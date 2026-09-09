# Solicitudes TDCON

PWA offline-first para capturar solicitudes de trabajo, generar el PDF original, obtener dos firmas manuscritas con dedo o stylus y producir la versión final lista para imprimir desde Android.

## Funciones del MVP

- Folio único por instalación.
- Guardado automático local mediante IndexedDB/Dexie.
- Actividades con descripción y observaciones, sin límite artificial de renglones.
- Registro de personal y materiales requeridos.
- PDF generado y firmado completamente en el dispositivo.
- Historial auditable con versiones original y firmada, fecha, estado y hash SHA-256.
- Impresión mediante el diálogo nativo de Android.
- Exportación e importación de respaldo ZIP.
- Instalación como PWA y operación sin internet después de la primera carga.

## Ejecución local

Requiere Node.js 22.13 o posterior.

```bash
npm install
npm run dev
```

Validación completa:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Arquitectura

El código está separado en `domain`, `application`, `infrastructure` y `features`. Los nombres de archivos, variables, tipos y comentarios están en inglés; los textos visibles se mantienen en español. El MVP usa React, TypeScript, React Hook Form, Zod, Dexie, pdf-lib, React-PDF/PDF.js, Signature Pad y JSZip.

## Instalación y prueba en Android

1. Abre la URL publicada en Google Chrome con conexión a internet.
2. Espera a que la pantalla principal termine de cargar.
3. Abre el menú de Chrome y pulsa **Instalar aplicación** o **Agregar a pantalla principal**.
4. Inicia la aplicación desde el nuevo icono.
5. Crea una solicitud de prueba, genera el PDF y firma ambos espacios con el dedo.
6. Exporta un respaldo antes de borrar datos o desinstalar.
7. Activa el modo avión, cierra y vuelve a abrir la aplicación para comprobar la operación offline.
8. En el PDF firmado, pulsa **Imprimir**. Android abrirá su selector de impresora; también puedes elegir **Guardar como PDF**.

La primera instalación requiere internet y HTTPS. Una PWA no puede seleccionar una impresora ni confirmar que el papel salió físicamente; Android conserva ese control. Borrar los datos de Chrome o desinstalar la aplicación puede eliminar los registros locales, por lo que los respaldos periódicos son indispensables.
