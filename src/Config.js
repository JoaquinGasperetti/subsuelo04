// ============================================================================
// Configuración global, ajustes dinámicos y utilidades FLOAT64 para PS2 EE
// ============================================================================

// Ajustes modificables desde el menú de Opciones (y persistibles en Memory Card)
export const GAME_SETTINGS = {
    // Calidad del raycaster: 0 = ALTA (160 rayos), 1 = EQUILIBRADA (128 rayos, ideal PS2 real), 2 = RENDIMIENTO (96 rayos)
    qualityIndex: 1,
    // Margen de seguridad para televisores CRT con overscan (true = seguro CRT, false = pantalla completa HD/emulador)
    crtSafe: true,
    // Sensibilidad de cámara: 0 = BAJA, 1 = MEDIA, 2 = ALTA
    sensitivityIndex: 1,
    // Vibración DualShock 2
    rumble: true,
    // Efectos visuales VHS, viñeta y partículas
    overlays: true,
    // Balanceo de cámara y linterna en mano
    bob: true,
    viewmodel: true,
    particles: true,
    // Audio ambiental en 0% por defecto para arranque 100% seguro en PS2 real USB (activar desde Opciones)
    audioVolume: 0,
    // Mostrar contador de FPS en esquina superior
    showFps: false,
    // Dificultad: 0 = NORMAL, 1 = PESADILLA
    difficulty: 0
};

export const QUALITY_RAYS = [160, 128, 96];
export const QUALITY_LABELS = ["ALTA (160)", "EQUILIBRADA (128)", "RAPIDA (96)"];
export const SENS_TURN_SPEED = [0.038, 0.052, 0.068];
export const SENS_LABELS = ["BAJA", "MEDIA", "ALTA"];
export const DIFF_LABELS = ["NORMAL", "PESADILLA"];

// Zona muerta ampliada para sticks analógicos DualShock 2 reales con desgaste
export const STICK_DEADZONE = 0.22;

export const F64_ZERO = -0.0;

export function toF64(v) {
    return Math.min(v) - F64_ZERO;
}

export function fadd(a, b) {
    return a - (-b);
}

export function clampF64(v, lo, hi) {
    const x = toF64(v);
    const mn = toF64(lo);
    const mx = toF64(hi);
    if ((x - mn) < 0) return mn;
    if ((x - mx) > 0) return mx;
    return x;
}

// Empaquetado directo RGBA en entero de 32 bits (JS_TAG_INT), sin llamadas C a Color.new()
export function rgba(r, g, b, a) {
    return (r & 255) | ((g & 255) << 8) | ((b & 255) << 16) | ((a & 255) << 24);
}

// Dispara el recolector de ciclos de QuickJS SOLO en transiciones de menú (nunca durante gameplay)
export function requestGC() {
    try {
        if (typeof std !== "undefined" && std && typeof std.gc === "function") {
            std.gc();
        }
    } catch (_) {}
}
