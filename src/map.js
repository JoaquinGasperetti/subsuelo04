// Mapa 20x20 del Subsuelo 04 y colisiones ultra-ligeras sin allocaciones por cuadro
// 0 = Pasillo libre
// 1 = Pared de hormigon humedo
// 2 = Pilar/estructura oxidada
// 3 = Pared de zona ritual / sangre
// 4 = Compuerta blindada de salida (Norte)
// 5 = Reja de seguridad (se abre al activar el Disyuntor Central)

const MAP_W = 20;
const MAP_H = 20;

const BASE_MAP = [
    [1,1,1,1,1,1,1,1,1,4,4,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,1],
    [1,0,2,2,0,1,0,1,1,0,0,1,1,0,1,0,2,2,0,1],
    [1,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,1],
    [1,1,1,0,1,1,0,0,0,2,2,0,0,0,1,1,0,1,1,1],
    [1,0,0,0,0,1,0,1,0,0,0,0,1,0,1,0,0,0,0,1],
    [1,0,2,1,0,0,0,1,0,0,0,0,1,0,0,0,1,2,0,1],
    [1,0,0,1,0,1,0,0,0,2,2,0,0,0,1,0,1,0,0,1],
    [3,0,0,0,0,5,0,0,0,0,0,0,0,0,5,0,0,0,0,3],
    [3,0,1,1,0,5,0,2,0,0,0,0,2,0,5,0,1,1,0,3],
    [3,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,3],
    [1,0,0,0,1,1,0,2,0,0,0,0,2,0,1,1,0,0,0,1],
    [1,0,2,0,0,0,0,0,0,2,2,0,0,0,0,0,0,2,0,1],
    [1,0,0,0,1,0,1,0,0,0,0,0,0,1,0,1,0,0,0,1],
    [1,1,0,1,1,0,1,1,0,0,0,0,1,1,0,1,1,0,1,1],
    [1,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,1],
    [1,0,2,1,0,1,0,3,0,0,0,0,3,0,1,0,1,2,0,1],
    [1,0,0,1,0,1,0,3,3,0,0,3,3,0,1,0,1,0,0,1],
    [1,0,0,0,0,0,0,0,0,3,3,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,3,3,1,1,1,1,1,1,1,1,1]
];

function createWorldGrid() {
    const grid = [];
    for (let y = 0; y < MAP_H; y++) {
        grid.push(BASE_MAP[y].slice());
    }
    return grid;
}

function getCell(grid, gx, gy) {
    if (gx < 0 || gx >= MAP_W || gy < 0 || gy >= MAP_H) return 1;
    return grid[gy][gx];
}

function isCellBlocked(grid, gx, gy) {
    if (gx < 0 || gx >= MAP_W || gy < 0 || gy >= MAP_H) return true;
    return grid[gy][gx] !== 0;
}

// Verificación directa de las 4 esquinas del bounding box (sin crear arrays por cuadro)
function isPosWalkable(grid, nx, ny, margin = 0.25) {
    const x = toF64(nx);
    const y = toF64(ny);
    const m = toF64(margin);
    const x0 = (x - m) | 0;
    const x1 = (x - (-m)) | 0;
    const y0 = (y - m) | 0;
    const y1 = (y - (-m)) | 0;

    if (x0 < 0 || x1 >= MAP_W || y0 < 0 || y1 >= MAP_H) return false;
    if (grid[y0][x0] !== 0) return false;
    if (grid[y0][x1] !== 0) return false;
    if (grid[y1][x0] !== 0) return false;
    if (grid[y1][x1] !== 0) return false;
    return true;
}

// Avanza un eje en pasos cortos para que un cuadro lento o un cambio futuro de
// velocidad no permita atravesar una celda sólida entre la posición anterior y la nueva.
function movePlayerAxis(grid, x, y, delta, moveX, margin = 0.25) {
    const steps = Math.max(1, Math.ceil(Math.abs(delta) / 0.10));
    const step = delta / steps;
    let moved = moveX ? x : y;
    for (let i = 0; i < steps; i++) {
        const candidate = moved + step;
        const nx = moveX ? candidate : x;
        const ny = moveX ? y : candidate;
        if (!isPosWalkable(grid, nx, ny, margin)) break;
        moved = candidate;
    }
    return moved;
}

const LORE_NOTES = [
    {
        code: "REGISTRO #01 - INGENIERIA",
        summary: "El disyuntor central abre las rejas Este y Oeste.",
        lines: [
            "14/10 - TURNO NOCHE (SUBSUELO 04)",
            "Tras el apagon se trabaron las rejas",
            "hacia los sectores Este y Oeste.",
            "El DISYUNTOR ROJO en el centro libera",
            "las trabas magneticas. Ve directo alli."
        ]
    },
    {
        code: "REGISTRO #02 - SEGURIDAD",
        summary: "No corras cerca suyo. Apaga la linterna para ocultarte.",
        lines: [
            "INFORME DE GUARDIA - PASILLO SUR",
            "Reacciona al ruido de pisadas rapidas",
            "y al haz directo de las linternas.",
            "Si sube tu pulso, apaga la luz [TRIANG]",
            "y deja de correr: perdera tu rastro."
        ]
    },
    {
        code: "REGISTRO #03 - PROTOCOLO",
        summary: "Ilumina sus ojos de frente para frenar su avance.",
        lines: [
            "OBSERVACION - COMPORTAMIENTO VISUAL",
            "Aunque la luz lo atrae desde lejos,",
            "apuntar directo a sus ojos lo frena.",
            "Usalo solo para ganar distancia si te",
            "acorrala en un pasillo. Cuida bateria."
        ]
    },
    {
        code: "REGISTRO #04 - EVACUACION",
        summary: "Los 4 fusibles abren la compuerta de salida al Norte.",
        lines: [
            "ORDEN DE EMERGENCIA - SALIDA NORTE",
            "La compuerta blindada al Norte (arriba",
            "en el PDA) requiere los 4 FUSIBLES.",
            "Cuando el panel pase a VERDE, corre",
            "hacia la salida. No mires atras."
        ]
    }
];

const LORE_MESSAGES = LORE_NOTES.map(n => [n.code, ": ", n.summary].join(""));

