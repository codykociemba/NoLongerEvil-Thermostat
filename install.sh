#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$ROOT_DIR/server"
ENV_TEMPLATE="$SERVER_DIR/.env.example"
CERT_DIR="$SERVER_DIR/certs"
BUILDER_DIR="$ROOT_DIR/firmware/builder"

require_cmd() {
  local missing=()
  for cmd in "$@"; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      missing+=("$cmd")
    fi
  done

  if [ "${#missing[@]}" -ne 0 ]; then
    echo "Missing required commands: ${missing[*]}"
    echo "Please install them and re-run this script."
    exit 1
  fi
}

prompt_value() {
  local prompt="$1"
  local default="${2:-}"
  local value

  if [ -n "$default" ]; then
    read -r -p "$prompt [$default]: " value
    value="${value:-$default}"
  else
    read -r -p "$prompt: " value
  fi

  value="${value//$'\n'/}"
  value="${value//$'\r'/}"

  echo "$value"
}

prompt_secret() {
  local prompt="$1"
  local value
  while true; do
    read -r -s -p "$prompt: " value
    echo >&2
    if [ -n "$value" ]; then
      value="${value//$'\n'/}"
      value="${value//$'\r'/}"
      echo "$value"
      return
    fi
    echo "Value required." >&2
  done
}

prompt_yes_no() {
  local prompt="$1"
  local default="$2"
  local options response

  if [ "$default" = "y" ]; then
    options="[Y/n]"
  else
    options="[y/N]"
  fi

  while true; do
    read -r -p "$prompt $options " response
    response="${response:-$default}"
    case "$response" in
      [Yy]*) return 0 ;;
      [Nn]*) return 1 ;;
      *) echo "Please answer y or n." ;;
    esac
  done
}

normalize_url() {
  local raw="$1"
  if [[ "$raw" != http://* && "$raw" != https://* ]]; then
    raw="https://$raw"
  fi
  raw="${raw%/}"
  echo "$raw"
}

extract_host() {
  local url="$1"
  local trimmed="${url#*://}"
  trimmed="${trimmed%%/*}"
  trimmed="${trimmed%%:*}"
  echo "$trimmed"
}

extract_port() {
  local url="$1"
  local trimmed="${url#*://}"
  trimmed="${trimmed%%/*}"
  if [[ "$trimmed" == *:* ]]; then
    echo "${trimmed##*:}"
  else
    echo ""
  fi
}

validate_port() {
  local port="$1"
  if [[ "$port" =~ ^[0-9]+$ ]] && [ "$port" -ge 1 ] && [ "$port" -le 65535 ]; then
    return 0
  fi
  return 1
}

update_env_value() {
  local key="$1"
  local value="$2"
  local tmp
  tmp="$(mktemp)"

  awk -v KEY="$key" -v VALUE="$value" '
    BEGIN { updated=0 }
    {
      if ($0 ~ ("^" KEY "=")) {
        if (!updated) {
          print KEY "=" VALUE
          updated=1
        }
      } else {
        print $0
      }
    }
    END {
      if (updated == 0) {
        print KEY "=" VALUE
      }
    }
  ' "$ENV_TEMPLATE" > "$tmp"

  mv "$tmp" "$ENV_TEMPLATE"
}

write_env_file() {
  update_env_value "API_ORIGIN" "$1"
  update_env_value "PROXY_PORT" "$2"
  update_env_value "CONTROL_PORT" "$3"
  cp "$ENV_TEMPLATE" "$SERVER_DIR/.env"
}

generate_certs() {
  local host="$1"
  echo ""
  echo "Generating SSL certificates for ${host}..."
  mkdir -p "$CERT_DIR"
  (cd "$BUILDER_DIR" && bash scripts/generate-certs.sh --server-only "$host")

  if [ ! -f "$CERT_DIR/nest_server.crt" ] || [ ! -f "$CERT_DIR/nest_server.key" ]; then
    echo "Failed to generate server certificate or key."
    exit 1
  fi

  echo "Certificates generated in server/certs/."
}

build_firmware() {
  local api_url="$1"
  local generation="$2"
  echo ""
  echo "Preparing firmware build for ${api_url}..."

  local api_host=$(echo "$api_url" | sed -E 's|https?://||' | sed 's|/.*||' | sed 's|:.*||')
  echo "[→] Generating SSL certificates for ${api_host}..."
  (cd "$BUILDER_DIR" && bash scripts/generate-certs.sh "$api_host")

  echo ""
  echo "[→] Building firmware in Docker..."
  echo ""

  local build_log="$ROOT_DIR/firmware_build.log"
  (cd "$BUILDER_DIR" && bash docker-build.sh --yes --force-build --build-xloader --build-uboot --api-url "$api_url" --generation "$generation") | tee "$build_log"

  FIRMWARE_ROOT_PASSWORD=$(grep "Password:" "$build_log" | grep -oE "[A-Za-z0-9]{18}" | tail -1)

  echo ""
  echo "[→] Copying firmware files to installer..."
  local installer_bin="$ROOT_DIR/firmware/installer/bin"
  mkdir -p "$installer_bin"

  if [ -f "$BUILDER_DIR/firmware/x-load.bin" ]; then
    cp "$BUILDER_DIR/firmware/x-load.bin" "$installer_bin/"
    echo "[✓] Copied x-load.bin to installer/bin"
  fi

  if [ -f "$BUILDER_DIR/firmware/u-boot.bin" ]; then
    cp "$BUILDER_DIR/firmware/u-boot.bin" "$installer_bin/"
    echo "[✓] Copied u-boot.bin to installer/bin"
  fi

  if [ -f "$BUILDER_DIR/firmware/uImage" ]; then
    cp "$BUILDER_DIR/firmware/uImage" "$installer_bin/"
    echo "[✓] Copied uImage to installer/bin"
  fi

  echo ""
  echo "[→] Building OMAP installer..."
  local installer_dir="$ROOT_DIR/firmware/installer"
  if [ -f "$installer_dir/build.sh" ]; then
    (cd "$installer_dir" && bash build.sh)
    echo "[✓] OMAP installer built successfully"
  else
    echo "[!] Warning: installer/build.sh not found, skipping OMAP build"
  fi

  echo "[→] Cleaning up build artifacts..."
  (cd "$installer_dir/src/omap_loader" && make clean >/dev/null 2>&1)
  echo "[✓] Build cleanup complete"
}

echo "============================================="
echo "  No Longer Evil Self-Hosting Installer"
echo "============================================="
echo ""

require_cmd node npm openssl awk mktemp

check_docker_permissions() {
  if command -v docker >/dev/null 2>&1; then
    if ! docker ps >/dev/null 2>&1; then
      echo ""
      echo "[!] Docker requires elevated permissions."
      echo "    This installer may need to run some commands with sudo."
      echo ""
      sudo -v
      while true; do sudo -n true; sleep 60; kill -0 "$$" || exit; done 2>/dev/null &
    fi
  fi
}

check_docker_permissions

DEFAULT_URL="https://backdoor.nolongerevil.com"
if [ ! -f "$ENV_TEMPLATE" ]; then
  echo "Could not find $ENV_TEMPLATE. Make sure you're running the script from self-hosting-kit/."
  exit 1
fi

while true; do
  api_input=$(prompt_value "Public API URL" "$DEFAULT_URL")
  api_origin=$(normalize_url "$api_input")
  api_host=$(extract_host "$api_origin")
  url_port=$(extract_port "$api_origin")

  if [ -n "$api_host" ]; then
    break
  fi
  echo "Unable to parse a hostname from '$api_input'. Please enter a valid URL or hostname."
done

default_api_port="${url_port:-443}"
default_control_port="8081"

while true; do
  api_port=$(prompt_value "Port to run the API on" "$default_api_port")
  if validate_port "$api_port"; then
    break
  fi
  echo "Invalid port. Enter a value between 1 and 65535."
done

while true; do
  control_port=$(prompt_value "Control API port" "$default_control_port")
  if validate_port "$control_port"; then
    break
  fi
  echo "Invalid port. Enter a value between 1 and 65535."
done

echo ""
echo "Summary"
echo "  API origin:     $api_origin"
echo "  API host:       $api_host"
echo "  API port:       $api_port"
echo "  Control port:   $control_port"
echo ""

if ! prompt_yes_no "Continue with these settings?" "y"; then
  echo "Setup cancelled."
  exit 0
fi

write_env_file "$api_origin" "$api_port" "$control_port"
echo ""
echo "Environment updated (server/.env & .env.example)."

generate_certs "$api_host"

nest_generation="gen2"

if [ -f "firmware/installer/bin/x-load.bin" ] && [ -f "firmware/installer/bin/u-boot.bin" ] && [ -f "firmware/installer/bin/uImage" ]; then
  echo ""
  if prompt_yes_no "Firmware files already exist. Rebuild them?" "n"; then
    if ! command -v docker >/dev/null 2>&1; then
      echo ""
      echo "[!] Docker is not installed."
      echo "    Download from: https://www.docker.com/products/docker-desktop"
      echo ""
      echo "Skipping firmware build. You can build later with:"
      echo "  cd firmware/builder && ./docker-build.sh --api-url $api_origin --generation $nest_generation --force-build"
    else
      build_firmware "$api_origin" "$nest_generation"
    fi
  else
    echo "Using existing firmware files."
  fi
else
  if ! command -v docker >/dev/null 2>&1; then
    echo ""
    echo "[!] Docker is not installed."
    echo "    Download from: https://www.docker.com/products/docker-desktop"
    echo ""
    echo "Skipping firmware build. You can build later with:"
    echo "  cd firmware/builder && ./docker-build.sh --api-url $api_origin --generation $nest_generation --force-build"
  else
    echo ""
    echo "Firmware files not found. Building firmware..."
    build_firmware "$api_origin" "$nest_generation"
  fi
fi

echo ""
echo "============================================="
echo "  Setup Complete"
echo "============================================="
echo ""

if [ -f "firmware/installer/bin/x-load.bin" ] && [ -f "firmware/installer/bin/u-boot.bin" ] && [ -f "firmware/installer/bin/uImage" ]; then
  echo "Firmware files ready:"
  echo "  x-load.bin    $(du -h firmware/installer/bin/x-load.bin | cut -f1)"
  echo "  u-boot.bin    $(du -h firmware/installer/bin/u-boot.bin | cut -f1)"
  echo "  uImage        $(du -h firmware/installer/bin/uImage | cut -f1)"
  echo ""
fi

if [ -n "$FIRMWARE_ROOT_PASSWORD" ]; then
  echo "Root Access Enabled:"
  echo "  Username: root"
  echo "  Password: $FIRMWARE_ROOT_PASSWORD"
  echo ""
  echo "  ⚠️  IMPORTANT: Save this password securely!"
  echo ""
fi

echo "SSL Certificates:"
echo "  Server certificates in: server/certs/"
echo "  - nest_server.crt (server certificate)"
echo "  - nest_server.key (server private key)"
echo "  - ca-cert.pem (CA certificate for firmware)"
echo ""

if [ -f "firmware/installer/install.sh" ]; then
  echo "============================================="
  echo "  Ready to Flash Firmware"
  echo "============================================="
  echo ""
  echo "Put your Nest thermostat into DFU mode:"
  echo "  1. Remove the Nest from the wall"
  echo "  2. Hold down the display while plugging in USB"
  echo "  3. Keep holding for ~10 seconds until display goes blank"
  echo "  4. Release - the Nest is now in DFU mode"
  echo ""

  if prompt_yes_no "Flash firmware now?" "y"; then
    echo ""
    (cd firmware/installer && bash install.sh)
  else
    echo ""
    echo "You can flash later with:"
    echo "  cd firmware/installer && bash install.sh"
  fi
fi

echo ""
echo "============================================="
echo "  Next Steps"
echo "============================================="

if [ "$api_origin" = "https://backdoor.nolongerevil.com" ]; then
  echo "1. Go to https://nolongerevil.com"
  echo "2. Enter your entry code when prompted"
  echo "3. Your Nest will connect to the NoLongerEvil service"
else
  echo "1. Start your self-hosted server:"
  echo "   cd server && npm install && npm run start"
  echo "2. Your Nest will connect to: $api_origin"
fi

echo ""
