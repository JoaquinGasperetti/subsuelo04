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

