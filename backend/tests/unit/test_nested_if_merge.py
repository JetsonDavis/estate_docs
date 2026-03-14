"""Unit tests for nested IF statement support in _merge_template."""

from src.services.document_service import DocumentService


class TestNestedIfMergeTemplate:
    """Test suite for nested IF blocks in DocumentService._merge_template."""

    # ── Basic single-level IF (regression) ───────────────────────────

    def test_single_if_true(self):
        """Single IF block included when identifier has value."""
        template = "Before {{ IF <<name>> }}Hello <<name>>{{ END }} After"
        answer_map = {"name": "Alice"}
        result = DocumentService._merge_template(template, answer_map)
        assert "Hello Alice" in result
        assert "Before" in result
        assert "After" in result

    def test_single_if_false(self):
        """Single IF block removed when identifier is empty."""
        template = "Before {{ IF <<name>> }}Hello <<name>>{{ END }} After"
        answer_map = {"name": ""}
        result = DocumentService._merge_template(template, answer_map)
        assert "Hello" not in result
        assert "Before" in result
        assert "After" in result

    def test_single_if_not_true(self):
        """Single IF NOT block included when identifier is empty."""
        template = "{{ IF NOT <<name>> }}No name provided{{ END }}"
        answer_map = {"name": ""}
        result = DocumentService._merge_template(template, answer_map)
        assert "No name provided" in result

    def test_single_if_not_false(self):
        """Single IF NOT block removed when identifier has value."""
        template = "{{ IF NOT <<name>> }}No name provided{{ END }}"
        answer_map = {"name": "Alice"}
        result = DocumentService._merge_template(template, answer_map)
        assert "No name provided" not in result

    def test_single_if_equals_true(self):
        """IF equals block included when value matches."""
        template = '{{ IF <<status>> = "active" }}Account is active{{ END }}'
        answer_map = {"status": "active"}
        result = DocumentService._merge_template(template, answer_map)
        assert "Account is active" in result

    def test_single_if_equals_false(self):
        """IF equals block removed when value doesn't match."""
        template = '{{ IF <<status>> = "active" }}Account is active{{ END }}'
        answer_map = {"status": "inactive"}
        result = DocumentService._merge_template(template, answer_map)
        assert "Account is active" not in result

    def test_single_if_not_equals_true(self):
        """IF not-equals block included when value doesn't match."""
        template = '{{ IF <<status>> != "active" }}Account is NOT active{{ END }}'
        answer_map = {"status": "inactive"}
        result = DocumentService._merge_template(template, answer_map)
        assert "Account is NOT active" in result

    def test_single_if_not_equals_false(self):
        """IF not-equals block removed when value matches."""
        template = '{{ IF <<status>> != "active" }}Account is NOT active{{ END }}'
        answer_map = {"status": "active"}
        result = DocumentService._merge_template(template, answer_map)
        assert "Account is NOT active" not in result

    # ── Nested IF blocks ─────────────────────────────────────────────

    def test_nested_if_both_true(self):
        """Nested IF: both outer and inner conditions true."""
        template = (
            "{{ IF <<has_spouse>> }}"
            "Spouse: <<spouse_name>>"
            "{{ IF <<has_children>> }}"
            " and children"
            "{{ END }}"
            "{{ END }}"
        )
        answer_map = {"has_spouse": "yes", "spouse_name": "Jane", "has_children": "yes"}
        result = DocumentService._merge_template(template, answer_map)
        assert "Spouse: Jane" in result
        assert "and children" in result

    def test_nested_if_outer_true_inner_false(self):
        """Nested IF: outer true, inner false — inner content removed."""
        template = (
            "{{ IF <<has_spouse>> }}"
            "Spouse: <<spouse_name>>"
            "{{ IF <<has_children>> }}"
            " and children"
            "{{ END }}"
            "{{ END }}"
        )
        answer_map = {"has_spouse": "yes", "spouse_name": "Jane", "has_children": ""}
        result = DocumentService._merge_template(template, answer_map)
        assert "Spouse: Jane" in result
        assert "and children" not in result

    def test_nested_if_outer_false(self):
        """Nested IF: outer false — entire block removed including inner."""
        template = (
            "{{ IF <<has_spouse>> }}"
            "Spouse: <<spouse_name>>"
            "{{ IF <<has_children>> }}"
            " and children"
            "{{ END }}"
            "{{ END }}"
        )
        answer_map = {"has_spouse": "", "spouse_name": "", "has_children": "yes"}
        result = DocumentService._merge_template(template, answer_map)
        assert "Spouse" not in result
        assert "children" not in result

    def test_nested_if_with_text_between(self):
        """Nested IF with text before, between, and after inner block."""
        template = (
            "Start "
            "{{ IF <<a>> }}"
            "A-before "
            "{{ IF <<b>> }}"
            "B-content "
            "{{ END }}"
            "A-after "
            "{{ END }}"
            "End"
        )
        answer_map = {"a": "yes", "b": "yes"}
        result = DocumentService._merge_template(template, answer_map)
        assert "Start" in result
        assert "A-before" in result
        assert "B-content" in result
        assert "A-after" in result
        assert "End" in result

    def test_nested_if_inner_false_preserves_outer_text(self):
        """When inner IF is false, outer text before and after is preserved."""
        template = (
            "{{ IF <<a>> }}"
            "A-before "
            "{{ IF <<b>> }}"
            "B-content "
            "{{ END }}"
            "A-after "
            "{{ END }}"
        )
        answer_map = {"a": "yes", "b": ""}
        result = DocumentService._merge_template(template, answer_map)
        assert "A-before" in result
        assert "B-content" not in result
        assert "A-after" in result

    # ── Triple nesting ───────────────────────────────────────────────

    def test_triple_nested_if_all_true(self):
        """Three levels of nesting, all true."""
        template = (
            "{{ IF <<a>> }}"
            "Level1 "
            "{{ IF <<b>> }}"
            "Level2 "
            "{{ IF <<c>> }}"
            "Level3"
            "{{ END }}"
            "{{ END }}"
            "{{ END }}"
        )
        answer_map = {"a": "yes", "b": "yes", "c": "yes"}
        result = DocumentService._merge_template(template, answer_map)
        assert "Level1" in result
        assert "Level2" in result
        assert "Level3" in result

    def test_triple_nested_if_middle_false(self):
        """Three levels: middle is false, innermost removed too."""
        template = (
            "{{ IF <<a>> }}"
            "Level1 "
            "{{ IF <<b>> }}"
            "Level2 "
            "{{ IF <<c>> }}"
            "Level3"
            "{{ END }}"
            "{{ END }}"
            "{{ END }}"
        )
        answer_map = {"a": "yes", "b": "", "c": "yes"}
        result = DocumentService._merge_template(template, answer_map)
        assert "Level1" in result
        assert "Level2" not in result
        assert "Level3" not in result

    # ── Mixed IF / IF NOT nesting ────────────────────────────────────

    def test_nested_if_and_if_not(self):
        """IF block containing an IF NOT block."""
        template = (
            "{{ IF <<married>> }}"
            "Married. "
            "{{ IF NOT <<prenup>> }}"
            "No prenuptial agreement."
            "{{ END }}"
            "{{ END }}"
        )
        answer_map = {"married": "yes", "prenup": ""}
        result = DocumentService._merge_template(template, answer_map)
        assert "Married." in result
        assert "No prenuptial agreement." in result

    def test_nested_if_not_containing_if(self):
        """IF NOT block containing an IF block."""
        template = (
            "{{ IF NOT <<has_trust>> }}"
            "No trust exists. "
            "{{ IF <<needs_probate>> }}"
            "Probate required."
            "{{ END }}"
            "{{ END }}"
        )
        answer_map = {"has_trust": "", "needs_probate": "yes"}
        result = DocumentService._merge_template(template, answer_map)
        assert "No trust exists." in result
        assert "Probate required." in result

    def test_nested_if_not_outer_false(self):
        """IF NOT outer is false (identifier has value) — all removed."""
        template = (
            "{{ IF NOT <<has_trust>> }}"
            "No trust exists. "
            "{{ IF <<needs_probate>> }}"
            "Probate required."
            "{{ END }}"
            "{{ END }}"
        )
        answer_map = {"has_trust": "yes", "needs_probate": "yes"}
        result = DocumentService._merge_template(template, answer_map)
        assert "No trust exists" not in result
        assert "Probate required" not in result

    # ── Nested IF with value comparison ──────────────────────────────

    def test_nested_if_equals_inside_if(self):
        """IF equals block nested inside a plain IF block."""
        template = (
            "{{ IF <<has_spouse>> }}"
            "Spouse section. "
            '{{ IF <<marital_status>> = "married" }}'
            "Currently married."
            "{{ END }}"
            "{{ END }}"
        )
        answer_map = {"has_spouse": "yes", "marital_status": "married"}
        result = DocumentService._merge_template(template, answer_map)
        assert "Spouse section." in result
        assert "Currently married." in result

    def test_nested_if_equals_inner_mismatch(self):
        """IF equals nested inside IF — inner comparison fails."""
        template = (
            "{{ IF <<has_spouse>> }}"
            "Spouse section. "
            '{{ IF <<marital_status>> = "married" }}'
            "Currently married."
            "{{ END }}"
            "{{ END }}"
        )
        answer_map = {"has_spouse": "yes", "marital_status": "divorced"}
        result = DocumentService._merge_template(template, answer_map)
        assert "Spouse section." in result
        assert "Currently married." not in result

    def test_nested_if_not_equals_inside_if(self):
        """IF not-equals block nested inside a plain IF block."""
        template = (
            "{{ IF <<has_spouse>> }}"
            "Spouse section. "
            '{{ IF <<marital_status>> != "single" }}'
            "Not single."
            "{{ END }}"
            "{{ END }}"
        )
        answer_map = {"has_spouse": "yes", "marital_status": "married"}
        result = DocumentService._merge_template(template, answer_map)
        assert "Spouse section." in result
        assert "Not single." in result

    # ── Sibling IF blocks ────────────────────────────────────────────

    def test_sibling_if_blocks_both_true(self):
        """Two sibling IF blocks at the same level, both true."""
        template = (
            "{{ IF <<a>> }}A-content{{ END }} "
            "{{ IF <<b>> }}B-content{{ END }}"
        )
        answer_map = {"a": "yes", "b": "yes"}
        result = DocumentService._merge_template(template, answer_map)
        assert "A-content" in result
        assert "B-content" in result

    def test_sibling_if_blocks_one_false(self):
        """Two sibling IF blocks, first true, second false."""
        template = (
            "{{ IF <<a>> }}A-content{{ END }} "
            "{{ IF <<b>> }}B-content{{ END }}"
        )
        answer_map = {"a": "yes", "b": ""}
        result = DocumentService._merge_template(template, answer_map)
        assert "A-content" in result
        assert "B-content" not in result

    # ── Nested siblings inside outer IF ──────────────────────────────

    def test_two_nested_ifs_inside_outer(self):
        """Two sibling IF blocks nested inside an outer IF."""
        template = (
            "{{ IF <<outer>> }}"
            "Outer. "
            "{{ IF <<inner1>> }}Inner1. {{ END }}"
            "{{ IF <<inner2>> }}Inner2. {{ END }}"
            "{{ END }}"
        )
        answer_map = {"outer": "yes", "inner1": "yes", "inner2": "yes"}
        result = DocumentService._merge_template(template, answer_map)
        assert "Outer." in result
        assert "Inner1." in result
        assert "Inner2." in result

    def test_two_nested_ifs_one_false(self):
        """Two sibling IF blocks inside outer, one false."""
        template = (
            "{{ IF <<outer>> }}"
            "Outer. "
            "{{ IF <<inner1>> }}Inner1. {{ END }}"
            "{{ IF <<inner2>> }}Inner2. {{ END }}"
            "{{ END }}"
        )
        answer_map = {"outer": "yes", "inner1": "", "inner2": "yes"}
        result = DocumentService._merge_template(template, answer_map)
        assert "Outer." in result
        assert "Inner1." not in result
        assert "Inner2." in result

    def test_outer_false_removes_all_nested(self):
        """Outer IF false removes all nested siblings."""
        template = (
            "{{ IF <<outer>> }}"
            "Outer. "
            "{{ IF <<inner1>> }}Inner1. {{ END }}"
            "{{ IF <<inner2>> }}Inner2. {{ END }}"
            "{{ END }}"
        )
        answer_map = {"outer": "", "inner1": "yes", "inner2": "yes"}
        result = DocumentService._merge_template(template, answer_map)
        assert "Outer." not in result
        assert "Inner1." not in result
        assert "Inner2." not in result

    # ── Real-world estate document scenario ──────────────────────────

    def test_estate_doc_nested_scenario(self):
        """Realistic estate document with nested conditionals."""
        template = (
            "TRUST AGREEMENT\n\n"
            "Trustor: <<trustor_name>>\n\n"
            "{{ IF <<has_spouse>> }}"
            "ARTICLE III - MARITAL PROVISIONS\n\n"
            "Spouse: <<spouse_name>>\n\n"
            '{{ IF <<marital_status>> = "married" }}'
            "The Trustor and Spouse are currently married.\n\n"
            "{{ IF <<has_prenup>> }}"
            "A prenuptial agreement dated <<prenup_date>> is in effect.\n"
            "{{ END }}"
            "{{ IF NOT <<has_prenup>> }}"
            "No prenuptial agreement exists between the parties.\n"
            "{{ END }}"
            "{{ END }}"
            "{{ END }}"
            "\n"
            "{{ IF <<has_children>> }}"
            "ARTICLE IV - CHILDREN\n\n"
            "The Trustor has the following children:\n"
            "{{ END }}"
        )
        answer_map = {
            "trustor_name": "John Doe",
            "has_spouse": "yes",
            "spouse_name": "Jane Doe",
            "marital_status": "married",
            "has_prenup": "",
            "prenup_date": "",
            "has_children": "yes",
        }
        result = DocumentService._merge_template(template, answer_map)
        assert "Trustor: John Doe" in result
        assert "ARTICLE III - MARITAL PROVISIONS" in result
        assert "Spouse: Jane Doe" in result
        assert "currently married" in result
        assert "No prenuptial agreement exists" in result
        assert "prenuptial agreement dated" not in result
        assert "ARTICLE IV - CHILDREN" in result

    def test_estate_doc_no_spouse(self):
        """Estate doc scenario: no spouse — entire marital section removed."""
        template = (
            "Trustor: <<trustor_name>>\n\n"
            "{{ IF <<has_spouse>> }}"
            "MARITAL PROVISIONS\n"
            "Spouse: <<spouse_name>>\n"
            '{{ IF <<marital_status>> = "married" }}'
            "Currently married.\n"
            "{{ END }}"
            "{{ END }}"
            "\n"
            "GENERAL PROVISIONS"
        )
        answer_map = {
            "trustor_name": "John Doe",
            "has_spouse": "",
            "spouse_name": "",
            "marital_status": "",
        }
        result = DocumentService._merge_template(template, answer_map)
        assert "Trustor: John Doe" in result
        assert "MARITAL PROVISIONS" not in result
        assert "GENERAL PROVISIONS" in result

    # ── Multiline nested IF blocks ───────────────────────────────────

    def test_multiline_nested_if(self):
        """Nested IF blocks spanning multiple lines."""
        template = """DOCUMENT

{{ IF <<section_a>> }}
Section A Content
Line 2 of Section A

{{ IF <<subsection_a1>> }}
Subsection A.1 Content
{{ END }}

End of Section A
{{ END }}

Footer"""
        answer_map = {"section_a": "yes", "subsection_a1": "yes"}
        result = DocumentService._merge_template(template, answer_map)
        assert "Section A Content" in result
        assert "Subsection A.1 Content" in result
        assert "End of Section A" in result
        assert "Footer" in result

    def test_multiline_nested_if_inner_false(self):
        """Multiline nested IF, inner false."""
        template = """DOCUMENT

{{ IF <<section_a>> }}
Section A Content

{{ IF <<subsection_a1>> }}
Subsection A.1 Content
{{ END }}

End of Section A
{{ END }}

Footer"""
        answer_map = {"section_a": "yes", "subsection_a1": ""}
        result = DocumentService._merge_template(template, answer_map)
        assert "Section A Content" in result
        assert "Subsection A.1 Content" not in result
        assert "End of Section A" in result
        assert "Footer" in result

    # ── ELSE support ─────────────────────────────────────────────────

    def test_else_condition_true(self):
        """When IF condition is true, IF body included, ELSE body removed."""
        template = "{{ IF <<name>> }}Hello <<name>>{{ ELSE }}No name{{ END }}"
        answer_map = {"name": "Alice"}
        result = DocumentService._merge_template(template, answer_map)
        assert "Hello Alice" in result
        assert "No name" not in result

    def test_else_condition_false(self):
        """When IF condition is false, ELSE body included."""
        template = "{{ IF <<name>> }}Hello <<name>>{{ ELSE }}No name provided{{ END }}"
        answer_map = {"name": ""}
        result = DocumentService._merge_template(template, answer_map)
        assert "Hello" not in result
        assert "No name provided" in result

    def test_else_with_if_not(self):
        """ELSE with IF NOT: condition true (empty) → IF body; false (has value) → ELSE body."""
        template = "{{ IF NOT <<name>> }}Anonymous{{ ELSE }}Known: <<name>>{{ END }}"
        # name is empty → IF NOT is true → IF body
        result = DocumentService._merge_template(template, {"name": ""})
        assert "Anonymous" in result
        assert "Known" not in result
        # name has value → IF NOT is false → ELSE body
        result = DocumentService._merge_template(template, {"name": "Alice"})
        assert "Anonymous" not in result
        assert "Known: Alice" in result

    def test_else_with_equality(self):
        """ELSE with value comparison."""
        template = '{{ IF <<status>> = "active" }}Active account{{ ELSE }}Inactive account{{ END }}'
        result = DocumentService._merge_template(template, {"status": "active"})
        assert "Active account" in result
        assert "Inactive account" not in result
        result = DocumentService._merge_template(template, {"status": "suspended"})
        assert "Active account" not in result
        assert "Inactive account" in result

    def test_else_with_inequality(self):
        """ELSE with != comparison."""
        template = '{{ IF <<role>> != "admin" }}Regular user{{ ELSE }}Admin user{{ END }}'
        result = DocumentService._merge_template(template, {"role": "viewer"})
        assert "Regular user" in result
        assert "Admin user" not in result
        result = DocumentService._merge_template(template, {"role": "admin"})
        assert "Regular user" not in result
        assert "Admin user" in result

    def test_else_with_surrounding_text(self):
        """ELSE preserves text before and after the block."""
        template = "Before {{ IF <<x>> }}YES{{ ELSE }}NO{{ END }} After"
        result = DocumentService._merge_template(template, {"x": "1"})
        assert "Before" in result
        assert "YES" in result
        assert "NO" not in result
        assert "After" in result
        result = DocumentService._merge_template(template, {"x": ""})
        assert "Before" in result
        assert "YES" not in result
        assert "NO" in result
        assert "After" in result

    # ── Nested ELSE ──────────────────────────────────────────────────

    def test_nested_if_else_inside_if(self):
        """IF/ELSE nested inside an outer IF block."""
        template = (
            "{{ IF <<has_spouse>> }}"
            "Spouse: "
            "{{ IF <<spouse_name>> }}<<spouse_name>>{{ ELSE }}Name unknown{{ END }}"
            "{{ END }}"
        )
        result = DocumentService._merge_template(template, {"has_spouse": "yes", "spouse_name": "Jane"})
        assert "Spouse:" in result
        assert "Jane" in result
        assert "unknown" not in result

        result = DocumentService._merge_template(template, {"has_spouse": "yes", "spouse_name": ""})
        assert "Spouse:" in result
        assert "Name unknown" in result

        result = DocumentService._merge_template(template, {"has_spouse": "", "spouse_name": "Jane"})
        assert "Spouse" not in result
        assert "Jane" not in result

    def test_nested_if_else_inside_else(self):
        """IF/ELSE nested inside an ELSE branch."""
        template = (
            "{{ IF <<has_trust>> }}"
            "Trust exists."
            "{{ ELSE }}"
            "No trust. "
            "{{ IF <<needs_probate>> }}Probate required.{{ ELSE }}No probate needed.{{ END }}"
            "{{ END }}"
        )
        result = DocumentService._merge_template(template, {"has_trust": "yes", "needs_probate": "yes"})
        assert "Trust exists." in result
        assert "No trust" not in result

        result = DocumentService._merge_template(template, {"has_trust": "", "needs_probate": "yes"})
        assert "Trust exists" not in result
        assert "No trust." in result
        assert "Probate required." in result

        result = DocumentService._merge_template(template, {"has_trust": "", "needs_probate": ""})
        assert "No trust." in result
        assert "No probate needed." in result

    def test_else_with_nested_inner_else(self):
        """Both outer and inner IF blocks have ELSE branches."""
        template = (
            "{{ IF <<a>> }}"
            "A-true "
            "{{ IF <<b>> }}B-true{{ ELSE }}B-false{{ END }}"
            "{{ ELSE }}"
            "A-false "
            "{{ IF <<c>> }}C-true{{ ELSE }}C-false{{ END }}"
            "{{ END }}"
        )
        result = DocumentService._merge_template(template, {"a": "1", "b": "1", "c": "1"})
        assert "A-true" in result
        assert "B-true" in result
        assert "A-false" not in result

        result = DocumentService._merge_template(template, {"a": "1", "b": "", "c": ""})
        assert "A-true" in result
        assert "B-false" in result
        assert "A-false" not in result

        result = DocumentService._merge_template(template, {"a": "", "b": "", "c": "1"})
        assert "A-false" in result
        assert "C-true" in result
        assert "A-true" not in result

        result = DocumentService._merge_template(template, {"a": "", "b": "", "c": ""})
        assert "A-false" in result
        assert "C-false" in result

    def test_sibling_if_else_blocks(self):
        """Two sibling IF/ELSE blocks at the same level."""
        template = (
            "{{ IF <<a>> }}A-yes{{ ELSE }}A-no{{ END }} "
            "{{ IF <<b>> }}B-yes{{ ELSE }}B-no{{ END }}"
        )
        result = DocumentService._merge_template(template, {"a": "1", "b": ""})
        assert "A-yes" in result
        assert "A-no" not in result
        assert "B-yes" not in result
        assert "B-no" in result

    # ── Real-world estate scenario with ELSE ─────────────────────────

    def test_estate_doc_else_scenario(self):
        """Realistic estate document using IF/ELSE for marital provisions."""
        template = (
            "TRUST AGREEMENT\n\n"
            "Trustor: <<trustor_name>>\n\n"
            "{{ IF <<has_spouse>> }}"
            "MARITAL PROVISIONS\n"
            "Spouse: <<spouse_name>>\n"
            "{{ IF <<has_prenup>> }}"
            "A prenuptial agreement is in effect.\n"
            "{{ ELSE }}"
            "No prenuptial agreement exists between the parties.\n"
            "{{ END }}"
            "{{ ELSE }}"
            "The Trustor is unmarried.\n"
            "{{ END }}"
            "\nGENERAL PROVISIONS"
        )
        # Married with prenup
        result = DocumentService._merge_template(template, {
            "trustor_name": "John Doe",
            "has_spouse": "yes",
            "spouse_name": "Jane Doe",
            "has_prenup": "yes",
        })
        assert "Trustor: John Doe" in result
        assert "MARITAL PROVISIONS" in result
        assert "Spouse: Jane Doe" in result
        assert "prenuptial agreement is in effect" in result
        assert "unmarried" not in result

        # Married without prenup
        result = DocumentService._merge_template(template, {
            "trustor_name": "John Doe",
            "has_spouse": "yes",
            "spouse_name": "Jane Doe",
            "has_prenup": "",
        })
        assert "No prenuptial agreement exists" in result
        assert "prenuptial agreement is in effect" not in result
        assert "unmarried" not in result

        # Unmarried
        result = DocumentService._merge_template(template, {
            "trustor_name": "John Doe",
            "has_spouse": "",
            "spouse_name": "",
            "has_prenup": "",
        })
        assert "unmarried" in result
        assert "MARITAL PROVISIONS" not in result
        assert "GENERAL PROVISIONS" in result

    def test_multiline_else(self):
        """Multiline IF/ELSE block."""
        template = """DOCUMENT

{{ IF <<section_a>> }}
Section A is included.
More A content.
{{ ELSE }}
Section A is NOT available.
Fallback content here.
{{ END }}

Footer"""
        result = DocumentService._merge_template(template, {"section_a": "yes"})
        assert "Section A is included." in result
        assert "More A content." in result
        assert "NOT available" not in result
        assert "Footer" in result

        result = DocumentService._merge_template(template, {"section_a": ""})
        assert "Section A is included" not in result
        assert "NOT available" in result
        assert "Fallback content" in result
        assert "Footer" in result


class TestIfAnyNoneMerge:
    """Test suite for IF ANY / IF NONE aggregate operators in template merge."""

    def test_if_any_true_when_match_present(self):
        """IF ANY should include block when at least one array element matches."""
        template = '{{ IF ANY <<color>> = "red" }}Red found{{ END }}'
        raw = {"color": '["red", "green", "blue"]'}
        result = DocumentService._merge_template(template, {}, raw_answer_map=raw)
        assert "Red found" in result

    def test_if_any_false_when_no_match(self):
        """IF ANY should exclude block when no array element matches."""
        template = '{{ IF ANY <<color>> = "red" }}Red found{{ END }}'
        raw = {"color": '["green", "blue"]'}
        result = DocumentService._merge_template(template, {}, raw_answer_map=raw)
        assert "Red found" not in result

    def test_if_none_true_when_no_match(self):
        """IF NONE should include block when no array element matches."""
        template = '{{ IF NONE <<color>> = "red" }}No red{{ END }}'
        raw = {"color": '["green", "blue"]'}
        result = DocumentService._merge_template(template, {}, raw_answer_map=raw)
        assert "No red" in result

    def test_if_none_false_when_match_present(self):
        """IF NONE should exclude block when at least one element matches."""
        template = '{{ IF NONE <<color>> = "red" }}No red{{ END }}'
        raw = {"color": '["red", "green"]'}
        result = DocumentService._merge_template(template, {}, raw_answer_map=raw)
        assert "No red" not in result

    def test_if_any_with_else(self):
        """IF ANY with ELSE branch."""
        template = '{{ IF ANY <<color>> = "red" }}Has red{{ ELSE }}No red{{ END }}'
        raw_yes = {"color": '["red", "blue"]'}
        raw_no = {"color": '["green", "blue"]'}
        assert "Has red" in DocumentService._merge_template(template, {}, raw_answer_map=raw_yes)
        assert "No red" in DocumentService._merge_template(template, {}, raw_answer_map=raw_no)

    def test_if_any_scalar_fallback(self):
        """IF ANY should work with a non-array scalar value."""
        template = '{{ IF ANY <<color>> = "red" }}Red found{{ END }}'
        raw = {"color": "red"}
        result = DocumentService._merge_template(template, {}, raw_answer_map=raw)
        assert "Red found" in result

    def test_if_none_scalar_fallback(self):
        """IF NONE should work with a non-array scalar value."""
        template = '{{ IF NONE <<color>> = "red" }}No red{{ END }}'
        raw = {"color": "green"}
        result = DocumentService._merge_template(template, {}, raw_answer_map=raw)
        assert "No red" in result

    def test_if_any_case_insensitive(self):
        """IF ANY/NONE condition keywords are case-insensitive."""
        template = '{{ if any <<color>> = "Red" }}found{{ END }}'
        raw = {"color": '["Red", "Blue"]'}
        result = DocumentService._merge_template(template, {}, raw_answer_map=raw)
        assert "found" in result

    def test_if_any_empty_array(self):
        """IF ANY on an empty array should be false."""
        template = '{{ IF ANY <<color>> = "red" }}Red found{{ END }}'
        raw = {"color": "[]"}
        result = DocumentService._merge_template(template, {}, raw_answer_map=raw)
        assert "Red found" not in result

    def test_if_none_empty_array(self):
        """IF NONE on an empty array should be true (no elements match)."""
        template = '{{ IF NONE <<color>> = "red" }}No red{{ END }}'
        raw = {"color": "[]"}
        result = DocumentService._merge_template(template, {}, raw_answer_map=raw)
        assert "No red" in result
