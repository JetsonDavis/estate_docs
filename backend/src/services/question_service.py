from sqlalchemy.orm import Session
from typing import Optional, List
from ..models.question import QuestionGroup, Question
from ..schemas.question import (
    QuestionGroupCreate,
    QuestionGroupUpdate,
    QuestionCreate,
    QuestionUpdate
)
from fastapi import HTTPException, status
from ..utils.naming import generate_copy_name, generate_copy_identifier


class QuestionGroupService:
    """Service for question group operations."""

    @staticmethod
    def get_question_group_by_id(db: Session, group_id: int) -> Optional[QuestionGroup]:
        """Get question group by ID."""
        return db.query(QuestionGroup).filter(QuestionGroup.id == group_id).first()

    @staticmethod
    def get_question_group_by_identifier(db: Session, identifier: str) -> Optional[QuestionGroup]:
        """Get question group by identifier."""
        return db.query(QuestionGroup).filter(QuestionGroup.identifier == identifier).first()

    @staticmethod
    def list_question_groups(
        db: Session,
        skip: int = 0,
        limit: int = 100,
        include_inactive: bool = False
    ) -> tuple[List[QuestionGroup], int]:
        """List question groups with pagination."""
        query = db.query(QuestionGroup)

        if not include_inactive:
            query = query.filter(QuestionGroup.is_active == True)

        # Show newest groups first so recently created groups are immediately visible.
        query = query.order_by(QuestionGroup.id.desc())

        total = query.count()
        groups = query.offset(skip).limit(limit).all()

        return groups, total

    @staticmethod
    def create_question_group(db: Session, group_data: QuestionGroupCreate) -> QuestionGroup:
        """Create a new question group."""
        # Check if identifier already exists
        existing = db.query(QuestionGroup).filter(
            QuestionGroup.identifier == group_data.identifier
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Question group with this identifier already exists"
            )

        new_group = QuestionGroup(
            name=group_data.name,
            description=group_data.description,
            identifier=group_data.identifier,
            display_order=group_data.display_order
        )

        db.add(new_group)
        db.commit()
        db.refresh(new_group)

        return new_group

    @staticmethod
    def update_question_group(
        db: Session,
        group_id: int,
        group_data: QuestionGroupUpdate
    ) -> QuestionGroup:
        """Update question group."""
        group = db.query(QuestionGroup).filter(QuestionGroup.id == group_id).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Question group not found"
            )

        # Update fields
        if group_data.name is not None:
            group.name = group_data.name
        if group_data.description is not None:
            group.description = group_data.description
        if group_data.display_order is not None:
            group.display_order = group_data.display_order
        if group_data.question_logic is not None:
            group.question_logic = group_data.question_logic
        if group_data.collapsed_items is not None:
            group.collapsed_items = group_data.collapsed_items
        if group_data.is_active is not None:
            group.is_active = group_data.is_active

        db.commit()
        db.refresh(group)

        return group

    @staticmethod
    def delete_question_group(db: Session, group_id: int) -> bool:
        """Hard delete a question group and its questions."""
        group = db.query(QuestionGroup).filter(QuestionGroup.id == group_id).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Question group not found"
            )

        # Delete all questions in this group first
        db.query(Question).filter(Question.question_group_id == group_id).delete()

        # Delete the group
        db.delete(group)
        db.commit()

        return True

    @staticmethod
    def copy_question_group(db: Session, group_id: int) -> QuestionGroup:
        """Create a copy of a question group with all its questions."""
        # Get the original group
        original_group = db.query(QuestionGroup).filter(QuestionGroup.id == group_id).first()
        if not original_group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Question group not found"
            )

        try:
            import uuid as _uuid

            # Get all existing group names and identifiers for uniqueness check
            all_groups = db.query(QuestionGroup).all()
            existing_names = [g.name for g in all_groups]
            existing_identifiers = [g.identifier for g in all_groups]

            # Generate unique name and identifier
            new_name = generate_copy_name(original_group.name, existing_names)
            new_identifier = generate_copy_identifier(original_group.identifier, existing_identifiers)

            # ── Build UUID mapping ──
            # Collect every UUID used in question_logic (id, localQuestionId)
            # and in questions (repeatable_group_id) so we can generate fresh
            # UUIDs for the copy while preserving internal linkages.
            uuid_map = {}  # old UUID string -> new UUID string

            def _ensure_uuid(old_val):
                """Get or create a new UUID for an old UUID value."""
                if old_val and old_val not in uuid_map:
                    uuid_map[old_val] = str(_uuid.uuid4())

            def _collect_logic_uuids(items):
                for item in (items or []):
                    _ensure_uuid(item.get('id'))
                    _ensure_uuid(item.get('localQuestionId'))
                    if item.get('type') == 'conditional' and 'conditional' in item:
                        cond = item['conditional']
                        _collect_logic_uuids(cond.get('nestedItems', []))

            _collect_logic_uuids(original_group.question_logic)

            # Also collect repeatable_group_id UUIDs from questions
            original_questions = QuestionService.list_questions_by_group(db, group_id, include_inactive=True)
            for q in original_questions:
                _ensure_uuid(q.repeatable_group_id)

            # Create the new group (question_logic will be remapped below)
            new_group = QuestionGroup(
                name=new_name,
                description=original_group.description,
                identifier=new_identifier,
                display_order=original_group.display_order,
                question_logic=original_group.question_logic,
                collapsed_items=original_group.collapsed_items,
                is_active=original_group.is_active
            )

            db.add(new_group)
            db.flush()  # Get the new group ID without committing

            # ── Copy questions ──
            # identifier_mapping: old string identifier -> new string identifier
            # id_mapping: old numeric question ID -> new numeric question ID
            identifier_mapping = {}
            id_mapping = {}

            for original_question in original_questions:
                # Strip the old namespace prefix and add the new one
                old_namespace = f"{original_group.identifier}."
                if original_question.identifier.startswith(old_namespace):
                    base_identifier = original_question.identifier[len(old_namespace):]
                else:
                    base_identifier = original_question.identifier

                new_q_identifier = f"{new_group.identifier}.{base_identifier}"
                identifier_mapping[original_question.identifier] = new_q_identifier

                # Remap repeatable_group_id to new UUID
                new_rep_group_id = None
                if original_question.repeatable_group_id:
                    new_rep_group_id = uuid_map.get(
                        original_question.repeatable_group_id,
                        original_question.repeatable_group_id
                    )

                # Create the new question - copy directly from original
                new_question = Question(
                    question_group_id=new_group.id,
                    question_text=original_question.question_text,
                    question_type=original_question.question_type,
                    identifier=new_q_identifier,
                    repeatable=original_question.repeatable,
                    repeatable_group_id=new_rep_group_id,
                    display_order=original_question.display_order,
                    is_required=original_question.is_required,
                    help_text=original_question.help_text,
                    options=original_question.options,
                    database_table=original_question.database_table,
                    database_value_column=original_question.database_value_column,
                    database_label_column=original_question.database_label_column,
                    person_display_mode=original_question.person_display_mode,
                    include_time=original_question.include_time,
                    validation_rules=original_question.validation_rules,
                    is_active=original_question.is_active
                )

                db.add(new_question)
                db.flush()

                id_mapping[original_question.id] = new_question.id

            # ── Remap question_logic ──
            # Actual structure (matches frontend QuestionLogicItem):
            #   question:    { id, type:'question', questionId:<int>,
            #                  localQuestionId:<uuid>, ... }
            #   conditional: { id, type:'conditional', conditional: {
            #                    ifIdentifier:<str>, nestedItems:[...] }, ... }
            if new_group.question_logic:
                def remap_logic_items(items):
                    if not items:
                        return items
                    updated = []
                    for item in items:
                        out = dict(item)
                        # Remap item-level UUIDs
                        if 'id' in out and out['id'] in uuid_map:
                            out['id'] = uuid_map[out['id']]
                        if 'localQuestionId' in out and out['localQuestionId'] in uuid_map:
                            out['localQuestionId'] = uuid_map[out['localQuestionId']]
                        if item.get('type') == 'question':
                            if 'questionId' in item and item['questionId'] in id_mapping:
                                out['questionId'] = id_mapping[item['questionId']]
                        elif item.get('type') == 'conditional' and 'conditional' in item:
                            cond = dict(item['conditional'])
                            if 'ifIdentifier' in cond and cond['ifIdentifier'] in identifier_mapping:
                                cond['ifIdentifier'] = identifier_mapping[cond['ifIdentifier']]
                            if 'nestedItems' in cond:
                                cond['nestedItems'] = remap_logic_items(cond['nestedItems'])
                            out['conditional'] = cond
                        updated.append(out)
                    return updated

                new_group.question_logic = remap_logic_items(new_group.question_logic)

            db.commit()
            db.refresh(new_group)

            return new_group

        except HTTPException:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to copy question group: {str(e)}"
            )


class QuestionService:
    """Service for question operations."""

    @staticmethod
    def get_question_by_id(db: Session, question_id: int) -> Optional[Question]:
        """Get question by ID."""
        return db.query(Question).filter(Question.id == question_id).first()

    @staticmethod
    def get_question_by_identifier(db: Session, identifier: str) -> Optional[Question]:
        """Get question by identifier."""
        return db.query(Question).filter(Question.identifier == identifier).first()

    @staticmethod
    def list_questions_by_group(
        db: Session,
        group_id: int,
        include_inactive: bool = False
    ) -> List[Question]:
        """List questions for a specific group."""
        query = db.query(Question).filter(Question.question_group_id == group_id)

        if not include_inactive:
            query = query.filter(Question.is_active == True)

        query = query.order_by(Question.display_order)

        return query.all()

    @staticmethod
    def create_question(db: Session, question_data: QuestionCreate) -> Question:
        """Create a new question."""
        # Verify question group exists first (needed for namespace)
        group = db.query(QuestionGroup).filter(
            QuestionGroup.id == question_data.question_group_id
        ).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Question group not found"
            )
        
        # Build namespaced identifier and check if it already exists
        namespaced_identifier = f"{group.identifier}.{question_data.identifier}"
        existing = db.query(Question).filter(
            Question.identifier == namespaced_identifier
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Question with this identifier already exists in this group"
            )

        # Convert options to dict format if provided
        options_dict = None
        if question_data.options:
            options_dict = [opt.model_dump() for opt in question_data.options]
        
        new_question = Question(
            question_group_id=question_data.question_group_id,
            question_text=question_data.question_text,
            question_type=question_data.question_type,
            identifier=namespaced_identifier,
            repeatable=question_data.repeatable,
            repeatable_group_id=question_data.repeatable_group_id,
            display_order=question_data.display_order,
            is_required=question_data.is_required,
            help_text=question_data.help_text,
            options=options_dict,
            database_table=question_data.database_table,
            database_value_column=question_data.database_value_column,
            database_label_column=question_data.database_label_column,
            person_display_mode=question_data.person_display_mode,
            include_time=question_data.include_time,
            validation_rules=question_data.validation_rules
        )
        
        db.add(new_question)
        db.commit()
        db.refresh(new_question)
        
        return new_question
    
    @staticmethod
    def update_question(
        db: Session,
        question_id: int,
        question_data: QuestionUpdate
    ) -> Question:
        """Update question."""
        question = db.query(Question).filter(Question.id == question_id).first()
        if not question:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Question not found"
            )
        
        # Update fields
        if question_data.question_text is not None:
            question.question_text = question_data.question_text
        if question_data.question_type is not None:
            question.question_type = question_data.question_type
        if question_data.identifier is not None:
            # Build namespaced identifier using the question's group
            group = db.query(QuestionGroup).filter(QuestionGroup.id == question.question_group_id).first()
            if not group:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Question group {question.question_group_id} not found; cannot build namespaced identifier"
                )
            new_namespaced = f"{group.identifier}.{question_data.identifier}"
            # Guard against renaming to an identifier already used by another question
            conflicting = db.query(Question).filter(
                Question.identifier == new_namespaced,
                Question.id != question_id
            ).first()
            if conflicting:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Question with this identifier already exists in this group"
                )
            question.identifier = new_namespaced
        if question_data.display_order is not None:
            question.display_order = question_data.display_order
        if question_data.is_required is not None:
            question.is_required = question_data.is_required
        if question_data.help_text is not None:
            question.help_text = question_data.help_text
        if question_data.options is not None:
            question.options = [opt.model_dump() for opt in question_data.options]
        if question_data.database_table is not None:
            question.database_table = question_data.database_table
        if question_data.database_value_column is not None:
            question.database_value_column = question_data.database_value_column
        if question_data.database_label_column is not None:
            question.database_label_column = question_data.database_label_column
        if question_data.validation_rules is not None:
            question.validation_rules = question_data.validation_rules
        if question_data.is_active is not None:
            question.is_active = question_data.is_active
        if question_data.repeatable is not None:
            question.repeatable = question_data.repeatable
            # When repeatable changes, always sync group_id from payload
            question.repeatable_group_id = question_data.repeatable_group_id
        elif question_data.repeatable_group_id is not None:
            question.repeatable_group_id = question_data.repeatable_group_id
        
        db.commit()
        db.refresh(question)
        
        return question
    
    @staticmethod
    def delete_question(db: Session, question_id: int) -> bool:
        """Hard delete a question."""
        question = db.query(Question).filter(Question.id == question_id).first()
        if not question:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Question not found"
            )
        
        db.delete(question)
        db.commit()
        
        return True
