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