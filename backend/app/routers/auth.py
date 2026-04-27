from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional

from jose import JWTError, jwt
import bcrypt

from app.database import get_db
from app.config import get_settings
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse, Token, GoogleLogin
from app.limiter import limiter
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()
security = HTTPBearer(auto_error=False)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRATION_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not credentials:
        raise credentials_exception
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


@router.post("/register")
@limiter.limit("5/minute")
def register(request: Request, user_data: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    # First user ever → automatically admin
    is_first_user = db.query(User).count() == 0
    role = "admin" if is_first_user else "user"

    user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=bcrypt.hashpw(user_data.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8"),
        avatar_url=user_data.avatar_url or "",
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": user.id, "role": user.role})
    return Token(access_token=token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
async def login(request: Request, credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not user.password_hash or not bcrypt.checkpw(credentials.password.encode("utf-8"), user.password_hash.encode("utf-8")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account deactivated")

    token = create_access_token({"sub": user.id, "role": user.role})

    # Generate AI advice on login (non-blocking — silenced on error)
    ai_advice: Optional[str] = None
    try:
        from app.services.chatbot import get_ai_advice_for_user
        ai_advice = await get_ai_advice_for_user(db, user.id)
    except Exception:
        ai_advice = None

    return Token(
        access_token=token,
        user=UserResponse.model_validate(user),
        ai_advice=ai_advice,
    )


@router.post("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


@router.post("/google", response_model=Token)
@limiter.limit("5/minute")
async def google_auth(request: Request, data: GoogleLogin, db: Session = Depends(get_db)):
    try:
        # Verify Google token
        idinfo = id_token.verify_oauth2_token(
            data.token, 
            google_requests.Request(), 
            settings.GOOGLE_CLIENT_ID
        )

        if idinfo["iss"] not in ["accounts.google.com", "https://accounts.google.com"]:
            raise ValueError("Wrong issuer")

        email = idinfo["email"]
        google_id = idinfo["sub"]
        name = idinfo.get("name", email.split("@")[0])
        picture = idinfo.get("picture", "")

        # Check if user exists by google_id
        user = db.query(User).filter(User.google_id == google_id).first()

        # If not, check by email
        if not user:
            user = db.query(User).filter(User.email == email).first()
            if user:
                # Link existing user to google_id
                user.google_id = google_id
                if not user.avatar_url:
                    user.avatar_url = picture
                db.commit()
            else:
                # Create new user
                is_first_user = db.query(User).count() == 0
                role = "admin" if is_first_user else "user"
                
                # Ensure unique username
                username = name
                base_username = username
                counter = 1
                while db.query(User).filter(User.username == username).first():
                    username = f"{base_username}{counter}"
                    counter += 1

                user = User(
                    username=username,
                    email=email,
                    google_id=google_id,
                    avatar_url=picture,
                    role=role,
                )
                db.add(user)
                db.commit()
                db.refresh(user)

        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account deactivated")

        token = create_access_token({"sub": user.id, "role": user.role})
        
        return Token(
            access_token=token,
            user=UserResponse.model_validate(user)
        )

    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Authentication error: {str(e)}")
