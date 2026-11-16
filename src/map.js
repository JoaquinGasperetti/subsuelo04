// Mapa 20x20 del Subsuelo 04 y colisiones anti-atravesamiento
// 0 = Pasillo libre
// 1 = Pared de hormigon humedo
// 2 = Pilar/estructura oxidada
// 3 = Pared de zona ritual / sangre
// 4 = Compuerta blindada de salida (Sur)
// 5 = Reja de seguridad (se abre al activar el Disyuntor Central)

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

// Colision robusta con margen amplio (0.34) + puntos medios para impedir atravesar esquinas o paredes
export function isPosWalkable(grid, nx, ny, margin = 0.28) {
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) return false;
    if (nx < 1.0 + margin || nx > MAP_W - 1.0 - margin) return false;
    if (ny < 1.0 + margin || ny > MAP_H - 1.0 - margin) return false;

    const minX = Math.floor(nx - margin);
    const maxX = Math.floor(nx + margin);
    const minY = Math.floor(ny - margin);
    const maxY = Math.floor(ny + margin);

    for (let gy = minY; gy <= maxY; gy++) {
        for (let gx = minX; gx <= maxX; gx++) {
            if (isCellBlocked(grid, gx, gy)) return false;
        }
    }
    return true;
}

// Movimiento con sub-pasos y deslizamiento seguro por eje para evitar atravesar paredes al correr
export function moveWithCollision(grid, entity, dx, dy, margin = 0.28) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.03));
    const sx = dx / steps;
    const sy = dy / steps;
    let bumpedGate = false;

    for (let i = 0; i < steps; i++) {
        if (isPosWalkable(grid, entity.x + sx, entity.y, margin)) {
            entity.x += sx;
        } else {
            const checkX = Math.floor(entity.x + sx + (sx > 0 ? margin : -margin));
            if (getCell(grid, checkX, Math.floor(entity.y)) === 5) bumpedGate = true;
        }

        if (isPosWalkable(grid, entity.x, entity.y + sy, margin)) {
            entity.y += sy;
        } else {
            const checkY = Math.floor(entity.y + sy + (sy > 0 ? margin : -margin));
            if (getCell(grid, Math.floor(entity.x), checkY) === 5) bumpedGate = true;
        }
    }
    return bumpedGate;
}

export const LORE_MESSAGES = [
    "NOTA #01: El disyuntor central corta las rejas de los sectores Este y Oeste.",
    "NOTA #02: No corras cerca suyo. Si apagas la linterna y te quedas quieto, pierde tu rastro.",
    "NOTA #03: Si te mira de frente, ilumina sus ojos para frenar su avance.",
    "NOTA #04: Los 4 fusibles alimentan la compuerta de evacuacion al Sur."
];
