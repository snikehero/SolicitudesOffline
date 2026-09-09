# APK de Android

Esta rama empaqueta la aplicación como una app Android con Capacitor. El formulario, las firmas, los PDF y la auditoría siguen funcionando sin Internet y se almacenan dentro del dispositivo. No se requiere una computadora ni un servidor una vez instalada la aplicación.

## Requisitos de la computadora de compilación

- Node.js 22.13 o posterior.
- JDK 21.
- Android Studio con el SDK de Android instalado.
- El repositorio clonado y ubicado en la rama `android-apk`.

En Windows, `JAVA_HOME` debe apuntar al directorio real del JDK, no al ejecutable `java.exe`. Android Studio crea normalmente `android/local.properties` con la ubicación del SDK; ese archivo es local y no se guarda en Git.

## Preparación inicial

```powershell
npm ci
npm run android:sync
npm run android:open
```

El último comando abre el proyecto nativo en Android Studio. Desde ahí se puede ejecutar la aplicación en un teléfono conectado por USB o en un emulador.

## APK de prueba

```powershell
npm run android:apk
```

El archivo se genera en `android/app/build/outputs/apk/debug/app-debug.apk`.

El APK de prueba sirve para desarrollo. No debe ser el instalador operativo porque su certificado de depuración depende de la computadora donde se compila.

## Configuración única de la firma operativa

Android exige que todas las actualizaciones estén firmadas con la misma llave. Esta configuración se realiza una sola vez.

1. Crear el directorio `android/signing`.
2. Generar y guardar la llave:

```powershell
keytool -genkeypair -v -keystore android/signing/solicitudes-offline-release.jks -alias solicitudes-offline -keyalg RSA -keysize 2048 -validity 10000
```

3. Copiar `android/keystore.properties.example` como `android/keystore.properties` y sustituir `CHANGE_ME` por las contraseñas elegidas.
4. Guardar una copia segura y externa del archivo `.jks`, su alias y sus contraseñas. Estos archivos están excluidos de Git deliberadamente.

Si la llave se pierde, no se podrá instalar una actualización sobre la app existente. Sería necesario desinstalarla, lo que puede eliminar los registros locales.

## Generar el primer APK operativo

```powershell
$env:TDCON_VERSION_CODE = '1'
$env:TDCON_VERSION_NAME = '1.0.0'
npm run android:release
```

El archivo se genera en `android/app/build/outputs/apk/release/app-release.apk`.

Copiar el APK al teléfono o tablet, abrirlo y autorizar temporalmente la instalación desde esa fuente cuando Android lo solicite.

## Publicar una actualización

1. Actualizar el código y probarlo.
2. Conservar el mismo identificador `com.tdcon.solicitudesoffline` y usar exactamente la misma llave `.jks`.
3. Aumentar siempre `TDCON_VERSION_CODE`. Por ejemplo, para la segunda entrega:

```powershell
$env:TDCON_VERSION_CODE = '2'
$env:TDCON_VERSION_NAME = '1.1.0'
npm run android:release
```

4. Pasar el nuevo `app-release.apk` al dispositivo y abrirlo. Android mostrará una actualización de la aplicación existente.
5. No desinstalar primero la versión anterior. Aunque una actualización conserva normalmente los datos de la aplicación, exportar un respaldo ZIP desde la propia app antes de actualizar es la medida recomendada.

## Operación sin conexión

- El APK contiene todos los recursos web; no usa una IP, dominio ni servidor.
- Se eliminó el permiso de Internet de Android.
- La impresión usa el diálogo nativo de Android. La impresora puede funcionar por USB, Bluetooth, Wi-Fi Direct o mediante el servicio de impresión que tenga instalado el dispositivo.
- Guardar o compartir un PDF y exportar un respaldo utiliza el selector nativo de Android.
- Los registros permanecen en el almacenamiento privado de la aplicación. Para transferirlos a otro equipo debe utilizarse la exportación e importación de respaldo.

## Comandos habituales

| Comando | Uso |
| --- | --- |
| `npm run android:sync` | Compila React y copia los cambios al proyecto Android. |
| `npm run android:open` | Abre el proyecto en Android Studio. |
| `npm run android:apk` | Genera un APK de depuración. |
| `npm run android:release` | Genera el APK operativo firmado. |
| `npm run test` | Ejecuta las pruebas automatizadas. |
| `npm run typecheck` | Verifica TypeScript. |
