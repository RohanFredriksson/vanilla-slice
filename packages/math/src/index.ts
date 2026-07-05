// @slice/math — vectors, matrices, quaternions, and scalar utilities.
// This package depends on nothing (see ARCHITECTURE.md).
//
// Vector/matrix operations are grouped into namespaces that share a name with
// their type, e.g. `const v: Vec3 = Vec3.create()`.

export * from './common';
export type * from './types';

export * as Vec2 from './vec2';
export * as Vec3 from './vec3';
export * as Mat4 from './mat4';
export * as Quat from './quat';

export const MATH_PACKAGE = '@slice/math';
