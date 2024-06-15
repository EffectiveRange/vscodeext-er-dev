#!/bin/bash

# SPDX-FileCopyrightText: 2024 Ferenc Nandor Janky <ferenj@effective-range.com>
# SPDX-FileCopyrightText: 2024 Attila Gombos <attila.gombos@effective-range.com>
# SPDX-License-Identifier: MIT

set -e -o pipefail

if [ ! -d "$1" ]; then
    echo "Usage: $0 <workspace dir>"
    exit 1
fi

OUT_DIR=/tmp/fpm
if [ -n "$2" ]; then
    OUT_DIR="$2"
fi


if [ ! -f "$1/setup.py" ]; then
    echo "No setup.py found in $1"
    exit 1
fi

SETUP_PATH=$(realpath "$1/setup.py")

mkdir -p "$OUT_DIR"
cd "$OUT_DIR"

FPM_OUT="$(fpm --log error --python-package-name-prefix python3 -f --python-bin "$(which python3)" -s python -t deb "$SETUP_PATH" )"

echo "$FPM_OUT" | sed -r "s|.*path=>\"([^\"]+).*|$OUT_DIR/\1|g"

