"""Document processing utilities for converting various file formats to Markdown."""

import os
from typing import Optional
from docx import Document
import PyPDF2
import pdfplumber
import markdown2
from pathlib import Path


class DocumentProcessor:
    """Handles conversion of various document formats to Markdown."""
    
    @staticmethod
    def word_to_markdown(file_path: str) -> str:
        """
        Convert Word document to Markdown text.
        
        Args:
            file_path: Path to the Word document
            
        Returns:
            Markdown text content
        """
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
    def validate_markdown(content: str) -> bool:
        """
        Validate that the content is valid Markdown.
        
        Args:
            content: Markdown content to validate
            
        Returns:
            True if valid, False otherwise
        """
        try:
            # Try to convert to HTML to validate
            markdown2.markdown(content)
            return True
        except Exception:
            return False
    
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
            File type: 'word', 'pdf', 'image', or None
        """
        ext = os.path.splitext(filename)[1].lower()
        
        if ext in ['.doc', '.docx']:
            return 'word'
        elif ext == '.pdf':
            return 'pdf'
        elif ext in ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp']:
            return 'image'
        
        return None
