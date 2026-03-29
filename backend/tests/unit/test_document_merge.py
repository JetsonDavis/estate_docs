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


class TestMacroSpacing:
    """Regression: space after macro usage must be preserved."""

    def test_macro_space_raw_same_line(self):
        """Raw text: @macro_1@ is my name → 'jeff is my name'."""
        template = '@@macro_1@@jeff@@ @macro_1@ is my name'
        result = DocumentService._merge_template(template, {}, {})
        assert 'jeff is my name' in result

    def test_macro_space_raw_separate_lines(self):
        """Definition on separate line from usage."""
        template = '@@macro_1@@jeff@@\n@macro_1@ is my name'
        result = DocumentService._merge_template(template, {}, {})
        assert 'jeff is my name' in result

    def test_macro_space_html_separate_paragraphs(self):
        """HTML paragraphs: definition in one <p>, usage in another."""
        template = '<p>@@macro_1@@jeff@@</p><p>@macro_1@ is my name</p>'
        result = DocumentService._merge_template(template, {}, {})
        assert 'jeff is my name' in result

    def test_macro_space_html_br_between(self):
        """HTML with <br> between definition and usage."""
        template = '<p>@@macro_1@@jeff@@<br>@macro_1@ is my name</p>'
        result = DocumentService._merge_template(template, {}, {})
        assert 'jeff is my name' in result

    def test_macro_space_html_spans(self):
        """HTML with spans wrapping macro and text separately."""
        template = '<p><span>@@macro_1@@jeff@@</span><span> @macro_1@ is my name</span></p>'
        result = DocumentService._merge_template(template, {}, {})
        assert 'jeff is my name' in result

    def test_macro_space_html_usage_span_no_leading_space(self):
        """HTML spans where space is only inside the usage text."""
        template = '<p><span>@@macro_1@@jeff@@</span> <span>@macro_1@ is my name</span></p>'
        result = DocumentService._merge_template(template, {}, {})
        assert 'jeff is my name' in result

    def test_macro_space_html_adjacent_spans(self):
        """Adjacent spans with no space between them."""
        template = '<p><span>@@macro_1@@jeff@@</span></p><p><span>@macro_1@</span><span> is my name</span></p>'
        result = DocumentService._merge_template(template, {}, {})
        assert 'jeff is my name' in result

    def test_macro_space_html_br_between_usage_and_text(self):
        """<br> between macro usage and following text must preserve spacing."""
        template = '<p>@@macro_1@@jeff@@</p><p>@macro_1@<br>is my name</p>'
        result = DocumentService._merge_template(template, {}, {})
        assert 'jeff is my name' in result

    def test_macro_space_html_adjacent_spans_no_space(self):
        """Adjacent spans without any whitespace — editor edge case."""
        template = '<p>@@macro_1@@jeff@@</p><p><span>@macro_1@</span><span>is my name</span></p>'
        result = DocumentService._merge_template(template, {}, {})
        # When spans are truly adjacent with no whitespace at all, text joins;
        # this mirrors browser rendering of adjacent inline elements.
        assert 'jeffis my name' in result or 'jeff is my name' in result


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
