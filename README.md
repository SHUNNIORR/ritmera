# Ritmera · Progressive Web App (PWA) de Temporizadores de Intervalos

> **Proyecto Académico** inspirado en conceptos de temporizadores de entrenamiento físico (como Timer Plus), implementado con identidad propia, arquitectura local-first, motor de reloj desacoplado basado en marcas de tiempo y cumplimiento de estándares web modernos.

---

## 1. Descripción y alcance académico

**Ritmera** es una Progressive Web App (PWA) diseñada para crear, estructurar, personalizar y ejecutar rutinas de intervalos (HIIT, Tabata, EMOM, descansos de fuerza, estiramientos o bloques de concentración tipo Pomodoro).

El proyecto tiene propósitos estrictamente académicos y de investigación en ingeniería de software frontend:
- Demostrar el diseño y la fiabilidad de un **motor de temporización desacoplado** capaz de resistir ralentizaciones y suspensiones de pestañas o dispositivos sin derivas de tiempo acumulativas.
- Implementar una arquitectura **Local-First** robusta mediante IndexedDB (encapsulada tras repositorios asíncronos), garantizando privacidad absoluta y autonomía offline.
- Ofrecer una experiencia de usuario accesible, responsive (mobile-first) y de alto rendimiento sin sobrecargar la aplicación con librerías visuales pesadas.

---

## 2. Funcionalidades implementadas

- **Biblioteca de rutinas:**
  - Visualización en cuadrícula o lista adaptable con códigos de color semánticos.
  - Buscador en tiempo real por nombre, descripción o etiquetas.
  - Filtros por categoría: *Todas, HIIT, Fuerza, Cardio, Movilidad, Estudio y Personalizadas*.
  - Ordenación por *Uso reciente, Alfabético y Fecha de creación*.
  - Acciones rápidas: Iniciar, Editar, Duplicar, Marcar como favorita y Eliminar con confirmación.
  - Plantillas preconfiguradas editables: **Tabata clásico (20/10)**, **HIIT 40/20**, **EMOM 10 min** y **Pomodoro 25/5**.

- **Editor estructurado de rutinas:**
  - Nombre, descripción, categoría y selector de paleta de colores accesibles.
  - Creación de etapas (*Trabajo, Descanso, Calentamiento, Vuelta a la calma, Recuperación y Personalizada*).
  - Bloques de etapas con **repeticiones configurables**, descanso entre rondas y descanso opcional tras la última repetición.
  - Reordenación accesible de bloques y etapas (botones subir/bajar), duplicación y borrado.
  - Entrada de duración ergonómica (minutos y segundos) diseñada para evitar desbordamientos de teclado virtual en móviles.
  - Cálculo de duración total estimada en tiempo real derivado de una función pura.

- **Motor de temporización y pantalla de ejecución:**
  - Reloj con tipografía monoespaciada/tabular para evitar oscilaciones de interfaz.
  - Máquina de estados: `idle`, `running`, `paused`, `completed`, `cancelled`.
  - Recálculo basado en **marcas de tiempo absolutas (`deadlineAt`)** que previene desajustes por `setInterval`.
  - Soporte de eventos del navegador (`visibilitychange`, `pageshow`) para avanzar las etapas vencidas si la pantalla se suspendió.
  - Controles: Iniciar, Pausar/Reanudar, Siguiente etapa, Etapa anterior, Reiniciar etapa, Ajuste rápido (+/-10 segundos) y Finalizar con confirmación.
  - Persistencia de sesión activa: si el usuario recarga la página por accidente, la sesión se restaura en el punto exacto.

- **Audio, voz y pantalla activa:**
  - Síntesis de sonido local con **Web Audio API** (sin necesidad de descargar archivos de audio externos, funciona 100% offline).
  - Avisos previos antes de finalizar etapa (beep de aviso).
  - Anuncios opcionales con **SpeechSynthesis API** en español con detección de compatibilidad y degradación elegante.
  - **Screen Wake Lock API** para mantener la pantalla activa durante el entrenamiento, con liberación automática al terminar.

- **Historial local:**
  - Registro automático de sesiones completadas e interrumpidas.
  - Instantánea inmutable de la rutina ejecutada (se conserva aunque luego se modifique o elimine la rutina original).
  - Visualización de fecha, tiempo real transcurrido vs tiempo planificado y etapas completadas.
  - Filtrado y borrado individual o completo.

- **Ajustes y Copias de Seguridad:**
  - Tema: *Sistema, Claro y Oscuro* mediante CSS tokens y variables.
  - Preferencias de sonido, voz, vibración y avisos.
  - Exportación de rutinas e historial en un archivo `JSON` versionado (`schemaVersion: 1`).
  - Importación segura de archivos `JSON` con validación de esquema, límite de 10 MB y selección de estrategia ante duplicados: *Omitir, Sobrescribir o Importar como copia*.
  - Restablecimiento de ajustes por defecto y eliminación completa de datos locales.

---

## 3. Stack técnico y justificación de elecciones

| Tecnología | Elección | Justificación |
|---|---|---|
| **Framework** | Angular 18 (Standalone Components) | Arquitectura moderna sin NgModules, Signals reactivos para estado fino y división de paquetes (lazy loading) por ruta. |
| **Lenguaje** | TypeScript con `strict: true` | Garantía de tipado estricto en modelos de dominio, validaciones y contratos entre capas. |
| **Persistencia** | IndexedDB mediante Dexie.js (v4) | Persistencia local-first estructurada, asíncrona y con versionado de esquema, encapsulada tras el patrón Repositorio. |
| **Estilos** | CSS Moderno con Custom Properties | Tokens de diseño para temas claro/oscuro, media queries para móvil/escritorio y respeto a `prefers-reduced-motion` y `safe-area-inset-*`. |
| **Audio** | Web Audio API | Síntesis procedural de frecuencias oscilatorias sin dependencias de red ni descargas de archivos `.mp3`. |
| **Voz** | SpeechSynthesis API | API nativa para síntesis de voz sin costos ni dependencias de terceros; con degradación silenciosa si no está disponible. |
| **Pantalla** | Screen Wake Lock API | Mantiene el dispositivo activo durante la sesión de entrenamiento evitando bloqueos accidentales. |
| **Pruebas Unitarias** | Jest + ts-jest | Rápido, ejecución modular y soporte de simulación de tiempo. |
| **Pruebas E2E** | Playwright | Automatización confiable en navegadores de escritorio y móviles emulados. |

---

## 4. Requisitos previos

- **Node.js:** Versión 18.x o 20.x (probado en Node v20.18.1).
- **npm:** Versión 9.x o 10.x.
- Navegador web moderno con soporte para ES2022 e IndexedDB (Chrome, Edge, Safari, Firefox).

---

## 5. Instalación y ejecución

### 5.1. Instalar dependencias
```bash
npm install
```

### 5.2. Iniciar servidor de desarrollo
```bash
npm start
# o
npx ng serve
```
Abre tu navegador en `http://localhost:4200/`.

---

## 6. Comandos disponibles

| Comando | Acción |
|---|---|
| `npm start` | Inicia la aplicación en modo desarrollo en `http://localhost:4200/`. |
| `npm run build` | Compila la aplicación para producción en la carpeta `dist/ritmera/browser` con optimizaciones, hashing y service worker. |
| `npm test` | Ejecuta las pruebas unitarias automatizadas con Jest. |
| `npm run test:e2e` | Ejecuta las pruebas end-to-end con Playwright. |

---

## 7. Cómo ejecutar las pruebas

### 7.1. Pruebas unitarias (Jest)
Ejecuta la suite completa de pruebas unitarias:
```bash
npm test
```
Cubre:
- Conversión y formato de duración (`formatDuration`, `msToSecsCeil`).
- Cálculo de duraciones de bloques con repeticiones y descansos inter-ronda.
- Expansión de rutinas en secuencias planas de etapas.
- Algoritmo de recuperación ante suspensión del navegador (`computeCurrentStep`).
- Reglas de validación de rutinas.
- Máquina de estados del motor de temporización (`TimerEngineService`).
- Validación y estrategias de importación de copias de seguridad (`ExportImportService`).

### 7.2. Pruebas End-to-End (Playwright)
```bash
npm run test:e2e
```

---

## 8. Cómo generar el build de producción

```bash
npm run build
```
Los artefactos compilados se generan en `dist/ritmera/browser`, incluyendo:
- Archivos JavaScript optimizados con carga diferida (*lazy loading*).
- Hojas de estilo CSS minificadas.
- Manifiesto de PWA (`manifest.webmanifest`).
- Service Worker de Angular (`ngsw-worker.js`) y tabla de hashes de caché (`ngsw.json`).

---

## 9. Instalación de la PWA en dispositivos compatibles

### En Android / Chrome / Edge:
1. Accede a la URL donde esté desplegada la aplicación mediante protocolo HTTPS (o `localhost`).
2. Haz clic en el aviso o en el menú del navegador en **"Instalar aplicación"** o **"Añadir a la pantalla de inicio"**.
3. La aplicación se abrirá en una ventana propia sin barra de direcciones (`display: standalone`).

### En iOS (Safari / iPhone / iPad):
1. Abre la web en Safari.
2. Pulsa el botón **Compartir** (icono de cuadrado con flecha hacia arriba).
3. Selecciona **"Añadir a la pantalla de inicio"** (*Add to Home Screen*).
4. La PWA se guardará como un icono independiente y respetará las áreas seguras (*safe-area-insets*).

### En Escritorio (Chrome / Edge / Safari macOS Sonoma+):
1. Haz clic en el icono de instalación situado en la barra de direcciones del navegador.
2. Ritmera se instalará como aplicación de escritorio nativa.

---

## 10. Persistencia local de datos y seguridad

- **Motor de persistencia:** Todos los datos se gestionan mediante **IndexedDB** a través de la base de datos `intervala-db` (nombre interno conservado para no perder datos existentes).
- **Tablas:**
  - `routines`: Definición de rutinas, etapas, bloques, colores y configuración.
  - `history`: Registro histórico de sesiones completadas o interrumpidas.
  - `activeSessions`: Snapshot de la sesión activa en curso para recuperación ante recargas.
  - `settings`: Preferencias de tema, audio, avisos y visualización.
- **Privacidad:** La aplicación **no envía datos a ningún servidor externo**, no utiliza cookies de rastreo ni servicios de terceros. Toda la información reside exclusivamente en el origen local del navegador.
- **Riesgos y mitigación:**
  - Si el usuario limpia el almacenamiento o la caché del navegador, IndexedDB puede vaciarse.
  - Se recomienda usar regularmente la función de **Exportar Copia de Seguridad (JSON)** desde Ajustes para salvaguardar las rutinas.

---

## 11. Limitaciones reales por plataforma y segundo plano

> [!WARNING]
> **Políticas de segundo plano en iOS (Safari):**  
> En dispositivos iOS, cuando la pantalla se bloquea o el usuario cambia de app, WebKit suspende la ejecución de JavaScript de forma agresiva.
> **Comportamiento en Ritmera:** Ritmera no confía en un `setInterval` continuo. Al reactivar la aplicación (`pageshow` o `visibilitychange`), el motor de temporización compara la marca de tiempo actual (`Date.now()`) contra `stepDeadlineAt`, deduce cuántas etapas se vencieron durante la suspensión y restaura la pantalla en la etapa y segundo exactos. No obstante, las alertas sonoras en segundo plano profundo con pantalla apagada en iOS requieren aplicaciones nativas con capacidades de audio background específicas.

> [!NOTE]
> **Screen Wake Lock API:**  
> Compatible con navegadores basados en Chromium (Android, Chrome, Edge) bajo HTTPS. En plataformas donde la API no está soportada (como Safari en iOS), la aplicación desactiva silenciosamente la función sin interrumpir la ejecución de los temporizadores.

> [!NOTE]
> **SpeechSynthesis (Guía por voz):**  
> Algunos navegadores móviles requieren una interacción táctil previa antes de permitir la emisión de voz. Si el motor de voz no está disponible o falla, Ritmera mantiene todas las alertas visuales y sonoras alternativas.

---

## 12. Reglas de negocio clave implementadas

1. **Fin de última etapa de una ronda:** Si el bloque tiene repeticiones restantes, se da paso al descanso entre rondas.
2. **Descanso posterior:** El descanso tras la última repetición del bloque es opcional y explícito (`restAfterLastRound`).
3. **Cálculo de duración:** Función determinista que multiplica etapas por repeticiones y suma descansos inter-ronda.
4. **Independencia de sesión:** Al iniciar una rutina, la sesión realiza una copia inmutable (`routineSnapshot`). Editar la rutina no altera una sesión ya en marcha.
5. **Recuperación tras recarga:** Las sesiones activas se guardan en IndexedDB y se reanudan calculando el tiempo transcurrido desde la última marca.
6. **Protección contra pulsaciones dobles:** El motor de temporización utiliza un bloqueo de transición para evitar que pulsar "Siguiente" rápidamente dispare transiciones dobles o carreras de estado.
7. **Zona horaria:** Las duraciones y cómputos se basan en marcas epoch (`Date.now()`), siendo inmunes a cambios de horario local.

---

## 13. Decisiones de arquitectura

- **Separación estricta del motor (`TimerEngineService`):** El cálculo temporal es agnóstico de la vista. La UI solo reacciona a señales y eventos emitidos por el motor.
- **ControlValueAccessor personalizado:** `DurationInputComponent` encapsula la entrada de tiempo en minutos y segundos, integrándose naturalmente con formularios reactivos.
- **Diseño sin dependencias visuales externas:** Todo el diseño se apoya en CSS nativo y tokens, permitiendo que la aplicación cargue en milisegundos y mantenga un bundle inicial muy reducido (~113 kB transferidos).
