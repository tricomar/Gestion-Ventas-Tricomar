import React, { useState } from 'react';
import { Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, X, Eye, Percent, DollarSign, TrendingDown, TrendingUp } from 'lucide-react';

const CartSidebar = ({ 
  cartItems, 
  cartId, 
  onUpdateQuantity, 
  onRemove, 
  onClear, 
  onPayment,
  customer,
  todayStats,
  onUpdateItemDiscount,
  discountPercentages = [0, 5, 10, 15, 20, 25, 30, 50]
}) => {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [cartDiscount, setCartDiscount] = useState({ type: 'none', value: 0 }); // 'percent', 'amount', 'none'

  // Calcular subtotal por producto considerando descuentos individuales
  const calculateItemSubtotal = (item) => {
    const basePrice = item.product.sale_price * item.quantity;
    const discount = (item.discount || 0) / 100;
    return basePrice * (1 - discount);
  };

  // Calcular subtotal del carrito (suma de todos los items con sus descuentos)
  const cartSubtotal = cartItems.reduce((sum, item) => sum + calculateItemSubtotal(item), 0);

  // Aplicar descuento general del carrito
  const getCartDiscountAmount = () => {
    if (cartDiscount.type === 'percent') {
      return cartSubtotal * (cartDiscount.value / 100);
    } else if (cartDiscount.type === 'amount') {
      return cartDiscount.value;
    }
    return 0;
  };

  const discountAmount = getCartDiscountAmount();
  const totalAfterDiscount = cartSubtotal - discountAmount;
  
  // Calcular IVA y subtotal sin IVA
  const subtotalSinIVA = totalAfterDiscount / 1.19;
  const iva = totalAfterDiscount - subtotalSinIVA;
  const total = totalAfterDiscount;

  const handlePaymentMethod = (method) => {
    // Pasar información de descuentos al payment handler
    onPayment(method, { 
      cartDiscount, 
      discountAmount,
      itemsWithDiscounts: cartItems.map(item => ({
        ...item,
        discountPercent: item.discount || 0,
        subtotalAfterDiscount: calculateItemSubtotal(item)
      }))
    });
    setShowPaymentModal(false);
  };

  return (
    <>
      <div 
        className="w-[450px] bg-white border-l-4 border-slate-900 flex flex-col"
        style={{ boxShadow: '-4px 0 0px 0px rgba(15,23,42,1)' }}
      >
        {/* Header con indicadores */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 border-b-4 border-slate-900 p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <ShoppingCart className="w-6 h-6" />
              Carrito
            </h2>
            <button
              onClick={() => setShowSalesModal(true)}
              className="px-3 py-2 bg-white/20 border-2 border-white rounded-lg text-white text-sm font-bold hover:bg-white/30 transition-all flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              ${Math.round(todayStats?.ventas?.total || 0).toLocaleString('es-CL')}
            </button>
          </div>
          
          {/* Indicadores del día */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="bg-white/20 border border-white rounded-lg p-2">
              <p className="text-[10px] text-white/80 font-bold">EGRESOS</p>
              <p className="text-sm text-white font-black flex items-center gap-1">
                <TrendingDown className="w-3 h-3" />
                ${Math.round(todayStats?.egresos?.total || 0).toLocaleString('es-CL')}
              </p>
            </div>
            <div className="bg-white/20 border border-white rounded-lg p-2">
              <p className="text-[10px] text-white/80 font-bold">INGRESOS +</p>
              <p className="text-sm text-white font-black flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                ${Math.round(todayStats?.ingresos_extras?.total || 0).toLocaleString('es-CL')}
              </p>
            </div>
            <div className="bg-white/20 border border-white rounded-lg p-2">
              <p className="text-[10px] text-white/80 font-bold">VENTAS</p>
              <p className="text-sm text-white font-black">{todayStats?.ventas?.count || 0}</p>
            </div>
          </div>

          <p className="text-sm text-white/90 font-mono mt-3">#{cartId.slice(0, 8).toUpperCase()}</p>
          {customer && (
            <div className="mt-2 px-3 py-2 bg-white/20 border border-white rounded-lg">
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
                      <p className="text-xs text-slate-600">Precio Unit.</p>
                      <p className="text-lg font-black text-slate-900">
                        ${Math.round(item.product.sale_price).toLocaleString('es-CL')}
                      </p>
                    </div>
                  </div>

                  {/* Descuento por producto */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t-2 border-slate-300">
                    <Percent className="w-4 h-4 text-purple-600" />
                    <select
                      value={item.discount || 0}
                      onChange={(e) => onUpdateItemDiscount && onUpdateItemDiscount(item.id, parseFloat(e.target.value))}
                      className="flex-1 px-2 py-1 border-2 border-slate-900 rounded-lg text-sm font-bold bg-white"
                    >
                      {discountPercentages.map(percent => (
                        <option key={percent} value={percent}>
                          {percent === 0 ? 'Sin descuento' : `-${percent}%`}
                        </option>
                      ))}
                    </select>
                    <div className="text-right">
                      <p className="text-xs text-slate-600">Subtotal</p>
                      <p className="text-lg font-black text-purple-600">
                        ${Math.round(calculateItemSubtotal(item)).toLocaleString('es-CL')}
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
            
            {/* Descuentos Generales del Carrito */}
            <div className="mb-4 p-3 bg-white border-2 border-slate-900 rounded-lg">
              <p className="text-xs font-bold text-slate-600 mb-2">DESCUENTO GENERAL</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-600 font-bold">Porcentaje %</label>
                  <div className="flex items-center gap-1">
                    <Percent className="w-4 h-4 text-purple-600" />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={cartDiscount.type === 'percent' ? cartDiscount.value : ''}
                      onChange={(e) => setCartDiscount({ type: 'percent', value: parseFloat(e.target.value) || 0 })}
                      onFocus={() => setCartDiscount({ type: 'percent', value: cartDiscount.type === 'percent' ? cartDiscount.value : 0 })}
                      className="flex-1 px-2 py-1 border-2 border-slate-900 rounded-lg text-sm font-bold"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-slate-600 font-bold">Monto $</label>
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <input
                      type="number"
                      min="0"
                      value={cartDiscount.type === 'amount' ? cartDiscount.value : ''}
                      onChange={(e) => setCartDiscount({ type: 'amount', value: parseFloat(e.target.value) || 0 })}
                      onFocus={() => setCartDiscount({ type: 'amount', value: cartDiscount.type === 'amount' ? cartDiscount.value : 0 })}
                      className="flex-1 px-2 py-1 border-2 border-slate-900 rounded-lg text-sm font-bold"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
              {discountAmount > 0 && (
                <p className="text-xs text-red-600 font-bold mt-2">
                  Descuento aplicado: -${Math.round(discountAmount).toLocaleString('es-CL')}
                </p>
              )}
            </div>

            {/* Totales */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 font-medium">Subtotal items:</span>
                <span className="font-bold text-slate-900">${Math.round(cartSubtotal).toLocaleString('es-CL')}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-red-600 font-medium">Descuento:</span>
                  <span className="font-bold text-red-600">-${Math.round(discountAmount).toLocaleString('es-CL')}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 font-medium">Subtotal (sin IVA):</span>
                <span className="font-bold text-slate-900">${Math.round(subtotalSinIVA).toLocaleString('es-CL')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 font-medium">IVA (19%):</span>
                <span className="font-bold text-slate-900">${Math.round(iva).toLocaleString('es-CL')}</span>
              </div>
              <div className="border-t-2 border-slate-900 pt-2 flex justify-between">
                <span className="text-lg font-black text-slate-900">TOTAL:</span>
                <span className="text-3xl font-black text-slate-900">${Math.round(total).toLocaleString('es-CL')}</span>
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

      {/* Sales Breakdown Modal */}
      {showSalesModal && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowSalesModal(false)}
        >
          <div 
            className="bg-white border-4 border-slate-900 rounded-xl p-8 max-w-md w-full"
            style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-slate-900">Total Ventas del Día</h3>
              <button
                onClick={() => setShowSalesModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-3">
              <div className="p-4 bg-green-50 border-2 border-slate-900 rounded-lg">
                <p className="text-xs text-slate-600 font-bold mb-1">EFECTIVO</p>
                <p className="text-2xl font-black text-slate-900">
                  ${Math.round(todayStats?.ventas?.efectivo || 0).toLocaleString('es-CL')}
                </p>
              </div>

              <div className="p-4 bg-blue-50 border-2 border-slate-900 rounded-lg">
                <p className="text-xs text-slate-600 font-bold mb-1">TARJETA</p>
                <p className="text-2xl font-black text-slate-900">
                  ${Math.round(todayStats?.ventas?.tarjeta || 0).toLocaleString('es-CL')}
                </p>
              </div>

              <div className="p-4 bg-purple-50 border-2 border-slate-900 rounded-lg">
                <p className="text-xs text-slate-600 font-bold mb-1">TRANSFERENCIA</p>
                <p className="text-2xl font-black text-slate-900">
                  ${Math.round(todayStats?.ventas?.transferencia || 0).toLocaleString('es-CL')}
                </p>
              </div>

              <div className="p-4 bg-gradient-to-r from-yellow-100 to-orange-100 border-4 border-slate-900 rounded-lg mt-4">
                <p className="text-sm text-slate-600 font-bold mb-1">TOTAL VENTAS</p>
                <p className="text-3xl font-black text-slate-900">
                  ${Math.round(todayStats?.ventas?.total || 0).toLocaleString('es-CL')}
                </p>
                <p className="text-xs text-slate-600 mt-1">{todayStats?.ventas?.count || 0} ventas registradas</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CartSidebar;
