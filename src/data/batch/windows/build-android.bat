@echo off

set ROOT_DIR=%~dp0
pushd "%ROOT_DIR%\..\.."
@cd

call ionic capacitor build android
