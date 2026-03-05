"""Service layer for document generation and merge operations."""

from sqlalchemy.orm import Session
from typing import Optional, Tuple, List
from fastapi import HTTPException, status
import re
from datetime import datetime
from docx import Document
from docx.shared import Pt
import io
import json

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

        # Get all answers for the session
        answers = db.query(SessionAnswer).filter(
            SessionAnswer.session_id == request.session_id
        ).all()

        # Build answer map: identifier -> answer_value
        answer_map = DocumentService._build_answer_map(db, answers)

        # Build raw answer map (unformatted) so FOREACH can parse JSON arrays
        raw_answer_map = {}
        for answer in answers:
            question = db.query(Question).filter(Question.id == answer.question_id).first()
            if question:
                raw_answer_map[question.identifier.lower()] = answer.answer_value
                if '.' in question.identifier:
                    stripped = question.identifier.split('.', 1)[1].lower()
                    if stripped not in raw_answer_map:
                        raw_answer_map[stripped] = answer.answer_value

        # Merge template with answers
        merged_content = DocumentService._merge_template(
            template.markdown_content,
            answer_map,
            raw_answer_map
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
    def _build_answer_map(db: Session, answers: List[SessionAnswer]) -> dict:
        """
        Build a map of question identifiers to answer values.

        Args:
            db: Database session
            answers: List of session answers

        Returns:
            Dictionary mapping identifiers to answer values
        """
        answer_map = {}

        for answer in answers:
            # Get question to find its identifier
            question = db.query(Question).filter(
                Question.id == answer.question_id
            ).first()

            if question:
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

        if question_type != 'person':
            return answer_value

        # Try to parse as JSON array of person objects
        try:
            import json
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
                        conjunction = person.get('conjunction', '')
                        if i > 0 and conjunction:
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

    @staticmethod
    def _merge_template(template_content: str, answer_map: dict, raw_answer_map: dict = None) -> str:
        """
        Merge template content with answer values.

        Replaces all occurrences of <<identifier>> with corresponding answer values.

        Supports conditional syntax:
        - [[ ... ]] - If all identifiers inside are empty, remove the entire section
        - {{ IF <<identifier>> }} ... {{ END }} - Include content if identifier is NOT empty
        - {{ IF NOT <<identifier>> }} ... {{ END }} - Include content if identifier IS empty

        Supports loop syntax for repeatable groups:
        - {{ FOREACH identifier }} ... {{ END FOREACH }}
          Repeats the body once per element in the identifier's array.
          Inside the body, <<identifier>> resolves to the Nth element,
          and ## becomes the 1-based loop index.
          All other array-valued identifiers also resolve to their Nth element
          (parallel iteration for repeatable group members).

        Args:
            template_content: Template markdown content
            answer_map: Dictionary mapping identifiers to answer values

        Returns:
            Merged content with identifiers replaced
        """
        merged_content = template_content

        # ── FOREACH loops ──────────────────────────────────────────────
        # Process {{ FOREACH identifier }} ... {{ END FOREACH }} blocks
        # Must run before all other directives so the expanded output can
        # be further processed by IF / conditional / identifier passes.
        import logging
        _logger = logging.getLogger(__name__)

        # Shared counter for ##, ###, ##% tokens across FOREACH and outside
        _global_counter = [0]

        foreach_pattern = r'\{\{\s*FOREACH\s+(?:<<)?([^>=!\s\}>]+)(?:>>)?\s*\}\}(.*?)\{\{\s*END\s+FOREACH\s*\}\}'

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

        def _format_item(item, field: str = None) -> str:
            """Format a single array element for output.
            
            Handles double-encoded JSON strings where each element may be
            a JSON string containing a JSON object (e.g. '{"name":"Alice"}').
            """
            # Normalise: if item is a string, try to decode it (possibly multiple levels)
            decoded = item
            if isinstance(decoded, str):
                for _ in range(3):  # up to 3 levels of encoding
                    try:
                        obj = json.loads(decoded)
                        if isinstance(obj, dict):
                            decoded = obj
                            break
                        elif isinstance(obj, str):
                            decoded = obj  # try another level
                        else:
                            break
                    except (json.JSONDecodeError, TypeError):
                        break

            if isinstance(decoded, dict):
                if field:
                    return str(decoded.get(field, ''))
                return decoded.get('name', str(decoded))
            if isinstance(decoded, str):
                if field:
                    return decoded if field == 'name' else ''
                return decoded
            return str(decoded)

        # For FOREACH loops, prefer raw (unformatted) values so JSON arrays are still parseable
        _raw_map = raw_answer_map if raw_answer_map else answer_map

        def process_foreach_block(match):
            loop_identifier = match.group(1).lower()
            body_template = match.group(2)

            # Get the array for the loop identifier — use raw values so person arrays aren't pre-formatted
            raw_value = _raw_map.get(loop_identifier, '') or answer_map.get(loop_identifier, '')
            loop_array = _parse_array(raw_value)

            if not loop_array or len(loop_array) == 0:
                _logger.info(f"FOREACH: identifier '{loop_identifier}' has no array data, removing block")
                return ''

            instance_count = len(loop_array)
            _logger.info(f"FOREACH: iterating '{loop_identifier}' with {instance_count} instances")

            # Find all identifiers referenced in the body
            # Keep original case for replacement, use lowercased for lookups
            body_identifiers_raw = re.findall(r'<<([^>]+)>>', body_template)

            # Pre-parse arrays for all referenced identifiers (use raw values for JSON arrays)
            identifier_arrays = {}
            for ident in body_identifiers_raw:
                # Handle dot notation (e.g., person_ident.field)
                base_ident = ident.split('.', 1)[0].lower() if '.' in ident else ident.lower()
                if base_ident not in identifier_arrays:
                    raw = _raw_map.get(base_ident, '') or answer_map.get(base_ident, '')
                    arr = _parse_array(raw)
                    identifier_arrays[base_ident] = arr

            # Helper: extract conjunction from a (possibly double-encoded) person item
            def _get_conjunction(item) -> str:
                decoded = item
                if isinstance(decoded, str):
                    for _ in range(3):
                        try:
                            obj = json.loads(decoded)
                            if isinstance(obj, dict):
                                decoded = obj
                                break
                            elif isinstance(obj, str):
                                decoded = obj
                            else:
                                break
                        except (json.JSONDecodeError, TypeError):
                            break
                if isinstance(decoded, dict):
                    return decoded.get('conjunction', '')
                return ''

            # Build output for each instance
            output_parts = []
            for idx in range(instance_count):
                instance_body = body_template

                # Replace loop index tokens (order matters: ### and ##% before ##)
                _cardinal_words = [
                    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven',
                    'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen',
                    'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen',
                    'Nineteen', 'Twenty'
                ]
                _ordinal_words = [
                    '', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth',
                    'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth',
                    'Thirteenth', 'Fourteenth', 'Fifteenth', 'Sixteenth',
                    'Seventeenth', 'Eighteenth', 'Nineteenth', 'Twentieth'
                ]
                _global_counter[0] += 1

                def _foreach_counter_replace(m):
                    token = m.group(1)  # ###, ##%, or ##
                    plus_str = m.group(2)  # e.g. '', '1', '2', None
                    inc = int(plus_str) if plus_str else 0
                    n = _global_counter[0] + inc
                    if token == '###':
                        return _cardinal_words[n] if n < len(_cardinal_words) else str(n)
                    elif token == '##%':
                        return _ordinal_words[n] if n < len(_ordinal_words) else f'{n}th'
                    else:
                        return str(n)

                # Match ###, ##%, or ## optionally followed by +N (longest token first)
                instance_body = re.sub(r'(###|##%|##)(?:\+(\d*))?', _foreach_counter_replace, instance_body)

                # Replace each <<identifier>> with the Nth element
                for orig_ident in body_identifiers_raw:
                    ident = orig_ident.lower()
                    has_dot = '.' in ident
                    if has_dot:
                        base_ident, field_name = ident.split('.', 1)
                    else:
                        base_ident = ident
                        field_name = None

                    arr = identifier_arrays.get(base_ident)
                    if arr is not None and idx < len(arr):
                        replacement = _format_item(arr[idx], field_name)
                    elif arr is not None:
                        replacement = ''  # Index out of range
                    else:
                        # Not an array — use scalar value as-is
                        scalar = answer_map.get(ident, '') or answer_map.get(base_ident, '')
                        replacement = scalar if not DocumentService._is_value_empty(scalar) else ''

                    # Replace using original case from template
                    instance_body = instance_body.replace(f'<<{orig_ident}>>', replacement)

                output_parts.append(instance_body)

            return ''.join(output_parts)

        # Process FOREACH blocks (may be nested in future, but for now single-level)
        merged_content = re.sub(foreach_pattern, process_foreach_block, merged_content, flags=re.DOTALL | re.IGNORECASE)

        # ── Conditional / IF directives ────────────────────────────────
        # Uses a recursive parser instead of regex to support nested IF blocks.
        # Supported forms:
        #   {{ IF <<ident>> }}              — include if ident has a value
        #   {{ IF NOT <<ident>> }}          — include if ident is empty
        #   {{ IF <<ident>> = "value" }}    — include if ident equals value
        #   {{ IF <<ident>> != "value" }}   — include if ident does not equal value
        #   {{ IF <<ident>> = EMPTY }}      — include if ident is empty (same as IF NOT)
        #   {{ IF <<ident>> = NULL }}       — include if ident is empty (same as IF NOT)
        #   {{ IF <<ident>> != EMPTY }}     — include if ident has a value (same as IF)
        #   {{ IF <<ident>> != NULL }}      — include if ident has a value (same as IF)
        # Optional {{ ELSE }} between {{ IF ... }} and {{ END }}.
        # All closed by {{ END }}. Nesting is fully supported.

        # Regex for any {{ IF ... }} opening tag (captures the full condition text)
        _if_open_re = re.compile(
            r'\{\{\s*IF\s+(.*?)\s*\}\}',
            re.IGNORECASE
        )
        _end_re = re.compile(r'\{\{\s*END\s*\}\}', re.IGNORECASE)
        _else_re = re.compile(r'\{\{\s*ELSE\s*\}\}', re.IGNORECASE)

        def _resolve_identifier_value(identifier: str) -> str:
            """Resolve an identifier to its value, supporting dot notation.

            For simple identifiers, looks up in answer_map.
            For dot notation (e.g., 'person.relationship'), parses the
            person JSON from raw_answer_map and extracts the field.
            """
            # First try direct lookup
            direct = answer_map.get(identifier, '')
            if direct and not DocumentService._is_value_empty(direct):
                return direct

            # Try dot notation: base_ident.field
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
                            # For arrays, extract field from first element
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

        def _evaluate_if_condition(condition_text: str) -> bool:
            """Evaluate the condition inside {{ IF <condition> }}.

            Returns True if the content should be included.
            """
            cond = condition_text.strip()

            # --- IF NOT <<ident>> ---
            not_match = re.match(
                r'NOT\s+(?:<<)?([^>=!\s\}>]+)(?:>>)?$', cond, re.IGNORECASE
            )
            if not_match:
                identifier = not_match.group(1).lower()
                value = _resolve_identifier_value(identifier)
                return DocumentService._is_value_empty(value)

            # --- IF <<ident>> != "value" or EMPTY/NULL ---
            _q = r'["\'“”‘’«»]'  # any quote character
            neq_match = re.match(
                r'(?:<<)?([^>=!\s\}>]+)(?:>>)?\s*!=\s*(?:' + _q + r'([^"\'“”‘’«»]*)' + _q + r'?|(EMPTY|NULL))',
                cond, re.IGNORECASE
            )
            if neq_match:
                identifier = neq_match.group(1).lower()
                keyword = neq_match.group(3)
                actual = _resolve_identifier_value(identifier)
                if keyword and keyword.upper() in ('EMPTY', 'NULL'):
                    # != EMPTY / != NULL means "has a value"
                    return not DocumentService._is_value_empty(actual)
                expected = neq_match.group(2) or ''
                return actual.lower() != expected.lower()

            # --- IF <<ident>> = "value" or EMPTY/NULL ---
            eq_match = re.match(
                r'(?:<<)?([^>=!\s\}>]+)(?:>>)?\s*=\s*(?:' + _q + r'([^"\'“”‘’«»]*)' + _q + r'?|(EMPTY|NULL))',
                cond, re.IGNORECASE
            )
            if eq_match:
                identifier = eq_match.group(1).lower()
                keyword = eq_match.group(3)
                actual = _resolve_identifier_value(identifier)
                if keyword and keyword.upper() in ('EMPTY', 'NULL'):
                    # = EMPTY / = NULL means "is empty"
                    return DocumentService._is_value_empty(actual)
                expected = eq_match.group(2) or ''
                return actual.lower() == expected.lower()

            # --- IF <<ident>> (has value) ---
            plain_match = re.match(
                r'(?:<<)?([^>=!\s\}>]+)(?:>>)?$', cond, re.IGNORECASE
            )
            if plain_match:
                identifier = plain_match.group(1).lower()
                value = _resolve_identifier_value(identifier)
                return not DocumentService._is_value_empty(value)

            # Unknown form — leave content in place
            return True

        def _process_if_blocks(text: str) -> str:
            """Recursively process nested {{ IF }} ... {{ ELSE }} ... {{ END }} blocks.

            Scans *text* left-to-right.  When an {{ IF ... }} tag is found the
            parser counts nesting depth to locate the matching {{ END }} and an
            optional {{ ELSE }} at the same depth.  The if-body (and else-body,
            if present) are recursively processed, then the condition decides
            which branch to keep.
            """
            result = []
            pos = 0

            while pos < len(text):
                # Find the next {{ IF ... }} tag
                open_match = _if_open_re.search(text, pos)
                if not open_match:
                    # No more IF tags — append remainder
                    result.append(text[pos:])
                    break

                # Append text before this IF tag
                result.append(text[pos:open_match.start()])

                condition_text = open_match.group(1)
                body_start = open_match.end()

                # Walk forward to find the matching {{ END }}, respecting nesting.
                # Also track the position of a {{ ELSE }} at depth 1 (top level
                # of this IF block) so we can split into if-body / else-body.
                depth = 1
                scan = body_start
                body_end = body_start  # default; overwritten when matching END found
                else_start = None      # start of {{ ELSE }} tag text (if found)
                else_end = None        # end of {{ ELSE }} tag text (if found)
                while depth > 0 and scan < len(text):
                    next_open = _if_open_re.search(text, scan)
                    next_end = _end_re.search(text, scan)
                    next_else = _else_re.search(text, scan)

                    if next_end is None:
                        # No matching END — treat rest of text as body (malformed)
                        scan = len(text)
                        break

                    # Collect all candidate tags and pick the earliest one
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
                        # {{ ELSE }} at the current IF's depth — record position
                        else_start = tag_match.start()
                        else_end = tag_match.end()
                        scan = tag_match.end()
                    elif tag_type == 'else':
                        # {{ ELSE }} inside a nested IF — skip it
                        scan = tag_match.end()
                    else:  # 'end'
                        depth -= 1
                        if depth == 0:
                            body_end = tag_match.start()
                            scan = tag_match.end()
                        else:
                            scan = tag_match.end()

                if depth != 0:
                    # Malformed template — no matching END; include as-is
                    result.append(text[open_match.start():])
                    break

                # Split into if-body and optional else-body
                if else_start is not None:
                    if_body = text[body_start:else_start]
                    else_body = text[else_end:body_end]
                else:
                    if_body = text[body_start:body_end]
                    else_body = None

                # Evaluate the condition and pick the correct branch
                if _evaluate_if_condition(condition_text):
                    result.append(_process_if_blocks(if_body))
                elif else_body is not None:
                    result.append(_process_if_blocks(else_body))
                # else: no ELSE branch and condition is false — discard

                pos = scan

            return ''.join(result)

        merged_content = _process_if_blocks(merged_content)

        # Process conditional sections [[ ... ]]
        # If all identifiers inside are empty, remove the entire section
        # After evaluation, the brackets are removed from the output
        logger = _logger

        conditional_pattern = r'\[\[(.*?)\]\]'

        # Debug: Check if pattern matches anything
        matches = re.findall(conditional_pattern, merged_content, flags=re.DOTALL)
        logger.info(f"Found {len(matches)} conditional sections: {matches}")

        def process_conditional_section(match):
            section_content = match.group(1)
            logger.info(f"Processing conditional section: '{section_content}'")

            # Find all identifiers in this section
            identifier_pattern = r'<<([^>]+)>>'
            identifiers_in_section = re.findall(identifier_pattern, section_content)
            logger.info(f"Identifiers in section: {identifiers_in_section}")

            if not identifiers_in_section:
                # No identifiers in section, keep the content (without brackets)
                logger.info(f"No identifiers, keeping content: '{section_content}'")
                return section_content

            # Check if ANY identifier in this section is empty/non-existent
            # If any identifier is empty, remove the entire section
            for identifier in identifiers_in_section:
                value = answer_map.get(identifier.lower(), '')
                logger.info(f"Checking identifier '{identifier}': value='{value}', is_empty={DocumentService._is_value_empty(value)}")
                if DocumentService._is_value_empty(value):
                    # At least one identifier is empty - remove the entire section
                    logger.info(f"Identifier '{identifier}' is empty, removing entire section")
                    return ''

            # All identifiers have values - keep the section content (without brackets)
            # and replace the identifiers with their values
            result = section_content
            for identifier in identifiers_in_section:
                value = answer_map.get(identifier.lower(), '')
                result = result.replace(f'<<{identifier}>>', value)
            logger.info(f"All identifiers have values, result: '{result}'")
            return result

        merged_content = re.sub(conditional_pattern, process_conditional_section, merged_content, flags=re.DOTALL)

        # Replace ##, ###, ##% tokens outside FOREACH with a running counter
        _cardinal_words = [
            '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven',
            'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen',
            'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen',
            'Nineteen', 'Twenty'
        ]
        _ordinal_words = [
            '', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth',
            'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth',
            'Thirteenth', 'Fourteenth', 'Fifteenth', 'Sixteenth',
            'Seventeenth', 'Eighteenth', 'Nineteenth', 'Twentieth'
        ]
        def _replace_counter_token(match):
            token = match.group(1)  # ###, ##%, or ##
            plus_str = match.group(2)  # e.g. '', '1', '2', None
            inc = int(plus_str) if plus_str else 1
            _global_counter[0] += inc
            num = _global_counter[0]
            if token == '###':
                return _cardinal_words[num] if num < len(_cardinal_words) else str(num)
            elif token == '##%':
                return _ordinal_words[num] if num < len(_ordinal_words) else f'{num}th'
            else:  # ##
                return str(num)

        # Match ###, ##%, or ## optionally followed by +N (longest token first)
        merged_content = re.sub(r'(###|##%|##)(?:\+(\d*))?', _replace_counter_token, merged_content)

        # Then, replace all identifiers with their values
        pattern = r'<<([^>]+)>>'

        def replace_identifier(match):
            identifier = match.group(1).lower()

            # Check if this is a person field with dot notation (e.g., person.field)
            if '.' in identifier:
                parts = identifier.split('.', 1)
                person_identifier = parts[0]
                field_name = parts[1]

                # First try the raw answer (before formatting) so we can parse JSON
                raw_json = (raw_answer_map or {}).get(person_identifier, '') or ''
                # Fall back to the formatted answer_map value
                formatted = answer_map.get(person_identifier, '')

                if raw_json:
                    try:
                        person_data = json.loads(raw_json)

                        if isinstance(person_data, dict):
                            field_value = person_data.get(field_name)
                            if field_value is not None:
                                return str(field_value)
                        elif isinstance(person_data, list) and len(person_data) > 0:
                            # Array of person objects (possibly double-encoded)
                            # If asking for 'name' on an array, return the
                            # fully formatted name string with conjunctions
                            if field_name == 'name':
                                return formatted if formatted else ''

                            # For other fields, decode and extract from first person
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

                # If raw parsing failed, try the formatted value
                if formatted:
                    try:
                        person_data = json.loads(formatted)
                        if isinstance(person_data, dict):
                            field_value = person_data.get(field_name)
                            if field_value is not None:
                                return str(field_value)
                    except (json.JSONDecodeError, TypeError):
                        # Already formatted text — if asking for 'name', return it
                        if field_name == 'name':
                            return formatted

                # Person field not found - return empty string
                return ''

            value = answer_map.get(identifier, '')
            # Return answer value if available and not empty, otherwise return empty string
            if not DocumentService._is_value_empty(value):
                # Check if value is a JSON array (repeatable question)
                try:
                    parsed = json.loads(value)
                    if isinstance(parsed, list) and len(parsed) > 0:
                        # Format as numbered list, handling double-encoded strings
                        numbered_items = []
                        for i, item in enumerate(parsed, 1):
                            decoded = item
                            # Decode double-encoded JSON strings
                            if isinstance(decoded, str):
                                try:
                                    obj = json.loads(decoded)
                                    if isinstance(obj, dict):
                                        decoded = obj
                                except (json.JSONDecodeError, TypeError):
                                    pass
                            if isinstance(decoded, dict):
                                item_str = decoded.get('name', str(decoded))
                            else:
                                item_str = str(decoded)
                            numbered_items.append(f"{i}. {item_str}")
                        result = '\n'.join(numbered_items)
                        return result
                except (json.JSONDecodeError, TypeError):
                    pass  # Not JSON, return as-is
                return value
            return ''
        
        merged_content = re.sub(pattern, replace_identifier, merged_content)
        
        # Finally, replace ## with auto-incrementing counter and #^. with current counter (no increment)
        # Use a simple pattern - ## anywhere in the text
        counter = [1]  # Use list to allow modification in nested function
        
        def replace_counter(match):
            current = counter[0]
            counter[0] += 1
            return str(current)
        
        def replace_counter_peek(match):
            # Return current counter value without incrementing
            return str(counter[0])
        
        # First replace #^. with current counter (no increment) - must be done before ##
        merged_content = re.sub(r'#\^\.', replace_counter_peek, merged_content)
        
        # Then replace ## with auto-incrementing counter
        merged_content = re.sub(r'##', replace_counter, merged_content)
        
        # Clean up any double spaces or extra whitespace left behind
        merged_content = re.sub(r'  +', ' ', merged_content)
        
        return merged_content
    
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
        
        # Get answers
        answers = db.query(SessionAnswer).filter(
            SessionAnswer.session_id == session_id
        ).all()
        
        answer_map = DocumentService._build_answer_map(db, answers)

        # Build raw answer map (unformatted) so FOREACH can parse JSON arrays
        raw_answer_map = {}
        for answer in answers:
            question = db.query(Question).filter(Question.id == answer.question_id).first()
            if question:
                raw_answer_map[question.identifier.lower()] = answer.answer_value
                if '.' in question.identifier:
                    stripped = question.identifier.split('.', 1)[1].lower()
                    if stripped not in raw_answer_map:
                        raw_answer_map[stripped] = answer.answer_value
        
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
            raw_answer_map
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
            raise ValueError("Template not found")
        
        # Get session (verify user owns it)
        session = db.query(InputForm).filter(
            InputForm.id == session_id,
            InputForm.user_id == user_id
        ).first()
        
        if not session:
            raise ValueError("Session not found")
        
        # Get all answers for this session with their question identifiers
        answers_query = db.query(SessionAnswer, Question).join(
            Question, SessionAnswer.question_id == Question.id
        ).filter(
            SessionAnswer.session_id == session_id
        ).all()
        
        # Build a raw answer map (before formatting) for FOREACH and person JSON data
        raw_answer_map = {}
        for answer, question in answers_query:
            raw_answer_map[question.identifier.lower()] = answer.answer_value
            # Also store under stripped identifier (without namespace prefix)
            if '.' in question.identifier:
                stripped = question.identifier.split('.', 1)[1].lower()
                if stripped not in raw_answer_map:
                    raw_answer_map[stripped] = answer.answer_value

        # Build a mapping of identifier -> answer value (with formatting for person types)
        answer_map = {}
        for answer, question in answers_query:
            formatted_value = DocumentService._format_answer_value(
                answer.answer_value,
                question.question_type
            )
            answer_map[question.identifier.lower()] = formatted_value
            # Also store under stripped identifier (without namespace prefix)
            if '.' in question.identifier:
                stripped = question.identifier.split('.', 1)[1].lower()
                if stripped not in answer_map:
                    answer_map[stripped] = formatted_value
        
        # Get template markdown content and merge using the shared _merge_template function
        # This handles all conditional logic ([[ ]], {{ IF }}, etc.) and identifier replacement
        content = template.markdown_content or ""
        merged_content = DocumentService._merge_template(content, answer_map, raw_answer_map)
        
        # Handle person field dot notation (e.g., <<person.field>>) for any remaining placeholders
        identifier_pattern = r'<<([^>]+)>>'
        
        def replace_person_fields(match):
            identifier = match.group(1).strip().lower()
            print(f"DEBUG: Processing identifier: '{identifier}'")
            
            # Check if this is a person field with dot notation (e.g., person.field)
            if '.' in identifier:
                parts = identifier.split('.', 1)
                person_identifier = parts[0]
                field_name = parts[1]
                print(f"DEBUG: person_identifier='{person_identifier}', field_name='{field_name}'")
                
                # Get the raw person JSON from answers (not the formatted version)
                person_json = raw_answer_map.get(person_identifier, '')
                print(f"DEBUG: person_json for '{person_identifier}': {person_json[:200] if person_json else 'NOT FOUND'}")
                
                if person_json:
                    try:
                        # Person data is now stored as JSON object with all fields
                        person_data = json.loads(person_json)
                        
                        if isinstance(person_data, dict):
                            # New format: JSON object with person fields
                            field_value = person_data.get(field_name)
                            if field_value is not None:
                                return str(field_value)
                        elif isinstance(person_data, list) and len(person_data) > 0:
                            # Legacy format: array of person objects or names
                            first_person = person_data[0]
                            if isinstance(first_person, dict):
                                field_value = first_person.get(field_name)
                                if field_value is not None:
                                    return str(field_value)
                                # Also check 'name' field for legacy format
                                if field_name == 'name' and 'name' in first_person:
                                    return str(first_person['name'])
                            elif isinstance(first_person, str) and field_name == 'name':
                                # Old format: just array of name strings
                                return first_person
                    except (json.JSONDecodeError, TypeError):
                        # Not JSON, might be a plain string - only return if asking for 'name'
                        if field_name == 'name':
                            return person_json
                
                # If person or field not found, return empty string
                return ''
            
            # Regular identifier that wasn't replaced - return empty string
            return ''
        
        # Replace any remaining person field identifiers
        merged_content = re.sub(identifier_pattern, replace_person_fields, merged_content)
        
        # Create a Word document
        doc = Document()
        
        # Add the merged content to the document
        # Split by paragraphs and add each one
        paragraphs = merged_content.split('\n')
        for para_text in paragraphs:
            if para_text.strip():
                paragraph = doc.add_paragraph(para_text)
                # Set default font
                for run in paragraph.runs:
                    run.font.size = Pt(12)
                    run.font.name = 'Calibri'
        
        # Save to bytes
        doc_bytes = io.BytesIO()
        doc.save(doc_bytes)
        doc_bytes.seek(0)
        
        return doc_bytes.getvalue()
