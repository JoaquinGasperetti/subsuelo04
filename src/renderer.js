// ============================================================================
// Renderizador 3D Ultra-Optimizado para PS2 Real (Emotion Engine 294MHz + GS)
// - Calidad dinámica sin allocaciones: 160 (Alta), 128 (Equilibrada), 96 (Rápida)
// - Agrupamiento de tramos (Span Batching) para detalles arquitectónicos en perspectiva
// - Colores empaquetados por bits (JS_TAG_INT) sin llamadas C a Color.new() en bucles
// - Sombreado Gouraud, rejas 3D transparentes, viewmodel, PDA y alerta direccional
// ============================================================================
import { MAP_W, MAP_H } from "./map.js";
import { GAME_SETTINGS, QUALITY_RAYS, F64_ZERO, toF64, rgba } from "./config.js";

const MAX_RAYS = 160;
const zBuffer = new Float64Array(MAX_RAYS);

// Tablas precalculadas para los 3 niveles de calidad (0 allocaciones por frame)
const QUALITY_TABLES = [];
for (let q = 0; q < QUALITY_RAYS.length; q++) {
    const n = QUALITY_RAYS[q];
    const camX = new Float64Array(n);
    const beamProf = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        const cx = (2.0 * (i - (-0.5)) / n) - 1.0;
        camX[i] = cx;
        const absCx = cx < 0 ? -cx : cx;
        const bp = 1.0 - absCx * 1.38;
        beamProf[i] = (bp > 0) ? (bp * bp) : 0.0;
    }
    QUALITY_TABLES.push({ numRays: n, camX, beamProf });
}

// Caché de coordenadas horizontales exactas por (screenW, numRays) para evitar huecos en cualquier resolución
let cachedColScreenW = -1;
let cachedColNumRays = -1;
const colStartX = new Int16Array(MAX_RAYS);
const colWidth  = new Int16Array(MAX_RAYS);

function ensureColLayout(screenW, numRays) {
    if (cachedColScreenW === screenW && cachedColNumRays === numRays) return;
    cachedColScreenW = screenW;
    cachedColNumRays = numRays;
    for (let i = 0; i < numRays; i++) {
        const x0 = ((i * screenW) / numRays) | 0;
        const x1 = (((i + 1) * screenW) / numRays) | 0;
        colStartX[i] = x0;
        colWidth[i]  = x1 - x0;
    }
}

// Colores estáticos precomputados
const ALPHA_OPAQUE    = 128 << 24;
const COL_HORIZON     = rgba(2, 2, 4, 128);
const COL_SPOT_FADE   = rgba(20, 28, 38, 0);
const COL_LOCK_BOX    = rgba(38, 40, 46, 128);
const COL_LOCK_LED    = rgba(255, 40, 30, 128);
const COL_CHEV_DARK   = rgba(20, 22, 25, 128);
const COL_DOOR_OPEN   = rgba(65, 255, 130, 128);
const COL_DOOR_LOCK   = rgba(255, 55, 35, 128);
const COL_SHADOW      = rgba(2, 2, 4, 92);
const COL_TORSO_BOT   = rgba(12, 4, 6, 128);
const COL_JAW         = rgba(18, 2, 4, 128);
const COL_EYE_GLOW    = rgba(255, 25, 25, 68);
const COL_EYE_RED     = rgba(255, 25, 20, 128);
const COL_EYE_CORE    = rgba(255, 210, 190, 128);
const COL_FUSE_HALO   = rgba(255, 185, 30, 42);
const COL_FUSE_BODY   = rgba(190, 140, 35, 128);
const COL_FUSE_CAP    = rgba(120, 95, 55, 128);
const COL_FUSE_CORE   = rgba(255, 245, 185, 128);
const COL_BAT_HALO    = rgba(30, 210, 255, 40);
const COL_BAT_TERM    = rgba(185, 195, 205, 128);
const COL_BAT_BODY    = rgba(22, 52, 68, 128);
const COL_BAT_BAR1    = rgba(70, 235, 255, 128);
const COL_BAT_BAR2    = rgba(185, 255, 255, 128);
const COL_BRK_HALO    = rgba(255, 45, 35, 48);
const COL_BRK_OUT     = rgba(75, 28, 28, 128);
const COL_BRK_IN      = rgba(185, 42, 38, 128);
const COL_BRK_WARN    = rgba(255, 220, 65, 128);
const COL_BRK_LEVER   = rgba(25, 25, 30, 128);
const COL_NOTE_HALO   = rgba(180, 210, 255, 36);
const COL_NOTE_PAGE   = rgba(232, 236, 244, 128);
const COL_NOTE_INK    = rgba(45, 55, 70, 128);
const COL_NOTE_BLOOD  = rgba(165, 40, 40, 128);
const COL_VIG_DARK    = rgba(0, 0, 4, 86);
const COL_VIG_CLEAR   = rgba(0, 0, 4, 0);
const COL_SLEEVE1     = rgba(24, 28, 34, 128);
const COL_SLEEVE2     = rgba(10, 12, 16, 128);
const COL_GLOVE       = rgba(38, 42, 48, 128);
const COL_GLOVE_HI    = rgba(54, 60, 68, 128);
const COL_FL_TOP      = rgba(92, 100, 114, 128);
const COL_FL_BOT      = rgba(26, 30, 36, 128);
const COL_FL_HEAD_T   = rgba(120, 130, 144, 128);
const COL_FL_HEAD_B   = rgba(42, 46, 54, 128);
const COL_LENS_ON     = rgba(245, 250, 255, 128);
const COL_LENS_OFF    = rgba(45, 55, 65, 128);
const COL_LED_OFF     = rgba(180, 35, 35, 128);
const COL_LED_LOW     = rgba(255, 165, 30, 128);
const COL_LED_OK      = rgba(55, 245, 115, 128);
const COL_MAGENTA     = rgba(255, 0, 255, 128);
const COL_EDGE_CLEAR  = rgba(210, 15, 15, 0);

// Pool estático para ordenar entidades sin crear objetos ni closures por frame
const MAX_DRAW_ENTITIES = 16;
const drawPool = [];
for (let i = 0; i < MAX_DRAW_ENTITIES; i++) {
    drawPool.push({ kind: "", x: 0.0, y: 0.0, distSq: 0.0 });
}

export const renderStats = { cols: 0, minD: 99.0, maxD: 0.0, wallMode: 0, numRays: 128 };

export function render3DWorld(
    screenW, screenH, grid, player, stalker, entities,
    dangerRatio, frameTick, exitUnlocked, fov, flashIntensity,
    mapAnim = 0.0, sideBias = 0.0
) {
    const qIdx = GAME_SETTINGS.qualityIndex;
    const qTable = QUALITY_TABLES[qIdx] || QUALITY_TABLES[1];
    const numRays = qTable.numRays;
    const CAM_X = qTable.camX;
    const BEAM_PROF = qTable.beamProf;
    ensureColLayout(screenW, numRays);
    renderStats.numRays = numRays;

    const px = toF64(player.x);
    const py = toF64(player.y);
    const pang = toF64(player.ang);
    const pbob = toF64(player.bobPhase);
    const pbat = toF64(player.battery);
    const dRatio = toF64(dangerRatio);
    const fovVal = toF64(fov);
    const fInt = toF64(flashIntensity);
    const mAnim = toF64(mapAnim);
    const sBias = toF64(sideBias);

    const enableBob = GAME_SETTINGS.bob;
    const enableOverlays = GAME_SETTINGS.overlays;
    const enableViewmodel = GAME_SETTINGS.viewmodel;
    const enableParticles = GAME_SETTINGS.particles && enableOverlays;

    const bobOffset = enableBob ? ((Math.sin(pbob) * 7.0) | 0) : 0;
    const swayOffset = enableBob ? ((Math.cos(pbob * 0.5) * 4.0) | 0) : 0;
    const panicShakeY = (enableBob && (dRatio - 0.30) > 0) ? (((Math.random() - 0.5) * 7.0 * dRatio) | 0) : 0;
    const panicShakeX = (enableBob && (dRatio - 0.45) > 0) ? (((Math.random() - 0.5) * 4.0 * dRatio) | 0) : 0;
    let halfH = ((screenH >> 1) + bobOffset + panicShakeY) | 0;
    if (halfH < 40) halfH = 40;
    else if (halfH > screenH - 40) halfH = screenH - 40;

    const flashActive = player.flashlightOn && ((pbat - 0.0) > 0);
    const lowFlicker = (flashActive && ((pbat - 24.0) < 0) && (frameTick % 9 === 0 || frameTick % 23 === 0)) ? 0.28 : 1.0;
    const effFlash = toF64(flashActive ? (fInt * lowFlicker) : 0.0);
    const emerPulse = 0.65 - (-(Math.sin(frameTick * 0.09) * 0.35));
    const emerFlicker = toF64(((frameTick % 97) < 6) ? 0.35 : emerPulse);

    // ------------------------------------------------------------------------
    // 1. TECHO Y PISO GOURAUD POR HARDWARE + CONO VOLUMETRICO DE LINTERNA
    // ------------------------------------------------------------------------
    const redPulse = (dRatio * 36.0) | 0;
    const ceilTopCol = rgba(14 + redPulse, 16, 22, 128);
    const ceilMidCol = rgba(7 + (redPulse >> 1), 8, 12, 128);
    const floorMidCol = rgba(12 + (redPulse >> 1), 14, 18, 128);
    const floorBotCol = rgba(26 + redPulse, 25, 30, 128);

    const midCeilY = (halfH * 0.55) | 0;
    const floorMidY = halfH + (((screenH - halfH) * 0.45) | 0);

    Draw.quad(0, 0, screenW, 0, 0, midCeilY, screenW, midCeilY, ceilTopCol, ceilTopCol, ceilMidCol, ceilMidCol);
    Draw.quad(0, midCeilY, screenW, midCeilY, 0, halfH, screenW, halfH, ceilMidCol, ceilMidCol, COL_HORIZON, COL_HORIZON);
    Draw.quad(0, halfH, screenW, halfH, 0, floorMidY, screenW, floorMidY, COL_HORIZON, COL_HORIZON, floorMidCol, floorMidCol);
    Draw.quad(0, floorMidY, screenW, floorMidY, 0, screenH, screenW, screenH, floorMidCol, floorMidCol, floorBotCol, floorBotCol);

    // Proyeccion volumetrica del haz de linterna en piso y techo (2 quads Gouraud)
    if ((effFlash - 0.05) > 0) {
        const spotCx = (screenW >> 1) + swayOffset;
        let spotAlpha = (effFlash * 44.0) | 0;
        if (spotAlpha > 72) spotAlpha = 72;
        const spotHotCol = rgba(195, 215, 240, spotAlpha);
        Draw.quad(
            spotCx - 28, halfH + 6,
            spotCx + 28, halfH + 6,
            spotCx - 230, screenH,
            spotCx + 230, screenH,
            COL_SPOT_FADE, COL_SPOT_FADE, spotHotCol, spotHotCol
        );
        const ceilHotCol = rgba(150, 175, 205, spotAlpha >> 1);
        Draw.quad(
            spotCx - 170, 0,
            spotCx + 170, 0,
            spotCx - 24, halfH - 6,
            spotCx + 24, halfH - 6,
            ceilHotCol, ceilHotCol, COL_SPOT_FADE, COL_SPOT_FADE
        );
    }

    const dirX = toF64(Math.cos(pang));
    const dirY = toF64(Math.sin(pang));
    const planeScale = toF64(Math.tan(fovVal * 0.5));
    const planeX = -dirY * planeScale;
    const planeY =  dirX * planeScale;

    renderStats.cols = 0;
    renderStats.minD = toF64(99.0);
    renderStats.maxD = toF64(0.0);

    // Variables de Span Batching por celda de muro
    let spanKey = -1;
    let spanHit = 0;
    let spanX0 = 0;
    let spanX1 = 0;
    let spanTop0 = 0, spanBot0 = 0, spanH0 = 0;
    let spanTop1 = 0, spanBot1 = 0, spanH1 = 0;
    let spanCR = 0, spanCG = 0, spanCB = 0;

    // ------------------------------------------------------------------------
    // 2. RAYCASTING DDA + AGRUPAMIENTO POR TRAMOS (SPAN BATCH)
    // ------------------------------------------------------------------------
    for (let i = 0; i < numRays; i++) {
        const camX = CAM_X[i];
        const rayDirX = dirX - (-planeX * camX);
        const rayDirY = dirY - (-planeY * camX);

        let mapX = px | 0;
        let mapY = py | 0;

        const absRayX = rayDirX < 0 ? -rayDirX : rayDirX;
        const absRayY = rayDirY < 0 ? -rayDirY : rayDirY;
        const deltaDistX = (absRayX - 1e-6) < 0 ? 1e6 : (1.0 / absRayX);
        const deltaDistY = (absRayY - 1e-6) < 0 ? 1e6 : (1.0 / absRayY);

        let stepX = 0, stepY = 0;
        let sideDistX = F64_ZERO, sideDistY = F64_ZERO;

        if (rayDirX < 0) {
            stepX = -1;
            sideDistX = (px - mapX) * deltaDistX;
        } else {
            stepX = 1;
            sideDistX = (mapX - (-1.0) - px) * deltaDistX;
        }

        if (rayDirY < 0) {
            stepY = -1;
            sideDistY = (py - mapY) * deltaDistY;
        } else {
            stepY = 1;
            sideDistY = (mapY - (-1.0) - py) * deltaDistY;
        }

        let hit = 0;
        let side = 0;
        let steps = 0;

        let hasGate = false;
        let gateDist = F64_ZERO;
        let gateSide = 0;

        while (hit === 0 && steps < 48) {
            steps++;
            if ((sideDistX - sideDistY) < 0) {
                sideDistX = sideDistX - (-deltaDistX);
                mapX += stepX;
                side = 0;
            } else {
                sideDistY = sideDistY - (-deltaDistY);
                mapY += stepY;
                side = 1;
            }
            if (mapX < 0 || mapX >= MAP_W || mapY < 0 || mapY >= MAP_H) {
                hit = 1;
                break;
            }
            const cell = grid[mapY][mapX];
            if (cell === 5) {
                if (!hasGate) {
                    hasGate = true;
                    gateDist = (side === 0) ? (sideDistX - deltaDistX) : (sideDistY - deltaDistY);
                    if ((gateDist - 0.14) < 0) gateDist = toF64(0.14);
                    gateSide = side;
                }
            } else if (cell > 0) {
                hit = cell;
            }
        }

        let perpDist = (side === 0) ? (sideDistX - deltaDistX) : (sideDistY - deltaDistY);
        if ((perpDist - 0.14) < 0) perpDist = toF64(0.14);
        zBuffer[i] = perpDist;

        const screenX = colStartX[i];
        const colW = colWidth[i];
        const wallH = (screenH / perpDist) | 0;
        const rawStart = halfH - (wallH >> 1);
        const rawEnd = rawStart + wallH;
        const drawStart = rawStart < 0 ? 0 : rawStart;
        const drawEnd = rawEnd > screenH ? screenH : rawEnd;
        const clippedH = drawEnd - drawStart;

        const beam = ((effFlash - 0.0) > 0) ? (BEAM_PROF[i] * effFlash) : 0.0;
        const maxVis = ((effFlash - 0.0) > 0) ? (7.5 - (-beam * 8.5)) : 4.2;

        if (clippedH > 0) {
            let light = 1.0 - (perpDist / maxVis);
            if ((light - 0.10) < 0) light = 0.10;
            if (side === 1) light *= 0.74;
            const distFactor = 1.0 - perpDist * 0.087;
            if ((distFactor - 0.0) > 0) {
                light = light - (-(beam * 0.45 * distFactor));
            }
            if ((light - 1.25) > 0) light = 1.25;

            let wallX = (side === 0) ? (py - (-perpDist * rayDirY)) : (px - (-perpDist * rayDirX));
            wallX -= (wallX | 0);

            const isEdgeSeam = ((wallX - 0.04) < 0 || (wallX - 0.96) > 0);
            const isPanel = (((wallX * 4.0) | 0) & 1) === 0;
            if (isEdgeSeam) light *= 0.50;
            else if (isPanel) light *= 0.93;

            let r = 98, g = 106, b = 116;
            if (hit === 2) {
                r = 136; g = 76; b = 54;
            } else if (hit === 3) {
                r = (92.0 - (-72.0 * emerFlicker)) | 0;
                g = 26;
                b = 28;
            } else if (hit === 4) {
                r = exitUnlocked ? 42 : 148;
                g = exitUnlocked ? 210 : 108;
                b = exitUnlocked ? 95 : 38;
            }

            let cR = ((r * light) - (-dRatio * 26.0)) | 0;
            let cG = (g * light) | 0;
            let cB = (b * light) | 0;
            if (cR > 255) cR = 255;
            if (cG > 255) cG = 255;
            if (cB > 255) cB = 255;

            renderStats.cols++;
            if ((perpDist - renderStats.minD) < 0) renderStats.minD = perpDist;
            if ((perpDist - renderStats.maxD) > 0) renderStats.maxD = perpDist;

            if (renderStats.wallMode === 1) {
                Draw.rect(screenX, drawStart, colW, clippedH, COL_MAGENTA);
            } else {
                Draw.rect(screenX, drawStart, colW, clippedH, cR | (cG << 8) | (cB << 16) | ALPHA_OPAQUE);
            }

            const cellKey = (mapY << 7) | (mapX << 1) | side;
            if (cellKey === spanKey) {
                spanX1 = screenX + colW;
                spanTop1 = drawStart;
                spanBot1 = drawEnd;
                spanH1 = wallH;
            } else {
                if (spanKey !== -1 && renderStats.wallMode === 0) {
                    flushWallSpanDetails(screenH, spanHit, spanX0, spanX1, spanTop0, spanBot0, spanH0, spanTop1, spanBot1, spanH1, spanCR, spanCG, spanCB, exitUnlocked, emerFlicker);
                }
                spanKey = cellKey;
                spanHit = hit;
                spanX0 = screenX;
                spanX1 = screenX + colW;
                spanTop0 = drawStart;
                spanBot0 = drawEnd;
                spanH0 = wallH;
                spanTop1 = drawStart;
                spanBot1 = drawEnd;
                spanH1 = wallH;
                spanCR = cR;
                spanCG = cG;
                spanCB = cB;
            }
        }

        // --------------------------------------------------------------------
        // 2B. REJAS DE SEGURIDAD 3D TRANSPARENTES
        // --------------------------------------------------------------------
        if (hasGate) {
            const gWallH = (screenH / gateDist) | 0;
            const gRawStart = halfH - (gWallH >> 1);
            const gRawEnd = gRawStart + gWallH;
            const gStart = gRawStart < 0 ? 0 : gRawStart;
            const gEnd = gRawEnd > screenH ? screenH : gRawEnd;
            const gClippedH = gEnd - gStart;

            if (gClippedH > 0) {
                let gWX = (gateSide === 0) ? (py - (-gateDist * rayDirY)) : (px - (-gateDist * rayDirX));
                gWX -= (gWX | 0);

                let gLight = 1.0 - (gateDist / maxVis);
                if ((gLight - 0.16) < 0) gLight = 0.16;
                if (gateSide === 1) gLight *= 0.78;

                const barScaled = gWX * 7.0;
                const barFrac = barScaled - (barScaled | 0);

                if ((barFrac - 0.34) < 0) {
                    const metal = gLight * 0.95;
                    let bR = ((115 * metal) - (-dRatio * 20.0)) | 0;
                    let bG = (125 * metal) | 0;
                    let bB = (138 * metal) | 0;
                    if (bR > 255) bR = 255;
                    if (bG > 255) bG = 255;
                    if (bB > 255) bB = 255;
                    Draw.rect(screenX, gStart, colW, gClippedH, bR | (bG << 8) | (bB << 16) | ALPHA_OPAQUE);
                    zBuffer[i] = gateDist;
                } else {
                    const crossH = Math.max(2, (gWallH * 0.05) | 0);
                    const midBarY = gRawStart + (gWallH >> 1);
                    if (midBarY >= gStart && midBarY + crossH <= gEnd) {
                        Draw.rect(screenX, midBarY, colW, crossH, rgba((75 * gLight) | 0, (82 * gLight) | 0, (92 * gLight) | 0, 128));
                    }
                }

                if ((gWX - 0.44) > 0 && (gWX - 0.56) < 0) {
                    const lbY = gRawStart + ((gWallH * 0.44) | 0);
                    const lbH = Math.max(4, (gWallH * 0.12) | 0);
                    if (lbY >= gStart && lbY + lbH <= gEnd) {
                        Draw.rect(screenX, lbY, colW, lbH, ((frameTick & 15) < 10) ? COL_LOCK_LED : COL_LOCK_BOX);
                    }
                }
            }
        }
    }

    if (spanKey !== -1 && renderStats.wallMode === 0) {
        flushWallSpanDetails(screenH, spanHit, spanX0, spanX1, spanTop0, spanBot0, spanH0, spanTop1, spanBot1, spanH1, spanCR, spanCG, spanCB, exitUnlocked, emerFlicker);
    }

    // ------------------------------------------------------------------------
    // 3. PROYECCION 3D DE ENTIDADES Y EL ACECHADOR (SIN ALLOCACIONES)
    // ------------------------------------------------------------------------
    let drawCount = 0;
    for (let e = 0; e < entities.length; e++) {
        const ent = entities[e];
        if (!ent.taken && drawCount < MAX_DRAW_ENTITIES - 1) {
            const slot = drawPool[drawCount++];
            slot.kind = ent.kind;
            slot.x = toF64(ent.x);
            slot.y = toF64(ent.y);
            const dx = slot.x - px;
            const dy = slot.y - py;
            slot.distSq = (dx * dx) - (-(dy * dy));
        }
    }
    {
        const slot = drawPool[drawCount++];
        slot.kind = "stalker";
        slot.x = toF64(stalker.x);
        slot.y = toF64(stalker.y);
        const dx = slot.x - px;
        const dy = slot.y - py;
        slot.distSq = (dx * dx) - (-(dy * dy));
    }

    for (let i = 1; i < drawCount; i++) {
        const tmp = drawPool[i];
        const tmpDist = tmp.distSq;
        let j = i - 1;
        while (j >= 0 && (drawPool[j].distSq - tmpDist) < 0) {
            drawPool[j + 1] = drawPool[j];
            j--;
        }
        drawPool[j + 1] = tmp;
    }

    const invDet = 1.0 / (planeX * dirY - dirX * planeY);
    const raysPerPx = numRays / screenW;
    for (let s = 0; s < drawCount; s++) {
        const sp = drawPool[s];
        const sx = sp.x - px;
        const sy = sp.y - py;
        const transformX = invDet * (dirY * sx - dirX * sy);
        const transformY = invDet * ((-planeY * sx) - (-planeX * sy));

        if ((transformY - 0.22) <= 0) continue;

        const screenX = (((screenW * 0.5) * (1.0 - (-transformX / transformY))) | 0) + swayOffset + panicShakeX;
        let spH = (screenH / transformY) | 0;
        if (spH > (screenH << 1)) spH = screenH << 1;
        const colIdx = (screenX * raysPerPx) | 0;

        if (sp.kind === "stalker") {
            const mW = Math.max(14, (spH * 0.48) | 0);
            const mH = (spH * 0.92) | 0;
            const mLeft = screenX - (mW >> 1);
            const stride = Math.sin(frameTick * 0.24);
            const absStride = stride < 0 ? -stride : stride;
            const bobStalker = (absStride * Math.max(2, (spH * 0.035) | 0)) | 0;
            const mTop = Math.max(0, halfH - (mH >> 1) + bobStalker);
            const drawH = Math.min(screenH - mTop, mH);
            if (drawH <= 0) continue;

            const cStart = Math.max(0, (mLeft * raysPerPx) | 0);
            const cEnd = Math.min(numRays - 1, ((mLeft + mW) * raysPerPx) | 0);
            let visible = false;
            for (let c = cStart; c <= cEnd; c++) {
                if ((transformY - zBuffer[c]) < 0) { visible = true; break; }
            }
            if (!visible) continue;

            const spCamX = Math.abs((2.0 * screenX / screenW) - 1.0);
            const spBeam = ((effFlash - 0.0) > 0) ? Math.max(0.0, 1.0 - spCamX * 1.38) * effFlash : 0.0;
            const spMaxVis = ((effFlash - 0.0) > 0) ? (7.5 - (-spBeam * 8.5)) : 4.2;
            const stLight = toF64(Math.max(0.22, Math.min(1.2, 1.0 - transformY / (spMaxVis - (-2.5)))));

            const bodyX = Math.max(0, mLeft);
            const bodyW = Math.min(screenW, mLeft + mW) - bodyX;

            const shadowY = Math.min(screenH - 4, mTop + drawH - 2);
            if (bodyW > 4 && shadowY > halfH) {
                Draw.rect(bodyX - 2, shadowY, bodyW + 4, Math.max(3, (drawH * 0.05) | 0), COL_SHADOW);
            }

            const legW = Math.max(3, (mW * 0.22) | 0);
            const legH = (drawH * 0.34) | 0;
            const legY = mTop + ((drawH * 0.66) | 0);
            const legOffsetL = (stride * Math.max(2, (legH * 0.14) | 0)) | 0;
            const lLegX = screenX - ((mW * 0.26) | 0);
            const rLegX = screenX + ((mW * 0.06) | 0);
            const darkLimbCol = rgba((22 * stLight) | 0, (10 * stLight) | 0, (14 * stLight) | 0, 128);
            if (lLegX >= 0 && lLegX + legW <= screenW) {
                Draw.rect(lLegX, Math.max(0, Math.min(screenH - legH, legY + legOffsetL)), legW, legH, darkLimbCol);
            }
            if (rLegX >= 0 && rLegX + legW <= screenW) {
                Draw.rect(rLegX, Math.max(0, Math.min(screenH - legH, legY - legOffsetL)), legW, legH, darkLimbCol);
            }

            if (bodyW > 0) {
                const torsoTop = mTop + ((drawH * 0.22) | 0);
                const torsoH = (drawH * 0.48) | 0;
                const tColTop = rgba(((42 * stLight) - (-dRatio * 24.0)) | 0, (14 * stLight) | 0, (18 * stLight) | 0, 128);
                Draw.quad(
                    bodyX, torsoTop, bodyX + bodyW, torsoTop,
                    bodyX + ((bodyW * 0.12) | 0), torsoTop + torsoH, bodyX + ((bodyW * 0.88) | 0), torsoTop + torsoH,
                    tColTop, tColTop, COL_TORSO_BOT, COL_TORSO_BOT
                );
                const ribW = (bodyW * 0.60) | 0;
                const ribX = bodyX + ((bodyW - ribW) >> 1);
                const ribCol = rgba((125 * stLight) | 0, (88 * stLight) | 0, (85 * stLight) | 0, 115);
                const ribH = Math.max(2, (torsoH * 0.08) | 0);
                Draw.rect(ribX, torsoTop + ((torsoH * 0.28) | 0), ribW, ribH, ribCol);
                Draw.rect(ribX, torsoTop + ((torsoH * 0.56) | 0), ribW, ribH, ribCol);
            }

            const armW = Math.max(3, (mW * 0.16) | 0);
            const armH = (drawH * 0.52) | 0;
            const armTop = mTop + ((drawH * 0.24) | 0);
            const armSwing = (Math.cos(frameTick * 0.24) * Math.max(2, (mW * 0.12) | 0)) | 0;
            const leftArmX = mLeft - (armW >> 1);
            const rightArmX = mLeft + mW - (armW >> 1);
            const clawCol = rgba((175 * stLight) | 0, (35 * stLight) | 0, 35, 128);
            if (leftArmX >= 0 && leftArmX + armW <= screenW) {
                const ay = Math.max(0, Math.min(screenH - armH, armTop - armSwing));
                Draw.rect(leftArmX, ay, armW, armH, darkLimbCol);
                Draw.rect(leftArmX, Math.min(screenH - 3, ay + armH - 3), armW + 2, 3, clawCol);
            }
            if (rightArmX >= 0 && rightArmX + armW <= screenW) {
                const ay = Math.max(0, Math.min(screenH - armH, armTop + armSwing));
                Draw.rect(rightArmX, ay, armW, armH, darkLimbCol);
                Draw.rect(rightArmX - 2, Math.min(screenH - 3, ay + armH - 3), armW + 2, 3, clawCol);
            }

            const headW = (mW * 0.56) | 0;
            const headH = (drawH * 0.24) | 0;
            const headL = screenX - (headW >> 1);
            const headX = Math.max(0, headL);
            const headDrawW = Math.min(screenW, headL + headW) - headX;
            if (headDrawW > 0 && headH > 0) {
                const skullTopCol = rgba((195 * stLight) | 0, (162 * stLight) | 0, (152 * stLight) | 0, 128);
                const skullBotCol = rgba((115 * stLight) | 0, (72 * stLight) | 0, (70 * stLight) | 0, 128);
                Draw.quad(
                    headX, mTop, headX + headDrawW, mTop,
                    headX, mTop + headH, headX + headDrawW, mTop + headH,
                    skullTopCol, skullTopCol, skullBotCol, skullBotCol
                );
                const jawW = (headDrawW * 0.54) | 0;
                const jawH = Math.max(2, (headH * (0.24 - (-dRatio * 0.22))) | 0);
                Draw.rect(headX + ((headDrawW - jawW) >> 1), mTop + headH - jawH - 1, jawW, jawH, COL_JAW);
            }

            const eyeSize = Math.max(2, (headW * 0.22) | 0);
            const eyeY = mTop + ((headH * 0.36) | 0);
            const e1x = screenX - ((headW * 0.30) | 0);
            const e2x = screenX + ((headW * 0.10) | 0);
            if (e1x >= 2 && e1x + eyeSize + 2 <= screenW) {
                Draw.rect(e1x - 1, eyeY - 1, eyeSize + 2, eyeSize + 2, COL_EYE_GLOW);
                Draw.rect(e1x, eyeY, eyeSize, eyeSize, COL_EYE_RED);
                Draw.rect(e1x + 1, eyeY + 1, Math.max(1, eyeSize - 2), Math.max(1, eyeSize - 2), COL_EYE_CORE);
            }
            if (e2x >= 2 && e2x + eyeSize + 2 <= screenW) {
                Draw.rect(e2x - 1, eyeY - 1, eyeSize + 2, eyeSize + 2, COL_EYE_GLOW);
                Draw.rect(e2x, eyeY, eyeSize, eyeSize, COL_EYE_RED);
                Draw.rect(e2x + 1, eyeY + 1, Math.max(1, eyeSize - 2), Math.max(1, eyeSize - 2), COL_EYE_CORE);
            }
        } else {
            if (colIdx < 0 || colIdx >= numRays || (transformY - zBuffer[colIdx]) >= 0) continue;
            const itemSize = Math.max(8, (spH * 0.32) | 0);
            const floatBob = (Math.sin((frameTick * 0.10) - (-s)) * 5.0) | 0;
            const iy = Math.max(4, Math.min(screenH - itemSize - 4, halfH + ((spH * 0.14) | 0) + floatBob));
            const ix = screenX - (itemSize >> 1);

            if (ix < 2 || ix + itemSize > screenW - 2) continue;

            if (sp.kind === "fuse") {
                const w = Math.max(6, (itemSize * 0.78) | 0);
                const capH = Math.max(2, (itemSize * 0.20) | 0);
                Draw.rect(ix - 3, iy - 3, w + 6, itemSize + 6, COL_FUSE_HALO);
                Draw.rect(ix, iy, w, itemSize, COL_FUSE_BODY);
                Draw.rect(ix - 1, iy, w + 2, capH, COL_FUSE_CAP);
                Draw.rect(ix - 1, iy + itemSize - capH, w + 2, capH, COL_FUSE_CAP);
                Draw.rect(ix + ((w * 0.28) | 0), iy + capH, Math.max(2, (w * 0.44) | 0), itemSize - (capH << 1), COL_FUSE_CORE);
            } else if (sp.kind === "battery") {
                const w = Math.max(6, (itemSize * 0.76) | 0);
                const termW = Math.max(2, (w * 0.44) | 0);
                Draw.rect(ix - 3, iy - 3, w + 6, itemSize + 6, COL_BAT_HALO);
                Draw.rect(ix + ((w - termW) >> 1), iy - 2, termW, 3, COL_BAT_TERM);
                Draw.rect(ix, iy, w, itemSize, COL_BAT_BODY);
                Draw.rect(ix + 1, iy + 2, Math.max(2, w - 2), Math.max(2, (itemSize * 0.25) | 0), COL_BAT_BAR1);
                Draw.rect(ix + 1, iy + ((itemSize * 0.42) | 0), Math.max(2, w - 2), Math.max(2, (itemSize * 0.25) | 0), COL_BAT_BAR2);
            } else if (sp.kind === "breaker") {
                const by = Math.max(2, iy - ((itemSize * 0.45) | 0));
                const bh = (itemSize * 1.25) | 0;
                Draw.rect(ix - 4, by - 4, itemSize + 8, bh + 8, COL_BRK_HALO);
                Draw.rect(ix, by, itemSize, bh, COL_BRK_OUT);
                Draw.rect(ix + 2, by + 2, Math.max(4, itemSize - 4), Math.max(4, bh - 4), COL_BRK_IN);
                Draw.rect(ix + ((itemSize * 0.22) | 0), by + ((bh * 0.20) | 0), Math.max(2, (itemSize * 0.56) | 0), Math.max(2, (bh * 0.26) | 0), COL_BRK_WARN);
                Draw.rect(ix + ((itemSize * 0.35) | 0), by + ((bh * 0.55) | 0), Math.max(2, (itemSize * 0.30) | 0), Math.max(3, (bh * 0.32) | 0), COL_BRK_LEVER);
            } else if (sp.kind === "note") {
                const nw = Math.max(6, (itemSize * 0.82) | 0);
                const nh = Math.max(6, (itemSize * 0.95) | 0);
                const ny = Math.min(screenH - nh - 2, iy + 2);
                const lineW = Math.max(2, nw - 4);
                Draw.rect(ix - 2, ny - 2, nw + 4, nh + 4, COL_NOTE_HALO);
                Draw.rect(ix, ny, nw, nh, COL_NOTE_PAGE);
                Draw.rect(ix + 2, ny + ((nh * 0.30) | 0), lineW, 1, COL_NOTE_INK);
                Draw.rect(ix + 2, ny + ((nh * 0.62) | 0), Math.max(1, (lineW * 0.65) | 0), 1, COL_NOTE_BLOOD);
            }
        }
    }

    // ------------------------------------------------------------------------
    // 4. PARTICULAS ATMOSFERICAS LIGERAS (10 PARTICULAS EN EL HAZ)
    // ------------------------------------------------------------------------
    if (enableParticles && (effFlash - 0.05) > 0) {
        const partCol = rgba(210, 225, 240, ((effFlash * 55.0) | 0));
        for (let p = 0; p < 10; p++) {
            const pxSeed = (p * 61 + 19) & 63;
            const pySeed = (p * 37 + 11) & 63;
            const partX = (160 + pxSeed * 5 - (((pang * 60.0) | 0) & 63)) % screenW;
            const partY = 48 + ((pySeed * 6 + (frameTick >> 1) * ((p & 1) + 1)) % (screenH - 96));
            Draw.rect(partX, partY, 2, 2, partCol);
        }
    }

    // ------------------------------------------------------------------------
    // 5. VIEWMODEL 3D EN PRIMERA PERSONA (MANO + LINTERNA TACTICA)
    // ------------------------------------------------------------------------
    if (enableViewmodel) {
        renderFlashlightViewmodel(screenW, screenH, effFlash, pbat, bobOffset, swayOffset, mAnim, frameTick);
    }

    // ------------------------------------------------------------------------
    // 6. VINETA PERIMETRAL GOURAUD + INDICADOR DIRECCIONAL DE PELIGRO
    // ------------------------------------------------------------------------
    if (enableOverlays) {
        const vigH = 48;
        Draw.quad(0, 0, screenW, 0, 0, vigH, screenW, vigH, COL_VIG_DARK, COL_VIG_DARK, COL_VIG_CLEAR, COL_VIG_CLEAR);
        Draw.quad(0, screenH - vigH, screenW, screenH - vigH, 0, screenH, screenW, screenH, COL_VIG_CLEAR, COL_VIG_CLEAR, COL_VIG_DARK, COL_VIG_DARK);

        // Resplandor rojo lateral que indica hacia qué lado está El Acechador cuando está cerca
        if ((dRatio - 0.22) > 0) {
            const absBias = sBias < 0 ? -sBias : sBias;
            if ((absBias - 0.18) > 0) {
                let edgeAlpha = (dRatio * absBias * 84.0) | 0;
                if (edgeAlpha > 88) edgeAlpha = 88;
                const edgeCol = rgba(220, 18, 22, edgeAlpha);
                const edgeW = 46;
                if (sBias < 0) {
                    Draw.quad(0, 0, edgeW, 0, 0, screenH, edgeW, screenH, edgeCol, COL_EDGE_CLEAR, edgeCol, COL_EDGE_CLEAR);
                } else {
                    Draw.quad(screenW - edgeW, 0, screenW, 0, screenW - edgeW, screenH, screenW, screenH, COL_EDGE_CLEAR, edgeCol, COL_EDGE_CLEAR, edgeCol);
                }
            }
        }
    }
}

function flushWallSpanDetails(screenH, hit, x0, x1, top0, bot0, h0, top1, bot1, h1, cR, cG, cB, exitUnlocked, emerFlicker) {
    if (h0 < 16 && h1 < 16) return;

    const cornH0 = Math.max(2, (h0 * 0.08) | 0);
    const cornH1 = Math.max(2, (h1 * 0.08) | 0);
    const cTopEnd0 = Math.min(bot0, top0 + cornH0);
    const cTopEnd1 = Math.min(bot1, top1 + cornH1);
    const trimCol = rgba((cR * 0.34) | 0, (cG * 0.36) | 0, (cB * 0.40) | 0, 128);

    Draw.quad(x0, top0, x1, top1, x0, cTopEnd0, x1, cTopEnd1, trimCol, trimCol, trimCol, trimCol);

    const baseStart0 = Math.max(top0, bot0 - cornH0);
    const baseStart1 = Math.max(top1, bot1 - cornH1);
    const baseCol = rgba((cR * 0.26) | 0, (cG * 0.28) | 0, (cB * 0.32) | 0, 128);
    Draw.quad(x0, baseStart0, x1, baseStart1, x0, bot0, x1, bot1, baseCol, baseCol, baseCol, baseCol);

    const spanW = x1 - x0;
    if (spanW < 8) return;

    const midX = (x0 + x1) >> 1;
    const avgTop = (top0 + top1) >> 1;
    const avgBot = (bot0 + bot1) >> 1;
    const avgH = avgBot - avgTop;
    if (avgH < 20) return;

    if (hit === 1) {
        const j0 = top0 + ((bot0 - top0) >> 1);
        const j1 = top1 + ((bot1 - top1) >> 1);
        const jCol = rgba((cR * 0.55) | 0, (cG * 0.58) | 0, (cB * 0.62) | 0, 128);
        Draw.quad(x0, j0, x1, j1, x0, Math.min(bot0, j0 + 2), x1, Math.min(bot1, j1 + 2), jCol, jCol, jCol, jCol);
    } else if (hit === 2) {
        const p0 = top0 + ((bot0 - top0) >> 1) - 2;
        const p1 = top1 + ((bot1 - top1) >> 1) - 2;
        const pCol = rgba(Math.min(255, cR + 32), Math.min(255, cG + 28), Math.min(255, cB + 24), 128);
        Draw.quad(x0, p0, x1, p1, x0, Math.min(bot0, p0 + 4), x1, Math.min(bot1, p1 + 4), pCol, pCol, pCol, pCol);
    } else if (hit === 3) {
        const lw = Math.max(4, (spanW * 0.32) | 0);
        const lx = midX - (lw >> 1);
        const ly = avgTop + ((avgH * 0.24) | 0);
        const lh = Math.max(3, (avgH * 0.09) | 0);
        if (ly + lh < avgBot) {
            const glowR = Math.min(255, ((210.0 * emerFlicker) - (-45.0)) | 0);
            const glowG = (55.0 * emerFlicker) | 0;
            Draw.rect(lx - 2, ly - 2, lw + 4, lh + 4, rgba(glowR, 12, 12, 58));
            Draw.rect(lx, ly, lw, lh, rgba(glowR, glowG, 35, 128));
        }
    } else if (hit === 4) {
        const pw = Math.max(6, (spanW * 0.36) | 0);
        const px0 = midX - (pw >> 1);
        const py0 = avgTop + ((avgH * 0.42) | 0);
        const ph = Math.max(4, (avgH * 0.16) | 0);
        if (py0 + ph < avgBot) {
            Draw.rect(px0 - 2, py0 - 2, pw + 4, ph + 4, COL_CHEV_DARK);
            Draw.rect(px0, py0, pw, ph, exitUnlocked ? COL_DOOR_OPEN : COL_DOOR_LOCK);
        }
    }
}

function renderFlashlightViewmodel(screenW, screenH, effFlash, battery, bobOffset, swayOffset, mapAnim, frameTick) {
    const hideOffset = (mapAnim * 120.0) | 0;
    const safeX = GAME_SETTINGS.crtSafe ? 16 : 0;
    const vmX = screenW - 148 - safeX + ((swayOffset * 1.6) | 0);
    const vmY = screenH - 118 + ((bobOffset * 1.15) | 0) + hideOffset;
    if (vmY >= screenH + 20) return;

    if ((effFlash - 0.05) > 0) {
        const lensX = vmX + 12;
        const lensY = vmY + 8;
        let coneAlpha = (effFlash * 38.0) | 0;
        if (coneAlpha > 58) coneAlpha = 58;
        const coneTipCol = rgba(225, 240, 255, coneAlpha);
        const coneFarCol = rgba(120, 165, 220, 0);
        Draw.triangle(
            lensX, lensY,
            (screenW * 0.26) | 0, (screenH * 0.34) | 0,
            (screenW * 0.72) | 0, (screenH * 0.28) | 0,
            coneTipCol, coneFarCol, coneFarCol
        );
        Draw.rect(lensX - 10, lensY - 10, 20, 20, rgba(210, 235, 255, coneAlpha));
    }

    Draw.quad(
        vmX + 48, vmY + 54,
        vmX + 132, vmY + 42,
        vmX + 88, screenH + 10,
        vmX + 165, screenH + 10,
        COL_SLEEVE1, COL_SLEEVE2, COL_SLEEVE2, COL_SLEEVE2
    );
    Draw.rect(vmX + 34, vmY + 36, 44, 26, COL_GLOVE);
    Draw.rect(vmX + 38, vmY + 32, 36, 6, COL_GLOVE_HI);

    Draw.quad(
        vmX + 18, vmY + 12,
        vmX + 44, vmY - 4,
        vmX + 78, vmY + 68,
        vmX + 106, vmY + 50,
        COL_FL_BOT, COL_FL_TOP, COL_FL_BOT, COL_FL_TOP
    );
    Draw.quad(
        vmX - 2, vmY + 2,
        vmX + 26, vmY - 16,
        vmX + 22, vmY + 20,
        vmX + 48, vmY + 2,
        COL_FL_HEAD_B, COL_FL_HEAD_T, COL_FL_HEAD_B, COL_FL_HEAD_T
    );

    Draw.rect(vmX + 6, vmY - 2, 12, 12, ((effFlash - 0.05) > 0) ? COL_LENS_ON : COL_LENS_OFF);
    const lowBat = (battery - 25.0) < 0;
    const ledCol = ((effFlash - 0.05) <= 0)
        ? COL_LED_OFF
        : (lowBat && ((frameTick & 15) < 8))
            ? COL_LED_LOW
            : COL_LED_OK;
    Draw.rect(vmX + 44, vmY + 18, 6, 4, ledCol);
}

// PDA Tactico animado (se desliza desde abajo y despliega al presionar SELECT o L2)
export function renderAnimatedMapPDA(screenW, screenH, grid, player, stalker, entities, dangerRatio, mapAnim, frameTick, fnt) {
    const mAnim = toF64(mapAnim);
    const dRatio = toF64(dangerRatio);
    if ((mAnim - 0.01) <= 0) return;

    const inv = 1.0 - mAnim;
    const ease = 1.0 - (inv * inv * inv);
    const panelW = 368;
    const panelH = 290;
    const targetY = (screenH - panelH) >> 1;
    const ox = (screenW - panelW) >> 1;
    const oy = (screenH - (-((targetY - screenH) * ease))) | 0;

    Draw.rect(0, 0, screenW, screenH, rgba(0, 0, 0, (75 * ease) | 0));
    Draw.rect(ox - 6, oy - 6, panelW + 12, panelH + 12, rgba(28, 46, 32, 124));
    Draw.rect(ox, oy, panelW, panelH, rgba(6, 14, 9, 126));

    Draw.rect(ox, oy, panelW, 28, rgba(14, 38, 20, 126));
    fnt.scale = Math.fround(0.48);
    fnt.color = rgba(110, 245, 140, 128);
    fnt.print(ox + 10, oy + 6, "PLANO SUBSUELO 04 [SELECT / L2]");

    const cellPx = 11;
    const mapPx = MAP_W * cellPx;
    const mx0 = ox + 16;
    const my0 = oy + 42;

    const colExit = rgba(60, 235, 110, 128);
    const colGate = rgba(235, 165, 55, 128);
    const colRit  = rgba(165, 45, 45, 128);
    const colWall = rgba(55, 115, 70, 120);

    for (let y = 0; y < MAP_H; y++) {
        let x = 0;
        const row = grid[y];
        while (x < MAP_W) {
            const v = row[x];
            if (v > 0) {
                let run = 1;
                while (x + run < MAP_W && row[x + run] === v) run++;
                const col = (v === 4) ? colExit : (v === 5) ? colGate : (v === 3) ? colRit : colWall;
                Draw.rect(mx0 + x * cellPx, my0 + y * cellPx, run * cellPx - 1, cellPx - 1, col);
                x += run;
            } else {
                x++;
            }
        }
    }

    const scanY = my0 + ((frameTick * 3) % mapPx);
    Draw.rect(mx0, scanY, mapPx, 2, rgba(80, 255, 120, 52));

    for (let i = 0; i < entities.length; i++) {
        const e = entities[i];
        if (e.taken) continue;
        const ec = (e.kind === "fuse") ? rgba(255, 220, 60, 128)
                 : (e.kind === "battery") ? rgba(60, 230, 255, 128)
                 : (e.kind === "breaker") ? rgba(255, 75, 75, 128)
                 : rgba(235, 235, 245, 128);
        Draw.rect(mx0 + ((toF64(e.x) * cellPx) | 0) - 2, my0 + ((toF64(e.y) * cellPx) | 0) - 2, 5, 5, ec);
    }

    if ((dRatio - 0.18) > 0 && ((frameTick & 15) < 10)) {
        Draw.rect(mx0 + ((toF64(stalker.x) * cellPx) | 0) - 3, my0 + ((toF64(stalker.y) * cellPx) | 0) - 3, 7, 7, rgba(255, 35, 35, 128));
    }

    const px = mx0 + ((toF64(player.x) * cellPx) | 0);
    const py = my0 + ((toF64(player.y) * cellPx) | 0);
    const pang = toF64(player.ang);
    Draw.rect(px - 3, py - 3, 6, 6, rgba(120, 255, 150, 128));
    Draw.line(px, py, px + ((Math.cos(pang) * 14.0) | 0), py + ((Math.sin(pang) * 14.0) | 0), rgba(150, 255, 180, 128));

    fnt.scale = Math.fround(0.42);
    fnt.color = rgba(130, 245, 155, 128);
    fnt.print(mx0 + (mapPx >> 1) - 4, my0 - 12, "N");
    fnt.print(mx0 + (mapPx >> 1) - 4, my0 + mapPx + 2, "S");
    fnt.print(mx0 - 11, my0 + (mapPx >> 1) - 5, "O");
    fnt.print(mx0 + mapPx + 3, my0 + (mapPx >> 1) - 5, "E");

    const lx = mx0 + mapPx + 14;
    fnt.scale = Math.fround(0.44);
    fnt.color = rgba(120, 255, 150, 128); fnt.print(lx, my0 + 8,  "TU POSICION");
    fnt.color = rgba(255, 220, 60, 128);  fnt.print(lx, my0 + 34, "FUSIBLES");
    fnt.color = rgba(255, 75, 75, 128);   fnt.print(lx, my0 + 60, "DISYUNTOR");
    fnt.color = rgba(60, 230, 255, 128);  fnt.print(lx, my0 + 86, "BATERIAS");
    fnt.color = rgba(235, 235, 245, 128); fnt.print(lx, my0 + 112,"NOTAS");
    fnt.color = rgba(60, 235, 110, 128);  fnt.print(lx, my0 + 138,"SALIDA NORTE");
    if ((dRatio - 0.18) > 0) {
        fnt.color = rgba(255, 50, 50, 128);
        fnt.print(lx, my0 + 174, "! ANOMALIA !");
    }
}
