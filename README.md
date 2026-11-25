# Subsuelo 04: El Acechador — HK Engine 1 (PlayStation 2)

Juego de **Survival Horror 3D en primera persona** para **PlayStation 2**, desarrollado por **HK Entertainment** sobre **HK Engine 1** (basado en [AthenaEnv V4](https://github.com/DanielSant0s/AthenaEnv)). Diseñado, probado y optimizado para correr en **hardware real de PlayStation 2** (modchip Matrix/Modbo + OPL desde USB o DVD-R) y en **PCSX2**.

---

## Estructura del repositorio

```text
.
├── athena.elf                     # Runtime AthenaEnv V4 clean-api (3.75 MB) con render VU1 y fix de GS VRAM
├── athena.ini                     # Configuración de arranque de AthenaEnv (CRLF, boot_logo = false)
├── main.js                        # Bundle monolítico generado para PS2 (sin imports ES6, 4.991 líneas)
├── title.cfg                      # Descriptor de arranque para la pestaña APPS de OPL
├── SYSTEM.CNF                     # Descriptor de arranque para DVD-R / ISO (CRLF)
├── ART/
│   └── athena.elf_ICO.png         # Ícono 64x64 (PNG 8-bit) para la lista APPS de OPL
├── src/                           # Código fuente modular de HK Engine 1 (compilado en main.js)
│   ├── _preamble.js               # Cabecera inicial del bundle
│   ├── config.js                  # Ajustes, utilidades Float64 MIPS, RGBA, estado 2D y telemetría
│   ├── storage.js                 # Persistencia JSON en Memory Card (mc0:/SUBSUELO04/save.json)
│   ├── audio.js                   # Módulos IOP (libsd/audsrv), Sound.Stream y Sound.Sfx
│   ├── map.js                     # Grilla BASE_MAP (20x20), colisión AABB y notas de lore
│   ├── ai.js                      # Máquina de estados de El Acechador y pathfinding BFS sin allocs
│   ├── renderer.js                # Pipeline 3D VU1 + streaming progresivo + fallback 2.5D + PDA
│   ├── menus.js                   # Pantallas de splash, título, opciones, pausa y expediente
│   ├── cinematic.js               # Sistema declarativo de cinemáticas VHS + intro de 44 s
│   └── main.js                    # Máquina de estados global y bucle principal Screen.display()
├── tools/
│   ├── build_main.py              # Compila src/ → main.js (--check para verificar, --watch en vivo)
│   ├── split_main.py              # Divide main.js en src/ preservando paridad byte a byte
│   ├── modules.json               # Manifiesto con el orden exacto de concatenación de módulos
│   ├── README_MODULAR.md          # Guía rápida del flujo modular src/ → main.js
│   └── generate_map_walls.py      # Generador automático de mallas 3D de paredes desde BASE_MAP
└── assets/
    ├── audio/
    │   ├── ambient.ogg            # Ambiente principal en bucle (OGG Vorbis estéreo, ~2.58 MB)
    │   ├── chase.ogg              # Música de persecución en bucle (OGG Vorbis estéreo, ~1.33 MB)
    │   └── LEEME_AUDIO.txt        # Especificación de formatos de audio y 9 SFX ADPCM (.adp)
    ├── fonts/
    │   └── ui.ttf                 # Tipografía FreeType para menús, HUD y PDA (~668 KB)
    ├── models/                    # 13 mallas 3D en formato Wavefront OBJ (escenario, ítems y Acechador)
    └── textures/                  # 13 texturas PNG (64x64 RGB para 3D + hk_logo.png 256x256 RGBA)
```

## Cómo ejecutarlo

### PlayStation 2 real — USB con OPL APPS (recomendado)
1. Formateá un pendrive en **FAT32**.
2. Copiá el contenido de ejecución en `mass:/APPS/Subsuelo04/` (solo hace falta `athena.elf`, `athena.ini`, `main.js`, `title.cfg` y la carpeta `assets/`; `src/` y `tools/` son solo de desarrollo).
3. *(Opcional)* Copiá `ART/athena.elf_ICO.png` a `mass:/ART/` para ver el ícono en el menú de OPL.
4. En **OPL**, desactivá **PADEMU** para evitar conflictos en el bus SIO2 y lanzá **Subsuelo 04** desde la pestaña **APPS**.

### PlayStation 2 real — USB con uLaunchELF / wLaunchELF
1. Copiá los archivos de ejecución en el pendrive (`mass:/Subsuelo04/`).
2. Abrí **uLaunchELF** (o una versión estable de wLaunchELF compatible con AthenaEnv) y ejecutá `athena.elf`.

### PlayStation 2 real — DVD-R (Modchip Matrix / Modbo)
1. Duplicá `athena.elf` y renombrá la copia a `ATHA_000.01`.
2. En **ImgBurn** (*Create image file from files/folders*), agregá `SYSTEM.CNF`, `ATHA_000.01`, `athena.ini`, `main.js` y `assets/`.
3. En **Options**, seleccioná `ISO9660 + UDF` (`UDF 1.02`), generá la `.iso` y grabala en DVD-R a baja velocidad (**4x**).

### Emulador PCSX2
1. Activá **HostFS** en los ajustes avanzados del emulador.
2. Cargá `athena.elf` desde **Sistema → Iniciar archivo...**.

## Controles (DualShock 2)

| Botón / Stick | Acción |
| :--- | :--- |
| **Stick Izquierdo / D-Pad** | Caminar y desplazarse lateralmente / navegar menús |
| **Stick Derecho / L1 - R1** | Girar la cámara en primera persona |
| **X (Cruz)** | Confirmar en menús / omitir pantalla de presentación |
| **Círculo / Cuadrado** | Correr en partida (consume *stamina* y genera ruido) / volver en menús / saltar carga de audio |
| **Triángulo** | Encender o apagar la linterna táctica |
| **Select / L2** | Desplegar u ocultar el plano PDA |
| **Start** | Pausar partida / confirmar / mantener 1.2 s para omitir cinemática |
| **R2** | Alternar modo de diagnóstico en pantalla (0: apagado, 1: telemetría PS2, 2: telemetría + paredes magenta) |

---

# Guía Técnica de Desarrollo — HK Engine 1

**HK Engine 1** es el motor 3D/2.5D y framework de ejecución en JavaScript diseñado por **HK Entertainment** para crear videojuegos en **PlayStation 2 real** sobre **AthenaEnv V4 (`clean-api`)**. Esta sección reúne todas las especificaciones de arquitectura, flujo modular, renderizado, presupuesto poligonal, CPU, memoria y buenas prácticas necesarias para desarrollar o extender juegos con el motor.

## 1. Arquitectura general, flujo modular y runtime

- **Runtime base**: `athena.elf` compilado desde AthenaEnv `clean-api` (commit `ad1949e`, [CI build](https://www.google.com/search?q=https://github.com/DanielSant0s/AthenaEnv/actions/runs/44427724969)), con soporte de API VU1 moderna (`Render.init()`, `Render.begin()`, `RenderObject.render()`) y el [parche del allocator de GS VRAM](https://www.google.com/search?q=https://github.com/DanielSant0s/AthenaEnv/commit/6527a7375e4a10c254279bc938859a0a75af4214) que evita la superposición de rangos de memoria al alinear texturas.
- **Desarrollo modular en `src/` → despliegue monolítico en `main.js`**: el código fuente se edita en 10 módulos separados dentro de `src/` y se ensambla en un único archivo `main.js` (~205 KB, 4.991 líneas) **sin `import` ES6** mediante `tools/build_main.py` y `tools/modules.json`. Esto combina comodidad de mantenimiento con compatibilidad total entre `mass:/` (USB FAT32), `cdfs:/` (DVD ISO9660) y `host:/` (PCSX2), sin fallos de rutas relativas ni sensibilidad a mayúsculas/minúsculas.
- **Comandos de compilación (`tools/`)**:
  - `python3 tools/build_main.py` — recompila `main.js` a partir de `src/`.
  - `python3 tools/build_main.py --check` — valida paridad byte a byte entre `src/` y `main.js`.
  - `python3 tools/build_main.py --watch` — recompila `main.js` automáticamente al guardar cambios en `src/`.
- **Organización de módulos en `src/`**:
  - `src/_preamble.js`: cabecera inicial del bundle.
  - `src/config.js`: ajustes dinámicos (`GAME_SETTINGS`), utilidades Float64 seguras para MIPS, empaquetado RGBA, estado 2D (`restore2DRenderState`) y telemetría de consola (`consoleStats`).
  - `src/storage.js`: persistencia JSON en Memory Card (`mc0:/SUBSUELO04/save.json`).
  - `src/audio.js`: carga de módulos IOP (`libsd`, `audsrv`), `Sound.Stream` y `Sound.Sfx`.
  - `src/map.js`: grilla lógica `BASE_MAP` (`20×20`), colisión AABB por ejes con sub-stepping (`movePlayerAxis`) y notas de lore.
  - `src/ai.js`: máquina de estados del enemigo (`AI_PATROL`, `AI_INVESTIGATE`, `AI_CHASE_INTRO`, `AI_HUNT`) y pathfinding BFS sin asignaciones.
  - `src/renderer.js`: pipeline 3D por hardware (VU1 + GS), streaming progresivo en 13 pasos (`HW3D_STREAM_STEPS`), fallback 2.5D por software, viewmodel y PDA.
  - `src/menus.js`: pantallas de splash, carga, título, opciones, pausa y expediente.
  - `src/cinematic.js`: sistema de cinemáticas declarativo sin asignaciones por cuadro (keyframes de cámara, fundidos, subtítulos máquina de escribir, efectos VHS, entidades y cues de audio) + intro *found footage* de 44 s (`CINEMATIC_INTRO`).
  - `src/main.js`: máquina de estados global (`STATE_SPLASH` → `STATE_LOADING` → `STATE_TITLE` → `STATE_MAP_LOADING` → `STATE_CINEMATIC` → `STATE_PLAY` / `STATE_PAUSE` / `STATE_OPTIONS` / etc.) y bucle `Screen.display()`.
- **Configuración de arranque (`athena.ini`)**: debe mantenerse con saltos de línea **CRLF** (`boot_logo = false`, `dark_mode = true`, `default_script = "main.js"`). El logo nativo de AthenaEnv se desactiva para mostrar el splash propio de **HK Entertainment** (`STATE_SPLASH`), cuya textura se libera de VRAM antes de iniciar la partida.

## 2. Pipeline de renderizado

HK Engine 1 soporta dos caminos de renderizado seleccionables desde Opciones (`GAME_SETTINGS.qualityIndex`): el **motor 3D real por hardware (VU1 + GS)** como modo principal (`0 = 3D VU1 STREAM`) y un **raycaster 2.5D por software** como respaldo (`1 = 2.5D MEDIA` con 96 rayos, `2 = 2.5D RAPIDA` con 64 rayos).

### 2.1 Inicialización de video y Z-Buffer
Al iniciar `main.js`, el motor consulta el modo de video nativo (`Screen.getMode()`) y habilita el buffer de profundidad por hardware:
- **Resolución y norma**: `640×448` en **NTSC 60 Hz** (detección automática de **PAL 50 Hz** cuando `SCREEN_H >= 500`, típicamente `640×512`).
- **Z-Buffer**: `screenMode.zbuffering = true` y `screenMode.psmz = Z16S` (profundidad de 16 bits con signo; se verifica `Z16S` global y `Screen.Z16S` como fallback). Si el Z-buffer no se activa correctamente (`screenDepthBufferReady === false`), el modo 3D VU1 se aborta de forma segura y cae al modo 2.5D.
- **VSync y formato de pantalla**: `Screen.setVSync(true)`, corrección de aspecto 16:9 / 4:3 y margen de seguridad CRT (*overscan*) activado por defecto.

### 2.2 Ciclo de un cuadro 3D por hardware (VU1 + GS)
En cada cuadro de `renderHardware3DWorld()` el motor ejecuta estrictamente esta secuencia:

1. **Proyección**: `Render.setView(fov, near, far)` con `fov = 60.0°` en 16:9 (`54.0°` en 4:3), `near = 0.25 m` (evita que paredes cercanas desaparezcan al rozarlas con el margen de colisión de `0.25 celdas = 0.50 m`) y `far = 52.0 m` (cubre la diagonal completa del mapa de `40×40 m`). Solo se actualiza cuando cambia el modo 16:9/4:3.
2. **Estado GS para 3D (Z invertido)**: AthenaEnv renderiza con profundidad invertida; antes de dibujar 3D se fuerza explícitamente:
   - `Screen.setParam(Screen.DEPTH_TEST_METHOD, Screen.DEPTH_GEQUAL)`
   - `Screen.setParam(Screen.DEPTH_TEST_ENABLE, true)`
3. **Inicio de pase y cámara**:
   - `Render.begin()` abre el pase VU1 del cuadro.
   - La cámara usa `Camera.type(Camera.LOOKAT)`. **Regla crítica**: `Camera.target(tx, ty, tz)` debe llamarse **siempre antes** que `Camera.position(cx, cy, cz)`, seguido de `Camera.update()`, ya que `Camera.target` conserva el desplazamiento relativo previo.
4. **Iluminación direccional (2 luces)**:
   - `hwLightMain` (luz direccional principal modulada por la linterna) y `hwLightFill` (luz cenital suave de relleno).
   - **Optimización**: `Lights.set(...)` solo se invoca cuando cambia el estado encendido/apagado de la linterna (`hwLastFlashState`), evitando llamadas innecesarias a C en cada frame.
5. **Envío de geometría al VU1**:
   - Escenario estático (`hwStaticObjs`), rejas dinámicas (`hwGatesObj` solo si `!breakerActive`), ítems activos dentro del radio de culling y enemigo (`hwStalkerObj`).
   - Cada `RenderData` se configura con `data.face_culling = Render.CULL_FACE_NONE` y `data.pipeline = Render.PL_DEFAULT`.
   - **Recorte preciso selectivo (`accurate_clipping`)**: se activa (`true`) únicamente en mallas grandes cercanas a la cámara (paredes, rejas y puerta de salida) para evitar triángulos estirados o desaparecidos al cruzar el frustum; piso, techo, ítems y enemigo usan `accurate_clipping = false` para ir por el camino rápido del VU1.
6. **Restauración de estado para 2D / HUD**:
   - En un bloque `finally`, se desactiva `DEPTH_TEST_ENABLE` (`false`) antes de dibujar el viewmodel 2D de la linterna, viñetas, PDA, HUD y textos FreeType.
   - `restore2DRenderState(screenW, screenH)` restablece `DEPTH_ALWAYS`, desactiva pruebas alfa y restaura `SCISSOR_BOUNDS` a pantalla completa.

### 2.3 Instanciación y Distance Culling
- **Reutilización de `RenderObject`**: en lugar de crear un `RenderObject` por cada ítem del mapa, HK Engine 1 carga **un único `RenderObject` por tipo de prop** (`fuse`, `battery`, `breaker`, `note`) y lo dibuja múltiples veces en el mismo cuadro actualizando `obj.position` y `obj.rotation` mediante dos objetos preasignados (`hwDrawPosition` y `hwDrawRotation`).
- **Culling por distancia (cuadrática, sin `Math.sqrt`)**:
  - **Ítems**: se omiten si `distSq > 81.0` celdas² (radio de **9 celdas = 18 m**).
  - **Enemigo (Acechador)**: se omite si `distSq > 225.0` celdas² (radio de **15 celdas = 30 m**).

### 2.4 Fallback 2.5D por software
Si la consola o el usuario selecciona `2.5D MEDIA` (96 rayos) o `2.5D RAPIDA` (64 rayos), el motor usa un raycaster DDA sin asignaciones por cuadro con tablas precalculadas en `Float64Array` (`QUALITY_TABLES`), caché de anchos de columna en `Int16Array` (`colStartX`, `colWidth`), agrupamiento de columnas contiguas (*Span Batching* en `flushWallSpan`) y sombreado Gouraud por primitivas `Draw.quad` / `Draw.triangle`.

### 2.5 Animación procedural del Acechador (sin assets nuevos)
El Acechador es un único `RenderObject` rígido (`stalker.obj`, 311 tris), así que su animación se calcula por código y se aplica solo a posición y rotación al llamar a `drawHwObject(...)`. **No agrega draw calls, triángulos ni memoria de assets.**

- **Funciones**: `resetStalkerAnim(inst, x, y)` (se llama al iniciar la partida y la cinemática) y `updateStalkerAnim(inst, lookX, lookY, dtScale, hasLos, isBlinded)` (una vez por cuadro, tanto en gameplay como en `STATE_CINEMATIC` con `cinStalker`). Los resultados quedan en `animOutY`, `animOutRx`, `animOutRy` y `animOutRz`.
- **Qué hace**: balanceo vertical e inclinaciones con frecuencia proporcional a la velocidad real (calculada del desplazamiento por cuadro); patrulla lenta y pesada, investigación cautelosa, persecución inclinada hacia adelante y más agresiva, y espasmos cuando la linterna lo frena (`isBlinded`). Gira suavemente hacia su dirección de movimiento (arco más corto, estilo `cinLerpAngle`) y solo se orienta al jugador cuando lo persigue o lo tiene a la vista.
- **Reglas de rendimiento**: tabla de senos precomputada (`Float64Array`, 256 entradas), cero asignaciones por cuadro, avance con `dtScale` (paridad NTSC/PAL) y opción activable desde Opciones (`ANIMACION 3D`, guardada en Memory Card).
- **Ajuste fino**: las amplitudes están en `updateStalkerAnim` (`bobAmp`, `rollAmp`, `pitchBase`, `freqScale` por estado). Con valores simulados el rebote máximo ronda 5 cm y la inclinación máxima ~11° al perseguir.

## 3. Presupuesto poligonal y pipeline de assets 3D

### 3.1 Escala métrica del mundo
- **Grilla lógica**: `20 × 20` celdas (`400` celdas totales).
- **Escala en metros**: `1 celda = 2.0 m` (`WORLD_CELL_SIZE = 2.0`), mapa total de `40 m × 40 m`.
- **Alturas**: techo a `2.6 m` (`WALL_HEIGHT = 2.6`), cámara/ojos a `1.55 m` (`WORLD_EYE_H = 1.55`), ítems flotantes a `0.55 m` (disyuntor en `0.0 m`, notas en `0.04 m`).

### 3.2 Conteo real de polígonos y draw calls en Subsuelo 04

| Archivo OBJ | Vértices | Triángulos | Peso | `accurate_clipping` | Rol en escena |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `map_floor.obj` | 260 | 130 | 17.4 KB | `false` | Piso estático del nivel |
| `map_ceiling.obj` | 260 | 130 | 17.4 KB | `false` | Techo estático del nivel |
| `map_walls_concrete.obj` | 568 | 284 | 37.2 KB | `true` | Paredes de hormigón (tipo `1`) |
| `map_walls_rust.obj` | 224 | 112 | 14.4 KB | `true` | Pilares/estructuras oxidadas (tipo `2`) |
| `map_walls_ritual.obj` | 68 | 34 | 4.3 KB | `true` | Paredes de zona ritual (tipo `3`) |
| `map_exit.obj` | 8 | 4 | 0.5 KB | `true` | Compuerta blindada Norte (tipo `4`) |
| `map_gates.obj` | 64 | 32 | 4.1 KB | `true` | Rejas dinámicas (tipo `5`, se ocultan al activar disyuntor) |
| `stalker.obj` | 933 | 311 | 77.0 KB | `false` | Enemigo 3D (proxy fallback: `stalker_placeholder.obj`, 72 tris, 9.4 KB) |
| `fuse.obj` | 24 | 12 | 1.5 KB | `false` | Prop fusible (hasta 4 instancias = 48 tris máx.) |
| `battery.obj` | 24 | 12 | 1.5 KB | `false` | Prop batería (hasta 3 instancias = 36 tris máx.) |
| `breaker.obj` | 24 | 12 | 1.5 KB | `false` | Prop disyuntor central (1 instancia = 12 tris) |
| `note.obj` | 24 | 12 | 1.5 KB | `false` | Prop nota de lore (hasta 4 instancias = 48 tris máx.) |

- **Total de escenario completo (con rejas)**: **726 triángulos** en 7 draw calls (`694` triángulos sin rejas).
- **Total máximo simultáneo en escena** (escenario + enemigo + 12 ítems): **1.181 triángulos** y hasta **20 draw calls** en el peor caso (en la práctica suele ser menor por distance culling).

### 3.3 Presupuestos recomendados para nuevos desarrollos en HK Engine 1

| Parámetro | Recomendado (60 FPS estables) | Techo práctico en PS2 + QuickJS |
| :--- | :--- | :--- |
| Triángulos visibles por cuadro | **800 – 1.800 tris** | ~2.500 – 3.000 tris (depende de cuántos usen `accurate_clipping`) |
| Draw calls VU1 por cuadro | **10 – 25 draws** | ~35 – 40 draws (cada `obj.render()` cruza el puente QuickJS → C → VU1) |
| Personaje / enemigo 3D | **250 – 500 tris** | ~800 tris (siempre triangulado, idealmente con proxy low-poly de respaldo) |
| Props / ítems repetidos | **12 – 64 tris** | ~120 tris (reutilizando un solo `RenderObject` por tipo) |
| Texturas 3D | **64×64 RGB PNG** | **128×128** solo para superficies heroicas; siempre pasar `tex.optimize()` |

### 3.4 Generación automática de paredes (`tools/generate_map_walls.py`)
Para editar el diseño de un nivel, se modifica `BASE_MAP` en `src/map.js`, se recompila el bundle y se regeneran los OBJ de paredes:

```bash
python3 tools/build_main.py
python3 tools/generate_map_walls.py
```

El script analiza la grilla `BASE_MAP` en `main.js`, emite **únicamente caras expuestas** que lindan con celdas caminables (`0`), fusiona tramos colineales contiguos en un solo quad (reduciendo drásticamente los triángulos), ajusta las UVs al largo del tramo y elimina caras internas coplanares entre paredes adyacentes que provocan parpadeo (*Z-fighting*) en el GS de 16 bits.

## 4. CPU (Emotion Engine 294 MHz) y reglas de QuickJS en MIPS

La PlayStation 2 cuenta con un procesador principal **Emotion Engine (MIPS R5900 a ~294.9 MHz)**, dos unidades vectoriales (**VU0 / VU1**), el sintetizador gráfico (**GS**) y el procesador de entrada/salida (**IOP a 36.8 MHz**). Como el código del juego corre interpretado en **QuickJS sobre MIPS**, el cuello de botella principal no es el relleno de píxeles del GS sino el **overhead de JavaScript y el Garbage Collector**.

### Reglas obligatorias de programación en HK Engine 1
1. **Cero asignaciones en el bucle principal (*hot path*)**:
   - No crear objetos literales `{ x, y }`, arrays temporales ni closures dentro de `Screen.display()`.
   - Reutilizar buffers preasignados: `bfsParent`, `bfsVisited`, `bfsQueue` (`Int16Array`/`Uint8Array` de `400` elementos para pathfinding), `aiResult`, `bfsOutNode`, `drawPool`, `hwEntityTransforms`, `hwDrawPosition` y `hwDrawRotation`.
2. **Sin concatenaciones `+` de strings por cuadro**:
   - Usar arreglos de cadenas constantes precomputadas (`BOOT_PCT_LABELS`, `MAP_PCT_LABELS`, `STREAM_3D_BADGES`, `FUSE_HUD_LABELS`, `LORE_MESSAGES`) o `[a, b].join("")` en lugares acotados. Evita picos de GC y el error `InternalError: string too long` observado en QuickJS MIPS con expresiones ternarias encadenadas.
3. **Aritmética segura Float64 en QuickJS MIPS**:
   - Usar las utilidades `toF64(v)`, `fadd(a, b)` (`a - (-b)`) y `clampF64(v, lo, hi)` en cálculos de física, cámara, colisión e IA para evitar conversiones inesperadas a enteros o degradación numérica en el compilador/intérprete MIPS.
4. **Empaquetado de colores RGBA sin signo (`>>> 0`)**:
   - Siempre generar colores con `rgba(r, g, b, a)` usando `>>> 0` (entero sin signo de 32 bits en `JS_TAG_INT`), sin llamar a `Color.new()` en bucles. Esto evita extensión de signo al escribir en el registro `RGBAQ` del GS (recordá que en PS2 GS el rango de alfa es **0 a 128**, donde `128` es 100% opaco).
5. **Delta-Time normalizado (paridad NTSC / PAL)**:
   - Cada cuadro calcula `dtMs` acotado a `[4, 120] ms` (default `16.6667 ms`) y `dtScale = clampF64(dtMs / 16.6667, 0.5, 2.0)`. Todos los desplazamientos de jugador, stamina, batería, cámara e IA multiplican por `dtScale` para mantener la misma velocidad en **60 Hz (NTSC)** y **50 Hz (PAL)**.
6. **Planificador cooperativo del EE para audio**:
   - Cuando el audio está activo (`audioReady && audioPlaying`), cada cuadro llama a `os.sleep(3)` para ceder ~3 ms al hilo de `audsrv` y evitar cortes o *underruns* en consola real.
7. **Streaming progresivo seguro para USB 1.1**:
   - La PS2 posee puertos **USB 1.1** (~0.8–1.0 MB/s reales). Cargar todos los `.obj` y `.png` en un solo frame congela la consola. Por eso HK Engine 1 divide la carga en **13 pasos atómicos** (`HW3D_STREAM_STEPS`), ejecutados paso a paso en la pantalla `STATE_MAP_LOADING` o espaciados cada 10 cuadros (~0.17 s) mediante `tickProgressive3DStream()`.

## 5. Memoria: EE RAM (32 MB) y GS VRAM (4 MB)

### 5.1 Mapa de hardware y presupuestos

| Memoria | Capacidad física | Uso en HK Engine 1 |
| :--- | :---: | :--- |
| **EE RAM** (RAM principal) | **32 MB** | Runtime `athena.elf` (~3.75 MB), heap de QuickJS, `main.js`, geometría OBJ en RAM (`RenderData`), buffers de streaming OGG y fuente FreeType (`ui.ttf`, ~668 KB). |
| **GS VRAM** (eDRAM de video) | **4 MB (4.096 KB)** | Doble framebuffer (front + back) + Z-Buffer `Z16S` (~2.2 a 2.8 MB según NTSC/PAL), atlas/caché de glifos FreeType y texturas 3D activas. |
| **IOP RAM** (I/O y audio) | **2 MB** | Drivers de USB (`mass:`), Memory Card (`mc0:`), DualShock 2 (`sio2`), módulos `libsd`/`audsrv` y muestras ADPCM SPU2. |

### 5.2 Gestión crítica de memoria y texturas
- **Retención obligatoria contra el GC (`hwKeptTextures`)**: en AthenaEnv, `RenderObject` conserva su `RenderData`, pero si el objeto JS `Image` pierde referencia, QuickJS puede recolectarlo y liberar el buffer nativo C de la textura mientras el 3D sigue dibujándola. Toda textura cargada exitosamente debe guardarse en el array global `hwKeptTextures`.
- **Prohibido forzar `std.gc()` en transiciones**: invocar `std.gc()` manualmente (por ejemplo al pausar) puede invalidar recursos nativos retenidos por el renderer o por FreeType.
- **Liberación explícita de texturas temporales**: las imágenes grandes de uso único (como `assets/textures/hk_logo.png`, `256×256 RGBA` = `256 KB` en VRAM) se liberan explícitamente con `img.free()` apenas termina su pantalla (`freeHkLogo()`).
- **Presupuesto real de texturas 3D en Subsuelo 04**: las 12 texturas activas son `64×64 RGB` optimizadas con `tex.optimize()`. Incluso sin paletizar ocupan `12 × 16 KB = 192 KB` (~48 KB paletizadas en 8-bit), dejando un margen muy holgado dentro de los 4 MB de GS VRAM.
- **Tipografía FreeType (`assets/fonts/ui.ttf`)**: se dibuja **sin dropshadow** para reducir a la mitad el tráfico de glifos hacia GS VRAM, y los textos de menús y PDA usan escalas `>= 0.70` (PDA en `0.72`) para evitar borrosidad por reducción en salidas entrelazadas 480i.
- **Particularidad de la API de VRAM**: al consultar `Screen.getFreeVRAM()` sin argumentos en AthenaEnv, el valor devuelto corresponde en realidad a la **VRAM usada (`VRAM_USED_TOTAL`)**, no a la libre. HK Engine 1 prioriza `Screen.getMemoryStats(Screen.VRAM_USED_TOTAL)` y usa `Screen.getFreeVRAM()` interpretado correctamente como VRAM usada cuando hace falta fallback.

## 6. Subsistemas: Audio, DualShock 2 y Memory Card

### 6.1 Audio (IOP + SPU2)
- **Inicialización diferida**: los módulos `libsd` y `audsrv` se cargan vía `IOP.getModule` / `IOP.loadModule` durante `STATE_LOADING` (o tras `frameTick >= 15` si se omitió la carga). El usuario puede presionar **Círculo** en la pantalla de carga para iniciar sin audio si hubiera algún problema en USB.
- **Streams de música (`Sound.Stream`)**: el motor soporta tanto `.wav` como `.ogg` (`assets/audio/ambient.ogg` / `.wav` y `chase.ogg` / `.wav`). Actualmente el repositorio incluye las pistas en **OGG Vorbis estéreo** (`ambient.ogg` de ~2.58 MB y `chase.ogg` de ~1.33 MB), reduciendo el peso de audio de ~33 MB en WAV a ~3.9 MB totales.
- **Efectos cortos (`Sound.Sfx`)**: la infraestructura define 9 efectos en formato **PS2 SPU2 ADPCM (`.adp`)** con volumen y paneo 3D (`-100` a `+100`) en `SFX_PATHS` (`step`, `flashlight`, `pickup`, `breaker`, `gate_locked`, `heartbeat`, `jumpscare`, `ui_move`, `ui_select`). Todavía no hay archivos `.adp` incluidos en `assets/audio/`; el motor verifica su existencia con `fileExistsSafe()` y los omite silenciosamente hasta que se agreguen.

### 6.2 DualShock 2 y bus SIO2
- **Zona muerta analógica**: `STICK_DEADZONE = 0.22` (calibrada para sticks DualShock 2 originales con desgaste).
- **Vibración segura (`triggerRumble`)**: bloqueada durante los primeros 30 cuadros (`frameTick < 30`), limitada a un máximo de una actualización cada 15 cuadros y condicionada a que el puerto 0 esté activo y en estado `STATE_STABLE` (`6`) o `STATE_FINDCTP1` (`5`). Esto evita cuelgues del bus SIO2 en PS2 reales.
- **Detección de desconexión**: a partir de `frameTick >= 60`, si `Pads.getState(0)` devuelve `0` o `7`, el juego pausa la acción y muestra el aviso de mando desconectado.

### 6.3 Persistencia en Memory Card (`mc0:`)
- Los ajustes de `GAME_SETTINGS` y los récords (`bestNormalSec`, `bestNightmareSec`, `escapes`) se guardan en `mc0:/SUBSUELO04/save.json` usando `os.mkdir`, `std.open` y `JSON.stringify`.
- Si no hay Memory Card en la ranura 1 (o se ejecuta en modo solo lectura sin MC0), las operaciones fallan silenciosamente sin interrumpir el juego.

## 7. Telemetría y depuración en consola (`R2`)

Presionando **R2** durante la partida (o activando *FPS / Diagnóstico* en Opciones) se despliega el panel `DIAGNOSTICO PS2`, que muestrea el hardware cada 30 cuadros (`updateConsoleStats`) para no impactar el rendimiento:
- **Identificación GS**: `System.getGPUInfo()` (`GS id.revision`).
- **FPS y CPU**: `Screen.getFPS(1000)` (promedio de 1 segundo) y frecuencia real del EE vía `System.getCPUInfo().CPUClock`.
- **EE RAM**: memoria asignada vs. total vía `System.getMemoryStats()`.
- **GS VRAM**: KB usados sobre 4.096 KB totales (`Screen.getMemoryStats` / `getFreeVRAM`).
- **Carga VU1**: `Render.stats().drawCalls` y `Render.stats().triangles`.
- **Modo `debugMode === 2`** (segunda pulsación de **R2**): activa la barra de coordenadas `(X, Y)`, fuente del modelo enemigo (`OBJ`/`PROXY`) y pinta paredes en magenta en modo 2.5D para depuración de colisiones.

## 8. Checklist rápido para desarrollar con HK Engine 1

1. **Editar siempre los módulos en `src/`** y recompilar el bundle PS2 con `python3 tools/build_main.py` (verificando con `--check` antes de commitear). No usar `import` ES6 ni rutas absolutas dependientes de PC.
2. **Al modificar el mapa (`BASE_MAP` en `src/map.js`)**, recompilar `main.js` y regenerar los OBJ de paredes ejecutando `python3 tools/generate_map_walls.py`.
3. **Exportar modelos 3D** en `.obj` triangulado con texturas `64×64` PNG (RGB), registrando cada asset en `HW3D_STREAM_STEPS` y reteniendo cada `Image` en `hwKeptTextures`.
4. **Activar `accurate_clipping = true`** únicamente en mallas grandes atravesables de cerca (paredes, puertas, rejas); dejar `false` en piso, techo, props y personajes.
5. **Respetar el orden de cámara** (`Camera.target` antes de `Camera.position`) y alternar `DEPTH_TEST_ENABLE` (`true` + `DEPTH_GEQUAL` en 3D, `false` en 2D/HUD).
6. **Auditar el presupuesto en consola real con `R2`**: verificar que `GS VRAM` no se acerque a 4.096 KB, mantener `TRI` bajo ~1.800–2.500 y evitar asignaciones por cuadro en QuickJS.
7. **Después de crear cualquier `Image`, `RenderData` o `RenderObject` nuevo**, pasarlo por `hkFixProto(obj, Clase)` antes de asignarle propiedades (ver sección 9).

## 9. Compatibilidad del runtime y solución de problemas

### 9.1 Objetos nativos sin prototipo (`hkFixProto`)
**Síntoma**: al probar en **PCSX2**, el juego mostraba `TypeError: not a function` en `drawHkSplashScreen` (el logo de HK no aparecía) o `RenderObject sin render()`, y la partida pasaba sola al modo 2.5D en vez de usar el 3D VU1.

**Causa observada**: las clases `Image`, `RenderData` y `RenderObject` tenían todos sus métodos (`Image.prototype.draw`, `RenderObject.prototype.render`, etc.), pero **los objetos creados con `new` llegaban con prototipo `null`** (`Object.getPrototypeOf(obj) === null`). Sin prototipo no existen `draw()`/`render()`, y asignaciones como `img.width = 216` o `obj.position = {...}` quedaban como propiedades de datos sueltas en lugar de pasar por los accesores del motor. No se determinó el motivo exacto en el runtime; antes funcionaba en PS2 real sin este arreglo.

**Solución**: la función `hkFixProto(obj, Cls)` reconecta `Cls.prototype` con `Object.setPrototypeOf` y **solo actúa si el prototipo no coincide**, así que en un runtime sano no cambia nada. Se aplica justo después de crear el objeto y **antes** de asignarle propiedades:
- texturas (`new Image(...)`) y logo de HK,
- `new RenderData(...)`,
- `new RenderObject(...)`.

**Cómo diagnosticarlo si reaparece**: mostrar `typeof obj.draw` / `typeof obj.render`, `Object.getPrototypeOf(obj) === Clase.prototype` y `Object.getOwnPropertyNames(obj)`. Si el objeto tiene como propiedades propias `width`, `color`, `position` o `rotation`, esas asignaciones se hicieron sin prototipo.

### 9.2 Degradación segura del 3D
- `drawHwObject` usa `obj.render()` y, si no existe, `obj.draw()`. Si ninguno existe **no lanza excepción**: marca el fallo, `render3DWorld` desactiva el 3D VU1 (`hw3dReady = false`) y continúa en 2.5D en el mismo cuadro. El motivo queda en `hwLoadErrorMsg` y se ve en el panel `R2` / pantalla de carga 3D.
- Si el logo de HK no se puede cargar o dibujar, el splash muestra el texto "HK ENTERTAINMENT" en su lugar.

### 9.3 Runtime del repositorio
El `athena.elf` incluido (3.753.784 bytes) expone `Render.init/begin/setView`, `RenderObject.render` e `Image.draw`. Una versión anterior del runtime (~5,7 MB) **no** tiene `Render.begin`: si el juego cae siempre a 2.5D, verificá primero el tamaño del `athena.elf` que se está ejecutando.

---

## Próximos pasos

- [x] Sistema de cinemáticas declarativo (`src/cinematic.js`) con cámara interpolada, efectos VHS, subtítulos máquina de escribir, aparición de El Acechador y salto manteniendo `START`.
- [x] Cinemática introductoria *found footage* de 44 segundos al iniciar Nueva Partida (`STATE_MAP_LOADING` → `STATE_CINEMATIC` → `STATE_PLAY`).
- [x] Animación procedural del Acechador (balanceo, inclinación por estado de IA, espasmos con linterna y orientación hacia su movimiento), también en la cinemática.
- [x] Compatibilidad con objetos nativos sin prototipo (`hkFixProto`) y degradación segura del 3D a 2.5D.
- [x] Migración de pistas musicales a OGG Vorbis (`ambient.ogg` y `chase.ogg`).
- [x] Flujo modular de desarrollo (`src/` + `tools/build_main.py` / `tools/split_main.py`) con compilación verificada byte a byte hacia `main.js`.
- [ ] Grabar y convertir a PS2 SPU2 ADPCM (`.adp`) los 9 efectos cortos declarados en `SFX_PATHS` (`step`, `flashlight`, `pickup`, `breaker`, `gate_locked`, `heartbeat`, `jumpscare`, `ui_move`, `ui_select`).
- [ ] Agregar cinemática de evacuación (apertura de compuerta Norte al reunir los 4 fusibles) reutilizando `startCinematic(...)`.
- [ ] Validar en hardware PS2 real (OPL USB 1.1 y DVD-R) los 44 segundos completos de la intro y el streaming OGG + ADPCM simultáneo con telemetría `R2` (FPS, EE RAM y GS VRAM).
- [ ] Añadir opción en Menú de Opciones para omitir automáticamente la intro en partidas siguientes o verla desde Expediente.

---

## Créditos

- **Estudio**: HK Entertainment
- **Autor**: Joaquín Gasperetti
- **Motor**: HK Engine 1
- **Runtime**: [AthenaEnv V4](https://github.com/DanielSant0s/AthenaEnv) (Daniel Santos)
