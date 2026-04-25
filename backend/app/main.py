import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import traceback

from app.config import get_settings
from app.database import engine, Base
from app.routers import auth as auth_router
from app.routers import users as users_router
from app.routers import chat as chat_router
from app.routers import claims as claims_router
from app.routers import leagues as leagues_router
from app.routers import admin_leagues as admin_leagues_router
from app.routers import stats as stats_router
from app.limiter import limiter

# Import all models so SQLAlchemy registers them
from app.models import *  # noqa

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="eFootball Arena API",
    description="Private eFootball league platform — trophies, Lord of the Game, AI coach.",
    version="3.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)

uploads_dir = settings.UPLOAD_DIR
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# Routers
app.include_router(auth_router.router)
app.include_router(users_router.router)
app.include_router(leagues_router.router)
app.include_router(admin_leagues_router.router)
app.include_router(claims_router.router)
app.include_router(chat_router.router)
app.include_router(stats_router.router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    print(f"UNHANDLED ERROR: {exc}\n{tb}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"},
    )


@app.get("/")
def root():
    return {"message": "eFootball Arena API v3.0 running", "version": "3.0.0"}


@app.get("/api/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_dirs=["app"],
    )
