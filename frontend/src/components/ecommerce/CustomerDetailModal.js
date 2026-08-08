import React from 'react';
import { X, Mail, Phone, ShoppingBag, DollarSign, Calendar, TrendingUp } from 'lucide-react';

const CustomerDetailModal = ({ customer, onClose }) => {
  if (!customer) return null;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(value || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getCustomerTypeLabel = (type) => {
    const types = {
      'new': { label: 'Nuevo', color: 'bg-green-100 text-green-800' },
      'recurring': { label: 'Recurrente', color: 'bg-blue-100 text-blue-800' },
      'one-time': { label: 'Una compra', color: 'bg-gray-100 text-gray-800' }
    };
    return types[type] || types['one-time'];
  };

  const typeInfo = getCustomerTypeLabel(customer.customer_type);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-xl flex justify-between items-start">
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-2">
              {customer.name || 'Cliente sin nombre'}
            </h2>
            <div className="flex items-center gap-4 text-sm opacity-90">
              <div className="flex items-center gap-1">
                <Mail size={16} />
                <span>{customer.email}</span>
              </div>
              {customer.phone && (
                <div className="flex items-center gap-1">
                  <Phone size={16} />
                  <span>{customer.phone}</span>
                </div>
              )}
            </div>
            <div className="mt-2">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${typeInfo.color}`}>
                {typeInfo.label}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-gray-50">
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <ShoppingBag size={18} />
              <span className="text-sm font-medium">Total Pedidos</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {customer.order_count || 0}
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <DollarSign size={18} />
              <span className="text-sm font-medium">Total Gastado</span>
            </div>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(customer.total_spent)}
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <TrendingUp size={18} />
              <span className="text-sm font-medium">Promedio/Pedido</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(customer.average_order_value)}
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <Calendar size={18} />
              <span className="text-sm font-medium">Última Compra</span>
            </div>
            <div className="text-sm font-semibold text-gray-900">
              Hace {customer.days_since_last_order || 0} días
            </div>
          </div>
        </div>

        {/* Timeline de pedidos */}
        <div className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <ShoppingBag size={20} />
            Historial de Pedidos ({customer.orders?.length || 0})
          </h3>

          {customer.orders && customer.orders.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {customer.orders.map((order, index) => (
                <div
                  key={index}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-purple-300 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold text-gray-900">
                          Orden #{order.order_reference || order.order_id}
                        </span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                          {order.status || 'Pendiente'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {formatDate(order.date)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">
                        {formatCurrency(order.total)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <ShoppingBag size={48} className="mx-auto mb-2 opacity-30" />
              <p>No hay pedidos registrados</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50 rounded-b-xl">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <div>
              <span className="font-medium">Primera compra:</span>{' '}
              {formatDate(customer.first_order_date)}
            </div>
            <div>
              <span className="font-medium">Última actualización:</span>{' '}
              {formatDate(customer.updated_at)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDetailModal;
