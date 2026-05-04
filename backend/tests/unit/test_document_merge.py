"""Unit tests for document template merge logic — macros, identifiers, array indexing."""

import json
import pytest
from docx import Document
from docx.shared import Pt
from src.services.document_service import DocumentService


class TestMergeDocumentFooter:
    """Regression tests for Word footer metadata on merged documents."""

    def test_add_merge_footer_includes_page_field_and_input_form_name(self):
        doc = Document()

        DocumentService._add_merge_footer(doc, "Will question group 5-2-26")

        footer_paragraph = doc.sections[0].footer.paragraphs[0]
        footer_xml = footer_paragraph._p.xml

        assert "PAGE" in footer_xml
        assert "Will question group 5-2-26" in footer_paragraph.text
        assert footer_paragraph.text.startswith("\t")
        assert footer_paragraph.runs[-1].font.size == Pt(8)


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

    def test_macro_space_strong_tag_traps_space(self):
        """Quill puts space inside <strong> between macro usage and text — space must survive."""
        template = '<p><span>@@macro_1@@jeff@@</span></p><p><span>I, @macro_1@</span><strong> </strong><span>of Ohio</span></p>'
        result = DocumentService._merge_template(template, {}, {})
        assert 'jeff of Ohio' in result

    def test_macro_split_across_strong_tags(self):
        """Quill can split @macro@ across <strong>/<span> tags — macro must still match."""
        template = '<p><span>@@client@@jeff@@</span></p><p><strong>@</strong><span>client</span><strong>@</strong><span> is here</span></p>'
        result = DocumentService._merge_template(template, {}, {})
        assert 'jeff is here' in result

    def test_macro_split_across_em_tags(self):
        """Quill can split @macro@ across <em> tags — macro must still match."""
        template = '<p><span>@@name@@alice@@</span></p><p><em>@</em><span>name</span><em>@</em> hello</p>'
        result = DocumentService._merge_template(template, {}, {})
        assert 'alice hello' in result

    def test_identifier_split_across_strong_tags(self):
        """Quill can split <<id>> across <strong> tags — identifier must still resolve."""
        template = '<p><strong>&lt;&lt;</strong><span>city</span><strong>&gt;&gt;</strong></p>'
        answer_map = {'city': 'Columbus'}
        raw_map = {'city': 'Columbus'}
        result = DocumentService._merge_template(template, answer_map, raw_map)
        assert 'Columbus' in result


class TestIfIdentifierComparison:
    """IF conditions comparing two identifiers (one may be subscripted)."""

    def test_if_ident_eq_ident_subscript_inside_foreach(self):
        """{{IF principal = principal[1]}} should match only the first iteration."""
        template = (
            '@@client@@<<principal[2]>>@@ '
            '{{FOR EACH <<principal>>}}'
            '{{IF principal = principal[1]}}FIRST '
            '{{ELSE}}OTHER '
            '{{END}}'
            '{{END FOR EACH}}'
        )
        answer_map = {
            'principal': json.dumps(['Alice', 'Bob']),
        }
        raw_map = dict(answer_map)
        id_group_map = {'principal': 1}

        result = DocumentService._merge_template(
            template, answer_map, raw_map,
            identifier_group_map=id_group_map
        )
        assert 'FIRST' in result
        assert 'OTHER' in result
        # FIRST should appear once (for Alice), OTHER once (for Bob)
        assert result.count('FIRST') == 1
        assert result.count('OTHER') == 1

    def test_if_ident_neq_ident_subscript(self):
        """{{IF principal != principal[1]}} should match all except the first."""
        template = (
            '{{FOR EACH <<principal>>}}'
            '{{IF principal != principal[1]}}NOT_FIRST '
            '{{END}}'
            '{{END FOR EACH}}'
        )
        answer_map = {
            'principal': json.dumps(['Alice', 'Bob', 'Carol']),
        }
        raw_map = dict(answer_map)
        id_group_map = {'principal': 1}

        result = DocumentService._merge_template(
            template, answer_map, raw_map,
            identifier_group_map=id_group_map
        )
        # NOT_FIRST should appear for Bob and Carol (2 times), not for Alice
        assert result.count('NOT_FIRST') == 2

    def test_subscripted_identifier_resolves_in_foreach_body(self):
        """<<principal[2]>> inside FOR EACH should resolve to second array element."""
        template = (
            '{{FOR EACH <<principal>>}}'
            '<<principal[2]>> '
            '{{END FOR EACH}}'
        )
        answer_map = {
            'principal': json.dumps(['Alice', 'Bob']),
        }
        raw_map = dict(answer_map)
        id_group_map = {'principal': 1}

        result = DocumentService._merge_template(
            template, answer_map, raw_map,
            identifier_group_map=id_group_map
        )
        assert 'Bob' in result


class TestCountFunction:
    """count() function in IF conditions and direct output."""

    def test_count_eq_in_if(self):
        """{{IF count(names) = 3}} should be true for a 3-element array."""
        template = '{{IF count(names) = 3}}YES{{ELSE}}NO{{END}}'
        raw = json.dumps(['Alice', 'Bob', 'Carol'])
        result = DocumentService._merge_template(template, {'names': raw}, {'names': raw})
        assert 'YES' in result
        assert 'NO' not in result

    def test_count_neq_in_if(self):
        template = '{{IF count(names) != 2}}NOT_TWO{{END}}'
        raw = json.dumps(['Alice', 'Bob', 'Carol'])
        result = DocumentService._merge_template(template, {'names': raw}, {'names': raw})
        assert 'NOT_TWO' in result

    def test_count_gt_in_if(self):
        template = '{{IF count(names) > 1}}MULTIPLE{{ELSE}}SINGLE{{END}}'
        raw = json.dumps(['Alice', 'Bob'])
        result = DocumentService._merge_template(template, {'names': raw}, {'names': raw})
        assert 'MULTIPLE' in result

    def test_count_lt_in_if(self):
        template = '{{IF count(names) < 2}}FEW{{ELSE}}MANY{{END}}'
        raw = json.dumps(['Alice'])
        result = DocumentService._merge_template(template, {'names': raw}, {'names': raw})
        assert 'FEW' in result

    def test_count_gte_in_if(self):
        template = '{{IF count(names) >= 2}}OK{{ELSE}}NO{{END}}'
        raw = json.dumps(['Alice', 'Bob'])
        result = DocumentService._merge_template(template, {'names': raw}, {'names': raw})
        assert 'OK' in result

    def test_count_lte_in_if(self):
        template = '{{IF count(names) <= 1}}ONE_OR_LESS{{ELSE}}MORE{{END}}'
        raw = json.dumps(['Alice', 'Bob'])
        result = DocumentService._merge_template(template, {'names': raw}, {'names': raw})
        assert 'MORE' in result

    def test_count_empty_array(self):
        template = '{{IF count(names) = 0}}EMPTY{{ELSE}}HAS{{END}}'
        raw = json.dumps([])
        result = DocumentService._merge_template(template, {'names': raw}, {'names': raw})
        assert 'EMPTY' in result

    def test_count_scalar_value(self):
        """A scalar (non-array) value should count as 1."""
        template = '{{IF count(city) = 1}}SCALAR{{END}}'
        result = DocumentService._merge_template(template, {'city': 'Columbus'}, {'city': 'Columbus'})
        assert 'SCALAR' in result

    def test_count_direct_output(self):
        """<<count(names)>> should output the array length."""
        template = 'There are <<count(names)>> people.'
        raw = json.dumps(['Alice', 'Bob', 'Carol'])
        result = DocumentService._merge_template(template, {'names': raw}, {'names': raw})
        assert 'There are 3 people.' in result

    def test_count_direct_output_empty(self):
        template = '<<count(missing)>> items'
        result = DocumentService._merge_template(template, {}, {})
        assert '0 items' in result

    def test_count_quoted_number_in_if(self):
        """count() should accept quoted numbers like count(names) = "2"."""
        template = '{{IF count(names) = "2"}}PAIR{{END}}'
        raw = json.dumps(['Alice', 'Bob'])
        result = DocumentService._merge_template(template, {'names': raw}, {'names': raw})
        assert 'PAIR' in result


class TestNoLeadingWhitespace:
    """Verify IF/SWITCH blocks produce no leading whitespace.

    _merge_template wraps output in <p>...</p> tags, so we check
    that content immediately follows '<p>' with no space.
    """

    def test_if_at_start_no_leading_space(self):
        """IF block at document start should have no leading space."""
        template = '{{IF name}}Hello{{END}}'
        am = {'name': 'Joe'}
        result = DocumentService._merge_template(template, am, am)
        assert '<p>Hello</p>' == result

    def test_if_after_macro_no_leading_space(self):
        """Macro definition + IF block should have no leading space after macro is removed."""
        template = '@@client@@<<principal>>@@ {{IF name}}Hello{{END}}'
        am = {'name': 'Joe', 'principal': 'Mary'}
        result = DocumentService._merge_template(template, am, am)
        assert result.startswith('<p>Hello'), f"Expected '<p>Hello' at start, got: {repr(result[:20])}"
        assert '<p> ' not in result, f"Found '<p> ' (space after p tag): {repr(result[:20])}"

    def test_switch_at_start_no_leading_space(self):
        """SWITCH block at document start should have no leading space."""
        template = '{{SWITCH <<color>>}}{{CASE "red"}}RED{{END SWITCH}}'
        am = {'color': 'red'}
        result = DocumentService._merge_template(template, am, am)
        assert '<p>RED</p>' == result

    def test_switch_after_macro_no_leading_space(self):
        """Macro definition + SWITCH block should have no leading space."""
        template = '@@client@@<<principal>>@@ {{SWITCH <<color>>}}{{CASE "red"}}RED{{END SWITCH}}'
        am = {'color': 'red', 'principal': 'Mary'}
        result = DocumentService._merge_template(template, am, am)
        assert '<p> ' not in result, f"Found '<p> ' (space after p tag): {repr(result[:20])}"

    def test_if_else_no_leading_space(self):
        template = '{{IF missing}}YES{{ELSE}}NO{{END}}'
        am = {}
        result = DocumentService._merge_template(template, am, am)
        assert '<p>NO</p>' == result

    def test_if_after_empty_paragraph_no_leading_space(self):
        """Simulates Quill HTML: macro + empty paragraph + IF block."""
        template = '<p>@@client@@&lt;&lt;principal&gt;&gt;@@</p><p><br></p><p>{{IF name}}Hello{{END}}</p>'
        am = {'name': 'Joe', 'principal': 'Mary'}
        result = DocumentService._merge_template(template, am, am)
        assert '<p> ' not in result, f"Found '<p> ' (space after p tag): {repr(result[:30])}"
        assert '<p>Hello</p>' == result

    def test_bom_character_stripped(self):
        """BOM (U+FEFF) from Quill editor must not appear in output."""
        template = '\ufeff<p>{{IF name}}Hello{{END}}</p>'
        am = {'name': 'Joe'}
        result = DocumentService._merge_template(template, am, am)
        assert '\ufeff' not in result, f"BOM found in output: {repr(result[:20])}"
        assert '<p>Hello</p>' == result

    def test_bom_with_macro_no_leading_space(self):
        """BOM + macro + IF block should produce clean output."""
        template = '\ufeff<p>@@client@@&lt;&lt;principal&gt;&gt;@@</p><p><br></p><p>{{IF name}}Hello{{END}}</p>'
        am = {'name': 'Joe', 'principal': 'Mary'}
        result = DocumentService._merge_template(template, am, am)
        assert '\ufeff' not in result, f"BOM found in output: {repr(result[:20])}"
        assert '<p> ' not in result, f"Leading space in p tag: {repr(result[:20])}"
        assert '<p>Hello</p>' == result


class TestCompoundConditions:
    """Tests for AND / OR compound conditions in {{IF}} blocks."""

    def test_and_both_true(self):
        template = '{{IF state = "FL" AND status = "married"}}YES{{END}}'
        am = {'state': 'FL', 'status': 'married'}
        result = DocumentService._merge_template(template, am, am)
        assert 'YES' in result

    def test_and_one_false(self):
        template = '{{IF state = "FL" AND status = "married"}}YES{{END}}'
        am = {'state': 'FL', 'status': 'single'}
        result = DocumentService._merge_template(template, am, am)
        assert 'YES' not in result

    def test_and_both_false(self):
        template = '{{IF state = "FL" AND status = "married"}}YES{{END}}'
        am = {'state': 'CA', 'status': 'single'}
        result = DocumentService._merge_template(template, am, am)
        assert 'YES' not in result

    def test_or_both_true(self):
        template = '{{IF state = "FL" OR state = "CA"}}YES{{END}}'
        am = {'state': 'FL'}
        result = DocumentService._merge_template(template, am, am)
        assert 'YES' in result

    def test_or_first_true(self):
        template = '{{IF state = "FL" OR status = "married"}}YES{{END}}'
        am = {'state': 'FL', 'status': 'single'}
        result = DocumentService._merge_template(template, am, am)
        assert 'YES' in result

    def test_or_second_true(self):
        template = '{{IF state = "CA" OR status = "married"}}YES{{END}}'
        am = {'state': 'FL', 'status': 'married'}
        result = DocumentService._merge_template(template, am, am)
        assert 'YES' in result

    def test_or_both_false(self):
        template = '{{IF state = "CA" OR status = "married"}}YES{{END}}'
        am = {'state': 'FL', 'status': 'single'}
        result = DocumentService._merge_template(template, am, am)
        assert 'YES' not in result

    def test_and_with_else(self):
        template = '{{IF state = "FL" AND status = "married"}}YES{{ELSE}}NO{{END}}'
        am = {'state': 'FL', 'status': 'single'}
        result = DocumentService._merge_template(template, am, am)
        assert 'NO' in result
        assert 'YES' not in result

    def test_or_with_else(self):
        template = '{{IF state = "CA" OR status = "married"}}YES{{ELSE}}NO{{END}}'
        am = {'state': 'FL', 'status': 'single'}
        result = DocumentService._merge_template(template, am, am)
        assert 'NO' in result

    def test_and_or_precedence(self):
        """AND binds tighter than OR: A AND B OR C = (A AND B) OR C."""
        template = '{{IF state = "CA" AND status = "married" OR override = "yes"}}YES{{END}}'
        am = {'state': 'FL', 'status': 'single', 'override': 'yes'}
        result = DocumentService._merge_template(template, am, am)
        assert 'YES' in result

    def test_and_or_precedence_false(self):
        """(A AND B) OR C — all false."""
        template = '{{IF state = "CA" AND status = "married" OR override = "yes"}}YES{{END}}'
        am = {'state': 'FL', 'status': 'single', 'override': 'no'}
        result = DocumentService._merge_template(template, am, am)
        assert 'YES' not in result

    def test_and_with_count(self):
        """AND with count() function."""
        template = '{{IF count(names) >= 2 AND state = "FL"}}YES{{END}}'
        raw = json.dumps(['Alice', 'Bob'])
        am = {'names': raw, 'state': 'FL'}
        result = DocumentService._merge_template(template, am, am)
        assert 'YES' in result

    def test_or_with_not(self):
        """OR with NOT condition."""
        template = '{{IF NOT spouse OR status = "single"}}ALONE{{END}}'
        am = {'status': 'single'}
        result = DocumentService._merge_template(template, am, am)
        assert 'ALONE' in result

    def test_and_with_truthy(self):
        """AND with bare truthy identifiers."""
        template = '{{IF spouse AND children}}FAMILY{{END}}'
        am = {'spouse': 'Jane', 'children': 'yes'}
        result = DocumentService._merge_template(template, am, am)
        assert 'FAMILY' in result

    def test_and_with_truthy_one_empty(self):
        template = '{{IF spouse AND children}}FAMILY{{END}}'
        am = {'spouse': 'Jane', 'children': ''}
        result = DocumentService._merge_template(template, am, am)
        assert 'FAMILY' not in result

    def test_triple_and(self):
        template = '{{IF a = "1" AND b = "2" AND c = "3"}}YES{{END}}'
        am = {'a': '1', 'b': '2', 'c': '3'}
        result = DocumentService._merge_template(template, am, am)
        assert 'YES' in result

    def test_triple_or(self):
        template = '{{IF a = "1" OR b = "2" OR c = "3"}}YES{{END}}'
        am = {'a': 'x', 'b': 'x', 'c': '3'}
        result = DocumentService._merge_template(template, am, am)
        assert 'YES' in result

    def test_case_insensitive_and_or(self):
        """AND/OR keywords should be case-insensitive."""
        template = '{{IF state = "FL" and status = "married"}}YES{{END}}'
        am = {'state': 'FL', 'status': 'married'}
        result = DocumentService._merge_template(template, am, am)
        assert 'YES' in result

        template2 = '{{IF state = "CA" or state = "FL"}}YES{{END}}'
        result2 = DocumentService._merge_template(template2, am, am)
        assert 'YES' in result2


class TestSwitchCase:
    """Tests for {{ SWITCH }} / {{ CASE }} / {{ ELSE }} / {{ END SWITCH }} blocks."""

    def test_switch_case_match(self):
        template = '{{SWITCH <<color>>}}{{CASE "red"}}RED{{CASE "blue"}}BLUE{{END SWITCH}}'
        am = {'color': 'red'}
        result = DocumentService._merge_template(template, am, am)
        assert 'RED' in result
        assert 'BLUE' not in result

    def test_switch_case_second_match(self):
        template = '{{SWITCH <<color>>}}{{CASE "red"}}RED{{CASE "blue"}}BLUE{{END SWITCH}}'
        am = {'color': 'blue'}
        result = DocumentService._merge_template(template, am, am)
        assert 'BLUE' in result
        assert 'RED' not in result

    def test_switch_no_match_no_else(self):
        template = 'Before {{SWITCH <<color>>}}{{CASE "red"}}RED{{CASE "blue"}}BLUE{{END SWITCH}} After'
        am = {'color': 'green'}
        result = DocumentService._merge_template(template, am, am)
        assert 'RED' not in result
        assert 'BLUE' not in result
        assert 'Before' in result
        assert 'After' in result

    def test_switch_else_fallback(self):
        template = '{{SWITCH <<color>>}}{{CASE "red"}}RED{{ELSE}}OTHER{{END SWITCH}}'
        am = {'color': 'green'}
        result = DocumentService._merge_template(template, am, am)
        assert 'OTHER' in result
        assert 'RED' not in result

    def test_switch_case_insensitive(self):
        """CASE matching should be case-insensitive."""
        template = '{{SWITCH <<color>>}}{{CASE "Red"}}FOUND{{END SWITCH}}'
        am = {'color': 'red'}
        result = DocumentService._merge_template(template, am, am)
        assert 'FOUND' in result

    def test_switch_with_angle_brackets(self):
        """Identifier can be wrapped in << >> or not."""
        template = '{{SWITCH color}}{{CASE "red"}}RED{{END SWITCH}}'
        am = {'color': 'red'}
        result = DocumentService._merge_template(template, am, am)
        assert 'RED' in result

    def test_switch_first_case_wins(self):
        """First matching CASE should win."""
        template = '{{SWITCH <<x>>}}{{CASE "a"}}FIRST{{CASE "a"}}SECOND{{END SWITCH}}'
        am = {'x': 'a'}
        result = DocumentService._merge_template(template, am, am)
        assert 'FIRST' in result
        assert 'SECOND' not in result

    def test_switch_with_nested_if(self):
        """CASE body can contain IF blocks."""
        template = '{{SWITCH <<state>>}}{{CASE "FL"}}{{IF spouse}}FL-MARRIED{{ELSE}}FL-SINGLE{{END}}{{END SWITCH}}'
        am = {'state': 'FL', 'spouse': 'Jane'}
        result = DocumentService._merge_template(template, am, am)
        assert 'FL-MARRIED' in result

    def test_switch_keywords_case_insensitive(self):
        """SWITCH/CASE/END SWITCH keywords should be case-insensitive."""
        template = '{{switch <<color>>}}{{case "red"}}RED{{else}}OTHER{{end switch}}'
        am = {'color': 'red'}
        result = DocumentService._merge_template(template, am, am)
        assert 'RED' in result

    def test_switch_smart_quotes(self):
        """CASE values can use smart quotes."""
        template = '{{SWITCH <<color>>}}{{CASE \u201cred\u201d}}RED{{END SWITCH}}'
        am = {'color': 'red'}
        result = DocumentService._merge_template(template, am, am)
        assert 'RED' in result

    def test_switch_multiple_cases_with_else(self):
        template = '{{SWITCH <<role>>}}{{CASE "admin"}}ADMIN{{CASE "editor"}}EDITOR{{CASE "viewer"}}VIEWER{{ELSE}}UNKNOWN{{END SWITCH}}'
        am = {'role': 'editor'}
        result = DocumentService._merge_template(template, am, am)
        assert 'EDITOR' in result
        assert 'ADMIN' not in result
        assert 'VIEWER' not in result
        assert 'UNKNOWN' not in result

    def test_switch_empty_identifier(self):
        """Empty identifier should fall through to ELSE."""
        template = '{{SWITCH <<missing>>}}{{CASE "a"}}A{{ELSE}}EMPTY{{END SWITCH}}'
        am = {}
        result = DocumentService._merge_template(template, am, am)
        assert 'EMPTY' in result

    def test_multiple_switch_blocks(self):
        """Multiple SWITCH blocks in same template."""
        template = '{{SWITCH <<a>>}}{{CASE "1"}}ONE{{END SWITCH}} and {{SWITCH <<b>>}}{{CASE "2"}}TWO{{END SWITCH}}'
        am = {'a': '1', 'b': '2'}
        result = DocumentService._merge_template(template, am, am)
        assert 'ONE' in result
        assert 'TWO' in result

    def test_switch_unquoted_case_number(self):
        """CASE values should work without quotes (e.g. {{ CASE 1 }})."""
        template = '{{SWITCH count(bene)}}{{CASE 1}}one bene{{CASE 2}}two benes{{CASE 3}}three benes{{ELSE}}many benes{{END SWITCH}}'
        raw = json.dumps(['Alice', 'Bob'])
        am = {'bene': raw}
        result = DocumentService._merge_template(template, am, am)
        assert 'two benes' in result

    def test_switch_unquoted_case_string(self):
        """Unquoted string CASE values."""
        template = '{{SWITCH <<name>>}}{{CASE joe}}JOE{{CASE tom}}TOM{{ELSE}}OTHER{{END SWITCH}}'
        am = {'name': 'joe'}
        result = DocumentService._merge_template(template, am, am)
        assert 'JOE' in result
        assert 'TOM' not in result

    def test_switch_unquoted_case_no_match(self):
        template = '{{SWITCH <<name>>}}{{CASE joe}}JOE{{CASE tom}}TOM{{ELSE}}OTHER{{END SWITCH}}'
        am = {'name': 'alice'}
        result = DocumentService._merge_template(template, am, am)
        assert 'OTHER' in result


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
