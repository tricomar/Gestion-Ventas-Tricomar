"""
Middleware para tenant isolation (aislamiento de datos por cuenta)
"""

from fastapi import Request, HTTPException, status
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

def get_account_id_from_user(user: dict) -> Optional[str]:
    """
    Extrae el account_id del usuario actual.
    Super-admin retorna None (puede ver todas las cuentas).
    """
    if user.get("role") == "super_admin":
        return None  # Super-admin no tiene restricciones
    
    return user.get("account_id")

def require_super_admin(user: dict):
    """
    Verifica que el usuario sea super-admin.
    Lanza excepción si no lo es.
    """
    if user.get("role") != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el super-admin puede realizar esta acción"
        )

def can_manage_account(user: dict, target_account_id: str) -> bool:
    """
    Verifica si el usuario puede gestionar una cuenta específica.
    Super-admin puede gestionar cualquier cuenta.
    Account admin solo puede gestionar su propia cuenta.
    """
    if user.get("role") == "super_admin":
        return True
    
    if user.get("role") == "account_admin" and user.get("account_id") == target_account_id:
        return True
    
    return False

def get_tenant_filter(user: dict, extra_filters: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Retorna el filtro de MongoDB para aislar datos por tenant.
    Super-admin retorna solo extra_filters (sin filtro account_id, ve todo).
    Otros usuarios retornan {"account_id": "xxx", ...extra_filters}.
    
    Args:
        user: Diccionario con datos del usuario
        extra_filters: Filtros adicionales a agregar
    
    Returns:
        Diccionario con filtros para MongoDB
    """
    account_id = get_account_id_from_user(user)
    
    # Construir filtro base
    filters = {}
    
    # Agregar filtro de account_id si no es super-admin
    if account_id is not None:
        filters["account_id"] = account_id
    
    # Agregar filtros extra
    if extra_filters:
        filters.update(extra_filters)
    
    return filters

def add_account_id_to_document(user: dict, document: Dict[str, Any]) -> Dict[str, Any]:
    """
    Agrega el account_id al documento antes de guardarlo en la base de datos.
    Super-admin: No agrega account_id (para operaciones administrativas)
    Otros usuarios: Agrega su account_id al documento
    
    Args:
        user: Diccionario con datos del usuario
        document: Documento a guardar
    
    Returns:
        Documento con account_id agregado
    """
    account_id = get_account_id_from_user(user)
    
    if account_id is not None:
        document["account_id"] = account_id
    
    return document
