import { fractureThreshold } from '@vanilla-slice/materials';
import type { Material } from '@vanilla-slice/materials';

/**
 * Whether an impact of the given `energy` on an object of characteristic `size`
 * exceeds the material's fracture-initiation threshold (`toughness × size`,
 * ADR 0009). Infinite-toughness (unbreakable) materials never exceed it, so
 * materialless bodies — which resolve to the unbreakable default — never gate
 * on this. This is the shared material-evaluation glue used by interaction
 * processors; it encodes no object-type knowledge.
 */
export function exceedsFractureThreshold(
  material: Material,
  energy: number,
  size: number,
): boolean {
  return energy > fractureThreshold(material, size);
}
