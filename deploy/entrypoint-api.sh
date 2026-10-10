#!/bin/sh
set -e

echo "[FlowCart API] Running database migrations..."
node packages/db/dist/migrate.js

echo "[FlowCart API] Migrations completed successfully. Starting API server..."
exec node apps/api/dist/server.js
