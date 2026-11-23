# Subsuelo 04: El Acechador (PS2 Real Hardware Edition)

Juego de **Survival Horror 3D en primera persona** para **PlayStation 2**, desarrollado en **JavaScript** sobre [AthenaEnv](https://github.com/DanielSant0s/AthenaEnv). Probado y optimizado para ejecutarse en una **PlayStation 2 real chipeada (Matrix + OPL)** y en **PCSX2**.

## Estructura del repositorio

```text
.
├── athena.elf       # Runtime AthenaEnv clean-api con render VU1 y allocator GS VRAM corregido
├── athena.ini       # Configuración de arranque de AthenaEnv (CRLF)
├── main.js          # Juego completo en un solo archivo (sin imports ES6)
├── title.cfg        # Lanzador para la pestaña APPS de OPL
├── SYSTEM.CNF       # Descriptor de arranque para DVD-R / ISO (CRLF)
└── assets/
    └── ambient.ogg  # Audio ambiental opcional (audsrv)
```

## Compatibilidad y optimizaciones para PS2 real

- **Arranque seguro en PS2 real + OPL**:
  - Bundle monolítico en `main.js` sin `import` ES6 ni dependencias de rutas relativas.
  - Vibración DualShock 2 (`Pads.rumble`) diferida hasta estabilizar SIO2 (`frameTick >= 30` y `Pads.getState(0) === 6`), evitando bloqueos al inicio tras el logo de Athena.
  - Colores RGBA empaquetados como enteros sin signo de 32 bits (`>>> 0`) para evitar extensión de signo en el registro `RGBAQ` del Graphics Synthesizer (GS) en primitivas Gouraud (`Draw.quad` / `Draw.triangle`).
  - Menús con arreglos de cadenas estáticas sin concatenaciones ternarias por frame para evitar `InternalError: string too long` en QuickJS MIPS.
- **Rendimiento en Emotion Engine (294 MHz) y GS**:
  - Calidad 3D seleccionable en tiempo real desde Opciones (`ALTA 160` / `EQUILIBRADA 128` / `RAPIDA 96` rayos) con tablas precalculadas y Span Batching.
  - Normalización por Delta-Time para mantener la misma velocidad en **NTSC 60Hz** y **PAL 50Hz**.
  - Área segura CRT (Overscan) activada por defecto y zona muerta analógica (`0.22`) pensada para DualShock 2 reales.
  - Guardado en Memory Card (`mc0:/SUBSUELO04/save.json`) con degradación segura si no hay Memory Card conectada.

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

## Cómo ejecutarlo en una PlayStation 2 real

### Opción 1 (Recomendada): Desde USB con OPL APPS
1. Formateá un pendrive en **FAT32**.
2. Copiá el contenido de este repositorio dentro de `mass:/APPS/Subsuelo04/` (deben quedar `athena.elf`, `athena.ini`, `main.js`, `title.cfg` y `assets/`).
3. En **OPL**, asegurate de tener **PADEMU desactivado** para evitar conflictos en el bus SIO2 y lanzá **Subsuelo 04** desde la sección **APPS**.

### Opción 2: Desde USB con wLaunchELF / uLaunchELF
1. Copiá la carpeta del repositorio al pendrive (`mass:/Subsuelo04/`).
2. Abrí **uLaunchELF** (se recomienda uLE o una versión estable anterior de wLE para AthenaEnv) y ejecutá `athena.elf`.

### Opción 3: Grabar en DVD-R (Modchip Matrix / Modbo)
1. Duplicá `athena.elf` y renombrá la copia a `ATHA_000.01`.
2. Con **ImgBurn** (*Create image file from files/folders*), agregá `SYSTEM.CNF`, `ATHA_000.01`, `athena.ini`, `main.js` y `assets/`.
3. En **Options**, elegí `ISO9660 + UDF` (UDF `1.02`), generá la `.iso` y grabala en DVD-R a baja velocidad (**4x**).

## Cómo ejecutarlo en PCSX2
- Activá **HostFS** en ajustes avanzados y cargá `athena.elf` desde **Sistema -> Iniciar archivo...**.

## Novedades de esta corrección
- **Pase VU1 en PS2 real**: `athena.elf` usa el build de AthenaEnv `clean-api` (commit `ad1949e`, [CI](https://github.com/DanielSant0s/AthenaEnv/actions/runs/44427724969)), con `Render.init()`, `Render.begin()` y `RenderObject.render()`. Incluye la [corrección del allocator GS VRAM](https://github.com/DanielSant0s/AthenaEnv/commit/6527a7375e4a10c254279bc938859a0a75af4214), que mantenía mal ordenados los bloques libres al alinear una textura y podía asignar rangos todavía ocupados. El modo predeterminado exige la API VU1 moderna y dibuja los OBJ reales.
- **Recorte de geometría**: `accurate_clipping` se reserva para paredes, rejas y salida; piso, techo, enemigo e ítems usan el camino rápido.
- **Paredes alineadas con la PDA**: `tools/generate_map_walls.py` regenera las superficies 3D directamente desde `BASE_MAP`, eliminando caras internas superpuestas que causaban parpadeo y corrigiendo la orientación de las caras.
- **Carga 3D completa**: La carga progresiva incluye piso, techo, paredes, salida, rejas, ítems y `stalker.obj` con `stalker.png`. Los objetos reutilizan sus `RenderData` y texturas durante toda la partida.
- **Diagnóstico de memoria**: El overlay R2 informa EE RAM y GS VRAM usada. Aunque se llama `getFreeVRAM`, la API de AthenaEnv devuelve VRAM usada cuando se consulta sin argumentos.
- **Plano cercano de cámara**: Se ajustó el recorte para que las paredes no desaparezcan al acercarse hasta el margen permitido por la colisión, manteniendo el fondo del mapa dentro del rango visible.
- **Textos de menús y PDA**: Se usa `assets/fonts/ui.ttf` (FreeType); los rótulos pequeños del PDA ahora se dibujan a escala 0.72 para evitar la reducción que los volvía borrosos en 480i.
- **Logo HK Entertainment**: Se desactivó el boot logo de AthenaEnv en `athena.ini` (`boot_logo = false`), se agregó la pantalla de arranque con `assets/textures/hk_logo.png` (256x256, liberada de VRAM antes de jugar) y se incluyó el ícono `ART/athena.elf_ICO.png` (64x64 PNG 8-bit) para copiar a `mass:/ART/` si deseás verlo en la lista APPS de OPL.
