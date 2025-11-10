#!/usr/bin/env bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$BUILD_DIR"

XLOADER_DIR="deps/x-loader"
UBOOT_DIR="deps/u-boot"
TOOLCHAIN_PREFIX="arm-none-linux-gnueabi-"
OUTPUT_DIR="firmware"
GENERATION=""

if ! command -v ${TOOLCHAIN_PREFIX}gcc >/dev/null 2>&1; then
  echo "[!] Error: ARM toolchain not found in PATH"
  exit 1
fi

build_xloader() {
  if [ ! -d "$XLOADER_DIR" ]; then
    echo "[!] Error: x-loader source not found at $XLOADER_DIR"
    echo "[!] Run download-deps.sh first to clone x-loader"
    return 1
  fi

  echo "[→] Building x-loader..."
  cd "$XLOADER_DIR/x-loader"

  make ARCH=arm CROSS_COMPILE=$TOOLCHAIN_PREFIX distclean 2>/dev/null || true

  if [ "$GENERATION" = "gen2" ]; then
    echo "[→] Configuring x-loader for Gen 2 (j49-usb-loader)..."
    make ARCH=arm CROSS_COMPILE=$TOOLCHAIN_PREFIX j49-usb-loader_config
  else
    echo "[→] Configuring x-loader for Gen 1 (Diamond)..."
    make ARCH=arm CROSS_COMPILE=$TOOLCHAIN_PREFIX diamond_config
  fi

  make ARCH=arm CROSS_COMPILE=$TOOLCHAIN_PREFIX

  if [ -f x-load.bin ]; then
    echo "[→] Copying x-load.bin to firmware directory..."
    mkdir -p "$BUILD_DIR/$OUTPUT_DIR"
    cp x-load.bin "$BUILD_DIR/$OUTPUT_DIR/x-load.bin"

    cd "$BUILD_DIR"
    SIZE=$(du -h "$OUTPUT_DIR/x-load.bin" | cut -f1)
    echo "[✓] x-loader built successfully: firmware/x-load.bin ($SIZE)"
  else
    echo "[!] Error: x-load.bin was not created"
    return 1
  fi
}

build_uboot() {
  if [ ! -d "$UBOOT_DIR" ]; then
    echo "[!] Error: u-boot source not found at $UBOOT_DIR"
    echo "[!] Run download-deps.sh first to clone u-boot"
    return 1
  fi

  echo "[→] Building u-boot..."
  cd "$UBOOT_DIR/u-boot"

  make ARCH=arm CROSS_COMPILE=$TOOLCHAIN_PREFIX distclean 2>/dev/null || true

  echo "[→] Configuring u-boot for Diamond (universal config)..."
  make ARCH=arm CROSS_COMPILE=$TOOLCHAIN_PREFIX diamond

  echo "[→] Building u-boot..."
  make ARCH=arm CROSS_COMPILE=$TOOLCHAIN_PREFIX

  if [ -f u-boot.bin ]; then
    echo "[→] Copying u-boot.bin to firmware directory..."
    mkdir -p "$BUILD_DIR/$OUTPUT_DIR"
    cp u-boot.bin "$BUILD_DIR/$OUTPUT_DIR/u-boot.bin"

    cd "$BUILD_DIR"
    SIZE=$(du -h "$OUTPUT_DIR/u-boot.bin" | cut -f1)
    echo "[✓] u-boot built successfully: firmware/u-boot.bin ($SIZE)"
  else
    echo "[!] Error: u-boot.bin was not created"
    return 1
  fi
}

echo "═══════════════════════════════════════════════════════"
echo " Building Bootloaders"
echo "═══════════════════════════════════════════════════════"
echo

BUILD_XLOADER=false
BUILD_UBOOT=false

while [ $# -gt 0 ]; do
  case "$1" in
    --xloader)
      BUILD_XLOADER=true
      shift
      ;;
    --uboot)
      BUILD_UBOOT=true
      shift
      ;;
    --all)
      BUILD_XLOADER=true
      BUILD_UBOOT=true
      shift
      ;;
    --generation)
      GENERATION="$2"
      shift 2
      ;;
    *)
      echo "Usage: $0 [--xloader] [--uboot] [--all] [--generation gen1|gen2]"
      exit 1
      ;;
  esac
done

if [ "$BUILD_XLOADER" = false ] && [ "$BUILD_UBOOT" = false ]; then
  echo "Usage: $0 [--xloader] [--uboot] [--all] [--generation gen1|gen2]"
  echo
  echo "Options:"
  echo "  --xloader        Build x-loader only"
  echo "  --uboot          Build u-boot only"
  echo "  --all            Build both x-loader and u-boot"
  echo "  --generation     Specify Nest generation (gen1 or gen2, default: gen2)"
  exit 1
fi

if [ -z "$GENERATION" ]; then
  GENERATION="gen2"
fi

if [ "$GENERATION" != "gen1" ] && [ "$GENERATION" != "gen2" ]; then
  echo "[!] Error: Invalid generation. Must be 'gen1' or 'gen2'"
  exit 1
fi

echo "[→] Building for Nest Generation: $GENERATION"
echo

mkdir -p "$OUTPUT_DIR"

if [ "$BUILD_XLOADER" = true ]; then
  build_xloader
  echo
fi

if [ "$BUILD_UBOOT" = true ]; then
  build_uboot
  echo
fi

echo "[✓] Bootloader build complete!"
echo
