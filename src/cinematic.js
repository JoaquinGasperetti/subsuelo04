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

