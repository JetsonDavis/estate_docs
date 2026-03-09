"""Shared naming utilities for copy operations."""

from typing import List


def generate_copy_name(original_name: str, existing_names: List[str]) -> str:
    """
    Generate a macOS-style copy name.
    - "Original" -> "Original copy"
    - "Original copy" -> "Original copy copy"
    - "Original copy copy" -> "Original copy copy copy"
    """
    base_name = original_name
    copy_suffix = " copy"

    # Start with "name copy"
    new_name = f"{base_name}{copy_suffix}"

    # If that exists, keep adding " copy" until we find a unique name
    while new_name in existing_names:
        new_name = f"{new_name}{copy_suffix}"

    return new_name


def generate_copy_identifier(original_identifier: str, existing_identifiers: List[str]) -> str:
    """
    Generate a unique identifier for a copy.
    - "original" -> "original_copy"
    - "original_copy" -> "original_copy_copy"
    """
    base_identifier = original_identifier
    copy_suffix = "_copy"

    # Start with "identifier_copy"
    new_identifier = f"{base_identifier}{copy_suffix}"

    # If that exists, keep adding "_copy" until we find a unique identifier
    while new_identifier in existing_identifiers:
        new_identifier = f"{new_identifier}{copy_suffix}"

    return new_identifier
