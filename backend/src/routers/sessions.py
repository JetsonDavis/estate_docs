"""API endpoints for questionnaire session management."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..middleware.auth_middleware import require_auth
from ..schemas.session import (
    DocumentSessionCreate,
    DocumentSessionResponse,
    DocumentSessionWithAnswers,
    SubmitAnswersRequest,
    SessionProgressResponse,
    SessionAnswerResponse
)
from ..services.session_service import SessionService
from ..services.question_service import QuestionService


router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("/", response_model=DocumentSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    session_data: DocumentSessionCreate,
    current_user: dict = Depends(require_auth),
    db: Session = Depends(get_db)
) -> DocumentSessionResponse:
    """
    Create a new questionnaire session.
    
    - **client_identifier**: Identifier for the client (e.g., name, case number)
    - **starting_group_id**: Optional starting question group ID (defaults to first group)
    """
    session = SessionService.create_session(
        db,
        session_data,
        int(current_user["sub"])
    )
    
    return DocumentSessionResponse.model_validate(session)


@router.get("/", response_model=List[DocumentSessionResponse])
async def list_sessions(
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(require_auth),
    db: Session = Depends(get_db)
) -> List[DocumentSessionResponse]:
    """
    List all questionnaire sessions for the current user.
    
    - **skip**: Number of records to skip (default: 0)
    - **limit**: Maximum number of records to return (default: 100)
    """
    sessions, _ = SessionService.list_sessions(
        db,
        int(current_user["sub"]),
        skip,
        limit
    )
    
    return [DocumentSessionResponse.model_validate(s) for s in sessions]


@router.get("/{session_id}", response_model=DocumentSessionWithAnswers)
async def get_session(
    session_id: int,
    current_user: dict = Depends(require_auth),
    db: Session = Depends(get_db)
) -> DocumentSessionWithAnswers:
    """
    Get a specific questionnaire session with all answers.
    
    - **session_id**: Session ID
    """
    session = SessionService.get_session(db, session_id, int(current_user["sub"]))
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    answers = SessionService.get_session_answers(db, session_id, int(current_user["sub"]))
    
    return DocumentSessionWithAnswers(
        **session.to_dict(),
        answers=[SessionAnswerResponse.model_validate(a) for a in answers]
    )


@router.get("/{session_id}/progress", response_model=SessionProgressResponse)
async def get_session_progress(
    session_id: int,
    current_user: dict = Depends(require_auth),
    db: Session = Depends(get_db)
) -> SessionProgressResponse:
    """
    Get current progress of a questionnaire session.
    
    - **session_id**: Session ID
    
    Returns the current question group, next group ID, and completion status.
    """
    session = SessionService.get_session(db, session_id, int(current_user["sub"]))
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    answers = SessionService.get_session_answers(db, session_id, int(current_user["sub"]))
    
    # Get current group details
    current_group = None
    if session.current_group_id and not session.is_completed:
        group = QuestionService.get_question_group(db, session.current_group_id)
        if group:
            current_group = {
                "id": group.id,
                "name": group.name,
                "description": group.description,
                "questions": [q.to_dict() for q in group.questions]
            }
    
    return SessionProgressResponse(
        session=DocumentSessionResponse.model_validate(session),
        current_group=current_group,
        next_group_id=session.current_group.next_group_id if session.current_group else None,
        is_completed=session.is_completed,
        total_answers=len(answers)
    )


@router.post("/{session_id}/submit", response_model=DocumentSessionResponse)
async def submit_answers(
    session_id: int,
    answers_data: SubmitAnswersRequest,
    current_user: dict = Depends(require_auth),
    db: Session = Depends(get_db)
) -> DocumentSessionResponse:
    """
    Submit answers for the current question group and navigate to next group.
    
    - **session_id**: Session ID
    - **answers**: List of answers to submit
    
    The system will automatically navigate to the next group based on conditional flow logic.
    """
    session = SessionService.submit_answers(
        db,
        session_id,
        int(current_user["sub"]),
        answers_data.answers
    )
    
    return DocumentSessionResponse.model_validate(session)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: int,
    current_user: dict = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    Delete a questionnaire session.
    
    - **session_id**: Session ID
    """
    success = SessionService.delete_session(db, session_id, int(current_user["sub"]))
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
