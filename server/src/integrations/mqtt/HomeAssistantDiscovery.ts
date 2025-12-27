/**
 * Home Assistant MQTT Discovery
 *
 * Publishes discovery messages for automatic device detection in Home Assistant
 * Reference: https://www.home-assistant.io/integrations/mqtt/#mqtt-discovery
 *
 * Discovery Topic Format:
 * <discovery_prefix>/<component>/[<node_id>/]<object_id>/config
 *
 * Example:
 * homeassistant/climate/nest_02AA01AC/thermostat/config
 */

import * as mqtt from 'mqtt';
import type { DeviceStateService } from '../../services/DeviceStateService';
import { resolveDeviceName } from './helpers';

/**
 * Build Home Assistant discovery payload for climate entity (main thermostat control)
 */
export function buildClimateDiscovery(
  serial: string,
  deviceName: string,
  topicPrefix: string
): any {
  // Always use Celsius - HA handles display conversion based on user preferences
  // This avoids double-conversion bugs when Nest display unit changes
  return {
    // Unique identifier
    unique_id: `nolongerevil_${serial}`,

    // Device name
    name: deviceName,

    // NEW: Updated from object_id to default_entity_id to fix HA Core 2026 deprecation warnings
    default_entity_id: `climate.nest_${serial}`,

    // Device info (groups all entities together)
    device: {
      identifiers: [`nolongerevil_${serial}`],
      name: deviceName,
      model: 'Nest Thermostat',
      manufacturer: 'Google Nest',
      sw_version: 'NoLongerEvil',
    },

    // Availability topic
    availability: {
      topic: `${topicPrefix}/${serial}/availability`,
      payload_available: 'online',
      payload_not_available: 'offline',
    },

    // Temperature unit - always Celsius (Nest internal format)
    // HA will convert to user's display preference automatically
    temperature_unit: 'C',

    // Precision (0.5 for Nest)
    precision: 0.5,
    temp_step: 0.5,

    // Current temperature
    current_temperature_topic: `${topicPrefix}/${serial}/ha/current_temperature`,

    // Current humidity
    current_humidity_topic: `${topicPrefix}/${serial}/ha/current_humidity`,

    // Target temperature (heat/cool mode)
    temperature_command_topic: `${topicPrefix}/${serial}/ha/target_temperature/set`,
    temperature_state_topic: `${topicPrefix}/${serial}/ha/target_temperature`,

    // Target temperature high (auto mode)
    temperature_high_command_topic: `${topicPrefix}/${serial}/ha/target_temperature_high/set`,
    temperature_high_state_topic: `${topicPrefix}/${serial}/ha/target_temperature_high`,

    // Target temperature low (auto mode)
    temperature_low_command_topic: `${topicPrefix}/${serial}/ha/target_temperature_low/set`,
    temperature_low_state_topic: `${topicPrefix}/${serial}/ha/target_temperature_low`,

    // HVAC mode (heat, cool, heat_cool, off)
    mode_command_topic: `${topicPrefix}/${serial}/ha/mode/set`,
    mode_state_topic: `${topicPrefix}/${serial}/ha/mode`,
    modes: ['off', 'heat', 'cool', 'heat_cool'],

    // HVAC action (heating, cooling, idle, fan, off)
    action_topic: `${topicPrefix}/${serial}/ha/action`,

    // Fan mode (on, auto)
    fan_mode_command_topic: `${topicPrefix}/${serial}/ha/fan_mode/set`,
    fan_mode_state_topic: `${topicPrefix}/${serial}/ha/fan_mode`,
    fan_modes: ['auto', 'on'],

    // Preset modes (home, away, eco)
    preset_mode_command_topic: `${topicPrefix}/${serial}/ha/preset/set`,
    preset_mode_state_topic: `${topicPrefix}/${serial}/ha/preset`,
    preset_modes: ['home', 'away', 'eco'],

    // Min/max temperature in Celsius (typical Nest range)
    min_temp: 9,
    max_temp: 32,

    // Optimistic mode
    optimistic: false,

    // QoS
    qos: 1,
  };
}

/**
 * Build Home Assistant discovery payload for Humidifier
 * NEW: Added for Nest Humidifier support
 */
export function buildHumidifierDiscovery(
  serial: string,
  deviceName: string,
  topicPrefix: string
): any {
  return {
    unique_id: `nolongerevil_${serial}_humidifier`,
    name: `${deviceName} Humidifier`,
    default_entity_id: `humidifier.nest_${serial}_humidifier`,
    device: {
      identifiers: [`nolongerevil_${serial}`],
      name: deviceName,
    },
    availability: {
      topic: `${topicPrefix}/${serial}/availability`,
      payload_available: 'online',
      payload_not_available: 'offline',
    },
    // 1. Switch (On/Off) - Direct to /ha/ topic
    command_topic: `${topicPrefix}/${serial}/ha/humidifier_state/set`,
    state_topic: `${topicPrefix}/${serial}/ha/humidifier_state`,
    payload_on: 'true',
    payload_off: 'false',
    
    // 2. Slider (Target) - Direct to /ha/ topic
    target_humidity_command_topic: `${topicPrefix}/${serial}/ha/target_humidity/set`,
    target_humidity_state_topic: `${topicPrefix}/${serial}/device/target_humidity`,
    min_humidity: 10,
    max_humidity: 60,
    
    // 3. Status
    action_topic: `${topicPrefix}/${serial}/ha/humidifier_action`,
    current_humidity_topic: `${topicPrefix}/${serial}/ha/current_humidity`,
    
    device_class: 'humidifier',
    origin: {
        name: 'NoLongerEvil',
        sw_version: '1.0.0'
    },
    qos: 1
  };
}

/**
 * Build Home Assistant discovery payload for temperature sensor
 */
export function buildTemperatureSensorDiscovery(
  serial: string,
  topicPrefix: string
): any {
  return {
    unique_id: `nolongerevil_${serial}_temperature`,
    name: `Temperature`,
    default_entity_id: `sensor.nest_${serial}_temperature`,

    device: {
      identifiers: [`nolongerevil_${serial}`],
    },

    state_topic: `${topicPrefix}/${serial}/ha/current_temperature`,
    unit_of_measurement: '°C',
    device_class: 'temperature',
    state_class: 'measurement',

    availability: {
      topic: `${topicPrefix}/${serial}/availability`,
      payload_available: 'online',
      payload_not_available: 'offline',
    },

    qos: 0,
  };
}

/**
 * Build Home Assistant discovery payload for humidity sensor
 */
export function buildHumiditySensorDiscovery(
  serial: string,
  topicPrefix: string
): any {
  return {
    unique_id: `nolongerevil_${serial}_humidity`,
    name: `Humidity`,
    default_entity_id: `sensor.nest_${serial}_humidity`,

    device: {
      identifiers: [`nolongerevil_${serial}`],
    },

    state_topic: `${topicPrefix}/${serial}/ha/current_humidity`,
    unit_of_measurement: '%',
    device_class: 'humidity',
    state_class: 'measurement',

    availability: {
      topic: `${topicPrefix}/${serial}/availability`,
      payload_available: 'online',
      payload_not_available: 'offline',
    },

    qos: 0,
  };
}

/**
 * Build Home Assistant discovery payload for outdoor temperature sensor
 */
export function buildOutdoorTemperatureSensorDiscovery(
  serial: string,
  topicPrefix: string
): any {
  return {
    unique_id: `nolongerevil_${serial}_outdoor_temperature`,
    name: `Outdoor Temperature`,
    default_entity_id: `sensor.nest_${serial}_outdoor_temperature`,

    device: {
      identifiers: [`nolongerevil_${serial}`],
    },

    state_topic: `${topicPrefix}/${serial}/ha/outdoor_temperature`,
    unit_of_measurement: '°C',
    device_class: 'temperature',
    state_class: 'measurement',

    availability: {
      topic: `${topicPrefix}/${serial}/availability`,
      payload_available: 'online',
      payload_not_available: 'offline',
    },

    qos: 0,
  };
}

/**
 * Build Home Assistant discovery payload for occupancy binary sensor
 */
export function buildOccupancyBinarySensorDiscovery(
  serial: string,
  topicPrefix: string
): any {
  return {
    unique_id: `nolongerevil_${serial}_occupancy`,
    name: `Occupancy`,
    default_entity_id: `binary_sensor.nest_${serial}_occupancy`,

    device: {
      identifiers: [`nolongerevil_${serial}`],
    },

    state_topic: `${topicPrefix}/${serial}/ha/occupancy`,
    payload_on: 'home',
    payload_off: 'away',
    device_class: 'occupancy',

    availability: {
      topic: `${topicPrefix}/${serial}/availability`,
      payload_available: 'online',
      payload_not_available: 'offline',
    },

    qos: 0,
  };
}


/**
 * Build Home Assistant discovery payload for fan binary sensor
 */
export function buildFanBinarySensorDiscovery(
  serial: string,
  topicPrefix: string
): any {
  return {
    unique_id: `nolongerevil_${serial}_fan`,
    name: `Fan`,
    default_entity_id: `binary_sensor.nest_${serial}_fan`,

    device: {
      identifiers: [`nolongerevil_${serial}`],
    },

    state_topic: `${topicPrefix}/${serial}/ha/fan_running`,
    payload_on: 'true',
    payload_off: 'false',
    device_class: 'running',

    availability: {
      topic: `${topicPrefix}/${serial}/availability`,
      payload_available: 'online',
      payload_not_available: 'offline',
    },

    qos: 0,
  };
}

/**
 * Build Home Assistant discovery payload for leaf (eco) binary sensor
 */
export function buildLeafBinarySensorDiscovery(
  serial: string,
  topicPrefix: string
): any {
  return {
    unique_id: `nolongerevil_${serial}_leaf`,
    name: `Eco Mode`,
    default_entity_id: `binary_sensor.nest_${serial}_leaf`,

    device: {
      identifiers: [`nolongerevil_${serial}`],
    },

    state_topic: `${topicPrefix}/${serial}/ha/eco`,
    payload_on: 'true',
    payload_off: 'false',
    device_class: 'power',

    availability: {
      topic: `${topicPrefix}/${serial}/availability`,
      payload_available: 'online',
      payload_not_available: 'offline',
    },

    qos: 0,
  };
}

/**
 * Publish all discovery messages for a thermostat
 */
export async function publishThermostatDiscovery(
  client: mqtt.MqttClient,
  serial: string,
  deviceState: DeviceStateService,
  topicPrefix: string,
  discoveryPrefix: string
): Promise<void> {
  try {
    // Resolve device name
    const deviceName = await resolveDeviceName(serial, deviceState);

    console.log(`[HA Discovery] Publishing discovery for ${serial} (${deviceName})`);
    
    // 1. Fetch Device Data for Capabilities Check
    // We check if the device actually has a humidifier before creating the entity
    const deviceObj = await deviceState.get(serial, `device.${serial}`);
    const hasHumidifier = deviceObj?.value?.has_humidifier === true;

    // Climate entity (main thermostat control)
    // Always uses Celsius - HA handles user display preferences
    const climateConfig = buildClimateDiscovery(serial, deviceName, topicPrefix);
    await publishDiscoveryMessage(
      client,
      `${discoveryPrefix}/climate/nest_${serial}/thermostat/config`,
      climateConfig
    );

    // Humidifier (Conditional)
    if (hasHumidifier) {
      const humConfig = buildHumidifierDiscovery(serial, deviceName, topicPrefix);
      await publishDiscoveryMessage(
        client,
        `${discoveryPrefix}/humidifier/nest_${serial}/humidifier/config`,
        humConfig
      );
    }

    // Temperature sensor
    const tempConfig = buildTemperatureSensorDiscovery(serial, topicPrefix);
    await publishDiscoveryMessage(
      client,
      `${discoveryPrefix}/sensor/nest_${serial}/temperature/config`,
      tempConfig
    );

    // Humidity sensor
    const humidityConfig = buildHumiditySensorDiscovery(serial, topicPrefix);
    await publishDiscoveryMessage(
      client,
      `${discoveryPrefix}/sensor/nest_${serial}/humidity/config`,
      humidityConfig
    );

    // Outdoor temperature sensor
    const outdoorTempConfig = buildOutdoorTemperatureSensorDiscovery(serial, topicPrefix);
    await publishDiscoveryMessage(
      client,
      `${discoveryPrefix}/sensor/nest_${serial}/outdoor_temperature/config`,
      outdoorTempConfig
    );

    // Occupancy binary sensor
    const occupancyConfig = buildOccupancyBinarySensorDiscovery(serial, topicPrefix);
    await publishDiscoveryMessage(
      client,
      `${discoveryPrefix}/binary_sensor/nest_${serial}/occupancy/config`,
      occupancyConfig
    );

    // Fan binary sensor
    const fanConfig = buildFanBinarySensorDiscovery(serial, topicPrefix);
    await publishDiscoveryMessage(
      client,
      `${discoveryPrefix}/binary_sensor/nest_${serial}/fan/config`,
      fanConfig
    );

    // Leaf (eco) binary sensor
    const leafConfig = buildLeafBinarySensorDiscovery(serial, topicPrefix);
    await publishDiscoveryMessage(
      client,
      `${discoveryPrefix}/binary_sensor/nest_${serial}/leaf/config`,
      leafConfig
    );

    console.log(`[HA Discovery] Successfully published all discovery messages for ${serial}`);
  } catch (error) {
    console.error(`[HA Discovery] Error publishing discovery for ${serial}:`, error);
    throw error;
  }
}

/**
 * Publish a single discovery message (with error handling)
 */
async function publishDiscoveryMessage(
  client: mqtt.MqttClient,
  topic: string,
  config: any
): Promise<void> {
  return new Promise((resolve, reject) => {
    const payload = typeof config === 'string' ? config : JSON.stringify(config);
    client.publish(topic, payload, { retain: true, qos: 1 }, (err) => {
      if (err) {
        console.error(`[HA Discovery] Failed to publish to ${topic}:`, err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Remove discovery messages for a device (when device is removed)
 */
export async function removeDeviceDiscovery(
  client: mqtt.MqttClient,
  serial: string,
  discoveryPrefix: string
): Promise<void> {
  const topics = [
    `${discoveryPrefix}/climate/nest_${serial}/thermostat/config`,
    `${discoveryPrefix}/humidifier/nest_${serial}/humidifier/config`, // Added Humidifier
    `${discoveryPrefix}/sensor/nest_${serial}/temperature/config`,
    `${discoveryPrefix}/sensor/nest_${serial}/humidity/config`,
    `${discoveryPrefix}/sensor/nest_${serial}/outdoor_temperature/config`,
    `${discoveryPrefix}/binary_sensor/nest_${serial}/occupancy/config`,
    `${discoveryPrefix}/binary_sensor/nest_${serial}/fan/config`,
    `${discoveryPrefix}/binary_sensor/nest_${serial}/leaf/config`,
  ];

  // Publish empty payloads to remove entities
  for (const topic of topics) {
    await publishDiscoveryMessage(client, topic, '');
  }

  console.log(`[HA Discovery] Removed all discovery messages for ${serial}`);
}
