import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Package, 
  TrendingUp, 
  Users, 
  Mail, 
  MessageSquare, 
  ShoppingBag,
  CheckCircle,
  Clock,
  XCircle,
  Truck,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const EcommercePage = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({
    total_orders: 0,
    pending_orders: 0,
    monthly_sales: 0,
    new_customers: 0
  });
  const [customers, setCustomers] = useState([]);
  const [guestEmails, setGuestEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [messageText, setMessageText] = useState('');

  useEffect(() => {
    fetchEcommerceData();
    // Polling cada 30 segundos para nuevos pedidos
    const interval = setInterval(fetchEcommerceData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchEcommerceData = async () => {
    try {
      // Obtener órdenes
      const ordersRes = await axios.get(`${API}/ecommerce/orders?limit=50`);
      setOrders(ordersRes.data);

      // Obtener estadísticas
      const statsRes = await axios.get(`${API}/ecommerce/stats`);
      setStats(statsRes.data);

      // Obtener últimos clientes
      const customersRes = await axios.get(`${API}/ecommerce/customers?limit=10`);
      setCustomers(customersRes.data);

      // Obtener correos de invitados
      const guestsRes = await axios.get(`${API}/ecommerce/guest-emails?limit=20`);
      setGuestEmails(guestsRes.data);

    } catch (error) {
      console.error('Error fetching ecommerce data:', error);
      // No mostrar toast para evitar spam en polling
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await axios.patch(`${API}/ecommerce/orders/${orderId}/status`, {
        status: newStatus
      });
      
      toast.success('Estado actualizado correctamente', {
        style: {
          background: '#D4F0A5',
          color: '#0f172a',
          border: '2px solid #0f172a',
          fontWeight: 'bold',
        }
      });
      
      fetchEcommerceData();
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Error al actualizar el estado');
    }
  };

  const sendMessage = async (customerId, customerEmail) => {
    if (!messageText.trim()) {
      toast.error('Escribe un mensaje');
      return;
    }

    try {
      await axios.post(`${API}/ecommerce/messages`, {
        customer_id: customerId,
        customer_email: customerEmail,
        message: messageText,
        order_id: selectedOrder?.id
      });
      
      toast.success('Mensaje enviado correctamente');
      setMessageText('');
      setSelectedOrder(null);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Error al enviar el mensaje');
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

  const StatCard = ({ title, value, icon: Icon, gradient }) => (
    <div 
      className={`bg-gradient-to-br ${gradient} border-2 border-slate-900 rounded-xl p-6`}
      style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 bg-white/90 border-2 border-slate-900 rounded-lg">
          <Icon className="w-6 h-6 text-slate-900" />
        </div>
      </div>
      <h3 className="text-sm font-bold text-slate-900 mb-2">{title}</h3>
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Total Pedidos"
          value={stats.total_orders}
          icon={ShoppingBag}
          gradient="from-purple-400 to-pink-400"
        />
        <StatCard 
          title="Pedidos Pendientes"
          value={stats.pending_orders}
          icon={Clock}
          gradient="from-orange-400 to-red-400"
        />
        <StatCard 
          title="Ventas Mensuales"
          value={`$${stats.monthly_sales?.toLocaleString('es-CL') || 0}`}
          icon={TrendingUp}
          gradient="from-yellow-400 to-orange-400"
        />
        <StatCard 
          title="Nuevos Clientes"
          value={stats.new_customers}
          icon={Users}
          gradient="from-pink-400 to-purple-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders List */}
        <div className="lg:col-span-2">
          <div 
            className="bg-white border-2 border-slate-900 rounded-xl p-6"
            style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Últimos Pedidos
              </h2>
              <button
                onClick={fetchEcommerceData}
                className="px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 border-2 border-slate-900 rounded-lg text-white font-bold hover:scale-105 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {orders.length > 0 ? (
                orders.map((order) => (
                  <div 
                    key={order.id}
                    className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-slate-900 rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-black text-slate-900">Pedido #{order.reference || order.id}</p>
                        <p className="text-xs text-slate-600">
                          {new Date(order.date_add || order.created_at).toLocaleString('es-CL')}
                        </p>
                        <p className="text-sm text-slate-700 mt-1">
                          Cliente: <span className="font-bold">{order.customer_name || order.customer_email}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-slate-900">
                          ${order.total_paid?.toLocaleString('es-CL') || order.total?.toLocaleString('es-CL')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-3 py-1 border-2 rounded-lg text-xs font-bold flex items-center gap-1 ${getStatusColor(order.current_state || order.status)}`}>
                        {getStatusIcon(order.current_state || order.status)}
                        {order.current_state || order.status}
                      </span>

                      <select
                        value={order.current_state || order.status}
                        onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                        className="px-3 py-1 bg-white border-2 border-slate-900 rounded-lg text-xs font-bold"
                      >
                        <option value="pending">Pendiente</option>
                        <option value="processing">Procesando</option>
                        <option value="shipped">Enviado</option>
                        <option value="completed">Completado</option>
                        <option value="cancelled">Cancelado</option>
                      </select>

                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="px-3 py-1 bg-blue-500 border-2 border-slate-900 rounded-lg text-white text-xs font-bold hover:bg-blue-600"
                      >
                        <MessageSquare className="w-3 h-3 inline mr-1" />
                        Mensaje
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-slate-500 py-12">No hay pedidos recientes</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar - Customers & Guests */}
        <div className="space-y-6">
          {/* Recent Customers */}
          <div 
            className="bg-white border-2 border-slate-900 rounded-xl p-6"
            style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
          >
            <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Últimos Clientes
            </h3>
            <div className="space-y-2">
              {customers.length > 0 ? (
                customers.map((customer) => (
                  <div key={customer.id} className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 border border-slate-900 rounded-lg">
                    <p className="font-bold text-sm text-slate-900">{customer.firstname} {customer.lastname}</p>
                    <p className="text-xs text-slate-600">{customer.email}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 text-center py-4">Sin clientes recientes</p>
              )}
            </div>
          </div>

          {/* Guest Emails */}
          <div 
            className="bg-white border-2 border-slate-900 rounded-xl p-6"
            style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
          >
            <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Correos Invitados
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {guestEmails.length > 0 ? (
                guestEmails.map((email, index) => (
                  <div key={index} className="p-2 bg-yellow-50 border border-slate-900 rounded text-xs font-mono">
                    {email}
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 text-center py-4">Sin correos de invitados</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Message Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div 
            className="bg-white border-4 border-slate-900 rounded-xl p-8 max-w-md w-full"
            style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
          >
            <h3 className="text-2xl font-black text-slate-900 mb-4">Enviar Mensaje</h3>
            <p className="text-sm text-slate-600 mb-4">
              Para: <span className="font-bold">{selectedOrder.customer_email}</span><br />
              Pedido: <span className="font-bold">#{selectedOrder.reference || selectedOrder.id}</span>
            </p>
            
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Escribe tu mensaje aquí..."
              rows={5}
              className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl font-medium resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => sendMessage(selectedOrder.customer_id, selectedOrder.customer_email)}
                className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-pink-500 border-2 border-slate-900 rounded-xl font-bold text-white hover:scale-105 transition-all"
              >
                Enviar
              </button>
              <button
                onClick={() => {
                  setSelectedOrder(null);
                  setMessageText('');
                }}
                className="flex-1 py-3 bg-white border-2 border-slate-900 rounded-xl font-bold text-slate-900 hover:bg-slate-50 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EcommercePage;
