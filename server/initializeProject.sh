#!/bin/bash

CERT_DEFAULT_COUNTRY=US
CERT_DEFAULT_STATE=TX
CERT_DEFAULT_LOCALITY=DFW
CERT_DEFAULT_ORG=NLET
CERT_DEFAULT_ORGUNIT=NLET-DEV
CERT_DEFAULT_URL=nletserver.io

echo "Generate key/csr/cert..."
if [ -d certs ]; then
  rm -fr certs
fi
mkdir certs
echo "  create nest_server.key"
openssl genrsa -out certs/nest_server.key 2048

echo "  create nest_server.csr"
echo "[ req ]" > certs/csr.conf
echo "prompt = no" >> certs/csr.conf
echo "days = 3650" >> certs/csr.conf
echo "distinguished_name = nlet_server" >> certs/csr.conf
echo "" >> certs/csr.conf
echo "[ nlet_server ]" >> certs/csr.conf

read -p "    Input your Country Name (US) : " CERT_COUNTRY
CERT_COUNTRY=${CERT_COUNTRY:-$CERT_DEFAULT_COUNTRY}
echo "countryName = $CERT_COUNTRY" >> certs/csr.conf

read -p "    Input your State or Province name (TX) : " CERT_STATE
CERT_STATE=${CERT_STATE:-$CERT_DEFAULT_STATE}
echo "stateOrProvinceName = $CERT_STATE"  >> certs/csr.conf

read -p "    Input your City or Locality name ($CERT_DEFAULT_LOCALITY) : " CERT_LOCALITY
CERT_LOCALITY=${CERT_LOCALITY:-$CERT_DEFAULT_LOCALITY}
echo "localityName = $CERT_LOCALITY" >> certs/csr.conf

read -p "    Input your organization name ($CERT_DEFAULT_ORG) : " CERT_ORG
CERT_ORG=${CERT_ORG:-$CERT_DEFAULT_ORG}
echo "organizationName = $CERT_ORG" >> certs/csr.conf

read -p "    Input your organizational unit name ($CERT_DEFAULT_ORGUNIT) : " CERT_ORGUNIT
CERT_ORGUNIT=${CERT_DEFAULT_ORGUNIT:-$CERT_DEFAULT_ORGUNIT}
echo "organizationalUnitName = $CERT_ORGUNIT" >> certs/csr.conf

read -p "    Input your URL ($CERT_DEFAULT_URL) : " CERT_URL
CERT_URL=${CERT_URL:-$CERT_DEFAULT_URL}
echo "commonName = $CERT_URL" >> certs/csr.conf
echo "" >> certs/csr.conf
echo "[ v3_req ]" >> certs/csr.conf
echo "basicConstraints = CA:false" >> certs/csr.conf
echo "extendedKeyUsage = serverAuth" >> certs/csr.conf
openssl req -new -config certs/csr.conf -key certs/nest_server.key -out certs/nest_server.csr

echo "  create nest_server.crt"
openssl x509 -req -days 3650 -in certs/nest_server.csr -signkey certs/nest_server.key -out certs/nest_server.crt
echo ""

echo "Creating Convex Data folder for docker"
if [ ! -d convex/data ]; then
  mkdir convex/data
fi

echo "Starting Convex Backend."
docker compose up -d backend
echo ""

echo "Getting selfhosted admin key."
GENERATED_KEY=$(docker compose exec backend ./generate_admin_key.sh)
echo ""
echo "KEY = $GENERATED_KEY"
echo ""

echo "Create .env.local for Convex"
echo "CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210" > .env.local
echo "CONVEX_SELF_HOSTED_ADMIN_KEY=$GENERATED_KEY" >> .env.local

echo ""
echo "Initializing tables/functions"
npx convex deploy

echo ""
echo "Stopping Convex Backend."
docker compose stop backend

echo ""
echo "Create .env for server"
echo "# Primary API origin (used for docs/certs)" > .env
echo "API_ORIGIN=https://localhost" >> .env
echo "" >> .env
echo "# Listener ports" >> .env
echo "PROXY_PORT=443" >> .env
echo "CONTROL_PORT=8081" >> .env
echo "" >> .env
echo "# Convex deployment" >> .env
echo "CONVEX_URL=http://backend:3120" >> .env
echo "CONVEX_ADMIN_KEY=$GENERATED_KEY" >> .env
echo "" >> .env
echo "# Entry key lifetime (seconds)" >> .env
echo "ENTRY_KEY_TTL_SECONDS=3600" >> .env

echo ""
echo "Project is ready for development. After updating the server code, run "
echo "the \"buildServerDocker.sh\" script. This will build the docker container."
echo "After building, you can run"
echo ""
echo "  docker compose pull"
echo ""
echo "then"
echo ""
echo "  docker compose up -d"
echo ""
echo "You can then access via the URLs below."
echo ""
echo "  Server API : https://localhost"
echo "  Control API : http://localhost:8081"
echo "  Convex Backend : http://localhost:3210"
echo "  Convex Dashboard : http://localhost:6791"
echo "      Admin Key : $GENERATED_KEY
echo ""