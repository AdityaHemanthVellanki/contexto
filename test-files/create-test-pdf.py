#!/usr/bin/env python3
"""
Create a test PDF file for QA testing
"""
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import os

def create_test_pdf():
    filename = "test-document.pdf"
    c = canvas.Canvas(filename, pagesize=letter)
    width, height = letter
    
    # Page 1
    c.setFont("Helvetica-Bold", 16)
    c.drawString(100, height - 100, "QA Test PDF Document")
    
    c.setFont("Helvetica", 12)
    y = height - 150
    
    test_content = [
        "This is a comprehensive test PDF for validating PDF extraction accuracy.",
        "",
        "Key Test Phrases:",
        "• PDF_UNIQUE_ID_24680 - This phrase should be extracted exactly",
        "• Numbers: 42, 3.14159, -17",
        "• Special characters: @#$%^&*()",
        "• Unicode: café, naïve, résumé",
        "",
        "Content Sections:",
        "1. Introduction: This document tests PDF processing",
        "2. Data validation: Row 5, Column 2 contains value PDF_TEST_VALUE_135",
        "3. Code snippet: function testPDFFunction() { return 'pdf_success'; }",
        "",
        "Expected chunk count: approximately 2-3 chunks",
        "Expected extraction: 100% accuracy for PDF text extraction"
    ]
    
    for line in test_content:
        c.drawString(100, y, line)
        y -= 20
        if y < 100:  # Start new page
            c.showPage()
            c.setFont("Helvetica", 12)
            y = height - 100
    
    # Page 2
    c.showPage()
    c.setFont("Helvetica-Bold", 14)
    c.drawString(100, height - 100, "Page 2: Additional Test Content")
    
    c.setFont("Helvetica", 12)
    y = height - 150
    
    page2_content = [
        "This is page 2 of the test PDF document.",
        "",
        "Additional test phrases:",
        "• PDF_PAGE2_IDENTIFIER_97531",
        "• Multi-page extraction test",
        "• Table-like data:",
        "",
        "Name          | Age | Department",
        "John Doe      | 28  | Engineering", 
        "Jane Smith    | 32  | Marketing",
        "Bob Johnson   | 45  | Sales",
        "",
        "End of PDF test document."
    ]
    
    for line in page2_content:
        c.drawString(100, y, line)
        y -= 20
    
    c.save()
    print(f"Created {filename} successfully")

if __name__ == "__main__":
    create_test_pdf()
