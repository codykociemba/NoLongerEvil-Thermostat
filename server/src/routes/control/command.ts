/**
 * /command Route Handler (Control API)
 *
 * Handles commands from web dashboard to control thermostats
 */

import type { CommandRequest, CommandResponse } from '../../lib/types';
import { DeviceStateService } from '../../services/DeviceStateService';
import { SubscriptionManager } from '../../services/SubscriptionManager';
import { validateTemperature } from '../../utils/temperatureSafety';

/**
 * Handle POST /command
 * Execute control command from web dashboard
 */
export async function handleCommand(
  body: any,
  deviceState: DeviceStateService,
  subscriptionManager: SubscriptionManager
): Promise<CommandResponse> {
  const {
    serial,
    action,
    value,
    mode,
    target_temperature_low,
    target_temperature_high,
    target_change_pending,
    object,
    field,
  } = body as CommandRequest;

  if (!serial) {
    throw new Error('Missing required field: serial');
  }

  const objectKey = object || `shared.${serial}`;

  let currentObj = await deviceState.get(serial, objectKey);
  if (!currentObj) {
    await deviceState.hydrateFromConvex(serial);
    currentObj = await deviceState.get(serial, objectKey);

    if (!currentObj) {
      throw new Error(`Object not found: ${objectKey}`);
    }
  }

  const currentValue = currentObj.value;
  let updatedValue = { ...currentValue };
  let changesMade = false;

  switch (action) {
    case 'temp':
    case 'temperature': {
      if (typeof value !== 'number') {
        throw new Error('Temperature value must be a number');
      }

      const clampedTemp = validateTemperature(value, currentValue);

      if (mode === 'heat') {
        updatedValue.target_temperature = clampedTemp;
        updatedValue.target_temperature_type = 'heat';
        changesMade = true;
      } else if (mode === 'cool') {
        updatedValue.target_temperature = clampedTemp;
        updatedValue.target_temperature_type = 'cool';
        changesMade = true;
      } else if (mode === 'range') {
        if (typeof target_temperature_low === 'number' && typeof target_temperature_high === 'number') {
          updatedValue.target_temperature_low = validateTemperature(target_temperature_low, currentValue);
          updatedValue.target_temperature_high = validateTemperature(target_temperature_high, currentValue);
          updatedValue.target_temperature_type = 'range';
          changesMade = true;
        }
      } else {
        updatedValue.target_temperature = clampedTemp;
        changesMade = true;
      }

      if (typeof target_change_pending === 'boolean') {
        updatedValue.target_change_pending = target_change_pending;
      }

      updatedValue.touched_by = {
        touched_by: 'nolongerevil',
        touched_where: 'api',
        touched_source: 'web',
        touched_when: Math.floor(Date.now() / 1000),
        touched_tzo: new Date().getTimezoneOffset() * -60,
        touched_id: 1
      };

      break;
    }

    case 'away': {
      const awayValue = value ? 2 : 0;
      updatedValue.auto_away = awayValue;
      changesMade = true;

      const nowMs = Date.now();

      const owner = await deviceState.getDeviceOwner(serial);
      if (owner && owner.userId) {
        const userId = owner.userId.replace(/^user_/, '');
        const userKey = `user.${userId}`;
        let userState = await deviceState.get(serial, userKey);

        if (userState && userState.value) {
          const updatedUserValue = {
            ...userState.value,
            away: Boolean(value),
            away_setter: 1,
            away_timestamp: nowMs,
            manual_away_timestamp: nowMs,
          };

          await deviceState.upsert(
            serial,
            userKey,
            userState.object_revision + 1,
            nowMs,
            updatedUserValue
          );
        }
      }

      break;
    }

    case 'set': {
      if (!field) {
        throw new Error('Field name required for set action');
      }
      updatedValue[field] = value;
      changesMade = true;
      break;
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }

  if (!changesMade) {
    return {
      success: false,
      message: 'No changes made',
      device: serial,
      object: objectKey,
      revision: currentObj.object_revision,
      timestamp: currentObj.object_timestamp,
    };
  }

  const newRevision = currentObj.object_revision + 1;
  const newTimestamp = Date.now();

  const updatedObj = await deviceState.upsert(serial, objectKey, newRevision, newTimestamp, updatedValue);

  const notifyResult = subscriptionManager.notify(serial, objectKey, updatedObj);
  console.log(
    `[Command] Executed ${action} for ${serial}/${objectKey}, notified ${notifyResult.notified} subscriber(s)`
  );

  return {
    success: true,
    message: 'Command handled',
    device: serial,
    object: objectKey,
    revision: updatedObj.object_revision,
    timestamp: updatedObj.object_timestamp,
  };
}
