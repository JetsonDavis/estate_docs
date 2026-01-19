import pytest
from fastapi import status


def test_register_endpoint(client, test_user_data):
    """Test user registration endpoint."""
    response = client.post("/api/v1/auth/register", json=test_user_data)
    
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["username"] == test_user_data["username"]
    assert data["email"] == test_user_data["email"]
    assert "password" not in data


def test_login_endpoint(client, test_user_data):
    """Test login endpoint."""
    # Register first
    client.post("/api/v1/auth/register", json=test_user_data)
    
    # Login
    login_data = {
        "username": test_user_data["username"],
        "password": test_user_data["password"]
    }
    response = client.post("/api/v1/auth/login", json=login_data)
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "user" in data
    assert data["user"]["username"] == test_user_data["username"]
    
    # Check cookies
    assert "access_token" in response.cookies
    assert "refresh_token" in response.cookies


def test_logout_endpoint(client):
    """Test logout endpoint."""
    response = client.post("/api/v1/auth/logout")
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "message" in data


def test_get_current_user_authenticated(client, test_user_data):
    """Test getting current user when authenticated."""
    # Register and login
    client.post("/api/v1/auth/register", json=test_user_data)
    login_response = client.post("/api/v1/auth/login", json={
        "username": test_user_data["username"],
        "password": test_user_data["password"]
    })
    
    # Get current user
    cookies = login_response.cookies
    response = client.get("/api/v1/auth/me", cookies=cookies)
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["username"] == test_user_data["username"]


def test_get_current_user_unauthenticated(client):
    """Test getting current user when not authenticated."""
    response = client.get("/api/v1/auth/me")
    
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_forgot_password_endpoint(client, test_user_data):
    """Test forgot password endpoint."""
    # Register first
    client.post("/api/v1/auth/register", json=test_user_data)
    
    # Request password reset
    response = client.post("/api/v1/auth/forgot-password", json={
        "email": test_user_data["email"]
    })
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "message" in data


def test_register_duplicate_username(client, test_user_data):
    """Test registering with duplicate username fails."""
    # Register first time
    client.post("/api/v1/auth/register", json=test_user_data)
    
    # Try to register again
    response = client.post("/api/v1/auth/register", json=test_user_data)
    
    assert response.status_code == status.HTTP_400_BAD_REQUEST


def test_login_invalid_credentials(client):
    """Test login with invalid credentials fails."""
    response = client.post("/api/v1/auth/login", json={
        "username": "nonexistent",
        "password": "WrongPass123"
    })
    
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
