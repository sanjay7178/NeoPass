// Chrome Extension Console Debug Script
// Paste this in the extension's popup DevTools console or content script console

async function debugProValidation() {
  console.log('=== NeoPass Pro Validation Debug ===\n');

  // 1. Check what's in storage
  const storageData = await chrome.storage.local.get([
    'accessToken',
    'refreshToken',
    'isPro',
    'username',
    'loggedIn'
  ]);

  console.log('1. Storage contents:', storageData);
  console.log('   Has accessToken:', !!storageData.accessToken);
  console.log('   Has refreshToken:', !!storageData.refreshToken);
  console.log('   isPro:', storageData.isPro);
  console.log('   loggedIn:', storageData.loggedIn);
  console.log('   username:', storageData.username);
  console.log('');

  // 2. Try to call the API directly
  if (!storageData.accessToken) {
    console.error('❌ No accessToken found in storage!');
    return;
  }

  console.log('2. Testing API call with token...');
  try {
    const response = await fetch('http://localhost:8787/api/account', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${storageData.accessToken}`
      }
    });

    console.log('   Response status:', response.status);
    console.log('   Response ok:', response.ok);

    const data = await response.json();
    console.log('3. Response data:', data);
    console.log('   success:', data.success);
    console.log('   account.isPro:', data.account?.isPro);

    // 4. Check the validation logic
    const isValid = data.success && data.account?.isPro === true;
    console.log('4. Validation result:', isValid);

    if (isValid) {
      console.log('✅ Pro validation should PASS');
    } else {
      console.log('❌ Pro validation would FAIL');
      if (!data.success) console.log('   - data.success is false');
      if (data.account?.isPro !== true) console.log('   - account.isPro is not true');
    }
  } catch (error) {
    console.error('❌ API call failed:', error);
  }
}

// Run the debug
debugProValidation();
