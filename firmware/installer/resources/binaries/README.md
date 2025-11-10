# Binary Files

This directory contains the pre-compiled omap_loader binaries for each platform.

## Required Files

- `omap_loader-macos-arm64` - macOS Apple Silicon (ARM64)
- `omap_loader-macos-x64` - macOS Intel (x64)
- `omap_loader-linux-x64` - Linux (x64)
- `omap_loader-win-x64.exe` - Windows (x64)

## Building Binaries

To build the binaries, use the build script in the parent project:

```bash
cd ../..
./build.sh
```

Then copy the built binaries to this directory with the appropriate names.