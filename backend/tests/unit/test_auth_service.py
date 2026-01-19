import pytest
from src.services.auth_service import AuthService
from src.models.user import User
from src.schemas.auth import LoginRequest, RegisterRequest
from src.utils.security import hash_password
from fastapi import HTTPException


def test_register_new_user(db_session, test_user_data):
    """Test user registration."""
    register_data = RegisterRequest(**test_user_data)
    user = AuthService.register(db_session, register_data)
    
    assert user.id is not None
    assert user.username == test_user_data["username"]
    assert user.email == test_user_data["email"]
    assert user.full_name == test_user_data["full_name"]
    assert user.role.value == "user"
    assert user.is_active is True


def test_register_duplicate_username(db_session, test_user_data):
    """Test registration with duplicate username fails."""
    register_data = RegisterRequest(**test_user_data)
    AuthService.register(db_session, register_data)
    
    with pytest.raises(HTTPException) as exc_info:
        AuthService.register(db_session, register_data)
    
    assert exc_info.value.status_code == 400
    assert "already registered" in exc_info.value.detail.lower()


def test_authenticate_user_success(db_session, test_user_data):
    """Test successful user authentication."""
    # Create user
    user = User(
        username=test_user_data["username"],
        email=test_user_data["email"],
        hashed_password=hash_password(test_user_data["password"]),
        full_name=test_user_data["full_name"]
    )
    db_session.add(user)
    db_session.commit()
    
    # Authenticate
    authenticated_user = AuthService.authenticate_user(
        db_session,
        test_user_data["username"],
        test_user_data["password"]
    )
    
    assert authenticated_user is not None
    assert authenticated_user.username == test_user_data["username"]


def test_authenticate_user_wrong_password(db_session, test_user_data):
    """Test authentication with wrong password fails."""
    # Create user
    user = User(
        username=test_user_data["username"],
        email=test_user_data["email"],
        hashed_password=hash_password(test_user_data["password"]),
        full_name=test_user_data["full_name"]
    )
    db_session.add(user)
    db_session.commit()
    
    # Try to authenticate with wrong password
    authenticated_user = AuthService.authenticate_user(
        db_session,
        test_user_data["username"],
        "WrongPassword123"
    )
    
    assert authenticated_user is None


def test_login_success(db_session, test_user_data):
    """Test successful login returns user and tokens."""
    # Register user first
    register_data = RegisterRequest(**test_user_data)
    AuthService.register(db_session, register_data)
    
    # Login
    login_data = LoginRequest(
        username=test_user_data["username"],
        password=test_user_data["password"]
    )
    user, access_token, refresh_token = AuthService.login(db_session, login_data)
    
    assert user.username == test_user_data["username"]
    assert access_token is not None
    assert refresh_token is not None
    assert len(access_token) > 0
    assert len(refresh_token) > 0


def test_login_invalid_credentials(db_session, test_user_data):
    """Test login with invalid credentials fails."""
    login_data = LoginRequest(
        username="nonexistent",
        password="WrongPass123"
    )
    
    with pytest.raises(HTTPException) as exc_info:
        AuthService.login(db_session, login_data)
    
    assert exc_info.value.status_code == 401
