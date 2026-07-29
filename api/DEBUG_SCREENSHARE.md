# Debug Screenshare Pro Validation

## The Issue
The screenshare bypass shows "This feature requires NeoPass Pro" even though the user is logged in as Pro.

## Validation Flow

1. **screenshare.js calls `validateProAccess()`**
2. **`getNeoPassToken()` retrieves token from chrome.storage.local**
3. **API call to `/api/account` with Bearer token**
4. **Checks if `data.success && data.account?.isPro === true`**

## Test the API Response

```bash
cd /home/sanjay7178/NeoPass/api

# Get token
TOKEN=$(curl -s -X POST http://localhost:8787/api/auth \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "testpass123"}' | jq -r '.accessToken')

echo "Token: $TOKEN"
echo ""

# Test account endpoint (what screenshare.js calls)
echo "=== /api/account response ==="
curl -s http://localhost:8787/api/account \
  -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "Expected check: data.success && data.account?.isPro === true"
```

## Expected Result
```json
{
  "success": true,
  "account": {
    "isPro": true,
    ...
  }
}
```

## Possible Issues

1. **Token not stored in chrome.storage.local**
   - Check chrome://extensions/ > NeoPass > Storage
   - Look for `accessToken` key

2. **API URL mismatch**
   - screenshare.js uses `NP_API_BASE`
   - popup.js uses `API_BASE_URL`
   - Both should point to your local API

3. **CORS issues**
   - Content scripts have different CORS rules
   - Check browser console for errors

4. **Token expired**
   - JWT tokens expire after 12 hours
   - Logout and re-login

## Quick Fix

If the API response is correct but validation still fails, the issue might be in how the extension checks the response. The validation code is:

```javascript
return data.success && data.account?.isPro === true;
```

This should work with our API response. Check the browser console for any errors when the validation runs.
