ECHO OFF

REM ===================================================================
:INPUT_START
ECHO +--------------+
ECHO  プロキシURLを入力してください。
ECHO    例：http://proxyserver:8080
ECHO    例：http://userid:password@proxyserver:8080
ECHO  ※設定をクリアする場合は delete を入力してください。
SET INPUT_STR=
SET /P INPUT_STR=

IF "%INPUT_STR%"=="delete" GOTO :DELETE_START
IF "%INPUT_STR%"=="" GOTO :INPUT_START

REM ===================================================================
:INPUT_CONF

echo.
ECHO +--------------+
ECHO  入力した文字は[%INPUT_STR%]でよろしいですか？ （Y / N）
SET CONF_SELECT=
SET /P CONF_SELECT=

IF "%CONF_SELECT%"=="" SET CONF_SELECT=N
IF /I NOT "%CONF_SELECT%"=="Y"  GOTO :INPUT_START

echo.
echo +-- proxy set --+
echo npm -g config set proxy "%INPUT_STR%"
call npm -g config set proxy "%INPUT_STR%"

echo.
echo +-- https-proxy set --+
echo npm -g config set https-proxy "%INPUT_STR%"
call npm -g config set https-proxy "%INPUT_STR%"

echo.
echo +-- config list --+
echo npm config list
call npm config list


GOTO :INPUT_END

echo.
REM ===================================================================
:DELETE_START

echo.
echo +-- proxy delete --+
echo npm -g config delete proxy
call npm -g config delete proxy

echo.
echo +-- https-proxy delete --+
echo npm -g config delete https-proxy
call npm -g config delete https-proxy

echo.
echo +-- registry set --+
echo npm -g config set registry https://registry.npmjs.org/
call npm -g config set registry https://registry.npmjs.org/

echo.
echo +-- strict-ssl set --+
echo npm -g config set strict-ssl true
call npm -g config set strict-ssl true

echo.
echo +-- config list --+
echo npm config list
call npm config list

GOTO :INPUT_END

echo.
REM ===================================================================
:INPUT_END

pause

