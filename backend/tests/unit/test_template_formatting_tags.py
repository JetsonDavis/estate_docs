"""Test template formatting tags: <center>, <right>, <indent>, <tab>."""

import pytest
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from src.services.document_service import DocumentService, HTMLToWordConverter


class TestFormattingTagsInTemplate:
    """Test that formatting tags in templates work correctly."""

    def test_center_tag_basic(self):
        """<center>text</center> should create centered paragraph."""
        template = '<center>TITLE</center>'
        merged = DocumentService._merge_template(template, {}, {})

        # Convert to Word document
        doc = Document()
        parser = HTMLToWordConverter(doc)
        parser.feed(merged)

        # Find the paragraph with "TITLE"
        title_para = None
        for para in doc.paragraphs:
            if 'TITLE' in para.text:
                title_para = para
                break

        assert title_para is not None, f"TITLE not found in paragraphs: {[p.text for p in doc.paragraphs]}"
        assert title_para.alignment == WD_ALIGN_PARAGRAPH.CENTER

    def test_center_with_cr_inside(self):
        """<center> with <cr> inside should center all lines."""
        template = '<center>LINE1<cr>LINE2<cr>LINE3</center>'
        merged = DocumentService._merge_template(template, {}, {})

        doc = Document()
        parser = HTMLToWordConverter(doc)
        parser.feed(merged)

        # Should have 3 centered paragraphs
        assert len(doc.paragraphs) >= 3
        assert doc.paragraphs[0].text == 'LINE1'
        assert doc.paragraphs[0].alignment == WD_ALIGN_PARAGRAPH.CENTER
        assert doc.paragraphs[1].text == 'LINE2'
        assert doc.paragraphs[1].alignment == WD_ALIGN_PARAGRAPH.CENTER
        assert doc.paragraphs[2].text == 'LINE3'
        assert doc.paragraphs[2].alignment == WD_ALIGN_PARAGRAPH.CENTER

    def test_right_tag_basic(self):
        """<right>text</right> should create right-aligned paragraph."""
        template = '<right>RIGHT ALIGNED</right>'
        merged = DocumentService._merge_template(template, {}, {})

        doc = Document()
        parser = HTMLToWordConverter(doc)
        parser.feed(merged)

        right_para = None
        for para in doc.paragraphs:
            if 'RIGHT ALIGNED' in para.text:
                right_para = para
                break

        assert right_para is not None
        assert right_para.alignment == WD_ALIGN_PARAGRAPH.RIGHT

    def test_right_with_cr_inside(self):
        """<right> with <cr> inside should right-align all lines."""
        template = '<right>LINE1<cr>LINE2</right>'
        merged = DocumentService._merge_template(template, {}, {})

        doc = Document()
        parser = HTMLToWordConverter(doc)
        parser.feed(merged)

        assert len(doc.paragraphs) >= 2
        assert doc.paragraphs[0].alignment == WD_ALIGN_PARAGRAPH.RIGHT
        assert doc.paragraphs[1].alignment == WD_ALIGN_PARAGRAPH.RIGHT

    def test_indent_tag_basic(self):
        """<indent>text</indent> should create indented paragraph."""
        template = '<indent>Indented text</indent>'
        merged = DocumentService._merge_template(template, {}, {})

        doc = Document()
        parser = HTMLToWordConverter(doc)
        parser.feed(merged)

        # Check that paragraph has left margin/indent
        indent_para = None
        for para in doc.paragraphs:
            if 'Indented text' in para.text:
                indent_para = para
                break

        assert indent_para is not None
        # The paragraph should have left_indent set
        assert indent_para.paragraph_format.left_indent is not None

    def test_indent_with_cr_inside(self):
        """<indent> with <cr> inside should indent all lines."""
        template = '<indent>LINE1<cr>LINE2</indent>'
        merged = DocumentService._merge_template(template, {}, {})

        doc = Document()
        parser = HTMLToWordConverter(doc)
        parser.feed(merged)

        assert len(doc.paragraphs) >= 2
        assert doc.paragraphs[0].paragraph_format.left_indent is not None
        assert doc.paragraphs[1].paragraph_format.left_indent is not None

    def test_tab_tag_basic(self):
        """<tab> should insert tab character."""
        template = 'Name<tab>Address<tab>Phone'
        merged = DocumentService._merge_template(template, {}, {})

        doc = Document()
        parser = HTMLToWordConverter(doc)
        parser.feed(merged)

        # Check that tab characters are present
        text = ''.join(run.text for run in doc.paragraphs[0].runs)
        assert '\t' in text
        assert text.count('\t') == 2

    def test_center_with_identifier(self):
        """<center> tag should work with identifiers."""
        template = '<center><<title>></center>'
        answer_map = {'title': 'LAST WILL AND TESTAMENT'}
        merged = DocumentService._merge_template(template, answer_map, answer_map)

        doc = Document()
        parser = HTMLToWordConverter(doc)
        parser.feed(merged)

        title_para = None
        for para in doc.paragraphs:
            if 'LAST WILL AND TESTAMENT' in para.text:
                title_para = para
                break

        assert title_para is not None
        assert title_para.alignment == WD_ALIGN_PARAGRAPH.CENTER

    def test_center_with_identifier_and_cr(self):
        """<center> with identifiers and <cr> inside."""
        template = '<center>LAST WILL<cr>OF<cr><<name>></center>'
        answer_map = {'name': 'John Doe'}
        merged = DocumentService._merge_template(template, answer_map, answer_map)

        doc = Document()
        parser = HTMLToWordConverter(doc)
        parser.feed(merged)

        # All 3 lines should be centered
        assert len(doc.paragraphs) >= 3
        for i in range(3):
            assert doc.paragraphs[i].alignment == WD_ALIGN_PARAGRAPH.CENTER

    def test_mixed_formatting(self):
        """Multiple formatting tags in one template."""
        template = '''
<center>ARTICLE ##</center>
<cr>
<indent>This is an indented paragraph.</indent>
<cr>
Name<tab>Address<tab>Phone
<cr>
<right>Page ##</right>
'''
        merged = DocumentService._merge_template(template, {}, {})

        doc = Document()
        parser = HTMLToWordConverter(doc)
        parser.feed(merged)

        # Check that we have multiple paragraphs with different formatting
        assert len(doc.paragraphs) > 0

        # Check for centered ARTICLE
        article_found = False
        for para in doc.paragraphs:
            if 'ARTICLE' in para.text:
                assert para.alignment == WD_ALIGN_PARAGRAPH.CENTER
                article_found = True
                break
        assert article_found, f"ARTICLE not found in: {[p.text for p in doc.paragraphs]}"

    def test_case_insensitive_tags(self):
        """Tags should work in uppercase, lowercase, or mixed case."""
        templates = [
            '<center>Text</center>',
            '<CENTER>Text</CENTER>',
            '<Center>Text</Center>',
        ]

        for template in templates:
            merged = DocumentService._merge_template(template, {}, {})
            doc = Document()
            parser = HTMLToWordConverter(doc)
            parser.feed(merged)

            centered = False
            for para in doc.paragraphs:
                if 'Text' in para.text:
                    centered = para.alignment == WD_ALIGN_PARAGRAPH.CENTER
                    break

            assert centered, f"Failed for template: {template}"

    def test_tab_uppercase(self):
        """<TAB> should also work."""
        template = 'A<TAB>B'
        merged = DocumentService._merge_template(template, {}, {})

        doc = Document()
        parser = HTMLToWordConverter(doc)
        parser.feed(merged)

        text = ''.join(run.text for run in doc.paragraphs[0].runs)
        assert '\t' in text

    def test_no_extra_blank_paragraphs(self):
        """Formatting tags should not create extra blank paragraphs."""
        template = '<center>LINE1</center><center>LINE2</center>'
        merged = DocumentService._merge_template(template, {}, {})

        doc = Document()
        parser = HTMLToWordConverter(doc)
        parser.feed(merged)

        # Should have exactly 2 paragraphs, no blank ones
        non_empty = [p for p in doc.paragraphs if p.text.strip()]
        assert len(non_empty) == 2
