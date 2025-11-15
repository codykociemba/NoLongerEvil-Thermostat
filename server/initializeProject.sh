#!/bin/bash

echo "Generate key/csr/cert..."
if [ -d certs ]; then
  rm -fr certs
fi
mkdir certs
echo "  create nest_server.key"
openssl genrsa -out certs/nest_server.key 2048

echo "[ req ]" > certs/csr.conf
echo "prompt = no" >> certs/csr.conf
echo "days = 3650" >> certs/csr.conf
echo "distinguished_name = nlet_server" >> certs/csr.conf
echo "" >> certs/csr.conf
echo "[ nlet_server ]" >> certs/csr.conf
echo "countryName = US" >> certs/csr.conf
echo "stateOrProvinceName = TX"  >> certs/csr.conf
echo "localityName = DFW" >> certs/csr.conf
echo "organizationName = NLET" >> certs/csr.conf
echo "organizationalUnitName = NLET-DEV" >> certs/csr.conf
echo "commonName = nletserver.io" >> certs/csr.conf
echo "" >> certs/csr.conf
echo "[ v3_req ]" >> certs/csr.conf
echo "basicConstraints = CA:false" >> certs/csr.conf
echo "extendedKeyUsage = serverAuth" >> certs/csr.conf

echo "  create nest_server.csr"
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

echo "Make sure to update CONVEX_ADMIN_KEY in your .env file with the KEY value below"
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
echo "Project is ready for development"