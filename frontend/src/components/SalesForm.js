import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Search, Plus } from 'lucide-react';
import ProductForm from './ProductForm';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SalesForm = ({ onSuccess }) => {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productSearch, setProductSearch] = useState('');
  const [quantity, setQuantity] = useState('');
  const [total, setTotal] = useState('');
  const [customer, setCustomer] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [hasTax, setHasTax] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  
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
    
    if (!selectedProduct) {
      toast.error('Debes seleccionar un producto del inventario');
      return;
    }
    
    if (!selectedProduct.sale_price || selectedProduct.sale_price === 0) {
      toast.error('El producto seleccionado no tiene precio de venta configurado');
      return;
    }
    
    if (!selectedProduct.cost_price && selectedProduct.cost_price !== 0) {
      toast.error('El producto seleccionado no tiene costo configurado');
      return;
    }
    
    if (!total || parseFloat(total) === 0) {
      toast.error('El total debe ser mayor a 0');
      return;
    }
    
    setLoading(true);

    try {
      await axios.post(`${API}/sales`, {
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        quantity: parseFloat(quantity),
        price: selectedProduct.sale_price,
        total: parseFloat(total),  // User-editable total
        cost_price: selectedProduct.cost_price || 0,
        store: selectedProduct.store || 'A',
        has_tax: hasTax,
        customer: customer || null,
        payment_method: paymentMethod
      });

      toast.success('Venta registrada exitosamente');
      
      // Reset form
      setSelectedProduct(null);
      setProductSearch('');
      setQuantity('');
      setTotal('');
      setCustomer('');
      setPaymentMethod('Efectivo');
      setHasTax(true);
      
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error('Error al registrar venta');
      console.error('Error creating sale:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectProduct = (prod) => {
    setSelectedProduct(prod);
    setProductSearch(prod.name);
    setShowProductSuggestions(false);
    // Calculate initial total when product is selected
    if (quantity && prod.sale_price) {
      setTotal((parseFloat(quantity) * prod.sale_price).toString());
    }
  };

  // Update total when quantity changes
  useEffect(() => {
    if (selectedProduct && selectedProduct.sale_price && quantity) {
      setTotal((parseFloat(quantity) * selectedProduct.sale_price).toString());
    } else {
      setTotal('');
    }
  }, [quantity, selectedProduct]);

  const selectCustomer = (cust) => {
    setCustomer(cust.name);
    setShowCustomerSuggestions(false);
  };

  const handleProductFormClose = async () => {
    setShowProductForm(false);
    // Refresh product search after creating new product
    if (productSearch.length > 1) {
      try {
        const response = await axios.get(`${API}/products/search?q=${productSearch}`);
        setProductSuggestions(response.data);
        setShowProductSuggestions(true);
        
        // Auto-select the newly created product if it matches the search
        if (response.data.length === 1) {
          selectProduct(response.data[0]);
        }
      } catch (error) {
        console.error('Error refreshing products:', error);
      }
    }
  };

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
        {/* Product Search */}
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
              onBlur={() => setTimeout(() => setShowProductSuggestions(false), 200)}
              className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 font-medium text-slate-900 focus:ring-0 focus:outline-none focus:border-indigo-500 transition-all"
              placeholder="Buscar producto..."
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
                  className="w-full text-left px-4 py-3 hover:bg-slate-100 font-medium border-b border-slate-200 last:border-b-0"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold">{prod.name}</p>
                      <p className="text-xs text-slate-500">Tienda {prod.store || 'A'}</p>
                    </div>
                    <span className="font-mono font-bold">
                      ${(prod.sale_price || 0).toLocaleString('es-CL')}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {/* No results - Show create button */}
          {showProductSuggestions && productSuggestions.length === 0 && productSearch.length > 1 && (
            <div className="absolute z-10 w-full mt-2 bg-white border-2 border-slate-900 rounded-xl shadow-lg overflow-hidden">
              <div className="p-4 text-center">
                <p className="text-sm text-slate-600 mb-3">
                  No se encontró &quot;{productSearch}&quot;
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowProductSuggestions(false);
                    setShowProductForm(true);
                  }}
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#D4F0A5] border-2 border-slate-900 rounded-xl font-bold hover:bg-[#c5e196] transition-all"
                  style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
                  data-testid="create-product-from-sales-btn"
                >
                  <Plus className="w-5 h-5" />
                  Crear Producto Nuevo
                </button>
              </div>
            </div>
          )}
          
          {/* Selected Product Info */}
          {selectedProduct && (
            <div className="mt-2 p-3 bg-slate-100 border-2 border-slate-900 rounded-xl">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold uppercase text-slate-500">
                    Tienda {selectedProduct.store || 'A'}
                  </span>
                  <p className="font-mono font-bold">
                    ${(selectedProduct.sale_price || 0).toLocaleString('es-CL')}
                  </p>
                </div>
                <span 
                  className="px-3 py-1 rounded-full text-xs font-bold uppercase border-2 border-slate-900"
                  style={{ backgroundColor: selectedProduct.store === 'A' ? '#D4F0A5' : '#FADBB0' }}
                >
                  {selectedProduct.store || 'A'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Quantity */}
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
            data-testid="sales-quantity-input"
          />
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

        {/* Total Editable with IVA Checkbox */}
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
                data-testid="sales-has-tax-checkbox"
              />
              <label htmlFor="hasTax" className="text-sm font-bold cursor-pointer select-none">
                Incluye IVA
              </label>
            </div>
          </div>
          <input
            type="number"
            step="0.01"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 text-3xl font-black text-slate-900 focus:ring-0 focus:outline-none focus:border-indigo-500 transition-all"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
            placeholder="0"
            required
            data-testid="sales-total-input"
          />
          <p className="text-xs text-slate-500 mt-2">
            {hasTax ? 'Se considera IVA (19%) - Utilidades calculadas' : 'Sin IVA - IVA va a favor'}
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
          onMouseEnter={(e) => {
            if (!loading) e.target.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
          }}
          data-testid="sales-submit-btn"
        >
          {loading ? 'Guardando...' : 'Registrar Venta'}
        </button>
      </form>

      {/* Product Form Modal */}
      {showProductForm && (
        <ProductForm
          product={null}
          onClose={handleProductFormClose}
        />
      )}
    </div>
  );
};

export default SalesForm;
