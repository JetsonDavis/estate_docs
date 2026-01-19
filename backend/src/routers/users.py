from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..schemas.user import UserCreate, UserUpdate, UserResponse, UserListResponse
from ..services.user_service import UserService
from ..middleware.auth_middleware import require_admin

router = APIRouter(prefix="/users", tags=["User Management"])


@router.get("", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    include_inactive: bool = Query(False, description="Include inactive users"),
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
) -> UserListResponse:
    """
    List all users with pagination (admin only).
    
    - **page**: Page number (starts at 1)
    - **page_size**: Number of items per page (max 100)
    - **include_inactive**: Include inactive users in results
    """
    skip = (page - 1) * page_size
    users, total = UserService.list_users(db, skip, page_size, include_inactive)
    
    return UserListResponse(
        users=[UserResponse.model_validate(user) for user in users],
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
) -> UserResponse:
    """
    Get user by ID (admin only).
    
    - **user_id**: User ID
    """
    user = UserService.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse.model_validate(user)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
) -> UserResponse:
    """
    Create a new user (admin only).
    
    - **username**: Unique username
    - **email**: Unique email address
    - **password**: Strong password
    - **full_name**: Optional full name
    - **role**: User role (admin or user)
    """
    user = UserService.create_user(db, user_data)
    return UserResponse.model_validate(user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
) -> UserResponse:
    """
    Update user information (admin only).
    
    - **user_id**: User ID
    - **email**: New email address (optional)
    - **full_name**: New full name (optional)
    - **role**: New role (optional)
    - **is_active**: Active status (optional)
    """
    user = UserService.update_user(db, user_id, user_data)
    return UserResponse.model_validate(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
) -> None:
    """
    Soft delete a user (admin only).
    
    - **user_id**: User ID
    """
    UserService.delete_user(db, user_id)
