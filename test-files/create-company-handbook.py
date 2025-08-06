#!/usr/bin/env python3
"""
Create a sample company handbook PDF for testing the AI pipeline
"""
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
from reportlab.lib.units import inch
import os

def create_company_handbook():
    filename = "sample_company_handbook.pdf"
    doc = SimpleDocTemplate(filename, pagesize=letter)
    styles = getSampleStyleSheet()
    
    # Create custom styles
    styles.add(ParagraphStyle(name='Heading1', 
                             parent=styles['Heading1'], 
                             fontSize=18,
                             spaceAfter=12))
    
    styles.add(ParagraphStyle(name='Heading2', 
                             parent=styles['Heading2'], 
                             fontSize=14,
                             spaceBefore=12,
                             spaceAfter=6))
    
    styles.add(ParagraphStyle(name='Normal', 
                             parent=styles['Normal'], 
                             fontSize=10,
                             spaceBefore=6,
                             spaceAfter=6))
    
    # Content for the handbook
    content = []
    
    # Title
    content.append(Paragraph("TechCorp Employee Handbook", styles['Title']))
    content.append(Spacer(1, 0.25*inch))
    content.append(Paragraph("Effective Date: January 1, 2023", styles['Normal']))
    content.append(Spacer(1, 0.5*inch))
    
    # Introduction
    content.append(Paragraph("1. Introduction", styles['Heading1']))
    content.append(Paragraph("""
    Welcome to TechCorp! This handbook contains important information about our company policies, 
    benefits, and expectations. All employees are expected to familiarize themselves with the 
    contents of this handbook. This document is not a contract of employment and does not guarantee 
    employment for any specific duration.
    """, styles['Normal']))
    
    # Company Values
    content.append(Paragraph("2. Company Values", styles['Heading1']))
    content.append(Paragraph("""
    At TechCorp, we believe in innovation, integrity, collaboration, and excellence. Our mission 
    is to create cutting-edge technology solutions that improve people's lives while maintaining 
    the highest ethical standards.
    """, styles['Normal']))
    
    # Employment Policies
    content.append(Paragraph("3. Employment Policies", styles['Heading1']))
    
    content.append(Paragraph("3.1 Equal Employment Opportunity", styles['Heading2']))
    content.append(Paragraph("""
    TechCorp is an equal opportunity employer. We do not discriminate based on race, color, 
    religion, gender, sexual orientation, gender identity, national origin, age, disability, 
    or any other protected characteristic.
    """, styles['Normal']))
    
    content.append(Paragraph("3.2 Employment Classifications", styles['Heading2']))
    content.append(Paragraph("""
    TechCorp classifies employees as follows:
    
    • Full-time: Employees who work 40 hours per week
    • Part-time: Employees who work fewer than 40 hours per week
    • Temporary: Employees hired for a specific project or time period
    • Exempt: Salaried employees who are not eligible for overtime pay
    • Non-exempt: Hourly employees who are eligible for overtime pay
    """, styles['Normal']))
    
    # Work Hours and Compensation
    content.append(Paragraph("4. Work Hours and Compensation", styles['Heading1']))
    
    content.append(Paragraph("4.1 Work Hours", styles['Heading2']))
    content.append(Paragraph("""
    Standard work hours are Monday through Friday, 9:00 AM to 5:00 PM. Flexible work arrangements 
    may be available depending on job requirements and manager approval.
    
    Part-time employees' schedules will be determined based on business needs and will be 
    communicated at the time of hire or when a change occurs.
    """, styles['Normal']))
    
    content.append(Paragraph("4.2 Compensation", styles['Heading2']))
    content.append(Paragraph("""
    Employees are paid bi-weekly. Direct deposit is available and encouraged. Annual performance 
    reviews will be conducted to evaluate potential salary adjustments.
    """, styles['Normal']))
    
    # Leave Policies
    content.append(Paragraph("5. Leave Policies", styles['Heading1']))
    
    content.append(Paragraph("5.1 Vacation Leave", styles['Heading2']))
    content.append(Paragraph("""
    Full-time employees accrue vacation leave as follows:
    • 0-2 years of service: 10 days per year
    • 3-5 years of service: 15 days per year
    • 6+ years of service: 20 days per year
    
    Part-time employees who work at least 20 hours per week accrue vacation leave on a pro-rated 
    basis. For example, an employee working 20 hours per week (50% of full-time) with 0-2 years 
    of service would accrue 5 days per year.
    
    Vacation leave must be approved by your manager at least two weeks in advance.
    """, styles['Normal']))
    
    content.append(Paragraph("5.2 Sick Leave", styles['Heading2']))
    content.append(Paragraph("""
    Full-time employees receive 8 sick days per year, accrued monthly.
    
    Part-time employees who work at least 20 hours per week receive sick leave on a pro-rated 
    basis according to their standard hours. For example, an employee working 20 hours per week 
    would receive 4 sick days per year.
    
    Sick leave may be used for personal illness, medical appointments, or to care for an immediate 
    family member who is ill.
    """, styles['Normal']))
    
    content.append(Paragraph("5.3 Parental Leave", styles['Heading2']))
    content.append(Paragraph("""
    Full-time employees with at least one year of service are eligible for parental leave:
    • Birth parents: 12 weeks of paid leave
    • Non-birth parents: 6 weeks of paid leave
    
    Part-time employees who work at least 20 hours per week are eligible for parental leave on a 
    pro-rated basis according to their standard hours. For example, an employee working 20 hours 
    per week would be eligible for 6 weeks of paid leave for birth parents and 3 weeks for non-birth 
    parents.
    """, styles['Normal']))
    
    content.append(Paragraph("5.4 Bereavement Leave", styles['Heading2']))
    content.append(Paragraph("""
    All employees, including part-time employees, are eligible for up to 3 days of paid bereavement 
    leave in the event of the death of an immediate family member. Part-time employees will receive 
    bereavement pay based on their scheduled hours during the bereavement period.
    """, styles['Normal']))
    
    content.append(Paragraph("5.5 Leave of Absence", styles['Heading2']))
    content.append(Paragraph("""
    Employees may request an unpaid leave of absence for reasons not covered by other leave policies. 
    Approval is at the discretion of management.
    
    For part-time employees, any leave of absence will be evaluated on a case-by-case basis, with 
    consideration given to the employee's length of service, performance, and the company's needs.
    """, styles['Normal']))
    
    # Benefits
    content.append(Paragraph("6. Benefits", styles['Heading1']))
    
    content.append(Paragraph("6.1 Health Insurance", styles['Heading2']))
    content.append(Paragraph("""
    Full-time employees are eligible for health, dental, and vision insurance after 30 days of 
    employment. TechCorp covers 80% of the premium for employee coverage.
    
    Part-time employees who work at least 30 hours per week are eligible for the same health 
    insurance benefits as full-time employees. Part-time employees who work 20-29 hours per week 
    are eligible to participate in the company's health insurance plan, but TechCorp will cover 
    only 50% of the premium for employee coverage.
    """, styles['Normal']))
    
    content.append(Paragraph("6.2 Retirement Plan", styles['Heading2']))
    content.append(Paragraph("""
    All employees, including part-time employees, are eligible to participate in the company's 
    401(k) plan after 90 days of employment. TechCorp matches 50% of employee contributions up 
    to 6% of salary.
    """, styles['Normal']))
    
    content.append(Paragraph("6.3 Professional Development", styles['Heading2']))
    content.append(Paragraph("""
    TechCorp supports employee growth through professional development opportunities. Full-time 
    employees are eligible for up to $2,000 per year for approved courses, certifications, or 
    conferences.
    
    Part-time employees who work at least 20 hours per week are eligible for professional 
    development benefits on a pro-rated basis according to their standard hours.
    """, styles['Normal']))
    
    # Code of Conduct
    content.append(Paragraph("7. Code of Conduct", styles['Heading1']))
    content.append(Paragraph("""
    All employees are expected to maintain professional behavior, respect company property, 
    protect confidential information, avoid conflicts of interest, and adhere to all company 
    policies. Violations may result in disciplinary action up to and including termination.
    """, styles['Normal']))
    
    # Build the PDF
    doc.build(content)
    print(f"Created {filename} successfully")

if __name__ == "__main__":
    create_company_handbook()
