@echo off
chcp 65001 >nul
setlocal EnableExtensions
title Saha Kiralama - Kurulum

set "KAYNAK=https://voleybol.digital/saha-kirala/indir/saha-kiralama.zip"
set "HEDEF=%LOCALAPPDATA%\SahaKiralama"

echo.
echo   ============================================
echo     Saha Kiralama Otomasyonu - Kurulum
echo   ============================================
echo.
echo   Kurulacagi yer: %HEDEF%
echo.

REM ======================================================== 1/5  Python
echo   [1/5] Python kontrol ediliyor...
set "PY="
py -3 --version >nul 2>&1 && set "PY=py -3"
if not defined PY (
    python --version >nul 2>&1 && set "PY=python"
)

if not defined PY (
    echo         Python bulunamadi, kuruluyor...
    where winget >nul 2>&1
    if errorlevel 1 (
        echo.
        echo   [DUR] Python kurulu degil ve otomatik kurulamiyor.
        echo         Su adresten kurun: https://www.python.org/downloads/
        echo         Kurulum ekraninda "Add python.exe to PATH" kutusunu isaretleyin,
        echo         sonra bu dosyayi tekrar calistirin.
        echo.
        pause
        exit /b 1
    )
    winget install --id Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements
    REM winget PATH'i bu pencereye yansitmaz; bilinen konumu deneyelim.
    set "PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    if not exist "%PY%" (
        echo.
        echo   Python kuruldu. Lutfen bu pencereyi kapatip kur.bat dosyasini
        echo   TEKRAR calistirin ^(PATH'in guncellenmesi icin gerekli^).
        echo.
        pause
        exit /b 0
    )
)
echo         Tamam.

REM ======================================================== 2/5  Chrome
echo   [2/5] Google Chrome kontrol ediliyor...
set "CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=1"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=1"
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "CHROME=1"
if not defined CHROME (
    echo         Chrome bulunamadi, kuruluyor...
    where winget >nul 2>&1
    if errorlevel 1 (
        echo         [UYARI] Otomatik kurulamadi. https://www.google.com/chrome/
    ) else (
        winget install --id Google.Chrome --silent --accept-package-agreements --accept-source-agreements
    )
)
echo         Tamam.

REM ======================================================== 3/5  Indirme
echo   [3/5] Uygulama indiriliyor...
if exist "%HEDEF%" rmdir /s /q "%HEDEF%"
mkdir "%HEDEF%" 2>nul

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;" ^
  "$z=Join-Path $env:TEMP 'saha-kiralama.zip';" ^
  "Invoke-WebRequest -Uri '%KAYNAK%' -OutFile $z -UseBasicParsing;" ^
  "Expand-Archive -Path $z -DestinationPath $env:TEMP -Force;" ^
  "Copy-Item -Path (Join-Path $env:TEMP 'saha-kiralama\*') -Destination '%HEDEF%' -Recurse -Force;" ^
  "Remove-Item $z -Force"

if errorlevel 1 (
    echo.
    echo   [HATA] Indirme basarisiz. Internet baglantinizi kontrol edip
    echo          tekrar deneyin.
    echo.
    pause
    exit /b 1
)
echo         Tamam.

REM ======================================================== 4/5  Paketler
echo   [4/5] Gerekli paketler kuruluyor ^(birkac dakika surebilir^)...
pushd "%HEDEF%"
%PY% -m venv .venv
if errorlevel 1 (
    echo   [HATA] Python ortami olusturulamadi.
    popd & pause & exit /b 1
)
".venv\Scripts\python.exe" -m pip install --quiet --upgrade pip
".venv\Scripts\python.exe" -m pip install --quiet -r requirements.txt
if errorlevel 1 (
    echo   [HATA] Paketler kurulamadi.
    popd & pause & exit /b 1
)
popd
echo         Tamam.

REM ======================================================== 5/5  Kisayol
echo   [5/5] Masaustu kisayolu olusturuluyor...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$s=(New-Object -ComObject WScript.Shell).CreateShortcut(" ^
  "[Environment]::GetFolderPath('Desktop')+'\Saha Kiralama.lnk');" ^
  "$s.TargetPath='%HEDEF%\baslat.bat'; $s.WorkingDirectory='%HEDEF%';" ^
  "$s.IconLocation='%SystemRoot%\System32\shell32.dll,14'; $s.Save()"
echo         Tamam.

echo.
echo   ============================================
echo     Kurulum tamamlandi.
echo   ============================================
echo.
echo   Bundan sonra masaustundeki "Saha Kiralama" kisayoluna
echo   cift tiklamaniz yeterli.
echo.
echo   Simdi baslatiliyor...
echo.
start "" "%HEDEF%\baslat.bat"
timeout /t 4 >nul
