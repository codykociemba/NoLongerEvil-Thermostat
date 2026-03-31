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

### Build for All Platforms

```bash
npm run package
```

### Build for Specific Platforms

macOS:
```bash
npm run package:mac
```

Linux:
```bash
npm run package:linux
```

> **Note:** Windows builds are not officially supported. For Windows development, use `npm run electron:dev`.

## Distribution Files

After building, you'll find the output in the `dist/` directory:

- **macOS**: `dist/nolongerevil-installer-mac-x64.zip`
- **Linux**: `dist/nolongerevil-installer-linux-x86_64.AppImage`
