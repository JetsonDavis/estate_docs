"""Document processing utilities for converting various file formats to Markdown."""

import os
from typing import Optional
from docx import Document
import PyPDF2
import pdfplumber
import markdown2
import mammoth
from pathlib import Path
from datetime import datetime


class DocumentProcessor:
    """Handles conversion of various document formats to Markdown."""
    
    @staticmethod
    def word_to_markdown(file_path: str) -> str:
        """
        Convert Word document to Markdown text using mammoth for better conversion.

        Args:
            file_path: Path to the Word document

        Returns:
            Markdown text content
        """
        try:
            # Try mammoth first for better conversion
            with open(file_path, "rb") as docx_file:
                result = mammoth.convert_to_markdown(docx_file)
                markdown_content = result.value

                # Clean up the markdown
                lines = markdown_content.split('\n')
                cleaned_lines = []
                for line in lines:
                    stripped = line.strip()
                    if stripped:
                        cleaned_lines.append(stripped)
                        cleaned_lines.append("")  # Add blank line

                return "\n".join(cleaned_lines).strip()
        except Exception as e:
            # Fallback to python-docx if mammoth fails
            doc = Document(file_path)
            markdown_lines = []

            for paragraph in doc.paragraphs:
                text = paragraph.text.strip()
                if not text:
                    continue

                # Check paragraph style for headings
                if paragraph.style.name.startswith('Heading'):
                    level = paragraph.style.name.replace('Heading ', '')
                    try:
                        level_num = int(level)
                        markdown_lines.append(f"{'#' * level_num} {text}")
                    except ValueError:
                        markdown_lines.append(text)
                else:
                    markdown_lines.append(text)

                markdown_lines.append("")  # Add blank line between paragraphs

            return "\n".join(markdown_lines)
    
    @staticmethod
    def pdf_to_markdown(file_path: str) -> str:
        """
        Convert PDF to Markdown text using pdfplumber for better text extraction.
        
        Args:
            file_path: Path to the PDF file
            
        Returns:
            Markdown text content
        """
        markdown_lines = []
        
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    # Split into paragraphs (double newlines)
                    paragraphs = text.split('\n\n')
                    for para in paragraphs:
                        # Clean up single newlines within paragraphs
                        cleaned = para.replace('\n', ' ').strip()
                        if cleaned:
                            markdown_lines.append(cleaned)
                            markdown_lines.append("")  # Blank line between paragraphs
        
        return "\n".join(markdown_lines)
    
    @staticmethod
    def image_to_markdown(file_path: str, ocr_text: str) -> str:
        """
        Convert OCR'd image text to Markdown.

        Args:
            file_path: Path to the image file
            ocr_text: OCR extracted text from AWS Textract or similar service

        Returns:
            Markdown text content
        """
        # For now, just format the OCR text as paragraphs
        # In production, this would use AWS Textract response structure
        markdown_lines = []

        paragraphs = ocr_text.split('\n\n')
        for para in paragraphs:
            cleaned = para.strip()
            if cleaned:
                markdown_lines.append(cleaned)
                markdown_lines.append("")

        return "\n".join(markdown_lines)

    @staticmethod
    def text_to_markdown(file_path: str) -> str:
        """
        Convert plain text file to Markdown.

        Args:
            file_path: Path to the text file

        Returns:
            Markdown text content
        """
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        return content
    
    @staticmethod
    def validate_markdown(content: str) -> bool:
        """
        Validate that the content is valid Markdown.

        Args:
            content: Markdown content to validate

        Returns:
            True if valid, False otherwise
        """
        # Simple validation - just check that content exists and is not empty
        # Any text is valid markdown, so we don't need strict validation
        if not content or not content.strip():
            return False

        return True
    
    @staticmethod
    def extract_identifiers(content: str) -> list[str]:
        """
        Extract all identifiers from Markdown content (e.g., <<identifier>>).
        
        Args:
            content: Markdown content
            
        Returns:
            List of unique identifiers
        """
        import re
        pattern = r'<<([^>]+)>>'
        matches = re.findall(pattern, content)
        return list(set(matches))
    
    @staticmethod
    def save_uploaded_file(file_content: bytes, filename: str, upload_dir: str) -> str:
        """
        Save uploaded file to storage.
        
        Args:
            file_content: File content as bytes
            filename: Original filename
            upload_dir: Directory to save the file
            
        Returns:
            Path to saved file
        """
        # Create upload directory if it doesn't exist
        Path(upload_dir).mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename to avoid conflicts
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        name, ext = os.path.splitext(filename)
        unique_filename = f"{name}_{timestamp}{ext}"
        
        file_path = os.path.join(upload_dir, unique_filename)
        
        with open(file_path, 'wb') as f:
            f.write(file_content)
        
        return file_path
    
    @staticmethod
    def get_file_type(filename: str) -> Optional[str]:
        """
        Determine file type from filename extension.

        Args:
            filename: Name of the file

        Returns:
            File type: 'word', 'pdf', 'image', 'text', or None
        """
        ext = os.path.splitext(filename)[1].lower()

        if ext in ['.doc', '.docx']:
            return 'word'
        elif ext == '.pdf':
            return 'pdf'
        elif ext in ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp']:
            return 'image'
        elif ext == '.txt':
            return 'text'

        return None

    @staticmethod
    def save_markdown_file(
        markdown_content: str,
        template_name: str,
        username: str,
        base_dir: str = "document_uploads"
    ) -> str:
        """
        Save markdown content to a file with proper naming convention.

        Args:
            markdown_content: The markdown content to save
            template_name: Name of the template
            username: Username of the user uploading
            base_dir: Base directory for uploads (default: document_uploads)

        Returns:
            Path to the saved markdown file
        """
        # Create document_uploads directory at root level if it doesn't exist
        root_dir = Path(__file__).parent.parent.parent.parent  # Go up to project root
        upload_dir = root_dir / base_dir
        upload_dir.mkdir(parents=True, exist_ok=True)

        # Generate filename: templatename_username_timestamp.md
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        # Clean template name for filename (remove special characters)
        clean_template_name = "".join(c for c in template_name if c.isalnum() or c in (' ', '-', '_')).strip()
        clean_template_name = clean_template_name.replace(' ', '_')
        filename = f"{clean_template_name}_{username}_{timestamp}.md"

        file_path = upload_dir / filename

        # Save the markdown content
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(markdown_content)

        return str(file_path)
