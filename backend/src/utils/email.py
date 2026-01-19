import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
from ..config import settings


def send_email(
    to_email: str,
    subject: str,
    body: str,
    html_body: Optional[str] = None,
    cc: Optional[List[str]] = None,
    bcc: Optional[List[str]] = None
) -> bool:
    """
    Send an email using SMTP.
    
    Args:
        to_email: Recipient email address
        subject: Email subject
        body: Plain text email body
        html_body: Optional HTML email body
        cc: Optional list of CC recipients
        bcc: Optional list of BCC recipients
        
    Returns:
        True if email sent successfully, False otherwise
    """
    try:
        msg = MIMEMultipart('alternative')
        msg['From'] = settings.email_from
        msg['To'] = to_email
        msg['Subject'] = subject
        
        if cc:
            msg['Cc'] = ', '.join(cc)
        if bcc:
            msg['Bcc'] = ', '.join(bcc)
        
        # Attach plain text version
        part1 = MIMEText(body, 'plain')
        msg.attach(part1)
        
        # Attach HTML version if provided
        if html_body:
            part2 = MIMEText(html_body, 'html')
            msg.attach(part2)
        
        # Connect to SMTP server and send
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            if settings.smtp_user and settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)
            
            recipients = [to_email]
            if cc:
                recipients.extend(cc)
            if bcc:
                recipients.extend(bcc)
            
            server.sendmail(settings.email_from, recipients, msg.as_string())
        
        return True
    except Exception as e:
        # Log error in production
        print(f"Failed to send email: {str(e)}")
        return False


def send_password_reset_email(to_email: str, reset_token: str) -> bool:
    """
    Send password reset email with reset link.
    
    Args:
        to_email: Recipient email address
        reset_token: Password reset token
        
    Returns:
        True if email sent successfully, False otherwise
    """
    # In production, this would be the actual frontend URL
    reset_link = f"http://localhost:5173/reset-password?token={reset_token}"
    
    subject = "Password Reset Request"
    body = f"""
You have requested to reset your password.

Please click the link below to reset your password:
{reset_link}

This link will expire in 24 hours.

If you did not request this password reset, please ignore this email.
"""
    
    html_body = f"""
<html>
<body>
    <h2>Password Reset Request</h2>
    <p>You have requested to reset your password.</p>
    <p>Please click the link below to reset your password:</p>
    <p><a href="{reset_link}">Reset Password</a></p>
    <p>This link will expire in 24 hours.</p>
    <p>If you did not request this password reset, please ignore this email.</p>
</body>
</html>
"""
    
    return send_email(to_email, subject, body, html_body)
