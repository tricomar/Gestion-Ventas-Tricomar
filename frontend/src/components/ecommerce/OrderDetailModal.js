import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Package, User, CreditCard, Truck, Calendar, DollarSign, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const OrderDetailModal = ({ orderId, onClose, onUpdate }) => {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [states, setStates] = useState([]);
  const [selectedState, setSelectedState] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchOrderDetail();
    fetchStates();
  }, [orderId]);

  const fetchOrderDetail = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/ecommerce/orders/${orderId}`);
      setOrder(response.data);
      setSelectedState(response.data.current_state);
    } catch (error) {
      console.error('Error fetching order:', error);
      toast.error('Error al cargar el pedido');
    } finally {
      setLoading(false);
    }
  };

  const fetchStates = async () => {
    try {
      const response = await axios.get(`${API}/ecommerce/order-states`);
      setStates(response.data);
    } catch (error) {
      console.error('Error fetching states:', error);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedState || selectedState === order.current_state) {
      return;
    }

    try {
      setUpdating(true);
      const selectedStateObj = states.find(s => s.id === selectedState);
      
      // Actualizar en Negocio Feliz Y sincronizar con PrestaShop
      await axios.patch(`${API}/ecommerce/orders/${orderId}/status`, {
        status: selectedState,
        state_name: selectedStateObj?.name || '',
        sync_to_prestashop: true  // Sincronizar con PrestaShop
      });
      
      toast.success('Estado actualizado en Negocio Feliz y PrestaShop');
      onUpdate && onUpdate();
      await fetchOrderDetail();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Error al actualizar el estado');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white border-4 border-slate-900 rounded-2xl p-8 max-w-2xl w-full"
             style={{ boxShadow: '12px 12px 0px 0px rgba(15,23,42,1)' }}>
          <p className="text-center text-slate-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  const getStateColor = (stateId) => {
    const colorMap = {
      '1': 'bg-yellow-100 text-yellow-800 border-yellow-800',
      '2': 'bg-green-100 text-green-800 border-green-800',
      '3': 'bg-blue-100 text-blue-800 border-blue-800',
      '4': 'bg-purple-100 text-purple-800 border-purple-800',
      '5': 'bg-emerald-100 text-emerald-800 border-emerald-800',
      '6': 'bg-red-100 text-red-800 border-red-800',
      '7': 'bg-orange-100 text-orange-800 border-orange-800',
    };
    return colorMap[stateId] || 'bg-gray-100 text-gray-800 border-gray-800';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white border-4 border-slate-900 rounded-2xl p-6 max-w-4xl w-full my-8"
           style={{ boxShadow: '12px 12px 0px 0px rgba(15,23,42,1)' }}>
        
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-black text-slate-900">
              Pedido #{order.reference}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {order.store_name} · {new Date(order.date_add).toLocaleDateString('es-CL', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Estado y Cambio de Estado */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-slate-900 rounded-xl p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-600 mb-2">Estado Actual</p>
              <span className={`inline-block px-3 py-1 rounded-lg text-sm font-bold border ${getStateColor(order.current_state)}`}>
                {order.state_name || `Estado ${order.current_state}`}
              </span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-600 mb-2">Cambiar Estado</p>
              <div className="flex gap-2">
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="flex-1 px-3 py-2 border-2 border-slate-900 rounded-lg font-medium"
                >
                  {states.map(state => (
                    <option key={state.id} value={state.id}>
                      {state.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleUpdateStatus}
                  disabled={updating || selectedState === order.current_state}
                  className="px-4 py-2 bg-blue-400 text-white font-bold border-2 border-slate-900 rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updating ? '...' : 'Actualizar'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Cliente */}
          <div className="border-2 border-slate-900 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-slate-900">Cliente</h3>
            </div>
            <p className="text-slate-900 font-medium mb-2">{order.customer_name}</p>
            {order.customer_email && (
              <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
                <span className="font-semibold">Email:</span>
                <a href={`mailto:${order.customer_email}`} className="hover:text-blue-600">
                  {order.customer_email}
                </a>
              </div>
            )}
            {order.customer_phone && (
              <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
                <span className="font-semibold">Teléfono:</span>
                <a href={`tel:${order.customer_phone}`} className="hover:text-blue-600">
                  {order.customer_phone}
                </a>
              </div>
            )}
            <p className="text-xs text-slate-500 mt-2">ID: {order.customer_id}</p>
          </div>

          {/* Pago */}
          <div className="border-2 border-slate-900 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="w-5 h-5 text-green-600" />
              <h3 className="font-bold text-slate-900">Método de Pago</h3>
            </div>
            <p className="text-slate-900 font-medium">{order.payment_method}</p>
            <p className="text-sm text-slate-600 mt-1">
              Total: ${Math.round(order.total_paid || 0).toLocaleString('es-CL')}
            </p>
          </div>
        </div>

        {/* Productos */}
        <div className="border-2 border-slate-900 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-slate-900">Productos</h3>
          </div>
          
          {order.items && order.items.length > 0 ? (
            <div className="space-y-2">
              {order.items.map((item, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{item.product_name}</p>
                    <p className="text-sm text-slate-600">
                      ${Math.round(item.product_price || 0).toLocaleString('es-CL')} × {item.product_quantity}
                    </p>
                  </div>
                  <p className="font-bold text-slate-900">
                    ${Math.round(item.total_price || 0).toLocaleString('es-CL')}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-4">No hay información de productos</p>
          )}
        </div>

        {/* Resumen de Totales */}
        <div className="border-2 border-slate-900 rounded-xl p-4 bg-gradient-to-br from-green-50 to-emerald-50">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Subtotal Productos:</span>
              <span className="font-medium">${Math.round(order.total_products || 0).toLocaleString('es-CL')}</span>
            </div>
            {order.shipping_cost > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Envío:</span>
                <span className="font-medium">${Math.round(order.shipping_cost || 0).toLocaleString('es-CL')}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t-2 border-slate-900">
              <span>Total Pagado:</span>
              <span className="text-green-600">${Math.round(order.total_paid || 0).toLocaleString('es-CL')}</span>
            </div>
          </div>
        </div>

        {/* Botones de Acción */}
        {order.integration_id && (
          <div className="mt-6 flex flex-wrap gap-3 justify-end">
            {/* Botón Generar Nota de Venta */}
            <button
              onClick={() => {
                // Generar nota de venta/factura
                window.print();
              }}
              className="px-4 py-2 bg-green-400 text-white font-bold border-2 border-slate-900 rounded-lg hover:bg-green-500 transition-colors inline-flex items-center gap-2"
            >
              <DollarSign className="w-4 h-4" />
              Generar Nota de Venta
            </button>
            
            {/* Botón Ver en PrestaShop */}
            <a
              href={order.prestashop_url || `${order.shop_url}/admin/index.php?controller=AdminOrders&id_order=${order.id_order}&vieworder&token=`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-purple-400 text-white font-bold border-2 border-slate-900 rounded-lg hover:bg-purple-500 transition-colors inline-flex items-center gap-2"
            >
              <Package className="w-4 h-4" />
              Ver en PrestaShop
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderDetailModal;
