#!/bin/bash
set -e

# ============================================
# Resume Matcher - Startup Script
# ============================================
# Usage:
#   ./app.sh start       Start all services
#   ./app.sh stop        Stop all services  
#   ./app.sh restart    Restart all services
#   ./app.sh status     Show status
#   ./app.sh logs       Show logs
#   ./app.sh help       Show help
#
# Environment variables:
#   FRONTEND_PORT    Frontend port (default: 3333)
#   BACKEND_PORT     Backend port (default: 8888)
#   POSTGRES_PORT    PostgreSQL port (default: 5433)
#   REDIS_PORT       Redis port (default: 6380)
# ============================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'
BOLD='\033[1m'

# Default ports
FRONTEND_PORT="${FRONTEND_PORT:-3333}"
BACKEND_PORT="${BACKEND_PORT:-8888}"
POSTGRES_PORT="${POSTGRES_PORT:-5433}"
REDIS_PORT="${REDIS_PORT:-6380}"

show_usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  start       Start all services (docker, db, redis, fe, be)"
    echo "  stop        Stop all services"
    echo "  restart     Restart all services"
    echo "  status      Show service status"
    echo "  logs        Show docker logs"
    echo "  build       Rebuild docker images"
    echo "  help        Show this help"
    echo ""
    echo "Environment variables:"
    echo "  FRONTEND_PORT    Frontend port (default: 3333)"
    echo "  BACKEND_PORT     Backend port (default: 8888)"
    echo "  POSTGRES_PORT    PostgreSQL port (default: 5433)"
    echo "  REDIS_PORT       Redis port (default: 6380)"
    echo ""
    echo "Examples:"
    echo "  $0 start"
    echo "  FRONTEND_PORT=3000 BACKEND_PORT=8000 $0 start"
}

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
    echo -e "${BOLD}        Resume Matcher - All in One${NC}"
    echo ""
}

status() { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${BLUE}[i]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }

start() {
    print_banner
    
    echo "Port Configuration:"
    echo -e "  ${BOLD}Frontend:${NC}   $FRONTEND_PORT"
    echo -e "  ${BOLD}Backend:${NC}    $BACKEND_PORT"
    echo -e "  ${BOLD}PostgreSQL:${NC} $POSTGRES_PORT"
    echo -e "  ${BOLD}Redis:${NC}      $REDIS_PORT"
    echo ""
    
    info "Starting Docker services..."
    
    # Set environment for docker-compose
    export FRONTEND_PORT
    export BACKEND_PORT
    export POSTGRES_PORT
    export REDIS_PORT
    
    # Start all services
    docker compose up -d
    
    info "Waiting for services to be ready..."
    
    # Wait for backend health
    for i in {1..60}; do
        if curl -s "http://localhost:${BACKEND_PORT}/api/v1/health" > /dev/null 2>&1; then
            status "Backend is ready"
            break
        fi
        if [ $i -eq 60 ]; then
            error "Backend failed to start within 60 seconds"
            echo "Run './app.sh logs' to see what's wrong"
            exit 1
        fi
        sleep 1
    done
    
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    status "Resume Matcher is running!"
    echo ""
    echo -e "  ${BOLD}Frontend:${NC}   http://localhost:${FRONTEND_PORT}"
    echo -e "  ${BOLD}Backend:${NC}    http://localhost:${BACKEND_PORT}"
    echo -e "  ${BOLD}API Docs:${NC}  http://localhost:${BACKEND_PORT}/docs"
    echo -e "  ${BOLD}PostgreSQL:${NC} localhost:${POSTGRES_PORT}"
    echo -e "  ${BOLD}Redis:${NC}      localhost:${REDIS_PORT}"
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    info "Run './app.sh logs' to view logs"
    info "Run './app.sh stop' to stop everything"
    echo ""
}

stop() {
    info "Stopping all services..."
    docker compose down
    status "All services stopped"
}

restart() {
    stop
    sleep 2
    start
}

status_cmd() {
    echo "Service Status:"
    echo ""
    docker compose ps
}

logs() {
    docker compose logs -f
}

build() {
    info "Building Docker images..."
    docker compose build --no-cache
    status "Build complete"
}

COMMAND="${1:-start}"

case "$COMMAND" in
    start) start ;;
    stop) stop ;;
    restart) restart ;;
    status) status_cmd ;;
    logs) logs ;;
    build) build ;;
    help|--help|-h) show_usage ;;
    *) error "Unknown command: $COMMAND"; show_usage; exit 1 ;;
esac
