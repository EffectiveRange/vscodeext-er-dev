#!/bin/bash

# SPDX-FileCopyrightText: 2024 Ferenc Nandor Janky <ferenj@effective-range.com>
# SPDX-FileCopyrightText: 2024 Attila Gombos <attila.gombos@effective-range.com>
# SPDX-License-Identifier: MIT

set -e -o pipefail

SESSION_ID="$1"
LISTEN_PORT="$2"
if [ -z "$SESSION_ID" ] || [ -z "$LISTEN_PORT" ]; then
  echo "Usage: start_debugpy.sh <session_id> <listen port> <debugpy args>..."
  exit 1
fi

shift 2

if [ -z "$@" ]; then
  echo "No debugpy args provided, at least the executable must be specified"
  exit 1
fi

DEBUGPY_LOG_DIR="/tmp"

setsid python3 -m debugpy --listen 0.0.0.0:$LISTEN_PORT  --log-to $DEBUGPY_LOG_DIR/ "$@"  2>&1 > /dev/null & 
DEBUGPY_PID="$!" 
echo "$DEBUGPY_PID" > /var/log/debugpy-$SESSION_ID.pid

STARTUP_TIMEOUT="30s"

(timeout $STARTUP_TIMEOUT tail -n0 -F $DEBUGPY_LOG_DIR/debugpy.server-$DEBUGPY_PID.log &) | grep -qE "(: wait_for_client\(\)|Code injection into PID=[0-9]+ completed|RuntimeError.*Address already in use)" 

if grep -E "wait_for_client\(\)" $DEBUGPY_LOG_DIR/debugpy.server-$DEBUGPY_PID.log ; then
  echo "Successfully started debugpy!"
  exit 0
fi
if grep -E "Code injection into PID=[0-9]+ completed" $DEBUGPY_LOG_DIR/debugpy.server-$DEBUGPY_PID.log ; then
  echo "Successfully started debugpy for attach!"
  exit 0
fi

if grep -E "RuntimeError.*Address already in use" $DEBUGPY_LOG_DIR/debugpy.server-$DEBUGPY_PID.log ; then
  echo "Failed to start debugpy: Address already in use"
  exit 75 # should retry with a different port
fi

echo "Timeout waiting for debugpy to start"
exit 124 # unknown error


