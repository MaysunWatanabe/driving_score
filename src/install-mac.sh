#!/bin/bash
ROOT_DIR=`pwd`
INSTALL_DIR=~/Desktop
PACKAGE_NAME=driving-score

echo "INSTALL: ${INSTALL_DIR}/${PACKAGE_NAME}"
if [ ! -d "${INSTALL_DIR}/${PACKAGE_NAME}" ]; then
  mkdir  ${INSTALL_DIR}/${PACKAGE_NAME}
fi
cd ${INSTALL_DIR}/${PACKAGE_NAME}

#npm uninstall -g ionic
#npm install -g @ionic/cli@7.1.1

cp -fr ${ROOT_DIR}/data/* ${INSTALL_DIR}/${PACKAGE_NAME}/
rm -fr ${INSTALL_DIR}/${PACKAGE_NAME}/android

npm install

ionic cap sync
npx cap sync

ionic build

if [ ! -d "${INSTALL_DIR}/${PACKAGE_NAME}/android" ]; then
  ionic capacitor add android
fi
cp -fr ${ROOT_DIR}/data/android/* ${INSTALL_DIR}/${PACKAGE_NAME}/android/


cd ${INSTALL_DIR}/${PACKAGE_NAME}/android
ln -s ../src/ .

echo "echo INSTALL FINISH."
echo "BUILD: ${INSTALL_DIR}/${PACKAGE_NAME}"

cd ${INSTALL_DIR}/${PACKAGE_NAME}
ionic capacitor build android
