"""
Helper functions para auditoría
"""
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from database import db
import uuid


async def create_audit_log(
    account_id: str,
    user_id: str,
    user_name: str,
    action: str,  # "create", "update", "delete"
    record_type: str,  # "sale", "expense", "income", etc.
    record_id: str,
    old_data: Optional[Dict[str, Any]] = None,
    new_data: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None
):
    """
    Crea un registro de auditoría en la base de datos
    """
    try:
        audit_log = {
            "id": str(uuid.uuid4()),
            "account_id": account_id,
            "user_id": user_id,
            "user_name": user_name,
            "action": action,
            "record_type": record_type,
            "record_id": record_id,
            "old_data": old_data,
            "new_data": new_data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "ip_address": ip_address
        }
        
        await db.audit_logs.insert_one(audit_log)
        return True
    except Exception as e:
        print(f"Error creating audit log: {e}")
        return False
