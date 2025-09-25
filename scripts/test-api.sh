#!/bin/bash
set -euo pipefail

echo "Testing mandatory Hostaway endpoint..."
curl -s "http://localhost:3001/api/reviews/hostaway?format=simple&page=1&limit=5" | jq . | head -n 50

echo "\nTesting with filters (approved=true)..."
curl -s "http://localhost:3001/api/reviews/hostaway?approved=true&page=1&limit=5&format=simple" | jq . | head -n 50

echo "\nTesting reviews endpoint..."
curl -s "http://localhost:3001/api/reviews" | jq . | head -n 50

echo "\nTesting listings endpoint..."
curl -s "http://localhost:3001/api/listings" | jq . | head -n 50

echo "\nTesting health endpoint..."
curl -s "http://localhost:3001/api/health" | jq . | head -n 50

echo "\nTesting hostaway metrics..."
curl -s "http://localhost:3001/api/reviews/hostaway/metrics" | jq . | head -n 50

echo "\nDone."


