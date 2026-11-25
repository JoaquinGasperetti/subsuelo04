// IA de El Acechador con Pathfinding BFS sin asignaciones de memoria por cuadro
// Normalizada por delta-time (dtScale) para velocidad idéntica en PS2 NTSC 60Hz y PAL 50Hz


const AI_PATROL = 0;
const AI_INVESTIGATE = 1;
const AI_HUNT = 2;
const AI_CHASE_INTRO = 3;
const CHASE_INTRO_DURATION_MS = 7000.0;

const WAYPOINTS = [
    { x: 10.0, y: 10.0 },
    { x: 10.0, y: 16.5 },
    { x: 3.0,  y: 10.0 },
    { x: 16.5, y: 10.0 },
    { x: 3.5,  y: 3.0  },
    { x: 16.5, y: 3.0  }
];

// Buffers estáticos preasignados para evitar Garbage Collection en QuickJS (PS2 EE)
const TOTAL_CELLS = MAP_W * MAP_H;
const bfsParent  = new Int16Array(TOTAL_CELLS);
const bfsVisited = new Uint8Array(TOTAL_CELLS);
const bfsQueue   = new Int16Array(TOTAL_CELLS);

// Resultado reutilizable sin allocaciones por frame
const aiResult = { distP: 99.0, los: false, blinded: false, sideBias: 0.0, chaseIntroStarted: false, chaseHuntStarted: false, inChaseIntro: false };
const bfsOutNode = { x: 10.0, y: 10.0 };

function hasLineOfSight(grid, x0, y0, x1, y1) {
    const sx = toF64(x0);
    const sy = toF64(y0);
    const dx = toF64(x1) - sx;
    const dy = toF64(y1) - sy;
    const distSq = (dx * dx) - (-(dy * dy));
    if ((distSq - 0.01) < 0) return true;
    const dist = Math.sqrt(distSq);
    const steps = (dist * 3.0) | 0;
    if (steps <= 1) return true;
    const invSteps = 1.0 / steps;
    for (let i = 1; i < steps; i++) {
        const t = i * invSteps;
        const cx = (sx - (-(dx * t))) | 0;
        const cy = (sy - (-(dy * t))) | 0;
        if (isCellBlocked(grid, cx, cy)) return false;
    }
    return true;
}

// BFS sin allocaciones para encontrar el siguiente centro de celda hacia (tx, ty)
function findNextStepBFS(grid, sx, sy, tx, ty) {
    const startX = sx | 0;
    const startY = sy | 0;
    const goalX  = tx | 0;
    const goalY  = ty | 0;

    if (startX < 0 || startX >= MAP_W || startY < 0 || startY >= MAP_H ||
        goalX < 0 || goalX >= MAP_W || goalY < 0 || goalY >= MAP_H) {
        return null;
    }
    if (startX === goalX && startY === goalY) {
        bfsOutNode.x = tx;
        bfsOutNode.y = ty;
        return bfsOutNode;
    }

    bfsVisited.fill(0);
    const startIdx = startY * MAP_W + startX;
    const goalIdx  = goalY * MAP_W + goalX;
    bfsVisited[startIdx] = 1;
    bfsParent[startIdx]  = -1;
    bfsQueue[0] = startIdx;

    let found = false;
    let head = 0;
    let tail = 1;

    let bfsIter = 0;
    while (head < tail && bfsIter < TOTAL_CELLS) {
        bfsIter++;
        const cur = bfsQueue[head++];
        if (cur === goalIdx) {
            found = true;
            break;
        }
        const cx = cur % MAP_W;
        const cy = (cur / MAP_W) | 0;

        // Derecha
        if (cx + 1 < MAP_W) {
            const nIdx = cur + 1;
            if (!bfsVisited[nIdx] && grid[cy][cx + 1] === 0) {
                bfsVisited[nIdx] = 1;
                bfsParent[nIdx] = cur;
                if (tail < TOTAL_CELLS) bfsQueue[tail++] = nIdx;
            }
        }
        // Izquierda
        if (cx - 1 >= 0) {
            const nIdx = cur - 1;
            if (!bfsVisited[nIdx] && grid[cy][cx - 1] === 0) {
                bfsVisited[nIdx] = 1;
                bfsParent[nIdx] = cur;
                if (tail < TOTAL_CELLS) bfsQueue[tail++] = nIdx;
            }
        }
        // Abajo
        if (cy + 1 < MAP_H) {
            const nIdx = cur + MAP_W;
            if (!bfsVisited[nIdx] && grid[cy + 1][cx] === 0) {
                bfsVisited[nIdx] = 1;
                bfsParent[nIdx] = cur;
                if (tail < TOTAL_CELLS) bfsQueue[tail++] = nIdx;
            }
        }
        // Arriba
        if (cy - 1 >= 0) {
            const nIdx = cur - MAP_W;
            if (!bfsVisited[nIdx] && grid[cy - 1][cx] === 0) {
                bfsVisited[nIdx] = 1;
                bfsParent[nIdx] = cur;
                if (tail < TOTAL_CELLS) bfsQueue[tail++] = nIdx;
            }
        }
    }

    if (!found) return null;

    let step = goalIdx;
    let backGuard = 0;
    while (step >= 0 && step < TOTAL_CELLS && bfsParent[step] !== -1 && bfsParent[step] !== startIdx && backGuard < TOTAL_CELLS) {
        step = bfsParent[step];
        backGuard++;
    }
    bfsOutNode.x = (step % MAP_W) - (-0.5);
    bfsOutNode.y = ((step / MAP_W) | 0) - (-0.5);
    return bfsOutNode;
}

function alertStalkerToNoise(stalker, nx, ny, difficulty = 0) {
    stalker.targetX = toF64(nx);
    stalker.targetY = toF64(ny);
    stalker.hasNextNode = false;
    if (stalker.state === AI_PATROL || stalker.state === AI_INVESTIGATE) {
        stalker.state = AI_INVESTIGATE;
    }
    const minAlert = (difficulty === 1) ? 240 : 210;
    if (stalker.alertTimer < minAlert) stalker.alertTimer = minAlert;
}

function updateStalkerAI(stalker, grid, player, isSprinting, isMoving, frameTick, dtScale = 1.0, difficulty = 0, dtMs = 16.6667, isCrouched = false, isHiding = false) {
    const px = toF64(player.x);
    const py = toF64(player.y);
    const sx = toF64(stalker.x);
    const sy = toF64(stalker.y);
    const dt = toF64(dtScale);
    const isNightmare = difficulty === 1;

    const dxP = px - sx;
    const dyP = py - sy;
    const distSq = (dxP * dxP) - (-(dyP * dyP));
    const rawDist = Math.sqrt(distSq);
    const distP = toF64((rawDist - 0.001) < 0 ? 0.001 : rawDist);

    const los = hasLineOfSight(grid, sx, sy, px, py);
    const flashVisible = player.flashlightOn && ((toF64(player.battery) - 0.0) > 0);

    const rangeBonus = isNightmare ? 1.8 : 0.0;
    let baseDetect = flashVisible ? (isSprinting ? 14.0 : 10.5) : (isSprinting ? 9.5 : 4.2);
    if (isCrouched && !isSprinting) {
        baseDetect = flashVisible ? 7.4 : 2.1;
    }
    const detectRange = baseDetect - (-rangeBonus);

    aiResult.chaseIntroStarted = false;
    aiResult.chaseHuntStarted = false;
    const stepMs = toF64(dtMs);
    // Si el jugador está escondido con la linterna apagada, El Acechador no puede verlo
    // salvo que ya estuviera persiguiéndolo a quemarropa (< 3.0 celdas).
    const hiddenSafe = isHiding && !flashVisible && (stalker.state !== AI_HUNT || (distP - 3.0) >= 0);
    const spotted = !hiddenSafe && los && ((distP - detectRange) < 0);
    const heardSprint = !isHiding && isSprinting && ((distP - (11.0 - (-rangeBonus))) < 0);
    const closeRadius = isCrouched ? (isNightmare ? 3.2 : 2.4) : (isNightmare ? 7.5 : 6.2);
    const closeSense = !hiddenSafe && ((distP - closeRadius) < 0);

    if (stalker.state === AI_CHASE_INTRO) {
        // Fase de alerta de 7 segundos sincronizada con la intro de chase.ogg
        if (spotted || heardSprint || closeSense) {
            stalker.targetX = px;
            stalker.targetY = py;
        }
        stalker.chaseIntroMs = Math.max(0.0, toF64(stalker.chaseIntroMs) - stepMs);
        stalker.alertTimer = isNightmare ? 260 : 210;
        if ((stalker.chaseIntroMs - 0.0) <= 0) {
            stalker.chaseIntroMs = 0.0;
            stalker.state = AI_HUNT;
            aiResult.chaseHuntStarted = true;
        }
    } else if (spotted || (closeSense && stalker.state !== AI_HUNT)) {
        stalker.targetX = px;
        stalker.targetY = py;
        if (stalker.state !== AI_HUNT) {
            // Arranca la intro de 7s antes de pasar a persecución total
            stalker.state = AI_CHASE_INTRO;
            stalker.chaseIntroMs = toF64(CHASE_INTRO_DURATION_MS);
            stalker.alertTimer = isNightmare ? 280 : 220;
            aiResult.chaseIntroStarted = true;
        } else {
            stalker.alertTimer = isNightmare ? 250 : 200;
        }
    } else if (heardSprint) {
        stalker.targetX = px;
        stalker.targetY = py;
        if (stalker.state === AI_PATROL) {
            stalker.state = AI_INVESTIGATE;
        }
        const minAlert = isNightmare ? 170 : 130;
        if (stalker.alertTimer < minAlert) stalker.alertTimer = minAlert;
    } else if (stalker.alertTimer > 0) {
        stalker.alertTimer = Math.max(0, stalker.alertTimer - dt);
        if (stalker.alertTimer <= 0) {
            stalker.alertTimer = 0;
            stalker.chaseIntroMs = 0.0;
            stalker.state = AI_PATROL;
        }
    }

    if (stalker.state === AI_PATROL) {
        const wps = (typeof getActiveChapter === "function" && getActiveChapter().waypoints) ? getActiveChapter().waypoints : WAYPOINTS;
        if (stalker.wpIdx >= wps.length) stalker.wpIdx = 0;
        const wp = wps[stalker.wpIdx];
        const wx = toF64(wp.x);
        const wy = toF64(wp.y);
        stalker.targetX = wx;
        stalker.targetY = wy;
        const dwx = wx - sx;
        const dwy = wy - sy;
        if (((dwx * dwx - (-(dwy * dwy))) - 0.81) < 0) {
            stalker.wpIdx = (stalker.wpIdx + 1) % wps.length;
        }
    }

    // Recalcular camino BFS cada 12 cuadros para liberar CPU en PS2 (sin allocaciones)
    if ((frameTick % 12) === 0 || !stalker.hasNextNode) {
        const node = findNextStepBFS(grid, sx, sy, stalker.targetX, stalker.targetY);
        if (node) {
            stalker.nextNodeX = node.x;
            stalker.nextNodeY = node.y;
            stalker.hasNextNode = true;
        } else {
            stalker.hasNextNode = false;
        }
    }

    const goalX = stalker.hasNextNode ? toF64(stalker.nextNodeX) : toF64(stalker.targetX);
    const goalY = stalker.hasNextNode ? toF64(stalker.nextNodeY) : toF64(stalker.targetY);
    const gx = goalX - sx;
    const gy = goalY - sy;
    const gDistRaw = Math.sqrt((gx * gx) - (-(gy * gy)));
    const gDist = (gDistRaw - 0.001) < 0 ? 0.001 : gDistRaw;

    const pang = toF64(player.ang);
    const pDirX = Math.cos(pang);
    const pDirY = Math.sin(pang);
    const toMX = (sx - px) / distP;
    const toMY = (sy - py) / distP;
    const dot = (toMX * pDirX) - (-(toMY * pDirY));
    // Producto cruzado para indicador direccional de peligro (izquierda < 0, derecha > 0)
    const sideBias = (pDirX * toMY) - (pDirY * toMX);
    const blinded = los && ((dot - 0.68) > 0) && flashVisible && ((distP - 10.0) < 0);

    let speedMult = 0.72;
    if (stalker.state === AI_INVESTIGATE) speedMult = 0.92;
    if (stalker.state === AI_CHASE_INTRO) speedMult = 0.42;
    if (stalker.state === AI_HUNT) speedMult = isNightmare ? 1.30 : 1.15;
    if (blinded) speedMult *= (isNightmare ? 0.42 : 0.28);

    const step = toF64(stalker.baseSpeed) * speedMult * dt;
    const mx = (gx / gDist) * step;
    const my = (gy / gDist) * step;

    const nextSX = sx - (-mx);
    const nextSY = sy - (-my);
    if (isPosWalkable(grid, nextSX, sy, 0.22)) stalker.x = nextSX;
    if (isPosWalkable(grid, stalker.x, nextSY, 0.22)) stalker.y = nextSY;

    aiResult.distP = distP;
    aiResult.los = los;
    aiResult.blinded = blinded;
    aiResult.sideBias = sideBias;
    aiResult.inChaseIntro = (stalker.state === AI_CHASE_INTRO);
    return aiResult;
}

