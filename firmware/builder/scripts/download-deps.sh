#!/usr/bin/env bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$BUILD_DIR"

# This script is called from inside Docker - no platform checks needed
# Docker ensures we're always running on Linux

download_toolchain() {
  if [ -d "deps/toolchain/arm-2008q3" ]; then
    echo "[✓] ARM toolchain already downloaded"
    return 0
  fi

  echo "[→] Downloading ARM toolchain from embeddedTS..."
  mkdir -p deps/toolchain
  cd deps/toolchain

  curl -L -f \
    "https://files.embeddedts.com/ftp/ts-socket-macrocontrollers/ts-4200-linux/cross-toolchains/arm-2008q3-72-arm-none-linux-gnueabi-i686-pc-linux-gnu.tar.bz2" \
    -o toolchain.tar.bz2

  if [ ! -f toolchain.tar.bz2 ] || [ ! -s toolchain.tar.bz2 ]; then
    echo "[!] Error: Failed to download toolchain"
    cd ../..
    return 1
  fi

  echo "[→] Extracting toolchain..."
  tar xjvf toolchain.tar.bz2
  echo "[✓] Toolchain extracted"

  rm toolchain.tar.bz2

  cd ../..

  if [ -d "deps/toolchain/arm-2008q3" ]; then
    echo "[✓] ARM toolchain ready"
  else
    echo "[!] Error: Toolchain extraction failed"
    return 1
  fi
}

download_xloader() {
  if [ -d "deps/x-loader" ]; then
    echo "[✓] x-loader already downloaded"
    return 0
  fi

  echo "[→] Cloning x-loader from Google..."
  git clone https://nest-open-source.googlesource.com/nest-learning-thermostat/5.9.4/x-loader deps/x-loader
  echo "[✓] x-loader cloned"
}

download_uboot() {
  if [ -d "deps/u-boot" ]; then
    echo "[✓] u-boot already downloaded"
    return 0
  fi

  echo "[→] Cloning u-boot from NestDFUAttack..."

  if [ ! -d "deps/nestdfu-tmp" ]; then
    git clone --depth=1 https://github.com/exploiteers/NestDFUAttack.git deps/nestdfu-tmp
  fi

  mkdir -p deps/u-boot
  mv deps/nestdfu-tmp/Dev/u-boot deps/u-boot/u-boot

  echo "[✓] u-boot cloned from NestDFUAttack"
}

download_linux() {
  if [ -d "deps/linux" ] && [ -f "deps/linux/linux/Makefile" ]; then
    echo "[✓] Linux kernel already downloaded"

    if [ ! -f "deps/initramfs_data.cpio" ]; then
      echo "[→] initramfs_data.cpio missing, downloading from NestDFUAttack..."
      if [ ! -d "deps/nestdfu-tmp" ]; then
        git clone --depth=1 https://github.com/exploiteers/NestDFUAttack.git deps/nestdfu-tmp
      fi

      if [ -f "deps/nestdfu-tmp/Dev/initramfs_data.cpio" ]; then
        cp deps/nestdfu-tmp/Dev/initramfs_data.cpio deps/initramfs_data.cpio
        echo "[✓] Base initramfs copied from NestDFUAttack"
      fi

      rm -rf deps/nestdfu-tmp
    fi

    return 0
  fi

  if [ -d "deps/linux" ]; then
    echo "[→] Cleaning up partial Linux kernel clone..."
    rm -rf deps/linux
  fi

  echo "[→] Cloning Linux kernel from NestDFUAttack..."

  if [ ! -d "deps/nestdfu-tmp" ]; then
    git clone --depth=1 https://github.com/exploiteers/NestDFUAttack.git deps/nestdfu-tmp
  fi

  mkdir -p deps/linux
  mv deps/nestdfu-tmp/Dev/linux deps/linux/linux

  if [ ! -f "deps/initramfs_data.cpio" ]; then
    echo "[→] Copying initramfs_data.cpio from NestDFUAttack..."
    if [ -f "deps/nestdfu-tmp/Dev/initramfs_data.cpio" ]; then
      cp deps/nestdfu-tmp/Dev/initramfs_data.cpio deps/initramfs_data.cpio
      echo "[✓] Base initramfs copied from NestDFUAttack"
    else
      echo "[!] Warning: initramfs_data.cpio not found in NestDFUAttack clone"
    fi
  else
    echo "[✓] initramfs_data.cpio already exists (skipping copy)"
  fi

  rm -rf deps/nestdfu-tmp

  if [ ! -f "deps/linux/linux/Makefile" ]; then
    echo "[!] Error: Linux kernel appears incomplete (no Makefile found)"
    return 1
  fi

  CUSTOM_LOGO_PPM="$BUILD_DIR/deps/logo_nest_clut224.ppm"
  KERNEL_LOGO_DIR="deps/linux/linux/drivers/video/logo"
  GTVHACKER_LOGO="$KERNEL_LOGO_DIR/logo_gtvhacker_clut224.ppm"

  if [ -f "$CUSTOM_LOGO_PPM" ]; then
    if [ -f "$GTVHACKER_LOGO" ]; then
      echo "[→] Replacing GTVHacker logo with custom NoLongerEvil logo..."
      cp "$CUSTOM_LOGO_PPM" "$GTVHACKER_LOGO"
      echo "[✓] Custom logo installed"
    else
      echo "[!] Warning: GTVHacker logo not found at $GTVHACKER_LOGO"
    fi
  else
    echo "[!] Warning: Custom logo not found at $CUSTOM_LOGO_PPM"
  fi

  echo "[✓] Linux kernel cloned from NestDFUAttack"
}

setup_toolchain_path() {
  local toolchain_path="$BUILD_DIR/deps/toolchain/arm-2008q3/bin"

  if [ -d "$toolchain_path" ]; then
    export PATH="$toolchain_path:$PATH"
    echo "[✓] Toolchain added to PATH"
  else
    echo "[!] Warning: Toolchain not found at $toolchain_path"
    if [ -d "deps/toolchain/arm-2008q3/bin" ]; then
      export PATH="$(pwd)/deps/toolchain/arm-2008q3/bin:$PATH"
      echo "[✓] Toolchain found and added to PATH"
    else
      echo "[!] Error: Could not locate toolchain"
      return 1
    fi
  fi
}

DOWNLOAD_XLOADER=false
DOWNLOAD_UBOOT=false
DOWNLOAD_LINUX=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --xloader)
      DOWNLOAD_XLOADER=true
      shift
      ;;
    --uboot)
      DOWNLOAD_UBOOT=true
      shift
      ;;
    --linux)
      DOWNLOAD_LINUX=true
      shift
      ;;
    *)
      shift
      ;;
  esac
done

if [ "$DOWNLOAD_XLOADER" = false ] && [ "$DOWNLOAD_UBOOT" = false ] && [ "$DOWNLOAD_LINUX" = false ]; then
  DOWNLOAD_XLOADER=true
  DOWNLOAD_UBOOT=true
  DOWNLOAD_LINUX=true
fi

echo "═══════════════════════════════════════════════════════"
echo " Downloading Build Dependencies"
echo "═══════════════════════════════════════════════════════"
echo

download_toolchain

if [ "$DOWNLOAD_XLOADER" = true ]; then
  download_xloader
else
  echo "[→] Skipping x-loader download (not needed)"
fi

if [ "$DOWNLOAD_UBOOT" = true ]; then
  download_uboot
else
  echo "[→] Skipping u-boot download (not needed)"
fi

if [ "$DOWNLOAD_LINUX" = true ]; then
  download_linux
else
  echo "[→] Skipping Linux kernel download (not needed)"
fi

setup_toolchain_path

echo
echo "[✓] All required dependencies ready!"
echo
if [ "$DOWNLOAD_LINUX" = true ]; then
  echo "Note: Base initramfs (initramfs_data.cpio) should already be present in source/"
fi
