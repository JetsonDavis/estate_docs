"""API endpoints for document flow management."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional

from ..database import get_db
from ..middleware.auth_middleware import require_auth, require_admin
from ..schemas.flow import (
    DocumentFlowCreate,
    DocumentFlowUpdate,
    DocumentFlowResponse,
    DocumentFlowWithGroups,
    DocumentFlowListResponse
)
from ..services.flow_service import FlowService


router = APIRouter(prefix="/flows", tags=["flows"])


@router.post("/", response_model=DocumentFlowResponse, status_code=status.HTTP_201_CREATED)
async def create_flow(
    flow_data: DocumentFlowCreate,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
) -> DocumentFlowResponse:
    """
    Create a new document flow (Admin only).
    
    - **name**: Unique flow name
    - **description**: Optional flow description
    - **starting_group_id**: Optional starting question group ID
    - **question_group_ids**: Optional list of question group IDs to associate
    """
    flow = FlowService.create_flow(
        db,
        flow_data,
        int(current_user["sub"])
    )
    
    return DocumentFlowResponse.model_validate(flow)


@router.get("/", response_model=DocumentFlowListResponse)
async def list_flows(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    current_user: dict = Depends(require_auth),
    db: Session = Depends(get_db)
) -> DocumentFlowListResponse:
    """
    List all document flows.
    
    - **skip**: Number of records to skip (default: 0)
    - **limit**: Maximum number of records to return (default: 100)
    - **search**: Optional search term for flow name
    """
    flows, total = FlowService.list_flows(db, skip, limit, search)
    
    page_size = limit
    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0
    current_page = (skip // page_size) + 1 if page_size > 0 else 1
    
    return DocumentFlowListResponse(
        flows=[DocumentFlowResponse.model_validate(f) for f in flows],
        total=total,
        page=current_page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/{flow_id}", response_model=DocumentFlowWithGroups)
async def get_flow(
    flow_id: int,
    current_user: dict = Depends(require_auth),
    db: Session = Depends(get_db)
) -> DocumentFlowWithGroups:
    """
    Get a specific document flow with associated question groups.
    
    - **flow_id**: Flow ID
    """
    flow_data = FlowService.get_flow_with_groups(db, flow_id)
    if not flow_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flow not found"
        )
    
    return DocumentFlowWithGroups(**flow_data)


@router.put("/{flow_id}", response_model=DocumentFlowResponse)
async def update_flow(
    flow_id: int,
    flow_data: DocumentFlowUpdate,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
) -> DocumentFlowResponse:
    """
    Update a document flow (Admin only).
    
    - **flow_id**: Flow ID
    """
    flow = FlowService.update_flow(db, flow_id, flow_data)
    if not flow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flow not found"
        )
    
    return DocumentFlowResponse.model_validate(flow)


@router.delete("/{flow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_flow(
    flow_id: int,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Delete a document flow (Admin only).
    
    - **flow_id**: Flow ID
    """
    success = FlowService.delete_flow(db, flow_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flow not found"
        )
