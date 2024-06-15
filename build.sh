#!/bin/bash

# SPDX-FileCopyrightText: 2024 Ferenc Nandor Janky <ferenj@effective-range.com>
# SPDX-FileCopyrightText: 2024 Attila Gombos <attila.gombos@effective-range.com>
# SPDX-License-Identifier: MIT

set -e -x -o pipefail

ROOTDIR=$(dirname $0)

rm -rf $ROOTDIR/build

yarn install
if [ -z $DISPLAY ]; then
  echo "DISPLAY is not set. Running in headless mode."
  xvfb-run -a -- yarn run test 
else
  yarn run test 
fi 
yarn run package
