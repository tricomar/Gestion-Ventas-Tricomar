"""
Router para logs de auditoría
"""
from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from datetime import datetime

from utils import db, get_current_user
from models.users import User
from models.audit import AuditLog
from middleware.tenant import get_tenant_filter

router = APIRouter()

@router.get("", response_model=List[AuditLog])
async def get_audit_logs(
    record_type: Optional[str] = Query(None),
    record_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    current_user: User = Depends(get_current_user)
):
    """
    Obtiene los logs de auditoría filtrados
    Solo accessible por account_admin y supervisor
    """
    # Validar permisos
    if current_user.role not in ['account_admin', 'supervisor']:
        return []
    
    # Filtro de tenant
    tenant_filter = get_tenant_filter(current_user.dict())
    
    # Filtros opcionales
    if record_type:
        tenant_filter['record_type'] = record_type
    if record_id:
        tenant_filter['record_id'] = record_id
    if action:
        tenant_filter['action'] = action
    
    # Obtener logs ordenados por timestamp descendente
    logs = await db.audit_logs.find(
        tenant_filter,
        {'_id': 0}
    ).sort('timestamp', -1).limit(limit).to_list(limit)
    
    # Convertir timestamps
    for log in logs:
        if isinstance(log.get('timestamp'), str):
            log['timestamp'] = datetime.fromisoformat(log['timestamp'])
    
    return logs

@router.get("/record/{record_type}/{record_id}", response_model=List[AuditLog])
async def get_record_history(
    record_type: str,
    record_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Obtiene el historial completo de un registro específico
    """
    # Validar permisos
    if current_user.role not in ['account_admin', 'supervisor']:
        return []
    
    # Filtro de tenant y registro
    query_filter = get_tenant_filter(current_user.dict())
    query_filter['record_type'] = record_type
    query_filter['record_id'] = record_id
    
    # Obtener logs ordenados por timestamp descendente
    logs = await db.audit_logs.find(
        query_filter,
        {'_id': 0}
    ).sort('timestamp', -1).to_list(100)
    
    # Convertir timestamps
    for log in logs:
        if isinstance(log.get('timestamp'), str):
            log['timestamp'] = datetime.fromisoformat(log['timestamp'])
    
    return logs
