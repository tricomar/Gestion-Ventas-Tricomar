import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, User, ShoppingCart, Package, DollarSign, Calendar, Store } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CartDetailModal = ({ cartId, onClose }) => {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCartDetail();
  }, [cartId]);

  const fetchCartDetail = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/ecommerce/carts/${cartId}`);
      setCart(response.data);
    } catch (error) {
      console.error('Error fetching cart:', error);
      toast.error('Error al cargar el carrito');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colorMap = {
      'abandoned': 'bg-red-100 text-red-800 border-red-800',
      'active': 'bg-blue-100 text-blue-800 border-blue-800',
      'converted': 'bg-green-100 text-green-800 border-green-800',
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800 border-gray-800';
  };

  const getStatusName = (status) => {
    const nameMap = {
      'abandoned': 'Abandonado',
      'active': 'Activo',
      'converted': 'Convertido',
    };
    return nameMap[status] || status;
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

  if (!cart) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white border-4 border-slate-900 rounded-2xl p-6 max-w-4xl w-full my-8"
           style={{ boxShadow: '12px 12px 0px 0px rgba(15,23,42,1)' }}>
        
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-black text-slate-900">
              Carrito #{cart.cart_id || cart.id}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {cart.store_name} · {new Date(cart.created_at).toLocaleDateString('es-CL', {
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

        {/* Estado */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-slate-900 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 mb-2">Estado del Carrito</p>
              <span className={`inline-block px-3 py-1 rounded-lg text-sm font-bold border ${getStatusColor(cart.status)}`}>
                {getStatusName(cart.status)}
              </span>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-slate-600 mb-1">Última actualización</p>
              <p className="text-xs text-slate-500">
                {new Date(cart.updated_at).toLocaleString('es-CL', { 
                  dateStyle: 'short', 
                  timeStyle: 'short' 
                })}
              </p>
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
            <p className="text-slate-900 font-medium">{cart.customer_name}</p>
            <p className="text-sm text-slate-600">{cart.customer_email}</p>
            <p className="text-xs text-slate-500 mt-1">ID: {cart.customer_id}</p>
          </div>

          {/* Tienda */}
          <div className="border-2 border-slate-900 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Store className="w-5 h-5 text-purple-600" />
              <h3 className="font-bold text-slate-900">Tienda</h3>
            </div>
            <p className="text-slate-900 font-medium">{cart.store_name}</p>
            <p className="text-sm text-slate-600">Código: {cart.store_code}</p>
          </div>
        </div>

        {/* Productos */}
        <div className="border-2 border-slate-900 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="w-5 h-5 text-green-600" />
            <h3 className="font-bold text-slate-900">Productos en el Carrito</h3>
          </div>
          
          {cart.items && cart.items.length > 0 ? (
            <div className="space-y-2">
              {cart.items.map((item, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{item.product_name}</p>
                    <p className="text-sm text-slate-600">
                      ${Math.round(item.product_price || 0).toLocaleString('es-CL')} × {item.quantity}
                    </p>
                  </div>
                  <p className="font-bold text-slate-900">
                    ${Math.round(item.total || 0).toLocaleString('es-CL')}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-4">No hay productos en el carrito</p>
          )}
        </div>

        {/* Total */}
        <div className="border-2 border-slate-900 rounded-xl p-4 bg-gradient-to-br from-green-50 to-emerald-50">
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold text-slate-900">Total del Carrito:</span>
            <span className="text-2xl font-black text-green-600">
              ${Math.round(cart.total_products || 0).toLocaleString('es-CL')}
            </span>
          </div>
        </div>

        {/* Acciones */}
        {cart.status === 'abandoned' && (
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => window.open(`mailto:${cart.customer_email}?subject=Tu carrito en ${cart.store_name}`, '_blank')}
              className="flex-1 px-4 py-2 bg-blue-400 text-white font-bold border-2 border-slate-900 rounded-lg hover:bg-blue-500 transition-colors"
            >
              Contactar Cliente
            </button>
            <button
              className="flex-1 px-4 py-2 bg-green-400 text-white font-bold border-2 border-slate-900 rounded-lg hover:bg-green-500 transition-colors"
            >
              Ver en PrestaShop
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartDetailModal;
