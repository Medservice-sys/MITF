# Manual de Funcionamiento del Sistema MITF (GE CT Telemetry Monitor)

Este manual describe el funcionamiento paso a paso del panel de telemetría y gestión de tickets **MITF-TOM**, diseñado para operadores e ingenieros de soporte del NOC.

---

## 📋 Índice
1. [Acceso al Sistema (Login)](#1-acceso-al-sistema-login)
2. [Monitoreo en Tiempo Real (Dashboard)](#2-monitoreo-en-tiempo-real-dashboard)
3. [Explorador de Logs y Filtros de Severidad](#3-explorador-de-logs-y-filtros-de-severidad)
4. [Flujo de Reconocimiento de Alarmas (ACK)](#4-flujo-de-reconocimiento-de-alarmas-ack)
5. [Gestión de Reglas Reconocidas (ACK Panel)](#5-gestión-de-reglas-reconocidas-ack-panel)
6. [Creación de Tickets de Falla (Bitácora - ATREC)](#6-creación-de-tickets-de-falla-bitácora---atrec)
7. [Clasificación de Alertas y Catálogo de Eventos](#7-clasificación-de-alertas-y-catálogo-de-eventos)

---

## 1. Acceso al Sistema (Login)
Al ingresar a la aplicación por primera vez, se presentará la pantalla de inicio de sesión.
1. Ingrese su **Nombre de Usuario** (Ej: `admin`, `operator`, o las credenciales personales de ingeniero).
2. Introduzca su **Contraseña**.
3. Haga clic en **Iniciar Sesión**.
4. El sistema cargará el rol correspondiente de forma dinámica (los ingenieros tendrán permisos de re-clasificación, mientras que los operadores se centrarán en la monitorización y los tickets).

> [!NOTE]
> El sistema permite restringir el acceso a ciertos dispositivos según el perfil del usuario asignado para cumplir con políticas de segregación de datos.

---

## 2. Monitoreo en Tiempo Real (Dashboard)
El Dashboard principal muestra el estado de salud general del equipo de tomógrafo computada (CT).

### Elementos Clave:
*   **Métricas de Hardware:** Gráficas y paneles con indicadores críticos como revoluciones del gantry, corriente del tubo (`mAs`), temperaturas y estado de las conexiones.
*   **Esquema Interactivo del Tomógrafo:** Un gráfico vectorial (`SVG`) representa las sub-secciones del tomógrafo (Tubo, Generador HV, Gantry, Colimador, Mesa de Paciente, etc.). 
    *   **Verde:** El componente funciona sin fallas activas.
    *   **Naranja/Rojo:** Componente en estado de advertencia o falla crítica.
*   **Logs Recientes:** Tabla con los últimos 10 eventos capturados.
    *   **Filtros Rápidos de Severidad:** En la cabecera de la tabla de logs recientes, puede hacer clic en los botones `Todos`, `Crítico`, `Warning`, o `Info` para aislar rápidamente los eventos recientes por su severidad.

---

## 3. Explorador de Logs y Filtros de Severidad
Para realizar un análisis detallado de fallas complejas:
1. Navegue al panel **Explorador Logs** en el menú lateral.
2. Utilice el panel superior para filtrar por:
    *   **Rango de fechas** (`Desde` / `Hasta`).
    *   **Proceso emisor** (`scanmgr`, `recon`, `sysstate`, `device_eventlog`).
    *   **Texto libre** mediante el campo `Buscar`.
3. **Filtrado Rápido por Severidad:**
    *   Haga clic en los botones de colores en la parte superior de la tabla:
        *   **Todas:** Muestra todo el volumen de logs.
        *   **Crítico (SEVERE):** Muestra solo alarmas que detienen el escaneo.
        *   **Warning (WARNING):** Eventos anormales pero no destructivos.
        *   **Info (INFO):** Mensajes informacionales del sistema.
    *   *Nota:* Estos botones se sincronizan automáticamente con el selector desplegable tradicional.

---

## 4. Flujo de Reconocimiento de Alarmas (ACK)
Cuando se identifica una alarma recurrente o conocida que requiere atención específica:
1. En cualquier tabla de logs (Dashboard o Explorador), haga clic derecho sobre la fila del log afectado.
2. En el menú contextual que aparece, seleccione **Reconocer (Acknowledge)**.
3. Se mostrará una alerta de confirmación en el navegador indicando que el código de alarma pasará a estar bajo supervisión de reglas activas.
4. Haga clic en **Aceptar**.
5. El sistema lo redirigirá inmediatamente a la subpantalla **Reconocidas (ACK)**.

---

## 5. Gestión de Reglas Reconocidas (ACK Panel)
La pestaña **Reconocidas (ACK)** es la base de operaciones para la clasificación y gestión de tickets:
1. **Barra de Filtrado de Severidad ACK:** Filtre la tabla de reglas activas mediante los botones en la cabecera:
    *   `Todas`, `Crítico`, `Warning`, `Info`, `Excluida (IGNORE)` o `Reconocida (INFORMATIONAL)`.
2. **Re-clasificar en Caliente:** En la columna *Nivel Actual*, puede modificar directamente la severidad de un código mediante el menú desplegable. Los cambios se guardarán automáticamente en la base de datos sin alterar otras reglas.
3. **Deshacer ACK:** Si desea eliminar el comportamiento de reconocimiento para una alarma y restaurar su comportamiento estándar, haga clic en **Deshacer ACK**.
4. **Crear Ticket:** Abre la bitácora ATREC pre-poblando la información del evento seleccionado.

---

## 6. Creación de Tickets de Falla (Bitácora - ATREC)
Diseñado bajo el estándar **TMF621/TMF642** para mantener trazabilidad absoluta de las fallas.

1. Al hacer clic en **Crear Ticket** desde una alarma reconocida:
    *   El sistema cargará la vista **Bitácora**.
    *   El panel **Detalle de Enriquecimiento (ATREC)** se mostrará con campos pre-cargados automáticamente: ID del Log, Código de Alarma, Elemento de Red Afectado, Severidad y Servicio Afectado.
2. Ingrese el grupo asignado y la descripción de la falla.
3. **Sección de Tareas:** Use la checklist interactiva para registrar las acciones realizadas por el ingeniero de soporte técnico. Puede añadir nuevos pasos haciendo clic en `Añadir Tarea`.
4. **Inspección de Calidad de Imagen:** Si la falla requirió calibraciones o pruebas de imagen:
    *   Seleccione el estado de calibración (`Aprobado`, `Disconforme`, `En monitoreo`).
    *   Rellene el cuadro de comentarios de calidad de imagen.
5. Haga clic en **Guardar Bitácora y Cerrar Ticket** para persistir el registro y concluir la intervención.

---

## 7. Clasificación de Alertas y Catálogo de Eventos
Esta sección (administrada por ingenieros L2/L3) permite registrar nuevas reglas globales.
*   **Registrar Nuevo Evento:** Permite agregar un código aprendido (`TCE Code`), asignarle un subsistema y una guía de diagnóstico inicial para los operadores.
*   **Reglas de Descarte (IGNORE):** Si clasifica un evento como `IGNORE`, el sistema omitirá automáticamente esta alarma en las métricas de fallas del tomógrafo, evitando alertas redundantes y reduciendo el ruido en el NOC.
