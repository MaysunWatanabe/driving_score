#!/bin/bash

INSTALL_DIR=$(cd $(dirname $0); pwd)
cd ${INSTALL_DIR}/../..

ps_check=`ps -x | grep "Android Studio" | grep -v "grep"`
if [ "$ps_check" != "" ]; then
  ionic capacitor copy android
else
  ionic capacitor build android
fi
