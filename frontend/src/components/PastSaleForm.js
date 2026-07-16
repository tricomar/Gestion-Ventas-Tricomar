import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStores } from '../hooks/useStores';
import axios from 'axios';
import { X, Search, Plus } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PastSaleForm = ({ onClose, onSuccess, initialDate }) => {
  const { user } = useAuth();
  const { getStoreName } = useStores();
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productSearch, setProductSearch] = useState('');
  const [quantity, setQuantity] = useState('');
  const [total, setTotal] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [hasTax, setHasTax] = useState(true);
  const [customDate, setCustomDate] = useState(initialDate || '');
  const [customTime, setCustomTime] = useState('12:00');
  const [loading, setLoading] = useState(false);
  
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);

  useEffect(() => {
    const searchProducts = async () => {
      if (productSearch.length > 1) {
        try {
          const response = await axios.get(`${API}/products/search?q=${productSearch}`);
          setProductSuggestions(response.data);
          setShowProductSuggestions(true);
        } catch (error) {
          console.error('Error searching products:', error);
          setProductSuggestions([]);
        }
      } else {
        setProductSuggestions([]);
        setShowProductSuggestions(false);
      }
    };

    const timer = setTimeout(searchProducts, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  useEffect(() => {
    const searchCustomers = async () => {
      if (customerSearch.length > 0) {
        try {
          const response = await axios.get(`${API}/customers`);
          const filtered = response.data.filter(c => 
            c.name.toLowerCase().includes(customerSearch.toLowerCase())
          );
          setCustomerSuggestions(filtered);
          setShowCustomerSuggestions(true);
        } catch (error) {
          console.error('Error searching customers:', error);
          setCustomerSuggestions([]);
        }
      } else {
        setCustomerSuggestions([]);
        setShowCustomerSuggestions(false);
      }
    };

    const timer = setTimeout(searchCustomers, 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  // Actualizar total cuando cambia cantidad
  useEffect(() => {
    if (selectedProduct && selectedProduct.sale_price && quantity) {
      setTotal((parseFloat(quantity) * selectedProduct.sale_price).toString());
    } else {
      setTotal('');
    }
  }, [quantity, selectedProduct]);

  const selectProduct = (prod) => {
    setSelectedProduct(prod);
    setProductSearch(prod.name);
    setShowProductSuggestions(false);
    if (quantity && prod.sale_price) {
      setTotal((parseFloat(quantity) * prod.sale_price).toString());
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedProduct) {
      toast.error('Debes seleccionar un producto');
      return;
    }
    
    if (!customDate) {
      toast.error('Debes seleccionar una fecha');
      return;
    }
    
    if (!total || parseFloat(total) === 0) {
      toast.error('El total debe ser mayor a 0');
      return;
    }
    
    setLoading(true);

    try {
      const dateTimeStr = `${customDate}T${customTime}:00`;
      
      await axios.post(`${API}/sales/past`, {
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        quantity: parseFloat(quantity),
        price: selectedProduct.sale_price,
        total: parseFloat(total),
        cost_price: selectedProduct.cost_price || 0,
        store: selectedProduct.store || 'A',
        has_tax: hasTax,
        customer_id: selectedCustomer?.id || null,
        customer_name: selectedCustomer?.name || null,
        payment_method: paymentMethod,
        custom_date: dateTimeStr
      });

      toast.success('Venta pasada registrada exitosamente');
      
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error('No tienes permisos para registrar ventas pasadas');
      } else if (error.response?.data?.detail) {
        toast.error(error.response.data.detail);
      } else {
        toast.error('Error al registrar venta pasada');
      }
      console.error('Error creating past sale:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div 
        className="bg-white border-2 border-slate-900 rounded-xl p-6 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 
            className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900"
            style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}
          >
            Registrar Venta Pasada
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Fecha y Hora */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase text-slate-500 mb-2">
                Fecha *
              </label>
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 font-medium text-slate-900 focus:ring-0 focus:outline-none focus:border-indigo-500 transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase text-slate-500 mb-2">
                Hora
              </label>
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 font-medium text-slate-900 focus:ring-0 focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          {/* Producto */}
          <div className="relative">
            <label className="block text-xs font-bold tracking-widest uppercase text-slate-500 mb-2">
              Producto *
            </label>
            <div className="relative">
              <input
                type="text"
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  if (!e.target.value) setSelectedProduct(null);
                }}
                className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 font-medium text-slate-900 focus:ring-0 focus:outline-none focus:border-indigo-500 transition-all"
                placeholder="Buscar producto..."
                required
              />
              <Search className="absolute right-4 top-3.5 w-5 h-5 text-slate-400" />
            </div>
            {showProductSuggestions && productSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-2 bg-white border-2 border-slate-900 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {productSuggestions.map((prod) => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => selectProduct(prod)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-100 font-medium border-b border-slate-200 last:border-b-0"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-bold">{prod.name}</p>
                        <p className="text-xs text-slate-500">{getStoreName(prod.store || 'A')}</p>
                      </div>
                      <span className="font-mono font-bold">
                        ${(prod.sale_price || 0).toLocaleString('es-CL')}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {selectedProduct && (
              <div className="mt-2 p-3 bg-slate-100 border-2 border-slate-900 rounded-xl">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold uppercase text-slate-500">
                      {getStoreName(selectedProduct.store || 'A')}
                    </span>
                    <p className="font-mono font-bold">
                      ${(selectedProduct.sale_price || 0).toLocaleString('es-CL')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Cantidad */}
          <div>
            <label className="block text-xs font-bold tracking-widest uppercase text-slate-500 mb-2">
              Cantidad *
            </label>
            <input
              type="number"
              step="1"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 font-medium text-slate-900 focus:ring-0 focus:outline-none focus:border-indigo-500 transition-all"
              required
            />
          </div>

          {/* Cliente */}
          <div className="relative">
            <label className="block text-xs font-bold tracking-widest uppercase text-slate-500 mb-2">
              Cliente (opcional)
            </label>
            <div className="relative">
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  if (!e.target.value) setSelectedCustomer(null);
                }}
                className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 font-medium text-slate-900 focus:ring-0 focus:outline-none focus:border-indigo-500 transition-all"
                placeholder="Buscar cliente..."
              />
              <Search className="absolute right-4 top-3.5 w-5 h-5 text-slate-400" />
            </div>
            {showCustomerSuggestions && customerSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-2 bg-white border-2 border-slate-900 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {customerSuggestions.map((cust) => (
                  <button
                    key={cust.id}
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(cust);
                      setCustomerSearch('');
                      setShowCustomerSuggestions(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-slate-100 font-medium border-b border-slate-200 last:border-b-0"
                  >
                    <p className="font-bold">{cust.name}</p>
                  </button>
                ))}
              </div>
            )}
            {selectedCustomer && (
              <div className="mt-2 p-3 bg-slate-100 border-2 border-slate-900 rounded-xl">
                <div className="flex justify-between items-center">
                  <p className="font-bold">{selectedCustomer.name}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setCustomerSearch('');
                    }}
                    className="px-3 py-1 rounded-lg text-xs font-bold uppercase border-2 border-slate-900 bg-red-100 hover:bg-red-200 transition-all"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Método de Pago */}
          <div>
            <label className="block text-xs font-bold tracking-widest uppercase text-slate-500 mb-2">
              Método de Pago *
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 font-medium text-slate-900 cursor-pointer focus:ring-0 focus:outline-none focus:border-indigo-500"
            >
              <option value="Efectivo">Efectivo</option>
              <option value="Tarjeta">Tarjeta</option>
              <option value="Transferencia">Transferencia</option>
            </select>
          </div>

          {/* Total */}
          <div className="bg-slate-100 border-2 border-slate-900 rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs font-bold tracking-widest uppercase text-slate-500">Total (Editable)</p>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hasTax"
                  checked={hasTax}
                  onChange={(e) => setHasTax(e.target.checked)}
                  className="w-5 h-5 border-2 border-slate-900 rounded cursor-pointer"
                />
                <label htmlFor="hasTax" className="text-sm font-bold cursor-pointer select-none">
                  Incluye IVA
                </label>
              </div>
            </div>
            <input
              type="number"
              step="1"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 text-3xl font-black text-slate-900 focus:ring-0 focus:outline-none focus:border-indigo-500 transition-all"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
              placeholder="0"
              required
            />
            <p className="text-xs text-slate-500 mt-2">
              {hasTax ? 'Se considera IVA (19%)' : 'Sin IVA'}
            </p>
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-slate-900 rounded-xl font-bold hover:bg-slate-100 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 text-slate-900 border-2 border-slate-900 rounded-xl px-6 py-3 font-bold transition-all"
              style={{
                backgroundColor: '#D4F0A5',
                boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)'
              }}
            >
              {loading ? 'Guardando...' : 'Registrar Venta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PastSaleForm;
