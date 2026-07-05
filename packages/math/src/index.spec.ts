import { describe, it, expect } from 'vitest';
import { MATH_PACKAGE } from './index';

describe('@slice/math', () => {
  it('exposes its package marker', () => {
    expect(MATH_PACKAGE).toBe('@slice/math');
  });
});
