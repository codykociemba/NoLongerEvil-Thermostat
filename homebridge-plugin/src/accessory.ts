import { API, CharacteristicValue, Logging, PlatformAccessory, Service } from 'homebridge';
import { NoLongerEvilAPI, Device } from './api';
import { NoLongerEvilPlatform } from './index';

export class NoLongerEvilThermostatAccessory {
  private thermostatService: Service;
  private informationService: Service;
  private updateInterval?: NodeJS.Timeout;

  constructor(
    private readonly platform: NoLongerEvilPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly device: Device,
    private readonly apiClient: NoLongerEvilAPI,
  ) {
    // Set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Nest')
      .setCharacteristic(this.platform.Characteristic.Model, 'Learning Thermostat')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, device.id)
      .setCharacteristic(this.platform.Characteristic.FirmwareRevision, 'NoLongerEvil');

    // Get or create the Thermostat service
    this.thermostatService = this.accessory.getService(this.platform.Service.Thermostat)
      || this.accessory.addService(this.platform.Service.Thermostat);

    this.thermostatService.setCharacteristic(this.platform.Characteristic.Name, device.name);

    // Register handlers for the characteristics
    this.thermostatService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.handleCurrentTemperatureGet.bind(this));

    this.thermostatService.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .onGet(this.handleTargetTemperatureGet.bind(this))
      .onSet(this.handleTargetTemperatureSet.bind(this));

    this.thermostatService.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .onGet(this.handleTargetHeatingCoolingStateGet.bind(this))
      .onSet(this.handleTargetHeatingCoolingStateSet.bind(this));

    this.thermostatService.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
      .onGet(this.handleCurrentHeatingCoolingStateGet.bind(this));

    this.thermostatService.getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
      .onGet(this.handleTemperatureDisplayUnitsGet.bind(this))
      .onSet(this.handleTemperatureDisplayUnitsSet.bind(this));

    // Set valid temperature range (adjust based on your thermostat's capabilities)
    this.thermostatService.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .setProps({
        minValue: 10,
        maxValue: 30,
        minStep: 0.5,
      });

    // Start polling for updates
    this.startPolling();
  }

  /**
   * Handle requests to get the current temperature
   */
  async handleCurrentTemperatureGet(): Promise<CharacteristicValue> {
    try {
      const status = await this.apiClient.getDeviceStatus(this.device.id);
      const temperature = status.currentTemperature ?? 20;
      
      this.platform.log.debug(`Current temperature for ${this.device.name}: ${temperature}`);
      return temperature;
    } catch (error) {
      this.platform.log.error(`Error getting current temperature: ${error}`);
      return 20; // Return default value on error
    }
  }

  /**
   * Handle requests to get the target temperature
   */
  async handleTargetTemperatureGet(): Promise<CharacteristicValue> {
    try {
      const status = await this.apiClient.getDeviceStatus(this.device.id);
      const temperature = status.targetTemperature ?? 20;
      
      this.platform.log.debug(`Target temperature for ${this.device.name}: ${temperature}`);
      return temperature;
    } catch (error) {
      this.platform.log.error(`Error getting target temperature: ${error}`);
      return 20; // Return default value on error
    }
  }

  /**
   * Handle requests to set the target temperature
   */
  async handleTargetTemperatureSet(value: CharacteristicValue): Promise<void> {
    try {
      const temperature = value as number;
      this.platform.log.debug(`Setting target temperature for ${this.device.name} to ${temperature}`);
      
      await this.apiClient.setTargetTemperature(this.device.id, temperature);
      
      // Update the cached value
      this.thermostatService.updateCharacteristic(
        this.platform.Characteristic.TargetTemperature,
        temperature,
      );
    } catch (error) {
      this.platform.log.error(`Error setting target temperature: ${error}`);
      throw error;
    }
  }

  /**
   * Handle requests to get the target heating/cooling state
   */
  async handleTargetHeatingCoolingStateGet(): Promise<CharacteristicValue> {
    try {
      const status = await this.apiClient.getDeviceStatus(this.device.id);
      const state = status.targetHeatingCoolingState ?? 
        this.platform.Characteristic.TargetHeatingCoolingState.OFF;
      
      this.platform.log.debug(`Target heating/cooling state for ${this.device.name}: ${state}`);
      return state;
    } catch (error) {
      this.platform.log.error(`Error getting target heating/cooling state: ${error}`);
      return this.platform.Characteristic.TargetHeatingCoolingState.OFF;
    }
  }

  /**
   * Handle requests to set the target heating/cooling state
   */
  async handleTargetHeatingCoolingStateSet(value: CharacteristicValue): Promise<void> {
    try {
      const state = value as number;
      this.platform.log.debug(`Setting target heating/cooling state for ${this.device.name} to ${state}`);
      
      await this.apiClient.setHeatingCoolingState(this.device.id, state);
      
      // Update the cached value
      this.thermostatService.updateCharacteristic(
        this.platform.Characteristic.TargetHeatingCoolingState,
        state,
      );
    } catch (error) {
      this.platform.log.error(`Error setting target heating/cooling state: ${error}`);
      throw error;
    }
  }

  /**
   * Handle requests to get the current heating/cooling state
   */
  async handleCurrentHeatingCoolingStateGet(): Promise<CharacteristicValue> {
    try {
      const status = await this.apiClient.getDeviceStatus(this.device.id);
      const state = status.currentHeatingCoolingState ?? 
        this.platform.Characteristic.CurrentHeatingCoolingState.OFF;
      
      this.platform.log.debug(`Current heating/cooling state for ${this.device.name}: ${state}`);
      return state;
    } catch (error) {
      this.platform.log.error(`Error getting current heating/cooling state: ${error}`);
      return this.platform.Characteristic.CurrentHeatingCoolingState.OFF;
    }
  }

  /**
   * Handle requests to get the temperature display units
   */
  async handleTemperatureDisplayUnitsGet(): Promise<CharacteristicValue> {
    try {
      const status = await this.apiClient.getDeviceStatus(this.device.id);
      const units = status.temperatureDisplayUnits ?? 
        this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS;
      
      this.platform.log.debug(`Temperature display units for ${this.device.name}: ${units}`);
      return units;
    } catch (error) {
      this.platform.log.error(`Error getting temperature display units: ${error}`);
      return this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS;
    }
  }

  /**
   * Handle requests to set the temperature display units
   */
  async handleTemperatureDisplayUnitsSet(value: CharacteristicValue): Promise<void> {
    try {
      const units = value as number;
      this.platform.log.debug(`Setting temperature display units for ${this.device.name} to ${units}`);
      
      await this.apiClient.setTemperatureDisplayUnits(this.device.id, units);
      
      // Update the cached value
      this.thermostatService.updateCharacteristic(
        this.platform.Characteristic.TemperatureDisplayUnits,
        units,
      );
    } catch (error) {
      this.platform.log.error(`Error setting temperature display units: ${error}`);
      throw error;
    }
  }

  /**
   * Start polling for device updates
   */
  private startPolling() {
    const pollInterval = this.platform.config.pollInterval || 60000; // Default: 60 seconds
    
    this.updateInterval = setInterval(async () => {
      try {
        const status = await this.apiClient.getDeviceStatus(this.device.id);
        
        // Update characteristics
        this.thermostatService.updateCharacteristic(
          this.platform.Characteristic.CurrentTemperature,
          status.currentTemperature ?? 20,
        );
        
        this.thermostatService.updateCharacteristic(
          this.platform.Characteristic.TargetTemperature,
          status.targetTemperature ?? 20,
        );
        
        this.thermostatService.updateCharacteristic(
          this.platform.Characteristic.TargetHeatingCoolingState,
          status.targetHeatingCoolingState ?? this.platform.Characteristic.TargetHeatingCoolingState.OFF,
        );
        
        this.thermostatService.updateCharacteristic(
          this.platform.Characteristic.CurrentHeatingCoolingState,
          status.currentHeatingCoolingState ?? this.platform.Characteristic.CurrentHeatingCoolingState.OFF,
        );
        
        this.thermostatService.updateCharacteristic(
          this.platform.Characteristic.TemperatureDisplayUnits,
          status.temperatureDisplayUnits ?? this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS,
        );
      } catch (error) {
        this.platform.log.error(`Error polling device status: ${error}`);
      }
    }, pollInterval);
  }

  /**
   * Stop polling for device updates
   */
  stopPolling() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
  }
}

