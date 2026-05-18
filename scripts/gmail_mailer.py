"""
Gmail API mailer — OAuth setup and send helper for SERVICE.

Install:
  pip install google-auth-oauthlib google-api-python-client python-dotenv

First run opens a browser to authorize; saves token.json for future runs.
Then copy refresh_token to Render as GMAIL_REFRESH_TOKEN.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import sys
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

from dotenv import load_dotenv
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / ".env"
TOKEN_PATH = ROOT / "token.json"
SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
]

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("gmail_mailer")


def load_env() -> None:
    if ENV_PATH.exists():
        load_dotenv(ENV_PATH)
    else:
        load_dotenv()


def client_config() -> dict:
    client_id = os.getenv("GMAIL_CLIENT_ID", "").strip()
    client_secret = os.getenv("GMAIL_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret:
        raise ValueError(
            "GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set in .env (see .env.example)"
        )
    return {
        "installed": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://localhost"],
        }
    }


def get_credentials() -> Credentials:
    creds: Credentials | None = None

    if TOKEN_PATH.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_config(client_config(), SCOPES)
            creds = flow.run_local_server(port=0)
        TOKEN_PATH.write_text(creds.to_json(), encoding="utf-8")
        logger.info("Saved credentials to %s", TOKEN_PATH)

    if creds and creds.refresh_token:
        logger.info(
            "GMAIL_REFRESH_TOKEN for Render (copy this value):\n%s",
            creds.refresh_token,
        )

    return creds


def build_service():
    return build("gmail", "v1", credentials=get_credentials(), cache_discovery=False)


def send_gmail(to_email: str, subject: str, body_html: str, body_text: str | None = None) -> str:
    """
    Send an email via Gmail API. Returns the Gmail message id.
    Supports HTML body with plain-text fallback.
    """
    from_email = os.getenv("EMAIL_FROM", os.getenv("EMAIL_IMAP_USER", "editor@jusic.co")).strip()
    from_name = os.getenv("EMAIL_FROM_NAME", "Jusic").strip()

    message = MIMEMultipart("alternative")
    message["to"] = to_email
    message["from"] = f"{from_name} <{from_email}>"
    message["subject"] = subject

    plain = body_text if body_text is not None else _html_to_plain(body_html)
    message.attach(MIMEText(plain, "plain", "utf-8"))
    message.attach(MIMEText(body_html, "html", "utf-8"))

    raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8").rstrip("=")

    try:
        service = build_service()
        sent = (
            service.users()
            .messages()
            .send(userId="me", body={"raw": raw})
            .execute()
        )
        msg_id = sent.get("id", "")
        logger.info("Sent message id=%s to=%s", msg_id, to_email)
        return msg_id
    except HttpError as err:
        logger.error("Gmail API error: %s", err)
        raise
    except Exception as err:
        logger.error("Send failed: %s", err)
        raise


def _html_to_plain(html: str) -> str:
    import re

    text = re.sub(r"<br\s*/?>", "\n", html, flags=re.I)
    text = re.sub(r"</p>", "\n\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    return text.strip()


if __name__ == "__main__":
    load_env()

    if len(sys.argv) >= 2 and sys.argv[1] == "auth-only":
        get_credentials()
        print("Authentication complete. Check logs for GMAIL_REFRESH_TOKEN.")
        sys.exit(0)

    to = os.getenv("GMAIL_TEST_TO", "editor@jusic.co")
    subject = "SERVICE Gmail API test"
    html = """
    <div dir="rtl" style="font-family:Arial,sans-serif">
      <p><strong>בדיקת שליחה</strong> מ-SERVICE דרך Gmail API.</p>
    </div>
    """.strip()

    try:
        mid = send_gmail(to, subject, html)
        print(f"OK — message id: {mid}")
    except Exception as exc:
        print(f"FAILED — {exc}", file=sys.stderr)
        sys.exit(1)
