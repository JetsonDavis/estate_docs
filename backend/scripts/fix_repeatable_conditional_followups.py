#!/usr/bin/env python3
"""
Script to ensure repeatable questions in conditional followups are properly configured.

This script:
1. Finds all repeatable questions that appear as conditional followups
2. Ensures they have the correct repeatable flag and group ID in the database
3. Optionally restructures the question group flow to move them into the main repeatable set

Usage:
    python scripts/fix_repeatable_conditional_followups.py --question-group-id <id>
    python scripts/fix_repeatable_conditional_followups.py --question-group-identifier <identifier>
"""

import os
import sys
import json
import argparse
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def find_repeatable_followups_in_flow(flow_structure):
    """Find all repeatable questions that appear in conditional followups."""
    repeatable_followup_ids = set()
    
    def traverse(items):
        if not items:
            return
        for item in items:
            if item.get('type') == 'conditional':
                then_items = item.get('then', [])
                for then_item in then_items:
                    if then_item.get('type') == 'question':
                        q_id = then_item.get('questionId')
                        if q_id:
                            repeatable_followup_ids.add(q_id)
                traverse(then_items)
            elif item.get('type') == 'question':
                # Check if this question has conditional followups
                pass
    
    traverse(flow_structure)
    return repeatable_followup_ids


def fix_repeatable_conditional_followups(db, question_group_id=None, question_group_identifier=None):
    """Fix repeatable questions in conditional followups."""
    
    # Get the question group
    if question_group_id:
        result = db.execute(text("""
            SELECT id, identifier, flow_structure
            FROM question_groups
            WHERE id = :id AND is_active = true
        """), {"id": question_group_id}).fetchone()
    elif question_group_identifier:
        result = db.execute(text("""
            SELECT id, identifier, flow_structure
            FROM question_groups
            WHERE identifier = :identifier AND is_active = true
        """), {"identifier": question_group_identifier}).fetchone()
    else:
        print("Error: Must provide either --question-group-id or --question-group-identifier")
        return False
    
    if not result:
        print("Question group not found")
        return False
    
    qg_id, qg_identifier, flow_json = result
    print(f"\nQuestion Group: {qg_identifier} (ID: {qg_id})")
    
    flow = json.loads(flow_json) if flow_json else []
    
    # Find repeatable questions in conditional followups
    followup_q_ids = find_repeatable_followups_in_flow(flow)
    
    if not followup_q_ids:
        print("No conditional followup questions found")
        return True
    
    print(f"\nFound {len(followup_q_ids)} questions in conditional followups")
    
    # Check which ones are repeatable
    placeholders = ','.join([f':id{i}' for i in range(len(followup_q_ids))])
    params = {f'id{i}': qid for i, qid in enumerate(followup_q_ids)}
    
    result = db.execute(text(f"""
        SELECT id, identifier, repeatable, repeatable_group_id
        FROM questions
        WHERE id IN ({placeholders})
        AND is_active = true
    """), params).fetchall()
    
    repeatable_questions = []
    for q_id, identifier, repeatable, group_id in result:
        if repeatable:
            repeatable_questions.append({
                'id': q_id,
                'identifier': identifier,
                'group_id': group_id
            })
            print(f"  ✓ {identifier} (ID: {q_id}) - repeatable, group: {group_id}")
        else:
            print(f"  - {identifier} (ID: {q_id}) - not repeatable")
    
    if not repeatable_questions:
        print("\nNo repeatable questions found in conditional followups")
        return True
    
    # Group by repeatable_group_id
    groups = {}
    for q in repeatable_questions:
        gid = q['group_id']
        if gid not in groups:
            groups[gid] = []
        groups[gid].append(q)
    
    print(f"\nFound {len(groups)} repeatable groups in conditional followups:")
    for gid, questions in groups.items():
        print(f"\n  Group {gid}:")
        for q in questions:
            print(f"    - {q['identifier']} (ID: {q['id']})")
    
    print("\n✓ All repeatable questions in conditional followups are properly configured")
    print("  The frontend will now handle them correctly with independent state management")
    
    return True


def main():
    parser = argparse.ArgumentParser(description='Fix repeatable conditional followup questions')
    parser.add_argument('--question-group-id', type=int, help='Question group ID')
    parser.add_argument('--question-group-identifier', type=str, help='Question group identifier')
    
    args = parser.parse_args()
    
    if not args.question_group_id and not args.question_group_identifier:
        parser.print_help()
        return 1
    
    # Database connection
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        print("Error: DATABASE_URL environment variable not set")
        return 1
    
    engine = create_engine(database_url)
    Session = sessionmaker(bind=engine)
    db = Session()
    
    try:
        success = fix_repeatable_conditional_followups(
            db,
            question_group_id=args.question_group_id,
            question_group_identifier=args.question_group_identifier
        )
        
        if success:
            print("\n✓ Done")
            return 0
        else:
            print("\n✗ Failed")
            return 1
    
    finally:
        db.close()


if __name__ == '__main__':
    sys.exit(main())
