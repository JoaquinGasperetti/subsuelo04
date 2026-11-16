// ============================================================================
// SUBSUELO 04: EL ACECHADOR (PS2 3D Survival Horror - AthenaEnv V4)
// ============================================================================

import { createWorldGrid, isPosWalkable, getCell, LORE_MESSAGES } from "./src/map.js";
import { AI_PATROL, updateStalkerAI } from "./src/ai.js";
import { render3DWorld, renderAnimatedMapPDA } from "./src/renderer.js";

const { width: SCREEN_W, height: SCREEN_H } = Screen.getMode();
Screen.setVSync(true);

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
let mapAnim = 0.0;

// Gamefeel: flashes, fov dinamico, cansancio y alertas
let flashTint = { r: 0, g: 0, b: 0, alpha: 0 };
let popupText = "";
let popupTimer = 0;
let radioText = "";
let radioTimer = 0;
let currentFov = 1.05;
let flashlightWarmup = 1.0;
let exhausted = false;
let bumpCooldown = 0;

let worldGrid = createWorldGrid();
let breakerActive = false;
let fusesCollected = 0;

const player = {
    x: 10.0,
    y: 1.8,
    ang: Math.PI * 0.5,
    bobPhase: 0.0,
    battery: 100.0,
    flashlightOn: true,
    stamina: 100.0
};

const stalker = {
    x: 10.0,
    y: 15.5,
    baseSpeed: 0.024,
    state: AI_PATROL,
    targetX: 10.0,
    targetY: 10.0,
    alertTimer: 0,
    wpIdx: 0,
    nextNode: null
};

let entities = [];

let lastRumbleBig = -1;
let lastRumbleSmall = -1;
function triggerRumble(big, small) {
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
    mapAnim = 0.0;
    currentFov = 1.05;
    flashlightWarmup = 1.0;
    exhausted = false;
    bumpCooldown = 0;
    flashTint.alpha = 0;
    popupTimer = 0;

    player.x = 10.0;
    player.y = 1.8;
    player.ang = Math.PI * 0.5;
    player.bobPhase = 0.0;
    player.battery = 100.0;
    player.flashlightOn = true;
    player.stamina = 100.0;

    stalker.x = 10.0;
    stalker.y = 15.5;
    stalker.baseSpeed = 0.024;
    stalker.state = AI_PATROL;
    stalker.targetX = 10.0;
    stalker.targetY = 10.0;
    stalker.alertTimer = 0;
    stalker.wpIdx = 0;
    stalker.nextNode = null;

    entities = [
        { kind: "fuse", x: 10.0, y: 18.2, taken: false },
        { kind: "fuse", x: 10.0, y: 9.5,  taken: false },
        { kind: "fuse", x: 2.0,  y: 17.5, taken: false },
        { kind: "fuse", x: 18.0, y: 17.5, taken: false },

        { kind: "breaker", x: 10.0, y: 12.2, taken: false },

        { kind: "battery", x: 7.5,  y: 5.5,  taken: false },
        { kind: "battery", x: 1.8,  y: 2.0,  taken: false },
        { kind: "battery", x: 18.2, y: 2.0,  taken: false },

        { kind: "note", x: 10.0, y: 3.5,  taken: false, msgIdx: 0 },
        { kind: "note", x: 7.5,  y: 14.5, taken: false, msgIdx: 1 },
        { kind: "note", x: 2.5,  y: 9.5,  taken: false, msgIdx: 2 },
        { kind: "note", x: 17.5, y: 9.5,  taken: false, msgIdx: 3 }
    ];

    showRadio("OBJETIVO: Activa el Disyuntor rojo, junta 4 Fusibles y escapa al Sur.", 260);
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
    frameTick++;
    pad.update();

    if (gameState === STATE_TITLE) {
        player.ang = frameTick * 0.006;
        render3DWorld(SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities, 0.25, frameTick, false, 1.05, 1.0);

        Draw.rect(0, 0, SCREEN_W, SCREEN_H, Color.new(0, 0, 0, 76));
        Draw.rect(40, 38, SCREEN_W - 80, SCREEN_H - 76, Color.new(10, 4, 6, 108));

        fnt.scale = Math.fround(1.0);
        fnt.color = Color.new(240, 45, 45, 128);
        fnt.print(105, 60, "SUBSUELO 04: EL ACECHADOR");

        fnt.scale = Math.fround(0.55);
        fnt.color = Color.new(220, 220, 225, 128);
        fnt.print(68, 108, "Survival Horror 3D en Primera Persona (AthenaEnv PS2 / PCSX2)");
        fnt.print(68, 138, "1. Activa el DISYUNTOR ROJO para abrir las rejas Este y Oeste.");
        fnt.print(68, 160, "2. Recolecta los 4 FUSIBLES dorados y recoge baterias cyan.");
        fnt.print(68, 182, "3. Escapa por la COMPUERTA VERDE en el sector Sur.");

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
            return;
        }
        if (pad.justPressed(Pads.SELECT) || pad.justPressed(Pads.L2)) {
            mapOpen = !mapOpen;
        }
        if (pad.justPressed(Pads.TRIANGLE)) {
            player.flashlightOn = !player.flashlightOn;
            if (player.flashlightOn) flashlightWarmup = 0.25;
        }

        // Animacion suave del plano PDA
        if (mapOpen) mapAnim = Math.min(1.0, mapAnim + 0.11);
        else mapAnim = Math.max(0.0, mapAnim - 0.13);

        // Warmup de linterna al encender
        if (flashlightWarmup < 1.0) {
            flashlightWarmup = Math.min(1.0, flashlightWarmup + 0.14);
        }

        // Rotacion
        const rx = (pad.rx || 0) / 128.0;
        const turnSpeed = mapOpen ? 0.036 : 0.052;
        if (Math.abs(rx) > 0.18) player.ang += rx * turnSpeed;
        if (pad.pressed(Pads.L1)) player.ang -= turnSpeed;
        if (pad.pressed(Pads.R1)) player.ang += turnSpeed;

        // Movimiento
        let fwd = 0.0, strafe = 0.0;
        const lx = (pad.lx || 0) / 128.0;
        const ly = (pad.ly || 0) / 128.0;
        if (Math.abs(ly) > 0.18) fwd = -ly;
        if (Math.abs(lx) > 0.18) strafe = lx;
        if (pad.pressed(Pads.UP)) fwd = 1.0;
        if (pad.pressed(Pads.DOWN)) fwd = -1.0;
        if (pad.pressed(Pads.LEFT)) strafe = -1.0;
        if (pad.pressed(Pads.RIGHT)) strafe = 1.0;

        const isMoving = Math.abs(fwd) > 0.05 || Math.abs(strafe) > 0.05;
        const wantSprint = (pad.pressed(Pads.CIRCLE) || pad.pressed(Pads.SQUARE)) && isMoving && !mapOpen;
        const isSprinting = wantSprint && !exhausted && player.stamina > 2.0;

        if (isSprinting) {
            player.stamina = Math.max(0.0, player.stamina - 0.45);
            if (player.stamina <= 2.0) exhausted = true;
        } else {
            player.stamina = Math.min(100.0, player.stamina + (exhausted ? 0.18 : 0.26));
            if (exhausted && player.stamina >= 32.0) exhausted = false;
        }

        // FOV dinamico al correr
        const targetFov = isSprinting ? 1.15 : 1.05;
        currentFov += (targetFov - currentFov) * 0.14;

        const speed = isSprinting ? 0.082 : (mapOpen ? 0.032 : 0.048);
        const dirX = Math.cos(player.ang);
        const dirY = Math.sin(player.ang);
        const dx = (dirX * fwd - dirY * strafe) * speed;
        const dy = (dirY * fwd + dirX * strafe) * speed;

        let bumpedGate = false;
        if (isPosWalkable(worldGrid, player.x + dx, player.y, 0.25)) {
            player.x += dx;
        } else if (getCell(worldGrid, Math.floor(player.x + dx + (dx > 0 ? 0.28 : -0.28)), Math.floor(player.y)) === 5) {
            bumpedGate = true;
        }
        if (isPosWalkable(worldGrid, player.x, player.y + dy, 0.25)) {
            player.y += dy;
        } else if (getCell(worldGrid, Math.floor(player.x), Math.floor(player.y + dy + (dy > 0 ? 0.28 : -0.28))) === 5) {
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
            player.bobPhase += isSprinting ? 0.28 : 0.16;
        }

        if (player.flashlightOn && player.battery > 0.0) {
            player.battery = Math.max(0.0, player.battery - 0.018);
        }

        // Recoger entidades con feedback visual y tactil
        for (let i = 0; i < entities.length; i++) {
            const e = entities[i];
            if (e.taken) continue;
            if (Math.hypot(player.x - e.x, player.y - e.y) < 0.90) {
                e.taken = true;
                if (e.kind === "fuse") {
                    fusesCollected++;
                    stalker.baseSpeed += 0.003;
                    triggerScreenFlash(255, 200, 50, 56);
                    triggerRumble(160, 1);
                    showPopup("+1 FUSIBLE (" + fusesCollected + "/4)");
                    showRadio("FUSIBLE RECOLECTADO (" + fusesCollected + "/4). El Acechador se agita...", 190);
                } else if (e.kind === "battery") {
                    player.battery = Math.min(100.0, player.battery + 45.0);
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

        if (fusesCollected === 4 && player.y < 1.45 && player.x > 8.5 && player.x < 11.5) {
            triggerRumble(0, 0);
            gameState = STATE_WIN;
        }

        const ai = updateStalkerAI(stalker, worldGrid, player, isSprinting, isMoving, frameTick);
        const dangerRatio = Math.max(0.0, Math.min(1.0, (7.0 - ai.distP) / 7.0));

        // Latido por vibracion DualShock 2
        if (dangerRatio > 0.28 && (frameTick % Math.max(12, Math.floor(38 - dangerRatio * 24)) < 4)) {
            triggerRumble(Math.floor(dangerRatio * 185), 1);
        } else if (bumpCooldown < 52) {
            triggerRumble(0, 0);
        }

        if (ai.distP < 0.65) {
            jumpscareTimer = 42;
            gameState = STATE_JUMPSCARE;
            triggerRumble(255, 1);
        }

        render3DWorld(SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities, dangerRatio, frameTick, fusesCollected === 4, currentFov, flashlightWarmup);

        // Vineta de oscuridad / cansancio / peligro
        if (!player.flashlightOn || player.battery <= 0.0) {
            Draw.rect(0, 0, SCREEN_W, SCREEN_H, Color.new(0, 0, 8, 76));
        }
        if (exhausted) {
            const exAlpha = Math.floor(22 + Math.abs(Math.sin(frameTick * 0.14)) * 28);
            Draw.rect(0, 0, SCREEN_W, SCREEN_H, Color.new(10, 10, 24, exAlpha));
        }
        if (dangerRatio > 0.15) {
            const barY = (frameTick * 13) % (SCREEN_H - 18);
            Draw.rect(0, barY, SCREEN_W, 10, Color.new(210, 20, 20, Math.floor(dangerRatio * 78)));
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

        // Plano PDA animado (solo visible al apretar SELECT / L2)
        renderAnimatedMapPDA(SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities, dangerRatio, mapAnim, frameTick, fnt);

        // HUD Superior CRT/VHS
        Draw.rect(0, 0, SCREEN_W, 34, Color.new(0, 0, 0, 92));
        fnt.scale = Math.fround(0.52);
        fnt.color = Color.new(235, 55, 55, 128);
        if ((frameTick % 40) < 25) fnt.print(14, 8, "REC");
        fnt.color = Color.new(235, 235, 240, 128);
        fnt.print(62, 8, "FUSIBLES: " + fusesCollected + "/4");
        fnt.print(195, 8, "LUZ: " + Math.floor(player.battery) + "%");
        fnt.color = exhausted ? Color.new(255, 95, 95, 128) : Color.new(235, 235, 240, 128);
        fnt.print(305, 8, "STAMINA: " + Math.floor(player.stamina) + "%");
        fnt.color = Color.new(235, 235, 240, 128);
        fnt.print(445, 8, "PULSO: " + Math.floor(72 + dangerRatio * 118) + " BPM");

        // Popup central de feedback
        if (popupTimer > 0) {
            popupTimer--;
            fnt.scale = Math.fround(0.68);
            fnt.color = Color.new(255, 245, 140, 128);
            fnt.print(210, 56, popupText);
        }

        // Banner inferior de radio / pista de plano
        Draw.rect(0, SCREEN_H - 36, SCREEN_W, 36, Color.new(0, 0, 0, 95));
        fnt.scale = Math.fround(0.50);
        if (radioTimer > 0) {
            radioTimer--;
            fnt.color = Color.new(255, 230, 120, 128);
            fnt.print(14, SCREEN_H - 26, radioText);
        } else if (fusesCollected === 4) {
            fnt.color = Color.new(100, 255, 130, 128);
            fnt.print(14, SCREEN_H - 26, "COMPUERTA SUR DESBLOQUEADA! Corre hacia la salida verde. [SELECT/L2: Plano]");
        } else if (!breakerActive) {
            fnt.color = Color.new(210, 195, 145, 128);
            fnt.print(14, SCREEN_H - 26, "Busca el Disyuntor rojo al centro para abrir las rejas. [SELECT/L2: Plano]");
        } else {
            fnt.color = Color.new(210, 195, 145, 128);
            fnt.print(14, SCREEN_H - 26, "Rejas abiertas. Junta los 4 fusibles (" + fusesCollected + "/4). [SELECT/L2: Plano]");
        }
    } else if (gameState === STATE_PAUSE) {
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
        Draw.rect(0, 0, SCREEN_W, SCREEN_H, flash ? Color.new(180, 10, 10, 128) : Color.new(12, 0, 0, 128));
        const jx = Math.floor((Math.random() - 0.5) * 28);
        const jy = Math.floor((Math.random() - 0.5) * 28);
        Draw.rect(170 + jx, 40 + jy, 300, 370, Color.new(20, 4, 6, 128));
        Draw.rect(210 + jx, 60 + jy, 220, 180, Color.new(190, 155, 150, 128));
        Draw.rect(245 + jx, 125 + jy, 45, 32, Color.new(255, 15, 15, 128));
        Draw.rect(350 + jx, 125 + jy, 45, 32, Color.new(255, 15, 15, 128));
        Draw.rect(260 + jx, 190 + jy, 120, 38, Color.new(10, 0, 0, 128));
        if (jumpscareTimer <= 0) {
            triggerRumble(0, 0);
            gameState = STATE_DEAD;
        }
    } else if (gameState === STATE_WIN) {
        Draw.rect(0, 0, SCREEN_W, SCREEN_H, Color.new(6, 28, 12, 128));
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
        Draw.rect(0, 0, SCREEN_W, SCREEN_H, Color.new(50, 0, 0, 128));
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
