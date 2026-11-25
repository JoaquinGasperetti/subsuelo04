# Flujo modular para `main.js` (Subsuelo 04 — HK Engine 1)

Estos scripts en Python 3 (sin dependencias externas, igual que `tools/generate_map_walls.py`) permiten editar el motor en módulos separados bajo `src/` y seguir generando el `main.js` monolítico sin `import`/`export` ES6 que requiere PlayStation 2 (`mass:/`, `cdfs:/`, `host:/`).

## 1. Migración inicial (una sola vez)

Descomprimí la carpeta `tools/` en la raíz de tu clon local de `subsuelo04` y ejecutá:

```bash
python3 tools/split_main.py
python3 tools/build_main.py --check
```

- `tools/split_main.py` lee los marcadores `// --- MODULE: src/... ---` de `main.js`, crea cada archivo en `src/`, guarda el orden exacto en `tools/modules.json` y verifica **paridad byte a byte** antes de escribir nada.
- `tools/build_main.py --check` confirma que el `main.js` reconstruido tiene el mismo SHA-256 que el original.

## 2. Flujo diario de desarrollo

Editá los archivos en `src/` y recompilá `main.js` antes de probar en PCSX2 o copiar al pendrive USB de OPL:

```bash
python3 tools/build_main.py
```

O dejalo corriendo en segundo plano mientras editás:

```bash
python3 tools/build_main.py --watch
```

Si agregás un módulo nuevo en `src/`, sumá una entrada `{"path": "src/nuevo.js", "marker": "// --- MODULE: src/nuevo.js ---\n"}` en el lugar correspondiente de `tools/modules.json` y volvé a ejecutar `python3 tools/build_main.py`.
