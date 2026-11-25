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

