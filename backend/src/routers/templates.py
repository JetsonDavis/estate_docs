"""API endpoints for template management."""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional
from ..database import get_db
from ..middleware.auth_middleware import require_auth, require_admin
from ..schemas.template import (
    TemplateCreate,
    TemplateUpdate,
    TemplateResponse,
    TemplateListResponse,
    TemplateIdentifiersResponse,
    FileUploadResponse
)
from ..services.template_service import TemplateService


router = APIRouter(prefix="/templates", tags=["templates"])


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    template_name: Optional[str] = None,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
) -> FileUploadResponse:
    """
    Upload a file (Word, PDF, or image) and convert to Markdown.

    - **file**: File to upload (.docx, .pdf, .jpg, .png, .tiff)
    - **template_name**: Optional template name for markdown file naming
    """
    result = await TemplateService.process_uploaded_file(
        file,
        int(current_user["sub"]),
        db,
        template_name
    )

    return FileUploadResponse(
        filename=result["filename"],
        file_path=result["file_path"],
        markdown_content=result["markdown_content"],
        message="File uploaded and processed successfully"
    )


@router.post("/", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    template_data: TemplateCreate,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
) -> TemplateResponse:
    """
    Create a new document template.
    
    - **name**: Template name
    - **description**: Optional description
    - **template_type**: Type of template (word, pdf, image, direct)
    - **markdown_content**: Markdown content with identifiers (e.g., <<identifier>>)
    - **original_filename**: Optional original filename
    - **original_file_path**: Optional path to original file
    """
    template = TemplateService.create_template(
        db,
        template_data,
        int(current_user["sub"])
    )
    
    return TemplateResponse.model_validate(template)


@router.get("/", response_model=TemplateListResponse)
async def list_templates(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    current_user: dict = Depends(require_auth),
    db: Session = Depends(get_db)
) -> TemplateListResponse:
    """
    List all templates with pagination and optional search.
    
    - **skip**: Number of records to skip (default: 0)
    - **limit**: Maximum number of records to return (default: 100)
    - **search**: Optional search term for template name
    """
    templates, total = TemplateService.list_templates(db, skip, limit, search)
    
    page_size = limit
    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0
    current_page = (skip // page_size) + 1 if page_size > 0 else 1
    
    return TemplateListResponse(
        templates=[TemplateResponse.model_validate(t) for t in templates],
        total=total,
        page=current_page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: int,
    current_user: dict = Depends(require_auth),
    db: Session = Depends(get_db)
) -> TemplateResponse:
    """
    Get a specific template by ID.
    
    - **template_id**: Template ID
    """
    template = TemplateService.get_template(db, template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    
    return TemplateResponse.model_validate(template)


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: int,
    template_data: TemplateUpdate,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
) -> TemplateResponse:
    """
    Update a template.
    
    - **template_id**: Template ID
    - **name**: Optional new name
    - **description**: Optional new description
    - **markdown_content**: Optional new markdown content
    """
    template = TemplateService.update_template(db, template_id, template_data)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    
    return TemplateResponse.model_validate(template)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: int,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Delete a template (soft delete).
    
    - **template_id**: Template ID
    """
    success = TemplateService.delete_template(db, template_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )


@router.get("/{template_id}/identifiers", response_model=TemplateIdentifiersResponse)
async def get_template_identifiers(
    template_id: int,
    current_user: dict = Depends(require_auth),
    db: Session = Depends(get_db)
) -> TemplateIdentifiersResponse:
    """
    Get all identifiers from a template.
    
    - **template_id**: Template ID
    """
    identifiers = TemplateService.get_template_identifiers(db, template_id)
    if identifiers is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    
    return TemplateIdentifiersResponse(
        template_id=template_id,
        identifiers=identifiers
    )
