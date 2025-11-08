# NoLongerEvil Thermostat - macOS Setup Instructions

## Quick Start for macOS Users

If you've already cloned the repository, just pull the latest changes:

```bash
cd NoLongerEvil-Thermostat
git pull origin main
```

## Full Setup (First Time)

### 1. Clone the Repository

```bash
git clone --recurse-submodules https://github.com/codykociemba/NoLongerEvil-Thermostat.git
cd NoLongerEvil-Thermostat
```

### 2. Install Dependencies

Install Xcode Command Line Tools and Homebrew (if not already installed):

```bash
xcode-select --install
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Install required packages:

```bash
brew install pkg-config libusb
```

### 3. Build the Firmware Loader

```bash
chmod +x build.sh
./build.sh
```

### 4. Flash Your Nest Thermostat

```bash
chmod +x install.sh
./install.sh
```

Then follow the on-screen instructions:
1. Ensure your Nest is charged (50%+ recommended)
2. Remove the Nest from the wall mount
3. Connect it to your computer via micro USB
4. Press and hold the display for 10-15 seconds
5. The device will reboot and enter DFU mode
6. The installer will automatically detect and flash the device

### 5. Complete Setup

After flashing:
1. Keep the device plugged in via USB for 2-3 minutes
2. Wait for the NoLongerEvil logo to appear
3. Visit https://nolongerevil.com to register
4. Link your device using the entry code from: Settings → Nest App → Get Entry Code
