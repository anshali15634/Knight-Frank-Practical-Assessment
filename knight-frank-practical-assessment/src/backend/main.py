import os
import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, Field
from pwdlib import PasswordHash
from supabase import Client, create_client
from supabase.lib.client_options import SyncClientOptions
from postgrest import APIError
from auth_tokens import create_access_token
from properties import router as properties_router  # NEW: property search endpoints

from agent.router import router as agent_router  # NEW: LangGraph agent endpoints

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# -----------------------------------------
# Configuration
# -----------------------------------------

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")

if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
    raise RuntimeError(
        "Missing SUPABASE_URL or SUPABASE_SECRET_KEY. "
        "Set them in backend/.env before starting the server."
    )

password_hash = PasswordHash.recommended()
supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SECRET_KEY,
    options=SyncClientOptions(
        postgrest_client_timeout=10,
    ),
)

# -----------------------------------------
# Application
# -----------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Knight Frank assessment API starting.")
    yield
    logger.info("Knight Frank assessment API shutting down.")


app = FastAPI(
    title="Knight Frank Assessment API",
    description=(
        "Frontend-independent registration and login API, plus the Knight Frank "
        "Dubai market AI agent (/chat). "
        "Authentication uses the custom public.kf_users table."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",    # Swagger UI
    redoc_url="/redoc",
)

@app.exception_handler(APIError)
async def supabase_api_error(request, exc: APIError):
    logger.error("Supabase error on %s: %s", request.url.path, exc.message)
    return JSONResponse(status_code=502, content={"detail": "Database error."})


frontend_origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

# NEW: mount the agent's /chat endpoint
app.include_router(agent_router)
app.include_router(properties_router)

# -----------------------------------------
# Request and response models
# -----------------------------------------

class SignupRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=150)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

class AuthResponse(BaseModel):
    message: str
    redirect_to: str | None = None
    full_name: str | None = None
    access_token: str | None = None

class HealthResponse(BaseModel):
    status: str


# -----------------------------------------
# Helper functions
# -----------------------------------------

def normalize_email(email: str) -> str:
    return email.strip().lower()


def get_user_by_email(email: str) -> dict | None:
    """Find one user by normalized email."""
    result = (
        supabase.table("kf_users")
        .select("id, full_name, email, password")
        .eq("email", normalize_email(email))
        .limit(1)
        .execute()
    )

    return result.data[0] if result.data else None


def hash_password(plain_password: str) -> str:
    """Hash a password before it is stored."""
    return password_hash.hash(plain_password)


def verify_password(plain_password: str, stored_hash: str) -> bool:
    """Compare a password against its stored Argon2 hash."""
    try:
        return password_hash.verify(plain_password, stored_hash)
    except (ValueError, TypeError):
        # Handles invalid hashes and legacy plaintext test records.
        return False


def database_error(operation: str, exc: Exception) -> None:
    # Do not log passwords, secret keys, or request bodies.
    logger.error("Database operation failed: %s", operation)
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="The database service is temporarily unavailable.",
    ) from exc


# -----------------------------------------
# Health check
# -----------------------------------------

@app.get("/health", response_model=HealthResponse, tags=["System"])
def health_check():
    return {"status": "ok"}


# -----------------------------------------
# Sign up
# -----------------------------------------

@app.post(
    "/auth/signup",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Authentication"],
)
def signup(payload: SignupRequest):
    full_name = payload.full_name.strip()
    email = normalize_email(str(payload.email))

    if not full_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Full name cannot be blank.",
        )

    try:
        existing_user = get_user_by_email(email)

        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "An account with this email already exists. "
                    "Please log in instead."
                ),
            )

        # Never store the submitted password directly.
        new_user = {
            "full_name": full_name,
            "email": email,
            "password": hash_password(payload.password),
        }

        result = (
            supabase.table("kf_users")
            .insert(new_user)
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Account creation failed.",
            )

        return AuthResponse(
            message=(
                "Account created successfully. "
                "You can now log in."
            ),
            redirect_to="/",
        )

    except HTTPException:
        raise
    except Exception as exc:
        database_error("signup", exc)


# -----------------------------------------
# Login
# -----------------------------------------

@app.post(
    "/auth/login",
    response_model=AuthResponse,
    tags=["Authentication"],
)
def login(payload: LoginRequest):
    email = normalize_email(str(payload.email))

    try:
        user = get_user_by_email(email)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=(
                    "No account exists with this email. "
                    "Please sign up first."
                ),
            )

        if not verify_password(payload.password, user["password"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return AuthResponse(
            message=f"Login successful. Welcome, {user['full_name']}!",
            redirect_to="/landing",
            full_name=user["full_name"],
            access_token=create_access_token(user["id"]),
        )

    except HTTPException:
        raise
    except Exception as exc:
        database_error("login", exc)


# -----------------------------------------
# Placeholder success page endpoint
# -----------------------------------------

@app.get("/success", tags=["Authentication"])
def success_page():
    return JSONResponse(
        content={
            "message": "Login successful. Welcome to the assessment platform.",
            "page": "success",
        }
    )