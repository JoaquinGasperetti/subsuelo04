// --- MODULE: src/cinematic.js ---
// ============================================================================
// Sistema de Cinemáticas Declarativo para HK Engine 1 (PS2 Real / AthenaEnv V4)
// - Basado en datos (línea de tiempo declarativa: cámara, fundidos, subtítulos
//   máquina de escribir, efectos VHS, entidades y cues de audio).
// - CERO carga de recursos durante la reproducción (usa el mapa/entidades ya
//   precargados en STATE_MAP_LOADING y la fuente FreeType activa).
// - CERO asignaciones de objetos/arrays por frame en el bucle principal.
// - Compatible con 3D VU1 y raycaster 2.5D, NTSC 60Hz y PAL 50Hz.
// ============================================================================

// Colores estáticos precomputados (alfa GS PS2: 0..128)
const CIN_COL_BAR        = rgba(0, 0, 0, 128);
const CIN_COL_REC_DOT    = rgba(235, 32, 32, 128);
const CIN_COL_REC_TXT    = rgba(240, 240, 245, 128);
const CIN_COL_META_TXT   = rgba(175, 190, 205, 128);
const CIN_COL_SUB_BG     = rgba(0, 0, 0, 96);
const CIN_COL_SUB_MAIN   = rgba(238, 240, 246, 128);
const CIN_COL_SUB_WARN   = rgba(255, 215, 110, 128);
const CIN_COL_SUB_ALERT  = rgba(255, 90, 85, 128);
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
// Si un .adp no existe o no fue cargado en sfxBank, el disparo se ignora sin error.
const CINEMATIC_AUDIO_HOOKS = {
    vhs_static:    "assets/audio/vhs_static.adp",    // Ruido de cinta VHS al encender/cortar señal
    power_down:    "assets/audio/power_down.adp",    // Caída eléctrica / apagón del sector
    stalker_growl: "assets/audio/stalker_growl.adp"  // Respiración / gruñido lejano de El Acechador
};

// Objetos reutilizables preasignados (cero allocaciones por frame en QuickJS)
const cinCamera = {
    x: toF64(10.0),
    y: toF64(1.8),
    ang: toF64(Math.PI * 0.5),
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
    fov: toF64(0.90),
    flashIntensity: toF64(1.0),
    glitch: toF64(0.0),
    redBlink: toF64(0.0),
    shake: toF64(0.0),
    flickerFlash: toF64(0.0),
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

// Consulta segura de VRAM libre antes de iniciar una cinemática (nunca por frame).
// Recuerda que Screen.getFreeVRAM() sin argumentos en AthenaEnv devuelve VRAM USADA.
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

// Interpolación suave cúbica (smoothstep) sin asignaciones
function cinSmoothstep(t) {
    const c = clampF64(t, 0.0, 1.0);
    return c * c * (3.0 - 2.0 * c);
}

// Interpolación angular por el arco más corto (evita giros de 360 grados al cruzar +-PI)
function cinLerpAngle(a0, a1, t) {
    const start = toF64(a0);
    let diff = toF64(a1) - start;
    const twoPi = 6.283185307179586;
    while ((diff - 3.141592653589793) > 0) diff = diff - twoPi;
    while ((diff - (-3.141592653589793)) < 0) diff = fadd(diff, twoPi);
    return fadd(start, diff * t);
}

// Ruido pseudoaleatorio determinístico por enteros (0..255) sin allocaciones
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
    cinState.fov = toF64(0.90);
    cinState.flashIntensity = toF64(1.0);
    cinState.glitch = toF64(0.0);
    cinState.redBlink = toF64(0.0);
    cinState.shake = toF64(0.0);
    cinState.flickerFlash = toF64(0.0);
    cinState.nextAudioIdx = 0;
    cinState.lastSubIdx = -1;
    cinState.lastSubChars = -1;
    cinState.cachedLine1 = "";
    cinState.cachedLine2 = "";
    cinState.cachedColorKind = 0;
    cinState.lastSecIdx = -1;
    cinState.cachedTcLabel = CIN_TC_LABELS[0];

    // Medir VRAM libre una sola vez antes de arrancar: si queda poca (< 256 KB),
    // reducimos adornos 2D para proteger la caché de glifos FreeType en PS2 real.
    const freeKb = cinMeasureFreeVramKB();
    cinState.vramChecked = true;
    cinState.lowVramMode = freeKb < 256;

    // Inicializar cámara con el primer keyframe
    const kf0 = sequence.keyframes[0];
    cinCamera.x = toF64(kf0.x);
    cinCamera.y = toF64(kf0.y);
    cinCamera.ang = toF64(kf0.ang);
    cinCamera.bobPhase = toF64(0.0);
    cinCamera.battery = toF64(100.0);
    cinCamera.flashlightOn = (kf0.flashlight !== false);

    // Ocultar Acechador fuera del radio de culling hasta que la timeline lo invoque
    cinStalker.x = toF64(99.0);
    cinStalker.y = toF64(99.0);
    cinStalker.state = AI_PATROL;
    resetStalkerAnim(cinStalker, 99.0, 99.0);

    // Forzar refresco de iluminación 3D al cambiar a cinemática
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

    // Devolver música ambiente y limpiar vibración / luces antes del gameplay
    setMusicTrack("ambient", false);
    triggerRumble(0, 0);
    hwLastFlashState = -1;

    // Transición limpia hacia el spawn del jugador sin doble fundido brusco
    introFade = 36;
    switchState(target);
}

// Evalúa keyframes de cámara con interpolación suave (o corte instantáneo si snap: true)
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
    let fov = toF64(a.fov !== undefined ? a.fov : 0.90);
    let flashOn = (a.flashlight !== false);

    if (b !== a && !b.snap) {
        const span = toF64(b.t) - toF64(a.t);
        if ((span - 1.0) > 0) {
            const u = cinSmoothstep((tMs - toF64(a.t)) / span);
            x = fadd(x, (toF64(b.x) - x) * u);
            y = fadd(y, (toF64(b.y) - y) * u);
            ang = cinLerpAngle(ang, toF64(b.ang), u);
            const fovB = toF64(b.fov !== undefined ? b.fov : 0.90);
            fov = fadd(fov, (fovB - fov) * u);
        }
    }

    // Aplicar micro-shake VHS (posicional + angular) sin crear objetos
    const shk = cinState.shake;
    if ((shk - 0.01) > 0) {
        const h1 = (cinHashByte(frameTick * 3 + 7) - 128) / 128.0;
        const h2 = (cinHashByte(frameTick * 5 + 19) - 128) / 128.0;
        ang = fadd(ang, h1 * 0.032 * shk);
        x = fadd(x, h2 * 0.025 * shk);
    }

    // Parpadeo de linterna en momentos de interferencia fuerte
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
    cinCamera.flashlightOn = flashOn;
    cinState.fov = fov;
    cinState.flashIntensity = fInt;
}

// Evalúa fundidos a negro / desde negro (rango GS 0..128)
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

// Evalúa efectos VHS declarativos activos en el instante tMs
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

// Evalúa aparición y desplazamiento de entidades (El Acechador) sin crear objetos
function cinEvalEntities(seq, tMs) {
    let stalkerVisible = false;
    const list = seq.entities;
    if (list) {
        for (let i = 0; i < list.length; i++) {
            const ev = list[i];
            if (ev.kind === "stalker" && (tMs - toF64(ev.t0)) >= 0 && (tMs - toF64(ev.t1)) <= 0) {
                const span = toF64(ev.t1) - toF64(ev.t0);
                const u = (span > 1.0) ? clampF64((tMs - toF64(ev.t0)) / span, 0.0, 1.0) : 1.0;
                cinStalker.x = fadd(toF64(ev.x0), (toF64(ev.x1) - toF64(ev.x0)) * u);
                cinStalker.y = fadd(toF64(ev.y0), (toF64(ev.y1) - toF64(ev.y0)) * u);
                stalkerVisible = true;
                break;
            }
        }
    }
    if (!stalkerVisible) {
        cinStalker.x = toF64(99.0);
        cinStalker.y = toF64(99.0);
        cinStalker.animYawInit = false;
    }
}

// Dispara cues de audio una única vez cuando la línea de tiempo los cruza
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
            // Gancho seguro para futuros .adp listados en CINEMATIC_AUDIO_HOOKS:
            // si el desarrollador agrega el sonido a sfxBank, sonará automáticamente.
            playSfx(cue.name, cue.pan || 0, cue.vol !== undefined ? cue.vol : 0.8);
        }
    }
}

// Evalúa subtítulos con efecto máquina de escribir (solo recorta string al avanzar carácter)
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
    const cps = sub.cps || 26;
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

// Dibuja el HUD VHS, efectos de interferencia, subtítulos, fundido y barra de salto
function cinDrawOverlay(screenW, screenH, frameTick, fnt) {
    const seq = cinState.seq;
    const safeX = GAME_SETTINGS.crtSafe ? 28 : 12;
    const safeY = GAME_SETTINGS.crtSafe ? 18 : 8;
    const barH = GAME_SETTINGS.crtSafe ? 50 : 42;

    // 1. Efectos VHS reutilizando primitivas livianas del motor (solo si overlays activos)
    if (GAME_SETTINGS.overlays) {
        const g = cinState.glitch;
        const rb = cinState.redBlink;

        // Línea de barrido VHS constante
        if (!cinState.lowVramMode) {
            const scanY = (frameTick * 4) % screenH;
            Draw.rect(0, scanY, screenW, 2, CIN_COL_SCANLINE);
        }

        // Bandas de interferencia / glitch proporcionales a cinState.glitch
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

        // Parpadeo de luces de emergencia rojas en bordes
        if ((rb - 0.05) > 0 && ((frameTick & 15) < 7)) {
            let rAlpha = (rb * 82.0) | 0;
            if (rAlpha > 90) rAlpha = 90;
            const redCol = rgba(230, 22, 26, rAlpha);
            Draw.rect(0, barH, screenW, 4, redCol);
            Draw.rect(0, screenH - barH - 4, screenW, 4, redCol);
            Draw.rect(0, barH, 8, screenH - (barH << 1), rgba(210, 18, 22, rAlpha >> 1));
            Draw.rect(screenW - 8, barH, 8, screenH - (barH << 1), rgba(210, 18, 22, rAlpha >> 1));
        }
    }

    // 2. Bandas cinematográficas letterbox (arriba y abajo)
    Draw.rect(0, 0, screenW, barH, CIN_COL_BAR);
    Draw.rect(0, screenH - barH, screenW, barH, CIN_COL_BAR);

    // 3. Cabecera VHS: indicador parpadeante REC + timecode + identificador de cámara
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
    if (seq.cameraLabel) {
        fnt.print((screenW >> 1) - 110, safeY + 2, seq.cameraLabel);
    }
    if (seq.dateLabel) {
        fnt.print(screenW - safeX - 168, safeY + 2, seq.dateLabel);
    }

    // 4. Subtítulos máquina de escribir sobre el borde inferior (área segura CRT)
    if (cinState.cachedLine1.length > 0) {
        const subH = cinState.cachedLine2.length > 0 ? 52 : 30;
        const subY = screenH - barH - subH - 8;
        const subW = screenW - (safeX << 1);
        Draw.rect(safeX, subY, subW, subH, CIN_COL_SUB_BG);

        fnt.scale = Math.fround(0.70);
        if (cinState.cachedColorKind === 2) fnt.color = CIN_COL_SUB_ALERT;
        else if (cinState.cachedColorKind === 1) fnt.color = CIN_COL_SUB_WARN;
        else fnt.color = CIN_COL_SUB_MAIN;

        fnt.print(safeX + 10, subY + 4, cinState.cachedLine1);
        if (cinState.cachedLine2.length > 0) {
            fnt.print(safeX + 10, subY + 26, cinState.cachedLine2);
        }
    }

    // 5. Indicador y barra de progreso para omitir manteniendo START apretado
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

    // 6. Fundido a negro / desde negro (capa superior)
    if (cinState.fadeAlpha > 0) {
        Draw.rect(0, 0, screenW, screenH, rgba(0, 0, 0, cinState.fadeAlpha));
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

    // Control de salto manteniendo START apretado
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

    // Verificar fin natural de la secuencia
    if ((cinState.elapsedMs - toF64(seq.durationMs)) >= 0) {
        finishCinematic();
        return;
    }

    const tMs = cinState.elapsedMs;
    cinEvalVhs(seq, tMs);
    cinEvalCamera(seq, tMs, frameTick);
    cinEvalEntities(seq, tMs);
    updateStalkerAnim(cinStalker, cinCamera.x, cinCamera.y, dtScale, false, false);
    cinEvalFade(seq, tMs);
    cinEvalAudioCues(seq, tMs);
    cinEvalSubtitles(seq, tMs);

    // Renderizar el mundo reutilizando el mismo pipeline 3D VU1 / 2.5D del gameplay.
    // mapAnim = 1.0 oculta el viewmodel de la linterna en 2.5D sin cambiar firmas.
    render3DWorld(
        screenW, screenH, worldGrid, cinCamera, cinStalker, entities,
        cinState.redBlink * 0.75, frameTick, false,
        cinState.fov, cinState.flashIntensity, 1.0, 0.0
    );

    cinDrawOverlay(screenW, screenH, frameTick, fnt);
}

// ============================================================================
// CINEMÁTICA INTRODUCTORIA: "SUBSUELO 04 - CINTA RECUPERADA" (44 segundos)
// Coherente con BASE_MAP (20x20) y LORE_NOTES #01..#04 (src/map.js).
// Todas las coordenadas de cámara verificadas en celdas transitables (0).
// ============================================================================
const CINEMATIC_INTRO = {
    id: "intro_subsuelo04",
    durationMs: 44000.0,
    skipHoldMs: 1200.0,
    cameraLabel: "CAM-04 // SUBSUELO 04",
    dateLabel: "14/10 02:14",

    keyframes: [
        // Plano 1 (0s..9s): Compuerta blindada Norte sellada (celdas 9..10, 0)
        { t: 0.0,     x: 10.0, y: 2.2,  ang: -1.5708, fov: 0.90, flashlight: true,  snap: true  },
        { t: 9000.0,  x: 10.0, y: 2.9,  ang: -1.4200, fov: 0.90, flashlight: true,  snap: false },

        // Plano 2 (9s..18s): Reja de seguridad Oeste trabada tras el apagón (celda 5, 8)
        { t: 9001.0,  x: 8.6,  y: 8.5,  ang:  3.1416, fov: 0.90, flashlight: true,  snap: true  },
        { t: 18000.0, x: 6.7,  y: 8.5,  ang:  3.0400, fov: 0.90, flashlight: true,  snap: false },

        // Plano 3 (18s..27s): Paneo sobre el Disyuntor Rojo central (10.0, 11.5) desde fila 10 libre
        { t: 18001.0, x: 8.6,  y: 10.4, ang:  0.6650, fov: 0.90, flashlight: true,  snap: true  },
        { t: 27000.0, x: 11.3, y: 10.4, ang:  2.4400, fov: 0.90, flashlight: true,  snap: false },

        // Plano 4 (27s..37.5s): Pasillo transversal fila 10 — aparición lejana de El Acechador
        { t: 27001.0, x: 5.5,  y: 10.5, ang:  0.0000, fov: 0.90, flashlight: true,  snap: true  },
        { t: 37500.0, x: 6.9,  y: 10.5, ang:  0.0250, fov: 0.92, flashlight: true,  snap: false },

        // Plano 5 (37.5s..44s): Corte de señal y enlace directo al punto de inicio del jugador
        { t: 37501.0, x: 10.0, y: 1.65, ang:  1.5708, fov: 0.90, flashlight: true,  snap: true  },
        { t: 44000.0, x: 10.0, y: 1.80, ang:  1.5708, fov: 0.90, flashlight: true,  snap: false }
    ],

    fades: [
        // Fundido inicial desde negro
        { t0: 0.0,     t1: 2400.0,  from: 128, to: 0   },
        // Micro-corte negro al perder señal tras ver a El Acechador
        { t0: 37200.0, t1: 37700.0, from: 0,   to: 128 },
        { t0: 37700.0, t1: 38600.0, from: 128, to: 128 },
        { t0: 38600.0, t1: 40000.0, from: 128, to: 0   },
        // Cierre suave hacia el inicio del control del jugador
        { t0: 43300.0, t1: 44000.0, from: 0,   to: 48  }
    ],

    vhsEffects: [
        // Arranque de cinta VHS
        { t0: 0.0,     t1: 2600.0,  glitch: 0.70, redBlink: 0.35, shake: 0.12, flickerFlash: 0.15 },
        // Cortes entre cámaras
        { t0: 8800.0,  t1: 9500.0,  glitch: 0.65, redBlink: 0.45, shake: 0.18, flickerFlash: 0.0  },
        { t0: 17800.0, t1: 18500.0, glitch: 0.60, redBlink: 0.40, shake: 0.16, flickerFlash: 0.0  },
        // Alarma roja tenue en sector de rejas
        { t0: 9500.0,  t1: 17800.0, glitch: 0.12, redBlink: 0.42, shake: 0.04, flickerFlash: 0.0  },
        // Tensión creciente con El Acechador a lo lejos
        { t0: 27000.0, t1: 33000.0, glitch: 0.38, redBlink: 0.65, shake: 0.22, flickerFlash: 0.28 },
        { t0: 33000.0, t1: 37600.0, glitch: 0.88, redBlink: 0.95, shake: 0.68, flickerFlash: 0.55 },
        // Recuperación de señal
        { t0: 38600.0, t1: 40400.0, glitch: 0.45, redBlink: 0.25, shake: 0.10, flickerFlash: 0.15 }
    ],

    entities: [
        // Silueta de El Acechador avanzando lentamente por el pasillo fila 10 (14.5 -> 11.2)
        { t0: 27200.0, t1: 37500.0, kind: "stalker", x0: 14.5, y0: 10.5, x1: 11.2, y1: 10.5 }
    ],

    subtitles: [
        {
            t0: 700.0, t1: 4500.0, cps: 28, colorKind: 1,
            line1: "14/10 - TURNO NOCHE // CINTA RECUPERADA",
            line2: "Registro automatico de emergencia - Subsuelo 04."
        },
        {
            t0: 4700.0, t1: 8800.0, cps: 28, colorKind: 0,
            line1: "Tras el apagon, la compuerta blindada Norte",
            line2: "quedo sellada. Requiere los 4 FUSIBLES."
        },
        {
            t0: 9400.0, t1: 13600.0, cps: 28, colorKind: 0,
            line1: "Las trabas magneticas cerraron las rejas",
            line2: "hacia los sectores Este y Oeste."
        },
        {
            t0: 13800.0, t1: 17800.0, cps: 28, colorKind: 1,
            line1: "El DISYUNTOR ROJO en el sector central",
            line2: "es el unico punto para liberar las rejas."
        },
        {
            t0: 18500.0, t1: 22600.0, cps: 28, colorKind: 0,
            line1: "Suministro critico: cuida la bateria de tu",
            line2: "linterna y revisa las notas del personal."
        },
        {
            t0: 22800.0, t1: 26800.0, cps: 26, colorKind: 1,
            line1: "Guardia sin respuesta... las camaras detectan",
            line2: "una silueta moviendose en los pasillos."
        },
        {
            t0: 27700.0, t1: 32200.0, cps: 28, colorKind: 2,
            line1: "No corras cerca suyo. Apaga la linterna",
            line2: "para perder su rastro si sube tu pulso."
        },
        {
            t0: 32500.0, t1: 37100.0, cps: 28, colorKind: 2,
            line1: "Si te acorrala, apunta directo a sus ojos",
            line2: "para frenarlo. No mires atras."
        },
        {
            t0: 39200.0, t1: 43400.0, cps: 30, colorKind: 1,
            line1: "SENAL RECUPERADA. Activa el disyuntor rojo,",
            line2: "junta los 4 fusibles y escapa al Norte."
        }
    ],

    audioCues: [
        { t: 100.0,   type: "music", name: "ambient",       rewind: true },
        { t: 250.0,   type: "hook",  name: "vhs_static",    pan: 0, vol: 0.70 },
        { t: 9100.0,  type: "sfx",   name: "gate_locked",   pan: 0, vol: 0.80 },
        { t: 18200.0, type: "sfx",   name: "flashlight",    pan: 0, vol: 0.75 },
        { t: 27100.0, type: "music", name: "chase",         rewind: true },
        { t: 29500.0, type: "sfx",   name: "heartbeat",     pan: 0, vol: 0.70 },
        { t: 33200.0, type: "hook",  name: "stalker_growl", pan: 0, vol: 0.85 },
        { t: 37600.0, type: "hook",  name: "vhs_static",    pan: 0, vol: 0.80 },
        { t: 38600.0, type: "music", name: "ambient",       rewind: false }
    ]
};