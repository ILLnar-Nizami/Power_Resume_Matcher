#!/bin/bash

set -e

FRONTEND_PORT=3333
BACKEND_PORT=8888

show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --start     Start Power Resume Matcher"
    echo "  --stop      Stop Power Resume Matcher"
    echo "  --restart   Restart Power Resume Matcher (applies updates)"
    echo "  --status    Show status of containers"
    echo "  -h, --help  Show this help message"
    echo ""
    echo "Ports: Frontend=$FRONTEND_PORT, Backend=$BACKEND_PORT"
}

start_services() {
    echo "🚀 Starting Power Resume Matcher..."

    FRONTEND_PORT=$FRONTEND_PORT BACKEND_PORT=$BACKEND_PORT docker compose up -d

    echo ""
    echo "✅ Power Resume Matcher is running!"
    echo ""
    echo "   Frontend:  http://localhost:$FRONTEND_PORT"
    echo "   Backend:   http://localhost:$BACKEND_PORT"
    echo "   API Docs:  http://localhost:$BACKEND_PORT/docs"
    echo ""
    echo "🛑 To stop: $0 --stop"
}

stop_services() {
    echo "🛑 Stopping Power Resume Matcher..."
    docker compose down
    echo "✅ Stopped!"
}

show_status() {
    echo "📊 Power Resume Matcher Status:"
    echo ""
    docker compose ps
}

restart_services() {
    echo "🔄 Restarting Power Resume Matcher (applying updates)..."
    docker compose down
    FRONTEND_PORT=$FRONTEND_PORT BACKEND_PORT=$BACKEND_PORT docker compose up -d
    echo ""
    echo "✅ Restart complete!"
    echo ""
    echo "   Frontend:  http://localhost:$FRONTEND_PORT"
    echo "   Backend:   http://localhost:$BACKEND_PORT"
    echo "   API Docs:  http://localhost:$BACKEND_PORT/docs"
}

case "${1:-}" in
    --start)
        start_services
        ;;
    --stop)
        stop_services
        ;;
    --restart)
        restart_services
        ;;
    --status)
        show_status
        ;;
    -h|--help)
        show_usage
        ;;
    *)
        echo "Error: Unknown option '$1'"
        echo ""
        show_usage
        exit 1
        ;;
esac
