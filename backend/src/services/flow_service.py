"""Service layer for document flow operations."""

from sqlalchemy.orm import Session
from typing import Optional, List, Tuple
from fastapi import HTTPException, status

from ..models.flow import DocumentFlow, flow_question_groups
from ..models.question import QuestionGroup
from ..schemas.flow import DocumentFlowCreate, DocumentFlowUpdate


class FlowService:
    """Service for document flow operations."""
    
    @staticmethod
    def create_flow(
        db: Session,
        flow_data: DocumentFlowCreate,
        user_id: int
    ) -> DocumentFlow:
        """
        Create a new document flow.
        
        Args:
            db: Database session
            flow_data: Flow creation data
            user_id: User ID creating the flow
            
        Returns:
            Created document flow
        """
        # Check if flow name already exists
        existing = db.query(DocumentFlow).filter(
            DocumentFlow.name == flow_data.name,
            DocumentFlow.is_active == True
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Flow with name '{flow_data.name}' already exists"
            )
        
        # Validate starting group if provided
        if flow_data.starting_group_id:
            starting_group = db.query(QuestionGroup).filter(
                QuestionGroup.id == flow_data.starting_group_id,
                QuestionGroup.is_active == True
            ).first()
            
            if not starting_group:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Starting group not found"
                )
        
        # Create flow
        flow = DocumentFlow(
            name=flow_data.name,
            description=flow_data.description,
            starting_group_id=flow_data.starting_group_id,
            created_by=user_id,
            is_active=True
        )
        
        db.add(flow)
        db.commit()
        db.refresh(flow)
        
        # Associate question groups if provided
        if flow_data.question_group_ids:
            FlowService._associate_question_groups(
                db,
                flow.id,
                flow_data.question_group_ids
            )
        
        return flow
    
    @staticmethod
    def _associate_question_groups(
        db: Session,
        flow_id: int,
        group_ids: List[int]
    ):
        """Associate question groups with a flow."""
        for idx, group_id in enumerate(group_ids):
            # Verify group exists
            group = db.query(QuestionGroup).filter(
                QuestionGroup.id == group_id,
                QuestionGroup.is_active == True
            ).first()
            
            if not group:
                continue
            
            # Insert association
            db.execute(
                flow_question_groups.insert().values(
                    flow_id=flow_id,
                    question_group_id=group_id,
                    order_index=idx
                )
            )
        
        db.commit()
    
    @staticmethod
    def get_flow(db: Session, flow_id: int) -> Optional[DocumentFlow]:
        """
        Get flow by ID.
        
        Args:
            db: Database session
            flow_id: Flow ID
            
        Returns:
            Flow if found, None otherwise
        """
        return db.query(DocumentFlow).filter(
            DocumentFlow.id == flow_id,
            DocumentFlow.is_active == True
        ).first()
    
    @staticmethod
    def list_flows(
        db: Session,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None
    ) -> Tuple[List[DocumentFlow], int]:
        """
        List document flows.
        
        Args:
            db: Database session
            skip: Number of records to skip
            limit: Maximum number of records to return
            search: Optional search term
            
        Returns:
            Tuple of (flows list, total count)
        """
        query = db.query(DocumentFlow).filter(
            DocumentFlow.is_active == True
        )
        
        if search:
            query = query.filter(
                DocumentFlow.name.ilike(f"%{search}%")
            )
        
        total = query.count()
        flows = query.order_by(DocumentFlow.created_at.desc()).offset(skip).limit(limit).all()
        
        return flows, total
    
    @staticmethod
    def update_flow(
        db: Session,
        flow_id: int,
        flow_data: DocumentFlowUpdate
    ) -> Optional[DocumentFlow]:
        """
        Update a document flow.
        
        Args:
            db: Database session
            flow_id: Flow ID
            flow_data: Flow update data
            
        Returns:
            Updated flow if found, None otherwise
        """
        flow = FlowService.get_flow(db, flow_id)
        if not flow:
            return None
        
        # Update fields
        if flow_data.name is not None:
            # Check name uniqueness
            existing = db.query(DocumentFlow).filter(
                DocumentFlow.name == flow_data.name,
                DocumentFlow.id != flow_id,
                DocumentFlow.is_active == True
            ).first()
            
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Flow with name '{flow_data.name}' already exists"
                )
            
            flow.name = flow_data.name
        
        if flow_data.description is not None:
            flow.description = flow_data.description
        
        if flow_data.starting_group_id is not None:
            flow.starting_group_id = flow_data.starting_group_id
        
        # Update question group associations if provided
        if flow_data.question_group_ids is not None:
            # Remove existing associations
            db.execute(
                flow_question_groups.delete().where(
                    flow_question_groups.c.flow_id == flow_id
                )
            )
            
            # Add new associations
            FlowService._associate_question_groups(
                db,
                flow_id,
                flow_data.question_group_ids
            )
        
        db.commit()
        db.refresh(flow)
        
        return flow
    
    @staticmethod
    def delete_flow(db: Session, flow_id: int) -> bool:
        """
        Soft delete a document flow.
        
        Args:
            db: Database session
            flow_id: Flow ID
            
        Returns:
            True if deleted, False if not found
        """
        flow = FlowService.get_flow(db, flow_id)
        if not flow:
            return False
        
        flow.is_active = False
        db.commit()
        
        return True
    
    @staticmethod
    def get_flow_with_groups(db: Session, flow_id: int) -> Optional[dict]:
        """
        Get flow with associated question groups.
        
        Args:
            db: Database session
            flow_id: Flow ID
            
        Returns:
            Flow data with question groups
        """
        flow = FlowService.get_flow(db, flow_id)
        if not flow:
            return None
        
        # Get associated question groups
        groups = db.query(QuestionGroup).join(
            flow_question_groups,
            QuestionGroup.id == flow_question_groups.c.question_group_id
        ).filter(
            flow_question_groups.c.flow_id == flow_id,
            QuestionGroup.is_active == True
        ).order_by(flow_question_groups.c.order_index).all()
        
        return {
            **flow.to_dict(),
            "question_groups": [g.to_dict() for g in groups]
        }
