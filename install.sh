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

  if [ "$HOSTING_MODE" = "selfhosted" ]; then
    local api_host=$(echo "$api_url" | sed -E 's|https?://||' | sed 's|/.*||' | sed 's|:.*||')
    echo "[→] Generating SSL certificates for ${api_host}..."
    (cd "$BUILDER_DIR" && bash scripts/generate-certs.sh "$api_host")
  fi

  echo ""
  echo "[→] Building firmware in Docker..."
  echo ""

  local build_gen="$generation"
  if [ "$HOSTING_MODE" = "hosted" ]; then
    build_gen="both"
    echo "[→] Building for both generations (hosted mode)"
  fi

  local build_args="--api-url $api_url --generation $build_gen --build-xloader --build-uboot"
  if [ "$HOSTING_MODE" = "hosted" ]; then
    build_args="$build_args --hosted"
  fi
  if [ "$enable_root" = true ]; then
    build_args="$build_args --enable-root-access"
  fi
  if [ "$enable_backplate" = true ]; then
    build_args="$build_args --enable-backplate-sim"
  fi
  
  local build_date_time=`date +"%m%d%Y-%H%M%S"`
  local build_log="$ROOT_DIR/firmware_build_$build_date_time.log"
  (cd "$BUILDER_DIR" && bash docker-build.sh $build_args) | tee "$build_log"

  FIRMWARE_ROOT_PASSWORD=$(grep "Password:" "$build_log" | grep -oE "[A-Za-z0-9]{18}" | tail -1)

  echo ""
  echo "[→] Copying firmware files to installer..."
  local installer_firmware="$ROOT_DIR/firmware/installer/resources/firmware"
  mkdir -p "$installer_firmware"

  if [ -f "$BUILDER_DIR/firmware/x-load-gen1.bin" ]; then
    cp "$BUILDER_DIR/firmware/x-load-gen1.bin" "$installer_firmware/"
  fi

  if [ -f "$BUILDER_DIR/firmware/x-load-gen2.bin" ]; then
    cp "$BUILDER_DIR/firmware/x-load-gen2.bin" "$installer_firmware/"
  fi

  if [ -f "$BUILDER_DIR/firmware/u-boot.bin" ]; then
    cp "$BUILDER_DIR/firmware/u-boot.bin" "$installer_firmware/"
  fi

  if [ -f "$BUILDER_DIR/firmware/uImage" ]; then
    cp "$BUILDER_DIR/firmware/uImage" "$installer_firmware/"
  fi

  echo ""
  local installer_firmware="$ROOT_DIR/firmware/installer/resources/firmware"

  MISSING_FILES=()
  if [ ! -f "$installer_firmware/x-load-gen1.bin" ]; then
    MISSING_FILES+=("x-load-gen1.bin")
  fi
  if [ ! -f "$installer_firmware/x-load-gen2.bin" ]; then
    MISSING_FILES+=("x-load-gen2.bin")
  fi
  if [ ! -f "$installer_firmware/u-boot.bin" ]; then
    MISSING_FILES+=("u-boot.bin")
  fi
  if [ ! -f "$installer_firmware/uImage" ]; then
    MISSING_FILES+=("uImage")
  fi

  if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo "[!] Error: Firmware files failed to build"
    echo "    Missing files in firmware/installer/resources/firmware/:"
    for file in "${MISSING_FILES[@]}"; do
      echo "      - $file"
    done
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
  npm run electron:dev > /dev/null 2>&1 &
  cd "$ROOT_DIR"
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
  npm run electron:dev > /dev/null 2>&1 &
  cd "$ROOT_DIR"
}

setup_selfhost() {
  # Here is where we can put the different supported backend setup.
  # Right now only sqlite...
  local which_backend="SQLITE"

  # Question here on which setup the user wants to use
  # which_backend=$(prompt_value "Which backend do you want to use?" "SQLITE")
  case $which_backend in
    SQLITE)
      setup_sqlite
      ;;
    MQTT)
      setup_mqtt
      ;;
  esac
  
  build_server_app
  build_server_image

  echo "Self-Host setup complete using $which_backend backend. You can "
  echo "now run with docker compose."
  echo ""
  echo "  docker compose up -d"
  echo ""
}

setup_sqlite() {
  echo "Using default backend. (SQLite)"
}

setup_mqtt() {
  echo "Setup MQTT"
}

build_server_app() {
  cd $ROOT_DIR/server
  echo "[->] Build nolongerevil server."
  npm install
  npm run build
  echo ""
}

build_server_image() {
  cd $ROOT_DIR/server
  echo "[→] Build nolongerevil docker image."
  docker build -t nolongerevil .
  echo ""
}

show_help() {
  cat <<EOF
No Longer Evil Installer

Usage: ./install.sh [OPTIONS]

OPTIONS:
  --build-only              Build firmware but don't launch installer
                            (useful for developers building hosted firmware)

  --generation <gen1|gen2>  Specify device generation (gen1 or gen2)
                            Skips interactive generation prompt

  --hosted                  Use hosted mode (No Longer Evil cloud servers)
                            Skips interactive hosting mode prompt

  --selfhosted              Use self-hosted mode (run your own server)
                            Skips interactive hosting mode prompt

  --help, -h                Show this help message

EXAMPLES:
  # Interactive mode (default)
  ./install.sh

  # Build Gen 1 hosted firmware for developers
  ./install.sh --build-only --generation gen1 --hosted

  # Build Gen 2 hosted firmware for developers
  ./install.sh --build-only --generation gen2 --hosted

  # Build self-hosted Gen 2 firmware without launching installer
  ./install.sh --build-only --generation gen2 --selfhosted

  # Use hosted mode with Gen 1 (interactive for other options)
  ./install.sh --hosted --generation gen1

EOF
  exit 0
}

# Parse command line arguments
BUILD_ONLY=false
GENERATION_ARG=""
HOSTING_MODE_ARG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --build-only)
      BUILD_ONLY=true
      shift
      ;;
    --generation)
      if [ -z "${2:-}" ]; then
        echo "Error: --generation requires a value (gen1 or gen2)"
        exit 1
      fi
      if [ "$2" != "gen1" ] && [ "$2" != "gen2" ]; then
        echo "Error: Invalid generation '$2'. Must be 'gen1' or 'gen2'"
        exit 1
      fi
      GENERATION_ARG="$2"
      shift 2
      ;;
    --hosted)
      HOSTING_MODE_ARG="hosted"
      shift
      ;;
    --selfhosted)
      HOSTING_MODE_ARG="selfhosted"
      shift
      ;;
    --help|-h)
      show_help
      ;;
    *)
      echo "Error: Unknown option '$1'"
      echo "Run './install.sh --help' for usage information"
      exit 1
      ;;
  esac
done

echo "============================================="
echo "  No Longer Evil Installer"
echo "============================================="
echo ""

require_cmd openssl awk mktemp

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

# Determine hosting mode
if [ -n "$HOSTING_MODE_ARG" ]; then
  HOSTING_MODE="$HOSTING_MODE_ARG"
  echo "Hosting mode: $HOSTING_MODE (from command line)"
  echo ""
else
  echo ""
  echo "Choose your setup:"
  echo "  1) Hosted (Recommended) - Use No Longer Evil cloud servers"
  echo "  2) Self-hosted - Run your own server"
  echo ""

  HOSTING_MODE=""
  while true; do
    read -r -p "Enter your choice [1-2]: " hosting_choice
    case "$hosting_choice" in
      1)
        HOSTING_MODE="hosted"
        echo "Selected: Hosted mode"
        break
        ;;
      2)
        HOSTING_MODE="selfhosted"
        echo "Selected: Self-hosted mode"
        break
        ;;
      *)
        echo "Please enter 1 or 2."
        ;;
    esac
  done
  echo ""
fi

# Determine device generation
if [ -n "$GENERATION_ARG" ]; then
  NEST_GENERATION="$GENERATION_ARG"
  echo "Device generation: $NEST_GENERATION (from command line)"
  echo ""
else
  echo "Identify your Nest Thermostat generation:"
  echo "  1) Generation 1 (Diamond)"
  echo "  2) Generation 2 (j49)"
  echo ""
  echo "Not sure which you have? Visit:"
  echo "  → https://docs.nolongerevil.com/compatibility#how-to-identify-your-nest-thermostat"
  echo ""

  NEST_GENERATION=""
  while true; do
    read -r -p "Enter your choice [1-2]: " gen_choice
    case "$gen_choice" in
      1)
        NEST_GENERATION="gen1"
        echo "Selected: Generation 1 (Diamond)"
        break
        ;;
      2)
        NEST_GENERATION="gen2"
        echo "Selected: Generation 2 (j49)"
        break
        ;;
      *)
        echo "Please enter 1 or 2."
        ;;
    esac
  done
  echo ""
fi

DEFAULT_URL="https://backdoor.nolongerevil.com"
if [ ! -f "$ENV_TEMPLATE" ]; then
  echo "Could not find $ENV_TEMPLATE. Make sure you're running the script from self-hosting-kit/."
  exit 1
fi

if [ "$HOSTING_MODE" = "selfhosted" ]; then
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
else
  # For hosted mode, use default URL
  api_origin="$DEFAULT_URL"
  api_host=$(extract_host "$api_origin")
  url_port=$(extract_port "$api_origin")
fi

if [ "$HOSTING_MODE" = "selfhosted" ]; then
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
else
  # For hosted mode, skip port configuration and SSL certificate generation
  echo ""
  echo "Using No Longer Evil hosted servers at: $api_origin"
  echo ""

  # For hosted mode with BUILD_ONLY=false, skip to building firmware and running installer
  # The installer will be launched later via npm run electron:dev
  echo "[→] Hosted mode: Will build firmware and launch installer..."
  echo ""
fi

if [ "$HOSTING_MODE" = "selfhosted" ]; then
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
else
  # For hosted mode, disable advanced features
  ENABLE_ROOT_ACCESS=false
  ENABLE_BACKPLATE_SIM=false
fi

SHOULD_BUILD_FIRMWARE=false

if [ "$HOSTING_MODE" = "hosted" ]; then
  SHOULD_BUILD_FIRMWARE=true
  echo "Building hosted firmware for $NEST_GENERATION..."
elif [ "$HOSTING_MODE" = "selfhosted" ]; then
  if [ -f "firmware/installer/resources/firmware/x-load-$NEST_GENERATION.bin" ] && [ -f "firmware/installer/resources/firmware/u-boot.bin" ] && [ -f "firmware/installer/resources/firmware/uImage" ]; then
    echo ""
    if [ "$BUILD_ONLY" = true ] || prompt_yes_no "Firmware files already exist. Rebuild them?" "n"; then
      SHOULD_BUILD_FIRMWARE=true
    else
      echo "Using existing firmware files."
    fi
  else
    SHOULD_BUILD_FIRMWARE=true
    echo ""
    echo "Firmware files not found. Building firmware..."
  fi
fi

if [ "$SHOULD_BUILD_FIRMWARE" = true ]; then
  if ! command -v docker >/dev/null 2>&1; then
    echo ""
    echo "[!] Docker is not installed."
    echo "    Download from: https://www.docker.com/products/docker-desktop"
    echo ""
    echo "Skipping firmware build. You can build later with:"
    echo "  cd firmware/builder && ./docker-build.sh --api-url $api_origin --generation $NEST_GENERATION --force-build"
  else
    build_firmware "$api_origin" "$NEST_GENERATION" "$ENABLE_ROOT_ACCESS" "$ENABLE_BACKPLATE_SIM"
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

if [ "$BUILD_ONLY" = true ]; then
  echo "Build-only mode complete!"
  echo ""
  echo "Firmware files are located in:"
  echo "  firmware/installer/resources/firmware/"
  echo ""
  echo "To package the installer, run:"
  echo "  cd firmware/installer && npm run package"
  echo ""
  exit 0
fi

if [ "$HOSTING_MODE" = "selfhosted" ]; then
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
else
  if [ -f "firmware/installer/resources/firmware/x-load-gen1.bin" ] && [ -f "firmware/installer/resources/firmware/x-load-gen2.bin" ] && [ -f "firmware/installer/resources/firmware/u-boot.bin" ] && [ -f "firmware/installer/resources/firmware/uImage" ]; then
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
  echo "After flashing firmware:"
  echo "1. Go to https://nolongerevil.com"
  echo "2. Enter your entry code when prompted"
  echo "3. Your Nest will connect to the NoLongerEvil service"
  echo ""
fi
