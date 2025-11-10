# No Longer Evil Self-Hosting Kit

This folder packages everything needed to self-host the No Longer Evil Nest API as a clean, redistributable open-source drop. It contains two major building blocks:

- `server/` – the hardened HTTPS API (Node.js) that devices talk to.
- `firmware/` – tools to build (`firmware/builder`) and flash (`firmware/installer`) Nest firmware that points at your self-hosted API.

The top-level `install.sh` script ties these pieces together so users can bootstrap an environment without touching individual configuration files.

## Directory Layout

```
self-hosting-kit/
├── install.sh              # Guided setup (env vars, certs, firmware build)
├── README.md               # This file
├── server/                 # Stand-alone Node HTTPS API
│   ├── index.js
│   ├── lib/
│   ├── certs/              # Filled by install.sh
│   ├── .env.example
│   └── package.json
└── firmware/
    ├── builder/            # Full build pipeline (kernel, certs, initramfs…)
    └── installer/          # DFU loader for flashing devices
```

## Quick Start

1. **Run the guided installer**

   ```bash
   cd self-hosting-kit
   bash install.sh
   ```

   The script will:
   - Prompt for the public API URL, HTTPS port, control port, and Clerk keys.
   - Update `server/.env.example` (and create `server/.env`) with the answers.
   - Generate self-signed certificates for both the API and the Nest firmware trust store.
   - Optionally kick off `firmware/builder/build.sh --yes --api-url <origin>` to produce `x-load.bin`, `u-boot.bin`, `uImage`, and matching certs in `firmware/builder/output/`.

2. **Install API dependencies and start the server**

   ```bash
   cd server
   npm install
   npm run start
   ```

   The server reads `API_ORIGIN`, `PROXY_PORT`, and `CONTROL_PORT` from `.env`. Self-hosted instances default to the certs in `server/certs`, but you can point `SSL_CERT_DIR` elsewhere if you already have production certificates.

3. **Flash the firmware**

   - If you built custom firmware, grab the artifacts from `firmware/builder/output/`.
   - Use the cross-platform scripts inside `firmware/installer/` (`build.sh` for the USB loader, `install.sh` to push the images) to flash your Nest in DFU mode.

## Scripts & Tooling

- `install.sh` – single entry point; validates input, rewrites env files, runs `scripts/generate-certs.sh`, copies certs into `server/certs`, and can call the firmware builder non-interactively.
- `firmware/builder/build.sh` – now accepts `--yes` / `--api-url` for CI-style automation. It handles dependency downloads, config file rewrites, SSL issuance, initramfs + kernel builds, and produces everything under `output/`.
- `firmware/installer/install.sh` – platform-aware loader that flashes `x-load.bin`, `u-boot.bin`, and `uImage` via USB (Linux/macOS/Windows via WSL or Git Bash).

## Requirements

- **Server/API**: Node 18+, npm, OpenSSL (for cert generation if you skip `install.sh`), optional Convex deployment for persistence.
- **Firmware builder**: bash, git, curl, tar, gzip, cpio, sed, openssl, make/gcc, plus the ARM cross toolchain that `scripts/download-deps.sh` fetches automatically.
- **Firmware installer**: bash + libusb (see `firmware/installer/README.md`).

## Tips

- Re-run `install.sh` any time you need to regenerate certs or change the API origin; it will safely rewrite `.env.example` and copy the new values to `.env`.
- Pass `--yes --api-url https://api.your-domain.com` to `firmware/builder/build.sh` if you want to script firmware builds outside of the installer.
- The generated CA certificate in `firmware/builder/output/certs/ca-cert.pem` is what the Nest firmware trusts. Keep the matching CA private key safe if you plan to rotate certificates later.
- To switch to production certificates, drop them in `server/certs/` as `nest_server.key` / `nest_server.crt` or point `SSL_CERT_DIR` to a different folder.

With this layout, you can publish the `self-hosting-kit` directory to GitHub and give end users a concise, auditable bootstrap story.
