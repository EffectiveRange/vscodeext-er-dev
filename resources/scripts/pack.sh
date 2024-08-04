#!/bin/bash

# SPDX-FileCopyrightText: 2024 Ferenc Nandor Janky <ferenj@effective-range.com>
# SPDX-FileCopyrightText: 2024 Attila Gombos <attila.gombos@effective-range.com>
# SPDX-License-Identifier: MIT
set -e -x

SCRIPT_DIR=$(dirname "$0")  

TYPE=$1
shift 1

if [ -z $TYPE ]; then
    echo "Usage: $0 <project type> <args>"
    exit 1
fi


$SCRIPT_DIR/pack_$TYPE "$@"