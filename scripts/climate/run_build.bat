@echo off
rem After run_coverage.bat has finished: builds the figures, checks their
rem accuracy and the Holiday Climate Index. No downloads, no key.
cd /d "%~dp0"
set "PY=python"
if exist "%USERPROFILE%\anaconda3\python.exe" set "PY=%USERPROFILE%\anaconda3\python.exe"
"%PY%" check_cells.py
"%PY%" build_normals.py
"%PY%" merge_sources.py
"%PY%" validate_climate.py
"%PY%" build_hci.py
echo.
echo Done. Tell Claude in the chat: "build finished".
pause
