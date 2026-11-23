// ============================================================================
// SUBSUELO 04: EL ACECHADOR (PS2 Real Hardware - Single-File Bundle)
// Cero imports ES6: 100% compatible con OPL (DVD ISO cdfs:/ y APPS mass:),
// wLaunchELF y PCSX2 sin problemas de rutas relativas ni mayusculas.
// ============================================================================

// --- MODULE: src/config.js ---
// ============================================================================
// Configuración global, ajustes dinámicos y utilidades FLOAT64 para PS2 EE
// ============================================================================

// Ajustes modificables desde el menú de Opciones (y persistibles en Memory Card)
const GAME_SETTINGS = {
    // Motor grafico: 0 = 3D VU1 (STREAM progresivo), 1 = 2.5D EQUILIBRADA (96), 2 = 2.5D RAPIDA (64)
    qualityIndex: 0,
    // Margen de seguridad para televisores CRT con overscan (true = seguro CRT, false = pantalla completa HD/emulador)
    crtSafe: true,
    // Relación de aspecto de TV: true = 16:9 panorámico (corrige estiramiento), false = 4:3 clásico
    aspect16x9: true,
    // Sensibilidad de cámara: 0 = BAJA, 1 = MEDIA, 2 = ALTA
    sensitivityIndex: 1,
    // Vibración DualShock 2
    rumble: false,
    // Efectos visuales VHS, viñeta y partículas
    overlays: true,
    // Balanceo de cámara y linterna en mano
    bob: true,
    viewmodel: true,
    particles: true,
    // Audio activado por defecto (75%), iniciado tras estabilizar el arranque en frameTick === 15
    audioVolume: 75,
// Mostrar panel de diagnostico de rendimiento
    showFps: false,
    // Dificultad: 0 = NORMAL, 1 = PESADILLA
    difficulty: 0
};

const QUALITY_RAYS = [128, 96, 64];
const QUALITY_LABELS = ["3D VU1 STREAM", "2.5D MEDIA", "2.5D RAPIDA"];
const SENS_TURN_SPEED = [0.024, 0.034, 0.046];
const SENS_LABELS = ["BAJA", "MEDIA", "ALTA"];
const DIFF_LABELS = ["NORMAL", "PESADILLA"];

// Zona muerta ampliada para sticks analógicos DualShock 2 reales con desgaste
const STICK_DEADZONE = 0.22;

const F64_ZERO = -0.0;

function toF64(v) {
    return Math.min(v) - F64_ZERO;
}

function fadd(a, b) {
    return a - (-b);
}

function clampF64(v, lo, hi) {
    const x = toF64(v);
    const mn = toF64(lo);
    const mx = toF64(hi);
    if ((x - mn) < 0) return mn;
    if ((x - mx) > 0) return mx;
    return x;
}

// Empaquetado directo RGBA en entero de 32 bits (JS_TAG_INT), sin llamadas C a Color.new()
function rgba(r, g, b, a) {
    return ((r & 255) | ((g & 255) << 8) | ((b & 255) << 16) | ((a & 255) << 24)) >>> 0;
}

// Muestreo pausado para no consultar las APIs nativas en cada cuadro.
const consoleStats = {
    lastSample: -30,
    fps: 0,
    cpuMHz: 0,
    ramUsed: 0,
    ramTotal: 0,
    vramUsed: 0,
    vramTotal: 0,
    drawCalls: 0,
    triangles: 0,
    gpuText: "GS: --"
};

function formatMemoryMB(bytes) {
    if (!(bytes > 0)) return "--";
    return String(Math.round(bytes / 1048576));
}

function restore2DRenderState(screenW, screenH) {
    if (typeof Screen === "undefined" || typeof Screen.setParam !== "function") return;
    try { if (typeof Screen.DEPTH_TEST_ENABLE !== "undefined") Screen.setParam(Screen.DEPTH_TEST_ENABLE, false); } catch (_) {}
    try {
        if (typeof Screen.DEPTH_TEST_METHOD !== "undefined" && typeof Screen.DEPTH_ALWAYS !== "undefined") {
            Screen.setParam(Screen.DEPTH_TEST_METHOD, Screen.DEPTH_ALWAYS);
        }
    } catch (_) {}
    try { if (typeof Screen.ALPHA_TEST_ENABLE !== "undefined") Screen.setParam(Screen.ALPHA_TEST_ENABLE, false); } catch (_) {}
    try { if (typeof Screen.DST_ALPHA_TEST_ENABLE !== "undefined") Screen.setParam(Screen.DST_ALPHA_TEST_ENABLE, false); } catch (_) {}
    try {
        if (typeof Screen.SCISSOR_BOUNDS !== "undefined") {
            Screen.setParam(Screen.SCISSOR_BOUNDS, { x1: 0, y1: 0, x2: screenW - 1, y2: screenH - 1 });
        }
    } catch (_) {}
}
function updateConsoleStats(frameTick) {
    if (frameTick - consoleStats.lastSample < 30) return;
    consoleStats.lastSample = frameTick;

    try {
        if (typeof Screen !== "undefined" && typeof Screen.getFPS === "function") {
            consoleStats.fps = Screen.getFPS(1000) | 0;
        }
    } catch (_) {}

    try {
        if (typeof System !== "undefined" && typeof System.getCPUInfo === "function") {
            const cpu = System.getCPUInfo();
            if (cpu) {
                if (cpu.CPUClock > 0) consoleStats.cpuMHz = Math.round(cpu.CPUClock / 1000000);
                if (cpu.RAMSize > 0) consoleStats.ramTotal = cpu.RAMSize;
            }
        }
    } catch (_) {}

    try {
        if (typeof System !== "undefined" && typeof System.getMemoryStats === "function") {
            const memory = System.getMemoryStats();
            if (memory && memory.used >= 0) consoleStats.ramUsed = memory.used;
        }
    } catch (_) {}

    try {
        if (typeof Screen !== "undefined" && typeof Screen.getMemoryStats === "function") {
            if (typeof Screen.VRAM_USED_TOTAL !== "undefined") consoleStats.vramUsed = Screen.getMemoryStats(Screen.VRAM_USED_TOTAL) | 0;
            if (typeof Screen.VRAM_SIZE !== "undefined") consoleStats.vramTotal = Screen.getMemoryStats(Screen.VRAM_SIZE) | 0;
        } else if (typeof Screen !== "undefined" && typeof Screen.getFreeVRAM === "function") {
            // Compatibilidad con runtimes antiguos: esta API informa el uso en AthenaEnv.
            consoleStats.vramUsed = Screen.getFreeVRAM() | 0;
        }
    } catch (_) {}

    try {
        if (typeof Render !== "undefined" && typeof Render.stats === "function") {
            const render = Render.stats();
            if (render) {
                if (render.drawCalls >= 0) consoleStats.drawCalls = render.drawCalls | 0;
                if (render.triangles >= 0) consoleStats.triangles = render.triangles | 0;
            }
        }
    } catch (_) {}

    try {
        if (typeof System !== "undefined" && typeof System.getGPUInfo === "function") {
            const gpu = System.getGPUInfo();
            if (gpu) consoleStats.gpuText = "GS " + (gpu.id || "?") + "." + (gpu.revision || "?");
        }
    } catch (_) {}
}

function drawConsoleStatsOverlay(screenW, screenH, frameTick, fnt) {
    updateConsoleStats(frameTick);
    const boxW = 205;
    const boxH = 112;
    const x = screenW - boxW - 8;
    const y = 8;
    Draw.rect(x, y, boxW, boxH, rgba(0, 0, 0, 168));
    Draw.rect(x, y, boxW, 2, rgba(80, 210, 230, 180));
    fnt.scale = Math.fround(0.56);
    fnt.color = rgba(130, 235, 245, 128);
    fnt.print(x + 7, y + 5, "DIAGNOSTICO PS2  " + consoleStats.gpuText);
    fnt.color = COL_WHITE;
    fnt.print(x + 7, y + 22, "FPS " + consoleStats.fps + "   CPU " + (consoleStats.cpuMHz || "--") + " MHz");
    fnt.print(x + 7, y + 39, "EE RAM " + formatMemoryMB(consoleStats.ramUsed) + "/" + formatMemoryMB(consoleStats.ramTotal) + " MB*");
    const vramUsedKB = consoleStats.vramUsed > 0 ? Math.round(consoleStats.vramUsed / 1024) : 0;
    const vramTotalKB = consoleStats.vramTotal > 0 ? Math.round(consoleStats.vramTotal / 1024) : 4096;
    fnt.print(x + 7, y + 56, "GS VRAM " + (vramUsedKB || "--") + "/" + vramTotalKB + " KB");
    fnt.print(x + 7, y + 73, "VU1 DRAWS " + consoleStats.drawCalls + "  TRI " + consoleStats.triangles);
    fnt.color = rgba(220, 205, 165, 128);
    fnt.print(x + 7, y + 91, "*RAM asignada; FPS promedio de 1s");
}

// --- MODULE: src/storage.js ---
// ============================================================================
// Persistencia segura en Memory Card PS2 (mc0:/SUBSUELO04/save.json)
// Se degrada con gracia si no hay Memory Card conectada o se ejecuta desde DVD
// ============================================================================

const SAVE_DIR  = "mc0:/SUBSUELO04";
const SAVE_PATH = "mc0:/SUBSUELO04/save.json";

const RECORDS = {
    bestNormalSec: 0,
    bestNightmareSec: 0,
    escapes: 0,
    mcAvailable: false
};

function loadSaveData() {
    try {
        if (typeof std === "undefined" || !std || typeof std.exists !== "function") return false;
        if (!std.exists(SAVE_PATH)) {
            // Verificar si mc0 existe comprobando System.getMCInfo si está disponible
            if (typeof System !== "undefined" && System && typeof System.getMCInfo === "function") {
                const mc = System.getMCInfo(0);
                if (mc && mc.type && mc.type > 0) RECORDS.mcAvailable = true;
            }
            return false;
        }
        const raw = std.loadFile(SAVE_PATH);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (data && typeof data === "object") {
            if (typeof data.qualityIndex === "number" && data.qualityIndex >= 0 && data.qualityIndex <= 2) {
                GAME_SETTINGS.qualityIndex = data.qualityIndex | 0;
            }
            if (typeof data.crtSafe === "boolean") GAME_SETTINGS.crtSafe = data.crtSafe;
            if (typeof data.aspect16x9 === "boolean") GAME_SETTINGS.aspect16x9 = data.aspect16x9;
            if (typeof data.sensitivityIndex === "number" && data.sensitivityIndex >= 0 && data.sensitivityIndex <= 2) {
                GAME_SETTINGS.sensitivityIndex = data.sensitivityIndex | 0;
            }
            if (typeof data.rumble === "boolean") GAME_SETTINGS.rumble = data.rumble;
            if (typeof data.overlays === "boolean") GAME_SETTINGS.overlays = data.overlays;
            if (typeof data.audioVolume === "number" && data.audioVolume >= 0 && data.audioVolume <= 100) {
                GAME_SETTINGS.audioVolume = data.audioVolume | 0;
            }
            if (typeof data.showFps === "boolean") GAME_SETTINGS.showFps = data.showFps;
            if (typeof data.difficulty === "number" && (data.difficulty === 0 || data.difficulty === 1)) {
                GAME_SETTINGS.difficulty = data.difficulty | 0;
            }
            if (typeof data.bestNormalSec === "number" && data.bestNormalSec > 0) {
                RECORDS.bestNormalSec = data.bestNormalSec | 0;
            }
            if (typeof data.bestNightmareSec === "number" && data.bestNightmareSec > 0) {
                RECORDS.bestNightmareSec = data.bestNightmareSec | 0;
            }
            if (typeof data.escapes === "number" && data.escapes > 0) {
                RECORDS.escapes = data.escapes | 0;
            }
            RECORDS.mcAvailable = true;
            return true;
        }
    } catch (_) {}
    return false;
}

function saveGameData() {
    try {
        if (typeof std === "undefined" || !std || typeof std.open !== "function") return false;
        if (typeof os !== "undefined" && os && typeof os.mkdir === "function") {
            try { os.mkdir(SAVE_DIR); } catch (_) {}
        }
        const payload = JSON.stringify({
            qualityIndex: GAME_SETTINGS.qualityIndex,
            crtSafe: GAME_SETTINGS.crtSafe,
            aspect16x9: GAME_SETTINGS.aspect16x9,
            sensitivityIndex: GAME_SETTINGS.sensitivityIndex,
            rumble: GAME_SETTINGS.rumble,
            overlays: GAME_SETTINGS.overlays,
            audioVolume: GAME_SETTINGS.audioVolume,
            showFps: GAME_SETTINGS.showFps,
            difficulty: GAME_SETTINGS.difficulty,
            bestNormalSec: RECORDS.bestNormalSec,
            bestNightmareSec: RECORDS.bestNightmareSec,
            escapes: RECORDS.escapes
        });
        const f = std.open(SAVE_PATH, "w");
        if (!f) return false;
        f.puts(payload);
        f.close();
        RECORDS.mcAvailable = true;
        return true;
    } catch (_) {
        return false;
    }
}

function recordEscape(secs, difficulty) {
    RECORDS.escapes++;
    if (difficulty === 1) {
        if (RECORDS.bestNightmareSec === 0 || secs < RECORDS.bestNightmareSec) {
            RECORDS.bestNightmareSec = secs;
        }
    } else {
        if (RECORDS.bestNormalSec === 0 || secs < RECORDS.bestNormalSec) {
            RECORDS.bestNormalSec = secs;
        }
    }
    return saveGameData();
}

// --- MODULE: src/audio.js ---
// ============================================================================
// Gestor Completo de Audio PS2 (AthenaEnv V4 Sound.Stream + Sound.Sfx ADPCM)
// - Música / Ambiente (OGG Vorbis 48kHz estéreo): assets/audio/ambient.ogg, chase.ogg
// - Efectos cortos (PS2 SPU2 ADPCM .adp): assets/audio/*.adp (carga opcional segura)
// ============================================================================

let ambientStream = null;
let chaseStream = null;
let activeTrack = "ambient";
let audioReady = false;
let audioPlaying = false;
let lastAppliedVol = -1;
let audioInitAttempted = false;
let iopAudioLoaded = false;

const SFX_PATHS = {
    step:        "assets/audio/step.adp",
    flashlight:  "assets/audio/flashlight.adp",
    pickup:      "assets/audio/pickup.adp",
    breaker:     "assets/audio/breaker.adp",
    gate_locked: "assets/audio/gate_locked.adp",
    heartbeat:   "assets/audio/heartbeat.adp",
    jumpscare:   "assets/audio/jumpscare.adp",
    ui_move:     "assets/audio/ui_move.adp",
    ui_select:   "assets/audio/ui_select.adp"
};
const sfxBank = {};
let sfxLoadedCount = 0;

function fileExistsSafe(path) {
    try {
        if (typeof std !== "undefined" && std && typeof std.exists === "function") {
            return !!std.exists(path);
        }
    } catch (_) {}
    return false;
}

function ensureAudioIOP() {
    if (iopAudioLoaded) return;
    iopAudioLoaded = true;
    try {
        if (typeof IOP !== "undefined" && IOP && typeof IOP.getModule === "function" && typeof IOP.loadModule === "function") {
            const sd = IOP.getModule("libsd");
            if (sd) {
                try { IOP.loadModule(sd); } catch (_) {}
            }
            const au = IOP.getModule("audsrv");
            if (au) {
                try { IOP.loadModule(au); } catch (_) {}
            }
        }
    } catch (_) {}
}

function resolveFirstExisting(paths) {
    for (let i = 0; i < paths.length; i++) {
        if (fileExistsSafe(paths[i])) return paths[i];
    }
    return null;
}

function initAudio() {
    if (audioReady) return true;
    if (audioInitAttempted) return false;
    audioInitAttempted = true;
    try {
        if (typeof Sound === "undefined" || !Sound) return false;
        ensureAudioIOP();

        if (typeof Sound.Stream === "function") {
            const ambPath = resolveFirstExisting([
                "assets/audio/ambient.wav",
                "assets/audio/ambient.ogg",
                "assets/ambient.wav",
                "assets/ambient.ogg"
            ]);
            if (ambPath) {
                try {
                    ambientStream = new Sound.Stream(ambPath);
                    if (ambientStream) ambientStream.loop = true;
                } catch (_) {
                    ambientStream = null;
                }
            }
            const chasePath = resolveFirstExisting([
                "assets/audio/chase.wav",
                "assets/audio/chase.ogg"
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

        // Por ahora solo usamos ambient.ogg y chase.ogg (Sound.Stream);
        // se evita sondear archivos .adp inexistentes por USB 1.1 en PS2

        if (ambientStream || chaseStream || sfxLoadedCount > 0) {
            audioReady = true;
            audioPlaying = false;
            activeTrack = "ambient";
            lastAppliedVol = -1;
            applyAudioVolume(GAME_SETTINGS.audioVolume);
            return true;
        }
    } catch (_) {
        ambientStream = null;
        chaseStream = null;
        audioReady = false;
        audioPlaying = false;
    }
    return false;
}

function getActiveStream() {
    if (activeTrack === "chase" && chaseStream) return chaseStream;
    return ambientStream || chaseStream;
}

function setMusicTrack(trackName, rewindFirst = false) {
    const next = (trackName === "chase" && chaseStream) ? "chase" : "ambient";
    if (next === activeTrack && !rewindFirst) return;
    const prevStream = getActiveStream();
    activeTrack = next;
    if (!audioReady || GAME_SETTINGS.audioVolume <= 0) return;
    try {
        if (prevStream && audioPlaying && typeof prevStream.pause === "function") {
            prevStream.pause();
            audioPlaying = false;
        }
        const cur = getActiveStream();
        if (cur) {
            if (rewindFirst && typeof cur.rewind === "function") {
                try { cur.rewind(); } catch (_) {}
            }
            if (typeof cur.play === "function") {
                cur.play();
                audioPlaying = true;
            }
            if (typeof Sound.setVolume === "function") {
                Sound.setVolume(GAME_SETTINGS.audioVolume | 0);
            }
        }
    } catch (_) {}
}

function applyAudioVolume(vol) {
    const clamped = vol < 0 ? 0 : (vol > 100 ? 100 : (vol | 0));
    if (clamped === lastAppliedVol) return;
    lastAppliedVol = clamped;
    if (!audioReady) return;
    const cur = getActiveStream();
    try {
        if (clamped === 0) {
            if (cur && audioPlaying && typeof cur.pause === "function") {
                cur.pause();
                audioPlaying = false;
            }
            if (typeof Sound.setVolume === "function") {
                Sound.setVolume(0);
            }
        } else {
            if (cur && !audioPlaying && typeof cur.play === "function") {
                cur.play();
                audioPlaying = true;
            }
            if (typeof Sound.setVolume === "function") {
                Sound.setVolume(clamped);
            }
        }
    } catch (_) {}
}

function playSfx(name, panVal = 0, volScale = 1.0) {
    if (!audioReady || GAME_SETTINGS.audioVolume <= 0) return;
    const sfx = sfxBank[name];
    if (!sfx || typeof sfx.play !== "function") return;
    try {
        let v = (GAME_SETTINGS.audioVolume * volScale) | 0;
        if (v < 1) v = 1;
        if (v > 100) v = 100;
        let p = panVal | 0;
        if (p < -100) p = -100;
        if (p > 100) p = 100;
        sfx.volume = v;
        sfx.pan = p;
        sfx.play();
    } catch (_) {}
}

function isAudioReady() {
    return audioReady;
}

// --- MODULE: src/map.js ---
// Mapa 20x20 del Subsuelo 04 y colisiones ultra-ligeras sin allocaciones por cuadro
// 0 = Pasillo libre
// 1 = Pared de hormigon humedo
// 2 = Pilar/estructura oxidada
// 3 = Pared de zona ritual / sangre
// 4 = Compuerta blindada de salida (Norte)
// 5 = Reja de seguridad (se abre al activar el Disyuntor Central)

const MAP_W = 20;
const MAP_H = 20;

const BASE_MAP = [
    [1,1,1,1,1,1,1,1,1,4,4,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,1],
    [1,0,2,2,0,1,0,1,1,0,0,1,1,0,1,0,2,2,0,1],
    [1,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,1],
    [1,1,1,0,1,1,0,0,0,2,2,0,0,0,1,1,0,1,1,1],
    [1,0,0,0,0,1,0,1,0,0,0,0,1,0,1,0,0,0,0,1],
    [1,0,2,1,0,0,0,1,0,0,0,0,1,0,0,0,1,2,0,1],
    [1,0,0,1,0,1,0,0,0,2,2,0,0,0,1,0,1,0,0,1],
    [3,0,0,0,0,5,0,0,0,0,0,0,0,0,5,0,0,0,0,3],
    [3,0,1,1,0,5,0,2,0,0,0,0,2,0,5,0,1,1,0,3],
    [3,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,3],
    [1,0,0,0,1,1,0,2,0,0,0,0,2,0,1,1,0,0,0,1],
    [1,0,2,0,0,0,0,0,0,2,2,0,0,0,0,0,0,2,0,1],
    [1,0,0,0,1,0,1,0,0,0,0,0,0,1,0,1,0,0,0,1],
    [1,1,0,1,1,0,1,1,0,0,0,0,1,1,0,1,1,0,1,1],
    [1,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,1],
    [1,0,2,1,0,1,0,3,0,0,0,0,3,0,1,0,1,2,0,1],
    [1,0,0,1,0,1,0,3,3,0,0,3,3,0,1,0,1,0,0,1],
    [1,0,0,0,0,0,0,0,0,3,3,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,3,3,1,1,1,1,1,1,1,1,1]
];

function createWorldGrid() {
    const grid = [];
    for (let y = 0; y < MAP_H; y++) {
        grid.push(BASE_MAP[y].slice());
    }
    return grid;
}

function getCell(grid, gx, gy) {
    if (gx < 0 || gx >= MAP_W || gy < 0 || gy >= MAP_H) return 1;
    return grid[gy][gx];
}

function isCellBlocked(grid, gx, gy) {
    if (gx < 0 || gx >= MAP_W || gy < 0 || gy >= MAP_H) return true;
    return grid[gy][gx] !== 0;
}

// Verificación directa de las 4 esquinas del bounding box (sin crear arrays por cuadro)
function isPosWalkable(grid, nx, ny, margin = 0.25) {
    const x = toF64(nx);
    const y = toF64(ny);
    const m = toF64(margin);
    const x0 = (x - m) | 0;
    const x1 = (x - (-m)) | 0;
    const y0 = (y - m) | 0;
    const y1 = (y - (-m)) | 0;

    if (x0 < 0 || x1 >= MAP_W || y0 < 0 || y1 >= MAP_H) return false;
    if (grid[y0][x0] !== 0) return false;
    if (grid[y0][x1] !== 0) return false;
    if (grid[y1][x0] !== 0) return false;
    if (grid[y1][x1] !== 0) return false;
    return true;
}

// Avanza un eje en pasos cortos para que un cuadro lento o un cambio futuro de
// velocidad no permita atravesar una celda sólida entre la posición anterior y la nueva.
function movePlayerAxis(grid, x, y, delta, moveX, margin = 0.25) {
    const steps = Math.max(1, Math.ceil(Math.abs(delta) / 0.10));
    const step = delta / steps;
    let moved = moveX ? x : y;
    for (let i = 0; i < steps; i++) {
        const candidate = moved + step;
        const nx = moveX ? candidate : x;
        const ny = moveX ? y : candidate;
        if (!isPosWalkable(grid, nx, ny, margin)) break;
        moved = candidate;
    }
    return moved;
}

const LORE_NOTES = [
    {
        code: "REGISTRO #01 - INGENIERIA",
        summary: "El disyuntor central abre las rejas Este y Oeste.",
        lines: [
            "14/10 - TURNO NOCHE (SUBSUELO 04)",
            "Tras el apagon se trabaron las rejas",
            "hacia los sectores Este y Oeste.",
            "El DISYUNTOR ROJO en el centro libera",
            "las trabas magneticas. Ve directo alli."
        ]
    },
    {
        code: "REGISTRO #02 - SEGURIDAD",
        summary: "No corras cerca suyo. Apaga la linterna para ocultarte.",
        lines: [
            "INFORME DE GUARDIA - PASILLO SUR",
            "Reacciona al ruido de pisadas rapidas",
            "y al haz directo de las linternas.",
            "Si sube tu pulso, apaga la luz [TRIANG]",
            "y deja de correr: perdera tu rastro."
        ]
    },
    {
        code: "REGISTRO #03 - PROTOCOLO",
        summary: "Ilumina sus ojos de frente para frenar su avance.",
        lines: [
            "OBSERVACION - COMPORTAMIENTO VISUAL",
            "Aunque la luz lo atrae desde lejos,",
            "apuntar directo a sus ojos lo frena.",
            "Usalo solo para ganar distancia si te",
            "acorrala en un pasillo. Cuida bateria."
        ]
    },
    {
        code: "REGISTRO #04 - EVACUACION",
        summary: "Los 4 fusibles abren la compuerta de salida al Norte.",
        lines: [
            "ORDEN DE EMERGENCIA - SALIDA NORTE",
            "La compuerta blindada al Norte (arriba",
            "en el PDA) requiere los 4 FUSIBLES.",
            "Cuando el panel pase a VERDE, corre",
            "hacia la salida. No mires atras."
        ]
    }
];

const LORE_MESSAGES = LORE_NOTES.map(n => [n.code, ": ", n.summary].join(""));

// --- MODULE: src/ai.js ---
// IA de El Acechador con Pathfinding BFS sin asignaciones de memoria por cuadro
// Normalizada por delta-time (dtScale) para velocidad idéntica en PS2 NTSC 60Hz y PAL 50Hz


const AI_PATROL = 0;
const AI_INVESTIGATE = 1;
const AI_HUNT = 2;
const AI_CHASE_INTRO = 3;
const CHASE_INTRO_DURATION_MS = 7000.0;

const WAYPOINTS = [
    { x: 10.0, y: 10.0 },
    { x: 10.0, y: 16.5 },
    { x: 3.0,  y: 10.0 },
    { x: 16.5, y: 10.0 },
    { x: 3.5,  y: 3.0  },
    { x: 16.5, y: 3.0  }
];

// Buffers estáticos preasignados para evitar Garbage Collection en QuickJS (PS2 EE)
const TOTAL_CELLS = MAP_W * MAP_H;
const bfsParent  = new Int16Array(TOTAL_CELLS);
const bfsVisited = new Uint8Array(TOTAL_CELLS);
const bfsQueue   = new Int16Array(TOTAL_CELLS);

// Resultado reutilizable sin allocaciones por frame
const aiResult = { distP: 99.0, los: false, blinded: false, sideBias: 0.0, chaseIntroStarted: false, chaseHuntStarted: false, inChaseIntro: false };
const bfsOutNode = { x: 10.0, y: 10.0 };

function hasLineOfSight(grid, x0, y0, x1, y1) {
    const sx = toF64(x0);
    const sy = toF64(y0);
    const dx = toF64(x1) - sx;
    const dy = toF64(y1) - sy;
    const distSq = (dx * dx) - (-(dy * dy));
    if ((distSq - 0.01) < 0) return true;
    const dist = Math.sqrt(distSq);
    const steps = (dist * 3.0) | 0;
    if (steps <= 1) return true;
    const invSteps = 1.0 / steps;
    for (let i = 1; i < steps; i++) {
        const t = i * invSteps;
        const cx = (sx - (-(dx * t))) | 0;
        const cy = (sy - (-(dy * t))) | 0;
        if (isCellBlocked(grid, cx, cy)) return false;
    }
    return true;
}

// BFS sin allocaciones para encontrar el siguiente centro de celda hacia (tx, ty)
function findNextStepBFS(grid, sx, sy, tx, ty) {
    const startX = sx | 0;
    const startY = sy | 0;
    const goalX  = tx | 0;
    const goalY  = ty | 0;

    if (startX < 0 || startX >= MAP_W || startY < 0 || startY >= MAP_H ||
        goalX < 0 || goalX >= MAP_W || goalY < 0 || goalY >= MAP_H) {
        return null;
    }
    if (startX === goalX && startY === goalY) {
        bfsOutNode.x = tx;
        bfsOutNode.y = ty;
        return bfsOutNode;
    }

    bfsVisited.fill(0);
    const startIdx = startY * MAP_W + startX;
    const goalIdx  = goalY * MAP_W + goalX;
    bfsVisited[startIdx] = 1;
    bfsParent[startIdx]  = -1;
    bfsQueue[0] = startIdx;

    let found = false;
    let head = 0;
    let tail = 1;

    let bfsIter = 0;
    while (head < tail && bfsIter < TOTAL_CELLS) {
        bfsIter++;
        const cur = bfsQueue[head++];
        if (cur === goalIdx) {
            found = true;
            break;
        }
        const cx = cur % MAP_W;
        const cy = (cur / MAP_W) | 0;

        // Derecha
        if (cx + 1 < MAP_W) {
            const nIdx = cur + 1;
            if (!bfsVisited[nIdx] && grid[cy][cx + 1] === 0) {
                bfsVisited[nIdx] = 1;
                bfsParent[nIdx] = cur;
                if (tail < TOTAL_CELLS) bfsQueue[tail++] = nIdx;
            }
        }
        // Izquierda
        if (cx - 1 >= 0) {
            const nIdx = cur - 1;
            if (!bfsVisited[nIdx] && grid[cy][cx - 1] === 0) {
                bfsVisited[nIdx] = 1;
                bfsParent[nIdx] = cur;
                if (tail < TOTAL_CELLS) bfsQueue[tail++] = nIdx;
            }
        }
        // Abajo
        if (cy + 1 < MAP_H) {
            const nIdx = cur + MAP_W;
            if (!bfsVisited[nIdx] && grid[cy + 1][cx] === 0) {
                bfsVisited[nIdx] = 1;
                bfsParent[nIdx] = cur;
                if (tail < TOTAL_CELLS) bfsQueue[tail++] = nIdx;
            }
        }
        // Arriba
        if (cy - 1 >= 0) {
            const nIdx = cur - MAP_W;
            if (!bfsVisited[nIdx] && grid[cy - 1][cx] === 0) {
                bfsVisited[nIdx] = 1;
                bfsParent[nIdx] = cur;
                if (tail < TOTAL_CELLS) bfsQueue[tail++] = nIdx;
            }
        }
    }

    if (!found) return null;

    let step = goalIdx;
    let backGuard = 0;
    while (step >= 0 && step < TOTAL_CELLS && bfsParent[step] !== -1 && bfsParent[step] !== startIdx && backGuard < TOTAL_CELLS) {
        step = bfsParent[step];
        backGuard++;
    }
    bfsOutNode.x = (step % MAP_W) - (-0.5);
    bfsOutNode.y = ((step / MAP_W) | 0) - (-0.5);
    return bfsOutNode;
}

function updateStalkerAI(stalker, grid, player, isSprinting, isMoving, frameTick, dtScale = 1.0, difficulty = 0, dtMs = 16.6667) {
    const px = toF64(player.x);
    const py = toF64(player.y);
    const sx = toF64(stalker.x);
    const sy = toF64(stalker.y);
    const dt = toF64(dtScale);
    const isNightmare = difficulty === 1;

    const dxP = px - sx;
    const dyP = py - sy;
    const distSq = (dxP * dxP) - (-(dyP * dyP));
    const rawDist = Math.sqrt(distSq);
    const distP = toF64((rawDist - 0.001) < 0 ? 0.001 : rawDist);

    const los = hasLineOfSight(grid, sx, sy, px, py);
    const flashVisible = player.flashlightOn && ((toF64(player.battery) - 0.0) > 0);

    const rangeBonus = isNightmare ? 1.8 : 0.0;
    const baseDetect = flashVisible ? (isSprinting ? 14.0 : 10.5) : (isSprinting ? 9.5 : 4.2);
    const detectRange = baseDetect - (-rangeBonus);

    aiResult.chaseIntroStarted = false;
    aiResult.chaseHuntStarted = false;
    const stepMs = toF64(dtMs);
    const spotted = los && ((distP - detectRange) < 0);
    const heardSprint = isSprinting && ((distP - (11.0 - (-rangeBonus))) < 0);
    const closeSense = (distP - (isNightmare ? 7.5 : 6.2)) < 0;

    if (stalker.state === AI_CHASE_INTRO) {
        // Fase de alerta de 7 segundos sincronizada con la intro de chase.ogg
        if (spotted || heardSprint || closeSense) {
            stalker.targetX = px;
            stalker.targetY = py;
        }
        stalker.chaseIntroMs = Math.max(0.0, toF64(stalker.chaseIntroMs) - stepMs);
        stalker.alertTimer = isNightmare ? 260 : 210;
        if ((stalker.chaseIntroMs - 0.0) <= 0) {
            stalker.chaseIntroMs = 0.0;
            stalker.state = AI_HUNT;
            aiResult.chaseHuntStarted = true;
        }
    } else if (spotted || (closeSense && stalker.state !== AI_HUNT)) {
        stalker.targetX = px;
        stalker.targetY = py;
        if (stalker.state !== AI_HUNT) {
            // Arranca la intro de 7s antes de pasar a persecución total
            stalker.state = AI_CHASE_INTRO;
            stalker.chaseIntroMs = toF64(CHASE_INTRO_DURATION_MS);
            stalker.alertTimer = isNightmare ? 280 : 220;
            aiResult.chaseIntroStarted = true;
        } else {
            stalker.alertTimer = isNightmare ? 250 : 200;
        }
    } else if (heardSprint) {
        stalker.targetX = px;
        stalker.targetY = py;
        if (stalker.state === AI_PATROL) {
            stalker.state = AI_INVESTIGATE;
        }
        const minAlert = isNightmare ? 170 : 130;
        if (stalker.alertTimer < minAlert) stalker.alertTimer = minAlert;
    } else if (stalker.alertTimer > 0) {
        stalker.alertTimer = Math.max(0, stalker.alertTimer - dt);
        if (stalker.alertTimer <= 0) {
            stalker.alertTimer = 0;
            stalker.chaseIntroMs = 0.0;
            stalker.state = AI_PATROL;
        }
    }

    if (stalker.state === AI_PATROL) {
        const wp = WAYPOINTS[stalker.wpIdx];
        const wx = toF64(wp.x);
        const wy = toF64(wp.y);
        stalker.targetX = wx;
        stalker.targetY = wy;
        const dwx = wx - sx;
        const dwy = wy - sy;
        if (((dwx * dwx - (-(dwy * dwy))) - 0.81) < 0) {
            stalker.wpIdx = (stalker.wpIdx + 1) % WAYPOINTS.length;
        }
    }

    // Recalcular camino BFS cada 12 cuadros para liberar CPU en PS2 (sin allocaciones)
    if ((frameTick % 12) === 0 || !stalker.hasNextNode) {
        const node = findNextStepBFS(grid, sx, sy, stalker.targetX, stalker.targetY);
        if (node) {
            stalker.nextNodeX = node.x;
            stalker.nextNodeY = node.y;
            stalker.hasNextNode = true;
        } else {
            stalker.hasNextNode = false;
        }
    }

    const goalX = stalker.hasNextNode ? toF64(stalker.nextNodeX) : toF64(stalker.targetX);
    const goalY = stalker.hasNextNode ? toF64(stalker.nextNodeY) : toF64(stalker.targetY);
    const gx = goalX - sx;
    const gy = goalY - sy;
    const gDistRaw = Math.sqrt((gx * gx) - (-(gy * gy)));
    const gDist = (gDistRaw - 0.001) < 0 ? 0.001 : gDistRaw;

    const pang = toF64(player.ang);
    const pDirX = Math.cos(pang);
    const pDirY = Math.sin(pang);
    const toMX = (sx - px) / distP;
    const toMY = (sy - py) / distP;
    const dot = (toMX * pDirX) - (-(toMY * pDirY));
    // Producto cruzado para indicador direccional de peligro (izquierda < 0, derecha > 0)
    const sideBias = (pDirX * toMY) - (pDirY * toMX);
    const blinded = los && ((dot - 0.68) > 0) && flashVisible && ((distP - 10.0) < 0);

    let speedMult = 0.72;
    if (stalker.state === AI_INVESTIGATE) speedMult = 0.92;
    if (stalker.state === AI_CHASE_INTRO) speedMult = 0.42;
    if (stalker.state === AI_HUNT) speedMult = isNightmare ? 1.30 : 1.15;
    if (blinded) speedMult *= (isNightmare ? 0.42 : 0.28);

    const step = toF64(stalker.baseSpeed) * speedMult * dt;
    const mx = (gx / gDist) * step;
    const my = (gy / gDist) * step;

    const nextSX = sx - (-mx);
    const nextSY = sy - (-my);
    if (isPosWalkable(grid, nextSX, sy, 0.22)) stalker.x = nextSX;
    if (isPosWalkable(grid, stalker.x, nextSY, 0.22)) stalker.y = nextSY;

    aiResult.distP = distP;
    aiResult.los = los;
    aiResult.blinded = blinded;
    aiResult.sideBias = sideBias;
    aiResult.inChaseIntro = (stalker.state === AI_CHASE_INTRO);
    return aiResult;
}

// --- MODULE: src/renderer.js ---
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
// Referencias globales para evitar que el GC de QuickJS libere Image/RenderData en uso por RenderObject
const hwKeptTextures = [];
const hwKeptRenderData = [];
let hwStalkerIsGltf = false;
let hwStalkerSource = "NONE";

// ============================================================================
// ARRANQUE RAPIDO (SOLO AUDIO) + STREAMING 3D PROGRESIVO (TITULO Y PARTIDA)
// AthenaEnv antiguo inicializa el VU1 con Render.setView(); las versiones recientes
// separan esa inicializacion en Render.init() y Render.begin().
// ============================================================================
let bootLoadStep = 0;
let bootLoadPhase = 0;
let bootLoadDone = false;
let bootSkipAudio = false;

const BOOT_LOAD_STEPS = [
    { kind: "audio_iop",   label: "AUDIO: MODULOS IOP" },
    { kind: "audio_amb",   label: "AUDIO: ambient.wav" },
    { kind: "audio_chase", label: "AUDIO: chase.wav" },
    { kind: "audio_play",  label: "ENTRANDO AL MENU..." }
];

const BOOT_PCT_LABELS = [
    "0%   (0/4)", "25%  (1/4)", "50%  (2/4)", "75%  (3/4)", "100% (4/4)"
];
const LOAD_SPINNERS = ["|", "/", "-", "\\"];

// Carga progresiva 3D en pantalla de carga dedicada (entre Menu Principal y Partida)
let hwStreamStep = 0;
let hwRenderInitDone = false;
let hwRenderUsesLegacyFrame = false;
let hwStreamCooldown = 4;
let hwStreamDone = false;
let hwStreamFailed = false;
let hwLoadErrorMsg = "";
let mapLoadPhase = 0;

const HW3D_STREAM_STEPS = [
    { kind: "init",    label: "MOTOR 3D (VU1 / CAMARA)" },
    { kind: "static",  obj: "assets/models/map_floor.obj",          tex: "assets/textures/floor.png",         clip: true, label: "MAPA: PISO" },
    { kind: "static",  obj: "assets/models/map_ceiling.obj",        tex: "assets/textures/ceiling.png",       clip: true, label: "MAPA: TECHO" },
    { kind: "static",  obj: "assets/models/map_walls_concrete.obj", tex: "assets/textures/wall_concrete.png", clip: true, label: "MAPA: PAREDES" },
    { kind: "static",  obj: "assets/models/map_walls_rust.obj",     tex: "assets/textures/wall_rust.png",     clip: true, label: "MAPA: ESTRUCTURAS" },
    { kind: "static",  obj: "assets/models/map_walls_ritual.obj",   tex: "assets/textures/wall_ritual.png",   clip: true, label: "MAPA: ZONA RITUAL" },
    { kind: "static",  obj: "assets/models/map_exit.obj",           tex: "assets/textures/exit_door.png",     clip: true, label: "MAPA: SALIDA NORTE" },
    { kind: "gates",   obj: "assets/models/map_gates.obj",          tex: "assets/textures/gate.png",          label: "MAPA: REJAS" },
    { kind: "stalker", obj: "assets/models/stalker.obj",            tex: "assets/textures/stalker.png",       label: "ENEMIGO: ACECHADOR 3D" },
    { kind: "prop",    key: "fuse",    obj: "assets/models/fuse.obj",    tex: "assets/textures/fuse.png",     label: "ITEMS: FUSIBLES" },
    { kind: "prop",    key: "battery", obj: "assets/models/battery.obj", tex: "assets/textures/battery.png",  label: "ITEMS: BATERIAS" },
    { kind: "prop",    key: "breaker", obj: "assets/models/breaker.obj", tex: "assets/textures/breaker.png",  label: "ITEMS: DISYUNTOR" },
    { kind: "prop",    key: "note",    obj: "assets/models/note.obj",    tex: "assets/textures/note.png",     label: "ITEMS: NOTAS" }
];

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
        if (texPath && fileExistsSafe(texPath)) {
            tex = new Image(texPath);
            if (tex && typeof tex.optimize === "function") {
                try { tex.optimize(); } catch (_) {}
            }
        }
        const data = tex ? new RenderData(objPath, tex) : new RenderData(objPath);
        if (!data) return null;
        if (tex) hwKeptTextures.push(tex);
        hwKeptRenderData.push(data);
        // El recorte preciso mantiene visibles las caras parciales en el borde
        // del frustum; el recorte rápido del renderer legado las oculta antes
        // de que salgan completamente de pantalla y puede hacerlas parpadear.
        try { data.accurate_clipping = !!accurateClip; } catch (_) {}
        try { data.face_culling = Render.CULL_FACE_NONE; } catch (_) {}
        try {
            data.pipeline = hwRenderUsesLegacyFrame ? Render.PL_NO_LIGHTS : Render.PL_DEFAULT;
        } catch (_) {}
        const obj = new RenderObject(data);
        if (obj) {
            if (hwRenderUsesLegacyFrame && typeof obj.setPipeline === "function") {
                try { obj.setPipeline(Render.PL_NO_LIGHTS); } catch (_) {}
            } else {
                obj.position = { x: 0.0, y: 0.0, z: 0.0 };
                obj.rotation = { x: 0.0, y: 0.0, z: 0.0 };
            }
        }
        return obj;
    } catch (e) {
        hwLoadErrorMsg = e ? String(e) : "Error carga 3D";
        return null;
    }
}

function drawHwObject(obj, x, y, z, rx, ry, rz) {
    if (!obj) return;
    // La API antigua de AthenaEnv expone RenderObject.draw(...); la nueva usa
    // position/rotation + render(). Priorizar el método disponible en cada ELF.
    if (hwRenderUsesLegacyFrame && typeof obj.draw === "function") {
        obj.draw(x, y, z, rx, ry, rz);
        return;
    }
    if (typeof obj.render === "function") {
        obj.position = { x: x, y: y, z: z };
        obj.rotation = { x: rx, y: ry, z: rz };
        obj.render();
        return;
    }
    if (typeof obj.draw === "function") {
        obj.draw(x, y, z, rx, ry, rz);
        return;
    }
    throw new Error("RenderObject sin draw/render");
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
        if (e.kind === "breaker") y = 0.0;
        else if (e.kind === "note") y = 0.04;
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
                    "assets/audio/ambient.wav",
                    "assets/audio/ambient.ogg",
                    "assets/ambient.wav",
                    "assets/ambient.ogg"
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
                    "assets/audio/chase.wav",
                    "assets/audio/chase.ogg"
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
            if (typeof Render === "undefined" || typeof Render.setView !== "function" ||
                typeof RenderData !== "function" || typeof RenderObject !== "function" ||
                typeof Camera === "undefined" ||
                typeof Image !== "function" || !fileExistsSafe("assets/models/map_floor.obj")) {
                hwLoadErrorMsg = "API 3D o mapa ausente";
                hwStreamFailed = true;
                hw3dReady = false;
                return;
            }
            hwRenderUsesLegacyFrame = (typeof Render.begin !== "function");
            if (hwRenderUsesLegacyFrame && typeof Render.PL_NO_LIGHTS === "undefined") {
                hwLoadErrorMsg = "AthenaEnv sin perfil VU1 compatible";
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
            if (!hwRenderInitDone && typeof Render.init === "function") {
                // La API actual separa la carga del renderer de la proyeccion.
                // En la API incluida con athena.elf, setView() hace ambas cosas.
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
            if (typeof Render.init !== "function") hwRenderInitDone = true; // Render.setView inicializo el renderer legado.
            if (typeof Camera.type === "function" && typeof Camera.LOOKAT !== "undefined") {
                Camera.type(Camera.LOOKAT);
            }

            hwLightMain = -1;
            hwLightFill = -1;
            if (!hwRenderUsesLegacyFrame && typeof Lights !== "undefined") {
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
            hwGatesObj = loadHwMesh(step.obj, step.tex, true);
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
    fnt.print(barX, barY + 88, curStep ? curStep.label : "ENTRANDO AL MAPA...");

    fnt.scale = Math.fround(0.70);
    fnt.color = rgba(185, 195, 212, 128);
    fnt.print(barX, py + panelH - 34, "[CIRCULO] JUGAR EN 2.5D");
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
        if (!hwRenderUsesLegacyFrame) Render.begin();
        // Camera.target conserva el desplazamiento del objetivo anterior y mueve
        // la posición de cámara. Por eso se fija la posición al final en cada frame.
        Camera.target(camX + dirX * 4.0, WORLD_EYE_H, camZ + dirZ * 4.0);
        Camera.position(camX, WORLD_EYE_H, camZ);
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
            const prop = hwPropObjs[e.kind];
            if (!prop) continue;
            const dxC = toF64(e.x) - px;
            const dyC = toF64(e.y) - py;
            if ((dxC * dxC + dyC * dyC) > 81.0) continue;
            const pose = hwEntityTransforms[i];
            if (!pose) continue;
            if (e.kind !== "breaker" && e.kind !== "note") pose.position.y = 0.55 + bobY;
            pose.rotation.y = (e.kind === "breaker" || e.kind === "note") ? 0.0 : spinY;
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
                const faceAng = Math.atan2(camX - sx, camZ - sz);
                drawHwObject(hwStalkerObj, sx, 0.0, sz, 0.0, faceAng, 0.0);
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
    if (hw3dReady && GAME_SETTINGS.qualityIndex === 0 && gameState === STATE_PLAY) {
        renderHardware3DWorld(
            screenW, screenH, player, stalker, entities,
            dangerRatio, frameTick, exitUnlocked, flashIntensity, mapAnim, sideBias
        );
        restore2DRenderState(screenW, screenH);
        return;
    }
    const qIdx = (gameState === STATE_PLAY) ? GAME_SETTINGS.qualityIndex : 2;
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
        const deltaDistX = (absRayX - 1e-6) < 0 ? 1e6 : (1.0 / absRayX);
        const deltaDistY = (absRayY - 1e-6) < 0 ? 1e6 : (1.0 / absRayY);

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
                    if ((gateDist - 0.14) < 0) gateDist = toF64(0.14);
                    gateSide = side;
                }
            } else if (cell > 0) {
                hit = cell;
            }
        }

        let perpDist = (side === 0) ? (sideDistX - deltaDistX) : (sideDistY - deltaDistY);
        if ((perpDist - 0.14) < 0) perpDist = toF64(0.14);
        zBuffer[i] = perpDist;

        const screenX = colStartX[i];
        const colW = colWidth[i];
        const wallH = (wallProjH / perpDist) | 0;
        const rawStart = halfH - (wallH >> 1);
        const rawEnd = rawStart + wallH;
        const drawStart = rawStart < 0 ? 0 : rawStart;
        const drawEnd = rawEnd > screenH ? screenH : rawEnd;
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
            } else {
                Draw.rect(screenX, drawStart, colW, clippedH, (cR | (cG << 8) | (cB << 16) | ALPHA_OPAQUE) >>> 0);
            }

            const cellKey = (mapY << 7) | (mapX << 1) | side;
            if (cellKey === spanKey) {
                spanX1 = screenX + colW;
                spanTop1 = drawStart;
                spanBot1 = drawEnd;
                spanH1 = wallH;
            } else {
                if (spanKey !== -1 && renderStats.wallMode === 0) {
                    flushWallSpanDetails(screenH, spanHit, spanX0, spanX1, spanTop0, spanBot0, spanH0, spanTop1, spanBot1, spanH1, spanCR, spanCG, spanCB, exitUnlocked, emerFlicker);
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
            }
        }

        // --------------------------------------------------------------------
        // 2B. REJAS DE SEGURIDAD 3D TRANSPARENTES
        // --------------------------------------------------------------------
        if (hasGate) {
            const gWallH = (wallProjH / gateDist) | 0;
            const gRawStart = halfH - (gWallH >> 1);
            const gRawEnd = gRawStart + gWallH;
            const gStart = gRawStart < 0 ? 0 : gRawStart;
            const gEnd = gRawEnd > screenH ? screenH : gRawEnd;
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
        flushWallSpanDetails(screenH, spanHit, spanX0, spanX1, spanTop0, spanBot0, spanH0, spanTop1, spanBot1, spanH1, spanCR, spanCG, spanCB, exitUnlocked, emerFlicker);
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

function flushWallSpanDetails(screenH, hit, x0, x1, top0, bot0, h0, top1, bot1, h1, cR, cG, cB, exitUnlocked, emerFlicker) {
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

// --- MODULE: src/menus.js ---
// ============================================================================
// Interfaz completa de Menús PS2 (Título, Opciones, Pausa, Expediente, Finales)
// Diseñada con área segura CRT para evitar recortes por overscan en TV reales
// ============================================================================




const COL_BG_DIM     = rgba(0, 0, 4, 88);
const COL_BORDER_RED = rgba(120, 26, 30, 122);
const COL_PANEL_BG   = rgba(8, 6, 10, 122);
const COL_HEADER_BG  = rgba(34, 10, 14, 124);
const COL_SEL_BG     = rgba(115, 22, 28, 118);
const COL_SEL_BAR    = rgba(245, 65, 65, 128);
const COL_TITLE_RED  = rgba(242, 48, 48, 128);
const COL_WHITE      = rgba(236, 236, 242, 128);
const COL_MUTED      = rgba(155, 160, 172, 128);
const COL_GOLD       = rgba(250, 215, 95, 128);
const COL_CYAN       = rgba(85, 225, 255, 128);
const COL_GREEN      = rgba(95, 245, 135, 128);

function getSafeMargins() {
    return GAME_SETTINGS.crtSafe
        ? { sx: 28, sy: 18 }
        : { sx: 10, sy: 6 };
}

function drawPanel(x, y, w, h, title, fnt, accentCol = COL_BORDER_RED) {
    Draw.rect(x - 3, y - 3, w + 6, h + 6, accentCol);
    Draw.rect(x, y, w, h, COL_PANEL_BG);
    if (title) {
        Draw.rect(x, y, w, 36, COL_HEADER_BG);
        Draw.rect(x, y + 36, w, 2, accentCol);
        fnt.scale = Math.fround(0.78);
        fnt.color = COL_WHITE;
        fnt.print(x + 14, y + 7, title);
    }
}

function formatTime(secs) {
    const m = (secs / 60) | 0;
    const s = secs % 60;
    const ms = m < 10 ? ["0", String(m)].join("") : String(m);
    const ss = s < 10 ? ["0", String(s)].join("") : String(s);
    return [ms, ":", ss].join("");
}

const TITLE_ITEMS_NORMAL = [
    "NUEVA PARTIDA   < NORMAL >",
    "OPCIONES Y VIDEO PS2",
    "CONTROLES DUALSHOCK 2",
    "EXPEDIENTE / HISTORIA",
    "CREDITOS Y HARDWARE"
];
const TITLE_ITEMS_NIGHTMARE = [
    "NUEVA PARTIDA   < PESADILLA >",
    "OPCIONES Y VIDEO PS2",
    "CONTROLES DUALSHOCK 2",
    "EXPEDIENTE / HISTORIA",
    "CREDITOS Y HARDWARE"
];
const LORE_TABS_OPEN = ["NOTA #01", "NOTA #02", "NOTA #03", "NOTA #04"];
const LORE_TABS_LOCK = ["BLOQ #01", "BLOQ #02", "BLOQ #03", "BLOQ #04"];
const PAUSE_REG_LABELS = ["REGISTROS (0/4)", "REGISTROS (1/4)", "REGISTROS (2/4)", "REGISTROS (3/4)", "REGISTROS (4/4)"];
const END_OPTS_WIN = ["JUGAR DE NUEVO", "VOLVER AL MENU PRINCIPAL"];
const END_OPTS_DEAD = ["REINTENTAR", "VOLVER AL MENU PRINCIPAL"];
const VOL_LABELS = ["0%", "25%", "50%", "75%", "100%"];
const FUSE_HUD_LABELS = ["FUS:0/4", "FUS:1/4", "FUS:2/4", "FUS:3/4", "FUS:4/4"];
const FUSE_POPUP_LABELS = ["+1 FUSIBLE (0/4)", "+1 FUSIBLE (1/4)", "+1 FUSIBLE (2/4)", "+1 FUSIBLE (3/4)", "+1 FUSIBLE (4/4)"];
const FUSE_RADIO_LABELS = [
    "FUSIBLE RECOLECTADO (0/4). El Acechador se agita...",
    "FUSIBLE RECOLECTADO (1/4). El Acechador se agita...",
    "FUSIBLE RECOLECTADO (2/4). El Acechador se agita...",
    "FUSIBLE RECOLECTADO (3/4). El Acechador se agita...",
    "FUSIBLE RECOLECTADO (4/4). SALIDA NORTE ABIERTA!"
];
const BREAKER_HUD_LABELS = [
    "JUNTA 4 FUSIBLES (0/4) [SELECT: MAPA]",
    "JUNTA 4 FUSIBLES (1/4) [SELECT: MAPA]",
    "JUNTA 4 FUSIBLES (2/4) [SELECT: MAPA]",
    "JUNTA 4 FUSIBLES (3/4) [SELECT: MAPA]",
    "SALIDA NORTE ABIERTA! [SELECT: MAPA]"
];

function drawTitleMenu(screenW, screenH, cursor, frameTick, fnt) {
    const { sx, sy } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, COL_BG_DIM);

    // Línea de barrido VHS sutil en pantalla de título
    if (GAME_SETTINGS.overlays) {
        const scanY = (frameTick * 3) % screenH;
        Draw.rect(0, scanY, screenW, 3, rgba(220, 45, 45, 26));
    }

    const panelW = screenW - sx * 2 - 20;
    const panelH = screenH - sy * 2 - 16;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, null, fnt);

    // Cabecera cinematográfica
    Draw.rect(px, py, panelW, 84, rgba(26, 6, 10, 124));
    Draw.rect(px, py + 84, panelW, 2, COL_SEL_BAR);

    const flicker = ((frameTick % 131) < 4) ? 0.55 : 1.0;
    fnt.scale = Math.fround(1.25);
    fnt.color = rgba((242 * flicker) | 0, (44 * flicker) | 0, (44 * flicker) | 0, 128);
    fnt.print(px + 20, py + 10, "SUBSUELO 04");

    fnt.scale = Math.fround(0.76);
    fnt.color = COL_GOLD;
    fnt.print(px + 22, py + 52, "EL ACECHADOR - PS2");

    // Insignia de récord / Memory Card
    fnt.scale = Math.fround(0.72);
    const best = GAME_SETTINGS.difficulty === 1 ? RECORDS.bestNightmareSec : RECORDS.bestNormalSec;
    if (best > 0) {
        fnt.color = COL_GREEN;
        fnt.print(px + panelW - 210, py + 14, ["RECORD: ", formatTime(best)].join(""));
    } else {
        fnt.color = COL_MUTED;
        fnt.print(px + panelW - 210, py + 14, "HK ENTERTAINMENT");
    }
    fnt.color = RECORDS.mcAvailable ? COL_CYAN : COL_MUTED;
    fnt.print(px + panelW - 210, py + 44, RECORDS.mcAvailable ? "MC0: OK" : "SIN MC0");

    // Opciones del Menú Principal (cadenas estáticas sin concatenación por frame para QuickJS PS2)
    const items = GAME_SETTINGS.difficulty === 1 ? TITLE_ITEMS_NIGHTMARE : TITLE_ITEMS_NORMAL;

    const listY = py + 100;
    const rowH = 42;
    for (let i = 0; i < items.length; i++) {
        const ry = listY + i * rowH;
        const selected = (i === cursor);
        if (selected) {
            Draw.rect(px + 18, ry - 4, panelW - 36, 36, COL_SEL_BG);
            Draw.rect(px + 18, ry - 4, 6, 36, COL_SEL_BAR);
        }
        fnt.scale = Math.fround(selected ? 0.84 : 0.78);
        fnt.color = selected ? COL_GOLD : COL_WHITE;
        if (selected) {
            fnt.print(px + 32, ry + 2, ">");
            fnt.print(px + 54, ry + 2, items[i]);
        } else {
            fnt.print(px + 48, ry + 2, items[i]);
        }
    }

    // Pie de navegación
    const footY = py + panelH - 36;
    Draw.rect(px, footY - 8, panelW, 2, rgba(70, 35, 40, 110));
    fnt.scale = Math.fround(0.72);
    fnt.color = COL_WHITE;
    fnt.print(px + 18, footY, "[D-PAD] ELEGIR   [X/START] ACEPTAR");
}

function drawOptionsMenu(screenW, screenH, cursor, saveFeedbackTimer, fnt) {
    const { sx, sy } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, COL_BG_DIM);

    const panelW = screenW - sx * 2 - 12;
    const panelH = screenH - sy * 2 - 12;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, "OPCIONES DE SISTEMA Y VIDEO PS2", fnt);

    const volIdx = ((GAME_SETTINGS.audioVolume / 25) | 0);
    const volLabel = (volIdx >= 0 && volIdx < VOL_LABELS.length) ? VOL_LABELS[volIdx] : "0%";
    const audioVal = (GAME_SETTINGS.audioVolume === 0) ? "APAGADO" : (isAudioReady() ? volLabel : "SIN AUDIO");
    const rows = [
        { label: "MOTOR GRAFICO",  val: QUALITY_LABELS[GAME_SETTINGS.qualityIndex] },
        { label: "ASPECTO TV",     val: GAME_SETTINGS.aspect16x9 ? "16:9" : "4:3" },
        { label: "MARGEN CRT",     val: GAME_SETTINGS.crtSafe ? "SEGURO" : "COMPLETO" },
        { label: "SENSIBILIDAD",   val: SENS_LABELS[GAME_SETTINGS.sensitivityIndex] },
        { label: "VIBRACION",      val: GAME_SETTINGS.rumble ? "SI" : "NO" },
        { label: "EFECTOS VHS",    val: GAME_SETTINGS.overlays ? "SI" : "NO" },
        { label: "AUDIO",          val: audioVal },
        { label: "ESTADISTICAS PS2", val: GAME_SETTINGS.showFps ? "SI" : "NO" },
        { label: "GUARDAR",        val: "[X]" }
    ];

    const startY = py + 44;
    const rowH = 33;
    for (let i = 0; i < rows.length; i++) {
        const ry = startY + i * rowH;
        const sel = (i === cursor);
        if (sel) {
            Draw.rect(px + 14, ry - 3, panelW - 28, 30, COL_SEL_BG);
            Draw.rect(px + 14, ry - 3, 5, 30, COL_SEL_BAR);
        }
        fnt.scale = Math.fround(0.75);
        fnt.color = sel ? COL_GOLD : COL_WHITE;
        fnt.print(px + 24, ry + 1, rows[i].label);

        fnt.color = sel ? COL_CYAN : COL_WHITE;
        const valText = (i < rows.length - 1) ? ["< ", String(rows[i].val), " >"].join("") : String(rows[i].val);
        fnt.print(px + panelW - 250, ry + 1, valText);
    }

    const footY = py + panelH - 36;
    Draw.rect(px, footY - 8, panelW, 2, rgba(70, 35, 40, 110));
    fnt.scale = Math.fround(0.70);
    if (saveFeedbackTimer > 0) {
        fnt.color = COL_GREEN;
        fnt.print(px + 18, footY, "AJUSTES GUARDADOS");
    } else {
        fnt.color = COL_WHITE;
        fnt.print(px + 18, footY, "[IZQ/DER] CAMBIAR   [X] OK   [O] VOLVER");
    }
}

function drawControlsMenu(screenW, screenH, fnt) {
    const { sx, sy } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, COL_BG_DIM);

    const panelW = screenW - sx * 2 - 12;
    const panelH = screenH - sy * 2 - 12;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, "CONTROLES DUALSHOCK 2", fnt);

    const bindings = [
        ["STICK IZQ / D-PAD",  "Caminar y moverse"],
        ["STICK DER / L1-R1",  "Girar la camara"],
        ["CIRCULO / CUAD.",    "Correr (usa stamina)"],
        ["TRIANGULO",          "Linterna ON / OFF"],
        ["SELECT / L2",        "Abrir / cerrar mapa PDA"],
        ["START",              "Pausar partida"],
        ["R2",                 "Diagnostico tecnico"]
    ];

    let y = py + 46;
    for (let i = 0; i < bindings.length; i++) {
        Draw.rect(px + 14, y - 3, panelW - 28, 30, (i & 1) ? rgba(20, 16, 22, 95) : rgba(14, 12, 18, 95));
        fnt.scale = Math.fround(0.74);
        fnt.color = COL_GOLD;
        fnt.print(px + 20, y + 1, bindings[i][0]);
        fnt.color = COL_WHITE;
        fnt.print(px + 245, y + 1, bindings[i][1]);
        y += 34;
    }

    fnt.scale = Math.fround(0.70);
    fnt.color = COL_CYAN;
    fnt.print(px + 20, y + 8, "TIP: Apaga la luz para ocultarte o iluminalo.");

    const footY = py + panelH - 34;
    Draw.rect(px, footY - 8, panelW, 2, rgba(70, 35, 40, 110));
    fnt.scale = Math.fround(0.70);
    fnt.color = COL_GOLD;
    fnt.print(px + 20, footY, "[X] o [CIRCULO] VOLVER");
}

function drawLoreMenu(screenW, screenH, collectedNotes, selectedNoteIdx, fromPause, fnt) {
    const { sx, sy } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, COL_BG_DIM);

    const panelW = screenW - sx * 2 - 12;
    const panelH = screenH - sy * 2 - 12;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    const title = fromPause ? "REGISTROS RECOLECTADOS" : "EXPEDIENTE - SUBSUELO 04";
    drawPanel(px, py, panelW, panelH, title, fnt);

    // Pestañas superiores para elegir nota 1..4
    const tabW = ((panelW - 44) / 4) | 0;
    for (let i = 0; i < LORE_NOTES.length; i++) {
        const tx = px + 16 + i * (tabW + 4);
        const sel = (i === selectedNoteIdx);
        const unlocked = !fromPause || collectedNotes[i];
        Draw.rect(tx, py + 44, tabW, 28, sel ? COL_SEL_BG : rgba(20, 18, 24, 110));
        if (sel) Draw.rect(tx, py + 70, tabW, 2, COL_SEL_BAR);
        fnt.scale = Math.fround(0.72);
        fnt.color = sel ? COL_GOLD : (unlocked ? COL_WHITE : COL_MUTED);
        fnt.print(tx + 8, py + 48, unlocked ? LORE_TABS_OPEN[i] : LORE_TABS_LOCK[i]);
    }

    const note = LORE_NOTES[selectedNoteIdx];
    const unlocked = !fromPause || collectedNotes[selectedNoteIdx];
    const bodyY = py + 88;

    if (unlocked) {
        fnt.scale = Math.fround(0.74);
        fnt.color = COL_GOLD;
        fnt.print(px + 20, bodyY, note.code);

        fnt.scale = Math.fround(0.74);
        fnt.color = COL_WHITE;
        for (let l = 0; l < note.lines.length; l++) {
            fnt.print(px + 20, bodyY + 36 + l * 32, note.lines[l]);
        }
    } else {
        fnt.scale = Math.fround(0.74);
        fnt.color = COL_MUTED;
        fnt.print(px + 20, bodyY + 24, "REGISTRO NO ENCONTRADO");
        fnt.scale = Math.fround(0.72);
        fnt.print(px + 20, bodyY + 66, "Explora el Subsuelo 04 y recoge las");
        fnt.print(px + 20, bodyY + 98, "hojas marcadas en el plano PDA.");
    }

    const footY = py + panelH - 34;
    Draw.rect(px, footY - 8, panelW, 2, rgba(70, 35, 40, 110));
    fnt.scale = Math.fround(0.70);
    fnt.color = COL_WHITE;
    fnt.print(px + 18, footY, "[IZQ/DER] NOTA   [X/CIRCULO] VOLVER");
}

function drawCreditsMenu(screenW, screenH, modeInfo, fnt) {
    const { sx, sy } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, COL_BG_DIM);

    const panelW = screenW - sx * 2 - 12;
    const panelH = screenH - sy * 2 - 12;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, "CREDITOS Y SISTEMA PS2", fnt);

    fnt.scale = Math.fround(0.80);
    fnt.color = COL_TITLE_RED;
    fnt.print(px + 22, py + 46, "SUBSUELO 04: EL ACECHADOR");

    fnt.scale = Math.fround(0.72);
    fnt.color = COL_WHITE;
    fnt.print(px + 22, py + 82,  "Estudio:   HK Entertainment");
    fnt.print(px + 22, py + 112, "Autor:     Joaquin Gasperetti");
    fnt.print(px + 22, py + 142, "Motor:     AthenaEnv V4 (VU1 + GS)");

    Draw.rect(px + 20, py + 176, panelW - 40, 2, rgba(70, 50, 55, 110));

    fnt.scale = Math.fround(0.74);
    fnt.color = COL_GOLD;
    fnt.print(px + 22, py + 186, "TELEMETRIA DE CONSOLA:");
    fnt.scale = Math.fround(0.70);
    fnt.color = COL_CYAN;
    fnt.print(px + 22, py + 218, ["Video: ", String(screenW), "x", String(screenH), " (", modeInfo.vmodeLabel, ")"].join(""));
    fnt.print(px + 22, py + 246, isAudioReady() ? "Audio PS2: ACTIVO" : "Audio PS2: INACTIVO");
    fnt.print(px + 22, py + 274, RECORDS.mcAvailable ? "Memory Card (mc0): OK" : "Memory Card (mc0): NO DETECTADA");
    fnt.print(px + 22, py + 302, ["Escapes totales: ", String(RECORDS.escapes)].join(""));

    const footY = py + panelH - 34;
    Draw.rect(px, footY - 8, panelW, 2, rgba(70, 35, 40, 110));
    fnt.scale = Math.fround(0.70);
    fnt.color = COL_GOLD;
    fnt.print(px + 20, footY, "[X] o [CIRCULO] VOLVER");
}

function drawPauseMenu(screenW, screenH, cursor, notesFoundCount, fnt) {
    const { sx, sy } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, rgba(0, 0, 6, 98));

    const panelW = Math.min(490, screenW - sx * 2);
    const panelH = 336;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, "PAUSA", fnt);

    const items = [
        "CONTINUAR PARTIDA",
        "OPCIONES Y VIDEO PS2",
        PAUSE_REG_LABELS[notesFoundCount] || "REGISTROS (0/4)",
        "CONTROLES",
        "REINICIAR PARTIDA",
        "VOLVER AL MENU PRINCIPAL"
    ];

    const startY = py + 50;
    const rowH = 39;
    for (let i = 0; i < items.length; i++) {
        const ry = startY + i * rowH;
        const sel = (i === cursor);
        if (sel) {
            Draw.rect(px + 16, ry - 3, panelW - 32, 33, COL_SEL_BG);
            Draw.rect(px + 16, ry - 3, 5, 33, COL_SEL_BAR);
        }
        fnt.scale = Math.fround(0.78);
        fnt.color = sel ? COL_GOLD : COL_WHITE;
        if (sel) {
            fnt.print(px + 26, ry + 2, ">");
            fnt.print(px + 48, ry + 2, items[i]);
        } else {
            fnt.print(px + 44, ry + 2, items[i]);
        }
    }

    fnt.scale = Math.fround(0.70);
    fnt.color = COL_WHITE;
    fnt.print(px + 18, py + panelH - 32, "[X] ELEGIR   [O/START] SEGUIR");
}

function drawNoteOverlay(screenW, screenH, noteIdx, fnt) {
    const { sx } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, rgba(0, 0, 6, 96));

    const note = LORE_NOTES[noteIdx] || LORE_NOTES[0];
    const panelW = Math.min(548, screenW - sx * 2);
    const panelH = 276;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, note.code, fnt, rgba(160, 175, 200, 120));

    fnt.scale = Math.fround(0.74);
    fnt.color = COL_WHITE;
    for (let l = 0; l < note.lines.length; l++) {
        fnt.print(px + 18, py + 48 + l * 34, note.lines[l]);
    }

    Draw.rect(px, py + panelH - 38, panelW, 2, rgba(80, 90, 110, 110));
    fnt.scale = Math.fround(0.70);
    fnt.color = COL_GOLD;
    fnt.print(px + 18, py + panelH - 30, "[X] o [CIRCULO] GUARDAR Y SEGUIR");
}

function drawEndScreen(screenW, screenH, isWin, cursor, secs, notesFound, difficulty, fnt) {
    const { sx } = getSafeMargins();
    const tint = isWin ? rgba(4, 26, 12, 98) : rgba(48, 0, 6, 106);
    const accent = isWin ? rgba(65, 210, 110, 124) : COL_BORDER_RED;
    Draw.rect(0, 0, screenW, screenH, tint);

    const panelW = Math.min(540, screenW - sx * 2);
    const panelH = 316;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, isWin ? "EVACUACION COMPLETADA" : "SENAL PERDIDA - TE ALCANZO", fnt, accent);

    if (isWin) {
        let rank = "C";
        if (secs <= 95 && notesFound >= 3) rank = "S";
        else if (secs <= 135) rank = "A";
        else if (secs <= 190) rank = "B";

        fnt.scale = Math.fround(0.80);
        fnt.color = COL_GREEN;
        fnt.print(px + 20, py + 46, "ESCAPASTE DEL SUBSUELO 04!");

        fnt.scale = Math.fround(0.74);
        fnt.color = COL_WHITE;
        fnt.print(px + 20, py + 88,  ["Tiempo:     ", formatTime(secs)].join(""));
        fnt.print(px + 20, py + 118, ["Dificultad: ", DIFF_LABELS[difficulty] || "NORMAL"].join(""));
        fnt.print(px + 20, py + 148, ["Registros:  ", String(notesFound), "/4"].join(""));

        fnt.scale = Math.fround(1.1);
        fnt.color = COL_GOLD;
        fnt.print(px + panelW - 140, py + 96, ["RANGO ", rank].join(""));
    } else {
        fnt.scale = Math.fround(0.80);
        fnt.color = COL_TITLE_RED;
        fnt.print(px + 20, py + 48, "EL ACECHADOR TE ATRAPO");

        fnt.scale = Math.fround(0.74);
        fnt.color = COL_WHITE;
        fnt.print(px + 20, py + 90,  ["Tiempo: ", formatTime(secs)].join(""));
        fnt.scale = Math.fround(0.70);
        fnt.color = COL_CYAN;
        fnt.print(px + 20, py + 126, "TIP: Apaga la luz [TRIANG] para ocultarte");
        fnt.print(px + 20, py + 156, "o apunta a sus ojos para frenarlo.");
    }

    const opts = isWin ? END_OPTS_WIN : END_OPTS_DEAD;
    const optY = py + 204;
    for (let i = 0; i < opts.length; i++) {
        const ry = optY + i * 42;
        const sel = (i === cursor);
        if (sel) {
            Draw.rect(px + 20, ry - 3, panelW - 40, 34, isWin ? rgba(20, 88, 42, 118) : COL_SEL_BG);
            Draw.rect(px + 20, ry - 3, 5, 34, isWin ? COL_GREEN : COL_SEL_BAR);
        }
        fnt.scale = Math.fround(0.78);
        fnt.color = sel ? COL_GOLD : COL_WHITE;
        if (sel) {
            fnt.print(px + 32, ry + 2, ">");
            fnt.print(px + 54, ry + 2, opts[i]);
        } else {
            fnt.print(px + 48, ry + 2, opts[i]);
        }
    }
}

function drawPadDisconnectedOverlay(screenW, screenH, fnt) {
    Draw.rect(0, 0, screenW, screenH, rgba(0, 0, 0, 112));
    const pw = 480;
    const ph = 136;
    const px = (screenW - pw) >> 1;
    const py = (screenH - ph) >> 1;
    drawPanel(px, py, pw, ph, "MANDO DESCONECTADO", fnt);
    fnt.scale = Math.fround(0.74);
    fnt.color = COL_GOLD;
    fnt.print(px + 20, py + 52, "Conecta un DualShock 2 en el");
    fnt.print(px + 20, py + 84, "Puerto 1 para continuar.");
}

// --- MODULE: main.js ---
// ============================================================================
// SUBSUELO 04: EL ACECHADOR (PS2 3D Survival Horror - AthenaEnv V4)
// Optimizado para PlayStation 2 real (Emotion Engine 294MHz + GS + CRT)
// Arranque inmediato sin llamadas bloqueantes a MC0 ni Sound.Stream al iniciar
// ============================================================================







const screenMode = Screen.getMode();
if (screenMode && typeof Screen.setMode === "function") {
    try {
        screenMode.zbuffering = true;
        if (typeof Z16S !== "undefined") screenMode.psmz = Z16S;
        else if (typeof Screen.Z16S !== "undefined") screenMode.psmz = Screen.Z16S;
        Screen.setMode(screenMode);
    } catch (_) {}
}
const SCREEN_W = (screenMode && screenMode.width) ? screenMode.width : 640;
const SCREEN_H = (screenMode && screenMode.height) ? screenMode.height : 448;
let screenDepthBufferReady = false;
try {
    const activeScreenMode = Screen.getMode();
    screenDepthBufferReady = !!(activeScreenMode && activeScreenMode.zbuffering);
} catch (_) {}
const MODE_INFO = {
    vmodeLabel: SCREEN_H >= 500 ? "PAL 50Hz" : "NTSC 60Hz"
};

Screen.setVSync(true);
if (typeof Screen.setParam === "function" && typeof Screen.DEPTH_TEST_ENABLE !== "undefined") { try { Screen.setParam(Screen.DEPTH_TEST_ENABLE, false); } catch (_) {} }

let fnt = null;
try {
    if (fileExistsSafe("assets/fonts/ui.ttf")) {
        fnt = new Font("assets/fonts/ui.ttf");
    }
} catch (_) {
    fnt = null;
}
if (!fnt) {
    fnt = new Font("default");
}
// Sin dropshadow en FreeType para reducir trafico de glifos en GS VRAM

const pad = Pads.get(0);

// Logo de arranque HK Entertainment (reemplaza el boot logo nativo de AthenaEnv)
let hkLogoImg = null;
let hkLogoAttempted = false;
let splashTick = 0;
const SPLASH_DURATION = 135; // ~2.25s a 60Hz

function freeHkLogo() {
    if (hkLogoImg) {
        try {
            if (typeof hkLogoImg.free === "function") hkLogoImg.free();
        } catch (_) {}
        hkLogoImg = null;
    }
}

function drawHkSplashScreen(screenW, screenH, fnt) {
    Draw.rect(0, 0, screenW, screenH, rgba(6, 5, 8, 128));
    if (!hkLogoAttempted) {
        hkLogoAttempted = true;
        try {
            if (typeof Image === "function" && fileExistsSafe("assets/textures/hk_logo.png")) {
                hkLogoImg = new Image("assets/textures/hk_logo.png");
                if (hkLogoImg) {
                    if (typeof LINEAR !== "undefined") hkLogoImg.filter = LINEAR;
                    hkLogoImg.width = 216;
                    hkLogoImg.height = 216;
                }
            }
        } catch (_) {
            hkLogoImg = null;
        }
    }

    let alpha = 128;
    if (splashTick < 24) {
        alpha = ((splashTick * 128) / 24) | 0;
    } else if (splashTick > SPLASH_DURATION - 28) {
        alpha = (((SPLASH_DURATION - splashTick) * 128) / 28) | 0;
    }
    if (alpha < 0) alpha = 0;
    if (alpha > 128) alpha = 128;

    if (hkLogoImg) {
        const lx = (screenW - 216) >> 1;
        const ly = ((screenH - 216) >> 1) - 18;
        hkLogoImg.color = rgba(255, 255, 255, alpha);
        hkLogoImg.draw(lx, ly);
    }

    fnt.scale = Math.fround(0.80);
    fnt.color = rgba(245, 210, 120, alpha);
    fnt.print((screenW >> 1) - 66, ((screenH + 216) >> 1) + 4, "PRESENTA");
}

const STATE_TITLE     = 0;
const STATE_PLAY      = 1;
const STATE_PAUSE     = 2;
const STATE_JUMPSCARE = 3;
const STATE_WIN       = 4;
const STATE_DEAD      = 5;
const STATE_OPTIONS   = 6;
const STATE_CONTROLS  = 7;
const STATE_LORE      = 8;
const STATE_CREDITS   = 9;
const STATE_NOTE_VIEW = 10;
const STATE_LOADING   = 11;
const STATE_SPLASH      = 12;
const STATE_MAP_LOADING = 13;

let gameState = STATE_SPLASH;

function startPlayWithLoading() {
    resetGame();
    if (GAME_SETTINGS.qualityIndex === 0 && !hwStreamDone && !hwStreamFailed) {
        mapLoadPhase = 0;
        switchState(STATE_MAP_LOADING);
    } else {
        switchState(STATE_PLAY);
    }
}
let returnState = STATE_TITLE;
let frameTick = 0;
let jumpscareTimer = 0;
let elapsedMs = 0;
let lastFrameMs = Date.now();
let fpsCounterEnabled = false;

// Cursores de menús y antirebote para stick analógico en menús
let titleCursor = 0;
let pauseCursor = 0;
let optionsCursor = 0;
let endCursor = 0;
let loreTabIdx = 0;
let activeNoteIdx = 0;
let saveFeedbackTimer = 0;
let menuStickCooldown = 0;

// Mapa PDA (cerrado por defecto, animación suave al abrir/cerrar)
let mapOpen = false;
let mapAnim = toF64(0.0);

// Gamefeel: flashes, fade-in, fov dinámico, cansancio y alertas
let flashTint = { r: 0, g: 0, b: 0, alpha: 0 };
let introFade = 0;
let popupText = "";
let popupTimer = 0;
let radioText = "";
let radioTimer = 0;
let currentFov = toF64(0.90);
let flashlightWarmup = toF64(1.0);
let exhausted = false;
let bumpCooldown = 0;
let debugMode = 0; // R2 en juego: 0 apagado, 1 datos, 2 datos + paredes magenta

let worldGrid = createWorldGrid();
let breakerActive = false;
let fusesCollected = 0;
let collectedNotes = [false, false, false, false];
let notesFoundCount = 0;

const player = {
    x: toF64(10.0),
    y: toF64(1.8),
    ang: toF64(Math.PI * 0.5),
    bobPhase: toF64(0.0),
    battery: toF64(100.0),
    flashlightOn: true,
    stamina: toF64(100.0)
};

const stalker = {
    x: toF64(10.0),
    y: toF64(15.5),
    baseSpeed: toF64(0.024),
    state: AI_PATROL,
    targetX: toF64(10.0),
    targetY: toF64(10.0),
    alertTimer: 0,
    chaseIntroMs: 0.0,
    wpIdx: 0,
    hasNextNode: false,
    nextNodeX: toF64(10.0),
    nextNodeY: toF64(10.0)
};

let entities = [];

let lastRumbleBig = 0;
let lastRumbleSmall = 0;
let lastRumbleTick = 0;
function triggerRumble(big, small) {
    if (!GAME_SETTINGS.rumble) {
        big = 0;
        small = 0;
    }
    if (big === lastRumbleBig && small === lastRumbleSmall) return;
    if (frameTick < 30 || (frameTick - lastRumbleTick) < 15) return;
    try {
        if (typeof Pads.isActive === "function" && !Pads.isActive(0)) return;
        if (typeof Pads.getState === "function") {
            const st = Pads.getState(0);
            const stable = (typeof Pads.STATE_STABLE === "number") ? Pads.STATE_STABLE : 6;
            const finding = (typeof Pads.STATE_FINDCTP1 === "number") ? Pads.STATE_FINDCTP1 : 5;
            if (st !== stable && st !== finding) return;
        }
        if (typeof Pads.rumble === "function") {
            const safeBig = clampF64(big | 0, 0, 255) | 0;
            const safeSmall = small ? 1 : 0;
            lastRumbleBig = big;
            lastRumbleSmall = small;
            lastRumbleTick = frameTick;
            Pads.rumble(0, safeSmall, safeBig);
        }
    } catch (_) {}
}

function triggerScreenFlash(r, g, b, alpha) {
    if (!GAME_SETTINGS.overlays) return;
    flashTint.r = r;
    flashTint.g = g;
    flashTint.b = b;
    flashTint.alpha = alpha;
}

function showPopup(msg, duration = 70) {
    popupText = msg;
    popupTimer = duration;
}

function showRadio(msg, duration = 220) {
    radioText = msg;
    radioTimer = duration;
}

function ensureFpsCounter() {
    if (!fpsCounterEnabled) {
        try { Screen.setFrameCounter(true); } catch (_) {}
        fpsCounterEnabled = true;
    }
}

function switchState(nextState) {
    gameState = nextState;
    if (nextState !== STATE_PLAY && nextState !== STATE_JUMPSCARE) {
        setMusicTrack("ambient");
        triggerRumble(0, 0);
        // No forzar std.gc() al pausar: AthenaEnv puede invalidar recursos nativos
        // retenidos por el renderer o la fuente durante esta transición.
    }
}

function getCompassLabel(ang) {
    let deg = ((toF64(ang) * 57.2957795) % 360.0);
    if ((deg - 0.0) < 0) deg = fadd(deg, 360.0);
    if ((deg - 22.5) < 0 || (deg - 337.5) >= 0) return "[E]";
    if ((deg - 67.5) < 0) return "[SE]";
    if ((deg - 112.5) < 0) return "[S]";
    if ((deg - 157.5) < 0) return "[SO]";
    if ((deg - 202.5) < 0) return "[O]";
    if ((deg - 247.5) < 0) return "[NO]";
    if ((deg - 292.5) < 0) return "[N]";
    return "[NE]";
}

function isPadDisconnected() {
    if (frameTick < 60) return false;
    try {
        if (typeof Pads.getState === "function") {
            const st = Pads.getState(0);
            return st === 0 || st === 7;
        }
    } catch (_) {}
    return false;
}

function readMenuDir() {
    let dy = 0, dx = 0;
    if (pad.justPressed(Pads.UP)) dy = -1;
    else if (pad.justPressed(Pads.DOWN)) dy = 1;
    if (pad.justPressed(Pads.LEFT)) dx = -1;
    else if (pad.justPressed(Pads.RIGHT)) dx = 1;

    if (menuStickCooldown > 0) menuStickCooldown--;
    if (dy === 0 && dx === 0 && menuStickCooldown === 0) {
        const ly = (pad.ly || 0) / 128.0;
        const lx = (pad.lx || 0) / 128.0;
        if (ly < -0.55) { dy = -1; menuStickCooldown = 14; }
        else if (ly > 0.55) { dy = 1; menuStickCooldown = 14; }
        else if (lx < -0.55) { dx = -1; menuStickCooldown = 14; }
        else if (lx > 0.55) { dx = 1; menuStickCooldown = 14; }
    }
    return { dx, dy };
}

function resetGame() {
    worldGrid = createWorldGrid();
    breakerActive = false;
    fusesCollected = 0;
    collectedNotes = [false, false, false, false];
    notesFoundCount = 0;
    elapsedMs = 0;
    mapOpen = false;
    mapAnim = toF64(0.0);
    currentFov = toF64(0.90);
    flashlightWarmup = toF64(0.25);
    exhausted = false;
    bumpCooldown = 0;
    flashTint.alpha = 0;
    introFade = 124;
    popupTimer = 0;
    endCursor = 0;
    pauseCursor = 0;

    const isNightmare = GAME_SETTINGS.difficulty === 1;

    player.x = toF64(10.0);
    player.y = toF64(1.8);
    player.ang = toF64(Math.PI * 0.5);
    player.bobPhase = toF64(0.0);
    player.battery = toF64(isNightmare ? 85.0 : 100.0);
    player.flashlightOn = true;
    player.stamina = toF64(100.0);

    stalker.x = toF64(10.5);
    stalker.y = toF64(16.5);
    stalker.baseSpeed = toF64(isNightmare ? 0.029 : 0.024);
    stalker.state = AI_PATROL;
    stalker.targetX = toF64(10.0);
    stalker.targetY = toF64(10.0);
    stalker.alertTimer = 0;
    stalker.chaseIntroMs = 0.0;
    stalker.wpIdx = 0;
    stalker.hasNextNode = false;

    entities = [
        { kind: "fuse", x: toF64(10.0), y: toF64(17.5), taken: false },
        { kind: "fuse", x: toF64(10.0), y: toF64(9.5),  taken: false },
        { kind: "fuse", x: toF64(2.5),  y: toF64(17.5), taken: false },
        { kind: "fuse", x: toF64(17.5), y: toF64(17.5), taken: false },

        { kind: "breaker", x: toF64(10.0), y: toF64(11.5), taken: false },

        { kind: "battery", x: toF64(8.5),  y: toF64(5.5),  taken: false },
        { kind: "battery", x: toF64(1.5),  y: toF64(2.5),  taken: false },
        { kind: "battery", x: toF64(18.5), y: toF64(2.5),  taken: false },

        { kind: "note", x: toF64(10.0), y: toF64(3.5),  taken: false, msgIdx: 0 },
        { kind: "note", x: toF64(8.5),  y: toF64(14.5), taken: false, msgIdx: 1 },
        { kind: "note", x: toF64(3.5),  y: toF64(8.5),  taken: false, msgIdx: 2 },
        { kind: "note", x: toF64(16.5), y: toF64(8.5),  taken: false, msgIdx: 3 }
    ];

    showPopup("SECTOR SUBSUELO 04", 90);
    showRadio("OBJETIVO: Activa el Disyuntor rojo, junta 4 Fusibles y escapa al Norte.", 260);
    if (frameTick >= 30) triggerRumble(0, 0);
}

resetGame();

let runtimeErr = null;
Screen.display(() => {
    if (runtimeErr !== null) {
        Draw.rect(0, 0, SCREEN_W, SCREEN_H, rgba(55, 0, 0, 128));
        fnt.scale = Math.fround(0.76);
        fnt.color = rgba(255, 220, 220, 128);
        fnt.print(24, 30, "ERROR EN TIEMPO DE EJECUCION:");
        fnt.scale = Math.fround(0.68);
        let ey = 68;
        for (let off = 0; off < runtimeErr.length && ey < SCREEN_H - 28; off += 42) {
            fnt.print(24, ey, runtimeErr.slice(off, off + 42));
            ey += 28;
        }
        return;
    }

    try {
        const nowMs = Date.now();
        let dtMs = nowMs - lastFrameMs;
        lastFrameMs = nowMs;
        if (dtMs < 4 || dtMs > 120) dtMs = 16.6667;
        const dtScale = clampF64(dtMs / 16.6667, 0.5, 2.0);

        frameTick++;
        pad.update();

        // Auto-inicializa el audio si se salto la pantalla de carga y el volumen esta activado
        if (gameState !== STATE_SPLASH && gameState !== STATE_LOADING && frameTick >= 15 && GAME_SETTINGS.audioVolume > 0 && !audioInitAttempted) {
            initAudio();
        }
        // Cede 3ms al planificador cooperativo del EE para que el hilo de audio audsrv no se quede sin buffer
        if (audioReady && audioPlaying && typeof os !== "undefined" && os && typeof os.sleep === "function") {
            try { os.sleep(3); } catch (_) {}
        }

        // Pantalla de presentacion HK Entertainment (reemplaza el boot logo de AthenaEnv)
        if (gameState === STATE_SPLASH) {
            splashTick++;
            drawHkSplashScreen(SCREEN_W, SCREEN_H, fnt);
            if (splashTick >= SPLASH_DURATION ||
                (splashTick > 10 && (pad.justPressed(Pads.CROSS) || pad.justPressed(Pads.START) || pad.justPressed(Pads.CIRCLE)))) {
                freeHkLogo();
                gameState = STATE_LOADING;
            }
            return;
        }

        // Arranque rapido (solo audio IOP/streams; el 3D se carga en streaming desde el menu)
        if (gameState === STATE_LOADING) {
            drawLoadingScreen(SCREEN_W, SCREEN_H, fnt);
            if (frameTick > 2 && pad.justPressed(Pads.CIRCLE)) {
                bootSkipAudio = true;
                audioInitAttempted = true;
                bootLoadDone = true;
                gameState = STATE_TITLE;
                return;
            }
            if (frameTick <= 1) return;
            if (bootLoadPhase === 0) {
                bootLoadPhase = 1;
                return;
            }
            bootLoadPhase = 0;
            const finished = stepBootLoad();
            if (finished) {
                gameState = STATE_TITLE;
            }
            return;
        }

        // Pantalla de carga dedicada del mapa 3D y El Acechador entre Menu y Partida
        if (gameState === STATE_MAP_LOADING) {
            drawMapLoadingScreen(SCREEN_W, SCREEN_H, fnt);
            if (pad.justPressed(Pads.CIRCLE)) {
                GAME_SETTINGS.qualityIndex = 1;
                switchState(STATE_PLAY);
                return;
            }
            if (hwStreamDone || hwStreamFailed) {
                if (mapLoadPhase < 2) {
                    mapLoadPhase++;
                    return;
                }
                mapLoadPhase = 0;
                hwLastFlashState = -1;
                hwPlayFrameCount = 0;
                buildHwEntityTransforms();
                switchState(STATE_PLAY);
                return;
            }
            if (mapLoadPhase === 0) {
                mapLoadPhase = 1;
                return;
            }
            mapLoadPhase = 0;
            stepOneMapLoad();
            return;
        }

        if (gameState === STATE_PLAY && isPadDisconnected()) {
            triggerRumble(0, 0);
            render3DWorld(SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities, 0.0, frameTick, fusesCollected === 4, currentFov, flashlightWarmup, mapAnim, 0.0);
            drawPadDisconnectedOverlay(SCREEN_W, SCREEN_H, fnt);
            return;
        }

        if (gameState === STATE_TITLE) {
            player.ang = toF64(frameTick * 0.002);
            render3DWorld(SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities, 0.22, frameTick, false, 0.90, 1.0, 1.0, 0.0);
            drawTitleMenu(SCREEN_W, SCREEN_H, titleCursor, frameTick, fnt);

            const nav = readMenuDir();
            if (nav.dy !== 0) { titleCursor = (titleCursor + nav.dy + 5) % 5; playSfx("ui_move", 0, 0.7); }
            if (titleCursor === 0 && nav.dx !== 0) {
                GAME_SETTINGS.difficulty = (GAME_SETTINGS.difficulty + 1) & 1;
            }
            if (pad.justPressed(Pads.CROSS) || pad.justPressed(Pads.START)) {
                playSfx("ui_select", 0, 0.85);
                if (titleCursor === 0) {
                    startPlayWithLoading();
                } else if (titleCursor === 1) {
                    returnState = STATE_TITLE;
                    optionsCursor = 0;
                    saveFeedbackTimer = 0;
                    switchState(STATE_OPTIONS);
                } else if (titleCursor === 2) {
                    returnState = STATE_TITLE;
                    switchState(STATE_CONTROLS);
                } else if (titleCursor === 3) {
                    returnState = STATE_TITLE;
                    loreTabIdx = 0;
                    switchState(STATE_LORE);
                } else if (titleCursor === 4) {
                    returnState = STATE_TITLE;
                    switchState(STATE_CREDITS);
                }
            }
        } else if (gameState === STATE_OPTIONS) {
            render3DWorld(SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities, 0.10, frameTick, fusesCollected === 4, currentFov, flashlightWarmup, 1.0, 0.0);
            if (saveFeedbackTimer > 0) saveFeedbackTimer--;
            drawOptionsMenu(SCREEN_W, SCREEN_H, optionsCursor, saveFeedbackTimer, fnt);

            const nav = readMenuDir();
            if (nav.dy !== 0) { optionsCursor = (optionsCursor + nav.dy + 9) % 9; playSfx("ui_move", 0, 0.7); }

            const adjust = nav.dx !== 0 ? nav.dx : (pad.justPressed(Pads.CROSS) && optionsCursor < 8 ? 1 : 0);
            if (adjust !== 0) {
                if (optionsCursor === 0) {
                    GAME_SETTINGS.qualityIndex = (GAME_SETTINGS.qualityIndex + adjust + 3) % 3;
                    if (GAME_SETTINGS.qualityIndex === 0 && hwStreamFailed) {
                        hwStreamFailed = false;
                        hwStreamDone = false;
                        hwStreamStep = 0;
                        hwStreamCooldown = 2;
                        hwLoadErrorMsg = "";
                    }
                } else if (optionsCursor === 1) {
                    GAME_SETTINGS.aspect16x9 = !GAME_SETTINGS.aspect16x9;
                } else if (optionsCursor === 2) {
                    GAME_SETTINGS.crtSafe = !GAME_SETTINGS.crtSafe;
                } else if (optionsCursor === 3) {
                    GAME_SETTINGS.sensitivityIndex = (GAME_SETTINGS.sensitivityIndex + adjust + 3) % 3;
                } else if (optionsCursor === 4) {
                    GAME_SETTINGS.rumble = !GAME_SETTINGS.rumble;
                    if (!GAME_SETTINGS.rumble) triggerRumble(0, 0);
                } else if (optionsCursor === 5) {
                    GAME_SETTINGS.overlays = !GAME_SETTINGS.overlays;
                } else if (optionsCursor === 6) {
                    GAME_SETTINGS.audioVolume = (GAME_SETTINGS.audioVolume + adjust * 25 + 125) % 125;
                    if (GAME_SETTINGS.audioVolume > 0 && !isAudioReady()) {
                        initAudio();
                    }
                    applyAudioVolume(GAME_SETTINGS.audioVolume);
                } else if (optionsCursor === 7) {
                    GAME_SETTINGS.showFps = !GAME_SETTINGS.showFps;
                    if (GAME_SETTINGS.showFps) ensureFpsCounter();
                }
            }

            if (pad.justPressed(Pads.CROSS) && optionsCursor === 8) {
                saveGameData();
                saveFeedbackTimer = 90;
                switchState(returnState);
            } else if (pad.justPressed(Pads.CIRCLE) || pad.justPressed(Pads.START)) {
                switchState(returnState);
            }
        } else if (gameState === STATE_CONTROLS) {
            render3DWorld(SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities, 0.10, frameTick, fusesCollected === 4, currentFov, flashlightWarmup, 1.0, 0.0);
            drawControlsMenu(SCREEN_W, SCREEN_H, fnt);
            if (pad.justPressed(Pads.CROSS) || pad.justPressed(Pads.CIRCLE) || pad.justPressed(Pads.START)) {
                switchState(returnState);
            }
        } else if (gameState === STATE_LORE) {
            render3DWorld(SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities, 0.10, frameTick, fusesCollected === 4, currentFov, flashlightWarmup, 1.0, 0.0);
            drawLoreMenu(SCREEN_W, SCREEN_H, collectedNotes, loreTabIdx, returnState === STATE_PAUSE, fnt);
            const nav = readMenuDir();
            if (nav.dx !== 0) loreTabIdx = (loreTabIdx + nav.dx + LORE_NOTES.length) % LORE_NOTES.length;
            if (pad.justPressed(Pads.CROSS) || pad.justPressed(Pads.CIRCLE) || pad.justPressed(Pads.START)) {
                switchState(returnState);
            }
        } else if (gameState === STATE_CREDITS) {
            render3DWorld(SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities, 0.10, frameTick, false, 0.90, 1.0, 1.0, 0.0);
            drawCreditsMenu(SCREEN_W, SCREEN_H, MODE_INFO, fnt);
            if (pad.justPressed(Pads.CROSS) || pad.justPressed(Pads.CIRCLE) || pad.justPressed(Pads.START)) {
                switchState(returnState);
            }
        } else if (gameState === STATE_NOTE_VIEW) {
            render3DWorld(SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities, 0.10, frameTick, fusesCollected === 4, currentFov, flashlightWarmup, mapAnim, 0.0);
            drawNoteOverlay(SCREEN_W, SCREEN_H, activeNoteIdx, fnt);
            if (pad.justPressed(Pads.CROSS) || pad.justPressed(Pads.CIRCLE) || pad.justPressed(Pads.START)) {
                switchState(STATE_PLAY);
            }
        } else if (gameState === STATE_PLAY) {
            elapsedMs += dtMs;
            hwPlayFrameCount++;
            if ((hwPlayFrameCount % 30) === 1) {
                let freeKb = -1;
                try {
                    if (typeof Screen.getFreeVRAM === "function") freeKb = (Screen.getFreeVRAM() / 1024) | 0;
                } catch (_) {}
                hwVramLabel = ["F:", String(hwPlayFrameCount), " VRAM:", String(freeKb), "KB"].join("");
            }
            tickProgressive3DStream();

            if (pad.justPressed(Pads.START)) {
                pauseCursor = 0;
                switchState(STATE_PAUSE);
                return;
            }
            if (pad.justPressed(Pads.SELECT) || pad.justPressed(Pads.L2)) {
                mapOpen = !mapOpen;
            }
            if (pad.justPressed(Pads.R2)) {
                debugMode = (debugMode + 1) % 3;
                if (debugMode > 0) ensureFpsCounter();
                renderStats.wallMode = (debugMode === 2) ? 1 : 0;
            }
            if (pad.justPressed(Pads.TRIANGLE)) {
                player.flashlightOn = !player.flashlightOn;
                if (player.flashlightOn) flashlightWarmup = toF64(0.25);
                playSfx("flashlight", 0, 0.85);
            }

            if (mapOpen) mapAnim = toF64(Math.min(1.0, fadd(mapAnim, 0.11 * dtScale)));
            else mapAnim = toF64(Math.max(0.0, mapAnim - 0.13 * dtScale));

            if ((flashlightWarmup - 1.0) < 0) {
                flashlightWarmup = toF64(Math.min(1.0, fadd(flashlightWarmup, 0.14 * dtScale)));
            }

            const rx = toF64((pad.rx || 0) / 128.0);
            const baseTurn = toF64(SENS_TURN_SPEED[GAME_SETTINGS.sensitivityIndex] || 0.052);
            const turnSpeed = (mapOpen ? (baseTurn * 0.70) : baseTurn) * dtScale;
            if ((Math.abs(rx) - STICK_DEADZONE) > 0) player.ang = fadd(player.ang, rx * turnSpeed);
            if (pad.pressed(Pads.L1)) player.ang = player.ang - turnSpeed;
            if (pad.pressed(Pads.R1)) player.ang = fadd(player.ang, turnSpeed);
            if ((player.ang - Math.PI) > 0) player.ang = player.ang - Math.PI * 2.0;
            else if ((player.ang - (-Math.PI)) < 0) player.ang = fadd(player.ang, Math.PI * 2.0);

            let fwd = F64_ZERO, strafe = F64_ZERO;
            const lx = toF64((pad.lx || 0) / 128.0);
            const ly = toF64((pad.ly || 0) / 128.0);
            if ((Math.abs(ly) - STICK_DEADZONE) > 0) fwd = -ly;
            if ((Math.abs(lx) - STICK_DEADZONE) > 0) strafe = lx;
            if (pad.pressed(Pads.UP)) fwd = toF64(1.0);
            if (pad.pressed(Pads.DOWN)) fwd = toF64(-1.0);
            if (pad.pressed(Pads.LEFT)) strafe = toF64(-1.0);
            if (pad.pressed(Pads.RIGHT)) strafe = toF64(1.0);

            const isMoving = ((Math.abs(fwd) - 0.05) > 0) || ((Math.abs(strafe) - 0.05) > 0);
            const wantSprint = (pad.pressed(Pads.CIRCLE) || pad.pressed(Pads.SQUARE)) && isMoving && !mapOpen;
            const isSprinting = wantSprint && !exhausted && ((player.stamina - 2.0) > 0);

            if (isSprinting) {
                player.stamina = toF64(Math.max(0.0, player.stamina - 0.45 * dtScale));
                if ((player.stamina - 2.0) <= 0) exhausted = true;
            } else {
                player.stamina = toF64(Math.min(100.0, fadd(player.stamina, (exhausted ? 0.18 : 0.26) * dtScale)));
                if (exhausted && ((player.stamina - 32.0) >= 0)) exhausted = false;
            }

            // FOV constante para evitar mareo 3D al correr o frenar
            currentFov = toF64(0.90);

            const speed = (isSprinting ? 0.082 : (mapOpen ? 0.032 : 0.048)) * dtScale;
            const dirX = toF64(Math.cos(player.ang));
            const dirY = toF64(Math.sin(player.ang));
            const dx = (dirX * fwd - dirY * strafe) * speed;
            const dy = fadd(dirY * fwd, dirX * strafe) * speed;

            let bumpedGate = false;
            const nextX = fadd(player.x, dx);
            const resolvedX = movePlayerAxis(worldGrid, player.x, player.y, dx, true, 0.25);
            if (Math.abs(resolvedX - nextX) > 0.0001 && getCell(worldGrid, (fadd(nextX, (dx > 0) ? 0.28 : -0.28)) | 0, player.y | 0) === 5) {
                bumpedGate = true;
            }
            player.x = resolvedX;
            const nextY = fadd(player.y, dy);
            const resolvedY = movePlayerAxis(worldGrid, player.x, player.y, dy, false, 0.25);
            if (Math.abs(resolvedY - nextY) > 0.0001 && getCell(worldGrid, player.x | 0, (fadd(nextY, (dy > 0) ? 0.28 : -0.28)) | 0) === 5) {
                bumpedGate = true;
            }
            player.y = resolvedY;
            if (bumpCooldown > 0) bumpCooldown--;
            if (bumpedGate && bumpCooldown === 0) {
                bumpCooldown = 60;
                playSfx("gate_locked", 0, 0.9);
                triggerRumble(110, 1);
                triggerScreenFlash(200, 60, 20, 42);
                showRadio("REJA BLOQUEADA: Activa el Disyuntor rojo en el sector central.", 160);
            }

            if (isMoving) {
                const prevStepCycle = (player.bobPhase / 3.14159) | 0;
                player.bobPhase = fadd(player.bobPhase, (isSprinting ? 0.28 : 0.16) * dtScale);
                const curStepCycle = (player.bobPhase / 3.14159) | 0;
                if (curStepCycle !== prevStepCycle) {
                    playSfx("step", (curStepCycle & 1) ? -18 : 18, isSprinting ? 0.85 : 0.55);
                }
            }

            const batDrain = GAME_SETTINGS.difficulty === 1 ? 0.024 : 0.018;
            if (player.flashlightOn && ((player.battery - 0.0) > 0)) {
                player.battery = toF64(Math.max(0.0, player.battery - batDrain * dtScale));
            }

            for (let i = 0; i < entities.length; i++) {
                const e = entities[i];
                if (e.taken) continue;
                const edx = player.x - toF64(e.x);
                const edy = player.y - toF64(e.y);
                if (((edx * edx - (-(edy * edy))) - 0.81) < 0) {
                    e.taken = true;
                    if (e.kind === "fuse") {
                        fusesCollected++;
                        playSfx("pickup", 0, 0.95);
                        stalker.baseSpeed = fadd(stalker.baseSpeed, 0.003);
                        triggerScreenFlash(255, 200, 50, 56);
                        triggerRumble(160, 1);
                        showPopup(FUSE_POPUP_LABELS[fusesCollected] || "+1 FUSIBLE");
                        showRadio(FUSE_RADIO_LABELS[fusesCollected] || "FUSIBLE RECOLECTADO.", 190);
                    } else if (e.kind === "battery") {
                        player.battery = toF64(Math.min(100.0, fadd(player.battery, 45.0)));
                        playSfx("pickup", 0, 0.85);
                        triggerScreenFlash(50, 220, 255, 48);
                        triggerRumble(90, 1);
                        showPopup("+45% BATERIA");
                        showRadio("BATERIA +45% RECUPERADA.", 140);
                    } else if (e.kind === "breaker") {
                        breakerActive = true;
                        playSfx("breaker", 0, 1.0);
                        for (let gy = 0; gy < worldGrid.length; gy++) {
                            for (let gx = 0; gx < worldGrid[gy].length; gx++) {
                                if (worldGrid[gy][gx] === 5) worldGrid[gy][gx] = 0;
                            }
                        }
                        triggerScreenFlash(60, 255, 110, 62);
                        triggerRumble(210, 1);
                        showPopup("REJAS DESBLOQUEADAS");
                        showRadio("DISYUNTOR ACTIVADO: Se abrieron las rejas Este y Oeste!", 240);
                    } else if (e.kind === "note") {
                        playSfx("pickup", 0, 0.75);
                        if (!collectedNotes[e.msgIdx]) {
                            collectedNotes[e.msgIdx] = true;
                            notesFoundCount++;
                        }
                        activeNoteIdx = e.msgIdx;
                        triggerScreenFlash(220, 230, 255, 38);
                        showRadio(LORE_MESSAGES[e.msgIdx] || "REGISTRO ENCONTRADO", 220);
                        switchState(STATE_NOTE_VIEW);
                        return;
                    }
                }
            }

            if (fusesCollected === 4 && ((player.y - 1.45) < 0) && ((player.x - 8.5) > 0) && ((player.x - 11.5) < 0)) {
                recordEscape((elapsedMs / 1000) | 0, GAME_SETTINGS.difficulty);
                endCursor = 0;
                switchState(STATE_WIN);
                return;
            }

            const ai = updateStalkerAI(stalker, worldGrid, player, isSprinting, isMoving, frameTick, dtScale, GAME_SETTINGS.difficulty, dtMs);
            const dangerRatio = toF64(Math.max(0.0, Math.min(1.0, (7.0 - toF64(ai.distP)) / 7.0)));

            if (ai.chaseIntroStarted) {
                setMusicTrack("chase", true);
                showPopup("TE HA DETECTADO...", 120);
                showRadio("ALGO SE ACERCA... PREPARATE PARA CORRER!", 260);
                triggerScreenFlash(160, 20, 25, 36);
            } else if (ai.chaseHuntStarted) {
                setMusicTrack("chase", false);
                showPopup("! TE PERSIGUE !", 95);
                showRadio("EL ACECHADOR TE PERSIGUE! CORRE!", 190);
                triggerScreenFlash(220, 18, 22, 56);
            } else if (stalker.state === AI_CHASE_INTRO || stalker.state === AI_HUNT) {
                setMusicTrack("chase", false);
            } else {
                setMusicTrack("ambient", false);
            }

            const hbPeriod = Math.max(14, (42.0 - dangerRatio * 26.0) | 0);
            if (((dangerRatio - 0.28) > 0) && ((frameTick % hbPeriod) === 0)) {
                playSfx("heartbeat", (ai.sideBias * 90.0) | 0, 0.55 + dangerRatio * 0.45);
            }

            if (((dangerRatio - 0.28) > 0) && (frameTick % Math.max(12, (38.0 - dangerRatio * 24.0) | 0) < 4)) {
                triggerRumble((dangerRatio * 185.0) | 0, 1);
            } else if (bumpCooldown < 52) {
                triggerRumble(0, 0);
            }

            if ((toF64(ai.distP) - 0.65) < 0) {
                jumpscareTimer = 42;
                endCursor = 0;
                gameState = STATE_JUMPSCARE;
                setMusicTrack("ambient");
                playSfx("jumpscare", 0, 1.0);
                triggerRumble(255, 1);
                return;
            }

            render3DWorld(
                SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities,
                dangerRatio, frameTick, fusesCollected === 4, currentFov,
                flashlightWarmup, mapAnim, ai.sideBias
            );

            if (GAME_SETTINGS.overlays) {
                if (!player.flashlightOn || ((player.battery - 0.0) <= 0)) {
                    Draw.rect(0, 0, SCREEN_W, SCREEN_H, rgba(0, 0, 8, 72));
                }
                if (exhausted) {
                    const exAlpha = (fadd(22.0, Math.abs(Math.sin(frameTick * 0.14)) * 28.0)) | 0;
                    Draw.rect(0, 0, SCREEN_W, SCREEN_H, rgba(10, 10, 24, exAlpha));
                }
                if (ai.inChaseIntro && ((frameTick & 31) < 16)) {
                    Draw.rect(0, 0, SCREEN_W, 4, rgba(210, 35, 35, 72));
                    Draw.rect(0, SCREEN_H - 4, SCREEN_W, 4, rgba(210, 35, 35, 72));
                }
                if ((dangerRatio - 0.15) > 0) {
                    const barY = (frameTick * 13) % (SCREEN_H - 18);
                    Draw.rect(0, barY, SCREEN_W, 10, rgba(210, 20, 20, (dangerRatio * 78.0) | 0));
                    if (ai.los && ((frameTick & 15) < 7)) {
                        Draw.rect(0, 0, SCREEN_W, 4, rgba(255, 30, 30, 95));
                        Draw.rect(0, SCREEN_H - 4, SCREEN_W, 4, rgba(255, 30, 30, 95));
                    }
                }
                if (flashTint.alpha > 0) {
                    Draw.rect(0, 0, SCREEN_W, SCREEN_H, rgba(flashTint.r, flashTint.g, flashTint.b, flashTint.alpha | 0));
                    flashTint.alpha = Math.max(0, flashTint.alpha - 4);
                }
            }

            renderAnimatedMapPDA(SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities, dangerRatio, mapAnim, frameTick, fnt);

            const { sx, sy } = getSafeMargins();
            const hudW = SCREEN_W - sx * 2;
            const topY = sy;
            Draw.rect(sx, topY, hudW, 38, rgba(4, 6, 10, 124));
            Draw.rect(sx, topY + 37, hudW, 2, rgba(70, 95, 115, 120));

            fnt.scale = Math.fround(0.68);
            fnt.color = rgba(245, 245, 250, 128);
            fnt.print(sx + 10, topY + 8, FUSE_HUD_LABELS[fusesCollected] || "FUS:0/4");
            if (GAME_SETTINGS.qualityIndex === 0 && !hwStreamDone && !hwStreamFailed) {
                const pendStep = HW3D_STREAM_STEPS[hwStreamStep];
                Draw.rect(SCREEN_W - sx - 280, topY + 40, 276, 26, rgba(12, 16, 26, 118));
                fnt.scale = Math.fround(0.62);
                fnt.color = rgba(110, 230, 255, 128);
                fnt.print(SCREEN_W - sx - 272, topY + 44, (STREAM_3D_BADGES[hwStreamStep] || "3D...") + (pendStep ? " " + pendStep.label : ""));
            }
            if (hw3dReady && GAME_SETTINGS.qualityIndex === 0) {
                Draw.rect(SCREEN_W - sx - 210, topY + 40, 206, 24, rgba(8, 14, 22, 118));
                fnt.scale = Math.fround(0.60);
                fnt.color = rgba(120, 245, 160, 128);
                fnt.print(SCREEN_W - sx - 202, topY + 43, hwVramLabel);
            }
            if (GAME_SETTINGS.qualityIndex === 0 && hwStreamFailed) {
                Draw.rect(SCREEN_W - sx - 340, topY + 40, 336, 26, rgba(40, 8, 8, 122));
                fnt.scale = Math.fround(0.60);
                fnt.color = rgba(255, 150, 130, 128);
                fnt.print(SCREEN_W - sx - 332, topY + 44, "3D FALLO: " + String(hwLoadErrorMsg || "?").slice(0, 28));
            }

            fnt.color = rgba(250, 215, 95, 128);
            fnt.print(sx + 114, topY + 8, getCompassLabel(player.ang));

            fnt.color = rgba(235, 235, 240, 128);
            fnt.print(sx + 174, topY + 8, "LUZ");
            Draw.rect(sx + 224, topY + 12, 56, 14, rgba(20, 30, 38, 128));
            const batFill = Math.max(0, (player.battery * 0.52) | 0);
            const batCol = ((player.battery - 25.0) < 0) ? rgba(255, 80, 45, 128) : rgba(55, 225, 255, 128);
            if (batFill > 0) Draw.rect(sx + 226, topY + 14, batFill, 10, batCol);

            fnt.color = exhausted ? rgba(255, 95, 95, 128) : rgba(235, 235, 240, 128);
            fnt.print(sx + 290, topY + 8, "STM");
            Draw.rect(sx + 342, topY + 12, 56, 14, rgba(25, 25, 32, 128));
            const stamFill = Math.max(0, (player.stamina * 0.52) | 0);
            const stamCol = exhausted ? rgba(255, 65, 65, 128) : rgba(95, 240, 135, 128);
            if (stamFill > 0) Draw.rect(sx + 344, topY + 14, stamFill, 10, stamCol);

            const bpm = (fadd(72.0, dangerRatio * 118.0)) | 0;
            const ecgCol = ((dangerRatio - 0.45) > 0) ? rgba(255, 65, 65, 128) : rgba(90, 245, 130, 128);
            fnt.color = ecgCol;
            fnt.print(sx + 408, topY + 8, ["BPM:", String(bpm)].join(""));

            const ecgBaseX = sx + hudW - 106;
            const ecgW = 96;
            Draw.rect(ecgBaseX, topY + 5, ecgW, 20, rgba(6, 14, 10, 120));
            const beatPeriod = Math.max(12, (36.0 - dangerRatio * 18.0) | 0);
            let prevEx = ecgBaseX;
            let prevEy = topY + 15;
            for (let ex = 12; ex <= ecgW; ex += 12) {
                const ph = (ex + (frameTick << 1)) % beatPeriod;
                let ey = topY + 15;
                if (ph < 4) ey = topY + 6;
                else if (ph < 8) ey = topY + 23;
                else if (ph < 12) ey = topY + 12;
                Draw.line(prevEx, prevEy, ecgBaseX + ex, ey, ecgCol);
                prevEx = ecgBaseX + ex;
                prevEy = ey;
            }

            if (debugMode > 0) {
                let fps = 0;
                try { fps = Screen.getFPS(60) | 0; } catch (_) {}
                if (debugMode > 0) {
                    Draw.rect(sx, topY + 40, hudW, 24, rgba(0, 0, 0, 118));
                    fnt.scale = Math.fround(0.58);
                    fnt.color = rgba(120, 255, 120, 128);
                    fnt.print(sx + 6, topY + 43, "X:" + player.x.toFixed(1) + " Y:" + player.y.toFixed(1) +
                        " 3D:" + (hw3dReady ? (hwRenderUsesLegacyFrame ? "VU1L" : "VU1") : "2.5D") +
                        " EN:" + hwStalkerSource + " FPS:" + fps);
                } else {
                    Draw.rect(sx + hudW - 76, topY + 33, 76, 18, rgba(0, 0, 0, 100));
                    fnt.scale = Math.fround(0.66);
                    fnt.color = fps >= 50 ? rgba(110, 255, 130, 128) : rgba(255, 210, 80, 128);
                    fnt.print(sx + hudW - 70, topY + 35, ["FPS: ", String(fps)].join(""));
                }
            }

            if (GAME_SETTINGS.showFps) {
                drawConsoleStatsOverlay(SCREEN_W, SCREEN_H, frameTick, fnt);
            }

            if (popupTimer > 0) {
                popupTimer--;
                fnt.scale = Math.fround(0.85);
                fnt.color = rgba(255, 245, 140, 128);
                fnt.print((SCREEN_W >> 1) - 140, topY + 54, popupText);
            }

            const botY = SCREEN_H - sy - 38;
            Draw.rect(sx, botY, hudW, 38, rgba(4, 6, 10, 124));
            Draw.rect(sx, botY, hudW, 2, rgba(70, 95, 115, 120));
            fnt.scale = Math.fround(0.66);
            if (radioTimer > 0) {
                radioTimer--;
                fnt.color = rgba(255, 230, 120, 128);
                fnt.print(sx + 10, botY + 8, radioText);
            } else if (fusesCollected === 4) {
                fnt.color = rgba(100, 255, 130, 128);
                fnt.print(sx + 10, botY + 8, "SALIDA NORTE ABIERTA! [SELECT: MAPA]");
            } else if (!breakerActive) {
                fnt.color = rgba(235, 220, 165, 128);
                fnt.print(sx + 10, botY + 8, "ACTIVA EL DISYUNTOR ROJO [SELECT: MAPA]");
            } else {
                fnt.color = rgba(235, 220, 165, 128);
                fnt.print(sx + 10, botY + 8, BREAKER_HUD_LABELS[fusesCollected] || BREAKER_HUD_LABELS[0]);
            }

            if (introFade > 0) {
                Draw.rect(0, 0, SCREEN_W, SCREEN_H, rgba(0, 0, 0, introFade | 0));
                introFade = Math.max(0, introFade - 4);
            }
        } else if (gameState === STATE_PAUSE) {
            render3DWorld(SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities, 0.0, frameTick, fusesCollected === 4, currentFov, flashlightWarmup, mapAnim, 0.0);
            drawPauseMenu(SCREEN_W, SCREEN_H, pauseCursor, notesFoundCount, fnt);

            const nav = readMenuDir();
            if (nav.dy !== 0) pauseCursor = (pauseCursor + nav.dy + 6) % 6;

            if (pad.justPressed(Pads.START) || pad.justPressed(Pads.CIRCLE)) {
                switchState(STATE_PLAY);
            } else if (pad.justPressed(Pads.CROSS)) {
                if (pauseCursor === 0) {
                    switchState(STATE_PLAY);
                } else if (pauseCursor === 1) {
                    returnState = STATE_PAUSE;
                    optionsCursor = 0;
                    saveFeedbackTimer = 0;
                    switchState(STATE_OPTIONS);
                } else if (pauseCursor === 2) {
                    returnState = STATE_PAUSE;
                    loreTabIdx = 0;
                    switchState(STATE_LORE);
                } else if (pauseCursor === 3) {
                    returnState = STATE_PAUSE;
                    switchState(STATE_CONTROLS);
                } else if (pauseCursor === 4) {
                    resetGame();
                    switchState(STATE_PLAY);
                } else if (pauseCursor === 5) {
                    titleCursor = 0;
                    switchState(STATE_TITLE);
                }
            }
        } else if (gameState === STATE_JUMPSCARE) {
            jumpscareTimer--;
            const flash = (jumpscareTimer & 3) < 2;
            Draw.rect(0, 0, SCREEN_W, SCREEN_H, flash ? rgba(165, 8, 12, 128) : rgba(10, 0, 2, 128));
            const jx = ((Math.random() - 0.5) * 24) | 0;
            const jy = ((Math.random() - 0.5) * 24) | 0;
            const cx = (SCREEN_W >> 1) + jx;
            const cy = (SCREEN_H >> 1) + jy;
            Draw.rect(cx - 160, Math.max(0, cy - 180), 320, 360, rgba(18, 4, 6, 128));
            Draw.rect(cx - 120, Math.max(0, cy - 165), 240, 110, rgba(205, 170, 162, 128));
            Draw.rect(cx - 105, Math.max(0, cy - 55), 210, 115, rgba(125, 78, 76, 128));
            Draw.rect(cx - 88, cy - 108, 64, 46, rgba(12, 0, 2, 128));
            Draw.rect(cx + 24, cy - 108, 64, 46, rgba(12, 0, 2, 128));
            Draw.rect(cx - 68, cy - 97, 24, 24, rgba(255, 25, 20, 128));
            Draw.rect(cx + 44, cy - 97, 24, 24, rgba(255, 25, 20, 128));
            Draw.rect(cx - 62, cy - 91, 12, 12, rgba(255, 235, 210, 128));
            Draw.rect(cx + 50, cy - 91, 12, 12, rgba(255, 235, 210, 128));
            Draw.rect(cx - 75, cy - 32, 150, 64, rgba(10, 0, 2, 128));
            const toothCol = rgba(225, 205, 195, 128);
            for (let t = 0; t < 6; t++) {
                const tx = cx - 68 + t * 24;
                Draw.rect(tx, cy - 32, 14, 20, toothCol);
                Draw.rect(tx, cy + 12, 14, 20, toothCol);
            }
            if (jumpscareTimer <= 0) {
                endCursor = 0;
                switchState(STATE_DEAD);
            }
        } else if (gameState === STATE_WIN || gameState === STATE_DEAD) {
            const isWin = gameState === STATE_WIN;
            render3DWorld(SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities, isWin ? 0.0 : 1.0, frameTick, isWin, isWin ? 1.05 : 1.15, isWin ? 1.0 : 0.25, 1.0, 0.0);
            drawEndScreen(SCREEN_W, SCREEN_H, isWin, endCursor, (elapsedMs / 1000) | 0, notesFoundCount, GAME_SETTINGS.difficulty, fnt);

            const nav = readMenuDir();
            if (nav.dy !== 0) endCursor = (endCursor + 1) & 1;

            if (pad.justPressed(Pads.CROSS) || pad.justPressed(Pads.START)) {
                if (endCursor === 0) {
                    startPlayWithLoading();
                } else {
                    titleCursor = 0;
                    switchState(STATE_TITLE);
                }
            }
        }
    } catch (e) {
        runtimeErr = String(e) + " | " + String(e && e.stack ? e.stack : "").replace(/\n/g, " ");
    }
});
