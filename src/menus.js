// ============================================================================
// Interfaz estética AAA PS2 (Título abierto sobre 3D, Opciones con barras y
// badges, Controles, Expediente 8 notas, Pausa, Cinemáticas y Pantallas Finales)
// - CERO allocaciones innecesarias por cuadro, alfa GS 0..128, escala >= 0.70
// - Área segura CRT (NTSC 640x448 y PAL 640x512)
// ============================================================================

const COL_BG_DIM       = rgba(0, 0, 5, 86);
const COL_BORDER_RED   = rgba(175, 34, 40, 124);
const COL_BORDER_STEEL = rgba(92, 106, 126, 112);
const COL_PANEL_BG     = rgba(7, 8, 13, 122);
const COL_HEADER_BG    = rgba(24, 9, 13, 126);
const COL_ROW_DARK     = rgba(13, 14, 21, 108);
const COL_ROW_ALT      = rgba(18, 19, 28, 108);
const COL_SEL_BG       = rgba(118, 20, 28, 122);
const COL_SEL_GLOW     = rgba(210, 42, 48, 42);
const COL_SEL_BAR      = rgba(245, 58, 62, 128);
const COL_TITLE_RED    = rgba(242, 46, 50, 128);
const COL_TITLE_GHOST  = rgba(120, 18, 24, 72);
const COL_WHITE        = rgba(238, 240, 246, 128);
const COL_MUTED        = rgba(152, 160, 176, 128);
const COL_GOLD         = rgba(250, 214, 96, 128);
const COL_CYAN         = rgba(86, 224, 255, 128);
const COL_GREEN        = rgba(88, 242, 138, 128);
const COL_KEYCAP_BG    = rgba(28, 32, 44, 124);

// Estado visual suave para cursores animados en menús
let uiTitleSlideY = -1.0;
let uiOptSlideY   = -1.0;
let uiPauseSlideY = -1.0;
let uiCinSlideY   = -1.0;

function getSafeMargins() {
    return GAME_SETTINGS.crtSafe
        ? { sx: 28, sy: 18 }
        : { sx: 10, sy: 6 };
}

function uiLerpY(cur, target) {
    if (cur < 0) return target;
    return fadd(cur, (target - cur) * 0.34);
}

// Dibuja esquinas arquitectónicas en L (estilo industrial / visor táctico PS2)
function drawCornerBrackets(x, y, w, h, len, col) {
    Draw.rect(x, y, len, 2, col);
    Draw.rect(x, y, 2, len, col);
    Draw.rect(x + w - len, y, len, 2, col);
    Draw.rect(x + w - 2, y, 2, len, col);
    Draw.rect(x, y + h - 2, len, 2, col);
    Draw.rect(x, y + h - len, 2, len, col);
    Draw.rect(x + w - len, y + h - 2, len, 2, col);
    Draw.rect(x + w - 2, y + h - len, 2, len, col);
}

function drawPanel(x, y, w, h, title, fnt, accentCol = COL_BORDER_RED, frameTick = 0) {
    // Sombra exterior suave + cuerpo obsidiana
    Draw.rect(x - 4, y - 4, w + 8, h + 8, rgba(0, 0, 0, 74));
    Draw.rect(x - 1, y - 1, w + 2, h + 2, COL_BORDER_STEEL);
    Draw.rect(x, y, w, h, COL_PANEL_BG);

    // Filete superior de acento y esquinas L
    Draw.rect(x, y, w, 3, accentCol);
    drawCornerBrackets(x - 2, y - 2, w + 4, h + 4, 16, accentCol);

    if (title) {
        Draw.rect(x, y + 3, w, 35, COL_HEADER_BG);
        Draw.rect(x, y + 38, w, 1, accentCol);
        // Indicador de estado parpadeante en cabecera
        const pulse = ((frameTick % 56) < 34);
        Draw.rect(x + 14, y + 16, 7, 7, pulse ? accentCol : rgba(75, 22, 28, 110));
        fnt.scale = Math.fround(0.76);
        fnt.color = COL_WHITE;
        fnt.print(x + 28, y + 10, title);
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
    { badge: "CAP 1", title: "INTRO - CINTA RECUPERADA",  meta: "44s  |  7 PLANOS  |  Subsuelo 04" },
    { badge: "CAP 2", title: "TUNELES DE MANTENIMIENTO",  meta: "14s  |  3 PLANOS  |  Nivel -2 y Valdez" },
    { badge: "CAP 3", title: "PABELLON DE CONTENCION",    meta: "14s  |  3 PLANOS  |  Origen Sujeto 04" },
    { badge: "FINAL", title: "EVACUACION - SALIDA NORTE", meta: "22s  |  4 PLANOS  |  Escape a superficie" },
    { badge: "MENU",  title: "VOLVER AL MENU PRINCIPAL",  meta: "Regresar a la pantalla de titulo" }
];
const DECOY_HUD_LABELS = ["SEN:0", "SEN:1", "SEN:2", "SEN:3"];
const LORE_TABS_OPEN = ["NOTA #01", "NOTA #02", "NOTA #03", "NOTA #04"];
const LORE_TABS_LOCK = ["BLOQ #01", "BLOQ #02", "BLOQ #03", "BLOQ #04"];
const PAUSE_REG_LABELS = [
    "REGISTROS (0/8)", "REGISTROS (1/8)", "REGISTROS (2/8)", "REGISTROS (3/8)",
    "REGISTROS (4/8)", "REGISTROS (5/8)", "REGISTROS (6/8)", "REGISTROS (7/8)", "REGISTROS (8/8)"
];
const END_OPTS_WIN  = ["JUGAR DE NUEVO", "VOLVER AL MENU PRINCIPAL"];
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
    "SALIDA NORTE ABIERTA! [X EN COMPUERTA]"
];

// ============================================================================
// PANTALLA DE TÍTULO CINEMATOGRÁFICA (deja respirar el escenario 3D a la derecha)
// ============================================================================
function drawTitleMenu(screenW, screenH, cursor, frameTick, fnt) {
    const { sx, sy } = getSafeMargins();

    // Gradiente lateral izquierdo en 5 franjas para contraste AAA sin tapar el fondo 3D
    Draw.rect(0, 0, 260, screenH, rgba(4, 4, 8, 118));
    Draw.rect(260, 0, 70, screenH, rgba(4, 4, 8, 96));
    Draw.rect(330, 0, 60, screenH, rgba(4, 4, 8, 68));
    Draw.rect(390, 0, 55, screenH, rgba(4, 4, 8, 38));
    Draw.rect(445, 0, 50, screenH, rgba(4, 4, 8, 16));

    // Bandas letterbox finas superior e inferior
    Draw.rect(0, 0, screenW, sy + 6, rgba(0, 0, 0, 118));
    Draw.rect(0, screenH - sy - 26, screenW, sy + 26, rgba(0, 0, 0, 118));
    Draw.rect(0, sy + 6, screenW, 1, rgba(95, 24, 30, 100));
    Draw.rect(0, screenH - sy - 26, screenW, 1, rgba(95, 24, 30, 100));

    // Barrido VHS sutil
    if (GAME_SETTINGS.overlays) {
        const scanY = (frameTick * 2) % screenH;
        Draw.rect(0, scanY, screenW, 2, rgba(220, 45, 50, 22));
    }

    // Esquinas CCTV en el encuadre derecho abierto
    drawCornerBrackets(sx, sy + 14, screenW - sx * 2, screenH - sy * 2 - 48, 14, rgba(160, 175, 195, 62));

    // Bloque tipográfico principal (con leve parpadeo eléctrico + sombra roja)
    const flicker = ((frameTick % 149) < 3 || (frameTick % 211) === 0) ? 0.58 : 1.0;
    const tx = sx + 8;
    const ty = sy + 24;

    fnt.scale = Math.fround(1.36);
    fnt.color = COL_TITLE_GHOST;
    fnt.print(tx + 3, ty + 2, "SUBSUELO 04");
    fnt.color = rgba((244 * flicker) | 0, (44 * flicker) | 0, (48 * flicker) | 0, 128);
    fnt.print(tx, ty, "SUBSUELO 04");

    // Filete rojo + subtítulo
    Draw.rect(tx, ty + 44, 240, 2, COL_SEL_BAR);
    Draw.rect(tx + 240, ty + 44, 72, 2, rgba(110, 30, 36, 96));

    fnt.scale = Math.fround(0.76);
    fnt.color = COL_GOLD;
    fnt.print(tx, ty + 52, "EL ACECHADOR   //   PLAYSTATION 2");

    // Lista de opciones con barra deslizante animada
    const items = GAME_SETTINGS.difficulty === 1 ? TITLE_ITEMS_NIGHTMARE : TITLE_ITEMS_NORMAL;
    const listY = ty + 90;
    const rowH = 38;
    const listW = Math.min(342, screenW - sx * 2 - 16);

    const targetY = toF64(listY + cursor * rowH - 3);
    uiTitleSlideY = uiLerpY(uiTitleSlideY, targetY);
    const slideYi = uiTitleSlideY | 0;

    // Resplandor + píldora del ítem activo
    Draw.rect(tx - 4, slideYi - 2, listW + 8, 36, COL_SEL_GLOW);
    Draw.rect(tx, slideYi, listW, 32, COL_SEL_BG);
    Draw.rect(tx, slideYi, 5, 32, COL_SEL_BAR);
    Draw.rect(tx, slideYi, listW, 1, rgba(245, 95, 95, 110));

    for (let i = 0; i < items.length; i++) {
        const ry = listY + i * rowH;
        const selected = (i === cursor);
        fnt.scale = Math.fround(selected ? 0.78 : 0.72);
        fnt.color = selected ? COL_GOLD : COL_WHITE;
        if (selected) {
            fnt.print(tx + 14, ry + 2, ">");
            fnt.print(tx + 34, ry + 2, items[i]);
        } else {
            fnt.print(tx + 20, ry + 3, items[i]);
        }
    }

    // Panel lateral derecho minimalista (estado del sistema, récord y campaña)
    const rx = screenW - sx - 188;
    const ryInfo = sy + 28;
    Draw.rect(rx - 10, ryInfo - 4, 192, 108, rgba(8, 10, 15, 98));
    Draw.rect(rx - 10, ryInfo - 4, 192, 2, COL_BORDER_STEEL);
    fnt.scale = Math.fround(0.70);
    fnt.color = COL_MUTED;
    fnt.print(rx, ryInfo + 4, "HK ENTERTAINMENT");
    fnt.color = RECORDS.mcAvailable ? COL_CYAN : COL_MUTED;
    fnt.print(rx, ryInfo + 28, RECORDS.mcAvailable ? "MC0: CONECTADA" : "MC0: SIN TARJETA");
    const best = GAME_SETTINGS.difficulty === 1 ? RECORDS.bestNightmareSec : RECORDS.bestNormalSec;
    fnt.color = best > 0 ? COL_GREEN : COL_MUTED;
    fnt.print(rx, ryInfo + 52, best > 0 ? ["RECORD: ", formatTime(best)].join("") : "SIN ESCAPES AUN");
    fnt.color = COL_GOLD;
    fnt.print(rx, ryInfo + 76, ["CAMPANA: CAP ", String(RECORDS.maxChapterUnlocked || 1), "/3"].join(""));

    // Pie de navegación
    const footY = screenH - sy - 20;
    fnt.scale = Math.fround(0.70);
    fnt.color = COL_WHITE;
    fnt.print(sx + 8, footY, "[D-PAD] ELEGIR   [IZQ/DER] DIFICULTAD   [X/START] ACEPTAR");
}

// ============================================================================
// MENÚ DE OPCIONES CON BARRA DE VOLUMEN Y BADGES DE ESTADO
// ============================================================================
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
        { label: "MOTOR GRAFICO",    val: qualityLabel,                                  kind: "cyan" },
        { label: "ASPECTO TV",       val: GAME_SETTINGS.aspect16x9 ? "16:9" : "4:3",     kind: "cyan" },
        { label: "MARGEN CRT",       val: GAME_SETTINGS.crtSafe ? "SEGURO" : "COMPLETO", kind: "bool", on: GAME_SETTINGS.crtSafe },
        { label: "SENSIBILIDAD",     val: SENS_LABELS[GAME_SETTINGS.sensitivityIndex],   kind: "cyan" },
        { label: "VIBRACION DS2",    val: GAME_SETTINGS.rumble ? "SI" : "NO",            kind: "bool", on: GAME_SETTINGS.rumble },
        { label: "EFECTOS VHS",      val: GAME_SETTINGS.overlays ? "SI" : "NO",          kind: "bool", on: GAME_SETTINGS.overlays },
        { label: "VOLUMEN AUDIO",    val: audioVal,                                      kind: "vol"  },
        { label: "ESTADISTICAS PS2", val: GAME_SETTINGS.showFps ? "SI" : "NO",           kind: "bool", on: GAME_SETTINGS.showFps },
        { label: "OMITIR INTRO",     val: GAME_SETTINGS.skipIntro ? "SI" : "NO",         kind: "bool", on: GAME_SETTINGS.skipIntro },
        { label: "GUARDAR EN MC0",   val: "[X] GUARDAR",                                 kind: "save" }
    ];

    const startY = py + 45;
    const rowH = 30;
    uiOptSlideY = uiLerpY(uiOptSlideY, toF64(startY + cursor * rowH - 2));

    for (let i = 0; i < rows.length; i++) {
        const ry = startY + i * rowH;
        Draw.rect(px + 14, ry - 2, panelW - 28, 27, (i & 1) ? COL_ROW_ALT : COL_ROW_DARK);
    }

    // Resaltado animado
    const syi = uiOptSlideY | 0;
    Draw.rect(px + 14, syi, panelW - 28, 27, COL_SEL_BG);
    Draw.rect(px + 14, syi, 5, 27, COL_SEL_BAR);

    for (let i = 0; i < rows.length; i++) {
        const ry = startY + i * rowH;
        const sel = (i === cursor);
        const r = rows[i];

        fnt.scale = Math.fround(0.72);
        fnt.color = sel ? COL_GOLD : COL_WHITE;
        fnt.print(px + 26, ry + 2, r.label);

        const vx = px + panelW - 238;
        if (r.kind === "vol") {
            // Barra segmentada de 4 bloques para volumen
            for (let seg = 0; seg < 4; seg++) {
                const active = (volIdx > seg) && GAME_SETTINGS.audioVolume > 0;
                Draw.rect(vx + seg * 22, ry + 7, 18, 10, active ? COL_CYAN : rgba(36, 42, 54, 120));
            }
            fnt.color = sel ? COL_GOLD : COL_WHITE;
            fnt.print(vx + 96, ry + 2, r.val);
        } else {
            let vCol = COL_WHITE;
            if (r.kind === "bool") vCol = r.on ? COL_GREEN : COL_MUTED;
            else if (r.kind === "cyan") vCol = COL_CYAN;
            else if (r.kind === "save") vCol = COL_GOLD;
            fnt.color = sel ? (r.kind === "bool" ? vCol : COL_GOLD) : vCol;
            const valText = (i < rows.length - 1) ? ["< ", String(r.val), " >"].join("") : String(r.val);
            fnt.print(vx, ry + 2, valText);
        }
    }

    const footY = py + panelH - 34;
    Draw.rect(px + 14, footY - 8, panelW - 28, 1, COL_BORDER_STEEL);
    fnt.scale = Math.fround(0.70);
    if (saveFeedbackTimer > 0) {
        fnt.color = COL_GREEN;
        fnt.print(px + 18, footY, "AJUSTES GUARDADOS EN MEMORY CARD");
    } else {
        fnt.color = COL_WHITE;
        fnt.print(px + 18, footY, "[IZQ/DER] CAMBIAR   [X] ACEPTAR   [O] VOLVER");
    }
}

// ============================================================================
// CONTROLES DUALSHOCK 2
// ============================================================================
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
        ["STICK DER / L1-R1",  "Mirar 360 / arriba-abajo"],
        ["X (CRUZ)",           "Interactuar / Esconderse"],
        ["CIRCULO / ABAJO+O",  "Correr / Giro rapido 180"],
        ["CUADRADO",           "Agacharse (modo sigilo)"],
        ["TRIANGULO",          "Linterna ON / OFF"],
        ["L2 / SELECT",        "Lanzar senuelo / Mapa PDA"],
        ["START / R2",         "Pausa / Diagnostico PS2"]
    ];

    let y = py + 46;
    for (let i = 0; i < bindings.length; i++) {
        Draw.rect(px + 14, y - 2, panelW - 28, 27, (i & 1) ? COL_ROW_ALT : COL_ROW_DARK);
        Draw.rect(px + 18, y + 1, 208, 21, COL_KEYCAP_BG);
        fnt.scale = Math.fround(0.71);
        fnt.color = COL_GOLD;
        fnt.print(px + 24, y + 2, bindings[i][0]);
        fnt.color = COL_WHITE;
        fnt.print(px + 238, y + 2, bindings[i][1]);
        y += 30;
    }

    fnt.scale = Math.fround(0.70);
    fnt.color = COL_CYAN;
    fnt.print(px + 18, y + 8, "TIP: Agachate [CUAD] o escondete [X] con la luz apagada.");

    const footY = py + panelH - 34;
    Draw.rect(px + 14, footY - 8, panelW - 28, 1, COL_BORDER_STEEL);
    fnt.scale = Math.fround(0.70);
    fnt.color = COL_GOLD;
    fnt.print(px + 18, footY, "[X] o [CIRCULO] VOLVER");
}

// ============================================================================
// EXPEDIENTE / REGISTROS (8 NOTAS DE CAMPAÑA)
// ============================================================================
function drawLoreMenu(screenW, screenH, collectedNotes, selectedNoteIdx, fromPause, fnt) {
    const { sx, sy } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, COL_BG_DIM);

    const panelW = screenW - sx * 2 - 12;
    const panelH = screenH - sy * 2 - 12;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    const title = fromPause ? "REGISTROS RECOLECTADOS" : "EXPEDIENTE - SUBSUELO 04";
    drawPanel(px, py, panelW, panelH, title, fnt);

    const tabPage = (selectedNoteIdx >= 4) ? 4 : 0;
    const tabW = ((panelW - 44) / 4) | 0;
    for (let slot = 0; slot < 4; slot++) {
        const i = tabPage + slot;
        if (i >= LORE_NOTES.length) break;
        const tx = px + 16 + slot * (tabW + 4);
        const sel = (i === selectedNoteIdx);
        const unlocked = !fromPause || collectedNotes[i];
        Draw.rect(tx, py + 46, tabW, 28, sel ? COL_SEL_BG : COL_ROW_DARK);
        if (sel) Draw.rect(tx, py + 72, tabW, 2, COL_SEL_BAR);
        fnt.scale = Math.fround(0.72);
        fnt.color = sel ? COL_GOLD : (unlocked ? COL_WHITE : COL_MUTED);
        const openLbl = ["NOTA #0", String(i + 1)].join("");
        const lockLbl = ["BLOQ #0", String(i + 1)].join("");
        fnt.print(tx + 8, py + 50, unlocked ? openLbl : lockLbl);
    }

    const note = LORE_NOTES[selectedNoteIdx] || LORE_NOTES[0];
    const unlocked = !fromPause || collectedNotes[selectedNoteIdx];
    const bodyY = py + 88;
    Draw.rect(px + 16, bodyY - 4, panelW - 32, panelH - 142, rgba(11, 12, 18, 112));
    Draw.rect(px + 16, bodyY - 4, 3, panelH - 142, unlocked ? COL_GOLD : COL_BORDER_STEEL);

    if (unlocked) {
        fnt.scale = Math.fround(0.74);
        fnt.color = COL_GOLD;
        fnt.print(px + 28, bodyY + 4, note.code);

        fnt.scale = Math.fround(0.73);
        fnt.color = COL_WHITE;
        for (let l = 0; l < note.lines.length; l++) {
            fnt.print(px + 28, bodyY + 38 + l * 32, note.lines[l]);
        }
    } else {
        fnt.scale = Math.fround(0.74);
        fnt.color = COL_MUTED;
        fnt.print(px + 28, bodyY + 24, "REGISTRO NO ENCONTRADO");
        fnt.scale = Math.fround(0.72);
        fnt.print(px + 28, bodyY + 66, "Explora los 3 capitulos y recoge las");
        fnt.print(px + 28, bodyY + 98, "hojas marcadas en el plano PDA.");
    }

    const footY = py + panelH - 34;
    Draw.rect(px + 14, footY - 8, panelW - 28, 1, COL_BORDER_STEEL);
    fnt.scale = Math.fround(0.70);
    fnt.color = COL_WHITE;
    fnt.print(px + 18, footY, fromPause
        ? "[IZQ/DER] NOTA   [X/CIRCULO] VOLVER"
        : "[IZQ/DER] NOTA   [TRIANG.] VER INTRO   [X/O] VOLVER");
}

// ============================================================================
// CRÉDITOS Y HARDWARE PS2
// ============================================================================
function drawCreditsMenu(screenW, screenH, modeInfo, fnt) {
    const { sx, sy } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, COL_BG_DIM);

    const panelW = screenW - sx * 2 - 12;
    const panelH = screenH - sy * 2 - 12;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, "CREDITOS Y SISTEMA PS2", fnt);

    fnt.scale = Math.fround(0.84);
    fnt.color = COL_TITLE_RED;
    fnt.print(px + 22, py + 48, "SUBSUELO 04: EL ACECHADOR");

    fnt.scale = Math.fround(0.72);
    fnt.color = COL_WHITE;
    fnt.print(px + 22, py + 84,  "Estudio:   HK Entertainment");
    fnt.print(px + 22, py + 112, "Autor:     Joaquin Gasperetti");
    fnt.print(px + 22, py + 140, "Motor:     HK Engine 1 (AthenaEnv V4)");

    Draw.rect(px + 20, py + 174, panelW - 40, 1, COL_BORDER_STEEL);

    fnt.scale = Math.fround(0.74);
    fnt.color = COL_GOLD;
    fnt.print(px + 22, py + 184, "TELEMETRIA DE CONSOLA:");
    fnt.scale = Math.fround(0.70);
    fnt.color = COL_CYAN;
    fnt.print(px + 22, py + 216, ["Video: ", String(screenW), "x", String(screenH), " (", modeInfo.vmodeLabel, ")"].join(""));
    fnt.print(px + 22, py + 244, isAudioReady() ? "Audio PS2: ACTIVO (OGG Stream)" : "Audio PS2: INACTIVO");
    fnt.print(px + 22, py + 272, RECORDS.mcAvailable ? "Memory Card (mc0): OK" : "Memory Card (mc0): NO DETECTADA");
    fnt.print(px + 22, py + 300, ["Escapes: ", String(RECORDS.escapes), "   |   Campana: Cap ", String(RECORDS.maxChapterUnlocked || 1), "/3"].join(""));

    const footY = py + panelH - 34;
    Draw.rect(px + 14, footY - 8, panelW - 28, 1, COL_BORDER_STEEL);
    fnt.scale = Math.fround(0.70);
    fnt.color = COL_GOLD;
    fnt.print(px + 20, footY, "[X] o [CIRCULO] VOLVER");
}

// ============================================================================
// MENÚ DE PAUSA CON CURSOR DESLIZANTE
// ============================================================================
function drawPauseMenu(screenW, screenH, cursor, notesFoundCount, fnt) {
    const { sx, sy } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, rgba(0, 0, 8, 102));

    const panelW = Math.min(490, screenW - sx * 2);
    const panelH = 340;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, "PAUSA", fnt);

    const items = [
        "CONTINUAR PARTIDA",
        "OPCIONES Y VIDEO PS2",
        PAUSE_REG_LABELS[notesFoundCount] || "REGISTROS (0/8)",
        "CONTROLES",
        "REINICIAR CAPITULO",
        "VOLVER AL MENU PRINCIPAL"
    ];

    const startY = py + 50;
    const rowH = 39;
    uiPauseSlideY = uiLerpY(uiPauseSlideY, toF64(startY + cursor * rowH - 3));
    const syi = uiPauseSlideY | 0;

    Draw.rect(px + 16, syi, panelW - 32, 33, COL_SEL_BG);
    Draw.rect(px + 16, syi, 5, 33, COL_SEL_BAR);

    for (let i = 0; i < items.length; i++) {
        const ry = startY + i * rowH;
        const sel = (i === cursor);
        fnt.scale = Math.fround(0.76);
        fnt.color = sel ? COL_GOLD : COL_WHITE;
        if (sel) {
            fnt.print(px + 28, ry + 2, ">");
            fnt.print(px + 50, ry + 2, items[i]);
        } else {
            fnt.print(px + 44, ry + 2, items[i]);
        }
    }

    Draw.rect(px + 16, py + panelH - 40, panelW - 32, 1, COL_BORDER_STEEL);
    fnt.scale = Math.fround(0.70);
    fnt.color = COL_WHITE;
    fnt.print(px + 18, py + panelH - 30, "[X] ELEGIR   [O/START] SEGUIR");
}

function drawNoteOverlay(screenW, screenH, noteIdx, fnt) {
    const { sx } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, rgba(0, 0, 8, 100));

    const note = LORE_NOTES[noteIdx] || LORE_NOTES[0];
    const panelW = Math.min(548, screenW - sx * 2);
    const panelH = 280;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, note.code, fnt, COL_GOLD);

    fnt.scale = Math.fround(0.74);
    fnt.color = COL_WHITE;
    for (let l = 0; l < note.lines.length; l++) {
        fnt.print(px + 22, py + 52 + l * 34, note.lines[l]);
    }

    Draw.rect(px + 16, py + panelH - 38, panelW - 32, 1, COL_BORDER_STEEL);
    fnt.scale = Math.fround(0.70);
    fnt.color = COL_GOLD;
    fnt.print(px + 20, py + panelH - 28, "[X] o [CIRCULO] GUARDAR Y SEGUIR");
}

// ============================================================================
// PANTALLAS FINALES (VICTORIA CON RANGO ENMARCADO / DERROTA)
// ============================================================================
function drawEndScreen(screenW, screenH, isWin, cursor, secs, notesFound, difficulty, fnt) {
    const { sx } = getSafeMargins();
    const tint = isWin ? rgba(4, 24, 12, 102) : rgba(42, 2, 6, 108);
    const accent = isWin ? COL_GREEN : COL_BORDER_RED;
    Draw.rect(0, 0, screenW, screenH, tint);

    const panelW = Math.min(544, screenW - sx * 2);
    const panelH = 324;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, isWin ? "EVACUACION COMPLETADA" : "SENAL PERDIDA - TE ALCANZO", fnt, accent);

    if (isWin) {
        let rank = "C";
        if (secs <= 240 && notesFound >= 5) rank = "S";
        else if (secs <= 360) rank = "A";
        else if (secs <= 520) rank = "B";

        fnt.scale = Math.fround(0.80);
        fnt.color = COL_GREEN;
        fnt.print(px + 22, py + 48, "ESCAPASTE DEL SUBSUELO 04!");

        fnt.scale = Math.fround(0.74);
        fnt.color = COL_WHITE;
        fnt.print(px + 22, py + 90,  ["Tiempo:     ", formatTime(secs)].join(""));
        fnt.print(px + 22, py + 120, ["Dificultad: ", DIFF_LABELS[difficulty] || "NORMAL"].join(""));
        fnt.print(px + 22, py + 150, ["Registros:  ", String(notesFound), "/8"].join(""));

        // Sello de rango con esquinas doradas
        const rx = px + panelW - 142;
        const ry = py + 84;
        Draw.rect(rx, ry, 114, 86, rgba(16, 20, 14, 122));
        drawCornerBrackets(rx, ry, 114, 86, 14, COL_GOLD);
        fnt.scale = Math.fround(0.70);
        fnt.color = COL_MUTED;
        fnt.print(rx + 26, ry + 8, "RANGO");
        fnt.scale = Math.fround(1.45);
        fnt.color = COL_GOLD;
        fnt.print(rx + 42, ry + 30, rank);
    } else {
        fnt.scale = Math.fround(0.82);
        fnt.color = COL_TITLE_RED;
        fnt.print(px + 22, py + 50, "EL ACECHADOR TE ATRAPO");

        fnt.scale = Math.fround(0.74);
        fnt.color = COL_WHITE;
        fnt.print(px + 22, py + 92,  ["Tiempo sobrevivido: ", formatTime(secs)].join(""));
        fnt.scale = Math.fround(0.70);
        fnt.color = COL_CYAN;
        fnt.print(px + 22, py + 128, "TIP: Usa [CUAD] para sigilo, [L2] para lanzar");
        fnt.print(px + 22, py + 156, "un senuelo o escondete [X] con la luz apagada.");
    }

    const opts = isWin ? END_OPTS_WIN : END_OPTS_DEAD;
    const optY = py + 208;
    for (let i = 0; i < opts.length; i++) {
        const ry = optY + i * 42;
        const sel = (i === cursor);
        Draw.rect(px + 20, ry - 3, panelW - 40, 34, sel ? (isWin ? rgba(20, 88, 42, 120) : COL_SEL_BG) : COL_ROW_DARK);
        if (sel) Draw.rect(px + 20, ry - 3, 5, 34, isWin ? COL_GREEN : COL_SEL_BAR);
        fnt.scale = Math.fround(0.76);
        fnt.color = sel ? COL_GOLD : COL_WHITE;
        if (sel) {
            fnt.print(px + 34, ry + 2, ">");
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
    fnt.print(px + 22, py + 54, "Conecta un DualShock 2 en el");
    fnt.print(px + 22, py + 84, "Puerto 1 para continuar.");
}

// ============================================================================
// GALERÍA DE CINEMÁTICAS (TEST) CON BADGES DE CAPÍTULO Y CURSOR SUAVE
// ============================================================================
function drawCinematicsMenu(screenW, screenH, cursor, fnt) {
    const { sx, sy } = getSafeMargins();
    Draw.rect(0, 0, screenW, screenH, COL_BG_DIM);

    const panelW = screenW - sx * 2 - 12;
    const panelH = screenH - sy * 2 - 12;
    const px = (screenW - panelW) >> 1;
    const py = (screenH - panelH) >> 1;

    drawPanel(px, py, panelW, panelH, "GALERIA DE CINEMATICAS (TEST)", fnt);

    fnt.scale = Math.fround(0.70);
    fnt.color = COL_MUTED;
    fnt.print(px + 20, py + 46, "Selecciona una secuencia (START 1s para omitir):");

    const startY = py + 76;
    const rowH = 52;
    uiCinSlideY = uiLerpY(uiCinSlideY, toF64(startY + cursor * rowH - 3));

    for (let i = 0; i < CINEMATIC_MENU_ITEMS.length; i++) {
        const ry = startY + i * rowH;
        Draw.rect(px + 16, ry - 3, panelW - 32, 46, (i & 1) ? COL_ROW_ALT : COL_ROW_DARK);
    }

    const syi = uiCinSlideY | 0;
    Draw.rect(px + 16, syi, panelW - 32, 46, COL_SEL_BG);
    Draw.rect(px + 16, syi, 6, 46, COL_SEL_BAR);

    for (let i = 0; i < CINEMATIC_MENU_ITEMS.length; i++) {
        const ry = startY + i * rowH;
        const sel = (i === cursor);
        const item = CINEMATIC_MENU_ITEMS[i];

        // Badge de capítulo a la izquierda
        Draw.rect(px + 28, ry + 6, 62, 26, sel ? rgba(30, 12, 16, 124) : COL_KEYCAP_BG);
        fnt.scale = Math.fround(0.70);
        fnt.color = sel ? COL_GOLD : COL_CYAN;
        fnt.print(px + 34, ry + 9, item.badge);

        fnt.scale = Math.fround(sel ? 0.76 : 0.72);
        fnt.color = sel ? COL_GOLD : COL_WHITE;
        fnt.print(px + 102, ry + 1, item.title);

        fnt.scale = Math.fround(0.70);
        fnt.color = sel ? COL_CYAN : COL_MUTED;
        fnt.print(px + 102, ry + 23, item.meta);
    }

    const footY = py + panelH - 34;
    Draw.rect(px + 14, footY - 8, panelW - 28, 1, COL_BORDER_STEEL);
    fnt.scale = Math.fround(0.70);
    fnt.color = COL_WHITE;
    fnt.print(px + 18, footY, "[D-PAD] ELEGIR   [X] REPRODUCIR   [O] VOLVER");
}
