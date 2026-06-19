"""
Legal Routes.

Public (no-auth) endpoints that serve the current Terms & Conditions and
Privacy Policy as Markdown. Both the mobile app (signup flow) and the admin
dashboard read these so there is a single source of truth for legal text.

NOTE: The documents under app/legal/*.md are good-faith, business-tailored
drafts. They are NOT a substitute for review by a qualified Nigerian lawyer
before production launch.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.config import settings

router = APIRouter(prefix="/legal", tags=["Legal"])

_LEGAL_DIR = Path(__file__).resolve().parent.parent / "legal"

# Map public doc type → versioned markdown filename.
_DOC_FILES = {
    "terms": f"terms_v{settings.LEGAL_VERSION.split('.')[0]}.md",
    "privacy": f"privacy_v{settings.LEGAL_VERSION.split('.')[0]}.md",
}


@lru_cache(maxsize=4)
def _read_doc(doc_type: str) -> str:
    path = _LEGAL_DIR / _DOC_FILES[doc_type]
    if not path.exists():
        raise FileNotFoundError(path)
    return path.read_text(encoding="utf-8")


def _serve(doc_type: str) -> dict:
    try:
        content = _read_doc(doc_type)
    except (KeyError, FileNotFoundError):
        raise HTTPException(status_code=404, detail="Document not found.")
    return {
        "doc_type": doc_type,
        "version": settings.LEGAL_VERSION,
        "content_md": content,
    }


@router.get("/terms")
async def get_terms():
    """Return the current Terms & Conditions as Markdown."""
    return _serve("terms")


@router.get("/privacy")
async def get_privacy():
    """Return the current Privacy Policy as Markdown."""
    return _serve("privacy")
