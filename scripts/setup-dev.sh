#!/bin/bash
set -euo pipefail

echo "Setting up FlexLiving Reviews Dashboard..."

ROOT_DIR=$(cd "$(dirname "$0")"/.. && pwd)

echo "Installing backend dependencies..."
cd "$ROOT_DIR/backend"
npm install --no-audit --no-fund

echo "Generating Prisma client..."
npm run db:generate || true

echo "Running database migrations..."
npm run db:migrate || true

echo "Seeding database..."
npm run db:seed || true

echo "Installing frontend dependencies..."
cd "$ROOT_DIR/frontend"
npm install --no-audit --no-fund

echo "Building frontend..."
npm run build || true

echo "Setup complete! Use 'docker-compose up -d' or run backend/frontend dev servers."


