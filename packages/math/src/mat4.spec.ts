import { describe, it, expect } from 'vitest';
import * as Mat4 from './mat4';
import * as Quat from './quat';
import * as Vec3 from './vec3';

describe('Mat4', () => {
  it('creates identity', () => {
    expect(Mat4.create()).toEqual([
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
    ]);
  });

  it('multiplying by identity is a no-op', () => {
    const m = Mat4.fromTranslation(Mat4.create(), [1, 2, 3]);
    const id = Mat4.create();
    const out = Mat4.create();
    expect(Mat4.equals(Mat4.multiply(out, m, id), m)).toBe(true);
    expect(Mat4.equals(Mat4.multiply(out, id, m), m)).toBe(true);
  });

  it('builds translation and transforms a point', () => {
    const m = Mat4.fromTranslation(Mat4.create(), [10, 20, 30]);
    const p = Vec3.transformMat4(Vec3.create(), [1, 2, 3], m);
    expect(p).toEqual([11, 22, 33]);
    expect(Mat4.getTranslation(Vec3.create(), m)).toEqual([10, 20, 30]);
  });

  it('builds scaling and transforms a point', () => {
    const m = Mat4.fromScaling(Mat4.create(), [2, 3, 4]);
    const p = Vec3.transformMat4(Vec3.create(), [1, 1, 1], m);
    expect(p).toEqual([2, 3, 4]);
  });

  it('invert(m) * m = identity', () => {
    const m = Mat4.fromRotationTranslationScale(
      Mat4.create(),
      Quat.setAxisAngle(Quat.create(), [0, 1, 0], Math.PI / 3),
      [5, -2, 7],
      [2, 2, 2],
    );
    const inv = Mat4.invert(Mat4.create(), m);
    expect(inv).not.toBeNull();
    const product = Mat4.multiply(Mat4.create(), m, inv!);
    expect(Mat4.equals(product, Mat4.create())).toBe(true);
  });

  it('returns null when inverting a singular matrix', () => {
    const singular = Mat4.fromScaling(Mat4.create(), [0, 1, 1]);
    expect(Mat4.invert(Mat4.create(), singular)).toBeNull();
  });

  it('transpose is an involution', () => {
    const m = Mat4.fromTranslation(Mat4.create(), [1, 2, 3]);
    const t = Mat4.transpose(Mat4.create(), m);
    const tt = Mat4.transpose(Mat4.create(), t);
    expect(Mat4.equals(tt, m)).toBe(true);
  });

  it('computes determinant of a scaling matrix', () => {
    const m = Mat4.fromScaling(Mat4.create(), [2, 3, 4]);
    expect(Mat4.determinant(m)).toBeCloseTo(24, 10);
  });

  it('builds a finite perspective projection', () => {
    const m = Mat4.perspective(Mat4.create(), Math.PI / 2, 1, 1, 100);
    expect(m[0]).toBeCloseTo(1, 10);
    expect(m[5]).toBeCloseTo(1, 10);
    expect(m[11]).toBe(-1);
    expect(m[15]).toBe(0);
  });
});
