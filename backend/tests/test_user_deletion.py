from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException


@pytest.mark.asyncio
async def test_delete_account_successfully_anonymizes_and_revokes_tokens():
    row = {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "password_hash": "hash",
        "is_active": True,
        "deleted_at": None,
    }

    pool = MagicMock()
    conn = AsyncMock()
    conn.fetchrow = AsyncMock(return_value=row)
    acquire_ctx = AsyncMock()
    acquire_ctx.__aenter__ = AsyncMock(return_value=conn)
    acquire_ctx.__aexit__ = AsyncMock(return_value=False)
    pool.acquire = MagicMock(return_value=acquire_ctx)

    with patch("app.services.auth_service.get_pool", return_value=pool), \
         patch("app.services.auth_service.verify_password", return_value=True), \
         patch("app.services.auth_service.token_repo.revoke_all_for_user", new=AsyncMock()) as revoke_mock, \
         patch("app.services.auth_service.user_repo.anonymize_profile", new=AsyncMock()) as anonymize_mock:
        from app.services.auth_service import delete_account

        response = await delete_account("123e4567-e89b-12d3-a456-426614174000", "StrongPass1")

    assert response["status"] == "deleted"
    anonymize_mock.assert_awaited_once_with("123e4567-e89b-12d3-a456-426614174000")
    revoke_mock.assert_awaited_once_with("123e4567-e89b-12d3-a456-426614174000")


@pytest.mark.asyncio
async def test_delete_account_rejects_wrong_password():
    row = {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "password_hash": "hash",
        "is_active": True,
        "deleted_at": None,
    }

    pool = MagicMock()
    conn = AsyncMock()
    conn.fetchrow = AsyncMock(return_value=row)
    acquire_ctx = AsyncMock()
    acquire_ctx.__aenter__ = AsyncMock(return_value=conn)
    acquire_ctx.__aexit__ = AsyncMock(return_value=False)
    pool.acquire = MagicMock(return_value=acquire_ctx)

    with patch("app.services.auth_service.get_pool", return_value=pool), \
         patch("app.services.auth_service.verify_password", return_value=False):
        from app.services.auth_service import delete_account

        with pytest.raises(HTTPException) as exc:
            await delete_account("123e4567-e89b-12d3-a456-426614174000", "WrongPass1")

    assert exc.value.status_code == 401
