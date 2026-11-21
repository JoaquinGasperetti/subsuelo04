// ============================================================================
// Gestor de Audio Ambiental seguro para PS2 (AthenaEnv Sound / audsrv)
// ============================================================================
import { GAME_SETTINGS } from "./config.js";

let ambientStream = null;
let audioReady = false;
let audioPlaying = false;
let lastAppliedVol = -1;

export function initAudio() {
    try {
        if (typeof Sound === "undefined" || !Sound || typeof Sound.Stream !== "function") return false;
        if (typeof std !== "undefined" && std && typeof std.exists === "function") {
            if (!std.exists("assets/ambient.wav")) return false;
        }
        ambientStream = Sound.Stream("assets/ambient.wav");
        if (ambientStream) {
            ambientStream.loop = true;
            audioReady = true;
            applyAudioVolume(GAME_SETTINGS.audioVolume);
            if (GAME_SETTINGS.audioVolume > 0) {
                ambientStream.play();
                audioPlaying = true;
            }
            return true;
        }
    } catch (_) {
        ambientStream = null;
        audioReady = false;
    }
    return false;
}

export function applyAudioVolume(vol) {
    const clamped = vol < 0 ? 0 : (vol > 100 ? 100 : (vol | 0));
    if (clamped === lastAppliedVol) return;
    lastAppliedVol = clamped;
    if (!audioReady || !ambientStream) return;
    try {
        if (typeof Sound.setVolume === "function") {
            Sound.setVolume(clamped);
        }
        if (clamped === 0) {
            if (audioPlaying && typeof ambientStream.pause === "function") {
                ambientStream.pause();
                audioPlaying = false;
            }
        } else {
            if (!audioPlaying && typeof ambientStream.play === "function") {
                ambientStream.play();
                audioPlaying = true;
            }
        }
    } catch (_) {}
}

export function isAudioReady() {
    return audioReady;
}
