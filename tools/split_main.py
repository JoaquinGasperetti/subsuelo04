#!/usr/bin/env python3
"""
split_main.py — Divide el monolito main.js de Subsuelo 04 en módulos reales bajo src/
a partir de los marcadores `// --- MODULE: <ruta> ---`, generando tools/modules.json
y verificando paridad byte a byte al reconstruir.

Uso (desde la raíz del repositorio subsuelo04):
    python3 tools/split_main.py
    python3 tools/split_main.py --dry-run
    python3 tools/split_main.py --force
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

MODULE_MARKER_RE = re.compile(
    r"^[ \t]*//[ \t]*---[ \t]*MODULE:[ \t]*(.+?)[ \t]*---[ \t]*\r?\n?$"
)


def detect_newline(raw: bytes) -> str:
    return "\r\n" if b"\r\n" in raw else "\n"


def parse_main_js(text: str) -> tuple[str | None, list[dict[str, str]]]:
    """Devuelve (preámbulo_opcional, lista_de_módulos) preservando saltos de línea exactos."""
    lines = text.splitlines(keepends=True)
    preamble_lines: list[str] = []
    modules: list[dict[str, str]] = []
    current_path: str | None = None
    current_marker: str | None = None
    current_lines: list[str] = []

    for line in lines:
        match = MODULE_MARKER_RE.match(line)
        if match:
            if current_path is not None:
                modules.append(
                    {
                        "path": current_path,
                        "marker": current_marker or "",
                        "content": "".join(current_lines),
                    }
                )
            raw_path = match.group(1).strip().replace("\\", "/")
            if raw_path.startswith("./"):
                raw_path = raw_path[2:]
            current_path = raw_path
            current_marker = line
            current_lines = []
        else:
            if current_path is None:
                preamble_lines.append(line)
            else:
                current_lines.append(line)

    if current_path is not None:
        modules.append(
            {
                "path": current_path,
                "marker": current_marker or "",
                "content": "".join(current_lines),
            }
        )

    preamble = "".join(preamble_lines) if preamble_lines else None
    return preamble, modules


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Divide main.js en módulos separados según los marcadores // --- MODULE: ... ---."
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parent.parent,
        help="Ruta raíz del repositorio (por defecto, el directorio padre de tools/).",
    )
    parser.add_argument(
        "--input",
        default="main.js",
        help="Archivo monolítico de entrada relativo a --root (por defecto: main.js).",
    )
    parser.add_argument(
        "--manifest",
        default="tools/modules.json",
        help="Ruta del manifiesto JSON a generar relativo a --root.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Muestra los módulos detectados sin escribir archivos en disco.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Sobrescribe archivos existentes en src/ y el manifiesto sin preguntar.",
    )
    args = parser.parse_args()

    repo_root: Path = args.root.resolve()
    main_path = repo_root / args.input
    manifest_path = repo_root / args.manifest

    if not main_path.is_file():
        print(f"[ERROR] No se encontró {main_path}. Ejecutá este script desde la raíz del repo.", file=sys.stderr)
        return 1

    raw_bytes = main_path.read_bytes()
    newline = detect_newline(raw_bytes)
    text = raw_bytes.decode("utf-8")

    preamble, modules = parse_main_js(text)
    if not modules:
        print(
            "[ERROR] No se detectaron marcadores `// --- MODULE: src/... ---` en main.js.",
            file=sys.stderr,
        )
        return 1

    entries: list[dict[str, object]] = []
    files_to_write: list[tuple[Path, str]] = []
    seen_paths: set[str] = set()

    if preamble is not None:
        preamble_rel = "src/_preamble.js"
        entries.append({"path": preamble_rel, "marker": None})
        files_to_write.append((repo_root / preamble_rel, preamble))
        seen_paths.add(preamble_rel)

    for mod in modules:
        rel_path = mod["path"]
        if rel_path == args.input:
            rel_path = f"src/{Path(rel_path).name}"
        if rel_path in seen_paths:
            stem = Path(rel_path).stem
            suffix = Path(rel_path).suffix or ".js"
            parent = Path(rel_path).parent
            idx = 2
            while True:
                candidate = str((parent / f"{stem}_{idx}{suffix}").as_posix())
                if candidate not in seen_paths:
                    rel_path = candidate
                    break
                idx += 1
        seen_paths.add(rel_path)
        entries.append({"path": rel_path, "marker": mod["marker"]})
        files_to_write.append((repo_root / rel_path, mod["content"]))

    # Verificación de reconstrucción byte a byte en memoria antes de escribir nada
    rebuilt_parts: list[str] = []
    for entry, (_, content) in zip(entries, files_to_write):
        marker = entry["marker"]
        if marker:
            rebuilt_parts.append(str(marker))
        rebuilt_parts.append(content)
    rebuilt_bytes = "".join(rebuilt_parts).encode("utf-8")

    if rebuilt_bytes != raw_bytes:
        print(
            "[ERROR] La verificación interna de paridad byte a byte falló. No se escribió ningún archivo.",
            file=sys.stderr,
        )
        return 1

    print(f"Detectados {len(modules)} módulos en {args.input} (newline={repr(newline)}, {len(raw_bytes):,} bytes):")
    for target_path, content in files_to_write:
        rel = target_path.relative_to(repo_root).as_posix()
        line_count = len(content.splitlines())
        print(f"  - {rel:<38} {line_count:>5} líneas  ({len(content.encode('utf-8')):>7,} bytes)")

    if args.dry_run:
        print("\n[DRY-RUN] Paridad byte a byte verificada (SHA-256 idéntico). Sin cambios en disco.")
        return 0

    existing = [p for p, _ in files_to_write if p.exists()]
    if manifest_path.exists():
        existing.append(manifest_path)
    if existing and not args.force:
        print(
            "\n[ABORTADO] Ya existen archivos de destino (usá --force para sobrescribir):",
            file=sys.stderr,
        )
        for p in existing[:10]:
            print(f"  * {p.relative_to(repo_root).as_posix()}", file=sys.stderr)
        return 2

    for target_path, content in files_to_write:
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_bytes(content.encode("utf-8"))

    manifest_data = {
        "output": args.input,
        "newline": newline,
        "source_sha256": sha256_bytes(raw_bytes),
        "modules": entries,
    }
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(
        json.dumps(manifest_data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print(f"\n[OK] Escritos {len(files_to_write)} archivos en src/ y manifiesto en {args.manifest}.")
    print(f"[OK] Paridad verificada byte a byte (SHA-256: {sha256_bytes(raw_bytes)[:16]}...).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
