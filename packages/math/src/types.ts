/**
 * Shared numeric vector/matrix types for the Slice Engine math package.
 *
 * All types are fixed-length tuples so that indexed access is statically known
 * (avoids `number | undefined` under `noUncheckedIndexedAccess`). Mutable
 * variants are used for outputs; `Readonly*` variants for inputs.
 *
 * Matrices are stored in **column-major** order (WebGL / Three.js convention).
 */

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];

/** Quaternion stored as `[x, y, z, w]`. */
export type Quat = [number, number, number, number];

/** 4x4 matrix in column-major order. */
export type Mat4 = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

export type ReadonlyVec2 = readonly [number, number];
export type ReadonlyVec3 = readonly [number, number, number];
export type ReadonlyVec4 = readonly [number, number, number, number];
export type ReadonlyQuat = readonly [number, number, number, number];
export type ReadonlyMat4 = readonly [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];
