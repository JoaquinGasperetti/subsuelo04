// ============================================================================
// SUBSUELO 04: EL ACECHADOR (PS2 3D Survival Horror - AthenaEnv V4)
// ============================================================================

import { createWorldGrid, isPosWalkable, getCell, LORE_MESSAGES } from "./src/map.js";
import { AI_PATROL, updateStalkerAI } from "./src/ai.js";
import { render3DWorld, renderAnimatedMapPDA, renderStats } from "./src/renderer.js";
import { ENABLE_OVERLAYS, ENABLE_RUMBLE, F64_ZERO, toF64, fadd } from "./src/config.js";

const { width: SCREEN_W, height: SCREEN_H } = Screen.getMode();
Screen.setVSync(true);
try {
    Screen.setParam(Screen.DEPTH_TEST_ENABLE, false);
} catch (_) {}

const fnt = new Font("default");
const pad = Pads.get(0);

const STATE_TITLE     = 0;
const STATE_PLAY      = 1;
const STATE_PAUSE     = 2;
const STATE_JUMPSCARE = 3;
const STATE_WIN       = 4;
const STATE_DEAD      = 5;

let gameState = STATE_TITLE;
let frameTick = 0;
let jumpscareTimer = 0;
let elapsedFrames = 0;

// Mapa PDA (cerrado por defecto, animacion suave al abrir/cerrar)
let mapOpen = false;
let mapAnim = toF64(0.0);

// Gamefeel: flashes, fov dinamico, cansancio y alertas
let flashTint = { r: 0, g: 0, b: 0, alpha: 0 };
let popupText = "";
let popupTimer = 0;
let radioText = "";
let radioTimer = 0;
let currentFov = toF64(1.05);
let flashlightWarmup = toF64(1.0);
let exhausted = false;
let bumpCooldown = 0;
let debugMode = 0; // CROSS en juego: 0 apagado, 1 datos, 2 datos + paredes magenta

let worldGrid = createWorldGrid();
let breakerActive = false;
let fusesCollected = 0;

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
    nextNode: null
};

let entities = [];

let lastRumbleBig = -1;
let lastRumbleSmall = -1;
function triggerRumble(big, small) {
    if (!ENABLE_RUMBLE) return;
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
    if (!ENABLE_OVERLAYS) return;
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

function resetGame() {
    worldGrid = createWorldGrid();
    breakerActive = false;
    fusesCollected = 0;
    elapsedFrames = 0;
    mapOpen = false;
    mapAnim = toF64(0.0);
    currentFov = toF64(1.05);
    flashlightWarmup = toF64(1.0);
    exhausted = false;
    bumpCooldown = 0;
    flashTint.alpha = 0;
    popupTimer = 0;

    player.x = toF64(10.0);
    player.y = toF64(1.8);
    player.ang = toF64(Math.PI * 0.5);
    player.bobPhase = toF64(0.0);
    player.battery = toF64(100.0);
    player.flashlightOn = true;
    player.stamina = toF64(100.0);

    stalker.x = toF64(10.5);
    stalker.y = toF64(16.5);
    stalker.baseSpeed = toF64(0.024);
    stalker.state = AI_PATROL;
    stalker.targetX = toF64(10.0);
    stalker.targetY = toF64(10.0);
    stalker.alertTimer = 0;
    stalker.wpIdx = 0;
    stalker.nextNode = null;

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

    showRadio("OBJETIVO: Activa el Disyuntor rojo, junta 4 Fusibles y escapa al Norte.", 260);
    triggerRumble(0, 0);
}

resetGame();

let runtimeErr = null;
Screen.display(() => {
    if (runtimeErr !== null) {
        Draw.rect(0, 0, SCREEN_W, SCREEN_H, Color.new(55, 0, 0, 128));
        fnt.scale = Math.fround(0.55);
        fnt.color = Color.new(255, 220, 220, 128);
        fnt.print(16, 30, "ERROR EN TIEMPO DE EJECUCION:");
        fnt.print(16, 60, runtimeErr);
        return;
    }
    try {
    if (typeof Screen.DEPTH_TEST_ENABLE !== "undefined") {
        Screen.setParam(Screen.DEPTH_TEST_ENABLE, false);
    }
    frameTick++;
    pad.update();

    if (gameState === STATE_TITLE) {
        player.ang = toF64(frameTick * 0.006);
        render3DWorld(SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities, 0.25, frameTick, false, 1.05, 1.0, 1.0);

        Draw.rect(0, 0, SCREEN_W, SCREEN_H, Color.new(0, 0, 0, 76));
        Draw.rect(36, 34, SCREEN_W - 72, SCREEN_H - 68, Color.new(45, 18, 22, 110));
        Draw.rect(40, 38, SCREEN_W - 80, SCREEN_H - 76, Color.new(10, 4, 6, 118));

        fnt.scale = Math.fround(1.0);
        fnt.color = Color.new(240, 45, 45, 128);
        fnt.print(105, 60, "SUBSUELO 04: EL ACECHADOR");

        fnt.scale = Math.fround(0.55);
        fnt.color = Color.new(220, 220, 225, 128);
        fnt.print(68, 108, "Survival Horror 3D en Primera Persona (AthenaEnv PS2 / PCSX2)");
        fnt.print(68, 138, "1. Activa el DISYUNTOR ROJO para abrir las rejas Este y Oeste.");
        fnt.print(68, 160, "2. Recolecta los 4 FUSIBLES dorados y recoge baterias cyan.");
        fnt.print(68, 182, "3. Escapa por la COMPUERTA VERDE en el sector Norte.");

        fnt.color = Color.new(245, 200, 90, 128);
        fnt.print(68, 218, "CONTROLES DUALSHOCK 2:");
        fnt.color = Color.new(205, 205, 215, 128);
        fnt.print(68, 242, "- Stick Izq / D-Pad : Caminar | CIRCULO / CUADRADO : Correr");
        fnt.print(68, 264, "- Stick Der / L1-R1 : Girar camara en 1ra persona");
        fnt.print(68, 286, "- TRIANGULO : Linterna | SELECT / L2 : Levantar Plano");
        fnt.print(68, 308, "- START : Pausar partida");

        if ((frameTick % 50) < 35) {
            fnt.scale = Math.fround(0.72);
            fnt.color = Color.new(255, 240, 120, 128);
            fnt.print(140, 354, "PRESIONA [START] O [X] PARA INICIAR");
        }

        if (pad.justPressed(Pads.START) || pad.justPressed(Pads.CROSS)) {
            resetGame();
            gameState = STATE_PLAY;
        }
    } else if (gameState === STATE_PLAY) {
        elapsedFrames++;

        if (pad.justPressed(Pads.START)) {
            triggerRumble(0, 0);
            gameState = STATE_PAUSE;
        }
        if (pad.justPressed(Pads.SELECT) || pad.justPressed(Pads.L2)) {
            mapOpen = !mapOpen;
        }
        if (pad.justPressed(Pads.CROSS)) {
            debugMode = (debugMode + 1) % 3;
            renderStats.wallMode = (debugMode === 2) ? 1 : 0;
        }
        if (pad.justPressed(Pads.TRIANGLE)) {
            player.flashlightOn = !player.flashlightOn;
            if (player.flashlightOn) flashlightWarmup = toF64(0.25);
        }

        // Animacion suave del plano PDA
        if (mapOpen) mapAnim = toF64(Math.min(1.0, fadd(mapAnim, 0.11)));
        else mapAnim = toF64(Math.max(0.0, mapAnim - 0.13));

        // Warmup de linterna al encender
        if ((flashlightWarmup - 1.0) < 0) {
            flashlightWarmup = toF64(Math.min(1.0, fadd(flashlightWarmup, 0.14)));
        }

        // Rotacion
        const rx = toF64((pad.rx || 0) / 128.0);
        const turnSpeed = mapOpen ? 0.036 : 0.052;
        if ((Math.abs(rx) - 0.18) > 0) player.ang = fadd(player.ang, rx * turnSpeed);
        if (pad.pressed(Pads.L1)) player.ang = player.ang - turnSpeed;
        if (pad.pressed(Pads.R1)) player.ang = fadd(player.ang, turnSpeed);
        if ((player.ang - Math.PI) > 0) player.ang = player.ang - Math.PI * 2.0;
        else if ((player.ang - (-Math.PI)) < 0) player.ang = fadd(player.ang, Math.PI * 2.0);

        // Movimiento
        let fwd = F64_ZERO, strafe = F64_ZERO;
        const lx = toF64((pad.lx || 0) / 128.0);
        const ly = toF64((pad.ly || 0) / 128.0);
        if ((Math.abs(ly) - 0.18) > 0) fwd = -ly;
        if ((Math.abs(lx) - 0.18) > 0) strafe = lx;
        if (pad.pressed(Pads.UP)) fwd = toF64(1.0);
        if (pad.pressed(Pads.DOWN)) fwd = toF64(-1.0);
        if (pad.pressed(Pads.LEFT)) strafe = toF64(-1.0);
        if (pad.pressed(Pads.RIGHT)) strafe = toF64(1.0);

        const isMoving = ((Math.abs(fwd) - 0.05) > 0) || ((Math.abs(strafe) - 0.05) > 0);
        const wantSprint = (pad.pressed(Pads.CIRCLE) || pad.pressed(Pads.SQUARE)) && isMoving && !mapOpen;
        const isSprinting = wantSprint && !exhausted && ((player.stamina - 2.0) > 0);

        if (isSprinting) {
            player.stamina = toF64(Math.max(0.0, player.stamina - 0.45));
            if ((player.stamina - 2.0) <= 0) exhausted = true;
        } else {
            player.stamina = toF64(Math.min(100.0, fadd(player.stamina, exhausted ? 0.18 : 0.26)));
            if (exhausted && ((player.stamina - 32.0) >= 0)) exhausted = false;
        }

        // FOV dinamico al correr
        const targetFov = isSprinting ? 1.15 : 1.05;
        currentFov = fadd(currentFov, (targetFov - currentFov) * 0.14);

        const speed = isSprinting ? 0.082 : (mapOpen ? 0.032 : 0.048);
        const dirX = toF64(Math.cos(player.ang));
        const dirY = toF64(Math.sin(player.ang));
        const dx = (dirX * fwd - dirY * strafe) * speed;
        const dy = fadd(dirY * fwd, dirX * strafe) * speed;

        let bumpedGate = false;
        const nextX = fadd(player.x, dx);
        if (isPosWalkable(worldGrid, nextX, player.y, 0.25)) {
            player.x = nextX;
        } else if (getCell(worldGrid, Math.floor(fadd(nextX, (dx > 0) ? 0.28 : -0.28)), Math.floor(player.y)) === 5) {
            bumpedGate = true;
        }
        const nextY = fadd(player.y, dy);
        if (isPosWalkable(worldGrid, player.x, nextY, 0.25)) {
            player.y = nextY;
        } else if (getCell(worldGrid, Math.floor(player.x), Math.floor(fadd(nextY, (dy > 0) ? 0.28 : -0.28))) === 5) {
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
            player.bobPhase = fadd(player.bobPhase, isSprinting ? 0.28 : 0.16);
        }

        if (player.flashlightOn && ((player.battery - 0.0) > 0)) {
            player.battery = toF64(Math.max(0.0, player.battery - 0.018));
        }

        // Recoger entidades con feedback visual y tactil
        for (let i = 0; i < entities.length; i++) {
            const e = entities[i];
            if (e.taken) continue;
            if ((Math.hypot(player.x - toF64(e.x), player.y - toF64(e.y)) - 0.90) < 0) {
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
                    triggerScreenFlash(220, 230, 255, 38);
                    showPopup("REGISTRO ENCONTRADO");
                    showRadio(LORE_MESSAGES[e.msgIdx], 260);
                }
            }
        }

        if (fusesCollected === 4 && ((player.y - 1.45) < 0) && ((player.x - 8.5) > 0) && ((player.x - 11.5) < 0)) {
            triggerRumble(0, 0);
            gameState = STATE_WIN;
        }

        const ai = updateStalkerAI(stalker, worldGrid, player, isSprinting, isMoving, frameTick);
        const dangerRatio = toF64(Math.max(0.0, Math.min(1.0, (7.0 - toF64(ai.distP)) / 7.0)));

        // Latido por vibracion DualShock 2
        if (((dangerRatio - 0.28) > 0) && (frameTick % Math.max(12, Math.floor(38.0 - dangerRatio * 24.0)) < 4)) {
            triggerRumble(Math.floor(dangerRatio * 185.0), 1);
        } else if (bumpCooldown < 52) {
            triggerRumble(0, 0);
        }

        if ((toF64(ai.distP) - 0.65) < 0) {
            jumpscareTimer = 42;
            gameState = STATE_JUMPSCARE;
            triggerRumble(255, 1);
        }

        render3DWorld(SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities, dangerRatio, frameTick, fusesCollected === 4, currentFov, flashlightWarmup, mapAnim);

        if (ENABLE_OVERLAYS) {
            // Vineta de oscuridad / cansancio / peligro
            if (!player.flashlightOn || ((player.battery - 0.0) <= 0)) {
                Draw.rect(0, 0, SCREEN_W, SCREEN_H, Color.new(0, 0, 8, 72));
            }
            if (exhausted) {
                const exAlpha = Math.floor(fadd(22.0, Math.abs(Math.sin(frameTick * 0.14)) * 28.0));
                Draw.rect(0, 0, SCREEN_W, SCREEN_H, Color.new(10, 10, 24, exAlpha));
            }
            if ((dangerRatio - 0.15) > 0) {
                const barY = (frameTick * 13) % (SCREEN_H - 18);
                Draw.rect(0, barY, SCREEN_W, 10, Color.new(210, 20, 20, Math.floor(dangerRatio * 78.0)));
                if (ai.los && (frameTick % 14 < 7)) {
                    Draw.rect(0, 34, SCREEN_W, 4, Color.new(255, 30, 30, 95));
                    Draw.rect(0, SCREEN_H - 40, SCREEN_W, 4, Color.new(255, 30, 30, 95));
                }
            }

            // Flash de pickup / evento
            if (flashTint.alpha > 0) {
                Draw.rect(0, 0, SCREEN_W, SCREEN_H, Color.new(flashTint.r, flashTint.g, flashTint.b, Math.floor(flashTint.alpha)));
                flashTint.alpha = Math.max(0, flashTint.alpha - 4);
            }
        }

        // Plano PDA animado (solo visible al apretar SELECT / L2)
        renderAnimatedMapPDA(SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities, dangerRatio, mapAnim, frameTick, fnt);

        // HUD Superior CRT/VHS con barras graficas y monitor ECG
        Draw.rect(0, 0, SCREEN_W, 34, Color.new(4, 6, 10, 112));
        Draw.rect(0, 33, SCREEN_W, 1, Color.new(60, 80, 95, 110));
        fnt.scale = Math.fround(0.50);
        fnt.color = Color.new(245, 50, 50, 128);
        if ((frameTick % 40) < 25) {
            Draw.circle(14, 17, 4, Color.new(245, 40, 40, 128), true);
            fnt.print(22, 8, "REC");
        }
        fnt.color = Color.new(235, 235, 240, 128);
        fnt.print(68, 8, "FUSIBLES: " + fusesCollected + "/4");

        // Barra visual de Bateria
        fnt.print(192, 8, "LUZ:");
        Draw.rect(236, 11, 54, 12, Color.new(20, 30, 38, 128));
        const batFill = Math.max(0, Math.floor((player.battery / 100.0) * 50.0));
        const batCol = ((player.battery - 25.0) < 0) ? Color.new(255, 80, 45, 128) : Color.new(55, 225, 255, 128);
        if (batFill > 0) Draw.rect(238, 13, batFill, 8, batCol);

        // Barra visual de Stamina
        fnt.color = exhausted ? Color.new(255, 95, 95, 128) : Color.new(235, 235, 240, 128);
        fnt.print(302, 8, "STAM:");
        Draw.rect(354, 11, 54, 12, Color.new(25, 25, 32, 128));
        const stamFill = Math.max(0, Math.floor((player.stamina / 100.0) * 50.0));
        const stamCol = exhausted ? Color.new(255, 65, 65, 128) : Color.new(95, 240, 135, 128);
        if (stamFill > 0) Draw.rect(356, 13, stamFill, 8, stamCol);

        // Monitor de Pulso BPM + onda ECG en tiempo real
        const bpm = Math.floor(fadd(72.0, dangerRatio * 118.0));
        const ecgCol = ((dangerRatio - 0.45) > 0) ? Color.new(255, 65, 65, 128) : Color.new(90, 245, 130, 128);
        fnt.color = ecgCol;
        fnt.print(422, 8, "BPM:" + bpm);
        const ecgBaseX = 505;
        const ecgW = 120;
        Draw.rect(ecgBaseX, 6, ecgW, 22, Color.new(6, 14, 10, 120));
        const beatPeriod = Math.max(10, Math.floor(34.0 - dangerRatio * 18.0));
        let prevEx = ecgBaseX;
        let prevEy = 17;
        for (let ex = 0; ex < ecgW; ex += 4) {
            const ph = (ex + frameTick * 2) % beatPeriod;
            let ey = 17;
            if (ph === 2) ey = 13;
            else if (ph === 4) ey = 7;
            else if (ph === 6) ey = 25;
            else if (ph === 8) ey = 14;
            Draw.line(prevEx, prevEy, ecgBaseX + ex, ey, ecgCol);
            prevEx = ecgBaseX + ex;
            prevEy = ey;
        }

        if (debugMode > 0) {
            let fps = -1;
            try { fps = Math.floor(Screen.getFPS(60)); } catch (_) {}
            Draw.rect(0, 34, SCREEN_W, 20, Color.new(0, 0, 0, 110));
            fnt.scale = Math.fround(0.45);
            fnt.color = Color.new(120, 255, 120, 128);
            fnt.print(8, 38, "X:" + player.x.toFixed(2) + " Y:" + player.y.toFixed(2) + " A:" + player.ang.toFixed(2) +
                " COLS:" + renderStats.cols + " D:" + renderStats.minD.toFixed(1) + "-" + renderStats.maxD.toFixed(1) +
                " FPS:" + fps + " M:" + debugMode);
        }

        // Popup central de feedback
        if (popupTimer > 0) {
            popupTimer--;
            fnt.scale = Math.fround(0.68);
            fnt.color = Color.new(255, 245, 140, 128);
            fnt.print(210, 56, popupText);
        }

        // Banner inferior de radio / pista de plano
        Draw.rect(0, SCREEN_H - 36, SCREEN_W, 36, Color.new(4, 6, 10, 112));
        Draw.rect(0, SCREEN_H - 36, SCREEN_W, 1, Color.new(60, 80, 95, 110));
        fnt.scale = Math.fround(0.50);
        if (radioTimer > 0) {
            radioTimer--;
            fnt.color = Color.new(255, 230, 120, 128);
            fnt.print(14, SCREEN_H - 26, radioText);
        } else if (fusesCollected === 4) {
            fnt.color = Color.new(100, 255, 130, 128);
            fnt.print(14, SCREEN_H - 26, "COMPUERTA NORTE DESBLOQUEADA! Corre hacia la salida verde. [SELECT/L2: Plano]");
        } else if (!breakerActive) {
            fnt.color = Color.new(210, 195, 145, 128);
            fnt.print(14, SCREEN_H - 26, "Busca el Disyuntor rojo al centro para abrir las rejas. [SELECT/L2: Plano]");
        } else {
            fnt.color = Color.new(210, 195, 145, 128);
            fnt.print(14, SCREEN_H - 26, "Rejas abiertas. Junta los 4 fusibles (" + fusesCollected + "/4). [SELECT/L2: Plano]");
        }
    } else if (gameState === STATE_PAUSE) {
        render3DWorld(SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities, 0.0, frameTick, fusesCollected === 4, currentFov, flashlightWarmup, mapAnim);
        Draw.rect(0, 0, SCREEN_W, SCREEN_H, Color.new(0, 0, 0, 96));
        fnt.scale = Math.fround(0.95);
        fnt.color = Color.new(240, 240, 245, 128);
        fnt.print(230, 150, "PAUSA");
        fnt.scale = Math.fround(0.60);
        fnt.print(150, 215, "[START] Continuar | [TRIANGULO] Reiniciar");
        if (pad.justPressed(Pads.START)) gameState = STATE_PLAY;
        if (pad.justPressed(Pads.TRIANGLE)) { resetGame(); gameState = STATE_PLAY; }
    } else if (gameState === STATE_JUMPSCARE) {
        jumpscareTimer--;
        const flash = (jumpscareTimer % 4 < 2);
        Draw.rect(0, 0, SCREEN_W, SCREEN_H, flash ? Color.new(165, 8, 12, 128) : Color.new(10, 0, 2, 128));
        const jx = Math.floor((Math.random() - 0.5) * 32);
        const jy = Math.floor((Math.random() - 0.5) * 32);
        // Silueta y craneo distorsionado en primer plano con colmillos y ojos incandescentes
        Draw.rect(155 + jx, 35 + jy, 330, 390, Color.new(18, 4, 6, 128));
        Draw.quad(
            200 + jx, 50 + jy, 440 + jx, 50 + jy,
            220 + jx, 260 + jy, 420 + jx, 260 + jy,
            Color.new(205, 170, 162, 128), Color.new(205, 170, 162, 128),
            Color.new(110, 65, 65, 128), Color.new(110, 65, 65, 128)
        );
        // Cuencas oculares y pupilas rojas brillantes
        Draw.rect(232 + jx, 112 + jy, 64, 46, Color.new(12, 0, 2, 128));
        Draw.rect(344 + jx, 112 + jy, 64, 46, Color.new(12, 0, 2, 128));
        Draw.circle(264 + jx, 135 + jy, 14, Color.new(255, 25, 20, 128), true);
        Draw.circle(376 + jx, 135 + jy, 14, Color.new(255, 25, 20, 128), true);
        Draw.circle(264 + jx, 135 + jy, 6, Color.new(255, 235, 210, 128), true);
        Draw.circle(376 + jx, 135 + jy, 6, Color.new(255, 235, 210, 128), true);
        // Fauces abiertas con dientes
        Draw.rect(245 + jx, 185 + jy, 150, 62, Color.new(10, 0, 2, 128));
        for (let t = 0; t < 6; t++) {
            const tx = 252 + jx + t * 24;
            Draw.triangle(tx, 185 + jy, tx + 16, 185 + jy, tx + 8, 206 + jy, Color.new(225, 205, 195, 128));
            Draw.triangle(tx, 247 + jy, tx + 16, 247 + jy, tx + 8, 226 + jy, Color.new(225, 205, 195, 128));
        }
        if (jumpscareTimer <= 0) {
            triggerRumble(0, 0);
            gameState = STATE_DEAD;
        }
    } else if (gameState === STATE_WIN) {
        render3DWorld(SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities, 0.0, frameTick, true, 1.05, 1.0, 1.0);
        Draw.rect(0, 0, SCREEN_W, SCREEN_H, Color.new(4, 24, 10, 96));
        Draw.rect(80, 95, SCREEN_W - 160, 220, Color.new(8, 32, 16, 118));
        Draw.rect(84, 99, SCREEN_W - 168, 212, Color.new(4, 14, 8, 124));
        const secs = Math.floor(elapsedFrames / 60);
        fnt.scale = Math.fround(0.95);
        fnt.color = Color.new(110, 255, 140, 128);
        fnt.print(130, 130, "ESCAPASTE DEL SUBSUELO 04!");
        fnt.scale = Math.fround(0.62);
        fnt.color = Color.new(225, 240, 225, 128);
        fnt.print(130, 195, "Tiempo de escape: " + secs + " segundos");
        fnt.print(145, 260, "Presiona [START] o [X] para volver a jugar");
        if (pad.justPressed(Pads.START) || pad.justPressed(Pads.CROSS)) {
            resetGame();
            gameState = STATE_PLAY;
        }
    } else if (gameState === STATE_DEAD) {
        render3DWorld(SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities, 1.0, frameTick, fusesCollected === 4, 1.15, 0.25, 1.0);
        Draw.rect(0, 0, SCREEN_W, SCREEN_H, Color.new(45, 0, 4, 102));
        Draw.rect(70, 105, SCREEN_W - 140, 210, Color.new(60, 12, 16, 118));
        Draw.rect(74, 109, SCREEN_W - 148, 202, Color.new(18, 2, 4, 124));
        fnt.scale = Math.fround(1.0);
        fnt.color = Color.new(255, 60, 60, 128);
        fnt.print(140, 140, "SENAL PERDIDA - TE ALCANZO");
        fnt.scale = Math.fround(0.60);
        fnt.color = Color.new(240, 205, 205, 128);
        fnt.print(105, 205, "Consejo: Apaga la linterna para esconderte o enfocalo de frente.");
        fnt.print(150, 265, "Presiona [START] o [X] para reintentar");
        if (pad.justPressed(Pads.START) || pad.justPressed(Pads.CROSS)) {
            resetGame();
            gameState = STATE_PLAY;
        }
    }
    } catch (e) {
        runtimeErr = String(e) + " | " + String(e && e.stack ? e.stack : "").replace(/\n/g, " ");
    }
});