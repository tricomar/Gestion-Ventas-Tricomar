import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Search } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SalesForm = ({ onSuccess }) => {
  const [product, setProduct] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [customer, setCustomer] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [loading, setLoading] = useState(false);
  
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);

  useEffect(() => {
    const searchProducts = async () => {
      if (product.length > 1) {
        try {
          const response = await axios.get(`${API}/products/search?q=${product}`);
          setProductSuggestions(response.data);
          setShowProductSuggestions(true);
        } catch (error) {
          console.error('Error searching products:', error);
        }
      } else {
        setProductSuggestions([]);
        setShowProductSuggestions(false);
      }
    };

    const timer = setTimeout(searchProducts, 300);
    return () => clearTimeout(timer);
  }, [product]);

  useEffect(() => {
    const searchCustomers = async () => {
      if (customer.length > 1) {
        try {
          const response = await axios.get(`${API}/customers/search?q=${customer}`);
          setCustomerSuggestions(response.data);
          setShowCustomerSuggestions(true);
        } catch (error) {
          console.error('Error searching customers:', error);
        }
      } else {
        setCustomerSuggestions([]);
        setShowCustomerSuggestions(false);
      }
    };

    const timer = setTimeout(searchCustomers, 300);
    return () => clearTimeout(timer);
  }, [customer]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(`${API}/sales`, {
        product,
        quantity: parseFloat(quantity),
        price: parseFloat(price),
        customer: customer || null,
        payment_method: paymentMethod
      });

      toast.success('Venta registrada exitosamente');
      
      // Reset form
      setProduct('');
      setQuantity('');
      setPrice('');
      setCustomer('');
      setPaymentMethod('Efectivo');
      
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error('Error al registrar venta');
      console.error('Error creating sale:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectProduct = (prod) => {
    setProduct(prod.name);
    if (prod.last_price) {
      setPrice(prod.last_price.toString());
    }
    setShowProductSuggestions(false);
  };

  const selectCustomer = (cust) => {
    setCustomer(cust.name);
    setShowCustomerSuggestions(false);
  };

  const total = quantity && price ? (parseFloat(quantity) * parseFloat(price)).toLocaleString('es-CL') : '0';

  return (
    <div 
      className="bg-white border-2 border-slate-900 rounded-xl p-6 md:p-8"
      style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
      data-testid="sales-form"
    >
      <h2 
        className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mb-6"
        style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}
      >
        Registrar Venta
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Product */}
        <div className="relative">
          <label className="block text-xs font-bold tracking-widest uppercase text-slate-500 mb-2">
            Producto *
          </label>
          <div className="relative">
            <input
              type="text"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              onBlur={() => setTimeout(() => setShowProductSuggestions(false), 200)}
              className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 font-medium text-slate-900 focus:ring-0 focus:outline-none focus:border-indigo-500 transition-all"
              required
              data-testid="sales-product-input"
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
                  className="w-full text-left px-4 py-2 hover:bg-slate-100 font-medium"
                >
                  {prod.name} {prod.last_price && `- $${prod.last_price}`}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quantity & Price */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold tracking-widest uppercase text-slate-500 mb-2">
              Cantidad *
            </label>
            <input
              type="number"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 font-medium text-slate-900 focus:ring-0 focus:outline-none focus:border-indigo-500 transition-all"
              required
              data-testid="sales-quantity-input"
            />
          </div>
          <div>
            <label className="block text-xs font-bold tracking-widest uppercase text-slate-500 mb-2">
              Precio *
            </label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 font-medium text-slate-900 focus:ring-0 focus:outline-none focus:border-indigo-500 transition-all"
              required
              data-testid="sales-price-input"
            />
          </div>
        </div>

        {/* Customer */}
        <div className="relative">
          <label className="block text-xs font-bold tracking-widest uppercase text-slate-500 mb-2">
            Cliente (opcional)
          </label>
          <div className="relative">
            <input
              type="text"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 200)}
              className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 font-medium text-slate-900 focus:ring-0 focus:outline-none focus:border-indigo-500 transition-all"
              data-testid="sales-customer-input"
            />
            <Search className="absolute right-4 top-3.5 w-5 h-5 text-slate-400" />
          </div>
          {showCustomerSuggestions && customerSuggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-2 bg-white border-2 border-slate-900 rounded-xl shadow-lg max-h-48 overflow-y-auto">
              {customerSuggestions.map((cust) => (
                <button
                  key={cust.id}
                  type="button"
                  onClick={() => selectCustomer(cust)}
                  className="w-full text-left px-4 py-2 hover:bg-slate-100 font-medium"
                >
                  {cust.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-xs font-bold tracking-widest uppercase text-slate-500 mb-2">
            Método de Pago *
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 font-medium text-slate-900 cursor-pointer focus:ring-0 focus:outline-none focus:border-indigo-500"
            data-testid="sales-payment-method-select"
          >
            <option value="Efectivo">Efectivo</option>
            <option value="Tarjeta">Tarjeta</option>
            <option value="Transferencia">Transferencia</option>
          </select>
        </div>

        {/* Total Display */}
        <div className="bg-slate-100 border-2 border-slate-900 rounded-xl p-4">
          <p className="text-xs font-bold tracking-widest uppercase text-slate-500 mb-1">Total</p>
          <p 
            className="text-3xl font-black text-slate-900"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
            data-testid="sales-total-display"
          >
            ${total}
          </p>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full text-slate-900 border-2 border-slate-900 rounded-xl px-6 py-4 font-bold transition-all"
          style={{
            backgroundColor: '#D4F0A5',
            boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)'
          }}
          onMouseEnter={(e) => !loading && (e.target.style.transform = 'translateY(-2px)')}
          onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
          data-testid="sales-submit-btn"
        >
          {loading ? 'Guardando...' : 'Registrar Venta'}
        </button>
      </form>
    </div>
  );
};

export default SalesForm;
