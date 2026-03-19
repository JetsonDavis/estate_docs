"""Unit tests for question service - simulating real user interactions with the Question Group UI.

These tests simulate various user workflows when creating and editing question groups,
including adding questions, deleting questions, inserting conditionals, reordering, etc.
"""

import pytest
from unittest.mock import Mock, patch
from sqlalchemy.orm import Session
from fastapi import HTTPException
from typing import List, Dict, Any

from src.services.question_service import QuestionGroupService, QuestionService
from src.models.question import QuestionGroup, Question, QuestionType
from src.schemas.question import (
    QuestionGroupCreate,
    QuestionGroupUpdate,
    QuestionCreate,
    QuestionUpdate,
    QuestionOption
)


# Helper functions to simulate UI operations
def create_question_logic_item(question_id: int, item_id: str = None) -> Dict[str, Any]:
    """Create a question logic item like the UI would."""
    return {
        "id": item_id or str(question_id),
        "type": "question",
        "questionId": question_id,
        "depth": 0
    }


def create_conditional_logic_item(
    item_id: str,
    if_identifier: str,
    operator: str,
    value: str,
    nested_items: List[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Create a conditional logic item like the UI would."""
    return {
        "id": item_id,
        "type": "conditional",
        "depth": 0,
        "conditional": {
            "ifIdentifier": if_identifier,
            "operator": operator,
            "value": value,
            "nestedItems": nested_items or []
        }
    }


def create_nested_question_item(question_id: int, item_id: str = None, depth: int = 1) -> Dict[str, Any]:
    """Create a nested question logic item."""
    return {
        "id": item_id or str(question_id),
        "type": "question",
        "questionId": question_id,
        "depth": depth
    }


class TestQuestionGroupService:
    """Test suite for QuestionGroupService."""

    def test_create_question_group_success(self, db_session: Session):
        """Test successful question group creation."""
        group_data = QuestionGroupCreate(
            name="Test Group",
            identifier="test_group",
            description="A test question group"
        )

        group = QuestionGroupService.create_question_group(db_session, group_data)

        assert group.name == "Test Group"
        assert group.identifier == "test_group"
        assert group.description == "A test question group"
        assert group.is_active == True

    def test_create_question_group_duplicate_identifier(self, db_session: Session):
        """Test that duplicate identifiers raise an error."""
        group_data = QuestionGroupCreate(
            name="Test Group",
            identifier="duplicate_id",
            description="First group"
        )
        QuestionGroupService.create_question_group(db_session, group_data)

        # Try to create another group with the same identifier
        group_data2 = QuestionGroupCreate(
            name="Another Group",
            identifier="duplicate_id",
            description="Second group"
        )

        with pytest.raises(HTTPException) as exc_info:
            QuestionGroupService.create_question_group(db_session, group_data2)

        assert exc_info.value.status_code == 400
        assert "already exists" in str(exc_info.value.detail)

    def test_get_question_group_by_id(self, db_session: Session):
        """Test getting a question group by ID."""
        group_data = QuestionGroupCreate(
            name="Findable Group",
            identifier="findable_group"
        )
        created = QuestionGroupService.create_question_group(db_session, group_data)

        found = QuestionGroupService.get_question_group_by_id(db_session, created.id)

        assert found is not None
        assert found.id == created.id
        assert found.name == "Findable Group"

    def test_get_question_group_by_id_not_found(self, db_session: Session):
        """Test getting a non-existent question group returns None."""
        found = QuestionGroupService.get_question_group_by_id(db_session, 99999)
        assert found is None

    def test_get_question_group_by_identifier(self, db_session: Session):
        """Test getting a question group by identifier."""
        group_data = QuestionGroupCreate(
            name="Identifiable Group",
            identifier="identifiable_group"
        )
        created = QuestionGroupService.create_question_group(db_session, group_data)

        found = QuestionGroupService.get_question_group_by_identifier(db_session, "identifiable_group")

        assert found is not None
        assert found.identifier == "identifiable_group"

    def test_list_question_groups(self, db_session: Session):
        """Test listing question groups."""
        # Create multiple groups
        for i in range(3):
            group_data = QuestionGroupCreate(
                name=f"Group {i}",
                identifier=f"group_{i}",
                display_order=i
            )
            QuestionGroupService.create_question_group(db_session, group_data)

        groups, total = QuestionGroupService.list_question_groups(db_session)

        assert total == 3
        assert len(groups) == 3

    def test_list_question_groups_pagination(self, db_session: Session):
        """Test listing question groups with pagination."""
        for i in range(5):
            group_data = QuestionGroupCreate(
                name=f"Group {i}",
                identifier=f"paginated_group_{i}",
                display_order=i
            )
            QuestionGroupService.create_question_group(db_session, group_data)

        groups, total = QuestionGroupService.list_question_groups(db_session, skip=2, limit=2)

        assert total == 5
        assert len(groups) == 2

    def test_update_question_group(self, db_session: Session):
        """Test updating a question group."""
        group_data = QuestionGroupCreate(
            name="Original Name",
            identifier="update_test"
        )
        created = QuestionGroupService.create_question_group(db_session, group_data)

        update_data = QuestionGroupUpdate(
            name="Updated Name",
            description="New description"
        )
        updated = QuestionGroupService.update_question_group(db_session, created.id, update_data)

        assert updated.name == "Updated Name"
        assert updated.description == "New description"
        assert updated.identifier == "update_test"  # Unchanged

    def test_update_question_group_not_found(self, db_session: Session):
        """Test updating a non-existent question group raises error."""
        update_data = QuestionGroupUpdate(name="New Name")

        with pytest.raises(HTTPException) as exc_info:
            QuestionGroupService.update_question_group(db_session, 99999, update_data)

        assert exc_info.value.status_code == 404

    def test_update_question_group_question_logic(self, db_session: Session):
        """Test updating question_logic field."""
        group_data = QuestionGroupCreate(
            name="Logic Test Group",
            identifier="logic_test"
        )
        created = QuestionGroupService.create_question_group(db_session, group_data)

        question_logic = [
            {"id": "1", "type": "question", "questionId": 1, "depth": 0},
            {"id": "2", "type": "conditional", "conditional": {
                "ifIdentifier": "q1",
                "operator": "equals",
                "value": "yes",
                "nestedItems": [
                    {"id": "3", "type": "question", "questionId": 2, "depth": 1}
                ]
            }, "depth": 0}
        ]

        update_data = QuestionGroupUpdate(question_logic=question_logic)
        updated = QuestionGroupService.update_question_group(db_session, created.id, update_data)

        assert updated.question_logic == question_logic
        assert len(updated.question_logic) == 2
        assert updated.question_logic[1]["type"] == "conditional"

    def test_delete_question_group(self, db_session: Session):
        """Test deleting a question group."""
        group_data = QuestionGroupCreate(
            name="Deletable Group",
            identifier="deletable_group"
        )
        created = QuestionGroupService.create_question_group(db_session, group_data)

        result = QuestionGroupService.delete_question_group(db_session, created.id)

        assert result == True
        assert QuestionGroupService.get_question_group_by_id(db_session, created.id) is None

    def test_delete_question_group_not_found(self, db_session: Session):
        """Test deleting a non-existent question group raises error."""
        with pytest.raises(HTTPException) as exc_info:
            QuestionGroupService.delete_question_group(db_session, 99999)

        assert exc_info.value.status_code == 404


class TestQuestionService:
    """Test suite for QuestionService."""

    @pytest.fixture
    def sample_group(self, db_session: Session):
        """Create a sample question group for testing."""
        group_data = QuestionGroupCreate(
            name="Sample Group",
            identifier="sample"
        )
        return QuestionGroupService.create_question_group(db_session, group_data)

    def test_create_question_success(self, db_session: Session, sample_group):
        """Test successful question creation."""
        question_data = QuestionCreate(
            question_group_id=sample_group.id,
            question_text="What is your name?",
            question_type=QuestionType.FREE_TEXT,
            identifier="name"
        )

        question = QuestionService.create_question(db_session, question_data)

        assert question.question_text == "What is your name?"
        assert question.question_type == QuestionType.FREE_TEXT
        assert question.identifier == "sample.name"  # Namespaced
        assert question.question_group_id == sample_group.id

    def test_create_question_with_options(self, db_session: Session, sample_group):
        """Test creating a multiple choice question with options."""
        question_data = QuestionCreate(
            question_group_id=sample_group.id,
            question_text="Choose a color",
            question_type=QuestionType.MULTIPLE_CHOICE,
            identifier="color",
            options=[
                QuestionOption(value="red", label="Red"),
                QuestionOption(value="blue", label="Blue"),
                QuestionOption(value="green", label="Green")
            ]
        )

        question = QuestionService.create_question(db_session, question_data)

        assert question.question_type == QuestionType.MULTIPLE_CHOICE
        assert len(question.options) == 3
        assert question.options[0]["value"] == "red"

    def test_create_question_repeatable(self, db_session: Session, sample_group):
        """Test creating a repeatable question."""
        question_data = QuestionCreate(
            question_group_id=sample_group.id,
            question_text="Enter beneficiary name",
            question_type=QuestionType.FREE_TEXT,
            identifier="beneficiary_name",
            repeatable=True
        )

        question = QuestionService.create_question(db_session, question_data)

        assert question.repeatable == True

    def test_create_question_with_repeatable_group_id(self, db_session: Session, sample_group):
        """Test creating a question with repeatable_group_id."""
        # Create first repeatable question
        q1_data = QuestionCreate(
            question_group_id=sample_group.id,
            question_text="Beneficiary name",
            question_type=QuestionType.FREE_TEXT,
            identifier="ben_name",
            repeatable=True
        )
        q1 = QuestionService.create_question(db_session, q1_data)

        # Create second question in same repeatable group
        q2_data = QuestionCreate(
            question_group_id=sample_group.id,
            question_text="Beneficiary share",
            question_type=QuestionType.FREE_TEXT,
            identifier="ben_share",
            repeatable=True,
            repeatable_group_id=str(q1.id)
        )
        q2 = QuestionService.create_question(db_session, q2_data)

        assert q2.repeatable == True
        assert q2.repeatable_group_id == str(q1.id)

    def test_create_question_duplicate_identifier(self, db_session: Session, sample_group):
        """Test that duplicate identifiers in same group raise error."""
        question_data = QuestionCreate(
            question_group_id=sample_group.id,
            question_text="First question",
            question_type=QuestionType.FREE_TEXT,
            identifier="duplicate"
        )
        QuestionService.create_question(db_session, question_data)

        question_data2 = QuestionCreate(
            question_group_id=sample_group.id,
            question_text="Second question",
            question_type=QuestionType.FREE_TEXT,
            identifier="duplicate"
        )

        with pytest.raises(HTTPException) as exc_info:
            QuestionService.create_question(db_session, question_data2)

        assert exc_info.value.status_code == 400
        assert "already exists" in str(exc_info.value.detail)

    def test_create_question_group_not_found(self, db_session: Session):
        """Test creating question for non-existent group raises error."""
        question_data = QuestionCreate(
            question_group_id=99999,
            question_text="Orphan question",
            question_type=QuestionType.FREE_TEXT,
            identifier="orphan"
        )

        with pytest.raises(HTTPException) as exc_info:
            QuestionService.create_question(db_session, question_data)

        assert exc_info.value.status_code == 404

    def test_get_question_by_id(self, db_session: Session, sample_group):
        """Test getting a question by ID."""
        question_data = QuestionCreate(
            question_group_id=sample_group.id,
            question_text="Findable question",
            question_type=QuestionType.FREE_TEXT,
            identifier="findable"
        )
        created = QuestionService.create_question(db_session, question_data)

        found = QuestionService.get_question_by_id(db_session, created.id)

        assert found is not None
        assert found.id == created.id

    def test_get_question_by_identifier(self, db_session: Session, sample_group):
        """Test getting a question by identifier."""
        question_data = QuestionCreate(
            question_group_id=sample_group.id,
            question_text="Identifiable question",
            question_type=QuestionType.FREE_TEXT,
            identifier="identifiable"
        )
        QuestionService.create_question(db_session, question_data)

        found = QuestionService.get_question_by_identifier(db_session, "sample.identifiable")

        assert found is not None
        assert found.question_text == "Identifiable question"

    def test_list_questions_by_group(self, db_session: Session, sample_group):
        """Test listing questions for a group."""
        for i in range(3):
            question_data = QuestionCreate(
                question_group_id=sample_group.id,
                question_text=f"Question {i}",
                question_type=QuestionType.FREE_TEXT,
                identifier=f"q{i}",
                display_order=i
            )
            QuestionService.create_question(db_session, question_data)

        questions = QuestionService.list_questions_by_group(db_session, sample_group.id)

        assert len(questions) == 3

    def test_update_question(self, db_session: Session, sample_group):
        """Test updating a question."""
        question_data = QuestionCreate(
            question_group_id=sample_group.id,
            question_text="Original text",
            question_type=QuestionType.FREE_TEXT,
            identifier="updatable"
        )
        created = QuestionService.create_question(db_session, question_data)

        update_data = QuestionUpdate(
            question_text="Updated text",
            is_required=True
        )
        updated = QuestionService.update_question(db_session, created.id, update_data)

        assert updated.question_text == "Updated text"
        assert updated.is_required == True

    def test_update_question_repeatable_group_id(self, db_session: Session, sample_group):
        """Test updating repeatable_group_id on a question."""
        # Create two questions
        q1_data = QuestionCreate(
            question_group_id=sample_group.id,
            question_text="Question 1",
            question_type=QuestionType.FREE_TEXT,
            identifier="q1",
            repeatable=True
        )
        q1 = QuestionService.create_question(db_session, q1_data)

        q2_data = QuestionCreate(
            question_group_id=sample_group.id,
            question_text="Question 2",
            question_type=QuestionType.FREE_TEXT,
            identifier="q2"
        )
        q2 = QuestionService.create_question(db_session, q2_data)

        # Update q2 to join q1's repeatable group
        update_data = QuestionUpdate(
            repeatable=True,
            repeatable_group_id=str(q1.id)
        )
        updated = QuestionService.update_question(db_session, q2.id, update_data)

        assert updated.repeatable == True
        assert updated.repeatable_group_id == str(q1.id)

    def test_update_question_not_found(self, db_session: Session):
        """Test updating a non-existent question raises error."""
        update_data = QuestionUpdate(question_text="New text")

        with pytest.raises(HTTPException) as exc_info:
            QuestionService.update_question(db_session, 99999, update_data)

        assert exc_info.value.status_code == 404

    def test_delete_question(self, db_session: Session, sample_group):
        """Test deleting a question."""
        question_data = QuestionCreate(
            question_group_id=sample_group.id,
            question_text="Deletable question",
            question_type=QuestionType.FREE_TEXT,
            identifier="deletable"
        )
        created = QuestionService.create_question(db_session, question_data)

        result = QuestionService.delete_question(db_session, created.id)

        assert result == True
        assert QuestionService.get_question_by_id(db_session, created.id) is None

    def test_delete_question_not_found(self, db_session: Session):
        """Test deleting a non-existent question raises error."""
        with pytest.raises(HTTPException) as exc_info:
            QuestionService.delete_question(db_session, 99999)

        assert exc_info.value.status_code == 404

    def test_delete_group_cascades_to_questions(self, db_session: Session, sample_group):
        """Test that deleting a group also deletes its questions."""
        # Create questions in the group
        for i in range(3):
            question_data = QuestionCreate(
                question_group_id=sample_group.id,
                question_text=f"Question {i}",
                question_type=QuestionType.FREE_TEXT,
                identifier=f"cascade_q{i}"
            )
            QuestionService.create_question(db_session, question_data)

        # Verify questions exist
        questions = QuestionService.list_questions_by_group(db_session, sample_group.id)
        assert len(questions) == 3

        # Delete the group
        QuestionGroupService.delete_question_group(db_session, sample_group.id)

        # Verify questions are also deleted
        questions = QuestionService.list_questions_by_group(db_session, sample_group.id)
        assert len(questions) == 0


class TestQuestionLogicFlow:
    """Test suite for question logic flow scenarios."""

    @pytest.fixture
    def group_with_questions(self, db_session: Session):
        """Create a group with multiple questions for testing logic flow."""
        group_data = QuestionGroupCreate(
            name="Logic Flow Group",
            identifier="logic_flow"
        )
        group = QuestionGroupService.create_question_group(db_session, group_data)

        # Create questions
        questions = []
        for i in range(5):
            q_data = QuestionCreate(
                question_group_id=group.id,
                question_text=f"Question {i + 1}",
                question_type=QuestionType.FREE_TEXT if i % 2 == 0 else QuestionType.MULTIPLE_CHOICE,
                identifier=f"q{i + 1}",
                display_order=i,
                options=[
                    QuestionOption(value="yes", label="Yes"),
                    QuestionOption(value="no", label="No")
                ] if i % 2 == 1 else None
            )
            questions.append(QuestionService.create_question(db_session, q_data))

        return group, questions

    def test_question_logic_simple_order(self, db_session: Session, group_with_questions):
        """Test simple question ordering in logic."""
        group, questions = group_with_questions

        # Set up simple linear question logic
        question_logic = [
            {"id": str(q.id), "type": "question", "questionId": q.id, "depth": 0}
            for q in questions
        ]

        update_data = QuestionGroupUpdate(question_logic=question_logic)
        updated = QuestionGroupService.update_question_group(db_session, group.id, update_data)

        assert len(updated.question_logic) == 5
        for i, item in enumerate(updated.question_logic):
            assert item["questionId"] == questions[i].id

    def test_question_logic_with_conditional(self, db_session: Session, group_with_questions):
        """Test question logic with conditional branching."""
        group, questions = group_with_questions

        # Set up logic with a conditional
        question_logic = [
            {"id": "1", "type": "question", "questionId": questions[0].id, "depth": 0},
            {"id": "2", "type": "question", "questionId": questions[1].id, "depth": 0},
            {
                "id": "3",
                "type": "conditional",
                "depth": 0,
                "conditional": {
                    "ifIdentifier": f"logic_flow.q2",
                    "operator": "equals",
                    "value": "yes",
                    "nestedItems": [
                        {"id": "4", "type": "question", "questionId": questions[2].id, "depth": 1}
                    ]
                }
            },
            {"id": "5", "type": "question", "questionId": questions[3].id, "depth": 0}
        ]

        update_data = QuestionGroupUpdate(question_logic=question_logic)
        updated = QuestionGroupService.update_question_group(db_session, group.id, update_data)

        assert len(updated.question_logic) == 4
        assert updated.question_logic[2]["type"] == "conditional"
        assert updated.question_logic[2]["conditional"]["ifIdentifier"] == "logic_flow.q2"
        assert len(updated.question_logic[2]["conditional"]["nestedItems"]) == 1

    def test_question_logic_nested_conditionals(self, db_session: Session, group_with_questions):
        """Test deeply nested conditional logic."""
        group, questions = group_with_questions

        # Set up logic with nested conditionals
        question_logic = [
            {"id": "1", "type": "question", "questionId": questions[0].id, "depth": 0},
            {
                "id": "2",
                "type": "conditional",
                "depth": 0,
                "conditional": {
                    "ifIdentifier": "logic_flow.q1",
                    "operator": "not_empty",
                    "value": "",
                    "nestedItems": [
                        {"id": "3", "type": "question", "questionId": questions[1].id, "depth": 1},
                        {
                            "id": "4",
                            "type": "conditional",
                            "depth": 1,
                            "conditional": {
                                "ifIdentifier": "logic_flow.q2",
                                "operator": "equals",
                                "value": "yes",
                                "nestedItems": [
                                    {"id": "5", "type": "question", "questionId": questions[2].id, "depth": 2}
                                ]
                            }
                        }
                    ]
                }
            }
        ]

        update_data = QuestionGroupUpdate(question_logic=question_logic)
        updated = QuestionGroupService.update_question_group(db_session, group.id, update_data)

        # Verify nested structure
        outer_conditional = updated.question_logic[1]
        assert outer_conditional["type"] == "conditional"
        assert len(outer_conditional["conditional"]["nestedItems"]) == 2

        inner_conditional = outer_conditional["conditional"]["nestedItems"][1]
        assert inner_conditional["type"] == "conditional"
        assert len(inner_conditional["conditional"]["nestedItems"]) == 1

    def test_question_logic_repeatable_group(self, db_session: Session):
        """Test question logic with repeatable groups."""
        group_data = QuestionGroupCreate(
            name="Repeatable Group",
            identifier="repeatable"
        )
        group = QuestionGroupService.create_question_group(db_session, group_data)

        # Create repeatable questions
        q1_data = QuestionCreate(
            question_group_id=group.id,
            question_text="Beneficiary Name",
            question_type=QuestionType.FREE_TEXT,
            identifier="ben_name",
            repeatable=True
        )
        q1 = QuestionService.create_question(db_session, q1_data)

        q2_data = QuestionCreate(
            question_group_id=group.id,
            question_text="Beneficiary Share",
            question_type=QuestionType.FREE_TEXT,
            identifier="ben_share",
            repeatable=True,
            repeatable_group_id=str(q1.id)
        )
        q2 = QuestionService.create_question(db_session, q2_data)

        # Set up logic
        question_logic = [
            {"id": "1", "type": "question", "questionId": q1.id, "depth": 0},
            {"id": "2", "type": "question", "questionId": q2.id, "depth": 0}
        ]

        update_data = QuestionGroupUpdate(question_logic=question_logic)
        updated = QuestionGroupService.update_question_group(db_session, group.id, update_data)

        # Verify both questions are in the same repeatable group
        q1_refreshed = QuestionService.get_question_by_id(db_session, q1.id)
        q2_refreshed = QuestionService.get_question_by_id(db_session, q2.id)

        assert q1_refreshed.repeatable == True
        assert q2_refreshed.repeatable == True
        assert q2_refreshed.repeatable_group_id == str(q1.id)

    def test_question_logic_insert_at_position(self, db_session: Session, group_with_questions):
        """Test inserting a question at a specific position in logic."""
        group, questions = group_with_questions

        # Initial logic with 3 questions
        initial_logic = [
            {"id": "1", "type": "question", "questionId": questions[0].id, "depth": 0},
            {"id": "2", "type": "question", "questionId": questions[1].id, "depth": 0},
            {"id": "3", "type": "question", "questionId": questions[2].id, "depth": 0}
        ]

        update_data = QuestionGroupUpdate(question_logic=initial_logic)
        QuestionGroupService.update_question_group(db_session, group.id, update_data)

        # Insert question at position 1 (between first and second)
        new_logic = [
            {"id": "1", "type": "question", "questionId": questions[0].id, "depth": 0},
            {"id": "4", "type": "question", "questionId": questions[3].id, "depth": 0},  # Inserted
            {"id": "2", "type": "question", "questionId": questions[1].id, "depth": 0},
            {"id": "3", "type": "question", "questionId": questions[2].id, "depth": 0}
        ]

        update_data = QuestionGroupUpdate(question_logic=new_logic)
        updated = QuestionGroupService.update_question_group(db_session, group.id, update_data)

        assert len(updated.question_logic) == 4
        assert updated.question_logic[1]["questionId"] == questions[3].id

    def test_question_logic_reorder(self, db_session: Session, group_with_questions):
        """Test reordering questions in logic."""
        group, questions = group_with_questions

        # Initial order: q1, q2, q3
        initial_logic = [
            {"id": "1", "type": "question", "questionId": questions[0].id, "depth": 0},
            {"id": "2", "type": "question", "questionId": questions[1].id, "depth": 0},
            {"id": "3", "type": "question", "questionId": questions[2].id, "depth": 0}
        ]

        update_data = QuestionGroupUpdate(question_logic=initial_logic)
        QuestionGroupService.update_question_group(db_session, group.id, update_data)

        # New order: q3, q1, q2
        new_logic = [
            {"id": "3", "type": "question", "questionId": questions[2].id, "depth": 0},
            {"id": "1", "type": "question", "questionId": questions[0].id, "depth": 0},
            {"id": "2", "type": "question", "questionId": questions[1].id, "depth": 0}
        ]

        update_data = QuestionGroupUpdate(question_logic=new_logic)
        updated = QuestionGroupService.update_question_group(db_session, group.id, update_data)

        assert updated.question_logic[0]["questionId"] == questions[2].id
        assert updated.question_logic[1]["questionId"] == questions[0].id
        assert updated.question_logic[2]["questionId"] == questions[1].id

    def test_question_logic_empty(self, db_session: Session):
        """Test that empty question logic is valid."""
        group_data = QuestionGroupCreate(
            name="Empty Logic Group",
            identifier="empty_logic"
        )
        group = QuestionGroupService.create_question_group(db_session, group_data)

        update_data = QuestionGroupUpdate(question_logic=[])
        updated = QuestionGroupService.update_question_group(db_session, group.id, update_data)

        assert updated.question_logic == []

    def test_question_logic_persists_after_reload(self, db_session: Session, group_with_questions):
        """Test that question logic persists correctly after database reload."""
        group, questions = group_with_questions

        question_logic = [
            {"id": "1", "type": "question", "questionId": questions[0].id, "depth": 0},
            {
                "id": "2",
                "type": "conditional",
                "depth": 0,
                "conditional": {
                    "ifIdentifier": "logic_flow.q1",
                    "operator": "not_empty",
                    "value": "",
                    "nestedItems": [
                        {"id": "3", "type": "question", "questionId": questions[1].id, "depth": 1}
                    ]
                }
            }
        ]

        update_data = QuestionGroupUpdate(question_logic=question_logic)
        QuestionGroupService.update_question_group(db_session, group.id, update_data)

        # Reload from database
        reloaded = QuestionGroupService.get_question_group_by_id(db_session, group.id)

        assert reloaded.question_logic is not None
        assert len(reloaded.question_logic) == 2
        assert reloaded.question_logic[1]["type"] == "conditional"
        assert reloaded.question_logic[1]["conditional"]["nestedItems"][0]["questionId"] == questions[1].id


class TestUserInteractionScenarios:
    """
    Test suite simulating real user interactions with the Question Group UI.
    
    These tests simulate various workflows a user might perform when creating
    and editing question groups, including adding, deleting, inserting, and
    reordering questions and conditionals.
    """

    def _create_group(self, db_session: Session, identifier: str) -> QuestionGroup:
        """Helper to create a question group."""
        group_data = QuestionGroupCreate(
            name=f"Test Group {identifier}",
            identifier=identifier
        )
        return QuestionGroupService.create_question_group(db_session, group_data)

    def _create_question(
        self, 
        db_session: Session, 
        group_id: int, 
        identifier: str,
        question_type: QuestionType = QuestionType.FREE_TEXT,
        repeatable: bool = False,
        repeatable_group_id: str = None,
        options: List[QuestionOption] = None
    ) -> Question:
        """Helper to create a question."""
        q_data = QuestionCreate(
            question_group_id=group_id,
            question_text=f"Question: {identifier}",
            question_type=question_type,
            identifier=identifier,
            repeatable=repeatable,
            repeatable_group_id=repeatable_group_id,
            options=options
        )
        return QuestionService.create_question(db_session, q_data)

    def _update_logic(self, db_session: Session, group_id: int, logic: List[Dict]) -> QuestionGroup:
        """Helper to update question logic."""
        update_data = QuestionGroupUpdate(question_logic=logic)
        return QuestionGroupService.update_question_group(db_session, group_id, update_data)

    # =========================================================================
    # TEST 1: Add three questions, delete the second one
    # =========================================================================
    def test_01_add_three_questions_delete_second(self, db_session: Session):
        """
        User adds 3 questions, then deletes the second one.
        Expected: Logic should have questions 1 and 3 in order.
        """
        group = self._create_group(db_session, "scenario_01")
        
        # User adds 3 questions
        q1 = self._create_question(db_session, group.id, "q1")
        q2 = self._create_question(db_session, group.id, "q2")
        q3 = self._create_question(db_session, group.id, "q3")
        
        # Set initial logic
        logic = [
            create_question_logic_item(q1.id, "1"),
            create_question_logic_item(q2.id, "2"),
            create_question_logic_item(q3.id, "3"),
        ]
        self._update_logic(db_session, group.id, logic)
        
        # User deletes q2
        QuestionService.delete_question(db_session, q2.id)
        
        # Update logic to remove q2
        new_logic = [
            create_question_logic_item(q1.id, "1"),
            create_question_logic_item(q3.id, "3"),
        ]
        updated = self._update_logic(db_session, group.id, new_logic)
        
        assert len(updated.question_logic) == 2
        assert updated.question_logic[0]["questionId"] == q1.id
        assert updated.question_logic[1]["questionId"] == q3.id

    # =========================================================================
    # TEST 2: Add questions, insert a conditional, add nested questions
    # =========================================================================
    def test_02_add_conditional_with_nested_questions(self, db_session: Session):
        """
        User adds 2 questions, inserts a conditional after q1, adds 2 nested questions.
        """
        group = self._create_group(db_session, "scenario_02")
        
        q1 = self._create_question(db_session, group.id, "q1", QuestionType.MULTIPLE_CHOICE,
                                   options=[QuestionOption(value="yes", label="Yes"),
                                           QuestionOption(value="no", label="No")])
        q2 = self._create_question(db_session, group.id, "q2")
        
        # Add nested questions
        nested1 = self._create_question(db_session, group.id, "nested1")
        nested2 = self._create_question(db_session, group.id, "nested2")
        
        logic = [
            create_question_logic_item(q1.id, "1"),
            create_conditional_logic_item(
                "cond1",
                f"scenario_02.q1",
                "equals",
                "yes",
                [
                    create_nested_question_item(nested1.id, "n1"),
                    create_nested_question_item(nested2.id, "n2"),
                ]
            ),
            create_question_logic_item(q2.id, "2"),
        ]
        updated = self._update_logic(db_session, group.id, logic)
        
        assert len(updated.question_logic) == 3
        assert updated.question_logic[1]["type"] == "conditional"
        assert len(updated.question_logic[1]["conditional"]["nestedItems"]) == 2

    # =========================================================================
    # TEST 3: Add nested questions, delete one, add a new one
    # =========================================================================
    def test_03_modify_nested_questions(self, db_session: Session):
        """
        User creates conditional with 2 nested questions, deletes second, adds new one.
        """
        group = self._create_group(db_session, "scenario_03")
        
        q1 = self._create_question(db_session, group.id, "q1", QuestionType.MULTIPLE_CHOICE,
                                   options=[QuestionOption(value="yes", label="Yes"),
                                           QuestionOption(value="no", label="No")])
        nested1 = self._create_question(db_session, group.id, "nested1")
        nested2 = self._create_question(db_session, group.id, "nested2")
        
        # Initial logic with conditional
        logic = [
            create_question_logic_item(q1.id, "1"),
            create_conditional_logic_item(
                "cond1", "scenario_03.q1", "equals", "yes",
                [
                    create_nested_question_item(nested1.id, "n1"),
                    create_nested_question_item(nested2.id, "n2"),
                ]
            ),
        ]
        self._update_logic(db_session, group.id, logic)
        
        # Delete nested2
        QuestionService.delete_question(db_session, nested2.id)
        
        # Add new nested question
        nested3 = self._create_question(db_session, group.id, "nested3")
        
        # Update logic
        new_logic = [
            create_question_logic_item(q1.id, "1"),
            create_conditional_logic_item(
                "cond1", "scenario_03.q1", "equals", "yes",
                [
                    create_nested_question_item(nested1.id, "n1"),
                    create_nested_question_item(nested3.id, "n3"),
                ]
            ),
        ]
        updated = self._update_logic(db_session, group.id, new_logic)
        
        nested_items = updated.question_logic[1]["conditional"]["nestedItems"]
        assert len(nested_items) == 2
        assert nested_items[0]["questionId"] == nested1.id
        assert nested_items[1]["questionId"] == nested3.id

    # =========================================================================
    # TEST 4: Insert question in the middle of existing questions
    # =========================================================================
    def test_04_insert_question_in_middle(self, db_session: Session):
        """
        User has 3 questions, inserts a new one between q1 and q2.
        """
        group = self._create_group(db_session, "scenario_04")
        
        q1 = self._create_question(db_session, group.id, "q1")
        q2 = self._create_question(db_session, group.id, "q2")
        q3 = self._create_question(db_session, group.id, "q3")
        
        logic = [
            create_question_logic_item(q1.id, "1"),
            create_question_logic_item(q2.id, "2"),
            create_question_logic_item(q3.id, "3"),
        ]
        self._update_logic(db_session, group.id, logic)
        
        # Insert new question between q1 and q2
        q_new = self._create_question(db_session, group.id, "q_new")
        
        new_logic = [
            create_question_logic_item(q1.id, "1"),
            create_question_logic_item(q_new.id, "new"),
            create_question_logic_item(q2.id, "2"),
            create_question_logic_item(q3.id, "3"),
        ]
        updated = self._update_logic(db_session, group.id, new_logic)
        
        assert len(updated.question_logic) == 4
        assert updated.question_logic[1]["questionId"] == q_new.id

    # =========================================================================
    # TEST 5: Insert conditional between two questions
    # =========================================================================
    def test_05_insert_conditional_between_questions(self, db_session: Session):
        """
        User has 3 questions, inserts a conditional between q2 and q3.
        """
        group = self._create_group(db_session, "scenario_05")
        
        q1 = self._create_question(db_session, group.id, "q1")
        q2 = self._create_question(db_session, group.id, "q2", QuestionType.MULTIPLE_CHOICE,
                                   options=[QuestionOption(value="yes", label="Yes"),
                                           QuestionOption(value="no", label="No")])
        q3 = self._create_question(db_session, group.id, "q3")
        nested = self._create_question(db_session, group.id, "nested")
        
        logic = [
            create_question_logic_item(q1.id, "1"),
            create_question_logic_item(q2.id, "2"),
            create_conditional_logic_item(
                "cond1", "scenario_05.q2", "equals", "yes",
                [create_nested_question_item(nested.id, "n1")]
            ),
            create_question_logic_item(q3.id, "3"),
        ]
        updated = self._update_logic(db_session, group.id, logic)
        
        assert len(updated.question_logic) == 4
        assert updated.question_logic[2]["type"] == "conditional"
        assert updated.question_logic[3]["questionId"] == q3.id

    # =========================================================================
    # TEST 6: Delete a conditional but keep its nested questions at root level
    # =========================================================================
    def test_06_delete_conditional_promote_nested(self, db_session: Session):
        """
        User deletes a conditional and moves its nested questions to root level.
        """
        group = self._create_group(db_session, "scenario_06")
        
        q1 = self._create_question(db_session, group.id, "q1", QuestionType.MULTIPLE_CHOICE,
                                   options=[QuestionOption(value="yes", label="Yes"),
                                           QuestionOption(value="no", label="No")])
        nested1 = self._create_question(db_session, group.id, "nested1")
        nested2 = self._create_question(db_session, group.id, "nested2")
        q2 = self._create_question(db_session, group.id, "q2")
        
        # Initial with conditional
        logic = [
            create_question_logic_item(q1.id, "1"),
            create_conditional_logic_item(
                "cond1", "scenario_06.q1", "equals", "yes",
                [
                    create_nested_question_item(nested1.id, "n1"),
                    create_nested_question_item(nested2.id, "n2"),
                ]
            ),
            create_question_logic_item(q2.id, "2"),
        ]
        self._update_logic(db_session, group.id, logic)
        
        # Remove conditional, promote nested to root
        new_logic = [
            create_question_logic_item(q1.id, "1"),
            create_question_logic_item(nested1.id, "n1"),
            create_question_logic_item(nested2.id, "n2"),
            create_question_logic_item(q2.id, "2"),
        ]
        updated = self._update_logic(db_session, group.id, new_logic)
        
        assert len(updated.question_logic) == 4
        assert all(item["type"] == "question" for item in updated.question_logic)

    # =========================================================================
    # TEST 7: Reorder questions by dragging
    # =========================================================================
    def test_07_reorder_questions(self, db_session: Session):
        """
        User reorders questions: q1, q2, q3, q4 -> q3, q1, q4, q2
        """
        group = self._create_group(db_session, "scenario_07")
        
        q1 = self._create_question(db_session, group.id, "q1")
        q2 = self._create_question(db_session, group.id, "q2")
        q3 = self._create_question(db_session, group.id, "q3")
        q4 = self._create_question(db_session, group.id, "q4")
        
        # New order
        logic = [
            create_question_logic_item(q3.id, "3"),
            create_question_logic_item(q1.id, "1"),
            create_question_logic_item(q4.id, "4"),
            create_question_logic_item(q2.id, "2"),
        ]
        updated = self._update_logic(db_session, group.id, logic)
        
        assert updated.question_logic[0]["questionId"] == q3.id
        assert updated.question_logic[1]["questionId"] == q1.id
        assert updated.question_logic[2]["questionId"] == q4.id
        assert updated.question_logic[3]["questionId"] == q2.id

    # =========================================================================
    # TEST 8: Create repeatable group with multiple questions
    # =========================================================================
    def test_08_create_repeatable_group(self, db_session: Session):
        """
        User creates a repeatable group with 3 questions that repeat together.
        """
        group = self._create_group(db_session, "scenario_08")
        
        # First question starts the repeatable group
        q1 = self._create_question(db_session, group.id, "ben_name", repeatable=True)
        
        # Other questions join the group
        q2 = self._create_question(db_session, group.id, "ben_share", 
                                   repeatable=True, repeatable_group_id=str(q1.id))
        q3 = self._create_question(db_session, group.id, "ben_relation",
                                   repeatable=True, repeatable_group_id=str(q1.id))
        
        logic = [
            create_question_logic_item(q1.id, "1"),
            create_question_logic_item(q2.id, "2"),
            create_question_logic_item(q3.id, "3"),
        ]
        updated = self._update_logic(db_session, group.id, logic)
        
        # Verify all questions are in the same repeatable group
        q1_db = QuestionService.get_question_by_id(db_session, q1.id)
        q2_db = QuestionService.get_question_by_id(db_session, q2.id)
        q3_db = QuestionService.get_question_by_id(db_session, q3.id)
        
        assert q1_db.repeatable == True
        assert q2_db.repeatable_group_id == str(q1.id)
        assert q3_db.repeatable_group_id == str(q1.id)

    # =========================================================================
    # TEST 9: Add question at the end after using insert in middle
    # =========================================================================
    def test_09_add_at_end_after_insert_in_middle(self, db_session: Session):
        """
        User inserts a question in the middle, then adds one at the end.
        This tests the bug where Add Question was inserting at wrong position.
        """
        group = self._create_group(db_session, "scenario_09")
        
        q1 = self._create_question(db_session, group.id, "q1")
        q2 = self._create_question(db_session, group.id, "q2")
        q3 = self._create_question(db_session, group.id, "q3")
        
        logic = [
            create_question_logic_item(q1.id, "1"),
            create_question_logic_item(q2.id, "2"),
            create_question_logic_item(q3.id, "3"),
        ]
        self._update_logic(db_session, group.id, logic)
        
        # Insert in middle
        q_middle = self._create_question(db_session, group.id, "q_middle")
        logic = [
            create_question_logic_item(q1.id, "1"),
            create_question_logic_item(q_middle.id, "mid"),
            create_question_logic_item(q2.id, "2"),
            create_question_logic_item(q3.id, "3"),
        ]
        self._update_logic(db_session, group.id, logic)
        
        # Add at end
        q_end = self._create_question(db_session, group.id, "q_end")
        logic = [
            create_question_logic_item(q1.id, "1"),
            create_question_logic_item(q_middle.id, "mid"),
            create_question_logic_item(q2.id, "2"),
            create_question_logic_item(q3.id, "3"),
            create_question_logic_item(q_end.id, "end"),
        ]
        updated = self._update_logic(db_session, group.id, logic)
        
        assert len(updated.question_logic) == 5
        assert updated.question_logic[4]["questionId"] == q_end.id

    # =========================================================================
    # TEST 10: Multiple conditionals in sequence
    # =========================================================================
    def test_10_multiple_conditionals_in_sequence(self, db_session: Session):
        """
        User creates multiple conditionals one after another.
        """
        group = self._create_group(db_session, "scenario_10")
        
        q1 = self._create_question(db_session, group.id, "q1", QuestionType.MULTIPLE_CHOICE,
                                   options=[QuestionOption(value="yes", label="Yes"),
                                           QuestionOption(value="no", label="No")])
        q2 = self._create_question(db_session, group.id, "q2", QuestionType.MULTIPLE_CHOICE,
                                   options=[QuestionOption(value="yes", label="Yes"),
                                           QuestionOption(value="no", label="No")])
        nested1 = self._create_question(db_session, group.id, "nested1")
        nested2 = self._create_question(db_session, group.id, "nested2")
        
        logic = [
            create_question_logic_item(q1.id, "1"),
            create_conditional_logic_item(
                "cond1", "scenario_10.q1", "equals", "yes",
                [create_nested_question_item(nested1.id, "n1")]
            ),
            create_question_logic_item(q2.id, "2"),
            create_conditional_logic_item(
                "cond2", "scenario_10.q2", "equals", "yes",
                [create_nested_question_item(nested2.id, "n2")]
            ),
        ]
        updated = self._update_logic(db_session, group.id, logic)
        
        assert len(updated.question_logic) == 4
        assert updated.question_logic[1]["type"] == "conditional"
        assert updated.question_logic[3]["type"] == "conditional"

    # =========================================================================
    # TEST 11: Deeply nested conditionals (3 levels)
    # =========================================================================
    def test_11_deeply_nested_conditionals(self, db_session: Session):
        """
        User creates conditionals nested 3 levels deep.
        """
        group = self._create_group(db_session, "scenario_11")
        
        q1 = self._create_question(db_session, group.id, "q1", QuestionType.MULTIPLE_CHOICE,
                                   options=[QuestionOption(value="yes", label="Yes"),
                                           QuestionOption(value="no", label="No")])
        q2 = self._create_question(db_session, group.id, "q2", QuestionType.MULTIPLE_CHOICE,
                                   options=[QuestionOption(value="yes", label="Yes"),
                                           QuestionOption(value="no", label="No")])
        q3 = self._create_question(db_session, group.id, "q3", QuestionType.MULTIPLE_CHOICE,
                                   options=[QuestionOption(value="yes", label="Yes"),
                                           QuestionOption(value="no", label="No")])
        q4 = self._create_question(db_session, group.id, "q4")
        
        logic = [
            create_question_logic_item(q1.id, "1"),
            {
                "id": "cond1",
                "type": "conditional",
                "depth": 0,
                "conditional": {
                    "ifIdentifier": "scenario_11.q1",
                    "operator": "equals",
                    "value": "yes",
                    "nestedItems": [
                        {"id": "2", "type": "question", "questionId": q2.id, "depth": 1},
                        {
                            "id": "cond2",
                            "type": "conditional",
                            "depth": 1,
                            "conditional": {
                                "ifIdentifier": "scenario_11.q2",
                                "operator": "equals",
                                "value": "yes",
                                "nestedItems": [
                                    {"id": "3", "type": "question", "questionId": q3.id, "depth": 2},
                                    {
                                        "id": "cond3",
                                        "type": "conditional",
                                        "depth": 2,
                                        "conditional": {
                                            "ifIdentifier": "scenario_11.q3",
                                            "operator": "equals",
                                            "value": "yes",
                                            "nestedItems": [
                                                {"id": "4", "type": "question", "questionId": q4.id, "depth": 3}
                                            ]
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                }
            }
        ]
        updated = self._update_logic(db_session, group.id, logic)
        
        # Verify structure
        level1 = updated.question_logic[1]["conditional"]["nestedItems"]
        assert len(level1) == 2
        
        level2 = level1[1]["conditional"]["nestedItems"]
        assert len(level2) == 2
        
        level3 = level2[1]["conditional"]["nestedItems"]
        assert len(level3) == 1
        assert level3[0]["questionId"] == q4.id

    # =========================================================================
    # TEST 12: Delete all questions and start fresh
    # =========================================================================
    def test_12_delete_all_and_start_fresh(self, db_session: Session):
        """
        User deletes all questions and creates new ones.
        """
        group = self._create_group(db_session, "scenario_12")
        
        # Create initial questions
        q1 = self._create_question(db_session, group.id, "old1")
        q2 = self._create_question(db_session, group.id, "old2")
        
        logic = [
            create_question_logic_item(q1.id, "1"),
            create_question_logic_item(q2.id, "2"),
        ]
        self._update_logic(db_session, group.id, logic)
        
        # Delete all
        QuestionService.delete_question(db_session, q1.id)
        QuestionService.delete_question(db_session, q2.id)
        self._update_logic(db_session, group.id, [])
        
        # Create new questions
        new1 = self._create_question(db_session, group.id, "new1")
        new2 = self._create_question(db_session, group.id, "new2")
        new3 = self._create_question(db_session, group.id, "new3")
        
        logic = [
            create_question_logic_item(new1.id, "1"),
            create_question_logic_item(new2.id, "2"),
            create_question_logic_item(new3.id, "3"),
        ]
        updated = self._update_logic(db_session, group.id, logic)
        
        assert len(updated.question_logic) == 3

    # =========================================================================
    # TEST 13: Move question into a conditional
    # =========================================================================
    def test_13_move_question_into_conditional(self, db_session: Session):
        """
        User moves an existing root-level question into a conditional.
        """
        group = self._create_group(db_session, "scenario_13")
        
        q1 = self._create_question(db_session, group.id, "q1", QuestionType.MULTIPLE_CHOICE,
                                   options=[QuestionOption(value="yes", label="Yes"),
                                           QuestionOption(value="no", label="No")])
        q2 = self._create_question(db_session, group.id, "q2")
        q3 = self._create_question(db_session, group.id, "q3")
        
        # Initial: all at root level
        logic = [
            create_question_logic_item(q1.id, "1"),
            create_question_logic_item(q2.id, "2"),
            create_question_logic_item(q3.id, "3"),
        ]
        self._update_logic(db_session, group.id, logic)
        
        # Move q2 into a conditional
        logic = [
            create_question_logic_item(q1.id, "1"),
            create_conditional_logic_item(
                "cond1", "scenario_13.q1", "equals", "yes",
                [create_nested_question_item(q2.id, "2")]
            ),
            create_question_logic_item(q3.id, "3"),
        ]
        updated = self._update_logic(db_session, group.id, logic)
        
        assert len(updated.question_logic) == 3
        assert updated.question_logic[1]["type"] == "conditional"
        assert updated.question_logic[1]["conditional"]["nestedItems"][0]["questionId"] == q2.id

    # =========================================================================
    # TEST 14: Move question out of conditional to root
    # =========================================================================
    def test_14_move_question_out_of_conditional(self, db_session: Session):
        """
        User moves a nested question out of a conditional to root level.
        """
        group = self._create_group(db_session, "scenario_14")
        
        q1 = self._create_question(db_session, group.id, "q1", QuestionType.MULTIPLE_CHOICE,
                                   options=[QuestionOption(value="yes", label="Yes"),
                                           QuestionOption(value="no", label="No")])
        q2 = self._create_question(db_session, group.id, "q2")
        q3 = self._create_question(db_session, group.id, "q3")
        
        # Initial: q2 nested
        logic = [
            create_question_logic_item(q1.id, "1"),
            create_conditional_logic_item(
                "cond1", "scenario_14.q1", "equals", "yes",
                [create_nested_question_item(q2.id, "2")]
            ),
            create_question_logic_item(q3.id, "3"),
        ]
        self._update_logic(db_session, group.id, logic)
        
        # Move q2 to root, remove conditional
        logic = [
            create_question_logic_item(q1.id, "1"),
            create_question_logic_item(q2.id, "2"),
            create_question_logic_item(q3.id, "3"),
        ]
        updated = self._update_logic(db_session, group.id, logic)
        
        assert len(updated.question_logic) == 3
        assert all(item["type"] == "question" for item in updated.question_logic)

    # =========================================================================
    # TEST 15: Change conditional operator
    # =========================================================================
    def test_15_change_conditional_operator(self, db_session: Session):
        """
        User changes the operator of a conditional from 'equals' to 'not_equals'.
        """
        group = self._create_group(db_session, "scenario_15")
        
        q1 = self._create_question(db_session, group.id, "q1", QuestionType.MULTIPLE_CHOICE,
                                   options=[QuestionOption(value="yes", label="Yes"),
                                           QuestionOption(value="no", label="No")])
        nested = self._create_question(db_session, group.id, "nested")
        
        # Initial with equals
        logic = [
            create_question_logic_item(q1.id, "1"),
            create_conditional_logic_item(
                "cond1", "scenario_15.q1", "equals", "yes",
                [create_nested_question_item(nested.id, "n1")]
            ),
        ]
        self._update_logic(db_session, group.id, logic)
        
        # Change to not_equals
        logic = [
            create_question_logic_item(q1.id, "1"),
            create_conditional_logic_item(
                "cond1", "scenario_15.q1", "not_equals", "yes",
                [create_nested_question_item(nested.id, "n1")]
            ),
        ]
        updated = self._update_logic(db_session, group.id, logic)
        
        assert updated.question_logic[1]["conditional"]["operator"] == "not_equals"

    # =========================================================================
    # TEST 16: Add question to empty conditional
    # =========================================================================
    def test_16_add_question_to_empty_conditional(self, db_session: Session):
        """
        User creates an empty conditional, then adds a question to it.
        """
        group = self._create_group(db_session, "scenario_16")
        
        q1 = self._create_question(db_session, group.id, "q1", QuestionType.MULTIPLE_CHOICE,
                                   options=[QuestionOption(value="yes", label="Yes"),
                                           QuestionOption(value="no", label="No")])
        
        # Empty conditional
        logic = [
            create_question_logic_item(q1.id, "1"),
            create_conditional_logic_item("cond1", "scenario_16.q1", "equals", "yes", []),
        ]
        self._update_logic(db_session, group.id, logic)
        
        # Add nested question
        nested = self._create_question(db_session, group.id, "nested")
        logic = [
            create_question_logic_item(q1.id, "1"),
            create_conditional_logic_item(
                "cond1", "scenario_16.q1", "equals", "yes",
                [create_nested_question_item(nested.id, "n1")]
            ),
        ]
        updated = self._update_logic(db_session, group.id, logic)
        
        assert len(updated.question_logic[1]["conditional"]["nestedItems"]) == 1

    # =========================================================================
    # TEST 17: Reorder nested questions within conditional
    # =========================================================================
    def test_17_reorder_nested_questions(self, db_session: Session):
        """
        User reorders questions within a conditional.
        """
        group = self._create_group(db_session, "scenario_17")
        
        q1 = self._create_question(db_session, group.id, "q1", QuestionType.MULTIPLE_CHOICE,
                                   options=[QuestionOption(value="yes", label="Yes"),
                                           QuestionOption(value="no", label="No")])
        n1 = self._create_question(db_session, group.id, "n1")
        n2 = self._create_question(db_session, group.id, "n2")
        n3 = self._create_question(db_session, group.id, "n3")
        
        # Initial order: n1, n2, n3
        logic = [
            create_question_logic_item(q1.id, "1"),
            create_conditional_logic_item(
                "cond1", "scenario_17.q1", "equals", "yes",
                [
                    create_nested_question_item(n1.id, "n1"),
                    create_nested_question_item(n2.id, "n2"),
                    create_nested_question_item(n3.id, "n3"),
                ]
            ),
        ]
        self._update_logic(db_session, group.id, logic)
        
        # Reorder to: n3, n1, n2
        logic = [
            create_question_logic_item(q1.id, "1"),
            create_conditional_logic_item(
                "cond1", "scenario_17.q1", "equals", "yes",
                [
                    create_nested_question_item(n3.id, "n3"),
                    create_nested_question_item(n1.id, "n1"),
                    create_nested_question_item(n2.id, "n2"),
                ]
            ),
        ]
        updated = self._update_logic(db_session, group.id, logic)
        
        nested = updated.question_logic[1]["conditional"]["nestedItems"]
        assert nested[0]["questionId"] == n3.id
        assert nested[1]["questionId"] == n1.id
        assert nested[2]["questionId"] == n2.id

    # =========================================================================
    # TEST 18: Change question type and add options
    # =========================================================================
    def test_18_change_question_type_add_options(self, db_session: Session):
        """
        User changes a free text question to multiple choice and adds options.
        """
        group = self._create_group(db_session, "scenario_18")
        
        q1 = self._create_question(db_session, group.id, "q1")
        
        logic = [create_question_logic_item(q1.id, "1")]
        self._update_logic(db_session, group.id, logic)
        
        # Change to multiple choice
        update_data = QuestionUpdate(
            question_type=QuestionType.MULTIPLE_CHOICE,
            options=[
                QuestionOption(value="opt1", label="Option 1"),
                QuestionOption(value="opt2", label="Option 2"),
            ]
        )
        updated_q = QuestionService.update_question(db_session, q1.id, update_data)
        
        assert updated_q.question_type == QuestionType.MULTIPLE_CHOICE
        assert len(updated_q.options) == 2

    # =========================================================================
    # TEST 19: Create conditional based on newly added question
    # =========================================================================
    def test_19_conditional_based_on_new_question(self, db_session: Session):
        """
        User adds a question, then immediately creates a conditional based on it.
        """
        group = self._create_group(db_session, "scenario_19")
        
        # Add first question
        q1 = self._create_question(db_session, group.id, "q1", QuestionType.MULTIPLE_CHOICE,
                                   options=[QuestionOption(value="yes", label="Yes"),
                                           QuestionOption(value="no", label="No")])
        
        logic = [create_question_logic_item(q1.id, "1")]
        self._update_logic(db_session, group.id, logic)
        
        # Add conditional immediately
        nested = self._create_question(db_session, group.id, "nested")
        logic = [
            create_question_logic_item(q1.id, "1"),
            create_conditional_logic_item(
                "cond1", "scenario_19.q1", "equals", "yes",
                [create_nested_question_item(nested.id, "n1")]
            ),
        ]
        updated = self._update_logic(db_session, group.id, logic)
        
        assert len(updated.question_logic) == 2
        assert updated.question_logic[1]["conditional"]["ifIdentifier"] == "scenario_19.q1"

    # =========================================================================
    # TEST 20: Complex workflow - full form creation
    # =========================================================================
    def test_20_complex_full_form_creation(self, db_session: Session):
        """
        Simulates creating a complete form with various question types,
        conditionals, and repeatable groups.
        """
        group = self._create_group(db_session, "scenario_20")
        
        # Step 1: Add basic info questions
        name = self._create_question(db_session, group.id, "client_name")
        dob = self._create_question(db_session, group.id, "dob", QuestionType.DATE)
        married = self._create_question(db_session, group.id, "married", QuestionType.MULTIPLE_CHOICE,
                                        options=[QuestionOption(value="yes", label="Yes"),
                                                QuestionOption(value="no", label="No")])
        
        # Step 2: Add spouse info (conditional on married=yes)
        spouse_name = self._create_question(db_session, group.id, "spouse_name")
        spouse_dob = self._create_question(db_session, group.id, "spouse_dob", QuestionType.DATE)
        
        # Step 3: Add children (repeatable)
        child_name = self._create_question(db_session, group.id, "child_name", repeatable=True)
        child_dob = self._create_question(db_session, group.id, "child_dob", QuestionType.DATE,
                                          repeatable=True, repeatable_group_id=str(child_name.id))
        
        # Step 4: Add beneficiaries (repeatable)
        ben_name = self._create_question(db_session, group.id, "ben_name", repeatable=True)
        ben_share = self._create_question(db_session, group.id, "ben_share",
                                          repeatable=True, repeatable_group_id=str(ben_name.id))
        
        # Build complete logic
        logic = [
            create_question_logic_item(name.id, "1"),
            create_question_logic_item(dob.id, "2"),
            create_question_logic_item(married.id, "3"),
            create_conditional_logic_item(
                "cond_married", "scenario_20.married", "equals", "yes",
                [
                    create_nested_question_item(spouse_name.id, "spouse_name"),
                    create_nested_question_item(spouse_dob.id, "spouse_dob"),
                ]
            ),
            create_question_logic_item(child_name.id, "child_name"),
            create_question_logic_item(child_dob.id, "child_dob"),
            create_question_logic_item(ben_name.id, "ben_name"),
            create_question_logic_item(ben_share.id, "ben_share"),
        ]
        updated = self._update_logic(db_session, group.id, logic)
        
        # Verify structure
        assert len(updated.question_logic) == 8
        
        # Verify conditional
        cond = updated.question_logic[3]
        assert cond["type"] == "conditional"
        assert len(cond["conditional"]["nestedItems"]) == 2
        
        # Verify repeatable groups
        child_name_db = QuestionService.get_question_by_id(db_session, child_name.id)
        child_dob_db = QuestionService.get_question_by_id(db_session, child_dob.id)
        assert child_name_db.repeatable == True
        assert child_dob_db.repeatable_group_id == str(child_name.id)
        
        ben_name_db = QuestionService.get_question_by_id(db_session, ben_name.id)
        ben_share_db = QuestionService.get_question_by_id(db_session, ben_share.id)
        assert ben_name_db.repeatable == True
        assert ben_share_db.repeatable_group_id == str(ben_name.id)


class TestCopyQuestionGroup:
    """Test suite for copying/duplicating question groups.

    Verifies that every field on the group and its questions is accurately
    preserved, that identifiers are correctly re-namespaced, and that
    question_logic JSON (questionId refs, ifIdentifier refs, nested items)
    is remapped to point at the new copied questions.
    """

    def _create_group(self, db_session: Session, identifier: str, **kwargs) -> QuestionGroup:
        group_data = QuestionGroupCreate(
            name=f"Test Group {identifier}",
            identifier=identifier,
            **kwargs
        )
        return QuestionGroupService.create_question_group(db_session, group_data)

    def _create_question(
        self,
        db_session: Session,
        group_id: int,
        identifier: str,
        question_type: QuestionType = QuestionType.FREE_TEXT,
        **kwargs
    ) -> Question:
        q_data = QuestionCreate(
            question_group_id=group_id,
            question_text=f"Question: {identifier}",
            question_type=question_type,
            identifier=identifier,
            **kwargs
        )
        return QuestionService.create_question(db_session, q_data)

    def _update_logic(self, db_session: Session, group_id: int, logic: list) -> QuestionGroup:
        update_data = QuestionGroupUpdate(question_logic=logic)
        return QuestionGroupService.update_question_group(db_session, group_id, update_data)

    @pytest.fixture
    def complex_group(self, db_session: Session):
        """Create a complex group with diverse question types and features."""
        group = self._create_group(db_session, "estate_plan", description="Estate planning group")

        # Q1: free text with help_text and validation
        q_client_name = self._create_question(
            db_session, group.id, "client_name",
            question_type=QuestionType.FREE_TEXT,
            help_text="Enter the client's full legal name",
            is_required=True,
            display_order=0,
            validation_rules={"min_length": 2, "max_length": 200}
        )

        # Q2: multiple choice with options
        q_marital = self._create_question(
            db_session, group.id, "marital_status",
            question_type=QuestionType.MULTIPLE_CHOICE,
            options=[
                QuestionOption(value="single", label="Single"),
                QuestionOption(value="married", label="Married"),
                QuestionOption(value="divorced", label="Divorced"),
            ],
            display_order=1
        )

        # Q3: person type with person_display_mode (repeatable)
        q_trustee = self._create_question(
            db_session, group.id, "new_sstee",
            question_type=QuestionType.PERSON,
            person_display_mode="autocomplete",
            repeatable=True,
            display_order=2
        )

        # Q4: free text in same repeatable group as Q3
        q_relation = self._create_question(
            db_session, group.id, "sstee_relation",
            question_type=QuestionType.FREE_TEXT,
            repeatable=True,
            repeatable_group_id=str(q_trustee.id),
            display_order=3
        )

        # Q5: date with include_time
        q_sign_date = self._create_question(
            db_session, group.id, "signing_date",
            question_type=QuestionType.DATE,
            include_time=True,
            display_order=4
        )

        # Q6: conditional target (shown only when marital_status = married)
        q_spouse = self._create_question(
            db_session, group.id, "spouse_name",
            question_type=QuestionType.FREE_TEXT,
            display_order=5
        )

        # Q7: nested conditional target
        q_spouse_trust = self._create_question(
            db_session, group.id, "spouse_trust_pct",
            question_type=QuestionType.FREE_TEXT,
            display_order=6,
            validation_rules={"pattern": "^\\d{1,3}$"}
        )

        # Build question_logic matching actual frontend QuestionLogicItem structure
        question_logic = [
            # Top-level question
            {"id": "item-1", "type": "question", "questionId": q_client_name.id, "depth": 0},
            # Top-level question
            {"id": "item-2", "type": "question", "questionId": q_marital.id, "depth": 0},
            # Conditional on marital_status
            {
                "id": "item-3",
                "type": "conditional",
                "depth": 0,
                "conditional": {
                    "ifIdentifier": "estate_plan.marital_status",
                    "operator": "equals",
                    "value": "married",
                    "nestedItems": [
                        {"id": "item-4", "type": "question", "questionId": q_spouse.id, "depth": 1},
                        # Nested conditional inside first conditional
                        {
                            "id": "item-5",
                            "type": "conditional",
                            "depth": 1,
                            "conditional": {
                                "ifIdentifier": "estate_plan.spouse_name",
                                "operator": "not_equals",
                                "value": "",
                                "nestedItems": [
                                    {"id": "item-6", "type": "question", "questionId": q_spouse_trust.id, "depth": 2}
                                ]
                            }
                        }
                    ]
                }
            },
            # Repeatable questions
            {"id": "item-7", "type": "question", "questionId": q_trustee.id, "depth": 0},
            {"id": "item-8", "type": "question", "questionId": q_relation.id, "depth": 0},
            # Date question
            {"id": "item-9", "type": "question", "questionId": q_sign_date.id, "depth": 0},
        ]

        group = self._update_logic(db_session, group.id, question_logic)

        questions = {
            "client_name": q_client_name,
            "marital_status": q_marital,
            "new_sstee": q_trustee,
            "sstee_relation": q_relation,
            "signing_date": q_sign_date,
            "spouse_name": q_spouse,
            "spouse_trust_pct": q_spouse_trust,
        }
        return group, questions

    def test_copy_group_name_and_identifier(self, db_session: Session, complex_group):
        """Copied group gets unique name and identifier."""
        original_group, _ = complex_group
        copied = QuestionGroupService.copy_question_group(db_session, original_group.id)

        assert copied.id != original_group.id
        assert copied.name == f"{original_group.name} copy"
        assert copied.identifier == f"{original_group.identifier}_copy"
        assert copied.description == original_group.description
        assert copied.is_active == original_group.is_active

    def test_copy_preserves_all_question_fields(self, db_session: Session, complex_group):
        """Every field on every question is preserved in the copy."""
        original_group, orig_questions = complex_group
        copied = QuestionGroupService.copy_question_group(db_session, original_group.id)

        copied_questions = QuestionService.list_questions_by_group(db_session, copied.id, include_inactive=True)
        assert len(copied_questions) == len(orig_questions)

        # Build lookup by base identifier (strip namespace)
        def base_id(q):
            ns = f"{q.question_group.identifier}." if q.question_group else ""
            return q.identifier[len(ns):] if q.identifier.startswith(ns) else q.identifier

        copied_by_base = {base_id(q): q for q in copied_questions}

        for key, orig in orig_questions.items():
            cq = copied_by_base.get(key)
            assert cq is not None, f"Missing copied question for '{key}'"

            # Identifier should be re-namespaced
            assert cq.identifier == f"{copied.identifier}.{key}"
            assert cq.identifier != orig.identifier

            # All other fields should match
            assert cq.question_text == orig.question_text
            assert cq.question_type == orig.question_type
            assert cq.repeatable == orig.repeatable
            assert cq.display_order == orig.display_order
            assert cq.is_required == orig.is_required
            assert cq.help_text == orig.help_text
            assert cq.options == orig.options
            assert cq.database_table == orig.database_table
            assert cq.database_value_column == orig.database_value_column
            assert cq.database_label_column == orig.database_label_column
            assert cq.person_display_mode == orig.person_display_mode
            assert cq.include_time == orig.include_time
            assert cq.validation_rules == orig.validation_rules
            assert cq.is_active == orig.is_active

    def test_copy_person_display_mode(self, db_session: Session, complex_group):
        """person_display_mode is preserved on person-type questions."""
        original_group, orig_questions = complex_group
        copied = QuestionGroupService.copy_question_group(db_session, original_group.id)
        copied_questions = QuestionService.list_questions_by_group(db_session, copied.id, include_inactive=True)

        trustee_copy = next((q for q in copied_questions if q.identifier.endswith(".new_sstee")), None)
        assert trustee_copy is not None
        assert trustee_copy.person_display_mode == "autocomplete"

    def test_copy_include_time(self, db_session: Session, complex_group):
        """include_time is preserved on date-type questions."""
        original_group, orig_questions = complex_group
        copied = QuestionGroupService.copy_question_group(db_session, original_group.id)
        copied_questions = QuestionService.list_questions_by_group(db_session, copied.id, include_inactive=True)

        date_copy = next((q for q in copied_questions if q.identifier.endswith(".signing_date")), None)
        assert date_copy is not None
        assert date_copy.include_time == True

    def test_copy_repeatable_group_id(self, db_session: Session, complex_group):
        """repeatable_group_id is preserved (questions stay linked)."""
        original_group, orig_questions = complex_group
        copied = QuestionGroupService.copy_question_group(db_session, original_group.id)
        copied_questions = QuestionService.list_questions_by_group(db_session, copied.id, include_inactive=True)

        trustee_copy = next((q for q in copied_questions if q.identifier.endswith(".new_sstee")), None)
        relation_copy = next((q for q in copied_questions if q.identifier.endswith(".sstee_relation")), None)

        assert trustee_copy is not None
        assert relation_copy is not None
        assert trustee_copy.repeatable == True
        assert relation_copy.repeatable == True
        assert relation_copy.repeatable_group_id == orig_questions["sstee_relation"].repeatable_group_id

    def test_copy_question_logic_questionId_remapped(self, db_session: Session, complex_group):
        """questionId fields in question_logic point to the NEW copied questions."""
        original_group, orig_questions = complex_group
        copied = QuestionGroupService.copy_question_group(db_session, original_group.id)

        copied_questions = QuestionService.list_questions_by_group(db_session, copied.id, include_inactive=True)
        copied_ids = {q.id for q in copied_questions}
        original_ids = {q.id for q in orig_questions.values()}

        # Collect all questionId values from the copied logic
        def collect_question_ids(items):
            ids = []
            for item in (items or []):
                if item.get("type") == "question" and "questionId" in item:
                    ids.append(item["questionId"])
                if item.get("type") == "conditional" and "conditional" in item:
                    ids.extend(collect_question_ids(item["conditional"].get("nestedItems", [])))
            return ids

        logic_question_ids = collect_question_ids(copied.question_logic)
        assert len(logic_question_ids) > 0, "question_logic should contain questionId references"

        for qid in logic_question_ids:
            assert qid in copied_ids, f"questionId {qid} should reference a copied question"
            assert qid not in original_ids, f"questionId {qid} still references an original question"

    def test_copy_question_logic_ifIdentifier_remapped(self, db_session: Session, complex_group):
        """ifIdentifier fields in conditionals use the new group namespace."""
        original_group, _ = complex_group
        copied = QuestionGroupService.copy_question_group(db_session, original_group.id)

        def collect_if_identifiers(items):
            ids = []
            for item in (items or []):
                if item.get("type") == "conditional" and "conditional" in item:
                    cond = item["conditional"]
                    if "ifIdentifier" in cond:
                        ids.append(cond["ifIdentifier"])
                    ids.extend(collect_if_identifiers(cond.get("nestedItems", [])))
            return ids

        if_identifiers = collect_if_identifiers(copied.question_logic)
        assert len(if_identifiers) >= 2, "Should have at least 2 conditional ifIdentifiers"

        for ident in if_identifiers:
            assert ident.startswith(f"{copied.identifier}."), \
                f"ifIdentifier '{ident}' should start with '{copied.identifier}.'"
            assert not ident.startswith(f"{original_group.identifier}."), \
                f"ifIdentifier '{ident}' still uses original namespace"

    def test_copy_question_logic_nested_structure_preserved(self, db_session: Session, complex_group):
        """Nested conditional structure (depth 2) is preserved after copy."""
        original_group, _ = complex_group
        copied = QuestionGroupService.copy_question_group(db_session, original_group.id)

        # Find the outer conditional
        outer_cond = None
        for item in copied.question_logic:
            if item.get("type") == "conditional":
                outer_cond = item
                break

        assert outer_cond is not None, "Should have a conditional in logic"
        nested = outer_cond["conditional"]["nestedItems"]
        assert len(nested) == 2, "Outer conditional should have 2 nested items"

        # First nested item is a question
        assert nested[0]["type"] == "question"

        # Second nested item is another conditional
        inner_cond = nested[1]
        assert inner_cond["type"] == "conditional"
        assert len(inner_cond["conditional"]["nestedItems"]) == 1
        assert inner_cond["conditional"]["nestedItems"][0]["type"] == "question"

    def test_copy_validation_rules_preserved(self, db_session: Session, complex_group):
        """validation_rules JSON is preserved on copied questions."""
        original_group, _ = complex_group
        copied = QuestionGroupService.copy_question_group(db_session, original_group.id)
        copied_questions = QuestionService.list_questions_by_group(db_session, copied.id, include_inactive=True)

        client_name_copy = next((q for q in copied_questions if q.identifier.endswith(".client_name")), None)
        assert client_name_copy is not None
        assert client_name_copy.validation_rules == {"min_length": 2, "max_length": 200}

        spouse_trust_copy = next((q for q in copied_questions if q.identifier.endswith(".spouse_trust_pct")), None)
        assert spouse_trust_copy is not None
        assert spouse_trust_copy.validation_rules == {"pattern": "^\\d{1,3}$"}

    def test_copy_options_preserved(self, db_session: Session, complex_group):
        """Multiple choice options are preserved on copied questions."""
        original_group, _ = complex_group
        copied = QuestionGroupService.copy_question_group(db_session, original_group.id)
        copied_questions = QuestionService.list_questions_by_group(db_session, copied.id, include_inactive=True)

        marital_copy = next((q for q in copied_questions if q.identifier.endswith(".marital_status")), None)
        assert marital_copy is not None
        assert len(marital_copy.options) == 3
        assert marital_copy.options[0]["value"] == "single"

    def test_double_copy_unique_names(self, db_session: Session, complex_group):
        """Copying twice yields distinct names/identifiers."""
        original_group, _ = complex_group
        copy1 = QuestionGroupService.copy_question_group(db_session, original_group.id)
        copy2 = QuestionGroupService.copy_question_group(db_session, original_group.id)

        assert copy1.name != copy2.name
        assert copy1.identifier != copy2.identifier
        assert copy2.name == f"{original_group.name} copy copy"
        assert copy2.identifier == f"{original_group.identifier}_copy_copy"
