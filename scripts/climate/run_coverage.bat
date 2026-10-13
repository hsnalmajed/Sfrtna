@echo off
rem Climate data for every city (current + being added) and the stations
rem that calibrate them: ERA5-Land 1991-2020, ERA5 cloud cover, ground heights.
rem Six ERA5-Land downloaders in parallel. Resumable: run again to continue.
rem Your Copernicus key stays in %USERPROFILE%\.cdsapirc - nothing here reads or stores it.
cd /d "%~dp0\..\.."
where git >nul 2>nul && git pull
set "PY=python"
if exist "%USERPROFILE%\anaconda3\python.exe" set "PY=%USERPROFILE%\anaconda3\python.exe"
"%PY%" -m pip install --quiet "cdsapi>=0.7.2" pandas numpy timezonefinder xarray netCDF4
cd scripts\climate
"%PY%" fetch_static.py
for /L %%i in (0,1,5) do start "ERA5-Land %%i" "%PY%" fetch_era5land.py --part=%%i/6
start "Cloud cover" "%PY%" fetch_cloud.py
echo.
echo Seven download windows started. Leave them running until each says it is done
echo (several hours). Then double-click run_build.bat in this folder.
pause
