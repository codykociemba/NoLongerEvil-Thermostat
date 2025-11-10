#!/usr/bin/env bash

set -e

# Determine if we need sudo for Docker
DOCKER_CMD="docker"
if ! docker ps >/dev/null 2>&1; then
    echo "[!] Docker requires sudo on this system"
    DOCKER_CMD="sudo docker"
fi

echo "[→] Building Docker image..."
$DOCKER_CMD build --no-cache -t nest-firmware-builder .

USER_ID=$(id -u)
GROUP_ID=$(id -g)

DOCKER_FLAGS="--rm"
if [[ " $* " =~ " --debug-pause " ]]; then
    echo "[→] Debug mode enabled - running in interactive mode"
    DOCKER_FLAGS="-it --rm"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Starting Docker Build Process"
echo "  All extraction, downloading, and compilation happens inside Docker"
echo "════════════════════════════════════════════════════════════"
echo ""

MSYS_NO_PATHCONV=1 $DOCKER_CMD run $DOCKER_FLAGS \
    -v "$(pwd):/work" \
    -v "$(cd ../.. && pwd)/server:/server" \
    -w /build \
    -e "PYTHONUNBUFFERED=1" \
    nest-firmware-builder \
    bash -c "
      echo '[→] Copying scripts to container...'
      cp -r /work/scripts /build/
      mkdir -p /build/deps
      cp /work/deps/*.cpio /build/deps/ 2>/dev/null || true
      cp /work/deps/*.ppm /build/deps/ 2>/dev/null || true
      cp /work/*.png /build/ 2>/dev/null || true
      cp /work/build.sh /build/ 2>/dev/null || true
      echo '[✓] Ready to build'
      echo ''

      export PATH=\"/build/deps/toolchain/arm-2008q3/bin:/build/deps/toolchain/arm-2008q3/libexec/gcc/arm-none-linux-gnueabi/4.3.2:\$PATH\"

      bash build.sh $*
      EXIT_CODE=\$?

      echo ''
      echo '[→] Copying firmware to host...'
      mkdir -p /work/firmware

      if [ -d /build/firmware ] && [ -n \"\$(ls -A /build/firmware 2>/dev/null)\" ]; then
        cp -v /build/firmware/* /work/firmware/
        echo '[✓] Firmware files copied to host'
      else
        echo '[!] Warning: No firmware files generated'
      fi

      if [ -f /build/build.log ]; then
        cp /build/build.log /work/build.log
      fi

      chown -R $USER_ID:$GROUP_ID /work/firmware /work/build.log 2>/dev/null || true
      exit \$EXIT_CODE
    "

EXIT_CODE=$?

echo ""
echo "════════════════════════════════════════════════════════════"

if [ "$EXIT_CODE" = "0" ]; then
  echo "[✓] Docker build complete!"
  echo "    Build log saved to: build.log"
  exit 0
else
  echo "[!] Docker build failed with exit code: $EXIT_CODE"
  echo "[!] Check build.log for details"
  exit 1
fi
