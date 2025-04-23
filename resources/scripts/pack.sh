#!/bin/bash

# SPDX-FileCopyrightText: 2024 Ferenc Nandor Janky <ferenj@effective-range.com>
# SPDX-FileCopyrightText: 2024 Attila Gombos <attila.gombos@effective-range.com>
# SPDX-License-Identifier: MIT
set -e -x

SCRIPT_DIR=$(dirname "$0")  

TYPE=$1
shift 1

if [ -z $TYPE ]; then
    echo "Usage: $0 <project type> <workspace dir> [<args>]"
    exit 1
fi

WSP_DIR=$1

if [ ! -d $WSP_DIR ]; then
    echo "Workspace directory $WSP_DIR does not exist."
    exit 1
fi

# use the supplied workspace packaging script if it exists
if [ -e "$WSP_DIR/pack.sh" ]; then
    "$WSP_DIR/pack.sh" "$@"
    exit 0
fi

$SCRIPT_DIR/pack_$TYPE "$@"