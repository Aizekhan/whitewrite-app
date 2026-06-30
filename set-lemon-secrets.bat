@echo off
echo Setting Lemon Squeezy API key in Firebase Secrets...
echo.

REM Set API key
firebase functions:secrets:set LEMON_SQUEEZY_API_KEY

echo.
echo API key set successfully!
echo.
echo Next: Deploy functions to get webhook URL
echo Then: Set LEMON_SQUEEZY_WEBHOOK_SECRET after creating webhook in LS dashboard
