// ============================================================================
// Interfaz completa de Menús PS2 (Título, Opciones, Pausa, Expediente, Finales)
// Diseñada con área segura CRT para evitar recortes por overscan en TV reales
// ============================================================================
import {
    GAME_SETTINGS, QUALITY_LABELS, SENS_LABELS, DIFF_LABELS, rgba
} from "./config.js";
import { LORE_NOTES } from "./map.js";
import { RECORDS } from "./storage.js";
import { isAudioReady } from "./audio.js";

const COL_BG_DIM     = rgba(0, 0, 4, 88);
const COL_BORDER_RED = rgba(120, 26, 30, 122);
const COL_PANEL_BG   = rgba(8, 6, 10, 122);
const COL_HEADER_BG  = rgba(34, 10, 14, 124);
const COL_SEL_BG     = rgba(115, 22, 28, 118);
const COL_SEL_BAR    = rgba(245, 65, 65, 128);
const COL_TITLE_RED  = rgba(242, 48, 48, 128);
const COL_WHITE      = rgba(236, 236, 242, 128);
const COL_MUTED      = rgba(155, 160, 172, 128);
const COL_GOLD       = rgba(250, 215, 95, 128);
const COL_CYAN       = rgba(85, 225, 255, 128);
const COL_GREEN      = rgba(95, 245, 135, 128);

export function getSafeMargins() {
    return GAME_SETTINGS.crtSafe
        ? { sx: 28, sy: 18 }
        : { sx: 10, sy: 6 };
}

function drawPanel(x, y, w, h, title, fnt, accentCol = COL_BORDER_RED) {
    Draw.rect(x - 3, y - 3, w + 6, h + 6, accentCol);
    Draw.rect(x, y, w, h, COL_PANEL_BG);
    if (title) {
        Draw.rect(x, y, w, 30, COL_HEADER_BG);
        Draw.rect(x, y + 30, w, 1, accentCol);
        fnt.scale = Math.fround(0.62);
        fnt.color = COL_WHITE;
        fnt.print(x + 14, y + 6, title);
    }
}

function formatTime(secs) {
    const m = (secs / 60) | 0;
    const s = secs % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
}

export function drawTitleMenu(screenW, screenH, cursor, frameTick, fnt) {
    const { sx, sy } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, COL_BG_DIM);

    // Línea de barrido VHS sutil en pantalla de título
    if (GAME_SETTINGS.overlays) {
        const scanY = (frameTick * 3) % screenH;
        Draw.rect(0, scanY, screenW, 3, rgba(220, 45, 45, 26));
    }

    const panelW = screenW - sx * 2 - 20;
    const panelH = screenH - sy * 2 - 16;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, null, fnt);

    // Cabecera cinematográfica
    Draw.rect(px, py, panelW, 84, rgba(26, 6, 10, 124));
    Draw.rect(px, py + 84, panelW, 2, COL_SEL_BAR);

    const flicker = ((frameTick % 131) < 4) ? 0.55 : 1.0;
    fnt.scale = Math.fround(1.05);
    fnt.color = rgba((242 * flicker) | 0, (44 * flicker) | 0, (44 * flicker) | 0, 128);
    fnt.print(px + 22, py + 14, "SUBSUELO 04");

    fnt.scale = Math.fround(0.56);
    fnt.color = COL_GOLD;
    fnt.print(px + 24, py + 54, "EL ACECHADOR  |  PS2 SURVIVAL HORROR EDITION");

    // Insignia de récord / Memory Card
    fnt.scale = Math.fround(0.44);
    const best = GAME_SETTINGS.difficulty === 1 ? RECORDS.bestNightmareSec : RECORDS.bestNormalSec;
    if (best > 0) {
        fnt.color = COL_GREEN;
        fnt.print(px + panelW - 185, py + 20, "RECORD: " + formatTime(best));
    } else {
        fnt.color = COL_MUTED;
        fnt.print(px + panelW - 185, py + 20, "PS2 REAL READY");
    }
    fnt.color = RECORDS.mcAvailable ? COL_CYAN : COL_MUTED;
    fnt.print(px + panelW - 185, py + 38, RECORDS.mcAvailable ? "MC0: DETECTADA" : "MC0: SIN GUARDADO");

    // Opciones del Menú Principal
    const items = [
        "NUEVA PARTIDA   < " + DIFF_LABELS[GAME_SETTINGS.difficulty] + " >",
        "OPCIONES Y VIDEO PS2",
        "CONTROLES DUALSHOCK 2",
        "EXPEDIENTE / HISTORIA",
        "CREDITOS Y HARDWARE"
    ];

    const listY = py + 106;
    const rowH = 38;
    for (let i = 0; i < items.length; i++) {
        const ry = listY + i * rowH;
        const selected = (i === cursor);
        if (selected) {
            Draw.rect(px + 20, ry - 4, panelW - 40, 30, COL_SEL_BG);
            Draw.rect(px + 20, ry - 4, 5, 30, COL_SEL_BAR);
        }
        fnt.scale = Math.fround(selected ? 0.64 : 0.56);
        fnt.color = selected ? COL_GOLD : COL_WHITE;
        fnt.print(px + (selected ? 38 : 34), ry + 1, (selected ? "> " : "  ") + items[i]);
    }

    // Pie de navegación
    const footY = py + panelH - 36;
    Draw.rect(px, footY - 8, panelW, 1, rgba(70, 35, 40, 110));
    fnt.scale = Math.fround(0.44);
    fnt.color = COL_MUTED;
    fnt.print(px + 20, footY, "[ARRIBA/ABAJO] Elegir   [IZQ/DER] Dificultad   [X/START] Aceptar");
}

export function drawOptionsMenu(screenW, screenH, cursor, saveFeedbackTimer, fnt) {
    const { sx, sy } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, COL_BG_DIM);

    const panelW = screenW - sx * 2 - 12;
    const panelH = screenH - sy * 2 - 12;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, "OPCIONES DE SISTEMA Y VIDEO PS2", fnt);

    const rows = [
        { label: "CALIDAD 3D (RAYOS)",   val: QUALITY_LABELS[GAME_SETTINGS.qualityIndex] },
        { label: "MARGEN TV CRT",        val: GAME_SETTINGS.crtSafe ? "SEGURO (CRT)" : "COMPLETO (HD)" },
        { label: "SENSIBILIDAD CAMARA",  val: SENS_LABELS[GAME_SETTINGS.sensitivityIndex] },
        { label: "VIBRACION DUALSHOCK2", val: GAME_SETTINGS.rumble ? "ACTIVADA" : "DESACTIVADA" },
        { label: "EFECTOS VHS / POLVO",  val: GAME_SETTINGS.overlays ? "ACTIVADOS" : "DESACTIVADOS" },
        { label: "AUDIO AMBIENTE",       val: isAudioReady() ? (GAME_SETTINGS.audioVolume + "%") : "NO DISPONIBLE" },
        { label: "CONTADOR DE FPS",      val: GAME_SETTINGS.showFps ? "VISIBLE" : "OCULTO" },
        { label: "GUARDAR Y VOLVER",     val: "[X]" }
    ];

    const startY = py + 44;
    const rowH = 34;
    for (let i = 0; i < rows.length; i++) {
        const ry = startY + i * rowH;
        const sel = (i === cursor);
        if (sel) {
            Draw.rect(px + 14, ry - 3, panelW - 28, 28, COL_SEL_BG);
            Draw.rect(px + 14, ry - 3, 4, 28, COL_SEL_BAR);
        }
        fnt.scale = Math.fround(0.52);
        fnt.color = sel ? COL_GOLD : COL_WHITE;
        fnt.print(px + 26, ry + 2, rows[i].label);

        fnt.color = sel ? COL_CYAN : COL_MUTED;
        const valText = (i < rows.length - 1) ? ("< " + rows[i].val + " >") : rows[i].val;
        fnt.print(px + panelW - 215, ry + 2, valText);
    }

    const footY = py + panelH - 34;
    Draw.rect(px, footY - 8, panelW, 1, rgba(70, 35, 40, 110));
    fnt.scale = Math.fround(0.44);
    if (saveFeedbackTimer > 0) {
        fnt.color = COL_GREEN;
        fnt.print(px + 18, footY, "Ajustes aplicados (guardados en Memory Card si esta disponible).");
    } else {
        fnt.color = COL_MUTED;
        fnt.print(px + 18, footY, "[IZQ/DER] Cambiar valor   [X] Aceptar   [CIRCULO] Volver");
    }
}

export function drawControlsMenu(screenW, screenH, fnt) {
    const { sx, sy } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, COL_BG_DIM);

    const panelW = screenW - sx * 2 - 12;
    const panelH = screenH - sy * 2 - 12;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, "CONTROLES DUALSHOCK 2", fnt);

    const bindings = [
        ["STICK IZQ / D-PAD",  "Caminar y desplazamiento lateral"],
        ["STICK DER / L1-R1",  "Girar camara en primera persona"],
        ["CIRCULO / CUADRADO", "Correr (consume stamina y genera ruido)"],
        ["TRIANGULO",          "Encender / apagar linterna tactica"],
        ["SELECT / L2",        "Desplegar u ocultar plano PDA"],
        ["START",              "Pausar partida / abrir menu"],
        ["R2",                 "Alternar diagnostico tecnico en juego"]
    ];

    let y = py + 48;
    for (let i = 0; i < bindings.length; i++) {
        Draw.rect(px + 16, y - 3, panelW - 32, 26, (i & 1) ? rgba(20, 16, 22, 95) : rgba(14, 12, 18, 95));
        fnt.scale = Math.fround(0.50);
        fnt.color = COL_GOLD;
        fnt.print(px + 24, y + 1, bindings[i][0]);
        fnt.color = COL_WHITE;
        fnt.print(px + 215, y + 1, bindings[i][1]);
        y += 32;
    }

    fnt.scale = Math.fround(0.46);
    fnt.color = COL_CYAN;
    fnt.print(px + 22, y + 10, "CONSEJO: Apaga la linterna para esconderte o ilumina al Acechador de frente.");

    const footY = py + panelH - 32;
    Draw.rect(px, footY - 8, panelW, 1, rgba(70, 35, 40, 110));
    fnt.scale = Math.fround(0.46);
    fnt.color = COL_GOLD;
    fnt.print(px + 20, footY, "Presiona [X] o [CIRCULO] para volver");
}

export function drawLoreMenu(screenW, screenH, collectedNotes, selectedNoteIdx, fromPause, fnt) {
    const { sx, sy } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, COL_BG_DIM);

    const panelW = screenW - sx * 2 - 12;
    const panelH = screenH - sy * 2 - 12;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    const title = fromPause ? "REGISTROS RECOLECTADOS" : "EXPEDIENTE - SUBSUELO 04";
    drawPanel(px, py, panelW, panelH, title, fnt);

    // Pestañas superiores para elegir nota 1..4
    const tabW = ((panelW - 44) / 4) | 0;
    for (let i = 0; i < LORE_NOTES.length; i++) {
        const tx = px + 16 + i * (tabW + 4);
        const sel = (i === selectedNoteIdx);
        const unlocked = !fromPause || collectedNotes[i];
        Draw.rect(tx, py + 42, tabW, 24, sel ? COL_SEL_BG : rgba(20, 18, 24, 110));
        if (sel) Draw.rect(tx, py + 64, tabW, 2, COL_SEL_BAR);
        fnt.scale = Math.fround(0.45);
        fnt.color = sel ? COL_GOLD : (unlocked ? COL_WHITE : COL_MUTED);
        fnt.print(tx + 8, py + 47, unlocked ? ("NOTA #0" + (i + 1)) : ("BLOQ #0" + (i + 1)));
    }

    const note = LORE_NOTES[selectedNoteIdx];
    const unlocked = !fromPause || collectedNotes[selectedNoteIdx];
    const bodyY = py + 82;

    if (unlocked) {
        fnt.scale = Math.fround(0.56);
        fnt.color = COL_GOLD;
        fnt.print(px + 20, bodyY, note.code);

        fnt.scale = Math.fround(0.49);
        fnt.color = COL_WHITE;
        for (let l = 0; l < note.lines.length; l++) {
            fnt.print(px + 20, bodyY + 34 + l * 26, note.lines[l]);
        }
    } else {
        fnt.scale = Math.fround(0.56);
        fnt.color = COL_MUTED;
        fnt.print(px + 20, bodyY + 24, "REGISTRO NO ENCONTRADO EN ESTA PARTIDA");
        fnt.scale = Math.fround(0.48);
        fnt.print(px + 20, bodyY + 62, "Explora los pasillos del Subsuelo 04 y recoge las hojas");
        fnt.print(px + 20, bodyY + 88, "blancas marcadas en el plano PDA para desbloquearlo.");
    }

    const footY = py + panelH - 32;
    Draw.rect(px, footY - 8, panelW, 1, rgba(70, 35, 40, 110));
    fnt.scale = Math.fround(0.45);
    fnt.color = COL_MUTED;
    fnt.print(px + 18, footY, "[IZQ/DER] Cambiar registro   [X / CIRCULO] Volver");
}

export function drawCreditsMenu(screenW, screenH, modeInfo, fnt) {
    const { sx, sy } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, COL_BG_DIM);

    const panelW = screenW - sx * 2 - 12;
    const panelH = screenH - sy * 2 - 12;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, "CREDITOS E INFORMACION DEL SISTEMA", fnt);

    fnt.scale = Math.fround(0.62);
    fnt.color = COL_TITLE_RED;
    fnt.print(px + 22, py + 48, "SUBSUELO 04: EL ACECHADOR");

    fnt.scale = Math.fround(0.50);
    fnt.color = COL_WHITE;
    fnt.print(px + 22, py + 84,  "Diseno y Desarrollo: Joaquin Gasperetti");
    fnt.print(px + 22, py + 112, "Motor Runtime PS2:   AthenaEnv V4 (QuickJS + GS)");
    fnt.print(px + 22, py + 140, "Render 3D:           Raycaster DDA + Span Batching Gouraud");

    Draw.rect(px + 20, py + 174, panelW - 40, 1, rgba(70, 50, 55, 110));

    fnt.color = COL_GOLD;
    fnt.print(px + 22, py + 188, "TELEMETRIA DE CONSOLA:");
    fnt.scale = Math.fround(0.47);
    fnt.color = COL_CYAN;
    fnt.print(px + 22, py + 216, "Modo de video: " + screenW + "x" + screenH + " (" + modeInfo.vmodeLabel + ")");
    fnt.print(px + 22, py + 240, "Audio PS2 (audsrv): " + (isAudioReady() ? "ACTIVO (ambient.wav)" : "INACTIVO"));
    fnt.print(px + 22, py + 264, "Memory Card (mc0):  " + (RECORDS.mcAvailable ? "DISPONIBLE" : "NO DETECTADA"));
    fnt.print(px + 22, py + 288, "Escapes totales: " + RECORDS.escapes);

    const footY = py + panelH - 32;
    Draw.rect(px, footY - 8, panelW, 1, rgba(70, 35, 40, 110));
    fnt.scale = Math.fround(0.46);
    fnt.color = COL_GOLD;
    fnt.print(px + 20, footY, "Presiona [X] o [CIRCULO] para volver");
}

export function drawPauseMenu(screenW, screenH, cursor, notesFoundCount, fnt) {
    const { sx, sy } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, rgba(0, 0, 6, 98));

    const panelW = Math.min(430, screenW - sx * 2);
    const panelH = 290;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, "PAUSA - SUBSUELO 04", fnt);

    const items = [
        "CONTINUAR PARTIDA",
        "OPCIONES Y VIDEO PS2",
        "REGISTROS (" + notesFoundCount + "/4)",
        "CONTROLES",
        "REINICIAR PARTIDA",
        "VOLVER AL MENU PRINCIPAL"
    ];

    const startY = py + 46;
    const rowH = 34;
    for (let i = 0; i < items.length; i++) {
        const ry = startY + i * rowH;
        const sel = (i === cursor);
        if (sel) {
            Draw.rect(px + 16, ry - 3, panelW - 32, 28, COL_SEL_BG);
            Draw.rect(px + 16, ry - 3, 4, 28, COL_SEL_BAR);
        }
        fnt.scale = Math.fround(0.54);
        fnt.color = sel ? COL_GOLD : COL_WHITE;
        fnt.print(px + (sel ? 32 : 28), ry + 1, (sel ? "> " : "  ") + items[i]);
    }

    fnt.scale = Math.fround(0.42);
    fnt.color = COL_MUTED;
    fnt.print(px + 18, py + panelH - 24, "[X] Seleccionar   [START/CIRCULO] Continuar");
}

export function drawNoteOverlay(screenW, screenH, noteIdx, fnt) {
    const { sx } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, rgba(0, 0, 6, 96));

    const note = LORE_NOTES[noteIdx] || LORE_NOTES[0];
    const panelW = Math.min(540, screenW - sx * 2);
    const panelH = 248;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, note.code, fnt, rgba(160, 175, 200, 120));

    fnt.scale = Math.fround(0.49);
    fnt.color = COL_WHITE;
    for (let l = 0; l < note.lines.length; l++) {
        fnt.print(px + 18, py + 46 + l * 28, note.lines[l]);
    }

    Draw.rect(px, py + panelH - 36, panelW, 1, rgba(80, 90, 110, 110));
    fnt.scale = Math.fround(0.46);
    fnt.color = COL_GOLD;
    fnt.print(px + 18, py + panelH - 26, "Presiona [X] o [CIRCULO] para guardar registro y continuar");
}

export function drawEndScreen(screenW, screenH, isWin, cursor, secs, notesFound, difficulty, fnt) {
    const { sx } = getSafeMargins();
    const tint = isWin ? rgba(4, 26, 12, 98) : rgba(48, 0, 6, 106);
    const accent = isWin ? rgba(65, 210, 110, 124) : COL_BORDER_RED;
    Draw.rect(0, 0, screenW, screenH, tint);

    const panelW = Math.min(520, screenW - sx * 2);
    const panelH = 286;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, isWin ? "EVACUACION COMPLETADA" : "SENAL PERDIDA - TE ALCANZO", fnt, accent);

    if (isWin) {
        let rank = "C";
        if (secs <= 95 && notesFound >= 3) rank = "S";
        else if (secs <= 135) rank = "A";
        else if (secs <= 190) rank = "B";

        fnt.scale = Math.fround(0.74);
        fnt.color = COL_GREEN;
        fnt.print(px + 20, py + 46, "ESCAPASTE DEL SUBSUELO 04!");

        fnt.scale = Math.fround(0.52);
        fnt.color = COL_WHITE;
        fnt.print(px + 20, py + 88,  "Tiempo de escape: " + formatTime(secs) + " (" + secs + "s)");
        fnt.print(px + 20, py + 114, "Dificultad:       " + DIFF_LABELS[difficulty]);
        fnt.print(px + 20, py + 140, "Registros:        " + notesFound + "/4");

        fnt.scale = Math.fround(1.1);
        fnt.color = COL_GOLD;
        fnt.print(px + panelW - 115, py + 92, "RANGO " + rank);
    } else {
        fnt.scale = Math.fround(0.72);
        fnt.color = COL_TITLE_RED;
        fnt.print(px + 20, py + 50, "EL ACECHADOR TE ATRAPO");

        fnt.scale = Math.fround(0.50);
        fnt.color = COL_WHITE;
        fnt.print(px + 20, py + 96,  "Tiempo sobrevivido: " + formatTime(secs));
        fnt.color = COL_CYAN;
        fnt.print(px + 20, py + 128, "Consejo: Apaga la linterna [TRIANGULO] para ocultarte");
        fnt.print(px + 20, py + 152, "o enfoca directamente sus ojos para frenarlo.");
    }

    const opts = [isWin ? "JUGAR DE NUEVO" : "REINTENTAR", "VOLVER AL MENU PRINCIPAL"];
    const optY = py + 190;
    for (let i = 0; i < opts.length; i++) {
        const ry = optY + i * 36;
        const sel = (i === cursor);
        if (sel) {
            Draw.rect(px + 20, ry - 3, panelW - 40, 28, isWin ? rgba(20, 88, 42, 118) : COL_SEL_BG);
            Draw.rect(px + 20, ry - 3, 4, 28, isWin ? COL_GREEN : COL_SEL_BAR);
        }
        fnt.scale = Math.fround(0.54);
        fnt.color = sel ? COL_GOLD : COL_WHITE;
        fnt.print(px + 34, ry + 1, (sel ? "> " : "  ") + opts[i]);
    }
}

export function drawPadDisconnectedOverlay(screenW, screenH, fnt) {
    Draw.rect(0, 0, screenW, screenH, rgba(0, 0, 0, 112));
    const pw = 440;
    const ph = 110;
    const px = (screenW - pw) >> 1;
    const py = (screenH - ph) >> 1;
    drawPanel(px, py, pw, ph, "MANDO DESCONECTADO", fnt);
    fnt.scale = Math.fround(0.52);
    fnt.color = COL_GOLD;
    fnt.print(px + 20, py + 52, "Conecta un DualShock 2 en el Puerto 1 para continuar.");
}
