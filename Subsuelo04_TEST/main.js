// ============================================================================
// SUBSUELO 04 - TEST DE ARRANQUE (diagnostico)
// Solo usa APIs que el juego ya usa. Si ves esta pantalla, Athena + main.js
// funcionan en tu consola y el problema esta en otra parte.
// ============================================================================
const mode = Screen.getMode();
const W = (mode && mode.width) ? mode.width : 640;
const H = (mode && mode.height) ? mode.height : 448;
Screen.setVSync(true);

const fnt = new Font("default");
const pad = Pads.get(0);
const col = (r, g, b) => (r & 255) | ((g & 255) << 8) | ((b & 255) << 16) | (128 << 24);

const info = [];
function add(label, fn) {
    let v;
    try { v = fn(); } catch (e) { v = "error: " + e; }
    info.push(label + ": " + v);
}

add("Resolucion", () => W + "x" + H);
add("cwd", () => {
    if (typeof os === "undefined" || typeof os.getcwd !== "function") return "n/d";
    const r = os.getcwd();
    return Array.isArray(r) ? r[0] : String(r);
});
["athena.ini", "main.js", "assets/ambient.wav"].forEach((p) => {
    add("existe " + p, () => (typeof std !== "undefined" && typeof std.exists === "function") ? (std.exists(p) ? "SI" : "NO") : "n/d");
});
add("archivos en .", () => {
    if (typeof System === "undefined" || typeof System.listDir !== "function") return "n/d";
    const l = System.listDir(".");
    return l.map((f) => f.name).slice(0, 12).join(" ");
});
add("Pad 0 activo", () => (typeof Pads.isActive === "function") ? (Pads.isActive(0) ? "SI" : "NO") : "n/d");

const BTN = ["CROSS", "CIRCLE", "SQUARE", "TRIANGLE", "START", "SELECT", "L1", "R1", "L2", "R2", "UP", "DOWN", "LEFT", "RIGHT"];
const t0 = Date.now();
let frames = 0;

Screen.display(() => {
    frames++;
    pad.update();

    Draw.rect(0, 0, W, H, col(10, 14, 24));
    // barras de color + barra "latido" (si se mueve, el bucle esta vivo)
    const cols = [col(220, 40, 40), col(40, 200, 60), col(50, 90, 230), col(230, 210, 40), col(200, 200, 200)];
    for (let i = 0; i < cols.length; i++) Draw.rect(32 + i * 60, 40, 56, 24, cols[i]);
    Draw.rect(32, 72, 300, 6, col(60, 60, 70));
    Draw.rect(32 + ((frames * 3) % 280), 72, 20, 6, col(255, 255, 255));

    fnt.scale = Math.fround(0.8);
    fnt.color = col(255, 255, 255);
    fnt.print(32, 14, "SUBSUELO 04 - TEST DE ARRANQUE");

    fnt.scale = Math.fround(0.55);
    fnt.color = col(120, 255, 140);
    fnt.print(32, 92, "main.js EJECUTADO OK  |  frame " + frames + "  |  " + (((Date.now() - t0) / 1000) | 0) + " s");

    fnt.color = col(220, 220, 220);
    let y = 120;
    for (let i = 0; i < info.length; i++) { fnt.print(32, y, info[i]); y += 22; }

    let pressed = [];
    for (let i = 0; i < BTN.length; i++) {
        try { if (pad.pressed(Pads[BTN[i]])) pressed.push(BTN[i]); } catch (_) {}
    }
    fnt.color = col(255, 220, 120);
    fnt.print(32, y + 10, "Botones: " + (pressed.length ? pressed.join(" ") : "-"));
    fnt.print(32, y + 32, "Stick izq: " + (pad.lx | 0) + ", " + (pad.ly | 0) + "   der: " + (pad.rx | 0) + ", " + ((pad.ry | 0)));
});
