#!/bin/bash

# SPDX-FileCopyrightText: 2024 Ferenc Nandor Janky <ferenj@effective-range.com>
# SPDX-FileCopyrightText: 2024 Attila Gombos <attila.gombos@effective-range.com>
# SPDX-License-Identifier: MIT

set -x -e -o pipefail

if [ ! -d "$1" ]; then
    echo "Usage: $0 <workspace dir>"
    exit 1
fi

if [ ! -d "$1/build" ]; then
    echo "No build directory found in $1"
    exit 1
fi

cd  "$1/build"

DEB_FILES_LIST="$(cpack . | grep "CPack: - package:" | sed -r 's/CPack: - package: //' | sed -r 's/ generated.*//')"

for f in "$DEB_FILES_LIST"
do
    echo "$f"
done