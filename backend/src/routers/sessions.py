"""API endpoints for document session management."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..middleware.auth_middleware import require_auth
from ..schemas.session import (
    InputFormCreate,
    InputFormResponse,
    InputFormWithAnswers,
    SubmitAnswersRequest,
    SessionProgressResponse,
    SessionAnswerResponse,
    SessionQuestionsResponse,
    SaveAnswersRequest,
    NavigateRequest
)
from ..services.session_service import SessionService
from ..services.question_service import QuestionGroupService


router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("/", response_model=InputFormResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    session_data: InputFormCreate,
    current_user: dict = Depends(require_auth),
    db: Session = Depends(get_db)
) -> InputFormResponse:
    """
    Create a new document session.
    
    - **client_identifier**: Identifier for the client (e.g., name, case number)
    - **starting_group_id**: Optional starting question group ID (defaults to first group)
    """
    session = SessionService.create_session(
        db,
        session_data,
        int(current_user["sub"])
    )
    
    return InputFormResponse.model_validate(session)


@router.get("/", response_model=List[InputFormResponse])
async def list_sessions(
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(require_auth),
    db: Session = Depends(get_db)
) -> List[InputFormResponse]:
    """
    List all document sessions for the current user.
    
    - **skip**: Number of records to skip (default: 0)
    - **limit**: Maximum number of records to return (default: 100)
    """
    sessions, _ = SessionService.list_sessions(
        db,
        int(current_user["sub"]),
        skip,
        limit
    )
    
    # Build response with question group names
    result = []
    for s in sessions:
        response = InputFormResponse.model_validate(s)
        # Get the question group name if there's a current_group_id
        if s.current_group_id:
            group = QuestionGroupService.get_question_group_by_id(db, s.current_group_id)
            if group:
                response.current_group_name = group.name
        result.append(response)
    
    return result


@router.get("/{session_id}", response_model=InputFormWithAnswers)
async def get_session(
    session_id: int,
    current_user: dict = Depends(require_auth),
    db: Session = Depends(get_db)
) -> InputFormWithAnswers:
    """
    Get a specific document session with all answers.
    
    - **session_id**: Session ID
    """
    session = SessionService.get_session(db, session_id, int(current_user["sub"]))
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    answers = SessionService.get_session_answers(db, session_id, int(current_user["sub"]))
    
    return InputFormWithAnswers(
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
    Get current progress of a document session.
    
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
        group = QuestionGroupService.get_question_group_by_id(db, session.current_group_id)
        if group:
            current_group = {
                "id": group.id,
                "name": group.name,
                "description": group.description,
                "questions": [q.to_dict() for q in group.questions]
            }
    
    return SessionProgressResponse(
        session=InputFormResponse.model_validate(session),
        current_group=current_group,
        next_group_id=None,  # Next group is determined dynamically based on answers
        is_completed=session.is_completed,
        total_answers=len(answers)
    )


@router.post("/{session_id}/submit", response_model=InputFormResponse)
async def submit_answers(
    session_id: int,
    answers_data: SubmitAnswersRequest,
    current_user: dict = Depends(require_auth),
    db: Session = Depends(get_db)
) -> InputFormResponse:
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
    
    return InputFormResponse.model_validate(session)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: int,
    current_user: dict = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    Delete a document session.
    
    - **session_id**: Session ID
    """
    success = SessionService.delete_session(db, session_id, int(current_user["sub"]))
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )


@router.get("/{session_id}/questions", response_model=SessionQuestionsResponse)
async def get_session_questions(
    session_id: int,
    page: int = 1,
    questions_per_page: int = 5,
    current_user: dict = Depends(require_auth),
    db: Session = Depends(get_db)
) -> SessionQuestionsResponse:
    """
    Get questions to display for a session based on flow_logic and question_logic.
    
    - **session_id**: Session ID
    - **page**: Current page number (1-indexed, default: 1)
    - **questions_per_page**: Number of questions per page (default: 5)
    
    Returns paginated questions with navigation info.
    """
    return SessionService.get_session_questions(
        db,
        session_id,
        int(current_user["sub"]),
        page,
        questions_per_page
    )


@router.post("/{session_id}/save-answers", status_code=status.HTTP_204_NO_CONTENT)
async def save_answers(
    session_id: int,
    answers_data: SaveAnswersRequest,
    current_user: dict = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    Save answers without navigating to next group.
    
    - **session_id**: Session ID
    - **answers**: List of answers to save
    """
    SessionService.save_answers(
        db,
        session_id,
        int(current_user["sub"]),
        answers_data.answers
    )


@router.post("/{session_id}/navigate", response_model=InputFormResponse)
async def navigate_session(
    session_id: int,
    navigate_data: NavigateRequest,
    current_user: dict = Depends(require_auth),
    db: Session = Depends(get_db)
) -> InputFormResponse:
    """
    Navigate to next or previous group in the flow.
    
    - **session_id**: Session ID
    - **direction**: 'forward' or 'backward'
    - **answers**: Optional answers to save before navigating
    """
    session = SessionService.navigate_session(
        db,
        session_id,
        int(current_user["sub"]),
        navigate_data.direction,
        navigate_data.answers
    )
    
    return InputFormResponse.model_validate(session)


@router.get("/{session_id}/identifiers", response_model=List[str])
async def get_session_identifiers(
    session_id: int,
    current_user: dict = Depends(require_auth),
    db: Session = Depends(get_db)
) -> List[str]:
    """
    Get all question identifiers from a session that have been answered.
    
    - **session_id**: Session ID
    """
    identifiers = SessionService.get_session_identifiers(db, session_id, int(current_user["sub"]))
    if identifiers is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    return identifiers
