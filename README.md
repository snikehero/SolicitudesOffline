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

## Modalidad local sin alojamiento externo

Requiere Node.js 22.13 o posterior.

Preparación inicial en la computadora:

```bash
npm install
npm run local:setup
```

El segundo comando detecta la IP local, crea el certificado HTTPS y muestra la dirección que debe abrirse en Android. Antes de capturar registros reales, reserva esa IP para la computadora desde la configuración DHCP del router.

Para iniciar la aplicación:

```bash
npm start
```

Este comando compila la versión actual y abre el servidor HTTPS en el puerto `8443`. La ventana debe permanecer abierta durante la instalación inicial y cuando se publiquen actualizaciones locales; después de comprobar el modo offline, la computadora puede apagarse.

### Certificado de Android

La PWA y su Service Worker requieren HTTPS, incluso dentro de una red local. El archivo que debe copiarse al teléfono es:

```text
.local-certs/local-ca.crt
```

En Android, la ruta habitual es **Configuración → Seguridad y privacidad → Más ajustes de seguridad → Instalar un certificado → Certificado de CA**. El nombre exacto cambia según el fabricante. Debe instalarse únicamente este certificado generado en la computadora de confianza.

Después:

1. Conecta teléfono y computadora a la misma red Wi-Fi.
2. Acepta para Node.js el acceso a redes privadas si Windows muestra el aviso del firewall.
3. Abre en Chrome la dirección mostrada por `npm run local:setup`, por ejemplo `https://192.168.1.50:8443`.
4. Espera a que cargue y usa **Menú → Instalar aplicación** o **Agregar a pantalla principal**.
5. Abre la aplicación desde su icono y visita al menos una vez la pantalla principal.
6. Activa modo avión, cierra y vuelve a abrir la aplicación para validar que el flujo completo está disponible.

La dirección IP forma parte de la identidad de almacenamiento de la aplicación. Cambiarla hace que Chrome la trate como otra instalación, por eso debe mantenerse fija.

## Desarrollo y validación

Servidor de desarrollo:

```bash
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

## Operación y respaldo

No se necesita internet para instalar desde el servidor local, pero sí conexión Wi-Fi entre el teléfono y la computadora durante la instalación o actualización. Una PWA no puede seleccionar una impresora ni confirmar que el papel salió físicamente; Android conserva ese control. Borrar los datos de Chrome, quitar el certificado o desinstalar la aplicación puede afectar el acceso, por lo que los respaldos ZIP periódicos son indispensables.
