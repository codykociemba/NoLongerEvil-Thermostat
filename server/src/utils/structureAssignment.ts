/**
 * Structure Assignment Business Logic
 *
 * Automatically assigns structure_id to device objects when missing.
 * Structure ID is derived from the device owner's userId.
 *
 * Critical protocol requirement: Devices need structure_id for multi-device grouping.
 */

import type { StructureAssignmentResult } from '../lib/types';
import { AbstractDeviceStateManager } from '../services/AbstractDeviceStateManager';

/**
 * Check if device object needs structure_id assignment
 */
export function needsStructureId(value: Record<string, any>): boolean {
  return !value.structure_id || value.structure_id === '';
}

/**
 * Assign structure_id to device object
 * Looks up device owner and sets structure_id to their userId (without "user_" prefix)
 */
export async function assignStructureId(
  deviceStateManager: AbstractDeviceStateManager,
  serial: string,
  value: Record<string, any>
): Promise<StructureAssignmentResult> {
  if (!needsStructureId(value)) {
    return { assigned: false };
  }

  try {
    const owner = await deviceStateManager.getDeviceOwner(serial);
    if (!owner || !owner.userId) {
      console.warn(`[StructureAssignment] No owner found for device ${serial}`);
      return { assigned: false };
    }

    let structureId = owner.userId;
    if (structureId.startsWith('user_')) {
      structureId = structureId.slice(5);
    }

    value.structure_id = structureId;

    console.log(`[StructureAssignment] Assigned structure_id "${structureId}" to device ${serial}`);

    return {
      assigned: true,
      structure_id: structureId,
    };
  } catch (error) {
    console.error(`[StructureAssignment] Failed to assign structure_id for ${serial}:`, error);
    return { assigned: false };
  }
}
