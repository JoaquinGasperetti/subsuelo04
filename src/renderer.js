// ============================================================================
// Renderizador 3D Raycaster de Alta Definicion (320 cols) + Gouraud + Viewmodel
// ============================================================================
import { MAP_W, MAP_H } from "./map.js";
import { ENABLE_BOB, ENABLE_OVERLAYS, ENABLE_VIEWMODEL, ENABLE_PARTICLES, F64_ZERO, toF64, fadd } from "./config.js";

export const NUM_RAYS = 320;
// Se usa Float64Array en lugar de Float32Array para evitar que QuickJS de AthenaEnv
// devuelva JS_CUSTOM_TAG_FLOAT32 al leer zBuffer[i] y falle al compararlo con FLOAT64.
const zBuffer = new Float64Array(NUM_RAYS);

// Diagnostico: estadisticas del ultimo frame y modo de color de paredes (0 normal, 1 magenta plano)
export const renderStats = { cols: 0, minD: 99.0, maxD: 0.0, wallMode: 0 };

function clampInt(v, lo, hi) {
    const iv = Math.floor(toF64(v));
    if ((iv - lo) < 0) return lo;
    if ((iv - hi) > 0) return hi;
    return iv;
}

export function render3DWorld(screenW, screenH, grid, player, stalker, entities, dangerRatio, frameTick, breakerActive, fov, flashIntensity, mapAnim = 0.0) {
    const px = toF64(player.x);
    const py = toF64(player.y);
    const pang = toF64(player.ang);
    const pbob = toF64(player.bobPhase);
    const pbat = toF64(player.battery);
    const dRatio = toF64(dangerRatio);
    const fovVal = toF64(fov);
    const fInt = toF64(flashIntensity);
    const mAnim = toF64(mapAnim);

    const colW = Math.max(1, Math.floor(screenW / NUM_RAYS)); // 2px en 640x448
    const bobOffset = ENABLE_BOB ? Math.floor(Math.sin(pbob) * 7.0) : 0;
    const swayOffset = ENABLE_BOB ? Math.floor(Math.cos(pbob * 0.5) * 4.0) : 0;
    const panicShakeY = (ENABLE_BOB && (dRatio - 0.30) > 0) ? Math.floor((Math.random() - 0.5) * 7.0 * dRatio) : 0;
    const panicShakeX = (ENABLE_BOB && (dRatio - 0.45) > 0) ? Math.floor((Math.random() - 0.5) * 4.0 * dRatio) : 0;
    const halfH = clampInt(fadd(screenH * 0.5, fadd(bobOffset, panicShakeY)), 40, screenH - 40);

    const flashActive = player.flashlightOn && ((pbat - 0.0) > 0);
    const lowFlicker = (flashActive && ((pbat - 24.0) < 0) && (frameTick % 9 === 0 || frameTick % 23 === 0)) ? 0.28 : 1.0;
    const effFlash = toF64(flashActive ? (fInt * lowFlicker) : 0.0);
    const emerPulse = toF64(fadd(0.65, Math.sin(frameTick * 0.09) * 0.35));
    const emerFlicker = toF64(((frameTick % 97) < 6) ? 0.35 : emerPulse);

    // ------------------------------------------------------------------------
    // 1. TECHO Y PISO CON SOMBREADO GOURAUD POR HARDWARE + CONO DE LINTERNA
    // ------------------------------------------------------------------------
    const redPulse = Math.floor(dRatio * 34.0);
    const ceilTopCol = Color.new(clampInt(14 + redPulse, 0, 255), 16, 22, 128);
    const ceilMidCol = Color.new(clampInt(7 + Math.floor(redPulse * 0.5), 0, 255), 8, 12, 128);
    const horizonCol = Color.new(2, 2, 4, 128);

    const midCeilY = Math.floor(halfH * 0.55);
    // Gradiente Gouraud de techo (2 bandas suaves)
    Draw.quad(0, 0, screenW, 0, 0, midCeilY, screenW, midCeilY, ceilTopCol, ceilTopCol, ceilMidCol, ceilMidCol);
    Draw.quad(0, midCeilY, screenW, midCeilY, 0, halfH, screenW, halfH, ceilMidCol, ceilMidCol, horizonCol, horizonCol);

    // Gradiente Gouraud de piso humedo (2 bandas suaves)
    const floorMidY = halfH + Math.floor((screenH - halfH) * 0.45);
    const floorMidCol = Color.new(clampInt(12 + Math.floor(redPulse * 0.4), 0, 255), 14, 18, 128);
    const floorBotCol = Color.new(clampInt(26 + Math.floor(redPulse * 0.8), 0, 255), 25, 30, 128);
    Draw.quad(0, halfH, screenW, halfH, 0, floorMidY, screenW, floorMidY, horizonCol, horizonCol, floorMidCol, floorMidCol);
    Draw.quad(0, floorMidY, screenW, floorMidY, 0, screenH, screenW, screenH, floorMidCol, floorMidCol, floorBotCol, floorBotCol);

    // Vigas transversales en techo y juntas de baldosas/charcos en piso con perspectiva
    const walkScroll = fadd(px * 0.85, py * 0.85);
    for (let b = 1; b <= 6; b++) {
        const phase = fadd(b * 0.16, (walkScroll - Math.floor(walkScroll)) * 0.16);
        const persp = phase * phase;
        const cy = Math.floor(halfH - persp * halfH);
        const fy = Math.floor(fadd(halfH, persp * (screenH - halfH)));
        const beamH = Math.max(1, Math.floor(persp * 6.0));
        const br = clampInt(6 + Math.floor(persp * 18.0), 0, 255);
        if (cy > 2 && cy < halfH - 4) {
            Draw.rect(0, cy, screenW, beamH, Color.new(br, br + 2, br + 5, 110));
        }
        if (fy > halfH + 4 && fy < screenH - 2) {
            Draw.rect(0, fy, screenW, Math.max(1, Math.floor(beamH * 0.6)), Color.new(br + 4, br + 6, br + 10, 96));
        }
    }

    // Proyeccion volumetrica del haz de linterna sobre el piso y techo
    if ((effFlash - 0.05) > 0) {
        const spotCx = Math.floor(screenW * 0.5) + swayOffset;
        const spotAlpha = clampInt(effFlash * 44.0, 0, 72);
        const spotHotCol = Color.new(195, 215, 240, spotAlpha);
        const spotFadeCol = Color.new(20, 28, 38, 0);
        // Trapecio de luz en el piso
        Draw.quad(
            spotCx - 28, halfH + 6,
            spotCx + 28, halfH + 6,
            spotCx - 230, screenH,
            spotCx + 230, screenH,
            spotFadeCol, spotFadeCol, spotHotCol, spotHotCol
        );
        // Reflejo tenue en el techo
        const ceilAlpha = clampInt(effFlash * 22.0, 0, 42);
        Draw.quad(
            spotCx - 170, 0,
            spotCx + 170, 0,
            spotCx - 24, halfH - 6,
            spotCx + 24, halfH - 6,
            Color.new(150, 175, 205, ceilAlpha),
            Color.new(150, 175, 205, ceilAlpha),
            spotFadeCol, spotFadeCol
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

    // ------------------------------------------------------------------------
    // 2. RAYCASTING DDA DE 320 COLUMNAS + DETALLE PROCEDURAL Y REJAS 3D
    // ------------------------------------------------------------------------
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

        // Registro de primera reja atravesada (hit === 5) para ver el pasillo detras de los barrotes
        let hasGate = false;
        let gateDist = F64_ZERO;
        let gateSide = 0;

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
            const cell = grid[mapY][mapX];
            if (cell === 5) {
                if (!hasGate) {
                    hasGate = true;
                    gateDist = (side === 0) ? (sideDistX - deltaDistX) : (sideDistY - deltaDistY);
                    if ((gateDist - 0.14) < 0) gateDist = toF64(0.14);
                    gateSide = side;
                }
                // El rayo continua a traves de la reja para dibujar el fondo detras de los barrotes
            } else if (cell > 0) {
                hit = cell;
            }
        }

        let perpDist = (side === 0) ? (sideDistX - deltaDistX) : (sideDistY - deltaDistY);
        if ((perpDist - 0.14) < 0) perpDist = toF64(0.14);
        zBuffer[i] = perpDist;

        const screenX = i * colW;
        const wallH = Math.floor(screenH / perpDist);
        const rawStart = halfH - Math.floor(wallH * 0.5);
        const rawEnd = rawStart + wallH;
        const drawStart = Math.max(0, rawStart);
        const drawEnd = Math.min(screenH, rawEnd);
        const clippedH = drawEnd - drawStart;

        const centerDist = Math.abs(camX);
        const beamProfile = Math.max(0.0, 1.0 - centerDist * 1.38);
        const beam = ((effFlash - 0.0) > 0) ? (beamProfile * beamProfile * effFlash) : 0.0;
        const maxVis = ((effFlash - 0.0) > 0) ? fadd(7.5, beam * 8.5) : 4.2;

        if (clippedH > 0) {
            let light = Math.max(0.12, 1.0 - (perpDist / maxVis));
            if (side === 1) light *= 0.74;
            const hotspot = beam * 0.45 * Math.max(0.0, 1.0 - perpDist / 11.5);
            light = Math.min(1.25, fadd(light, hotspot));

            let wallX = (side === 0) ? fadd(py, perpDist * rayDirY) : fadd(px, perpDist * rayDirX);
            wallX -= Math.floor(wallX);

            const texBin = Math.floor(wallX * 16.0);
            const cellHash = ((mapX * 73 + mapY * 37 + texBin * 13) & 31);

            const isEdgeSeam = ((wallX - 0.035) < 0 || (wallX - 0.965) > 0);
            const isSubSeam = (Math.abs(wallX - 0.5) - 0.018) < 0;
            const isPanel = (Math.floor(wallX * 4.0) % 2 === 0);

            if (isEdgeSeam) light *= 0.48;
            else if (isSubSeam) light *= 0.68;
            else if (isPanel) light *= 0.94;

            // Variacion sutil de grano de superficie por columna
            if ((cellHash & 3) === 0) light *= 0.91;
            else if ((cellHash & 3) === 1) light *= 1.05;

            let r = 98, g = 106, b = 116;
            if (hit === 2) {
                // Pilar industrial oxidado
                r = 136; g = 76; b = 54;
                if ((cellHash & 7) < 3) { r = 112; g = 58; b = 42; }
            } else if (hit === 3) {
                // Zona ritual / muros ensangrentados con iluminacion de emergencia
                r = Math.floor(fadd(92.0, 72.0 * emerFlicker));
                g = 26;
                b = 28;
            } else if (hit === 4) {
                // Compuerta blindada Norte
                r = breakerActive ? 42 : 148;
                g = breakerActive ? 210 : 108;
                b = breakerActive ? 95 : 38;
            }

            const redTint = dRatio * 26.0;
            const cR = clampInt(fadd(r * light, redTint), 0, 255);
            const cG = clampInt(g * light, 0, 255);
            const cB = clampInt(b * light, 0, 255);

            renderStats.cols++;
            if ((perpDist - renderStats.minD) < 0) renderStats.minD = perpDist;
            if ((perpDist - renderStats.maxD) > 0) renderStats.maxD = perpDist;

            if (renderStats.wallMode === 1) {
                Draw.rect(screenX, drawStart, colW, clippedH, Color.new(255, 0, 255, 128));
            } else {
                // Sombreado Gouraud vertical: oclusion ambiental en techo/piso + centro iluminado por el haz
                const aoR = Math.floor(cR * 0.46);
                const aoG = Math.floor(cG * 0.46);
                const aoB = Math.floor(cB * 0.48);
                const midR = clampInt(fadd(cR, beam * 36.0), 0, 255);
                const midG = clampInt(fadd(cG, beam * 38.0), 0, 255);
                const midB = clampInt(fadd(cB, beam * 44.0), 0, 255);

                const colEdge = Color.new(aoR, aoG, aoB, 128);
                const colMid  = Color.new(midR, midG, midB, 128);
                const midY = clampInt(halfH, drawStart, drawEnd);

                if (clippedH >= 10) {
                    if (midY > drawStart) {
                        Draw.quad(
                            screenX, drawStart, screenX + colW, drawStart,
                            screenX, midY,      screenX + colW, midY,
                            colEdge, colEdge, colMid, colMid
                        );
                    }
                    if (drawEnd > midY) {
                        Draw.quad(
                            screenX, midY,    screenX + colW, midY,
                            screenX, drawEnd, screenX + colW, drawEnd,
                            colMid, colMid, colEdge, colEdge
                        );
                    }
                } else {
                    Draw.rect(screenX, drawStart, colW, clippedH, colMid);
                }

                // Detalles arquitectonicos cuando la pared tiene suficiente altura en pantalla
                if (wallH >= 18) {
                    // 1) Cornisa / conducto de cañeria superior y zocalo industrial inferior
                    const corniceH = Math.max(2, Math.floor(wallH * 0.07));
                    const corniceEnd = Math.min(drawEnd, rawStart + corniceH);
                    if (corniceEnd > drawStart) {
                        Draw.rect(screenX, drawStart, colW, corniceEnd - drawStart, Color.new(Math.floor(cR * 0.34), Math.floor(cG * 0.36), Math.floor(cB * 0.40), 128));
                    }
                    const pipeY = rawStart + Math.floor(wallH * 0.11);
                    if (pipeY >= drawStart && pipeY + 2 <= drawEnd) {
                        Draw.rect(screenX, pipeY, colW, Math.max(2, Math.floor(wallH * 0.025)), Color.new(clampInt(cR * 0.78 + 18, 0, 255), clampInt(cG * 0.78 + 18, 0, 255), clampInt(cB * 0.82 + 22, 0, 255), 128));
                    }

                    const baseStart = Math.max(drawStart, rawEnd - Math.max(2, Math.floor(wallH * 0.09)));
                    if (drawEnd > baseStart) {
                        Draw.rect(screenX, baseStart, colW, drawEnd - baseStart, Color.new(Math.floor(cR * 0.28), Math.floor(cG * 0.30), Math.floor(cB * 0.32), 128));
                    }

                    // 2) Juntas horizontales de bloques y detalles especificos por tipo de muro
                    const joint1Y = rawStart + Math.floor(wallH * 0.34);
                    const joint2Y = rawStart + Math.floor(wallH * 0.66);
                    const jointCol = Color.new(Math.floor(cR * 0.52), Math.floor(cG * 0.52), Math.floor(cB * 0.55), 128);
                    if (joint1Y >= drawStart && joint1Y < drawEnd) Draw.rect(screenX, joint1Y, colW, 1, jointCol);
                    if (joint2Y >= drawStart && joint2Y < drawEnd) Draw.rect(screenX, joint2Y, colW, 1, jointCol);

                    if (hit === 1) {
                        // Manchas verticales de humedad/filtracion y franja de precaucion industrial
                        if ((cellHash & 7) === 2) {
                            const leakH = Math.floor(wallH * (fadd(0.35, (cellHash & 3) * 0.12)));
                            const leakEnd = Math.min(drawEnd, Math.max(drawStart, rawStart + leakH));
                            if (leakEnd > drawStart) {
                                Draw.rect(screenX, drawStart, colW, leakEnd - drawStart, Color.new(Math.floor(cR * 0.55), Math.floor(cG * 0.62), Math.floor(cB * 0.58), 96));
                            }
                        }
                        // Banda de seguridad amarilla/negra a media altura en muros seleccionados
                        if (((mapX + mapY) % 3 === 0) && wallH >= 28) {
                            const stripeY = rawStart + Math.floor(wallH * 0.52);
                            const stripeH = Math.max(2, Math.floor(wallH * 0.055));
                            if (stripeY >= drawStart && stripeY + stripeH <= drawEnd) {
                                const diag = (Math.floor(wallX * 12.0) % 2 === 0);
                                const sR = diag ? clampInt(195 * light, 0, 255) : Math.floor(22 * light);
                                const sG = diag ? clampInt(155 * light, 0, 255) : Math.floor(22 * light);
                                const sB = diag ? Math.floor(25 * light)       : Math.floor(24 * light);
                                Draw.rect(screenX, stripeY, colW, stripeH, Color.new(sR, sG, sB, 128));
                            }
                        }
                    } else if (hit === 2) {
                        // Remaches metalicos y refuerzos diagonales en pilares oxidados
                        const isRivetCol = (((wallX - 0.10) > 0 && (wallX - 0.16) < 0) || ((wallX - 0.84) > 0 && (wallX - 0.90) < 0));
                        if (isRivetCol && wallH >= 32) {
                            const rivCol = Color.new(clampInt(midR + 45, 0, 255), clampInt(midG + 35, 0, 255), clampInt(midB + 30, 0, 255), 128);
                            for (let rv = 1; rv <= 4; rv++) {
                                const ry = rawStart + Math.floor(wallH * (rv * 0.20));
                                if (ry >= drawStart && ry + 2 <= drawEnd) {
                                    Draw.rect(screenX, ry, colW, 2, rivCol);
                                }
                            }
                        }
                    } else if (hit === 3) {
                        // Luminaria roja de emergencia empotrada + chorreaduras de sangre
                        if ((wallX - 0.40) > 0 && (wallX - 0.60) < 0) {
                            const lampY = rawStart + Math.floor(wallH * 0.24);
                            const lampH = Math.max(3, Math.floor(wallH * 0.08));
                            if (lampY >= drawStart && lampY + lampH <= drawEnd) {
                                const glowR = clampInt(fadd(210.0 * emerFlicker, 45.0), 0, 255);
                                const glowG = clampInt(55 * emerFlicker, 0, 255);
                                Draw.rect(screenX, lampY, colW, lampH, Color.new(glowR, glowG, 35, 128));
                            }
                        }
                        if ((cellHash & 3) === 0) {
                            const dripY = rawStart + Math.floor(wallH * 0.40);
                            const dripH = Math.floor(wallH * (fadd(0.25, (cellHash & 3) * 0.08)));
                            const dStart = Math.max(drawStart, dripY);
                            const dEnd = Math.min(drawEnd, dripY + dripH);
                            if (dEnd > dStart) {
                                Draw.rect(screenX, dStart, colW, dEnd - dStart, Color.new(Math.floor(cR * 0.45), 6, 8, 120));
                            }
                        }
                    } else if (hit === 4) {
                        // Compuerta blindada Norte con chevrones y panel luminoso central
                        const chevH = Math.max(3, Math.floor(wallH * 0.09));
                        const isChev = (Math.floor(wallX * 14.0) % 2 === 0);
                        const chCol = isChev
                            ? Color.new(clampInt(210 * light, 0, 255), clampInt(165 * light, 0, 255), 25, 128)
                            : Color.new(20, 22, 25, 128);
                        if (rawStart + chevH > drawStart && rawStart + chevH <= drawEnd) {
                            Draw.rect(screenX, drawStart, colW, Math.min(chevH, drawEnd - drawStart), chCol);
                        }
                        if ((wallX - 0.35) > 0 && (wallX - 0.65) < 0) {
                            const pY = rawStart + Math.floor(wallH * 0.42);
                            const pH = Math.max(4, Math.floor(wallH * 0.16));
                            if (pY >= drawStart && pY + pH <= drawEnd) {
                                const ledCol = breakerActive
                                    ? Color.new(65, 255, 130, 128)
                                    : Color.new(255, 55, 35, 128);
                                Draw.rect(screenX, pY, colW, pH, ledCol);
                            }
                        }
                    }
                }
            }
        }

        // --------------------------------------------------------------------
        // 2B. REJAS DE SEGURIDAD 3D TRANSPARENTES (VER A TRAVES DE BARROTES)
        // --------------------------------------------------------------------
        if (hasGate) {
            const gWallH = Math.floor(screenH / gateDist);
            const gRawStart = halfH - Math.floor(gWallH * 0.5);
            const gRawEnd = gRawStart + gWallH;
            const gStart = Math.max(0, gRawStart);
            const gEnd = Math.min(screenH, gRawEnd);
            const gClippedH = gEnd - gStart;

            if (gClippedH > 0) {
                let gWX = (gateSide === 0) ? fadd(py, gateDist * rayDirY) : fadd(px, gateDist * rayDirX);
                gWX -= Math.floor(gWX);

                let gLight = Math.max(0.16, 1.0 - (gateDist / maxVis));
                if (gateSide === 1) gLight *= 0.78;
                gLight = Math.min(1.25, fadd(gLight, beam * 0.40 * Math.max(0.0, 1.0 - gateDist / 10.0)));

                // 8 barrotes cilindricos por celda + caja de cerradura central
                const barScaled = gWX * 8.0;
                const barFrac = barScaled - Math.floor(barScaled);
                const isVerticalBar = (barFrac - 0.36) < 0;
                const isLockBox = ((gWX - 0.44) > 0 && (gWX - 0.56) < 0);

                if (isVerticalBar) {
                    // Sombreado cilindrico en cada barrote metalico
                    const cylShade = 1.0 - Math.abs(barFrac - 0.18) * 3.2;
                    const metal = Math.max(0.35, cylShade) * gLight;
                    const bR = clampInt(fadd(115.0 * metal, dRatio * 20.0), 0, 255);
                    const bG = clampInt(125 * metal, 0, 255);
                    const bB = clampInt(138 * metal, 0, 255);
                    Draw.rect(screenX, gStart, colW, gClippedH, Color.new(bR, bG, bB, 128));
                    // El barrote solido ocluye entidades detras de la reja en esta columna
                    zBuffer[i] = gateDist;
                } else {
                    // Travesaños horizontales superior, central e inferior (dejando huecos abiertos entre barrotes)
                    const crossH = Math.max(2, Math.floor(gWallH * 0.045));
                    const cCol = Color.new(clampInt(75 * gLight, 0, 255), clampInt(82 * gLight, 0, 255), clampInt(92 * gLight, 0, 255), 128);
                    const topBarY = gRawStart + Math.floor(gWallH * 0.12);
                    const midBarY = gRawStart + Math.floor(gWallH * 0.50);
                    const botBarY = gRawStart + Math.floor(gWallH * 0.86);
                    if (topBarY >= gStart && topBarY + crossH <= gEnd) Draw.rect(screenX, topBarY, colW, crossH, cCol);
                    if (midBarY >= gStart && midBarY + crossH <= gEnd) Draw.rect(screenX, midBarY, colW, crossH, cCol);
                    if (botBarY >= gStart && botBarY + crossH <= gEnd) Draw.rect(screenX, botBarY, colW, crossH, cCol);
                }

                // Caja de bloqueo electromagnetico con LED rojo parpadeante en el centro de la reja
                if (isLockBox) {
                    const lbY = gRawStart + Math.floor(gWallH * 0.43);
                    const lbH = Math.max(4, Math.floor(gWallH * 0.14));
                    if (lbY >= gStart && lbY + lbH <= gEnd) {
                        Draw.rect(screenX, lbY, colW, lbH, Color.new(38, 40, 46, 128));
                        if ((gWX - 0.48) > 0 && (gWX - 0.52) < 0 && ((frameTick % 24) < 16)) {
                            const ledY = lbY + Math.floor(lbH * 0.3);
                            Draw.rect(screenX, ledY, colW, Math.max(2, Math.floor(lbH * 0.4)), Color.new(255, 40, 30, 128));
                        }
                    }
                }
            }
        }
    }

    // ------------------------------------------------------------------------
    // 3. PROYECCION 3D DE ENTIDADES Y EL ACECHADOR CON Z-BUFFER
    // ------------------------------------------------------------------------
    const drawList = [];
    for (let e = 0; e < entities.length; e++) {
        if (!entities[e].taken) drawList.push(entities[e]);
    }
    drawList.push({ kind: "stalker", x: toF64(stalker.x), y: toF64(stalker.y), state: stalker.state });

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
            const mW = Math.max(14, Math.floor(spH * 0.48));
            const mH = Math.floor(spH * 0.92);
            const mLeft = screenX - Math.floor(mW * 0.5);
            const stride = Math.sin(frameTick * 0.24);
            const bobStalker = Math.floor(Math.abs(stride) * Math.max(2, spH * 0.035));
            const mTop = Math.max(0, halfH - Math.floor(mH * 0.5) + bobStalker);
            const drawH = Math.min(screenH - mTop, mH);
            if (drawH <= 0) continue;

            const cStart = Math.max(0, Math.floor(mLeft / colW));
            const cEnd = Math.min(NUM_RAYS - 1, Math.floor((mLeft + mW) / colW));
            let visible = false;
            for (let c = cStart; c <= cEnd; c++) {
                if ((transformY - zBuffer[c]) < 0) { visible = true; break; }
            }
            if (!visible) continue;

            const spCamX = Math.abs((2.0 * screenX / screenW) - 1.0);
            const spBeam = ((effFlash - 0.0) > 0) ? Math.max(0.0, 1.0 - spCamX * 1.38) * effFlash : 0.0;
            const spMaxVis = ((effFlash - 0.0) > 0) ? fadd(7.5, spBeam * 8.5) : 4.2;
            const stLight = toF64(Math.max(0.22, Math.min(1.2, 1.0 - transformY / fadd(spMaxVis, 2.5))));
            const bodyX = Math.max(0, mLeft);
            const bodyW = Math.min(screenW, mLeft + mW) - bodyX;

            // Sombra proyectada en el piso bajo El Acechador
            const shadowY = Math.min(screenH - 4, mTop + drawH - 2);
            if (bodyW > 4 && shadowY > halfH) {
                Draw.rect(bodyX - 2, shadowY, bodyW + 4, Math.max(3, Math.floor(drawH * 0.05)), Color.new(2, 2, 4, 95));
            }

            // Piernas biomecanicas articuladas en movimiento
            const legW = Math.max(3, Math.floor(mW * 0.22));
            const legH = Math.floor(drawH * 0.34);
            const legY = mTop + Math.floor(drawH * 0.66);
            const legOffsetL = Math.floor(stride * Math.max(2, legH * 0.14));
            const legOffsetR = -legOffsetL;
            const lLegX = screenX - Math.floor(mW * 0.26);
            const rLegX = screenX + Math.floor(mW * 0.06);
            const darkLimbCol = Color.new(clampInt(22 * stLight, 0, 255), clampInt(10 * stLight, 0, 255), clampInt(14 * stLight, 0, 255), 128);
            if (lLegX >= 0 && lLegX + legW <= screenW) {
                Draw.rect(lLegX, clampInt(legY + legOffsetL, 0, screenH - legH), legW, legH, darkLimbCol);
            }
            if (rLegX >= 0 && rLegX + legW <= screenW) {
                Draw.rect(rLegX, clampInt(legY + legOffsetR, 0, screenH - legH), legW, legH, darkLimbCol);
            }

            // Torso encorvado con sombreado Gouraud y costillas expuestas
            if (bodyW > 0) {
                const torsoTop = mTop + Math.floor(drawH * 0.22);
                const torsoH = Math.floor(drawH * 0.48);
                const tColTop = Color.new(clampInt(fadd(42.0 * stLight, dRatio * 24.0), 0, 255), clampInt(14 * stLight, 0, 255), clampInt(18 * stLight, 0, 255), 128);
                const tColBot = Color.new(12, 4, 6, 128);
                Draw.quad(
                    bodyX, torsoTop, bodyX + bodyW, torsoTop,
                    bodyX + Math.floor(bodyW * 0.12), torsoTop + torsoH, bodyX + Math.floor(bodyW * 0.88), torsoTop + torsoH,
                    tColTop, tColTop, tColBot, tColBot
                );

                // Costillas / placas dorsales palidas
                const ribW = Math.floor(bodyW * 0.62);
                const ribX = bodyX + Math.floor((bodyW - ribW) * 0.5);
                const ribCol = Color.new(clampInt(125 * stLight, 0, 255), clampInt(88 * stLight, 0, 255), clampInt(85 * stLight, 0, 255), 115);
                for (let rb = 0; rb < 3; rb++) {
                    const ry = torsoTop + Math.floor(torsoH * (fadd(0.22, rb * 0.24)));
                    Draw.rect(ribX, ry, ribW, Math.max(1, Math.floor(torsoH * 0.07)), ribCol);
                }
            }

            // Brazos largos desproporcionados con garras
            const armW = Math.max(3, Math.floor(mW * 0.16));
            const armH = Math.floor(drawH * 0.54);
            const armTop = mTop + Math.floor(drawH * 0.24);
            const armSwing = Math.floor(Math.cos(frameTick * 0.24) * Math.max(2, mW * 0.12));
            const leftArmX = mLeft - Math.floor(armW * 0.6);
            const rightArmX = mLeft + mW - Math.floor(armW * 0.4);
            const clawCol = Color.new(clampInt(175 * stLight, 0, 255), clampInt(35 * stLight, 0, 255), 35, 128);
            if (leftArmX >= 0 && leftArmX + armW <= screenW) {
                const ay = clampInt(armTop - armSwing, 0, screenH - armH);
                Draw.rect(leftArmX, ay, armW, armH, darkLimbCol);
                Draw.rect(leftArmX, Math.min(screenH - 3, ay + armH - 3), armW + 2, 3, clawCol);
            }
            if (rightArmX >= 0 && rightArmX + armW <= screenW) {
                const ay = clampInt(armTop + armSwing, 0, screenH - armH);
                Draw.rect(rightArmX, ay, armW, armH, darkLimbCol);
                Draw.rect(rightArmX - 2, Math.min(screenH - 3, ay + armH - 3), armW + 2, 3, clawCol);
            }

            // Cabeza / craneo distorsionado con mandibula desencajada
            const headW = Math.floor(mW * 0.56);
            const headH = Math.floor(drawH * 0.24);
            const headL = screenX - Math.floor(headW * 0.5);
            const headX = Math.max(0, headL);
            const headDrawW = Math.min(screenW, headL + headW) - headX;
            if (headDrawW > 0 && headH > 0) {
                const skullTopCol = Color.new(clampInt(195 * stLight, 0, 255), clampInt(162 * stLight, 0, 255), clampInt(152 * stLight, 0, 255), 128);
                const skullBotCol = Color.new(clampInt(115 * stLight, 0, 255), clampInt(72 * stLight, 0, 255), clampInt(70 * stLight, 0, 255), 128);
                Draw.quad(
                    headX, mTop, headX + headDrawW, mTop,
                    headX, mTop + headH, headX + headDrawW, mTop + headH,
                    skullTopCol, skullTopCol, skullBotCol, skullBotCol
                );
                // Boca / mandibula oscura abierta
                const jawW = Math.floor(headDrawW * 0.54);
                const jawH = Math.max(2, Math.floor(headH * (fadd(0.24, dRatio * 0.22))));
                const jawX = headX + Math.floor((headDrawW - jawW) * 0.5);
                const jawY = mTop + headH - jawH - 1;
                Draw.rect(jawX, jawY, jawW, jawH, Color.new(18, 2, 4, 128));
            }

            // Ojos carmesi brillantes con halo
            const eyeSize = Math.max(2, Math.floor(headW * 0.22));
            const eyeY = mTop + Math.floor(headH * 0.36);
            const e1x = screenX - Math.floor(headW * 0.30);
            const e2x = screenX + Math.floor(headW * 0.10);
            const eyeGlow = Color.new(255, 25, 25, 68);
            const eyeCore = Color.new(255, 210, 190, 128);
            if (e1x >= 2 && e1x + eyeSize + 2 <= screenW) {
                Draw.rect(e1x - 1, eyeY - 1, eyeSize + 2, eyeSize + 2, eyeGlow);
                Draw.rect(e1x, eyeY, eyeSize, eyeSize, Color.new(255, 25, 20, 128));
                Draw.rect(e1x + 1, eyeY + 1, Math.max(1, eyeSize - 2), Math.max(1, eyeSize - 2), eyeCore);
            }
            if (e2x >= 2 && e2x + eyeSize + 2 <= screenW) {
                Draw.rect(e2x - 1, eyeY - 1, eyeSize + 2, eyeSize + 2, eyeGlow);
                Draw.rect(e2x, eyeY, eyeSize, eyeSize, Color.new(255, 25, 20, 128));
                Draw.rect(e2x + 1, eyeY + 1, Math.max(1, eyeSize - 2), Math.max(1, eyeSize - 2), eyeCore);
            }
        } else {
            if (colIdx < 0 || colIdx >= NUM_RAYS || (transformY - zBuffer[colIdx]) >= 0) continue;
            const itemSize = Math.max(8, Math.floor(spH * 0.32));
            const floatBob = Math.floor(Math.sin(fadd(frameTick * 0.10, s)) * 5.0);
            const iy = Math.max(4, Math.min(screenH - itemSize - 4, halfH + Math.floor(spH * 0.14) + floatBob));
            const ix = screenX - Math.floor(itemSize * 0.5);

            if (ix < 2 || ix + itemSize > screenW - 2) continue;

            // Sombra en el piso bajo el objeto
            const floorShadowY = Math.min(screenH - 3, halfH + Math.floor(spH * 0.44));
            if (floorShadowY > iy) {
                Draw.rect(ix, floorShadowY, itemSize, Math.max(2, Math.floor(itemSize * 0.22)), Color.new(2, 3, 5, 88));
            }

            if (sp.kind === "fuse") {
                // Halo ambar + cilindro de vidrio con casquillos de bronce y filamento incandescente
                const w = Math.max(6, Math.floor(itemSize * 0.78));
                const capH = Math.max(2, Math.floor(itemSize * 0.20));
                Draw.rect(ix - 3, iy - 3, w + 6, itemSize + 6, Color.new(255, 185, 30, 42));
                Draw.rect(ix, iy, w, itemSize, Color.new(190, 140, 35, 128));
                Draw.rect(ix - 1, iy, w + 2, capH, Color.new(120, 95, 55, 128));
                Draw.rect(ix - 1, iy + itemSize - capH, w + 2, capH, Color.new(120, 95, 55, 128));
                Draw.rect(ix + Math.floor(w * 0.28), iy + capH, Math.max(2, Math.floor(w * 0.44)), itemSize - capH * 2, Color.new(255, 245, 185, 128));
            } else if (sp.kind === "battery") {
                // Celda de litio con terminal "+" y barras LED cyan de carga
                const w = Math.max(6, Math.floor(itemSize * 0.76));
                const termW = Math.max(2, Math.floor(w * 0.44));
                Draw.rect(ix - 3, iy - 3, w + 6, itemSize + 6, Color.new(30, 210, 255, 40));
                Draw.rect(ix + Math.floor((w - termW) * 0.5), iy - 2, termW, 3, Color.new(185, 195, 205, 128));
                Draw.rect(ix, iy, w, itemSize, Color.new(22, 52, 68, 128));
                Draw.rect(ix + 1, iy + 2, Math.max(2, w - 2), Math.max(2, Math.floor(itemSize * 0.25)), Color.new(70, 235, 255, 128));
                Draw.rect(ix + 1, iy + Math.floor(itemSize * 0.42), Math.max(2, w - 2), Math.max(2, Math.floor(itemSize * 0.25)), Color.new(185, 255, 255, 128));
            } else if (sp.kind === "breaker") {
                // Gabinete electrico industrial con palanca y piloto luminoso
                const by = Math.max(2, iy - Math.floor(itemSize * 0.45));
                const bh = Math.floor(itemSize * 1.25);
                Draw.rect(ix - 4, by - 4, itemSize + 8, bh + 8, Color.new(255, 45, 35, 48));
                Draw.rect(ix, by, itemSize, bh, Color.new(75, 28, 28, 128));
                Draw.rect(ix + 2, by + 2, Math.max(4, itemSize - 4), Math.max(4, bh - 4), Color.new(185, 42, 38, 128));
                // Etiqueta de alto voltaje y palanca
                Draw.rect(ix + Math.floor(itemSize * 0.22), by + Math.floor(bh * 0.20), Math.max(2, Math.floor(itemSize * 0.56)), Math.max(2, Math.floor(bh * 0.26)), Color.new(255, 220, 65, 128));
                Draw.rect(ix + Math.floor(itemSize * 0.35), by + Math.floor(bh * 0.55), Math.max(2, Math.floor(itemSize * 0.30)), Math.max(3, Math.floor(bh * 0.32)), Color.new(25, 25, 30, 128));
            } else if (sp.kind === "note") {
                // Tablero / hoja de registro con renglones escritos
                const nw = Math.max(6, Math.floor(itemSize * 0.82));
                const nh = Math.max(6, Math.floor(itemSize * 0.95));
                const ny = Math.min(screenH - nh - 2, iy + 2);
                Draw.rect(ix - 2, ny - 2, nw + 4, nh + 4, Color.new(180, 210, 255, 36));
                Draw.rect(ix, ny, nw, nh, Color.new(232, 236, 244, 128));
                const lineW = Math.max(2, nw - 4);
                Draw.rect(ix + 2, ny + Math.floor(nh * 0.25), lineW, 1, Color.new(45, 55, 70, 128));
                Draw.rect(ix + 2, ny + Math.floor(nh * 0.50), lineW, 1, Color.new(45, 55, 70, 128));
                Draw.rect(ix + 2, ny + Math.floor(nh * 0.72), Math.max(1, Math.floor(lineW * 0.65)), 1, Color.new(165, 40, 40, 128));
            }
        }
    }

    // ------------------------------------------------------------------------
    // 4. PARTICULAS ATMOSFERICAS (POLVO / ESPORAS EN EL HAZ DE LINTERNA)
    // ------------------------------------------------------------------------
    if (ENABLE_PARTICLES) {
        for (let p = 0; p < 26; p++) {
            const seedX = (p * 97 + 31) % 100;
            const seedY = (p * 53 + 17) % 100;
            const driftX = Math.sin(fadd(frameTick * 0.018, p * 1.7)) * 28.0;
            const driftY = (fadd(frameTick * fadd(0.35, (p & 3) * 0.12), seedY * 4.5) % (screenH - 60));
            const partX = clampInt(fadd(seedX * (screenW / 100.0), fadd(driftX, -pang * 85.0)) % screenW, 0, screenW - 3);
            const partY = clampInt(fadd(30.0, driftY), 34, screenH - 40);

            const normX = Math.abs((partX - screenW * 0.5) / (screenW * 0.5));
            const inBeam = ((effFlash - 0.05) > 0) && ((normX - 0.52) < 0);
            const alpha = inBeam ? clampInt((0.60 - normX) * 115.0 * effFlash, 18, 78) : 16;
            const sz = ((p & 3) === 0 && inBeam) ? 2 : 1;
            Draw.rect(partX, partY, sz, sz, Color.new(210, 225, 240, alpha));
        }
    }

    // ------------------------------------------------------------------------
    // 5. VIEWMODEL 3D EN PRIMERA PERSONA (MANO + LINTERNA TACTICA)
    // ------------------------------------------------------------------------
    if (ENABLE_VIEWMODEL) {
        renderFlashlightViewmodel(screenW, screenH, effFlash, pbat, bobOffset, swayOffset, mAnim, frameTick);
    }

    // ------------------------------------------------------------------------
    // 6. VINETA PERIMETRAL GOURAUD Y SCANLINES CRT/VHS
    // ------------------------------------------------------------------------
    if (ENABLE_OVERLAYS) {
        const vigDark = Color.new(0, 0, 4, 88);
        const vigClear = Color.new(0, 0, 4, 0);
        const vigH = 54;
        Draw.quad(0, 34, screenW, 34, 0, 34 + vigH, screenW, 34 + vigH, vigDark, vigDark, vigClear, vigClear);
        Draw.quad(0, screenH - 36 - vigH, screenW, screenH - 36 - vigH, 0, screenH - 36, screenW, screenH - 36, vigClear, vigClear, vigDark, vigDark);

        // Scanlines sutiles estilo monitor CRT de seguridad
        const scanOffset = (frameTick & 1) * 2;
        const scanCol = Color.new(0, 0, 0, 18);
        for (let sy = 36 + scanOffset; sy < screenH - 36; sy += 8) {
            Draw.rect(0, sy, screenW, 1, scanCol);
        }
    }
}

function renderFlashlightViewmodel(screenW, screenH, effFlash, battery, bobOffset, swayOffset, mapAnim, frameTick) {
    // Al abrir el mapa PDA, la mano con la linterna baja suavemente
    const hideOffset = Math.floor(mapAnim * 120.0);
    const vmX = screenW - 148 + Math.floor(swayOffset * 1.6);
    const vmY = screenH - 118 + Math.floor(bobOffset * 1.15) + hideOffset;
    if (vmY >= screenH + 20) return;

    // 1) Haz volumetrico saliendo del lente hacia el centro de la escena
    if ((effFlash - 0.05) > 0) {
        const lensX = vmX + 12;
        const lensY = vmY + 8;
        const coneAlpha = clampInt(effFlash * 38.0, 0, 58);
        const coneTipCol = Color.new(225, 240, 255, coneAlpha);
        const coneFarCol = Color.new(120, 165, 220, 0);
        Draw.triangle(
            lensX, lensY,
            Math.floor(screenW * 0.26), Math.floor(screenH * 0.34),
            Math.floor(screenW * 0.72), Math.floor(screenH * 0.28),
            coneTipCol, coneFarCol, coneFarCol
        );
        // Halo brillante en el lente
        Draw.circle(lensX, lensY, 14, Color.new(210, 235, 255, clampInt(effFlash * 52.0, 0, 82)), true);
    }

    // 2) Manga del traje y guante tactico sosteniendo la linterna
    const sleeveCol1 = Color.new(24, 28, 34, 128);
    const sleeveCol2 = Color.new(10, 12, 16, 128);
    Draw.quad(
        vmX + 48, vmY + 54,
        vmX + 132, vmY + 42,
        vmX + 88, screenH + 10,
        vmX + 165, screenH + 10,
        sleeveCol1, sleeveCol2, sleeveCol2, sleeveCol2
    );

    // Nudillos del guante
    const gloveCol = Color.new(38, 42, 48, 128);
    Draw.rect(vmX + 34, vmY + 36, 44, 26, gloveCol);
    Draw.rect(vmX + 38, vmY + 32, 36, 6, Color.new(54, 60, 68, 128));

    // 3) Cuerpo cilindrico metalico de la linterna (con sombreado Gouraud)
    const bodyTop = Color.new(88, 96, 108, 128);
    const bodyBot = Color.new(26, 30, 36, 128);
    Draw.quad(
        vmX + 18, vmY + 12,
        vmX + 44, vmY - 4,
        vmX + 78, vmY + 68,
        vmX + 106, vmY + 50,
        bodyBot, bodyTop, bodyBot, bodyTop
    );

    // Cabezal / bisel del reflector
    const headTop = Color.new(115, 125, 138, 128);
    const headBot = Color.new(42, 46, 54, 128);
    Draw.quad(
        vmX - 2, vmY + 2,
        vmX + 26, vmY - 16,
        vmX + 22, vmY + 20,
        vmX + 48, vmY + 2,
        headBot, headTop, headBot, headTop
    );

    // Lente frontal
    const lensCol = ((effFlash - 0.05) > 0)
        ? Color.new(245, 250, 255, 128)
        : Color.new(45, 55, 65, 128);
    Draw.circle(vmX + 12, vmY + 4, 8, lensCol, true);

    // LED indicador de estado de bateria en el lomo de la linterna
    const lowBat = (battery - 25.0) < 0;
    const ledCol = ((effFlash - 0.05) <= 0)
        ? Color.new(180, 35, 35, 128)
        : (lowBat && (frameTick % 16 < 8))
            ? Color.new(255, 165, 30, 128)
            : Color.new(55, 245, 115, 128);
    Draw.rect(vmX + 44, vmY + 18, 6, 4, ledCol);
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

    // Carcasa del PDA / Plano tactico con bisel metalico
    Draw.rect(ox - 8, oy - 8, panelW + 16, panelH + 16, Color.new(34, 52, 38, 124));
    Draw.rect(ox - 4, oy - 4, panelW + 8, panelH + 8, Color.new(16, 28, 20, 126));
    Draw.rect(ox, oy, panelW, panelH, Color.new(6, 14, 9, 126));

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