"""Service layer for document session operations."""

from sqlalchemy.orm import Session
from typing import Optional, List, Tuple, Dict, Any
from fastapi import HTTPException, status
from datetime import datetime
import math

from ..models.session import DocumentSession, SessionAnswer
from ..models.question import QuestionGroup, Question
from ..models.flow import DocumentFlow, flow_question_groups
from ..schemas.session import (
    DocumentSessionCreate,
    DocumentSessionUpdate,
    SessionAnswerCreate,
    QuestionToDisplay,
    SessionQuestionsResponse
)


class SessionService:
    """Service for document session operations."""
    
    @staticmethod
    def create_session(
        db: Session,
        session_data: DocumentSessionCreate,
        user_id: int
    ) -> DocumentSession:
        """
        Create a new document session.
        
        Args:
            db: Database session
            session_data: Session creation data
            user_id: User ID creating the session
            
        Returns:
            Created document session
        """
        from ..models.flow import DocumentFlow
        
        # Determine starting group
        starting_group_id = session_data.starting_group_id
        flow_id = session_data.flow_id
        
        # If flow is specified, use its starting group
        if flow_id:
            flow = db.query(DocumentFlow).filter(
                DocumentFlow.id == flow_id,
                DocumentFlow.is_active == True
            ).first()
            
            if not flow:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Flow not found"
                )
            
            if flow.starting_group_id:
                starting_group_id = flow.starting_group_id
        
        # If still no starting group, get first available group
        if not starting_group_id:
            first_group = db.query(QuestionGroup).filter(
                QuestionGroup.is_active == True
            ).order_by(QuestionGroup.display_order).first()
            
            if not first_group:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No question groups available"
                )
            starting_group_id = first_group.id
        
        session = DocumentSession(
            client_identifier=session_data.client_identifier,
            user_id=user_id,
            flow_id=flow_id,
            current_group_id=starting_group_id,
            is_completed=False
        )
        
        db.add(session)
        db.commit()
        db.refresh(session)
        
        return session
    
    @staticmethod
    def get_session(db: Session, session_id: int, user_id: int) -> Optional[DocumentSession]:
        """
        Get session by ID (user can only access their own sessions).
        
        Args:
            db: Database session
            session_id: Session ID
            user_id: User ID
            
        Returns:
            Session if found and belongs to user, None otherwise
        """
        return db.query(DocumentSession).filter(
            DocumentSession.id == session_id,
            DocumentSession.user_id == user_id
        ).first()
    
    @staticmethod
    def list_sessions(
        db: Session,
        user_id: int,
        skip: int = 0,
        limit: int = 100
    ) -> Tuple[List[DocumentSession], int]:
        """
        List sessions for a user.
        
        Args:
            db: Database session
            user_id: User ID
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            Tuple of (sessions list, total count)
        """
        query = db.query(DocumentSession).filter(
            DocumentSession.user_id == user_id
        )
        
        total = query.count()
        sessions = query.order_by(DocumentSession.created_at.desc()).offset(skip).limit(limit).all()
        
        return sessions, total
    
    @staticmethod
    def submit_answers(
        db: Session,
        session_id: int,
        user_id: int,
        answers: List[SessionAnswerCreate]
    ) -> DocumentSession:
        """
        Submit answers for current question group and navigate to next group.
        
        Args:
            db: Database session
            session_id: Session ID
            user_id: User ID
            answers: List of answers to submit
            
        Returns:
            Updated session
        """
        session = SessionService.get_session(db, session_id, user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        # Allow saving answers on completed sessions for editing
        
        # Get current group
        current_group = db.query(QuestionGroup).filter(
            QuestionGroup.id == session.current_group_id
        ).first()
        
        if not current_group:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current question group not found"
            )
        
        # Save answers
        for answer_data in answers:
            # Check if answer already exists for this question
            existing_answer = db.query(SessionAnswer).filter(
                SessionAnswer.session_id == session_id,
                SessionAnswer.question_id == answer_data.question_id
            ).first()
            
            if existing_answer:
                # Update existing answer
                existing_answer.answer_value = answer_data.answer_value
            else:
                # Create new answer
                answer = SessionAnswer(
                    session_id=session_id,
                    question_id=answer_data.question_id,
                    answer_value=answer_data.answer_value
                )
                db.add(answer)
        
        db.commit()
        
        # Determine next group based on conditional flow
        next_group_id = SessionService._get_next_group(db, session, current_group, answers)
        
        if next_group_id:
            session.current_group_id = next_group_id
        else:
            # No next group - mark as completed
            session.is_completed = True
            session.completed_at = datetime.utcnow()
        
        db.commit()
        db.refresh(session)
        
        return session
    
    @staticmethod
    def _get_next_group(
        db: Session,
        session: DocumentSession,
        current_group: QuestionGroup,
        answers: List[SessionAnswerCreate]
    ) -> Optional[int]:
        """
        Determine next group based on conditional flow logic.
        
        Args:
            db: Database session
            session: Current session
            current_group: Current question group
            answers: Submitted answers
            
        Returns:
            Next group ID or None if completed
        """
        # Build answer lookup by question identifier
        answer_by_question_id = {a.question_id: a.answer_value for a in answers}
        
        # Check if current group has question logic with conditionals
        if current_group.question_logic:
            for item in current_group.question_logic:
                if item.get('type') == 'conditional':
                    cond = item.get('conditional', {})
                    if_identifier = cond.get('ifIdentifier')
                    expected_value = cond.get('value')
                    operator = cond.get('operator', 'equals')  # Default to 'equals' for backwards compatibility
                    next_group_id = cond.get('nextGroupId')
                    
                    # Find question by identifier to get its ID
                    for q in current_group.questions:
                        if q.identifier == if_identifier:
                            actual_value = answer_by_question_id.get(q.id)
                            
                            # Skip if the field is empty
                            if actual_value is None or actual_value == '':
                                break
                            
                            # Evaluate based on operator
                            if operator == 'not_equals':
                                condition_met = actual_value != expected_value
                            else:  # 'equals' or default
                                condition_met = actual_value == expected_value
                            
                            if condition_met:
                                if next_group_id:
                                    return next_group_id
                                break
        
        # If no conditional flow matched, find next group by display_order
        next_group = db.query(QuestionGroup).filter(
            QuestionGroup.display_order > current_group.display_order
        ).order_by(QuestionGroup.display_order).first()
        
        return next_group.id if next_group else None
    
    @staticmethod
    def get_session_answers(
        db: Session,
        session_id: int,
        user_id: int
    ) -> List[SessionAnswer]:
        """
        Get all answers for a session.
        
        Args:
            db: Database session
            session_id: Session ID
            user_id: User ID
            
        Returns:
            List of session answers
        """
        session = SessionService.get_session(db, session_id, user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        return db.query(SessionAnswer).filter(
            SessionAnswer.session_id == session_id
        ).all()
    
    @staticmethod
    def delete_session(db: Session, session_id: int, user_id: int) -> bool:
        """
        Delete a session.
        
        Args:
            db: Database session
            session_id: Session ID
            user_id: User ID
            
        Returns:
            True if deleted, False if not found
        """
        session = SessionService.get_session(db, session_id, user_id)
        if not session:
            return False
        
        db.delete(session)
        db.commit()
        
        return True
    
    @staticmethod
    def get_session_questions(
        db: Session,
        session_id: int,
        user_id: int,
        page: int = 1,
        questions_per_page: int = 5
    ) -> SessionQuestionsResponse:
        """
        Get questions to display for a session based on flow_logic and question_logic.
        
        Args:
            db: Database session
            session_id: Session ID
            user_id: User ID
            page: Current page number (1-indexed)
            questions_per_page: Number of questions per page
            
        Returns:
            SessionQuestionsResponse with questions and navigation info
        """
        session = SessionService.get_session(db, session_id, user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        # Allow viewing/editing completed sessions - don't block access
        
        # Get flow and its groups
        flow = None
        flow_name = None
        ordered_groups = []
        
        if session.flow_id:
            flow = db.query(DocumentFlow).filter(
                DocumentFlow.id == session.flow_id
            ).first()
            if flow:
                flow_name = flow.name
                # Get groups from flow_logic
                if flow.flow_logic:
                    ordered_groups = SessionService._get_groups_from_flow_logic(
                        db, flow.flow_logic, session_id
                    )
        
        # If no flow or no groups from flow_logic, use current_group_id
        if not ordered_groups and session.current_group_id:
            group = db.query(QuestionGroup).filter(
                QuestionGroup.id == session.current_group_id
            ).first()
            if group:
                ordered_groups = [group]
        
        if not ordered_groups:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No question groups available"
            )
        
        # Find current group index
        current_group_index = 0
        current_group = None
        for i, group in enumerate(ordered_groups):
            if group.id == session.current_group_id:
                current_group_index = i
                current_group = group
                break
        
        if not current_group:
            current_group = ordered_groups[0]
            current_group_index = 0
            # Update session's current_group_id
            session.current_group_id = current_group.id
            db.commit()
        
        # Get existing answers for this session
        existing_answers_list = db.query(SessionAnswer).filter(
            SessionAnswer.session_id == session_id
        ).all()
        existing_answers = {a.question_id: a.answer_value for a in existing_answers_list}
        
        # Get questions to display based on question_logic
        questions_to_display = SessionService._get_questions_from_logic(
            db, current_group, existing_answers
        )
        
        # Paginate questions
        total_questions = len(questions_to_display)
        total_pages = max(1, math.ceil(total_questions / questions_per_page))
        page = max(1, min(page, total_pages))
        
        start_idx = (page - 1) * questions_per_page
        end_idx = start_idx + questions_per_page
        paginated_questions = questions_to_display[start_idx:end_idx]
        
        # Convert to response format
        question_responses = []
        for q in paginated_questions:
            question_responses.append(QuestionToDisplay(
                id=q.id,
                identifier=q.identifier,
                question_text=q.question_text,
                question_type=q.question_type,
                is_required=q.is_required,
                help_text=q.help_text,
                options=q.options,
                person_display_mode=q.person_display_mode,
                include_time=q.include_time,
                validation_rules=q.validation_rules,
                current_answer=existing_answers.get(q.id)
            ))
        
        is_last_group = current_group_index >= len(ordered_groups) - 1
        
        # Extract identifiers that have conditionals depending on them
        conditional_identifiers = []
        if current_group.question_logic:
            def extract_conditional_identifiers(items):
                identifiers = []
                for item in items:
                    if item.get('type') == 'conditional' and item.get('conditional'):
                        cond = item['conditional']
                        if_identifier = cond.get('ifIdentifier')
                        if if_identifier:
                            identifiers.append(if_identifier)
                        # Check nested items recursively
                        if cond.get('nestedItems'):
                            identifiers.extend(extract_conditional_identifiers(cond['nestedItems']))
                return identifiers
            conditional_identifiers = list(set(extract_conditional_identifiers(current_group.question_logic)))
        
        return SessionQuestionsResponse(
            session_id=session_id,
            client_identifier=session.client_identifier,
            flow_id=session.flow_id,
            flow_name=flow_name,
            current_group_id=current_group.id,
            current_group_name=current_group.name,
            current_group_index=current_group_index,
            total_groups=len(ordered_groups),
            questions=question_responses,
            current_page=page,
            total_pages=total_pages,
            questions_per_page=questions_per_page,
            is_completed=session.is_completed,
            is_last_group=is_last_group,
            can_go_back=current_group_index > 0 or page > 1,
            existing_answers=existing_answers,
            conditional_identifiers=conditional_identifiers
        )
    
    @staticmethod
    def _get_groups_from_flow_logic(
        db: Session,
        flow_logic: List[Dict],
        session_id: int
    ) -> List[QuestionGroup]:
        """
        Extract ordered list of question groups from flow_logic.
        Evaluates conditionals based on existing answers.
        """
        groups = []
        
        # Get existing answers for conditional evaluation
        existing_answers = db.query(SessionAnswer).filter(
            SessionAnswer.session_id == session_id
        ).all()
        answer_map = {}
        for answer in existing_answers:
            question = db.query(Question).filter(Question.id == answer.question_id).first()
            if question:
                answer_map[question.identifier] = answer.answer_value
        
        def process_steps(steps: List[Dict]):
            for step in steps:
                if step.get('type') == 'group' and step.get('groupId'):
                    group = db.query(QuestionGroup).filter(
                        QuestionGroup.id == step['groupId'],
                        QuestionGroup.is_active == True
                    ).first()
                    if group and group not in groups:
                        groups.append(group)
                
                elif step.get('type') == 'conditional' and step.get('conditional'):
                    cond = step['conditional']
                    identifier = cond.get('identifier')
                    expected_value = cond.get('value')
                    
                    # Check if condition is met
                    if identifier and identifier in answer_map:
                        if answer_map[identifier] == expected_value:
                            # Condition met - add target group
                            target_group_id = cond.get('targetGroupId')
                            if target_group_id:
                                target_group = db.query(QuestionGroup).filter(
                                    QuestionGroup.id == target_group_id,
                                    QuestionGroup.is_active == True
                                ).first()
                                if target_group and target_group not in groups:
                                    groups.append(target_group)
                            
                            # Process nested steps
                            if cond.get('nestedSteps'):
                                process_steps(cond['nestedSteps'])
        
        process_steps(flow_logic)
        return groups
    
    @staticmethod
    def _get_questions_from_logic(
        db: Session,
        group: QuestionGroup,
        existing_answers: Dict[int, str]
    ) -> List[Question]:
        """
        Get questions to display based on question_logic.
        Evaluates conditionals and respects stop flags.
        """
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"_get_questions_from_logic called for group {group.id} ({group.name})")
        logger.info(f"question_logic: {group.question_logic}")
        logger.info(f"existing_answers: {existing_answers}")
        
        if not group.question_logic:
            # No logic defined - return all questions in order
            logger.info("No question_logic defined, returning all questions")
            return db.query(Question).filter(
                Question.question_group_id == group.id,
                Question.is_active == True
            ).order_by(Question.display_order).all()
        
        questions = []
        # Build answer map by identifier
        answer_by_identifier = {}
        for q_id, answer in existing_answers.items():
            question = db.query(Question).filter(Question.id == q_id).first()
            if question:
                answer_by_identifier[question.identifier] = answer
        
        logger.info(f"answer_by_identifier: {answer_by_identifier}")
        
        def process_logic_items(items: List[Dict], depth: int = 0) -> bool:
            """Process logic items. Returns False if stop flag encountered."""
            indent = "  " * depth
            logger.info(f"{indent}Processing {len(items)} logic items at depth {depth}")
            
            for idx, item in enumerate(items):
                logger.info(f"{indent}Item {idx}: type={item.get('type')}, questionId={item.get('questionId')}")
                
                if item.get('type') == 'question':
                    question_id = item.get('questionId')
                    if question_id:
                        question = db.query(Question).filter(
                            Question.id == question_id,
                            Question.is_active == True
                        ).first()
                        if question and question not in questions:
                            logger.info(f"{indent}  Adding question: {question.identifier} (id={question.id})")
                            questions.append(question)
                        elif not question:
                            logger.warning(f"{indent}  Question with id {question_id} not found or inactive")
                    else:
                        logger.warning(f"{indent}  Question item has no questionId")
                    
                    # Check for stop flag
                    if item.get('stopFlow'):
                        logger.info(f"{indent}  Stop flag encountered")
                        return False
                
                elif item.get('type') == 'conditional' and item.get('conditional'):
                    cond = item['conditional']
                    identifier = cond.get('ifIdentifier')
                    expected_value = cond.get('value')
                    operator = cond.get('operator', 'equals')  # Default to 'equals' for backwards compatibility
                    
                    operator_display = '==' if operator == 'equals' else '!='
                    logger.info(f"{indent}  Conditional: if {identifier} {operator_display} '{expected_value}'")
                    logger.info(f"{indent}  Current answer for {identifier}: '{answer_by_identifier.get(identifier, 'NOT ANSWERED')}'")
                    
                    # Check if condition is met
                    # Don't show conditional questions if the referenced field is empty
                    if identifier and identifier in answer_by_identifier:
                        actual_value = answer_by_identifier[identifier]
                        
                        # If the actual value is empty/None, don't show conditional questions
                        if actual_value is None or actual_value == '':
                            logger.info(f"{indent}  Condition NOT MET (field is empty)")
                            continue
                        
                        # Evaluate based on operator
                        if operator == 'not_equals':
                            condition_met = actual_value != expected_value
                        else:  # 'equals' or default
                            condition_met = actual_value == expected_value
                        
                        if condition_met:
                            logger.info(f"{indent}  Condition MET - processing nested items")
                            # Condition met - process nested items
                            nested_items = cond.get('nestedItems', [])
                            if nested_items:
                                should_continue = process_logic_items(nested_items, depth + 1)
                                if not should_continue:
                                    return False
                            
                            # Check for end flow flag
                            if cond.get('endFlow'):
                                logger.info(f"{indent}  End flow flag encountered")
                                return False
                        else:
                            logger.info(f"{indent}  Condition NOT MET (value mismatch)")
                    else:
                        logger.info(f"{indent}  Condition NOT MET (identifier not in answers)")
            
            return True
        
        process_logic_items(group.question_logic)
        logger.info(f"Final questions to display: {[q.identifier for q in questions]}")
        return questions
    
    @staticmethod
    def save_answers(
        db: Session,
        session_id: int,
        user_id: int,
        answers: List[SessionAnswerCreate]
    ) -> None:
        """
        Save answers without navigating to next group.
        """
        session = SessionService.get_session(db, session_id, user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        for answer_data in answers:
            existing = db.query(SessionAnswer).filter(
                SessionAnswer.session_id == session_id,
                SessionAnswer.question_id == answer_data.question_id
            ).first()
            
            if existing:
                existing.answer_value = answer_data.answer_value
            else:
                answer = SessionAnswer(
                    session_id=session_id,
                    question_id=answer_data.question_id,
                    answer_value=answer_data.answer_value
                )
                db.add(answer)
        
        db.commit()
    
    @staticmethod
    def navigate_session(
        db: Session,
        session_id: int,
        user_id: int,
        direction: str,
        answers: Optional[List[SessionAnswerCreate]] = None
    ) -> DocumentSession:
        """
        Navigate to next or previous group in the flow.
        
        Args:
            db: Database session
            session_id: Session ID
            user_id: User ID
            direction: 'forward' or 'backward'
            answers: Optional answers to save before navigating
            
        Returns:
            Updated session
        """
        session = SessionService.get_session(db, session_id, user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        # Allow navigation and saving on completed sessions for editing
        
        # Save answers if provided
        if answers:
            SessionService.save_answers(db, session_id, user_id, answers)
        
        # Get ordered groups from flow
        ordered_groups = []
        if session.flow_id:
            flow = db.query(DocumentFlow).filter(
                DocumentFlow.id == session.flow_id
            ).first()
            if flow and flow.flow_logic:
                ordered_groups = SessionService._get_groups_from_flow_logic(
                    db, flow.flow_logic, session_id
                )
        
        if not ordered_groups and session.current_group_id:
            group = db.query(QuestionGroup).filter(
                QuestionGroup.id == session.current_group_id
            ).first()
            if group:
                ordered_groups = [group]
        
        # Find current index
        current_index = 0
        for i, group in enumerate(ordered_groups):
            if group.id == session.current_group_id:
                current_index = i
                break
        
        # Navigate
        if direction == 'forward':
            if current_index < len(ordered_groups) - 1:
                # Move to next group
                session.current_group_id = ordered_groups[current_index + 1].id
            else:
                # Last group - mark as completed
                session.is_completed = True
                session.completed_at = datetime.utcnow()
        
        elif direction == 'backward':
            if current_index > 0:
                session.current_group_id = ordered_groups[current_index - 1].id
        
        db.commit()
        db.refresh(session)
        
        return session
    
    @staticmethod
    def get_session_identifiers(db: Session, session_id: int, user_id: int) -> Optional[List[str]]:
        """
        Get all question identifiers from a session that have been answered.
        
        Args:
            db: Database session
            session_id: Session ID
            user_id: User ID (for authorization)
            
        Returns:
            List of identifiers if session found, None otherwise
        """
        session = SessionService.get_session(db, session_id, user_id)
        if not session:
            return None
        
        # Get all answers for this session with their question identifiers
        answers = db.query(SessionAnswer, Question.identifier).join(
            Question, SessionAnswer.question_id == Question.id
        ).filter(
            SessionAnswer.session_id == session_id
        ).all()
        
        # Extract unique identifiers
        identifiers = list(set([identifier for _, identifier in answers]))
        
        return sorted(identifiers)
