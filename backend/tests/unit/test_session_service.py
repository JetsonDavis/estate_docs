"""Unit tests for session service."""

import pytest
from unittest.mock import Mock, patch
from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime

from src.services.session_service import SessionService
from src.models.session import InputForm, SessionAnswer
from src.models.question import QuestionGroup, Question
from src.schemas.session import InputFormCreate, SessionAnswerCreate


class TestSessionService:
    """Test suite for SessionService."""

    def test_create_session_success(self, db_session: Session, sample_question_group):
        """Test successful session creation."""
        session_data = InputFormCreate(
            client_identifier="John Doe",
            starting_group_id=sample_question_group.id
        )

        session = SessionService.create_session(db_session, session_data, 1)

        assert session.client_identifier == "John Doe"
        assert session.user_id == 1
        assert session.current_group_id == sample_question_group.id
        assert session.is_completed is False

    def test_create_session_default_starting_group(self, db_session: Session, sample_question_group):
        """Test session creation with default starting group."""
        session_data = InputFormCreate(
            client_identifier="Jane Doe"
        )

        session = SessionService.create_session(db_session, session_data, 1)

        assert session.current_group_id == sample_question_group.id

    def test_create_session_no_groups_available(self, db_session: Session):
        """Test session creation when no question groups exist."""
        session_data = InputFormCreate(
            client_identifier="Test Client"
        )

        with pytest.raises(HTTPException) as exc_info:
            SessionService.create_session(db_session, session_data, 1)

        assert exc_info.value.status_code == 400
        assert "No question groups available" in str(exc_info.value.detail)

    def test_get_session_success(self, db_session: Session, sample_session):
        """Test getting a session by ID."""
        retrieved = SessionService.get_session(db_session, sample_session.id, sample_session.user_id)

        assert retrieved is not None
        assert retrieved.id == sample_session.id
        assert retrieved.client_identifier == sample_session.client_identifier

    def test_get_session_wrong_user(self, db_session: Session, sample_session):
        """Test getting a session with wrong user ID."""
        retrieved = SessionService.get_session(db_session, sample_session.id, 999)

        assert retrieved is None

    def test_list_sessions(self, db_session: Session, sample_question_group):
        """Test listing sessions for a user."""
        # Create multiple sessions
        for i in range(3):
            session_data = InputFormCreate(
                client_identifier=f"Client {i}",
                starting_group_id=sample_question_group.id
            )
            SessionService.create_session(db_session, session_data, 1)

        sessions, total = SessionService.list_sessions(db_session, 1)

        assert total == 3
        assert len(sessions) == 3

    def test_list_sessions_pagination(self, db_session: Session, sample_question_group):
        """Test listing sessions with pagination."""
        # Create 5 sessions
        for i in range(5):
            session_data = InputFormCreate(
                client_identifier=f"Client {i}",
                starting_group_id=sample_question_group.id
            )
            SessionService.create_session(db_session, session_data, 1)

        sessions, total = SessionService.list_sessions(db_session, 1, skip=0, limit=2)

        assert total == 5
        assert len(sessions) == 2

    def test_submit_answers_success(self, db_session: Session, sample_session, sample_questions):
        """Test submitting answers successfully."""
        answers = [
            SessionAnswerCreate(question_id=sample_questions[0].id, answer_value="Answer 1"),
            SessionAnswerCreate(question_id=sample_questions[1].id, answer_value="Answer 2")
        ]

        updated_session = SessionService.submit_answers(
            db_session,
            sample_session.id,
            sample_session.user_id,
            answers
        )

        assert updated_session is not None
        # Check answers were saved
        saved_answers = db_session.query(SessionAnswer).filter(
            SessionAnswer.session_id == sample_session.id
        ).all()
        assert len(saved_answers) == 2

    def test_submit_answers_session_not_found(self, db_session: Session):
        """Test submitting answers to non-existent session."""
        answers = [SessionAnswerCreate(question_id=1, answer_value="Test")]

        with pytest.raises(HTTPException) as exc_info:
            SessionService.submit_answers(db_session, 999, 1, answers)

        assert exc_info.value.status_code == 404

    def test_submit_answers_already_completed(self, db_session: Session, sample_session, sample_questions):
        """Test submitting answers to completed session is allowed (for editing)."""
        sample_session.is_completed = True
        sample_session.completed_at = datetime.utcnow()
        db_session.commit()

        answers = [SessionAnswerCreate(question_id=sample_questions[0].id, answer_value="Edited")]

        updated_session = SessionService.submit_answers(
            db_session,
            sample_session.id,
            sample_session.user_id,
            answers
        )

        assert updated_session is not None
        saved = db_session.query(SessionAnswer).filter(
            SessionAnswer.session_id == sample_session.id,
            SessionAnswer.question_id == sample_questions[0].id
        ).first()
        assert saved is not None
        assert saved.answer_value == "Edited"

    def test_submit_answers_update_existing(self, db_session: Session, sample_session, sample_questions):
        """Test updating existing answers."""
        # Submit initial answer
        initial_answer = SessionAnswer(
            session_id=sample_session.id,
            question_id=sample_questions[0].id,
            answer_value="Initial Answer"
        )
        db_session.add(initial_answer)
        db_session.commit()

        # Update the answer
        answers = [
            SessionAnswerCreate(question_id=sample_questions[0].id, answer_value="Updated Answer")
        ]

        SessionService.submit_answers(
            db_session,
            sample_session.id,
            sample_session.user_id,
            answers
        )

        # Verify answer was updated
        updated_answer = db_session.query(SessionAnswer).filter(
            SessionAnswer.session_id == sample_session.id,
            SessionAnswer.question_id == sample_questions[0].id
        ).first()

        assert updated_answer.answer_value == "Updated Answer"

    def test_conditional_flow_navigation(self, db_session: Session, sample_session_with_flow, sample_questions):
        """Test conditional flow navigation based on answers."""
        # Answer that triggers conditional flow
        answers = [
            SessionAnswerCreate(question_id=sample_questions[0].id, answer_value="Male")
        ]

        updated_session = SessionService.submit_answers(
            db_session,
            sample_session_with_flow.id,
            sample_session_with_flow.user_id,
            answers
        )

        # Since there's no next group, session should complete
        assert updated_session.is_completed is True

    def test_default_flow_navigation(self, db_session: Session, sample_session, sample_questions):
        """Test default flow navigation when no condition matches."""
        answers = [
            SessionAnswerCreate(question_id=sample_questions[0].id, answer_value="Other")
        ]

        updated_session = SessionService.submit_answers(
            db_session,
            sample_session.id,
            sample_session.user_id,
            answers
        )

        # Should complete since there's no next group
        assert updated_session.is_completed is True

    def test_session_completion(self, db_session: Session, sample_session_last_group, sample_questions):
        """Test session completion when no next group."""
        answers = [
            SessionAnswerCreate(question_id=sample_questions[0].id, answer_value="Final Answer")
        ]

        updated_session = SessionService.submit_answers(
            db_session,
            sample_session_last_group.id,
            sample_session_last_group.user_id,
            answers
        )

        assert updated_session.is_completed is True
        assert updated_session.completed_at is not None

    def test_get_session_answers(self, db_session: Session, sample_session, sample_questions):
        """Test getting all answers for a session."""
        # Create some answers
        for i, question in enumerate(sample_questions):
            answer = SessionAnswer(
                session_id=sample_session.id,
                question_id=question.id,
                answer_value=f"Answer {i}"
            )
            db_session.add(answer)
        db_session.commit()

        answers = SessionService.get_session_answers(
            db_session,
            sample_session.id,
            sample_session.user_id
        )

        assert len(answers) == len(sample_questions)

    def test_delete_session_success(self, db_session: Session, sample_session):
        """Test deleting a session."""
        success = SessionService.delete_session(
            db_session,
            sample_session.id,
            sample_session.user_id
        )

        assert success is True

        # Verify session is deleted
        deleted = db_session.query(InputForm).filter(
            InputForm.id == sample_session.id
        ).first()
        assert deleted is None

    def test_delete_session_not_found(self, db_session: Session):
        """Test deleting non-existent session."""
        success = SessionService.delete_session(db_session, 999, 1)
        assert success is False


class TestHierarchicalNumbering:
    """Test suite for hierarchical numbering in _get_questions_from_logic.

    Regression tests for the bug where conditionals far from their triggering
    question used last_question_number as prefix instead of the trigger's number,
    causing follow-ups like '6-1' instead of '2-2' inside repeatable blocks.
    """

    def _make_question(self, db_session, group, identifier, text, qtype="free_text",
                       repeatable=False, repeatable_group_id=None, options=None):
        """Helper to create a question in the group."""
        q = Question(
            question_group_id=group.id,
            identifier=identifier,
            question_text=text,
            question_type=qtype,
            display_order=1,
            is_required=False,
            repeatable=repeatable,
            repeatable_group_id=repeatable_group_id,
            options=options,
        )
        db_session.add(q)
        db_session.flush()
        return q

    def test_conditional_far_from_trigger_uses_trigger_number(self, db_session):
        """Conditionals referencing a question far earlier in the logic list
        should number nested items relative to the trigger, not the last question.

        Layout mirrors the Diane Schatz bug:
          Q1 (trustor, repeatable)
          Q2 (trustor_living, repeatable)
          IF trustor_living=no -> Q_dod            (should be 2-1)
          Q3 (trust_name)
          Q4 (trust_date)
          Q5 (has_restated)
          Q6 (amend_clause)
          IF trustor_living=no -> Q_death_clause   (should be 2-2, NOT 6-1)
        """
        group = QuestionGroup(
            name="Test Numbering",
            identifier="test_numbering_far_cond",
            display_order=1,
        )
        db_session.add(group)
        db_session.flush()

        rep_grp = "rep-group-1"
        q1 = self._make_question(db_session, group, "trustor", "Trustor?",
                                 qtype="person", repeatable=True, repeatable_group_id=rep_grp)
        q2 = self._make_question(db_session, group, "trustor_living", "Living?",
                                 qtype="multiple_choice", repeatable=True,
                                 repeatable_group_id=rep_grp,
                                 options=[{"value": "yes", "label": "Yes"},
                                          {"value": "no", "label": "No"}])
        q_dod = self._make_question(db_session, group, "trustor_dod", "Date of death?")
        q3 = self._make_question(db_session, group, "trust_name", "Trust name?")
        q4 = self._make_question(db_session, group, "trust_date", "Trust date?")
        q5 = self._make_question(db_session, group, "has_restated", "Restated?",
                                 qtype="multiple_choice",
                                 options=[{"value": "yes", "label": "Yes"},
                                          {"value": "no", "label": "No"}])
        q6 = self._make_question(db_session, group, "amend_clause", "What clause?")
        q_death_clause = self._make_question(db_session, group, "death_clause",
                                             "Surviving trustor clause?")
        db_session.flush()

        group.question_logic = [
            {"type": "question", "questionId": q1.id},
            {"type": "question", "questionId": q2.id},
            # First conditional right after trigger — should number as 2-X
            {"type": "conditional", "conditional": {
                "ifIdentifier": "trustor_living", "value": "no",
                "nestedItems": [
                    {"type": "question", "questionId": q_dod.id},
                ],
            }},
            {"type": "question", "questionId": q3.id},
            {"type": "question", "questionId": q4.id},
            {"type": "question", "questionId": q5.id},
            {"type": "question", "questionId": q6.id},
            # Second conditional far from trigger — should ALSO number as 2-X (continuing)
            {"type": "conditional", "conditional": {
                "ifIdentifier": "trustor_living", "value": "no",
                "nestedItems": [
                    {"type": "question", "questionId": q_death_clause.id},
                ],
            }},
        ]
        db_session.commit()

        questions_with_data, _, question_numbers, _ = SessionService._get_questions_from_logic(
            db_session, group, {}
        )

        # Core assertions: top-level numbering
        assert question_numbers[q1.id] == "1"
        assert question_numbers[q2.id] == "2"
        assert question_numbers[q3.id] == "3"
        assert question_numbers[q4.id] == "4"
        assert question_numbers[q5.id] == "5"
        assert question_numbers[q6.id] == "6"

        # First conditional follow-up of trustor_living: numbered under "2"
        assert question_numbers[q_dod.id] == "2-1"

        # Second conditional follow-up of trustor_living: MUST continue under "2"
        # Before the fix this was incorrectly "6-1"
        assert question_numbers[q_death_clause.id] == "2-2"

    def test_multiple_conditionals_same_trigger_continue_numbering(self, db_session):
        """Multiple conditional blocks referencing the same trigger should
        continue incrementing the sub-number, not restart at 1."""
        group = QuestionGroup(
            name="Test Multi Cond",
            identifier="test_multi_cond",
            display_order=1,
        )
        db_session.add(group)
        db_session.flush()

        q_main = self._make_question(db_session, group, "color", "Favorite color?",
                                     qtype="multiple_choice",
                                     options=[{"value": "red", "label": "Red"},
                                              {"value": "blue", "label": "Blue"}])
        q_red1 = self._make_question(db_session, group, "shade_red", "What shade of red?")
        q_filler = self._make_question(db_session, group, "filler", "Unrelated question?")
        q_red2 = self._make_question(db_session, group, "why_red", "Why red?")
        db_session.flush()

        group.question_logic = [
            {"type": "question", "questionId": q_main.id},
            {"type": "conditional", "conditional": {
                "ifIdentifier": "color", "value": "red",
                "nestedItems": [
                    {"type": "question", "questionId": q_red1.id},
                ],
            }},
            {"type": "question", "questionId": q_filler.id},
            # Second conditional for same trigger, after intervening question
            {"type": "conditional", "conditional": {
                "ifIdentifier": "color", "value": "red",
                "nestedItems": [
                    {"type": "question", "questionId": q_red2.id},
                ],
            }},
        ]
        db_session.commit()

        _, _, question_numbers, _ = SessionService._get_questions_from_logic(
            db_session, group, {}
        )

        assert question_numbers[q_main.id] == "1"
        assert question_numbers[q_red1.id] == "1-1"
        assert question_numbers[q_filler.id] == "2"
        # Must be 1-2, not 2-1
        assert question_numbers[q_red2.id] == "1-2"

    def test_nested_sub_conditionals_number_correctly(self, db_session):
        """Conditionals nested inside other conditionals should number
        relative to their own trigger question."""
        group = QuestionGroup(
            name="Test Nested Sub",
            identifier="test_nested_sub",
            display_order=1,
        )
        db_session.add(group)
        db_session.flush()

        q_parent = self._make_question(db_session, group, "parent_q", "Parent?",
                                       qtype="multiple_choice",
                                       options=[{"value": "yes", "label": "Yes"}])
        q_child = self._make_question(db_session, group, "child_q", "Child?",
                                      qtype="multiple_choice",
                                      options=[{"value": "Other", "label": "Other"}])
        q_grandchild = self._make_question(db_session, group, "grandchild_q", "Details?")
        db_session.flush()

        group.question_logic = [
            {"type": "question", "questionId": q_parent.id},
            {"type": "conditional", "conditional": {
                "ifIdentifier": "parent_q", "value": "yes",
                "nestedItems": [
                    {"type": "question", "questionId": q_child.id},
                    {"type": "conditional", "conditional": {
                        "ifIdentifier": "child_q", "value": "Other",
                        "nestedItems": [
                            {"type": "question", "questionId": q_grandchild.id},
                        ],
                    }},
                ],
            }},
        ]
        db_session.commit()

        _, _, question_numbers, _ = SessionService._get_questions_from_logic(
            db_session, group, {}
        )

        assert question_numbers[q_parent.id] == "1"
        assert question_numbers[q_child.id] == "1-1"
        assert question_numbers[q_grandchild.id] == "1-1-1"

    def test_amendment_pattern_no_duplicate_numbers(self, db_session):
        """Mimics the amendment repeatable block where multiple conditional
        blocks under the same trigger should not produce duplicate numbers.

        Layout:
          Q7 (amendment_number, repeatable)
          Q8 (amendment_type, repeatable)
          IF amendment_type=Update SSTEE -> Q_sstee_title    (8-1)
          IF amendment_type=Update SSTEE -> Q_new_sstee      (8-2, NOT duplicate 8-1)
                                            Q_sstee_relation (8-3)
        """
        group = QuestionGroup(
            name="Test Amend Pattern",
            identifier="test_amend_pattern",
            display_order=1,
        )
        db_session.add(group)
        db_session.flush()

        rep_grp = "amend-group"
        q7 = self._make_question(db_session, group, "amend_num", "Amendment number?",
                                 repeatable=True, repeatable_group_id=rep_grp)
        q8 = self._make_question(db_session, group, "amend_type", "Amendment type?",
                                 qtype="multiple_choice", repeatable=True,
                                 repeatable_group_id=rep_grp,
                                 options=[{"value": "Update SSTEE", "label": "Update SSTEE"}])
        q_title = self._make_question(db_session, group, "sstee_title", "SSTEE section title?")
        q_new = self._make_question(db_session, group, "new_sstee", "New trustees?",
                                    qtype="person", repeatable=True,
                                    repeatable_group_id="sstee-sub-group")
        q_rel = self._make_question(db_session, group, "sstee_rel", "Relation to trustor?",
                                    repeatable=True, repeatable_group_id="sstee-sub-group")
        db_session.flush()

        group.question_logic = [
            {"type": "question", "questionId": q7.id},
            {"type": "question", "questionId": q8.id},
            {"type": "conditional", "conditional": {
                "ifIdentifier": "amend_type", "value": "Update SSTEE",
                "nestedItems": [
                    {"type": "question", "questionId": q_title.id},
                ],
            }},
            {"type": "conditional", "conditional": {
                "ifIdentifier": "amend_type", "value": "Update SSTEE",
                "nestedItems": [
                    {"type": "question", "questionId": q_new.id},
                    {"type": "question", "questionId": q_rel.id},
                ],
            }},
        ]
        db_session.commit()

        _, _, question_numbers, _ = SessionService._get_questions_from_logic(
            db_session, group, {}
        )

        assert question_numbers[q7.id] == "1"
        assert question_numbers[q8.id] == "2"
        assert question_numbers[q_title.id] == "2-1"
        # These must continue from 2-1, not restart at 2-1
        assert question_numbers[q_new.id] == "2-2"
        assert question_numbers[q_rel.id] == "2-3"

        # Verify no duplicate hierarchical numbers
        all_numbers = list(question_numbers.values())
        assert len(all_numbers) == len(set(all_numbers)), \
            f"Duplicate hierarchical numbers found: {all_numbers}"


class TestAnyNoneOperators:
    """Tests for IF ANY / IF NONE conditional operators on repeatable groups."""

    def _make_question(self, db_session, group, identifier, text, qtype="free_text",
                       repeatable=False, repeatable_group_id=None, options=None):
        q = Question(
            question_group_id=group.id,
            identifier=identifier,
            question_text=text,
            question_type=qtype,
            display_order=1,
            is_required=False,
            repeatable=repeatable,
            repeatable_group_id=repeatable_group_id,
            options=options,
        )
        db_session.add(q)
        db_session.flush()
        return q

    def _setup_any_none_scenario(self, db_session):
        """Create a repeatable question with an any_equals and none_equals conditional.

        Layout:
          Q1 (color, repeatable, multiple_choice: red/blue/green)
          IF ANY color = red  -> Q_red_msg
          IF NONE color = blue -> Q_no_blue_msg
        """
        group = QuestionGroup(
            name="Test Any None",
            identifier="test_any_none",
            display_order=1,
        )
        db_session.add(group)
        db_session.flush()

        q_color = self._make_question(
            db_session, group, "color", "Favorite color?",
            qtype="multiple_choice", repeatable=True, repeatable_group_id="color-group",
            options=[{"value": "red", "label": "Red"},
                     {"value": "blue", "label": "Blue"},
                     {"value": "green", "label": "Green"}],
        )
        q_red_msg = self._make_question(db_session, group, "red_msg", "Someone picked red!")
        q_no_blue_msg = self._make_question(db_session, group, "no_blue_msg", "Nobody picked blue!")
        db_session.flush()

        group.question_logic = [
            {"type": "question", "questionId": q_color.id},
            {"type": "conditional", "conditional": {
                "ifIdentifier": "color", "operator": "any_equals", "value": "red",
                "nestedItems": [{"type": "question", "questionId": q_red_msg.id}],
            }},
            {"type": "conditional", "conditional": {
                "ifIdentifier": "color", "operator": "none_equals", "value": "blue",
                "nestedItems": [{"type": "question", "questionId": q_no_blue_msg.id}],
            }},
        ]
        db_session.commit()
        return group, q_color, q_red_msg, q_no_blue_msg

    def test_any_equals_matches_when_present(self, db_session):
        """any_equals should show nested questions when at least one instance matches."""
        group, q_color, q_red_msg, _ = self._setup_any_none_scenario(db_session)

        # Answers: ["red", "green"] — "red" is present
        existing_answers = {q_color.id: '["red", "green"]'}
        questions_with_data, _, _, _ = SessionService._get_questions_from_logic(
            db_session, group, existing_answers
        )
        displayed_ids = [q.id for q, _, _ in questions_with_data]
        assert q_red_msg.id in displayed_ids

    def test_any_equals_hidden_when_absent(self, db_session):
        """any_equals should hide nested questions when no instance matches."""
        group, q_color, q_red_msg, _ = self._setup_any_none_scenario(db_session)

        # Answers: ["blue", "green"] — "red" is NOT present
        existing_answers = {q_color.id: '["blue", "green"]'}
        questions_with_data, _, _, _ = SessionService._get_questions_from_logic(
            db_session, group, existing_answers
        )
        displayed_ids = [q.id for q, _, _ in questions_with_data]
        assert q_red_msg.id not in displayed_ids

    def test_none_equals_matches_when_absent(self, db_session):
        """none_equals should show nested questions when NO instance matches."""
        group, q_color, _, q_no_blue_msg = self._setup_any_none_scenario(db_session)

        # Answers: ["red", "green"] — "blue" is NOT present
        existing_answers = {q_color.id: '["red", "green"]'}
        questions_with_data, _, _, _ = SessionService._get_questions_from_logic(
            db_session, group, existing_answers
        )
        displayed_ids = [q.id for q, _, _ in questions_with_data]
        assert q_no_blue_msg.id in displayed_ids

    def test_none_equals_hidden_when_present(self, db_session):
        """none_equals should hide nested questions when any instance matches."""
        group, q_color, _, q_no_blue_msg = self._setup_any_none_scenario(db_session)

        # Answers: ["blue", "green"] — "blue" IS present
        existing_answers = {q_color.id: '["blue", "green"]'}
        questions_with_data, _, _, _ = SessionService._get_questions_from_logic(
            db_session, group, existing_answers
        )
        displayed_ids = [q.id for q, _, _ in questions_with_data]
        assert q_no_blue_msg.id not in displayed_ids

    def test_any_equals_single_value_fallback(self, db_session):
        """any_equals should work with a plain (non-JSON) scalar answer."""
        group, q_color, q_red_msg, _ = self._setup_any_none_scenario(db_session)

        existing_answers = {q_color.id: 'red'}
        questions_with_data, _, _, _ = SessionService._get_questions_from_logic(
            db_session, group, existing_answers
        )
        displayed_ids = [q.id for q, _, _ in questions_with_data]
        assert q_red_msg.id in displayed_ids

    def test_none_equals_single_value_fallback(self, db_session):
        """none_equals should work with a plain (non-JSON) scalar answer."""
        group, q_color, _, q_no_blue_msg = self._setup_any_none_scenario(db_session)

        # "red" is not "blue", so none_equals blue should be True
        existing_answers = {q_color.id: 'red'}
        questions_with_data, _, _, _ = SessionService._get_questions_from_logic(
            db_session, group, existing_answers
        )
        displayed_ids = [q.id for q, _, _ in questions_with_data]
        assert q_no_blue_msg.id in displayed_ids


@pytest.fixture
def sample_question_group(db_session):
    """Create a sample question group."""
    group = QuestionGroup(
        name="Test Group",
        description="Test Description",
        identifier="test_group",
        display_order=1
    )
    db_session.add(group)
    db_session.commit()
    db_session.refresh(group)
    return group


@pytest.fixture
def sample_questions(db_session, sample_question_group):
    """Create sample questions."""
    questions = []
    for i in range(3):
        question = Question(
            question_group_id=sample_question_group.id,
            identifier=f"test_q{i}",
            question_text=f"Test Question {i}",
            question_type="free_text",
            display_order=i,
            is_required=True
        )
        db_session.add(question)
        questions.append(question)

    db_session.commit()
    for q in questions:
        db_session.refresh(q)

    return questions


@pytest.fixture
def sample_session(db_session, sample_question_group):
    """Create a sample session."""
    session = InputForm(
        client_identifier="Test Client",
        user_id=1,
        current_group_id=sample_question_group.id,
        is_completed=False
    )
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)
    return session


@pytest.fixture
def sample_session_with_flow(db_session, sample_question_group, sample_questions):
    """Create a session with conditional flow."""
    # Add question logic to group
    sample_question_group.question_logic = [
        {
            "type": "question",
            "questionId": sample_questions[0].id
        },
        {
            "type": "conditional",
            "conditional": {
                "ifIdentifier": sample_questions[0].identifier,
                "value": "Male",
                "nestedItems": [
                    {"type": "question", "questionId": sample_questions[1].id}
                ]
            }
        }
    ]
    db_session.commit()

    session = InputForm(
        client_identifier="Flow Test Client",
        user_id=1,
        current_group_id=sample_question_group.id,
        is_completed=False
    )
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)
    return session


@pytest.fixture
def sample_session_last_group(db_session, sample_question_group):
    """Create a session on the last group (no next group)."""
    sample_question_group.next_group_id = None
    db_session.commit()

    session = InputForm(
        client_identifier="Last Group Client",
        user_id=1,
        current_group_id=sample_question_group.id,
        is_completed=False
    )
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)
    return session
