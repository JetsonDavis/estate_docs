import os
import uuid
from pathlib import Path
from typing import Optional
import aiofiles
from ..config import settings


def ensure_directory_exists(directory: str) -> None:
    """
    Ensure a directory exists, creating it if necessary.
    
    Args:
        directory: Directory path to ensure exists
    """
    Path(directory).mkdir(parents=True, exist_ok=True)


def generate_unique_filename(original_filename: str) -> str:
    """
    Generate a unique filename using UUID while preserving extension.
    
    Args:
        original_filename: Original filename
        
    Returns:
        Unique filename with original extension
    """
    extension = Path(original_filename).suffix
    unique_name = f"{uuid.uuid4()}{extension}"
    return unique_name


async def save_upload_file(
    file_content: bytes,
    original_filename: str,
    subdirectory: Optional[str] = None
) -> tuple[str, str]:
    """
    Save an uploaded file to the upload directory.
    
    Args:
        file_content: File content as bytes
        original_filename: Original filename
        subdirectory: Optional subdirectory within upload directory
        
    Returns:
        Tuple of (stored_filename, full_file_path)
    """
    # Generate unique filename
    stored_filename = generate_unique_filename(original_filename)
    
    # Determine full directory path
    if subdirectory:
        directory = os.path.join(settings.upload_dir, subdirectory)
    else:
        directory = settings.upload_dir
    
    ensure_directory_exists(directory)
    
    # Full file path
    file_path = os.path.join(directory, stored_filename)
    
    # Save file asynchronously
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(file_content)
    
    return stored_filename, file_path


async def save_generated_document(
    file_content: bytes,
    filename: str,
    client_id: int
) -> str:
    """
    Save a generated PDF document.
    
    Args:
        file_content: PDF content as bytes
        filename: Filename for the document
        client_id: Client ID for organization
        
    Returns:
        Full file path where document was saved
    """
    # Create client-specific subdirectory
    directory = os.path.join(settings.generated_dir, str(client_id))
    ensure_directory_exists(directory)
    
    # Full file path
    file_path = os.path.join(directory, filename)
    
    # Save file asynchronously
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(file_content)
    
    return file_path


async def read_file(file_path: str) -> bytes:
    """
    Read a file from disk.
    
    Args:
        file_path: Full path to file
        
    Returns:
        File content as bytes
        
    Raises:
        FileNotFoundError: If file doesn't exist
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    
    async with aiofiles.open(file_path, 'rb') as f:
        content = await f.read()
    
    return content


def delete_file(file_path: str) -> bool:
    """
    Delete a file from disk.
    
    Args:
        file_path: Full path to file
        
    Returns:
        True if file was deleted, False if file didn't exist
    """
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
        return False
    except Exception as e:
        print(f"Error deleting file {file_path}: {str(e)}")
        return False


def get_file_size(file_path: str) -> int:
    """
    Get the size of a file in bytes.
    
    Args:
        file_path: Full path to file
        
    Returns:
        File size in bytes
        
    Raises:
        FileNotFoundError: If file doesn't exist
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    
    return os.path.getsize(file_path)


def validate_file_size(file_size_bytes: int) -> bool:
    """
    Validate that a file size is within the allowed limit.
    
    Args:
        file_size_bytes: File size in bytes
        
    Returns:
        True if file size is valid, False otherwise
    """
    max_size_bytes = settings.max_upload_size_mb * 1024 * 1024
    return file_size_bytes <= max_size_bytes
