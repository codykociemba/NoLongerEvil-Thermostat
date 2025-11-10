#!/usr/bin/env bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVER_DIR="$(cd "$BUILD_DIR/../.." && pwd)/server"
cd "$BUILD_DIR"

SERVER_ONLY=false
DOMAIN=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --server-only)
      SERVER_ONLY=true
      shift
      ;;
    *)
      if [ -z "$DOMAIN" ]; then
        DOMAIN="$1"
      fi
      shift
      ;;
  esac
done

if [ -z "$DOMAIN" ]; then
  echo "Usage: $0 [--server-only] <domain>"
  echo "Example: $0 backdoor.nolongerevil.com"
  echo "Example: $0 --server-only backdoor.nolongerevil.com"
  exit 1
fi

SERVER_CERT_DIR="$SERVER_DIR/certs"
ROOT_CERT_DIR="$BUILD_DIR/deps/root/etc/ssl/certs"

mkdir -p "$SERVER_CERT_DIR"

if [ "$DOMAIN" = "backdoor.nolongerevil.com" ]; then
  echo "[→] Using official No Longer Evil CA certificate for default domain..."

  cat > "$SERVER_CERT_DIR/ca-cert.pem" << 'EOF'
-----BEGIN CERTIFICATE-----
MIIF+TCCA+GgAwIBAgIUP0dbiF2u6BuJE/7m7jN1amlzSnowDQYJKoZIhvcNAQEL
BQAwgYsxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApDYWxpZm9ybmlhMRIwEAYDVQQH
DAlQYWxvIEFsdG8xEjAQBgNVBAoMCU5lc3QgTGFiczENMAsGA1UECwwETmVzdDEw
MC4GA1UEAwwnTmVzdCBQcml2YXRlIFJvb3QgQ2VydGlmaWNhdGUgQXV0aG9yaXR5
MB4XDTI1MTAzMTA3MzMzMVoXDTM1MTAyOTA3MzMzMVowgYsxCzAJBgNVBAYTAlVT
MRMwEQYDVQQIDApDYWxpZm9ybmlhMRIwEAYDVQQHDAlQYWxvIEFsdG8xEjAQBgNV
BAoMCU5lc3QgTGFiczENMAsGA1UECwwETmVzdDEwMC4GA1UEAwwnTmVzdCBQcml2
YXRlIFJvb3QgQ2VydGlmaWNhdGUgQXV0aG9yaXR5MIICIjANBgkqhkiG9w0BAQEF
AAOCAg8AMIICCgKCAgEAyh0CaWTZpfA9FV1/Qeaauo0LngDTvMFZYwT8+WP1R5s2
FYFNH4LKZ+Csqyi62TBTWSojUxLIl4oJzZ6ZajmELCFV0PdrI001fo2IA1LQeCli
aC03eqv4jl0hQYS4zc36h1EbFnckM8YeSmiu/lj42Dk1oZHNbZh1u4oMS7eGaf9B
WfbyBAUZsIMv/khFn41RdaQ03ugeSVGqE82Ilc0IV081GPzL3T/i3W5UEF3I6rXv
s7+jOmw/VT5oXHO2shU/x3dKE4ET3c27exyotCD8pTi2FWUAJ+XwrrRYKBh0iN6g
m+Cb3u63d7w/sSjEnc9TFcpDhXEmRJPKnzL0y+SOG90AhVujVAuwWJIcimvG0V27
hF2CYoayEE145E6F0q7SlGA5XNuZdSDvj8iRk12YNk6AIgmv4bfPbg8gwuCnY7FC
IsCm2VNYmQauO67/Wll4RyTnMjiXoTLgf3xVPXBi4tYpaSw1gAHVTyIYxqJB8nK6
ygojl0Sv9lbdjRqVzz3BWmWsKUoCoRCWxsjFXW/l7HxdQzXwvmwDsYQMGMpluQ8Z
MEDj7fzraJGJCm51DK6bqAJY3EPAMOe/SJfIjCwBufUPLfL6RbS+FsmqlVy+MJaU
c+1HPf0kEODofqvV4UXPNJdyWC1JmpbSjvLlPSdtpWsdi6977o23M0DwJuKdg4kC
AwEAAaNTMFEwHQYDVR0OBBYEFBPKTGQVE2zfjT413yF62DKf/V4EMB8GA1UdIwQY
MBaAFBPKTGQVE2zfjT413yF62DKf/V4EMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZI
hvcNAQELBQADggIBAKN2CUATqajgalzkeyrUPBXBZDIrE7XwuVcosyuDqReAIiHV
9dxL3yEtQo2L5FQIOTqHgzEgtCLBSXW4jQFRbiFszxGoDWOUqnCnWasrEYjkyBJN
3jPoEDkLNEX5nLe4KbWoJLpcm9AS0jeyoSfFQebmCCO95+OQ2/UDKcU6rbPRvdun
9k9/g/53HEB8hlLhA0OJHQVSCokCTOae9+WsVnw5OqFyz9hALr0Ur2MCLu/l9A0X
cXTpJ0kSc63emDnEakE/uOO6IPnoYPCPg5WPRU6TjvgcjfulathNv0hst6lz8Sd3
5pfFw09OV20fNJ+5RnvRlVtAPrdTFLxzQNnOQZU8ZUzWunzey6BCCRI0N1QwPkXe
TEZAy/pzx13AqBpy+Hl5FiOu6xAmLD7OpCSqCD8DIbHDdPZoEZnA5290dfZhBgmx
LPBj5HsJWJQ57agUQZBHmegaiB9fJqlcJ4CblPRhkELSszN5psPrAolZysquVuv8
EhULhOcnoCE+4dp6o4klYSoLkg8rVWyVa5f4iDwD51DMAcsAs2TU6mvIVHRodlu1
u7+mT2BE1N5Y2xuBnDXFy/fzYT/XferYBOHP7+rWSopJH4epRJnp55lUsEAyP0VQ
+O8glPffIxvKO2/1ZxPHotDoSZtWe28cHUODojbsd1PpfCioQqkrUzWNLoZw
-----END CERTIFICATE-----
EOF

  echo "[✓] Official No Longer Evil CA certificate installed"
  echo ""
  echo "[!] IMPORTANT: You are using the default domain (backdoor.nolongerevil.com)"
  echo "[!] The device will connect to No Longer Evil's servers"
  echo "[!] Your own server certificates will NOT work with this configuration"
  echo "[!] To use your own server, specify a custom domain instead"
  echo ""

else
  echo "[→] Generating SSL certificates for ${DOMAIN}..."

echo "[→] Creating CA private key..."
openssl genrsa -out "$SERVER_CERT_DIR/ca-key.pem" 4096 2>/dev/null

echo "[→] Creating self-signed CA certificate..."
openssl req -new -x509 -days 3650 -key "$SERVER_CERT_DIR/ca-key.pem" \
  -out "$SERVER_CERT_DIR/ca-cert.pem" \
  -subj "/CN=No Longer Evil API" 2>/dev/null

echo "[→] Creating server private key..."
openssl genrsa -out "$SERVER_CERT_DIR/nest_server.key" 4096 2>/dev/null

echo "[→] Creating server CSR..."
openssl req -new -key "$SERVER_CERT_DIR/nest_server.key" \
  -out "$SERVER_CERT_DIR/server-csr.pem" \
  -subj "/CN=${DOMAIN}" 2>/dev/null

echo "[→] Signing server certificate..."
openssl x509 -req -days 3650 \
  -in "$SERVER_CERT_DIR/server-csr.pem" \
  -CA "$SERVER_CERT_DIR/ca-cert.pem" \
  -CAkey "$SERVER_CERT_DIR/ca-key.pem" \
  -CAcreateserial \
  -out "$SERVER_CERT_DIR/nest_server.crt" 2>/dev/null

if [ "$SERVER_ONLY" = false ] && [ -d "$ROOT_CERT_DIR" ]; then
  echo "[→] Installing CA bundle to firmware filesystem..."
  cp "$SERVER_CERT_DIR/ca-cert.pem" "$ROOT_CERT_DIR/ca-bundle.pem"
  echo "[✓] CA certificate installed to deps/root/etc/ssl/certs/ca-bundle.pem"
fi

rm -f "$SERVER_CERT_DIR/server-csr.pem"

echo "[✓] SSL certificates generated successfully!"
echo
echo "Server certificates (for API server):"
echo "  Location:           $SERVER_CERT_DIR"
echo "  CA Certificate:     ca-cert.pem"
echo "  CA Private Key:     ca-key.pem"
echo "  Server Certificate: nest_server.crt"
echo "  Server Private Key: nest_server.key"
echo
fi
