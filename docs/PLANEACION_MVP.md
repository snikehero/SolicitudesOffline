# Planeación del MVP - Solicitudes de trabajo y firmas en PDF

## 1. Objetivo

Construir una aplicación instalable en tablets Android que permita capturar una Solicitud de Trabajo, obtener dos firmas manuscritas, generar los PDF de Solicitud de Trabajo y Requisición de Material, conservar un historial local auditable y enviar el PDF al sistema de impresión de Android, sin requerir conexión a internet durante la operación.

La solución se desarrollará como una PWA con React y TypeScript. Inicialmente se distribuirá desde un servidor HTTPS dentro de la red local, sin depender de alojamiento externo, y quedará preparada para empaquetarse con Capacitor si las pruebas en las tablets muestran que se necesita mayor control del almacenamiento o de la impresión.

La arquitectura, convenciones de código, requerimientos técnicos, librerías, estrategias y estructura de carpetas se definen en [Documento general del proyecto](DOCUMENTO_TECNICO_PROYECTO.md). Ese documento forma parte de esta planeación y será la referencia principal durante la programación.

Reglas obligatorias de implementación:

- Aplicar CLEAN, DRY, KISS, YAGNI y SRP con criterio práctico.
- Escribir código, variables, tipos, funciones, archivos, carpetas y comentarios en inglés.
- Mantener en español los labels, mensajes y textos visibles para el usuario.
- Separar presentación, casos de uso, dominio e infraestructura.
- No introducir backend, sincronización ni características futuras en el MVP.

## 2. Supuestos para el MVP

- Se utilizará un solo modelo de tablet Android y una versión estandarizada de Chrome.
- La aplicación se instalará y probará con conexión una primera vez; después deberá funcionar completamente offline.
- La firma inicial será manuscrita electrónica, capturada con dedo o stylus. No incluirá certificados digitales avanzados.
- La impresión podrá requerir confirmación en el diálogo de impresión de Android.
- Cada tablet tendrá su propia secuencia de folios y su propio historial.
- Los PDF se generarán dentro de la tablet, sin enviar información a servidores.
- Los campos actuales de `solicitud_trabajo_app.html` se conservarán en el modelo de datos.
- Los registros finalizados no podrán editarse. Una corrección generará una nueva versión o un registro sustituto.

## 3. Alcance funcional

### 3.1 Incluido

1. Instalar la aplicación desde Chrome como PWA.
2. Crear una nueva solicitud con folio automático.
3. Guardar automáticamente un borrador mientras se captura.
4. Capturar datos generales:
   - Fecha.
   - Proyecto o sitio.
   - Cliente.
   - Ubicación.
   - Solicitante residente.
   - Puesto o cargo.
5. Capturar una o más actividades:
   - Descripción de la actividad o alcance.
   - Observaciones.
6. Capturar uno o más requerimientos de personal:
   - Rol o especialidad.
   - Cantidad.
   - Duración.
   - Unidad.
   - Fecha de inicio requerida.
7. Capturar uno o más materiales:
   - Descripción.
   - Cantidad.
   - Unidad de medida.
   - Marca.
   - Modelo o número de parte.
   - Marca o modelo sustituible.
   - Fecha de entrega requerida.
   - Alcance u observaciones.
8. Capturar la fecha de finalización del alcance.
9. Capturar la firma del solicitante:
   - Trazo de firma.
   - Nombre.
   - Fecha.
10. Capturar la firma de quien levantó la solicitud por TDCON:
    - Trazo de firma.
    - Nombre.
    - Puesto.
11. Mostrar una vista previa antes de finalizar.
12. Finalizar y bloquear el registro.
13. Generar el PDF de Solicitud de Trabajo.
14. Generar el PDF de Requisición de Material.
15. Abrir el diálogo de impresión de Android.
16. Consultar y buscar el historial por folio, cliente, solicitante y fecha.
17. Reabrir, visualizar, exportar y reimprimir documentos finalizados.
18. Exportar un respaldo local de los registros y PDF.
19. Restaurar un respaldo en una instalación compatible.
20. Registrar eventos básicos de auditoría.

### 3.2 Fuera del MVP

- Sincronización entre tablets.
- Servidor central o almacenamiento en la nube.
- Firma con certificado criptográfico emitido por una autoridad certificadora.
- Envío automático por correo, WhatsApp u otros servicios.
- Impresión silenciosa sin diálogo del sistema.
- Administración remota de dispositivos.
- Flujos de aprobación de varios niveles.
- Modificación visual de formatos por el usuario.
- Integración con ERP, compras o control de obra.

## 4. Decisiones confirmadas para el MVP

### 4.1 Machote de materiales

El MVP utilizará un machote Excel para Materiales Requeridos. No se generará ni solicitará un machote de Solicitud de Trabajo.

El archivo inicial es `machote_materiales_requeridos.xlsx` y contiene los campos de materiales definidos en el formulario.

La salida PDF que necesite la aplicación se compondrá programáticamente con los datos capturados, sin depender de un machote de Solicitud de Trabajo.

### 4.2 Campos de actividades

Cada actividad tendrá únicamente dos campos: descripción y observaciones.

### 4.3 Clasificación de materiales

No se incluirá el concepto de ramo ni se aplicará la regla de máximo 20 partidas. Los campos existentes de materiales son suficientes. La interfaz y los documentos admitirán las partidas que requiera el registro.

### 4.4 Política de folios

Inicialmente el folio será único dentro de la tablet. La estrategia para varias tablets se decidirá en una etapa posterior.

## 5. Arquitectura propuesta

### 5.1 Tecnologías

- React con TypeScript.
- Vite para construcción y empaquetado.
- React Router para navegación interna.
- IndexedDB mediante Dexie para registros, índices, eventos y archivos binarios.
- Service Worker propio y manifiesto de recursos para instalación y caché offline completa.
- PDF-lib para rellenar o componer PDF localmente.
- Canvas o Signature Pad para las firmas.
- Web Crypto API para SHA-256 y cifrado de respaldos.
- Vitest y Testing Library para pruebas unitarias.
- Playwright para pruebas integrales en navegador.
- Capacitor reservado como adaptador Android, sin hacerlo obligatorio en la primera iteración.

### 5.2 Capas

1. **Interfaz:** pantallas, formularios, captura de firmas y mensajes.
2. **Dominio:** reglas de validación, estados, folios y finalización.
3. **Persistencia:** IndexedDB, migraciones y recuperación de datos.
4. **Documentos:** mapeo de datos a las plantillas y generación de PDF.
5. **Plataforma:** impresión, exportación, importación y detección de almacenamiento.
6. **Auditoría:** eventos, versiones y huellas de integridad.

La interfaz no deberá acceder directamente a IndexedDB ni al generador de PDF. Esto permitirá cambiar la PWA por una aplicación empaquetada sin reescribir el formulario.

## 6. Modelo de datos mínimo

### 6.1 Solicitud

- `id`: UUID interno.
- `folio`: identificador visible.
- `version`: número de versión.
- `status`: `draft`, `ready_to_sign`, `finalized` o `voided`.
- `createdAt`, `updatedAt`, `finalizedAt`.
- `deviceId`.
- `fecha`, `proyecto`, `cliente`, `ubicacion`, `solicitante`, `puesto`, `fechaFin`.
- `actividades[]`.
- `personal[]`.
- `materiales[]`.
- `firmaSolicitante`.
- `firmaTdcon`.
- `solicitudPdf` y `requisicionPdf`.
- `pdfSha256`.
- `schemaVersion`.

### 6.2 Firma

- Nombre de la persona.
- Puesto, cuando corresponda.
- Fecha declarada.
- Fecha y hora de captura del dispositivo.
- Trazos originales normalizados.
- Imagen transparente generada para el PDF.
- Ancho y alto del área de captura.

### 6.3 Evento de auditoría

- `eventId`.
- `solicitudId`.
- Tipo de evento: creación, edición, guardado, firma, finalización, generación, exportación, impresión solicitada o anulación.
- Fecha y hora.
- Identificador del dispositivo.
- Datos mínimos asociados al evento.
- Huella encadenada opcional para detectar modificaciones del historial.

## 7. Estados y reglas

### Borrador

- Puede modificarse.
- Se guarda automáticamente.
- Las firmas pueden limpiarse y volver a capturarse.
- No se considera documento oficial.

### Listo para firmar

- Superó las validaciones de campos obligatorios.
- Se puede regresar a captura antes de firmar.

### Finalizado

- Requiere las firmas y datos obligatorios.
- Genera los PDF y sus huellas SHA-256.
- Ya no puede modificarse.
- Puede visualizarse, exportarse y reimprimirse.

### Anulado

- No se elimina físicamente.
- Requiere motivo.
- Conserva datos, PDF, fecha y evento de anulación.

## 8. Pantallas del MVP

1. **Inicio e historial**
   - Nueva solicitud.
   - Búsqueda y filtros.
   - Estado, folio, fecha, cliente y solicitante.
   - Indicador de respaldo pendiente.
2. **Captura de solicitud**
   - Secciones progresivas y controles grandes para tablet.
   - Guardado automático visible.
   - Navegación entre secciones sin perder datos.
3. **Firmas**
   - Una firma por turno y en pantalla amplia.
   - Confirmación antes de aceptar cada firma.
4. **Revisión**
   - Resumen de datos y advertencias.
   - Vista previa del PDF.
   - Acción Finalizar y firmar documento.
5. **Detalle del expediente**
   - Datos, estado, eventos y documentos generados.
   - Imprimir, exportar o anular según permisos.
6. **Respaldo y diagnóstico**
   - Espacio utilizado y disponible.
   - Exportar respaldo.
   - Restaurar respaldo.
   - Confirmación de operación offline.

## 9. Plan de ejecución

### Etapa 0 - Definición y validación del formato

**Entregables**

- Inventario definitivo de campos.
- Machote Excel de Materiales Requeridos.
- Diseño programático de los documentos PDF requeridos.
- Tabla de mapeo de datos hacia los documentos generados.
- Lista de campos obligatorios y reglas de negocio.

**Criterio de salida**

El responsable funcional aprueba los campos, reglas y una muestra del PDF esperado.

### Etapa 1 - Base técnica offline

**Trabajo**

- Crear el proyecto React/TypeScript.
- Configurar PWA, manifest, iconos y service worker.
- Empaquetar todas las dependencias; ninguna debe cargarse desde CDN.
- Crear la base IndexedDB y sus migraciones.
- Crear identificador estable de dispositivo.
- Implementar folios y guardado automático.
- Mostrar estado offline y versión instalada.

**Criterios de aceptación**

- Después de instalarla, la aplicación abre y funciona en modo avión.
- Recargar o cerrar la PWA no pierde un borrador.
- No se realizan solicitudes de red durante la operación normal offline.

### Etapa 2 - Captura completa

**Trabajo**

- Implementar datos generales.
- Implementar actividades, personal y materiales dinámicos.
- Agregar validaciones y mensajes comprensibles.
- Implementar historial, búsqueda, apertura y edición de borradores.
- Optimizar la interfaz para uso táctil.

**Criterios de aceptación**

- Se pueden capturar todos los campos conservados del prototipo.
- Agregar o eliminar filas mantiene la numeración y no mezcla datos.
- Un cierre inesperado permite recuperar el último borrador guardado.

### Etapa 3 - Firmas y finalización

**Trabajo**

- Capturar trazos con Pointer Events para dedo y stylus.
- Guardar trazos normalizados y generar imagen transparente.
- Validar firma vacía y nombres requeridos.
- Implementar vista de revisión.
- Implementar estados y bloqueo de registros finalizados.
- Registrar eventos de auditoría.

**Criterios de aceptación**

- Las firmas conservan su proporción después de rotar o redimensionar la pantalla.
- No es posible finalizar sin los datos y firmas requeridos.
- Un registro finalizado no puede editarse desde la interfaz.

### Etapa 4 - PDF e impresión

**Trabajo**

- Integrar el machote Excel de Materiales Requeridos como referencia funcional.
- Crear el diseño programático y la paginación de partidas.
- Generar Solicitud de Trabajo y Requisición de Material.
- Evitar recortes, traslapes y textos fuera de página.
- Calcular y guardar SHA-256.
- Implementar vista previa, descarga e impresión.

**Criterios de aceptación**

- Los PDF se generan en modo avión.
- Los datos y firmas corresponden al registro guardado.
- Los documentos impresos mantienen tamaño, márgenes y legibilidad.
- Reabrir un expediente produce exactamente los PDF finalizados guardados; no los regenera con datos distintos.

### Etapa 5 - Respaldo, restauración y endurecimiento

**Trabajo**

- Solicitar almacenamiento persistente y mostrar su resultado.
- Implementar exportación cifrada de registros, eventos y PDF.
- Implementar restauración con validación de versión e integridad.
- Manejar falta de espacio, escritura fallida y datos corruptos.
- Añadir bloqueo por PIN si se confirma como requisito.
- Evaluar empaquetado con Capacitor en la tablet objetivo.

**Criterios de aceptación**

- Un respaldo puede restaurarse en una instalación limpia sin perder expedientes.
- La aplicación detecta respaldos alterados o incompatibles.
- Ningún error de almacenamiento se muestra como guardado exitoso.

### Etapa 6 - Piloto y liberación

**Trabajo**

- Prueba con usuarios reales y stylus, si aplica.
- Pruebas con la impresora y el servicio de impresión seleccionados.
- Simular cierres, reinicios, modo avión y poco almacenamiento.
- Corregir hallazgos críticos.
- Preparar instructivo de instalación, uso, respaldo y recuperación.

**Criterio de salida**

El flujo completo se ejecuta en la tablet objetivo: crear, guardar, firmar, finalizar, generar PDF, imprimir, localizar en historial, exportar respaldo y restaurar.

## 10. Estimación inicial

Estimación para una persona desarrolladora con acceso oportuno a formatos y decisiones funcionales:

| Etapa | Duración estimada |
|---|---:|
| Definición y mapeo del formato | 2-4 días |
| Base React/PWA/IndexedDB | 3-5 días |
| Captura completa e historial | 5-8 días |
| Firmas, estados y auditoría | 4-6 días |
| Generación de PDF e impresión | 5-8 días |
| Respaldo y endurecimiento | 4-7 días |
| Piloto y correcciones | 4-7 días |
| **Total estimado** | **27-45 días hábiles** |

La mayor variación estará en la complejidad de los machotes PDF, la impresora elegida y el nivel real de auditoría requerido.

## 11. Estrategia de pruebas

### Pruebas unitarias

- Folios y cambio de año.
- Validaciones.
- Transformación del modelo a campos PDF.
- Manejo de listas de materiales con pocas y muchas partidas.
- Cálculo de huellas.
- Migraciones de base de datos.

### Pruebas integrales

- Crear, cerrar, reabrir y terminar un borrador.
- Capturar firmas con táctil.
- Generar ambos PDF.
- Buscar y reimprimir un expediente.
- Exportar y restaurar respaldo.
- Actualizar la PWA sin perder datos.

### Pruebas físicas

- Modo avión desde el arranque.
- Reinicio de tablet durante captura.
- Rotación de pantalla durante firma.
- Almacenamiento casi lleno.
- Impresión de documentos con pocas y muchas partidas.
- Calidad de firma y textos en papel.
- Desinstalación y restauración documentada.

## 12. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El usuario borra los datos del navegador | Respaldo obligatorio, almacenamiento persistente y posible empaquetado con Capacitor |
| Dependencia accidental de internet | Recursos y bibliotecas empaquetados; pruebas automatizadas en modo offline |
| Folios duplicados entre tablets | Incorporar identificador de tablet al folio |
| PDF ilegible con muchas partidas | Paginación controlada y pruebas con casos máximos |
| Firma deformada o perdida | Guardar trazos normalizados además de la imagen |
| Impresora incompatible con Chrome | Prueba temprana; usar Capacitor o integración nativa si es necesario |
| Manipulación posterior del registro | Bloqueo, eventos de auditoría, PDF almacenado y SHA-256 |
| Actualización rompe registros existentes | Versionado de esquema, migraciones y respaldo previo |

## 13. Definición de terminado del MVP

El MVP se considerará terminado cuando, en la tablet Android objetivo y sin internet, un usuario pueda:

1. Instalar y abrir la aplicación.
2. Capturar todos los campos acordados.
3. Cerrar y recuperar un borrador sin pérdida de información.
4. Obtener ambas firmas.
5. Revisar y finalizar la solicitud.
6. Generar los dos PDF con formato aprobado.
7. Enviar el PDF al sistema de impresión de Android.
8. Encontrar y reimprimir un expediente finalizado.
9. Ver su información básica de auditoría.
10. Exportar un respaldo y restaurarlo correctamente.

No se aceptará como terminado si alguna biblioteca requiere internet, si los registros finalizados pueden editarse o si la única copia de los documentos depende de almacenamiento temporal del navegador.

## 14. Próximo paso inmediato

Los siguientes puntos siguen pendientes antes del desarrollo:

1. Campos obligatorios.
2. Modelo exacto de tablet, stylus e impresora.
3. Política de respaldo y responsable de ejecutarlo.
4. Diseño visual esperado de los PDF generados.

Con estas respuestas puede cerrarse la Etapa 0 y comenzar la construcción del proyecto React/PWA.
