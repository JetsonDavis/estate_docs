from fastapi import APIRouter, Depends, Response, HTTPException, status, Request
from sqlalchemy.orm import Session
from ..database import get_db
from ..schemas.auth import (
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    ChangePasswordRequest,
    MessageResponse,
)
from ..schemas.user import UserResponse
from ..services.auth_service import AuthService
from ..middleware.auth_middleware import require_auth, get_user_id
from ..middleware.rate_limit import auth_rate_limiter, get_client_ip
from ..config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: Request,
    register_data: RegisterRequest,
    db: Session = Depends(get_db)
) -> UserResponse:
    """
    Register a new user account.
    
    - **username**: Unique username (3-50 characters, alphanumeric with underscores)
    - **email**: Valid email address
    - **password**: Strong password (min 8 chars, uppercase, lowercase, digit)
    - **full_name**: Optional full name
    """
    auth_rate_limiter.check(get_client_ip(request))
    user = AuthService.register(db, register_data)
    return UserResponse.model_validate(user)


@router.post("/login", response_model=LoginResponse)
async def login(
    request: Request,
    login_data: LoginRequest,
    response: Response,
    db: Session = Depends(get_db)
) -> LoginResponse:
    """
    Login with username and password.
    
    Returns user information and sets httpOnly cookie with access token.
    
    - **username**: Username
    - **password**: Password
    """
    auth_rate_limiter.check(get_client_ip(request))
    user, access_token, refresh_token = AuthService.login(db, login_data)
    
    # Set httpOnly cookies
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=3600,  # 1 hour
    )
    
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=604800,  # 7 days
    )
    
    return LoginResponse(user=user.to_dict())


@router.post("/refresh", response_model=MessageResponse)
async def refresh_token(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
) -> MessageResponse:
    """
    Refresh access token using refresh token from cookie.
    
    Validates the token against the server-side store, revokes the old
    refresh token, and issues a rotated replacement (token rotation).
    """
    auth_rate_limiter.check(get_client_ip(request))
    from ..models.user import RefreshToken as RefreshTokenModel
    from ..utils.security import verify_token, create_access_token, create_refresh_token
    
    raw_refresh = request.cookies.get("refresh_token")
    
    if not raw_refresh:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found"
        )
    
    # Verify JWT signature and expiration
    payload = verify_token(raw_refresh)
    
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    jti = payload.get("jti")
    if not jti:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token (missing jti)"
        )
    
    # Validate against server-side store
    stored = db.query(RefreshTokenModel).filter(
        RefreshTokenModel.token_jti == jti
    ).first()
    
    if not stored or not stored.is_valid():
        # If token was already revoked, this may indicate theft — revoke ALL
        # tokens for the user as a precaution
        if stored and stored.is_revoked:
            db.query(RefreshTokenModel).filter(
                RefreshTokenModel.user_id == stored.user_id,
                RefreshTokenModel.is_revoked == False
            ).update({"is_revoked": True})
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked"
        )
    
    # Revoke the old refresh token (single use)
    stored.is_revoked = True
    
    # Create new access token
    token_data = {
        "sub": payload["sub"],
        "username": payload["username"],
        "role": payload["role"],
    }
    new_access_token = create_access_token(token_data)
    
    # Rotate: issue a new refresh token
    new_refresh_jwt, new_jti, new_expires = create_refresh_token(token_data)
    new_stored = RefreshTokenModel(
        user_id=int(payload["sub"]),
        token_jti=new_jti,
        expires_at=new_expires,
    )
    db.add(new_stored)
    db.commit()
    
    # Set new cookies
    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=3600,  # 1 hour
    )
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_jwt,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=604800,  # 7 days
    )
    
    return MessageResponse(message="Token refreshed successfully")


@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
) -> MessageResponse:
    """
    Logout current user by revoking refresh tokens and clearing cookies.
    """
    from ..models.user import RefreshToken as RefreshTokenModel
    from ..utils.security import verify_token
    
    # Try to revoke the specific refresh token from the cookie
    raw_refresh = request.cookies.get("refresh_token")
    if raw_refresh:
        payload = verify_token(raw_refresh)
        if payload and payload.get("jti"):
            stored = db.query(RefreshTokenModel).filter(
                RefreshTokenModel.token_jti == payload["jti"]
            ).first()
            if stored and not stored.is_revoked:
                stored.is_revoked = True
                db.commit()
    
    response.delete_cookie(key="access_token")
    response.delete_cookie(key="refresh_token")
    return MessageResponse(message="Logged out successfully")


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    current_user: dict = Depends(require_auth),
    db: Session = Depends(get_db)
) -> UserResponse:
    """
    Get current authenticated user information.
    """
    from ..services.user_service import UserService
    
    uid = get_user_id(current_user)
    user = UserService.get_user_by_id(db, uid)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse.model_validate(user)


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    request: Request,
    forgot_data: ForgotPasswordRequest,
    db: Session = Depends(get_db)
) -> MessageResponse:
    """
    Request password reset email.
    
    - **email**: Email address associated with account
    """
    auth_rate_limiter.check(get_client_ip(request))
    AuthService.forgot_password(db, forgot_data.email)
    return MessageResponse(
        message="If the email exists, a password reset link has been sent"
    )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    request: Request,
    reset_data: ResetPasswordRequest,
    db: Session = Depends(get_db)
) -> MessageResponse:
    """
    Reset password using token from email.

    - **token**: Password reset token from email
    - **new_password**: New strong password
    """
    auth_rate_limiter.check(get_client_ip(request))
    AuthService.reset_password(db, reset_data.token, reset_data.new_password)
    return MessageResponse(message="Password reset successfully")


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    change_data: ChangePasswordRequest,
    current_user: dict = Depends(require_auth),
    db: Session = Depends(get_db)
) -> MessageResponse:
    """
    Change password for authenticated user.
    
    - **current_password**: Current password
    - **new_password**: New strong password
    """
    uid = get_user_id(current_user)
    AuthService.change_password(
        db,
        uid,
        change_data.current_password,
        change_data.new_password
    )
    return MessageResponse(message="Password changed successfully")
