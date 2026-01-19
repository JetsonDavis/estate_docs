from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
from ..models.user import User, PasswordResetToken
from ..schemas.auth import LoginRequest, RegisterRequest
from ..utils.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    generate_password_reset_token,
)
from ..utils.email import send_password_reset_email
from fastapi import HTTPException, status


class AuthService:
    """Service for authentication operations."""
    
    @staticmethod
    def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
        """
        Authenticate a user with username and password.
        
        Args:
            db: Database session
            username: Username
            password: Plain text password
            
        Returns:
            User object if authentication successful, None otherwise
        """
        user = db.query(User).filter(
            User.username == username,
            User.is_active == True
        ).first()
        
        if not user:
            return None
        
        if not verify_password(password, user.hashed_password):
            return None
        
        # Update last login
        user.last_login = datetime.utcnow()
        db.commit()
        
        return user
    
    @staticmethod
    def login(db: Session, login_data: LoginRequest) -> tuple[User, str, str]:
        """
        Login a user and generate tokens.
        
        Args:
            db: Database session
            login_data: Login credentials
            
        Returns:
            Tuple of (user, access_token, refresh_token)
            
        Raises:
            HTTPException: If authentication fails
        """
        user = AuthService.authenticate_user(
            db, login_data.username, login_data.password
        )
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
            )
        
        # Generate tokens
        token_data = {
            "sub": str(user.id),
            "username": user.username,
            "role": user.role.value,
        }
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)
        
        return user, access_token, refresh_token
    
    @staticmethod
    def register(db: Session, register_data: RegisterRequest) -> User:
        """
        Register a new user.
        
        Args:
            db: Database session
            register_data: Registration data
            
        Returns:
            Created user object
            
        Raises:
            HTTPException: If username or email already exists
        """
        # Check if username exists
        existing_user = db.query(User).filter(
            User.username == register_data.username
        ).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already registered",
            )
        
        # Check if email exists
        existing_email = db.query(User).filter(
            User.email == register_data.email
        ).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )
        
        # Create new user
        hashed_pw = hash_password(register_data.password)
        new_user = User(
            username=register_data.username,
            email=register_data.email,
            hashed_password=hashed_pw,
            full_name=register_data.full_name,
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        return new_user
    
    @staticmethod
    def forgot_password(db: Session, email: str) -> bool:
        """
        Initiate password reset process.
        
        Args:
            db: Database session
            email: User email
            
        Returns:
            True if email sent successfully
        """
        user = db.query(User).filter(
            User.email == email,
            User.is_active == True
        ).first()
        
        if not user:
            # Don't reveal if email exists
            return True
        
        # Generate reset token
        token = generate_password_reset_token()
        expires_at = datetime.utcnow() + timedelta(hours=24)
        
        # Save token to database
        reset_token = PasswordResetToken(
            user_id=user.id,
            token=token,
            expires_at=expires_at,
        )
        db.add(reset_token)
        db.commit()
        
        # Send email
        send_password_reset_email(user.email, token)
        
        return True
    
    @staticmethod
    def reset_password(db: Session, token: str, new_password: str) -> bool:
        """
        Reset password using token.
        
        Args:
            db: Database session
            token: Password reset token
            new_password: New password
            
        Returns:
            True if password reset successful
            
        Raises:
            HTTPException: If token is invalid or expired
        """
        reset_token = db.query(PasswordResetToken).filter(
            PasswordResetToken.token == token
        ).first()
        
        if not reset_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid reset token",
            )
        
        if not reset_token.is_valid():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Reset token has expired or been used",
            )
        
        # Get user
        user = db.query(User).filter(User.id == reset_token.user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        
        # Update password
        user.hashed_password = hash_password(new_password)
        reset_token.is_used = True
        
        db.commit()
        
        return True
    
    @staticmethod
    def change_password(
        db: Session, user_id: int, current_password: str, new_password: str
    ) -> bool:
        """
        Change user password.
        
        Args:
            db: Database session
            user_id: User ID
            current_password: Current password
            new_password: New password
            
        Returns:
            True if password changed successfully
            
        Raises:
            HTTPException: If current password is incorrect
        """
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        
        if not verify_password(current_password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect",
            )
        
        user.hashed_password = hash_password(new_password)
        db.commit()
        
        return True
