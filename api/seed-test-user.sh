#!/bin/bash

# Generate SHA-256 hash of "testpass123" using Node.js (portable across macOS/Linux)
HASH=$(node -e "console.log(require('crypto').createHash('sha256').update('testpass123').digest('hex'))")

echo "Creating test user in local KV..."
echo "Username: testuser"
echo "Password: testpass123"
echo "Password hash: $HASH"

# Create user in local KV
npx wrangler kv:key put --binding USERS --local "user:testuser" "{
  \"username\": \"testuser\",
  \"passwordHash\": \"$HASH\",
  \"email\": \"test@example.com\",
  \"isPro\": true,
  \"plan\": \"pro\",
  \"createdAt\": 1700000000000
}"

echo ""
echo "✅ Test user created!"
echo ""
echo "Login with:"
echo "  Username: testuser"
echo "  Password: testpass123"
echo ""
echo "Test with:"
echo "  curl -X POST http://localhost:8787/api/auth \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"username\": \"testuser\", \"password\": \"testpass123\"}'"
