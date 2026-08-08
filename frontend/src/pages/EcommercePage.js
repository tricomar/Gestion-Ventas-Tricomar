import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Package, 
  TrendingUp, 
  Users, 
  ShoppingBag,
  ShoppingCart,
  CheckCircle,
  Clock,
  XCircle,
  Truck,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Eye
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAccount } from '../context/AccountContext';
import OrderDetailModal from '../components/ecommerce/OrderDetailModal';
import CartDetailModal from '../components/ecommerce/CartDetailModal';
import CustomerDetailModal from '../components/ecommerce/CustomerDetailModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const EcommercePage = () => {
  const { user } = useAuth();
  const { account } = useAccount();
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [carts, setCarts] = useState([]);
  const [selectedCartId, setSelectedCartId] = useState(null);
  const [cartStats, setCartStats] = useState({
    active: 0,
    abandoned: 0,
    converted: 0,
    abandonment_rate: 0
  });
  const [stats, setStats] = useState({
    total_orders: 0,
    pending_orders: 0,
    today_sales: 0,
    today_orders: 0,
    monthly_sales: 0,
    monthly_orders: 0,
    new_customers: 0,
    abandoned_carts: 0,
    currency_symbol: '$',
    currency_code: 'CLP',
    timezone: 'America/Santiago'
  });
  const [abandonedCarts, setAbandonedCarts] = useState([]);
  const [finalizedCarts, setFinalizedCarts] = useState([]);
  const [integrations, setIntegrations] = useState([]);
  const [selectedStore, setSelectedStore] = useState('all'); // Cambio: usar store_id en vez de integration_id
  const [activeTab, setActiveTab] = useState('orders'); // 'orders', 'carts', 'customers'
  const [cartFilterStatus, setCartFilterStatus] = useState('abandoned'); // 'active', 'abandoned', 'converted'
  const [loading, setLoading] = useState(true);
  
  // Estados para Clientes
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [customerStats, setCustomerStats] = useState({
    total_customers: 0,
    new_customers: 0,
    recurring_customers: 0,
    one_time_customers: 0,
    avg_order_value: 0,
    recurring_rate: 0
  });
  const [customerFilter, setCustomerFilter] = useState('all'); // 'all', 'new', 'recurring', 'one-time'
  
  // Estados de pedidos para mapeo
  const [orderStates, setOrderStates] = useState([]);

  useEffect(() => {
    fetchIntegrations();
    fetchStats();
    fetchOrders();
    fetchCarts();
    fetchCartStats();
    fetchCustomerStats();
    fetchOrderStates();
  }, []);

  useEffect(() => {
    if (account?.stores || selectedStore === 'all') {
      fetchEcommerceData();
    }
  }, [selectedStore]);

  const fetchIntegrations = async () => {
    try {
      const response = await axios.get(`${API}/integrations/prestashop/list`);
      setIntegrations(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching integrations:', error);
      setLoading(false);
    }
  };

  const fetchOrderStates = async () => {
    try {
      const response = await axios.get(`${API}/ecommerce/order-states`);
      setOrderStates(response.data);
    } catch (error) {
      console.error('Error fetching order states:', error);
    }
  };

  const getStateName = (stateId) => {
    if (!stateId) return 'Desconocido';
    const state = orderStates.find(s => s.id === String(stateId));
    return state ? state.name : `Estado ${stateId}`;
  };



  const fetchStats = async () => {
    try {
      const storeParam = selectedStore !== 'all' ? `?store_id=${selectedStore}` : '';
      const response = await axios.get(`${API}/ecommerce/stats${storeParam}`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API}/ecommerce/orders?limit=50`);
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const fetchEcommerceData = async () => {
    try {
      const storeParam = selectedStore !== 'all' 
        ? `store_id=${selectedStore}&` 
        : '';

      // Obtener órdenes
      const ordersRes = await axios.get(`${API}/ecommerce/orders?${storeParam}limit=50`);
      setOrders(ordersRes.data);

      // Obtener estadísticas
      const statsParam = selectedStore !== 'all' ? `?store_id=${selectedStore}` : '';
      const statsRes = await axios.get(`${API}/ecommerce/stats${statsParam}`);
      setStats(statsRes.data);

      // Obtener carritos abandonados
      const abandonedRes = await axios.get(`${API}/ecommerce/carts?${storeParam}status=abandoned&limit=50`);
      setAbandonedCarts(abandonedRes.data);

      // Obtener carritos finalizados
      const finalizedRes = await axios.get(`${API}/ecommerce/carts?${storeParam}status=converted&limit=50`);
      setFinalizedCarts(finalizedRes.data);

    } catch (error) {
      console.error('Error fetching ecommerce data:', error);
    }
  };


  const fetchCarts = async () => {
    try {
      const response = await axios.get(`${API}/ecommerce/carts?status=${cartFilterStatus}&limit=50`);
      setCarts(response.data);
    } catch (error) {
      console.error('Error fetching carts:', error);
      toast.error('Error al cargar carritos');
    }
  };

  const fetchCartStats = async () => {
    try {
      const response = await axios.get(`${API}/ecommerce/carts/stats`);
      setCartStats(response.data);
    } catch (error) {
      console.error('Error fetching cart stats:', error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const filterParam = customerFilter !== 'all' ? `customer_type=${customerFilter}&` : '';
      const storeParam = selectedStore !== 'all' ? `store_id=${selectedStore}&` : '';
      const response = await axios.get(`${API}/ecommerce/customers?${storeParam}${filterParam}limit=50`);
      setCustomers(response.data);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Error al cargar clientes');
    }
  };

  const fetchCustomerStats = async () => {
    try {
      const response = await axios.get(`${API}/ecommerce/customers/stats`);
      setCustomerStats(response.data);
    } catch (error) {
      console.error('Error fetching customer stats:', error);
    }
  };

  const fetchCustomerDetail = async (customerId) => {
    try {
      const response = await axios.get(`${API}/ecommerce/customers/${customerId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching customer detail:', error);
      toast.error('Error al cargar detalle del cliente');
      return null;
    }
  };

  const handleCustomerClick = async (customerId) => {
    const detail = await fetchCustomerDetail(customerId);
    if (detail) {
      setSelectedCustomerId(detail);
    }
  };

  useEffect(() => {
    if (activeTab === 'carts') {
      fetchCarts();
    }
  }, [cartFilterStatus]);

  useEffect(() => {
    if (activeTab === 'customers') {
      fetchCustomers();
      fetchCustomerStats();
    }
  }, [activeTab, customerFilter]);


  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-yellow-100 text-yellow-800 border-yellow-800',
      'processing': 'bg-blue-100 text-blue-800 border-blue-800',
      'completed': 'bg-green-100 text-green-800 border-green-800',
      'shipped': 'bg-purple-100 text-purple-800 border-purple-800',
      'cancelled': 'bg-red-100 text-red-800 border-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-800';
  };

  const getStatusIcon = (status) => {
    const icons = {
      'pending': Clock,
      'processing': RefreshCw,
      'completed': CheckCircle,
      'shipped': Truck,
      'cancelled': XCircle
    };
    const Icon = icons[status] || Clock;
    return <Icon className="w-4 h-4" />;
  };

  const getIntegrationName = (integrationId) => {
    const integration = integrations.find(i => i.id === integrationId);
    return integration ? integration.store_name : 'Desconocido';
  };

  const getPrestashopOrderUrl = (integrationId, orderId) => {
    const integration = integrations.find(i => i.id === integrationId);
    if (!integration || !orderId || !integration.api_url) return '#';
    
    // Construir URL del admin de PrestaShop para ver la orden
    // Formato típico: https://tienda.com/admin123/index.php?controller=AdminOrders&id_order=123&vieworder
    const baseUrl = integration.api_url.replace('/api', '');
    return `${baseUrl}/index.php?controller=AdminOrders&id_order=${orderId}&vieworder`;
  };

  const getPrestashopCartUrl = (cart) => {
    const integration = integrations.find(i => i.id === cart.integration_id);
    if (!integration || !cart.id_order || !integration.api_url) return null;
    
    // Si el carrito está finalizado y tiene orden, enlazar a la orden
    return `${integration.api_url.replace('/api', '')}/index.php?controller=AdminOrders&id_order=${cart.id_order}&vieworder`;
  };

  const StatCard = ({ title, value, icon: Icon, gradient }) => (
    <div 
      className={`bg-gradient-to-br ${gradient} border-4 border-slate-900 rounded-xl p-6`}
      style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 bg-white border-2 border-slate-900 rounded-lg">
          <Icon className="w-6 h-6 text-slate-900" />
        </div>
      </div>
      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-2">{title}</h3>
      <p className="text-3xl font-black text-slate-900">{value}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Cargando datos de ecommerce...</p>
        </div>
      </div>
    );
  }

  // Obtener tiendas desde account
  const stores = account?.stores || [];

  if (stores.length === 0) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto text-center mt-20">
          <div className="text-8xl mb-6">🛍️</div>
          <h2 className="text-3xl font-black text-slate-900 mb-4">No hay tiendas configuradas</h2>
          <p className="text-slate-600 mb-8">
            Ve a <strong>Configuración → Tiendas/Cajas</strong> para configurar tus tiendas y conectar PrestaShop
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 
          className="text-5xl font-black text-slate-900 mb-2"
          style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}
        >
          🛍️ Ecommerce
        </h1>
        <p className="text-lg text-slate-600 font-medium">
          Gestiona tus ventas online en tiempo real
        </p>
      </div>

      {/* Store Filter Buttons */}
      <div className="mb-8 flex flex-wrap gap-3">
        <button
          onClick={() => setSelectedStore('all')}
          className={`px-6 py-3 border-2 border-slate-900 rounded-xl font-bold transition-all ${
            selectedStore === 'all'
              ? 'bg-indigo-400 text-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]'
              : 'bg-white text-slate-900 hover:bg-slate-50'
          }`}
        >
          🏪 Todas las Tiendas
        </button>
        {stores.map((store) => {
          const isSelected = selectedStore === store.id;
          
          return (
            <button
              key={store.id}
              onClick={() => setSelectedStore(store.id)}
              className={`px-6 py-3 border-2 border-slate-900 rounded-xl font-bold transition-all ${
                isSelected
                  ? 'bg-purple-400 text-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]'
                  : 'bg-white text-slate-900 hover:bg-slate-50'
              }`}
            >
              🛒 {store.name}
            </button>
          );
        })}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Ventas Hoy"
          value={`${stats.currency_symbol}${Math.round(stats.today_sales || 0).toLocaleString('es-CL')}`}
          icon={TrendingUp}
          gradient="from-green-400 to-emerald-400"
        />
        <StatCard 
          title="Pedidos Pendientes"
          value={stats.pending_orders}
          icon={Clock}
          gradient="from-orange-400 to-red-400"
        />
        <StatCard 
          title="Ventas Mensuales"
          value={`${stats.currency_symbol}${Math.round(stats.monthly_sales || 0).toLocaleString('es-CL')}`}
          icon={ShoppingBag}
          gradient="from-purple-400 to-pink-400"
        />
        <StatCard 
          title="Carritos Abandonados"
          value={stats.abandoned_carts || 0}
          icon={ShoppingCart}
          gradient="from-yellow-400 to-orange-400"
        />
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-6 py-3 border-2 border-slate-900 rounded-xl font-bold transition-all ${
            activeTab === 'orders'
              ? 'bg-blue-400 text-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]'
              : 'bg-white text-slate-900 hover:bg-slate-50'
          }`}
        >
          📦 Órdenes ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab('carts')}
          className={`px-6 py-3 border-2 border-slate-900 rounded-xl font-bold transition-all ${
            activeTab === 'carts'
              ? 'bg-yellow-400 text-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]'
              : 'bg-white text-slate-900 hover:bg-slate-50'
          }`}
        >
          🛒 Carritos ({cartStats.abandoned + cartStats.active})
        </button>
        <button
          onClick={() => setActiveTab('customers')}
          className={`px-6 py-3 border-2 border-slate-900 rounded-xl font-bold transition-all ${
            activeTab === 'customers'
              ? 'bg-purple-400 text-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]'
              : 'bg-white text-slate-900 hover:bg-slate-50'
          }`}
        >
          👥 Clientes ({customerStats.total_customers})
        </button>
      </div>

      {/* Content Based on Active Tab */}
      {activeTab === 'orders' && (
        <div className="bg-white border-4 border-slate-900 rounded-xl p-6"
             style={{ boxShadow: '8px_8px_0px_0px_rgba(15,23,42,1)' }}>
          <h2 className="text-2xl font-black text-slate-900 mb-6">📦 Órdenes de Compra</h2>
          
          {orders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">No hay órdenes para mostrar</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {orders.map((order) => (
                <div 
                  key={order.id}
                  className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-slate-900 rounded-xl"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-slate-900">Orden #{order.reference || order.id}</h3>
                      <p className="text-sm text-slate-600">{order.customer_name || 'Cliente'}</p>
                      <p className="text-xs text-slate-500">
                        🏪 {order.store_name || 'Desconocido'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-lg text-slate-900">
                        ${parseFloat(order.total_paid || 0).toLocaleString('es-CL')}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(order.date_add).toLocaleDateString('es-CL')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 border-2 rounded-lg text-xs font-bold flex items-center gap-1 ${getStatusColor(order.current_state || order.status)}`}>
                        {getStatusIcon(order.current_state || order.status)}
                        {order.state_name || getStateName(order.current_state || order.status)}
                      </span>
                      <span className="text-xs text-slate-600 font-medium">
                        💳 {order.payment_method || 'Sin método'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedOrderId(order.id)}
                        className="flex items-center gap-1 px-3 py-1 bg-blue-400 text-white rounded-lg text-xs font-bold hover:bg-blue-500 transition-colors border-2 border-slate-900"
                      >
                        <Eye className="w-3 h-3" />
                        Ver Detalle
                      </button>
                      {order.integration_id && (
                        <a
                          href={getPrestashopOrderUrl(order.integration_id, order.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          PrestaShop
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'carts' && (
        <div className="bg-white border-4 border-slate-900 rounded-xl p-6"
             style={{ boxShadow: '8px_8px_0px_0px_rgba(15,23,42,1)' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-slate-900">🛒 Carritos de Compra</h2>
            
            {/* Stats Cards */}
            <div className="flex gap-3">
              <div className="px-4 py-2 bg-blue-100 border-2 border-blue-600 rounded-lg">
                <span className="text-xs font-medium text-blue-900">Activos</span>
                <p className="text-lg font-black text-blue-900">{cartStats.active}</p>
              </div>
              <div className="px-4 py-2 bg-yellow-100 border-2 border-yellow-600 rounded-lg">
                <span className="text-xs font-medium text-yellow-900">Abandonados</span>
                <p className="text-lg font-black text-yellow-900">{cartStats.abandoned}</p>
              </div>
              <div className="px-4 py-2 bg-green-100 border-2 border-green-600 rounded-lg">
                <span className="text-xs font-medium text-green-900">Convertidos</span>
                <p className="text-lg font-black text-green-900">{cartStats.converted}</p>
              </div>
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setCartFilterStatus('abandoned')}
              className={`px-4 py-2 border-2 border-slate-900 rounded-lg font-bold text-sm ${
                cartFilterStatus === 'abandoned'
                  ? 'bg-yellow-400 text-slate-900'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Abandonados
            </button>
            <button
              onClick={() => setCartFilterStatus('active')}
              className={`px-4 py-2 border-2 border-slate-900 rounded-lg font-bold text-sm ${
                cartFilterStatus === 'active'
                  ? 'bg-blue-400 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Activos
            </button>
            <button
              onClick={() => setCartFilterStatus('converted')}
              className={`px-4 py-2 border-2 border-slate-900 rounded-lg font-bold text-sm ${
                cartFilterStatus === 'converted'
                  ? 'bg-green-400 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Convertidos
            </button>
          </div>
          
          {/* Carts List */}
          {carts.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">No hay carritos en esta categoría</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {carts.map((cart) => (
                <div 
                  key={cart.cart_id || cart.id}
                  className={`p-4 border-2 border-slate-900 rounded-xl ${
                    cart.status === 'abandoned' ? 'bg-gradient-to-br from-yellow-50 to-orange-50' :
                    cart.status === 'active' ? 'bg-gradient-to-br from-blue-50 to-cyan-50' :
                    'bg-gradient-to-br from-green-50 to-teal-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-slate-900">Carrito #{cart.cart_id || cart.id}</h3>
                        <span className={`px-2 py-0.5 border rounded text-xs font-bold ${
                          cart.status === 'abandoned' ? 'bg-yellow-200 border-yellow-600 text-yellow-900' :
                          cart.status === 'active' ? 'bg-blue-200 border-blue-600 text-blue-900' :
                          'bg-green-200 border-green-600 text-green-900'
                        }`}>
                          {cart.status === 'abandoned' ? '⏳ Abandonado' :
                           cart.status === 'active' ? '🔵 Activo' :
                           '✅ Convertido'}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-900">{cart.customer_name}</p>
                      <p className="text-xs text-slate-600">{cart.customer_email}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-600">
                        <span>🏪 {cart.store_name}</span>
                        <span>📦 {cart.items?.length || 0} productos</span>
                        <span className="font-bold text-green-600">
                          ${Math.round(cart.total_products || 0).toLocaleString('es-CL')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        📅 {new Date(cart.created_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedCartId(cart.cart_id || cart.id)}
                      className="px-3 py-1 bg-blue-400 text-white rounded-lg text-xs font-bold hover:bg-blue-500 transition-colors border-2 border-slate-900 flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      Ver Detalle
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Customers Tab */}
      {activeTab === 'customers' && (
        <div className="bg-white border-4 border-slate-900 rounded-xl p-6"
             style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-slate-900">👥 Clientes Ecommerce</h2>
            
            {/* Filtros */}
            <div className="flex gap-2">
              <button
                onClick={() => setCustomerFilter('all')}
                className={`px-4 py-2 border-2 border-slate-900 rounded-lg font-semibold text-sm transition-all ${
                  customerFilter === 'all'
                    ? 'bg-purple-400 text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
                    : 'bg-white text-slate-900 hover:bg-slate-50'
                }`}
              >
                Todos ({customerStats.total_customers})
              </button>
              <button
                onClick={() => setCustomerFilter('new')}
                className={`px-4 py-2 border-2 border-slate-900 rounded-lg font-semibold text-sm transition-all ${
                  customerFilter === 'new'
                    ? 'bg-green-400 text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
                    : 'bg-white text-slate-900 hover:bg-slate-50'
                }`}
              >
                Nuevos ({customerStats.new_customers})
              </button>
              <button
                onClick={() => setCustomerFilter('recurring')}
                className={`px-4 py-2 border-2 border-slate-900 rounded-lg font-semibold text-sm transition-all ${
                  customerFilter === 'recurring'
                    ? 'bg-blue-400 text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
                    : 'bg-white text-slate-900 hover:bg-slate-50'
                }`}
              >
                Recurrentes ({customerStats.recurring_customers})
              </button>
              <button
                onClick={() => setCustomerFilter('one-time')}
                className={`px-4 py-2 border-2 border-slate-900 rounded-lg font-semibold text-sm transition-all ${
                  customerFilter === 'one-time'
                    ? 'bg-gray-400 text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
                    : 'bg-white text-slate-900 hover:bg-slate-50'
                }`}
              >
                Una compra ({customerStats.one_time_customers})
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-slate-900 rounded-lg p-4">
              <div className="text-sm font-semibold text-slate-600 mb-1">Valor Promedio Pedido</div>
              <div className="text-2xl font-black text-slate-900">
                ${Math.round(customerStats.avg_order_value || 0).toLocaleString('es-CL')}
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-slate-900 rounded-lg p-4">
              <div className="text-sm font-semibold text-slate-600 mb-1">Tasa Recurrencia</div>
              <div className="text-2xl font-black text-slate-900">
                {customerStats.recurring_rate || 0}%
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-slate-900 rounded-lg p-4">
              <div className="text-sm font-semibold text-slate-600 mb-1">Clientes Activos</div>
              <div className="text-2xl font-black text-slate-900">
                {customerStats.recurring_customers + customerStats.new_customers}
              </div>
            </div>
          </div>
          
          {customers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No hay clientes para mostrar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-slate-900">
                    <th className="text-left py-3 px-4 font-black text-slate-900">Cliente</th>
                    <th className="text-left py-3 px-4 font-black text-slate-900">Email</th>
                    <th className="text-center py-3 px-4 font-black text-slate-900">Tipo</th>
                    <th className="text-center py-3 px-4 font-black text-slate-900">Pedidos</th>
                    <th className="text-right py-3 px-4 font-black text-slate-900">Total Gastado</th>
                    <th className="text-right py-3 px-4 font-black text-slate-900">Promedio</th>
                    <th className="text-center py-3 px-4 font-black text-slate-900">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer, index) => {
                    const getTypeColor = (type) => {
                      const colors = {
                        'new': 'bg-green-100 text-green-800 border-green-800',
                        'recurring': 'bg-blue-100 text-blue-800 border-blue-800',
                        'one-time': 'bg-gray-100 text-gray-800 border-gray-800'
                      };
                      return colors[type] || colors['one-time'];
                    };

                    const getTypeLabel = (type) => {
                      const labels = {
                        'new': 'Nuevo',
                        'recurring': 'Recurrente',
                        'one-time': 'Una compra'
                      };
                      return labels[type] || 'Una compra';
                    };

                    return (
                      <tr 
                        key={index}
                        className="border-b border-slate-200 hover:bg-purple-50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">
                            {customer.name || 'Cliente sin nombre'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-sm">
                          {customer.email}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 border-2 rounded-lg text-xs font-bold ${getTypeColor(customer.customer_type)}`}>
                            {getTypeLabel(customer.customer_type)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-900">
                          {customer.order_count}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-green-600">
                          ${Math.round(customer.total_spent || 0).toLocaleString('es-CL')}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-blue-600">
                          ${Math.round(customer.average_order_value || 0).toLocaleString('es-CL')}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleCustomerClick(customer.customer_id)}
                            className="px-3 py-1 bg-purple-400 text-white border-2 border-slate-900 rounded-lg font-semibold text-sm hover:bg-purple-500 transition-colors shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                          >
                            <Eye size={16} className="inline" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrderId && (
        <OrderDetailModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onUpdate={() => {
            fetchOrders();
            fetchStats();
          }}
        />
      )}
      
      {/* Cart Detail Modal */}
      {selectedCartId && (
        <CartDetailModal
          cartId={selectedCartId}
          onClose={() => setSelectedCartId(null)}
        />
      )}

      {/* Customer Detail Modal */}
      {selectedCustomerId && (
        <CustomerDetailModal
          customer={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
        />
      )}
    </div>
  );
};

export default EcommercePage;
