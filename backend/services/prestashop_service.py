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
    
    def _make_request_xml(self, endpoint: str, method: str = 'GET', data: Optional[str] = None) -> str:
        """
        Realizar petición XML a PrestaShop (sin convertir a JSON)
        
        Args:
            endpoint: Endpoint de la API
            method: Método HTTP
            data: Datos XML para POST/PUT
            
        Returns:
            Respuesta XML como string
        """
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/xml'} if data else {}
        
        response = requests.request(
            method=method,
            url=url,
            auth=self.auth,
            data=data,
            headers=headers,
            timeout=30,
            verify=True
        )
        response.raise_for_status()
        return response.text
    
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
            params = {'display': 'full', 'output_format': 'JSON'}
            response = self._make_request(f'categories/{category_id}', params=params)
            
            print(f"[PrestaShop] get_category({category_id}) response keys: {response.keys() if response else 'None'}")
            
            if response and 'category' in response:
                return response['category']
            elif response and 'categories' in response:
                # A veces viene envuelto en 'categories'
                cats = response['categories']
                if isinstance(cats, dict):
                    return cats
                elif isinstance(cats, list) and len(cats) > 0:
                    return cats[0]
            
            print(f"[PrestaShop] get_category({category_id}) - estructura inesperada: {str(response)[:200]}")
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
        
        # IDs de categorías sistema que no queremos (Home/Root)
        system_categories = {1, 2}
        
        while current_id and current_id not in system_categories and depth < max_depth:
            category = self.get_category(current_id)
            
            if not category:
                print(f"[PrestaShop] No se pudo obtener categoría {current_id}")
                break
            
            # Extraer datos importantes
            try:
                cat_data = {
                    'id': int(category.get('id', 0)),
                    'name': self._extract_multilang_field(category.get('name', '')),
                    'id_parent': int(category.get('id_parent', 0)),
                    'level_depth': int(category.get('level_depth', 0)),
                    'active': int(category.get('active', 0))
                }
                
                print(f"[PrestaShop] Categoría {cat_data['id']}: '{cat_data['name']}' (parent: {cat_data['id_parent']})")
                
                hierarchy.insert(0, cat_data)  # Insertar al inicio para mantener orden raíz->hoja
                
                # Ir al padre (si no es categoría sistema)
                parent_id = cat_data['id_parent']
                if parent_id in system_categories:
                    break
                    
                current_id = parent_id
                depth += 1
                
            except Exception as e:
                print(f"[PrestaShop] Error extrayendo datos de categoría {current_id}: {str(e)}")
                break
        
        print(f"[PrestaShop] Jerarquía obtenida: {len(hierarchy)} niveles")
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

    def get_manufacturers(self, limit: int = 500, offset: int = 0) -> List[Dict[str, Any]]:
        """
        Obtener fabricantes/marcas de PrestaShop
        
        Args:
            limit: Número máximo de fabricantes a obtener
            offset: Offset para paginación
            
        Returns:
            Lista de fabricantes con {id, name}
        """
        params = {
            'display': 'full',
            'limit': f'{offset},{limit}'
        }
        
        response = self._make_request('manufacturers', params=params)
        
        manufacturers = []
        if 'manufacturers' in response and isinstance(response['manufacturers'], list):
            manufacturers = response['manufacturers']
        elif 'manufacturers' in response and isinstance(response['manufacturers'], dict):
            manufacturers = [response['manufacturers']]
        
        # Mapear a estructura simple
        result = []
        for manu in manufacturers:
            try:
                result.append({
                    'id': int(manu.get('id', 0)),
                    'name': self._extract_multilang_field(manu.get('name', ''))
                })
            except Exception as e:
                print(f"[PrestaShop] Error parsing manufacturer: {str(e)}")
                continue
        
        return result

    
    def get_products(self, limit: int = 100, offset: int = 0, display: str = 'full') -> List[Dict[str, Any]]:
        """
        Obtener productos de PrestaShop
        
        Args:
            limit: Número máximo de productos a obtener
            offset: Offset para paginación
            display: Campos a obtener ('full' o lista de campos específicos)
            
        Returns:
            Lista de productos
        """
        params = {
            'display': display,
            'limit': f'{offset},{limit}'
        }
        
        response = self._make_request('products', params=params)
        
        products = []
        if 'products' in response and isinstance(response['products'], list):
            products = response['products']
        elif 'products' in response and isinstance(response['products'], dict):
            products = [response['products']]
        
        return products

    def get_products_by_id_range(self, min_id: int = 0, limit: int = 500, display: str = 'full') -> List[Dict[str, Any]]:
        """
        Obtener productos de PrestaShop usando filtro de ID (más eficiente que offset)
        
        Args:
            min_id: ID mínimo para filtrar (id > min_id, EXCLUSIVO)
            limit: Número máximo de productos a obtener
            display: Campos a obtener ('full' o lista de campos específicos)
            
        Returns:
            Lista de productos
        """
        params = {
            'display': display,
            'limit': str(limit),
            'sort': 'id_ASC'  # Ordenar por ID ascendente
        }
        
        # Filtrar por ID MAYOR ESTRICTO que min_id (usando > en lugar de >=)
        if min_id > 0:
            # Formato: [min_id+1|max_value] para excluir el último ID procesado
            params['filter[id]'] = f'>[{min_id}]'
        
        response = self._make_request('products', params=params)
        
        products = []
        if 'products' in response and isinstance(response['products'], list):
            products = response['products']
        elif 'products' in response and isinstance(response['products'], dict):
            products = [response['products']]
        
        return products

    def get_product_combinations(self, product_id: int) -> List[Dict[str, Any]]:
        """
        Obtener combinaciones/variantes de un producto
        
        Args:
            product_id: ID del producto
            
        Returns:
            Lista de combinaciones con sus atributos
        """
        try:
            params = {
                'filter[id_product]': product_id,
                'display': 'full'
            }
            
            response = self._make_request('combinations', params=params)
            
            combinations = []
            if 'combinations' in response:
                combs = response['combinations']
                if isinstance(combs, list):
                    combinations = combs
                elif isinstance(combs, dict):
                    combinations = [combs]
            
            return combinations
        except Exception as e:
            print(f"[PrestaShop] Error obteniendo combinaciones del producto {product_id}: {e}")
            return []


    
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


    def get_orders(self, limit: int = 500, offset: int = 0, date_from: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Obtener órdenes/pedidos de PrestaShop
        
        Args:
            limit: Número máximo de órdenes
            offset: Offset para paginación
            date_from: Fecha desde (formato: YYYY-MM-DD) para sincronización incremental
            
        Returns:
            Lista de órdenes
        """
        params = {
            'display': 'full',
            'limit': f'{offset},{limit}',
            'sort': '[id_DESC]'
        }
        
        if date_from:
            params['filter[date_add]'] = f'[{date_from},]'
        
        try:
            response = self._make_request('orders', params=params)
            
            orders = []
            if 'orders' in response:
                if isinstance(response['orders'], list):
                    orders = response['orders']
                elif isinstance(response['orders'], dict):
                    orders = [response['orders']]
            
            return orders
        except Exception as e:
            print(f"Error getting orders: {str(e)}")
            return []
    
    
    def get_order_details(self, order_id: int) -> Optional[Dict[str, Any]]:
        """
        Obtener detalles completos de una orden incluyendo productos
        
        Args:
            order_id: ID de la orden
            
        Returns:
            Datos completos de la orden con items procesados
        """
        try:
            params = {'display': 'full'}
            response = self._make_request(f'orders/{order_id}', params=params)
            
            order = None
            
            # Manejar diferentes estructuras de respuesta
            if 'orders' in response:
                orders_data = response['orders']
                if isinstance(orders_data, list) and len(orders_data) > 0:
                    order = orders_data[0]
                elif isinstance(orders_data, dict):
                    order = orders_data
            elif 'order' in response:
                order = response['order']
            
            if not order:
                return None
            
            # Procesar items del pedido
            associations = order.get('associations', {})
            order_rows = associations.get('order_rows', [])
            
            # Si order_rows no es una lista, convertirla
            if isinstance(order_rows, dict):
                order_rows = [order_rows]
            
            # Procesar cada producto
            items = []
            for row in order_rows:
                try:
                    product_id = row.get('product_id')
                    product_name = row.get('product_name', 'Producto desconocido')
                    product_quantity = int(row.get('product_quantity', 0))
                    unit_price = float(row.get('unit_price_tax_incl', 0))
                    
                    items.append({
                        'product_id': product_id,
                        'product_name': product_name,
                        'product_quantity': product_quantity,
                        'product_price': unit_price,
                        'total_price': unit_price * product_quantity
                    })
                except Exception as e:
                    print(f"Error processing order row: {e}")
                    continue
            
            # Agregar items procesados al pedido
            order['processed_items'] = items
            
            return order
            
        except Exception as e:
            print(f"Error getting order {order_id}: {str(e)}")
            return None
    
    
    def get_customers(self, limit: int = 500, offset: int = 0, date_from: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Obtener clientes de PrestaShop
        
        Args:
            limit: Número máximo de clientes
            offset: Offset para paginación
            date_from: Fecha desde para sincronización incremental
            
        Returns:
            Lista de clientes
        """
        params = {
            'display': 'full',
            'limit': f'{offset},{limit}'
        }
        
        if date_from:
            params['filter[date_add]'] = f'[{date_from},]'
        
        try:
            response = self._make_request('customers', params=params)
            
            customers = []
            if 'customers' in response:
                if isinstance(response['customers'], list):
                    customers = response['customers']
                elif isinstance(response['customers'], dict):
                    customers = [response['customers']]
            
            return customers
        except Exception as e:
            print(f"Error getting customers: {str(e)}")
            return []
    
    
    def get_order_states(self) -> List[Dict[str, Any]]:
        """
        Obtener todos los estados de pedidos desde PrestaShop, incluyendo 
        estados personalizados creados por módulos o configurados por usuarios.
        
        Returns:
            Lista de estados con id, name, color, module_name, etc.
        """
        all_states = []
        offset = 0
        page_size = 100
        
        try:
            while True:
                params = {
                    'display': 'full',
                    'limit': f'{offset},{page_size}'
                }
                
                response = self._make_request('order_states', params=params)
                
                # Extraer estados de la respuesta
                states = []
                if 'order_states' in response:
                    states_data = response['order_states']
                    
                    # Manejar diferentes estructuras de respuesta
                    if isinstance(states_data, dict):
                        if 'order_state' in states_data:
                            order_state = states_data['order_state']
                            if isinstance(order_state, list):
                                states = order_state
                            elif isinstance(order_state, dict):
                                states = [order_state]
                    elif isinstance(states_data, list):

    def update_order_state(self, order_id: int, new_state_id: str) -> bool:
        """
        Actualizar el estado de una orden en PrestaShop
        
        Args:
            order_id: ID de la orden en PrestaShop
            new_state_id: ID del nuevo estado
            
        Returns:
            True si se actualizó correctamente
        """
        try:
            # Obtener la orden actual
            order_data = self._make_request(f'orders/{order_id}')
            
            if not order_data or 'order' not in order_data:
                logger.error(f"No se pudo obtener orden {order_id}")
                return False
            
            order = order_data['order']
            
            # Actualizar el estado
            order['current_state'] = str(new_state_id)
            
            # Enviar actualización
            update_xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<prestashop>
    <order>
        <id>{order_id}</id>
        <current_state>{new_state_id}</current_state>
    </order>
</prestashop>'''
            
            response = requests.put(
                f"{self.base_url}/orders/{order_id}",
                auth=(self.api_key, ''),
                headers={'Content-Type': 'text/xml'},
                data=update_xml,
                timeout=30
            )
            
            if response.status_code in [200, 201]:
                logger.info(f"✓ Estado de orden {order_id} actualizado a {new_state_id}")
                return True
            else:
                logger.error(f"Error actualizando orden {order_id}: HTTP {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Error actualizando estado de orden {order_id}: {e}")
            return False

                        states = states_data
                
                if not states:
                    break
                
                # Procesar estados
                for state in states:
                    # Extraer nombre del campo multidioma
                    name = ""
                    if 'name' in state:
                        if isinstance(state['name'], dict):
                            # Estructura multidioma: {"language": [{"id": "1", "value": "Nombre"}]}
                            lang_data = state['name'].get('language', [])
                            if isinstance(lang_data, list) and len(lang_data) > 0:
                                # Obtener primer idioma
                                first_lang = lang_data[0]
                                if isinstance(first_lang, dict):
                                    name = first_lang.get('value', first_lang.get('_', ''))
                            elif isinstance(lang_data, dict):
                                name = lang_data.get('value', lang_data.get('_', ''))
                        elif isinstance(state['name'], str):
                            name = state['name']
                    
                    processed_state = {
                        'id': str(state.get('id', '')),
                        'name': name,
                        'color': state.get('color', ''),
                        'module_name': state.get('module_name', ''),
                        'hidden': state.get('hidden', '0'),
                        'deleted': state.get('deleted', '0'),
                        'send_email': state.get('send_email', '0'),
                        'invoice': state.get('invoice', '0'),
                        'shipped': state.get('shipped', '0'),
                        'paid': state.get('paid', '0'),
                        'delivery': state.get('delivery', '0'),
                        'unremovable': state.get('unremovable', '0'),
                        'logable': state.get('logable', '0')
                    }
                    all_states.append(processed_state)
                
                # Si obtuvimos menos estados que el tamaño de página, terminamos
                if len(states) < page_size:
                    break
                
                offset += page_size
            
            return all_states
            
        except Exception as e:
            print(f"Error getting order states from PrestaShop: {str(e)}")
            # En caso de error, retornar lista vacía en lugar de fallar
            return []
    
    
    def get_customer_messages(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """
        Obtener mensajes de clientes
        
        Args:
            limit: Número máximo de mensajes
            offset: Offset para paginación
            
        Returns:
            Lista de mensajes
        """
        params = {
            'display': 'full',
            'limit': f'{offset},{limit}',
            'sort': '[id_DESC]'
        }
        
        try:
            response = self._make_request('customer_messages', params=params)
            
            messages = []
            if 'customer_messages' in response:
                if isinstance(response['customer_messages'], list):
                    messages = response['customer_messages']
                elif isinstance(response['customer_messages'], dict):
                    messages = [response['customer_messages']]
            
            return messages
        except Exception as e:
            print(f"Error getting customer messages: {str(e)}")
            return []
    
    
    def get_carts(self, limit: int = 500, offset: int = 0, date_from: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Obtener carritos de compra
        
        Args:
            limit: Número máximo de carritos
            offset: Offset para paginación
            date_from: Fecha desde para sincronización incremental
            
        Returns:
            Lista de carritos
        """
        params = {
            'display': 'full',
            'limit': f'{offset},{limit}',
            'sort': '[id_DESC]'
        }
        
        if date_from:
            params['filter[date_add]'] = f'[{date_from},]'
        
        try:
            response = self._make_request('carts', params=params)
            
            carts = []
            if 'carts' in response:
                if isinstance(response['carts'], list):
                    carts = response['carts']
                elif isinstance(response['carts'], dict):
                    carts = [response['carts']]
            
            return carts
        except Exception as e:
            print(f"Error getting carts: {str(e)}")
            return []
    
    
    def get_product_images(self, product_id: int) -> List[Dict[str, Any]]:
        """
        Obtener URLs de imágenes de un producto
        
        Args:
            product_id: ID del producto
            
        Returns:
            Lista de imágenes con URLs
        """
        try:
            params = {'display': 'full'}
            response = self._make_request(f'images/products/{product_id}', params=params)
            
            images = []
            if 'image' in response:
                if isinstance(response['image'], list):
                    images = response['image']
                elif isinstance(response['image'], dict):
                    images = [response['image']]
            
            # Construir URLs completas
            for img in images:
                img_id = img.get('id')
                if img_id:
                    img['url'] = f"{self.shop_url}/api/images/products/{product_id}/{img_id}"
            
            return images
        except Exception as e:
            print(f"Error getting images for product {product_id}: {str(e)}")
            return []
    
    
    def update_stock(self, product_id: int, quantity: int) -> bool:
        """
        Actualizar stock de un producto en PrestaShop
        
        Args:
            product_id: ID del producto
            quantity: Nueva cantidad de stock
            
        Returns:
            True si se actualizó correctamente
        """
        try:
            # Primero obtener el stock_available_id del producto
            params = {
                'display': 'full',
                'filter[id_product]': f'[{product_id}]'
            }
            response = self._make_request('stock_availables', params=params)
            
            stock_id = None
            if 'stock_availables' in response:
                stock_data = response['stock_availables']
                if isinstance(stock_data, list) and len(stock_data) > 0:
                    stock_id = stock_data[0].get('id')
                elif isinstance(stock_data, dict):
                    stock_id = stock_data.get('id')
            
            if not stock_id:
                print(f"No stock_available found for product {product_id}")
                return False
            
            # Actualizar stock
            xml_data = f'''<?xml version="1.0" encoding="UTF-8"?>
            <prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
                <stock_available>
                    <id>{stock_id}</id>
                    <id_product>{product_id}</id_product>
                    <quantity>{quantity}</quantity>
                </stock_available>
            </prestashop>'''
            
            self._make_request(f'stock_availables/{stock_id}', method='PUT', data=xml_data)
            return True
            
        except Exception as e:
            print(f"Error updating stock for product {product_id}: {str(e)}")
            return False


    
    def update_product_active(self, product_id: int, active: bool) -> bool:
        """
        Actualizar el estado activo/inactivo de un producto en PrestaShop
        Compatible con PrestaShop 1.7.x y 8.x
        
        Usa el método recomendado por PrestaShop: obtener esquema blank, modificar y enviar PUT
        
        Args:
            product_id: ID del producto en PrestaShop
            active: True para activar, False para desactivar
            
        Returns:
            True si se actualizó correctamente
        """
        active_value = "1" if active else "0"
        print(f"[PrestaShop] Updating product {product_id} active to {active_value}")
        
        try:
            # Método simplificado: obtener XML completo y modificar solo active
            # Obtener producto completo en formato XML
            url = f"{self.api_url}/products/{product_id}"
            response = requests.get(url, auth=self.auth, timeout=30, verify=True)
            
            if response.status_code != 200:
                print(f"[PrestaShop] Failed to get product: {response.status_code}")
                return False
            
            # Parse XML
            product_xml = response.text
            product_dict = xmltodict.parse(product_xml)
            
            # Modificar active
            if 'prestashop' in product_dict and 'product' in product_dict['prestashop']:
                product_dict['prestashop']['product']['active'] = active_value
                
                # Limpiar campos problemáticos que PrestaShop regenera automáticamente
                # Estos campos pueden causar errores 400 si se envían en PUT
                product = product_dict['prestashop']['product']
                fields_to_remove = [
                    'manufacturer_name', 'quantity', 'position_in_category',
                    'date_add', 'date_upd'
                ]
                for field in fields_to_remove:
                    if field in product:
                        del product[field]
                
                # Convertir a XML
                updated_xml = xmltodict.unparse(product_dict, encoding='utf-8')
                
                # PUT
                put_response = requests.put(
                    url,
                    auth=self.auth,
                    data=updated_xml.encode('utf-8'),
                    headers={'Content-Type': 'application/xml'},
                    timeout=30,
                    verify=True
                )
                
                if put_response.status_code in [200, 201]:
                    print(f"[PrestaShop] Product {product_id} updated successfully")
                    return True
                else:
                    print(f"[PrestaShop] PUT failed: {put_response.status_code} - {put_response.text[:300]}")
                    return False
            
            return False
                
        except Exception as e:
            print(f"[PrestaShop] Error updating product: {str(e)}")
            return False


