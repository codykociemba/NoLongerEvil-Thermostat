/**
 * /nest/transport Route Handlers
 *
 * Implements the core Nest protocol for:
 * - GET /nest/transport/device/{serial} - List objects for device
 * - POST /nest/transport - Subscribe to updates (long-poll)
 * - POST /nest/transport/put - Device state updates
 */

import { IncomingMessage, ServerResponse } from 'http';
import type { DeviceObject, ClientDeviceObject, Subscription } from '../../lib/types';
import { DeviceStateService } from '../../services/DeviceStateService';
import { SubscriptionManager } from '../../services/SubscriptionManager';
import { extractWeaveDeviceId } from '../../lib/serialParser';
import { preserveFanTimer } from '../../utils/fanTimer';
import { assignStructureId, needsStructureId } from '../../utils/structureAssignment';
import { AbstractDeviceStateManager } from '@/services/AbstractDeviceStateManager';

/**
 * Handle GET /nest/transport/device/{serial}
 * Returns list of all objects and their metadata for a device
 */
export async function handleTransportGet(
  _req: IncomingMessage,
  res: ServerResponse,
  serial: string,
  deviceState: DeviceStateService,
  deviceStateManager: AbstractDeviceStateManager
): Promise<void> {
  await deviceStateManager.ensureDeviceAlertDialog(serial);
  const deviceObjects = await deviceState.getAllForDevice(serial);

  const objects = Object.values(deviceObjects).map(obj => ({
    object_revision: obj.object_revision,
    object_timestamp: obj.object_timestamp,
    object_key: obj.object_key,
  }));

  const responseStr = JSON.stringify({ objects });
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(responseStr, 'utf8')
  });
  res.end(responseStr);
}

/**
 * Handle POST /nest/transport (Subscribe mode)
 * Long-poll subscription for real-time updates
 */
export async function handleTransportSubscribe(
  req: IncomingMessage,
  res: ServerResponse,
  serial: string,
  body: any,
  deviceState: DeviceStateService,
  subscriptionManager: SubscriptionManager,
  deviceStateManager: AbstractDeviceStateManager
): Promise<void> {
  const { session, chunked, objects } = body;

  if (!Array.isArray(objects)) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Invalid request: objects array required');
    return;
  }

  const sessionId = session || `session_${serial}_${Date.now()}`;
  const weaveDeviceId = extractWeaveDeviceId(req);
  const responseObjects: DeviceObject[] = [];

  for (const clientObj of objects as ClientDeviceObject[]) {
    const { object_key, object_revision, object_timestamp, value } = clientObj;
    let serverObj = await deviceState.get(serial, object_key);

    const isUpdate = value &&
                     (object_revision === undefined || object_revision === 0) &&
                     (object_timestamp === undefined || object_timestamp === 0);

    if (isUpdate) {

      const existingValue = serverObj?.value || {};
      let mergedValue = deviceState.mergeValues(existingValue, value);

      if (weaveDeviceId) {
        mergedValue.weave_device_id = weaveDeviceId;
      }

      if (object_key === `device.${serial}`) {
        mergedValue = preserveFanTimer(mergedValue, existingValue);

        if (needsStructureId(mergedValue)) {
          const result = await assignStructureId(deviceStateManager, serial, mergedValue);
          if (result.assigned) {
            const owner = await deviceStateManager.getDeviceOwner(serial);
            if (owner) {
              await deviceStateManager.updateUserAwayStatus(owner.userId);
              await deviceStateManager.syncUserWeatherFromDevice(owner.userId);
            }
          }
        }

        if ('away' in value || 'postal_code' in value) {
          const owner = await deviceStateManager.getDeviceOwner(serial);
          if (owner) {
            await deviceStateManager.updateUserAwayStatus(owner.userId);
            await deviceStateManager.syncUserWeatherFromDevice(owner.userId);
          }
        }
      }

      const valuesEqual = serverObj && deviceState.areValuesEqual(serverObj.value, mergedValue);
      const newRevision = valuesEqual ? (serverObj?.object_revision || 0) : (serverObj?.object_revision || 0) + 1;
      const newTimestamp = Date.now();

      serverObj = await deviceState.upsert(serial, object_key, newRevision, newTimestamp, mergedValue);
    }

    const responseObj: DeviceObject = {
      object_revision: serverObj?.object_revision || 0,
      object_timestamp: serverObj?.object_timestamp || 0,
      object_key,
      value: serverObj?.value || {}
    };

    responseObjects.push(responseObj);
  }

  const outdatedObjects: DeviceObject[] = [];
  const objectsToMerge: Array<{ deviceObj: ClientDeviceObject; ourObj: DeviceObject }> = [];

  for (let i = 0; i < objects.length; i++) {
    const clientObj = objects[i] as ClientDeviceObject;
    const responseObj = responseObjects[i];

    if (clientObj.object_revision === 0 && clientObj.object_timestamp === 0) {
      outdatedObjects.push(responseObj);
      continue;
    }

    const serverRevisionHigher = responseObj.object_revision > clientObj.object_revision;
    const serverTimestampHigher = responseObj.object_timestamp > clientObj.object_timestamp;

    if (serverRevisionHigher || serverTimestampHigher) {
      outdatedObjects.push(responseObj);
    } else if (clientObj.object_revision > responseObj.object_revision || clientObj.object_timestamp > responseObj.object_timestamp) {
      objectsToMerge.push({ deviceObj: clientObj, ourObj: responseObj });
    }
  }

  for (const { deviceObj, ourObj } of objectsToMerge) {
    const object_key = deviceObj.object_key;
    const mergedValue = deviceObj.value ? { ...ourObj.value, ...deviceObj.value } : ourObj.value;
    await deviceState.upsert(serial, object_key, deviceObj.object_revision, deviceObj.object_timestamp, mergedValue);
  }

  if (outdatedObjects.length > 0) {
    console.log(`[Transport] Responding immediately with ${outdatedObjects.length} outdated object(s) for ${serial}`);

    const response = JSON.stringify({ objects: outdatedObjects });
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=UTF-8',
      'X-nl-service-timestamp': Date.now().toString()
    });
    res.end(response);
    return;
  }

  if (chunked) {
    const subscription: Subscription = {
      res,
      objects: objects as ClientDeviceObject[],
      sessionId,
      connectedAt: Date.now(),
      serial,
    };

    const added = subscriptionManager.addSubscription(subscription);
    if (!added) {
      res.writeHead(429, { 'Content-Type': 'text/plain' });
      res.end('Too many subscriptions for this device');
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'application/json; charset=UTF-8',
      'Transfer-Encoding': 'chunked',
      'X-nl-service-timestamp': Date.now().toString()
    });

    res.write('');

    console.log(`[Transport] Added subscription for ${serial} (session: ${sessionId})`);
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end();
  }
}

/**
 * Handle POST /nest/transport/put
 * Device sends state updates
 */
export async function handlePut(
  req: IncomingMessage,
  res: ServerResponse,
  serial: string,
  body: any,
  deviceState: DeviceStateService,
  subscriptionManager: SubscriptionManager,
  deviceStateManager: AbstractDeviceStateManager
): Promise<void> {
  const { objects } = body;

  if (!Array.isArray(objects)) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Invalid request: objects array required');
    return;
  }

  const weaveDeviceId = extractWeaveDeviceId(req);
  const responseObjects: any[] = [];
  let deviceObjectChanged = false;

  for (const clientObj of objects as ClientDeviceObject[]) {
    const { object_key, value } = clientObj;

    if (!value) {
      console.warn(`[Transport/PUT] No value provided for ${serial}/${object_key}`);
      continue;
    }

    let serverObj = await deviceState.get(serial, object_key);
    const existingValue = serverObj?.value || {};
    let mergedValue = deviceState.mergeValues(existingValue, value);

    if (weaveDeviceId) {
      mergedValue.weave_device_id = weaveDeviceId;
    }

    if (object_key === `device.${serial}`) {
      deviceObjectChanged = true;
      mergedValue = preserveFanTimer(mergedValue, existingValue);
    }

    const valuesChanged = !serverObj || !deviceState.areValuesEqual(serverObj.value, mergedValue);
    const newRevision = valuesChanged ? (serverObj?.object_revision || 0) + 1 : (serverObj?.object_revision || 0);
    const newTimestamp = Date.now();

    serverObj = await deviceState.upsert(serial, object_key, newRevision, newTimestamp, mergedValue);

    const responseObj: any = {
      object_revision: serverObj.object_revision,
      object_timestamp: serverObj.object_timestamp,
      object_key: serverObj.object_key,
    };

    if (valuesChanged) {
      responseObj.value = serverObj.value;
    }

    responseObjects.push(responseObj);
  }

  if (deviceObjectChanged) {
    const owner = await deviceStateManager.getDeviceOwner(serial);
    if (owner) {
      await deviceStateManager.updateUserAwayStatus(owner.userId);
      await deviceStateManager.syncUserWeatherFromDevice(owner.userId);
    }
  }

  const notifyResult = subscriptionManager.notifyAll(serial, responseObjects);
  console.log(
    `[Transport/PUT] Notified ${notifyResult.notified} subscriber(s) for ${serial}, ` +
    `${responseObjects.length} object(s) updated`
  );

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ objects: responseObjects }));
}
