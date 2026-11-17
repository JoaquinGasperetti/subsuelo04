// Configuración de efectos de cámara, overlays y vibración DualShock 2
export const ENABLE_BOB      = true; // balanceo/vaivén de cámara al caminar
export const ENABLE_OVERLAYS = true; // rectángulos translúcidos a pantalla completa (flash de pickup, viñeta, cansancio, barra de peligro)
export const ENABLE_RUMBLE   = true; // vibración del DualShock 2

// En el fork de QuickJS de AthenaEnv V4 (src/quickjs/quickjs.c):
// 1) Sumar INT + FLOAT64 con "+" o "+=" entra en js_add_slow y convierte el resultado en
//    JS_CUSTOM_TAG_FLOAT32 (tag 7), mientras que el otro eje permanece en JS_TAG_FLOAT64 (tag 8).
// 2) En js_relational_slow (<, <=, >, >=), cuando un operando es FLOAT32 y el otro es FLOAT64,
//    ambos filtros rápidos fallan y cae en float64_compare, donde lee el FLOAT32 mediante
//    JS_VALUE_GET_INT (~1.06e9). Así, `sideDistX < sideDistY` evalúa siempre a `false` en el DDA
//    y todas las paredes verticales (side = 0) desaparecen al mover al jugador.
// Estas utilidades fuerzan OP_neg + OP_sub (__JS_NewFloat64), evitando que se creen valores FLOAT32.
export const F64_ZERO = -0.0;

export function toF64(v) {
    return Math.min(v) - F64_ZERO;
}

export function fadd(a, b) {
    return a - (-b);
}
