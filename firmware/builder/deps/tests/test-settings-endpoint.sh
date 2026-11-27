#!/bin/sh
# Tests for the endpoint validation in deps/settings (issues #194, #237).
#
# The CGI must accept only an http(s):// endpoint built from an IPv4 address
# or a host name, an optional port, and a path of characters that are safe in
# client.config. Anything else must be refused, because only & and | are
# escaped when the value is written.
#
# valid_ip_port and valid_endpoint are taken from ../settings itself; the check
# below also re-does the write ($endpoint + "/entry") and asserts that the
# resulting string has no character outside the safe set.
#
# Usage: sh firmware/builder/deps/tests/test-settings-endpoint.sh

set -u

HERE=$(dirname "$0")
SETTINGS="$HERE/../settings"

if [ ! -f "$SETTINGS" ]; then
  echo "cannot find $SETTINGS" >&2
  exit 2
fi

# On the device busybox provides sed/cut/grep; use it here when available so the
# tests exercise the same implementation.
if command -v busybox >/dev/null 2>&1; then
  busybox2() { busybox "$@"; }
else
  busybox2() { "$@"; }
fi

eval "$(sed -n '/^valid_ip_port() {/,/^}/p' "$SETTINGS")"
eval "$(sed -n '/^valid_endpoint() {/,/^}/p' "$SETTINGS")"

if ! command -v valid_ip_port >/dev/null 2>&1 || ! command -v valid_endpoint >/dev/null 2>&1; then
  echo "could not load the validation functions from $SETTINGS" >&2
  exit 2
fi

total=0
failed=0

check() {
  want="$1"
  url="$2"
  total=$((total + 1))

  if valid_endpoint "$url"; then got=ACCEPT; else got=REJECT; fi

  if [ "$got" != "$want" ]; then
    echo "FAIL [$url]: expected $want, got $got"
    failed=$((failed + 1))
    return
  fi

  # Every accepted endpoint is written to client.config as "$url/entry".
  if [ "$got" = ACCEPT ]; then
    written="$url/entry"
    case "$written" in
      *[!A-Za-z0-9._~:/-]*)
        echo "FAIL [$url]: accepted, but the written value has unsafe characters: $written"
        failed=$((failed + 1))
        return
        ;;
    esac
  fi

  echo "ok   [$url] $want"
}

# Accepted endpoints
check ACCEPT 'http://192.168.1.100:8000'
check ACCEPT 'https://192.168.1.100'
check ACCEPT 'https://nle.example.com'
check ACCEPT 'http://localhost'
check ACCEPT 'http://localhost:8000'
check ACCEPT 'http://192.168.1.100:8000/'
check ACCEPT 'http://192.168.10.35:9543/entry'
check ACCEPT 'http://host:8000/nle'
check ACCEPT 'http://host:8000/nle/sub_dir-1.2~'

# Refused endpoints
check REJECT ''                                   # empty
check REJECT '192.168.1.100:8000'                 # no scheme
check REJECT '192.168.1.100'                      # no scheme
check REJECT 'backdoor.nolongerevil.com'          # no scheme
check REJECT 'ftp://host:8000'                    # wrong scheme
check REJECT 'http://999.1.1.1:8000'              # octet > 255
check REJECT 'http://1.2.3.4.5:8000'              # five octets
check REJECT 'http://192.168.1.100:0'             # port < 1
check REJECT 'http://192.168.1.100:70000'         # port > 65535
check REJECT 'http://192.168.1.100:abc'           # port not numeric
check REJECT 'http://host:'                       # empty port
check REJECT 'http://:8000'                       # empty host
check REJECT 'http://ho st:8000'                  # space in host
check REJECT 'http://host:8000;rm -rf /'          # shell characters
check REJECT 'http://host:8000/entry?x=1'         # query in path
check REJECT 'http://host:8000/a b'               # space in path
check REJECT 'http://host:8000/a"b'               # quote in path
check REJECT 'http://host:8000/a&b'               # ampersand in path
check REJECT 'http://host:8000/a|b'               # pipe in path
check REJECT 'http://x<a key="y" value="z"/>'     # XML injection

echo
if [ "$failed" -eq 0 ]; then
  echo "PASS: $total/$total"
  exit 0
fi
echo "FAIL: $failed of $total"
exit 1
