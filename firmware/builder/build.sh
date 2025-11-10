#!/usr/bin/env bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
OS="$(uname -s)"

if [ -f /.dockerenv ] || grep -q docker /proc/1/cgroup 2>/dev/null; then
    PLATFORM="docker"
else
    case "$OS" in
        Linux*)
            PLATFORM="linux"
            print_info "Running on native Linux"
            ;;
        *)
            print_error "Non-Linux platform detected: $OS"
            echo ""
            echo "This build system uses an ARM toolchain compiled for Linux."
            echo "Please use the Docker build script instead:"
            echo ""
            echo "  ${BOLD}./docker-build.sh --api-url <your-url> --force-build${NC}"
            echo ""
            if ! command -v docker >/dev/null 2>&1; then
                echo "Docker is not installed. Download from: https://www.docker.com/products/docker-desktop"
                echo ""
            fi
            exit 1
            ;;
    esac
fi

DEFAULT_API_URL="https://backdoor.nolongerevil.com"
FIRMWARE_DIR="firmware"

BUILD_XLOADER=false
BUILD_UBOOT=false
BUILD_XLOADER_SET=false
BUILD_UBOOT_SET=false
API_URL="${API_URL:-$DEFAULT_API_URL}"
API_URL_SET=false
NON_INTERACTIVE=false
NEED_CUSTOM_BUILD=false
FORCE_BUILD=false
GENERATION="gen2"
GENERATION_SET=true
DEBUG_PAUSE=false
ENABLE_BACKPLATE_SIM=false
ENABLE_ROOT_ACCESS=false
ROOT_PASSWORD=""

if [ -t 1 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  CYAN='\033[0;36m'
  BOLD='\033[1m'
  NC='\033[0m' 
else
  RED=''
  GREEN=''
  YELLOW=''
  BLUE=''
  CYAN=''
  BOLD=''
  NC=''
fi

print_header() {
  echo
  echo -e "${BOLD}${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${CYAN}║                                                               ║${NC}"
  echo -e "${BOLD}${CYAN}║             ${BOLD}No Longer Evil Firmware Builder${CYAN}                   ║${NC}"
  echo -e "${BOLD}${CYAN}║                                                               ║${NC}"
  echo -e "${BOLD}${CYAN}║                      ${YELLOW}No Longer Evil${CYAN}                           ║${NC}"
  echo -e "${BOLD}${CYAN}║                                                               ║${NC}"
  echo -e "${BOLD}${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}"
  echo
}

print_section() {
  echo
  echo -e "${BOLD}${BLUE}┌───────────────────────────────────────────────────────────────┐${NC}"
  echo -e "${BOLD}${BLUE}│${NC} $1"
  echo -e "${BOLD}${BLUE}└───────────────────────────────────────────────────────────────┘${NC}"
  echo
}

print_success() {
  echo -e "${GREEN}[✓]${NC} $1"
}

print_info() {
  echo -e "${CYAN}[→]${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
  echo -e "${RED}[✗]${NC} $1"
}

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Options:
  --api-url <url>          Override the default API URL used by the firmware
  --build-xloader          Build x-loader from source instead of using prebuilt
  --build-uboot            Build u-boot from source instead of using prebuilt
  --generation <gen>       Specify Nest generation: gen1 or gen2 (default: gen2)
  --force-build            Force rebuild of kernel even if API URL is default
  --debug-pause            Pause after extracting initramfs for manual editing
  --enable-backplate-sim   Enable backplate simulator in firmware
  --enable-root-access     Enable root access with generated password
  --yes, -y                Run non-interactively with the provided values
  --help, -h               Show this help message
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --api-url)
        shift
        if [ -z "${1:-}" ]; then
          print_error "--api-url requires a value"
          exit 1
        fi
        API_URL="$1"
        API_URL_SET=true
        shift
        ;;
      --build-xloader)
        BUILD_XLOADER=true
        BUILD_XLOADER_SET=true
        shift
        ;;
      --build-uboot)
        BUILD_UBOOT=true
        BUILD_UBOOT_SET=true
        shift
        ;;
      --generation)
        shift
        if [ -z "${1:-}" ]; then
          print_error "--generation requires a value (gen1 or gen2)"
          exit 1
        fi
        if [ "$1" != "gen1" ] && [ "$1" != "gen2" ]; then
          print_error "Invalid generation: $1. Must be 'gen1' or 'gen2'"
          exit 1
        fi
        GENERATION="$1"
        GENERATION_SET=true
        shift
        ;;
      --force-build)
        FORCE_BUILD=true
        shift
        ;;
      --debug-pause)
        DEBUG_PAUSE=true
        shift
        ;;
      --enable-backplate-sim)
        ENABLE_BACKPLATE_SIM=true
        NEED_CUSTOM_BUILD=true
        shift
        ;;
      --enable-root-access)
        ENABLE_ROOT_ACCESS=true
        NEED_CUSTOM_BUILD=true
        shift
        ;;
      --yes|-y|--non-interactive)
        NON_INTERACTIVE=true
        shift
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      *)
        print_error "Unknown option: $1"
        usage
        exit 1
        ;;
    esac
  done
}

ask_yes_no() {
  local prompt="$1"
  local default="$2"
  local response

  if [ "$default" = "y" ]; then
    prompt="$prompt [Y/n]: "
  else
    prompt="$prompt [y/N]: "
  fi

  while true; do
    read -p "$prompt" response
    response=${response:-$default}
    case "$response" in
      [Yy]* ) return 0;;
      [Nn]* ) return 1;;
      * ) echo "Please answer yes or no.";;
    esac
  done
}

ask_input() {
  local prompt="$1"
  local default="$2"
  local response

  if [ -n "$default" ]; then
    prompt="$prompt [$default]: "
  else
    prompt="$prompt: "
  fi

  read -p "$prompt" response
  echo "${response:-$default}"
}

check_dependencies() {
  print_section "Checking Dependencies"

  local missing_deps=()

  for cmd in git curl tar gzip cpio sed; do
    if ! command -v $cmd >/dev/null 2>&1; then
      missing_deps+=("$cmd")
    fi
  done

  if [ ${#missing_deps[@]} -gt 0 ]; then
    print_error "Missing required dependencies: ${missing_deps[*]}"
    echo
    echo "Please install the missing dependencies and try again."
    exit 1
  fi

  print_success "All required dependencies found"
}

setup_dependencies() {
  print_section "Setting Up Build Dependencies"

  if [ ! -d "deps/toolchain/arm-2008q3" ] || \
     [ ! -d "deps/x-loader" ] || \
     [ ! -d "deps/u-boot" ] || \
     [ ! -d "deps/linux" ]; then
    print_info "Downloading build dependencies (this may take a while)..."
    echo
    bash scripts/download-deps.sh
  else
    print_success "Build dependencies already present"
  fi

  if [ ! -f "deps/initramfs_data.cpio" ]; then
    print_error "Base initramfs not found at deps/initramfs_data.cpio"
    echo "This file should be included with the builder package."
    exit 1
  fi

  export PATH="$SCRIPT_DIR/deps/toolchain/arm-2008q3/bin:$PATH"
}

configure_build() {
  print_section "Build Configuration"

  if [ "$NON_INTERACTIVE" = false ] && [ "$GENERATION_SET" != true ]; then
    echo -e "${BOLD}Nest Generation:${NC}"
    echo "Please specify which Nest thermostat generation you are building for:"
    echo "  Gen 1: Original Diamond Nest thermostat"
    echo "  Gen 2: j49 Nest thermostat (default)"
    echo

    if ask_yes_no "Are you building for Gen 2 (j49)?" "y"; then
      GENERATION="gen2"
    else
      GENERATION="gen1"
    fi
    echo
  fi

  if [ "$NON_INTERACTIVE" = false ] && [ "$BUILD_XLOADER_SET" != true ]; then
    echo -e "${BOLD}Bootloader Options:${NC}"
    echo "Building from source is only needed if you're modifying bootloader code."
    echo "Pre-compiled binaries are available and recommended for most users."
    echo

    if ask_yes_no "Build x-loader from source?" "n"; then
      BUILD_XLOADER=true
    fi
  fi

  if [ "$NON_INTERACTIVE" = false ] && [ "$BUILD_UBOOT_SET" != true ]; then
    if ask_yes_no "Build u-boot from source?" "n"; then
      BUILD_UBOOT=true
    fi
  fi

  if [ "$API_URL_SET" != true ] && [ "$NON_INTERACTIVE" = false ]; then
    echo
    echo -e "${BOLD}API Configuration:${NC}"
    echo "The Nest will connect to this API server after flashing."
    echo "Default: $DEFAULT_API_URL"
    echo
    API_URL=$(ask_input "Enter API URL" "$API_URL")
  fi

  NEED_CUSTOM_BUILD=false
  if [ "$API_URL" != "$DEFAULT_API_URL" ] || [ "$FORCE_BUILD" = true ]; then
    NEED_CUSTOM_BUILD=true
  fi

  echo
  echo -e "${BOLD}Build Summary:${NC}"
  echo "  Generation:          $GENERATION"
  echo "  x-loader:            $([ "$BUILD_XLOADER" = true ] && echo "Build from source" || echo "Use pre-compiled")"
  echo "  u-boot:              $([ "$BUILD_UBOOT" = true ] && echo "Build from source" || echo "Use pre-compiled")"
  echo "  API URL:             $API_URL"
  echo "  Custom kernel:       $([ "$NEED_CUSTOM_BUILD" = true ] && echo "Yes" || echo "No (using pre-compiled)")"
  echo "  Backplate simulator: $([ "$ENABLE_BACKPLATE_SIM" = true ] && echo "Enabled" || echo "Disabled")"
  echo "  Root access:         $([ "$ENABLE_ROOT_ACCESS" = true ] && echo "Enabled" || echo "Disabled")"
  echo

  if [ "$NON_INTERACTIVE" = false ]; then
    if ! ask_yes_no "Proceed with this configuration?" "y"; then
      print_warning "Build cancelled by user"
      exit 0
    fi
  fi
}

build_firmware() {
  print_section "Building Firmware"

  if [ "$BUILD_XLOADER" = true ]; then
    rm -f "$SCRIPT_DIR/firmware/x-load.bin" 2>/dev/null || true
    rm -f "$SCRIPT_DIR/../installer/bin/x-load.bin" 2>/dev/null || true
  fi

  if [ "$BUILD_UBOOT" = true ]; then
    rm -f "$SCRIPT_DIR/firmware/u-boot.bin" 2>/dev/null || true
    rm -f "$SCRIPT_DIR/../installer/bin/u-boot.bin" 2>/dev/null || true
  fi

  if [ "$NEED_CUSTOM_BUILD" = true ]; then
    rm -f "$SCRIPT_DIR/firmware/uImage" 2>/dev/null || true
    rm -f "$SCRIPT_DIR/../installer/bin/uImage" 2>/dev/null || true
  fi

  if [ "$BUILD_XLOADER" = true ] || [ "$BUILD_UBOOT" = true ]; then
    local bootloader_args=""
    [ "$BUILD_XLOADER" = true ] && bootloader_args="$bootloader_args --xloader"
    [ "$BUILD_UBOOT" = true ] && bootloader_args="$bootloader_args --uboot"
    bootloader_args="$bootloader_args --generation $GENERATION"

    bash scripts/build-bootloaders.sh $bootloader_args
  else
    if [ ! -f "$FIRMWARE_DIR/x-load.bin" ]; then
      print_warning "Pre-compiled x-load.bin not found"
    else
      print_success "Using pre-compiled x-load.bin"
    fi

    if [ ! -f "$FIRMWARE_DIR/u-boot.bin" ]; then
      print_warning "Pre-compiled u-boot.bin not found"
    else
      print_success "Using pre-compiled u-boot.bin"
    fi
  fi

  if [ "$NEED_CUSTOM_BUILD" = true ]; then
    print_info "Building custom kernel with logo only (using NestDFUAttack base initramfs)..."
    echo
    
    # DEBUG TEST: Extract and repack to see if repack process breaks it
    print_info "DEBUG TEST: Extracting and repacking NestDFUAttack cpio to test repack process..."

    rm -rf "$SCRIPT_DIR/deps/root"
    mkdir -p "$SCRIPT_DIR/deps/root"
    cd "$SCRIPT_DIR/deps/root"
    cpio -id < "$SCRIPT_DIR/deps/initramfs_data.cpio" 2>/dev/null
    print_success "Extracted original NestDFUAttack cpio"

    cd "$SCRIPT_DIR/deps/root"
    print_info "Repacking without any modifications..."
    mkdir -p "$SCRIPT_DIR/deps/linux"
    find . -print0 | cpio -o -0 -H newc -R 0:0 > "$SCRIPT_DIR/deps/linux/initramfs_data.cpio" 2>/dev/null
    cd "$SCRIPT_DIR"
    rm -rf "$SCRIPT_DIR/deps/root"

    SIZE=$(du -h "$SCRIPT_DIR/deps/linux/initramfs_data.cpio" | cut -f1)
    print_success "Repacked cpio without modifications ($SIZE)"

    print_info "Building kernel with repacked cpio..."

    if [ -d "$SCRIPT_DIR/deps/toolchain/arm-2008q3/bin" ]; then
      export PATH="$SCRIPT_DIR/deps/toolchain/arm-2008q3/bin:$PATH"
      print_info "Toolchain added to PATH for kernel build"
    fi

    bash scripts/build-kernel.sh
  else
    if [ ! -f "$FIRMWARE_DIR/uImage" ]; then
      print_warning "Pre-compiled uImage not found"
    else
      print_success "Using pre-compiled uImage"
    fi
  fi
}

print_results() {
  print_section "Build Complete!"

  echo -e "${BOLD}Firmware files:${NC}"
  echo

  if [ -f "$FIRMWARE_DIR/x-load.bin" ]; then
    SIZE=$(du -h "$FIRMWARE_DIR/x-load.bin" | cut -f1)
    echo "  x-load.bin    $SIZE"
  fi

  if [ -f "$FIRMWARE_DIR/u-boot.bin" ]; then
    SIZE=$(du -h "$FIRMWARE_DIR/u-boot.bin" | cut -f1)
    echo "  u-boot.bin    $SIZE"
  fi

  if [ -f "$FIRMWARE_DIR/uImage" ]; then
    SIZE=$(du -h "$FIRMWARE_DIR/uImage" | cut -f1)
    echo "  uImage        $SIZE"
  fi

  echo
  echo -e "${BOLD}${GREEN}All firmware files are ready in: firmware/${NC}"
  echo

  if [ "$NEED_CUSTOM_BUILD" = true ]; then
    SERVER_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)/server"
    echo -e "${BOLD}SSL Certificates:${NC}"
    echo "  Server certificates in: $SERVER_DIR/certs/"
    echo "  - nest_server.crt (server certificate)"
    echo "  - nest_server.key (server private key)"
    echo "  - ca-cert.pem (CA certificate for firmware)"
    echo
  fi

  if [ "$ENABLE_BACKPLATE_SIM" = true ]; then
    echo -e "${BOLD}${YELLOW}Backplate Simulator:${NC}"
    echo "  Backplate simulation is enabled in this firmware"
    echo "  HVAC Type: 1H1C (Heat + Cool)"
    echo "  Wires: Rh, W1, Y1, G"
    echo
  fi

  if [ "$ENABLE_ROOT_ACCESS" = true ] && [ -n "$ROOT_PASSWORD" ]; then
    echo -e "${BOLD}${RED}Root Access Enabled:${NC}"
    echo -e "  ${BOLD}Username:${NC} root"
    echo -e "  ${BOLD}Password:${NC} ${BOLD}${RED}$ROOT_PASSWORD${NC}"
    echo
    echo -e "${YELLOW}  ⚠️  IMPORTANT: Save this password securely!${NC}"
    echo -e "${YELLOW}  ⚠️  Root access is enabled on this firmware${NC}"
    echo
  fi
}

main() {
  parse_args "$@"
  print_header
  check_dependencies
  setup_dependencies
  configure_build
  build_firmware
  print_results
}

main "$@"
