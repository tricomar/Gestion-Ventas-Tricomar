"""
Servicio para interactuar con la API de PrestaShop
"""

import requests
import xmltodict
import json
from typing import Optional, List, Dict, Any
from requests.auth import HTTPBasicAuth


class PrestashopAPIService:
    """Servicio para interactuar con PrestaShop WebService API"""
    
    def __init__(self, shop_url: str, api_key: str):
        """
        Inicializar servicio de PrestaShop
        
        Args:
            shop_url: URL de la tienda (ej: https://tricomarpets.cl)
            api_key: API Key de PrestaShop
        """
        self.shop_url = shop_url.rstrip('/')
        self.api_url = f"{self.shop_url}/api"
        self.api_key = api_key
        self.auth = HTTPBasicAuth(api_key, '')  # Password vacío según documentación
        
    def _make_request(self, endpoint: str, method: str = 'GET', data: Optional[str] = None, params: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Realizar petición a la API de PrestaShop
        
        Args:
            endpoint: Endpoint de la API (ej: 'products', 'categories')
            method: Método HTTP
            data: Datos XML para POST/PUT
            params: Parámetros de query
            
        Returns:
            Respuesta parseada como diccionario
        """
        url = f"{self.api_url}/{endpoint}"
        
        # Agregar output_format=JSON para facilitar el manejo
        if params is None:
            params = {}
        params['output_format'] = 'JSON'
        
        headers = {'Content-Type': 'application/xml'} if data else {}
        
        try:
            print(f"[PrestaShop] Request: {method} {url} with params: {params}")
            response = requests.request(
                method=method,
                url=url,
                auth=self.auth,
                params=params,
                data=data,
                headers=headers,
                timeout=30,
                verify=True  # Verificar SSL
            )
            print(f"[PrestaShop] Response status: {response.status_code}")
            response.raise_for_status()
            
            # Parse JSON response
            if response.text:
                return response.json()
            return {}
            
        except requests.exceptions.SSLError as e:
            print(f"[PrestaShop] SSL Error: {str(e)}")
            raise Exception(f"Error SSL: Verifica el certificado del servidor")
        except requests.exceptions.Timeout as e:
            print(f"[PrestaShop] Timeout: {str(e)}")
            raise Exception(f"Timeout: El servidor no responde")
        except requests.exceptions.ConnectionError as e:
            print(f"[PrestaShop] Connection Error: {str(e)}")
            raise Exception(f"Error de conexión: No se puede alcanzar el servidor")
        except requests.exceptions.HTTPError as e:
            print(f"[PrestaShop] HTTP Error: {response.status_code} - {response.text[:200]}")
            if response.status_code == 401:
                raise Exception(f"Autenticación fallida: Verifica tu API Key")
            elif response.status_code == 403:
                raise Exception(f"Acceso denegado: La API Key no tiene permisos suficientes")
            elif response.status_code == 404:
                raise Exception(f"Recurso no encontrado: Verifica la URL de tu tienda")
            else:
                raise Exception(f"Error HTTP {response.status_code}")
        except requests.exceptions.RequestException as e:
            print(f"[PrestaShop] Request Exception: {str(e)}")
            raise Exception(f"Error en petición: {str(e)}")
    
    def test_connection(self) -> bool:
        """
        Probar conexión con la API
        
        Returns:
            True si la conexión es exitosa
        """
        try:
            print(f"[PrestaShop] Testing connection to: {self.api_url}")
            # Probar con endpoint específico en lugar de raíz
            # Usar categories que es simple y rápido
            params = {
                'display': '[id]',
                'limit': '1'
            }
            response = requests.get(
                f"{self.api_url}/categories",
                auth=self.auth,
                params=params,
                timeout=10,
                verify=True
            )
            print(f"[PrestaShop] Connection test status: {response.status_code}")
            response.raise_for_status()
            print(f"[PrestaShop] Connection successful")
            return True
        except Exception as e:
            print(f"[PrestaShop] Connection failed: {str(e)}")
            return False
    
    def get_categories(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """
        Obtener categorías de PrestaShop
        
        Args:
            limit: Número máximo de categorías a obtener
            offset: Offset para paginación
            
        Returns:
            Lista de categorías
        """
        params = {
            'display': 'full',
            'limit': f'{offset},{limit}'
        }
        
        response = self._make_request('categories', params=params)
        
        categories = []
        if 'categories' in response and isinstance(response['categories'], list):
            categories = response['categories']
        elif 'categories' in response and isinstance(response['categories'], dict):
            # Si solo hay una categoría, viene como dict
            categories = [response['categories']]
        
        return categories
    
    def get_category(self, category_id: int) -> Optional[Dict[str, Any]]:
        """
        Obtener una categoría específica de PrestaShop
        
        Args:
            category_id: ID de la categoría
            
        Returns:
            Datos de la categoría o None
        """
        try:
            params = {'display': 'full'}
            response = self._make_request(f'categories/{category_id}', params=params)
            
            if 'category' in response:
                return response['category']
            return None
        except Exception as e:
            print(f"[PrestaShop] Error getting category {category_id}: {str(e)}")
            return None
    
    def get_category_hierarchy(self, category_id: int) -> List[Dict[str, Any]]:
        """
        Obtener jerarquía completa de una categoría (desde raíz hasta categoría actual)
        
        Args:
            category_id: ID de la categoría
            
        Returns:
            Lista de categorías desde raíz hasta la categoría actual
        """
        hierarchy = []
        current_id = category_id
        
        # Evitar loops infinitos
        max_depth = 10
        depth = 0
        
        while current_id and current_id != 1 and current_id != 2 and depth < max_depth:
            category = self.get_category(current_id)
            
            if not category:
                break
            
            # Extraer datos importantes
            cat_data = {
                'id': int(category.get('id', 0)),
                'name': self._extract_multilang_field(category.get('name', '')),
                'id_parent': int(category.get('id_parent', 0)),
                'level_depth': int(category.get('level_depth', 0)),
                'active': int(category.get('active', 0))
            }
            
            hierarchy.insert(0, cat_data)  # Insertar al inicio para mantener orden raíz->hoja
            
            # Ir al padre
            current_id = cat_data['id_parent']
            depth += 1
        
        return hierarchy
    
    def _extract_multilang_field(self, field_data) -> str:
        """
        Extraer texto de campo multiidioma de PrestaShop
        
        Args:
            field_data: Dato que puede ser string, dict o list de dicts
            
        Returns:
            Texto extraído
        """
        if isinstance(field_data, str):
            return field_data
        elif isinstance(field_data, dict):
            # Si es dict con 'language', extraer el value
            if 'language' in field_data:
                lang = field_data['language']
                if isinstance(lang, list) and len(lang) > 0:
                    return lang[0].get('value', '')
                elif isinstance(lang, dict):
                    return lang.get('value', '')
            # Si tiene 'value' directo
            return field_data.get('value', '')
        elif isinstance(field_data, list) and len(field_data) > 0:
            # Tomar el primer elemento
            return self._extract_multilang_field(field_data[0])
        
        return ''
    
    def get_products(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """
        Obtener productos de PrestaShop
        
        Args:
            limit: Número máximo de productos a obtener
            offset: Offset para paginación
            
        Returns:
            Lista de productos
        """
        params = {
            'display': 'full',
            'limit': f'{offset},{limit}'
        }
        
        response = self._make_request('products', params=params)
        
        products = []
        if 'products' in response and isinstance(response['products'], list):
            products = response['products']
        elif 'products' in response and isinstance(response['products'], dict):
            products = [response['products']]
        
        return products
    
    def get_product_stock(self, product_id: int) -> Optional[int]:
        """
        Obtener stock de un producto específico
        
        Args:
            product_id: ID del producto en PrestaShop
            
        Returns:
            Cantidad de stock o None si no se encuentra
        """
        try:
            params = {
                'filter[id_product]': product_id,
                'display': 'full'
            }
            
            response = self._make_request('stock_availables', params=params)
            
            if 'stock_availables' in response:
                stock_data = response['stock_availables']
                
                if isinstance(stock_data, list) and len(stock_data) > 0:
                    return int(stock_data[0].get('quantity', 0))
                elif isinstance(stock_data, dict):
                    return int(stock_data.get('quantity', 0))
            
            return 0
            
        except Exception as e:
            print(f"Error getting stock for product {product_id}: {str(e)}")
            return None
    
    def update_product_stock(self, product_id: int, quantity: int) -> bool:
        """
        Actualizar stock de un producto
        
        Args:
            product_id: ID del producto en PrestaShop
            quantity: Nueva cantidad de stock
            
        Returns:
            True si la actualización fue exitosa
        """
        try:
            # Primero obtener el stock_available_id
            params = {
                'filter[id_product]': product_id,
                'display': 'full'
            }
            
            response = self._make_request('stock_availables', params=params)
            
            stock_available_id = None
            if 'stock_availables' in response:
                stock_data = response['stock_availables']
                
                if isinstance(stock_data, list) and len(stock_data) > 0:
                    stock_available_id = stock_data[0].get('id')
                elif isinstance(stock_data, dict):
                    stock_available_id = stock_data.get('id')
            
            if not stock_available_id:
                raise Exception(f"No se encontró stock_available para producto {product_id}")
            
            # Construir XML para actualizar
            xml_data = f'''<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
    <stock_available>
        <id>{stock_available_id}</id>
        <quantity>{quantity}</quantity>
    </stock_available>
</prestashop>'''
            
            # Actualizar stock
            self._make_request(
                f'stock_availables/{stock_available_id}',
                method='PUT',
                data=xml_data
            )
            
            return True
            
        except Exception as e:
            print(f"Error updating stock for product {product_id}: {str(e)}")
            return False
    
    def update_product_reference(self, product_id: int, reference: str) -> bool:
        """
        Actualizar SKU/reference de un producto en PrestaShop
        
        Args:
            product_id: ID del producto en PrestaShop
            reference: Nuevo SKU/reference
            
        Returns:
            True si la actualización fue exitosa
        """
        try:
            # Construir XML para actualizar solo el reference
            xml_data = f'''<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
    <product>
        <id>{product_id}</id>
        <reference><![CDATA[{reference}]]></reference>
    </product>
</prestashop>'''
            
            # Actualizar producto
            self._make_request(
                f'products/{product_id}',
                method='PUT',
                data=xml_data
            )
            
            return True
            
        except Exception as e:
            print(f"Error updating reference for product {product_id}: {str(e)}")
            return False
    
    def get_all_stock(self, limit: int = 500) -> Dict[int, int]:
        """
        Obtener todo el stock disponible
        
        Args:
            limit: Número máximo de registros
            
        Returns:
            Diccionario {product_id: quantity}
        """
        try:
            params = {
                'display': 'full',
                'limit': f'0,{limit}'
            }
            
            response = self._make_request('stock_availables', params=params)
            
            stock_dict = {}
            if 'stock_availables' in response:
                stock_data = response['stock_availables']
                
                if isinstance(stock_data, list):
                    for stock in stock_data:
                        product_id = int(stock.get('id_product', 0))
                        quantity = int(stock.get('quantity', 0))
                        if product_id > 0:
                            stock_dict[product_id] = quantity
                elif isinstance(stock_data, dict):
                    product_id = int(stock_data.get('id_product', 0))
                    quantity = int(stock_data.get('quantity', 0))
                    if product_id > 0:
                        stock_dict[product_id] = quantity
            
            return stock_dict
            
        except Exception as e:
            print(f"Error getting all stock: {str(e)}")
            return {}
