// IA de El Acechador con Pathfinding BFS en grilla 20x20
import { MAP_W, MAP_H, isCellBlocked, isPosWalkable } from "./map.js";

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
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.1) return true;
    const steps = Math.ceil(dist * 4);
    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const cx = Math.floor(x0 + dx * t);
        const cy = Math.floor(y0 + dy * t);
        if (isCellBlocked(grid, cx, cy)) return false;
    }
    return true;
}

// BFS ligero para encontrar el siguiente centro de celda hacia (tx, ty)
function findNextStepBFS(grid, sx, sy, tx, ty) {
    const startX = Math.floor(sx);
    const startY = Math.floor(sy);
    const goalX = Math.floor(tx);
    const goalY = Math.floor(ty);

    if (startX === goalX && startY === goalY) {
        return { x: tx, y: ty };
    }

    const total = MAP_W * MAP_H;
    const parent = new Int16Array(total).fill(-1);
    const visited = new Uint8Array(total);
    const queue = [];

    const startIdx = startY * MAP_W + startX;
    const goalIdx = goalY * MAP_W + goalX;
    visited[startIdx] = 1;
    queue.push(startIdx);

    const dirs = [1, -1, MAP_W, -MAP_W];
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
        x: (step % MAP_W) + 0.5,
        y: Math.floor(step / MAP_W) + 0.5
    };
}

export function updateStalkerAI(stalker, grid, player, isSprinting, isMoving, frameTick) {
    const dxP = player.x - stalker.x;
    const dyP = player.y - stalker.y;
    const distP = Math.max(0.001, Math.hypot(dxP, dyP));

    const los = hasLineOfSight(grid, stalker.x, stalker.y, player.x, player.y);
    const flashVisible = player.flashlightOn && player.battery > 0.0;

    // Rango de deteccion depende de luz y ruido
    const detectRange = flashVisible ? (isSprinting ? 14.0 : 10.5) : (isSprinting ? 9.5 : 4.2);

    if (los && distP < detectRange) {
        stalker.state = AI_HUNT;
        stalker.targetX = player.x;
        stalker.targetY = player.y;
        stalker.alertTimer = 180;
    } else if (isSprinting && distP < 11.0) {
        if (stalker.state !== AI_HUNT) stalker.state = AI_INVESTIGATE;
        stalker.targetX = player.x;
        stalker.targetY = player.y;
        stalker.alertTimer = Math.max(stalker.alertTimer, 130);
    } else if (stalker.alertTimer > 0) {
        stalker.alertTimer--;
        if (stalker.alertTimer === 0) {
            stalker.state = AI_PATROL;
        }
    }

    if (stalker.state === AI_PATROL) {
        const wp = WAYPOINTS[stalker.wpIdx];
        stalker.targetX = wp.x;
        stalker.targetY = wp.y;
        if (Math.hypot(wp.x - stalker.x, wp.y - stalker.y) < 0.9) {
            stalker.wpIdx = (stalker.wpIdx + 1) % WAYPOINTS.length;
        }
    }

    // Recalcular camino BFS cada 8 cuadros para mantener 60 FPS constantes
    if ((frameTick % 8) === 0 || !stalker.nextNode) {
        stalker.nextNode = findNextStepBFS(grid, stalker.x, stalker.y, stalker.targetX, stalker.targetY);
    }

    const goal = stalker.nextNode || { x: stalker.targetX, y: stalker.targetY };
    const gx = goal.x - stalker.x;
    const gy = goal.y - stalker.y;
    const gDist = Math.max(0.001, Math.hypot(gx, gy));

    // Si el jugador lo enfoca directo con la linterna, se frena fuertemente
    const pDirX = Math.cos(player.ang);
    const pDirY = Math.sin(player.ang);
    const toMX = (stalker.x - player.x) / distP;
    const toMY = (stalker.y - player.y) / distP;
    const dot = toMX * pDirX + toMY * pDirY;
    const blinded = los && (dot > 0.68) && flashVisible && distP < 10.0;

    let speedMult = 0.72;
    if (stalker.state === AI_INVESTIGATE) speedMult = 0.92;
    if (stalker.state === AI_HUNT) speedMult = 1.15;
    if (blinded) speedMult *= 0.28;

    const step = stalker.baseSpeed * speedMult;
    const mx = (gx / gDist) * step;
    const my = (gy / gDist) * step;

    if (isPosWalkable(grid, stalker.x + mx, stalker.y, 0.22)) stalker.x += mx;
    if (isPosWalkable(grid, stalker.x, stalker.y + my, 0.22)) stalker.y += my;

    return { distP, los, blinded };
}
