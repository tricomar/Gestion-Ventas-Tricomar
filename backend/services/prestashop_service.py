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
            response = requests.request(
                method=method,
                url=url,
                auth=self.auth,
                params=params,
                data=data,
                headers=headers,
                timeout=30
            )
            response.raise_for_status()
            
            # Parse JSON response
            if response.text:
                return response.json()
            return {}
            
        except requests.exceptions.RequestException as e:
            raise Exception(f"Error en petición a PrestaShop: {str(e)}")
    
    def test_connection(self) -> bool:
        """
        Probar conexión con la API
        
        Returns:
            True si la conexión es exitosa
        """
        try:
            self._make_request('')
            return True
        except Exception:
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
