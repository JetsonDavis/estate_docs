from fastapi import Request, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from ..utils.security import verify_token
from ..database import get_db
from sqlalchemy.orm import Session


security = HTTPBearer()


async def get_current_user_from_token(
    credentials: HTTPAuthorizationCredentials
) -> dict:
    """
    Extract and validate user from JWT token.
    
    Args:
        credentials: HTTP authorization credentials containing JWT token
        
    Returns:
        Decoded token payload with user information
        
    Raises:
        HTTPException: If token is invalid or expired
    """
    token = credentials.credentials
    payload = verify_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return payload


async def get_current_user_from_cookie(request: Request) -> Optional[dict]:
    """
    Extract and validate user from cookie-based JWT token.
    
    Args:
        request: FastAPI request object
        
    Returns:
        Decoded token payload with user information, or None if no token
        
    Raises:
        HTTPException: If token is invalid or expired
    """
    token = request.cookies.get("access_token")
    
    if not token:
        return None
    
    payload = verify_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    
    return payload


async def require_auth(request: Request, db: Session = Depends(get_db)) -> dict:
    """
    Dependency that requires authentication via cookie.
    
    Re-checks the database to ensure the user is still active,
    so deactivated users are rejected immediately.
    
    Args:
        request: FastAPI request object
        db: Database session
        
    Returns:
        Decoded token payload with user information
        
    Raises:
        HTTPException: If not authenticated or user deactivated
    """
    user = await get_current_user_from_cookie(request)
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    
    # Re-check that user is still active in the database
    from ..models.user import User
    db_user = db.query(User).filter(User.id == int(user["sub"])).first()
    if not db_user or not db_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account has been deactivated",
        )
    
    return user


def get_user_id(current_user: dict) -> int:
    """Extract and validate the user ID from the JWT payload.

    Raises HTTP 401 if the 'sub' claim is missing or not a valid integer.
    """
    try:
        return int(current_user["sub"])
    except (ValueError, TypeError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )


async def require_admin(request: Request, db: Session = Depends(get_db)) -> dict:
    """
    Dependency that requires admin role.
    
    Args:
        request: FastAPI request object
        db: Database session
        
    Returns:
        Decoded token payload with user information
        
    Raises:
        HTTPException: If not authenticated or not admin
    """
    user = await require_auth(request, db)
    
    if user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    
    return user
