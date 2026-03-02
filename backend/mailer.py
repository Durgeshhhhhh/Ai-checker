import os
import smtplib
from email.message import EmailMessage


def _smtp_config():
    host = os.getenv("SMTP_HOST", "").strip()
    port = int(os.getenv("SMTP_PORT", "587"))
    username = os.getenv("SMTP_USERNAME", "").strip()
    password = os.getenv("SMTP_PASSWORD", "")
    from_email = os.getenv("SMTP_FROM_EMAIL", username or "").strip()
    use_tls = os.getenv("SMTP_USE_TLS", "true").strip().lower() in {"1", "true", "yes", "on"}
    return host, port, username, password, from_email, use_tls


def send_admin_approval_email(to_email: str, login_email: str, login_password: str) -> None:
    host, port, username, password, from_email, use_tls = _smtp_config()
    if not host or not from_email:
        raise RuntimeError("SMTP is not configured. Set SMTP_HOST and SMTP_FROM_EMAIL.")

    msg = EmailMessage()
    msg["Subject"] = "Admin Access Request Approved"
    msg["From"] = from_email
    msg["To"] = to_email
    msg.set_content(
        "Your admin access request has been approved.\n\n"
        f"You can now login.\n"
        f"Email: {login_email}\n"
        f"Password: {login_password}\n\n"
        "Please login and change your password if needed."
    )

    with smtplib.SMTP(host, port, timeout=20) as server:
        if use_tls:
            server.starttls()
        if username:
            server.login(username, password)
        server.send_message(msg)
