import React, { useState } from 'react';
import { Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, X } from 'lucide-react';

const CartSidebar = ({ 
  cartItems, 
  cartId, 
  onUpdateQuantity, 
  onRemove, 
  onClear, 
  onPayment,
  customer 
}) => {
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const subtotalSinIVA = cartItems.reduce((sum, item) => {
    const itemTotal = item.product.sale_price * item.quantity;
    return sum + (itemTotal / 1.19);
  }, 0);

  const iva = cartItems.reduce((sum, item) => {
    const itemTotal = item.product.sale_price * item.quantity;
    const itemIVA = itemTotal - (itemTotal / 1.19);
    return sum + itemIVA;
  }, 0);

  const total = cartItems.reduce((sum, item) => 
    sum + (item.product.sale_price * item.quantity), 0
  );

  const handlePaymentMethod = (method) => {
    onPayment(method);
    setShowPaymentModal(false);
  };

  return (
    <>
      <div 
        className="w-[450px] bg-white border-l-4 border-slate-900 flex flex-col"
        style={{ boxShadow: '-4px 0 0px 0px rgba(15,23,42,1)' }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 border-b-4 border-slate-900 p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <ShoppingCart className="w-6 h-6" />
              Carrito
            </h2>
            {cartItems.length > 0 && (
              <button
                onClick={onClear}
                className="px-3 py-1 bg-white/20 border border-white rounded-lg text-white text-xs font-bold hover:bg-white/30 transition-all"
              >
                Limpiar
              </button>
            )}
          </div>
          <p className="text-sm text-white/90 font-mono">#{cartId.slice(0, 8).toUpperCase()}</p>
          {customer && (
            <div className="mt-3 px-3 py-2 bg-white/20 border border-white rounded-lg">
              <p className="text-xs text-white/80">Cliente:</p>
              <p className="text-sm font-bold text-white">{customer.name}</p>
            </div>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-6">
          {cartItems.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-400 font-medium">Carrito vacío</p>
              <p className="text-sm text-slate-400 mt-2">Agrega productos para comenzar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cartItems.map((item) => (
                <div 
                  key={item.id}
                  className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-slate-900 rounded-xl p-4"
                  style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 text-sm mb-1">{item.product.name}</h3>
                      <p className="text-xs text-slate-600">{item.product.sku || 'Sin SKU'}</p>
                    </div>
                    <button
                      onClick={() => onRemove(item.id)}
                      className="p-1 hover:bg-red-100 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                        className="w-8 h-8 bg-white border-2 border-slate-900 rounded-lg flex items-center justify-center font-bold hover:bg-slate-100 transition-all"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-12 text-center font-black text-lg">{item.quantity}</span>
                      <button
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                        className="w-8 h-8 bg-white border-2 border-slate-900 rounded-lg flex items-center justify-center font-bold hover:bg-slate-100 transition-all"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-600">Subtotal</p>
                      <p className="text-xl font-black text-slate-900">
                        ${(item.product.sale_price * item.quantity).toLocaleString('es-CL')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals Footer */}
        {cartItems.length > 0 && (
          <div className="border-t-4 border-slate-900 bg-gradient-to-br from-yellow-50 to-orange-50 p-6">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 font-medium">Subtotal (sin IVA):</span>
                <span className="font-bold text-slate-900">${subtotalSinIVA.toLocaleString('es-CL', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 font-medium">IVA (19%):</span>
                <span className="font-bold text-slate-900">${iva.toLocaleString('es-CL', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="border-t-2 border-slate-900 pt-2 flex justify-between">
                <span className="text-lg font-black text-slate-900">TOTAL:</span>
                <span className="text-3xl font-black text-slate-900">${total.toLocaleString('es-CL')}</span>
              </div>
            </div>
            
            <button
              onClick={() => setShowPaymentModal(true)}
              className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 border-2 border-slate-900 rounded-xl font-black text-white text-lg hover:scale-105 transition-all flex items-center justify-center gap-2"
              style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
            >
              <CreditCard className="w-6 h-6" />
              PAGAR
            </button>
          </div>
        )}
      </div>

      {/* Payment Method Modal */}
      {showPaymentModal && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowPaymentModal(false)}
        >
          <div 
            className="bg-white border-4 border-slate-900 rounded-xl p-8 max-w-md w-full"
            style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-slate-900">Método de Pago</h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={() => handlePaymentMethod('Efectivo')}
                className="w-full py-4 bg-gradient-to-r from-green-400 to-green-500 border-2 border-slate-900 rounded-xl font-bold text-white hover:scale-105 transition-all flex items-center justify-center gap-3"
                style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
              >
                <Banknote className="w-6 h-6" />
                Efectivo
              </button>
              
              <button
                onClick={() => handlePaymentMethod('Tarjeta')}
                className="w-full py-4 bg-gradient-to-r from-blue-400 to-blue-500 border-2 border-slate-900 rounded-xl font-bold text-white hover:scale-105 transition-all flex items-center justify-center gap-3"
                style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
              >
                <CreditCard className="w-6 h-6" />
                Tarjeta
              </button>
              
              <button
                onClick={() => handlePaymentMethod('Transferencia')}
                className="w-full py-4 bg-gradient-to-r from-purple-400 to-purple-500 border-2 border-slate-900 rounded-xl font-bold text-white hover:scale-105 transition-all flex items-center justify-center gap-3"
                style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
              >
                <CreditCard className="w-6 h-6" />
                Transferencia
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CartSidebar;
