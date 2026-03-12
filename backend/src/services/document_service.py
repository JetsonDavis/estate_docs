"""Service layer for document generation and merge operations."""

from sqlalchemy.orm import Session
from typing import Optional, Tuple, List
from fastapi import HTTPException, status
import re
import logging
from datetime import datetime
from docx import Document
from docx.shared import Pt
import io
import json
from htmldocx import HtmlToDocx

_logger = logging.getLogger(__name__)

from ..models.document import GeneratedDocument
from ..models.template import Template
from ..models.session import InputForm, SessionAnswer
from ..models.question import Question
from ..models.person import Person
from ..schemas.document import GenerateDocumentRequest


class DocumentService:
    """Service for document generation and merge operations."""

    @staticmethod
    def generate_document(
        db: Session,
        request: GenerateDocumentRequest,
        user_id: int
    ) -> GeneratedDocument:
        """
        Generate a document by merging session answers into a template.

        Args:
            db: Database session
            request: Document generation request
            user_id: User ID generating the document

        Returns:
            Generated document
        """
        # Get template
        template = db.query(Template).filter(
            Template.id == request.template_id,
            Template.is_active == True
        ).first()

        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found"
            )

        # Get session (verify user owns it)
        session = db.query(InputForm).filter(
            InputForm.id == request.session_id,
            InputForm.user_id == user_id
        ).first()

        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )

        # Get all answers with their questions in a single joined query
        answer_pairs = db.query(SessionAnswer, Question).join(
            Question, SessionAnswer.question_id == Question.id
        ).filter(
            SessionAnswer.session_id == request.session_id
        ).all()

        # Build answer map: identifier -> formatted answer_value
        answer_map = DocumentService._build_answer_map(answer_pairs)

        # Build raw answer map (unformatted) so FOREACH can parse JSON arrays
        raw_answer_map = DocumentService._build_raw_answer_map(answer_pairs)

        # Build conjunction info for repeatable groups
        conj_map, id_grp_map = DocumentService._build_conjunction_info(answer_pairs)

        # Merge template with answers
        merged_content = DocumentService._merge_template(
            template.markdown_content,
            answer_map,
            raw_answer_map,
            conj_map,
            id_grp_map
        )

        # Generate document name if not provided
        document_name = request.document_name or f"{template.name} - {session.client_identifier}"

        # Create generated document
        document = GeneratedDocument(
            session_id=request.session_id,
            template_id=request.template_id,
            document_name=document_name,
            markdown_content=merged_content,
            generated_by=user_id,
            generated_at=datetime.utcnow()
        )

        db.add(document)
        db.commit()
        db.refresh(document)

        return document

    @staticmethod
    def _build_answer_map(answer_question_pairs: List[Tuple[SessionAnswer, Question]]) -> dict:
        """
        Build a map of question identifiers to answer values.

        Args:
            answer_question_pairs: List of (SessionAnswer, Question) tuples from a joined query

        Returns:
            Dictionary mapping identifiers to answer values
        """
        answer_map = {}

        for answer, question in answer_question_pairs:
            # Format person answers with conjunctions
            formatted_value = DocumentService._format_answer_value(
                answer.answer_value,
                question.question_type
            )
            # Store under lowercased full namespaced identifier (e.g., "group.poa_sign_date")
            answer_map[question.identifier.lower()] = formatted_value
            # Also store under stripped identifier (e.g., "poa_sign_date")
            # so templates can reference identifiers without namespace prefix
            if '.' in question.identifier:
                stripped = question.identifier.split('.', 1)[1].lower()
                # Only set stripped key if not already taken (first writer wins)
                if stripped not in answer_map:
                    answer_map[stripped] = formatted_value

        return answer_map

    @staticmethod
    def _build_raw_answer_map(answer_question_pairs: List[Tuple[SessionAnswer, Question]]) -> dict:
        """
        Build a map of question identifiers to raw (unformatted) answer values.

        Raw values preserve JSON arrays so FOREACH loops can parse them.

        Args:
            answer_question_pairs: List of (SessionAnswer, Question) tuples from a joined query

        Returns:
            Dictionary mapping identifiers to raw answer values
        """
        raw_answer_map = {}

        for answer, question in answer_question_pairs:
            raw_answer_map[question.identifier.lower()] = answer.answer_value
            if '.' in question.identifier:
                stripped = question.identifier.split('.', 1)[1].lower()
                if stripped not in raw_answer_map:
                    raw_answer_map[stripped] = answer.answer_value

        return raw_answer_map

    @staticmethod
    def _format_answer_value(answer_value: str, question_type: str) -> str:
        """
        Format an answer value for display in merged documents.

        For person-type questions, converts JSON array with conjunctions to readable text.
        E.g., [{"name": "John", "conjunction": "and"}, {"name": "Jane"}] -> "John and Jane"

        Args:
            answer_value: Raw answer value from database
            question_type: Type of the question

        Returns:
            Formatted answer string
        """
        # Format date values as "Month Day, Year" (e.g., "March 9, 2026")
        if question_type == 'date':
            try:
                dt = datetime.strptime(answer_value, '%Y-%m-%d')
                return dt.strftime('%B %-d, %Y')
            except (ValueError, TypeError):
                return answer_value

        if question_type not in ('person', 'person_backup'):
            return answer_value

        # Try to parse as JSON array of person objects
        try:
            parsed = json.loads(answer_value)

            if isinstance(parsed, list) and len(parsed) > 0:
                # Normalise each element: if it's a JSON string, decode it
                normalised = []
                for item in parsed:
                    if isinstance(item, dict):
                        normalised.append(item)
                    elif isinstance(item, str):
                        try:
                            obj = json.loads(item)
                            if isinstance(obj, dict):
                                normalised.append(obj)
                            else:
                                normalised.append({'name': item})
                        except (json.JSONDecodeError, TypeError):
                            normalised.append({'name': item})
                    else:
                        normalised.append({'name': str(item)})

                # Check if it's the format with objects containing name and conjunction
                if any('name' in p for p in normalised):
                    result_parts = []
                    for i, person in enumerate(normalised):
                        name = person.get('name', '')
                        if not name:
                            continue
                        # The conjunction on THIS person indicates how it connects
                        # to the PREVIOUS person (e.g., "then Andrea" means
                        # Andrea follows the previous person with "then")
                        conjunction = person.get('conjunction', '') or 'and'
                        if i > 0:
                            if conjunction.lower() == 'then':
                                result_parts.append(', then')
                            else:
                                result_parts.append(conjunction)
                        result_parts.append(name)
                    return ' '.join(result_parts)

            return answer_value
        except (json.JSONDecodeError, TypeError):
            # Not JSON, return as-is
            return answer_value

    @staticmethod
    def _build_conjunction_info(answer_question_pairs: List[Tuple[SessionAnswer, Question]]) -> tuple:
        """
        Build conjunction info from person-type repeatable answers.

        Args:
            answer_question_pairs: List of (SessionAnswer, Question) tuples from a joined query

        Returns:
            Tuple of (conjunction_map, identifier_group_map) where:
            - conjunction_map: {repeatable_group_id: [conj1, conj2, ...]} from person entries
            - identifier_group_map: {identifier: repeatable_group_id} for all repeatable questions
        """
        conjunction_map = {}  # repeatable_group_id -> [conjunctions]
        identifier_group_map = {}  # identifier -> repeatable_group_id

        for answer, question in answer_question_pairs:
            # Map every repeatable question's identifier to its group
            if question.repeatable and question.repeatable_group_id:
                ident = question.identifier.lower()
                identifier_group_map[ident] = question.repeatable_group_id
                if '.' in question.identifier:
                    stripped = question.identifier.split('.', 1)[1].lower()
                    identifier_group_map[stripped] = question.repeatable_group_id

                # Extract conjunctions from person-type answers
                if question.question_type in ('person', 'person_backup'):
                    group_id = question.repeatable_group_id
                    if group_id not in conjunction_map:
                        try:
                            parsed = json.loads(answer.answer_value)
                            if isinstance(parsed, list):
                                conjunctions = []
                                for item in parsed:
                                    decoded = item
                                    if isinstance(decoded, str):
                                        try:
                                            decoded = json.loads(decoded)
                                        except (json.JSONDecodeError, TypeError):
                                            pass
                                    if isinstance(decoded, dict):
                                        conjunctions.append(decoded.get('conjunction', 'and'))
                                    else:
                                        conjunctions.append('and')
                                conjunction_map[group_id] = conjunctions
                        except (json.JSONDecodeError, TypeError):
                            pass

        return conjunction_map, identifier_group_map

    @staticmethod
    def _is_value_empty(value: str) -> bool:
        """Check if a value should be considered empty."""
        if not value:
            return True
        if not value.strip():
            return True
        # Check for "[identifier: NOT ANSWERED]" pattern but not JSON arrays
        if value.startswith('[') and value.endswith(']') and ': NOT ANSWERED]' in value:
            return True
        return False

    # ── Shared word lists for counter tokens ─────────────────────────
    _CARDINAL_WORDS = [
        '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven',
        'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen',
        'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen',
        'Nineteen', 'Twenty'
    ]
    _ORDINAL_WORDS = [
        '', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth',
        'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth',
        'Thirteenth', 'Fourteenth', 'Fifteenth', 'Sixteenth',
        'Seventeenth', 'Eighteenth', 'Nineteenth', 'Twentieth'
    ]

    # ── Pre-compiled regexes ──────────────────────────────────────────
    _FOREACH_RE = re.compile(
        r'\{\{\s*FOREACH(?:\((\d+)\))?\s+(?:<<)?([^>=!\s\}>]+)(?:>>)?\s*\}\}'
        r'(.*?)'
        r'\{\{\s*END\s+FOREACH\s*\}\}',
        re.DOTALL | re.IGNORECASE
    )
    _IF_OPEN_RE = re.compile(r'\{\{\s*IF\s+(.*?)\s*\}\}', re.IGNORECASE)
    _END_RE = re.compile(r'\{\{\s*END\s*\}\}', re.IGNORECASE)
    _ELSE_RE = re.compile(r'\{\{\s*ELSE\s*\}\}', re.IGNORECASE)
    _COUNTER_RE = re.compile(r'(###|##%|##)(?:\+(\d*))?')
    _IDENTIFIER_RE = re.compile(r'<<([^>]+)>>')
    _CONDITIONAL_RE = re.compile(r'\[\[(.*?)\]\]', re.DOTALL)

    @staticmethod
    def _parse_array(raw: str):
        """Try to parse a string as a JSON array; return list or None."""
        if not raw:
            return None
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return parsed
        except (json.JSONDecodeError, TypeError):
            pass
        return None

    @staticmethod
    def _decode_json_item(item):
        """Decode a possibly multi-level JSON-encoded item to its innermost dict or str."""
        decoded = item
        if isinstance(decoded, str):
            for _ in range(3):
                try:
                    obj = json.loads(decoded)
                    if isinstance(obj, dict):
                        return obj
                    elif isinstance(obj, str):
                        decoded = obj
                    else:
                        break
                except (json.JSONDecodeError, TypeError):
                    break
        return decoded

    @staticmethod
    def _format_item(item, field: str = None) -> str:
        """Format a single array element for output.

        Handles double-encoded JSON strings where each element may be
        a JSON string containing a JSON object (e.g. '{"name":"Alice"}').
        """
        decoded = DocumentService._decode_json_item(item)

        if isinstance(decoded, dict):
            if field:
                return str(decoded.get(field, ''))
            return decoded.get('name', str(decoded))
        if isinstance(decoded, str):
            if field:
                return decoded if field == 'name' else ''
            return decoded
        return str(decoded)

    @staticmethod
    def _counter_to_str(token: str, n: int) -> str:
        """Convert a counter token (##, ###, ##%) and number to its string representation."""
        if token == '###':
            return DocumentService._CARDINAL_WORDS[n] if n < len(DocumentService._CARDINAL_WORDS) else str(n)
        elif token == '##%':
            return DocumentService._ORDINAL_WORDS[n] if n < len(DocumentService._ORDINAL_WORDS) else f'{n}th'
        else:
            return str(n)

    @staticmethod
    def _process_foreach_blocks(text: str, answer_map: dict, raw_map: dict, global_counter: list) -> str:
        """Process {{ FOREACH identifier }} ... {{ END FOREACH }} blocks.

        Args:
            text: Template text potentially containing FOREACH blocks
            answer_map: Formatted identifier -> value map
            raw_map: Raw (unformatted) identifier -> value map
            global_counter: Mutable [int] shared counter for ## tokens

        Returns:
            Text with FOREACH blocks expanded
        """
        def _process_block(match):
            counter_start_str = match.group(1)
            loop_identifier = match.group(2).lower()
            body_template = match.group(3)

            if counter_start_str:
                global_counter[0] = int(counter_start_str) - 1

            raw_value = raw_map.get(loop_identifier, '') or answer_map.get(loop_identifier, '')
            loop_array = DocumentService._parse_array(raw_value)

            if not loop_array or len(loop_array) == 0:
                _logger.debug(f"FOREACH: identifier '{loop_identifier}' has no array data, removing block")
                return ''

            instance_count = len(loop_array)
            _logger.debug(f"FOREACH: iterating '{loop_identifier}' with {instance_count} instances")

            body_identifiers_raw = re.findall(r'<<([^>]+)>>', body_template)

            identifier_arrays = {}
            for ident in body_identifiers_raw:
                base_ident = ident.split('.', 1)[0].lower() if '.' in ident else ident.lower()
                if base_ident not in identifier_arrays:
                    raw = raw_map.get(base_ident, '') or answer_map.get(base_ident, '')
                    identifier_arrays[base_ident] = DocumentService._parse_array(raw)

            output_parts = []
            for idx in range(instance_count):
                instance_body = body_template
                global_counter[0] += 1

                def _foreach_counter_replace(m, _gc=global_counter):
                    token = m.group(1)
                    plus_str = m.group(2)
                    inc = int(plus_str) if plus_str else 0
                    return DocumentService._counter_to_str(token, _gc[0] + inc)

                instance_body = DocumentService._COUNTER_RE.sub(_foreach_counter_replace, instance_body)

                for orig_ident in body_identifiers_raw:
                    ident = orig_ident.lower()
                    if '.' in ident:
                        base_ident, field_name = ident.split('.', 1)
                    else:
                        base_ident, field_name = ident, None

                    arr = identifier_arrays.get(base_ident)
                    if arr is not None and idx < len(arr):
                        replacement = DocumentService._format_item(arr[idx], field_name)
                    elif arr is not None:
                        replacement = ''
                    else:
                        scalar = answer_map.get(ident, '') or answer_map.get(base_ident, '')
                        replacement = scalar if not DocumentService._is_value_empty(scalar) else ''

                    instance_body = instance_body.replace(f'<<{orig_ident}>>', replacement)

                output_parts.append(instance_body)

            return ''.join(output_parts)

        return DocumentService._FOREACH_RE.sub(_process_block, text)

    @staticmethod
    def _resolve_identifier_value(identifier: str, answer_map: dict, raw_answer_map: dict) -> str:
        """Resolve an identifier to its value, supporting dot notation.

        For simple identifiers, looks up in answer_map.
        For dot notation (e.g., 'person.relationship'), parses the
        person JSON from raw_answer_map and extracts the field.
        """
        direct = answer_map.get(identifier, '')
        if direct and not DocumentService._is_value_empty(direct):
            return direct

        if '.' in identifier:
            base, field = identifier.split('.', 1)
            raw_json = (raw_answer_map or {}).get(base, '') or ''
            if raw_json:
                try:
                    parsed = json.loads(raw_json)
                    if isinstance(parsed, dict):
                        val = parsed.get(field)
                        if val is not None:
                            return str(val)
                    elif isinstance(parsed, list) and len(parsed) > 0:
                        first = parsed[0]
                        if isinstance(first, str):
                            try:
                                first = json.loads(first)
                            except (json.JSONDecodeError, TypeError):
                                pass
                        if isinstance(first, dict):
                            val = first.get(field)
                            if val is not None:
                                return str(val)
                except (json.JSONDecodeError, TypeError):
                    pass
        return ''

    @staticmethod
    def _evaluate_if_condition(condition_text: str, answer_map: dict, raw_answer_map: dict) -> bool:
        """Evaluate the condition inside {{ IF <condition> }}.

        Returns True if the content should be included.
        """
        cond = condition_text.strip()

        not_match = re.match(
            r'NOT\s+(?:<<)?([^>=!\s\}>]+)(?:>>)?$', cond, re.IGNORECASE
        )
        if not_match:
            identifier = not_match.group(1).lower()
            value = DocumentService._resolve_identifier_value(identifier, answer_map, raw_answer_map)
            return DocumentService._is_value_empty(value)

        _q = r'["\'\u201c\u201d\u2018\u2019\u00ab\u00bb]'
        neq_match = re.match(
            r'(?:<<)?([^>=!\s\}>]+)(?:>>)?\s*!=\s*(?:' + _q + r'([^"\'\u201c\u201d\u2018\u2019\u00ab\u00bb]*)' + _q + r'?|(EMPTY|NULL))',
            cond, re.IGNORECASE
        )
        if neq_match:
            identifier = neq_match.group(1).lower()
            keyword = neq_match.group(3)
            actual = DocumentService._resolve_identifier_value(identifier, answer_map, raw_answer_map)
            if keyword and keyword.upper() in ('EMPTY', 'NULL'):
                return not DocumentService._is_value_empty(actual)
            expected = neq_match.group(2) or ''
            return actual.lower() != expected.lower()

        eq_match = re.match(
            r'(?:<<)?([^>=!\s\}>]+)(?:>>)?\s*=\s*(?:' + _q + r'([^"\'\u201c\u201d\u2018\u2019\u00ab\u00bb]*)' + _q + r'?|(EMPTY|NULL))',
            cond, re.IGNORECASE
        )
        if eq_match:
            identifier = eq_match.group(1).lower()
            keyword = eq_match.group(3)
            actual = DocumentService._resolve_identifier_value(identifier, answer_map, raw_answer_map)
            if keyword and keyword.upper() in ('EMPTY', 'NULL'):
                return DocumentService._is_value_empty(actual)
            expected = eq_match.group(2) or ''
            return actual.lower() == expected.lower()

        plain_match = re.match(
            r'(?:<<)?([^>=!\s\}>]+)(?:>>)?$', cond, re.IGNORECASE
        )
        if plain_match:
            identifier = plain_match.group(1).lower()
            value = DocumentService._resolve_identifier_value(identifier, answer_map, raw_answer_map)
            return not DocumentService._is_value_empty(value)

        return True

    @staticmethod
    def _process_if_blocks(text: str, answer_map: dict, raw_answer_map: dict) -> str:
        """Recursively process nested {{ IF }} ... {{ ELSE }} ... {{ END }} blocks.

        Scans *text* left-to-right.  When an {{ IF ... }} tag is found the
        parser counts nesting depth to locate the matching {{ END }} and an
        optional {{ ELSE }} at the same depth.  The if-body (and else-body,
        if present) are recursively processed, then the condition decides
        which branch to keep.
        """
        _if_open_re = DocumentService._IF_OPEN_RE
        _end_re = DocumentService._END_RE
        _else_re = DocumentService._ELSE_RE

        result = []
        pos = 0

        while pos < len(text):
            open_match = _if_open_re.search(text, pos)
            if not open_match:
                result.append(text[pos:])
                break

            result.append(text[pos:open_match.start()])

            condition_text = open_match.group(1)
            body_start = open_match.end()

            depth = 1
            scan = body_start
            body_end = body_start
            else_start = None
            else_end = None
            while depth > 0 and scan < len(text):
                next_open = _if_open_re.search(text, scan)
                next_end = _end_re.search(text, scan)
                next_else = _else_re.search(text, scan)

                if next_end is None:
                    scan = len(text)
                    break

                candidates = [('end', next_end)]
                if next_open:
                    candidates.append(('open', next_open))
                if next_else:
                    candidates.append(('else', next_else))
                candidates.sort(key=lambda c: c[1].start())

                tag_type, tag_match = candidates[0]

                if tag_type == 'open':
                    depth += 1
                    scan = tag_match.end()
                elif tag_type == 'else' and depth == 1:
                    else_start = tag_match.start()
                    else_end = tag_match.end()
                    scan = tag_match.end()
                elif tag_type == 'else':
                    scan = tag_match.end()
                else:
                    depth -= 1
                    if depth == 0:
                        body_end = tag_match.start()
                        scan = tag_match.end()
                    else:
                        scan = tag_match.end()

            if depth != 0:
                result.append(text[open_match.start():])
                break

            if else_start is not None:
                if_body = text[body_start:else_start]
                else_body = text[else_end:body_end]
            else:
                if_body = text[body_start:body_end]
                else_body = None

            if DocumentService._evaluate_if_condition(condition_text, answer_map, raw_answer_map):
                result.append(DocumentService._process_if_blocks(if_body, answer_map, raw_answer_map))
            elif else_body is not None:
                result.append(DocumentService._process_if_blocks(else_body, answer_map, raw_answer_map))

            pos = scan

        return ''.join(result)

    @staticmethod
    def _process_conditional_sections(text: str, answer_map: dict) -> str:
        """Process [[ ... ]] conditional sections.

        If any identifier inside is empty, remove the entire section.
        Otherwise, replace identifiers and remove the brackets.
        """
        def _process_section(match):
            section_content = match.group(1)

            identifiers_in_section = re.findall(r'<<([^>]+)>>', section_content)

            if not identifiers_in_section:
                return section_content

            for identifier in identifiers_in_section:
                value = answer_map.get(identifier.lower(), '')
                if DocumentService._is_value_empty(value):
                    _logger.debug(f"Identifier '{identifier}' is empty, removing conditional section")
                    return ''

            result = section_content
            for identifier in identifiers_in_section:
                value = answer_map.get(identifier.lower(), '')
                result = result.replace(f'<<{identifier}>>', value)
            return result

        return DocumentService._CONDITIONAL_RE.sub(_process_section, text)

    @staticmethod
    def _replace_counter_tokens(text: str, global_counter: list) -> str:
        """Replace ##, ###, ##% tokens with running counter values.

        Args:
            text: Text containing counter tokens
            global_counter: Mutable [int] shared counter state

        Returns:
            Text with counter tokens replaced
        """
        def _replacer(match):
            token = match.group(1)
            plus_str = match.group(2)
            inc = int(plus_str) if plus_str else 1
            global_counter[0] += inc
            return DocumentService._counter_to_str(token, global_counter[0])

        return DocumentService._COUNTER_RE.sub(_replacer, text)

    @staticmethod
    def _replace_identifiers(text: str, answer_map: dict, raw_answer_map: dict,
                             conjunction_map: dict, identifier_group_map: dict) -> str:
        """Replace all <<identifier>> tokens with their values.

        Handles dot notation for person fields, JSON arrays with conjunction
        joining, and scalar values.
        """
        _conj_map = conjunction_map or {}
        _id_grp_map = identifier_group_map or {}
        _raw_map = raw_answer_map or {}

        def _replace(match):
            identifier = match.group(1).lower()

            if '.' in identifier:
                parts = identifier.split('.', 1)
                person_identifier = parts[0]
                field_name = parts[1]

                raw_json = _raw_map.get(person_identifier, '') or ''
                formatted = answer_map.get(person_identifier, '')

                if raw_json:
                    try:
                        person_data = json.loads(raw_json)

                        if isinstance(person_data, dict):
                            field_value = person_data.get(field_name)
                            if field_value is not None:
                                return str(field_value)
                        elif isinstance(person_data, list) and len(person_data) > 0:
                            if field_name == 'name':
                                return formatted if formatted else ''
                            first = person_data[0]
                            if isinstance(first, str):
                                try:
                                    first = json.loads(first)
                                except (json.JSONDecodeError, TypeError):
                                    pass
                            if isinstance(first, dict):
                                field_value = first.get(field_name)
                                if field_value is not None:
                                    return str(field_value)
                    except (json.JSONDecodeError, TypeError):
                        pass

                if formatted:
                    try:
                        person_data = json.loads(formatted)
                        if isinstance(person_data, dict):
                            field_value = person_data.get(field_name)
                            if field_value is not None:
                                return str(field_value)
                    except (json.JSONDecodeError, TypeError):
                        if field_name == 'name':
                            return formatted

                return ''

            value = answer_map.get(identifier, '')
            if not DocumentService._is_value_empty(value):
                try:
                    parsed = json.loads(value)
                    if isinstance(parsed, list) and len(parsed) > 0:
                        items = []
                        for item in parsed:
                            decoded = DocumentService._decode_json_item(item)
                            if isinstance(decoded, dict):
                                item_str = decoded.get('name', str(decoded))
                            else:
                                item_str = str(decoded)
                            items.append(item_str)

                        group_id = _id_grp_map.get(identifier)
                        conjunctions = _conj_map.get(group_id, []) if group_id else []

                        if len(items) == 1:
                            return items[0]

                        result_parts = [items[0]]
                        for i in range(1, len(items)):
                            conj = conjunctions[i] if i < len(conjunctions) else 'and'
                            if not conj:
                                conj = 'and'
                            if conj.lower() == 'then':
                                result_parts.append(f', then {items[i]}')
                            elif i == len(items) - 1 and conj.lower() in ('and', 'or'):
                                if len(items) > 2:
                                    result_parts.append(f', {conj} {items[i]}')
                                else:
                                    result_parts.append(f' {conj} {items[i]}')
                            else:
                                result_parts.append(f', {items[i]}')
                        return ''.join(result_parts)
                except (json.JSONDecodeError, TypeError):
                    pass
                return value
            return ''

        return DocumentService._IDENTIFIER_RE.sub(_replace, text)

    @staticmethod
    def _merge_template(template_content: str, answer_map: dict, raw_answer_map: dict = None, conjunction_map: dict = None, identifier_group_map: dict = None) -> str:
        """
        Merge template content with answer values.

        Orchestrates five passes in order:
        1. FOREACH loops — expand repeatable blocks
        2. IF / ELSE conditionals — evaluate nested conditional blocks
        3. [[ ... ]] conditional sections — remove sections with empty identifiers
        4. Counter tokens (##, ###, ##%) — replace with running numbers
        5. Identifier replacement — replace remaining <<identifier>> tokens

        Args:
            template_content: Template markdown content
            answer_map: Dictionary mapping identifiers to formatted answer values
            raw_answer_map: Dictionary mapping identifiers to raw (unformatted) values
            conjunction_map: {repeatable_group_id: [conjunctions]} for joining arrays
            identifier_group_map: {identifier: repeatable_group_id} for repeatable questions

        Returns:
            Merged content with identifiers replaced
        """
        raw_map = raw_answer_map if raw_answer_map else answer_map
        global_counter = [0]

        # Pass 1: FOREACH loops
        merged = DocumentService._process_foreach_blocks(
            template_content, answer_map, raw_map, global_counter
        )

        # Pass 2: IF / ELSE conditionals
        merged = DocumentService._process_if_blocks(merged, answer_map, raw_answer_map)

        # Pass 3: [[ ... ]] conditional sections
        merged = DocumentService._process_conditional_sections(merged, answer_map)

        # Pass 4: Counter tokens
        merged = DocumentService._replace_counter_tokens(merged, global_counter)

        # Pass 5: Identifier replacement
        merged = DocumentService._replace_identifiers(
            merged, answer_map, raw_answer_map, conjunction_map, identifier_group_map
        )

        # Clean up double spaces
        merged = re.sub(r'  +', ' ', merged)

        return merged
    
    @staticmethod
    def preview_document(
        db: Session,
        session_id: int,
        template_id: int,
        user_id: int
    ) -> dict:
        """
        Preview a document merge without saving.
        
        Args:
            db: Database session
            session_id: Session ID
            template_id: Template ID
            user_id: User ID
            
        Returns:
            Preview data including merged content and missing identifiers
        """
        # Get template
        template = db.query(Template).filter(
            Template.id == template_id,
            Template.is_active == True
        ).first()
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found"
            )
        
        # Get session
        session = db.query(InputForm).filter(
            InputForm.id == session_id,
            InputForm.user_id == user_id
        ).first()
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        # Get all answers with their questions in a single joined query
        answer_pairs = db.query(SessionAnswer, Question).join(
            Question, SessionAnswer.question_id == Question.id
        ).filter(
            SessionAnswer.session_id == session_id
        ).all()
        
        answer_map = DocumentService._build_answer_map(answer_pairs)

        # Build raw answer map (unformatted) so FOREACH can parse JSON arrays
        raw_answer_map = DocumentService._build_raw_answer_map(answer_pairs)
        
        # Build conjunction info for repeatable groups
        conj_map, id_grp_map = DocumentService._build_conjunction_info(answer_pairs)

        # Get template identifiers
        template_identifiers = template.extract_identifiers()
        
        # Find missing identifiers
        missing_identifiers = [
            identifier for identifier in template_identifiers
            if identifier.lower() not in answer_map
        ]
        
        # Merge content
        merged_content = DocumentService._merge_template(
            template.markdown_content,
            answer_map,
            raw_answer_map,
            conj_map,
            id_grp_map
        )
        
        return {
            "template_name": template.name,
            "session_client": session.client_identifier,
            "markdown_content": merged_content,
            "missing_identifiers": missing_identifiers,
            "available_identifiers": list(answer_map.keys())
        }
    
    @staticmethod
    def get_document(
        db: Session,
        document_id: int,
        user_id: int
    ) -> Optional[GeneratedDocument]:
        """
        Get a generated document by ID.
        
        Args:
            db: Database session
            document_id: Document ID
            user_id: User ID
            
        Returns:
            Generated document if found and user has access
        """
        return db.query(GeneratedDocument).join(
            InputForm,
            GeneratedDocument.session_id == InputForm.id
        ).filter(
            GeneratedDocument.id == document_id,
            InputForm.user_id == user_id
        ).first()
    
    @staticmethod
    def list_documents(
        db: Session,
        user_id: int,
        skip: int = 0,
        limit: int = 100
    ) -> Tuple[List[GeneratedDocument], int]:
        """
        List generated documents for a user.
        
        Args:
            db: Database session
            user_id: User ID
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            Tuple of (documents list, total count)
        """
        query = db.query(GeneratedDocument).join(
            InputForm,
            GeneratedDocument.session_id == InputForm.id
        ).filter(
            InputForm.user_id == user_id
        )
        
        total = query.count()
        documents = query.order_by(GeneratedDocument.generated_at.desc()).offset(skip).limit(limit).all()
        
        return documents, total
    
    @staticmethod
    def delete_document(
        db: Session,
        document_id: int,
        user_id: int
    ) -> bool:
        """
        Delete a generated document.
        
        Args:
            db: Database session
            document_id: Document ID
            user_id: User ID
            
        Returns:
            True if deleted, False if not found
        """
        document = DocumentService.get_document(db, document_id, user_id)
        if not document:
            return False
        
        db.delete(document)
        db.commit()
        
        return True
    
    @staticmethod
    def merge_document(
        db: Session,
        session_id: int,
        template_id: int,
        user_id: int
    ) -> bytes:
        """
        Merge a template with session data and return a Word document.
        
        Args:
            db: Database session
            session_id: Document session ID
            template_id: Template ID
            user_id: User ID
            
        Returns:
            Bytes of the generated Word document
        """
        # Get template
        template = db.query(Template).filter(
            Template.id == template_id,
            Template.is_active == True
        ).first()
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found"
            )
        
        # Get session (verify user owns it)
        session = db.query(InputForm).filter(
            InputForm.id == session_id,
            InputForm.user_id == user_id
        ).first()
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        # Get all answers with their questions in a single joined query
        answer_pairs = db.query(SessionAnswer, Question).join(
            Question, SessionAnswer.question_id == Question.id
        ).filter(
            SessionAnswer.session_id == session_id
        ).all()
        
        # Build answer maps and conjunction info from the joined pairs
        raw_answer_map = DocumentService._build_raw_answer_map(answer_pairs)
        answer_map = DocumentService._build_answer_map(answer_pairs)
        conj_map, id_grp_map = DocumentService._build_conjunction_info(answer_pairs)

        # Get template markdown content and merge using the shared _merge_template function
        # This handles all conditional logic ([[ ]], {{ IF }}, etc.) and identifier replacement
        content = template.markdown_content or ""
        merged_content = DocumentService._merge_template(content, answer_map, raw_answer_map, conj_map, id_grp_map)
        
        # Create a Word document
        doc = Document()
        
        # Convert HTML to Word with formatting preserved
        # The merged_content now contains HTML from the rich text editor
        parser = HtmlToDocx()
        
        # Wrap content in basic HTML structure if not already HTML
        if not merged_content.strip().startswith('<'):
            # Plain text or markdown - wrap in paragraph tags
            html_content = f"<div>{merged_content}</div>"
        else:
            # Already HTML from rich text editor
            html_content = merged_content
        
        # Parse and add HTML content to document with formatting
        parser.add_html_to_document(html_content, doc)
        
        # Save to bytes
        doc_bytes = io.BytesIO()
        doc.save(doc_bytes)
        doc_bytes.seek(0)
        
        return doc_bytes.getvalue()
