// Mapa 20x20 del Subsuelo 04 y colisiones ultra-ligeras sin allocaciones por cuadro
// 0 = Pasillo libre
// 1 = Pared de hormigon humedo
// 2 = Pilar/estructura oxidada
// 3 = Pared de zona ritual / sangre
// 4 = Compuerta blindada de salida (Norte)
// 5 = Reja de seguridad (se abre al activar el Disyuntor Central)

import { toF64 } from "./config.js";

export const MAP_W = 20;
export const MAP_H = 20;

export const BASE_MAP = [
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

export function createWorldGrid() {
    const grid = [];
    for (let y = 0; y < MAP_H; y++) {
        grid.push(BASE_MAP[y].slice());
    }
    return grid;
}

export function getCell(grid, gx, gy) {
    if (gx < 0 || gx >= MAP_W || gy < 0 || gy >= MAP_H) return 1;
    return grid[gy][gx];
}

export function isCellBlocked(grid, gx, gy) {
    if (gx < 0 || gx >= MAP_W || gy < 0 || gy >= MAP_H) return true;
    return grid[gy][gx] !== 0;
}

// Verificación directa de las 4 esquinas del bounding box (sin crear arrays por cuadro)
export function isPosWalkable(grid, nx, ny, margin = 0.25) {
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

export const LORE_NOTES = [
    {
        code: "REGISTRO #01 - INGENIERIA",
        summary: "El disyuntor central corta las rejas de los sectores Este y Oeste.",
        lines: [
            "FECHA: 14/10 - TURNO NOCHE (SUBSUELO 04)",
            "Tras el apagon se cerraron las rejas de contencion",
            "hacia los sectores Este y Oeste.",
            "El DISYUNTOR ROJO en el nucleo central libera",
            "las trabas magneticas. Si bajas, ve directo alli."
        ]
    },
    {
        code: "REGISTRO #02 - SEGURIDAD",
        summary: "No corras cerca suyo. Apaga la linterna y quedate quieto para esconderte.",
        lines: [
            "INFORME DE GUARDIA - ANOMALIA EN PASILLO SUR",
            "Esa cosa reacciona al ruido de pisadas rapidas",
            "y al haz directo de nuestras linternas tacticas.",
            "Si sientes el pulso dispararse, apaga la luz [TRIANGULO]",
            "y evita correr: en la oscuridad pierde tu rastro."
        ]
    },
    {
        code: "REGISTRO #03 - PROTOCOLO",
        summary: "Si te mira de frente, ilumina sus ojos para frenar su avance.",
        lines: [
            "OBSERVACION DE CAMPO - COMPORTAMIENTO VISUAL",
            "Aunque la luz lo atrae desde lejos, el haz concentrado",
            "directo en sus ojos lo desorienta por unos segundos.",
            "Usalo solo para ganar distancia cuando te acorrale",
            "en un pasillo estrecho. Cuida la bateria."
        ]
    },
    {
        code: "REGISTRO #04 - EVACUACION",
        summary: "Los 4 fusibles alimentan la compuerta de evacuacion al Norte.",
        lines: [
            "ORDEN DE EMERGENCIA - COMPUERTA NORTE",
            "La salida blindada al Norte (arriba en el plano PDA)",
            "requiere los 4 FUSIBLES industriales de respaldo.",
            "Cuando el panel pase a VERDE, corre hacia la compuerta.",
            "No mires atras."
        ]
    }
];

export const LORE_MESSAGES = LORE_NOTES.map(n => n.code + ": " + n.summary);
