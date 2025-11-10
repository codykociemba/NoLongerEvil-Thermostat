# Nest Thermostat Firmware Setup

> **⚠️ WARNING: EXPERIMENTAL SOFTWARE**
>
> This project is currently in the **experimental/testing phase**. Do NOT use this firmware on any thermostat that is critical for your heating or cooling needs. Flashing this firmware may brick your device or cause unexpected behavior. Only proceed if you have a backup thermostat or can afford to have your device non-functional during testing.

This directory contains the tools and firmware needed to flash custom firmware to Nest Thermostat devices using the OMAP DFU (Device Firmware Update) interface.

## Prerequesites

You will need to have, ideally, a linux computer available. MacOS can also be used but some people are having difficulties. Windows should be able to be used with MingW or CygWin but YMMV.

⚠️ This firmware is only for Nest Generation 1 and 2. On the back plate you should see a bubble level, which should be green. If it's blue, that's gen 3 and not supported yet.

## Overview

This firmware loader uses the OMAP bootloader interface to flash custom bootloader and kernel images to Nest Thermostat devices. The device must be put into DFU mode to accept new firmware.

**Important:** After flashing this firmware, your device will no longer contact Nest/Google servers. It will operate independently and connect to the NoLongerEvil platform instead, giving you complete control over your thermostat.

## How it Works

The custom firmware flashes the device with modified bootloader and kernel components that redirect all network traffic from the original Nest/Google servers to a server we specify. This server hosts a reverse-engineered replica of their API, allowing the thermostat to function independently while giving you complete control over your device data and settings.

By intercepting the communication layer, the thermostat believes it's communicating with the official Nest infrastructure, but instead connects to the NoLongerEvil platform. This approach ensures full compatibility with the device's existing software while breaking free from Google's cloud dependency.

## Quick Start

### 1. Clone the Repository

```bash
git clone --recurse-submodules https://github.com/codykociemba/NoLongerEvil-Thermostat.git
cd NoLongerEvil-Thermostat
```

### 2. Install Prerequisites

Before building, you'll need to install some required packages:

#### Linux (Debian/Ubuntu)

```bash
sudo apt-get update
sudo apt-get install build-essential libusb-1.0-0-dev gcc pkg-config
```

#### macOS

First, install Xcode Command Line Tools:

```bash
xcode-select --install
```

Then install libusb using Homebrew (the build script will attempt to install this automatically if missing):

```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install libusb
brew install libusb
```

### 3. Build the omap_loader tool

```bash
chmod +x build.sh
./build.sh
```

The build script will automatically detect your operating system (Linux, macOS, or Windows) and build the appropriate binary.

### 4. Start the firmware installer

**IMPORTANT: You must start the installer script BEFORE rebooting the device.**

#### Linux

```bash
chmod +x install.sh
./install.sh
```

#### macOS

```bash
chmod +x install.sh
./install.sh
```

**Note for macOS:** You may need to grant USB permissions. If you encounter permission issues, check System Preferences → Security & Privacy.

The script will wait for the device to enter DFU mode.

### 5. Put your Nest device in DFU mode

Follow these steps carefully:

1. **Charge the device** - Ensure your Nest Thermostat is properly charged (at least 50% battery recommended)
2. **Remove from wall** - Remove the Nest from its back plate/wall mount
3. **Connect via USB** - Plug the Nest into your computer using a micro USB cable
4. **Wait for the installer** - Make sure the `install.sh` script is running and waiting
5. **Reboot the device** - Press and hold down on the display for 10-15 seconds until the device reboots
6. **DFU mode active** - Once it reboots, the device will enter DFU mode and the installer script will recognize it and begin flashing

The firmware installer will automatically detect the device and flash the custom bootloader (x-load, u-boot) and kernel (uImage).

### 6. Wait for the device to boot

After the firmware is flashed successfully, you should see our logo on the device screen:

![NoLongerEvil Logo](assets/firmware_logo.png)

**Important:**
- Keep the device plugged in via USB
- Wait for the device to complete its boot sequence (this may take 3-4 minutes)
- Do not disconnect or power off the device during this time

### 7. Register your account

Once the device has fully rebooted:

1. Visit **[https://nolongerevil.com](https://nolongerevil.com)** in your web browser
2. **Register an account** (or sign in if you already have one)
3. Navigate to your **Dashboard**

You will see a "No devices" screen that prompts you for an entry code.

### 8. Link your device

To link your Nest device to your NoLongerEvil account:

1. On your Nest device, navigate to: **Settings → Nest App → Get Entry Code**
2. The device will display a unique entry code
3. Enter this code on the NoLongerEvil dashboard
4. Your device is now linked and ready to use!

## What Gets Flashed

The firmware installation process installs three components:

1. **x-load.bin** - First-stage bootloader (X-Loader for OMAP)
2. **u-boot.bin** - Second-stage bootloader (Das U-Boot) loaded at address 0x80100000
3. **uImage** - Linux kernel image loaded at address 0x80A00000

After flashing, the device jumps to execution at 0x80100000 (u-boot).

## Security Considerations

This tool provides low-level access to the device's boot process. Use responsibly:

- Only use on devices you own
- Improper firmware can brick your device (Don't sue me bro)

## Credits & Acknowledgments

This project builds upon the excellent work of several security researchers and developers:

- **[grant-h](https://github.com/grant-h) / [ajb142](https://github.com/ajb142)** - [omap_loader](https://github.com/ajb142/omap_loader), the USB bootloader tool used to flash OMAP devices
- **[exploiteers (GTVHacker)](https://github.com/exploiteers)** - Original research and development of the [Nest DFU attack](https://github.com/exploiteers/NestDFUAttack), which demonstrated the ability to flash custom firmware to Nest devices gen 1 & gen 2
- **[FULU](https://bounties.fulu.org/)** and all bounty backers - For funding the [Nest Learning Thermostat Gen 1/2 bounty](https://bounties.fulu.org/bounties/nest-learning-thermostat-gen-1-2) and supporting the right-to-repair movement

Without their groundbreaking research, open-source contributions, and advocacy for device ownership rights, this work would not be possible. Thank you!

### Open Source Commitment

We are committed to transparency and the right-to-repair movement. The firmware images and backend API server code will be open sourced soon, allowing the community to audit, improve, and self-host their own infrastructure.

## References

- [OMAP Loader by ajb142](https://github.com/ajb142/omap_loader)
- [Nest DFU Attack by exploiteers](https://github.com/exploiteers/NestDFUAttack)