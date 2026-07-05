import { createMesh } from './mesh';
import type { Mesh } from './mesh';

/**
 * Create an axis-aligned box centered at the origin with outward-facing,
 * counter-clockwise winding. Uses 8 shared vertices and 12 triangles.
 */
export function createBox(width = 1, height = 1, depth = 1): Mesh {
  const x = width / 2;
  const y = height / 2;
  const z = depth / 2;

  const positions = [
    -x, -y, -z, // 0
    x, -y, -z, //  1
    x, y, -z, //   2
    -x, y, -z, //  3
    -x, -y, z, //  4
    x, -y, z, //   5
    x, y, z, //    6
    -x, y, z, //   7
  ];

  const indices = [
    4, 5, 6, 4, 6, 7, // +Z (front)
    0, 3, 2, 0, 2, 1, // -Z (back)
    1, 2, 6, 1, 6, 5, // +X (right)
    0, 4, 7, 0, 7, 3, // -X (left)
    3, 7, 6, 3, 6, 2, // +Y (top)
    0, 1, 5, 0, 5, 4, // -Y (bottom)
  ];

  return createMesh(positions, indices);
}
