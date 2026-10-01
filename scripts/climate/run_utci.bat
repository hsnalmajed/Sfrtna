@echo off
rem ERA5-HEAT (UTCI) 1991-2020: six downloaders in parallel. Resumable: run again to continue.
cd /d "%~dp0"
set "PY=python"
if exist "%USERPROFILE%\anaconda3\python.exe" set "PY=%USERPROFILE%\anaconda3\python.exe"
"%PY%" -m pip install --quiet "cdsapi>=0.7.2" xarray netCDF4
for /L %%i in (0,1,5) do start "UTCI worker %%i" "%PY%" scripts\climate\fetch_utci.py --worker=%%i/6
echo Six UTCI downloaders started in their own windows. Leave them running.
pause
