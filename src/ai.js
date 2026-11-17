// IA de El Acechador con Pathfinding BFS en grilla 20x20
import { MAP_W, MAP_H, isCellBlocked, isPosWalkable } from "./map.js";
import { toF64, fadd } from "./config.js";

export const AI_PATROL = 0;
export const AI_INVESTIGATE = 1;
export const AI_HUNT = 2;

const WAYPOINTS = [
    { x: 10.0, y: 10.0 },
    { x: 10.0, y: 16.5 },
    { x: 3.0,  y: 10.0 },
    { x: 16.5, y: 10.0 },
    { x: 3.5,  y: 3.0  },
    { x: 16.5, y: 3.0  }
];

export function hasLineOfSight(grid, x0, y0, x1, y1) {
    const sx = toF64(x0);
    const sy = toF64(y0);
    const dx = toF64(x1) - sx;
    const dy = toF64(y1) - sy;
    const dist = toF64(Math.hypot(dx, dy));
    if ((dist - 0.1) < 0) return true;
    const steps = Math.ceil(dist * 4.0);
    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const cx = Math.floor(fadd(sx, dx * t));
        const cy = Math.floor(fadd(sy, dy * t));
        if (isCellBlocked(grid, cx, cy)) return false;
    }
    return true;
}

// BFS ligero para encontrar el siguiente centro de celda hacia (tx, ty)
function findNextStepBFS(grid, sx, sy, tx, ty) {
    const startX = Math.floor(toF64(sx));
    const startY = Math.floor(toF64(sy));
    const goalX = Math.floor(toF64(tx));
    const goalY = Math.floor(toF64(ty));

    if (startX === goalX && startY === goalY) {
        return { x: toF64(tx), y: toF64(ty) };
    }

    const total = MAP_W * MAP_H;
    const parent = new Int16Array(total).fill(-1);
    const visited = new Uint8Array(total);
    const queue = [];

    const startIdx = startY * MAP_W + startX;
    const goalIdx = goalY * MAP_W + goalX;
    visited[startIdx] = 1;
    queue.push(startIdx);

    let found = false;
    let head = 0;

    while (head < queue.length) {
        const cur = queue[head++];
        if (cur === goalIdx) {
            found = true;
            break;
        }
        const cx = cur % MAP_W;
        const cy = Math.floor(cur / MAP_W);

        for (let d = 0; d < 4; d++) {
            let nx = cx, ny = cy;
            if (d === 0) nx++;
            else if (d === 1) nx--;
            else if (d === 2) ny++;
            else ny--;

            if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H) continue;
            const nIdx = ny * MAP_W + nx;
            if (visited[nIdx] || isCellBlocked(grid, nx, ny)) continue;

            visited[nIdx] = 1;
            parent[nIdx] = cur;
            queue.push(nIdx);
        }
    }

    if (!found) return null;

    // Retroceder desde goalIdx hasta el primer paso despues de startIdx
    let step = goalIdx;
    while (parent[step] !== -1 && parent[step] !== startIdx) {
        step = parent[step];
    }
    return {
        x: fadd(step % MAP_W, 0.5),
        y: fadd(Math.floor(step / MAP_W), 0.5)
    };
}

export function updateStalkerAI(stalker, grid, player, isSprinting, isMoving, frameTick) {
    const px = toF64(player.x);
    const py = toF64(player.y);
    const sx = toF64(stalker.x);
    const sy = toF64(stalker.y);

    const dxP = px - sx;
    const dyP = py - sy;
    const distP = toF64(Math.max(0.001, Math.hypot(dxP, dyP)));

    const los = hasLineOfSight(grid, sx, sy, px, py);
    const flashVisible = player.flashlightOn && ((toF64(player.battery) - 0.0) > 0);

    // Rango de deteccion depende de luz y ruido
    const detectRange = flashVisible ? (isSprinting ? 14.0 : 10.5) : (isSprinting ? 9.5 : 4.2);

    if (los && (distP - detectRange) < 0) {
        stalker.state = AI_HUNT;
        stalker.targetX = px;
        stalker.targetY = py;
        stalker.alertTimer = 180;
    } else if (isSprinting && (distP - 11.0) < 0) {
        if (stalker.state !== AI_HUNT) stalker.state = AI_INVESTIGATE;
        stalker.targetX = px;
        stalker.targetY = py;
        stalker.alertTimer = Math.max(stalker.alertTimer, 130);
    } else if (stalker.alertTimer > 0) {
        stalker.alertTimer--;
        if (stalker.alertTimer === 0) {
            stalker.state = AI_PATROL;
        }
    }

    if (stalker.state === AI_PATROL) {
        const wp = WAYPOINTS[stalker.wpIdx];
        stalker.targetX = toF64(wp.x);
        stalker.targetY = toF64(wp.y);
        if ((Math.hypot(stalker.targetX - sx, stalker.targetY - sy) - 0.9) < 0) {
            stalker.wpIdx = (stalker.wpIdx + 1) % WAYPOINTS.length;
        }
    }

    // Recalcular camino BFS cada 8 cuadros para mantener 60 FPS constantes
    if ((frameTick % 8) === 0 || !stalker.nextNode) {
        stalker.nextNode = findNextStepBFS(grid, sx, sy, stalker.targetX, stalker.targetY);
    }

    const goal = stalker.nextNode || { x: stalker.targetX, y: stalker.targetY };
    const gx = toF64(goal.x) - sx;
    const gy = toF64(goal.y) - sy;
    const gDist = toF64(Math.max(0.001, Math.hypot(gx, gy)));

    // Si el jugador lo enfoca directo con la linterna, se frena fuertemente
    const pang = toF64(player.ang);
    const pDirX = toF64(Math.cos(pang));
    const pDirY = toF64(Math.sin(pang));
    const toMX = (sx - px) / distP;
    const toMY = (sy - py) / distP;
    const dot = fadd(toMX * pDirX, toMY * pDirY);
    const blinded = los && ((dot - 0.68) > 0) && flashVisible && ((distP - 10.0) < 0);

    let speedMult = 0.72;
    if (stalker.state === AI_INVESTIGATE) speedMult = 0.92;
    if (stalker.state === AI_HUNT) speedMult = 1.15;
    if (blinded) speedMult *= 0.28;

    const step = toF64(stalker.baseSpeed) * speedMult;
    const mx = (gx / gDist) * step;
    const my = (gy / gDist) * step;

    const nextSX = fadd(sx, mx);
    const nextSY = fadd(sy, my);
    if (isPosWalkable(grid, nextSX, sy, 0.22)) stalker.x = nextSX;
    if (isPosWalkable(grid, stalker.x, nextSY, 0.22)) stalker.y = nextSY;

    return { distP, los, blinded };
}
