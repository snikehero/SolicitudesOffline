# Documento general del proyecto

## 1. Objetivo General

Desarrollar una aplicación web instalable como PWA en tablets Android para capturar solicitudes de trabajo, administrar materiales requeridos, generar documentos PDF, obtener firmas manuscritas, conservar evidencia local auditable y enviar el documento final al sistema de impresión de Android.

El flujo principal deberá funcionar completamente sin conexión después de instalar la aplicación por primera vez. Internet será opcional y no una dependencia operativa.

El MVP deberá permitir:

1. Crear y recuperar borradores.
2. Capturar los campos definidos para la solicitud.
3. Capturar actividades usando únicamente descripción y observaciones.
4. Capturar listas de materiales sin clasificación por ramo ni límite fijo de partidas.
5. Generar y almacenar un PDF original.
6. Visualizar el PDF dentro de la aplicación.
7. Capturar firmas con dedo o stylus.
8. Incrustar las firmas permanentemente en una nueva versión del PDF.
9. Conservar tanto el PDF original como el firmado.
10. Consultar, reabrir y auditar registros locales.
11. Imprimir únicamente la versión firmada mediante el diálogo estándar de Android.
12. Exportar e importar respaldos locales.

## 2. Plataforma Principal

- Tablet Android administrada por la organización.
- Google Chrome o navegador Chromium estandarizado.
- PWA instalada desde el mecanismo estándar del navegador.
- Orientación horizontal como diseño principal, con soporte funcional para orientación vertical.
- Operación táctil con dedo, stylus, S Pen o lápiz capacitivo.
- Ejecución completamente local durante el flujo principal.
- Sin aplicación Android nativa durante el MVP.

La arquitectura deberá conservar una frontera de plataforma para permitir un empaquetado posterior con Capacitor si las pruebas físicas revelan limitaciones relevantes de almacenamiento, archivos o impresión.

## 3. Stack Tecnológico

### Aplicación

- React.
- TypeScript con configuración estricta.
- Vite.
- Enrutamiento y renderizado con Vinext sobre Vite.
- Estado local de React para el flujo del MVP; no se incorpora un almacén global hasta que exista una necesidad real.
- React Hook Form para formularios.
- Zod para esquemas, validación y transformación controlada de datos.

### PWA y operación offline

- Service Worker propio, pequeño y versionado.
- Web App Manifest.
- Cache Storage para el App Shell y recursos estáticos.
- Service Worker con actualización solicitada por el usuario.

### Persistencia

- IndexedDB.
- Dexie.js como adaptador de persistencia.
- Storage Manager API para consultar cuota y solicitar persistencia.
- Web Crypto API para UUID cuando esté disponible, SHA-256 y cifrado de respaldos.

### Documentos y firma

- `pdf-lib` para creación, modificación e incrustación de firmas.
- `react-pdf` y PDF.js empaquetado localmente para visualización.
- `signature_pad` sobre Canvas para la captura manuscrita.
- Pointer Events como interfaz unificada para dedo, stylus y mouse.
- JSZip para exportar e importar respaldos.

### Calidad

- ESLint.
- Prettier.
- Vitest.
- React Testing Library.
- `fake-indexeddb` para pruebas de persistencia.
- Playwright para recorridos integrales y validación offline.

No se utilizarán CDN, fuentes remotas ni recursos críticos descargados durante la operación.

## 4. Requerimientos

### 4.1 Requerimientos funcionales

#### Captura

- Crear una solicitud con folio único dentro de la tablet.
- Guardar cambios automáticamente sin depender de un botón Guardar.
- Recuperar el último borrador después de cerrar la PWA, reiniciar Chrome o reiniciar la tablet.
- Capturar datos generales, actividades, personal, materiales, fecha de finalización y firmantes.
- Permitir agregar y eliminar filas dinámicas.
- Utilizar únicamente descripción y observaciones en cada actividad.
- No solicitar ramo para los materiales.
- No imponer un límite fijo de 20 materiales.
- Validar campos obligatorios antes de generar o firmar.

#### Documentos

- Generar el PDF original dentro del dispositivo.
- Almacenar el PDF antes de mostrar acciones de firma o impresión.
- Visualizar documentos sin depender del visor externo de Chrome.
- Capturar dos firmas: solicitante y representante TDCON.
- Rechazar firmas vacías.
- Crear una versión firmada distinta de la versión original.
- Incrustar firmas, nombres, fechas e identificador en el contenido real del PDF.
- Calcular SHA-256 de cada versión final.
- Bloquear la edición del expediente finalizado.

#### Historial y auditoría

- Buscar por folio, cliente, solicitante y fecha.
- Filtrar por estado.
- Registrar creación, modificación, generación, firma, apertura, solicitud de impresión, exportación y anulación.
- Conservar registros anulados junto con su motivo.
- Mostrar espacio local utilizado y estado del respaldo.

#### Impresión y respaldo

- Habilitar impresión solamente cuando exista un PDF firmado válido.
- Abrir el diálogo estándar de impresión compatible con Android.
- Exportar metadatos, documentos, firmas y auditoría en un paquete local.
- Validar versión, estructura e integridad antes de importar un respaldo.

### 4.2 Requerimientos no funcionales

- El flujo principal debe funcionar en modo avión.
- El inicio offline no debe depender de la disponibilidad del servidor original.
- Toda dependencia crítica debe quedar incluida en el build.
- TypeScript deberá compilar sin errores y sin `any` injustificado.
- La interfaz deberá usar objetivos táctiles de al menos 48 px para acciones principales.
- No se deberá depender de `hover` para descubrir o ejecutar acciones.
- Las fechas deberán almacenarse en ISO 8601 y mostrarse en formato local de México.
- Ningún error de persistencia deberá presentarse como una operación exitosa.
- No deberán quedar `TODO`, `FIXME` ni mocks en funcionalidades centrales al liberar el MVP.
- Las migraciones de IndexedDB deberán preservar los registros existentes.

## 5. Estrategias

### 5.1 Offline-first

- Cachear el App Shell durante la instalación del Service Worker.
- Usar Cache First para recursos locales versionados.
- No interceptar como exitosas solicitudes que requieren una red inexistente.
- Verificar en el build que no existan URL críticas externas.
- Mostrar claramente el estado Online u Offline sin bloquear el trabajo.
- Configurar las actualizaciones como `prompt`; nunca recargar mientras haya un formulario o firma en proceso.
- Activar una versión nueva solo después de guardar el borrador y recibir confirmación.

### 5.2 Persistencia e integridad

- IndexedDB será la fuente de verdad local.
- Los componentes React nunca accederán directamente a Dexie.
- Cada operación crítica se ejecutará mediante un caso de uso.
- La finalización se realizará en una transacción: guardar firmas, guardar PDF firmado, calcular y guardar hash, actualizar estado y registrar auditoría.
- No se permitirá el estado `SIGNED` sin una versión firmada y su hash.
- El PDF original nunca se sobrescribirá.
- Los respaldos tendrán versión de esquema y manifiesto de hashes.

### 5.3 Experiencia táctil

- Diseñar primero para tablet horizontal.
- Dividir formularios largos en pasos claros.
- Mantener siempre visible el estado de guardado.
- Abrir la firma en un área amplia y dedicada.
- Solicitar confirmación para finalizar, anular, reemplazar una firma o importar un respaldo.
- Conservar los datos escritos al cambiar de orientación.

### 5.4 Calidad y mantenibilidad

- Dominio independiente de React, Dexie, PDF.js y del Service Worker.
- Dependencias externas encapsuladas detrás de puertos e implementaciones.
- Pruebas unitarias sobre reglas puras y casos de uso.
- Pruebas de integración sobre IndexedDB, PDF y respaldos.
- Pruebas end-to-end del flujo completo en modo offline.

## 6. Proceso desde el llenado de formulario hasta impresión

1. El usuario crea una solicitud.
2. `CreateWorkRequest` asigna UUID, folio local, estado `DRAFT` y fechas ISO.
3. Cada cambio válido activa `SaveWorkRequestDraft` con debounce.
4. El repositorio guarda el agregado completo y registra el evento correspondiente.
5. La pantalla de revisión ejecuta `ValidateWorkRequest`.
6. Si los datos son válidos, `GenerateOriginalPdf` crea un Blob mediante `PdfGenerator`.
7. Una transacción guarda el PDF original como una versión inmutable y cambia el estado a `PENDING_SIGNATURE`.
8. El visor interno abre exactamente el Blob almacenado.
9. El usuario captura cada firma en `SignaturePad`.
10. `CaptureSignature` valida que existan trazos, normaliza puntos y crea una imagen PNG transparente.
11. El usuario confirma que desea finalizar el documento.
12. `SignDocument` recupera el PDF original y delega la incrustación a `PdfSigner`.
13. `PdfSigner` coloca firmas, nombres y fechas usando una configuración central de posiciones.
14. La aplicación calcula SHA-256 del Blob firmado.
15. Una sola transacción almacena las firmas, la nueva versión PDF, el hash, el estado `SIGNED` y los eventos de auditoría.
16. El visor abre la versión firmada almacenada para revisión.
17. `RequestDocumentPrint` comprueba nuevamente el estado y la existencia del PDF firmado.
18. `BrowserPrintGateway` prepara el documento e invoca el mecanismo compatible del navegador.
19. Android muestra su diálogo nativo para que el usuario seleccione impresora, copias, papel y orientación.
20. La aplicación registra `PRINT_REQUESTED`. No declarará que la impresión física concluyó porque una PWA no puede garantizar ese resultado.

## 7. Librerías a utilizar

| Necesidad | Librería o API | Motivo |
|---|---|---|
| Interfaz | React | Componentes declarativos y ecosistema estable |
| Tipado | TypeScript | Contratos claros entre capas y reducción de errores |
| Build | Vite | Desarrollo y build PWA simples |
| Formularios | React Hook Form | Evita renderizados innecesarios en formularios extensos |
| Validación | Zod | Un mismo esquema para interfaz, casos de uso e importación |
| Estado de UI | React | Estado local suficiente para el alcance del MVP |
| Base local | Dexie.js | Transacciones y migraciones comprensibles sobre IndexedDB |
| PWA | Web App Manifest / Service Worker | Caché offline y control de actualizaciones sin dependencias innecesarias |
| PDF | pdf-lib | Generación y modificación completamente local |
| Visor | react-pdf / PDF.js | Visualización interna sin depender del visor del navegador |
| Firma | signature_pad | Captura de trazos probada y reutilizable |
| Respaldo | JSZip | Paquetes portables con metadatos y archivos |
| Hash y cifrado | Web Crypto API | Capacidad nativa sin dependencia adicional |
| Identificadores | `crypto.randomUUID()` | UUID local sin identificadores invasivos de hardware |
| Pruebas | Vitest / Testing Library | Pruebas unitarias y de componentes |
| IndexedDB en pruebas | fake-indexeddb | Ejecución determinista sin navegador real |
| Pruebas integrales | Playwright | Recorridos PWA y escenarios offline |

No se agregará una librería si una API estándar resuelve el caso con claridad. Cada dependencia deberá justificar mantenimiento, tamaño y valor funcional.

## 8. Restricciones y Limitantes

- La distribución inicial se realizará desde un servidor HTTPS ejecutado en una computadora de la red local; no dependerá de `chatgpt.site` ni de otro alojamiento externo.
- Android deberá confiar en la autoridad certificadora local generada para el proyecto antes de instalar la PWA.
- La computadora debe conservar una IP privada fija. La IP forma parte del origen web y, por tanto, de la identidad del almacenamiento IndexedDB.
- La computadora solo debe permanecer encendida durante la instalación inicial o una actualización; la operación diaria offline utilizará los recursos precargados en el teléfono o tablet.
- El primer acceso e instalación de la PWA requieren disponer del build desde un origen HTTPS o entorno permitido.
- El navegador administra la cuota de almacenamiento. Se solicitará persistencia, pero el usuario todavía puede borrar datos desde la configuración.
- Desinstalar la PWA o limpiar los datos del navegador puede eliminar la información local. El respaldo periódico será obligatorio.
- Una PWA no puede imprimir silenciosamente ni seleccionar una impresora sin intervención del usuario.
- `window.print()` o el mecanismo equivalente abre el diálogo del sistema. La aplicación solo puede registrar la solicitud de impresión.
- La compatibilidad real depende del servicio de impresión instalado y de la impresora seleccionada.
- Una firma dibujada no equivale a una firma digital criptográfica certificada.
- SHA-256 detecta cambios, pero no demuestra por sí solo la identidad legal del firmante.
- La fecha y hora provienen del dispositivo y pueden ser incorrectas si el reloj fue alterado.
- Los folios serán únicos únicamente dentro de la instalación durante el MVP.
- No existirá sincronización entre tablets ni consolidación central durante el MVP.
- Los PDF y respaldos pueden consumir almacenamiento considerable. La aplicación deberá monitorear cuota y fallar de manera segura.
- La orientación vertical será compatible, pero la experiencia principal se optimizará para horizontal.
- No habrá machote de Solicitud de Trabajo. Los documentos necesarios se diseñarán programáticamente.
- El machote inicial de Materiales Requeridos será el archivo Excel aprobado para el proyecto.

## 9. Principios de programación

### CLEAN

- El dominio contendrá entidades, reglas y estados sin importar React o infraestructura.
- Los casos de uso dependerán de interfaces declaradas en la capa de aplicación.
- Dexie, PDF-lib, PDF.js, Service Worker, impresión y archivos serán adaptadores reemplazables.
- La dirección de dependencias será: presentación -> aplicación -> dominio.
- Infraestructura implementará puertos de aplicación y no será importada desde el dominio.

### DRY

- Cada regla de validación tendrá una sola definición.
- Los esquemas compartidos no se duplicarán entre formularios, persistencia y respaldos.
- Las posiciones de firma y el mapeo PDF se definirán una sola vez.
- DRY no justificará abstracciones genéricas prematuras.

### KISS

- Un solo frontend y una sola base local.
- Sin backend, sincronización, colas remotas ni microservicios en el MVP.
- Estado global únicamente para información realmente compartida.
- Flujos explícitos y errores con tipos conocidos.

### YAGNI

- No implementar QR, firma con certificados, sincronización o administración remota todavía.
- No crear interfaces extensibles sin un segundo uso real o una frontera externa.
- Preparar puntos de sustitución, pero no desarrollar características futuras.

### SRP

- Un componente presenta una responsabilidad de interfaz.
- Un caso de uso ejecuta una intención del usuario.
- Un repositorio persiste y recupera agregados.
- Un generador crea PDF; un firmador modifica PDF; un visor solo presenta PDF.
- La auditoría no se mezclará con el renderizado ni con los componentes.

## 10. Convenciones de código

- Código, nombres de archivos, carpetas, variables, funciones, clases, tipos y comentarios en inglés.
- Textos visibles, labels, validaciones y mensajes para el usuario en español.
- `camelCase` para variables y funciones.
- `PascalCase` para componentes, clases y tipos.
- `kebab-case` para carpetas y archivos que no exportan un componente React.
- Componentes React en `PascalCase.tsx`.
- Constantes globales inmutables en `UPPER_SNAKE_CASE` solo cuando ayude a reconocerlas.
- No usar abreviaturas ambiguas como `doc`, `req`, `obj` o `dataManager` si existe un nombre específico.
- Evitar comentarios que repiten el código. Documentar motivos, restricciones o decisiones no evidentes.
- No mostrar stack traces ni mensajes técnicos al usuario final.
- Usar errores tipados y mapearlos a mensajes de interfaz en español.

Ejemplo:

```ts
export interface MaterialItem {
  id: string;
  description: string;
  quantity: number | null;
  unitOfMeasure: string;
  brand: string;
  partNumber: string;
  isSubstitutable: boolean | null;
  requiredDeliveryDate: string | null;
  scopeNotes: string;
}
```

Label correspondiente:

```tsx
<FieldLabel>Equipo / Material / Descripción</FieldLabel>
```

## 11. Estructura de carpetas

```text
src/
  app/
    App.tsx
    router.tsx
    providers/
    startup/

  domain/
    work-requests/
      entities/
      value-objects/
      work-request-state.ts
      work-request-rules.ts
    documents/
      document-version.ts
      document-status.ts
    audit/
      audit-event.ts
    shared/
      domain-error.ts

  application/
    ports/
      audit-repository.ts
      document-repository.ts
      pdf-generator.ts
      pdf-signer.ts
      print-gateway.ts
      backup-gateway.ts
    use-cases/
      create-work-request.ts
      save-work-request-draft.ts
      generate-original-pdf.ts
      capture-signature.ts
      sign-document.ts
      request-document-print.ts
      export-backup.ts
      import-backup.ts
    dto/

  infrastructure/
    db/
      app-database.ts
      schema-versions.ts
      dexie-document-repository.ts
      dexie-audit-repository.ts
    pdf/
      pdf-lib-generator.ts
      pdf-lib-signer.ts
      pdf-layout.ts
      signature-position.ts
    printing/
      browser-print-gateway.ts
    backup/
      zip-backup-gateway.ts
      backup-manifest.ts
    crypto/
      sha256-service.ts
    pwa/
      update-controller.ts
      storage-persistence.ts

  features/
    dashboard/
      components/
      DashboardPage.tsx
    work-request-form/
      components/
      hooks/
      validation/
      WorkRequestFormPage.tsx
    document-review/
      components/
      DocumentReviewPage.tsx
    signature/
      components/
        SignaturePad.tsx
      SignaturePage.tsx
    document-history/
      components/
      DocumentHistoryPage.tsx
    backup/
      BackupPage.tsx

  shared/
    ui/
    hooks/
    utils/
    constants/
    styles/
    i18n/
      es-MX.ts

  test/
    builders/
    fixtures/
    setup.ts

public/
  icons/
  pdf-assets/

e2e/
  offline-flow.spec.ts
  signing-flow.spec.ts
  backup-flow.spec.ts
```

La estructura combina capas CLEAN con carpetas por funcionalidad en la presentación. No se crearán carpetas vacías ni archivos de reexportación innecesarios.

## 12. Modelo y estados documentales

Estados iniciales:

```text
DRAFT -> PENDING_SIGNATURE -> SIGNED -> PRINT_READY
  |              |
  +----------> VOIDED
```

- `DRAFT`: editable y con autoguardado.
- `PENDING_SIGNATURE`: existe PDF original inmutable.
- `SIGNED`: existen firmas y PDF firmado con hash.
- `PRINT_READY`: la versión firmada pasó validación para impresión.
- `VOIDED`: expediente conservado, bloqueado y con motivo.

No se incluirá `ARCHIVED` como estado de negocio en el MVP. Archivar será, si se necesita, una propiedad de visualización que no alterará la integridad documental.

Tablas IndexedDB propuestas:

- `workRequests`.
- `documentVersions`.
- `signatures`.
- `auditEvents`.
- `settings`.
- `backupHistory`.

Índices principales:

- Folio.
- Estado.
- Fecha de creación.
- Cliente.
- Solicitante.
- Identificador de documento en versiones, firmas y auditoría.

## 13. Estrategia de pruebas

### Unitarias

- Generación de folios.
- Reglas de transición de estados.
- Validación de campos.
- Rechazo de firma vacía.
- Normalización de trazos.
- Mapeo de datos al PDF.
- Hash SHA-256.

### Integración

- Guardado y recuperación en Dexie.
- Migraciones de esquema.
- Transacción de firma completa.
- Conservación de PDF original y firmado.
- Exportación e importación de respaldo.
- Validación de hashes del respaldo.

### End-to-end

1. Instalar y abrir la PWA online una vez.
2. Crear y recuperar un borrador.
3. Activar modo avión.
4. Completar el formulario.
5. Generar y visualizar PDF.
6. Firmar con dedo y stylus.
7. Cerrar y reabrir la aplicación.
8. Consultar el PDF firmado.
9. Confirmar que un documento sin firma no puede imprimirse.
10. Solicitar impresión del documento firmado.
11. Exportar y restaurar un respaldo.
12. Instalar una actualización sin perder datos ni el borrador activo.

## 14. Criterio técnico de terminado

- `npm run lint`, `npm run typecheck`, `npm test` y `npm run build` terminan correctamente.
- El build no contiene dependencias críticas hacia CDN.
- Playwright completa el recorrido offline principal.
- La aplicación se instala y abre en modo avión en la tablet objetivo.
- Los borradores sobreviven cierres y reinicios.
- El PDF firmado contiene realmente las firmas.
- PDF original y firmado permanecen separados e inmutables.
- La aplicación no permite imprimir sin una versión firmada válida.
- El respaldo se restaura en una instalación limpia.
- La planeación, README y decisiones técnicas corresponden al comportamiento implementado.
