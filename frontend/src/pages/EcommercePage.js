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
import OrderDetailModal from '../components/ecommerce/OrderDetailModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const EcommercePage = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
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
  const [selectedIntegration, setSelectedIntegration] = useState('all');
  const [activeTab, setActiveTab] = useState('orders'); // 'orders', 'abandoned', 'finalized'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIntegrations();
  }, []);

  useEffect(() => {
    if (integrations.length > 0 || selectedIntegration === 'all') {
      fetchEcommerceData();
    }
  }, [selectedIntegration]);

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

  const fetchEcommerceData = async () => {
    try {
      const integrationParam = selectedIntegration !== 'all' 
        ? `integration_id=${selectedIntegration}&` 
        : '';

      // Obtener órdenes
      const ordersRes = await axios.get(`${API}/ecommerce/orders?${integrationParam}limit=50`);
      setOrders(ordersRes.data);

      // Obtener estadísticas
      const statsRes = await axios.get(`${API}/ecommerce/stats`);
      setStats(statsRes.data);

      // Obtener carritos abandonados
      const abandonedRes = await axios.get(`${API}/ecommerce/carts/abandoned?${integrationParam}limit=50`);
      setAbandonedCarts(abandonedRes.data);

      // Obtener carritos finalizados
      const finalizedRes = await axios.get(`${API}/ecommerce/carts/finalized?${integrationParam}limit=50`);
      setFinalizedCarts(finalizedRes.data);

    } catch (error) {
      console.error('Error fetching ecommerce data:', error);
    }
  };

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

  if (integrations.length === 0) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto text-center mt-20">
          <div className="text-8xl mb-6">🛍️</div>
          <h2 className="text-3xl font-black text-slate-900 mb-4">No hay integraciones de ecommerce</h2>
          <p className="text-slate-600 mb-8">
            Ve a <strong>Configuración → Integraciones</strong> para conectar tu tienda PrestaShop
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
          onClick={() => setSelectedIntegration('all')}
          className={`px-6 py-3 border-2 border-slate-900 rounded-xl font-bold transition-all ${
            selectedIntegration === 'all'
              ? 'bg-indigo-400 text-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]'
              : 'bg-white text-slate-900 hover:bg-slate-50'
          }`}
        >
          🏪 Todas las Tiendas
        </button>
        {integrations.map((integration) => (
          <button
            key={integration.id}
            onClick={() => setSelectedIntegration(integration.id)}
            className={`px-6 py-3 border-2 border-slate-900 rounded-xl font-bold transition-all ${
              selectedIntegration === integration.id
                ? 'bg-purple-400 text-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]'
                : 'bg-white text-slate-900 hover:bg-slate-50'
            }`}
          >
            🛒 {integration.store_name}
          </button>
        ))}
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
          onClick={() => setActiveTab('abandoned')}
          className={`px-6 py-3 border-2 border-slate-900 rounded-xl font-bold transition-all ${
            activeTab === 'abandoned'
              ? 'bg-yellow-400 text-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]'
              : 'bg-white text-slate-900 hover:bg-slate-50'
          }`}
        >
          🛒 Carritos Abandonados ({abandonedCarts.length})
        </button>
        <button
          onClick={() => setActiveTab('finalized')}
          className={`px-6 py-3 border-2 border-slate-900 rounded-xl font-bold transition-all ${
            activeTab === 'finalized'
              ? 'bg-green-400 text-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]'
              : 'bg-white text-slate-900 hover:bg-slate-50'
          }`}
        >
          ✅ Carritos Finalizados ({finalizedCarts.length})
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
                        🏪 {getIntegrationName(order.integration_id)}
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
                        {order.state_name || `Estado ${order.current_state || order.status}`}
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

      {activeTab === 'abandoned' && (
        <div className="bg-white border-4 border-slate-900 rounded-xl p-6"
             style={{ boxShadow: '8px_8px_0px_0px_rgba(15,23,42,1)' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-slate-900">🛒 Carritos Abandonados</h2>
            <div className="flex items-center gap-2 px-4 py-2 bg-yellow-100 border-2 border-yellow-600 rounded-lg">
              <AlertCircle className="w-5 h-5 text-yellow-700" />
              <span className="text-sm font-bold text-yellow-900">
                {abandonedCarts.length} carritos sin completar
              </span>
            </div>
          </div>
          
          {abandonedCarts.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">No hay carritos abandonados</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {abandonedCarts.map((cart) => (
                <div 
                  key={cart.id}
                  className="p-4 bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-slate-900 rounded-xl"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-slate-900">Carrito #{cart.id}</h3>
                      <p className="text-sm text-slate-600">Cliente ID: {cart.id_customer}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        🏪 {getIntegrationName(cart.integration_id)}
                      </p>
                    </div>
                    <ShoppingCart className="w-8 h-8 text-yellow-600" />
                  </div>
                  
                  <div className="text-xs text-slate-600 mb-2">
                    <p>📅 {new Date(cart.date_add).toLocaleString('es-CL')}</p>
                    {cart.date_upd && (
                      <p>🔄 Actualizado: {new Date(cart.date_upd).toLocaleString('es-CL')}</p>
                    )}
                  </div>
                  
                  <div className="pt-3 border-t-2 border-slate-200">
                    <span className="px-3 py-1 bg-yellow-200 border-2 border-yellow-600 rounded-lg text-xs font-bold">
                      ⏳ Abandonado
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'finalized' && (
        <div className="bg-white border-4 border-slate-900 rounded-xl p-6"
             style={{ boxShadow: '8px_8px_0px_0px_rgba(15,23,42,1)' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-slate-900">✅ Carritos Finalizados</h2>
            <div className="flex items-center gap-2 px-4 py-2 bg-green-100 border-2 border-green-600 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-700" />
              <span className="text-sm font-bold text-green-900">
                {finalizedCarts.length} compras completadas
              </span>
            </div>
          </div>
          
          {finalizedCarts.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">No hay carritos finalizados</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {finalizedCarts.map((cart) => {
                const prestashopUrl = getPrestashopCartUrl(cart);
                return (
                  <div 
                    key={cart.id}
                    className="p-4 bg-gradient-to-r from-green-50 to-teal-50 border-2 border-slate-900 rounded-xl"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-slate-900">Carrito #{cart.id}</h3>
                          <span className="px-2 py-0.5 bg-green-200 border border-green-600 rounded text-xs font-bold text-green-900">
                            ✅ Finalizado
                          </span>
                        </div>
                        <p className="text-sm text-slate-600">Orden: #{cart.id_order}</p>
                        <p className="text-xs text-slate-500">Cliente ID: {cart.id_customer}</p>
                        <p className="text-xs text-slate-500">
                          🏪 {getIntegrationName(cart.integration_id)}
                        </p>
                      </div>
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    
                    <div className="text-xs text-slate-600 mb-3">
                      <p>📅 {new Date(cart.date_add).toLocaleString('es-CL')}</p>
                    </div>
                    
                    {prestashopUrl && (
                      <a
                        href={prestashopUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white border-2 border-slate-900 rounded-lg font-bold hover:bg-blue-600 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Ver en PrestaShop
                      </a>
                    )}
                  </div>
                );
              })}
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
    </div>
  );
};

export default EcommercePage;
