@echo off
cd /d D:\Projects\TRACE
git add -A
git commit -m "session close: dispatch system, photos, admin, UX audit, handoff"
git push origin main
echo.
echo === PUSH COMPLETE ===
echo.
echo NEXT SESSION: Read HANDOFF.md, start with Phase 1 (schema push + verify deployment)
