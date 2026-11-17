// Renderizador 3D Raycaster de 160 columnas + PDA Tactico Animado
import { MAP_W, MAP_H } from "./map.js";
import { ENABLE_BOB, F64_ZERO, toF64, fadd } from "./config.js";

export const NUM_RAYS = 160;
// Se usa Float64Array en lugar de Float32Array para evitar que QuickJS de AthenaEnv
// devuelva JS_CUSTOM_TAG_FLOAT32 al leer zBuffer[i] y falle al compararlo con FLOAT64.
const zBuffer = new Float64Array(NUM_RAYS);

// Diagnostico: estadisticas del ultimo frame y modo de color de paredes (0 normal, 1 magenta plano)
export const renderStats = { cols: 0, minD: 99.0, maxD: 0.0, wallMode: 0 };

export function render3DWorld(screenW, screenH, grid, player, stalker, entities, dangerRatio, frameTick, breakerActive, fov, flashIntensity) {
    const px = toF64(player.x);
    const py = toF64(player.y);
    const pang = toF64(player.ang);
    const pbob = toF64(player.bobPhase);
    const pbat = toF64(player.battery);
    const dRatio = toF64(dangerRatio);
    const fovVal = toF64(fov);
    const fInt = toF64(flashIntensity);

    const colW = Math.floor(screenW / NUM_RAYS);
    const bobOffset = ENABLE_BOB ? Math.floor(Math.sin(pbob) * 6.5) : 0;
    const swayOffset = ENABLE_BOB ? Math.floor(Math.cos(pbob * 0.5) * 3.0) : 0;
    const panicShakeY = (ENABLE_BOB && (dRatio - 0.30) > 0) ? Math.floor((Math.random() - 0.5) * 7.0 * dRatio) : 0;
    const panicShakeX = (ENABLE_BOB && (dRatio - 0.45) > 0) ? Math.floor((Math.random() - 0.5) * 4.0 * dRatio) : 0;
    const halfH = Math.floor(screenH * 0.5) + bobOffset + panicShakeY;

    // 1. Techo y piso con bandas de profundidad y pulso rojo de peligro
    const ceilR = Math.floor(fadd(7.0, dRatio * 28.0));
    Draw.rect(0, 0, screenW, Math.max(1, halfH), Color.new(ceilR, 5, 10, 128));
    Draw.rect(0, Math.max(0, halfH), screenW, screenH - Math.max(0, halfH), Color.new(16 + Math.floor(dRatio * 20.0), 13, 14, 128));

    Draw.rect(0, Math.max(0, halfH - 42), screenW, 84, Color.new(4, 3, 6, 128));
    Draw.rect(0, Math.max(0, halfH - 18), screenW, 36, Color.new(2, 2, 4, 128));

    const flashActive = player.flashlightOn && ((pbat - 0.0) > 0);
    const lowFlicker = (flashActive && ((pbat - 24.0) < 0) && (frameTick % 9 === 0 || frameTick % 23 === 0)) ? 0.28 : 1.0;
    const effFlash = toF64(flashActive ? (fInt * lowFlicker) : 0.0);
    const emerFlicker = toF64(((frameTick % 97) < 6) ? 0.42 : 1.0);

    const dirX = toF64(Math.cos(pang));
    const dirY = toF64(Math.sin(pang));
    const planeScale = toF64(Math.tan(fovVal * 0.5));
    const planeX = -dirY * planeScale;
    const planeY =  dirX * planeScale;

    renderStats.cols = 0;
    renderStats.minD = toF64(99.0);
    renderStats.maxD = toF64(0.0);

    // 2. Raycasting DDA de 160 columnas
    for (let i = 0; i < NUM_RAYS; i++) {
        const camX = (2.0 * fadd(i, 0.5) / NUM_RAYS) - 1.0;
        const rayDirX = fadd(dirX, planeX * camX);
        const rayDirY = fadd(dirY, planeY * camX);

        let mapX = Math.floor(px);
        let mapY = Math.floor(py);

        const absRayX = Math.abs(rayDirX);
        const absRayY = Math.abs(rayDirY);
        const deltaDistX = toF64(((absRayX - 1e-6) < 0) ? 1e6 : Math.abs(1.0 / rayDirX));
        const deltaDistY = toF64(((absRayY - 1e-6) < 0) ? 1e6 : Math.abs(1.0 / rayDirY));

        let stepX = 0, stepY = 0;
        let sideDistX = F64_ZERO, sideDistY = F64_ZERO;

        if (rayDirX < 0) {
            stepX = -1;
            sideDistX = (px - mapX) * deltaDistX;
        } else {
            stepX = 1;
            sideDistX = (fadd(mapX, 1.0) - px) * deltaDistX;
        }

        if (rayDirY < 0) {
            stepY = -1;
            sideDistY = (py - mapY) * deltaDistY;
        } else {
            stepY = 1;
            sideDistY = (fadd(mapY, 1.0) - py) * deltaDistY;
        }

        let hit = 0;
        let side = 0;
        let steps = 0;
        while (hit === 0 && steps < 64) {
            steps++;
            if ((sideDistX - sideDistY) < 0) {
                sideDistX = fadd(sideDistX, deltaDistX);
                mapX += stepX;
                side = 0;
            } else {
                sideDistY = fadd(sideDistY, deltaDistY);
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
        if ((perpDist - 0.14) < 0) perpDist = toF64(0.14);
        zBuffer[i] = perpDist;

        const wallH = Math.floor(screenH / perpDist);
        const rawStart = halfH - Math.floor(wallH * 0.5);
        const rawEnd = rawStart + wallH;
        const drawStart = Math.max(0, rawStart);
        const drawEnd = Math.min(screenH, rawEnd);
        const clippedH = drawEnd - drawStart;
        if (clippedH <= 0) continue;

        const centerDist = Math.abs(camX);
        const beam = ((effFlash - 0.0) > 0) ? Math.max(0.0, 1.0 - centerDist * 1.45) * effFlash : 0.0;
        const maxVis = ((effFlash - 0.0) > 0) ? fadd(6.0, beam * 6.0) : 3.3;
        let light = Math.max(0.16, 1.0 - (perpDist / maxVis));
        if (side === 1) light *= 0.72;
        light = Math.min(1.0, fadd(light, beam * 0.28 * Math.max(0.0, 1.0 - perpDist / 10.5)));

        let wallX = (side === 0) ? fadd(py, perpDist * rayDirY) : fadd(px, perpDist * rayDirX);
        wallX -= Math.floor(wallX);

        const isSeam = ((wallX - 0.04) < 0 || (wallX - 0.96) > 0);
        const isPanel = (Math.floor(wallX * 8.0) % 2 === 0);
        if (isSeam) light *= 0.58;
        else if (isPanel) light *= 0.92;

        let r = 108, g = 114, b = 122;
        if (hit === 2) {
            r = 138; g = 74; b = 56;
        } else if (hit === 3) {
            r = Math.floor(155 * emerFlicker); g = 32; b = 32;
        } else if (hit === 4) {
            r = breakerActive ? 48 : 145;
            g = breakerActive ? 215 : 115;
            b = breakerActive ? 92 : 40;
        } else if (hit === 5) {
            const bar = (Math.floor(wallX * 10.0) % 2 === 0);
            r = bar ? 95 : 35;
            g = bar ? 105 : 40;
            b = bar ? 115 : 48;
        }

        const cR = Math.min(255, Math.floor(fadd(r * light, dRatio * 24.0)));
        const cG = Math.min(255, Math.floor(g * light));
        const cB = Math.min(255, Math.floor(b * light));
        renderStats.cols++;
        if ((perpDist - renderStats.minD) < 0) renderStats.minD = perpDist;
        if ((perpDist - renderStats.maxD) > 0) renderStats.maxD = perpDist;
        if (renderStats.wallMode === 1) {
            Draw.rect(i * colW, drawStart, colW, clippedH, Color.new(255, 0, 255, 128));
        } else {
            Draw.rect(i * colW, drawStart, colW, clippedH, Color.new(cR, cG, cB, 128));
        }
    }

    // 3. Proyeccion 3D de Entidades con Z-Buffer
    const drawList = [];
    for (let e = 0; e < entities.length; e++) {
        if (!entities[e].taken) drawList.push(entities[e]);
    }
    drawList.push({ kind: "stalker", x: toF64(stalker.x), y: toF64(stalker.y) });

    for (let s = 0; s < drawList.length; s++) {
        const dx = toF64(drawList[s].x) - px;
        const dy = toF64(drawList[s].y) - py;
        drawList[s].distSq = fadd(dx * dx, dy * dy);
    }
    drawList.sort((a, b) => b.distSq - a.distSq);

    const invDet = 1.0 / (planeX * dirY - dirX * planeY);
    for (let s = 0; s < drawList.length; s++) {
        const sp = drawList[s];
        const sx = toF64(sp.x) - px;
        const sy = toF64(sp.y) - py;
        const transformX = invDet * (dirY * sx - dirX * sy);
        const transformY = invDet * fadd(-planeY * sx, planeX * sy);

        if ((transformY - 0.22) <= 0) continue;

        const screenX = Math.floor((screenW * 0.5) * fadd(1.0, transformX / transformY)) + swayOffset + panicShakeX;
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
                if ((transformY - zBuffer[c]) < 0) { visible = true; break; }
            }
            if (!visible) continue;

            const bodyX = Math.max(0, mLeft);
            const bodyW = Math.min(screenW, mLeft + mW) - bodyX;
            if (bodyW > 0) {
                Draw.rect(bodyX, mTop + Math.floor(drawH * 0.22), bodyW, Math.floor(drawH * 0.78), Color.new(18, 5, 8, 128));
            }
            const headW = Math.floor(mW * 0.56);
            const headH = Math.floor(drawH * 0.24);
            const headL = screenX - Math.floor(headW * 0.5);
            const headX = Math.max(0, headL);
            const headDrawW = Math.min(screenW, headL + headW) - headX;
            if (headDrawW > 0 && headH > 0) {
                Draw.rect(headX, mTop, headDrawW, headH, Color.new(180, 150, 145, 128));
            }
            const eyeSize = Math.max(2, Math.floor(headW * 0.22));
            const eyeY = mTop + Math.floor(headH * 0.38);
            const e1x = screenX - Math.floor(headW * 0.30);
            const e2x = screenX + Math.floor(headW * 0.12);
            if (e1x >= 0 && e1x + eyeSize <= screenW) Draw.rect(e1x, eyeY, eyeSize, eyeSize, Color.new(255, 20, 20, 128));
            if (e2x >= 0 && e2x + eyeSize <= screenW) Draw.rect(e2x, eyeY, eyeSize, eyeSize, Color.new(255, 20, 20, 128));
        } else {
            if (colIdx < 0 || colIdx >= NUM_RAYS || (transformY - zBuffer[colIdx]) >= 0) continue;
            const itemSize = Math.max(6, Math.floor(spH * 0.30));
            const iy = Math.max(0, Math.min(screenH - itemSize, halfH + Math.floor(spH * 0.14) + Math.floor(Math.sin(fadd(frameTick * 0.1, s)) * 5)));
            const ix = screenX - Math.floor(itemSize * 0.4);

            if (ix < 0 || ix + itemSize > screenW) continue;
            if (sp.kind === "fuse") {
                Draw.rect(ix, iy, Math.floor(itemSize * 0.8), itemSize, Color.new(255, 205, 45, 128));
                Draw.rect(ix + 2, iy + 2, Math.max(2, Math.floor(itemSize * 0.4)), Math.max(2, Math.floor(itemSize * 0.5)), Color.new(255, 250, 195, 128));
            } else if (sp.kind === "battery") {
                Draw.rect(ix, iy, Math.floor(itemSize * 0.75), itemSize, Color.new(40, 220, 245, 128));
                Draw.rect(ix + 2, iy + 2, Math.max(2, Math.floor(itemSize * 0.35)), Math.max(2, Math.floor(itemSize * 0.4)), Color.new(200, 255, 255, 128));
            } else if (sp.kind === "breaker") {
                const by = Math.max(0, iy - Math.floor(itemSize * 0.4));
                Draw.rect(ix, by, itemSize, itemSize, Color.new(235, 55, 55, 128));
                Draw.rect(ix + 2, by + 2, Math.max(2, itemSize - 4), Math.max(2, Math.floor(itemSize * 0.4)), Color.new(255, 230, 100, 128));
            } else if (sp.kind === "note") {
                Draw.rect(ix, Math.min(screenH - itemSize, iy + 4), Math.floor(itemSize * 0.8), Math.floor(itemSize * 0.65), Color.new(230, 235, 245, 128));
            }
        }
    }
}

// PDA Tactico animado (se desliza desde abajo y despliega al presionar SELECT o L2)
export function renderAnimatedMapPDA(screenW, screenH, grid, player, stalker, entities, dangerRatio, mapAnim, frameTick, fnt) {
    const mAnim = toF64(mapAnim);
    const dRatio = toF64(dangerRatio);
    if ((mAnim - 0.01) <= 0) return;

    // Ease-out cubic para una animacion suave al levantar el plano
    const ease = 1.0 - Math.pow(1.0 - mAnim, 3);
    const panelW = 360;
    const panelH = 290;
    const targetY = Math.floor((screenH - panelH) * 0.5);
    const ox = Math.floor((screenW - panelW) * 0.5);
    const oy = Math.floor(fadd(screenH, (targetY - screenH) * ease));

    // Oscurecer fondo proporcionalmente
    Draw.rect(0, 0, screenW, screenH, Color.new(0, 0, 0, Math.floor(75 * ease)));

    // Carcasa del PDA / Plano tactico
    Draw.rect(ox - 6, oy - 6, panelW + 12, panelH + 12, Color.new(20, 34, 24, 122));
    Draw.rect(ox, oy, panelW, panelH, Color.new(6, 14, 9, 124));

    // Cabecera del PDA + Brujula cardinal (N arriba, S abajo, O izq, E der)
    Draw.rect(ox, oy, panelW, 28, Color.new(14, 38, 20, 126));
    fnt.scale = Math.fround(0.48);
    fnt.color = Color.new(110, 245, 140, 128);
    fnt.print(ox + 10, oy + 6, "PLANO SUBSUELO 04 [SELECT / L2]");

    // Grilla 20x20 centrada
    const cellPx = 11;
    const mapPx = MAP_W * cellPx; // 220
    const mx0 = ox + 16;
    const my0 = oy + 42;

    for (let y = 0; y < MAP_H; y++) {
        let x = 0;
        while (x < MAP_W) {
            const v = grid[y][x];
            if (v > 0) {
                let run = 1;
                while (x + run < MAP_W && grid[y][x + run] === v) run++;
                const col = (v === 4) ? Color.new(60, 235, 110, 128)
                          : (v === 5) ? Color.new(235, 165, 55, 128)
                          : (v === 3) ? Color.new(165, 45, 45, 128)
                          : Color.new(55, 115, 70, 120);
                Draw.rect(mx0 + x * cellPx, my0 + y * cellPx, run * cellPx - 1, cellPx - 1, col);
                x += run;
            } else {
                x++;
            }
        }
    }

    // Linea de barrido tipo radar
    const scanY = my0 + ((frameTick * 3) % mapPx);
    Draw.rect(mx0, scanY, mapPx, 2, Color.new(80, 255, 120, 52));

    // Entidades
    for (let i = 0; i < entities.length; i++) {
        const e = entities[i];
        if (e.taken) continue;
        const ec = (e.kind === "fuse") ? Color.new(255, 220, 60, 128)
                 : (e.kind === "battery") ? Color.new(60, 230, 255, 128)
                 : (e.kind === "breaker") ? Color.new(255, 75, 75, 128)
                 : Color.new(235, 235, 245, 128);
        Draw.rect(mx0 + Math.floor(toF64(e.x) * cellPx) - 2, my0 + Math.floor(toF64(e.y) * cellPx) - 2, 5, 5, ec);
    }

    // Blip del Acechador (solo si hay proximidad / interferencia)
    if ((dRatio - 0.18) > 0 && (frameTick % 16 < 10)) {
        Draw.rect(mx0 + Math.floor(toF64(stalker.x) * cellPx) - 3, my0 + Math.floor(toF64(stalker.y) * cellPx) - 3, 7, 7, Color.new(255, 35, 35, 128));
    }

    // Jugador + cono de vista
    const px = mx0 + Math.floor(toF64(player.x) * cellPx);
    const py = my0 + Math.floor(toF64(player.y) * cellPx);
    const pang = toF64(player.ang);
    Draw.rect(px - 3, py - 3, 6, 6, Color.new(120, 255, 150, 128));
    Draw.line(px, py, px + Math.floor(Math.cos(pang) * 14), py + Math.floor(Math.sin(pang) * 14), Color.new(150, 255, 180, 128));

    // Marcadores cardinales N/S/O/E alrededor de la grilla
    fnt.scale = Math.fround(0.42);
    fnt.color = Color.new(130, 245, 155, 128);
    fnt.print(mx0 + Math.floor(mapPx * 0.5) - 4, my0 - 12, "N");
    fnt.print(mx0 + Math.floor(mapPx * 0.5) - 4, my0 + mapPx + 2, "S");
    fnt.print(mx0 - 11, my0 + Math.floor(mapPx * 0.5) - 5, "O");
    fnt.print(mx0 + mapPx + 3, my0 + Math.floor(mapPx * 0.5) - 5, "E");

    // Leyenda a la derecha dentro del PDA
    const lx = mx0 + mapPx + 14;
    fnt.scale = Math.fround(0.44);
    fnt.color = Color.new(120, 255, 150, 128); fnt.print(lx, my0 + 8,  "TU POSICION");
    fnt.color = Color.new(255, 220, 60, 128);  fnt.print(lx, my0 + 34, "FUSIBLES");
    fnt.color = Color.new(255, 75, 75, 128);   fnt.print(lx, my0 + 60, "DISYUNTOR");
    fnt.color = Color.new(60, 230, 255, 128);  fnt.print(lx, my0 + 86, "BATERIAS");
    fnt.color = Color.new(235, 235, 245, 128); fnt.print(lx, my0 + 112,"NOTAS");
    fnt.color = Color.new(60, 235, 110, 128);  fnt.print(lx, my0 + 138,"SALIDA NORTE");
    if ((dRatio - 0.18) > 0) {
        fnt.color = Color.new(255, 50, 50, 128);
        fnt.print(lx, my0 + 174, "! ANOMALIA !");
    }
}