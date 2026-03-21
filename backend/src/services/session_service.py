"""Service layer for document session operations."""

from sqlalchemy.orm import Session
from typing import Optional, List, Tuple, Dict, Any
from fastapi import HTTPException, status
from datetime import datetime
import json
import logging
import math

_logger = logging.getLogger(__name__)

from ..models.session import InputForm, SessionAnswer, AnswerSnapshot
from ..models.question import QuestionGroup, Question
from ..models.flow import DocumentFlow, flow_question_groups
from ..schemas.session import (
    InputFormCreate,
    InputFormUpdate,
    SessionAnswerCreate,
    QuestionToDisplay,
    SessionQuestionsResponse
)
from ..utils.naming import generate_copy_name


class SessionService:
    """Service for document session operations."""

    @staticmethod
    def create_session(
        db: Session,
        session_data: InputFormCreate,
        user_id: int
    ) -> InputForm:
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

        session = InputForm(
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
    def get_session(db: Session, session_id: int, user_id: int) -> Optional[InputForm]:
        """
        Get session by ID (user can only access their own sessions).

        Args:
            db: Database session
            session_id: Session ID
            user_id: User ID

        Returns:
            Session if found and belongs to user, None otherwise
        """
        return db.query(InputForm).filter(
            InputForm.id == session_id,
            InputForm.user_id == user_id
        ).first()

    @staticmethod
    def list_sessions(
        db: Session,
        user_id: int,
        skip: int = 0,
        limit: int = 100
    ) -> Tuple[List[InputForm], int]:
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
        query = db.query(InputForm).filter(
            InputForm.user_id == user_id
        )

        total = query.count()
        sessions = query.order_by(InputForm.created_at.desc()).offset(skip).limit(limit).all()

        return sessions, total

    @staticmethod
    def submit_answers(
        db: Session,
        session_id: int,
        user_id: int,
        answers: List[SessionAnswerCreate]
    ) -> InputForm:
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

        # Validate question_ids belong to the current group
        valid_question_ids = {q.id for q in current_group.questions}
        for answer_data in answers:
            if answer_data.question_id not in valid_question_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Question {answer_data.question_id} does not belong to current group"
                )

        # Batch-load existing answers for submitted question_ids in one query
        submitted_question_ids = [a.question_id for a in answers]
        existing_answers_list = db.query(SessionAnswer).filter(
            SessionAnswer.session_id == session_id,
            SessionAnswer.question_id.in_(submitted_question_ids)
        ).all()
        existing_by_qid = {a.question_id: a for a in existing_answers_list}

        # Save answers
        for answer_data in answers:
            existing_answer = existing_by_qid.get(answer_data.question_id)

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

        # Record snapshots for persistence verification
        submitted_qids = [a.question_id for a in answers]
        if submitted_qids:
            SessionService._record_snapshots(db, session_id, submitted_qids)

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
        session: InputForm,
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
                    # Support both namespaced and non-namespaced identifiers
                    for q in current_group.questions:
                        # Check both full identifier and stripped version
                        q_stripped = q.identifier.split('.', 1)[1] if '.' in q.identifier else q.identifier
                        if q.identifier == if_identifier or q_stripped == if_identifier:
                            actual_value = answer_by_question_id.get(q.id)

                            # Skip if the field is empty
                            if actual_value is None or actual_value == '':
                                break

                            # Evaluate based on operator
                            if operator == 'not_equals':
                                condition_met = actual_value != expected_value
                            elif operator in ('any_equals', 'none_equals'):
                                # Check if ANY or NONE of the repeatable group instances match
                                try:
                                    parsed = json.loads(actual_value)
                                    if isinstance(parsed, list):
                                        values = [str(v) if v is not None else '' for v in parsed]
                                    else:
                                        values = [actual_value]
                                except (json.JSONDecodeError, TypeError):
                                    values = [actual_value]
                                any_match = expected_value in values
                                condition_met = any_match if operator == 'any_equals' else not any_match
                            elif operator in ('count_greater_than', 'count_equals', 'count_less_than'):
                                # Count operators for repeatable fields - parse JSON array and compare length
                                try:
                                    parsed = json.loads(actual_value)
                                    if isinstance(parsed, list):
                                        count = len(parsed)
                                    else:
                                        count = 1  # Non-array value counts as 1
                                except (json.JSONDecodeError, TypeError):
                                    count = 1 if actual_value else 0  # Non-JSON value counts as 1 if not empty

                                try:
                                    threshold = int(expected_value)
                                except (ValueError, TypeError):
                                    threshold = 0

                                if operator == 'count_greater_than':
                                    condition_met = count > threshold
                                elif operator == 'count_equals':
                                    condition_met = count == threshold
                                else:  # count_less_than
                                    condition_met = count < threshold
                            else:  # 'equals' or default
                                condition_met = actual_value == expected_value

                            if condition_met:
                                if next_group_id:
                                    return next_group_id
                                break

        # If no conditional flow matched, find next group within the same flow
        if session.flow_id:
            flow = db.query(DocumentFlow).filter(
                DocumentFlow.id == session.flow_id
            ).first()
            if flow and flow.flow_logic:
                # Get ordered groups from flow logic and find the one after current
                ordered_groups = SessionService._get_groups_from_flow_logic(
                    db, flow.flow_logic, session.id
                )
                for i, g in enumerate(ordered_groups):
                    if g.id == current_group.id and i + 1 < len(ordered_groups):
                        return ordered_groups[i + 1].id
                # Current group is last in flow or not found
                return None

        # No flow — find next active group by display_order (scoped fallback)
        next_group = db.query(QuestionGroup).filter(
            QuestionGroup.display_order > current_group.display_order,
            QuestionGroup.is_active == True
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
        user_id: int
    ) -> SessionQuestionsResponse:
        """
        Get questions to display for a session based on flow_logic and question_logic.

        Args:
            db: Database session
            session_id: Session ID
            user_id: User ID

        Returns:
            SessionQuestionsResponse with all questions for the current group
        """
        session = SessionService.get_session(db, session_id, user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )

        # Allow viewing/editing completed sessions - don't block access

        # Resolve ordered groups from flow (or fallback)
        ordered_groups, flow_name = SessionService._get_ordered_groups(db, session)

        if not ordered_groups:
            # For sessions with no group (e.g., completed or orphaned),
            # return an empty question set instead of an error
            return {
                "session_id": session.id,
                "client_identifier": session.client_identifier,
                "flow_id": session.flow_id,
                "flow_name": flow_name,
                "current_group_id": 0,
                "current_group_name": "",
                "current_group_index": 0,
                "total_groups": 0,
                "questions": [],
                "current_page": 1,
                "total_pages": 1,
                "questions_per_page": 0,
                "is_completed": session.is_completed,
                "is_last_group": True,
                "is_first_group": True,
                "can_go_back": False,
                "existing_answers": {a.question_id: a.answer_value for a in db.query(SessionAnswer).filter(SessionAnswer.session_id == session_id).all()},
                "conditional_identifiers": [],
            }

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

        # Get existing answers for this session
        existing_answers_list = db.query(SessionAnswer).filter(
            SessionAnswer.session_id == session_id
        ).all()
        existing_answers = {}
        
        # Process answers and split 2D arrays into synthetic IDs
        for answer in existing_answers_list:
            # Check if this is a 2D array (for repeatable conditional followups)
            try:
                parsed = json.loads(answer.answer_value)
                if isinstance(parsed, list) and len(parsed) > 0 and isinstance(parsed[0], list):
                    # This is a 2D array - split into synthetic IDs
                    # Each element is an array for a parent instance
                    for instance_idx, instance_array in enumerate(parsed):
                        synthetic_id = answer.question_id * 100000 + instance_idx
                        existing_answers[synthetic_id] = json.dumps(instance_array)
                    # Also keep the original for backward compatibility
                    existing_answers[answer.question_id] = answer.answer_value
                else:
                    # Regular answer
                    existing_answers[answer.question_id] = answer.answer_value
            except (json.JSONDecodeError, TypeError):
                # Not JSON or not a list - treat as regular answer
                existing_answers[answer.question_id] = answer.answer_value

        # Get questions to display based on question_logic
        # Returns tuple of (questions_with_data, repeatable_followups, question_numbers, all_followups)
        questions_with_data, repeatable_followups, question_numbers, all_followups = SessionService._get_questions_from_logic(
            db, current_group, existing_answers
        )

        # Return all questions without pagination
        total_questions = len(questions_with_data)
        paginated_questions = questions_with_data

        # Convert to response format
        from src.schemas.session import ConditionalFollowup, ConditionalFollowupQuestion

        def build_followup_question(fq_tuple) -> ConditionalFollowupQuestion:
            """Build a ConditionalFollowupQuestion from a (question, sub_followups) tuple."""
            fq, sub_followups = fq_tuple
            # Recursively build conditional_followups for this follow-up question
            fq_cond_followups = None
            if sub_followups:
                fq_cond_followups = []
                for sfu in sub_followups:
                    sfu_questions = [build_followup_question(sq_tuple) for sq_tuple in sfu['questions']]
                    fq_cond_followups.append(ConditionalFollowup(
                        trigger_value=sfu['trigger_value'],
                        operator=sfu['operator'],
                        questions=sfu_questions
                    ))
            return ConditionalFollowupQuestion(
                id=fq.id,
                identifier=fq.identifier,
                question_text=fq.question_text,
                question_type=fq.question_type,
                is_required=fq.is_required,
                repeatable=fq.repeatable,
                repeatable_group_id=fq.repeatable_group_id,
                help_text=fq.help_text,
                options=fq.options,
                person_display_mode=fq.person_display_mode,
                include_time=fq.include_time,
                validation_rules=fq.validation_rules,
                conditional_followups=fq_cond_followups,
                hierarchical_number=question_numbers.get(fq.id)
            )

        question_responses = []
        for q, depth, hierarchical_number in paginated_questions:
            # Build conditional_followups for any question that has them
            # (repeatable questions use these for per-instance rendering,
            # all questions use them for answer deletion when conditionals change)
            cond_followups = None
            if q.id in all_followups:
                cond_followups = []
                for fu in all_followups[q.id]:
                    fu_questions = [build_followup_question(fq_tuple) for fq_tuple in fu['questions']]
                    cond_followups.append(ConditionalFollowup(
                        trigger_value=fu['trigger_value'],
                        operator=fu['operator'],
                        questions=fu_questions
                    ))

            question_responses.append(QuestionToDisplay(
                id=q.id,
                identifier=q.identifier,
                question_text=q.question_text,
                question_type=q.question_type,
                is_required=q.is_required,
                repeatable=q.repeatable,
                repeatable_group_id=q.repeatable_group_id,
                help_text=q.help_text,
                options=q.options,
                person_display_mode=q.person_display_mode,
                include_time=q.include_time,
                validation_rules=q.validation_rules,
                current_answer=existing_answers.get(q.id),
                depth=depth,
                conditional_followups=cond_followups,
                hierarchical_number=hierarchical_number
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
            current_page=1,
            total_pages=1,
            questions_per_page=0,
            is_completed=session.is_completed,
            is_last_group=is_last_group,
            can_go_back=current_group_index > 0,
            existing_answers=existing_answers,
            conditional_identifiers=conditional_identifiers
        )

    @staticmethod
    def _get_ordered_groups(
        db: Session,
        session: InputForm
    ) -> Tuple[List[QuestionGroup], Optional[str]]:
        """
        Resolve ordered question groups for a session from its flow.
        Returns (ordered_groups, flow_name).

        Falls back to the session's current_group_id if no flow is set
        or the flow has no flow_logic.
        """
        ordered_groups = []
        flow_name = None

        if session.flow_id:
            flow = db.query(DocumentFlow).filter(
                DocumentFlow.id == session.flow_id
            ).first()
            if flow:
                flow_name = flow.name
                if flow.flow_logic:
                    ordered_groups = SessionService._get_groups_from_flow_logic(
                        db, flow.flow_logic, session.id
                    )

        # Fallback: use current_group_id as a single-element list
        if not ordered_groups and session.current_group_id:
            group = db.query(QuestionGroup).filter(
                QuestionGroup.id == session.current_group_id
            ).first()
            if group:
                ordered_groups = [group]

        return ordered_groups, flow_name

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

        # Batch-load all questions referenced by answers in one query
        answer_question_ids = [a.question_id for a in existing_answers]
        if answer_question_ids:
            questions_for_answers = db.query(Question).filter(
                Question.id.in_(answer_question_ids)
            ).all()
            question_id_to_identifier = {q.id: q.identifier for q in questions_for_answers}
        else:
            question_id_to_identifier = {}

        answer_map = {}
        for answer in existing_answers:
            identifier = question_id_to_identifier.get(answer.question_id)
            if identifier:
                answer_map[identifier] = answer.answer_value

        # Collect all group IDs referenced in flow_logic, then batch-load
        def collect_group_ids(steps: List[Dict]) -> set:
            ids = set()
            for step in steps:
                if step.get('type') == 'group' and step.get('groupId'):
                    ids.add(step['groupId'])
                elif step.get('type') == 'conditional' and step.get('conditional'):
                    cond = step['conditional']
                    if cond.get('targetGroupId'):
                        ids.add(cond['targetGroupId'])
                    if cond.get('nestedSteps'):
                        ids.update(collect_group_ids(cond['nestedSteps']))
            return ids

        all_group_ids = collect_group_ids(flow_logic)
        if all_group_ids:
            all_groups = db.query(QuestionGroup).filter(
                QuestionGroup.id.in_(all_group_ids),
                QuestionGroup.is_active == True
            ).all()
            group_by_id = {g.id: g for g in all_groups}
        else:
            group_by_id = {}

        added_group_ids = set()

        def process_steps(steps: List[Dict]):
            for step in steps:
                if step.get('type') == 'group' and step.get('groupId'):
                    group = group_by_id.get(step['groupId'])
                    if group and group.id not in added_group_ids:
                        groups.append(group)
                        added_group_ids.add(group.id)

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
                                target_group = group_by_id.get(target_group_id)
                                if target_group and target_group.id not in added_group_ids:
                                    groups.append(target_group)
                                    added_group_ids.add(target_group.id)

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
    ) -> tuple:
        """
        Get questions to display based on question_logic.
        Evaluates conditionals and respects stop flags.

        Returns:
            Tuple of (questions_with_data, repeatable_followups, question_numbers)
            - questions_with_data: List of (question, depth, hierarchical_number) tuples
            - repeatable_followups: Dict mapping question_id -> list of {trigger_value, operator, questions}
              for repeatable questions that have conditional follow-ups
            - question_numbers: Dict mapping question_id -> hierarchical_number string
        """
        _logger.debug(f"_get_questions_from_logic called for group {group.id} ({group.name})")
        _logger.debug(f"question_logic: {group.question_logic}")
        _logger.debug(f"existing_answers: {existing_answers}")

        # Batch-load all active questions for this group in one query
        all_group_questions = db.query(Question).filter(
            Question.question_group_id == group.id,
            Question.is_active == True
        ).order_by(Question.display_order).all()
        question_by_id = {q.id: q for q in all_group_questions}

        if not group.question_logic:
            # No logic defined - return all questions in order with depth 0
            _logger.debug("No question_logic defined, returning all questions")
            simple_numbers = {q.id: str(i + 1) for i, q in enumerate(all_group_questions)}
            return [(q, 0, str(i + 1)) for i, q in enumerate(all_group_questions)], {}, simple_numbers, {}

        questions_with_data = []  # List of (question, depth, hierarchical_number) tuples
        question_ids_added = set()  # Track which question IDs have been added
        # Track repeatable question identifiers (both namespaced and stripped)
        repeatable_identifier_to_question_id = {}
        # Track ALL question identifiers (for conditional followup collection on non-repeatable too)
        all_identifier_to_question_id = {}
        # Conditional follow-ups for repeatable questions: {question_id: [{trigger_value, operator, questions}]}
        repeatable_followups = {}
        # Conditional follow-ups for ALL questions (including non-repeatable): used for answer deletion
        all_followups = {}

        # Build answer map by identifier using pre-loaded questions
        # Store both namespaced and non-namespaced versions for compatibility
        answer_by_identifier = {}
        for q_id, answer in existing_answers.items():
            question = question_by_id.get(q_id)
            if question:
                # Store with full namespaced identifier
                answer_by_identifier[question.identifier] = answer
                # Also store with stripped identifier (without namespace prefix)
                if '.' in question.identifier:
                    stripped_identifier = question.identifier.split('.', 1)[1]
                    answer_by_identifier[stripped_identifier] = answer

        _logger.debug(f"answer_by_identifier: {answer_by_identifier}")

        # Pre-scan logic to find question identifiers (repeatable and non-repeatable)
        def find_question_identifiers(items: List[Dict]):
            for item in items:
                if item.get('type') == 'question':
                    qid = item.get('questionId')
                    if qid:
                        q = question_by_id.get(qid)
                        if q:
                            all_identifier_to_question_id[q.identifier] = q.id
                            if '.' in q.identifier:
                                stripped = q.identifier.split('.', 1)[1]
                                all_identifier_to_question_id[stripped] = q.id
                            if q.repeatable:
                                repeatable_identifier_to_question_id[q.identifier] = q.id
                                if '.' in q.identifier:
                                    stripped = q.identifier.split('.', 1)[1]
                                    repeatable_identifier_to_question_id[stripped] = q.id
                elif item.get('type') == 'conditional' and item.get('conditional'):
                    nested = item['conditional'].get('nestedItems', [])
                    if nested:
                        find_question_identifiers(nested)

        find_question_identifiers(group.question_logic)
        _logger.debug(f"Repeatable identifiers: {repeatable_identifier_to_question_id}")
        _logger.debug(f"All identifiers: {all_identifier_to_question_id}")

        # PASS 1: Assign hierarchical numbers to ALL questions in the tree
        # This ensures numbering matches the admin view exactly
        question_numbers = {}  # Maps question_id -> hierarchical_number
        # Track counters per prefix so multiple conditionals referencing the same
        # triggering question continue numbering instead of restarting at 1
        prefix_counters = {}  # Maps prefix string -> last counter used

        def _resolve_nested_prefix(cond_identifier: str, fallback: str) -> str:
            """Look up the trigger question's hierarchical number to use as prefix."""
            if cond_identifier:
                for qid, q in question_by_id.items():
                    ident = q.identifier
                    stripped = ident.split('.', 1)[1] if '.' in ident else ident
                    if ident == cond_identifier or stripped == cond_identifier:
                        if qid in question_numbers:
                            return question_numbers[qid]
                        break
            return fallback

        def assign_hierarchical_numbers(items: List[Dict], number_prefix: str = ""):
            """Traverse entire tree and assign numbers to all questions.

            Mutually exclusive conditional branches (same trigger, different
            values) share the same number base so visible questions never have
            gaps.  Same-trigger-same-value branches continue counting (e.g. the
            amendment pattern where two blocks both check amendment_type=Update).
            """
            question_counter = prefix_counters.get(number_prefix, 0)
            last_question_number = number_prefix

            i = 0
            while i < len(items):
                item = items[i]

                if item.get('type') == 'question':
                    question_id = item.get('questionId')
                    if question_id:
                        question_counter += 1
                        hierarchical_number = f"{number_prefix}-{question_counter}" if number_prefix else str(question_counter)
                        question_numbers[question_id] = hierarchical_number
                        last_question_number = hierarchical_number
                        _logger.debug(f"Assigned number {hierarchical_number} to question_id {question_id}")
                    i += 1

                elif item.get('type') == 'conditional' and item.get('conditional'):
                    cond = item['conditional']
                    cond_identifier = cond.get('ifIdentifier')
                    nested_prefix = _resolve_nested_prefix(cond_identifier, last_question_number)

                    # Collect consecutive conditionals with the same trigger
                    run: List[Dict] = []
                    j = i
                    while j < len(items):
                        ci = items[j]
                        if ci.get('type') != 'conditional' or not ci.get('conditional'):
                            break
                        if ci['conditional'].get('ifIdentifier') != cond_identifier:
                            break
                        run.append(ci)
                        j += 1

                    # Process the run — reset counter for each NEW value
                    base_counter = prefix_counters.get(nested_prefix, 0)
                    max_counter = base_counter
                    seen_values: set = set()

                    for run_item in run:
                        rc = run_item['conditional']
                        rv = rc.get('value')
                        rn = rc.get('nestedItems', [])

                        if rv not in seen_values:
                            # Mutually exclusive value: reset to base
                            prefix_counters[nested_prefix] = base_counter
                            seen_values.add(rv)
                        # else: same value → continue counting (amendment pattern)

                        if rn:
                            assign_hierarchical_numbers(rn, nested_prefix)

                        branch_counter = prefix_counters.get(nested_prefix, 0)
                        if branch_counter > max_counter:
                            max_counter = branch_counter

                    # After all branches, use the highest counter
                    prefix_counters[nested_prefix] = max_counter
                    i = j

                else:
                    i += 1

            prefix_counters[number_prefix] = question_counter

        assign_hierarchical_numbers(group.question_logic)
        _logger.debug(f"Question numbers assigned: {question_numbers}")

        def collect_nested_questions(items: List[Dict]) -> list:
            """Collect question objects from nested logic items, including nested conditionals as metadata.

            Returns a list of (question, sub_followups) tuples where sub_followups is a list of
            {trigger_value, operator, questions} dicts for conditionals that depend on the question.
            """
            collected = []
            # First pass: collect all questions and build an identifier->question map
            question_map = {}  # identifier -> question object
            for item in items:
                if item.get('type') == 'question':
                    qid = item.get('questionId')
                    if qid:
                        q = question_by_id.get(qid)
                        if q:
                            question_map[q.identifier] = q
                            # Also map stripped identifier
                            if '.' in q.identifier:
                                stripped = q.identifier.split('.', 1)[1]
                                question_map[stripped] = q

            # Second pass: find conditionals and associate them with their parent questions
            sub_followups_map = {}  # question_id -> list of {trigger_value, operator, questions}
            for item in items:
                if item.get('type') == 'conditional' and item.get('conditional'):
                    cond = item['conditional']
                    cond_identifier = cond.get('ifIdentifier')
                    if cond_identifier and cond_identifier in question_map:
                        parent_q = question_map[cond_identifier]
                        nested_items = cond.get('nestedItems', [])
                        # Recursively collect nested questions (supports deeper nesting)
                        nested_results = collect_nested_questions(nested_items)
                        nested_qs = [nr[0] for nr in nested_results]
                        if nested_qs:
                            if parent_q.id not in sub_followups_map:
                                sub_followups_map[parent_q.id] = []
                            sub_followups_map[parent_q.id].append({
                                'trigger_value': cond.get('value', ''),
                                'operator': cond.get('operator', 'equals'),
                                'questions': nested_results  # list of (question, sub_followups) tuples
                            })

            # Build final list: (question, sub_followups)
            for item in items:
                if item.get('type') == 'question':
                    qid = item.get('questionId')
                    if qid:
                        q = question_by_id.get(qid)
                        if q:
                            collected.append((q, sub_followups_map.get(q.id)))
            return collected

        def process_logic_items(items: List[Dict], depth: int = 0) -> bool:
            """Process logic items. Returns False if stop flag encountered.
            Uses pre-assigned hierarchical numbers from question_numbers dict."""
            indent = "  " * depth
            _logger.debug(f"{indent}Processing {len(items)} logic items at depth {depth}")

            for idx, item in enumerate(items):
                _logger.debug(f"{indent}Item {idx}: type={item.get('type')}, questionId={item.get('questionId')}")

                if item.get('type') == 'question':
                    question_id = item.get('questionId')
                    if question_id:
                        # Use pre-assigned hierarchical number
                        hierarchical_number = question_numbers.get(question_id, "?")

                        question = question_by_id.get(question_id)
                        # Only add to result if found, active, and not already added
                        if question and question.id not in question_ids_added:
                            _logger.debug(f"{indent}  Adding question: {question.identifier} (id={question.id}, depth={depth}, number={hierarchical_number})")
                            questions_with_data.append((question, depth, hierarchical_number))
                            question_ids_added.add(question.id)
                        elif not question:
                            _logger.warning(f"{indent}  Question with id {question_id} not found or inactive (assigned number={hierarchical_number})")
                    else:
                        _logger.warning(f"{indent}  Question item has no questionId")

                    # Check for stop flag
                    if item.get('stopFlow'):
                        _logger.debug(f"{indent}  Stop flag encountered")
                        return False

                elif item.get('type') == 'conditional' and item.get('conditional'):
                    cond = item['conditional']
                    identifier = cond.get('ifIdentifier')
                    expected_value = cond.get('value')
                    operator = cond.get('operator', 'equals')  # Default to 'equals' for backwards compatibility

                    operator_display = '==' if operator == 'equals' else '!='
                    _logger.debug(f"{indent}  Conditional: if {identifier} {operator_display} '{expected_value}'")
                    _logger.debug(f"{indent}  Current answer for {identifier}: '{answer_by_identifier.get(identifier, 'NOT ANSWERED')}'")

                    # Collect conditional follow-up questions as metadata
                    # For repeatable questions: used for per-instance rendering
                    # For all questions: used by frontend to identify which answers to delete on change
                    if identifier and identifier in all_identifier_to_question_id:
                        parent_q_id = all_identifier_to_question_id[identifier]
                        nested_items = cond.get('nestedItems', [])
                        followup_questions = collect_nested_questions(nested_items)

                        if followup_questions:
                            # Always collect into all_followups for answer deletion
                            if parent_q_id not in all_followups:
                                all_followups[parent_q_id] = []
                            all_followups[parent_q_id].append({
                                'trigger_value': expected_value,
                                'operator': operator,
                                'questions': followup_questions
                            })
                            # Also collect into repeatable_followups if it's a repeatable question
                            if identifier in repeatable_identifier_to_question_id:
                                if parent_q_id not in repeatable_followups:
                                    repeatable_followups[parent_q_id] = []
                                repeatable_followups[parent_q_id].append({
                                    'trigger_value': expected_value,
                                    'operator': operator,
                                    'questions': followup_questions
                                })
                            _logger.debug(f"{indent}  Collected {len(followup_questions)} follow-up questions for q_id={parent_q_id}, trigger='{expected_value}'")

                    # Check if condition is met
                    # Don't show conditional questions if the referenced field is empty
                    if identifier and identifier in answer_by_identifier:
                        actual_value = answer_by_identifier[identifier]

                        # If the actual value is empty/None, don't show conditional questions
                        if actual_value is None or actual_value == '':
                            _logger.debug(f"{indent}  Condition NOT MET (field is empty)")
                            continue

                        # Evaluate based on operator
                        if operator == 'not_equals':
                            # For repeatable questions, check if none of the array elements match
                            try:
                                parsed = json.loads(actual_value)
                                if isinstance(parsed, list):
                                    condition_met = expected_value not in parsed
                                else:
                                    condition_met = actual_value != expected_value
                            except (json.JSONDecodeError, TypeError, ValueError):
                                condition_met = actual_value != expected_value
                        elif operator in ('any_equals', 'none_equals'):
                            # Check if ANY or NONE of the repeatable group instances match
                            try:
                                parsed = json.loads(actual_value)
                                if isinstance(parsed, list):
                                    values = [str(v) if v is not None else '' for v in parsed]
                                else:
                                    values = [actual_value]
                            except (json.JSONDecodeError, TypeError, ValueError):
                                values = [actual_value]
                            any_match = expected_value in values
                            condition_met = any_match if operator == 'any_equals' else not any_match
                            _logger.debug(f"{indent}  {operator}: '{expected_value}' in {values} = {condition_met}")
                        elif operator in ('count_greater_than', 'count_equals', 'count_less_than'):
                            # Count operators for repeatable fields - parse JSON array and compare length
                            try:
                                parsed = json.loads(actual_value)
                                if isinstance(parsed, list):
                                    count = len(parsed)
                                else:
                                    count = 1  # Non-array value counts as 1
                            except (json.JSONDecodeError, TypeError):
                                count = 1 if actual_value else 0  # Non-JSON value counts as 1 if not empty

                            try:
                                threshold = int(expected_value)
                            except (ValueError, TypeError):
                                threshold = 0

                            if operator == 'count_greater_than':
                                condition_met = count > threshold
                            elif operator == 'count_equals':
                                condition_met = count == threshold
                            else:  # count_less_than
                                condition_met = count < threshold

                            _logger.debug(f"{indent}  Count comparison: {count} {operator} {threshold} = {condition_met}")
                        else:  # 'equals' or default
                            # For repeatable questions, the answer may be a JSON array
                            # Check if any element in the array matches the expected value
                            try:
                                parsed = json.loads(actual_value)
                                if isinstance(parsed, list):
                                    if operator == 'not_equals':
                                        condition_met = expected_value not in parsed
                                    else:
                                        condition_met = expected_value in parsed
                                    _logger.debug(f"{indent}  Array comparison: '{expected_value}' in {parsed} = {condition_met}")
                                else:
                                    condition_met = actual_value == expected_value
                            except (json.JSONDecodeError, TypeError, ValueError):
                                condition_met = actual_value == expected_value

                        if condition_met:
                            _logger.debug(f"{indent}  Condition MET - processing nested items")
                            # Skip adding to flat list if this is a repeatable follow-up
                            # (frontend will render per-instance using conditional_followups)
                            # BUT: any_equals/none_equals are aggregate operators that apply
                            # across ALL instances, so their nested items belong in the flat list.
                            is_aggregate_op = operator in ('any_equals', 'none_equals')
                            if identifier in repeatable_identifier_to_question_id and not is_aggregate_op:
                                _logger.debug(f"{indent}  Skipping flat list addition (repeatable follow-up)")
                            else:
                                nested_items = cond.get('nestedItems', [])
                                if nested_items:
                                    # Process nested items (numbers already assigned in pass 1)
                                    should_continue = process_logic_items(nested_items, depth + 1)
                                    if not should_continue:
                                        return False

                            # Check for end flow flag
                            if cond.get('endFlow'):
                                _logger.debug(f"{indent}  End flow flag encountered")
                                return False
                        else:
                            _logger.debug(f"{indent}  Condition NOT MET (value mismatch)")
                    else:
                        _logger.debug(f"{indent}  Condition NOT MET (identifier not in answers)")

            return True

        process_logic_items(group.question_logic)
        _logger.debug(f"Final questions to display: {[(q.identifier, d, h) for q, d, h in questions_with_data]}")
        _logger.debug(f"Repeatable followups: {repeatable_followups}")
        return questions_with_data, repeatable_followups, question_numbers, all_followups

    @staticmethod
    def save_answers(
        db: Session,
        session_id: int,
        user_id: int,
        answers: List[SessionAnswerCreate]
    ) -> None:
        """
        Save answers without navigating to next group.
        Handles synthetic IDs (>= 100000) for repeatable conditional followups.
        """
        session = SessionService.get_session(db, session_id, user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )

        # Separate synthetic IDs from real IDs
        real_answers = []
        synthetic_answers = {}  # {real_id: {instance_idx: answer_value}}
        real_answers_pending = []  # hold real answers until we know about synthetics
        
        for answer_data in answers:
            if answer_data.question_id >= 100000:
                # Synthetic ID: extract real ID and instance index
                real_id = answer_data.question_id // 100000
                instance_idx = answer_data.question_id % 100000
                
                if real_id not in synthetic_answers:
                    synthetic_answers[real_id] = {}
                synthetic_answers[real_id][instance_idx] = answer_data.answer_value
            else:
                real_answers_pending.append(answer_data)

        # If a real question ID also has synthetic siblings, treat it as
        # instance 0 in the synthetic merge — do NOT save it separately,
        # or it will overwrite the merged 2D array.
        for answer_data in real_answers_pending:
            if answer_data.question_id in synthetic_answers:
                synthetic_answers[answer_data.question_id][0] = answer_data.answer_value
            else:
                real_answers.append(answer_data)

        # Validate question_ids belong to the current group
        if session.current_group_id:
            current_group = db.query(QuestionGroup).filter(
                QuestionGroup.id == session.current_group_id
            ).first()
            if current_group:
                valid_question_ids = {q.id for q in current_group.questions}
                
                # Validate real answers
                for answer_data in real_answers:
                    if answer_data.question_id not in valid_question_ids:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Question {answer_data.question_id} does not belong to current group"
                        )
                
                # Validate synthetic answers (check real IDs)
                for real_id in synthetic_answers.keys():
                    if real_id not in valid_question_ids:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Question {real_id} does not belong to current group"
                        )

        # Merge synthetic answers into 2D arrays
        for real_id, instance_data in synthetic_answers.items():
            # Load existing answer for this real question
            existing = db.query(SessionAnswer).filter(
                SessionAnswer.session_id == session_id,
                SessionAnswer.question_id == real_id
            ).first()
            
            # Parse existing 2D array or create new one
            if existing and existing.answer_value:
                try:
                    existing_2d = json.loads(existing.answer_value)
                    if not isinstance(existing_2d, list):
                        existing_2d = []
                except (json.JSONDecodeError, TypeError):
                    existing_2d = []
            else:
                existing_2d = []
            
            # Update the 2D array with new instance data
            for instance_idx, answer_value in instance_data.items():
                # Parse the answer value (it's a JSON array for repeatable questions)
                try:
                    answer_array = json.loads(answer_value)
                    if not isinstance(answer_array, list):
                        answer_array = [answer_value]
                except (json.JSONDecodeError, TypeError):
                    answer_array = [answer_value] if answer_value else ['']
                
                # Ensure 2D array is large enough
                while len(existing_2d) <= instance_idx:
                    existing_2d.append([])
                
                # Update this instance's array
                existing_2d[instance_idx] = answer_array
            
            # Save the merged 2D array
            merged_value = json.dumps(existing_2d)
            
            if existing:
                existing.answer_value = merged_value
            else:
                answer = SessionAnswer(
                    session_id=session_id,
                    question_id=real_id,
                    answer_value=merged_value
                )
                db.add(answer)

        # Save regular answers
        if real_answers:
            submitted_question_ids = [a.question_id for a in real_answers]
            existing_answers_list = db.query(SessionAnswer).filter(
                SessionAnswer.session_id == session_id,
                SessionAnswer.question_id.in_(submitted_question_ids)
            ).all()
            existing_by_qid = {a.question_id: a for a in existing_answers_list}

            for answer_data in real_answers:
                existing = existing_by_qid.get(answer_data.question_id)

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

        # Record snapshots for persistence verification
        # Re-read the just-committed answers for the affected question IDs
        all_affected_qids = [a.question_id for a in real_answers] + list(synthetic_answers.keys())
        if all_affected_qids:
            SessionService._record_snapshots(db, session_id, all_affected_qids)

    @staticmethod
    def delete_answers(
        db: Session,
        session_id: int,
        user_id: int,
        question_ids: List[int]
    ) -> int:
        """
        Delete answers for specific questions in a session.

        Args:
            db: Database session
            session_id: Session ID
            user_id: User ID
            question_ids: List of question IDs whose answers should be deleted

        Returns:
            Number of answers deleted
        """
        session = SessionService.get_session(db, session_id, user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )

        if not question_ids:
            return 0

        deleted = db.query(SessionAnswer).filter(
            SessionAnswer.session_id == session_id,
            SessionAnswer.question_id.in_(question_ids)
        ).delete(synchronize_session='fetch')

        # Do NOT delete snapshots here — they must persist so we can
        # detect if an answer disappears unexpectedly on the next load.

        db.commit()
        return deleted

    @staticmethod
    def navigate_session(
        db: Session,
        session_id: int,
        user_id: int,
        direction: str,
        answers: Optional[List[SessionAnswerCreate]] = None
    ) -> InputForm:
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

        # Resolve ordered groups from flow (or fallback)
        ordered_groups, _ = SessionService._get_ordered_groups(db, session)

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
    def get_session_identifiers(db: Session, session_id: int, user_id: int) -> Optional[Dict[str, str]]:
        """
        Get all question identifiers from a session that have been answered,
        along with their formatted display values.

        Args:
            db: Database session
            session_id: Session ID
            user_id: User ID (for authorization)

        Returns:
            Dict mapping identifier -> formatted value, or None if session not found
        """
        from .document_service import DocumentService

        session = SessionService.get_session(db, session_id, user_id)
        if not session:
            return None

        # Get all answers for this session with their questions
        answer_pairs = db.query(SessionAnswer, Question).join(
            Question, SessionAnswer.question_id == Question.id
        ).filter(
            SessionAnswer.session_id == session_id
        ).all()

        # Build formatted answer map using DocumentService for consistent formatting
        identifier_values: Dict[str, str] = {}
        for answer, question in answer_pairs:
            formatted_value = DocumentService._format_answer_value(
                answer.answer_value,
                question.question_type
            )
            identifier_values[question.identifier] = formatted_value

        return identifier_values

    @staticmethod
    def copy_session(db: Session, session_id: int, user_id: int) -> InputForm:
        """
        Create a copy of a session with all its answers.

        Args:
            db: Database session
            session_id: Session ID to copy
            user_id: User ID (for authorization and ownership)

        Returns:
            Created session copy
        """
        # Get the original session
        original_session = SessionService.get_session(db, session_id, user_id)
        if not original_session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )

        # Get all existing client identifiers for this user for uniqueness check
        user_sessions = db.query(InputForm).filter(
            InputForm.user_id == user_id
        ).all()
        existing_names = [s.client_identifier for s in user_sessions]

        # Generate unique client identifier
        new_client_identifier = generate_copy_name(
            original_session.client_identifier,
            existing_names
        )

        # Create the new session
        new_session = InputForm(
            client_identifier=new_client_identifier,
            user_id=user_id,
            flow_id=original_session.flow_id,
            current_group_id=original_session.current_group_id,
            is_completed=False  # Copy starts as not completed
        )

        db.add(new_session)
        db.flush()  # Get the new session ID without committing

        # Copy all answers from the original session
        original_answers = db.query(SessionAnswer).filter(
            SessionAnswer.session_id == session_id
        ).all()

        for original_answer in original_answers:
            new_answer = SessionAnswer(
                session_id=new_session.id,
                question_id=original_answer.question_id,
                answer_value=original_answer.answer_value
            )
            db.add(new_answer)

        db.commit()
        db.refresh(new_session)

        return new_session

    @staticmethod
    def _record_snapshots(
        db: Session,
        session_id: int,
        question_ids: List[int]  # kept for API compat but we snapshot ALL answers
    ) -> None:
        """
        Record answer snapshots for persistence verification.
        Snapshots ALL answers for the entire session so we have a
        complete record. Snapshots are never deleted — if an answer
        disappears later, the snapshot stays so we can detect the loss.

        Args:
            db: Database session
            session_id: Session ID
            question_ids: (unused) kept for call-site compatibility
        """
        # Read ALL current answers for this session
        current_answers = db.query(SessionAnswer).filter(
            SessionAnswer.session_id == session_id
        ).all()

        answer_map = {a.question_id: a.answer_value for a in current_answers}

        # Load ALL existing snapshots for this session
        existing_snapshots = db.query(AnswerSnapshot).filter(
            AnswerSnapshot.session_id == session_id
        ).all()
        existing_snap_map = {s.question_id: s for s in existing_snapshots}

        # Upsert snapshots for every answer that currently exists
        for qid, value in answer_map.items():
            if qid in existing_snap_map:
                existing_snap_map[qid].answer_value = value
                existing_snap_map[qid].saved_at = datetime.utcnow()
            else:
                snapshot = AnswerSnapshot(
                    session_id=session_id,
                    question_id=qid,
                    answer_value=value,
                    saved_at=datetime.utcnow()
                )
                db.add(snapshot)

        # Do NOT delete snapshots for answers that no longer exist —
        # that's exactly the scenario we want to detect.

        db.commit()

    @staticmethod
    def verify_persistence(
        db: Session,
        session_id: int,
        user_id: int
    ) -> Dict[str, Any]:
        """
        Verify that all answer snapshots still match the actual session_answers.

        Args:
            db: Database session
            session_id: Session ID
            user_id: User ID

        Returns:
            Dict with 'ok' bool and 'mismatches' list of problem details
        """
        session = SessionService.get_session(db, session_id, user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )

        # Get all snapshots for this session
        snapshots = db.query(AnswerSnapshot).filter(
            AnswerSnapshot.session_id == session_id
        ).all()

        if not snapshots:
            return {"ok": True, "mismatches": [], "snapshot_count": 0}

        # Get all current answers for this session
        current_answers = db.query(SessionAnswer).filter(
            SessionAnswer.session_id == session_id
        ).all()
        answer_map = {a.question_id: a.answer_value for a in current_answers}

        # Build question lookup for identifiers
        snapshot_qids = [s.question_id for s in snapshots]
        questions = db.query(Question).filter(
            Question.id.in_(snapshot_qids)
        ).all()
        question_map = {q.id: q for q in questions}

        mismatches = []
        for snap in snapshots:
            current_value = answer_map.get(snap.question_id)
            q = question_map.get(snap.question_id)
            q_identifier = q.identifier if q else f"question_{snap.question_id}"

            if current_value is None:
                mismatches.append({
                    "question_id": snap.question_id,
                    "identifier": q_identifier,
                    "issue": "missing",
                    "expected": snap.answer_value,
                    "actual": None,
                    "saved_at": snap.saved_at.isoformat()
                })
            elif current_value != snap.answer_value:
                mismatches.append({
                    "question_id": snap.question_id,
                    "identifier": q_identifier,
                    "issue": "value_changed",
                    "expected": snap.answer_value,
                    "actual": current_value,
                    "saved_at": snap.saved_at.isoformat()
                })

        return {
            "ok": len(mismatches) == 0,
            "mismatches": mismatches,
            "snapshot_count": len(snapshots)
        }

    @staticmethod
    def mark_session_complete(
        db: Session,
        session_id: int,
        user_id: int
    ) -> InputForm:
        """
        Mark a session as completed.

        Args:
            db: Database session
            session_id: Session ID to mark as complete
            user_id: User ID

        Returns:
            Updated InputForm
        """
        session = SessionService.get_session(db, session_id, user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )

        # Toggle completion status
        if session.is_completed:
            session.is_completed = False
            session.completed_at = None
        else:
            session.is_completed = True
            session.completed_at = datetime.utcnow()

        db.commit()
        db.refresh(session)

        return session
