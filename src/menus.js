// ============================================================================
// Interfaz completa de Menús PS2 (Título, Opciones, Pausa, Expediente, Finales)
// Diseñada con área segura CRT para evitar recortes por overscan en TV reales
// ============================================================================




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

function getSafeMargins() {
    return GAME_SETTINGS.crtSafe
        ? { sx: 28, sy: 18 }
        : { sx: 10, sy: 6 };
}

function drawPanel(x, y, w, h, title, fnt, accentCol = COL_BORDER_RED) {
    Draw.rect(x - 3, y - 3, w + 6, h + 6, accentCol);
    Draw.rect(x, y, w, h, COL_PANEL_BG);
    if (title) {
        Draw.rect(x, y, w, 36, COL_HEADER_BG);
        Draw.rect(x, y + 36, w, 2, accentCol);
        fnt.scale = Math.fround(0.78);
        fnt.color = COL_WHITE;
        fnt.print(x + 14, y + 7, title);
    }
}

function formatTime(secs) {
    const m = (secs / 60) | 0;
    const s = secs % 60;
    const ms = m < 10 ? ["0", String(m)].join("") : String(m);
    const ss = s < 10 ? ["0", String(s)].join("") : String(s);
    return [ms, ":", ss].join("");
}

const TITLE_ITEMS_NORMAL = [
    "NUEVA PARTIDA   < NORMAL >",
    "OPCIONES Y VIDEO PS2",
    "CONTROLES DUALSHOCK 2",
    "EXPEDIENTE / HISTORIA",
    "CREDITOS Y HARDWARE",
    "CINEMATICAS (TEST)"
];
const TITLE_ITEMS_NIGHTMARE = [
    "NUEVA PARTIDA   < PESADILLA >",
    "OPCIONES Y VIDEO PS2",
    "CONTROLES DUALSHOCK 2",
    "EXPEDIENTE / HISTORIA",
    "CREDITOS Y HARDWARE",
    "CINEMATICAS (TEST)"
];
const CINEMATIC_MENU_ITEMS = [
    { title: "01. CAP 1 - INTRO RECUPERADA",  meta: "44s | 7 PLANOS | Subsuelo 04" },
    { title: "02. CAP 2 - TUNELES CALDERAS",  meta: "14s | 3 PLANOS | Nivel -2 y Valdez" },
    { title: "03. CAP 3 - CONTENCION RITUAL", meta: "14s | 3 PLANOS | Origen Sujeto 04" },
    { title: "04. FINAL - EVACUACION NORTE",  meta: "22s | 4 PLANOS | Escape a superficie" },
    { title: "VOLVER AL MENU PRINCIPAL",      meta: "Regresar al titulo" }
];
const DECOY_HUD_LABELS = ["SEN:0", "SEN:1", "SEN:2", "SEN:3"];
const LORE_TABS_OPEN = ["NOTA #01", "NOTA #02", "NOTA #03", "NOTA #04"];
const LORE_TABS_LOCK = ["BLOQ #01", "BLOQ #02", "BLOQ #03", "BLOQ #04"];
const PAUSE_REG_LABELS = ["REGISTROS (0/4)", "REGISTROS (1/4)", "REGISTROS (2/4)", "REGISTROS (3/4)", "REGISTROS (4/4)"];
const END_OPTS_WIN = ["JUGAR DE NUEVO", "VOLVER AL MENU PRINCIPAL"];
const END_OPTS_DEAD = ["REINTENTAR", "VOLVER AL MENU PRINCIPAL"];
const VOL_LABELS = ["0%", "25%", "50%", "75%", "100%"];
const FUSE_HUD_LABELS = ["FUS:0/4", "FUS:1/4", "FUS:2/4", "FUS:3/4", "FUS:4/4"];
const FUSE_POPUP_LABELS = ["+1 FUSIBLE (0/4)", "+1 FUSIBLE (1/4)", "+1 FUSIBLE (2/4)", "+1 FUSIBLE (3/4)", "+1 FUSIBLE (4/4)"];
const FUSE_RADIO_LABELS = [
    "FUSIBLE RECOLECTADO (0/4). El Acechador se agita...",
    "FUSIBLE RECOLECTADO (1/4). El Acechador se agita...",
    "FUSIBLE RECOLECTADO (2/4). El Acechador se agita...",
    "FUSIBLE RECOLECTADO (3/4). El Acechador se agita...",
    "FUSIBLE RECOLECTADO (4/4). SALIDA NORTE ABIERTA!"
];
const BREAKER_HUD_LABELS = [
    "JUNTA 4 FUSIBLES (0/4) [SELECT: MAPA]",
    "JUNTA 4 FUSIBLES (1/4) [SELECT: MAPA]",
    "JUNTA 4 FUSIBLES (2/4) [SELECT: MAPA]",
    "JUNTA 4 FUSIBLES (3/4) [SELECT: MAPA]",
    "SALIDA NORTE ABIERTA! [SELECT: MAPA]"
];

function drawTitleMenu(screenW, screenH, cursor, frameTick, fnt) {
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
    fnt.scale = Math.fround(1.25);
    fnt.color = rgba((242 * flicker) | 0, (44 * flicker) | 0, (44 * flicker) | 0, 128);
    fnt.print(px + 20, py + 10, "SUBSUELO 04");

    fnt.scale = Math.fround(0.76);
    fnt.color = COL_GOLD;
    fnt.print(px + 22, py + 52, "EL ACECHADOR - PS2");

    // Insignia de récord / Memory Card
    fnt.scale = Math.fround(0.72);
    const best = GAME_SETTINGS.difficulty === 1 ? RECORDS.bestNightmareSec : RECORDS.bestNormalSec;
    if (best > 0) {
        fnt.color = COL_GREEN;
        fnt.print(px + panelW - 210, py + 14, ["RECORD: ", formatTime(best)].join(""));
    } else {
        fnt.color = COL_MUTED;
        fnt.print(px + panelW - 210, py + 14, "HK ENTERTAINMENT");
    }
    fnt.color = RECORDS.mcAvailable ? COL_CYAN : COL_MUTED;
    fnt.print(px + panelW - 210, py + 44, RECORDS.mcAvailable ? "MC0: OK" : "SIN MC0");

    // Opciones del Menú Principal (cadenas estáticas sin concatenación por frame para QuickJS PS2)
    const items = GAME_SETTINGS.difficulty === 1 ? TITLE_ITEMS_NIGHTMARE : TITLE_ITEMS_NORMAL;

    const listY = py + 96;
    const rowH = 38;
    for (let i = 0; i < items.length; i++) {
        const ry = listY + i * rowH;
        const selected = (i === cursor);
        if (selected) {
            Draw.rect(px + 18, ry - 3, panelW - 36, 32, COL_SEL_BG);
            Draw.rect(px + 18, ry - 3, 6, 32, COL_SEL_BAR);
        }
        fnt.scale = Math.fround(selected ? 0.80 : 0.74);
        fnt.color = selected ? COL_GOLD : COL_WHITE;
        if (selected) {
            fnt.print(px + 32, ry + 2, ">");
            fnt.print(px + 54, ry + 2, items[i]);
        } else {
            fnt.print(px + 48, ry + 2, items[i]);
        }
    }

    // Pie de navegación
    const footY = py + panelH - 36;
    Draw.rect(px, footY - 8, panelW, 2, rgba(70, 35, 40, 110));
    fnt.scale = Math.fround(0.72);
    fnt.color = COL_WHITE;
    fnt.print(px + 18, footY, "[D-PAD] ELEGIR   [X/START] ACEPTAR");
}

function drawOptionsMenu(screenW, screenH, cursor, saveFeedbackTimer, fnt) {
    const { sx, sy } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, COL_BG_DIM);

    const panelW = screenW - sx * 2 - 12;
    const panelH = screenH - sy * 2 - 12;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, "OPCIONES DE SISTEMA Y VIDEO PS2", fnt);

    const volIdx = ((GAME_SETTINGS.audioVolume / 25) | 0);
    const volLabel = (volIdx >= 0 && volIdx < VOL_LABELS.length) ? VOL_LABELS[volIdx] : "0%";
    const audioVal = (GAME_SETTINGS.audioVolume === 0) ? "APAGADO" : (isAudioReady() ? volLabel : "SIN AUDIO");
    const qualityLabel = (GAME_SETTINGS.qualityIndex === 0 && hwStreamFailed)
        ? "ERROR VU1"
        : QUALITY_LABELS[GAME_SETTINGS.qualityIndex];
    const rows = [
        { label: "MOTOR GRAFICO",  val: qualityLabel },
        { label: "ASPECTO TV",     val: GAME_SETTINGS.aspect16x9 ? "16:9" : "4:3" },
        { label: "MARGEN CRT",     val: GAME_SETTINGS.crtSafe ? "SEGURO" : "COMPLETO" },
        { label: "SENSIBILIDAD",   val: SENS_LABELS[GAME_SETTINGS.sensitivityIndex] },
        { label: "VIBRACION",      val: GAME_SETTINGS.rumble ? "SI" : "NO" },
        { label: "EFECTOS VHS",    val: GAME_SETTINGS.overlays ? "SI" : "NO" },
        { label: "AUDIO",          val: audioVal },
        { label: "ESTADISTICAS PS2", val: GAME_SETTINGS.showFps ? "SI" : "NO" },
        { label: "OMITIR INTRO",   val: GAME_SETTINGS.skipIntro ? "SI" : "NO" },
        { label: "GUARDAR",        val: "[X]" }
    ];

    const startY = py + 44;
    const rowH = 30;
    for (let i = 0; i < rows.length; i++) {
        const ry = startY + i * rowH;
        const sel = (i === cursor);
        if (sel) {
            Draw.rect(px + 14, ry - 2, panelW - 28, 27, COL_SEL_BG);
            Draw.rect(px + 14, ry - 2, 5, 27, COL_SEL_BAR);
        }
        fnt.scale = Math.fround(0.72);
        fnt.color = sel ? COL_GOLD : COL_WHITE;
        fnt.print(px + 24, ry + 1, rows[i].label);

        fnt.color = sel ? COL_CYAN : COL_WHITE;
        const valText = (i < rows.length - 1) ? ["< ", String(rows[i].val), " >"].join("") : String(rows[i].val);
        fnt.print(px + panelW - 250, ry + 1, valText);
    }

    const footY = py + panelH - 36;
    Draw.rect(px, footY - 8, panelW, 2, rgba(70, 35, 40, 110));
    fnt.scale = Math.fround(0.70);
    if (saveFeedbackTimer > 0) {
        fnt.color = COL_GREEN;
        fnt.print(px + 18, footY, "AJUSTES GUARDADOS");
    } else {
        fnt.color = COL_WHITE;
        fnt.print(px + 18, footY, "[IZQ/DER] CAMBIAR   [X] OK   [O] VOLVER");
    }
}

function drawControlsMenu(screenW, screenH, fnt) {
    const { sx, sy } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, COL_BG_DIM);

    const panelW = screenW - sx * 2 - 12;
    const panelH = screenH - sy * 2 - 12;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, "CONTROLES DUALSHOCK 2", fnt);

    const bindings = [
        ["STICK IZQ / D-PAD",  "Caminar (con inercia)"],
        ["STICK DER / L1-R1",  "Girar la camara"],
        ["X (CRUZ)",           "Interactuar / Esconderse"],
        ["CIRCULO / ABAJO+O",  "Correr / Giro rapido 180"],
        ["CUADRADO",           "Agacharse (modo sigilo)"],
        ["TRIANGULO",          "Linterna ON / OFF"],
        ["L2 / SELECT",        "Lanzar senuelo / Mapa PDA"],
        ["START / R2",         "Pausa / Diagnostico PS2"]
    ];

    let y = py + 44;
    for (let i = 0; i < bindings.length; i++) {
        Draw.rect(px + 14, y - 2, panelW - 28, 27, (i & 1) ? rgba(20, 16, 22, 95) : rgba(14, 12, 18, 95));
        fnt.scale = Math.fround(0.72);
        fnt.color = COL_GOLD;
        fnt.print(px + 20, y + 1, bindings[i][0]);
        fnt.color = COL_WHITE;
        fnt.print(px + 245, y + 1, bindings[i][1]);
        y += 30;
    }

    fnt.scale = Math.fround(0.70);
    fnt.color = COL_CYAN;
    fnt.print(px + 20, y + 8, "TIP: Apaga la luz para ocultarte o iluminalo.");

    const footY = py + panelH - 34;
    Draw.rect(px, footY - 8, panelW, 2, rgba(70, 35, 40, 110));
    fnt.scale = Math.fround(0.70);
    fnt.color = COL_GOLD;
    fnt.print(px + 20, footY, "[X] o [CIRCULO] VOLVER");
}

function drawLoreMenu(screenW, screenH, collectedNotes, selectedNoteIdx, fromPause, fnt) {
    const { sx, sy } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, COL_BG_DIM);

    const panelW = screenW - sx * 2 - 12;
    const panelH = screenH - sy * 2 - 12;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    const title = fromPause ? "REGISTROS RECOLECTADOS" : "EXPEDIENTE - SUBSUELO 04";
    drawPanel(px, py, panelW, panelH, title, fnt);

    // Pestañas superiores en ventana de 4 (soporta 8 notas de campaña sin desbordar)
    const tabPage = (selectedNoteIdx >= 4) ? 4 : 0;
    const tabW = ((panelW - 44) / 4) | 0;
    for (let slot = 0; slot < 4; slot++) {
        const i = tabPage + slot;
        if (i >= LORE_NOTES.length) break;
        const tx = px + 16 + slot * (tabW + 4);
        const sel = (i === selectedNoteIdx);
        const unlocked = !fromPause || collectedNotes[i];
        Draw.rect(tx, py + 44, tabW, 28, sel ? COL_SEL_BG : rgba(20, 18, 24, 110));
        if (sel) Draw.rect(tx, py + 70, tabW, 2, COL_SEL_BAR);
        fnt.scale = Math.fround(0.72);
        fnt.color = sel ? COL_GOLD : (unlocked ? COL_WHITE : COL_MUTED);
        const openLbl = ["NOTA #0", String(i + 1)].join("");
        const lockLbl = ["BLOQ #0", String(i + 1)].join("");
        fnt.print(tx + 8, py + 48, unlocked ? openLbl : lockLbl);
    }

    const note = LORE_NOTES[selectedNoteIdx];
    const unlocked = !fromPause || collectedNotes[selectedNoteIdx];
    const bodyY = py + 88;

    if (unlocked) {
        fnt.scale = Math.fround(0.74);
        fnt.color = COL_GOLD;
        fnt.print(px + 20, bodyY, note.code);

        fnt.scale = Math.fround(0.74);
        fnt.color = COL_WHITE;
        for (let l = 0; l < note.lines.length; l++) {
            fnt.print(px + 20, bodyY + 36 + l * 32, note.lines[l]);
        }
    } else {
        fnt.scale = Math.fround(0.74);
        fnt.color = COL_MUTED;
        fnt.print(px + 20, bodyY + 24, "REGISTRO NO ENCONTRADO");
        fnt.scale = Math.fround(0.72);
        fnt.print(px + 20, bodyY + 66, "Explora el Subsuelo 04 y recoge las");
        fnt.print(px + 20, bodyY + 98, "hojas marcadas en el plano PDA.");
    }

    const footY = py + panelH - 34;
    Draw.rect(px, footY - 8, panelW, 2, rgba(70, 35, 40, 110));
    fnt.scale = Math.fround(0.70);
    fnt.color = COL_WHITE;
    fnt.print(px + 18, footY, fromPause
        ? "[IZQ/DER] NOTA   [X/CIRCULO] VOLVER"
        : "[IZQ/DER] NOTA   [TRIANG.] VER INTRO   [X/O] VOLVER");
}

function drawCreditsMenu(screenW, screenH, modeInfo, fnt) {
    const { sx, sy } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, COL_BG_DIM);

    const panelW = screenW - sx * 2 - 12;
    const panelH = screenH - sy * 2 - 12;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, "CREDITOS Y SISTEMA PS2", fnt);

    fnt.scale = Math.fround(0.80);
    fnt.color = COL_TITLE_RED;
    fnt.print(px + 22, py + 46, "SUBSUELO 04: EL ACECHADOR");

    fnt.scale = Math.fround(0.72);
    fnt.color = COL_WHITE;
    fnt.print(px + 22, py + 82,  "Estudio:   HK Entertainment");
    fnt.print(px + 22, py + 112, "Autor:     Joaquin Gasperetti");
    fnt.print(px + 22, py + 142, "Motor:     HK Engine 1");

    Draw.rect(px + 20, py + 176, panelW - 40, 2, rgba(70, 50, 55, 110));

    fnt.scale = Math.fround(0.74);
    fnt.color = COL_GOLD;
    fnt.print(px + 22, py + 186, "TELEMETRIA DE CONSOLA:");
    fnt.scale = Math.fround(0.70);
    fnt.color = COL_CYAN;
    fnt.print(px + 22, py + 218, ["Video: ", String(screenW), "x", String(screenH), " (", modeInfo.vmodeLabel, ")"].join(""));
    fnt.print(px + 22, py + 246, isAudioReady() ? "Audio PS2: ACTIVO" : "Audio PS2: INACTIVO");
    fnt.print(px + 22, py + 274, RECORDS.mcAvailable ? "Memory Card (mc0): OK" : "Memory Card (mc0): NO DETECTADA");
    fnt.print(px + 22, py + 302, ["Escapes totales: ", String(RECORDS.escapes)].join(""));

    const footY = py + panelH - 34;
    Draw.rect(px, footY - 8, panelW, 2, rgba(70, 35, 40, 110));
    fnt.scale = Math.fround(0.70);
    fnt.color = COL_GOLD;
    fnt.print(px + 20, footY, "[X] o [CIRCULO] VOLVER");
}

function drawPauseMenu(screenW, screenH, cursor, notesFoundCount, fnt) {
    const { sx, sy } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, rgba(0, 0, 6, 98));

    const panelW = Math.min(490, screenW - sx * 2);
    const panelH = 336;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, "PAUSA", fnt);

    const items = [
        "CONTINUAR PARTIDA",
        "OPCIONES Y VIDEO PS2",
        PAUSE_REG_LABELS[notesFoundCount] || "REGISTROS (0/4)",
        "CONTROLES",
        "REINICIAR PARTIDA",
        "VOLVER AL MENU PRINCIPAL"
    ];

    const startY = py + 50;
    const rowH = 39;
    for (let i = 0; i < items.length; i++) {
        const ry = startY + i * rowH;
        const sel = (i === cursor);
        if (sel) {
            Draw.rect(px + 16, ry - 3, panelW - 32, 33, COL_SEL_BG);
            Draw.rect(px + 16, ry - 3, 5, 33, COL_SEL_BAR);
        }
        fnt.scale = Math.fround(0.78);
        fnt.color = sel ? COL_GOLD : COL_WHITE;
        if (sel) {
            fnt.print(px + 26, ry + 2, ">");
            fnt.print(px + 48, ry + 2, items[i]);
        } else {
            fnt.print(px + 44, ry + 2, items[i]);
        }
    }

    fnt.scale = Math.fround(0.70);
    fnt.color = COL_WHITE;
    fnt.print(px + 18, py + panelH - 32, "[X] ELEGIR   [O/START] SEGUIR");
}

function drawNoteOverlay(screenW, screenH, noteIdx, fnt) {
    const { sx } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, rgba(0, 0, 6, 96));

    const note = LORE_NOTES[noteIdx] || LORE_NOTES[0];
    const panelW = Math.min(548, screenW - sx * 2);
    const panelH = 276;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, note.code, fnt, rgba(160, 175, 200, 120));

    fnt.scale = Math.fround(0.74);
    fnt.color = COL_WHITE;
    for (let l = 0; l < note.lines.length; l++) {
        fnt.print(px + 18, py + 48 + l * 34, note.lines[l]);
    }

    Draw.rect(px, py + panelH - 38, panelW, 2, rgba(80, 90, 110, 110));
    fnt.scale = Math.fround(0.70);
    fnt.color = COL_GOLD;
    fnt.print(px + 18, py + panelH - 30, "[X] o [CIRCULO] GUARDAR Y SEGUIR");
}

function drawEndScreen(screenW, screenH, isWin, cursor, secs, notesFound, difficulty, fnt) {
    const { sx } = getSafeMargins();
    const tint = isWin ? rgba(4, 26, 12, 98) : rgba(48, 0, 6, 106);
    const accent = isWin ? rgba(65, 210, 110, 124) : COL_BORDER_RED;
    Draw.rect(0, 0, screenW, screenH, tint);

    const panelW = Math.min(540, screenW - sx * 2);
    const panelH = 316;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, isWin ? "EVACUACION COMPLETADA" : "SENAL PERDIDA - TE ALCANZO", fnt, accent);

    if (isWin) {
        let rank = "C";
        if (secs <= 95 && notesFound >= 3) rank = "S";
        else if (secs <= 135) rank = "A";
        else if (secs <= 190) rank = "B";

        fnt.scale = Math.fround(0.80);
        fnt.color = COL_GREEN;
        fnt.print(px + 20, py + 46, "ESCAPASTE DEL SUBSUELO 04!");

        fnt.scale = Math.fround(0.74);
        fnt.color = COL_WHITE;
        fnt.print(px + 20, py + 88,  ["Tiempo:     ", formatTime(secs)].join(""));
        fnt.print(px + 20, py + 118, ["Dificultad: ", DIFF_LABELS[difficulty] || "NORMAL"].join(""));
        fnt.print(px + 20, py + 148, ["Registros:  ", String(notesFound), "/4"].join(""));

        fnt.scale = Math.fround(1.1);
        fnt.color = COL_GOLD;
        fnt.print(px + panelW - 140, py + 96, ["RANGO ", rank].join(""));
    } else {
        fnt.scale = Math.fround(0.80);
        fnt.color = COL_TITLE_RED;
        fnt.print(px + 20, py + 48, "EL ACECHADOR TE ATRAPO");

        fnt.scale = Math.fround(0.74);
        fnt.color = COL_WHITE;
        fnt.print(px + 20, py + 90,  ["Tiempo: ", formatTime(secs)].join(""));
        fnt.scale = Math.fround(0.70);
        fnt.color = COL_CYAN;
        fnt.print(px + 20, py + 126, "TIP: Apaga la luz [TRIANG] para ocultarte");
        fnt.print(px + 20, py + 156, "o apunta a sus ojos para frenarlo.");
    }

    const opts = isWin ? END_OPTS_WIN : END_OPTS_DEAD;
    const optY = py + 204;
    for (let i = 0; i < opts.length; i++) {
        const ry = optY + i * 42;
        const sel = (i === cursor);
        if (sel) {
            Draw.rect(px + 20, ry - 3, panelW - 40, 34, isWin ? rgba(20, 88, 42, 118) : COL_SEL_BG);
            Draw.rect(px + 20, ry - 3, 5, 34, isWin ? COL_GREEN : COL_SEL_BAR);
        }
        fnt.scale = Math.fround(0.78);
        fnt.color = sel ? COL_GOLD : COL_WHITE;
        if (sel) {
            fnt.print(px + 32, ry + 2, ">");
            fnt.print(px + 54, ry + 2, opts[i]);
        } else {
            fnt.print(px + 48, ry + 2, opts[i]);
        }
    }
}

function drawPadDisconnectedOverlay(screenW, screenH, fnt) {
    Draw.rect(0, 0, screenW, screenH, rgba(0, 0, 0, 112));
    const pw = 480;
    const ph = 136;
    const px = (screenW - pw) >> 1;
    const py = (screenH - ph) >> 1;
    drawPanel(px, py, pw, ph, "MANDO DESCONECTADO", fnt);
    fnt.scale = Math.fround(0.74);
    fnt.color = COL_GOLD;
    fnt.print(px + 20, py + 52, "Conecta un DualShock 2 en el");
    fnt.print(px + 20, py + 84, "Puerto 1 para continuar.");
}

function drawCinematicsMenu(screenW, screenH, cursor, fnt) {
    const { sx, sy } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, COL_BG_DIM);

    const panelW = screenW - sx * 2 - 12;
    const panelH = screenH - sy * 2 - 12;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, "CINEMATICAS (MODO TEST)", fnt);

    fnt.scale = Math.fround(0.70);
    fnt.color = COL_MUTED;
    fnt.print(px + 20, py + 48, "Selecciona una secuencia para reproducirla (START 1s para omitir):");

    const startY = py + 76;
    const rowH = 52;
    for (let i = 0; i < CINEMATIC_MENU_ITEMS.length; i++) {
        const ry = startY + i * rowH;
        const sel = (i === cursor);
        const item = CINEMATIC_MENU_ITEMS[i];
        Draw.rect(px + 16, ry - 3, panelW - 32, 46, sel ? COL_SEL_BG : rgba(18, 15, 22, 105));
        if (sel) Draw.rect(px + 16, ry - 3, 6, 46, COL_SEL_BAR);

        fnt.scale = Math.fround(sel ? 0.76 : 0.72);
        fnt.color = sel ? COL_GOLD : COL_WHITE;
        if (sel) {
            fnt.print(px + 26, ry + 1, ">");
            fnt.print(px + 46, ry + 1, item.title);
        } else {
            fnt.print(px + 42, ry + 1, item.title);
        }

        fnt.scale = Math.fround(0.70);
        fnt.color = sel ? COL_CYAN : COL_MUTED;
        fnt.print(px + 42, ry + 23, item.meta);
    }

    const footY = py + panelH - 34;
    Draw.rect(px, footY - 8, panelW, 2, rgba(70, 35, 40, 110));
    fnt.scale = Math.fround(0.70);
    fnt.color = COL_WHITE;
    fnt.print(px + 18, footY, "[D-PAD] ELEGIR   [X] REPRODUCIR   [O] VOLVER");
}

