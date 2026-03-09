"""Simple in-memory rate limiter for auth endpoints."""

import time
from collections import defaultdict
from fastapi import Request, HTTPException, status


class RateLimiter:
    """
    Token-bucket rate limiter keyed by client IP.
    
    Args:
        max_requests: Maximum requests allowed in the window
        window_seconds: Time window in seconds
    """
    
    def __init__(self, max_requests: int = 10, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = defaultdict(list)
    
    def _cleanup(self, key: str) -> None:
        """Remove expired timestamps."""
        cutoff = time.time() - self.window_seconds
        self._requests[key] = [
            ts for ts in self._requests[key] if ts > cutoff
        ]
    
    def reset(self) -> None:
        """Clear all tracked requests (useful for testing)."""
        self._requests.clear()
    
    def check(self, key: str) -> None:
        """
        Check rate limit for the given key.
        
        Raises:
            HTTPException: 429 if rate limit exceeded
        """
        self._cleanup(key)
        if len(self._requests[key]) >= self.max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later.",
            )
        self._requests[key].append(time.time())


# Shared limiter: 10 requests per minute for auth endpoints
auth_rate_limiter = RateLimiter(max_requests=10, window_seconds=60)


def get_client_ip(request: Request) -> str:
    """Extract client IP, respecting X-Forwarded-For behind proxies."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
