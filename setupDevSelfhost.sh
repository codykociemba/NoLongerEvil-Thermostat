set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$ROOT_DIR/server"
SERVER_ENV=$SERVER_DIR/.env.local

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
  ' "$SERVER_ENV" > "$tmp"

  mv "$tmp" "$SERVER_ENV"
}

echo "============================================="
echo "  No Longer Evil Self-Hosting Server Setup"
echo "============================================="
echo ""

echo "Creating Convex Data folder for docker"
if [ ! -d convex/data ]; then
  mkdir -p convex/data
fi

echo "Starting Convex Backend."
docker compose up -d backend
echo ""

echo "Getting selfhosted admin key."
GENERATED_KEY=$(docker compose exec backend ./generate_admin_key.sh)
echo ""
echo "KEY = $GENERATED_KEY"
echo ""

echo "Update .env.local for Convex initialization"
update_env_value "CONVEX_SELF_HOSTED_URL" "http://127.0.0.1:3210"
update_env_value "CONVEX_SELF_HOSTED_ADMIN_KEY" "$GENERATED_KEY"
echo ""

echo "Initializing Server and Convex"
cd $SERVER_DIR
npm install
npx convex deploy
echo ""

echo "Stopping Convex Backend."
cd ../
docker compose stop backend
echo ""

echo "Update server .env"
update_env_value "CONVEX_SELF_HOSTED_URL" "http://backend:3210"
update_env_value "CONVEX_URL" "http://backend:3210"
echo ""

echo "Build nolongerevil docker image."
docker build -t nolongerevil .
echo ""

echo "Development environment complete. You can "
echo "now run with docker compose."
echo ""
echo "  docker compose up -d"
echo ""
echo "If you make any changes to the server code, "
echo "it will require a rebuild of the docker image."
echo "Run the below command to do this."
echo ""
echo "  docker build -t nolongerevil ."
echo ""