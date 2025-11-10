#!/usr/bin/env bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$BUILD_DIR"

LINUX_DIR="deps/linux/linux"
TOOLCHAIN_PREFIX="arm-none-linux-gnueabi-"
OUTPUT_DIR="firmware"
INITRAMFS="deps/linux/initramfs_data.cpio"

if [ ! -d "$LINUX_DIR" ]; then
  echo "[!] Error: Linux kernel source not found at $LINUX_DIR"
  echo "[!] Run download-deps.sh first to clone the kernel source"
  exit 1
fi

if [ ! -f "$INITRAMFS" ]; then
  echo "[!] Error: initramfs not found at $INITRAMFS"
  echo "[!] Run build-initramfs.sh first to create the initramfs"
  exit 1
fi

if ! command -v ${TOOLCHAIN_PREFIX}gcc >/dev/null 2>&1; then
  echo "[!] Error: ARM toolchain not found in PATH"
  exit 1
fi

echo "[→] Building Linux kernel..."

cd "$LINUX_DIR"

echo "[→] Configuring with gtvhacker_defconfig..."
make ARCH=arm distclean gtvhacker_defconfig

echo "[→] Compiling kernel with embedded initramfs (this may take several minutes)..."
make ARCH=arm CROSS_COMPILE=$TOOLCHAIN_PREFIX uImage \
  -j$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

if [ -f arch/arm/boot/uImage ]; then
  echo "[→] Copying uImage to firmware directory..."
  mkdir -p "$BUILD_DIR/$OUTPUT_DIR"
  cp arch/arm/boot/uImage "$BUILD_DIR/$OUTPUT_DIR/uImage"

  cd "$BUILD_DIR"
  echo "[✓] Kernel built successfully: firmware/uImage"

  SIZE=$(du -h "$OUTPUT_DIR/uImage" | cut -f1)
  echo "    Size: $SIZE"
else
  echo "[!] Error: uImage was not created"
  exit 1
fi

echo
