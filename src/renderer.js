// Renderizador 3D Raycaster de 320 columnas (optimizado para PCSX2)
import { MAP_W, MAP_H } from "./map.js";

export const NUM_RAYS = 320;
export const FOV = 1.05;
const zBuffer = new Float32Array(NUM_RAYS);

export function render3DWorld(screenW, screenH, grid, player, stalker, entities, dangerRatio, frameTick, breakerActive) {
    const colW = Math.floor(screenW / NUM_RAYS);
    const bobOffset = Math.floor(Math.sin(player.bobPhase) * 6.0);
    const panicShake = (dangerRatio > 0.35) ? Math.floor((Math.random() - 0.5) * 6.0 * dangerRatio) : 0;
    const halfH = Math.floor(screenH * 0.5) + bobOffset + panicShake;

    // 1. Techo y piso con bandas de profundidad y pulso rojo de peligro
    const ceilR = Math.floor(7 + dangerRatio * 26);
    Draw.rect(0, 0, screenW, Math.max(1, halfH), Color.new(ceilR, 5, 10, 128));
    Draw.rect(0, Math.max(0, halfH), screenW, screenH - Math.max(0, halfH), Color.new(16 + Math.floor(dangerRatio * 18), 13, 14, 128));

    // Bandas de profundidad en piso/techo para mayor sensacion 3D
    Draw.rect(0, Math.max(0, halfH - 42), screenW, 84, Color.new(4, 3, 6, 128));
    Draw.rect(0, Math.max(0, halfH - 18), screenW, 36, Color.new(2, 2, 4, 128));

    const flashActive = player.flashlightOn && player.battery > 0.0;
    const lowFlicker = (flashActive && player.battery < 22.0 && (frameTick % 11 === 0)) ? 0.32 : 1.0;
    const emerFlicker = ((frameTick % 97) < 6) ? 0.45 : 1.0;

    const dirX = Math.cos(player.ang);
    const dirY = Math.sin(player.ang);
    const planeScale = Math.tan(FOV * 0.5);
    const planeX = -dirY * planeScale;
    const planeY =  dirX * planeScale;

    // 2. Raycasting DDA de 320 columnas (2px de ancho por columna)
    for (let i = 0; i < NUM_RAYS; i++) {
        const camX = (2.0 * (i + 0.5) / NUM_RAYS) - 1.0;
        const rayDirX = dirX + planeX * camX;
        const rayDirY = dirY + planeY * camX;

        let mapX = Math.floor(player.x);
        let mapY = Math.floor(player.y);

        const deltaDistX = (Math.abs(rayDirX) < 1e-6) ? 1e6 : Math.abs(1.0 / rayDirX);
        const deltaDistY = (Math.abs(rayDirY) < 1e-6) ? 1e6 : Math.abs(1.0 / rayDirY);

        let stepX = 0, stepY = 0;
        let sideDistX = 0, sideDistY = 0;

        if (rayDirX < 0) {
            stepX = -1;
            sideDistX = (player.x - mapX) * deltaDistX;
        } else {
            stepX = 1;
            sideDistX = (mapX + 1.0 - player.x) * deltaDistX;
        }

        if (rayDirY < 0) {
            stepY = -1;
            sideDistY = (player.y - mapY) * deltaDistY;
        } else {
            stepY = 1;
            sideDistY = (mapY + 1.0 - player.y) * deltaDistY;
        }

        let hit = 0;
        let side = 0;
        let steps = 0;
        while (hit === 0 && steps < 64) {
            steps++;
            if (sideDistX < sideDistY) {
                sideDistX += deltaDistX;
                mapX += stepX;
                side = 0;
            } else {
                sideDistY += deltaDistY;
                mapY += stepY;
                side = 1;
            }
            if (mapX < 0 || mapX >= MAP_W || mapY < 0 || mapY >= MAP_H) {
                hit = 1;
                break;
            }
            if (grid[mapY][mapX] > 0) {
                hit = grid[mapY][mapX];
            }
        }

        let perpDist = (side === 0) ? (sideDistX - deltaDistX) : (sideDistY - deltaDistY);
        if (perpDist < 0.12) perpDist = 0.12;
        zBuffer[i] = perpDist;

        const wallH = Math.floor(screenH / perpDist);
        const rawStart = halfH - Math.floor(wallH * 0.5);
        const rawEnd = rawStart + wallH;
        const drawStart = Math.max(0, rawStart);
        const drawEnd = Math.min(screenH, rawEnd);
        const clippedH = drawEnd - drawStart;
        if (clippedH <= 0) continue;

        // Iluminacion por distancia + cono de linterna
        const centerDist = Math.abs(camX);
        const beam = flashActive ? Math.max(0.0, 1.0 - centerDist * 1.45) * lowFlicker : 0.0;
        const maxVis = flashActive ? (6.0 + beam * 6.0) : 3.4;
        let light = Math.max(0.05, 1.0 - (perpDist / maxVis));
        if (side === 1) light *= 0.72;
        light = Math.min(1.0, light + beam * 0.28 * Math.max(0.0, 1.0 - perpDist / 10.5));

        let wallX = (side === 0) ? (player.y + perpDist * rayDirY) : (player.x + perpDist * rayDirX);
        wallX -= Math.floor(wallX);

        // Detalle procedural por textura de franjas
        const isSeam = (wallX < 0.04 || wallX > 0.96);
        const isPanel = (Math.floor(wallX * 8) % 2 === 0);
        if (isSeam) light *= 0.58;
        else if (isPanel) light *= 0.92;

        let r = 108, g = 114, b = 122;
        if (hit === 2) {
            r = 138; g = 74; b = 56; // Pilar oxidado
        } else if (hit === 3) {
            r = Math.floor(155 * emerFlicker); g = 32; b = 32; // Zona ritual / luz roja
        } else if (hit === 4) {
            r = breakerActive ? 48 : 145;
            g = breakerActive ? 215 : 115;
            b = breakerActive ? 92 : 40;
        } else if (hit === 5) {
            // Reja de seguridad metalica (franjas alternadas)
            const bar = (Math.floor(wallX * 10) % 2 === 0);
            r = bar ? 95 : 35;
            g = bar ? 105 : 40;
            b = bar ? 115 : 48;
        }

        const cR = Math.min(255, Math.floor(r * light + dangerRatio * 22));
        const cG = Math.min(255, Math.floor(g * light));
        const cB = Math.min(255, Math.floor(b * light));
        Draw.rect(i * colW, drawStart, colW, clippedH, Color.new(cR, cG, cB, 128));
    }

    // 3. Proyeccion 3D de Entidades con Z-Buffer
    const drawList = [];
    for (let e = 0; e < entities.length; e++) {
        if (!entities[e].taken) {
            drawList.push(entities[e]);
        }
    }
    drawList.push({
        kind: "stalker",
        x: stalker.x,
        y: stalker.y
    });

    for (let s = 0; s < drawList.length; s++) {
        drawList[s].distSq = (drawList[s].x - player.x) ** 2 + (drawList[s].y - player.y) ** 2;
    }
    drawList.sort((a, b) => b.distSq - a.distSq);

    const invDet = 1.0 / (planeX * dirY - dirX * planeY);
    for (let s = 0; s < drawList.length; s++) {
        const sp = drawList[s];
        const sx = sp.x - player.x;
        const sy = sp.y - player.y;
        const transformX = invDet * (dirY * sx - dirX * sy);
        const transformY = invDet * (-planeY * sx + planeX * sy);

        if (transformY <= 0.22) continue;

        const screenX = Math.floor((screenW * 0.5) * (1.0 + transformX / transformY));
        const spH = Math.min(screenH * 2, Math.floor(screenH / transformY));
        const colIdx = Math.floor(screenX / colW);

        if (sp.kind === "stalker") {
            const mW = Math.max(12, Math.floor(spH * 0.44));
            const mH = Math.floor(spH * 0.88);
            const mLeft = screenX - Math.floor(mW * 0.5);
            const mTop = Math.max(0, halfH - Math.floor(mH * 0.5) + Math.floor(Math.sin(frameTick * 0.22) * 3));
            const drawH = Math.min(screenH - mTop, mH);
            if (drawH <= 0) continue;

            const cStart = Math.max(0, Math.floor(mLeft / colW));
            const cEnd = Math.min(NUM_RAYS - 1, Math.floor((mLeft + mW) / colW));
            let visible = false;
            for (let c = cStart; c <= cEnd; c++) {
                if (transformY < zBuffer[c]) { visible = true; break; }
            }
            if (!visible) continue;

            // Silueta + garras + cabeza palida + ojos carmesi
            Draw.rect(mLeft, mTop + Math.floor(drawH * 0.22), mW, Math.floor(drawH * 0.78), Color.new(18, 5, 8, 128));
            const headW = Math.floor(mW * 0.56);
            const headH = Math.floor(drawH * 0.24);
            Draw.rect(screenX - Math.floor(headW * 0.5), mTop, headW, headH, Color.new(180, 150, 145, 128));
            const eyeSize = Math.max(2, Math.floor(headW * 0.22));
            Draw.rect(screenX - Math.floor(headW * 0.30), mTop + Math.floor(headH * 0.38), eyeSize, eyeSize, Color.new(255, 20, 20, 128));
            Draw.rect(screenX + Math.floor(headW * 0.12), mTop + Math.floor(headH * 0.38), eyeSize, eyeSize, Color.new(255, 20, 20, 128));
        } else {
            if (colIdx < 0 || colIdx >= NUM_RAYS || transformY >= zBuffer[colIdx]) continue;
            const itemSize = Math.max(6, Math.floor(spH * 0.30));
            const iy = Math.max(0, Math.min(screenH - itemSize, halfH + Math.floor(spH * 0.14) + Math.floor(Math.sin(frameTick * 0.1 + s) * 5)));
            const ix = screenX - Math.floor(itemSize * 0.4);

            if (sp.kind === "fuse") {
                Draw.rect(ix, iy, Math.floor(itemSize * 0.8), itemSize, Color.new(255, 205, 45, 128));
                Draw.rect(ix + 2, iy + 2, Math.max(2, Math.floor(itemSize * 0.4)), Math.max(2, Math.floor(itemSize * 0.5)), Color.new(255, 250, 195, 128));
            } else if (sp.kind === "battery") {
                Draw.rect(ix, iy, Math.floor(itemSize * 0.75), itemSize, Color.new(40, 220, 245, 128));
                Draw.rect(ix + 2, iy + 2, Math.max(2, Math.floor(itemSize * 0.35)), Math.max(2, Math.floor(itemSize * 0.4)), Color.new(200, 255, 255, 128));
            } else if (sp.kind === "breaker") {
                Draw.rect(ix, iy - Math.floor(itemSize * 0.4), itemSize, itemSize, Color.new(235, 55, 55, 128));
                Draw.rect(ix + 2, iy - Math.floor(itemSize * 0.3), Math.max(2, itemSize - 4), Math.max(2, Math.floor(itemSize * 0.4)), Color.new(255, 230, 100, 128));
            } else if (sp.kind === "note") {
                Draw.rect(ix, iy + 4, Math.floor(itemSize * 0.8), Math.floor(itemSize * 0.65), Color.new(230, 235, 245, 128));
            }
        }
    }
}

export function renderMinimap(screenW, screenH, grid, player, stalker, entities, dangerRatio) {
    const cellPx = 5;
    const mapPx = MAP_W * cellPx;
    const ox = screenW - mapPx - 14;
    const oy = 42;

    Draw.rect(ox - 3, oy - 3, mapPx + 6, mapPx + 6, Color.new(0, 0, 0, 95));
    for (let y = 0; y < MAP_H; y++) {
        for (let x = 0; x < MAP_W; x++) {
            const v = grid[y][x];
            if (v > 0) {
                const col = (v === 4) ? Color.new(60, 220, 100, 115)
                          : (v === 5) ? Color.new(220, 160, 60, 115)
                          : (v === 3) ? Color.new(140, 40, 40, 115)
                          : Color.new(85, 90, 100, 115);
                Draw.rect(ox + x * cellPx, oy + y * cellPx, cellPx, cellPx, col);
            }
        }
    }

    // Entidades sin recoger
    for (let i = 0; i < entities.length; i++) {
        const e = entities[i];
        if (e.taken) continue;
        const ec = (e.kind === "fuse") ? Color.new(255, 220, 60, 128)
                 : (e.kind === "battery") ? Color.new(60, 230, 255, 128)
                 : (e.kind === "breaker") ? Color.new(255, 80, 80, 128)
                 : Color.new(230, 230, 245, 128);
        Draw.rect(ox + Math.floor(e.x * cellPx) - 1, oy + Math.floor(e.y * cellPx) - 1, 3, 3, ec);
    }

    // Acechador (parpadea si esta cerca)
    if (dangerRatio > 0.2) {
        Draw.rect(ox + Math.floor(stalker.x * cellPx) - 2, oy + Math.floor(stalker.y * cellPx) - 2, 4, 4, Color.new(255, 30, 30, 128));
    }

    // Jugador + vector de direccion
    const px = ox + Math.floor(player.x * cellPx);
    const py = oy + Math.floor(player.y * cellPx);
    Draw.rect(px - 2, py - 2, 4, 4, Color.new(100, 255, 140, 128));
    Draw.line(px, py, px + Math.floor(Math.cos(player.ang) * 8), py + Math.floor(Math.sin(player.ang) * 8), Color.new(140, 255, 170, 128));
}
