# NoLongerEvil Thermostat Installer

A cross-platform Electron application for flashing NoLongerEvil firmware to Nest Thermostats.

### Prerequisites

- Node.js 18+ and npm
- For macOS: Xcode Command Line Tools
- For Windows: Build tools for native modules
- For Linux: build-essential, libusb-1.0-0-dev

### Setup

1. Install dependencies:
```bash
npm install
```

2. Ensure binaries are in place:
   - Copy platform-specific omap_loader binaries to `resources/binaries/`
   - Firmware files should be in `resources/firmware/`

3. Run in development mode:
```bash
npm run electron:dev
```

## Building

### Build for Current Platform

```bash
npm run electron:build
```

### Build for Specific Platforms

macOS:
```bash
npm run electron:build:mac
```

Windows:
```bash
npm run electron:build:win
```

Linux:
```bash
npm run electron:build:linux
```

## Distribution Files

After building, you'll find:

- **macOS**: `dist-electron/NoLongerEvil Installer.dmg`
- **Windows**: `dist-electron/NoLongerEvil Installer Setup.exe`
- **Linux**: `dist-electron/NoLongerEvil Installer.AppImage`
