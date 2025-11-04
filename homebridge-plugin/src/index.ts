import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { NoLongerEvilThermostatAccessory } from './accessory';
import { NoLongerEvilAPI } from './api';

const PLATFORM_NAME = 'NoLongerEvilThermostat';

export = (api: API) => {
  api.registerPlatform(PLATFORM_NAME, NoLongerEvilPlatform);
};

class NoLongerEvilPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  
  public readonly accessories: PlatformAccessory[] = [];
  private apiClient: NoLongerEvilAPI;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    // Initialize API client
    const apiUrl = this.config.apiUrl || 'https://nolongerevil.com/api';
    const apiKey = this.config.apiKey;
    
    if (!apiKey) {
      this.log.error('API key is required. Please configure it in config.json');
      return;
    }

    this.apiClient = new NoLongerEvilAPI(apiUrl, apiKey, this.log);

    // When this event is fired, it means HomeBridge has restored all cached accessories
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  /**
   * Discover devices from the NoLongerEvil API
   */
  async discoverDevices() {
    try {
      const devices = await this.apiClient.getDevices();
      
      this.log.info(`Found ${devices.length} device(s)`);

      for (const device of devices) {
        const uuid = this.api.hap.uuid.generate(device.id);
        const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

        if (existingAccessory) {
          this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
          new NoLongerEvilThermostatAccessory(this, existingAccessory, device, this.apiClient);
        } else {
          this.log.info('Adding new accessory:', device.name);
          const accessory = new this.api.platformAccessory(device.name, uuid);
          accessory.context.device = device;
          
          new NoLongerEvilThermostatAccessory(this, accessory, device, this.apiClient);
          this.api.registerPlatformAccessories(PLATFORM_NAME, PLATFORM_NAME, [accessory]);
          this.accessories.push(accessory);
        }
      }
    } catch (error) {
      this.log.error('Failed to discover devices:', error);
    }
  }
}

