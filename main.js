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
    // Motor grafico: 0 = modelos 3D reales por VU1, 1 = 2.5D media, 2 = 2.5D rapida
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
    difficulty: 0,
    // Omitir automaticamente la cinematica introductoria al iniciar Nueva Partida
    skipIntro: false
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
            // AthenaEnv conserva el nombre getFreeVRAM, pero sin argumento
            // devuelve VRAM usada (VRAM_USED_TOTAL).
            const total = 4 * 1024 * 1024;
            consoleStats.vramTotal = total;
            consoleStats.vramUsed = Math.max(0, Math.min(total, Screen.getFreeVRAM() | 0));
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
    maxChapterUnlocked: 1,
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
            if (typeof data.skipIntro === "boolean") GAME_SETTINGS.skipIntro = data.skipIntro;
            if (typeof data.bestNormalSec === "number" && data.bestNormalSec > 0) {
                RECORDS.bestNormalSec = data.bestNormalSec | 0;
            }
            if (typeof data.bestNightmareSec === "number" && data.bestNightmareSec > 0) {
                RECORDS.bestNightmareSec = data.bestNightmareSec | 0;
            }
            if (typeof data.escapes === "number" && data.escapes > 0) {
                RECORDS.escapes = data.escapes | 0;
            }
            if (typeof data.maxChapterUnlocked === "number" && data.maxChapterUnlocked >= 1 && data.maxChapterUnlocked <= 3) {
                RECORDS.maxChapterUnlocked = data.maxChapterUnlocked | 0;
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
            skipIntro: GAME_SETTINGS.skipIntro,
            bestNormalSec: RECORDS.bestNormalSec,
            bestNightmareSec: RECORDS.bestNightmareSec,
            escapes: RECORDS.escapes,
            maxChapterUnlocked: RECORDS.maxChapterUnlocked
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
// ============================================================================
// Campaña lineal de 3 Capítulos (mapas 20x20), colisiones AABB sin allocs,
// notas de lore, triggers de radio narrativa y configuración de entidades.
// 0 = Pasillo libre        1 = Pared hormigon    2 = Pilar/estructura oxidada
// 3 = Zona ritual / sangre 4 = Compuerta salida  5 = Reja de seguridad
// ============================================================================

const MAP_W = 20;
const MAP_H = 20;

// CAPÍTULO 1: SUBSUELO 04 — EL APAGÓN (mapa original preservado)
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

// CAPÍTULO 2: TÚNELES DE MANTENIMIENTO Y CALDERAS (pasillos estrechos + sala de válvulas)
const CH2_MAP = [
    [1,1,1,1,1,1,1,1,1,4,4,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,2,0,0,0,0,0,0,0,0,0,0,2,0,0,0,1],
    [1,0,2,0,2,0,1,1,1,0,0,1,1,1,0,2,0,2,0,1],
    [1,0,2,0,0,0,1,0,0,0,0,0,0,1,0,0,0,2,0,1],
    [1,0,0,0,1,1,1,0,2,0,0,2,0,1,1,1,0,0,0,1],
    [1,2,2,0,5,0,0,0,0,0,0,0,0,0,0,5,0,2,2,1],
    [1,0,0,0,5,0,2,1,0,2,2,0,1,2,0,5,0,0,0,1],
    [1,0,1,0,1,0,0,0,0,0,0,0,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,1,2,0,1,0,0,1,0,2,1,1,0,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,2,1,1,0,2,2,0,0,0,0,0,0,2,2,0,1,1,2,1],
    [1,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,1],
    [1,0,2,1,1,0,1,0,1,0,0,1,0,1,0,1,1,2,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,1],
    [1,1,2,0,1,1,1,2,0,2,2,0,2,1,1,1,0,2,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,2,2,0,1,0,2,0,0,0,0,2,0,1,0,2,2,0,1],
    [1,0,0,0,0,1,0,0,0,3,3,0,0,0,1,0,0,0,0,1],
    [1,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

// CAPÍTULO 3: PABELLÓN DE CONTENCIÓN Y ASCENSOR DE SUPERFICIE (zona ritual + clímax)
const CH3_MAP = [
    [1,1,1,1,1,1,1,1,1,4,4,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,3,3,0,1,1,0,0,0,0,0,0,1,1,0,3,3,0,1],
    [1,0,3,0,0,0,0,0,3,0,0,3,0,0,0,0,0,3,0,1],
    [1,0,0,0,1,0,3,0,3,0,0,3,0,3,0,1,0,0,0,1],
    [1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1],
    [1,0,0,0,5,0,2,0,1,0,0,1,0,2,0,5,0,0,0,1],
    [1,0,3,0,5,0,2,0,0,0,0,0,0,2,0,5,0,3,0,1],
    [1,0,3,0,1,0,0,0,3,0,0,3,0,0,0,1,0,3,0,1],
    [1,0,0,0,0,0,3,0,0,0,0,0,0,3,0,0,0,0,0,1],
    [3,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,3],
    [3,0,0,0,0,3,0,2,0,0,0,0,2,0,3,0,0,0,0,3],
    [1,0,3,1,0,3,0,0,0,3,3,0,0,0,3,0,1,3,0,1],
    [1,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,1],
    [1,1,0,3,3,0,1,1,0,0,0,0,1,1,0,3,3,0,1,1],
    [1,0,0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0,0,1],
    [1,0,3,0,1,0,3,0,0,0,0,0,0,3,0,1,0,3,0,1],
    [1,0,0,0,1,0,3,3,0,0,0,0,3,3,0,1,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3]
];

const CHAPTERS = [
    {
        id: 0,
        code: "CAP. 1",
        title: "SUBSUELO 04: EL APAGON",
        objectiveBreaker: "ACTIVA EL DISYUNTOR ROJO [SELECT: MAPA]",
        objectiveExit: "SALIDA NORTE ABIERTA! [X EN COMPUERTA]",
        grid: BASE_MAP,
        meshPrefix: "map_",
        playerSpawn: { x: 10.0, y: 1.8, ang: 1.5708 },
        stalkerSpawn: { x: 10.5, y: 16.5, speedNormal: 0.024, speedNightmare: 0.029 },
        waypoints: [
            { x: 10.0, y: 10.0 }, { x: 10.0, y: 16.5 },
            { x: 3.0,  y: 10.0 }, { x: 16.5, y: 10.0 },
            { x: 3.5,  y: 3.0  }, { x: 16.5, y: 3.0  }
        ],
        entities: [
            { kind: "fuse",    x: 10.0, y: 17.5, taken: false },
            { kind: "fuse",    x: 10.0, y: 9.5,  taken: false },
            { kind: "fuse",    x: 2.5,  y: 17.5, taken: false },
            { kind: "fuse",    x: 17.5, y: 17.5, taken: false },
            { kind: "breaker", x: 10.0, y: 11.5, taken: false },
            { kind: "battery", x: 8.5,  y: 5.5,  taken: false },
            { kind: "battery", x: 1.5,  y: 2.5,  taken: false },
            { kind: "battery", x: 18.5, y: 2.5,  taken: false },
            { kind: "decoy",   x: 11.5, y: 6.5,  taken: false },
            { kind: "decoy",   x: 3.5,  y: 12.5, taken: false },
            { kind: "locker",  x: 6.5,  y: 5.5,  faceAng: 0.0,    taken: false },
            { kind: "locker",  x: 12.5, y: 13.5, faceAng: 3.1416, taken: false },
            { kind: "note",    x: 10.0, y: 3.5,  msgIdx: 0, taken: false },
            { kind: "note",    x: 10.0, y: 14.5, msgIdx: 1, taken: false },
            { kind: "note",    x: 3.5,  y: 10.5, msgIdx: 2, taken: false },
            { kind: "note",    x: 16.5, y: 10.5, msgIdx: 3, taken: false }
        ],
        radioTriggers: [
            { x: 10.0, y: 3.5,  radius: 2.2, text: "VALDEZ (RADIO): Me escuchas? Las rejas se trabaron. Busca el disyuntor rojo en el centro.", duration: 240, fired: false },
            { x: 10.0, y: 10.5, radius: 2.5, text: "VALDEZ (RADIO): Hay algo en el pasillo transversal... agachate con [CUAD] si lo ois cerca.", duration: 240, fired: false },
            { x: 10.0, y: 16.5, radius: 2.4, text: "VALDEZ (RADIO): Estas en la zona ritual. Toma ese fusible y sali de ahi cuanto antes.", duration: 220, fired: false }
        ]
    },
    {
        id: 1,
        code: "CAP. 2",
        title: "TUNELES DE MANTENIMIENTO",
        objectiveBreaker: "ACTIVA VALVULA CENTRAL [SELECT: MAPA]",
        objectiveExit: "ESCLUSA NORTE ABIERTA! [X EN COMPUERTA]",
        grid: CH2_MAP,
        meshPrefix: "ch2_",
        playerSpawn: { x: 10.0, y: 18.45, ang: -1.5708 },
        stalkerSpawn: { x: 10.0, y: 3.5, speedNormal: 0.026, speedNightmare: 0.031 },
        waypoints: [
            { x: 10.0, y: 9.5  }, { x: 10.0, y: 15.5 },
            { x: 2.5,  y: 9.5  }, { x: 17.5, y: 9.5  },
            { x: 2.5,  y: 15.5 }, { x: 16.5, y: 3.5  }
        ],
        entities: [
            { kind: "fuse",    x: 2.5,  y: 1.5,  taken: false },
            { kind: "fuse",    x: 17.5, y: 1.5,  taken: false },
            { kind: "fuse",    x: 2.5,  y: 13.5, taken: false },
            { kind: "fuse",    x: 17.5, y: 13.5, taken: false },
            { kind: "breaker", x: 10.0, y: 9.5,  taken: false },
            { kind: "battery", x: 10.0, y: 13.5, taken: false },
            { kind: "battery", x: 5.5,  y: 5.5,  taken: false },
            { kind: "battery", x: 14.5, y: 5.5,  taken: false },
            { kind: "decoy",   x: 7.5,  y: 15.5, taken: false },
            { kind: "decoy",   x: 12.5, y: 3.5,  taken: false },
            { kind: "locker",  x: 7.5,  y: 9.5,  faceAng: 0.0,    taken: false },
            { kind: "locker",  x: 12.5, y: 9.5,  faceAng: 3.1416, taken: false },
            { kind: "locker",  x: 5.5,  y: 15.5, faceAng: 0.0,    taken: false },
            { kind: "npc",     x: 10.0, y: 15.5, name: "VALDEZ", spoken: false,
              dialog: "VALDEZ: Estoy herido... activa la valvula central y junta los 4 fusibles para pasar a Contencion.", taken: false },
            { kind: "note",    x: 10.0, y: 7.5,  msgIdx: 4, taken: false },
            { kind: "note",    x: 10.0, y: 3.5,  msgIdx: 5, taken: false }
        ],
        radioTriggers: [
            { x: 10.0, y: 17.5, radius: 2.0, text: "VALDEZ (RADIO): Estoy en el cruce de calderas, frente a vos. Ven con cuidado, usa [L2] para distraerlo.", duration: 250, fired: false },
            { x: 10.0, y: 9.5,  radius: 2.5, text: "DRA. MORALES (RADIO): Aqui Sala de Control. El sujeto cruzo a los tuneles. No enciendas la luz si te rodea.", duration: 240, fired: false },
            { x: 10.0, y: 2.5,  radius: 2.2, text: "DRA. MORALES (RADIO): La esclusa Norte lleva al Pabellon de Contencion. Apurate!", duration: 210, fired: false }
        ]
    },
    {
        id: 2,
        code: "CAP. 3",
        title: "PABELLON DE CONTENCION",
        objectiveBreaker: "DESBLOQUEA NUCLEO CENTRAL [SELECT: MAPA]",
        objectiveExit: "ASCENSOR NORTE LISTO! [X PARA ESCAPAR]",
        grid: CH3_MAP,
        meshPrefix: "ch3_",
        playerSpawn: { x: 10.0, y: 18.45, ang: -1.5708 },
        stalkerSpawn: { x: 10.0, y: 5.5, speedNormal: 0.028, speedNightmare: 0.033 },
        waypoints: [
            { x: 10.0, y: 10.0 }, { x: 10.0, y: 5.5  },
            { x: 4.5,  y: 10.0 }, { x: 15.5, y: 10.0 },
            { x: 2.5,  y: 1.5  }, { x: 17.5, y: 1.5  }
        ],
        entities: [
            { kind: "fuse",    x: 1.5,  y: 1.5,  taken: false },
            { kind: "fuse",    x: 18.5, y: 1.5,  taken: false },
            { kind: "fuse",    x: 1.5,  y: 16.5, taken: false },
            { kind: "fuse",    x: 18.5, y: 16.5, taken: false },
            { kind: "breaker", x: 10.0, y: 10.0, taken: false },
            { kind: "battery", x: 10.0, y: 13.5, taken: false },
            { kind: "battery", x: 5.5,  y: 5.5,  taken: false },
            { kind: "battery", x: 14.5, y: 5.5,  taken: false },
            { kind: "decoy",   x: 10.0, y: 16.5, taken: false },
            { kind: "decoy",   x: 10.0, y: 3.5,  taken: false },
            { kind: "locker",  x: 6.5,  y: 10.0, faceAng: 0.0,    taken: false },
            { kind: "locker",  x: 13.5, y: 10.0, faceAng: 3.1416, taken: false },
            { kind: "locker",  x: 10.0, y: 1.5,  faceAng: 1.5708, taken: false },
            { kind: "note",    x: 10.0, y: 13.5, msgIdx: 6, taken: false },
            { kind: "note",    x: 10.0, y: 5.5,  msgIdx: 7, taken: false }
        ],
        radioTriggers: [
            { x: 10.0, y: 17.5, radius: 2.2, text: "DRA. MORALES (RADIO): Ultimo tramo. Libera el nucleo central y energiza el ascensor Norte con 4 fusibles.", duration: 250, fired: false },
            { x: 10.0, y: 10.0, radius: 2.6, text: "DRA. MORALES (RADIO): Cuidado! Aqui nacio el Sujeto 04. Es mas rapido en este sector.", duration: 240, fired: false },
            { x: 10.0, y: 2.5,  radius: 2.2, text: "DRA. MORALES (RADIO): El ascensor a la superficie esta frente a vos. No te detengas!", duration: 220, fired: false }
        ]
    }
];

let activeChapterIdx = 0;

function getActiveChapter() {
    return CHAPTERS[activeChapterIdx] || CHAPTERS[0];
}

function createWorldGrid(chapterIdx) {
    const idx = (chapterIdx !== undefined) ? chapterIdx : activeChapterIdx;
    const src = (CHAPTERS[idx] || CHAPTERS[0]).grid;
    const grid = [];
    for (let y = 0; y < MAP_H; y++) {
        grid.push(src[y].slice());
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
        summary: "Agachate [CUAD] o apaga la linterna para perder su rastro.",
        lines: [
            "INFORME DE GUARDIA - PASILLO SUR",
            "Reacciona al ruido de pisadas rapidas",
            "y al haz directo de las linternas.",
            "Agachate [CUAD] o usa un escondite [X]",
            "con la luz apagada: perdera tu rastro."
        ]
    },
    {
        code: "REGISTRO #03 - PROTOCOLO",
        summary: "Ilumina sus ojos o lanza un senuelo [L2] para desviarlo.",
        lines: [
            "OBSERVACION - COMPORTAMIENTO VISUAL",
            "Apuntar directo a sus ojos lo frena,",
            "y lanzar un SENUELO [L2] lo desvia",
            "hacia el ruido del pasillo contrario.",
            "Usalo si te bloquea un cuello de botella."
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
    },
    {
        code: "REGISTRO #05 - CALDERAS",
        summary: "Valdez quedo atrapado tras sellar la esclusa de mantenimiento.",
        lines: [
            "BITACORA MANTENIMIENTO - NIVEL -2",
            "Intentamos encerrar al sujeto en los",
            "tuneles de vapor, pero rompio el panel.",
            "Si encuentras a Valdez, activa la valvula",
            "central y avanza hacia Contencion."
        ]
    },
    {
        code: "REGISTRO #06 - DRA. MORALES",
        summary: "Los escondites bloquean su vision si mantienes la luz apagada.",
        lines: [
            "NOTA DE LABORATORIO - CONTROL",
            "El Sujeto 04 caza por contraste de luz",
            "y vibracion de pisadas. Los nichos de",
            "mantenimiento son seguros siempre que",
            "apagues la linterna antes de que pase."
        ]
    },
    {
        code: "REGISTRO #07 - PROYECTO 04",
        summary: "El experimento de adaptacion en oscuridad colapso el 14/10.",
        lines: [
            "ARCHIVO CONFIDENCIAL - CONTENCION",
            "El Sujeto 04 fue expuesto a aislamiento",
            "total en el subsuelo durante 90 dias.",
            "Cuando cayo la red electrica, escapo",
            "de la camara ritual hacia los pasillos."
        ]
    },
    {
        code: "REGISTRO #08 - EVACUACION FINAL",
        summary: "El ascensor de carga al Norte lleva directo a la superficie.",
        lines: [
            "PROTOCOLO FINAL - SALIDA SUPERFICIE",
            "Coloca los ultimos 4 fusibles en el",
            "pabellon y activa el ascensor Norte.",
            "Una vez arriba, el Subsuelo 04 quedara",
            "sellado permanentemente."
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

function alertStalkerToNoise(stalker, nx, ny, difficulty = 0) {
    stalker.targetX = toF64(nx);
    stalker.targetY = toF64(ny);
    stalker.hasNextNode = false;
    if (stalker.state === AI_PATROL || stalker.state === AI_INVESTIGATE) {
        stalker.state = AI_INVESTIGATE;
    }
    const minAlert = (difficulty === 1) ? 240 : 210;
    if (stalker.alertTimer < minAlert) stalker.alertTimer = minAlert;
}

function updateStalkerAI(stalker, grid, player, isSprinting, isMoving, frameTick, dtScale = 1.0, difficulty = 0, dtMs = 16.6667, isCrouched = false, isHiding = false) {
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
    let baseDetect = flashVisible ? (isSprinting ? 14.0 : 10.5) : (isSprinting ? 9.5 : 4.2);
    if (isCrouched && !isSprinting) {
        baseDetect = flashVisible ? 7.4 : 2.1;
    }
    const detectRange = baseDetect - (-rangeBonus);

    aiResult.chaseIntroStarted = false;
    aiResult.chaseHuntStarted = false;
    const stepMs = toF64(dtMs);
    // Si el jugador está escondido con la linterna apagada, El Acechador no puede verlo
    // salvo que ya estuviera persiguiéndolo a quemarropa (< 3.0 celdas).
    const hiddenSafe = isHiding && !flashVisible && (stalker.state !== AI_HUNT || (distP - 3.0) >= 0);
    const spotted = !hiddenSafe && los && ((distP - detectRange) < 0);
    const heardSprint = !isHiding && isSprinting && ((distP - (11.0 - (-rangeBonus))) < 0);
    const closeRadius = isCrouched ? (isNightmare ? 3.2 : 2.4) : (isNightmare ? 7.5 : 6.2);
    const closeSense = !hiddenSafe && ((distP - closeRadius) < 0);

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
        const wps = (typeof getActiveChapter === "function" && getActiveChapter().waypoints) ? getActiveChapter().waypoints : WAYPOINTS;
        if (stalker.wpIdx >= wps.length) stalker.wpIdx = 0;
        const wp = wps[stalker.wpIdx];
        const wx = toF64(wp.x);
        const wy = toF64(wp.y);
        stalker.targetX = wx;
        stalker.targetY = wy;
        const dwx = wx - sx;
        const dwy = wy - sy;
        if (((dwx * dwx - (-(dwy * dwy))) - 0.81) < 0) {
            stalker.wpIdx = (stalker.wpIdx + 1) % wps.length;
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
        restore2DRenderState(screenW, screenH);
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
    if (hw3dReady && GAME_SETTINGS.qualityIndex === 0) {
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

// --- MODULE: src/menus.js ---
// ============================================================================
// Interfaz estética AAA PS2 (Título abierto sobre 3D, Opciones con barras y
// badges, Controles, Expediente 8 notas, Pausa, Cinemáticas y Pantallas Finales)
// - CERO allocaciones innecesarias por cuadro, alfa GS 0..128, escala >= 0.70
// - Área segura CRT (NTSC 640x448 y PAL 640x512)
// ============================================================================

const COL_BG_DIM       = rgba(0, 0, 5, 86);
const COL_BORDER_RED   = rgba(175, 34, 40, 124);
const COL_BORDER_STEEL = rgba(92, 106, 126, 112);
const COL_PANEL_BG     = rgba(7, 8, 13, 122);
const COL_HEADER_BG    = rgba(24, 9, 13, 126);
const COL_ROW_DARK     = rgba(13, 14, 21, 108);
const COL_ROW_ALT      = rgba(18, 19, 28, 108);
const COL_SEL_BG       = rgba(118, 20, 28, 122);
const COL_SEL_GLOW     = rgba(210, 42, 48, 42);
const COL_SEL_BAR      = rgba(245, 58, 62, 128);
const COL_TITLE_RED    = rgba(242, 46, 50, 128);
const COL_TITLE_GHOST  = rgba(120, 18, 24, 72);
const COL_WHITE        = rgba(238, 240, 246, 128);
const COL_MUTED        = rgba(152, 160, 176, 128);
const COL_GOLD         = rgba(250, 214, 96, 128);
const COL_CYAN         = rgba(86, 224, 255, 128);
const COL_GREEN        = rgba(88, 242, 138, 128);
const COL_KEYCAP_BG    = rgba(28, 32, 44, 124);

// Estado visual suave para cursores animados en menús
let uiTitleSlideY = -1.0;
let uiOptSlideY   = -1.0;
let uiPauseSlideY = -1.0;
let uiCinSlideY   = -1.0;

function getSafeMargins() {
    return GAME_SETTINGS.crtSafe
        ? { sx: 28, sy: 18 }
        : { sx: 10, sy: 6 };
}

function uiLerpY(cur, target) {
    if (cur < 0) return target;
    return fadd(cur, (target - cur) * 0.34);
}

// Dibuja esquinas arquitectónicas en L (estilo industrial / visor táctico PS2)
function drawCornerBrackets(x, y, w, h, len, col) {
    Draw.rect(x, y, len, 2, col);
    Draw.rect(x, y, 2, len, col);
    Draw.rect(x + w - len, y, len, 2, col);
    Draw.rect(x + w - 2, y, 2, len, col);
    Draw.rect(x, y + h - 2, len, 2, col);
    Draw.rect(x, y + h - len, 2, len, col);
    Draw.rect(x + w - len, y + h - 2, len, 2, col);
    Draw.rect(x + w - 2, y + h - len, 2, len, col);
}

function drawPanel(x, y, w, h, title, fnt, accentCol = COL_BORDER_RED, frameTick = 0) {
    // Sombra exterior suave + cuerpo obsidiana
    Draw.rect(x - 4, y - 4, w + 8, h + 8, rgba(0, 0, 0, 74));
    Draw.rect(x - 1, y - 1, w + 2, h + 2, COL_BORDER_STEEL);
    Draw.rect(x, y, w, h, COL_PANEL_BG);

    // Filete superior de acento y esquinas L
    Draw.rect(x, y, w, 3, accentCol);
    drawCornerBrackets(x - 2, y - 2, w + 4, h + 4, 16, accentCol);

    if (title) {
        Draw.rect(x, y + 3, w, 35, COL_HEADER_BG);
        Draw.rect(x, y + 38, w, 1, accentCol);
        // Indicador de estado parpadeante en cabecera
        const pulse = ((frameTick % 56) < 34);
        Draw.rect(x + 14, y + 16, 7, 7, pulse ? accentCol : rgba(75, 22, 28, 110));
        fnt.scale = Math.fround(0.76);
        fnt.color = COL_WHITE;
        fnt.print(x + 28, y + 10, title);
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
    "CREDITOS Y HARDWARE",
    "CINEMATICAS (TEST)"
];
const TITLE_ITEMS_NIGHTMARE = [
    "NUEVA PARTIDA   < PESADILLA >",
    "OPCIONES Y VIDEO PS2",
    "CONTROLES DUALSHOCK 2",
    "EXPEDIENTE / HISTORIA",
    "CREDITOS Y HARDWARE",
    "CINEMATICAS (TEST)"
];
const CINEMATIC_MENU_ITEMS = [
    { badge: "CAP 1", title: "INTRO - CINTA RECUPERADA",  meta: "44s  |  7 PLANOS  |  Subsuelo 04" },
    { badge: "CAP 2", title: "TUNELES DE MANTENIMIENTO",  meta: "14s  |  3 PLANOS  |  Nivel -2 y Valdez" },
    { badge: "CAP 3", title: "PABELLON DE CONTENCION",    meta: "14s  |  3 PLANOS  |  Origen Sujeto 04" },
    { badge: "FINAL", title: "EVACUACION - SALIDA NORTE", meta: "22s  |  4 PLANOS  |  Escape a superficie" },
    { badge: "MENU",  title: "VOLVER AL MENU PRINCIPAL",  meta: "Regresar a la pantalla de titulo" }
];
const DECOY_HUD_LABELS = ["SEN:0", "SEN:1", "SEN:2", "SEN:3"];
const LORE_TABS_OPEN = ["NOTA #01", "NOTA #02", "NOTA #03", "NOTA #04"];
const LORE_TABS_LOCK = ["BLOQ #01", "BLOQ #02", "BLOQ #03", "BLOQ #04"];
const PAUSE_REG_LABELS = [
    "REGISTROS (0/8)", "REGISTROS (1/8)", "REGISTROS (2/8)", "REGISTROS (3/8)",
    "REGISTROS (4/8)", "REGISTROS (5/8)", "REGISTROS (6/8)", "REGISTROS (7/8)", "REGISTROS (8/8)"
];
const END_OPTS_WIN  = ["JUGAR DE NUEVO", "VOLVER AL MENU PRINCIPAL"];
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
    "SALIDA NORTE ABIERTA! [X EN COMPUERTA]"
];

// ============================================================================
// PANTALLA DE TÍTULO CINEMATOGRÁFICA (deja respirar el escenario 3D a la derecha)
// ============================================================================
function drawTitleMenu(screenW, screenH, cursor, frameTick, fnt) {
    const { sx, sy } = getSafeMargins();

    // Gradiente lateral izquierdo en 5 franjas para contraste AAA sin tapar el fondo 3D
    Draw.rect(0, 0, 260, screenH, rgba(4, 4, 8, 118));
    Draw.rect(260, 0, 70, screenH, rgba(4, 4, 8, 96));
    Draw.rect(330, 0, 60, screenH, rgba(4, 4, 8, 68));
    Draw.rect(390, 0, 55, screenH, rgba(4, 4, 8, 38));
    Draw.rect(445, 0, 50, screenH, rgba(4, 4, 8, 16));

    // Bandas letterbox finas superior e inferior
    Draw.rect(0, 0, screenW, sy + 6, rgba(0, 0, 0, 118));
    Draw.rect(0, screenH - sy - 26, screenW, sy + 26, rgba(0, 0, 0, 118));
    Draw.rect(0, sy + 6, screenW, 1, rgba(95, 24, 30, 100));
    Draw.rect(0, screenH - sy - 26, screenW, 1, rgba(95, 24, 30, 100));

    // Barrido VHS sutil
    if (GAME_SETTINGS.overlays) {
        const scanY = (frameTick * 2) % screenH;
        Draw.rect(0, scanY, screenW, 2, rgba(220, 45, 50, 22));
    }

    // Esquinas CCTV en el encuadre derecho abierto
    drawCornerBrackets(sx, sy + 14, screenW - sx * 2, screenH - sy * 2 - 48, 14, rgba(160, 175, 195, 62));

    // Bloque tipográfico principal (con leve parpadeo eléctrico + sombra roja)
    const flicker = ((frameTick % 149) < 3 || (frameTick % 211) === 0) ? 0.58 : 1.0;
    const tx = sx + 8;
    const ty = sy + 24;

    fnt.scale = Math.fround(1.36);
    fnt.color = COL_TITLE_GHOST;
    fnt.print(tx + 3, ty + 2, "SUBSUELO 04");
    fnt.color = rgba((244 * flicker) | 0, (44 * flicker) | 0, (48 * flicker) | 0, 128);
    fnt.print(tx, ty, "SUBSUELO 04");

    // Filete rojo + subtítulo
    Draw.rect(tx, ty + 44, 240, 2, COL_SEL_BAR);
    Draw.rect(tx + 240, ty + 44, 72, 2, rgba(110, 30, 36, 96));

    fnt.scale = Math.fround(0.76);
    fnt.color = COL_GOLD;
    fnt.print(tx, ty + 52, "EL ACECHADOR   //   PLAYSTATION 2");

    // Lista de opciones con barra deslizante animada
    const items = GAME_SETTINGS.difficulty === 1 ? TITLE_ITEMS_NIGHTMARE : TITLE_ITEMS_NORMAL;
    const listY = ty + 90;
    const rowH = 38;
    const listW = Math.min(342, screenW - sx * 2 - 16);

    const targetY = toF64(listY + cursor * rowH - 3);
    uiTitleSlideY = uiLerpY(uiTitleSlideY, targetY);
    const slideYi = uiTitleSlideY | 0;

    // Resplandor + píldora del ítem activo
    Draw.rect(tx - 4, slideYi - 2, listW + 8, 36, COL_SEL_GLOW);
    Draw.rect(tx, slideYi, listW, 32, COL_SEL_BG);
    Draw.rect(tx, slideYi, 5, 32, COL_SEL_BAR);
    Draw.rect(tx, slideYi, listW, 1, rgba(245, 95, 95, 110));

    for (let i = 0; i < items.length; i++) {
        const ry = listY + i * rowH;
        const selected = (i === cursor);
        fnt.scale = Math.fround(selected ? 0.78 : 0.72);
        fnt.color = selected ? COL_GOLD : COL_WHITE;
        if (selected) {
            fnt.print(tx + 14, ry + 2, ">");
            fnt.print(tx + 34, ry + 2, items[i]);
        } else {
            fnt.print(tx + 20, ry + 3, items[i]);
        }
    }

    // Panel lateral derecho minimalista (estado del sistema, récord y campaña)
    const rx = screenW - sx - 188;
    const ryInfo = sy + 28;
    Draw.rect(rx - 10, ryInfo - 4, 192, 108, rgba(8, 10, 15, 98));
    Draw.rect(rx - 10, ryInfo - 4, 192, 2, COL_BORDER_STEEL);
    fnt.scale = Math.fround(0.70);
    fnt.color = COL_MUTED;
    fnt.print(rx, ryInfo + 4, "HK ENTERTAINMENT");
    fnt.color = RECORDS.mcAvailable ? COL_CYAN : COL_MUTED;
    fnt.print(rx, ryInfo + 28, RECORDS.mcAvailable ? "MC0: CONECTADA" : "MC0: SIN TARJETA");
    const best = GAME_SETTINGS.difficulty === 1 ? RECORDS.bestNightmareSec : RECORDS.bestNormalSec;
    fnt.color = best > 0 ? COL_GREEN : COL_MUTED;
    fnt.print(rx, ryInfo + 52, best > 0 ? ["RECORD: ", formatTime(best)].join("") : "SIN ESCAPES AUN");
    fnt.color = COL_GOLD;
    fnt.print(rx, ryInfo + 76, ["CAMPANA: CAP ", String(RECORDS.maxChapterUnlocked || 1), "/3"].join(""));

    // Pie de navegación
    const footY = screenH - sy - 20;
    fnt.scale = Math.fround(0.70);
    fnt.color = COL_WHITE;
    fnt.print(sx + 8, footY, "[D-PAD] ELEGIR   [IZQ/DER] DIFICULTAD   [X/START] ACEPTAR");
}

// ============================================================================
// MENÚ DE OPCIONES CON BARRA DE VOLUMEN Y BADGES DE ESTADO
// ============================================================================
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
    const qualityLabel = (GAME_SETTINGS.qualityIndex === 0 && hwStreamFailed)
        ? "ERROR VU1"
        : QUALITY_LABELS[GAME_SETTINGS.qualityIndex];
    const rows = [
        { label: "MOTOR GRAFICO",    val: qualityLabel,                                  kind: "cyan" },
        { label: "ASPECTO TV",       val: GAME_SETTINGS.aspect16x9 ? "16:9" : "4:3",     kind: "cyan" },
        { label: "MARGEN CRT",       val: GAME_SETTINGS.crtSafe ? "SEGURO" : "COMPLETO", kind: "bool", on: GAME_SETTINGS.crtSafe },
        { label: "SENSIBILIDAD",     val: SENS_LABELS[GAME_SETTINGS.sensitivityIndex],   kind: "cyan" },
        { label: "VIBRACION DS2",    val: GAME_SETTINGS.rumble ? "SI" : "NO",            kind: "bool", on: GAME_SETTINGS.rumble },
        { label: "EFECTOS VHS",      val: GAME_SETTINGS.overlays ? "SI" : "NO",          kind: "bool", on: GAME_SETTINGS.overlays },
        { label: "VOLUMEN AUDIO",    val: audioVal,                                      kind: "vol"  },
        { label: "ESTADISTICAS PS2", val: GAME_SETTINGS.showFps ? "SI" : "NO",           kind: "bool", on: GAME_SETTINGS.showFps },
        { label: "OMITIR INTRO",     val: GAME_SETTINGS.skipIntro ? "SI" : "NO",         kind: "bool", on: GAME_SETTINGS.skipIntro },
        { label: "GUARDAR EN MC0",   val: "[X] GUARDAR",                                 kind: "save" }
    ];

    const startY = py + 45;
    const rowH = 30;
    uiOptSlideY = uiLerpY(uiOptSlideY, toF64(startY + cursor * rowH - 2));

    for (let i = 0; i < rows.length; i++) {
        const ry = startY + i * rowH;
        Draw.rect(px + 14, ry - 2, panelW - 28, 27, (i & 1) ? COL_ROW_ALT : COL_ROW_DARK);
    }

    // Resaltado animado
    const syi = uiOptSlideY | 0;
    Draw.rect(px + 14, syi, panelW - 28, 27, COL_SEL_BG);
    Draw.rect(px + 14, syi, 5, 27, COL_SEL_BAR);

    for (let i = 0; i < rows.length; i++) {
        const ry = startY + i * rowH;
        const sel = (i === cursor);
        const r = rows[i];

        fnt.scale = Math.fround(0.72);
        fnt.color = sel ? COL_GOLD : COL_WHITE;
        fnt.print(px + 26, ry + 2, r.label);

        const vx = px + panelW - 238;
        if (r.kind === "vol") {
            // Barra segmentada de 4 bloques para volumen
            for (let seg = 0; seg < 4; seg++) {
                const active = (volIdx > seg) && GAME_SETTINGS.audioVolume > 0;
                Draw.rect(vx + seg * 22, ry + 7, 18, 10, active ? COL_CYAN : rgba(36, 42, 54, 120));
            }
            fnt.color = sel ? COL_GOLD : COL_WHITE;
            fnt.print(vx + 96, ry + 2, r.val);
        } else {
            let vCol = COL_WHITE;
            if (r.kind === "bool") vCol = r.on ? COL_GREEN : COL_MUTED;
            else if (r.kind === "cyan") vCol = COL_CYAN;
            else if (r.kind === "save") vCol = COL_GOLD;
            fnt.color = sel ? (r.kind === "bool" ? vCol : COL_GOLD) : vCol;
            const valText = (i < rows.length - 1) ? ["< ", String(r.val), " >"].join("") : String(r.val);
            fnt.print(vx, ry + 2, valText);
        }
    }

    const footY = py + panelH - 34;
    Draw.rect(px + 14, footY - 8, panelW - 28, 1, COL_BORDER_STEEL);
    fnt.scale = Math.fround(0.70);
    if (saveFeedbackTimer > 0) {
        fnt.color = COL_GREEN;
        fnt.print(px + 18, footY, "AJUSTES GUARDADOS EN MEMORY CARD");
    } else {
        fnt.color = COL_WHITE;
        fnt.print(px + 18, footY, "[IZQ/DER] CAMBIAR   [X] ACEPTAR   [O] VOLVER");
    }
}

// ============================================================================
// CONTROLES DUALSHOCK 2
// ============================================================================
function drawControlsMenu(screenW, screenH, fnt) {
    const { sx, sy } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, COL_BG_DIM);

    const panelW = screenW - sx * 2 - 12;
    const panelH = screenH - sy * 2 - 12;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, "CONTROLES DUALSHOCK 2", fnt);

    const bindings = [
        ["STICK IZQ / D-PAD",  "Caminar (con inercia)"],
        ["STICK DER / L1-R1",  "Girar la camara"],
        ["X (CRUZ)",           "Interactuar / Esconderse"],
        ["CIRCULO / ABAJO+O",  "Correr / Giro rapido 180"],
        ["CUADRADO",           "Agacharse (modo sigilo)"],
        ["TRIANGULO",          "Linterna ON / OFF"],
        ["L2 / SELECT",        "Lanzar senuelo / Mapa PDA"],
        ["START / R2",         "Pausa / Diagnostico PS2"]
    ];

    let y = py + 46;
    for (let i = 0; i < bindings.length; i++) {
        Draw.rect(px + 14, y - 2, panelW - 28, 27, (i & 1) ? COL_ROW_ALT : COL_ROW_DARK);
        Draw.rect(px + 18, y + 1, 208, 21, COL_KEYCAP_BG);
        fnt.scale = Math.fround(0.71);
        fnt.color = COL_GOLD;
        fnt.print(px + 24, y + 2, bindings[i][0]);
        fnt.color = COL_WHITE;
        fnt.print(px + 238, y + 2, bindings[i][1]);
        y += 30;
    }

    fnt.scale = Math.fround(0.70);
    fnt.color = COL_CYAN;
    fnt.print(px + 18, y + 8, "TIP: Agachate [CUAD] o escondete [X] con la luz apagada.");

    const footY = py + panelH - 34;
    Draw.rect(px + 14, footY - 8, panelW - 28, 1, COL_BORDER_STEEL);
    fnt.scale = Math.fround(0.70);
    fnt.color = COL_GOLD;
    fnt.print(px + 18, footY, "[X] o [CIRCULO] VOLVER");
}

// ============================================================================
// EXPEDIENTE / REGISTROS (8 NOTAS DE CAMPAÑA)
// ============================================================================
function drawLoreMenu(screenW, screenH, collectedNotes, selectedNoteIdx, fromPause, fnt) {
    const { sx, sy } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, COL_BG_DIM);

    const panelW = screenW - sx * 2 - 12;
    const panelH = screenH - sy * 2 - 12;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    const title = fromPause ? "REGISTROS RECOLECTADOS" : "EXPEDIENTE - SUBSUELO 04";
    drawPanel(px, py, panelW, panelH, title, fnt);

    const tabPage = (selectedNoteIdx >= 4) ? 4 : 0;
    const tabW = ((panelW - 44) / 4) | 0;
    for (let slot = 0; slot < 4; slot++) {
        const i = tabPage + slot;
        if (i >= LORE_NOTES.length) break;
        const tx = px + 16 + slot * (tabW + 4);
        const sel = (i === selectedNoteIdx);
        const unlocked = !fromPause || collectedNotes[i];
        Draw.rect(tx, py + 46, tabW, 28, sel ? COL_SEL_BG : COL_ROW_DARK);
        if (sel) Draw.rect(tx, py + 72, tabW, 2, COL_SEL_BAR);
        fnt.scale = Math.fround(0.72);
        fnt.color = sel ? COL_GOLD : (unlocked ? COL_WHITE : COL_MUTED);
        const openLbl = ["NOTA #0", String(i + 1)].join("");
        const lockLbl = ["BLOQ #0", String(i + 1)].join("");
        fnt.print(tx + 8, py + 50, unlocked ? openLbl : lockLbl);
    }

    const note = LORE_NOTES[selectedNoteIdx] || LORE_NOTES[0];
    const unlocked = !fromPause || collectedNotes[selectedNoteIdx];
    const bodyY = py + 88;
    Draw.rect(px + 16, bodyY - 4, panelW - 32, panelH - 142, rgba(11, 12, 18, 112));
    Draw.rect(px + 16, bodyY - 4, 3, panelH - 142, unlocked ? COL_GOLD : COL_BORDER_STEEL);

    if (unlocked) {
        fnt.scale = Math.fround(0.74);
        fnt.color = COL_GOLD;
        fnt.print(px + 28, bodyY + 4, note.code);

        fnt.scale = Math.fround(0.73);
        fnt.color = COL_WHITE;
        for (let l = 0; l < note.lines.length; l++) {
            fnt.print(px + 28, bodyY + 38 + l * 32, note.lines[l]);
        }
    } else {
        fnt.scale = Math.fround(0.74);
        fnt.color = COL_MUTED;
        fnt.print(px + 28, bodyY + 24, "REGISTRO NO ENCONTRADO");
        fnt.scale = Math.fround(0.72);
        fnt.print(px + 28, bodyY + 66, "Explora los 3 capitulos y recoge las");
        fnt.print(px + 28, bodyY + 98, "hojas marcadas en el plano PDA.");
    }

    const footY = py + panelH - 34;
    Draw.rect(px + 14, footY - 8, panelW - 28, 1, COL_BORDER_STEEL);
    fnt.scale = Math.fround(0.70);
    fnt.color = COL_WHITE;
    fnt.print(px + 18, footY, fromPause
        ? "[IZQ/DER] NOTA   [X/CIRCULO] VOLVER"
        : "[IZQ/DER] NOTA   [TRIANG.] VER INTRO   [X/O] VOLVER");
}

// ============================================================================
// CRÉDITOS Y HARDWARE PS2
// ============================================================================
function drawCreditsMenu(screenW, screenH, modeInfo, fnt) {
    const { sx, sy } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, COL_BG_DIM);

    const panelW = screenW - sx * 2 - 12;
    const panelH = screenH - sy * 2 - 12;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, "CREDITOS Y SISTEMA PS2", fnt);

    fnt.scale = Math.fround(0.84);
    fnt.color = COL_TITLE_RED;
    fnt.print(px + 22, py + 48, "SUBSUELO 04: EL ACECHADOR");

    fnt.scale = Math.fround(0.72);
    fnt.color = COL_WHITE;
    fnt.print(px + 22, py + 84,  "Estudio:   HK Entertainment");
    fnt.print(px + 22, py + 112, "Autor:     Joaquin Gasperetti");
    fnt.print(px + 22, py + 140, "Motor:     HK Engine 1 (AthenaEnv V4)");

    Draw.rect(px + 20, py + 174, panelW - 40, 1, COL_BORDER_STEEL);

    fnt.scale = Math.fround(0.74);
    fnt.color = COL_GOLD;
    fnt.print(px + 22, py + 184, "TELEMETRIA DE CONSOLA:");
    fnt.scale = Math.fround(0.70);
    fnt.color = COL_CYAN;
    fnt.print(px + 22, py + 216, ["Video: ", String(screenW), "x", String(screenH), " (", modeInfo.vmodeLabel, ")"].join(""));
    fnt.print(px + 22, py + 244, isAudioReady() ? "Audio PS2: ACTIVO (OGG Stream)" : "Audio PS2: INACTIVO");
    fnt.print(px + 22, py + 272, RECORDS.mcAvailable ? "Memory Card (mc0): OK" : "Memory Card (mc0): NO DETECTADA");
    fnt.print(px + 22, py + 300, ["Escapes: ", String(RECORDS.escapes), "   |   Campana: Cap ", String(RECORDS.maxChapterUnlocked || 1), "/3"].join(""));

    const footY = py + panelH - 34;
    Draw.rect(px + 14, footY - 8, panelW - 28, 1, COL_BORDER_STEEL);
    fnt.scale = Math.fround(0.70);
    fnt.color = COL_GOLD;
    fnt.print(px + 20, footY, "[X] o [CIRCULO] VOLVER");
}

// ============================================================================
// MENÚ DE PAUSA CON CURSOR DESLIZANTE
// ============================================================================
function drawPauseMenu(screenW, screenH, cursor, notesFoundCount, fnt) {
    const { sx, sy } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, rgba(0, 0, 8, 102));

    const panelW = Math.min(490, screenW - sx * 2);
    const panelH = 340;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, "PAUSA", fnt);

    const items = [
        "CONTINUAR PARTIDA",
        "OPCIONES Y VIDEO PS2",
        PAUSE_REG_LABELS[notesFoundCount] || "REGISTROS (0/8)",
        "CONTROLES",
        "REINICIAR CAPITULO",
        "VOLVER AL MENU PRINCIPAL"
    ];

    const startY = py + 50;
    const rowH = 39;
    uiPauseSlideY = uiLerpY(uiPauseSlideY, toF64(startY + cursor * rowH - 3));
    const syi = uiPauseSlideY | 0;

    Draw.rect(px + 16, syi, panelW - 32, 33, COL_SEL_BG);
    Draw.rect(px + 16, syi, 5, 33, COL_SEL_BAR);

    for (let i = 0; i < items.length; i++) {
        const ry = startY + i * rowH;
        const sel = (i === cursor);
        fnt.scale = Math.fround(0.76);
        fnt.color = sel ? COL_GOLD : COL_WHITE;
        if (sel) {
            fnt.print(px + 28, ry + 2, ">");
            fnt.print(px + 50, ry + 2, items[i]);
        } else {
            fnt.print(px + 44, ry + 2, items[i]);
        }
    }

    Draw.rect(px + 16, py + panelH - 40, panelW - 32, 1, COL_BORDER_STEEL);
    fnt.scale = Math.fround(0.70);
    fnt.color = COL_WHITE;
    fnt.print(px + 18, py + panelH - 30, "[X] ELEGIR   [O/START] SEGUIR");
}

function drawNoteOverlay(screenW, screenH, noteIdx, fnt) {
    const { sx } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, rgba(0, 0, 8, 100));

    const note = LORE_NOTES[noteIdx] || LORE_NOTES[0];
    const panelW = Math.min(548, screenW - sx * 2);
    const panelH = 280;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, note.code, fnt, COL_GOLD);

    fnt.scale = Math.fround(0.74);
    fnt.color = COL_WHITE;
    for (let l = 0; l < note.lines.length; l++) {
        fnt.print(px + 22, py + 52 + l * 34, note.lines[l]);
    }

    Draw.rect(px + 16, py + panelH - 38, panelW - 32, 1, COL_BORDER_STEEL);
    fnt.scale = Math.fround(0.70);
    fnt.color = COL_GOLD;
    fnt.print(px + 20, py + panelH - 28, "[X] o [CIRCULO] GUARDAR Y SEGUIR");
}

// ============================================================================
// PANTALLAS FINALES (VICTORIA CON RANGO ENMARCADO / DERROTA)
// ============================================================================
function drawEndScreen(screenW, screenH, isWin, cursor, secs, notesFound, difficulty, fnt) {
    const { sx } = getSafeMargins();
    const tint = isWin ? rgba(4, 24, 12, 102) : rgba(42, 2, 6, 108);
    const accent = isWin ? COL_GREEN : COL_BORDER_RED;
    Draw.rect(0, 0, screenW, screenH, tint);

    const panelW = Math.min(544, screenW - sx * 2);
    const panelH = 324;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, isWin ? "EVACUACION COMPLETADA" : "SENAL PERDIDA - TE ALCANZO", fnt, accent);

    if (isWin) {
        let rank = "C";
        if (secs <= 240 && notesFound >= 5) rank = "S";
        else if (secs <= 360) rank = "A";
        else if (secs <= 520) rank = "B";

        fnt.scale = Math.fround(0.80);
        fnt.color = COL_GREEN;
        fnt.print(px + 22, py + 48, "ESCAPASTE DEL SUBSUELO 04!");

        fnt.scale = Math.fround(0.74);
        fnt.color = COL_WHITE;
        fnt.print(px + 22, py + 90,  ["Tiempo:     ", formatTime(secs)].join(""));
        fnt.print(px + 22, py + 120, ["Dificultad: ", DIFF_LABELS[difficulty] || "NORMAL"].join(""));
        fnt.print(px + 22, py + 150, ["Registros:  ", String(notesFound), "/8"].join(""));

        // Sello de rango con esquinas doradas
        const rx = px + panelW - 142;
        const ry = py + 84;
        Draw.rect(rx, ry, 114, 86, rgba(16, 20, 14, 122));
        drawCornerBrackets(rx, ry, 114, 86, 14, COL_GOLD);
        fnt.scale = Math.fround(0.70);
        fnt.color = COL_MUTED;
        fnt.print(rx + 26, ry + 8, "RANGO");
        fnt.scale = Math.fround(1.45);
        fnt.color = COL_GOLD;
        fnt.print(rx + 42, ry + 30, rank);
    } else {
        fnt.scale = Math.fround(0.82);
        fnt.color = COL_TITLE_RED;
        fnt.print(px + 22, py + 50, "EL ACECHADOR TE ATRAPO");

        fnt.scale = Math.fround(0.74);
        fnt.color = COL_WHITE;
        fnt.print(px + 22, py + 92,  ["Tiempo sobrevivido: ", formatTime(secs)].join(""));
        fnt.scale = Math.fround(0.70);
        fnt.color = COL_CYAN;
        fnt.print(px + 22, py + 128, "TIP: Usa [CUAD] para sigilo, [L2] para lanzar");
        fnt.print(px + 22, py + 156, "un senuelo o escondete [X] con la luz apagada.");
    }

    const opts = isWin ? END_OPTS_WIN : END_OPTS_DEAD;
    const optY = py + 208;
    for (let i = 0; i < opts.length; i++) {
        const ry = optY + i * 42;
        const sel = (i === cursor);
        Draw.rect(px + 20, ry - 3, panelW - 40, 34, sel ? (isWin ? rgba(20, 88, 42, 120) : COL_SEL_BG) : COL_ROW_DARK);
        if (sel) Draw.rect(px + 20, ry - 3, 5, 34, isWin ? COL_GREEN : COL_SEL_BAR);
        fnt.scale = Math.fround(0.76);
        fnt.color = sel ? COL_GOLD : COL_WHITE;
        if (sel) {
            fnt.print(px + 34, ry + 2, ">");
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
    fnt.print(px + 22, py + 54, "Conecta un DualShock 2 en el");
    fnt.print(px + 22, py + 84, "Puerto 1 para continuar.");
}

// ============================================================================
// GALERÍA DE CINEMÁTICAS (TEST) CON BADGES DE CAPÍTULO Y CURSOR SUAVE
// ============================================================================
function drawCinematicsMenu(screenW, screenH, cursor, fnt) {
    const { sx, sy } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, COL_BG_DIM);

    const panelW = screenW - sx * 2 - 12;
    const panelH = screenH - sy * 2 - 12;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, "GALERIA DE CINEMATICAS (TEST)", fnt);

    fnt.scale = Math.fround(0.70);
    fnt.color = COL_MUTED;
    fnt.print(px + 20, py + 46, "Selecciona una secuencia (START 1s para omitir):");

    const startY = py + 76;
    const rowH = 52;
    uiCinSlideY = uiLerpY(uiCinSlideY, toF64(startY + cursor * rowH - 3));

    for (let i = 0; i < CINEMATIC_MENU_ITEMS.length; i++) {
        const ry = startY + i * rowH;
        Draw.rect(px + 16, ry - 3, panelW - 32, 46, (i & 1) ? COL_ROW_ALT : COL_ROW_DARK);
    }

    const syi = uiCinSlideY | 0;
    Draw.rect(px + 16, syi, panelW - 32, 46, COL_SEL_BG);
    Draw.rect(px + 16, syi, 6, 46, COL_SEL_BAR);

    for (let i = 0; i < CINEMATIC_MENU_ITEMS.length; i++) {
        const ry = startY + i * rowH;
        const sel = (i === cursor);
        const item = CINEMATIC_MENU_ITEMS[i];

        // Badge de capítulo a la izquierda
        Draw.rect(px + 28, ry + 6, 62, 26, sel ? rgba(30, 12, 16, 124) : COL_KEYCAP_BG);
        fnt.scale = Math.fround(0.70);
        fnt.color = sel ? COL_GOLD : COL_CYAN;
        fnt.print(px + 34, ry + 9, item.badge);

        fnt.scale = Math.fround(sel ? 0.76 : 0.72);
        fnt.color = sel ? COL_GOLD : COL_WHITE;
        fnt.print(px + 102, ry + 1, item.title);

        fnt.scale = Math.fround(0.70);
        fnt.color = sel ? COL_CYAN : COL_MUTED;
        fnt.print(px + 102, ry + 23, item.meta);
    }

    const footY = py + panelH - 34;
    Draw.rect(px + 14, footY - 8, panelW - 28, 1, COL_BORDER_STEEL);
    fnt.scale = Math.fround(0.70);
    fnt.color = COL_WHITE;
    fnt.print(px + 18, footY, "[D-PAD] ELEGIR   [X] REPRODUCIR   [O] VOLVER");
}
// --- MODULE: src/cinematic.js ---
// ============================================================================
// Sistema de Cinemáticas Declarativo para HK Engine 1 (PS2 Real / AthenaEnv V4)
// - Línea de tiempo declarativa: cámara 3D con altura (eyeH), cabeceo (pitchY),
//   respiración handheld, cambios de cámara CCTV por plano, tarjetas de título,
//   flashes de luz, fundidos, subtítulos máquina de escribir, efectos VHS,
//   entidades con estado de IA y cues de audio / vibración.
// - CERO carga de recursos durante la reproducción y CERO allocs por cuadro.
// - Compatible con 3D VU1 y raycaster 2.5D, NTSC 60Hz y PAL 50Hz.
// ============================================================================

// Colores estáticos precomputados (alfa GS PS2: 0..128)
const CIN_COL_BAR        = rgba(0, 0, 0, 128);
const CIN_COL_BAR_TRIM   = rgba(58, 66, 78, 88);
const CIN_COL_RETICLE    = rgba(175, 190, 208, 72);
const CIN_COL_REC_DOT    = rgba(235, 32, 32, 128);
const CIN_COL_REC_TXT    = rgba(240, 240, 245, 128);
const CIN_COL_META_TXT   = rgba(175, 190, 205, 128);
const CIN_COL_SUB_BG     = rgba(4, 5, 9, 104);
const CIN_COL_SUB_MAIN   = rgba(238, 240, 246, 128);
const CIN_COL_SUB_WARN   = rgba(255, 215, 110, 128);
const CIN_COL_SUB_ALERT  = rgba(255, 90, 85, 128);
const CIN_COL_SUB_RULE0  = rgba(120, 138, 158, 110);
const CIN_COL_SUB_RULE1  = rgba(240, 195, 85, 120);
const CIN_COL_SUB_RULE2  = rgba(235, 55, 55, 124);
const CIN_COL_TITLE_MAIN = rgba(244, 244, 248, 128);
const CIN_COL_TITLE_RED  = rgba(242, 52, 52, 128);
const CIN_COL_TITLE_GRN  = rgba(95, 242, 145, 128);
const CIN_COL_TITLE_SUB  = rgba(190, 200, 214, 124);
const CIN_COL_SKIP_BG    = rgba(18, 20, 26, 118);
const CIN_COL_SKIP_FILL  = rgba(235, 55, 55, 128);
const CIN_COL_SKIP_TXT   = rgba(210, 215, 224, 128);
const CIN_COL_SCANLINE   = rgba(200, 220, 235, 20);
const CIN_COL_GLITCH_W   = rgba(215, 225, 235, 44);
const CIN_COL_GLITCH_R   = rgba(220, 32, 36, 56);

// Tabla precomputada de segundos 00..59 para timecode VHS sin concatenación por cuadro
const CIN_TC_LABELS = [
    "REC 00:00", "REC 00:01", "REC 00:02", "REC 00:03", "REC 00:04",
    "REC 00:05", "REC 00:06", "REC 00:07", "REC 00:08", "REC 00:09",
    "REC 00:10", "REC 00:11", "REC 00:12", "REC 00:13", "REC 00:14",
    "REC 00:15", "REC 00:16", "REC 00:17", "REC 00:18", "REC 00:19",
    "REC 00:20", "REC 00:21", "REC 00:22", "REC 00:23", "REC 00:24",
    "REC 00:25", "REC 00:26", "REC 00:27", "REC 00:28", "REC 00:29",
    "REC 00:30", "REC 00:31", "REC 00:32", "REC 00:33", "REC 00:34",
    "REC 00:35", "REC 00:36", "REC 00:37", "REC 00:38", "REC 00:39",
    "REC 00:40", "REC 00:41", "REC 00:42", "REC 00:43", "REC 00:44",
    "REC 00:45", "REC 00:46", "REC 00:47", "REC 00:48", "REC 00:49",
    "REC 00:50", "REC 00:51", "REC 00:52", "REC 00:53", "REC 00:54",
    "REC 00:55", "REC 00:56", "REC 00:57", "REC 00:58", "REC 00:59"
];

// Ganchos documentados para futuros efectos ADPCM (.adp) en assets/audio/
const CINEMATIC_AUDIO_HOOKS = {
    vhs_static:    "assets/audio/vhs_static.adp",
    power_down:    "assets/audio/power_down.adp",
    stalker_growl: "assets/audio/stalker_growl.adp"
};

// Objetos reutilizables preasignados (cero allocaciones por frame en QuickJS)
const cinCamera = {
    x: toF64(10.0),
    y: toF64(1.8),
    ang: toF64(Math.PI * 0.5),
    eyeH: toF64(WORLD_EYE_H),
    pitchY: toF64(0.0),
    bobPhase: toF64(0.0),
    battery: toF64(100.0),
    flashlightOn: true,
    stamina: toF64(100.0)
};

const cinStalker = {
    x: toF64(99.0),
    y: toF64(99.0),
    baseSpeed: toF64(0.024),
    state: AI_PATROL,
    targetX: toF64(10.0),
    targetY: toF64(10.0),
    alertTimer: 0,
    chaseIntroMs: 0.0,
    wpIdx: 0,
    hasNextNode: false,
    nextNodeX: toF64(10.0),
    nextNodeY: toF64(10.0),
    animPhase: toF64(0.0),
    animSpasmPhase: toF64(0.0),
    animPrevX: toF64(99.0),
    animPrevY: toF64(99.0),
    animSpeed: toF64(0.0),
    animYaw: toF64(0.0),
    animYawInit: false,
    animOutY: toF64(0.0),
    animOutRx: toF64(0.0),
    animOutRy: toF64(0.0),
    animOutRz: toF64(0.0)
};

const cinState = {
    active: false,
    seq: null,
    nextState: 1, // STATE_PLAY
    elapsedMs: toF64(0.0),
    skipHoldMs: toF64(0.0),
    skipFading: false,
    skipFadeAlpha: toF64(0.0),
    fadeAlpha: 0,
    flashR: 0,
    flashG: 0,
    flashB: 0,
    flashAlpha: 0,
    fov: toF64(0.90),
    flashIntensity: toF64(1.0),
    glitch: toF64(0.0),
    redBlink: toF64(0.0),
    shake: toF64(0.0),
    flickerFlash: toF64(0.0),
    activeCamLabel: "",
    stalkerLookAtCam: false,
    titleMain: "",
    titleSub: "",
    titleStyle: 0,
    nextAudioIdx: 0,
    lastSubIdx: -1,
    lastSubChars: -1,
    cachedLine1: "",
    cachedLine2: "",
    cachedColorKind: 0,
    lastSecIdx: -1,
    cachedTcLabel: "REC 00:00",
    vramChecked: false,
    lowVramMode: false
};

function cinMeasureFreeVramKB() {
    try {
        if (typeof Screen !== "undefined" && Screen) {
            if (typeof Screen.getMemoryStats === "function" &&
                typeof Screen.VRAM_USED_TOTAL !== "undefined" &&
                typeof Screen.VRAM_SIZE !== "undefined") {
                const used = Screen.getMemoryStats(Screen.VRAM_USED_TOTAL) | 0;
                const total = Screen.getMemoryStats(Screen.VRAM_SIZE) | 0;
                return Math.max(0, ((total - used) / 1024) | 0);
            }
            if (typeof Screen.getFreeVRAM === "function") {
                const used = Screen.getFreeVRAM() | 0;
                return Math.max(0, ((4 * 1024 * 1024 - used) / 1024) | 0);
            }
        }
    } catch (_) {}
    return 1024;
}

function cinSmoothstep(t) {
    const c = clampF64(t, 0.0, 1.0);
    return c * c * (3.0 - 2.0 * c);
}

function cinLerpAngle(a0, a1, t) {
    const start = toF64(a0);
    let diff = toF64(a1) - start;
    const twoPi = 6.283185307179586;
    while ((diff - 3.141592653589793) > 0) diff = diff - twoPi;
    while ((diff - (-3.141592653589793)) < 0) diff = fadd(diff, twoPi);
    return fadd(start, diff * t);
}

function cinHashByte(seed) {
    let x = (seed ^ 0x5bd1e995) | 0;
    x = Math.imul(x, 1597334677);
    return (x >>> 24) & 255;
}

// Inicia una cinemática declarativa y cambia al estado STATE_CINEMATIC
function startCinematic(sequence, onFinishState) {
    if (!sequence || !sequence.keyframes || sequence.keyframes.length === 0) {
        switchState(onFinishState);
        return;
    }

    cinState.active = true;
    cinState.seq = sequence;
    cinState.nextState = onFinishState;
    cinState.elapsedMs = toF64(0.0);
    cinState.skipHoldMs = toF64(0.0);
    cinState.skipFading = false;
    cinState.skipFadeAlpha = toF64(0.0);
    cinState.fadeAlpha = 128;
    cinState.flashAlpha = 0;
    cinState.fov = toF64(0.90);
    cinState.flashIntensity = toF64(1.0);
    cinState.glitch = toF64(0.0);
    cinState.redBlink = toF64(0.0);
    cinState.shake = toF64(0.0);
    cinState.flickerFlash = toF64(0.0);
    cinState.activeCamLabel = sequence.cameraLabel || "";
    cinState.stalkerLookAtCam = false;
    cinState.titleMain = "";
    cinState.titleSub = "";
    cinState.titleStyle = 0;
    cinState.nextAudioIdx = 0;
    cinState.lastSubIdx = -1;
    cinState.lastSubChars = -1;
    cinState.cachedLine1 = "";
    cinState.cachedLine2 = "";
    cinState.cachedColorKind = 0;
    cinState.lastSecIdx = -1;
    cinState.cachedTcLabel = CIN_TC_LABELS[0];

    const freeKb = cinMeasureFreeVramKB();
    cinState.vramChecked = true;
    cinState.lowVramMode = freeKb < 256;

    const kf0 = sequence.keyframes[0];
    cinCamera.x = toF64(kf0.x);
    cinCamera.y = toF64(kf0.y);
    cinCamera.ang = toF64(kf0.ang);
    cinCamera.eyeH = toF64(kf0.eyeH !== undefined ? kf0.eyeH : WORLD_EYE_H);
    cinCamera.pitchY = toF64(kf0.pitchY !== undefined ? kf0.pitchY : 0.0);
    cinCamera.bobPhase = toF64(0.0);
    cinCamera.battery = toF64(100.0);
    cinCamera.flashlightOn = (kf0.flashlight !== false);
    if (kf0.cam) cinState.activeCamLabel = kf0.cam;

    cinStalker.x = toF64(99.0);
    cinStalker.y = toF64(99.0);
    cinStalker.state = AI_PATROL;
    resetStalkerAnim(cinStalker, 99.0, 99.0);

    hwLastFlashState = -1;
    triggerRumble(0, 0);
    switchState(STATE_CINEMATIC);
}

// Finaliza limpiamente la cinemática y entrega el control al estado destino
function finishCinematic() {
    const target = cinState.nextState;
    cinState.active = false;
    cinState.seq = null;
    cinState.skipFading = false;
    cinState.skipHoldMs = toF64(0.0);
    cinState.cachedLine1 = "";
    cinState.cachedLine2 = "";
    cinState.titleMain = "";
    cinState.titleSub = "";
    cinState.flashAlpha = 0;

    setMusicTrack("ambient", false);
    triggerRumble(0, 0);
    hwLastFlashState = -1;

    introFade = 36;
    switchState(target);
}

// Evalúa keyframes de cámara (posición, ángulo, altura eyeH, cabeceo pitchY, FOV y cámara activa)
function cinEvalCamera(seq, tMs, frameTick) {
    const kfs = seq.keyframes;
    const len = kfs.length;
    let idx = 0;
    for (let i = 0; i < len - 1; i++) {
        if ((tMs - toF64(kfs[i + 1].t)) >= 0) {
            idx = i + 1;
        } else {
            break;
        }
    }

    const a = kfs[idx];
    const b = (idx + 1 < len) ? kfs[idx + 1] : a;
    let x = toF64(a.x);
    let y = toF64(a.y);
    let ang = toF64(a.ang);
    let eyeH = toF64(a.eyeH !== undefined ? a.eyeH : WORLD_EYE_H);
    let pitchY = toF64(a.pitchY !== undefined ? a.pitchY : 0.0);
    let fov = toF64(a.fov !== undefined ? a.fov : 0.90);
    let flashOn = (a.flashlight !== false);
    const handheld = !!a.handheld;

    if (a.cam) cinState.activeCamLabel = a.cam;
    else cinState.activeCamLabel = seq.cameraLabel || "";

    if (b !== a && !b.snap) {
        const span = toF64(b.t) - toF64(a.t);
        if ((span - 1.0) > 0) {
            const u = cinSmoothstep((tMs - toF64(a.t)) / span);
            x = fadd(x, (toF64(b.x) - x) * u);
            y = fadd(y, (toF64(b.y) - y) * u);
            ang = cinLerpAngle(ang, toF64(b.ang), u);
            const eyeB = toF64(b.eyeH !== undefined ? b.eyeH : WORLD_EYE_H);
            const pitchB = toF64(b.pitchY !== undefined ? b.pitchY : 0.0);
            const fovB = toF64(b.fov !== undefined ? b.fov : 0.90);
            eyeH = fadd(eyeH, (eyeB - eyeH) * u);
            pitchY = fadd(pitchY, (pitchB - pitchY) * u);
            fov = fadd(fov, (fovB - fov) * u);
        }
    }

    // Respiración orgánica de cámara en mano (sin allocaciones, usando sin LUT del motor)
    if (handheld) {
        const phase = toF64(tMs * 0.0042);
        eyeH = fadd(eyeH, Math.sin(phase) * 0.045);
        ang = fadd(ang, Math.sin(phase * 0.65) * 0.012);
    }

    // Micro-shake VHS / impacto (posicional + angular + vertical)
    const shk = cinState.shake;
    if ((shk - 0.01) > 0) {
        const h1 = (cinHashByte(frameTick * 3 + 7) - 128) / 128.0;
        const h2 = (cinHashByte(frameTick * 5 + 19) - 128) / 128.0;
        const h3 = (cinHashByte(frameTick * 9 + 41) - 128) / 128.0;
        ang = fadd(ang, h1 * 0.030 * shk);
        x = fadd(x, h2 * 0.022 * shk);
        eyeH = fadd(eyeH, h3 * 0.028 * shk);
    }

    // Parpadeo eléctrico de linterna
    let fInt = toF64(1.0);
    if ((cinState.flickerFlash - 0.05) > 0) {
        const fh = cinHashByte(frameTick * 7 + 31);
        if (fh < ((cinState.flickerFlash * 120.0) | 0)) {
            fInt = toF64(0.18);
            flashOn = false;
        }
    }

    cinCamera.x = x;
    cinCamera.y = y;
    cinCamera.ang = ang;
    cinCamera.eyeH = clampF64(eyeH, 0.55, 2.38);
    cinCamera.pitchY = clampF64(pitchY, -1.20, 1.20);
    cinCamera.flashlightOn = flashOn;
    cinState.fov = fov;
    cinState.flashIntensity = fInt;
}

function cinEvalFade(seq, tMs) {
    let alpha = 0;
    const fades = seq.fades;
    if (fades) {
        for (let i = 0; i < fades.length; i++) {
            const f = fades[i];
            const t0 = toF64(f.t0);
            const t1 = toF64(f.t1);
            if ((tMs - t0) >= 0 && (tMs - t1) <= 0) {
                const span = t1 - t0;
                const u = (span > 1.0) ? clampF64((tMs - t0) / span, 0.0, 1.0) : 1.0;
                const val = fadd(toF64(f.from), (toF64(f.to) - toF64(f.from)) * u);
                const iv = val | 0;
                if (iv > alpha) alpha = iv;
            }
        }
    }
    if (cinState.skipFading) {
        const skA = cinState.skipFadeAlpha | 0;
        if (skA > alpha) alpha = skA;
    }
    if (alpha < 0) alpha = 0;
    if (alpha > 128) alpha = 128;
    cinState.fadeAlpha = alpha;
}

function cinEvalFlashes(seq, tMs) {
    let fa = 0;
    let fr = 0, fg = 0, fb = 0;
    const flashes = seq.flashes;
    if (flashes) {
        for (let i = 0; i < flashes.length; i++) {
            const fl = flashes[i];
            const t0 = toF64(fl.t0);
            const t1 = toF64(fl.t1);
            if ((tMs - t0) >= 0 && (tMs - t1) <= 0) {
                const span = t1 - t0;
                const u = (span > 1.0) ? clampF64((tMs - t0) / span, 0.0, 1.0) : 1.0;
                // Pulso rápido de subida (primer 20%) y decaimiento suave
                const env = (u < 0.2) ? (u / 0.2) : ((1.0 - u) / 0.8);
                const a = ((toF64(fl.maxAlpha || 80) * clampF64(env, 0.0, 1.0)) | 0);
                if (a > fa) {
                    fa = a;
                    fr = fl.r | 0;
                    fg = fl.g | 0;
                    fb = fl.b | 0;
                }
            }
        }
    }
    if (fa > 128) fa = 128;
    cinState.flashAlpha = fa;
    cinState.flashR = fr;
    cinState.flashG = fg;
    cinState.flashB = fb;
}

function cinEvalTitles(seq, tMs) {
    cinState.titleMain = "";
    cinState.titleSub = "";
    cinState.titleStyle = 0;
    const list = seq.titles;
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
        const ti = list[i];
        if ((tMs - toF64(ti.t0)) >= 0 && (tMs - toF64(ti.t1)) <= 0) {
            cinState.titleMain = ti.title || "";
            cinState.titleSub = ti.subtitle || "";
            cinState.titleStyle = ti.style | 0;
            return;
        }
    }
}

function cinEvalVhs(seq, tMs) {
    let glitch = toF64(0.0);
    let redBlink = toF64(0.0);
    let shake = toF64(0.0);
    let flicker = toF64(0.0);

    const list = seq.vhsEffects;
    if (list) {
        for (let i = 0; i < list.length; i++) {
            const fx = list[i];
            if ((tMs - toF64(fx.t0)) >= 0 && (tMs - toF64(fx.t1)) <= 0) {
                if (fx.glitch !== undefined && (toF64(fx.glitch) - glitch) > 0) glitch = toF64(fx.glitch);
                if (fx.redBlink !== undefined && (toF64(fx.redBlink) - redBlink) > 0) redBlink = toF64(fx.redBlink);
                if (fx.shake !== undefined && (toF64(fx.shake) - shake) > 0) shake = toF64(fx.shake);
                if (fx.flickerFlash !== undefined && (toF64(fx.flickerFlash) - flicker) > 0) flicker = toF64(fx.flickerFlash);
            }
        }
    }

    cinState.glitch = glitch;
    cinState.redBlink = redBlink;
    cinState.shake = shake;
    cinState.flickerFlash = flicker;
}

function cinEvalEntities(seq, tMs) {
    let stalkerVisible = false;
    cinState.stalkerLookAtCam = false;
    const list = seq.entities;
    if (list) {
        for (let i = 0; i < list.length; i++) {
            const ev = list[i];
            if (ev.kind === "stalker" && (tMs - toF64(ev.t0)) >= 0 && (tMs - toF64(ev.t1)) <= 0) {
                const span = toF64(ev.t1) - toF64(ev.t0);
                const u = (span > 1.0) ? clampF64((tMs - toF64(ev.t0)) / span, 0.0, 1.0) : 1.0;
                cinStalker.x = fadd(toF64(ev.x0), (toF64(ev.x1) - toF64(ev.x0)) * u);
                cinStalker.y = fadd(toF64(ev.y0), (toF64(ev.y1) - toF64(ev.y0)) * u);
                cinStalker.state = (ev.state !== undefined) ? ev.state : AI_PATROL;
                cinState.stalkerLookAtCam = !!ev.lookAtCam;
                stalkerVisible = true;
                break;
            }
        }
    }
    if (!stalkerVisible) {
        cinStalker.x = toF64(99.0);
        cinStalker.y = toF64(99.0);
        cinStalker.state = AI_PATROL;
        cinStalker.animYawInit = false;
    }
}

function cinEvalAudioCues(seq, tMs) {
    const cues = seq.audioCues;
    if (!cues) return;
    while (cinState.nextAudioIdx < cues.length) {
        const cue = cues[cinState.nextAudioIdx];
        if ((tMs - toF64(cue.t)) < 0) break;
        cinState.nextAudioIdx++;
        if (cue.type === "music") {
            setMusicTrack(cue.name || "ambient", !!cue.rewind);
        } else if (cue.type === "sfx") {
            playSfx(cue.name, cue.pan || 0, cue.vol !== undefined ? cue.vol : 0.85);
        } else if (cue.type === "hook") {
            playSfx(cue.name, cue.pan || 0, cue.vol !== undefined ? cue.vol : 0.8);
        } else if (cue.type === "rumble") {
            triggerRumble(cue.ms || 140, cue.power !== undefined ? cue.power : 1);
        }
    }
}

function cinEvalSubtitles(seq, tMs) {
    const subs = seq.subtitles;
    if (!subs) return;

    let activeIdx = -1;
    for (let i = 0; i < subs.length; i++) {
        const s = subs[i];
        if ((tMs - toF64(s.t0)) >= 0 && (tMs - toF64(s.t1)) <= 0) {
            activeIdx = i;
            break;
        }
    }

    if (activeIdx === -1) {
        if (cinState.lastSubIdx !== -1) {
            cinState.lastSubIdx = -1;
            cinState.lastSubChars = -1;
            cinState.cachedLine1 = "";
            cinState.cachedLine2 = "";
        }
        return;
    }

    const sub = subs[activeIdx];
    const l1 = sub.line1 || "";
    const l2 = sub.line2 || "";
    const totalChars = l1.length + l2.length;
    const cps = sub.cps || 28;
    const localMs = tMs - toF64(sub.t0);
    let shown = ((localMs * cps) / 1000.0) | 0;
    if (shown < 0) shown = 0;
    if (shown > totalChars) shown = totalChars;

    if (activeIdx !== cinState.lastSubIdx || shown !== cinState.lastSubChars) {
        cinState.lastSubIdx = activeIdx;
        cinState.lastSubChars = shown;
        cinState.cachedColorKind = sub.colorKind || 0;
        if (shown <= l1.length) {
            cinState.cachedLine1 = l1.slice(0, shown);
            cinState.cachedLine2 = "";
        } else {
            cinState.cachedLine1 = l1;
            cinState.cachedLine2 = l2.slice(0, shown - l1.length);
        }
    }
}

function cinDrawOverlay(screenW, screenH, frameTick, fnt) {
    const seq = cinState.seq;
    const safeX = GAME_SETTINGS.crtSafe ? 28 : 12;
    const safeY = GAME_SETTINGS.crtSafe ? 18 : 8;
    const barH = GAME_SETTINGS.crtSafe ? 50 : 42;

    // 1. Efectos VHS y alarma de emergencia
    if (GAME_SETTINGS.overlays) {
        const g = cinState.glitch;
        const rb = cinState.redBlink;

        if (!cinState.lowVramMode) {
            const scanY = (frameTick * 4) % screenH;
            Draw.rect(0, scanY, screenW, 2, CIN_COL_SCANLINE);
        }

        if ((g - 0.05) > 0) {
            const bands = ((g - 0.55) > 0) ? 3 : ((g - 0.25) > 0 ? 2 : 1);
            for (let b = 0; b < bands; b++) {
                const hy = cinHashByte(frameTick * 11 + b * 53);
                const hh = 3 + ((cinHashByte(frameTick * 7 + b * 29) * ((g * 16.0) | 0)) >> 8);
                const by = ((hy * (screenH - 20)) >> 8) + 10;
                const col = (b === 0 && (g - 0.45) > 0) ? CIN_COL_GLITCH_R : CIN_COL_GLITCH_W;
                Draw.rect(0, by, screenW, hh, col);
            }
        }

        if ((rb - 0.05) > 0 && ((frameTick & 15) < 7)) {
            let rAlpha = (rb * 82.0) | 0;
            if (rAlpha > 90) rAlpha = 90;
            const redCol = rgba(230, 22, 26, rAlpha);
            Draw.rect(0, barH, screenW, 4, redCol);
            Draw.rect(0, screenH - barH - 4, screenW, 4, redCol);
            Draw.rect(0, barH, 8, screenH - (barH << 1), rgba(210, 18, 22, rAlpha >> 1));
            Draw.rect(screenW - 8, barH, 8, screenH - (barH << 1), rgba(210, 18, 22, rAlpha >> 1));
        }

        // Esquinas de visor CCTV minimalistas (solo fuera de lowVramMode)
        if (!cinState.lowVramMode) {
            const rx0 = safeX;
            const rx1 = screenW - safeX;
            const ry0 = barH + 10;
            const ry1 = screenH - barH - 10;
            Draw.rect(rx0, ry0, 18, 2, CIN_COL_RETICLE);
            Draw.rect(rx0, ry0, 2, 14, CIN_COL_RETICLE);
            Draw.rect(rx1 - 18, ry0, 18, 2, CIN_COL_RETICLE);
            Draw.rect(rx1 - 2, ry0, 2, 14, CIN_COL_RETICLE);
            Draw.rect(rx0, ry1 - 2, 18, 2, CIN_COL_RETICLE);
            Draw.rect(rx0, ry1 - 14, 2, 14, CIN_COL_RETICLE);
            Draw.rect(rx1 - 18, ry1 - 2, 18, 2, CIN_COL_RETICLE);
            Draw.rect(rx1 - 2, ry1 - 14, 2, 14, CIN_COL_RETICLE);
        }
    }

    // 2. Bandas cinematográficas letterbox con filete metálico sutil
    Draw.rect(0, 0, screenW, barH, CIN_COL_BAR);
    Draw.rect(0, screenH - barH, screenW, barH, CIN_COL_BAR);
    Draw.rect(0, barH, screenW, 1, CIN_COL_BAR_TRIM);
    Draw.rect(0, screenH - barH - 1, screenW, 1, CIN_COL_BAR_TRIM);

    // 3. Cabecera CCTV: REC + timecode + cámara dinámica por plano + fecha
    const recOn = ((frameTick % 48) < 28);
    if (recOn) {
        Draw.rect(safeX, safeY + 5, 10, 10, CIN_COL_REC_DOT);
    }

    const secIdx = ((cinState.elapsedMs / 1000.0) | 0);
    const clampedSec = secIdx < 0 ? 0 : (secIdx >= CIN_TC_LABELS.length ? (CIN_TC_LABELS.length - 1) : secIdx);
    if (clampedSec !== cinState.lastSecIdx) {
        cinState.lastSecIdx = clampedSec;
        cinState.cachedTcLabel = CIN_TC_LABELS[clampedSec];
    }

    fnt.scale = Math.fround(0.70);
    fnt.color = CIN_COL_REC_TXT;
    fnt.print(safeX + 18, safeY, cinState.cachedTcLabel);

    fnt.scale = Math.fround(0.66);
    fnt.color = CIN_COL_META_TXT;
    if (cinState.activeCamLabel) {
        fnt.print((screenW >> 1) - 125, safeY + 2, cinState.activeCamLabel);
    }
    if (seq.dateLabel) {
        fnt.print(screenW - safeX - 154, safeY + 2, seq.dateLabel);
    }

    // 4. Subtítulos máquina de escribir sobre el borde inferior
    if (cinState.cachedLine1.length > 0) {
        const subH = cinState.cachedLine2.length > 0 ? 54 : 32;
        const subY = screenH - barH - subH - 10;
        const subW = screenW - (safeX << 1);
        Draw.rect(safeX, subY, subW, subH, CIN_COL_SUB_BG);

        let ruleCol = CIN_COL_SUB_RULE0;
        if (cinState.cachedColorKind === 2) ruleCol = CIN_COL_SUB_RULE2;
        else if (cinState.cachedColorKind === 1) ruleCol = CIN_COL_SUB_RULE1;
        Draw.rect(safeX, subY, subW, 2, ruleCol);

        fnt.scale = Math.fround(0.70);
        if (cinState.cachedColorKind === 2) fnt.color = CIN_COL_SUB_ALERT;
        else if (cinState.cachedColorKind === 1) fnt.color = CIN_COL_SUB_WARN;
        else fnt.color = CIN_COL_SUB_MAIN;

        fnt.print(safeX + 12, subY + 6, cinState.cachedLine1);
        if (cinState.cachedLine2.length > 0) {
            fnt.print(safeX + 12, subY + 28, cinState.cachedLine2);
        }
    }

    // 5. Indicador y barra de progreso para omitir manteniendo START
    const holdTarget = toF64(seq.skipHoldMs || 1200.0);
    const skipY = screenH - barH + 10;
    fnt.scale = Math.fround(0.64);
    fnt.color = CIN_COL_SKIP_TXT;
    fnt.print(safeX, skipY, "MANTENE [START] PARA OMITIR");

    if ((cinState.skipHoldMs - 1.0) > 0) {
        const barW = 150;
        const barX = screenW - safeX - barW;
        const ratio = clampF64(cinState.skipHoldMs / holdTarget, 0.0, 1.0);
        const fillW = (barW * ratio) | 0;
        Draw.rect(barX - 2, skipY + 2, barW + 4, 14, CIN_COL_SKIP_BG);
        if (fillW > 0) {
            Draw.rect(barX, skipY + 4, fillW, 10, CIN_COL_SKIP_FILL);
        }
    }

    // 6. Flash de luz / corte eléctrico (sobre la escena, debajo del fundido negro)
    if (cinState.flashAlpha > 0) {
        Draw.rect(0, 0, screenW, screenH, rgba(cinState.flashR, cinState.flashG, cinState.flashB, cinState.flashAlpha));
    }

    // 7. Fundido a negro / desde negro
    if (cinState.fadeAlpha > 0) {
        Draw.rect(0, 0, screenW, screenH, rgba(0, 0, 0, cinState.fadeAlpha));
    }

    // 8. Tarjetas de título editoriales (sobre el fundido para aperturas/cierres limpios)
    if (cinState.titleMain.length > 0) {
        const cy = (screenH >> 1) - 24;
        const ruleW = 240;
        const ruleX = (screenW - ruleW) >> 1;
        let tCol = CIN_COL_TITLE_MAIN;
        let rCol = CIN_COL_SUB_RULE0;
        if (cinState.titleStyle === 1) {
            tCol = CIN_COL_TITLE_RED;
            rCol = CIN_COL_SUB_RULE2;
        } else if (cinState.titleStyle === 2) {
            tCol = CIN_COL_TITLE_GRN;
            rCol = rgba(85, 225, 130, 120);
        }
        const approxW = cinState.titleMain.length * 14;
        const tx = Math.max(safeX, (screenW - approxW) >> 1);
        fnt.scale = Math.fround(1.02);
        fnt.color = tCol;
        fnt.print(tx, cy - 12, cinState.titleMain);
        Draw.rect(ruleX, cy + 28, ruleW, 2, rCol);

        if (cinState.titleSub.length > 0) {
            const subApproxW = cinState.titleSub.length * 9;
            const sx = Math.max(safeX, (screenW - subApproxW) >> 1);
            fnt.scale = Math.fround(0.72);
            fnt.color = CIN_COL_TITLE_SUB;
            fnt.print(sx, cy + 38, cinState.titleSub);
        }
    }
}

// Bucle principal de actualización y renderizado del estado STATE_CINEMATIC
function updateAndRenderCinematic(screenW, screenH, dtMs, dtScale, frameTick, padObj, fnt) {
    const seq = cinState.seq;
    if (!cinState.active || !seq) {
        finishCinematic();
        return;
    }

    const stepMs = toF64(dtMs);
    cinState.elapsedMs = fadd(cinState.elapsedMs, stepMs);

    const holdTarget = toF64(seq.skipHoldMs || 1200.0);
    if (!cinState.skipFading) {
        if (padObj.pressed(Pads.START)) {
            cinState.skipHoldMs = fadd(cinState.skipHoldMs, stepMs);
            if ((cinState.skipHoldMs - holdTarget) >= 0) {
                cinState.skipFading = true;
                cinState.skipFadeAlpha = toF64(cinState.fadeAlpha);
            }
        } else {
            cinState.skipHoldMs = toF64(0.0);
        }
    } else {
        cinState.skipFadeAlpha = fadd(cinState.skipFadeAlpha, stepMs * 0.45);
        if ((cinState.skipFadeAlpha - 128.0) >= 0) {
            finishCinematic();
            return;
        }
    }

    if ((cinState.elapsedMs - toF64(seq.durationMs)) >= 0) {
        finishCinematic();
        return;
    }

    const tMs = cinState.elapsedMs;
    cinEvalVhs(seq, tMs);
    cinEvalCamera(seq, tMs, frameTick);
    cinEvalEntities(seq, tMs);
    updateStalkerAnim(cinStalker, cinCamera.x, cinCamera.y, dtScale, cinState.stalkerLookAtCam, false);
    cinEvalFade(seq, tMs);
    cinEvalFlashes(seq, tMs);
    cinEvalTitles(seq, tMs);
    cinEvalAudioCues(seq, tMs);
    cinEvalSubtitles(seq, tMs);

    render3DWorld(
        screenW, screenH, worldGrid, cinCamera, cinStalker, entities,
        cinState.redBlink * 0.75, frameTick, !!seq.exitOpen,
        cinState.fov, cinState.flashIntensity, 1.0, 0.0
    );

    cinDrawOverlay(screenW, screenH, frameTick, fnt);
}

// ============================================================================
// CINEMÁTICA 01: "SUBSUELO 04 - CINTA RECUPERADA" (44 segundos, 7 planos)
// Recorre los 5 hitos reales de BASE_MAP: Compuerta Norte (4), Rejas Oeste (5),
// Disyuntor Rojo (10,11.5), Zona Ritual Sur (3 + fusible) y Pasillo Fila 10.
// Todas las coordenadas de cámara validadas en celdas transitables (0).
// ============================================================================
const CINEMATIC_INTRO = {
    id: "intro_subsuelo04",
    durationMs: 44000.0,
    skipHoldMs: 1200.0,
    chapterIdx: 0,
    exitOpen: false,
    cameraLabel: "CAM-01 // COMPUERTA NORTE",
    dateLabel: "14/10 02:14",

    keyframes: [
        // Plano 1 (0s..6.2s): Apertura con grúa CCTV alta descendiendo sobre Compuerta Norte sellada
        { t: 0.0,     x: 10.0, y: 2.75, ang: -1.5708, eyeH: 2.22, pitchY: -0.58, fov: 0.88, flashlight: true,  snap: true,  cam: "CAM-01 // COMPUERTA NORTE" },
        { t: 6200.0,  x: 10.0, y: 1.85, ang: -1.5708, eyeH: 1.48, pitchY:  0.08, fov: 0.92, flashlight: true,  snap: false, cam: "CAM-01 // COMPUERTA NORTE" },

        // Plano 2 (6.2s..12.6s): Travelling lateral CCTV hacia las rejas magnéticas Oeste (5, 8)
        { t: 6201.0,  x: 8.9,  y: 8.50, ang:  3.1416, eyeH: 2.15, pitchY: -0.42, fov: 0.90, flashlight: true,  snap: true,  cam: "CAM-02 // REJAS OESTE" },
        { t: 12600.0, x: 6.5,  y: 8.50, ang:  3.0600, eyeH: 1.72, pitchY: -0.18, fov: 0.88, flashlight: true,  snap: false, cam: "CAM-02 // REJAS OESTE" },

        // Plano 3 (12.6s..19.2s): Paneo cinematográfico sobre el Disyuntor Rojo central (10.0, 11.5)
        { t: 12601.0, x: 8.4,  y: 10.4, ang:  0.6400, eyeH: 1.12, pitchY: -0.18, fov: 0.90, flashlight: true,  snap: true,  cam: "CAM-03 // DISYUNTOR CENTRAL" },
        { t: 19200.0, x: 11.6, y: 10.4, ang:  2.4800, eyeH: 1.78, pitchY: -0.34, fov: 0.86, flashlight: true,  snap: false, cam: "CAM-03 // DISYUNTOR CENTRAL" },

        // Plano 4 (19.2s..25.4s): Travelling alto CCTV cruzando la Zona Ritual Sur (fila 16 libre) hacia el fusible (10.0, 17.5)
        { t: 19201.0, x: 8.50, y: 16.40, ang:  0.6400, eyeH: 2.22, pitchY: -0.50, fov: 0.90, flashlight: true,  snap: true,  cam: "CAM-04 // ZONA RITUAL SUR" },
        { t: 25400.0, x: 11.40, y: 16.40, ang:  2.4200, eyeH: 1.88, pitchY: -0.36, fov: 0.84, flashlight: true,  snap: false, cam: "CAM-04 // ZONA RITUAL SUR" },

        // Plano 5 (25.4s..32.6s): Contrapicado tenso en pasillo transversal — surge El Acechador
        { t: 25401.0, x: 5.5,  y: 10.5, ang:  0.0000, eyeH: 0.96, pitchY:  0.24, fov: 0.90, flashlight: true,  snap: true,  handheld: true, cam: "CAM-05 // PASILLO CENTRAL" },
        { t: 32600.0, x: 6.7,  y: 10.5, ang:  0.0150, eyeH: 1.04, pitchY:  0.20, fov: 0.86, flashlight: true,  snap: false, handheld: true, cam: "CAM-05 // PASILLO CENTRAL" },

        // Plano 6 (32.6s..37.6s): El Acechador fija la vista y carga — retroceso brusco y pérdida de señal
        { t: 32601.0, x: 6.7,  y: 10.5, ang:  0.0150, eyeH: 1.04, pitchY:  0.22, fov: 0.86, flashlight: true,  snap: false, handheld: true, cam: "SENAL INESTABLE // CAM-05" },
        { t: 37600.0, x: 5.2,  y: 10.5, ang: -0.0200, eyeH: 0.90, pitchY:  0.32, fov: 0.78, flashlight: true,  snap: false, handheld: true, cam: "SENAL INESTABLE // CAM-05" },

        // Plano 7 (37.6s..44.0s): Recuperación de enlace y match-cut exacto al spawn del jugador (10.0, 1.8)
        { t: 37601.0, x: 10.0, y: 1.70, ang:  1.5708, eyeH: 1.38, pitchY: -0.14, fov: 0.90, flashlight: true,  snap: true,  handheld: true, cam: "ENLACE DIRECTO // SUBSUELO 04" },
        { t: 44000.0, x: 10.0, y: 1.80, ang:  1.5708, eyeH: 1.55, pitchY:  0.00, fov: 0.90, flashlight: true,  snap: false, handheld: false, cam: "ENLACE DIRECTO // SUBSUELO 04" }
    ],

    titles: [
        { t0: 200.0,   t1: 2300.0,  title: "HK ENTERTAINMENT",   subtitle: "REGISTRO RECUPERADO - 14/10", style: 0 },
        { t0: 37700.0, t1: 39600.0, title: "SUBSUELO 04",        subtitle: "EL ACECHADOR",                style: 1 }
    ],

    fades: [
        { t0: 0.0,     t1: 2400.0,  from: 128, to: 128 },
        { t0: 2400.0,  t1: 3700.0,  from: 128, to: 0   },
        { t0: 37300.0, t1: 37650.0, from: 0,   to: 128 },
        { t0: 37650.0, t1: 39700.0, from: 128, to: 128 },
        { t0: 39700.0, t1: 41000.0, from: 128, to: 0   },
        { t0: 43400.0, t1: 44000.0, from: 0,   to: 44  }
    ],

    flashes: [
        { t0: 6150.0,  t1: 6450.0,  r: 220, g: 230, b: 245, maxAlpha: 42 },
        { t0: 12550.0, t1: 12850.0, r: 220, g: 230, b: 245, maxAlpha: 40 },
        { t0: 19150.0, t1: 19450.0, r: 210, g: 35,  b: 35,  maxAlpha: 46 },
        { t0: 32550.0, t1: 33000.0, r: 235, g: 25,  b: 25,  maxAlpha: 72 },
        { t0: 37200.0, t1: 37650.0, r: 245, g: 245, b: 255, maxAlpha: 96 }
    ],

    vhsEffects: [
        { t0: 2400.0,  t1: 4200.0,  glitch: 0.65, redBlink: 0.30, shake: 0.10, flickerFlash: 0.15 },
        { t0: 6000.0,  t1: 6600.0,  glitch: 0.68, redBlink: 0.45, shake: 0.16, flickerFlash: 0.0  },
        { t0: 6600.0,  t1: 12400.0, glitch: 0.12, redBlink: 0.40, shake: 0.04, flickerFlash: 0.0  },
        { t0: 12400.0, t1: 13000.0, glitch: 0.62, redBlink: 0.35, shake: 0.15, flickerFlash: 0.0  },
        { t0: 19000.0, t1: 19700.0, glitch: 0.72, redBlink: 0.60, shake: 0.22, flickerFlash: 0.20 },
        { t0: 25400.0, t1: 32600.0, glitch: 0.36, redBlink: 0.62, shake: 0.20, flickerFlash: 0.26 },
        { t0: 32600.0, t1: 37600.0, glitch: 0.92, redBlink: 1.00, shake: 0.74, flickerFlash: 0.58 },
        { t0: 39700.0, t1: 41200.0, glitch: 0.42, redBlink: 0.20, shake: 0.10, flickerFlash: 0.12 }
    ],

    entities: [
        // Paso pesado de patrulla emergiendo desde el extremo Este del pasillo fila 10
        { t0: 25600.0, t1: 32600.0, kind: "stalker", state: AI_PATROL, lookAtCam: false, x0: 14.4, y0: 10.5, x1: 10.9, y1: 10.5 },
        // Detección y embestida agresiva directa hacia la cámara
        { t0: 32601.0, t1: 37600.0, kind: "stalker", state: AI_HUNT,   lookAtCam: true,  x0: 10.9, y0: 10.5, x1: 7.4,  y1: 10.5 }
    ],

    subtitles: [
        {
            t0: 2700.0, t1: 6000.0, cps: 30, colorKind: 1,
            line1: "APAGON TOTAL // COMPUERTA NORTE SELLADA",
            line2: "Se requieren los 4 FUSIBLES para liberar el acceso."
        },
        {
            t0: 6600.0, t1: 12200.0, cps: 28, colorKind: 0,
            line1: "Las trabas magneticas bloquearon las rejas",
            line2: "de los sectores Este y Oeste del subsuelo."
        },
        {
            t0: 13100.0, t1: 18800.0, cps: 28, colorKind: 1,
            line1: "El DISYUNTOR ROJO en el sector central",
            line2: "es el unico punto para restaurar el paso."
        },
        {
            t0: 19700.0, t1: 25000.0, cps: 28, colorKind: 0,
            line1: "Sector Sur comprometido... los fusibles quedaron",
            line2: "dispersos entre la zona ritual y los depositos."
        },
        {
            t0: 26000.0, t1: 32100.0, cps: 28, colorKind: 2,
            line1: "Movimiento detectado en pasillo central.",
            line2: "No corras cerca suyo y apaga la linterna si te busca."
        },
        {
            t0: 32800.0, t1: 37200.0, cps: 32, colorKind: 2,
            line1: "NOS VIO! Apunta directo a sus ojos para frenarlo...",
            line2: "SENAL CRITICA -- CONEXION PERDIDA."
        },
        {
            t0: 40000.0, t1: 43500.0, cps: 32, colorKind: 1,
            line1: "ENLACE RESTABLECIDO. Activa el disyuntor rojo,",
            line2: "reune los 4 fusibles y escapa por el Norte."
        }
    ],

    audioCues: [
        { t: 100.0,   type: "music",  name: "ambient",       rewind: true },
        { t: 250.0,   type: "hook",   name: "vhs_static",    pan: 0, vol: 0.72 },
        { t: 6250.0,  type: "sfx",    name: "gate_locked",   pan: 0, vol: 0.80 },
        { t: 12700.0, type: "sfx",    name: "flashlight",    pan: 0, vol: 0.75 },
        { t: 19300.0, type: "rumble", ms: 120, power: 1 },
        { t: 25500.0, type: "music",  name: "chase",         rewind: true },
        { t: 28200.0, type: "sfx",    name: "heartbeat",     pan: 0, vol: 0.72 },
        { t: 32600.0, type: "hook",   name: "stalker_growl", pan: 0, vol: 0.90 },
        { t: 32650.0, type: "rumble", ms: 260, power: 1 },
        { t: 37300.0, type: "hook",   name: "vhs_static",    pan: 0, vol: 0.85 },
        { t: 38200.0, type: "music",  name: "ambient",       rewind: false }
    ]
};

// ============================================================================
// CINEMÁTICA 02: "EVACUACION - COMPUERTA NORTE" (22 segundos, 4 planos)
// Se dispara al escapar por la salida Norte con los 4 fusibles hacia STATE_WIN.
// Todas las coordenadas de cámara validadas en celdas transitables (0).
// ============================================================================
const CINEMATIC_EVAC = {
    id: "evac_subsuelo04",
    durationMs: 22000.0,
    skipHoldMs: 1000.0,
    chapterIdx: 2,
    exitOpen: true,
    cameraLabel: "CAM-01 // SALIDA NORTE",
    dateLabel: "14/10 03:41",

    keyframes: [
        // Plano 1 (0s..6.0s): Contrapicado heroico sobre la Compuerta Norte liberada por los 4 fusibles
        { t: 0.0,     x: 10.0, y: 2.95, ang: -1.5708, eyeH: 0.92, pitchY:  0.34, fov: 0.90, flashlight: true,  snap: true,  cam: "CAM-01 // SALIDA NORTE" },
        { t: 6000.0,  x: 10.0, y: 1.75, ang: -1.5708, eyeH: 1.48, pitchY:  0.06, fov: 0.94, flashlight: true,  snap: false, cam: "CAM-01 // SALIDA NORTE" },

        // Plano 2 (6.0s..12.2s): Corte a la sala central (filas 8..11 libres) — El Acechador embiste tarde
        { t: 6001.0,  x: 10.0, y: 8.35, ang:  1.5708, eyeH: 1.92, pitchY: -0.26, fov: 0.90, flashlight: true,  snap: true,  handheld: true, cam: "CAM-03 // SALA CENTRAL" },
        { t: 12200.0, x: 10.0, y: 8.65, ang:  1.5400, eyeH: 1.62, pitchY: -0.12, fov: 0.82, flashlight: true,  snap: false, handheld: true, cam: "CAM-03 // SALA CENTRAL" },

        // Plano 3 (12.2s..17.6s): Carrera final en mano hacia la compuerta abierta y golpe de luz
        { t: 12201.0, x: 10.0, y: 2.65, ang: -1.5708, eyeH: 1.44, pitchY:  0.08, fov: 0.90, flashlight: true,  snap: true,  handheld: true, cam: "CAM-01 // EVACUACION" },
        { t: 17600.0, x: 10.0, y: 1.30, ang: -1.5708, eyeH: 1.58, pitchY:  0.22, fov: 1.02, flashlight: true,  snap: false, handheld: true, cam: "CAM-01 // EVACUACION" },

        // Plano 4 (17.6s..22.0s): Cierre sobre negro con tarjeta de evacuación confirmada
        { t: 17601.0, x: 10.0, y: 1.30, ang: -1.5708, eyeH: 1.58, pitchY:  0.22, fov: 1.02, flashlight: false, snap: true,  cam: "REGISTRO CERRADO" },
        { t: 22000.0, x: 10.0, y: 1.30, ang: -1.5708, eyeH: 1.58, pitchY:  0.22, fov: 1.02, flashlight: false, snap: false, cam: "REGISTRO CERRADO" }
    ],

    titles: [
        { t0: 17800.0, t1: 21700.0, title: "EVACUACION CONFIRMADA", subtitle: "COMPUERTA NORTE SELLADA — SOBREVIVISTE", style: 2 }
    ],

    fades: [
        { t0: 0.0,     t1: 850.0,   from: 128, to: 0   },
        { t0: 17200.0, t1: 17800.0, from: 0,   to: 128 },
        { t0: 17800.0, t1: 22000.0, from: 128, to: 128 }
    ],

    flashes: [
        // Pulso verde eléctrico al completar los 4 fusibles y abrir la compuerta
        { t0: 350.0,   t1: 1150.0,  r: 65,  g: 245, b: 125, maxAlpha: 64 },
        // Corte rojo de alarma al aparecer El Acechador detrás
        { t0: 6000.0,  t1: 6450.0,  r: 235, g: 28,  b: 28,  maxAlpha: 68 },
        // Destello blanco/cian de superficie al cruzar la compuerta
        { t0: 16400.0, t1: 17450.0, r: 225, g: 245, b: 255, maxAlpha: 118 }
    ],

    vhsEffects: [
        { t0: 0.0,     t1: 1400.0,  glitch: 0.48, redBlink: 0.15, shake: 0.16, flickerFlash: 0.08 },
        { t0: 5800.0,  t1: 6400.0,  glitch: 0.65, redBlink: 0.55, shake: 0.24, flickerFlash: 0.0  },
        { t0: 6400.0,  t1: 12200.0, glitch: 0.52, redBlink: 0.92, shake: 0.44, flickerFlash: 0.34 },
        { t0: 12200.0, t1: 13000.0, glitch: 0.55, redBlink: 0.35, shake: 0.26, flickerFlash: 0.0  },
        { t0: 15500.0, t1: 17400.0, glitch: 0.32, redBlink: 0.10, shake: 0.28, flickerFlash: 0.0  }
    ],

    entities: [
        // El Acechador embiste a toda velocidad por la sala central (fila 11.4 -> 9.35) sin llegar a tiempo
        { t0: 6100.0,  t1: 12200.0, kind: "stalker", state: AI_HUNT, lookAtCam: true, x0: 9.85, y0: 11.4, x1: 10.0, y1: 9.35 }
    ],

    subtitles: [
        {
            t0: 600.0,  t1: 5700.0,  cps: 30, colorKind: 1,
            line1: "ENERGIA RESTABLECIDA // 4 DE 4 FUSIBLES",
            line2: "Trabas magneticas de la compuerta Norte liberadas."
        },
        {
            t0: 6500.0, t1: 11900.0, cps: 32, colorKind: 2,
            line1: "ALERTA DE PROXIMIDAD EN EL PASILLO CENTRAL!",
            line2: "El Acechador embiste hacia la salida... corre!"
        },
        {
            t0: 12600.0, t1: 16800.0, cps: 32, colorKind: 1,
            line1: "COMPUERTA ABIERTA // CRUCE DE SUPERFICIE",
            line2: "Dejando atras el Subsuelo 04..."
        }
    ],

    audioCues: [
        { t: 100.0,   type: "music",  name: "ambient",       rewind: false },
        { t: 350.0,   type: "sfx",    name: "breaker",       pan: 0, vol: 0.95 },
        { t: 380.0,   type: "rumble", ms: 200, power: 1 },
        { t: 2100.0,  type: "sfx",    name: "gate_locked",   pan: 0, vol: 0.78 },
        { t: 6050.0,  type: "music",  name: "chase",         rewind: true  },
        { t: 6200.0,  type: "rumble", ms: 240, power: 1 },
        { t: 7200.0,  type: "hook",   name: "stalker_growl", pan: 0, vol: 0.90 },
        { t: 12300.0, type: "music",  name: "ambient",       rewind: false },
        { t: 16500.0, type: "rumble", ms: 160, power: 1 }
    ]
};

// ============================================================================
// CINEMÁTICA 02: "CAPITULO 2 - TUNELES DE MANTENIMIENTO" (14 segundos, 3 planos)
// ============================================================================
const CINEMATIC_CH2_INTRO = {
    id: "ch2_intro_tuneles",
    chapterIdx: 1,
    durationMs: 14000.0,
    skipHoldMs: 1000.0,
    exitOpen: false,
    cameraLabel: "CAM-06 // TUNELES NIVEL -2",
    dateLabel: "14/10 02:48",

    keyframes: [
        // Plano 1 (0s..5.0s): Picado CCTV sobre el pasillo transversal de calderas (fila 9 libre)
        { t: 0.0,     x: 6.50, y: 9.50, ang:  0.0000, eyeH: 2.22, pitchY: -0.48, fov: 0.90, flashlight: true, snap: true,  cam: "CAM-06 // CALDERAS NIVEL -2" },
        { t: 5000.0,  x: 11.5, y: 9.50, ang:  0.0000, eyeH: 1.85, pitchY: -0.26, fov: 0.86, flashlight: true, snap: false, cam: "CAM-06 // CALDERAS NIVEL -2" },

        // Plano 2 (5.0s..9.8s): Cruce Sur donde espera el Operador Valdez herido (10.0, 15.5)
        { t: 5001.0,  x: 7.50, y: 15.5, ang:  0.0000, eyeH: 1.35, pitchY:  0.04, fov: 0.88, flashlight: true, snap: true,  handheld: true, cam: "CAM-07 // CRUCE SUR" },
        { t: 9800.0,  x: 8.80, y: 15.5, ang:  0.0000, eyeH: 1.45, pitchY:  0.00, fov: 0.84, flashlight: true, snap: false, handheld: true, cam: "CAM-07 // CRUCE SUR" },

        // Plano 3 (9.8s..14.0s): Match-cut al spawn del jugador en Capítulo 2 (10.0, 18.2) mirando al Norte
        { t: 9801.0,  x: 10.0, y: 18.65, ang: -1.5708, eyeH: 1.38, pitchY: -0.10, fov: 0.90, flashlight: true, snap: true,  handheld: true, cam: "ENLACE DIRECTO // CAP. 2" },
        { t: 14000.0, x: 10.0, y: 18.45, ang: -1.5708, eyeH: 1.55, pitchY:  0.00, fov: 0.90, flashlight: true, snap: false, cam: "ENLACE DIRECTO // CAP. 2" }
    ],

    titles: [
        { t0: 200.0, t1: 2400.0, title: "CAPITULO 2", subtitle: "TUNELES DE MANTENIMIENTO", style: 0 }
    ],

    fades: [
        { t0: 0.0,     t1: 2300.0,  from: 128, to: 128 },
        { t0: 2300.0,  t1: 3300.0,  from: 128, to: 0   },
        { t0: 13500.0, t1: 14000.0, from: 0,   to: 40  }
    ],

    flashes: [
        { t0: 4950.0, t1: 5250.0, r: 220, g: 230, b: 245, maxAlpha: 44 },
        { t0: 9750.0, t1: 10050.0, r: 220, g: 230, b: 245, maxAlpha: 40 }
    ],

    vhsEffects: [
        { t0: 2300.0, t1: 4200.0, glitch: 0.45, redBlink: 0.25, shake: 0.12, flickerFlash: 0.10 },
        { t0: 5000.0, t1: 9800.0, glitch: 0.24, redBlink: 0.40, shake: 0.10, flickerFlash: 0.08 }
    ],

    entities: [],

    subtitles: [
        { t0: 2500.0, t1: 5000.0, cps: 30, colorKind: 1, line1: "NIVEL -2 // TUNELES DE MANTENIMIENTO", line2: "La compuerta Norte nos llevo directo a las calderas." },
        { t0: 5400.0, t1: 9600.0, cps: 30, colorKind: 0, line1: "VALDEZ (RADIO): Estoy en el cruce Sur, herido.", line2: "Acercate con cuidado y usa [L2] para lanzar senuelos." },
        { t0: 10200.0, t1: 13600.0, cps: 32, colorKind: 1, line1: "OBJETIVO: Habla con Valdez, activa la valvula", line2: "central y junta los 4 fusibles hacia Contencion." }
    ],

    audioCues: [
        { t: 100.0,  type: "music",  name: "ambient", rewind: false },
        { t: 250.0,  type: "hook",   name: "vhs_static", pan: 0, vol: 0.65 },
        { t: 5100.0, type: "rumble", ms: 110, power: 1 }
    ]
};

// ============================================================================
// CINEMÁTICA 03: "CAPITULO 3 - PABELLON DE CONTENCION" (14 segundos, 3 planos)
// ============================================================================
const CINEMATIC_CH3_INTRO = {
    id: "ch3_intro_contencion",
    chapterIdx: 2,
    durationMs: 14000.0,
    skipHoldMs: 1000.0,
    exitOpen: false,
    cameraLabel: "CAM-09 // PABELLON CONTENCION",
    dateLabel: "14/10 03:19",

    keyframes: [
        // Plano 1 (0s..5.2s): Cámara alta sobre el corredor central ritual (fila 10 libre)
        { t: 0.0,     x: 6.50, y: 10.5, ang:  0.0000, eyeH: 2.24, pitchY: -0.52, fov: 0.90, flashlight: true, snap: true,  cam: "CAM-09 // CAMARA DE CONTENCION" },
        { t: 5200.0,  x: 12.5, y: 10.5, ang:  0.0000, eyeH: 1.92, pitchY: -0.30, fov: 0.86, flashlight: true, snap: false, cam: "CAM-09 // CAMARA DE CONTENCION" },

        // Plano 2 (5.2s..9.8s): Contrapicado tenso con El Acechador patrullando el pabellón
        { t: 5201.0,  x: 6.50, y: 5.50, ang:  0.0000, eyeH: 0.94, pitchY:  0.26, fov: 0.88, flashlight: true, snap: true,  handheld: true, cam: "CAM-10 // SECTOR NORTE" },
        { t: 9800.0,  x: 7.40, y: 5.50, ang:  0.0200, eyeH: 1.02, pitchY:  0.22, fov: 0.82, flashlight: true, snap: false, handheld: true, cam: "CAM-10 // SECTOR NORTE" },

        // Plano 3 (9.8s..14.0s): Match-cut al spawn del jugador en Capítulo 3 (10.0, 18.2)
        { t: 9801.0,  x: 10.0, y: 18.60, ang: -1.5708, eyeH: 1.38, pitchY: -0.10, fov: 0.90, flashlight: true, snap: true,  handheld: true, cam: "ENLACE DIRECTO // CAP. 3" },
        { t: 14000.0, x: 10.0, y: 18.45, ang: -1.5708, eyeH: 1.55, pitchY:  0.00, fov: 0.90, flashlight: true, snap: false, cam: "ENLACE DIRECTO // CAP. 3" }
    ],

    titles: [
        { t0: 200.0, t1: 2400.0, title: "CAPITULO 3", subtitle: "PABELLON DE CONTENCION", style: 1 }
    ],

    fades: [
        { t0: 0.0,     t1: 2300.0,  from: 128, to: 128 },
        { t0: 2300.0,  t1: 3300.0,  from: 128, to: 0   },
        { t0: 13500.0, t1: 14000.0, from: 0,   to: 40  }
    ],

    flashes: [
        { t0: 5150.0, t1: 5500.0, r: 235, g: 28, b: 28, maxAlpha: 64 },
        { t0: 9750.0, t1: 10050.0, r: 220, g: 230, b: 245, maxAlpha: 44 }
    ],

    vhsEffects: [
        { t0: 2300.0, t1: 5200.0, glitch: 0.42, redBlink: 0.45, shake: 0.14, flickerFlash: 0.14 },
        { t0: 5200.0, t1: 9800.0, glitch: 0.68, redBlink: 0.88, shake: 0.34, flickerFlash: 0.32 }
    ],

    entities: [
        { t0: 5300.0, t1: 9800.0, kind: "stalker", state: AI_HUNT, lookAtCam: true, x0: 13.5, y0: 5.5, x1: 10.2, y1: 5.5 }
    ],

    subtitles: [
        { t0: 2500.0, t1: 5100.0, cps: 30, colorKind: 2, line1: "PABELLON DE CONTENCION // ORIGEN DEL SUJETO 04", line2: "Aqui es donde inicio el experimento." },
        { t0: 5500.0, t1: 9600.0, cps: 32, colorKind: 2, line1: "DRA. MORALES (RADIO): Esta en su territorio!", line2: "Usa los escondites [X] y apaga la luz si se acerca." },
        { t0: 10200.0, t1: 13600.0, cps: 32, colorKind: 1, line1: "OBJETIVO FINAL: Libera el nucleo, junta los 4", line2: "fusibles y alcanza el ascensor a la superficie." }
    ],

    audioCues: [
        { t: 100.0,  type: "music",  name: "ambient", rewind: false },
        { t: 5250.0, type: "music",  name: "chase",   rewind: true  },
        { t: 5300.0, type: "rumble", ms: 220, power: 1 },
        { t: 9800.0, type: "music",  name: "ambient", rewind: false }
    ]
};

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
let hkLogoDrawFailed = false;
let splashTick = 0;
// Algunos objetos nativos (Image, RenderData, RenderObject) llegan SIN prototipo en este runtime
// (Object.getPrototypeOf(obj) === null), por lo que no tienen draw()/render() ni sus setters.
// Se les reconecta el prototipo de su clase justo despues de crearlos y antes de asignar
// propiedades. Si el objeto ya tiene su prototipo correcto, no hace nada.
function hkFixProto(obj, Cls) {
    if (!obj) return obj;
    try {
        if (typeof Cls === "function" && Cls.prototype && Object.getPrototypeOf(obj) !== Cls.prototype) {
            Object.setPrototypeOf(obj, Cls.prototype);
        }
    } catch (_) {}
    return obj;
}

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
                hkFixProto(hkLogoImg, Image);
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
        try {
            hkLogoImg.color = rgba(255, 255, 255, alpha);
            hkLogoImg.draw(lx, ly);
        } catch (_) {
            hkLogoDrawFailed = true;
        }
    }
    if (!hkLogoImg || hkLogoDrawFailed) {
        fnt.scale = Math.fround(1.10);
        fnt.color = rgba(245, 210, 120, alpha);
        fnt.print((screenW >> 1) - 150, (screenH >> 1) - 30, "HK ENTERTAINMENT");
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
const STATE_CINEMATIC       = 14;
const STATE_CINEMATICS_MENU = 15;

let gameState = STATE_SPLASH;
let pendingCinematicSeq = null;
let pendingCinematicNext = STATE_PLAY;

function getChapterIntroCinematic(chapterIdx) {
    if (chapterIdx === 1) return CINEMATIC_CH2_INTRO;
    if (chapterIdx === 2) return CINEMATIC_CH3_INTRO;
    return CINEMATIC_INTRO;
}

function startCinematicWithLoading(sequence, nextState) {
    const chIdx = (sequence && sequence.chapterIdx !== undefined) ? sequence.chapterIdx : 0;
    if (activeChapterIdx !== chIdx || hwLoadedChapterIdx !== chIdx) {
        resetGame(chIdx);
        prepareChapter3D(chIdx);
    }
    pendingCinematicSeq = sequence;
    pendingCinematicNext = nextState;
    if (GAME_SETTINGS.qualityIndex === 0 && !hwStreamDone && !hwStreamFailed) {
        mapLoadPhase = 0;
        switchState(STATE_MAP_LOADING);
    } else {
        if (hw3dReady) buildHwEntityTransforms();
        pendingCinematicSeq = null;
        startCinematic(sequence, nextState);
    }
}

function startChapter(chapterIdx, playIntro = true) {
    const need3DReload = (hwLoadedChapterIdx !== chapterIdx);
    resetGame(chapterIdx);
    if (need3DReload) prepareChapter3D(chapterIdx);
    const shouldPlayIntro = !!playIntro && !GAME_SETTINGS.skipIntro;
    pendingCinematicSeq = shouldPlayIntro ? getChapterIntroCinematic(chapterIdx) : null;
    pendingCinematicNext = STATE_PLAY;
    if (GAME_SETTINGS.qualityIndex === 0 && !hwStreamDone && !hwStreamFailed) {
        mapLoadPhase = 0;
        switchState(STATE_MAP_LOADING);
    } else {
        if (hw3dReady) buildHwEntityTransforms();
        if (pendingCinematicSeq) {
            const seq = pendingCinematicSeq;
            const nextSt = pendingCinematicNext;
            pendingCinematicSeq = null;
            startCinematic(seq, nextSt);
        } else {
            switchState(STATE_PLAY);
        }
    }
}

function startPlayWithLoading(playIntro = false) {
    startChapter(0, playIntro);
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
let cinematicsCursor = 0;
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
let playerVelX = toF64(0.0);
let playerVelY = toF64(0.0);
let playerTurnVel = toF64(0.0);
let camShake = toF64(0.0);
let camBreathPhase = toF64(0.0);
let quickTurnRem = toF64(0.0);
let playerDecoys = 1;
let decoyCooldown = 0;
let activeRadioTriggers = [];
let activeInteractEnt = null;
let activeInteractLabel = "";
let activeInteractIsExit = false;
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
    nextNodeY: toF64(10.0),
    animPhase: toF64(0.0),
    animSpasmPhase: toF64(0.0),
    animPrevX: toF64(10.0),
    animPrevY: toF64(15.5),
    animSpeed: toF64(0.0),
    animYaw: toF64(0.0),
    animYawInit: false,
    animOutY: toF64(0.0),
    animOutRx: toF64(0.0),
    animOutRy: toF64(0.0),
    animOutRz: toF64(0.0)
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
    if (nextState !== STATE_PLAY && nextState !== STATE_JUMPSCARE && nextState !== STATE_CINEMATIC) {
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

function resetGame(chapterIdx) {
    activeChapterIdx = (chapterIdx !== undefined) ? chapterIdx : 0;
    const ch = getActiveChapter();
    worldGrid = createWorldGrid(activeChapterIdx);
    breakerActive = false;
    fusesCollected = 0;
    collectedNotes = [false, false, false, false, false, false, false, false];
    notesFoundCount = 0;
    if (activeChapterIdx === 0) elapsedMs = 0;
    mapOpen = false;
    mapAnim = toF64(0.0);
    currentFov = toF64(0.90);
    flashlightWarmup = toF64(0.25);
    exhausted = false;
    bumpCooldown = 0;
    playerVelX = toF64(0.0);
    playerVelY = toF64(0.0);
    playerTurnVel = toF64(0.0);
    camShake = toF64(0.0);
    camBreathPhase = toF64(0.0);
    quickTurnRem = toF64(0.0);
    playerDecoys = 1;
    decoyCooldown = 0;
    activeInteractEnt = null;
    activeInteractLabel = "";
    activeInteractIsExit = false;
    flashTint.alpha = 0;
    introFade = 124;
    popupTimer = 0;
    endCursor = 0;
    pauseCursor = 0;

    const isNightmare = GAME_SETTINGS.difficulty === 1;

    player.x = toF64(ch.playerSpawn.x);
    player.y = toF64(ch.playerSpawn.y);
    player.ang = toF64(ch.playerSpawn.ang);
    player.eyeH = toF64(WORLD_EYE_H);
    player.pitchY = toF64(0.0);
    player.crouched = false;
    player.hiding = false;
    player.hideReturnX = player.x;
    player.hideReturnY = player.y;
    player.bobPhase = toF64(0.0);
    player.battery = toF64(isNightmare ? 85.0 : 100.0);
    player.flashlightOn = true;
    player.stamina = toF64(100.0);

    stalker.x = toF64(ch.stalkerSpawn.x);
    stalker.y = toF64(ch.stalkerSpawn.y);
    stalker.baseSpeed = toF64(isNightmare ? ch.stalkerSpawn.speedNightmare : ch.stalkerSpawn.speedNormal);
    stalker.state = AI_PATROL;
    stalker.targetX = toF64(10.0);
    stalker.targetY = toF64(10.0);
    stalker.alertTimer = 0;
    stalker.chaseIntroMs = 0.0;
    stalker.wpIdx = 0;
    stalker.hasNextNode = false;
    resetStalkerAnim(stalker, stalker.x, stalker.y);

    entities = [];
    for (let i = 0; i < ch.entities.length; i++) {
        const src = ch.entities[i];
        entities.push({
            kind: src.kind,
            x: toF64(src.x),
            y: toF64(src.y),
            msgIdx: src.msgIdx,
            faceAng: src.faceAng,
            name: src.name,
            dialog: src.dialog,
            spoken: false,
            taken: false
        });
    }

    activeRadioTriggers = [];
    for (let i = 0; i < ch.radioTriggers.length; i++) {
        const rt = ch.radioTriggers[i];
        activeRadioTriggers.push({
            x: toF64(rt.x),
            y: toF64(rt.y),
            radiusSq: toF64(rt.radius * rt.radius),
            text: rt.text,
            duration: rt.duration,
            fired: false
        });
    }

    showPopup(ch.title, 100);
    showRadio(ch.objectiveBreaker, 210);
    if (hw3dReady) buildHwEntityTransforms();
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
                if (pendingCinematicSeq) {
                    const seq = pendingCinematicSeq;
                    const nextSt = pendingCinematicNext;
                    pendingCinematicSeq = null;
                    startCinematic(seq, nextSt);
                } else {
                    switchState(STATE_PLAY);
                }
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
                if (pendingCinematicSeq) {
                    const seq = pendingCinematicSeq;
                    const nextSt = pendingCinematicNext;
                    pendingCinematicSeq = null;
                    startCinematic(seq, nextSt);
                } else {
                    switchState(STATE_PLAY);
                }
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

        // Cinemática in-engine (INTRO -> CINEMATIC -> GAMEPLAY) sin carga de recursos
        if (gameState === STATE_CINEMATIC) {
            if (isPadDisconnected()) {
                triggerRumble(0, 0);
                render3DWorld(SCREEN_W, SCREEN_H, worldGrid, cinCamera, cinStalker, entities, 0.0, frameTick, false, cinState.fov, cinState.flashIntensity, 1.0, 0.0);
                drawPadDisconnectedOverlay(SCREEN_W, SCREEN_H, fnt);
                return;
            }
            updateAndRenderCinematic(SCREEN_W, SCREEN_H, dtMs, dtScale, frameTick, pad, fnt);
            return;
        }

        if (gameState === STATE_PLAY && isPadDisconnected()) {
            triggerRumble(0, 0);
            render3DWorld(SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities, 0.0, frameTick, fusesCollected === 4, currentFov, flashlightWarmup, mapAnim, 0.0);
            drawPadDisconnectedOverlay(SCREEN_W, SCREEN_H, fnt);
            return;
        }

        if (gameState === STATE_TITLE) {
            if (GAME_SETTINGS.qualityIndex === 0 && hwLoadedChapterIdx < 0) {
                prepareChapter3D(0);
            }
            if (!hwStreamDone && !hwStreamFailed) {
                tickProgressive3DStream();
                if (hw3dReady && hwEntityTransforms.length === 0) buildHwEntityTransforms();
            }
            player.x = toF64(10.0);
            player.y = toF64(10.5);
            player.eyeH = toF64(1.62 + Math.sin(frameTick * 0.015) * 0.05);
            player.pitchY = toF64(-0.08);
            player.flashlightOn = true;
            player.battery = toF64(100.0);
            player.ang = toF64(frameTick * 0.0022);
            render3DWorld(SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities, 0.22, frameTick, false, 0.90, 1.0, 1.0, 0.0);
            drawTitleMenu(SCREEN_W, SCREEN_H, titleCursor, frameTick, fnt);

            const nav = readMenuDir();
            if (nav.dy !== 0) { titleCursor = (titleCursor + nav.dy + 6) % 6; playSfx("ui_move", 0, 0.7); }
            if (titleCursor === 0 && nav.dx !== 0) {
                GAME_SETTINGS.difficulty = (GAME_SETTINGS.difficulty + 1) & 1;
            }
            if (pad.justPressed(Pads.CROSS) || pad.justPressed(Pads.START)) {
                playSfx("ui_select", 0, 0.85);
                if (titleCursor === 0) {
                    startPlayWithLoading(true);
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
                } else if (titleCursor === 5) {
                    returnState = STATE_TITLE;
                    cinematicsCursor = 0;
                    switchState(STATE_CINEMATICS_MENU);
                }
            }
        } else if (gameState === STATE_OPTIONS) {
            render3DWorld(SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities, 0.10, frameTick, fusesCollected === 4, currentFov, flashlightWarmup, 1.0, 0.0);
            if (saveFeedbackTimer > 0) saveFeedbackTimer--;
            drawOptionsMenu(SCREEN_W, SCREEN_H, optionsCursor, saveFeedbackTimer, fnt);

            const nav = readMenuDir();
            if (nav.dy !== 0) { optionsCursor = (optionsCursor + nav.dy + 10) % 10; playSfx("ui_move", 0, 0.7); }

            const adjust = nav.dx !== 0 ? nav.dx : (pad.justPressed(Pads.CROSS) && optionsCursor < 9 ? 1 : 0);
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
                } else if (optionsCursor === 8) {
                    GAME_SETTINGS.skipIntro = !GAME_SETTINGS.skipIntro;
                }
            }

            if (pad.justPressed(Pads.CROSS) && optionsCursor === 9) {
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
            if (returnState === STATE_TITLE && pad.justPressed(Pads.TRIANGLE)) {
                playSfx("ui_select", 0, 0.85);
                startCinematicWithLoading(CINEMATIC_INTRO, STATE_LORE);
                return;
            }
            if (pad.justPressed(Pads.CROSS) || pad.justPressed(Pads.CIRCLE) || pad.justPressed(Pads.START)) {
                switchState(returnState);
            }
        } else if (gameState === STATE_CREDITS) {
            render3DWorld(SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities, 0.10, frameTick, false, 0.90, 1.0, 1.0, 0.0);
            drawCreditsMenu(SCREEN_W, SCREEN_H, MODE_INFO, fnt);
            if (pad.justPressed(Pads.CROSS) || pad.justPressed(Pads.CIRCLE) || pad.justPressed(Pads.START)) {
                switchState(returnState);
            }
        } else if (gameState === STATE_CINEMATICS_MENU) {
            render3DWorld(SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities, 0.10, frameTick, false, 0.90, 1.0, 1.0, 0.0);
            drawCinematicsMenu(SCREEN_W, SCREEN_H, cinematicsCursor, fnt);
            const nav = readMenuDir();
            if (nav.dy !== 0) {
                cinematicsCursor = (cinematicsCursor + nav.dy + CINEMATIC_MENU_ITEMS.length) % CINEMATIC_MENU_ITEMS.length;
                playSfx("ui_move", 0, 0.7);
            }
            if (pad.justPressed(Pads.CROSS) || pad.justPressed(Pads.START)) {
                playSfx("ui_select", 0, 0.85);
                if (cinematicsCursor === 0) {
                    startCinematicWithLoading(CINEMATIC_INTRO, STATE_CINEMATICS_MENU);
                    return;
                } else if (cinematicsCursor === 1) {
                    startCinematicWithLoading(CINEMATIC_CH2_INTRO, STATE_CINEMATICS_MENU);
                    return;
                } else if (cinematicsCursor === 2) {
                    startCinematicWithLoading(CINEMATIC_CH3_INTRO, STATE_CINEMATICS_MENU);
                    return;
                } else if (cinematicsCursor === 3) {
                    startCinematicWithLoading(CINEMATIC_EVAC, STATE_CINEMATICS_MENU);
                    return;
                } else {
                    switchState(STATE_TITLE);
                }
            } else if (pad.justPressed(Pads.CIRCLE)) {
                switchState(STATE_TITLE);
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
                    if (typeof Screen.getMemoryStats === "function" &&
                        typeof Screen.VRAM_USED_TOTAL !== "undefined" && typeof Screen.VRAM_SIZE !== "undefined") {
                        const used = Screen.getMemoryStats(Screen.VRAM_USED_TOTAL) | 0;
                        const total = Screen.getMemoryStats(Screen.VRAM_SIZE) | 0;
                        freeKb = Math.max(0, ((total - used) / 1024) | 0);
                    } else if (typeof Screen.getFreeVRAM === "function") {
                        const used = Screen.getFreeVRAM() | 0;
                        freeKb = Math.max(0, ((4 * 1024 * 1024 - used) / 1024) | 0);
                    }
                } catch (_) {}
                hwVramLabel = ["F:", String(hwPlayFrameCount), " VRAM L:", String(freeKb), "KB"].join("");
            }
            tickProgressive3DStream();

            if (pad.justPressed(Pads.START)) {
                pauseCursor = 0;
                switchState(STATE_PAUSE);
                return;
            }
            if (pad.justPressed(Pads.SELECT)) {
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
            if (!player.hiding && pad.justPressed(Pads.SQUARE)) {
                player.crouched = !player.crouched;
            }
            if (decoyCooldown > 0) decoyCooldown--;
            if (!player.hiding && pad.justPressed(Pads.L2) && decoyCooldown === 0) {
                if (playerDecoys > 0) {
                    playerDecoys--;
                    decoyCooldown = 45;
                    const tDirX = toF64(Math.cos(player.ang));
                    const tDirY = toF64(Math.sin(player.ang));
                    let tx = player.x;
                    let ty = player.y;
                    for (let s = 1; s <= 10; s++) {
                        const cx = fadd(player.x, tDirX * (s * 0.5));
                        const cy = fadd(player.y, tDirY * (s * 0.5));
                        if (!isPosWalkable(worldGrid, cx, cy, 0.25)) break;
                        tx = cx;
                        ty = cy;
                    }
                    alertStalkerToNoise(stalker, tx, ty, GAME_SETTINGS.difficulty);
                    playSfx("pickup", 0, 0.9);
                    triggerRumble(80, 1);
                    triggerScreenFlash(90, 215, 255, 34);
                    showPopup("SENUELO LANZADO");
                    showRadio("DISTRACCION: El Acechador se dirige al ruido del senuelo.", 160);
                } else {
                    showPopup("SIN SENUELOS");
                }
            }

            if (mapOpen) mapAnim = toF64(Math.min(1.0, fadd(mapAnim, 0.11 * dtScale)));
            else mapAnim = toF64(Math.max(0.0, mapAnim - 0.13 * dtScale));

            if ((flashlightWarmup - 1.0) < 0) {
                flashlightWarmup = toF64(Math.min(1.0, fadd(flashlightWarmup, 0.14 * dtScale)));
            }

            // Gamefeel: altura base suave + respiración orgánica + headbob + sacudida de impacto
            const baseEyeTarget = player.hiding ? toF64(1.18) : (player.crouched ? toF64(1.02) : toF64(WORLD_EYE_H));
            const curEyeBase = toF64(player.eyeBase !== undefined ? player.eyeBase : WORLD_EYE_H);
            player.eyeBase = fadd(curEyeBase, (baseEyeTarget - curEyeBase) * Math.min(1.0, 0.22 * dtScale));
            const breathRate = exhausted ? 0.14 : (player.hiding ? 0.09 : 0.045);
            camBreathPhase = fadd(camBreathPhase, toF64(breathRate * dtScale));
            if ((camShake - 0.005) > 0) {
                camShake = toF64(Math.max(0.0, camShake - 0.032 * dtScale));
            } else {
                camShake = toF64(0.0);
            }

            let fwd = F64_ZERO, strafe = F64_ZERO;
            const lx = toF64((pad.lx || 0) / 128.0);
            const ly = toF64((pad.ly || 0) / 128.0);
            if ((Math.abs(ly) - STICK_DEADZONE) > 0) fwd = -ly;
            if ((Math.abs(lx) - STICK_DEADZONE) > 0) strafe = lx;
            if (pad.pressed(Pads.UP)) fwd = toF64(1.0);
            if (pad.pressed(Pads.DOWN)) fwd = toF64(-1.0);
            if (pad.pressed(Pads.LEFT)) strafe = toF64(-1.0);
            if (pad.pressed(Pads.RIGHT)) strafe = toF64(1.0);

            if (!player.hiding && (fwd - (-0.5)) < 0 && pad.justPressed(Pads.CIRCLE) && (quickTurnRem - 0.01) <= 0) {
                quickTurnRem = toF64(Math.PI);
            }
            if ((quickTurnRem - 0.01) > 0) {
                // Curva ease-out para giro 180° suave y firme
                const qtStep = Math.min(quickTurnRem, toF64(Math.max(0.11, quickTurnRem * 0.24) * dtScale));
                player.ang = fadd(player.ang, qtStep);
                quickTurnRem = quickTurnRem - qtStep;
                playerTurnVel = toF64(0.0);
            } else {
                const rx = toF64((pad.rx || 0) / 128.0);
                const baseTurn = toF64(SENS_TURN_SPEED[GAME_SETTINGS.sensitivityIndex] || 0.052);
                const turnSpeed = mapOpen || player.hiding ? (baseTurn * 0.55) : baseTurn;
                let tgtTurn = toF64(0.0);
                if ((Math.abs(rx) - STICK_DEADZONE) > 0) tgtTurn = rx * turnSpeed;
                if (pad.pressed(Pads.L1)) tgtTurn = tgtTurn - turnSpeed;
                if (pad.pressed(Pads.R1)) tgtTurn = fadd(tgtTurn, turnSpeed);
                playerTurnVel = fadd(playerTurnVel, (tgtTurn - playerTurnVel) * Math.min(1.0, 0.36 * dtScale));
                player.ang = fadd(player.ang, playerTurnVel * dtScale);
            }
            if ((player.ang - Math.PI) > 0) player.ang = player.ang - Math.PI * 2.0;
            else if ((player.ang - (-Math.PI)) < 0) player.ang = fadd(player.ang, Math.PI * 2.0);

            const isMovingInput = !player.hiding && (((Math.abs(fwd) - 0.05) > 0) || ((Math.abs(strafe) - 0.05) > 0));
            const wantSprint = !player.hiding && pad.pressed(Pads.CIRCLE) && (fwd - (-0.3)) > 0 && isMovingInput && !mapOpen;
            if (wantSprint && player.crouched) player.crouched = false;
            const isSprinting = wantSprint && !exhausted && ((player.stamina - 2.0) > 0);

            if (isSprinting) {
                player.stamina = toF64(Math.max(0.0, player.stamina - 0.45 * dtScale));
                if ((player.stamina - 2.0) <= 0) exhausted = true;
            } else {
                player.stamina = toF64(Math.min(100.0, fadd(player.stamina, (exhausted ? 0.18 : 0.26) * dtScale)));
                if (exhausted && ((player.stamina - 32.0) >= 0)) exhausted = false;
            }

            currentFov = toF64(0.90);

            const targetSpeed = player.hiding ? 0.0 : (isSprinting ? 0.082 : (player.crouched ? 0.028 : (mapOpen ? 0.032 : 0.048)));
            const dirX = toF64(Math.cos(player.ang));
            const dirY = toF64(Math.sin(player.ang));
            const tgtVx = (dirX * fwd - dirY * strafe) * targetSpeed;
            const tgtVy = fadd(dirY * fwd, dirX * strafe) * targetSpeed;
            const accel = Math.min(1.0, (isMovingInput ? 0.26 : 0.30) * dtScale);
            playerVelX = fadd(playerVelX, (tgtVx - playerVelX) * accel);
            playerVelY = fadd(playerVelY, (tgtVy - playerVelY) * accel);
            const dx = playerVelX * dtScale;
            const dy = playerVelY * dtScale;
            const isMoving = !player.hiding && (((Math.abs(playerVelX) - 0.006) > 0) || ((Math.abs(playerVelY) - 0.006) > 0));

            let bumpedGate = false;
            if (!player.hiding) {
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
            }
            if (bumpCooldown > 0) bumpCooldown--;
            if (bumpedGate && bumpCooldown === 0) {
                bumpCooldown = 60;
                playSfx("gate_locked", 0, 0.9);
                camShake = toF64(0.45);
                triggerRumble(110, 1);
                triggerScreenFlash(200, 60, 20, 42);
                showRadio("REJA BLOQUEADA: Activa el disyuntor central para liberar el paso.", 160);
            }

            if (isMoving) {
                const prevStepCycle = (player.bobPhase / 3.14159) | 0;
                player.bobPhase = fadd(player.bobPhase, (isSprinting ? 0.28 : (player.crouched ? 0.10 : 0.16)) * dtScale);
                const curStepCycle = (player.bobPhase / 3.14159) | 0;
                if (curStepCycle !== prevStepCycle && !player.crouched) {
                    playSfx("step", (curStepCycle & 1) ? -18 : 18, isSprinting ? 0.85 : 0.55);
                }
            }

            const batDrain = GAME_SETTINGS.difficulty === 1 ? 0.024 : 0.018;
            if (player.flashlightOn && ((player.battery - 0.0) > 0)) {
                player.battery = toF64(Math.max(0.0, player.battery - batDrain * dtScale));
            }

            if ((frameTick % 10) === 0) {
                for (let i = 0; i < activeRadioTriggers.length; i++) {
                    const rt = activeRadioTriggers[i];
                    if (rt.fired) continue;
                    const rdx = player.x - rt.x;
                    const rdy = player.y - rt.y;
                    if (((rdx * rdx - (-(rdy * rdy))) - rt.radiusSq) < 0) {
                        rt.fired = true;
                        showRadio(rt.text, rt.duration);
                    }
                }
            }

            activeInteractEnt = null;
            activeInteractLabel = "";
            activeInteractIsExit = false;

            if (player.hiding) {
                activeInteractLabel = "[X] SALIR DEL ESCONDITE";
                if (pad.justPressed(Pads.CROSS)) {
                    player.hiding = false;
                    player.x = player.hideReturnX;
                    player.y = player.hideReturnY;
                    playSfx("ui_select", 0, 0.7);
                }
            } else {
                let bestDistSq = toF64(1.85);
                for (let i = 0; i < entities.length; i++) {
                    const e = entities[i];
                    if (e.taken) continue;
                    const edx = player.x - toF64(e.x);
                    const edy = player.y - toF64(e.y);
                    const d2 = edx * edx - (-(edy * edy));
                    if ((d2 - bestDistSq) < 0) {
                        bestDistSq = d2;
                        activeInteractEnt = e;
                    }
                }
                if (fusesCollected === 4 && ((player.y - 1.85) < 0) && ((player.x - 8.2) > 0) && ((player.x - 11.8) < 0)) {
                    activeInteractIsExit = true;
                    activeInteractLabel = (activeChapterIdx < CHAPTERS.length - 1)
                        ? "[X] ABRIR COMPUERTA AL SIGUIENTE SECTOR"
                        : "[X] ACTIVAR ASCENSOR Y ESCAPAR";
                } else if (activeInteractEnt) {
                    const k = activeInteractEnt.kind;
                    if (k === "fuse") activeInteractLabel = "[X] TOMAR FUSIBLE";
                    else if (k === "battery") activeInteractLabel = "[X] TOMAR BATERIA (+45%)";
                    else if (k === "breaker") activeInteractLabel = "[X] ACTIVAR DISYUNTOR CENTRAL";
                    else if (k === "note") activeInteractLabel = "[X] LEER REGISTRO";
                    else if (k === "decoy") activeInteractLabel = "[X] TOMAR SENUELO";
                    else if (k === "locker") activeInteractLabel = "[X] ESCONDERSE";
                    else if (k === "npc") activeInteractLabel = "[X] HABLAR CON VALDEZ";
                }

                if (pad.justPressed(Pads.CROSS)) {
                    if (activeInteractIsExit) {
                        if (activeChapterIdx < CHAPTERS.length - 1) {
                            const nextCh = activeChapterIdx + 1;
                            if (RECORDS.maxChapterUnlocked < (nextCh + 1)) {
                                RECORDS.maxChapterUnlocked = nextCh + 1;
                                saveGameData();
                            }
                            playSfx("breaker", 0, 0.95);
                            triggerRumble(180, 1);
                            startChapter(nextCh, true);
                            return;
                        } else {
                            recordEscape((elapsedMs / 1000) | 0, GAME_SETTINGS.difficulty);
                            endCursor = 0;
                            startCinematic(CINEMATIC_EVAC, STATE_WIN);
                            return;
                        }
                    } else if (activeInteractEnt) {
                        const e = activeInteractEnt;
                        if (e.kind === "locker") {
                            player.hiding = true;
                            player.crouched = false;
                            player.hideReturnX = player.x;
                            player.hideReturnY = player.y;
                            player.x = toF64(e.x);
                            player.y = toF64(e.y);
                            if (e.faceAng !== undefined) player.ang = toF64(e.faceAng);
                            playerVelX = toF64(0.0);
                            playerVelY = toF64(0.0);
                            playSfx("ui_select", 0, 0.75);
                            showPopup("ESCONDIDO");
                        } else if (e.kind === "npc") {
                            playSfx("ui_select", 0, 0.85);
                            e.spoken = true;
                            showPopup(e.name || "SOBREVIVIENTE");
                            showRadio(e.dialog || "VALDEZ: Sigue adelante, no te detengas.", 260);
                        } else {
                            e.taken = true;
                            if (e.kind === "fuse") {
                                fusesCollected++;
                                playSfx("pickup", 0, 0.95);
                                stalker.baseSpeed = fadd(stalker.baseSpeed, 0.0025);
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
                            } else if (e.kind === "decoy") {
                                playerDecoys = Math.min(3, playerDecoys + 1);
                                playSfx("pickup", 0, 0.85);
                                triggerScreenFlash(90, 215, 255, 42);
                                triggerRumble(80, 1);
                                showPopup("+1 SENUELO [L2]");
                                showRadio("SENUELO RECOLECTADO: Pulsa [L2] para desviar al Acechador.", 170);
                            } else if (e.kind === "breaker") {
                                breakerActive = true;
                                playSfx("breaker", 0, 1.0);
                                for (let gy = 0; gy < worldGrid.length; gy++) {
                                    for (let gx = 0; gx < worldGrid[gy].length; gx++) {
                                        if (worldGrid[gy][gx] === 5) worldGrid[gy][gx] = 0;
                                    }
                                }
                                camShake = toF64(0.65);
                                triggerScreenFlash(60, 255, 110, 62);
                                triggerRumble(210, 1);
                                showPopup("REJAS DESBLOQUEADAS");
                                showRadio("DISYUNTOR ACTIVADO: Se abrieron las rejas de seguridad!", 240);
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
                }
            }

            const ai = updateStalkerAI(stalker, worldGrid, player, isSprinting, isMoving, frameTick, dtScale, GAME_SETTINGS.difficulty, dtMs, player.crouched, player.hiding);
            updateStalkerAnim(stalker, player.x, player.y, dtScale, ai.los, ai.blinded);
            const dangerRatio = toF64(Math.max(0.0, Math.min(1.0, (7.0 - toF64(ai.distP)) / 7.0)));

            if (ai.chaseIntroStarted) {
                setMusicTrack("chase", true);
                camShake = toF64(0.55);
                showPopup("TE HA DETECTADO...", 120);
                showRadio("ALGO SE ACERCA... PREPARATE PARA CORRER!", 260);
                triggerScreenFlash(160, 20, 25, 36);
            } else if (ai.chaseHuntStarted) {
                setMusicTrack("chase", false);
                camShake = toF64(0.85);
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

            // Aplicar headbob, respiración orgánica, cabeceo sutil y sacudida de impacto
            const bobAmp = isMoving ? (isSprinting ? 0.058 : (player.crouched ? 0.015 : 0.032)) : 0.0;
            const headBobY = GAME_SETTINGS.bob ? (Math.sin(player.bobPhase * 2.0) * bobAmp) : 0.0;
            const breathAmp = exhausted ? 0.024 : (0.010 + dangerRatio * 0.016);
            const breathY = Math.sin(camBreathPhase) * breathAmp;
            let shkY = 0.0;
            let shkPitch = 0.0;
            const totalShake = Math.max(camShake, (dangerRatio - 0.55) > 0 ? (dangerRatio - 0.55) * 0.45 : 0.0);
            if ((totalShake - 0.01) > 0) {
                shkY = ((cinHashByte(frameTick * 7 + 13) - 128) / 128.0) * 0.055 * totalShake;
                shkPitch = ((cinHashByte(frameTick * 11 + 29) - 128) / 128.0) * 0.14 * totalShake;
            }
            player.eyeH = clampF64(fadd(fadd(player.eyeBase, headBobY + breathY), shkY), 0.75, 2.05);
            player.pitchY = fadd(headBobY * 1.4, shkPitch);

            // Parpadeo sutil de linterna cuando queda poca batería (< 20%)
            let effFlashWarm = flashlightWarmup;
            if (player.flashlightOn && ((player.battery - 20.0) < 0) && ((player.battery - 0.0) > 0)) {
                if (cinHashByte(frameTick * 5 + 17) < 28) effFlashWarm = toF64(0.32);
            }

            render3DWorld(
                SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities,
                dangerRatio, frameTick, fusesCollected === 4, currentFov,
                effFlashWarm, mapAnim, ai.sideBias
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

            if (player.hiding) {
                Draw.rect(0, 0, SCREEN_W, 92, rgba(0, 0, 0, 118));
                Draw.rect(0, SCREEN_H - 92, SCREEN_W, 92, rgba(0, 0, 0, 118));
                Draw.rect(0, 92, 68, SCREEN_H - 184, rgba(0, 0, 0, 112));
                Draw.rect(SCREEN_W - 68, 92, 68, SCREEN_H - 184, rgba(0, 0, 0, 112));
            }

            // Retícula central sutil (se ilumina en dorado cuando hay interacción [X])
            if (!mapOpen && !player.hiding) {
                const cx = SCREEN_W >> 1;
                const cy = SCREEN_H >> 1;
                if (activeInteractLabel.length > 0) {
                    const rCol = rgba(250, 218, 100, 118);
                    Draw.rect(cx - 1, cy - 1, 3, 3, rCol);
                    Draw.rect(cx - 10, cy - 5, 2, 10, rCol);
                    Draw.rect(cx + 8, cy - 5, 2, 10, rCol);
                } else {
                    Draw.rect(cx - 1, cy - 1, 2, 2, rgba(220, 230, 240, 52));
                }
            }

            // Aviso contextual [X] limpio y centrado
            if (activeInteractLabel.length > 0 && !mapOpen) {
                const prW = Math.min(436, hudW - 24);
                const prX = (SCREEN_W - prW) >> 1;
                const prY = SCREEN_H - sy - 86;
                Draw.rect(prX, prY, prW, 32, rgba(8, 10, 16, 122));
                Draw.rect(prX, prY, prW, 2, rgba(250, 215, 95, 124));
                Draw.rect(prX, prY + 30, prW, 1, rgba(90, 102, 120, 100));
                fnt.scale = Math.fround(0.70);
                fnt.color = rgba(250, 225, 115, 128);
                fnt.print(prX + 14, prY + 7, activeInteractLabel);
            }

            // Barra HUD superior táctica (sin superposiciones)
            Draw.rect(sx, topY, hudW, 36, rgba(6, 8, 13, 122));
            Draw.rect(sx, topY + 35, hudW, 2, rgba(82, 100, 122, 114));

            fnt.scale = Math.fround(0.66);
            fnt.color = player.crouched ? rgba(92, 244, 138, 128) : rgba(250, 214, 96, 128);
            fnt.print(sx + 8, topY + 8, player.crouched ? "SIGILO" : getActiveChapter().code);

            fnt.color = rgba(242, 244, 250, 128);
            fnt.print(sx + 82, topY + 8, FUSE_HUD_LABELS[fusesCollected] || "FUS:0/4");

            fnt.color = rgba(96, 224, 255, 128);
            fnt.print(sx + 162, topY + 8, DECOY_HUD_LABELS[playerDecoys] || "SEN:0");

            fnt.color = rgba(250, 215, 95, 128);
            fnt.print(sx + 224, topY + 8, getCompassLabel(player.ang));

            fnt.color = rgba(225, 232, 240, 128);
            fnt.print(sx + 272, topY + 8, "LUZ");
            Draw.rect(sx + 312, topY + 11, 54, 12, rgba(20, 28, 38, 128));
            const batFill = Math.max(0, (player.battery * 0.50) | 0);
            const batCol = ((player.battery - 25.0) < 0) ? rgba(255, 78, 48, 128) : rgba(62, 224, 255, 128);
            if (batFill > 0) Draw.rect(sx + 314, topY + 13, batFill, 8, batCol);

            fnt.color = exhausted ? rgba(255, 90, 90, 128) : rgba(225, 232, 240, 128);
            fnt.print(sx + 374, topY + 8, "STM");
            Draw.rect(sx + 414, topY + 11, 54, 12, rgba(24, 24, 34, 128));
            const stamFill = Math.max(0, (player.stamina * 0.50) | 0);
            const stamCol = exhausted ? rgba(255, 65, 65, 128) : rgba(92, 240, 136, 128);
            if (stamFill > 0) Draw.rect(sx + 416, topY + 13, stamFill, 8, stamCol);

            const ecgCol = ((dangerRatio - 0.45) > 0) ? rgba(255, 65, 65, 128) : rgba(90, 245, 130, 128);
            const ecgBaseX = sx + hudW - 102;
            const ecgW = 94;
            Draw.rect(ecgBaseX, topY + 6, ecgW, 22, rgba(6, 14, 10, 120));

            if (GAME_SETTINGS.qualityIndex === 0 && !hwStreamDone && !hwStreamFailed) {
                const pendStep = HW3D_STREAM_STEPS[hwStreamStep];
                Draw.rect(SCREEN_W - sx - 280, topY + 40, 276, 26, rgba(12, 16, 26, 118));
                fnt.scale = Math.fround(0.62);
                fnt.color = rgba(110, 230, 255, 128);
                fnt.print(SCREEN_W - sx - 272, topY + 44, (STREAM_3D_BADGES[hwStreamStep] || "3D...") + (pendStep ? " " + pendStep.label : ""));
            }
            if (debugMode > 0 && hw3dReady && GAME_SETTINGS.qualityIndex === 0) {
                Draw.rect(SCREEN_W - sx - 210, topY + 68, 206, 24, rgba(8, 14, 22, 118));
                fnt.scale = Math.fround(0.60);
                fnt.color = rgba(120, 245, 160, 128);
                fnt.print(SCREEN_W - sx - 202, topY + 71, hwVramLabel);
            }
            if (GAME_SETTINGS.qualityIndex === 0 && hwStreamFailed) {
                Draw.rect(SCREEN_W - sx - 340, topY + 40, 336, 26, rgba(40, 8, 8, 122));
                fnt.scale = Math.fround(0.60);
                fnt.color = rgba(255, 150, 130, 128);
                fnt.print(SCREEN_W - sx - 332, topY + 44, "3D FALLO: " + String(hwLoadErrorMsg || "?").slice(0, 28));
            }
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
                        " 3D:" + (GAME_SETTINGS.qualityIndex === 0 ? (hw3dReady ? "VU1" : (hwStreamFailed ? "ERROR" : "CARGA")) : "2.5D") +
                        " EN:" + hwStalkerSource + " FPS:" + fps);
                } else {
                    Draw.rect(sx + hudW - 76, topY + 33, 76, 18, rgba(0, 0, 0, 100));
                    fnt.scale = Math.fround(0.66);
                    fnt.color = fps >= 50 ? rgba(110, 255, 130, 128) : rgba(255, 210, 80, 128);
                    fnt.print(sx + hudW - 70, topY + 35, ["FPS: ", String(fps)].join(""));
                }
            }

            if (GAME_SETTINGS.showFps || debugMode > 0) {
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
                    startPlayWithLoading(false);
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