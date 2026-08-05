import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Plus, Search, Trash2, ShoppingCart } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PastCartSaleForm = ({ onClose, onSuccess }) => {
  const [cartItems, setCartItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [loading, setLoading] = useState(false);

  // Inicializar fecha y hora con el día actual
  useEffect(() => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().slice(0, 5); // HH:MM
    setCustomDate(dateStr);
    setCustomTime(timeStr);
  }, []);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchProducts();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (customerSearch.length >= 2) {
      searchCustomers();
    } else {
      setCustomerResults([]);
    }
  }, [customerSearch]);

  const searchProducts = async () => {
    try {
      const response = await axios.get(`${API}/products/search?q=${searchQuery}`);
      setSearchResults(response.data);
    } catch (error) {
      console.error('Error searching products:', error);
    }
  };

  const searchCustomers = async () => {
    try {
      const response = await axios.get(`${API}/customers/search?q=${customerSearch}`);
      setCustomerResults(response.data);
    } catch (error) {
      console.error('Error searching customers:', error);
    }
  };

  const addToCart = (product) => {
    const existingItem = cartItems.find(item => item.product.id === product.id);
    
    if (existingItem) {
      setCartItems(cartItems.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCartItems([...cartItems, { product, quantity: 1 }]);
    }
    
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeFromCart = (productId) => {
    setCartItems(cartItems.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity < 1) return;
    setCartItems(cartItems.map(item =>
      item.product.id === productId
        ? { ...item, quantity: newQuantity }
        : item
    ));
  };

  const selectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch('');
    setCustomerResults([]);
  };

  const calculateTotals = () => {
    const subtotal = cartItems.reduce((sum, item) => 
      sum + (item.product.sale_price * item.quantity), 0
    );
    const iva = subtotal - (subtotal / 1.19);
    const total = subtotal;

    return {
      subtotal: subtotal / 1.19,
      iva,
      total
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (cartItems.length === 0) {
      toast.error('Debes agregar al menos un producto');
      return;
    }

    if (!customDate || !customTime) {
      toast.error('Debes especificar fecha y hora');
      return;
    }

    setLoading(true);

    try {
      const totals = calculateTotals();
      const dateTimeStr = `${customDate}T${customTime}:00`;

      const saleData = {
        cart_id: uuidv4(),
        items: cartItems.map(item => ({
          product_id: item.product.id,
          product_name: item.product.name,
          quantity: item.quantity,
          unit_price: item.product.sale_price,
          subtotal: item.product.sale_price * item.quantity
        })),
        customer_id: selectedCustomer?.id || null,
        customer_name: selectedCustomer?.name || 'Cliente General',
        payment_method: paymentMethod,
        subtotal: totals.subtotal,
        iva: totals.iva,
        total: totals.total,
        date: customDate,
        created_at: dateTimeStr
      };

      await axios.post(`${API}/sales/cart`, saleData);
      
      toast.success('Venta pasada registrada exitosamente');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error registering past sale:', error);
      toast.error(error.response?.data?.detail || 'Error al registrar venta pasada');
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div 
        className="bg-white border-2 border-slate-900 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black flex items-center gap-2">
            <ShoppingCart className="w-6 h-6" />
            Registrar Venta Pasada
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Fecha y Hora */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-amber-50 border-2 border-slate-900 rounded-lg">
            <div>
              <label className="block text-sm font-bold mb-2">📅 Fecha de la Venta</label>
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">🕐 Hora</label>
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg font-mono"
                required
              />
            </div>
          </div>

          {/* Búsqueda de Productos */}
          <div>
            <label className="block text-sm font-bold mb-2">🔍 Buscar Productos</label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre o SKU..."
                className="w-full px-4 py-3 border-2 border-slate-900 rounded-lg pr-10"
              />
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            </div>

            {/* Resultados de búsqueda */}
            {searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-2 bg-white border-2 border-slate-900 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {searchResults.map(product => (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="p-3 hover:bg-slate-100 cursor-pointer border-b border-slate-200 last:border-b-0"
                  >
                    <div className="font-bold text-sm">{product.name}</div>
                    <div className="text-xs text-slate-600">
                      SKU: {product.sku} • ${Math.round(product.sale_price).toLocaleString('es-CL')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Carrito */}
          <div className="border-2 border-slate-900 rounded-lg p-4 bg-slate-50">
            <h3 className="text-lg font-bold mb-3">🛒 Productos ({cartItems.length})</h3>
            
            {cartItems.length === 0 ? (
              <p className="text-slate-500 text-center py-8">
                No hay productos en el carrito. Busca y agrega productos arriba.
              </p>
            ) : (
              <div className="space-y-2">
                {cartItems.map((item) => (
                  <div 
                    key={item.product.id}
                    className="flex items-center gap-3 p-3 bg-white border-2 border-slate-900 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-bold text-sm">{item.product.name}</div>
                      <div className="text-xs text-slate-600">
                        ${Math.round(item.product.sale_price).toLocaleString('es-CL')} × {item.quantity}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="px-2 py-1 bg-slate-200 border border-slate-900 rounded font-bold"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-bold">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="px-2 py-1 bg-slate-200 border border-slate-900 rounded font-bold"
                      >
                        +
                      </button>
                      <div className="font-mono font-bold ml-2">
                        ${Math.round(item.product.sale_price * item.quantity).toLocaleString('es-CL')}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.product.id)}
                        className="p-1 hover:bg-red-100 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Totales */}
            {cartItems.length > 0 && (
              <div className="mt-4 pt-4 border-t-2 border-slate-900 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal (sin IVA):</span>
                  <span className="font-bold">${Math.round(totals.subtotal).toLocaleString('es-CL')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>IVA (19%):</span>
                  <span className="font-bold">${Math.round(totals.iva).toLocaleString('es-CL')}</span>
                </div>
                <div className="flex justify-between text-lg font-black pt-2 border-t-2 border-slate-900">
                  <span>TOTAL:</span>
                  <span className="font-mono">${Math.round(totals.total).toLocaleString('es-CL')}</span>
                </div>
              </div>
            )}
          </div>

          {/* Cliente */}
          <div>
            <label className="block text-sm font-bold mb-2">👤 Cliente (Opcional)</label>
            {selectedCustomer ? (
              <div className="flex items-center gap-2 p-3 bg-blue-50 border-2 border-blue-900 rounded-lg">
                <span className="flex-1 font-bold">{selectedCustomer.name}</span>
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Buscar cliente... (opcional)"
                  className="w-full px-4 py-3 border-2 border-slate-900 rounded-lg"
                />
                {customerResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-2 bg-white border-2 border-slate-900 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {customerResults.map(customer => (
                      <div
                        key={customer.id}
                        onClick={() => selectCustomer(customer)}
                        className="p-3 hover:bg-slate-100 cursor-pointer border-b border-slate-200 last:border-b-0"
                      >
                        <div className="font-bold text-sm">{customer.name}</div>
                        {customer.email && (
                          <div className="text-xs text-slate-600">{customer.email}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Método de Pago */}
          <div>
            <label className="block text-sm font-bold mb-2">💳 Método de Pago</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-4 py-3 border-2 border-slate-900 rounded-lg"
              required
            >
              <option value="Efectivo">Efectivo</option>
              <option value="Tarjeta">Tarjeta</option>
              <option value="Transferencia">Transferencia</option>
            </select>
          </div>

          {/* Botones */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || cartItems.length === 0}
              className="flex-1 px-6 py-3 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
            >
              {loading ? 'Guardando...' : 'Registrar Venta'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-slate-200 text-slate-900 rounded-lg font-bold hover:bg-slate-300 transition-all"
              style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PastCartSaleForm;
