#!/bin/bash

# SPDX-FileCopyrightText: 2024 Ferenc Nandor Janky <ferenj@effective-range.com>
# SPDX-FileCopyrightText: 2024 Attila Gombos <attila.gombos@effective-range.com>
# SPDX-License-Identifier: MIT

set -e -x -o pipefail
SCRIPT_DIR="$( cd "$( dirname "$0" )" && pwd )"
if [ -z $2 ] || { [ $3 != "quick" ] && [ $3 != "all" ]; }; then
    echo "Usage: $0 <project type> <workspace dir> <'quick'|'all'> <target> [<extra ssh args>]..."
    exit 1
fi


PACK_SCRIPT="$SCRIPT_DIR/pack.sh"
PROJTYPE=$1
WSPDIR=$2
TYPE=$3
TARGET=$4

if [ ! -f "$PACK_SCRIPT"  ]; then
    echo "No pack script found for project type $1"
    exit 1
fi

if [ ! -d "$WSPDIR" ]; then
    echo "Workspace directory $WSPDIR does not exist"
    exit 1
fi

if [ -z $TARGET ]; then
    echo "No target specified"
    exit 1
fi

shift 4

DEB_FILES_LIST=$("$PACK_SCRIPT" $PROJTYPE "$WSPDIR")

for file in "$DEB_FILES_LIST"
do
DEB_FILES_NAMES="$DEB_FILES_NAMES ./$(basename $file)"
done

echo "Deploying $DEB_FILES_NAMES to $TARGET ..."

ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -q "$@" "$TARGET" "mkdir -p /tmp/erdev/"

SSHARGS="ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -q $@"
rsync -avzc --progress -e "$SSHARGS" $(echo $DEB_FILES_LIST | tr '\n' ' ') "$TARGET:/tmp/erdev/"

if [ $TYPE == "quick" ]; then
    ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -q  "$@" "$TARGET" "cd /tmp/erdev/ && sudo dpkg -i $DEB_FILES_NAMES"
elif [ $TYPE == "all" ]; then
    ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -q  "$@" "$TARGET" "cd /tmp/erdev/ && sudo apt install -y --reinstall --no-install-recommends $DEB_FILES_NAMES" 
else
    echo "Deployment type $TYPE unknown!"
    exit 1
fi