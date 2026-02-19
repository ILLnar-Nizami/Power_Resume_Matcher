"""FastAPI application entry point."""

import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI

# Fix for Windows: Use ProactorEventLoop for subprocess support (Playwright)
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

logger = logging.getLogger(__name__)
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.config import settings
from app.database import db
from app.database.connection import init_db, close_db
from app.pdf import close_pdf_renderer, init_pdf_renderer
from app.routers import (
    config_router,
    enrichment_router,
    health_router,
    jobs_router,
    resumes_router,
    tailor_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    settings.data_dir.mkdir(parents=True, exist_ok=True)

    # Initialize PostgreSQL database tables
    try:
        await init_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        raise

    # PDF renderer uses lazy initialization - will initialize on first use
    # await init_pdf_renderer()
    yield
    # Shutdown - wrap each cleanup in try-except to ensure all resources are released
    try:
        await close_pdf_renderer()
    except Exception as e:
        logger.error(f"Error closing PDF renderer: {e}")

    try:
        await close_db()
    except Exception as e:
        logger.error(f"Error closing database: {e}")


app = FastAPI(
    title="Resume Matcher API",
    description="AI-powered resume tailoring for job descriptions",
    version=__version__,
    lifespan=lifespan,
)

# CORS middleware - origins configurable via CORS_ORIGINS env var
# Default to allowing all common development origins for debugging
default_origins = [
    "http://localhost:3333",
    "http://127.0.0.1:3333",
    "http://localhost:8888",
    "http://127.0.0.1:8888",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

cors_env = os.environ.get("CORS_ORIGINS_LIST", "")
if cors_env:
    cors_list = [o.strip() for o in cors_env.split(",") if o.strip()]
else:
    cors_list = default_origins

print(f"[DEBUG] CORS origins: {cors_list}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

# Include routers
app.include_router(health_router, prefix="/api/v1")
app.include_router(config_router, prefix="/api/v1")
app.include_router(resumes_router, prefix="/api/v1")
app.include_router(jobs_router, prefix="/api/v1")
app.include_router(tailor_router, prefix="/api/v1")
app.include_router(enrichment_router, prefix="/api/v1")


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "Resume Matcher API",
        "version": __version__,
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
    )
