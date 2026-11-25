// ============================================================================
// Campaña lineal de 3 Capítulos (mapas 20x20), colisiones AABB sin allocs,
// notas de lore, triggers de radio narrativa y configuración de entidades.
// 0 = Pasillo libre        1 = Pared hormigon    2 = Pilar/estructura oxidada
// 3 = Zona ritual / sangre 4 = Compuerta salida  5 = Reja de seguridad
// ============================================================================

const MAP_W = 20;
const MAP_H = 20;

// CAPÍTULO 1: SUBSUELO 04 — EL APAGÓN (mapa original preservado)
const BASE_MAP = [
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

// CAPÍTULO 2: TÚNELES DE MANTENIMIENTO Y CALDERAS (pasillos estrechos + sala de válvulas)
const CH2_MAP = [
    [1,1,1,1,1,1,1,1,1,4,4,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,2,0,0,0,0,0,0,0,0,0,0,2,0,0,0,1],
    [1,0,2,0,2,0,1,1,1,0,0,1,1,1,0,2,0,2,0,1],
    [1,0,2,0,0,0,1,0,0,0,0,0,0,1,0,0,0,2,0,1],
    [1,0,0,0,1,1,1,0,2,0,0,2,0,1,1,1,0,0,0,1],
    [1,2,2,0,5,0,0,0,0,0,0,0,0,0,0,5,0,2,2,1],
    [1,0,0,0,5,0,2,1,0,2,2,0,1,2,0,5,0,0,0,1],
    [1,0,1,0,1,0,0,0,0,0,0,0,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,1,2,0,1,0,0,1,0,2,1,1,0,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,2,1,1,0,2,2,0,0,0,0,0,0,2,2,0,1,1,2,1],
    [1,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,1],
    [1,0,2,1,1,0,1,0,1,0,0,1,0,1,0,1,1,2,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,1],
    [1,1,2,0,1,1,1,2,0,2,2,0,2,1,1,1,0,2,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,2,2,0,1,0,2,0,0,0,0,2,0,1,0,2,2,0,1],
    [1,0,0,0,0,1,0,0,0,3,3,0,0,0,1,0,0,0,0,1],
    [1,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

// CAPÍTULO 3: PABELLÓN DE CONTENCIÓN Y ASCENSOR DE SUPERFICIE (zona ritual + clímax)
const CH3_MAP = [
    [1,1,1,1,1,1,1,1,1,4,4,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,3,3,0,1,1,0,0,0,0,0,0,1,1,0,3,3,0,1],
    [1,0,3,0,0,0,0,0,3,0,0,3,0,0,0,0,0,3,0,1],
    [1,0,0,0,1,0,3,0,3,0,0,3,0,3,0,1,0,0,0,1],
    [1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1],
    [1,0,0,0,5,0,2,0,1,0,0,1,0,2,0,5,0,0,0,1],
    [1,0,3,0,5,0,2,0,0,0,0,0,0,2,0,5,0,3,0,1],
    [1,0,3,0,1,0,0,0,3,0,0,3,0,0,0,1,0,3,0,1],
    [1,0,0,0,0,0,3,0,0,0,0,0,0,3,0,0,0,0,0,1],
    [3,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,3],
    [3,0,0,0,0,3,0,2,0,0,0,0,2,0,3,0,0,0,0,3],
    [1,0,3,1,0,3,0,0,0,3,3,0,0,0,3,0,1,3,0,1],
    [1,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,1],
    [1,1,0,3,3,0,1,1,0,0,0,0,1,1,0,3,3,0,1,1],
    [1,0,0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0,0,1],
    [1,0,3,0,1,0,3,0,0,0,0,0,0,3,0,1,0,3,0,1],
    [1,0,0,0,1,0,3,3,0,0,0,0,3,3,0,1,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3]
];

const CHAPTERS = [
    {
        id: 0,
        code: "CAP. 1",
        title: "SUBSUELO 04: EL APAGON",
        objectiveBreaker: "ACTIVA EL DISYUNTOR ROJO [SELECT: MAPA]",
        objectiveExit: "SALIDA NORTE ABIERTA! [X EN COMPUERTA]",
        grid: BASE_MAP,
        meshPrefix: "map_",
        playerSpawn: { x: 10.0, y: 1.8, ang: 1.5708 },
        stalkerSpawn: { x: 10.5, y: 16.5, speedNormal: 0.024, speedNightmare: 0.029 },
        waypoints: [
            { x: 10.0, y: 10.0 }, { x: 10.0, y: 16.5 },
            { x: 3.0,  y: 10.0 }, { x: 16.5, y: 10.0 },
            { x: 3.5,  y: 3.0  }, { x: 16.5, y: 3.0  }
        ],
        entities: [
            { kind: "fuse",    x: 10.0, y: 17.5, taken: false },
            { kind: "fuse",    x: 10.0, y: 9.5,  taken: false },
            { kind: "fuse",    x: 2.5,  y: 17.5, taken: false },
            { kind: "fuse",    x: 17.5, y: 17.5, taken: false },
            { kind: "breaker", x: 10.0, y: 11.5, taken: false },
            { kind: "battery", x: 8.5,  y: 5.5,  taken: false },
            { kind: "battery", x: 1.5,  y: 2.5,  taken: false },
            { kind: "battery", x: 18.5, y: 2.5,  taken: false },
            { kind: "decoy",   x: 11.5, y: 6.5,  taken: false },
            { kind: "decoy",   x: 3.5,  y: 12.5, taken: false },
            { kind: "locker",  x: 6.5,  y: 5.5,  faceAng: 0.0,    taken: false },
            { kind: "locker",  x: 12.5, y: 13.5, faceAng: 3.1416, taken: false },
            { kind: "note",    x: 10.0, y: 3.5,  msgIdx: 0, taken: false },
            { kind: "note",    x: 10.0, y: 14.5, msgIdx: 1, taken: false },
            { kind: "note",    x: 3.5,  y: 10.5, msgIdx: 2, taken: false },
            { kind: "note",    x: 16.5, y: 10.5, msgIdx: 3, taken: false }
        ],
        radioTriggers: [
            { x: 10.0, y: 3.5,  radius: 2.2, text: "VALDEZ (RADIO): Me escuchas? Las rejas se trabaron. Busca el disyuntor rojo en el centro.", duration: 240, fired: false },
            { x: 10.0, y: 10.5, radius: 2.5, text: "VALDEZ (RADIO): Hay algo en el pasillo transversal... agachate con [CUAD] si lo ois cerca.", duration: 240, fired: false },
            { x: 10.0, y: 16.5, radius: 2.4, text: "VALDEZ (RADIO): Estas en la zona ritual. Toma ese fusible y sali de ahi cuanto antes.", duration: 220, fired: false }
        ]
    },
    {
        id: 1,
        code: "CAP. 2",
        title: "TUNELES DE MANTENIMIENTO",
        objectiveBreaker: "ACTIVA VALVULA CENTRAL [SELECT: MAPA]",
        objectiveExit: "ESCLUSA NORTE ABIERTA! [X EN COMPUERTA]",
        grid: CH2_MAP,
        meshPrefix: "ch2_",
        playerSpawn: { x: 10.0, y: 18.45, ang: -1.5708 },
        stalkerSpawn: { x: 10.0, y: 3.5, speedNormal: 0.026, speedNightmare: 0.031 },
        waypoints: [
            { x: 10.0, y: 9.5  }, { x: 10.0, y: 15.5 },
            { x: 2.5,  y: 9.5  }, { x: 17.5, y: 9.5  },
            { x: 2.5,  y: 15.5 }, { x: 16.5, y: 3.5  }
        ],
        entities: [
            { kind: "fuse",    x: 2.5,  y: 1.5,  taken: false },
            { kind: "fuse",    x: 17.5, y: 1.5,  taken: false },
            { kind: "fuse",    x: 2.5,  y: 13.5, taken: false },
            { kind: "fuse",    x: 17.5, y: 13.5, taken: false },
            { kind: "breaker", x: 10.0, y: 9.5,  taken: false },
            { kind: "battery", x: 10.0, y: 13.5, taken: false },
            { kind: "battery", x: 5.5,  y: 5.5,  taken: false },
            { kind: "battery", x: 14.5, y: 5.5,  taken: false },
            { kind: "decoy",   x: 7.5,  y: 15.5, taken: false },
            { kind: "decoy",   x: 12.5, y: 3.5,  taken: false },
            { kind: "locker",  x: 7.5,  y: 9.5,  faceAng: 0.0,    taken: false },
            { kind: "locker",  x: 12.5, y: 9.5,  faceAng: 3.1416, taken: false },
            { kind: "locker",  x: 5.5,  y: 15.5, faceAng: 0.0,    taken: false },
            { kind: "npc",     x: 10.0, y: 15.5, name: "VALDEZ", spoken: false,
              dialog: "VALDEZ: Estoy herido... activa la valvula central y junta los 4 fusibles para pasar a Contencion.", taken: false },
            { kind: "note",    x: 10.0, y: 7.5,  msgIdx: 4, taken: false },
            { kind: "note",    x: 10.0, y: 3.5,  msgIdx: 5, taken: false }
        ],
        radioTriggers: [
            { x: 10.0, y: 17.5, radius: 2.0, text: "VALDEZ (RADIO): Estoy en el cruce de calderas, frente a vos. Ven con cuidado, usa [L2] para distraerlo.", duration: 250, fired: false },
            { x: 10.0, y: 9.5,  radius: 2.5, text: "DRA. MORALES (RADIO): Aqui Sala de Control. El sujeto cruzo a los tuneles. No enciendas la luz si te rodea.", duration: 240, fired: false },
            { x: 10.0, y: 2.5,  radius: 2.2, text: "DRA. MORALES (RADIO): La esclusa Norte lleva al Pabellon de Contencion. Apurate!", duration: 210, fired: false }
        ]
    },
    {
        id: 2,
        code: "CAP. 3",
        title: "PABELLON DE CONTENCION",
        objectiveBreaker: "DESBLOQUEA NUCLEO CENTRAL [SELECT: MAPA]",
        objectiveExit: "ASCENSOR NORTE LISTO! [X PARA ESCAPAR]",
        grid: CH3_MAP,
        meshPrefix: "ch3_",
        playerSpawn: { x: 10.0, y: 18.45, ang: -1.5708 },
        stalkerSpawn: { x: 10.0, y: 5.5, speedNormal: 0.028, speedNightmare: 0.033 },
        waypoints: [
            { x: 10.0, y: 10.0 }, { x: 10.0, y: 5.5  },
            { x: 4.5,  y: 10.0 }, { x: 15.5, y: 10.0 },
            { x: 2.5,  y: 1.5  }, { x: 17.5, y: 1.5  }
        ],
        entities: [
            { kind: "fuse",    x: 1.5,  y: 1.5,  taken: false },
            { kind: "fuse",    x: 18.5, y: 1.5,  taken: false },
            { kind: "fuse",    x: 1.5,  y: 16.5, taken: false },
            { kind: "fuse",    x: 18.5, y: 16.5, taken: false },
            { kind: "breaker", x: 10.0, y: 10.0, taken: false },
            { kind: "battery", x: 10.0, y: 13.5, taken: false },
            { kind: "battery", x: 5.5,  y: 5.5,  taken: false },
            { kind: "battery", x: 14.5, y: 5.5,  taken: false },
            { kind: "decoy",   x: 10.0, y: 16.5, taken: false },
            { kind: "decoy",   x: 10.0, y: 3.5,  taken: false },
            { kind: "locker",  x: 6.5,  y: 10.0, faceAng: 0.0,    taken: false },
            { kind: "locker",  x: 13.5, y: 10.0, faceAng: 3.1416, taken: false },
            { kind: "locker",  x: 10.0, y: 1.5,  faceAng: 1.5708, taken: false },
            { kind: "note",    x: 10.0, y: 13.5, msgIdx: 6, taken: false },
            { kind: "note",    x: 10.0, y: 5.5,  msgIdx: 7, taken: false }
        ],
        radioTriggers: [
            { x: 10.0, y: 17.5, radius: 2.2, text: "DRA. MORALES (RADIO): Ultimo tramo. Libera el nucleo central y energiza el ascensor Norte con 4 fusibles.", duration: 250, fired: false },
            { x: 10.0, y: 10.0, radius: 2.6, text: "DRA. MORALES (RADIO): Cuidado! Aqui nacio el Sujeto 04. Es mas rapido en este sector.", duration: 240, fired: false },
            { x: 10.0, y: 2.5,  radius: 2.2, text: "DRA. MORALES (RADIO): El ascensor a la superficie esta frente a vos. No te detengas!", duration: 220, fired: false }
        ]
    }
];

let activeChapterIdx = 0;

function getActiveChapter() {
    return CHAPTERS[activeChapterIdx] || CHAPTERS[0];
}

function createWorldGrid(chapterIdx) {
    const idx = (chapterIdx !== undefined) ? chapterIdx : activeChapterIdx;
    const src = (CHAPTERS[idx] || CHAPTERS[0]).grid;
    const grid = [];
    for (let y = 0; y < MAP_H; y++) {
        grid.push(src[y].slice());
    }
    return grid;
}

function getCell(grid, gx, gy) {
    if (gx < 0 || gx >= MAP_W || gy < 0 || gy >= MAP_H) return 1;
    return grid[gy][gx];
}

function isCellBlocked(grid, gx, gy) {
    if (gx < 0 || gx >= MAP_W || gy < 0 || gy >= MAP_H) return true;
    return grid[gy][gx] !== 0;
}

// Verificación directa de las 4 esquinas del bounding box (sin crear arrays por cuadro)
function isPosWalkable(grid, nx, ny, margin = 0.25) {
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

function movePlayerAxis(grid, x, y, delta, moveX, margin = 0.25) {
    const steps = Math.max(1, Math.ceil(Math.abs(delta) / 0.10));
    const step = delta / steps;
    let moved = moveX ? x : y;
    for (let i = 0; i < steps; i++) {
        const candidate = moved + step;
        const nx = moveX ? candidate : x;
        const ny = moveX ? y : candidate;
        if (!isPosWalkable(grid, nx, ny, margin)) break;
        moved = candidate;
    }
    return moved;
}

const LORE_NOTES = [
    {
        code: "REGISTRO #01 - INGENIERIA",
        summary: "El disyuntor central abre las rejas Este y Oeste.",
        lines: [
            "14/10 - TURNO NOCHE (SUBSUELO 04)",
            "Tras el apagon se trabaron las rejas",
            "hacia los sectores Este y Oeste.",
            "El DISYUNTOR ROJO en el centro libera",
            "las trabas magneticas. Ve directo alli."
        ]
    },
    {
        code: "REGISTRO #02 - SEGURIDAD",
        summary: "Agachate [CUAD] o apaga la linterna para perder su rastro.",
        lines: [
            "INFORME DE GUARDIA - PASILLO SUR",
            "Reacciona al ruido de pisadas rapidas",
            "y al haz directo de las linternas.",
            "Agachate [CUAD] o usa un escondite [X]",
            "con la luz apagada: perdera tu rastro."
        ]
    },
    {
        code: "REGISTRO #03 - PROTOCOLO",
        summary: "Ilumina sus ojos o lanza un senuelo [L2] para desviarlo.",
        lines: [
            "OBSERVACION - COMPORTAMIENTO VISUAL",
            "Apuntar directo a sus ojos lo frena,",
            "y lanzar un SENUELO [L2] lo desvia",
            "hacia el ruido del pasillo contrario.",
            "Usalo si te bloquea un cuello de botella."
        ]
    },
    {
        code: "REGISTRO #04 - EVACUACION",
        summary: "Los 4 fusibles abren la compuerta de salida al Norte.",
        lines: [
            "ORDEN DE EMERGENCIA - SALIDA NORTE",
            "La compuerta blindada al Norte (arriba",
            "en el PDA) requiere los 4 FUSIBLES.",
            "Cuando el panel pase a VERDE, corre",
            "hacia la salida. No mires atras."
        ]
    },
    {
        code: "REGISTRO #05 - CALDERAS",
        summary: "Valdez quedo atrapado tras sellar la esclusa de mantenimiento.",
        lines: [
            "BITACORA MANTENIMIENTO - NIVEL -2",
            "Intentamos encerrar al sujeto en los",
            "tuneles de vapor, pero rompio el panel.",
            "Si encuentras a Valdez, activa la valvula",
            "central y avanza hacia Contencion."
        ]
    },
    {
        code: "REGISTRO #06 - DRA. MORALES",
        summary: "Los escondites bloquean su vision si mantienes la luz apagada.",
        lines: [
            "NOTA DE LABORATORIO - CONTROL",
            "El Sujeto 04 caza por contraste de luz",
            "y vibracion de pisadas. Los nichos de",
            "mantenimiento son seguros siempre que",
            "apagues la linterna antes de que pase."
        ]
    },
    {
        code: "REGISTRO #07 - PROYECTO 04",
        summary: "El experimento de adaptacion en oscuridad colapso el 14/10.",
        lines: [
            "ARCHIVO CONFIDENCIAL - CONTENCION",
            "El Sujeto 04 fue expuesto a aislamiento",
            "total en el subsuelo durante 90 dias.",
            "Cuando cayo la red electrica, escapo",
            "de la camara ritual hacia los pasillos."
        ]
    },
    {
        code: "REGISTRO #08 - EVACUACION FINAL",
        summary: "El ascensor de carga al Norte lleva directo a la superficie.",
        lines: [
            "PROTOCOLO FINAL - SALIDA SUPERFICIE",
            "Coloca los ultimos 4 fusibles en el",
            "pabellon y activa el ascensor Norte.",
            "Una vez arriba, el Subsuelo 04 quedara",
            "sellado permanentemente."
        ]
    }
];

const LORE_MESSAGES = LORE_NOTES.map(n => [n.code, ": ", n.summary].join(""));
