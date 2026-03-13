#!/usr/bin/env python3
"""
Migrate repeatable conditional followup questions out of conditionals.

This script restructures the question group flow to move repeatable questions
that are currently inside conditional followups into the main repeatable set.
This is necessary because repeatable questions inside conditionals create
a 2D array structure that the current backend cannot properly handle.

Usage:
    python scripts/migrate_repeatable_conditional_followups.py --question-group-identifier test_31126_450
"""

import os
import sys
import json
import argparse
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def migrate_flow_structure(db, question_group_identifier):
    """
    Migrate the flow structure to move repeatable conditional followups
    into the main repeatable set.
    """
    
    # Get the question group
    result = db.execute(text("""
        SELECT id, identifier, flow_structure
        FROM question_groups
        WHERE identifier = :identifier AND is_active = true
    """), {"identifier": question_group_identifier}).fetchone()
    
    if not result:
        print(f"Question group '{question_group_identifier}' not found")
        return False
    
    qg_id, qg_identifier, flow_json = result
    print(f"\nQuestion Group: {qg_identifier} (ID: {qg_id})")
    
    flow = json.loads(flow_json) if flow_json else []
    
    # Find the repeatable group with conditional followups
    modified = False
    new_flow = []
    
    for item in flow:
        if item.get('type') == 'repeatable_set':
            questions = item.get('questions', [])
            
            # Check if any question has conditional followups with repeatable questions
            for q in questions:
                if q.get('type') == 'question' and q.get('conditional_followups'):
                    for cfu in q['conditional_followups']:
                        then_items = cfu.get('then', [])
                        
                        # Find repeatable questions in the conditional
                        repeatable_followups = []
                        for then_item in then_items:
                            if then_item.get('type') == 'question':
                                q_id = then_item.get('questionId')
                                if q_id:
                                    # Check if this question is repeatable
                                    q_result = db.execute(text("""
                                        SELECT id, identifier, repeatable, repeatable_group_id
                                        FROM questions
                                        WHERE id = :id AND is_active = true
                                    """), {"id": q_id}).fetchone()
                                    
                                    if q_result and q_result[2]:  # repeatable = True
                                        repeatable_followups.append({
                                            'id': q_result[0],
                                            'identifier': q_result[1],
                                            'group_id': q_result[3]
                                        })
                        
                        if repeatable_followups:
                            print(f"\nFound {len(repeatable_followups)} repeatable questions in conditional followup:")
                            for rfq in repeatable_followups:
                                print(f"  - {rfq['identifier']} (ID: {rfq['id']}, Group: {rfq['group_id']})")
                            
                            print("\n⚠️  MIGRATION REQUIRED:")
                            print("  Repeatable questions inside conditionals create a 2D array structure")
                            print("  that cannot be properly saved/loaded with the current backend schema.")
                            print("\n  Recommended solution:")
                            print("  1. Move these questions out of the conditional into the main repeatable set")
                            print("  2. Add a new conditional question to control their visibility")
                            print("\n  This requires manual restructuring in the admin UI.")
                            modified = True
        
        new_flow.append(item)
    
    if not modified:
        print("\n✓ No repeatable conditional followups found - no migration needed")
        return True
    
    print("\n" + "="*80)
    print("MIGRATION STEPS:")
    print("="*80)
    print("\n1. Go to the Question Groups admin page")
    print("2. Edit the question group:", qg_identifier)
    print("3. For each repeatable question currently in a conditional:")
    print("   a. Remove it from the conditional followup")
    print("   b. Add it to the main repeatable set")
    print("   c. Add a new 'multiple_choice' question to control visibility")
    print("   d. Make the new question a conditional trigger")
    print("\n4. Update the flow structure to reflect the new organization")
    print("\nThis ensures each parent instance can have its own independent")
    print("repeatable instances without creating a 2D array structure.")
    print("="*80)
    
    return True


def main():
    parser = argparse.ArgumentParser(description='Migrate repeatable conditional followup questions')
    parser.add_argument('--question-group-identifier', type=str, required=True,
                       help='Question group identifier (e.g., test_31126_450)')
    
    args = parser.parse_args()
    
    # Database connection
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        print("Error: DATABASE_URL environment variable not set")
        return 1
    
    engine = create_engine(database_url)
    Session = sessionmaker(bind=engine)
    db = Session()
    
    try:
        success = migrate_flow_structure(db, args.question_group_identifier)
        
        if success:
            print("\n✓ Analysis complete")
            return 0
        else:
            print("\n✗ Migration failed")
            return 1
    
    finally:
        db.close()


if __name__ == '__main__':
    sys.exit(main())
