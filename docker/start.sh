#!/bin/bash
set -e

# ============================================
# Resume Matcher - Docker Startup Script
# ============================================
# This script runs INSIDE the Docker container
# It starts both frontend and backend services
# ============================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'
BOLD='\033[1m'

# Get ports from environment (set by docker-compose)
FRONTEND_PORT="${FRONTEND_PORT:-3333}"
BACKEND_PORT="${BACKEND_PORT:-8888}"

print_banner() {
    echo -e "${CYAN}"
    cat << 'EOF'

 ██████╗ ███████╗███████╗██╗   ██╗███╗   ███╗███████╗
 ██╔══██╗██╔════╝██╔════╝██║   ██║████╗ ████║██╔════╝
 ██████╔╝█████╗  ███████╗██║   ██║██╔████╔██║█████╗
 ██╔══██╗██╔══╝  ╚════██║██║   ██║██║╚██╔╝██║██╔══╝
 ██║  ██║███████╗███████║╚██████╔╝██║ ╚═╝ ██║███████╗
 ╚═╝  ╚═╝╚══════╝╚══════╝ ╚═════╝ ╚═╝     ╚═╝╚══════╝

 ███╗   ███╗ █████╗ ████████╗ ██████╗██╗  ██╗███████╗██████╗
 ████╗ ████║██╔══██╗╚══██╔══╝██╔════╝██║  ██║██╔════╝██╔══██╗
 ██╔████╔██║███████║   ██║   ██║     ███████║█████╗  ██████╔╝
 ██║╚██╔╝██║██╔══██║   ██║   ██║     ██╔══██║██╔══╝  ██╔══██╗
 ██║ ╚═╝ ██║██║  ██║   ██║   ╚██████╗██║  ██║███████╗██║  ██║
 ╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝    ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝

EOF
    echo -e "${NC}"
    echo -e "${BOLD}        Resume Matcher - Docker${NC}"
    echo ""
}

status() { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${BLUE}[i]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }

print_banner

echo "Port Configuration:"
echo -e "  ${BOLD}Frontend:${NC}  $FRONTEND_PORT"
echo -e "  ${BOLD}Backend:${NC}   $BACKEND_PORT"
echo ""

# Check and create data directory
info "Checking data directory..."
DATA_DIR="/app/backend/data"
if [ ! -d "$DATA_DIR" ]; then
    mkdir -p "$DATA_DIR"
    status "Created data directory: $DATA_DIR"
else
    status "Data directory exists: $DATA_DIR"
fi

# Cleanup function
cleanup() {
    echo ""
    info "Shutting down..."
    if [ -n "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    exit 0
}
trap cleanup SIGTERM SIGINT

# Start backend
echo ""
info "Starting backend on port $BACKEND_PORT..."
cd /app/backend
python -m uvicorn app.main:app --host 0.0.0.0 --port $BACKEND_PORT &
BACKEND_PID=$!

# Wait for backend
info "Waiting for backend..."
for i in {1..30}; do
    if curl -s "http://localhost:$BACKEND_PORT/api/v1/health" > /dev/null 2>&1; then
        status "Backend ready"
        break
    fi
    if [ $i -eq 30 ]; then
        error "Backend failed to start"
        exit 1
    fi
    sleep 1
done

# Start frontend
echo ""
info "Starting frontend on port $FRONTEND_PORT..."
cd /app/frontend
export PORT="$FRONTEND_PORT"
npm start &
FRONTEND_PID=$!

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
status "Resume Matcher is running!"
echo ""
echo -e "  ${BOLD}Frontend:${NC}  http://localhost:$FRONTEND_PORT"
echo -e "  ${BOLD}Backend:${NC}   http://localhost:$BACKEND_PORT"
echo -e "  ${BOLD}API Docs:${NC}  http://localhost:$BACKEND_PORT/docs"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Wait for frontend
wait $FRONTEND_PID
