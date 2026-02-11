#!/bin/bash
set -e

echo "🚀 Starting Power Resume Matcher..."

# Start Docker services
docker compose up -d

echo ""
echo "✅ Power Resume Matcher is running!"
echo ""
echo "   Frontend:  http://localhost:3333"
echo "   Backend:   http://localhost:8888"
echo "   API Docs:  http://localhost:8888/docs"
echo ""
echo "🛑 To stop: docker compose down"
