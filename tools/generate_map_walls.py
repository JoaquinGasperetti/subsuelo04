"""Regenerate the 3D wall surfaces from BASE_MAP in main.js.

Only faces bordering walkable cells are emitted. This avoids coplanar internal
faces between adjacent wall cells, which can flicker on the PS2 GS, and keeps the
3D wall layout tied to the map used by the PDA and collision code.
"""

import ast
import re
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MAP_SOURCE = ROOT / "main.js"
OUTPUTS = {
    1: ROOT / "assets/models/map_walls_concrete.obj",
    2: ROOT / "assets/models/map_walls_rust.obj",
    3: ROOT / "assets/models/map_walls_ritual.obj",
}
CELL_SIZE = 2.0
WALL_HEIGHT = 2.6


def read_base_map():
    source = MAP_SOURCE.read_text(encoding="utf-8")
    match = re.search(r"const BASE_MAP = (\[.*?\]);", source, re.S)
    if not match:
        raise RuntimeError("No se encontro BASE_MAP en main.js")
    grid = ast.literal_eval(match.group(1))
    if not grid or any(len(row) != len(grid[0]) for row in grid):
        raise RuntimeError("BASE_MAP debe ser rectangular y no estar vacio")
    return grid


def exposed_runs(grid):
    """Return merged runs keyed by (wall type, direction, plane index)."""
    edges = defaultdict(set)
    height = len(grid)
    width = len(grid[0])

    for gy, row in enumerate(grid):
        for gx, wall_type in enumerate(row):
            if wall_type not in OUTPUTS:
                continue
            # direction, neighbour cell, plane index, segment index
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
    if direction == "west":  # -X
        return [(p, 0, a), (p, 0, b), (p, h, b), (p, h, a)], ( -1, 0, 0)
    if direction == "east":  # +X
        return [(p, 0, b), (p, 0, a), (p, h, a), (p, h, b)], (1, 0, 0)
    if direction == "north":  # -Z
        return [(b, 0, p), (a, 0, p), (a, h, p), (b, h, p)], (0, 0, -1)
    return [(a, 0, p), (b, 0, p), (b, h, p), (a, h, p)], (0, 0, 1)


def write_obj(path, wall_type, runs):
    quads = runs.get(wall_type, [])
    lines = [
        f"# Generated from main.js BASE_MAP; wall type {wall_type}; do not edit by hand."
    ]
    for direction, plane, start, end in quads:
        verts, _ = quad_vertices(direction, plane, start, end)
        lines.extend("v %.4f %.4f %.4f" % v for v in verts)
    for direction, _, start, end in quads:
        length = end - start
        lines.extend((f"vt 0.0000 0.0000", f"vt {length:.4f} 0.0000", f"vt {length:.4f} 1.0000", f"vt 0.0000 1.0000"))
    for direction, plane, start, end in quads:
        _, normal = quad_vertices(direction, plane, start, end)
        lines.append("vn %.1f %.1f %.1f" % normal)
    for index in range(len(quads)):
        base = index * 4 + 1
        lines.append(f"f {base}/{base}/{index + 1} {base + 1}/{base + 1}/{index + 1} {base + 2}/{base + 2}/{index + 1}")
        lines.append(f"f {base}/{base}/{index + 1} {base + 2}/{base + 2}/{index + 1} {base + 3}/{base + 3}/{index + 1}")
    path.write_text("\n".join(lines) + "\n", encoding="ascii", newline="\n")


def main():
    grid = read_base_map()
    runs = exposed_runs(grid)
    for wall_type, path in OUTPUTS.items():
        write_obj(path, wall_type, runs)
        print(f"{path.relative_to(ROOT)}: {len(runs.get(wall_type, []))} quads")


if __name__ == "__main__":
    main()
