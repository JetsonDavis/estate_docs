"""Service layer for document session operations."""

from sqlalchemy.orm import Session
from typing import Optional, List, Tuple, Dict, Any
from fastapi import HTTPException, status
from datetime import datetime
import math

from ..models.session import InputForm, SessionAnswer
from ..models.question import QuestionGroup, Question
from ..models.flow import DocumentFlow, flow_question_groups
from ..schemas.session import (
    InputFormCreate,
    InputFormUpdate,
    SessionAnswerCreate,
    QuestionToDisplay,
    SessionQuestionsResponse
)


def generate_copy_name(original_name: str, existing_names: List[str]) -> str:
    """
    Generate a macOS-style copy name for client identifiers.
    - "Original" -> "Original copy"
    - "Original copy" -> "Original copy copy"
    - "Original copy copy" -> "Original copy copy copy"
    """
    base_name = original_name
    copy_suffix = " copy"

    # Start with "name copy"
    new_name = f"{base_name}{copy_suffix}"

    # If that exists, keep adding " copy" until we find a unique name
    while new_name in existing_names:
        new_name = f"{new_name}{copy_suffix}"

    return new_name


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
                            elif operator in ('count_greater_than', 'count_equals', 'count_less_than'):
                                # Count operators for repeatable fields - parse JSON array and compare length
                                try:
                                    import json
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
        # Returns tuple of (questions_with_data, repeatable_followups)
        questions_with_data, repeatable_followups = SessionService._get_questions_from_logic(
            db, current_group, existing_answers
        )

        # Paginate questions
        total_questions = len(questions_with_data)
        total_pages = max(1, math.ceil(total_questions / questions_per_page))
        page = max(1, min(page, total_pages))

        start_idx = (page - 1) * questions_per_page
        end_idx = start_idx + questions_per_page
        paginated_questions = questions_with_data[start_idx:end_idx]

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
            )

        question_responses = []
        for q, depth, hierarchical_number in paginated_questions:
            # Build conditional_followups if this repeatable question has them
            cond_followups = None
            if q.id in repeatable_followups:
                cond_followups = []
                for fu in repeatable_followups[q.id]:
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
    ) -> tuple:
        """
        Get questions to display based on question_logic.
        Evaluates conditionals and respects stop flags.

        Returns:
            Tuple of (questions_with_data, repeatable_followups)
            - questions_with_data: List of (question, depth, hierarchical_number) tuples
            - repeatable_followups: Dict mapping question_id -> list of {trigger_value, operator, questions}
              for repeatable questions that have conditional follow-ups
        """
        import logging
        import json
        logger = logging.getLogger(__name__)

        logger.info(f"_get_questions_from_logic called for group {group.id} ({group.name})")
        logger.info(f"question_logic: {group.question_logic}")
        logger.info(f"existing_answers: {existing_answers}")

        if not group.question_logic:
            # No logic defined - return all questions in order with depth 0
            logger.info("No question_logic defined, returning all questions")
            questions = db.query(Question).filter(
                Question.question_group_id == group.id,
                Question.is_active == True
            ).order_by(Question.display_order).all()
            return [(q, 0, str(i + 1)) for i, q in enumerate(questions)], {}

        questions_with_data = []  # List of (question, depth, hierarchical_number) tuples
        question_ids_added = set()  # Track which question IDs have been added
        # Track repeatable question identifiers (both namespaced and stripped)
        repeatable_identifier_to_question_id = {}
        # Conditional follow-ups for repeatable questions: {question_id: [{trigger_value, operator, questions}]}
        repeatable_followups = {}
        
        # Build answer map by identifier
        # Store both namespaced and non-namespaced versions for compatibility
        answer_by_identifier = {}
        for q_id, answer in existing_answers.items():
            question = db.query(Question).filter(Question.id == q_id).first()
            if question:
                # Store with full namespaced identifier
                answer_by_identifier[question.identifier] = answer
                # Also store with stripped identifier (without namespace prefix)
                if '.' in question.identifier:
                    stripped_identifier = question.identifier.split('.', 1)[1]
                    answer_by_identifier[stripped_identifier] = answer

        logger.info(f"answer_by_identifier: {answer_by_identifier}")
        
        # Pre-scan logic to find repeatable question identifiers
        def find_repeatable_identifiers(items: List[Dict]):
            for item in items:
                if item.get('type') == 'question':
                    qid = item.get('questionId')
                    if qid:
                        q = db.query(Question).filter(Question.id == qid, Question.is_active == True).first()
                        if q and q.repeatable:
                            repeatable_identifier_to_question_id[q.identifier] = q.id
                            if '.' in q.identifier:
                                stripped = q.identifier.split('.', 1)[1]
                                repeatable_identifier_to_question_id[stripped] = q.id
                elif item.get('type') == 'conditional' and item.get('conditional'):
                    nested = item['conditional'].get('nestedItems', [])
                    if nested:
                        find_repeatable_identifiers(nested)
        
        find_repeatable_identifiers(group.question_logic)
        logger.info(f"Repeatable identifiers: {repeatable_identifier_to_question_id}")

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
                        q = db.query(Question).filter(Question.id == qid, Question.is_active == True).first()
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
                        q = db.query(Question).filter(Question.id == qid, Question.is_active == True).first()
                        if q:
                            collected.append((q, sub_followups_map.get(q.id)))
            return collected

        def process_logic_items(items: List[Dict], depth: int = 0, number_prefix: str = "") -> bool:
            """Process logic items. Returns False if stop flag encountered."""
            indent = "  " * depth
            logger.info(f"{indent}Processing {len(items)} logic items at depth {depth}")

            question_counter = 0  # Counter for ALL questions at this level (logical position)
            last_question_number = number_prefix  # Track the last question's number for nested items

            for idx, item in enumerate(items):
                logger.info(f"{indent}Item {idx}: type={item.get('type')}, questionId={item.get('questionId')}")

                if item.get('type') == 'question':
                    question_id = item.get('questionId')
                    # Always increment counter to maintain logical position numbering (matches admin view)
                    question_counter += 1
                    hierarchical_number = f"{number_prefix}-{question_counter}" if number_prefix else str(question_counter)
                    last_question_number = hierarchical_number  # Remember this for conditionals

                    if question_id:
                        question = db.query(Question).filter(
                            Question.id == question_id,
                            Question.is_active == True
                        ).first()
                        # Only add to result if found, active, and not already added
                        if question and question.id not in question_ids_added:
                            logger.info(f"{indent}  Adding question: {question.identifier} (id={question.id}, depth={depth}, number={hierarchical_number})")
                            questions_with_data.append((question, depth, hierarchical_number))
                            question_ids_added.add(question.id)
                        elif not question:
                            logger.warning(f"{indent}  Question with id {question_id} not found or inactive (but counted as position {hierarchical_number})")
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

                    # Check if this conditional depends on a repeatable question
                    # If so, collect the follow-up questions as metadata for per-instance rendering
                    if identifier and identifier in repeatable_identifier_to_question_id:
                        parent_q_id = repeatable_identifier_to_question_id[identifier]
                        nested_items = cond.get('nestedItems', [])
                        followup_questions = collect_nested_questions(nested_items)
                        
                        if followup_questions:
                            if parent_q_id not in repeatable_followups:
                                repeatable_followups[parent_q_id] = []
                            repeatable_followups[parent_q_id].append({
                                'trigger_value': expected_value,
                                'operator': operator,
                                'questions': followup_questions
                            })
                            logger.info(f"{indent}  Collected {len(followup_questions)} follow-up questions for repeatable q_id={parent_q_id}, trigger='{expected_value}'")
                        
                        # Still evaluate and add to flat list for backwards compatibility
                        # (non-repeatable rendering paths still need them)
                        # But mark them so the frontend knows they're also in conditional_followups

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
                            # For repeatable questions, check if none of the array elements match
                            try:
                                parsed = json.loads(actual_value)
                                if isinstance(parsed, list):
                                    condition_met = expected_value not in parsed
                                else:
                                    condition_met = actual_value != expected_value
                            except (json.JSONDecodeError, TypeError, ValueError):
                                condition_met = actual_value != expected_value
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
                            
                            logger.info(f"{indent}  Count comparison: {count} {operator} {threshold} = {condition_met}")
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
                                    logger.info(f"{indent}  Array comparison: '{expected_value}' in {parsed} = {condition_met}")
                                else:
                                    condition_met = actual_value == expected_value
                            except (json.JSONDecodeError, TypeError, ValueError):
                                condition_met = actual_value == expected_value
                        
                        if condition_met:
                            logger.info(f"{indent}  Condition MET - processing nested items")
                            # Condition met - process nested items
                            # Skip adding to flat list if this is a repeatable follow-up
                            # (frontend will render per-instance using conditional_followups)
                            if identifier in repeatable_identifier_to_question_id:
                                logger.info(f"{indent}  Skipping flat list addition (repeatable follow-up)")
                            else:
                                nested_items = cond.get('nestedItems', [])
                                if nested_items:
                                    # Use the last question number at this level as prefix for nested questions
                                    # This matches the admin view's numbering logic
                                    nested_prefix = last_question_number
                                    should_continue = process_logic_items(nested_items, depth + 1, nested_prefix)
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
        logger.info(f"Final questions to display: {[(q.identifier, d, h) for q, d, h in questions_with_data]}")
        logger.info(f"Repeatable followups: {repeatable_followups}")
        return questions_with_data, repeatable_followups
    
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
