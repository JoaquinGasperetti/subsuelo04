"""Regenerate 3D map meshes (walls, gates, exit, floor, ceiling) for all chapters
defined in src/map.js (or main.js).

Only faces bordering walkable cells (0) are emitted to avoid coplanar internal
faces that cause Z-fighting on the PS2 GS, while keeping every chapter well
within the PS2 VU1 triangle budget.
"""

import ast
import re
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SRC_MAP = ROOT / "src/map.js"
FALLBACK_MAP = ROOT / "main.js"
MODELS_DIR = ROOT / "assets/models"

CELL_SIZE = 2.0
WALL_HEIGHT = 2.6

CHAPTER_DEFS = [
    ("BASE_MAP", "map_", False),  # Cap 1: conserva map_floor.obj / map_ceiling.obj originales
    ("CH2_MAP",  "ch2_", True),   # Cap 2: genera muros, rejas, salida, piso y techo
    ("CH3_MAP",  "ch3_", True),   # Cap 3: genera muros, rejas, salida, piso y techo
]

WALL_FILES = {
    1: "walls_concrete.obj",
    2: "walls_rust.obj",
    3: "walls_ritual.obj",
    4: "exit.obj",
    5: "gates.obj",
}


def read_map_array(source: str, var_name: str):
    match = re.search(rf"const\s+{var_name}\s*=\s*(\[.*?\]);", source, re.S)
    if not match:
        raise RuntimeError(f"No se encontro {var_name}")
    grid = ast.literal_eval(match.group(1))
    if not grid or any(len(row) != len(grid[0]) for row in grid):
        raise RuntimeError(f"{var_name} debe ser rectangular y no estar vacio")
    return grid


def exposed_runs(grid):
    """Return merged runs keyed by (wall type, direction, plane index)."""
    edges = defaultdict(set)
    height = len(grid)
    width = len(grid[0])

    for gy, row in enumerate(grid):
        for gx, wall_type in enumerate(row):
            if wall_type not in WALL_FILES:
                continue
            sides = (
                ("west", gx - 1, gy, gx, gy),
                ("east", gx + 1, gy, gx + 1, gy),
                ("north", gx, gy - 1, gy, gx),
                ("south", gx, gy + 1, gy + 1, gx),
            )
            for direction, nx, ny, plane, segment in sides:
                if not (0 <= nx < width and 0 <= ny < height):
                    continue
                if grid[ny][nx] != 0:
                    continue
                edges[(wall_type, direction, plane)].add(segment)

    runs = defaultdict(list)
    for (wall_type, direction, plane), segments in edges.items():
        ordered = sorted(segments)
        if not ordered:
            continue
        start = previous = ordered[0]
        for segment in ordered[1:] + [None]:
            if segment is not None and segment == previous + 1:
                previous = segment
                continue
            runs[wall_type].append((direction, plane, start, previous + 1))
            if segment is not None:
                start = previous = segment
    return runs


def quad_vertices(direction, plane, start, end):
    p = plane * CELL_SIZE
    a = start * CELL_SIZE
    b = end * CELL_SIZE
    h = WALL_HEIGHT
    if direction == "west":
        return [(p, 0, a), (p, 0, b), (p, h, b), (p, h, a)], (-1, 0, 0)
    if direction == "east":
        return [(p, 0, b), (p, 0, a), (p, h, a), (p, h, b)], (1, 0, 0)
    if direction == "north":
        return [(b, 0, p), (a, 0, p), (a, h, p), (b, h, p)], (0, 0, -1)
    return [(a, 0, p), (b, 0, p), (b, h, p), (a, h, p)], (0, 0, 1)


def write_wall_obj(path: Path, var_name: str, wall_type: int, runs):
    quads = runs.get(wall_type, [])
    lines = [f"# Generated from {var_name}; wall type {wall_type}; do not edit by hand."]
    for direction, plane, start, end in quads:
        verts, _ = quad_vertices(direction, plane, start, end)
        lines.extend("v %.4f %.4f %.4f" % v for v in verts)
    for _, _, start, end in quads:
        length = end - start
        lines.extend(("vt 0.0000 0.0000", f"vt {length:.4f} 0.0000", f"vt {length:.4f} 1.0000", "vt 0.0000 1.0000"))
    for direction, plane, start, end in quads:
        _, normal = quad_vertices(direction, plane, start, end)
        lines.append("vn %.1f %.1f %.1f" % normal)
    for index in range(len(quads)):
        base = index * 4 + 1
        lines.append(f"f {base}/{base}/{index + 1} {base + 1}/{base + 1}/{index + 1} {base + 2}/{base + 2}/{index + 1}")
        lines.append(f"f {base}/{base}/{index + 1} {base + 2}/{base + 2}/{index + 1} {base + 3}/{base + 3}/{index + 1}")
    path.write_text("\n".join(lines) + "\n", encoding="ascii", newline="\n")
    return len(quads) * 2


def write_horizontal_slab_obj(path: Path, var_name: str, grid, y_level: float, is_ceiling: bool):
    """Merge horizontal walkable runs (0) per row into minimal floor/ceiling quads."""
    quads = []
    for gy, row in enumerate(grid):
        gx = 0
        w = len(row)
        while gx < w:
            if row[gx] != 0:
                gx += 1
                continue
            start = gx
            while gx < w and row[gx] == 0:
                gx += 1
            quads.append((gy, start, gx))

    lines = [f"# Generated from {var_name}; {'ceiling' if is_ceiling else 'floor'}; do not edit by hand."]
    normal = (0, -1, 0) if is_ceiling else (0, 1, 0)
    for gy, x0, x1 in quads:
        ax, bx = x0 * CELL_SIZE, x1 * CELL_SIZE
        az, bz = gy * CELL_SIZE, (gy + 1) * CELL_SIZE
        if is_ceiling:
            verts = [(ax, y_level, az), (bx, y_level, az), (bx, y_level, bz), (ax, y_level, bz)]
        else:
            verts = [(ax, y_level, bz), (bx, y_level, bz), (bx, y_level, az), (ax, y_level, az)]
        lines.extend("v %.4f %.4f %.4f" % v for v in verts)
    for _, x0, x1 in quads:
        length = x1 - x0
        lines.extend(("vt 0.0000 0.0000", f"vt {length:.4f} 0.0000", f"vt {length:.4f} 1.0000", "vt 0.0000 1.0000"))
    lines.append("vn %.1f %.1f %.1f" % normal)
    for index in range(len(quads)):
        base = index * 4 + 1
        lines.append(f"f {base}/{base}/1 {base + 1}/{base + 1}/1 {base + 2}/{base + 2}/1")
        lines.append(f"f {base}/{base}/1 {base + 2}/{base + 2}/1 {base + 3}/{base + 3}/1")
    path.write_text("\n".join(lines) + "\n", encoding="ascii", newline="\n")
    return len(quads) * 2


def main():
    src_path = SRC_MAP if SRC_MAP.is_file() else FALLBACK_MAP
    source = src_path.read_text(encoding="utf-8")
    for var_name, prefix, gen_slabs in CHAPTER_DEFS:
        grid = read_map_array(source, var_name)
        runs = exposed_runs(grid)
        total_tris = 0
        for wall_type, suffix in WALL_FILES.items():
            # En Cap 1 preservamos map_exit.obj y map_gates.obj si ya existen; regeneramos muros 1..3
            out_path = MODELS_DIR / f"{prefix}{suffix}"
            if prefix == "map_" and wall_type in (4, 5) and out_path.is_file():
                continue
            tris = write_wall_obj(out_path, var_name, wall_type, runs)
            total_tris += tris
            print(f"{out_path.relative_to(ROOT)}: {tris} tris")
        if gen_slabs:
            t_fl = write_horizontal_slab_obj(MODELS_DIR / f"{prefix}floor.obj", var_name, grid, 0.0, False)
            t_cl = write_horizontal_slab_obj(MODELS_DIR / f"{prefix}ceiling.obj", var_name, grid, WALL_HEIGHT, True)
            total_tris += t_fl + t_cl
            print(f"{prefix}floor.obj: {t_fl} tris | {prefix}ceiling.obj: {t_cl} tris")
        print(f"==> {var_name} ({prefix}*) total generado: {total_tris} tris\n")


if __name__ == "__main__":
    main()
