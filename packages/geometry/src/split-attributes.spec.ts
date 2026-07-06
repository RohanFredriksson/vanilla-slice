import { describe, it, expect } from 'vitest';
import { createPlane, fromNormalAndPoint } from './plane';
import { createBox } from './primitives';
import { createMesh, triangleCount } from './mesh';
import type { Mesh } from './mesh';
import { splitMeshByPlane } from './split';

/** A unit box whose `tex3` equals its positions and whose UVs are stubbed. */
function texturedBox(): Mesh {
  const box = createBox();
  const uvs: number[] = [];
  for (let i = 0; i < box.positions.length / 3; i++) {
    uvs.push(0, 0);
  }
  return createMesh(box.positions.slice(), box.indices.slice(), {
    uvs,
    tex3: box.positions.slice(),
  });
}

/** Collect the UV pairs of a mesh as `[u, v]` tuples. */
function uvPairs(mesh: Mesh): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const uvs = mesh.uvs ?? [];
  for (let i = 0; i < uvs.length; i += 2) {
    out.push([uvs[i]!, uvs[i + 1]!]);
  }
  return out;
}

describe('splitMeshByPlane — attribute channels (ADR 0010)', () => {
  it('emits parallel uv/tex3/groups arrays for a textured cut', () => {
    const plane = fromNormalAndPoint(createPlane(), [1, 0, 0], [0, 0, 0]);
    const { front } = splitMeshByPlane(texturedBox(), plane);

    const verts = front!.positions.length / 3;
    const tris = triangleCount(front!);
    expect(front!.uvs).toBeDefined();
    expect(front!.uvs!.length).toBe(verts * 2);
    expect(front!.tex3).toBeDefined();
    expect(front!.tex3!.length).toBe(verts * 3);
    expect(front!.groups).toBeDefined();
    expect(front!.groups!.length).toBe(tris);
  });

  it('tags exterior faces group 0 and cap faces group 1', () => {
    const plane = fromNormalAndPoint(createPlane(), [1, 0, 0], [0, 0, 0]);
    const { front } = splitMeshByPlane(texturedBox(), plane);

    const groups = front!.groups!;
    expect(groups).toContain(0);
    expect(groups).toContain(1);
    // Every face is either exterior (0) or interior (1).
    expect(groups.every((g) => g === 0 || g === 1)).toBe(true);
  });

  it('interpolates UVs at the cut boundary', () => {
    // A single triangle straddling x = 0, UVs varying linearly with position.
    const mesh = createMesh(
      [-1, -1, 0, 1, -1, 0, 1, 1, 0],
      [0, 1, 2],
      { uvs: [0, 0, 1, 0, 1, 1] },
    );
    const plane = fromNormalAndPoint(createPlane(), [1, 0, 0], [0, 0, 0]);
    const { front } = splitMeshByPlane(mesh, plane, { cap: false });

    const pairs = uvPairs(front!);
    // Edge (-1,-1)->(1,-1) crosses x=0 at its midpoint → uv (0.5, 0).
    // Edge (1,1)->(-1,-1) crosses x=0 at its midpoint → uv (0.5, 0.5).
    const near = (a: [number, number], b: [number, number]) =>
      Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
    expect(pairs.some((p) => near(p, [0.5, 0]))).toBe(true);
    expect(pairs.some((p) => near(p, [0.5, 0.5]))).toBe(true);
  });

  it('maps cap tex3 through capToMaterialSpace', () => {
    const plane = fromNormalAndPoint(createPlane(), [1, 0, 0], [0, 0, 0]);
    // Column-major translation by +10 on x: tex3 = worldPoint + [10, 0, 0].
    const toMaterial: number[] = [
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 0, 0, 1,
    ];
    const { front } = splitMeshByPlane(texturedBox(), plane, {
      capToMaterialSpace: toMaterial,
    });

    const groups = front!.groups!;
    const positions = front!.positions;
    const tex3 = front!.tex3!;
    let checkedInterior = false;
    for (let t = 0; t < groups.length; t++) {
      if (groups[t] !== 1) continue;
      checkedInterior = true;
      for (let k = 0; k < 3; k++) {
        const v = front!.indices[t * 3 + k]!;
        expect(tex3[v * 3]!).toBeCloseTo(positions[v * 3]! + 10, 6);
        expect(tex3[v * 3 + 1]!).toBeCloseTo(positions[v * 3 + 1]!, 6);
        expect(tex3[v * 3 + 2]!).toBeCloseTo(positions[v * 3 + 2]!, 6);
      }
    }
    expect(checkedInterior).toBe(true);
  });

  it('falls back to positions-only when the source has no attributes', () => {
    const plane = fromNormalAndPoint(createPlane(), [1, 0, 0], [0, 0, 0]);

    // With a cap, groups are still emitted (the cut introduces an interior slot),
    // but uv/tex3 stay absent since the source supplied none.
    const capped = splitMeshByPlane(createBox(), plane, { cap: true });
    expect(capped.front!.uvs).toBeUndefined();
    expect(capped.front!.tex3).toBeUndefined();
    expect(capped.front!.groups).toBeDefined();
    expect(capped.front!.groups).toContain(1);

    // Without a cap and without source groups, the mesh stays positions-only.
    const uncapped = splitMeshByPlane(createBox(), plane, { cap: false });
    expect(uncapped.front!.uvs).toBeUndefined();
    expect(uncapped.front!.tex3).toBeUndefined();
    expect(uncapped.front!.groups).toBeUndefined();
  });

  it('preserves a re-cut interior face as interior (group 1)', () => {
    const plane1 = fromNormalAndPoint(createPlane(), [1, 0, 0], [0, 0, 0]);
    const half = splitMeshByPlane(texturedBox(), plane1).front!;
    expect(half.groups).toContain(1);

    // Cut the half again on a different axis; original interior faces that
    // survive must keep group 1, and the new cap adds more group-1 faces.
    const plane2 = fromNormalAndPoint(createPlane(), [0, 1, 0], [0, 0, 0]);
    const quarter = splitMeshByPlane(half, plane2).front!;
    expect(quarter.groups).toContain(0);
    expect(quarter.groups).toContain(1);
  });
});
