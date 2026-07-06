import { describe, it, expect } from 'vitest';
import { createBox, createMesh } from '@vanilla-slice/geometry';
import type { Mesh } from '@vanilla-slice/geometry';
import { fractureMesh } from './voronoi';

/** A unit box carrying UVs and a rest-pose `tex3` equal to its local positions. */
function texturedBox(): Mesh {
  const box = createBox();
  const uvs: number[] = [];
  for (let i = 0; i < box.positions.length / 3; i++) uvs.push(0, 0);
  return createMesh(box.positions.slice(), box.indices.slice(), {
    uvs,
    tex3: box.positions.slice(),
  });
}

/** Unique `tex3` points of a mesh, quantized to a grid for set comparison. */
function tex3Keys(mesh: Mesh): Set<string> {
  const keys = new Set<string>();
  const t = mesh.tex3 ?? [];
  for (let i = 0; i < t.length; i += 3) {
    const q = (v: number) => Math.round(v * 1e5) / 1e5;
    keys.add(`${q(t[i]!)},${q(t[i + 1]!)},${q(t[i + 2]!)}`);
  }
  return keys;
}

describe('fractureMesh — tex3 attributes (ADR 0010, P7)', () => {
  it('carries tex3 onto every fragment, in model space (identity mapping)', () => {
    const frags = fractureMesh(texturedBox(), {
      seeds: [
        [-0.25, 0, 0],
        [0.25, 0, 0],
      ],
      cap: true,
    });
    expect(frags).toHaveLength(2);

    for (const frag of frags) {
      const mesh = frag.mesh;
      expect(mesh.tex3).toBeDefined();
      expect(mesh.tex3!.length).toBe(mesh.positions.length);
      expect(mesh.groups).toContain(1); // interior cell face present
      // The mesh sits at the origin and no capToMaterialSpace was given, so the
      // rest-pose coordinate equals the (world == model) position everywhere —
      // exterior faces inherit it, cap faces fall back to the world point.
      for (let i = 0; i < mesh.positions.length; i++) {
        expect(mesh.tex3![i]!).toBeCloseTo(mesh.positions[i]!, 6);
      }
    }
  });

  it('keeps tex3 continuous across the shared face of adjacent cells', () => {
    const frags = fractureMesh(texturedBox(), {
      seeds: [
        [-0.25, 0, 0],
        [0.25, 0, 0],
      ],
      cap: true,
    });
    // The two cells meet on the x = 0 plane; their cut faces are triangulated
    // from the same boundary polygon, so the shared boundary tex3 points must
    // coincide — a reassembly would line the wood grain back up.
    const a = tex3Keys(frags[0]!.mesh);
    const b = tex3Keys(frags[1]!.mesh);
    let shared = 0;
    for (const key of a) if (b.has(key)) shared++;
    expect(shared).toBeGreaterThanOrEqual(4); // the 4 corners of the cut square
  });
});
