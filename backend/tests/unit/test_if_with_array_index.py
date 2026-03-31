"""Test IF statements with array subscript syntax."""

import json
import pytest
from src.services.document_service import DocumentService


class TestIfWithArrayIndex:
    """Test that array indexing works inside IF conditions."""

    def test_if_with_array_index_equals(self):
        """{{ IF <<names[1]>> = "Alice" }} should work."""
        template = '{{ IF <<names[1]>> = "Alice" }}First is Alice{{ END }}'
        raw = json.dumps(['Alice', 'Bob', 'Carol'])
        answer_map = {'names': raw}
        raw_map = {'names': raw}

        result = DocumentService._merge_template(template, answer_map, raw_map)
        assert 'First is Alice' in result

    def test_if_with_array_index_not_equals(self):
        """{{ IF <<names[1]>> != "Bob" }} should work."""
        template = '{{ IF <<names[1]>> != "Bob" }}First is not Bob{{ END }}'
        raw = json.dumps(['Alice', 'Bob', 'Carol'])
        answer_map = {'names': raw}
        raw_map = {'names': raw}

        result = DocumentService._merge_template(template, answer_map, raw_map)
        assert 'First is not Bob' in result

    def test_if_with_array_index_false(self):
        """{{ IF <<names[1]>> = "Bob" }} should be false."""
        template = '{{ IF <<names[1]>> = "Bob" }}First is Bob{{ ELSE }}First is not Bob{{ END }}'
        raw = json.dumps(['Alice', 'Bob', 'Carol'])
        answer_map = {'names': raw}
        raw_map = {'names': raw}

        result = DocumentService._merge_template(template, answer_map, raw_map)
        assert 'First is not Bob' in result
        assert 'First is Bob' not in result.replace('First is not Bob', '')

    def test_if_with_array_index_person_field(self):
        """{{ IF <<trustee[1].name>> = "Alice Smith" }} should work."""
        template = '{{ IF <<trustee[1].name>> = "Alice Smith" }}First trustee is Alice{{ END }}'
        raw = json.dumps([{'name': 'Alice Smith'}, {'name': 'Bob Jones'}])
        answer_map = {'trustee': 'Alice Smith and Bob Jones'}
        raw_map = {'trustee': raw}

        result = DocumentService._merge_template(template, answer_map, raw_map)
        assert 'First trustee is Alice' in result

    def test_if_with_array_index_empty_check(self):
        """{{ IF <<names[1]>> }} should check if first element exists."""
        template = '{{ IF <<names[1]>> }}Has first{{ ELSE }}No first{{ END }}'
        raw = json.dumps(['Alice', 'Bob'])
        answer_map = {'names': raw}
        raw_map = {'names': raw}

        result = DocumentService._merge_template(template, answer_map, raw_map)
        assert 'Has first' in result

    def test_if_with_array_index_out_of_bounds(self):
        """{{ IF <<names[5]>> }} should be false when index out of bounds."""
        template = '{{ IF <<names[5]>> }}Has fifth{{ ELSE }}No fifth{{ END }}'
        raw = json.dumps(['Alice', 'Bob'])
        answer_map = {'names': raw}
        raw_map = {'names': raw}

        result = DocumentService._merge_template(template, answer_map, raw_map)
        assert 'No fifth' in result
        assert 'Has fifth' not in result.replace('No fifth', '')

    def test_if_not_with_array_index(self):
        """{{ IF NOT <<names[5]>> }} should work for out of bounds."""
        template = '{{ IF NOT <<names[5]>> }}No fifth element{{ END }}'
        raw = json.dumps(['Alice', 'Bob'])
        answer_map = {'names': raw}
        raw_map = {'names': raw}

        result = DocumentService._merge_template(template, answer_map, raw_map)
        assert 'No fifth element' in result

    def test_nested_if_with_array_index(self):
        """Nested IF with array indexing."""
        template = '''{{ IF <<trustee[1]>> }}
First trustee: <<trustee[1].name>>
{{ IF <<trustee[1].name>> = "Alice Smith" }}
  Alice is first
{{ END }}
{{ END }}'''
        raw = json.dumps([{'name': 'Alice Smith'}, {'name': 'Bob Jones'}])
        answer_map = {'trustee': 'Alice Smith and Bob Jones'}
        raw_map = {'trustee': raw}

        result = DocumentService._merge_template(template, answer_map, raw_map)
        assert 'First trustee: Alice Smith' in result
        assert 'Alice is first' in result
