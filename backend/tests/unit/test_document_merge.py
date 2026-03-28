"""Unit tests for document template merge logic — macros, identifiers, array indexing."""

import json
import pytest
from src.services.document_service import DocumentService


class TestMacroWithArrayIndex:
    """Regression tests: macro containing <<identifier[N]>> must resolve."""

    def test_macro_with_array_index_outside_foreach(self):
        """@@var@@<<group[1]>>@@ then @var@ should resolve to first array element."""
        template = '@@var@@<<group[1]>>@@ Result: @var@'
        answer_map = {'group': json.dumps(['Alice', 'Bob', 'Carol'])}
        raw_map = {'group': json.dumps(['Alice', 'Bob', 'Carol'])}

        result = DocumentService._merge_template(template, answer_map, raw_map)
        assert 'Alice' in result
        assert 'Result: Alice' in result

    def test_macro_with_array_index_second_element(self):
        """<<group[2]>> in macro should resolve to second array element."""
        template = '@@second@@<<group[2]>>@@ Value: @second@'
        answer_map = {'group': json.dumps(['Alice', 'Bob', 'Carol'])}
        raw_map = {'group': json.dumps(['Alice', 'Bob', 'Carol'])}

        result = DocumentService._merge_template(template, answer_map, raw_map)
        assert 'Bob' in result

    def test_array_index_inside_foreach_preserved(self):
        """<<other[1]>> inside FOR EACH should not be consumed by the loop."""
        template = (
            '{{ FOR EACH name }}'
            '<<name>> sees <<other[1]>> '
            '{{ END FOR EACH }}'
        )
        answer_map = {
            'name': json.dumps(['X', 'Y']),
            'other': json.dumps(['Alpha', 'Beta']),
        }
        raw_map = dict(answer_map)
        id_group_map = {'name': 1}

        result = DocumentService._merge_template(
            template, answer_map, raw_map,
            identifier_group_map=id_group_map
        )
        # <<other[1]>> should resolve to "Alpha" (first element) in every iteration
        assert result.count('Alpha') == 2

    def test_array_index_inside_conditional_brackets(self):
        """<<group[1]>> inside [[ ... ]] should resolve, not remove section."""
        template = '[[Name: <<group[1]>>]]'
        answer_map = {'group': json.dumps(['Alice', 'Bob'])}
        raw_map = {'group': json.dumps(['Alice', 'Bob'])}

        result = DocumentService._merge_template(template, answer_map, raw_map)
        assert 'Name: Alice' in result

    def test_array_index_empty_removes_conditional_section(self):
        """<<group[5]>> out-of-range inside [[ ... ]] should remove section."""
        template = 'Before [[Name: <<group[5]>>]] After'
        answer_map = {'group': json.dumps(['Alice', 'Bob'])}
        raw_map = {'group': json.dumps(['Alice', 'Bob'])}

        result = DocumentService._merge_template(template, answer_map, raw_map)
        assert 'Name:' not in result

    def test_plain_macro_still_works(self):
        """Basic macro without array indexing still works."""
        template = '@@firm@@ Smith & Associates @@ Prepared by @firm@.'
        answer_map = {}
        raw_map = {}

        result = DocumentService._merge_template(template, answer_map, raw_map)
        assert 'Smith & Associates' in result

    def test_macro_with_identifier_resolves(self):
        """Macro containing <<identifier>> (no index) resolves in Pass 5."""
        template = '@@who@@<<client>>@@ Hello @who@!'
        answer_map = {'client': 'John Doe'}
        raw_map = {'client': 'John Doe'}

        result = DocumentService._merge_template(template, answer_map, raw_map)
        assert 'John Doe' in result


class TestArrayIndexDirect:
    """Direct <<identifier[N]>> usage (no macro) with array indexing."""

    def test_simple_array_index(self):
        template = 'First: <<names[1]>>, Second: <<names[2]>>'
        raw = json.dumps(['Alice', 'Bob', 'Carol'])
        answer_map = {'names': raw}
        raw_map = {'names': raw}

        result = DocumentService._merge_template(template, answer_map, raw_map)
        assert 'First: Alice' in result
        assert 'Second: Bob' in result

    def test_person_array_index_with_field(self):
        template = 'Primary: <<trustee[1].name>>'
        raw = json.dumps([{'name': 'Alice Smith'}, {'name': 'Bob Jones'}])
        answer_map = {'trustee': 'Alice Smith and Bob Jones'}
        raw_map = {'trustee': json.dumps([{'name': 'Alice Smith'}, {'name': 'Bob Jones'}])}

        result = DocumentService._merge_template(template, answer_map, raw_map)
        assert 'Primary: Alice Smith' in result
