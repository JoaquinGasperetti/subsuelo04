// ============================================================================
// Persistencia segura en Memory Card PS2 (mc0:/SUBSUELO04/save.json)
// Se degrada con gracia si no hay Memory Card conectada o se ejecuta desde DVD
// ============================================================================
import { GAME_SETTINGS } from "./config.js";

const SAVE_DIR  = "mc0:/SUBSUELO04";
const SAVE_PATH = "mc0:/SUBSUELO04/save.json";

export const RECORDS = {
    bestNormalSec: 0,
    bestNightmareSec: 0,
    escapes: 0,
    mcAvailable: false
};

export function loadSaveData() {
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

export function saveGameData() {
    try {
        if (typeof std === "undefined" || !std || typeof std.open !== "function") return false;
        if (typeof os !== "undefined" && os && typeof os.mkdir === "function") {
            try { os.mkdir(SAVE_DIR); } catch (_) {}
        }
        const payload = JSON.stringify({
            qualityIndex: GAME_SETTINGS.qualityIndex,
            crtSafe: GAME_SETTINGS.crtSafe,
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

export function recordEscape(secs, difficulty) {
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
