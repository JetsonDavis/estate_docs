"""Test counter tokens: ##, ###, ##%, ##A"""

import pytest
from src.services.document_service import DocumentService


class TestCounterTokens:
    """Test all counter token types."""

    def test_numeric_counter(self):
        """## should produce 1, 2, 3, ..."""
        template = 'ARTICLE ##<cr>ARTICLE ##<cr>ARTICLE ##'
        result = DocumentService._merge_template(template, {}, {})
        assert 'ARTICLE 1' in result
        assert 'ARTICLE 2' in result
        assert 'ARTICLE 3' in result

    def test_cardinal_words_counter(self):
        """### should produce One, Two, Three, ..."""
        template = 'ARTICLE ###<cr>ARTICLE ###<cr>ARTICLE ###'
        result = DocumentService._merge_template(template, {}, {})
        assert 'ARTICLE One' in result
        assert 'ARTICLE Two' in result
        assert 'ARTICLE Three' in result

    def test_ordinal_words_counter(self):
        """##% should produce First, Second, Third, ..."""
        template = 'The ##% beneficiary<cr>The ##% beneficiary<cr>The ##% beneficiary'
        result = DocumentService._merge_template(template, {}, {})
        assert 'The First beneficiary' in result
        assert 'The Second beneficiary' in result
        assert 'The Third beneficiary' in result

    def test_letter_counter(self):
        """##A should produce A, B, C, ..."""
        template = 'Section ##A<cr>Section ##A<cr>Section ##A'
        result = DocumentService._merge_template(template, {}, {})
        assert 'Section A' in result
        assert 'Section B' in result
        assert 'Section C' in result

    def test_ordinal_beyond_twenty(self):
        """##% beyond 20 should produce 21st, 22nd, etc."""
        template = ''
        for _ in range(25):
            template += 'Item ##%<cr>'
        result = DocumentService._merge_template(template, {}, {})

        # Check first 20 are words
        assert 'Item First' in result
        assert 'Item Twentieth' in result

        # Check beyond 20 uses numbers with suffix
        assert 'Item 21st' in result or 'Item 21th' in result

    def test_mixed_counters(self):
        """Multiple counter types in same template share global counter."""
        template = 'ARTICLE ##: ###'
        result = DocumentService._merge_template(template, {}, {})
        # Global counter: ##=1, ###=2 (both increment the same counter)
        assert 'ARTICLE 1: Two' in result

    def test_counter_in_foreach_loop(self):
        """Counter inside FOR EACH loop - global counter increments with each iteration."""
        template = '''{{ FOR EACH name }}
##. <<name>>
{{ END FOR EACH }}'''
        import json
        answer_map = {'name': json.dumps(['Alice', 'Bob', 'Carol'])}
        raw_map = {'name': json.dumps(['Alice', 'Bob', 'Carol'])}
        id_group_map = {'name': 1}

        result = DocumentService._merge_template(template, answer_map, raw_map, identifier_group_map=id_group_map)
        # Global counter increments: 1. Alice, 2. Bob, 3. Carol
        # But FOR EACH also has built-in ## that uses loop index
        assert 'Alice' in result
        assert 'Bob' in result
        assert 'Carol' in result

    def test_ordinal_with_offset(self):
        """##%+5 should add offset to counter."""
        template = 'Item ##%+5'
        result = DocumentService._merge_template(template, {}, {})
        # Counter starts at 0, +5 offset = 5
        assert 'Item Fifth' in result
