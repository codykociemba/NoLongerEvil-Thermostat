# Nest Thermostat Firmware Setup

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-donate-yellow.svg)](https://buymeacoffee.com/codykociemba)
[![Discord](https://img.shields.io/badge/Discord-Join%20Us-5865F2?logo=discord&logoColor=white)](https://discord.gg/hackhouse)
[![Release](https://img.shields.io/badge/Release-v1.0.1-blue)](https://github.com/codykociemba/NoLongerEvil-Thermostat/releases/tag/v1.0.1)

<div align="center">
  <a href="https://bounties.fulu.org/bounties/nest-learning-thermostat-gen-1-2">
    <img src="assets/fulu-bounties.png" alt="FULU Bounties Winner" width="500">
  </a>
  <h2>🏆 FULU Bounty Winner 🏆</h2>
  <p><strong><a href="https://hackhouse.io">Hack House</a></strong> and this project are the official winners of the <strong><a href="https://bounties.fulu.org/bounties/nest-learning-thermostat-gen-1-2">FULU Bounty for Nest Learning Thermostat Gen 1/2</a></strong></p>
</div>

**Hardware Alternative:** If you're interested in the hardware side of things, check out [https://sett.homes](https://sett.homes) for a drop-in PCB replacement option.

---

## Installation

### Option 1: GUI Installer - **Recommended**

📖 **[Follow the installation guide at docs.nolongerevil.com](https://docs.nolongerevil.com/hosted/installation)** or [download the latest release](https://github.com/codykociemba/NoLongerEvil-Thermostat/releases) directly.

The installer handles everything — flashing the firmware and walking you through setup. During setup, choose your hosting mode:
- **Cloud-hosted** — connects to the No Longer Evil platform; no server setup required
- **Self-hosted (Home Assistant)** — auto-discovers your Home Assistant instance and connects to the No Longer Evil add-on
- **Self-hosted (NLE Server)** — connects to a standalone No Longer Evil server at a custom IP and port

> **Self-hosting?** You'll need to set up your server infrastructure separately before running the installer. See the [Self-Hosted Guide](https://docs.nolongerevil.com/self-hosted/overview).

### Option 2: Build from Source

If you'd rather build and run the installer yourself instead of downloading a release:

---

### Prerequisites

- **Node.js 18+** and npm
- **Docker** — only needed if rebuilding firmware from source ([Install Docker](https://www.docker.com/products/docker-desktop))
- **macOS/Linux** — Windows is not supported for building or flashing

### 1. Clone the Repository

```bash
git clone https://github.com/codykociemba/NoLongerEvil-Thermostat.git
cd NoLongerEvil-Thermostat
```

### 2. Build the Firmware (optional)

The repo already includes pre-built firmware files in `firmware/installer/resources/firmware/`. This step is only needed if you want to customize the firmware (e.g. a different server URL).

```bash
cd firmware/builder
./docker-build.sh --generation both --enable-root-access --yes
```

This builds for both Nest Gen 1 and Gen 2 inside Docker. Afterwards, copy the output to the installer:

```bash
cp firmware/builder/firmware/* firmware/installer/resources/firmware/
```

### 3. Build or Run the Installer

```bash
cd firmware/installer
npm install
```

**Run directly (no build needed):**
```bash
npm run electron:dev
```

**Or build a distributable:**
```bash
npm run package:mac    # macOS
npm run package:linux  # Linux
```

Output is in `firmware/installer/dist/`. Open the built app and follow the on-screen steps.

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