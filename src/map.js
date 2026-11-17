// Mapa 20x20 del Subsuelo 04 y colisiones
// 0 = Pasillo libre
// 1 = Pared de hormigon humedo
// 2 = Pilar/estructura oxidada
// 3 = Pared de zona ritual / sangre
// 4 = Compuerta blindada de salida (Norte)
// 5 = Reja de seguridad (se abre al activar el Disyuntor Central)

import { toF64, fadd } from "./config.js";

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
    return getCell(grid, gx, gy) !== 0;
}

export function isPosWalkable(grid, nx, ny, margin = 0.25) {
    if (isNaN(nx) || isNaN(ny)) return false;
    const x = toF64(nx);
    const y = toF64(ny);
    const m = toF64(margin);
    const checks = [
        [x - m,       y - m],
        [fadd(x, m),  y - m],
        [x - m,       fadd(y, m)],
        [fadd(x, m),  fadd(y, m)],
        [x,           y - m],
        [x,           fadd(y, m)],
        [x - m,       y],
        [fadd(x, m),  y]
    ];
    for (let i = 0; i < 8; i++) {
        const mx = Math.floor(checks[i][0]);
        const my = Math.floor(checks[i][1]);
        if (isCellBlocked(grid, mx, my)) return false;
    }
    return true;
}

export const LORE_MESSAGES = [
    "NOTA #01: El disyuntor central corta las rejas de los sectores Este y Oeste.",
    "NOTA #02: No corras cerca suyo. Si apagas la linterna y te quedas quieto, pierde tu rastro.",
    "NOTA #03: Si te mira de frente, ilumina sus ojos para frenar su avance.",
    "NOTA #04: Los 4 fusibles alimentan la compuerta de evacuacion al Norte (arriba en el plano)."
];
