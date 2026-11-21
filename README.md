# Subsuelo 04: El Acechador (PS2 Real Hardware Edition)

Juego de **Survival Horror 3D en primera persona** para **PlayStation 2**, desarrollado en **JavaScript** sobre [AthenaEnv V4](https://github.com/DanielSant0s/AthenaEnv). Optimizado y preparado para ejecutarse tanto en una **PlayStation 2 real chipeada** (DVD-R, USB con OPL o wLaunchELF) como en **PCSX2**.

## Novedades y optimizaciones para PS2 real

- **Compatibilidad ISO9660 / CDVD real**:
  - Corregido el nombre de `src/config.js` en minúsculas (evita fallos de carga en sistemas de archivos sensibles a mayúsculas/minúsculas en DVD/OPL).
  - `SYSTEM.CNF` formateado estrictamente con saltos de línea DOS (`CRLF`) y salto final para compatibilidad con BIOS y modchips reales.
- **Rendimiento en Emotion Engine (294 MHz) y GS**:
  - **Calidad 3D seleccionable en tiempo real** desde Opciones (`ALTA 160` / `EQUILIBRADA 128` / `RAPIDA 96` rayos) con tablas precalculadas y cero asignaciones por frame.
  - **Normalización por Delta-Time**: la velocidad del jugador, la IA y los temporizadores se mantienen idénticos en consolas **NTSC 60Hz**, **PAL 50Hz** o ante variaciones de FPS.
  - **Garbage Collector controlado (`std.gc()`)** únicamente en transiciones de menú para evitar tirones durante persecuciones.
  - **Contador de FPS nativo** (`Screen.setFrameCounter(true)`) activable desde Opciones.
- **Televisores CRT y DualShock 2 reales**:
  - **Área segura CRT (Overscan)** activada por defecto (configurable en Opciones entre `SEGURO CRT` y `COMPLETO HD`) para que el HUD, el ECG y los menús nunca se corten en un televisor de tubo.
  - **Zona muerta analógica ampliada (`0.22`)** y sensibilidad configurable para evitar *drift* en sticks DualShock 2 desgastados, además de pausa automática si el mando se desconecta.
- **Experiencia de juego completa**:
  - **Menú Principal navegable** con fondo 3D en vivo y selector de dificultad (**NORMAL** / **PESADILLA**).
  - **Menú de Opciones** accesible desde el título y desde la pausa.
  - **Menú de Pausa completo**, visor de **Controles**, **Expediente de Registros**, lector modal de notas al encontrarlas, **brújula cardinal** en el HUD e **indicador direccional de peligro** en los bordes de pantalla.
  - **Audio ambiental de terror (`assets/ambient.wav`)** en bucle continuo mediante `Sound.Stream` (`audsrv`).
  - **Guardado en Memory Card (`mc0:/SUBSUELO04/save.json`)** de preferencias y récords de escape (con degradación segura si no hay Memory Card conectada).

## Controles (DualShock 2)

| Botón / Stick | Acción |
| :--- | :--- |
| **Stick Izquierdo / D-Pad** | Caminar y desplazarse lateralmente / navegar menús |
| **Stick Derecho / L1 - R1** | Girar la cámara en primera persona |
| **Círculo / Cuadrado** | Correr (consume *stamina* y genera ruido) |
| **Triángulo** | Encender / apagar linterna táctica |
| **Select / L2** | Desplegar / ocultar plano PDA |
| **Start** | Pausar partida |
| **R2** | Alternar información técnica de diagnóstico |

## Cómo ejecutarlo en una PlayStation 2 real chipeada

### Opción 1: Grabar en DVD-R (Modchip Matrix / Modbo / Mars)
1. Abrí **ImgBurn** en PC y elegí **Create image file from files/folders** (Crear archivo de imagen desde archivos/carpetas).
2. Agregá **todo el contenido** de la carpeta raíz (`SYSTEM.CNF`, `ATHA_000.01`, `athena.ini`, `main.js`, `src/`, `assets/`).
3. En la pestaña **Options**:
   - **File System**: `ISO9660 + UDF`
   - **UDF Revision**: `1.02`
4. En **Labels**, poné por ejemplo `SUBSUELO04` y generá el archivo `.iso`.
5. Grabá la `.iso` en un **DVD-R** (preferentemente Verbatim) a velocidad baja (**4x**).

### Opción 2: Desde pendrive USB con wLaunchELF (sin quemar disco)
1. Formateá un pendrive en **FAT32**.
2. Copiá la carpeta completa `subsuelo04` a la raíz del pendrive (`mass:/subsuelo04/`).
3. En la PS2, abrí **wLaunchELF** / **uLaunchELF**, entrá en `mass:/subsuelo04/` y ejecutá `athena.elf`.

### Opción 3: Desde USB / HDD con OPL (Open PS2 Loader)
1. Generá la `.iso` con ImgBurn como en la Opción 1 (ISO9660 + UDF 1.02).
2. Copiá la `.iso` a la carpeta `DVD/` de tu USB o disco interno con el formato de nombre `ATHA_000.01.Subsuelo04.iso` (o instalala con OPL Manager).

## Cómo ejecutarlo en PCSX2
- **Modo ISO**: cargá la `.iso` generada desde **Sistema -> Iniciar disco**.
- **Modo ELF directo**: activá **HostFS** en ajustes avanzados y cargá `athena.elf` desde **Sistema -> Iniciar archivo...**.
