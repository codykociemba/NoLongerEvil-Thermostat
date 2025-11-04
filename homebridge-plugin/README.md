# HomeBridge Plugin for NoLongerEvil Thermostat

This HomeBridge plugin allows you to control your NoLongerEvil-flashed Nest Thermostat through Apple HomeKit.

## Features

- Control your thermostat via HomeKit/Siri
- View current and target temperature
- Set heating/cooling modes (Off, Heat, Cool, Auto)
- Automatic status updates via polling
- Support for multiple thermostats

## Installation

1. Install HomeBridge if you haven't already: [HomeBridge Installation Guide](https://github.com/homebridge/homebridge/wiki)

2. Install this plugin:
   ```bash
   npm install -g homebridge-nolongerevil-thermostat
   ```

3. Or install from source:
   ```bash
   cd homebridge-plugin
   npm install
   npm run build
   npm link
   ```

## Configuration

Add the following configuration to your HomeBridge `config.json`:

```json
{
  "platforms": [
    {
      "platform": "NoLongerEvilThermostat",
      "name": "NoLongerEvil Thermostat",
      "apiUrl": "https://nolongerevil.com/api",
      "apiKey": "YOUR_API_KEY_HERE",
      "pollInterval": 60000
    }
  ]
}
```

### Configuration Options

- `platform` (required): Must be `"NoLongerEvilThermostat"`
- `name` (required): Name for your platform
- `apiUrl` (optional): Base URL for the NoLongerEvil API (default: `"https://nolongerevil.com/api"`)
- `apiKey` (required): Your API key from NoLongerEvil platform
- `pollInterval` (optional): How often to poll for updates in milliseconds (default: 60000 = 60 seconds)

## Getting Your API Key

1. Log in to [https://nolongerevil.com](https://nolongerevil.com)
2. Navigate to your account settings
3. Generate an API key (exact location may vary - check the NoLongerEvil documentation)

## API Implementation Notes

**⚠️ IMPORTANT:** This plugin currently includes placeholder API endpoints. You'll need to update the API client (`src/api.ts`) with the actual NoLongerEvil API endpoints.

The following methods need to be implemented with the real API endpoints:

- `getDevices()` - Fetch all thermostats associated with your account
- `getDeviceStatus(deviceId)` - Get current status of a thermostat
- `setTargetTemperature(deviceId, temperature)` - Set target temperature
- `setHeatingCoolingState(deviceId, state)` - Set heating/cooling mode
- `setTemperatureDisplayUnits(deviceId, units)` - Set temperature units (Celsius/Fahrenheit)

### Example API Implementation

Once you know the NoLongerEvil API structure, update `src/api.ts`:

```typescript
async getDevices(): Promise<Device[]> {
  const response: AxiosResponse<Device[]> = await this.client.get('/devices');
  return response.data;
}

async getDeviceStatus(deviceId: string): Promise<Device> {
  const response: AxiosResponse<Device> = await this.client.get(`/devices/${deviceId}`);
  return response.data;
}

async setTargetTemperature(deviceId: string, temperature: number): Promise<void> {
  await this.client.put(`/devices/${deviceId}/target-temperature`, { temperature });
}
```

## Development

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the plugin:
   ```bash
   npm run build
   ```
4. Watch for changes:
   ```bash
   npm run watch
   ```

## Troubleshooting

- **Plugin not appearing**: Make sure you've restarted HomeBridge after installation
- **API errors**: Verify your API key is correct and the API endpoints are properly implemented
- **Devices not discovered**: Check the HomeBridge logs for API errors
- **Temperature not updating**: Verify the polling interval and API connectivity

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT

