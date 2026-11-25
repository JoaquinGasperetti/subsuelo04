#!/usr/bin/env python3
"""
build_main.py — Compila los módulos de src/ definidos en tools/modules.json en un único
main.js compatible con QuickJS / AthenaEnv V4 en PS2 (mass:/, cdfs:/, host:/).

Uso (desde la raíz del repositorio subsuelo04):
    python3 tools/build_main.py            # Reconstruye main.js
    python3 tools/build_main.py --check    # Verifica si main.js está sincronizado (exit 0/1)
    python3 tools/build_main.py --watch    # Reconstruye automáticamente al guardar cambios en src/
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from pathlib import Path


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_manifest(manifest_path: Path) -> dict:
    if not manifest_path.is_file():
        raise FileNotFoundError(
            f"No se encontró {manifest_path}. Ejecutá primero `python3 tools/split_main.py`."
        )
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def assemble_bundle(repo_root: Path, manifest: dict) -> tuple[bytes, int]:
    parts: list[str] = []
    modules = manifest.get("modules", [])
    if not modules:
        raise ValueError("El manifiesto no contiene módulos en la clave 'modules'.")

    for entry in modules:
        rel_path = entry["path"]
        marker = entry.get("marker")
        mod_path = repo_root / rel_path
        if not mod_path.is_file():
            raise FileNotFoundError(f"Falta el módulo declarado en el manifiesto: {rel_path}")
        if marker:
            parts.append(str(marker))
        parts.append(mod_path.read_bytes().decode("utf-8"))

    bundle_bytes = "".join(parts).encode("utf-8")
    return bundle_bytes, len(modules)


def run_build(repo_root: Path, manifest_path: Path, check_only: bool) -> int:
    manifest = load_manifest(manifest_path)
    out_rel = manifest.get("output", "main.js")
    out_path = repo_root / out_rel

    bundle_bytes, mod_count = assemble_bundle(repo_root, manifest)
    new_hash = sha256_bytes(bundle_bytes)
    new_lines = bundle_bytes.count(b"\n") + (1 if bundle_bytes and not bundle_bytes.endswith(b"\n") else 0)

    if check_only:
        if not out_path.is_file():
            print(f"[DESINCRONIZADO] No existe {out_rel}. Ejecutá `python3 tools/build_main.py`.", file=sys.stderr)
            return 1
        current_bytes = out_path.read_bytes()
        if current_bytes == bundle_bytes:
            print(f"[OK] {out_rel} está 100% sincronizado con {mod_count} módulos ({new_lines:,} líneas, SHA-256: {new_hash[:16]}...).")
            return 0
        print(
            f"[DESINCRONIZADO] {out_rel} difiere de los módulos en src/ "
            f"(actual: {len(current_bytes):,} B vs build: {len(bundle_bytes):,} B). "
            "Ejecutá `python3 tools/build_main.py`.",
            file=sys.stderr,
        )
        return 1

    changed = True
    if out_path.is_file() and out_path.read_bytes() == bundle_bytes:
        changed = False

    if changed:
        out_path.write_bytes(bundle_bytes)
        print(f"[OK] Generado {out_rel} desde {mod_count} módulos ({new_lines:,} líneas, {len(bundle_bytes):,} bytes, SHA-256: {new_hash[:16]}...).")
    else:
        print(f"[SIN CAMBIOS] {out_rel} ya está al día ({new_lines:,} líneas, SHA-256: {new_hash[:16]}...).")
    return 0


def watch_loop(repo_root: Path, manifest_path: Path, interval: float) -> int:
    print(f"[WATCH] Monitoreando módulos declarados en {manifest_path.relative_to(repo_root).as_posix()} (Ctrl+C para salir)...")
    last_mtimes: dict[Path, int] = {}

    def snapshot() -> dict[Path, int]:
        manifest = load_manifest(manifest_path)
        files = [manifest_path] + [repo_root / e["path"] for e in manifest.get("modules", [])]
        return {p: p.stat().st_mtime_ns for p in files if p.exists()}

    try:
        run_build(repo_root, manifest_path, check_only=False)
        last_mtimes = snapshot()
        while True:
            time.sleep(interval)
            current = snapshot()
            if current != last_mtimes:
                try:
                    run_build(repo_root, manifest_path, check_only=False)
                except Exception as exc:
                    print(f"[ERROR] {exc}", file=sys.stderr)
                last_mtimes = current
    except KeyboardInterrupt:
        print("\n[WATCH] Detenido.")
        return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Concatena los módulos de src/ en main.js según tools/modules.json."
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parent.parent,
        help="Ruta raíz del repositorio (por defecto, el directorio padre de tools/).",
    )
    parser.add_argument(
        "--manifest",
        default="tools/modules.json",
        help="Ruta del manifiesto JSON relativo a --root.",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Solo verifica si main.js coincide byte a byte con src/ (no escribe).",
    )
    parser.add_argument(
        "--watch",
        action="store_true",
        help="Recompila main.js automáticamente cuando cambian archivos en src/.",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=0.75,
        help="Intervalo de polling en segundos para --watch (por defecto: 0.75).",
    )
    args = parser.parse_args()

    repo_root = args.root.resolve()
    manifest_path = repo_root / args.manifest

    try:
        if args.watch:
            return watch_loop(repo_root, manifest_path, args.interval)
        return run_build(repo_root, manifest_path, check_only=args.check)
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
