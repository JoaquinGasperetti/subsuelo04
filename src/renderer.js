// ============================================================================
// Renderizador 3D Ultra-Optimizado para PS2 Real (Emotion Engine 294MHz + GS)
// - Calidad dinámica sin allocaciones: 160 (Alta), 128 (Equilibrada), 96 (Rápida)
// - Agrupamiento de tramos (Span Batching) para detalles arquitectónicos en perspectiva
// - Colores empaquetados por bits (JS_TAG_INT) sin llamadas C a Color.new() en bucles
// - Sombreado Gouraud, rejas 3D transparentes, viewmodel, PDA y alerta direccional
// ============================================================================


const MAX_RAYS = 160;
const zBuffer = new Float64Array(MAX_RAYS);

// Tablas precalculadas para los 3 niveles de calidad (0 allocaciones por frame)
const QUALITY_TABLES = [];
for (let q = 0; q < QUALITY_RAYS.length; q++) {
    const n = QUALITY_RAYS[q];
    const camX = new Float64Array(n);
    const beamProf = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        const cx = (2.0 * (i - (-0.5)) / n) - 1.0;
        camX[i] = cx;
        const absCx = cx < 0 ? -cx : cx;
        const bp = 1.0 - absCx * 1.38;
        beamProf[i] = (bp > 0) ? (bp * bp) : 0.0;
    }
    QUALITY_TABLES.push({ numRays: n, camX, beamProf });
}

// Caché de coordenadas horizontales exactas por (screenW, numRays) para evitar huecos en cualquier resolución
let cachedColScreenW = -1;
let cachedColNumRays = -1;
const colStartX = new Int16Array(MAX_RAYS);
const colWidth  = new Int16Array(MAX_RAYS);

function ensureColLayout(screenW, numRays) {
    if (cachedColScreenW === screenW && cachedColNumRays === numRays) return;
    cachedColScreenW = screenW;
    cachedColNumRays = numRays;
    for (let i = 0; i < numRays; i++) {
        const x0 = ((i * screenW) / numRays) | 0;
        const x1 = (((i + 1) * screenW) / numRays) | 0;
        colStartX[i] = x0;
        colWidth[i]  = x1 - x0;
    }
}

// Colores estáticos precomputados
const ALPHA_OPAQUE    = (128 << 24) >>> 0;
const COL_HORIZON     = rgba(2, 2, 4, 128);
const COL_SPOT_FADE   = rgba(20, 28, 38, 0);
const COL_LOCK_BOX    = rgba(38, 40, 46, 128);
const COL_LOCK_LED    = rgba(255, 40, 30, 128);
const COL_CHEV_DARK   = rgba(20, 22, 25, 128);
const COL_DOOR_OPEN   = rgba(65, 255, 130, 128);
const COL_DOOR_LOCK   = rgba(255, 55, 35, 128);
const COL_SHADOW      = rgba(2, 2, 4, 92);
const COL_TORSO_BOT   = rgba(12, 4, 6, 128);
const COL_JAW         = rgba(18, 2, 4, 128);
const COL_EYE_GLOW    = rgba(255, 25, 25, 68);
const COL_EYE_RED     = rgba(255, 25, 20, 128);
const COL_EYE_CORE    = rgba(255, 210, 190, 128);
const COL_FUSE_HALO   = rgba(255, 185, 30, 42);
const COL_FUSE_BODY   = rgba(190, 140, 35, 128);
const COL_FUSE_CAP    = rgba(120, 95, 55, 128);
const COL_FUSE_CORE   = rgba(255, 245, 185, 128);
const COL_BAT_HALO    = rgba(30, 210, 255, 40);
const COL_BAT_TERM    = rgba(185, 195, 205, 128);
const COL_BAT_BODY    = rgba(22, 52, 68, 128);
const COL_BAT_BAR1    = rgba(70, 235, 255, 128);
const COL_BAT_BAR2    = rgba(185, 255, 255, 128);
const COL_BRK_HALO    = rgba(255, 45, 35, 48);
const COL_BRK_OUT     = rgba(75, 28, 28, 128);
const COL_BRK_IN      = rgba(185, 42, 38, 128);
const COL_BRK_WARN    = rgba(255, 220, 65, 128);
const COL_BRK_LEVER   = rgba(25, 25, 30, 128);
const COL_NOTE_HALO   = rgba(180, 210, 255, 36);
const COL_NOTE_PAGE   = rgba(232, 236, 244, 128);
const COL_NOTE_INK    = rgba(45, 55, 70, 128);
const COL_NOTE_BLOOD  = rgba(165, 40, 40, 128);
const COL_VIG_DARK    = rgba(0, 0, 4, 86);
const COL_VIG_CLEAR   = rgba(0, 0, 4, 0);
const COL_SLEEVE1     = rgba(24, 28, 34, 128);
const COL_SLEEVE2     = rgba(10, 12, 16, 128);
const COL_GLOVE       = rgba(38, 42, 48, 128);
const COL_GLOVE_HI    = rgba(54, 60, 68, 128);
const COL_FL_TOP      = rgba(92, 100, 114, 128);
const COL_FL_BOT      = rgba(26, 30, 36, 128);
const COL_FL_HEAD_T   = rgba(120, 130, 144, 128);
const COL_FL_HEAD_B   = rgba(42, 46, 54, 128);
const COL_LENS_ON     = rgba(245, 250, 255, 128);
const COL_LENS_OFF    = rgba(45, 55, 65, 128);
const COL_LED_OFF     = rgba(180, 35, 35, 128);
const COL_LED_LOW     = rgba(255, 165, 30, 128);
const COL_LED_OK      = rgba(55, 245, 115, 128);
const COL_MAGENTA     = rgba(255, 0, 255, 128);
const COL_EDGE_CLEAR  = rgba(210, 15, 15, 0);

// Pool estático para ordenar entidades sin crear objetos ni closures por frame
const MAX_DRAW_ENTITIES = 16;
const drawPool = [];
for (let i = 0; i < MAX_DRAW_ENTITIES; i++) {
    drawPool.push({ kind: "", x: 0.0, y: 0.0, distSq: 0.0 });
}

const renderStats = { cols: 0, minD: 99.0, maxD: 0.0, wallMode: 0, numRays: 128 };


// ============================================================================
// MOTOR 3D REAL POR HARDWARE PS2 (VU1 + VU0 + GS via AthenaEnv V4)
// Escala real: 1 celda del mapa = 2.0 m, techo = 2.6 m, ojos = 1.55 m
// El Acechador 3D se carga desde OBJ junto al escenario para evitar carga en partida.
// ============================================================================
const WORLD_CELL_SIZE = 2.0;
const WORLD_EYE_H = 1.55;

let hw3dAttempted = false;
let hw3dReady = false;
let hw3dLastWide = null;
let hwLightMain = -1;
let hwLightFill = -1;
let hwStaticObjs = [];
let hwGatesObj = null;
let hwPropObjs = {};
let hwEntityTransforms = [];
let hwLastFlashState = -1;
let hwPlayFrameCount = 0;
let hwVramLabel = "VRAM:--";
let hwStalkerObj = null;
// RenderObject conserva RenderData; retener Image evita que QuickJS libere sus texturas.
const hwKeptTextures = [];
// position/rotation se copian de forma sincrona; reutilizar evita crear objetos por draw.
const hwDrawPosition = { x: 0.0, y: 0.0, z: 0.0 };
const hwDrawRotation = { x: 0.0, y: 0.0, z: 0.0 };
let hwStalkerIsGltf = false;
let hwStalkerSource = "NONE";

// ============================================================================
// ANIMACION PROCEDURAL DEL ACECHADOR 3D (0 allocs/frame, LUT Float64, NTSC/PAL)
// ============================================================================
const STALKER_SIN_SIZE = 256;
const STALKER_SIN_MASK = 255;
const STALKER_TWO_PI = toF64(6.283185307179586);
const STALKER_RAD_TO_LUT = toF64(STALKER_SIN_SIZE / 6.283185307179586);
const STALKER_SIN_LUT = new Float64Array(STALKER_SIN_SIZE);
for (let i = 0; i < STALKER_SIN_SIZE; i++) {
    STALKER_SIN_LUT[i] = toF64(Math.sin((i * 6.283185307179586) / STALKER_SIN_SIZE));
}

function resetStalkerAnim(inst, x, y) {
    if (!inst) return;
    inst.animPhase = toF64(0.0);
    inst.animSpasmPhase = toF64(0.0);
    inst.animPrevX = toF64(x);
    inst.animPrevY = toF64(y);
    inst.animSpeed = toF64(0.0);
    inst.animYaw = toF64(0.0);
    inst.animYawInit = false;
    inst.animOutY = toF64(0.0);
    inst.animOutRx = toF64(0.0);
    inst.animOutRy = toF64(0.0);
    inst.animOutRz = toF64(0.0);
}

// Actualiza fase, orientacion suave (arco mas corto) y pose procedural por instancia
function updateStalkerAnim(inst, lookX, lookY, dtScale, hasLos, isBlinded) {
    if (!inst) return;
    const sx = toF64(inst.x);
    const sy = toF64(inst.y);

    const dt = clampF64(dtScale, 0.5, 2.0);
    const dx = sx - toF64(inst.animPrevX);
    const dy = sy - toF64(inst.animPrevY);
    inst.animPrevX = sx;
    inst.animPrevY = sy;

    const distSq = fadd(dx * dx, dy * dy);
    let moveDist = toF64(0.0);
    let moved = false;

    // Salto > 0.5 celdas en 1 cuadro = spawn o teletransporte (no interpretar como velocidad)
    if ((distSq - 0.25) > 0) {
        inst.animSpeed = toF64(0.0);
        inst.animYawInit = false;
    } else if ((distSq - 0.00000001) > 0) {
        moveDist = toF64(Math.sqrt(distSq));
        moved = true;
    }

    // Velocidad real normalizada a 60Hz (celdas por cuadro equivalente)
    const instSpeed = moveDist / dt;
    const speedAlpha = clampF64(0.22 * dt, 0.0, 1.0);
    const smoothSpeed = fadd(toF64(inst.animSpeed), (instSpeed - toF64(inst.animSpeed)) * speedAlpha);
    inst.animSpeed = smoothSpeed;

    // Perfil de movimiento segun estado de IA (default: AI_PATROL lento y pesado)
    let bobAmp = toF64(0.048);
    let rollAmp = toF64(0.056);
    let pitchBase = toF64(0.040);
    let pitchAmp = toF64(0.020);
    let freqScale = toF64(8.2);
    let turnRate = toF64(0.10);

    const st = inst.state;
    if (st === AI_INVESTIGATE) {
        bobAmp = toF64(0.032);
        rollAmp = toF64(0.036);
        pitchBase = toF64(0.065);
        pitchAmp = toF64(0.018);
        freqScale = toF64(9.0);
        turnRate = toF64(0.13);
    } else if (st === AI_CHASE_INTRO) {
        bobAmp = toF64(0.028);
        rollAmp = toF64(0.042);
        pitchBase = toF64(0.095);
        pitchAmp = toF64(0.024);
        freqScale = toF64(9.6);
        turnRate = toF64(0.18);
    } else if (st === AI_HUNT) {
        bobAmp = toF64(0.075);
        rollAmp = toF64(0.078);
        pitchBase = toF64(0.165);
        pitchAmp = toF64(0.045);
        freqScale = toF64(11.2);
        turnRate = toF64(0.22);
    }

    // Orientacion: gira hacia su movimiento y solo encara al jugador si lo caza o lo ve
    const facePlayer = (st === AI_HUNT) || (st === AI_CHASE_INTRO) || !!hasLos;
    let targetYaw = toF64(inst.animYaw);
    let hasTargetYaw = false;
    if (facePlayer) {
        targetYaw = toF64(Math.atan2(toF64(lookX) - sx, toF64(lookY) - sy));
        hasTargetYaw = true;
    } else if (moved) {
        targetYaw = toF64(Math.atan2(dx, dy));
        hasTargetYaw = true;
    } else if (!inst.animYawInit) {
        targetYaw = toF64(Math.atan2(toF64(lookX) - sx, toF64(lookY) - sy));
        hasTargetYaw = true;
    }

    if (hasTargetYaw) {
        if (!inst.animYawInit) {
            inst.animYaw = targetYaw;
            inst.animYawInit = true;
        } else {
            inst.animYaw = cinLerpAngle(inst.animYaw, targetYaw, clampF64(turnRate * dt, 0.0, 1.0));
        }
    }

    let targetY = toF64(0.0);
    let targetRx = pitchBase;
    let targetRz = toF64(0.0);
    let yawJitter = toF64(0.0);

    if (isBlinded) {
        // Frenado por linterna: espasmos cortos y retroceso leve usando 2 armonicos de la LUT
        let spPhase = fadd(toF64(inst.animSpasmPhase), 0.62 * dt);
        if ((spPhase - STALKER_TWO_PI) >= 0) spPhase = spPhase - STALKER_TWO_PI;
        inst.animSpasmPhase = spPhase;

        const spIdx = ((spPhase * STALKER_RAD_TO_LUT) | 0) & STALKER_SIN_MASK;
        const sp1 = STALKER_SIN_LUT[spIdx];
        const sp2 = STALKER_SIN_LUT[((spIdx * 3) + 41) & STALKER_SIN_MASK];
        const jerk = sp1 * sp2;

        targetY = (sp1 * sp1) * 0.018;
        targetRx = fadd(-0.070, sp2 * 0.075);
        targetRz = fadd(sp1 * 0.065, jerk * 0.060);
        yawJitter = sp2 * 0.070;
    } else {
        const moveAmp = clampF64(smoothSpeed / 0.014, 0.0, 1.15);
        if ((moveAmp - 0.02) > 0) {
            let phase = fadd(toF64(inst.animPhase), fadd(0.030, smoothSpeed * freqScale) * dt);
            if ((phase - STALKER_TWO_PI) >= 0) phase = phase - STALKER_TWO_PI;
            inst.animPhase = phase;
        }

        const idx = ((toF64(inst.animPhase) * STALKER_RAD_TO_LUT) | 0) & STALKER_SIN_MASK;
        const s = STALKER_SIN_LUT[idx];
        const c = STALKER_SIN_LUT[(idx + 64) & STALKER_SIN_MASK];

        // s*s mantiene Y >= 0 (2 apoyos suaves por zancada sin hundir los pies en el piso)
        targetY = (s * s) * bobAmp * moveAmp;
        targetRx = fadd(pitchBase, c * pitchAmp * moveAmp);
        targetRz = s * rollAmp * moveAmp;
    }

    const poseAlpha = clampF64((isBlinded ? 0.55 : 0.25) * dt, 0.0, 1.0);
    inst.animOutY  = fadd(toF64(inst.animOutY),  (targetY  - toF64(inst.animOutY))  * poseAlpha);
    inst.animOutRx = fadd(toF64(inst.animOutRx), (targetRx - toF64(inst.animOutRx)) * poseAlpha);
    inst.animOutRz = fadd(toF64(inst.animOutRz), (targetRz - toF64(inst.animOutRz)) * poseAlpha);
    inst.animOutRy = fadd(toF64(inst.animYaw), yawJitter);
}

// ============================================================================
// ARRANQUE RAPIDO (SOLO AUDIO) + STREAMING 3D PROGRESIVO (TITULO Y PARTIDA)
// AthenaEnv moderno inicializa el VU1 con Render.init() y abre cada cuadro 3D
// con Render.begin(); el modo 3D requiere esta API y el pase RenderObject.render().
// ============================================================================
let bootLoadStep = 0;
let bootLoadPhase = 0;
let bootLoadDone = false;
let bootSkipAudio = false;

const BOOT_LOAD_STEPS = [
    { kind: "audio_iop",   label: "AUDIO: MODULOS IOP" },
    { kind: "audio_amb",   label: "AUDIO: ambient.ogg" },
    { kind: "audio_chase", label: "AUDIO: chase.ogg" },
    { kind: "audio_play",  label: "ENTRANDO AL MENU..." }
];

const BOOT_PCT_LABELS = [
    "0%   (0/4)", "25%  (1/4)", "50%  (2/4)", "75%  (3/4)", "100% (4/4)"
];
const LOAD_SPINNERS = ["|", "/", "-", "\\"];

// Carga progresiva 3D en pantalla de carga dedicada (entre Menu Principal y Partida)
let hwStreamStep = 0;
let hwRenderInitDone = false;
let hwStreamCooldown = 4;
let hwStreamDone = false;
let hwStreamFailed = false;
let hwLoadErrorMsg = "";
let hwDrawFailed = false;
let mapLoadPhase = 0;
let hwLoadedChapterIdx = -1;
const hwTexCache = {};

const HW3D_STREAM_STEPS = [
    { kind: "init",    label: "MOTOR 3D (VU1 / CAMARA)" },
    { kind: "static",  obj: "assets/models/map_floor.obj",          tex: "assets/textures/floor.png",         clip: false, label: "MAPA: PISO" },
    { kind: "static",  obj: "assets/models/map_ceiling.obj",        tex: "assets/textures/ceiling.png",       clip: false, label: "MAPA: TECHO" },
    { kind: "static",  obj: "assets/models/map_walls_concrete.obj", tex: "assets/textures/wall_concrete.png", clip: true, label: "MAPA: PAREDES" },
    { kind: "static",  obj: "assets/models/map_walls_rust.obj",     tex: "assets/textures/wall_rust.png",     clip: true, label: "MAPA: ESTRUCTURAS" },
    { kind: "static",  obj: "assets/models/map_walls_ritual.obj",   tex: "assets/textures/wall_ritual.png",   clip: true, label: "MAPA: ZONA RITUAL" },
    { kind: "static",  obj: "assets/models/map_exit.obj",           tex: "assets/textures/exit_door.png",     clip: true, label: "MAPA: SALIDA NORTE" },
    { kind: "gates",   obj: "assets/models/map_gates.obj",          tex: "assets/textures/gate.png",          clip: true, label: "MAPA: REJAS" },
    { kind: "stalker", obj: "assets/models/stalker.obj",            tex: "assets/textures/stalker.png",       label: "ENEMIGO: ACECHADOR 3D" },
    { kind: "prop",    key: "fuse",    obj: "assets/models/fuse.obj",    tex: "assets/textures/fuse.png",     label: "ITEMS: FUSIBLES" },
    { kind: "prop",    key: "battery", obj: "assets/models/battery.obj", tex: "assets/textures/battery.png",  label: "ITEMS: BATERIAS" },
    { kind: "prop",    key: "breaker", obj: "assets/models/breaker.obj", tex: "assets/textures/breaker.png",  label: "ITEMS: DISYUNTOR" },
    { kind: "prop",    key: "note",    obj: "assets/models/note.obj",    tex: "assets/textures/note.png",     label: "ITEMS: NOTAS" }
];

function prepareChapter3D(chapterIdx) {
    const ch = CHAPTERS[chapterIdx] || CHAPTERS[0];
    const p = ch.meshPrefix || "map_";
    HW3D_STREAM_STEPS[1].obj = ["assets/models/", p, "floor.obj"].join("");
    HW3D_STREAM_STEPS[2].obj = ["assets/models/", p, "ceiling.obj"].join("");
    HW3D_STREAM_STEPS[3].obj = ["assets/models/", p, "walls_concrete.obj"].join("");
    HW3D_STREAM_STEPS[4].obj = ["assets/models/", p, "walls_rust.obj"].join("");
    HW3D_STREAM_STEPS[5].obj = ["assets/models/", p, "walls_ritual.obj"].join("");
    HW3D_STREAM_STEPS[6].obj = ["assets/models/", p, "exit.obj"].join("");
    HW3D_STREAM_STEPS[7].obj = ["assets/models/", p, "gates.obj"].join("");
    hwStaticObjs = [];
    hwGatesObj = null;
    hwStreamStep = 0;
    hwStreamDone = false;
    hwStreamFailed = false;
    hw3dReady = false;
    hwStreamCooldown = 2;
    hwLoadErrorMsg = "";
    hwLoadedChapterIdx = chapterIdx;
}

const MAP_PCT_LABELS = [
    "0%   (0/13)",  "8%   (1/13)",  "15%  (2/13)", "23%  (3/13)",
    "31%  (4/13)",  "38%  (5/13)",  "46%  (6/13)", "54%  (7/13)",
    "62%  (8/13)",  "69%  (9/13)",  "77%  (10/13)", "85% (11/13)",
    "92%  (12/13)", "100% (13/13)"
];

const STREAM_3D_BADGES = [
    "3D: 0/13",  "3D: 1/13",  "3D: 2/13",  "3D: 3/13",
    "3D: 4/13",  "3D: 5/13",  "3D: 6/13",  "3D: 7/13",
    "3D: 8/13",  "3D: 9/13",  "3D: 10/13", "3D: 11/13",
    "3D: 12/13", "3D VU1 LISTO"
];

function loadHwMesh(objPath, texPath, accurateClip = false) {
    if (!fileExistsSafe(objPath)) return null;
    try {
        let tex = null;
        if (texPath) {
            if (hwTexCache[texPath]) {
                tex = hwTexCache[texPath];
            } else if (fileExistsSafe(texPath)) {
                tex = new Image(texPath);
                hkFixProto(tex, Image);
                if (tex && typeof tex.optimize === "function") {
                    try { tex.optimize(); } catch (_) {}
                }
                if (tex) hwTexCache[texPath] = tex;
            }
        }
        const data = tex ? new RenderData(objPath, tex) : new RenderData(objPath);
        if (!data) return null;
        hkFixProto(data, RenderData);
        // El recorte preciso se ejecuta en el VU1 antes de enviar triángulos fuera
        // del volumen visible al GS. Reservarlo para paredes/rejas/salida mantiene
        // piso, techo y modelos pequeños en el camino rápido, sin crear meshes nuevos.
        try { data.accurate_clipping = !!accurateClip; } catch (_) {}
        try { data.face_culling = Render.CULL_FACE_NONE; } catch (_) {}
        try {
            data.pipeline = Render.PL_DEFAULT;
        } catch (_) {}
        const obj = new RenderObject(data);
        if (obj) {
            hkFixProto(obj, RenderObject);
            // Retener la textura solo después de crear el objeto: si falla la
            // carga, no dejamos imágenes/meshes huérfanos vivos hasta el final.
            if (tex && hwKeptTextures.indexOf(tex) === -1) hwKeptTextures.push(tex);
            obj.position = { x: 0.0, y: 0.0, z: 0.0 };
            obj.rotation = { x: 0.0, y: 0.0, z: 0.0 };
        }
        return obj;
    } catch (e) {
        hwLoadErrorMsg = e ? String(e) : "Error carga 3D";
        return null;
    }
}

function drawHwObject(obj, x, y, z, rx, ry, rz) {
    if (!obj) return;
    const useRender = (typeof obj.render === "function");
    if (useRender || typeof obj.draw === "function") {
        hwDrawPosition.x = x;
        hwDrawPosition.y = y;
        hwDrawPosition.z = z;
        hwDrawRotation.x = rx;
        hwDrawRotation.y = ry;
        hwDrawRotation.z = rz;
        obj.position = hwDrawPosition;
        obj.rotation = hwDrawRotation;
        if (useRender) obj.render(); else obj.draw();
        return;
    }
    // Sin render()/draw(): no lanzar. Se marca el fallo y render3DWorld cae al modo 2.5D
    // (el motivo queda en hwLoadErrorMsg y se ve en R2).
    if (!hwDrawFailed) {
        hwDrawFailed = true;
        hwLoadErrorMsg = "RenderObject sin render()/draw()";
    }
}

function loadHwStalker(objPath, texPath) {
    hwStalkerIsGltf = false;
    hwStalkerSource = "NONE";
    let obj = loadHwMesh(objPath, texPath, false);
    if (obj) {
        hwStalkerSource = "OBJ";
        return obj;
    }
    obj = loadHwMesh("assets/models/stalker_placeholder.obj", texPath, false);
    if (obj) {
        hwStalkerSource = "PROXY";
    }
    return obj;
}

function updateHw3dProjection() {
    const isWide = !!GAME_SETTINGS.aspect16x9;
    if (hw3dLastWide === isWide) return;
    hw3dLastWide = isWide;
    try {
        // Mantener el near plane corto evita que paredes cercanas desaparezcan
        // al mirar de costado. El far plane cubre la diagonal del escenario.
        Render.setView(isWide ? 60.0 : 54.0, 0.25, 52.0);
    } catch (e) {
        hwLoadErrorMsg = e ? String(e) : "Error Render.setView";
    }
}

function buildHwEntityTransforms() {
    hwEntityTransforms = [];
    for (let i = 0; i < entities.length; i++) {
        const e = entities[i];
        let y = 0.55;
        if (e.kind === "breaker" || e.kind === "locker" || e.kind === "npc") y = 0.0;
        else if (e.kind === "note") y = 0.04;
        else if (e.kind === "decoy") y = 0.42;
        hwEntityTransforms.push({
            position: {
                x: toF64(e.x) * WORLD_CELL_SIZE,
                y: y,
                z: toF64(e.y) * WORLD_CELL_SIZE
            },
            rotation: { x: 0.0, y: 0.0, z: 0.0 }
        });
    }
}

function stepBootLoad() {
    if (bootLoadDone) return true;
    const total = BOOT_LOAD_STEPS.length;
    if (bootLoadStep >= total) {
        bootLoadDone = true;
        return true;
    }
    const step = BOOT_LOAD_STEPS[bootLoadStep];
    try {
        if (step.kind === "audio_iop") {
            if (!bootSkipAudio && GAME_SETTINGS.audioVolume > 0 && typeof Sound !== "undefined" && Sound) {
                audioInitAttempted = true;
                ensureAudioIOP();
            }
        } else if (step.kind === "audio_amb") {
            if (!bootSkipAudio && GAME_SETTINGS.audioVolume > 0 && typeof Sound !== "undefined" && Sound && typeof Sound.Stream === "function") {
                const ambPath = resolveFirstExisting([
                    "assets/audio/ambient.ogg",
                    "assets/audio/ambient.wav",
                    "assets/ambient.ogg",
                    "assets/ambient.wav"
                ]);
                if (ambPath) {
                    try {
                        ambientStream = new Sound.Stream(ambPath);
                        if (ambientStream) ambientStream.loop = true;
                    } catch (_) {
                        ambientStream = null;
                    }
                }
            }
        } else if (step.kind === "audio_chase") {
            if (!bootSkipAudio && GAME_SETTINGS.audioVolume > 0 && typeof Sound !== "undefined" && Sound && typeof Sound.Stream === "function") {
                const chasePath = resolveFirstExisting([
                    "assets/audio/chase.ogg",
                    "assets/audio/chase.wav"
                ]);
                if (chasePath) {
                    try {
                        chaseStream = new Sound.Stream(chasePath);
                        if (chaseStream) chaseStream.loop = true;
                    } catch (_) {
                        chaseStream = null;
                    }
                }
            }
        } else if (step.kind === "audio_play") {
            if (!bootSkipAudio && (ambientStream || chaseStream)) {
                audioReady = true;
                audioPlaying = false;
                activeTrack = "ambient";
                lastAppliedVol = -1;
                applyAudioVolume(GAME_SETTINGS.audioVolume);
            }
        }
    } catch (_) {}

    bootLoadStep++;
    if (bootLoadStep >= total) {
        bootLoadDone = true;
        return true;
    }
    return false;
}

function tickProgressive3DStream() {
    if (GAME_SETTINGS.qualityIndex !== 0) return;
    if (hwStreamDone || hwStreamFailed) return;
    if (hwStreamCooldown > 0) {
        hwStreamCooldown--;
        return;
    }
    // Espaciar cada carga 10 cuadros (~0.17s) para streaming seguro en USB 1.1
    hwStreamCooldown = 10;

    const total = HW3D_STREAM_STEPS.length;
    if (hwStreamStep >= total) {
        hwStreamDone = true;
        return;
    }

    const step = HW3D_STREAM_STEPS[hwStreamStep];
    try {
        if (step.kind === "init") {
            hw3dAttempted = true;
            if (typeof Render === "undefined" || typeof Render.init !== "function" ||
                typeof Render.begin !== "function" || typeof Render.setView !== "function" ||
                typeof RenderData !== "function" || typeof RenderObject !== "function" ||
                !RenderObject.prototype ||
                (typeof RenderObject.prototype.render !== "function" && typeof RenderObject.prototype.draw !== "function") ||
                typeof Camera === "undefined" ||
                typeof Image !== "function" || !fileExistsSafe("assets/models/map_floor.obj")) {
                hwLoadErrorMsg = "AthenaEnv sin API VU1 moderna";
                hwStreamFailed = true;
                hw3dReady = false;
                return;
            }
            if (!screenDepthBufferReady) {
                hwLoadErrorMsg = "Z-buffer no disponible";
                hwStreamFailed = true;
                hw3dReady = false;
                return;
            }
            try { Screen.clearColor(rgba(4, 5, 8, 128)); } catch (_) {}
            if (!hwRenderInitDone) {
                // La API moderna separa la inicialización de la proyección.
                Render.init();
                hwRenderInitDone = true;
            }
            hw3dLastWide = null;
            updateHw3dProjection();
            if (hwLoadErrorMsg) {
                hwStreamFailed = true;
                hw3dReady = false;
                return;
            }
            if (typeof Camera.type === "function" && typeof Camera.LOOKAT !== "undefined") {
                Camera.type(Camera.LOOKAT);
            }

            hwLightMain = -1;
            hwLightFill = -1;
            if (typeof Lights !== "undefined") {
                let l0 = 0;
                let l1 = 1;
                try {
                    if (typeof Lights.new === "function") {
                        const a = Lights.new();
                        const b = Lights.new();
                        if (typeof a === "number" && a >= 0 && a <= 3) l0 = a;
                        if (typeof b === "number" && b >= 0 && b <= 3) l1 = b;
                    }
                } catch (_) {}
                hwLightMain = l0;
                hwLightFill = l1;
                try {
                    Lights.set(hwLightMain, Lights.DIRECTION, 0.0, -0.25, -1.0);
                    Lights.set(hwLightMain, Lights.AMBIENT, 0.16, 0.17, 0.20);
                    Lights.set(hwLightMain, Lights.DIFFUSE, 0.85, 0.82, 0.78);
                    Lights.set(hwLightFill, Lights.DIRECTION, 0.0, -1.0, 0.0);
                    Lights.set(hwLightFill, Lights.AMBIENT, 0.16, 0.18, 0.22);
                    Lights.set(hwLightFill, Lights.DIFFUSE, 0.28, 0.30, 0.36);
                } catch (_) {}
            }
            hwStaticObjs = [];
        } else if (step.kind === "static") {
            const o = loadHwMesh(step.obj, step.tex, !!step.clip);
            if (o) hwStaticObjs.push(o);
            if (hwStaticObjs.length >= 4 && hwStalkerObj) {
                hw3dReady = true;
            }
        } else if (step.kind === "stalker") {
            hwStalkerObj = loadHwStalker(step.obj, step.tex);
            if (hwStaticObjs.length >= 4 && hwStalkerObj) hw3dReady = true;
        } else if (step.kind === "gates") {
            hwGatesObj = loadHwMesh(step.obj, step.tex, !!step.clip);
        } else if (step.kind === "prop") {
            const o = loadHwMesh(step.obj, step.tex, false);
            if (o) hwPropObjs[step.key] = o;
        }
    } catch (e) {
        hwLoadErrorMsg = e ? String(e) : "Error stream 3D";
        hwStreamFailed = true;
        hw3dReady = false;
        return;
    }

    hwStreamStep++;
    if (hwStreamStep >= total) {
        hwStreamDone = true;
        if (hwStaticObjs.length > 0) hw3dReady = true;
    }
}

function drawLoadingScreen(screenW, screenH, fnt) {
    Draw.rect(0, 0, screenW, screenH, rgba(7, 6, 10, 128));

    const panelW = Math.min(548, screenW - 48);
    const panelH = 264;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    Draw.rect(px, py, panelW, panelH, rgba(16, 14, 22, 124));
    Draw.rect(px, py, panelW, 3, rgba(215, 38, 38, 128));
    Draw.rect(px, py + panelH - 2, panelW, 2, rgba(95, 25, 32, 128));
    Draw.rect(px, py, 2, panelH, rgba(95, 25, 32, 128));
    Draw.rect(px + panelW - 2, py, 2, panelH, rgba(95, 25, 32, 128));

    fnt.scale = Math.fround(1.0);
    fnt.color = rgba(242, 48, 48, 128);
    fnt.print(px + 24, py + 16, "SUBSUELO 04");

    fnt.scale = Math.fround(0.72);
    fnt.color = rgba(205, 210, 224, 128);
    fnt.print(px + 24, py + 56, "INICIANDO SISTEMA PS2");

    const total = BOOT_LOAD_STEPS.length;
    const clampedStep = bootLoadStep < 0 ? 0 : (bootLoadStep > total ? total : bootLoadStep);
    const barX = px + 24;
    const barY = py + 94;
    const barW = panelW - 48;
    const barH = 28;
    const fillW = ((barW * clampedStep) / total) | 0;

    Draw.rect(barX - 2, barY - 2, barW + 4, barH + 4, rgba(130, 45, 55, 128));
    Draw.rect(barX, barY, barW, barH, rgba(24, 22, 32, 128));
    if (fillW > 0) {
        Draw.rect(barX, barY, fillW, barH, rgba(210, 34, 42, 128));
        Draw.rect(barX, barY, fillW, 5, rgba(255, 110, 95, 128));
    }

    fnt.scale = Math.fround(0.74);
    fnt.color = rgba(255, 232, 160, 128);
    fnt.print(barX, barY + 38, BOOT_PCT_LABELS[clampedStep] || "0%   (0/4)");

    const spinIdx = ((frameTick >> 2) & 3);
    fnt.scale = Math.fround(0.74);
    fnt.color = rgba(110, 230, 255, 128);
    fnt.print(barX + barW - 122, barY + 38, "ACTIVO");
    fnt.print(barX + barW - 22, barY + 38, LOAD_SPINNERS[spinIdx]);

    const scanY = barY + 72;
    const scanW = 54;
    const scanMax = barW - scanW;
    const cycle = (frameTick * 6) % (scanMax * 2);
    const scanOff = cycle <= scanMax ? cycle : (scanMax * 2 - cycle);
    Draw.rect(barX, scanY, barW, 5, rgba(32, 36, 48, 128));
    Draw.rect(barX + scanOff, scanY, scanW, 5, rgba(90, 220, 255, 128));

    const curStep = BOOT_LOAD_STEPS[clampedStep < total ? clampedStep : (total - 1)];
    fnt.scale = Math.fround(0.72);
    fnt.color = rgba(238, 240, 248, 128);
    fnt.print(barX, barY + 88, curStep ? curStep.label : "LISTO");

    fnt.scale = Math.fround(0.70);
    fnt.color = rgba(185, 195, 212, 128);
    fnt.print(barX, py + panelH - 34, "[CIRCULO] ENTRAR SIN AUDIO");
}

function stepOneMapLoad() {
    if (hwStreamDone || hwStreamFailed) return true;
    hwStreamCooldown = 0;
    tickProgressive3DStream();
    return hwStreamDone || hwStreamFailed;
}

function drawMapLoadingScreen(screenW, screenH, fnt) {
    Draw.rect(0, 0, screenW, screenH, rgba(6, 5, 10, 128));

    const panelW = Math.min(548, screenW - 48);
    const panelH = 268;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    Draw.rect(px, py, panelW, panelH, rgba(16, 14, 22, 124));
    Draw.rect(px, py, panelW, 3, rgba(215, 38, 38, 128));
    Draw.rect(px, py + panelH - 2, panelW, 2, rgba(95, 25, 32, 128));
    Draw.rect(px, py, 2, panelH, rgba(95, 25, 32, 128));
    Draw.rect(px + panelW - 2, py, 2, panelH, rgba(95, 25, 32, 128));

    fnt.scale = Math.fround(0.95);
    fnt.color = rgba(242, 48, 48, 128);
    fnt.print(px + 24, py + 16, "CARGANDO SUBSUELO 04");

    fnt.scale = Math.fround(0.72);
    fnt.color = rgba(205, 210, 224, 128);
    fnt.print(px + 24, py + 54, "CARGANDO MAPA 3D Y ACECHADOR");

    const total = HW3D_STREAM_STEPS.length;
    const clampedStep = hwStreamStep < 0 ? 0 : (hwStreamStep > total ? total : hwStreamStep);
    const barX = px + 24;
    const barY = py + 92;
    const barW = panelW - 48;
    const barH = 28;
    const fillW = ((barW * clampedStep) / total) | 0;

    Draw.rect(barX - 2, barY - 2, barW + 4, barH + 4, rgba(130, 45, 55, 128));
    Draw.rect(barX, barY, barW, barH, rgba(24, 22, 32, 128));
    if (fillW > 0) {
        Draw.rect(barX, barY, fillW, barH, rgba(210, 34, 42, 128));
        Draw.rect(barX, barY, fillW, 5, rgba(255, 110, 95, 128));
    }

    fnt.scale = Math.fround(0.74);
    fnt.color = rgba(255, 232, 160, 128);
    fnt.print(barX, barY + 38, MAP_PCT_LABELS[clampedStep] || "0%   (0/13)");

    const spinIdx = ((frameTick >> 2) & 3);
    fnt.scale = Math.fround(0.74);
    fnt.color = rgba(110, 230, 255, 128);
    fnt.print(barX + barW - 122, barY + 38, "CARGANDO");
    fnt.print(barX + barW - 22, barY + 38, LOAD_SPINNERS[spinIdx]);

    const scanY = barY + 72;
    const scanW = 54;
    const scanMax = barW - scanW;
    const cycle = (frameTick * 6) % (scanMax * 2);
    const scanOff = cycle <= scanMax ? cycle : (scanMax * 2 - cycle);
    Draw.rect(barX, scanY, barW, 5, rgba(32, 36, 48, 128));
    Draw.rect(barX + scanOff, scanY, scanW, 5, rgba(90, 220, 255, 128));

    const curStep = HW3D_STREAM_STEPS[clampedStep < total ? clampedStep : (total - 1)];
    fnt.scale = Math.fround(0.72);
    fnt.color = rgba(238, 240, 248, 128);
    fnt.print(barX, barY + 88, hwStreamFailed ? hwLoadErrorMsg : (curStep ? curStep.label : "ENTRANDO AL MAPA..."));

    fnt.scale = Math.fround(0.70);
    fnt.color = rgba(185, 195, 212, 128);
    fnt.print(barX, py + panelH - 34, hwStreamFailed ? "[CIRCULO] CONTINUAR (2.5D)" : "[CIRCULO] JUGAR EN 3D VU1");
}

function renderHardware3DWorld(
    screenW, screenH, player, stalker, entities,
    dangerRatio, frameTick, exitUnlocked, flashIntensity, mapAnim, sideBias
) {
    updateHw3dProjection();

    const px = toF64(player.x);
    const py = toF64(player.y);
    const pang = toF64(player.ang);
    const pbob = toF64(player.bobPhase);
    const pbat = toF64(player.battery);
    const dRatio = toF64(dangerRatio);
    const fInt = toF64(flashIntensity);
    const mAnim = toF64(mapAnim);
    const sBias = toF64(sideBias);

    const dirX = toF64(Math.cos(pang));
    const dirZ = toF64(Math.sin(pang));
    const camX = px * WORLD_CELL_SIZE;
    const camZ = py * WORLD_CELL_SIZE;

    const flashActive = player.flashlightOn && ((pbat - 0.0) > 0);
    const lowFlicker = (flashActive && ((pbat - 24.0) < 0) && (frameTick % 9 === 0 || frameTick % 23 === 0)) ? 0.30 : 1.0;
    const effFlash = toF64(flashActive ? (fInt * lowFlicker) : 0.0);

    const lPow = 0.22 + effFlash * 0.92;
    const redTint = dRatio * 0.38;

    // Activar Z-buffer (DEPTH_TEST_ENABLE) durante el pase 3D VU1 y desactivarlo para 2D/HUD
    const hasDepthToggle = (typeof Screen.setParam === "function" && typeof Screen.DEPTH_TEST_ENABLE !== "undefined");
    if (hasDepthToggle) {
        try {
            // AthenaEnv renderiza con Z invertido: fijar GEQUAL explicitamente evita
            // depender del estado GS que haya dejado el menu o un pase 2D anterior.
            if (typeof Screen.DEPTH_TEST_METHOD !== "undefined" && typeof Screen.DEPTH_GEQUAL !== "undefined") {
                Screen.setParam(Screen.DEPTH_TEST_METHOD, Screen.DEPTH_GEQUAL);
            }
            Screen.setParam(Screen.DEPTH_TEST_ENABLE, true);
        } catch (_) {}
    }
    try {
        Render.begin();
        // Camera.target conserva el desplazamiento del objetivo anterior y mueve
        // la posición de cámara. Por eso se fija la posición al final en cada frame.
        const camY = (player.eyeH !== undefined) ? toF64(player.eyeH) : WORLD_EYE_H;
        const targetY = (player.pitchY !== undefined) ? fadd(camY, toF64(player.pitchY)) : camY;
        Camera.target(camX + dirX * 4.0, targetY, camZ + dirZ * 4.0);
        Camera.position(camX, camY, camZ);
        Camera.update();

        // Actualizar luz principal solo cuando cambia la linterna (cero spam a C por cuadro)
        const flashStateBit = flashActive ? 1 : 0;
        if (hwLightMain >= 0 && hwLightMain <= 3 && flashStateBit !== hwLastFlashState) {
            hwLastFlashState = flashStateBit;
            const lp = flashActive ? 1.05 : 0.25;
            Lights.set(hwLightMain, Lights.DIRECTION, 0.0, -0.35, -1.0);
            Lights.set(hwLightMain, Lights.AMBIENT, flashActive ? 0.24 : 0.12, flashActive ? 0.24 : 0.13, flashActive ? 0.26 : 0.16);
            Lights.set(hwLightMain, Lights.DIFFUSE, lp, lp * 0.96, lp * 0.90);
        }

        // 1. Escenario estatico 3D
        for (let i = 0; i < hwStaticObjs.length; i++) {
            drawHwObject(hwStaticObjs[i], 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
        }
        // 2. Rejas 3D
        if (hwGatesObj && !breakerActive) {
            drawHwObject(hwGatesObj, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
        }

        // 3. Items 3D: reutilizar un RenderObject por tipo evita agotar recursos nativos de PS2.
        const spinY = toF64(frameTick * 0.03);
        const bobY = toF64(Math.sin(frameTick * 0.08) * 0.08);
        for (let i = 0; i < entities.length; i++) {
            const e = entities[i];
            if (e.taken) continue;
            let prop = hwPropObjs[e.kind];
            if (!prop) {
                if (e.kind === "decoy") prop = hwPropObjs.battery;
                else if (e.kind === "locker") prop = hwPropObjs.breaker;
                else if (e.kind === "npc") prop = hwStalkerObj;
            }
            if (!prop) continue;
            const dxC = toF64(e.x) - px;
            const dyC = toF64(e.y) - py;
            if ((dxC * dxC + dyC * dyC) > 81.0) continue;
            const pose = hwEntityTransforms[i];
            if (!pose) continue;
            const isStatic = (e.kind === "breaker" || e.kind === "note" || e.kind === "locker" || e.kind === "npc");
            if (!isStatic) pose.position.y = (e.kind === "decoy" ? 0.42 : 0.55) + bobY;
            pose.rotation.y = isStatic ? 0.0 : spinY;
            drawHwObject(prop,
                pose.position.x, pose.position.y, pose.position.z,
                pose.rotation.x, pose.rotation.y, pose.rotation.z);
        }

        // 4. El Acechador en 3D (visible hasta 30m / 15 celdas)
        if (hwStalkerObj) {
            const sdxC = toF64(stalker.x) - px;
            const sdyC = toF64(stalker.y) - py;
            if ((sdxC * sdxC + sdyC * sdyC) <= 225.0) {
                const sx = toF64(stalker.x) * WORLD_CELL_SIZE;
                const sz = toF64(stalker.y) * WORLD_CELL_SIZE;
                drawHwObject(
                    hwStalkerObj,
                    sx, stalker.animOutY, sz,
                    stalker.animOutRx, stalker.animOutRy, stalker.animOutRz
                );
            }
        }
    } finally {
        if (hasDepthToggle) {
            try { Screen.setParam(Screen.DEPTH_TEST_ENABLE, false); } catch (_) {}
        }
    }

    // 5. Linterna en mano (viewmodel 2D) y vineta sutil (solo en juego activo)
    if (gameState === STATE_PLAY) {
        const enableBob = GAME_SETTINGS.bob;
        const vmBobOffset = enableBob ? ((Math.sin(pbob) * 3.0) | 0) : 0;
        const vmSwayOffset = enableBob ? ((Math.cos(pbob * 0.5) * 2.0) | 0) : 0;
        if (GAME_SETTINGS.viewmodel) {
            renderFlashlightViewmodel(screenW, screenH, effFlash, pbat, vmBobOffset, vmSwayOffset, mAnim, frameTick);
        }
        if (GAME_SETTINGS.overlays && (dRatio - 0.22) > 0) {
            const absBias = sBias < 0 ? -sBias : sBias;
            if ((absBias - 0.18) > 0) {
                let edgeAlpha = (dRatio * absBias * 84.0) | 0;
                if (edgeAlpha > 88) edgeAlpha = 88;
                const edgeCol = rgba(220, 18, 22, edgeAlpha);
                if (sBias < 0) Draw.rect(0, 0, 22, screenH, edgeCol);
                else Draw.rect(screenW - 22, 0, 22, screenH, edgeCol);
            }
        }
    }
}

function render3DWorld(
    screenW, screenH, grid, player, stalker, entities,
    dangerRatio, frameTick, exitUnlocked, fov, flashIntensity,
    mapAnim = 0.0, sideBias = 0.0
) {
    if (hw3dReady && GAME_SETTINGS.qualityIndex === 0 && (gameState === STATE_PLAY || gameState === STATE_CINEMATIC)) {
        hwDrawFailed = false;
        try {
            renderHardware3DWorld(
                screenW, screenH, player, stalker, entities,
                dangerRatio, frameTick, exitUnlocked, flashIntensity, mapAnim, sideBias
            );
        } catch (e) {
            hwDrawFailed = true;
            hwLoadErrorMsg = e ? String(e) : "Error render 3D";
        }
        restore2DRenderState(screenW, screenH);
        if (!hwDrawFailed) return;
        hw3dReady = false;
        hwStreamFailed = true;
    }
    const qIdx = (gameState === STATE_PLAY || gameState === STATE_CINEMATIC) ? GAME_SETTINGS.qualityIndex : 2;
    const qTable = QUALITY_TABLES[qIdx] || QUALITY_TABLES[1];
    const numRays = qTable.numRays;
    const CAM_X = qTable.camX;
    const BEAM_PROF = qTable.beamProf;
    ensureColLayout(screenW, numRays);
    renderStats.numRays = numRays;

    const px = toF64(player.x);
    const py = toF64(player.y);
    const pang = toF64(player.ang);
    const pbob = toF64(player.bobPhase);
    const pbat = toF64(player.battery);
    const dRatio = toF64(dangerRatio);
    const fovVal = toF64(fov);
    const fInt = toF64(flashIntensity);
    const mAnim = toF64(mapAnim);
    const sBias = toF64(sideBias);

    const enableBob = GAME_SETTINGS.bob;
    const enableOverlays = GAME_SETTINGS.overlays;
    const enableViewmodel = GAME_SETTINGS.viewmodel;
    const enableParticles = GAME_SETTINGS.particles && enableOverlays;

    // Horizonte 100% fijo y estable para evitar mareo 3D; el balanceo sutil solo afecta a la linterna en mano
    const vmBobOffset = enableBob ? ((Math.sin(pbob) * 3.0) | 0) : 0;
    const vmSwayOffset = enableBob ? ((Math.cos(pbob * 0.5) * 2.0) | 0) : 0;
    const halfH = screenH >> 1;

    const flashActive = player.flashlightOn && ((pbat - 0.0) > 0);
    const lowFlicker = (flashActive && ((pbat - 24.0) < 0) && (frameTick % 9 === 0 || frameTick % 23 === 0)) ? 0.28 : 1.0;
    const effFlash = toF64(flashActive ? (fInt * lowFlicker) : 0.0);
    const emerPulse = 0.65 - (-(Math.sin(frameTick * 0.09) * 0.35));
    const emerFlicker = toF64(((frameTick % 97) < 6) ? 0.35 : emerPulse);

    // ------------------------------------------------------------------------
    // 1. TECHO Y PISO GOURAUD POR HARDWARE + CONO VOLUMETRICO DE LINTERNA
    // ------------------------------------------------------------------------
    const redPulse = (dRatio * 36.0) | 0;
    const ceilTopCol = rgba(14 + redPulse, 16, 22, 128);
    const ceilMidCol = rgba(7 + (redPulse >> 1), 8, 12, 128);
    const floorMidCol = rgba(12 + (redPulse >> 1), 14, 18, 128);
    const floorBotCol = rgba(26 + redPulse, 25, 30, 128);

    const midCeilY = (halfH * 0.55) | 0;
    const floorMidY = halfH + (((screenH - halfH) * 0.45) | 0);

    Draw.quad(0, 0, screenW, 0, 0, midCeilY, screenW, midCeilY, ceilTopCol, ceilTopCol, ceilMidCol, ceilMidCol);
    Draw.quad(0, midCeilY, screenW, midCeilY, 0, halfH, screenW, halfH, ceilMidCol, ceilMidCol, COL_HORIZON, COL_HORIZON);
    Draw.quad(0, halfH, screenW, halfH, 0, floorMidY, screenW, floorMidY, COL_HORIZON, COL_HORIZON, floorMidCol, floorMidCol);
    Draw.quad(0, floorMidY, screenW, floorMidY, 0, screenH, screenW, screenH, floorMidCol, floorMidCol, floorBotCol, floorBotCol);

    // Proyeccion volumetrica del haz de linterna en piso y techo (2 quads Gouraud)
    if ((effFlash - 0.05) > 0) {
        const spotCx = (screenW >> 1) + vmSwayOffset;
        let spotAlpha = (effFlash * 44.0) | 0;
        if (spotAlpha > 72) spotAlpha = 72;
        const spotHotCol = rgba(195, 215, 240, spotAlpha);
        Draw.quad(
            spotCx - 28, halfH + 6,
            spotCx + 28, halfH + 6,
            spotCx - 230, screenH,
            spotCx + 230, screenH,
            COL_SPOT_FADE, COL_SPOT_FADE, spotHotCol, spotHotCol
        );
        const ceilHotCol = rgba(150, 175, 205, spotAlpha >> 1);
        Draw.quad(
            spotCx - 170, 0,
            spotCx + 170, 0,
            spotCx - 24, halfH - 6,
            spotCx + 24, halfH - 6,
            ceilHotCol, ceilHotCol, COL_SPOT_FADE, COL_SPOT_FADE
        );
    }

    const dirX = toF64(Math.cos(pang));
    const dirY = toF64(Math.sin(pang));
    // Corrección geométrica real 16:9 vs 4:3 (la TV 16:9 estira 4:3 horizontalmente 1.333x)
    const isWide = GAME_SETTINGS.aspect16x9;
    const basePlane = toF64(Math.tan(fovVal * 0.5));
    const planeScale = isWide ? toF64(basePlane * 1.3333) : basePlane;
    const wallProjH = toF64(screenH * 0.92);
    const spriteAspectX = isWide ? toF64(0.75) : toF64(1.0);
    const planeX = -dirY * planeScale;
    const planeY =  dirX * planeScale;

    renderStats.cols = 0;
    renderStats.minD = toF64(99.0);
    renderStats.maxD = toF64(0.0);

    // Variables de Span Batching por celda de muro
    let spanKey = -1;
    let spanHit = 0;
    let spanX0 = 0;
    let spanX1 = 0;
    let spanTop0 = 0, spanBot0 = 0, spanH0 = 0;
    let spanTop1 = 0, spanBot1 = 0, spanH1 = 0;
    let spanCR = 0, spanCG = 0, spanCB = 0;
    let spanCR1 = 0, spanCG1 = 0, spanCB1 = 0;

    // ------------------------------------------------------------------------
    // 2. RAYCASTING DDA + AGRUPAMIENTO POR TRAMOS (SPAN BATCH)
    // ------------------------------------------------------------------------
    for (let i = 0; i < numRays; i++) {
        const camX = CAM_X[i];
        const rayDirX = dirX - (-planeX * camX);
        const rayDirY = dirY - (-planeY * camX);

        let mapX = px | 0;
        let mapY = py | 0;

        const absRayX = rayDirX < 0 ? -rayDirX : rayDirX;
        const absRayY = rayDirY < 0 ? -rayDirY : rayDirY;
        const deltaDistX = (absRayX - 1e-9) < 0 ? 1e30 : (1.0 / absRayX);
        const deltaDistY = (absRayY - 1e-9) < 0 ? 1e30 : (1.0 / absRayY);

        let stepX = 0, stepY = 0;
        let sideDistX = F64_ZERO, sideDistY = F64_ZERO;

        if (rayDirX < 0) {
            stepX = -1;
            sideDistX = (px - mapX) * deltaDistX;
        } else {
            stepX = 1;
            sideDistX = (mapX - (-1.0) - px) * deltaDistX;
        }

        if (rayDirY < 0) {
            stepY = -1;
            sideDistY = (py - mapY) * deltaDistY;
        } else {
            stepY = 1;
            sideDistY = (mapY - (-1.0) - py) * deltaDistY;
        }

        let hit = 0;
        let side = 0;
        let steps = 0;

        let hasGate = false;
        let gateDist = F64_ZERO;
        let gateSide = 0;

        while (hit === 0 && steps < 48) {
            steps++;
            if ((sideDistX - sideDistY) < 0) {
                sideDistX = sideDistX - (-deltaDistX);
                mapX += stepX;
                side = 0;
            } else {
                sideDistY = sideDistY - (-deltaDistY);
                mapY += stepY;
                side = 1;
            }
            if (mapX < 0 || mapX >= MAP_W || mapY < 0 || mapY >= MAP_H) {
                hit = 1;
                break;
            }
            const cell = grid[mapY][mapX];
            if (cell === 5) {
                if (!hasGate) {
                    hasGate = true;
                    gateDist = (side === 0) ? (sideDistX - deltaDistX) : (sideDistY - deltaDistY);
                    gateSide = side;
                }
            } else if (cell > 0) {
                hit = cell;
            }
        }

        if (hit === 0) {
            zBuffer[i] = toF64(1e20);
            continue;
        }
        if (hasGate) {
            if (gateDist !== gateDist || gateDist > 1e20) hasGate = false;
            else if ((gateDist - 0.14) < 0) gateDist = toF64(0.14);
        }
        let perpDist = (side === 0) ? (sideDistX - deltaDistX) : (sideDistY - deltaDistY);
        if (perpDist !== perpDist || perpDist > 1e20) {
            zBuffer[i] = toF64(1e20);
            continue;
        }
        if ((perpDist - 0.14) < 0) perpDist = toF64(0.14);
        zBuffer[i] = perpDist;

        const screenX = colStartX[i];
        const colW = colWidth[i];
        const wallH = (wallProjH / perpDist) | 0;
        const rawStart = halfH - (wallH >> 1);
        const rawEnd = rawStart + wallH;
        const drawStart = Math.max(0, Math.min(screenH, rawStart));
        const drawEnd = Math.max(0, Math.min(screenH, rawEnd));
        const clippedH = drawEnd - drawStart;

        const beam = ((effFlash - 0.0) > 0) ? (BEAM_PROF[i] * effFlash) : 0.0;
        const maxVis = ((effFlash - 0.0) > 0) ? (7.5 - (-beam * 8.5)) : 4.2;

        if (clippedH > 0) {
            let light = 1.0 - (perpDist / maxVis);
            if ((light - 0.10) < 0) light = 0.10;
            if (side === 1) light *= 0.74;
            const distFactor = 1.0 - perpDist * 0.087;
            if ((distFactor - 0.0) > 0) {
                light = light - (-(beam * 0.45 * distFactor));
            }
            if ((light - 1.25) > 0) light = 1.25;

            let wallX = (side === 0) ? (py - (-perpDist * rayDirY)) : (px - (-perpDist * rayDirX));
            wallX -= (wallX | 0);

            const isEdgeSeam = ((wallX - 0.04) < 0 || (wallX - 0.96) > 0);
            const isPanel = (((wallX * 4.0) | 0) & 1) === 0;
            if (isEdgeSeam) light *= 0.50;
            else if (isPanel) light *= 0.93;

            let r = 98, g = 106, b = 116;
            if (hit === 2) {
                r = 136; g = 76; b = 54;
            } else if (hit === 3) {
                r = (92.0 - (-72.0 * emerFlicker)) | 0;
                g = 26;
                b = 28;
            } else if (hit === 4) {
                r = exitUnlocked ? 42 : 148;
                g = exitUnlocked ? 210 : 108;
                b = exitUnlocked ? 95 : 38;
            }

            let cR = ((r * light) - (-dRatio * 26.0)) | 0;
            let cG = (g * light) | 0;
            let cB = (b * light) | 0;
            if (cR > 255) cR = 255;
            if (cG > 255) cG = 255;
            if (cB > 255) cB = 255;

            renderStats.cols++;
            if ((perpDist - renderStats.minD) < 0) renderStats.minD = perpDist;
            if ((perpDist - renderStats.maxD) > 0) renderStats.maxD = perpDist;

            if (renderStats.wallMode === 1) {
                Draw.rect(screenX, drawStart, colW, clippedH, COL_MAGENTA);
            }

            const cellKey = (mapY << 7) | (mapX << 1) | side;
            if (cellKey === spanKey) {
                spanX1 = screenX + colW;
                spanTop1 = drawStart;
                spanBot1 = drawEnd;
                spanH1 = wallH;
                spanCR1 = cR;
                spanCG1 = cG;
                spanCB1 = cB;
            } else {
                if (spanKey !== -1 && renderStats.wallMode === 0) {
                    flushWallSpan(screenH, spanHit, spanX0, spanX1, spanTop0, spanBot0, spanH0, spanTop1, spanBot1, spanH1, spanCR, spanCG, spanCB, spanCR1, spanCG1, spanCB1, exitUnlocked, emerFlicker);
                }
                spanKey = cellKey;
                spanHit = hit;
                spanX0 = screenX;
                spanX1 = screenX + colW;
                spanTop0 = drawStart;
                spanBot0 = drawEnd;
                spanH0 = wallH;
                spanTop1 = drawStart;
                spanBot1 = drawEnd;
                spanH1 = wallH;
                spanCR = cR;
                spanCG = cG;
                spanCB = cB;
                spanCR1 = cR;
                spanCG1 = cG;
                spanCB1 = cB;
            }
        }

        // --------------------------------------------------------------------
        // 2B. REJAS DE SEGURIDAD 3D TRANSPARENTES
        // --------------------------------------------------------------------
        if (hasGate) {
            if (spanKey !== -1 && renderStats.wallMode === 0) {
                flushWallSpan(screenH, spanHit, spanX0, spanX1, spanTop0, spanBot0, spanH0, spanTop1, spanBot1, spanH1, spanCR, spanCG, spanCB, spanCR1, spanCG1, spanCB1, exitUnlocked, emerFlicker);
                spanKey = -1;
            }
            const gWallH = (wallProjH / gateDist) | 0;
            const gRawStart = halfH - (gWallH >> 1);
            const gRawEnd = gRawStart + gWallH;
            const gStart = Math.max(0, Math.min(screenH, gRawStart));
            const gEnd = Math.max(0, Math.min(screenH, gRawEnd));
            const gClippedH = gEnd - gStart;

            if (gClippedH > 0) {
                let gWX = (gateSide === 0) ? (py - (-gateDist * rayDirY)) : (px - (-gateDist * rayDirX));
                gWX -= (gWX | 0);

                let gLight = 1.0 - (gateDist / maxVis);
                if ((gLight - 0.16) < 0) gLight = 0.16;
                if (gateSide === 1) gLight *= 0.78;

                const barScaled = gWX * 7.0;
                const barFrac = barScaled - (barScaled | 0);

                if ((barFrac - 0.34) < 0) {
                    const metal = gLight * 0.95;
                    let bR = ((115 * metal) - (-dRatio * 20.0)) | 0;
                    let bG = (125 * metal) | 0;
                    let bB = (138 * metal) | 0;
                    if (bR > 255) bR = 255;
                    if (bG > 255) bG = 255;
                    if (bB > 255) bB = 255;
                    Draw.rect(screenX, gStart, colW, gClippedH, (bR | (bG << 8) | (bB << 16) | ALPHA_OPAQUE) >>> 0);
                    zBuffer[i] = gateDist;
                } else {
                    const crossH = Math.max(2, (gWallH * 0.05) | 0);
                    const midBarY = gRawStart + (gWallH >> 1);
                    if (midBarY >= gStart && midBarY + crossH <= gEnd) {
                        Draw.rect(screenX, midBarY, colW, crossH, rgba((75 * gLight) | 0, (82 * gLight) | 0, (92 * gLight) | 0, 128));
                    }
                }

                if ((gWX - 0.44) > 0 && (gWX - 0.56) < 0) {
                    const lbY = gRawStart + ((gWallH * 0.44) | 0);
                    const lbH = Math.max(4, (gWallH * 0.12) | 0);
                    if (lbY >= gStart && lbY + lbH <= gEnd) {
                        Draw.rect(screenX, lbY, colW, lbH, ((frameTick & 15) < 10) ? COL_LOCK_LED : COL_LOCK_BOX);
                    }
                }
            }
        }
    }

    if (spanKey !== -1 && renderStats.wallMode === 0) {
        flushWallSpan(screenH, spanHit, spanX0, spanX1, spanTop0, spanBot0, spanH0, spanTop1, spanBot1, spanH1, spanCR, spanCG, spanCB, spanCR1, spanCG1, spanCB1, exitUnlocked, emerFlicker);
    }

    // ------------------------------------------------------------------------
    // 3. PROYECCION 3D DE ENTIDADES Y EL ACECHADOR (SIN ALLOCACIONES)
    // ------------------------------------------------------------------------
    let drawCount = 0;
    for (let e = 0; e < entities.length; e++) {
        const ent = entities[e];
        if (!ent.taken && drawCount < MAX_DRAW_ENTITIES - 1) {
            const slot = drawPool[drawCount++];
            slot.kind = ent.kind;
            slot.x = toF64(ent.x);
            slot.y = toF64(ent.y);
            const dx = slot.x - px;
            const dy = slot.y - py;
            slot.distSq = (dx * dx) - (-(dy * dy));
        }
    }
    {
        const slot = drawPool[drawCount++];
        slot.kind = "stalker";
        slot.x = toF64(stalker.x);
        slot.y = toF64(stalker.y);
        const dx = slot.x - px;
        const dy = slot.y - py;
        slot.distSq = (dx * dx) - (-(dy * dy));
    }

    for (let i = 1; i < drawCount; i++) {
        const tmp = drawPool[i];
        const tmpDist = tmp.distSq;
        let j = i - 1;
        while (j >= 0 && (drawPool[j].distSq - tmpDist) < 0) {
            drawPool[j + 1] = drawPool[j];
            j--;
        }
        drawPool[j + 1] = tmp;
    }

    const rawDet = planeX * dirY - dirX * planeY;
    const invDet = (Math.abs(rawDet) < 1e-6) ? 1.0 : (1.0 / rawDet);
    const raysPerPx = numRays / screenW;
    for (let s = 0; s < drawCount; s++) {
        const sp = drawPool[s];
        const sx = sp.x - px;
        const sy = sp.y - py;
        const transformX = invDet * (dirY * sx - dirX * sy);
        const transformY = invDet * ((-planeY * sx) - (-planeX * sy));

        if ((transformY - 0.22) <= 0) continue;

        const screenX = ((screenW * 0.5) * (1.0 - (-transformX / transformY))) | 0;
        if (screenX < -screenW || screenX > (screenW << 1)) continue;
        let spH = (wallProjH / transformY) | 0;
        if (spH > (screenH << 1)) spH = screenH << 1;
        const colIdx = (screenX * raysPerPx) | 0;

        if (sp.kind === "stalker") {
            const mW = Math.max(12, (spH * 0.48 * spriteAspectX) | 0);
            const mH = (spH * 0.92) | 0;
            const mLeft = screenX - (mW >> 1);
            const stride = Math.sin(frameTick * 0.24);
            const absStride = stride < 0 ? -stride : stride;
            const bobStalker = (absStride * Math.max(2, (spH * 0.035) | 0)) | 0;
            const mTop = Math.max(0, halfH - (mH >> 1) + bobStalker);
            const drawH = Math.min(screenH - mTop, mH);
            if (drawH <= 0) continue;

            const cStart = Math.max(0, (mLeft * raysPerPx) | 0);
            const cEnd = Math.min(numRays - 1, ((mLeft + mW) * raysPerPx) | 0);
            let visible = false;
            for (let c = cStart; c <= cEnd; c++) {
                if ((transformY - zBuffer[c]) < 0) { visible = true; break; }
            }
            if (!visible) continue;

            const spCamX = Math.abs((2.0 * screenX / screenW) - 1.0);
            const spBeam = ((effFlash - 0.0) > 0) ? Math.max(0.0, 1.0 - spCamX * 1.38) * effFlash : 0.0;
            const spMaxVis = ((effFlash - 0.0) > 0) ? (7.5 - (-spBeam * 8.5)) : 4.2;
            const stLight = toF64(Math.max(0.22, Math.min(1.2, 1.0 - transformY / (spMaxVis - (-2.5)))));

            const bodyX = Math.max(0, mLeft);
            const bodyW = Math.min(screenW, mLeft + mW) - bodyX;

            const shadowY = Math.min(screenH - 6, mTop + drawH - 2);
            const shadowH = Math.min(screenH - shadowY, Math.max(3, (drawH * 0.05) | 0));
            if (bodyW > 4 && shadowY > halfH && shadowH > 0) {
                const shX = Math.max(0, bodyX - 2);
                const shW = Math.min(screenW - shX, bodyW + 4);
                if (shW > 0) Draw.rect(shX, shadowY, shW, shadowH, COL_SHADOW);
            }

            const legW = Math.max(3, (mW * 0.22) | 0);
            const legH = Math.min(screenH, Math.max(2, (drawH * 0.34) | 0));
            const legY = mTop + ((drawH * 0.66) | 0);
            const legOffsetL = (stride * Math.max(2, (legH * 0.14) | 0)) | 0;
            const lLegX = screenX - ((mW * 0.26) | 0);
            const rLegX = screenX + ((mW * 0.06) | 0);
            const darkLimbCol = rgba((22 * stLight) | 0, (10 * stLight) | 0, (14 * stLight) | 0, 128);
            if (lLegX >= 0 && lLegX + legW <= screenW && legH > 0) {
                Draw.rect(lLegX, Math.max(0, Math.min(screenH - legH, legY + legOffsetL)), legW, legH, darkLimbCol);
            }
            if (rLegX >= 0 && rLegX + legW <= screenW && legH > 0) {
                Draw.rect(rLegX, Math.max(0, Math.min(screenH - legH, legY - legOffsetL)), legW, legH, darkLimbCol);
            }

            if (bodyW > 0) {
                const torsoTop = Math.max(0, Math.min(screenH - 4, mTop + ((drawH * 0.22) | 0)));
                const torsoH = Math.min(screenH - torsoTop, Math.max(2, (drawH * 0.48) | 0));
                const tColTop = rgba(((42 * stLight) - (-dRatio * 24.0)) | 0, (14 * stLight) | 0, (18 * stLight) | 0, 128);
                if (torsoH > 0) {
                    const halfTH = torsoH >> 1;
                    Draw.rect(bodyX, torsoTop, bodyW, Math.max(1, halfTH), tColTop);
                    Draw.rect(bodyX + ((bodyW * 0.08) | 0), torsoTop + halfTH, Math.max(1, (bodyW * 0.84) | 0), Math.max(1, torsoH - halfTH), COL_TORSO_BOT);
                    const ribW = Math.max(1, (bodyW * 0.60) | 0);
                    const ribX = bodyX + ((bodyW - ribW) >> 1);
                    const ribCol = rgba((125 * stLight) | 0, (88 * stLight) | 0, (85 * stLight) | 0, 115);
                    const ribH = Math.max(2, (torsoH * 0.08) | 0);
                    const r1y = Math.min(screenH - ribH, torsoTop + ((torsoH * 0.28) | 0));
                    const r2y = Math.min(screenH - ribH, torsoTop + ((torsoH * 0.56) | 0));
                    Draw.rect(ribX, r1y, ribW, ribH, ribCol);
                    Draw.rect(ribX, r2y, ribW, ribH, ribCol);
                }
            }

            const armW = Math.max(3, (mW * 0.16) | 0);
            const armH = Math.min(screenH, Math.max(2, (drawH * 0.52) | 0));
            const armTop = mTop + ((drawH * 0.24) | 0);
            const armSwing = (Math.cos(frameTick * 0.24) * Math.max(2, (mW * 0.12) | 0)) | 0;
            const leftArmX = mLeft - (armW >> 1);
            const rightArmX = mLeft + mW - (armW >> 1);
            const clawCol = rgba((175 * stLight) | 0, (35 * stLight) | 0, 35, 128);
            if (leftArmX >= 2 && leftArmX + armW + 2 <= screenW && armH > 0) {
                const ay = Math.max(0, Math.min(screenH - armH, armTop - armSwing));
                Draw.rect(leftArmX, ay, armW, armH, darkLimbCol);
                Draw.rect(leftArmX, Math.min(screenH - 3, ay + armH - 3), armW + 2, 3, clawCol);
            }
            if (rightArmX >= 2 && rightArmX + armW + 2 <= screenW && armH > 0) {
                const ay = Math.max(0, Math.min(screenH - armH, armTop + armSwing));
                Draw.rect(rightArmX, ay, armW, armH, darkLimbCol);
                Draw.rect(rightArmX - 2, Math.min(screenH - 3, ay + armH - 3), armW + 2, 3, clawCol);
            }

            const headW = (mW * 0.56) | 0;
            const headH = Math.min(screenH - mTop, Math.max(2, (drawH * 0.24) | 0));
            const headL = screenX - (headW >> 1);
            const headX = Math.max(0, headL);
            const headDrawW = Math.min(screenW, headL + headW) - headX;
            if (headDrawW > 0 && headH > 0) {
                const skullTopCol = rgba((195 * stLight) | 0, (162 * stLight) | 0, (152 * stLight) | 0, 128);
                const skullBotCol = rgba((115 * stLight) | 0, (72 * stLight) | 0, (70 * stLight) | 0, 128);
                const halfHH = headH >> 1;
                Draw.rect(headX, mTop, headDrawW, Math.max(1, halfHH), skullTopCol);
                Draw.rect(headX, mTop + halfHH, headDrawW, Math.max(1, headH - halfHH), skullBotCol);
                const jawW = Math.max(2, (headDrawW * 0.54) | 0);
                const jawH = Math.max(2, Math.min(headH, (headH * (0.24 - (-dRatio * 0.22))) | 0));
                Draw.rect(headX + ((headDrawW - jawW) >> 1), Math.max(0, mTop + headH - jawH - 1), jawW, jawH, COL_JAW);
            }

            const eyeSize = Math.max(2, (headW * 0.22) | 0);
            const eyeY = mTop + ((headH * 0.36) | 0);
            const e1x = screenX - ((headW * 0.30) | 0);
            const e2x = screenX + ((headW * 0.10) | 0);
            if (e1x >= 2 && e1x + eyeSize + 2 <= screenW) {
                Draw.rect(e1x - 1, eyeY - 1, eyeSize + 2, eyeSize + 2, COL_EYE_GLOW);
                Draw.rect(e1x, eyeY, eyeSize, eyeSize, COL_EYE_RED);
                Draw.rect(e1x + 1, eyeY + 1, Math.max(1, eyeSize - 2), Math.max(1, eyeSize - 2), COL_EYE_CORE);
            }
            if (e2x >= 2 && e2x + eyeSize + 2 <= screenW) {
                Draw.rect(e2x - 1, eyeY - 1, eyeSize + 2, eyeSize + 2, COL_EYE_GLOW);
                Draw.rect(e2x, eyeY, eyeSize, eyeSize, COL_EYE_RED);
                Draw.rect(e2x + 1, eyeY + 1, Math.max(1, eyeSize - 2), Math.max(1, eyeSize - 2), COL_EYE_CORE);
            }
        } else {
            if (colIdx < 0 || colIdx >= numRays || (transformY - zBuffer[colIdx]) >= 0) continue;
            const itemSize = Math.max(8, (spH * 0.32) | 0);
            const itemW = Math.max(6, (itemSize * spriteAspectX) | 0);
            const floatBob = (Math.sin((frameTick * 0.10) - (-s)) * 4.0) | 0;
            const iy = Math.max(4, Math.min(screenH - itemSize - 4, halfH + ((spH * 0.14) | 0) + floatBob));
            const ix = screenX - (itemW >> 1);

            if (ix < 2 || ix + itemSize > screenW - 2) continue;

            if (sp.kind === "fuse") {
                const w = Math.max(6, (itemSize * 0.78) | 0);
                const capH = Math.max(2, (itemSize * 0.20) | 0);
                Draw.rect(ix - 3, iy - 3, w + 6, itemSize + 6, COL_FUSE_HALO);
                Draw.rect(ix, iy, w, itemSize, COL_FUSE_BODY);
                Draw.rect(ix - 1, iy, w + 2, capH, COL_FUSE_CAP);
                Draw.rect(ix - 1, iy + itemSize - capH, w + 2, capH, COL_FUSE_CAP);
                Draw.rect(ix + ((w * 0.28) | 0), iy + capH, Math.max(2, (w * 0.44) | 0), itemSize - (capH << 1), COL_FUSE_CORE);
            } else if (sp.kind === "battery") {
                const w = Math.max(6, (itemSize * 0.76) | 0);
                const termW = Math.max(2, (w * 0.44) | 0);
                Draw.rect(ix - 3, iy - 3, w + 6, itemSize + 6, COL_BAT_HALO);
                Draw.rect(ix + ((w - termW) >> 1), iy - 2, termW, 3, COL_BAT_TERM);
                Draw.rect(ix, iy, w, itemSize, COL_BAT_BODY);
                Draw.rect(ix + 1, iy + 2, Math.max(2, w - 2), Math.max(2, (itemSize * 0.25) | 0), COL_BAT_BAR1);
                Draw.rect(ix + 1, iy + ((itemSize * 0.42) | 0), Math.max(2, w - 2), Math.max(2, (itemSize * 0.25) | 0), COL_BAT_BAR2);
            } else if (sp.kind === "breaker") {
                const by = Math.max(2, iy - ((itemSize * 0.45) | 0));
                const bh = (itemSize * 1.25) | 0;
                Draw.rect(ix - 4, by - 4, itemSize + 8, bh + 8, COL_BRK_HALO);
                Draw.rect(ix, by, itemSize, bh, COL_BRK_OUT);
                Draw.rect(ix + 2, by + 2, Math.max(4, itemSize - 4), Math.max(4, bh - 4), COL_BRK_IN);
                Draw.rect(ix + ((itemSize * 0.22) | 0), by + ((bh * 0.20) | 0), Math.max(2, (itemSize * 0.56) | 0), Math.max(2, (bh * 0.26) | 0), COL_BRK_WARN);
                Draw.rect(ix + ((itemSize * 0.35) | 0), by + ((bh * 0.55) | 0), Math.max(2, (itemSize * 0.30) | 0), Math.max(3, (bh * 0.32) | 0), COL_BRK_LEVER);
            } else if (sp.kind === "note") {
                const nw = Math.max(6, (itemSize * 0.82) | 0);
                const nh = Math.max(6, (itemSize * 0.95) | 0);
                const ny = Math.min(screenH - nh - 2, iy + 2);
                const lineW = Math.max(2, nw - 4);
                Draw.rect(ix - 2, ny - 2, nw + 4, nh + 4, COL_NOTE_HALO);
                Draw.rect(ix, ny, nw, nh, COL_NOTE_PAGE);
                Draw.rect(ix + 2, ny + ((nh * 0.30) | 0), lineW, 1, COL_NOTE_INK);
                Draw.rect(ix + 2, ny + ((nh * 0.62) | 0), Math.max(1, (lineW * 0.65) | 0), 1, COL_NOTE_BLOOD);
            }
        }
    }

    // ------------------------------------------------------------------------
    // 4. PARTICULAS ATMOSFERICAS LIGERAS (10 PARTICULAS EN EL HAZ)
    // ------------------------------------------------------------------------
    if (enableParticles && (effFlash - 0.05) > 0) {
        const partCol = rgba(210, 225, 240, ((effFlash * 55.0) | 0));
        for (let p = 0; p < 10; p++) {
            const pxSeed = (p * 61 + 19) & 63;
            const pySeed = (p * 37 + 11) & 63;
            const partX = (160 + pxSeed * 5 - (((pang * 60.0) | 0) & 63)) % screenW;
            const partY = 48 + ((pySeed * 6 + (frameTick >> 1) * ((p & 1) + 1)) % (screenH - 96));
            Draw.rect(partX, partY, 2, 2, partCol);
        }
    }

    // ------------------------------------------------------------------------
    // 5. VIEWMODEL 3D EN PRIMERA PERSONA (MANO + LINTERNA TACTICA)
    // ------------------------------------------------------------------------
    if (enableViewmodel) {
        renderFlashlightViewmodel(screenW, screenH, effFlash, pbat, vmBobOffset, vmSwayOffset, mAnim, frameTick);
    }

    // ------------------------------------------------------------------------
    // 6. VINETA PERIMETRAL GOURAUD + INDICADOR DIRECCIONAL DE PELIGRO
    // ------------------------------------------------------------------------
    if (enableOverlays) {
        const vigH = 48;
        Draw.quad(0, 0, screenW, 0, 0, vigH, screenW, vigH, COL_VIG_DARK, COL_VIG_DARK, COL_VIG_CLEAR, COL_VIG_CLEAR);
        Draw.quad(0, screenH - vigH, screenW, screenH - vigH, 0, screenH, screenW, screenH, COL_VIG_CLEAR, COL_VIG_CLEAR, COL_VIG_DARK, COL_VIG_DARK);

        // Resplandor rojo lateral que indica hacia qué lado está El Acechador cuando está cerca
        if ((dRatio - 0.22) > 0) {
            const absBias = sBias < 0 ? -sBias : sBias;
            if ((absBias - 0.18) > 0) {
                let edgeAlpha = (dRatio * absBias * 84.0) | 0;
                if (edgeAlpha > 88) edgeAlpha = 88;
                const edgeCol = rgba(220, 18, 22, edgeAlpha);
                const edgeW = 46;
                if (sBias < 0) {
                    Draw.rect(0, 0, edgeW >> 1, screenH, edgeCol);
                } else {
                    Draw.rect(screenW - (edgeW >> 1), 0, edgeW >> 1, screenH, edgeCol);
                }
            }
        }
    }
}

function flushWallSpan(screenH, hit, x0, x1, top0, bot0, h0, top1, bot1, h1, cR0, cG0, cB0, cR1, cG1, cB1, exitUnlocked, emerFlicker) {
    const col0 = rgba(cR0, cG0, cB0, 128);
    const col1 = rgba(cR1, cG1, cB1, 128);
    Draw.quad(x0, top0, x1, top1, x0, bot0, x1, bot1, col0, col1, col0, col1);

    const cR = (cR0 + cR1) >> 1;
    const cG = (cG0 + cG1) >> 1;
    const cB = (cB0 + cB1) >> 1;
    if (h0 < 16 && h1 < 16) return;

    const cornH0 = Math.max(2, (h0 * 0.08) | 0);
    const cornH1 = Math.max(2, (h1 * 0.08) | 0);
    const cTopEnd0 = Math.min(bot0, top0 + cornH0);
    const cTopEnd1 = Math.min(bot1, top1 + cornH1);
    const trimCol = rgba((cR * 0.34) | 0, (cG * 0.36) | 0, (cB * 0.40) | 0, 128);

    Draw.quad(x0, top0, x1, top1, x0, cTopEnd0, x1, cTopEnd1, trimCol, trimCol, trimCol, trimCol);

    const baseStart0 = Math.max(top0, bot0 - cornH0);
    const baseStart1 = Math.max(top1, bot1 - cornH1);
    const baseCol = rgba((cR * 0.26) | 0, (cG * 0.28) | 0, (cB * 0.32) | 0, 128);
    Draw.quad(x0, baseStart0, x1, baseStart1, x0, bot0, x1, bot1, baseCol, baseCol, baseCol, baseCol);

    const spanW = x1 - x0;
    if (spanW < 8) return;

    const midX = (x0 + x1) >> 1;
    const avgTop = (top0 + top1) >> 1;
    const avgBot = (bot0 + bot1) >> 1;
    const avgH = avgBot - avgTop;
    if (avgH < 20) return;

    if (hit === 1) {
        const j0 = top0 + ((bot0 - top0) >> 1);
        const j1 = top1 + ((bot1 - top1) >> 1);
        const jCol = rgba((cR * 0.55) | 0, (cG * 0.58) | 0, (cB * 0.62) | 0, 128);
        Draw.quad(x0, j0, x1, j1, x0, Math.min(bot0, j0 + 2), x1, Math.min(bot1, j1 + 2), jCol, jCol, jCol, jCol);
    } else if (hit === 2) {
        const p0 = top0 + ((bot0 - top0) >> 1) - 2;
        const p1 = top1 + ((bot1 - top1) >> 1) - 2;
        const pCol = rgba(Math.min(255, cR + 32), Math.min(255, cG + 28), Math.min(255, cB + 24), 128);
        Draw.quad(x0, p0, x1, p1, x0, Math.min(bot0, p0 + 4), x1, Math.min(bot1, p1 + 4), pCol, pCol, pCol, pCol);
    } else if (hit === 3) {
        const lw = Math.max(4, (spanW * 0.32) | 0);
        const lx = midX - (lw >> 1);
        const ly = avgTop + ((avgH * 0.24) | 0);
        const lh = Math.max(3, (avgH * 0.09) | 0);
        if (ly + lh < avgBot) {
            const glowR = Math.min(255, ((210.0 * emerFlicker) - (-45.0)) | 0);
            const glowG = (55.0 * emerFlicker) | 0;
            Draw.rect(lx - 2, ly - 2, lw + 4, lh + 4, rgba(glowR, 12, 12, 58));
            Draw.rect(lx, ly, lw, lh, rgba(glowR, glowG, 35, 128));
        }
    } else if (hit === 4) {
        const pw = Math.max(6, (spanW * 0.36) | 0);
        const px0 = midX - (pw >> 1);
        const py0 = avgTop + ((avgH * 0.42) | 0);
        const ph = Math.max(4, (avgH * 0.16) | 0);
        if (py0 + ph < avgBot) {
            Draw.rect(px0 - 2, py0 - 2, pw + 4, ph + 4, COL_CHEV_DARK);
            Draw.rect(px0, py0, pw, ph, exitUnlocked ? COL_DOOR_OPEN : COL_DOOR_LOCK);
        }
    }
}

function renderFlashlightViewmodel(screenW, screenH, effFlash, battery, bobOffset, swayOffset, mapAnim, frameTick) {
    const hideOffset = (mapAnim * 120.0) | 0;
    const safeX = GAME_SETTINGS.crtSafe ? 16 : 0;
    const vmX = screenW - 148 - safeX + ((swayOffset * 1.6) | 0);
    const vmY = screenH - 118 + ((bobOffset * 1.15) | 0) + hideOffset;
    if (vmY >= screenH + 20) return;

    if ((effFlash - 0.05) > 0) {
        const lensX = vmX + 12;
        const lensY = vmY + 8;
        let coneAlpha = (effFlash * 38.0) | 0;
        if (coneAlpha > 58) coneAlpha = 58;
        const coneTipCol = rgba(225, 240, 255, coneAlpha);
        const coneFarCol = rgba(120, 165, 220, 0);
        Draw.triangle(
            lensX, lensY,
            (screenW * 0.26) | 0, (screenH * 0.34) | 0,
            (screenW * 0.72) | 0, (screenH * 0.28) | 0,
            coneTipCol, coneFarCol, coneFarCol
        );
        Draw.rect(lensX - 10, lensY - 10, 20, 20, rgba(210, 235, 255, coneAlpha));
    }

    Draw.quad(
        vmX + 48, vmY + 54,
        vmX + 132, vmY + 42,
        vmX + 88, screenH + 10,
        vmX + 165, screenH + 10,
        COL_SLEEVE1, COL_SLEEVE2, COL_SLEEVE2, COL_SLEEVE2
    );
    Draw.rect(vmX + 34, vmY + 36, 44, 26, COL_GLOVE);
    Draw.rect(vmX + 38, vmY + 32, 36, 6, COL_GLOVE_HI);

    Draw.quad(
        vmX + 18, vmY + 12,
        vmX + 44, vmY - 4,
        vmX + 78, vmY + 68,
        vmX + 106, vmY + 50,
        COL_FL_BOT, COL_FL_TOP, COL_FL_BOT, COL_FL_TOP
    );
    Draw.quad(
        vmX - 2, vmY + 2,
        vmX + 26, vmY - 16,
        vmX + 22, vmY + 20,
        vmX + 48, vmY + 2,
        COL_FL_HEAD_B, COL_FL_HEAD_T, COL_FL_HEAD_B, COL_FL_HEAD_T
    );

    Draw.rect(vmX + 6, vmY - 2, 12, 12, ((effFlash - 0.05) > 0) ? COL_LENS_ON : COL_LENS_OFF);
    const lowBat = (battery - 25.0) < 0;
    const ledCol = ((effFlash - 0.05) <= 0)
        ? COL_LED_OFF
        : (lowBat && ((frameTick & 15) < 8))
            ? COL_LED_LOW
            : COL_LED_OK;
    Draw.rect(vmX + 44, vmY + 18, 6, 4, ledCol);
}

// PDA Tactico animado (se desliza desde abajo y despliega al presionar SELECT o L2)
function renderAnimatedMapPDA(screenW, screenH, grid, player, stalker, entities, dangerRatio, mapAnim, frameTick, fnt) {
    const mAnim = toF64(mapAnim);
    const dRatio = toF64(dangerRatio);
    if ((mAnim - 0.01) <= 0) return;

    const inv = 1.0 - mAnim;
    const ease = 1.0 - (inv * inv * inv);
    const panelW = 368;
    const panelH = 290;
    const targetY = (screenH - panelH) >> 1;
    const ox = (screenW - panelW) >> 1;
    const oy = (screenH - (-((targetY - screenH) * ease))) | 0;

    Draw.rect(0, 0, screenW, screenH, rgba(0, 0, 0, (75 * ease) | 0));
    Draw.rect(ox - 6, oy - 6, panelW + 12, panelH + 12, rgba(28, 46, 32, 124));
    Draw.rect(ox, oy, panelW, panelH, rgba(6, 14, 9, 126));

    Draw.rect(ox, oy, panelW, 30, rgba(14, 38, 20, 126));
    fnt.scale = Math.fround(0.72);
    fnt.color = rgba(110, 245, 140, 128);
    fnt.print(ox + 10, oy + 5, "PLANO SUBSUELO 04 [SELECT/L2]");

    const cellPx = 11;
    const mapPx = MAP_W * cellPx;
    const mx0 = ox + 16;
    const my0 = oy + 42;

    const colExit = rgba(60, 235, 110, 128);
    const colGate = rgba(235, 165, 55, 128);
    const colRit  = rgba(165, 45, 45, 128);
    const colWall = rgba(55, 115, 70, 120);

    for (let y = 0; y < MAP_H; y++) {
        let x = 0;
        const row = grid[y];
        while (x < MAP_W) {
            const v = row[x];
            if (v > 0) {
                let run = 1;
                while (x + run < MAP_W && row[x + run] === v) run++;
                const col = (v === 4) ? colExit : (v === 5) ? colGate : (v === 3) ? colRit : colWall;
                Draw.rect(mx0 + x * cellPx, my0 + y * cellPx, run * cellPx - 1, cellPx - 1, col);
                x += run;
            } else {
                x++;
            }
        }
    }

    const scanY = my0 + ((frameTick * 3) % mapPx);
    Draw.rect(mx0, scanY, mapPx, 2, rgba(80, 255, 120, 52));

    for (let i = 0; i < entities.length; i++) {
        const e = entities[i];
        if (e.taken) continue;
        const ec = (e.kind === "fuse") ? rgba(255, 220, 60, 128)
                 : (e.kind === "battery") ? rgba(60, 230, 255, 128)
                 : (e.kind === "breaker") ? rgba(255, 75, 75, 128)
                 : rgba(235, 235, 245, 128);
        Draw.rect(mx0 + ((toF64(e.x) * cellPx) | 0) - 2, my0 + ((toF64(e.y) * cellPx) | 0) - 2, 5, 5, ec);
    }

    if ((dRatio - 0.18) > 0 && ((frameTick & 15) < 10)) {
        Draw.rect(mx0 + ((toF64(stalker.x) * cellPx) | 0) - 3, my0 + ((toF64(stalker.y) * cellPx) | 0) - 3, 7, 7, rgba(255, 35, 35, 128));
    }

    const px = mx0 + ((toF64(player.x) * cellPx) | 0);
    const py = my0 + ((toF64(player.y) * cellPx) | 0);
    const pang = toF64(player.ang);
    Draw.rect(px - 3, py - 3, 6, 6, rgba(120, 255, 150, 128));
    Draw.line(px, py, px + ((Math.cos(pang) * 14.0) | 0), py + ((Math.sin(pang) * 14.0) | 0), rgba(150, 255, 180, 128));

    fnt.scale = Math.fround(0.72);
    fnt.color = rgba(130, 245, 155, 128);
    fnt.print(mx0 + (mapPx >> 1) - 5, my0 - 16, "N");
    fnt.print(mx0 + (mapPx >> 1) - 5, my0 + mapPx + 1, "S");
    fnt.print(mx0 - 13, my0 + (mapPx >> 1) - 8, "O");
    fnt.print(mx0 + mapPx + 2, my0 + (mapPx >> 1) - 8, "E");

    const lx = mx0 + mapPx + 16;
    fnt.scale = Math.fround(0.72);
    fnt.color = rgba(120, 255, 150, 128); fnt.print(lx, my0 + 4,   "TU POSICION");
    fnt.color = rgba(255, 220, 60, 128);  fnt.print(lx, my0 + 32,  "FUSIBLES");
    fnt.color = rgba(255, 75, 75, 128);   fnt.print(lx, my0 + 60,  "DISYUNTOR");
    fnt.color = rgba(60, 230, 255, 128);  fnt.print(lx, my0 + 88,  "BATERIAS");
    fnt.color = rgba(235, 235, 245, 128); fnt.print(lx, my0 + 116, "NOTAS");
    fnt.color = rgba(60, 235, 110, 128);  fnt.print(lx, my0 + 144, "SALIDA");
    if ((dRatio - 0.18) > 0) {
        fnt.color = rgba(255, 50, 50, 128);
        fnt.print(lx, my0 + 178, "! ANOMALIA !");
    }
}

