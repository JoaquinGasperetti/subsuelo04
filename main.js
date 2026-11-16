// ============================================================================
// SUBSUELO 04: EL ACECHADOR (Juego Completo 3D Survival Horror en PS2 / PCSX2)
// Motor: AthenaEnv V4 (JavaScript / QuickJS)
// ============================================================================

import { createWorldGrid, isPosWalkable, LORE_MESSAGES } from "./src/map.js";
import { AI_PATROL, updateStalkerAI } from "./src/ai.js";
import { render3DWorld, renderMinimap } from "./src/renderer.js";

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
let showMinimap = true;
let radioText = "";
let radioTimer = 0;
let elapsedFrames = 0;

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

function triggerRumble(big, small) {
    try {
        if (typeof Pads.rumble === "function") {
            Pads.rumble(0, big, small);
        }
    } catch (_) {}
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
        // 4 Fusibles (2 en sectores centrales, 2 detras de las rejas Este/Oeste)
        { kind: "fuse", x: 10.0, y: 18.2, taken: false },
        { kind: "fuse", x: 10.0, y: 9.5,  taken: false },
        { kind: "fuse", x: 2.0,  y: 17.5, taken: false },
        { kind: "fuse", x: 18.0, y: 17.5, taken: false },

        // Disyuntor Central (abre las rejas Este y Oeste)
        { kind: "breaker", x: 10.0, y: 12.2, taken: false },

        // 3 Baterias de repuesto
        { kind: "battery", x: 7.5,  y: 5.5,  taken: false },
        { kind: "battery", x: 1.8,  y: 2.0,  taken: false },
        { kind: "battery", x: 18.2, y: 2.0,  taken: false },

        // 4 Notas de lore / pistas
        { kind: "note", x: 10.0, y: 3.5,  taken: false, msgIdx: 0 },
        { kind: "note", x: 7.5,  y: 14.5, taken: false, msgIdx: 1 },
        { kind: "note", x: 2.5,  y: 9.5,  taken: false, msgIdx: 2 },
        { kind: "note", x: 17.5, y: 9.5,  taken: false, msgIdx: 3 }
    ];

    showRadio("OBJETIVO: Activa el Disyuntor rojo, junta 4 Fusibles y escapa al Sur.", 260);
    triggerRumble(0, 0);
}

resetGame();

Screen.display(() => {
    frameTick++;
    pad.update();

    if (gameState === STATE_TITLE) {
        player.ang = frameTick * 0.006;
        render3DWorld(SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities, 0.25, frameTick, false);

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
        fnt.print(68, 286, "- TRIANGULO : Linterna (apagarla te oculta) | SELECT : Mapa");
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
        if (pad.justPressed(Pads.SELECT)) {
            showMinimap = !showMinimap;
        }
        if (pad.justPressed(Pads.TRIANGLE)) {
            player.flashlightOn = !player.flashlightOn;
        }

        // Rotacion
        const rx = pad.rx / 128.0;
        const turnSpeed = 0.052;
        if (Math.abs(rx) > 0.18) player.ang += rx * turnSpeed;
        if (pad.pressed(Pads.L1)) player.ang -= turnSpeed;
        if (pad.pressed(Pads.R1)) player.ang += turnSpeed;

        // Movimiento
        let fwd = 0.0, strafe = 0.0;
        const lx = pad.lx / 128.0;
        const ly = pad.ly / 128.0;
        if (Math.abs(ly) > 0.18) fwd = -ly;
        if (Math.abs(lx) > 0.18) strafe = lx;
        if (pad.pressed(Pads.UP)) fwd = 1.0;
        if (pad.pressed(Pads.DOWN)) fwd = -1.0;
        if (pad.pressed(Pads.LEFT)) strafe = -1.0;
        if (pad.pressed(Pads.RIGHT)) strafe = 1.0;

        const isMoving = Math.abs(fwd) > 0.05 || Math.abs(strafe) > 0.05;
        const isSprinting = (pad.pressed(Pads.CIRCLE) || pad.pressed(Pads.SQUARE)) && player.stamina > 5.0 && isMoving;
        const speed = isSprinting ? 0.082 : 0.048;

        if (isSprinting) {
            player.stamina = Math.max(0.0, player.stamina - 0.42);
        } else {
            player.stamina = Math.min(100.0, player.stamina + 0.24);
        }

        const dirX = Math.cos(player.ang);
        const dirY = Math.sin(player.ang);
        const dx = (dirX * fwd - dirY * strafe) * speed;
        const dy = (dirY * fwd + dirX * strafe) * speed;

        if (isPosWalkable(worldGrid, player.x + dx, player.y)) player.x += dx;
        if (isPosWalkable(worldGrid, player.x, player.y + dy)) player.y += dy;

        if (isMoving) {
            player.bobPhase += isSprinting ? 0.26 : 0.16;
        }

        if (player.flashlightOn && player.battery > 0.0) {
            player.battery = Math.max(0.0, player.battery - 0.018);
        }

        // Recoger entidades
        for (let i = 0; i < entities.length; i++) {
            const e = entities[i];
            if (e.taken) continue;
            if (Math.hypot(player.x - e.x, player.y - e.y) < 0.85) {
                e.taken = true;
                if (e.kind === "fuse") {
                    fusesCollected++;
                    stalker.baseSpeed += 0.003;
                    showRadio("FUSIBLE RECOLECTADO (" + fusesCollected + "/4). El Acechador se agita...", 190);
                } else if (e.kind === "battery") {
                    player.battery = Math.min(100.0, player.battery + 45.0);
                    showRadio("BATERIA +45% RECUPERADA.", 140);
                } else if (e.kind === "breaker") {
                    breakerActive = true;
                    // Abrir todas las rejas (celdas con valor 5)
                    for (let gy = 0; gy < worldGrid.length; gy++) {
                        for (let gx = 0; gx < worldGrid[gy].length; gx++) {
                            if (worldGrid[gy][gx] === 5) worldGrid[gy][gx] = 0;
                        }
                    }
                    showRadio("DISYUNTOR ACTIVADO: Se abrieron las rejas Este y Oeste!", 240);
                } else if (e.kind === "note") {
                    showRadio(LORE_MESSAGES[e.msgIdx], 260);
                }
            }
        }

        // Victoria al cruzar la compuerta sur con los 4 fusibles
        if (fusesCollected === 4 && player.y < 1.35 && player.x > 8.6 && player.x < 11.4) {
            triggerRumble(0, 0);
            gameState = STATE_WIN;
        }

        // IA del Acechador con BFS
        const ai = updateStalkerAI(stalker, worldGrid, player, isSprinting, isMoving, frameTick);
        const dangerRatio = Math.max(0.0, Math.min(1.0, (7.0 - ai.distP) / 7.0));

        // Latido por vibracion DualShock 2
        if (dangerRatio > 0.30 && (frameTick % Math.max(12, Math.floor(38 - dangerRatio * 24)) < 4)) {
            triggerRumble(Math.floor(dangerRatio * 180), 1);
        } else {
            triggerRumble(0, 0);
        }

        if (ai.distP < 0.62) {
            jumpscareTimer = 42;
            gameState = STATE_JUMPSCARE;
            triggerRumble(255, 1);
        }

        render3DWorld(SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities, dangerRatio, frameTick, fusesCollected === 4);

        // Vineta de oscuridad y VHS
        if (!player.flashlightOn || player.battery <= 0.0) {
            Draw.rect(0, 0, SCREEN_W, SCREEN_H, Color.new(0, 0, 8, 76));
        }
        if (dangerRatio > 0.15) {
            const barY = (frameTick * 13) % (SCREEN_H - 18);
            Draw.rect(0, barY, SCREEN_W, 10, Color.new(210, 20, 20, Math.floor(dangerRatio * 78)));
        }

        if (showMinimap) {
            renderMinimap(SCREEN_W, SCREEN_H, worldGrid, player, stalker, entities, dangerRatio);
        }

        // HUD Superior CRT/VHS
        Draw.rect(0, 0, SCREEN_W, 34, Color.new(0, 0, 0, 92));
        fnt.scale = Math.fround(0.52);
        fnt.color = Color.new(235, 55, 55, 128);
        if ((frameTick % 40) < 25) fnt.print(14, 8, "REC");
        fnt.color = Color.new(235, 235, 240, 128);
        fnt.print(62, 8, "FUSIBLES: " + fusesCollected + "/4");
        fnt.print(195, 8, "LUZ: " + Math.floor(player.battery) + "%");
        fnt.print(305, 8, "STAMINA: " + Math.floor(player.stamina) + "%");
        fnt.print(445, 8, "PULSO: " + Math.floor(72 + dangerRatio * 118) + " BPM");

        // Banner inferior de radio / estado
        Draw.rect(0, SCREEN_H - 36, SCREEN_W, 36, Color.new(0, 0, 0, 95));
        if (radioTimer > 0) {
            radioTimer--;
            fnt.color = Color.new(255, 230, 120, 128);
            fnt.print(14, SCREEN_H - 27, radioText);
        } else if (fusesCollected === 4) {
            fnt.color = Color.new(100, 255, 130, 128);
            fnt.print(14, SCREEN_H - 27, "COMPUERTA SUR DESBLOQUEADA! Corre hacia la salida verde.");
        } else if (!breakerActive) {
            fnt.color = Color.new(210, 195, 145, 128);
            fnt.print(14, SCREEN_H - 27, "Busca el Disyuntor rojo al centro para abrir las rejas.");
        } else {
            fnt.color = Color.new(210, 195, 145, 128);
            fnt.print(14, SCREEN_H - 27, "Rejas abiertas. Junta los 4 fusibles (" + fusesCollected + "/4).");
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
});
