#!/usr/bin/env bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$BUILD_DIR"

# Detect platform
OS="$(uname -s)"
case "$OS" in
    Linux*)
        PLATFORM="linux"
        ;;
    Darwin*)
        PLATFORM="macos"
        ;;
    MINGW*|MSYS*|CYGWIN*)
        echo "[!] ERROR: Windows native environments (Git Bash, MSYS2, MinGW) are not supported."
        echo "[!] Please use WSL2 (Windows Subsystem for Linux) instead."
        exit 1
        ;;
    *)
        PLATFORM="unknown"
        ;;
esac

if [ -z "$1" ]; then
  echo "Usage: $0 <api_url>"
  echo "Example: $0 https://192.168.1.100"
  exit 1
fi

API_URL="$1"
TEMP_DIR="temp_cpio"
CONFIG_FILE="$TEMP_DIR/etc/nestlabs/client.config"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "[!] Error: client.config not found at $CONFIG_FILE"
  echo "[!] Make sure build-initramfs.sh has been run first to extract the filesystem"
  exit 1
fi

echo "[→] Updating client.config with API URL: ${API_URL}/entry"

if command -v sed >/dev/null 2>&1; then
  if [ "$PLATFORM" = "macos" ]; then
    sed -i '' \
      's|<a key="cloudregisterurl" value="[^"]*"/>|<a key="cloudregisterurl" value="'"${API_URL}/entry"'"/>|' \
      "$CONFIG_FILE"
  else
    sed -i \
      's|<a key="cloudregisterurl" value="[^"]*"/>|<a key="cloudregisterurl" value="'"${API_URL}/entry"'"/>|' \
      "$CONFIG_FILE"
  fi
else
  echo "[!] Error: sed command not found"
  exit 1
fi

grep "cloudregisterurl" "$CONFIG_FILE" | head -1
echo "[✓] client.config updated"
