# Subsuelo 04: El Acechador

Juego de **Survival Horror 3D en primera persona** para PlayStation 2 (probado en **PCSX2**), desarrollado en **JavaScript** sobre el motor [AthenaEnv V4](https://github.com/DanielSant0s/AthenaEnv) y la plantilla [Athena-PS2-Template](https://github.com/JSLegendDev/Athena-PS2-Template).

## Características principales

- **Motor Raycaster 3D de 320 columnas**: proyección plana exacta con *Z-buffer* para entidades, sombreado por distancia, cono de linterna dinámico, luces rojas de emergencia parpadeantes y balanceo de cámara.
- **IA con Pathfinding BFS (`src/ai.js`)**: *El Acechador* patrulla el mapa de `20x20`, investiga el ruido al correr y te persigue rodeando columnas y paredes. Si lo enfocás de frente con la linterna, se frena; si la apagás y te quedás quieto, pierde tu rastro.
- **Progresión y ambientación**:
  - **Disyuntor central**: desbloquea las rejas de seguridad hacia los sectores Este y Oeste.
  - **4 Fusibles** + **3 Baterías** + **4 Notas de registro** repartidas por las instalaciones.
  - **HUD estilo cámara VHS (`REC`)**, interferencia dinámica por proximidad, minimapa táctico opcional, vibración **DualShock 2** al ritmo de los latidos y secuencia de *jumpscare*.

## Controles (DualShock 2)

| Botón / Stick | Acción |
| :--- | :--- |
| **Stick Izquierdo / D-Pad** | Caminar y desplazarse lateralmente |
| **Stick Derecho / L1 - R1** | Girar la cámara en primera persona |
| **Círculo / Cuadrado** | Correr (consume *stamina* y genera ruido) |
| **Triángulo** | Encender / Apagar linterna (ahorra batería y reduce detección) |
| **Select** | Mostrar / Ocultar minimapa |
| **Start** | Iniciar / Pausar partida |

## Estructura del proyecto

```text
.
├── main.js              # Bucle principal, estados, HUD VHS, notas y jumpscare
├── src/
│   ├── map.js           # Mapa 20x20, colisiones, rejas y textos de lore
│   ├── ai.js            # Pathfinding BFS y máquina de 3 estados (Patrol/Investigate/Hunt)
│   ├── renderer.js      # Raycaster 3D de 320 columnas, Z-buffer y minimapa
│   ├── debugOverlay.js  # Utilidad de depuración de la plantilla
│   └── timer.js         # Temporizador auxiliar
├── assets/              # Recursos gráficos y fuentes
├── athena.elf           # Binario ejecutable de AthenaEnv para PS2
├── ATHA_000.01          # Ejecutable de arranque para ISO PS2
├── SYSTEM.CNF           # Descriptor de arranque PlayStation 2
└── athena.ini           # Configuración del runtime
```

## Cómo ejecutarlo en PCSX2

1. **Modo ISO (recomendado)**: comprimí todos los archivos de la raíz en un `.zip` (o usá el paquete tal cual), convertilo a `.iso` en [mconverter.eu](https://mconverter.eu) y abrilo en PCSX2 con **Sistema -> Iniciar disco**.
2. **Modo ELF directo**: en PCSX2 seleccioná **Sin disco (No Disc)**, activá **HostFS** en ajustes avanzados del sistema y cargá `athena.elf` desde **Sistema -> Iniciar archivo...**.

## Próximos pasos planificados

- Reemplazo de columnas sólidas por texturas `.png` con recorte vertical (`Image.startx` / `endx`).
- Sonido ambiental, pasos, latidos y efectos de *jumpscare* mediante `Sound` / `Sfx`.
