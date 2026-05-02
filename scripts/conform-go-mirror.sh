#!/usr/bin/env bash
# Conformance check for go-backend (mirror of Python FastAPI).
# Run from repo root or any directory.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/go-backend"

echo "== Go mirror conformance: $ROOT/go-backend =="

echo ">> go fmt (apply standard formatting)"
go fmt ./...

echo ">> go vet (static analysis)"
go vet ./...

echo ">> go test ./..."
go test ./... -count=1

echo ">> go build"
go build -o /tmp/estate-go-server ./cmd/server/

echo "OK: Go mirror builds, tests pass, and vet is clean."
echo ""
echo "Note: The Go merge pipeline is a subset of Python document_service."
echo "      See go-backend/README.md Known TODOs for full parity gaps."
