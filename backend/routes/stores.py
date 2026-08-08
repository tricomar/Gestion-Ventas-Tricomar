"""
Rutas para gestión de configuración de tiendas
Sistema unificado que conecta POS, Ecommerce y Dashboard
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from auth.jwt_handler import get_current_user
from models.users import User
from database import db

router = APIRouter()


class StoreConfig(BaseModel):
    code: str
    name: str
    active: bool = True
    type: str = "hybrid"  # physical, ecommerce, hybrid
    integrations: List[str] = []  # IDs de integraciones PrestaShop


class StoresConfigResponse(BaseModel):
    stores: List[StoreConfig]


@router.get("/config")
async def get_stores_config(
    current_user: User = Depends(get_current_user)
):
    """
    Obtener configuración de tiendas del usuario
    Esta es la fuente de verdad para nombres y configuración
    """
    try:
        # Buscar configuración en app_settings
        settings = await db.app_settings.find_one(
            {"account_id": current_user.account_id},
            {"_id": 0, "stores_config": 1}
        )
        
        if settings and settings.get("stores_config"):
            return {"stores": settings["stores_config"]}
        
        # Si no existe, crear configuración por defecto con integraciones existentes
        integrations = await db.prestashop_integrations.find(
            {"account_id": current_user.account_id, "is_active": True},
            {"_id": 1, "shop_url": 1}
        ).to_list(10)
        
        default_stores = []
        
        # Crear tienda para cada integración
        for idx, integration in enumerate(integrations):
            integration_id = str(integration["_id"])
            shop_url = integration.get("shop_url", "")
            
            # Detectar nombre basado en URL
            if "pet" in shop_url.lower():
                code = "PS"
                name = "PetShop"
            elif "grow" in shop_url.lower() or "tricomar.cl" in shop_url:
                code = "GS"
                name = "GrowShop"
            else:
                code = f"T{idx+1}"
                name = f"Tienda {idx+1}"
            
            default_stores.append({
                "code": code,
                "name": name,
                "active": True,
                "type": "hybrid",
                "integrations": [integration_id]
            })
        
        # Si no hay integraciones, crear 2 tiendas por defecto
        if not default_stores:
            default_stores = [
                {
                    "code": "GS",
                    "name": "GrowShop",
                    "active": True,
                    "type": "physical",
                    "integrations": []
                },
                {
                    "code": "PS",
                    "name": "PetShop",
                    "active": True,
                    "type": "physical",
                    "integrations": []
                }
            ]
        
        # Guardar configuración por defecto
        await db.app_settings.update_one(
            {"account_id": current_user.account_id},
            {"$set": {"stores_config": default_stores}},
            upsert=True
        )
        
        return {"stores": default_stores}
        
    except Exception as e:
        print(f"Error getting stores config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/config/{store_code}")
async def update_store_config(
    store_code: str,
    name: Optional[str] = None,
    active: Optional[bool] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Actualizar configuración de una tienda
    El nombre se propagará automáticamente a todas las colecciones relacionadas
    """
    try:
        # Obtener configuración actual
        settings = await db.app_settings.find_one(
            {"account_id": current_user.account_id}
        )
        
        if not settings or not settings.get("stores_config"):
            raise HTTPException(status_code=404, detail="Configuración de tiendas no encontrada")
        
        stores = settings["stores_config"]
        store_found = False
        
        # Actualizar tienda en la configuración
        for store in stores:
            if store["code"] == store_code:
                store_found = True
                if name is not None:
                    old_name = store.get("name")
                    store["name"] = name
                if active is not None:
                    store["active"] = active
                break
        
        if not store_found:
            raise HTTPException(status_code=404, detail=f"Tienda con código {store_code} no encontrada")
        
        # Guardar configuración actualizada
        await db.app_settings.update_one(
            {"account_id": current_user.account_id},
            {"$set": {"stores_config": stores}}
        )
        
        # Propagar cambio de nombre a todas las colecciones relacionadas
        if name is not None:
            update_data = {"store_name": name}
            
            # Actualizar órdenes
            orders_result = await db.ecommerce_orders.update_many(
                {"account_id": current_user.account_id, "store_code": store_code},
                {"$set": update_data}
            )
            
            # Actualizar carritos
            carts_result = await db.ecommerce_carts.update_many(
                {"account_id": current_user.account_id, "store_code": store_code},
                {"$set": update_data}
            )
            
            # Actualizar clientes
            customers_result = await db.ecommerce_customers.update_many(
                {"account_id": current_user.account_id, "store_code": store_code},
                {"$set": update_data}
            )
            
            return {
                "success": True,
                "message": "Tienda actualizada exitosamente",
                "updated": {
                    "config": True,
                    "orders": orders_result.modified_count,
                    "carts": carts_result.modified_count,
                    "customers": customers_result.modified_count
                }
            }
        
        return {"success": True, "message": "Tienda actualizada exitosamente"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating store config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/name/{store_code}")
async def get_store_name(
    store_code: str,
    current_user: User = Depends(get_current_user)
):
    """
    Obtener nombre de una tienda por su código
    Útil para lookups rápidos
    """
    try:
        settings = await db.app_settings.find_one(
            {"account_id": current_user.account_id},
            {"_id": 0, "stores_config": 1}
        )
        
        if settings and settings.get("stores_config"):
            for store in settings["stores_config"]:
                if store["code"] == store_code:
                    return {"code": store_code, "name": store["name"]}
        
        return {"code": store_code, "name": f"Tienda {store_code}"}
        
    except Exception as e:
        print(f"Error getting store name: {e}")
        return {"code": store_code, "name": f"Tienda {store_code}"}
