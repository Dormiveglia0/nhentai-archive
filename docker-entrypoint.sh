#!/bin/sh
set -eu

if [ "$(id -u)" = "0" ]; then
  exec setpriv --reuid "$(stat -c %u /data)" --regid "$(stat -c %g /data)" --clear-groups "$@"
fi

exec "$@"
