// ============================================================================
// SUBSUELO 04: EL ACECHADOR (PS2 3D Survival Horror - AthenaEnv V4)
// Optimizado para PlayStation 2 real (Emotion Engine 294MHz + GS + CRT)
// Arranque inmediato sin llamadas bloqueantes a MC0 ni Sound.Stream al iniciar
// ============================================================================

import { createWorldGrid, isPosWalkable, getCell, LORE_NOTES } from "./src/map.js";
import { AI_PATROL, updateStalkerAI } from "./src/ai.js";
import { render3DWorld, renderAnimatedMapPDA, renderStats } from "./src/renderer.js";
import {
    GAME_SETTINGS, SENS_TURN_SPEED, STICK_DEADZONE,
    F64_ZERO, toF64, fadd, clampF64, rgba, requestGC
} from "./src/config.js";
import { saveGameData, recordEscape } from "./src/storage.js";
import { initAudio, applyAudioVolume, isAudioReady } from "./src/audio.js";
import {
    getSafeMargins, drawTitleMenu, drawOptionsMenu, drawControlsMenu,
    drawLoreMenu, drawCreditsMenu, drawPauseMenu, drawNoteOverlay,
    drawEndScreen, drawPadDisconnectedOverlay
} from "./src/menus.js";

const screenMode = Screen.getMode();
const SCREEN_W = (screenMode && screenMode.width) ? screenMode.width : 640;
const SCREEN_H = (screenMode && screenMode.height) ? screenMode.height : 448;
const MODE_INFO = {
    vmodeLabel: SCREEN_H >= 500 ? "PAL 50Hz" : "NTSC 60Hz"
};

Screen.setVSync(true);
try { Screen.setParam(Screen.DEPTH_TEST_ENABLE, false); } catch (_) {}

const fnt = new Font("default");
const pad = Pads.get(0);

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

let gameState = STATE_TITLE;
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
let currentFov = toF64(1.05);
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
    wpIdx: 0,
    hasNextNode: false,
    nextNodeX: toF64(10.0),
    nextNodeY: toF64(10.0)
};

let entities = [];

let lastRumbleBig = -1;
let lastRumbleSmall = -1;
function triggerRumble(big, small) {
    if (!GAME_SETTINGS.rumble) {
        big = 0;
        small = 0;
    }
    if (big === lastRumbleBig && small === lastRumbleSmall) return;
    lastRumbleBig = big;
    lastRumbleSmall = small;
    try {
        if (typeof Pads.rumble === "function") {
            Pads.rumble(0, big, small);
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
        triggerRumble(0, 0);
        requestGC();
    }
}

function getCompassLabel(ang) {
    let deg = ((toF64(ang) * 57.2957795) % 360.0);
    if ((deg - 0.0) < 0) deg = fadd(deg, 360.0);
    if ((deg - 22.5) < 0 || (deg - 337.5) >= 0) return "E";
    if ((deg - 67.5) < 0) return "SE";
    if ((deg - 112.5) < 0) return "S";
    if ((deg - 157.5) < 0) return "SO";
    if ((deg - 202.5) < 0) return "O";
    if ((deg - 247.5) < 0) return "NO";
    if ((deg - 292.5) < 0) return "N";
    return "NE";
}

function isPadDisconnected() {
    try {
        if (typeof Pads.isActive === "function") {
            return !Pads.isActive(0);
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
    currentFov = toF64(1.05);
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
    triggerRumble(0, 0);
}

resetGame();

let runtimeErr = null;
Screen.display(() => {
    if (runtimeErr !== null) {
        Draw.rect(0, 0, SCREEN_W, SCREEN_H, rgba(55, 0, 0, 128));
        fnt.scale = Math.fround(0.55);
        fnt.color = rgba(255, 220, 220, 128);
        fnt.print(24, 34, "ERROR EN TIEMPO DE EJECUCION:");
        fnt.print(24, 64, runtimeErr);
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

        if (gameState === STATE_PLAY && isPadDisconnected()) {
            triggerRumble(0, 0);
            render3DWorld(SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities, 0.0, frameTick, fusesCollected === 4, currentFov, flashlightWarmup, mapAnim, 0.0);
            drawPadDisconnectedOverlay(SCREEN_W, SCREEN_H, fnt);
            return;
        }

        if (gameState === STATE_TITLE) {
            player.ang = toF64(frameTick * 0.005);
            render3DWorld(SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities, 0.22, frameTick, false, 1.05, 1.0, 1.0, 0.0);
            drawTitleMenu(SCREEN_W, SCREEN_H, titleCursor, frameTick, fnt);

            const nav = readMenuDir();
            if (nav.dy !== 0) titleCursor = (titleCursor + nav.dy + 5) % 5;
            if (titleCursor === 0 && nav.dx !== 0) {
                GAME_SETTINGS.difficulty = (GAME_SETTINGS.difficulty + 1) & 1;
            }
            if (pad.justPressed(Pads.CROSS) || pad.justPressed(Pads.START)) {
                if (titleCursor === 0) {
                    resetGame();
                    switchState(STATE_PLAY);
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
            if (nav.dy !== 0) optionsCursor = (optionsCursor + nav.dy + 8) % 8;

            const adjust = nav.dx !== 0 ? nav.dx : (pad.justPressed(Pads.CROSS) && optionsCursor < 7 ? 1 : 0);
            if (adjust !== 0) {
                if (optionsCursor === 0) {
                    GAME_SETTINGS.qualityIndex = (GAME_SETTINGS.qualityIndex + adjust + 3) % 3;
                } else if (optionsCursor === 1) {
                    GAME_SETTINGS.crtSafe = !GAME_SETTINGS.crtSafe;
                } else if (optionsCursor === 2) {
                    GAME_SETTINGS.sensitivityIndex = (GAME_SETTINGS.sensitivityIndex + adjust + 3) % 3;
                } else if (optionsCursor === 3) {
                    GAME_SETTINGS.rumble = !GAME_SETTINGS.rumble;
                    if (!GAME_SETTINGS.rumble) triggerRumble(0, 0);
                } else if (optionsCursor === 4) {
                    GAME_SETTINGS.overlays = !GAME_SETTINGS.overlays;
                } else if (optionsCursor === 5) {
                    GAME_SETTINGS.audioVolume = (GAME_SETTINGS.audioVolume + adjust * 25 + 125) % 125;
                    if (GAME_SETTINGS.audioVolume > 0 && !isAudioReady()) {
                        initAudio();
                    }
                    applyAudioVolume(GAME_SETTINGS.audioVolume);
                } else if (optionsCursor === 6) {
                    GAME_SETTINGS.showFps = !GAME_SETTINGS.showFps;
                    if (GAME_SETTINGS.showFps) ensureFpsCounter();
                }
            }

            if (pad.justPressed(Pads.CROSS) && optionsCursor === 7) {
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
            render3DWorld(SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities, 0.10, frameTick, false, 1.05, 1.0, 1.0, 0.0);
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

            const targetFov = isSprinting ? 1.15 : 1.05;
            currentFov = fadd(currentFov, (targetFov - currentFov) * Math.min(1.0, 0.14 * dtScale));

            const speed = (isSprinting ? 0.082 : (mapOpen ? 0.032 : 0.048)) * dtScale;
            const dirX = toF64(Math.cos(player.ang));
            const dirY = toF64(Math.sin(player.ang));
            const dx = (dirX * fwd - dirY * strafe) * speed;
            const dy = fadd(dirY * fwd, dirX * strafe) * speed;

            let bumpedGate = false;
            const nextX = fadd(player.x, dx);
            if (isPosWalkable(worldGrid, nextX, player.y, 0.25)) {
                player.x = nextX;
            } else if (getCell(worldGrid, (fadd(nextX, (dx > 0) ? 0.28 : -0.28)) | 0, player.y | 0) === 5) {
                bumpedGate = true;
            }
            const nextY = fadd(player.y, dy);
            if (isPosWalkable(worldGrid, player.x, nextY, 0.25)) {
                player.y = nextY;
            } else if (getCell(worldGrid, player.x | 0, (fadd(nextY, (dy > 0) ? 0.28 : -0.28)) | 0) === 5) {
                bumpedGate = true;
            }
            if (bumpCooldown > 0) bumpCooldown--;
            if (bumpedGate && bumpCooldown === 0) {
                bumpCooldown = 60;
                triggerRumble(110, 1);
                triggerScreenFlash(200, 60, 20, 42);
                showRadio("REJA BLOQUEADA: Activa el Disyuntor rojo en el sector central.", 160);
            }

            if (isMoving) {
                player.bobPhase = fadd(player.bobPhase, (isSprinting ? 0.28 : 0.16) * dtScale);
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
                        stalker.baseSpeed = fadd(stalker.baseSpeed, 0.003);
                        triggerScreenFlash(255, 200, 50, 56);
                        triggerRumble(160, 1);
                        showPopup("+1 FUSIBLE (" + fusesCollected + "/4)");
                        showRadio("FUSIBLE RECOLECTADO (" + fusesCollected + "/4). El Acechador se agita...", 190);
                    } else if (e.kind === "battery") {
                        player.battery = toF64(Math.min(100.0, fadd(player.battery, 45.0)));
                        triggerScreenFlash(50, 220, 255, 48);
                        triggerRumble(90, 1);
                        showPopup("+45% BATERIA");
                        showRadio("BATERIA +45% RECUPERADA.", 140);
                    } else if (e.kind === "breaker") {
                        breakerActive = true;
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
                        if (!collectedNotes[e.msgIdx]) {
                            collectedNotes[e.msgIdx] = true;
                            notesFoundCount++;
                        }
                        activeNoteIdx = e.msgIdx;
                        triggerScreenFlash(220, 230, 255, 38);
                        showRadio(LORE_NOTES[e.msgIdx].code + ": " + LORE_NOTES[e.msgIdx].summary, 220);
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

            const ai = updateStalkerAI(stalker, worldGrid, player, isSprinting, isMoving, frameTick, dtScale, GAME_SETTINGS.difficulty);
            const dangerRatio = toF64(Math.max(0.0, Math.min(1.0, (7.0 - toF64(ai.distP)) / 7.0)));

            if (((dangerRatio - 0.28) > 0) && (frameTick % Math.max(12, (38.0 - dangerRatio * 24.0) | 0) < 4)) {
                triggerRumble((dangerRatio * 185.0) | 0, 1);
            } else if (bumpCooldown < 52) {
                triggerRumble(0, 0);
            }

            if ((toF64(ai.distP) - 0.65) < 0) {
                jumpscareTimer = 42;
                endCursor = 0;
                gameState = STATE_JUMPSCARE;
                triggerRumble(255, 1);
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
            Draw.rect(sx, topY, hudW, 30, rgba(4, 6, 10, 114));
            Draw.rect(sx, topY + 29, hudW, 1, rgba(60, 80, 95, 110));

            fnt.scale = Math.fround(0.46);
            if ((frameTick % 40) < 25) {
                Draw.rect(sx + 8, topY + 11, 7, 7, rgba(245, 40, 40, 128));
                fnt.color = rgba(245, 50, 50, 128);
                fnt.print(sx + 18, topY + 7, "REC");
            }

            fnt.color = rgba(235, 235, 240, 128);
            fnt.print(sx + 58, topY + 7, "FUS:" + fusesCollected + "/4");

            fnt.color = rgba(250, 215, 95, 128);
            fnt.print(sx + 132, topY + 7, "[" + getCompassLabel(player.ang) + "]");

            fnt.color = rgba(235, 235, 240, 128);
            fnt.print(sx + 178, topY + 7, "LUZ:");
            Draw.rect(sx + 216, topY + 9, 52, 11, rgba(20, 30, 38, 128));
            const batFill = Math.max(0, (player.battery * 0.48) | 0);
            const batCol = ((player.battery - 25.0) < 0) ? rgba(255, 80, 45, 128) : rgba(55, 225, 255, 128);
            if (batFill > 0) Draw.rect(sx + 218, topY + 11, batFill, 7, batCol);

            fnt.color = exhausted ? rgba(255, 95, 95, 128) : rgba(235, 235, 240, 128);
            fnt.print(sx + 278, topY + 7, "STM:");
            Draw.rect(sx + 318, topY + 9, 52, 11, rgba(25, 25, 32, 128));
            const stamFill = Math.max(0, (player.stamina * 0.48) | 0);
            const stamCol = exhausted ? rgba(255, 65, 65, 128) : rgba(95, 240, 135, 128);
            if (stamFill > 0) Draw.rect(sx + 320, topY + 11, stamFill, 7, stamCol);

            const bpm = (fadd(72.0, dangerRatio * 118.0)) | 0;
            const ecgCol = ((dangerRatio - 0.45) > 0) ? rgba(255, 65, 65, 128) : rgba(90, 245, 130, 128);
            fnt.color = ecgCol;
            fnt.print(sx + 380, topY + 7, "BPM:" + bpm);

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

            if (GAME_SETTINGS.showFps || debugMode > 0) {
                let fps = 0;
                try { fps = Screen.getFPS(60) | 0; } catch (_) {}
                if (debugMode > 0) {
                    Draw.rect(sx, topY + 32, hudW, 18, rgba(0, 0, 0, 112));
                    fnt.scale = Math.fround(0.42);
                    fnt.color = rgba(120, 255, 120, 128);
                    fnt.print(sx + 6, topY + 34, "X:" + player.x.toFixed(1) + " Y:" + player.y.toFixed(1) +
                        " R:" + renderStats.numRays + " DT:" + dtScale.toFixed(2) + " FPS:" + fps + " M:" + debugMode);
                } else {
                    Draw.rect(sx + hudW - 76, topY + 33, 76, 18, rgba(0, 0, 0, 100));
                    fnt.scale = Math.fround(0.43);
                    fnt.color = fps >= 50 ? rgba(110, 255, 130, 128) : rgba(255, 210, 80, 128);
                    fnt.print(sx + hudW - 70, topY + 35, "FPS: " + fps);
                }
            }

            if (popupTimer > 0) {
                popupTimer--;
                fnt.scale = Math.fround(0.64);
                fnt.color = rgba(255, 245, 140, 128);
                fnt.print((SCREEN_W >> 1) - 110, topY + 54, popupText);
            }

            const botY = SCREEN_H - sy - 30;
            Draw.rect(sx, botY, hudW, 30, rgba(4, 6, 10, 114));
            Draw.rect(sx, botY, hudW, 1, rgba(60, 80, 95, 110));
            fnt.scale = Math.fround(0.46);
            if (radioTimer > 0) {
                radioTimer--;
                fnt.color = rgba(255, 230, 120, 128);
                fnt.print(sx + 10, botY + 7, radioText);
            } else if (fusesCollected === 4) {
                fnt.color = rgba(100, 255, 130, 128);
                fnt.print(sx + 10, botY + 7, "SALIDA NORTE ABIERTA! Ve hacia el Norte [N]. [SELECT/L2: Plano]");
            } else if (!breakerActive) {
                fnt.color = rgba(210, 195, 145, 128);
                fnt.print(sx + 10, botY + 7, "Busca el Disyuntor rojo al centro para abrir rejas. [SELECT/L2: Plano]");
            } else {
                fnt.color = rgba(210, 195, 145, 128);
                fnt.print(sx + 10, botY + 7, "Rejas abiertas. Junta los 4 fusibles (" + fusesCollected + "/4). [SELECT/L2: Plano]");
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
            const jx = ((Math.random() - 0.5) * 32) | 0;
            const jy = ((Math.random() - 0.5) * 32) | 0;
            Draw.rect(155 + jx, 35 + jy, 330, 390, rgba(18, 4, 6, 128));
            Draw.quad(
                200 + jx, 50 + jy, 440 + jx, 50 + jy,
                220 + jx, 260 + jy, 420 + jx, 260 + jy,
                rgba(205, 170, 162, 128), rgba(205, 170, 162, 128),
                rgba(110, 65, 65, 128), rgba(110, 65, 65, 128)
            );
            Draw.rect(232 + jx, 112 + jy, 64, 46, rgba(12, 0, 2, 128));
            Draw.rect(344 + jx, 112 + jy, 64, 46, rgba(12, 0, 2, 128));
            Draw.rect(252 + jx, 123 + jy, 24, 24, rgba(255, 25, 20, 128));
            Draw.rect(364 + jx, 123 + jy, 24, 24, rgba(255, 25, 20, 128));
            Draw.rect(258 + jx, 129 + jy, 12, 12, rgba(255, 235, 210, 128));
            Draw.rect(370 + jx, 129 + jy, 12, 12, rgba(255, 235, 210, 128));
            Draw.rect(245 + jx, 185 + jy, 150, 62, rgba(10, 0, 2, 128));
            for (let t = 0; t < 6; t++) {
                const tx = 252 + jx + t * 24;
                Draw.triangle(tx, 185 + jy, tx + 16, 185 + jy, tx + 8, 206 + jy, rgba(225, 205, 195, 128));
                Draw.triangle(tx, 247 + jy, tx + 16, 247 + jy, tx + 8, 226 + jy, rgba(225, 205, 195, 128));
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
                    resetGame();
                    switchState(STATE_PLAY);
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
