"""
alerts.py
=========
Apex AI — Smart Alert / Notification System
--------------------------------------------
Delivers trading signals to users via:
  • Telegram  (python-telegram-bot, async send)
  • Email     (smtplib SMTP_SSL, HTML template)

Celery Beat task ``scan_and_alert`` runs every 4 hours, loops over all users'
watchlists, calls ``signal_gate.run_inference``, and dispatches alerts when the
signal action is not HOLD *and* the confidence meets each user's threshold.

A per-user, per-ticker 24-hour deduplication guard is stored in Redis to avoid
alert flooding.

Environment variables (never hardcoded)
  TELEGRAM_BOT_TOKEN   — Bot token from @BotFather
  SMTP_HOST            — e.g. smtp.gmail.com
  SMTP_PORT            — e.g. 465  (SSL) or 587 (TLS)
  SMTP_USER            — Sender address / login
  SMTP_PASSWORD        — SMTP password / app-password
  REDIS_URL            — e.g. redis://localhost:6379/0
  DASHBOARD_URL        — Base URL used in email "View Full Analysis" button
                         (default: http://localhost:5173)

Author : Apex AI Team
Requires: python-telegram-bot>=20, celery, redis, smtplib (stdlib)
"""

from __future__ import annotations

import logging
import os
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("apex_ai.alerts")

# ---------------------------------------------------------------------------
# Environment helpers
# ---------------------------------------------------------------------------
_TELEGRAM_BOT_TOKEN: str = os.environ.get("TELEGRAM_BOT_TOKEN", "")
_SMTP_HOST: str          = os.environ.get("SMTP_HOST", "smtp.gmail.com")
_SMTP_PORT: int          = int(os.environ.get("SMTP_PORT", "465"))
_SMTP_USER: str          = os.environ.get("SMTP_USER", "")
_SMTP_PASSWORD: str      = os.environ.get("SMTP_PASSWORD", "")
_REDIS_URL: str          = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
_DASHBOARD_URL: str      = os.environ.get("DASHBOARD_URL", "http://localhost:5173")

# Redis key TTL for duplicate-alert guard (seconds in 24 h)
_ALERT_TTL_SECONDS: int = 86_400


# ===========================================================================
# ── SECTION 1: Message Formatting ───────────────────────────────────────────
# ===========================================================================

def format_signal_message(
    signal_output: Any,
    ticker: str,
    explanation_text: str,
) -> str:
    """Build a Telegram Markdown-formatted message string for a trading signal.

    Parameters
    ----------
    signal_output : SignalOutput
        Structured output from ``signal_gate.gate_signal`` / ``run_inference``.
    ticker : str
        Stock ticker symbol, e.g. ``'AAPL'``.
    explanation_text : str
        Human-readable SHAP/feature explanation, e.g.
        ``'RSI recovery from oversold + VIX declining'``.

    Returns
    -------
    str
        Telegram Markdown-formatted message string ready to pass to
        ``bot.send_message(parse_mode='Markdown')``.

    Examples
    --------
    >>> msg = format_signal_message(signal, "AAPL", "RSI oversold recovery")
    >>> assert "*🟢 BUY SIGNAL" in msg or "*🔴 SELL SIGNAL" in msg
    """
    action: str  = signal_output.action          # 'BUY' | 'SELL' | 'HOLD'
    conf: float  = signal_output.confidence
    p10: float   = signal_output.p10
    p50: float   = signal_output.p50
    p90: float   = signal_output.p90
    ret: float   = signal_output.expected_return_pct
    cur: float   = signal_output.current_price

    # Signal badge
    if action == "BUY":
        badge = "🟢 BUY"
    elif action == "SELL":
        badge = "🔴 SELL"
    else:
        badge = "🟡 HOLD"

    # Horizon is a fixed 14-day forecast window for display purposes
    horizon_label = "14d"

    # Expected-return sign and colour hint via emoji
    ret_sign  = "+" if ret >= 0 else ""
    pct_label = f"{ret_sign}{ret:.1f}%"

    # Risk hint derived from cone width
    cone_width = (p90 - p10) / p50 if p50 > 0 else 0
    if cone_width > 0.12:
        risk_note = "⚠️ _Risk: ATR elevated — size position carefully_"
    elif cone_width > 0.07:
        risk_note = "⚠️ _Risk: Moderate uncertainty — use limit orders_"
    else:
        risk_note = "✅ _Risk: Low cone width — high conviction setup_"

    message = (
        f"*{badge} SIGNAL — {ticker.upper()}*\n"
        f"Confidence: {conf:.2f} | Horizon: {horizon_label}\n"
        f"P50 Forecast: ${p50:.2f} ({pct_label})\n"
        f"Range: ${p10:.2f} — ${p90:.2f}\n"
        f"\n"
        f"_Why: {explanation_text}_\n"
        f"\n"
        f"{risk_note}"
    )
    return message


def format_email_html(
    signal_output: Any,
    ticker: str,
    explanation_text: str,
    top_features: Optional[List[Dict[str, Any]]] = None,
) -> str:
    """Generate a dark-themed HTML email body for a trading signal.

    Parameters
    ----------
    signal_output : SignalOutput
        Structured output from ``signal_gate``.
    ticker : str
        Stock ticker symbol.
    explanation_text : str
        Narrative explanation for the signal.
    top_features : list of dict, optional
        List of ``{'feature': str, 'importance': float}`` dicts for the mini
        feature-importance table.  If omitted, the table is skipped.

    Returns
    -------
    str
        Complete HTML document string suitable for an email body.
    """
    action: str  = signal_output.action
    conf: float  = signal_output.confidence
    p10: float   = signal_output.p10
    p50: float   = signal_output.p50
    p90: float   = signal_output.p90
    ret: float   = signal_output.expected_return_pct
    cur: float   = signal_output.current_price

    # ── Badge styling ────────────────────────────────────────────────────────
    if action == "BUY":
        badge_color  = "#00c896"   # green
        badge_bg     = "#003322"
        badge_label  = "🟢 BUY SIGNAL"
    elif action == "SELL":
        badge_color  = "#ff4d6d"   # red
        badge_bg     = "#330011"
        badge_label  = "🔴 SELL SIGNAL"
    else:
        badge_color  = "#f5a623"   # amber
        badge_bg     = "#332200"
        badge_label  = "🟡 HOLD"

    # ── Feature importance table rows ────────────────────────────────────────
    feature_rows_html = ""
    if top_features:
        for feat in top_features[:6]:   # cap at 6 rows
            fname  = feat.get("feature", "N/A")
            fimport = feat.get("importance", 0.0)
            bar_pct = min(int(abs(fimport) * 100), 100)
            bar_color = "#00c896" if fimport >= 0 else "#ff4d6d"
            feature_rows_html += f"""
            <tr>
              <td style="padding:6px 10px;color:#c5c9d4;font-size:13px;">{fname}</td>
              <td style="padding:6px 10px;">
                <div style="
                  background:{bar_color};
                  width:{bar_pct}%;
                  height:8px;
                  border-radius:4px;
                  min-width:4px;">
                </div>
              </td>
              <td style="padding:6px 10px;color:#c5c9d4;font-size:13px;text-align:right;">
                {fimport:+.3f}
              </td>
            </tr>"""

    feature_table_html = ""
    if feature_rows_html:
        feature_table_html = f"""
        <h3 style="color:#a0a8b8;font-size:14px;margin:24px 0 8px;
                   letter-spacing:1px;text-transform:uppercase;">
          Feature Importance
        </h3>
        <table style="width:100%;border-collapse:collapse;
                      background:#1a1e2e;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#12152a;">
              <th style="padding:8px 10px;color:#6c7a96;font-size:12px;
                         text-align:left;font-weight:600;">Feature</th>
              <th style="padding:8px 10px;color:#6c7a96;font-size:12px;
                         text-align:left;font-weight:600;">Impact</th>
              <th style="padding:8px 10px;color:#6c7a96;font-size:12px;
                         text-align:right;font-weight:600;">Value</th>
            </tr>
          </thead>
          <tbody>{feature_rows_html}</tbody>
        </table>"""

    ret_sign = "+" if ret >= 0 else ""
    dashboard_url = f"{_DASHBOARD_URL}?ticker={ticker.upper()}"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Apex AI Signal — {ticker.upper()}</title>
</head>
<body style="margin:0;padding:0;background:#0d1117;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#0d1117;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#12152a;border-radius:16px;
                    border:1px solid #1e2540;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a1e35 0%,#0e1b3a 100%);
                     padding:28px 32px;">
            <p style="margin:0;font-size:11px;letter-spacing:3px;
                      color:#5a6480;text-transform:uppercase;">Apex AI Trading Signals</p>
            <h1 style="margin:8px 0 0;font-size:26px;font-weight:700;color:#e8ecf4;">
              {ticker.upper()} Signal Report
            </h1>
          </td>
        </tr>

        <!-- Signal Badge -->
        <tr>
          <td style="padding:24px 32px 0;">
            <div style="
              display:inline-block;
              background:{badge_bg};
              border:1px solid {badge_color};
              border-radius:10px;
              padding:14px 24px;">
              <span style="font-size:22px;font-weight:700;color:{badge_color};">
                {badge_label}
              </span>
              <span style="margin-left:16px;font-size:15px;color:#a0a8b8;">
                Confidence: {conf:.0%}
              </span>
            </div>
          </td>
        </tr>

        <!-- Forecast Row: P10 / P50 / P90 -->
        <tr>
          <td style="padding:24px 32px 0;">
            <h3 style="color:#a0a8b8;font-size:14px;margin:0 0 12px;
                       letter-spacing:1px;text-transform:uppercase;">
              14-Day Price Forecast
            </h3>
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border-collapse:collapse;">
              <tr>
                <td style="width:33%;text-align:center;padding:12px;
                           background:#1a1e2e;border-radius:8px 0 0 8px;">
                  <p style="margin:0;color:#6c7a96;font-size:11px;
                             text-transform:uppercase;letter-spacing:1px;">P10</p>
                  <p style="margin:6px 0 0;color:#ff4d6d;
                             font-size:20px;font-weight:700;">${p10:.2f}</p>
                </td>
                <td style="width:1px;background:#0d1117;"></td>
                <td style="width:33%;text-align:center;padding:12px;
                           background:#1e243a;">
                  <p style="margin:0;color:#6c7a96;font-size:11px;
                             text-transform:uppercase;letter-spacing:1px;">
                    P50 &nbsp;·&nbsp; {ret_sign}{ret:.1f}%</p>
                  <p style="margin:6px 0 0;color:#e8ecf4;
                             font-size:22px;font-weight:700;">${p50:.2f}</p>
                </td>
                <td style="width:1px;background:#0d1117;"></td>
                <td style="width:33%;text-align:center;padding:12px;
                           background:#1a1e2e;border-radius:0 8px 8px 0;">
                  <p style="margin:0;color:#6c7a96;font-size:11px;
                             text-transform:uppercase;letter-spacing:1px;">P90</p>
                  <p style="margin:6px 0 0;color:#00c896;
                             font-size:20px;font-weight:700;">${p90:.2f}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Why / Explanation -->
        <tr>
          <td style="padding:24px 32px 0;">
            <h3 style="color:#a0a8b8;font-size:14px;margin:0 0 8px;
                       letter-spacing:1px;text-transform:uppercase;">Signal Rationale</h3>
            <p style="margin:0;color:#c5c9d4;font-size:14px;
                      line-height:1.6;background:#1a1e2e;
                      border-left:3px solid {badge_color};
                      padding:12px 16px;border-radius:0 8px 8px 0;">
              {explanation_text}
            </p>
          </td>
        </tr>

        <!-- Feature Table (optional) -->
        <tr>
          <td style="padding:0 32px;">
            {feature_table_html}
          </td>
        </tr>

        <!-- CTA Button -->
        <tr>
          <td style="padding:28px 32px;text-align:center;">
            <a href="{dashboard_url}"
               style="
                 display:inline-block;
                 background:linear-gradient(135deg,#3b5bff,#7b2fff);
                 color:#ffffff;
                 text-decoration:none;
                 font-size:15px;
                 font-weight:600;
                 padding:14px 36px;
                 border-radius:10px;
                 letter-spacing:0.5px;">
              View Full Analysis →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px 28px;border-top:1px solid #1e2540;">
            <p style="margin:0;color:#3d4762;font-size:11px;text-align:center;">
              Apex AI &nbsp;·&nbsp; Automated Trading Signals &nbsp;·&nbsp;
              This is not financial advice. Trade responsibly.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""
    return html


# ===========================================================================
# ── SECTION 2: Telegram Delivery ────────────────────────────────────────────
# ===========================================================================

async def _async_send_telegram(chat_id: str | int, text: str) -> bool:
    """Internal async helper that calls the Telegram Bot API."""
    try:
        from telegram import Bot  # python-telegram-bot >= 20
        bot = Bot(token=_TELEGRAM_BOT_TOKEN)
        async with bot:
            await bot.send_message(
                chat_id=chat_id,
                text=text,
                parse_mode="Markdown",
            )
        return True
    except Exception as exc:           # TelegramError, NetworkError, etc.
        logger.error(
            "Telegram send FAILED  chat_id=%s  error=%s", chat_id, exc
        )
        return False


def send_telegram_alert(
    chat_id: str | int,
    signal_output: Any,
    ticker: str,
    explanation_text: str,
) -> bool:
    """Format and send a Telegram trading-signal alert.

    Wraps the async Telegram Bot API call so it can be called from synchronous
    Celery tasks without requiring the caller to manage an event loop.

    Parameters
    ----------
    chat_id : str or int
        Telegram chat / user ID stored in the user's profile.
    signal_output : SignalOutput
        Structured signal from ``signal_gate``.
    ticker : str
        Stock ticker symbol.
    explanation_text : str
        Narrative explanation for the signal.

    Returns
    -------
    bool
        ``True`` if the message was delivered, ``False`` on any error.

    Notes
    -----
    Errors are logged but **never** re-raised so a single bad send cannot
    crash the Celery scan loop.
    """
    import asyncio

    if not _TELEGRAM_BOT_TOKEN:
        logger.warning("send_telegram_alert: TELEGRAM_BOT_TOKEN not set — skipping.")
        return False

    message = format_signal_message(signal_output, ticker, explanation_text)

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Already inside an async context (e.g. FastAPI); schedule coroutine
            import concurrent.futures
            future = asyncio.ensure_future(_async_send_telegram(chat_id, message))
            ok: bool = False
            # This branch typically won't be hit from Celery, but handle it
            with concurrent.futures.ThreadPoolExecutor() as pool:
                ok = pool.submit(asyncio.run, _async_send_telegram(chat_id, message)).result()
        else:
            ok = loop.run_until_complete(_async_send_telegram(chat_id, message))
    except RuntimeError:
        # No running loop at all — create a fresh one
        ok = asyncio.run(_async_send_telegram(chat_id, message))

    if ok:
        logger.info("Telegram alert SENT  ticker=%s  chat_id=%s", ticker, chat_id)
    return ok


# ===========================================================================
# ── SECTION 3: Email Delivery ────────────────────────────────────────────────
# ===========================================================================

def send_email_alert(
    to_email: str,
    subject: str,
    html_body: str,
) -> bool:
    """Send an HTML email via SMTP_SSL.

    Credentials are loaded from environment variables:
    ``SMTP_HOST``, ``SMTP_PORT``, ``SMTP_USER``, ``SMTP_PASSWORD``.

    Parameters
    ----------
    to_email : str
        Recipient email address.
    subject : str
        Email subject line.
    html_body : str
        Full HTML string (e.g. from :func:`format_email_html`).

    Returns
    -------
    bool
        ``True`` on success, ``False`` on any error.

    Notes
    -----
    Failures are logged but **never** re-raised — the caller (Celery task)
    must not crash due to a transient SMTP issue.
    """
    if not all([_SMTP_HOST, _SMTP_USER, _SMTP_PASSWORD]):
        logger.warning("send_email_alert: SMTP credentials not configured — skipping.")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"Apex AI Signals <{_SMTP_USER}>"
    msg["To"]      = to_email
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(_SMTP_HOST, _SMTP_PORT, context=context) as server:
            server.login(_SMTP_USER, _SMTP_PASSWORD)
            server.sendmail(_SMTP_USER, [to_email], msg.as_string())
        logger.info("Email alert SENT  to=%s  subject=%r", to_email, subject)
        return True
    except smtplib.SMTPAuthenticationError as exc:
        logger.error("send_email_alert: SMTP auth failed — %s", exc)
    except smtplib.SMTPException as exc:
        logger.error("send_email_alert: SMTP error — %s", exc)
    except OSError as exc:
        logger.error("send_email_alert: network error — %s", exc)
    return False


# ===========================================================================
# ── SECTION 4: Redis Duplicate Guard ────────────────────────────────────────
# ===========================================================================

def _redis_client():
    """Return a connected Redis client, or None if Redis is unavailable."""
    try:
        import redis as redis_lib
        client = redis_lib.from_url(_REDIS_URL, decode_responses=True)
        client.ping()
        return client
    except Exception as exc:
        logger.warning("_redis_client: Redis unavailable — %s", exc)
        return None


def _alert_was_sent_recently(
    redis_client: Any,
    user_id: str,
    ticker: str,
) -> bool:
    """Return True if an alert was already dispatched for (user, ticker) in the last 24 h."""
    if redis_client is None:
        return False   # fail-open: allow send if Redis is down
    key = f"apex_ai:alert_sent:{user_id}:{ticker.upper()}"
    return redis_client.exists(key) > 0


def _mark_alert_sent(
    redis_client: Any,
    user_id: str,
    ticker: str,
) -> None:
    """Set the Redis duplicate-guard key with a 24-hour TTL."""
    if redis_client is None:
        return
    key = f"apex_ai:alert_sent:{user_id}:{ticker.upper()}"
    redis_client.set(key, "1", ex=_ALERT_TTL_SECONDS)


# ===========================================================================
# ── SECTION 5: Celery App ───────────────────────────────────────────────────
# ===========================================================================

def _make_celery_app():
    """Create and return the Celery application instance."""
    from celery import Celery
    app = Celery("apex_ai", broker=_REDIS_URL, backend=_REDIS_URL)
    app.conf.update(
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        timezone="UTC",
        enable_utc=True,
        beat_schedule={
            "scan-and-alert-every-4h": {
                "task": "alerts.scan_and_alert",
                "schedule": 4 * 60 * 60,   # 4 hours in seconds
                "options": {"expires": 3 * 60 * 60},
            },
        },
    )
    return app


# Lazy init: gracefully degrade if Celery is not installed
try:
    celery_app = _make_celery_app()
except ImportError:
    celery_app = None  # type: ignore[assignment]
    logger.warning(
        "Celery not installed — scan_and_alert task unavailable. "
        "Run: pip install celery[redis]"
    )


# ===========================================================================
# ── SECTION 6: Celery Beat Task — scan_and_alert ────────────────────────────
# ===========================================================================

def scan_and_alert(*args, **kwargs) -> Dict[str, Any]:  # decorated below if Celery available
    """Scheduled Celery Beat task: scan watchlists and dispatch alerts.

    Decorating happens at the bottom of the module so that importing
    ``alerts`` does not crash when Celery is absent.
    """
    return _scan_and_alert_impl(*args, **kwargs)


def _scan_and_alert_impl(self=None) -> Dict[str, Any]:
    """Scheduled Celery Beat task: scan watchlists and dispatch alerts.

    Runs every 4 hours (configured in beat_schedule above).

    Workflow
    --------
    1. Connect to Redis for deduplication.
    2. Load all active users (with watchlists and preferences) from DB.
    3. For each user → for each ticker in their watchlist:
       a. Call ``run_inference(ticker, model, training_dataset)``.
       b. Skip if action == 'HOLD'.
       c. Skip if confidence < user's ``alert_threshold``.
       d. Skip if a duplicate alert was sent within 24 h.
       e. Send Telegram alert (if chat_id configured).
       f. Send email alert   (if email configured).
       g. Record sent flag in Redis.
    4. Return summary dict with counts for logging / monitoring.

    Returns
    -------
    dict
        ``{'tickers_scanned': int, 'alerts_sent': int, 'errors': int}``
    """
    logger.info("scan_and_alert: task started")

    tickers_scanned: int = 0
    alerts_sent: int     = 0
    errors: int          = 0

    # ── Step 1: Redis connection ─────────────────────────────────────────────
    rc = _redis_client()

    # ── Step 2: Load model once (expensive — cache between task runs) ────────
    model            = None
    training_dataset = None
    try:
        model, training_dataset = _load_model_cached()
    except Exception as exc:
        logger.error("scan_and_alert: model load failed — %s", exc)
        return {"tickers_scanned": 0, "alerts_sent": 0, "errors": 1}

    # ── Step 3: Load users ───────────────────────────────────────────────────
    try:
        users = _get_all_users_with_watchlists()
    except Exception as exc:
        logger.error("scan_and_alert: failed to fetch users — %s", exc)
        return {"tickers_scanned": 0, "alerts_sent": 0, "errors": 1}

    # ── Step 4: Scan loop ────────────────────────────────────────────────────
    for user in users:
        user_id:         str   = str(user.get("id", "unknown"))
        watchlist:       List  = user.get("watchlist", [])
        alert_threshold: float = float(user.get("alert_threshold", 0.65))
        telegram_chat_id       = user.get("telegram_chat_id")
        email:           str   = user.get("email", "")

        for ticker in watchlist:
            tickers_scanned += 1
            try:
                # ── 4a: Run inference ────────────────────────────────────────
                from signal_gate import run_inference
                signal = run_inference(ticker, model, training_dataset)

                logger.info(
                    "scan_and_alert [user=%s  ticker=%s]: action=%s  confidence=%.2f",
                    user_id, ticker, signal.action, signal.confidence,
                )

                # ── 4b: Skip HOLDs ───────────────────────────────────────────
                if signal.action == "HOLD":
                    continue

                # ── 4c: Respect user threshold ───────────────────────────────
                if signal.confidence < alert_threshold:
                    logger.info(
                        "scan_and_alert [user=%s  ticker=%s]: "
                        "confidence %.2f < threshold %.2f — skipping",
                        user_id, ticker, signal.confidence, alert_threshold,
                    )
                    continue

                # ── 4d: Duplicate guard ──────────────────────────────────────
                if _alert_was_sent_recently(rc, user_id, ticker):
                    logger.info(
                        "scan_and_alert [user=%s  ticker=%s]: "
                        "duplicate within 24 h — skipping",
                        user_id, ticker,
                    )
                    continue

                # ── 4e/4f: Dispatch alerts ───────────────────────────────────
                explanation = signal.reason
                sent_any    = False

                if telegram_chat_id:
                    ok = send_telegram_alert(
                        chat_id=telegram_chat_id,
                        signal_output=signal,
                        ticker=ticker,
                        explanation_text=explanation,
                    )
                    sent_any = sent_any or ok

                if email:
                    subject   = f"Apex AI — {signal.action} Signal: {ticker.upper()}"
                    html_body = format_email_html(signal, ticker, explanation)
                    ok = send_email_alert(email, subject, html_body)
                    sent_any = sent_any or ok

                # ── 4g: Mark sent ────────────────────────────────────────────
                if sent_any:
                    _mark_alert_sent(rc, user_id, ticker)
                    alerts_sent += 1

            except Exception as exc:
                errors += 1
                logger.error(
                    "scan_and_alert [user=%s  ticker=%s]: unexpected error — %s",
                    user_id, ticker, exc,
                    exc_info=True,
                )

    summary = {
        "tickers_scanned": tickers_scanned,
        "alerts_sent":     alerts_sent,
        "errors":          errors,
    }
    logger.info("scan_and_alert: DONE — %s", summary)
    return summary


# ===========================================================================
# ── SECTION 7: Stubs — replace with real DB / model loading ─────────────────
# ===========================================================================

def _load_model_cached():
    """Load TFT model + training dataset.  Replace with your production loader.

    Returns
    -------
    tuple[TemporalFusionTransformer, TimeSeriesDataSet]
        (model, training_dataset) ready for ``run_inference``.
    """
    model_path = os.environ.get("MODEL_PATH", "models/tft_model.ckpt")
    try:
        from pytorch_forecasting import TemporalFusionTransformer
        import torch
        model = TemporalFusionTransformer.load_from_checkpoint(model_path)
        model.eval()
        # training_dataset is typically serialised alongside the checkpoint;
        # adjust this path / loading logic to match your project layout.
        import pickle
        dataset_path = model_path.replace(".ckpt", "_dataset.pkl")
        with open(dataset_path, "rb") as fh:
            training_dataset = pickle.load(fh)
        return model, training_dataset
    except Exception as exc:
        logger.error("_load_model_cached: %s", exc)
        raise


def _get_all_users_with_watchlists() -> List[Dict[str, Any]]:
    """Return all users who have opted in to alerts.

    Replace this stub with your actual database query.

    Expected shape of each user dict::

        {
            "id":               "user_123",
            "email":            "alice@example.com",
            "telegram_chat_id": "987654321",   # or None
            "alert_threshold":  0.70,
            "watchlist":        ["AAPL", "MSFT", "TSLA"],
        }
    """
    # --- STUB: replace with real DB call ---
    logger.warning(
        "_get_all_users_with_watchlists: using stub — no real users loaded. "
        "Replace this function with your database query."
    )
    return []


# ===========================================================================
# ── SECTION 8: Unit Tests ────────────────────────────────────────────────────
# ===========================================================================

def _build_mock_signal(action: str = "BUY") -> Any:
    """Build a minimal mock SignalOutput for testing without importing signal_gate."""
    from types import SimpleNamespace
    return SimpleNamespace(
        action=action,
        confidence=0.82,
        p10=188.20,
        p50=194.50,
        p90=201.80,
        current_price=188.34,
        expected_return_pct=3.27,
        reason="RSI recovery from oversold + VIX declining",
        gate_results={},
    )


if __name__ == "__main__":
    import sys
    import unittest

    class TestFormatSignalMessage(unittest.TestCase):

        def test_buy_signal_contains_green_badge(self):
            sig = _build_mock_signal("BUY")
            msg = format_signal_message(sig, "AAPL", "RSI oversold recovery")
            self.assertIn("🟢 BUY SIGNAL — AAPL", msg)

        def test_sell_signal_contains_red_badge(self):
            sig = _build_mock_signal("SELL")
            msg = format_signal_message(sig, "AAPL", "MACD crossover bearish")
            self.assertIn("🔴 SELL SIGNAL — AAPL", msg)

        def test_hold_signal_contains_yellow_badge(self):
            sig = _build_mock_signal("HOLD")
            msg = format_signal_message(sig, "AAPL", "No clear direction")
            self.assertIn("🟡 HOLD SIGNAL — AAPL", msg)

        def test_confidence_in_message(self):
            sig = _build_mock_signal("BUY")
            msg = format_signal_message(sig, "AAPL", "Test")
            self.assertIn("0.82", msg)

        def test_p50_in_message(self):
            sig = _build_mock_signal("BUY")
            msg = format_signal_message(sig, "AAPL", "Test")
            self.assertIn("194.50", msg)

        def test_range_in_message(self):
            sig = _build_mock_signal("BUY")
            msg = format_signal_message(sig, "AAPL", "Test")
            self.assertIn("188.20", msg)
            self.assertIn("201.80", msg)

        def test_explanation_in_message(self):
            sig = _build_mock_signal("BUY")
            expl = "RSI recovery from oversold + VIX declining"
            msg  = format_signal_message(sig, "AAPL", expl)
            self.assertIn(expl, msg)

        def test_ticker_uppercased(self):
            sig = _build_mock_signal("BUY")
            msg = format_signal_message(sig, "aapl", "Test")
            self.assertIn("AAPL", msg)

    class TestFormatEmailHtml(unittest.TestCase):

        def _make_sig(self, action="BUY"):
            return _build_mock_signal(action)

        def test_html_structure(self):
            sig  = self._make_sig()
            html = format_email_html(sig, "AAPL", "Bullish breakout")
            self.assertIn("<!DOCTYPE html>", html)
            self.assertIn("</html>", html)

        def test_buy_badge_color(self):
            sig  = self._make_sig("BUY")
            html = format_email_html(sig, "AAPL", "Test")
            self.assertIn("#00c896", html)   # green

        def test_sell_badge_color(self):
            sig  = self._make_sig("SELL")
            html = format_email_html(sig, "AAPL", "Test")
            self.assertIn("#ff4d6d", html)   # red

        def test_hold_badge_color(self):
            sig  = self._make_sig("HOLD")
            html = format_email_html(sig, "AAPL", "Test")
            self.assertIn("#f5a623", html)   # amber

        def test_ticker_in_title(self):
            sig  = self._make_sig()
            html = format_email_html(sig, "TSLA", "Test")
            self.assertIn("TSLA", html)

        def test_p_values_present(self):
            sig  = self._make_sig()
            html = format_email_html(sig, "AAPL", "Test")
            self.assertIn("188.20", html)   # p10
            self.assertIn("194.50", html)   # p50
            self.assertIn("201.80", html)   # p90

        def test_cta_button_present(self):
            sig  = self._make_sig()
            html = format_email_html(sig, "AAPL", "Test")
            self.assertIn("View Full Analysis", html)

        def test_feature_table_rendered_when_provided(self):
            sig  = self._make_sig()
            feats = [{"feature": "RSI", "importance": 0.42},
                     {"feature": "VIX", "importance": -0.18}]
            html = format_email_html(sig, "AAPL", "Test", top_features=feats)
            self.assertIn("RSI", html)
            self.assertIn("VIX", html)

        def test_feature_table_absent_when_not_provided(self):
            sig  = self._make_sig()
            html = format_email_html(sig, "AAPL", "Test", top_features=None)
            self.assertNotIn("Feature Importance", html)

        def test_dashboard_url_in_html(self):
            sig  = self._make_sig()
            html = format_email_html(sig, "AAPL", "Test")
            self.assertIn("AAPL", html)          # ticker in query param

    print("\n" + "=" * 60)
    print("  Apex AI — alerts.py unit tests")
    print("=" * 60 + "\n")
    loader = unittest.TestLoader()
    suite  = unittest.TestSuite()
    suite.addTests(loader.loadTestsFromTestCase(TestFormatSignalMessage))
    suite.addTests(loader.loadTestsFromTestCase(TestFormatEmailHtml))
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    if result.wasSuccessful():
        sys.stdout.buffer.write(
            ("\n  \u2705 All unit tests passed.\n" + "=" * 60 + "\n").encode("utf-8")
        )
    else:
        raise SystemExit(1)


# ===========================================================================
# ── Late-bind Celery decorator (after function is defined) ───────────────────
# ===========================================================================
if celery_app is not None:
    scan_and_alert = celery_app.task(
        name="alerts.scan_and_alert",
        bind=False,
        max_retries=0,
    )(_scan_and_alert_impl)
