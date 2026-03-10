"""Unit tests for conjunction-based joining of repeatable arrays in _merge_template."""

import json
from src.services.document_service import DocumentService


class TestConjunctionMerge:
    """Test inline repeatable identifiers joined with conjunctions."""

    def test_two_items_and(self):
        """Two items joined with 'and'."""
        template = "Shares: <<shares>>"
        answer_map = {"shares": json.dumps(["50%", "50%"])}
        conj_map = {"group1": ["and", "and"]}
        id_grp_map = {"shares": "group1"}
        result = DocumentService._merge_template(template, answer_map, None, conj_map, id_grp_map)
        assert result.strip() == "Shares: 50% and 50%"

    def test_three_items_and_oxford_comma(self):
        """Three items joined with 'and' uses Oxford comma."""
        template = "Shares: <<shares>>"
        answer_map = {"shares": json.dumps(["50%", "30%", "20%"])}
        conj_map = {"group1": ["and", "and", "and"]}
        id_grp_map = {"shares": "group1"}
        result = DocumentService._merge_template(template, answer_map, None, conj_map, id_grp_map)
        assert result.strip() == "Shares: 50%, 30%, and 20%"

    def test_two_items_or(self):
        """Two items joined with 'or'."""
        template = "Choose <<option>>"
        answer_map = {"option": json.dumps(["A", "B"])}
        conj_map = {"group1": ["or", "or"]}
        id_grp_map = {"option": "group1"}
        result = DocumentService._merge_template(template, answer_map, None, conj_map, id_grp_map)
        assert result.strip() == "Choose A or B"

    def test_three_items_or_oxford_comma(self):
        """Three items joined with 'or' uses Oxford comma."""
        template = "Choose <<option>>"
        answer_map = {"option": json.dumps(["A", "B", "C"])}
        conj_map = {"group1": ["or", "or", "or"]}
        id_grp_map = {"option": "group1"}
        result = DocumentService._merge_template(template, answer_map, None, conj_map, id_grp_map)
        assert result.strip() == "Choose A, B, or C"

    def test_then_conjunction(self):
        """Items joined with 'then'."""
        template = "Order: <<names>>"
        answer_map = {"names": json.dumps(["Alice", "Bob", "Carol"])}
        conj_map = {"group1": ["and", "then", "then"]}
        id_grp_map = {"names": "group1"}
        result = DocumentService._merge_template(template, answer_map, None, conj_map, id_grp_map)
        assert result.strip() == "Order: Alice, then Bob, then Carol"

    def test_mixed_conjunctions(self):
        """Mixed 'and' and 'then' conjunctions."""
        template = "<<names>>"
        answer_map = {"names": json.dumps(["Alice", "Bob", "Carol"])}
        conj_map = {"group1": ["and", "and", "then"]}
        id_grp_map = {"names": "group1"}
        result = DocumentService._merge_template(template, answer_map, None, conj_map, id_grp_map)
        # Alice, Bob, then Carol
        assert "Alice, Bob, then Carol" in result

    def test_single_item(self):
        """Single item returns just the item."""
        template = "Name: <<name>>"
        answer_map = {"name": json.dumps(["Alice"])}
        conj_map = {"group1": ["and"]}
        id_grp_map = {"name": "group1"}
        result = DocumentService._merge_template(template, answer_map, None, conj_map, id_grp_map)
        assert result.strip() == "Name: Alice"

    def test_no_conjunction_map_defaults_to_and(self):
        """Without conjunction map, defaults to 'and'."""
        template = "<<items>>"
        answer_map = {"items": json.dumps(["A", "B", "C"])}
        result = DocumentService._merge_template(template, answer_map, None, None, None)
        assert result.strip() == "A, B, and C"

    def test_person_array_with_conjunctions(self):
        """Person arrays with embedded conjunctions are formatted correctly."""
        template = "Trustees: <<trustee>>"
        person_data = [
            {"name": "John Smith", "conjunction": "and"},
            {"name": "Jane Doe", "conjunction": "and"},
            {"name": "Bob Johnson", "conjunction": "and"}
        ]
        answer_map = {"trustee": json.dumps(person_data)}
        conj_map = {"group1": ["and", "and", "and"]}
        id_grp_map = {"trustee": "group1"}
        result = DocumentService._merge_template(template, answer_map, None, conj_map, id_grp_map)
        assert "John Smith" in result
        assert "Jane Doe" in result
        assert "Bob Johnson" in result
        # Verify the names are joined with conjunctions, not just concatenated
        assert "John Smith" in result and "Jane Doe" in result and "Bob Johnson" in result
        # With 3 "and" conjunctions the result should use Oxford comma format
        assert ", " in result or " and " in result

    def test_identifier_not_in_group_defaults_to_and(self):
        """Identifier not in any group still defaults to 'and' joining."""
        template = "<<items>>"
        answer_map = {"items": json.dumps(["X", "Y"])}
        conj_map = {}
        id_grp_map = {}
        result = DocumentService._merge_template(template, answer_map, None, conj_map, id_grp_map)
        assert result.strip() == "X and Y"
