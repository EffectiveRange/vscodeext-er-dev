#!/bin/bash

# SPDX-FileCopyrightText: 2024 Ferenc Nandor Janky <ferenj@effective-range.com>
# SPDX-FileCopyrightText: 2024 Attila Gombos <attila.gombos@effective-range.com>
# SPDX-License-Identifier: MIT

set -e -x -o pipefail
SCRIPT_DIR="$( cd "$( dirname "$0" )" && pwd )"
if [ -z $2 ]; then
    echo "Usage: $0 <project type> <workspace dir> <target> [<extra ssh args>]..."
    exit 1
fi

PACK_SCRIPT="$SCRIPT_DIR/pack_$1.sh"
if [ ! -f "$PACK_SCRIPT"  ]; then
    echo "No pack script found for project type $1"
    exit 1
fi

TARGET=$3

if [ -z $TARGET ]; then
    echo "No target specified"
    exit 1
fi


DEB_FILES_LIST="$("$PACK_SCRIPT" "$2")"

for file in "$DEB_FILES_LIST"
do
DEB_FILES_NAMES="$DEB_FILES_NAMES ./$(basename $file)"
done


shift 3
echo "Deploying $DEB_FILES_NAMES to $TARGET ..."

ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -q "$@" "$TARGET" "mkdir -p /tmp/erdev/"
scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$@"  $(echo $DEB_FILES_LIST | tr '\n' ' ') "$TARGET:/tmp/erdev/"
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -q  "$@" "$TARGET" "cd /tmp/erdev/ && sudo apt install -y --reinstall --no-install-recommends $DEB_FILES_NAMES" 