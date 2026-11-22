# Subsuelo 04: El Acechador (PS2 Real Hardware Edition)

Juego de **Survival Horror 3D en primera persona** para **PlayStation 2**, desarrollado en **JavaScript** sobre [AthenaEnv V4](https://github.com/DanielSant0s/AthenaEnv). Probado y optimizado para ejecutarse en una **PlayStation 2 real chipeada (Matrix + OPL)** y en **PCSX2**.

## Estructura del repositorio

```text
.
├── athena.elf       # Runtime AthenaEnv V4 para PlayStation 2
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
- **Configuración segura del Z-buffer**: Se solicita Z16S al modo de pantalla y se comprueba que AthenaEnv lo haya activado antes de arrancar el pase VU1. Si no está disponible, se informa el error y el juego conserva el render 2.5D en vez de dibujar una escena 3D corrupta. El estado de profundidad se restaura para el HUD 2D.
- **Recorte de geometría del mapa**: Las mallas del escenario usan `accurate_clipping` de AthenaEnv para recortar triángulos que atraviesan los planos de cámara; el cargador ahora respeta esa opción por modelo.
- **Prueba del mapa 3D**: La carga progresiva actual incluye piso, techo, paredes, salida, rejas e ítems. El Acechador está omitido deliberadamente para aislar los bloqueos del render del escenario; `stalker.obj` todavía no se carga en esta prueba.
- **Textos de menús y PDA**: Se usa `assets/fonts/ui.ttf` (FreeType); los rótulos pequeños del PDA ahora se dibujan a escala 0.72 para evitar la reducción que los volvía borrosos en 480i.
- **Logo HK Entertainment**: Se desactivó el boot logo de AthenaEnv en `athena.ini` (`boot_logo = false`), se agregó la pantalla de arranque con `assets/textures/hk_logo.png` (256x256, liberada de VRAM antes de jugar) y se incluyó el ícono `ART/athena.elf_ICO.png` (64x64 PNG 8-bit) para copiar a `mass:/ART/` si deseás verlo en la lista APPS de OPL.
