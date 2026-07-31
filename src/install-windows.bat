@echo off
setlocal

set ROOT_DIR=%~dp0
set INSTALL_DIR=%HOMEDRIVE%%HOMEPATH%\Desktop
set PACKAGE_NAME=driving-score

echo +-- config --+
echo ROOT_DIR=%ROOT_DIR%
echo INSTALL_DIR=%INSTALL_DIR%
echo PACKAGE_NAME=%PACKAGE_NAME%
echo +------------+


echo.
echo +-- check java command. --+
echo java --version
call java --version
if %errorlevel% neq 0 (
  echo.
  echo ERROR: java command failed.
  echo install manual. https://www.oracle.com/jp/java/technologies/downloads/
  echo please install Java 17.
  pause
  exit
) else (
  echo OK
)
echo +-------------------------+


echo.
echo +-- check AndroidStudio(adb) command. --+
echo adb --version
call adb --version
if %errorlevel% neq 0 (
  echo ERROR: adb command failed.

  if exist "%HOMEDRIVE%%HOMEPATH%\AppData\Local\Android\Sdk" (
    echo.
    echo setting manual. https://windroid.work/2020/04/adb-windows-android-2020.html/
    echo please set the path for ANDROID_HOME.
    echo plase add %ANDROID_HOME%\platform-tools to Path

  ) else (
    echo.
    echo install manual. https://developer.android.com/studio
    echo please install Android SDK 13.0.
    echo please install Android SDK Platform-Tools.
  )
  pause
  exit
) else (
  echo OK
)
echo +---------------------------------------+


echo.
echo +-- check node command. --+
echo node --version
call node --version
if %errorlevel% neq 0 (
  echo.
  echo ERROR: node command failed.
  echo install manual. https://qiita.com/taiponrock/items/9001ae194571feb63a5e
  pause
  exit
) else (
  echo OK
)
echo +-------------------------+


echo.
echo +-- npm config --+
for /f "usebackq delims=" %%A in (`npm -g config get registry`) do set REGISTRY=%%A

if "%REGISTRY%" == "http://registry.npmjs.org/" (
  echo npm -g config set strict-ssl false
  call npm -g config set strict-ssl false
)
echo npm config list
call npm config list
echo +----------------+

echo.
echo +-- check ionic command. --+
echo ionic --version
call ionic --version
if %errorlevel% neq 0 (
  echo.
  echo install ionic command.
  echo npm install -g @ionic/cli@7.1.1

  call npm uninstall -g ionic
  call npm install -g @ionic/cli@7.1.1
  if %errorlevel% neq 0 (
    echo.
    echo ERROR: ionic install failed.
    echo RETRY: ionic install.
    echo npm -g config set registry http://registry.npmjs.org/
    call npm -g config set registry http://registry.npmjs.org/

    echo npm -g config set strict-ssl false
    call npm -g config set strict-ssl false

    echo npm install -g @ionic/cli@7.1.1
    call npm install -g @ionic/cli@7.1.1
    if %errorlevel% neq 0 (
      echo.
      echo ERROR: ionic install failed.
      call npm -g config set registry %REGISTRY%
      call npm -g config set strict-ssl true
      pause
      exit
    )
  )

  call ionic --version
  if %errorlevel% neq 0 (
    echo.
    echo ERROR: ionic command failed.
    call npm -g config set registry %REGISTRY%
    call npm -g config set strict-ssl true
    pause
    exit
  )

  echo OK

) else (
  echo OK
)
echo +--------------------------+


echo.
echo +-- install %INSTALL_DIR%\%PACKAGE_NAME% --+

if not exist "%INSTALL_DIR%\%PACKAGE_NAME%" (
  echo mkdir "%INSTALL_DIR%\%PACKAGE_NAME%"
  mkdir "%INSTALL_DIR%\%PACKAGE_NAME%"
)
echo pushd "%INSTALL_DIR%\%PACKAGE_NAME%"
pushd "%INSTALL_DIR%\%PACKAGE_NAME%"

echo.
echo xcopy /E /Y /Q "%ROOT_DIR%data" "%INSTALL_DIR%\%PACKAGE_NAME%"
xcopy /E /Y /Q "%ROOT_DIR%data" "%INSTALL_DIR%\%PACKAGE_NAME%"

if exist android\src (
  echo.
  echo rd /s /q android\src
  rd /s /q android\src
)

echo.
echo mklink /D android\src "%INSTALL_DIR%\%PACKAGE_NAME%\src"
mklink /D android\src "%INSTALL_DIR%\%PACKAGE_NAME%\src"
if %errorlevel% neq 0 (
  echo.
  echo ERROR: Please run the batch as administrator.
  call npm -g config set registry %REGISTRY%
  call npm -g config set strict-ssl true
  pause
  exit
)

echo.
echo rd /s /q android
rd /s /q android

echo.
echo npm install
call npm install
if %errorlevel% neq 0 (
  echo.
  echo ERROR: npm install failed.
  echo RETRY: npm install.
  echo npm -g config set registry http://registry.npmjs.org/
  call npm -g config set registry http://registry.npmjs.org/

  echo npm -g config set strict-ssl false
  call npm -g config set strict-ssl false

  echo npm install
  call npm install
  if %errorlevel% neq 0 (
    echo.
    echo ERROR: npm install failed.
    call npm -g config set registry %REGISTRY%
    call npm -g config set strict-ssl true
    pause
    exit
  )
)

echo.
echo ionic cap sync
call ionic cap sync
if %errorlevel% neq 0 (
  echo.
  echo ERROR: ionic cap sync failed.

  echo.
  echo re-install ionic.
  call npm uninstall -g ionic
  call npm install -g @ionic/cli@7.1.1
  if %errorlevel% neq 0 (
    echo.
    echo ERROR: ionic install failed.
    call npm -g config set registry %REGISTRY%
    call npm -g config set strict-ssl true
    pause
    exit
  )

  echo.
  echo ionic cap sync
  call ionic cap sync
  if %errorlevel% neq 0 (
    echo.
    echo ERROR: ionic cap sync failed.
    call npm -g config set registry %REGISTRY%
    call npm -g config set strict-ssl true
    pause
    exit
  )
)

echo.
echo npx cap sync
call npx cap sync
if %errorlevel% neq 0 (
  echo.
  echo ERROR: npx cap sync failed.
  call npm -g config set registry %REGISTRY%
  call npm -g config set strict-ssl true
  pause
  exit
)

echo.
echo ionic build
call ionic build
if %errorlevel% neq 0 (
  echo.
  echo ERROR: ionic build failed.
  call npm -g config set registry %REGISTRY%
  call npm -g config set strict-ssl true
  pause
  exit
)


if not exist "%INSTALL_DIR%\%PACKAGE_NAME%\android" (
  echo.
  echo npx cap add android
  call npx cap add android
)

echo.
echo xcopy /E /Y /Q "%ROOT_DIR%data\android" "%INSTALL_DIR%\%PACKAGE_NAME%\android"
xcopy /E /Y /Q "%ROOT_DIR%data\android" "%INSTALL_DIR%\%PACKAGE_NAME%\android"

echo.
echo mklink /D android\src "%INSTALL_DIR%\%PACKAGE_NAME%\src"
mklink /D android\src "%INSTALL_DIR%\%PACKAGE_NAME%\src"
if %errorlevel% neq 0 (
  echo.
  echo ERROR: mklink command failed.
  echo Please run the batch as administrator.
  call npm -g config set registry %REGISTRY%
  call npm -g config set strict-ssl true
  pause
  exit
)

echo.
echo INSTALL FINISH.
echo +------------------------------------------+

echo.
echo +-- build %INSTALL_DIR%\%PACKAGE_NAME% --+
echo ionic capacitor build android
call ionic capacitor build android
if %errorlevel% neq 0 (
  echo.
  echo ERROR: ionic capacitor build failed.
  call npm -g config set registry %REGISTRY%
  call npm -g config set strict-ssl true
  pause
  exit
)
echo +----------------------------------------+

call npm -g config set registry %REGISTRY%
call npm -g config set strict-ssl true

endlocal
pause
