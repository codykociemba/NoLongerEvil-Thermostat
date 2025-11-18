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
  cp "$ENV_TEMPLATE" "$SERVER_DIR/.env.local"
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
  local enable_root="$3"
  local enable_backplate="$4"
  echo ""
  echo "Preparing firmware build for ${api_url}..."

  local api_host=$(echo "$api_url" | sed -E 's|https?://||' | sed 's|/.*||' | sed 's|:.*||')
  echo "[→] Generating SSL certificates for ${api_host}..."
  (cd "$BUILDER_DIR" && bash scripts/generate-certs.sh "$api_host")

  echo ""
  echo "[→] Building firmware in Docker..."
  echo ""

  local build_args="--api-url $api_url --generation $generation"
  if [ "$enable_root" = true ]; then
    build_args="$build_args --enable-root-access"
  fi
  if [ "$enable_backplate" = true ]; then
    build_args="$build_args --enable-backplate-sim"
  fi

  local build_log="$ROOT_DIR/firmware_build.log"
  (cd "$BUILDER_DIR" && bash docker-build.sh $build_args) | tee "$build_log"

  FIRMWARE_ROOT_PASSWORD=$(grep "Password:" "$build_log" | grep -oE "[A-Za-z0-9]{18}" | tail -1)

  echo ""
  echo "[→] Copying firmware files to installer..."
  local installer_firmware="$ROOT_DIR/firmware/installer/resources/firmware"
  mkdir -p "$installer_firmware"

  if [ -f "$BUILDER_DIR/firmware/x-load.bin" ]; then
    cp "$BUILDER_DIR/firmware/x-load.bin" "$installer_firmware/"
  fi

  if [ -f "$BUILDER_DIR/firmware/u-boot.bin" ]; then
    cp "$BUILDER_DIR/firmware/u-boot.bin" "$installer_firmware/"
  fi

  if [ -f "$BUILDER_DIR/firmware/uImage" ]; then
    cp "$BUILDER_DIR/firmware/uImage" "$installer_firmware/"
  fi

  echo ""
  local installer_firmware="$ROOT_DIR/firmware/installer/resources/firmware"

  if [ ! -f "$installer_firmware/x-load.bin" ] || [ ! -f "$installer_firmware/u-boot.bin" ] || [ ! -f "$installer_firmware/uImage" ]; then
    echo "[!] Error: Firmware files failed to build"
    echo "    Missing files in firmware/installer/resources/firmware/"
    exit 1
  fi

  echo "[✓] All firmware files verified"

  echo ""
  local installer_dir="$ROOT_DIR/firmware/installer"

  if [ ! -d "$installer_dir" ]; then
    echo "[!] Error: Installer directory not found"
    exit 1
  fi

  cd "$installer_dir"

  if [ ! -d "node_modules" ]; then
    echo "[→] Installing Firmware installer dependencies..."
    npm install
  fi

  echo "[✓] Starting Firmware installer GUI..."
  npm run electron:dev
}

launch_installer() {
  local installer_dir="$ROOT_DIR/firmware/installer"

  if [ ! -d "$installer_dir" ]; then
    echo "[!] Error: Installer directory not found"
    return 1
  fi

  echo ""
  echo "[→] Launching Firmware installer..."

  cd "$installer_dir"

  if [ ! -d "node_modules" ]; then
    echo "[→] Installing Firmware installer dependencies..."
    npm install
  fi

  echo "[✓] Starting Firmware installer GUI..."
  npm run electron:dev
}

setup_selfhost() {
  # Here is where we can put the different supported backend setup.
  # Right now only Convex...
  local which_backend="CONVEX"

  # Question here on which setup the user wants to use
  # which_backend=$(prompt_value "Which backend do you want to use?" "CONVEX")
  case $which_backend in
    CONVEX)
      setup_convex
      ;;
    MQTT)
      setup_mqtt
      ;;
  esac
  
  build_server_image

  echo "Self-Host setup complete for $which_backend. You can "
  echo "now run with docker compose."
  echo ""
  echo "  docker compose up -d"
  echo ""
}

setup_convex() {
  local generated_admin_key=""

  echo "[→] Setup docker-compose.yml"
  cp docker-compose-convex.yml docker-compose.yml

  if [ -d $ROOT_DIR/convex ]; then
    if prompt_yes_no "Convex data folder already exists. Do you want to recreate?" "n"; then
      rm -fr $ROOT_DIR/convex
      mkdir -p $ROOT_DIR/convex/data
    fi
  fi

  echo "[→] Starting Convex Backend..."
  docker compose up -d backend
  echo "[→] Getting Convex Admin Key..."
  generated_admin_key=$(docker compose exec backend ./generate_admin_key.sh)
  echo ""
  echo "[✓] Key = $generated_admin_key"
  echo ""

  echo "[→] Updating Server .env.local for Convex Initialization"
  update_env_value "CONVEX_SELF_HOSTED_URL" "http://127.0.0.1:3210"
  update_env_value "CONVEX_SELF_HOSTED_ADMIN_KEY" "$generated_admin_key"
  cp $ENV_TEMPLATE $SERVER_DIR/.env.local

  echo "[→] Initializing Server and Convex"
  cd $SERVER_DIR
  npm install
  npx convex deploy
  echo "[→] Stopping Convex Backend."
  cd $ROOT_DIR
  docker compose stop backend
  
  echo "[→] Update Server .env.local to use Convex Docker"
  update_env_value "CONVEX_SELF_HOSTED_URL" "http://backend:3210"
  update_env_value "CONVEX_URL" "http://backend:3210"
  echo ""
}

setup_mqtt() {
  echo "Setup MQTT"
}

build_server_image() {
  cd $ROOT_DIR
  echo "[→] Build nolongerevil docker image."
  docker build -t nolongerevil .
  echo ""
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

echo ""
echo "Advanced Firmware Options"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  WARNING: The following options are advanced features."
echo "   Only enable them if you know what they do."
echo ""

ENABLE_ROOT_ACCESS=false
if prompt_yes_no "Enable SSH root access on the thermostat?" "n"; then
  ENABLE_ROOT_ACCESS=true
  echo "Root access will be enabled (SSH on port 22)"
else
  echo "Root access disabled"
fi

ENABLE_BACKPLATE_SIM=false
if prompt_yes_no "Enable backplate simulation?" "n"; then
  ENABLE_BACKPLATE_SIM=true
  echo "Backplate simulation will be enabled"
else
  echo "Backplate simulation disabled"
fi

nest_generation="gen2"

if [ -f "firmware/installer/resources/firmware/x-load.bin" ] && [ -f "firmware/installer/resources/firmware/u-boot.bin" ] && [ -f "firmware/installer/resources/firmware/uImage" ]; then
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
      build_firmware "$api_origin" "$nest_generation" "$ENABLE_ROOT_ACCESS" "$ENABLE_BACKPLATE_SIM"
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
    build_firmware "$api_origin" "$nest_generation" "$ENABLE_ROOT_ACCESS" "$ENABLE_BACKPLATE_SIM"
  fi
fi

echo ""
echo "============================================="
echo "  Setup Complete"
echo "============================================="
echo ""

if [ -f "firmware/installer/resources/firmware/x-load.bin" ] && [ -f "firmware/installer/resources/firmware/u-boot.bin" ] && [ -f "firmware/installer/resources/firmware/uImage" ]; then
  echo "Firmware files ready:"
  echo "  x-load.bin    $(du -h firmware/installer/resources/firmware/x-load.bin | cut -f1)"
  echo "  u-boot.bin    $(du -h firmware/installer/resources/firmware/u-boot.bin | cut -f1)"
  echo "  uImage        $(du -h firmware/installer/resources/firmware/uImage | cut -f1)"
  echo ""
fi

if [ -n "${FIRMWARE_ROOT_PASSWORD:-}" ]; then
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

if [ -f "firmware/installer/resources/firmware/x-load.bin" ] && [ -f "firmware/installer/resources/firmware/u-boot.bin" ] && [ -f "firmware/installer/resources/firmware/uImage" ]; then
  launch_installer
fi

echo ""
echo "============================================="
echo "  Next Steps"
echo "============================================="
echo ""
echo "The Electron installer GUI should have launched."
echo "If not, you can start it manually with:"
echo "  cd firmware/installer && npm run electron:dev"
echo ""

if [ "$api_origin" = "https://backdoor.nolongerevil.com" ]; then
  echo "After flashing firmware:"
  echo "1. Go to https://nolongerevil.com"
  echo "2. Enter your entry code when prompted"
  echo "3. Your Nest will connect to the NoLongerEvil service"
  echo ""

  exit 0
else
  if prompt_yes_no "Create Self-Hosting Server" "n"; then
    setup_selfhost
    echo ""
  else
    echo "After flashing firmware:"
    echo "1. Start your self-hosted server:"
    echo "   cd server && npm install && npm run start"
    echo "2. Your Nest will connect to: $api_origin"
    echo ""
  fi
fi