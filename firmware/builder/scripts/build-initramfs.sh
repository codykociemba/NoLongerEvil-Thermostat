#!/usr/bin/env bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$BUILD_DIR"

ROOT_DIR="deps/root"
BASE_CPIO="deps/initramfs_data.cpio"
MODE="$1"
API_URL="$2"
NON_INTERACTIVE="${3:-false}"

if [ ! -f "$BASE_CPIO" ]; then
  echo "[!] Error: Base initramfs not found at $BASE_CPIO"
  echo "[!] Please ensure initramfs_data.cpio exists in deps/"
  exit 1
fi

if [ "$MODE" = "extract" ]; then
  echo "[→] Extracting base initramfs..."

  if [ -d "$BUILD_DIR/$ROOT_DIR" ] && [ -d "$BUILD_DIR/$ROOT_DIR/etc" ] && [ -d "$BUILD_DIR/$ROOT_DIR/bin" ]; then
    echo "[✓] Filesystem already extracted to $ROOT_DIR (skipping extraction)"
    exit 0
  fi

  if [ ! -f "$BUILD_DIR/$BASE_CPIO" ]; then
    echo "[!] Error: Base initramfs not found at $BUILD_DIR/$BASE_CPIO"
    exit 1
  fi

  if [ ! -r "$BUILD_DIR/$BASE_CPIO" ]; then
    echo "[!] Error: Cannot read $BUILD_DIR/$BASE_CPIO (permission denied)"
    exit 1
  fi

  rm -rf "$BUILD_DIR/$ROOT_DIR"
  mkdir -p "$BUILD_DIR/$ROOT_DIR"

  cd "$BUILD_DIR/$ROOT_DIR"

  echo "[→] Running cpio extraction..."
  set +e  
  cpio -id < "$BUILD_DIR/$BASE_CPIO" 2>/dev/null
  EXTRACT_EXIT=$?
  set -e  

  cd "$BUILD_DIR"

  if [ ! -d "$BUILD_DIR/$ROOT_DIR/etc" ] || [ ! -d "$BUILD_DIR/$ROOT_DIR/bin" ]; then
    echo "[!] Error: Extraction failed - no filesystem found in $ROOT_DIR"
    echo "[!] cpio exit code was: $EXTRACT_EXIT"
    exit 1
  fi

  echo "[!] Note: Device node errors are expected in Docker and can be ignored"

  echo "[✓] Filesystem extracted to $ROOT_DIR"

elif [ "$MODE" = "pack" ]; then

  if [ -z "$API_URL" ]; then
    echo "[!] Error: API_URL not provided for pack mode"
    echo "Usage: $0 pack <api_url>"
    exit 1
  fi

  if [ ! -d "$BUILD_DIR/$ROOT_DIR" ]; then
    echo "[!] Error: $ROOT_DIR directory not found. Run 'extract' mode first."
    exit 1
  fi

  echo "[→] Updating configuration with API URL: $API_URL"

  CLIENT_CONFIG="$BUILD_DIR/$ROOT_DIR/etc/nestlabs/client.config"

  if [ -f "$CLIENT_CONFIG" ]; then
    ENTRY_URL="$API_URL"
    if [[ ! "$ENTRY_URL" =~ /entry$ ]]; then
      ENTRY_URL="${ENTRY_URL}/entry"
    fi

    sed -i.bak "s|<a key=\"cloudregisterurl\" value=\"[^\"]*\"|<a key=\"cloudregisterurl\" value=\"$ENTRY_URL\"|g" "$CLIENT_CONFIG"
    rm -f "$CLIENT_CONFIG.bak"

    if grep -q "cloudregisterurl.*value=\"$ENTRY_URL\"" "$CLIENT_CONFIG"; then
      echo "[✓] Updated cloudregisterurl to: $ENTRY_URL"
    else
      echo "[!] Warning: Failed to update cloudregisterurl in $CLIENT_CONFIG"
      echo "[!] Please verify the file manually"
    fi
  else
    echo "[!] Warning: client.config not found at $CLIENT_CONFIG"
  fi

  if [ "$NON_INTERACTIVE" != "true" ]; then
    echo ""
    echo "[!] Filesystem ready at: $ROOT_DIR"
    echo "[!] CA certificate should be at: $ROOT_DIR/etc/ssl/certs/ca-bundle.pem"
    echo "[!] You can modify any files in the filesystem if needed."
    echo ""
    read -p "Press Enter to continue packing the filesystem (or Ctrl+C to abort)... "
  fi

  echo "[→] Packing modified filesystem..."
  cd "$BUILD_DIR/$ROOT_DIR"

  echo "[→] Ensuring nle scripts are executable..."
  chmod +x bin/nle
  chmod +x etc/init.d/nle

  find . -print0 | cpio -o -0 -H newc -R 0:0 > "$BUILD_DIR/deps/linux/initramfs_data.cpio" 2>/dev/null

  cd "$BUILD_DIR"

  SIZE=$(du -h "deps/linux/initramfs_data.cpio" | cut -f1)
  echo "[✓] Initramfs rebuilt successfully: deps/linux/initramfs_data.cpio ($SIZE)"

  echo "[→] Copying initramfs to firmware directory..."
  mkdir -p "$BUILD_DIR/firmware"
  cp "deps/linux/initramfs_data.cpio" "$BUILD_DIR/firmware/initramfs_data.cpio"
  echo "[✓] Initramfs copied to firmware/initramfs_data.cpio"

  rm -rf "$BUILD_DIR/$ROOT_DIR"

else
  echo "Usage: $0 {extract|pack} [api_url]"
  echo ""
  echo "  extract           - Extract the base initramfs to deps/root"
  echo "  pack <api_url>    - Update config and pack the initramfs"
  exit 1
fi

echo
