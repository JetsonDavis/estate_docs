from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import QuestionGroup
from ..schemas.question import (
    QuestionGroupCreate,
    QuestionGroupUpdate,
    QuestionGroupResponse,
    QuestionGroupDetailResponse,
    QuestionGroupListResponse,
    QuestionCreate,
    QuestionUpdate,
    QuestionResponse,
)
from ..services.question_service import QuestionGroupService, QuestionService
from ..middleware.auth_middleware import require_admin

router = APIRouter(prefix="/question-groups", tags=["Question Groups"])


@router.get("", response_model=QuestionGroupListResponse)
async def list_question_groups(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    include_inactive: bool = Query(False, description="Include inactive groups"),
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
) -> QuestionGroupListResponse:
    """
    List all question groups with pagination (admin only).
    """
    skip = (page - 1) * page_size
    groups, total = QuestionGroupService.list_question_groups(
        db, skip, page_size, include_inactive
    )
    
    # Get questions for each group to include identifiers and types
    group_responses = []
    for g in groups:
        questions = QuestionService.list_questions_by_group(db, g.id, include_inactive=False)
        group_response = QuestionGroupResponse(
            id=g.id,
            name=g.name,
            description=g.description,
            identifier=g.identifier,
            display_order=g.display_order,
            created_at=g.created_at,
            updated_at=g.updated_at,
            is_active=g.is_active,
            question_count=len(questions),
            questions=[
                {
                    "id": q.id,
                    "identifier": q.identifier,
                    "question_text": q.question_text,
                    "question_type": q.question_type
                } for q in questions
            ]
        )
        group_responses.append(group_response)
    
    return QuestionGroupListResponse(
        question_groups=group_responses,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/{group_id}", response_model=QuestionGroupDetailResponse)
async def get_question_group(
    group_id: int,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
) -> QuestionGroupDetailResponse:
    """
    Get question group by ID with all questions (admin only).
    """
    group = QuestionGroupService.get_question_group_by_id(db, group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question group not found"
        )
    
    # Get questions for this group
    questions = QuestionService.list_questions_by_group(db, group_id, include_inactive=True)
    
    return QuestionGroupDetailResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        identifier=group.identifier,
        display_order=group.display_order,
        question_logic=group.question_logic,
        created_at=group.created_at,
        updated_at=group.updated_at,
        is_active=group.is_active,
        question_count=len(questions),
        questions=[QuestionResponse.model_validate(q) for q in questions]
    )


@router.post("", response_model=QuestionGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_question_group(
    group_data: QuestionGroupCreate,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
) -> QuestionGroupResponse:
    """
    Create a new question group (admin only).
    """
    group = QuestionGroupService.create_question_group(db, group_data)
    return QuestionGroupResponse.model_validate(group)


@router.put("/{group_id}", response_model=QuestionGroupResponse)
async def update_question_group(
    group_id: int,
    group_data: QuestionGroupUpdate,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
) -> QuestionGroupResponse:
    """
    Update question group (admin only).
    """
    group = QuestionGroupService.update_question_group(db, group_id, group_data)
    questions = QuestionService.list_questions_by_group(db, group_id, include_inactive=False)
    return QuestionGroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        identifier=group.identifier,
        display_order=group.display_order,
        question_logic=group.question_logic,
        created_at=group.created_at,
        updated_at=group.updated_at,
        is_active=group.is_active,
        question_count=len(questions),
        questions=[
            {
                "id": q.id,
                "identifier": q.identifier,
                "question_text": q.question_text,
                "question_type": q.question_type
            } for q in questions
        ]
    )


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question_group(
    group_id: int,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
) -> None:
    """
    Soft delete a question group (admin only).
    """
    QuestionGroupService.delete_question_group(db, group_id)


# Question endpoints within a group
@router.post("/{group_id}/questions", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED)
async def create_question(
    group_id: int,
    question_data: QuestionCreate,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
) -> QuestionResponse:
    """
    Create a new question in a group (admin only).
    """
    # Ensure question_group_id matches the path parameter
    question_data.question_group_id = group_id
    question = QuestionService.create_question(db, question_data)
    return QuestionResponse.model_validate(question)


@router.get("/{group_id}/questions", response_model=List[QuestionResponse])
async def list_questions(
    group_id: int,
    include_inactive: bool = Query(False, description="Include inactive questions"),
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
) -> List[QuestionResponse]:
    """
    List all questions in a group (admin only).
    """
    questions = QuestionService.list_questions_by_group(db, group_id, include_inactive)
    return [QuestionResponse.model_validate(q) for q in questions]


@router.put("/questions/{question_id}", response_model=QuestionResponse)
async def update_question(
    question_id: int,
    question_data: QuestionUpdate,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
) -> QuestionResponse:
    """
    Update a question (admin only).
    """
    question = QuestionService.update_question(db, question_id, question_data)
    return QuestionResponse.model_validate(question)


@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    question_id: int,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
) -> None:
    """
    Soft delete a question (admin only).
    """
    QuestionService.delete_question(db, question_id)


@router.get("/questions/check-identifier")
async def check_question_identifier(
    identifier: str = Query(..., description="Identifier to check"),
    group_id: int = Query(..., description="Question group ID for namespace"),
    exclude_id: int = Query(None, description="Question ID to exclude from check"),
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
) -> dict:
    """
    Check if a question identifier already exists within a group (admin only).
    The identifier is namespaced with the group identifier before checking.
    Returns { exists: bool, question_id: int | null }
    """
    # Get the group to build the namespaced identifier
    group = db.query(QuestionGroup).filter(QuestionGroup.id == group_id).first()
    if not group:
        return {"exists": False, "question_id": None}
    
    # Build the namespaced identifier
    namespaced_identifier = f"{group.identifier}.{identifier}"
    
    question = QuestionService.get_question_by_identifier(db, namespaced_identifier)
    if question and (exclude_id is None or question.id != exclude_id):
        return {"exists": True, "question_id": question.id}
    return {"exists": False, "question_id": None}
