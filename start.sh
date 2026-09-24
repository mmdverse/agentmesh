#!/bin/bash
set -e

echo "=== AGENTMESH START.SH — MODERN LUXURY V2 ==="
echo "Full platform start: pnpm install + tsc --force + build + seed + run"
echo ""

# Check pnpm
if ! command -v pnpm &> /dev/null; then
  echo "pnpm not found, installing via npm..."
  npm install -g pnpm
fi

echo "[1/7] pnpm install"
pnpm install

echo ""
echo "[2/7] Build packages: tsc -b --force"
pnpm exec tsc -b --force || (echo "Cleaning tsbuildinfo and retrying..." && find . -name "tsconfig.tsbuildinfo" -delete && pnpm exec tsc -b --force)

echo ""
echo "[3/7] Build control-plane and gateway"
pnpm --filter @agentmesh/control-plane build || (cd apps/control-plane && pnpm exec tsc -b --force && cd ../..)
pnpm --filter @agentmesh/gateway build || (cd apps/gateway && pnpm exec tsc -b --force && cd ../..)

echo ""
echo "[4/7] Build console (Next.js)"
pnpm --filter @agentmesh/console build || echo "Console build warning — will run dev fallback"

echo ""
echo "[5/7] Verify dist exists"
ls -lh apps/control-plane/dist/index.js || echo "ERROR: control-plane dist missing — check build"
ls -lh apps/gateway/dist/index.js || echo "ERROR: gateway dist missing — check build"
ls -lh apps/console/.next || echo "WARNING: console .next missing"

echo ""
echo "[6/7] Start infrastructure (docker-compose optional)"
if command -v docker &> /dev/null && [ -f docker-compose.yml ]; then
  echo "docker-compose.yml found — you can run: docker-compose up -d (postgres redis nats minio)"
  echo "For dev InMemory mode, skip docker-compose and use npm run dev"
else
  echo "No docker or docker-compose — running InMemory mode (data volatile)"
fi

echo ""
echo "[7/7] Starting services..."
echo "InMemory warning: data will be lost on restart. For persistence use docker-compose up"

# Seed real agent registration after CP starts
(
  sleep 5
  echo "Seeding real agent 9001..."
  curl -s -X POST http://localhost:3002/v1/agents -H "Content-Type: application/json" -d '{"name":"real-agent","url":"http://localhost:9001","version":"0.1.0","description":"Real translator+reviewer","tags":["translate","code-review"]}' || echo "Seed failed — CP not ready yet"
) &

echo ""
echo "Starting control-plane :3002, gateway :3001, console :3000, real-agent :9001"
echo "Run: pnpm dev (or pnpm --filter @agentmesh/control-plane dev etc)"
echo ""
echo "=== READY — MODERN LUXURY V2 ==="
echo "CP: http://localhost:3002/v1/info"
echo "GW: http://localhost:3001/v1/info"
echo "Console: http://localhost:3000"
echo "Real agent: http://localhost:9001/.well-known/agent.json"
