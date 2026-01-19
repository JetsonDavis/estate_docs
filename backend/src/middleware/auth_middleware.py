from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from ..utils.security import verify_token


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


async def require_auth(request: Request) -> dict:
    """
    Dependency that requires authentication via cookie.
    
    Args:
        request: FastAPI request object
        
    Returns:
        Decoded token payload with user information
        
    Raises:
        HTTPException: If not authenticated
    """
    user = await get_current_user_from_cookie(request)
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    
    return user


async def require_admin(request: Request) -> dict:
    """
    Dependency that requires admin role.
    
    Args:
        request: FastAPI request object
        
    Returns:
        Decoded token payload with user information
        
    Raises:
        HTTPException: If not authenticated or not admin
    """
    user = await require_auth(request)
    
    if user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    
    return user
