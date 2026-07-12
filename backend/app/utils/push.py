"""
Utilitaire pour envoyer une notification push a tous les admins abonnes.
"""
import json
import logging
from pywebpush import webpush, WebPushException
from sqlalchemy.orm import Session

from app.models.push_subscription import PushSubscription
from app.models.user import User
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


def send_push_to_admins(db: Session, title: str, body: str, url: str = "/admin/claims"):
    """Envoie une notification push a tous les abonnements des utilisateurs admin."""
    if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_PUBLIC_KEY:
        logger.warning("VAPID keys non configurees, notification push ignoree.")
        return

    admin_ids = [u.id for u in db.query(User).filter(User.role == "admin").all()]
    if not admin_ids:
        return

    subs = db.query(PushSubscription).filter(PushSubscription.user_id.in_(admin_ids)).all()

    payload = json.dumps({"title": title, "body": body, "url": url})

    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": f"mailto:{settings.VAPID_CLAIMS_EMAIL}"},
            )
        except WebPushException as e:
            logger.warning(f"Push echoue pour {sub.endpoint[:50]}...: {e}")
            # 410/404 = abonnement expire/revoque -> on le supprime
            if e.response is not None and e.response.status_code in (404, 410):
                db.query(PushSubscription).filter(PushSubscription.id == sub.id).delete()
    db.commit()
