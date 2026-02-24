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
from ..middleware.auth_middleware import require_auth

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
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
    user = AuthService.register(db, register_data)
    return UserResponse.model_validate(user)


@router.post("/login", response_model=LoginResponse)
async def login(
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
    user, access_token, refresh_token = AuthService.login(db, login_data)
    
    # Set httpOnly cookies
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="lax",
        max_age=3600,  # 1 hour
    )
    
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
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
    
    Returns new access token and sets it as httpOnly cookie.
    """
    refresh_token = request.cookies.get("refresh_token")
    
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found"
        )
    
    # Verify and decode refresh token
    from ..utils.security import verify_token, create_access_token
    payload = verify_token(refresh_token)
    
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    # Create new access token with same user data
    token_data = {
        "sub": payload["sub"],
        "username": payload["username"],
        "role": payload["role"],
    }
    new_access_token = create_access_token(token_data)
    
    # Set new access token cookie
    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="lax",
        max_age=3600,  # 1 hour
    )
    
    return MessageResponse(message="Token refreshed successfully")


@router.post("/logout", response_model=MessageResponse)
async def logout(response: Response) -> MessageResponse:
    """
    Logout current user by clearing authentication cookies.
    """
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
    
    user = UserService.get_user_by_id(db, int(current_user["sub"]))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse.model_validate(user)


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    forgot_data: ForgotPasswordRequest,
    db: Session = Depends(get_db)
) -> MessageResponse:
    """
    Request password reset email.
    
    - **email**: Email address associated with account
    """
    AuthService.forgot_password(db, forgot_data.email)
    return MessageResponse(
        message="If the email exists, a password reset link has been sent"
    )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    reset_data: ResetPasswordRequest,
    db: Session = Depends(get_db)
) -> MessageResponse:
    """
    Reset password using token from email.
    
    - **token**: Password reset token from email
    - **new_password**: New strong password
    """
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
    AuthService.change_password(
        db,
        int(current_user["sub"]),
        change_data.current_password,
        change_data.new_password
    )
    return MessageResponse(message="Password changed successfully")
