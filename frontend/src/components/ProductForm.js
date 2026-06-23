import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ProductForm = ({ product, onClose }) => {
  const [name, setName] = useState('');
  const [store, setStore] = useState('A');
  const [costPrice, setCostPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setStore(product.store);
      setCostPrice(product.cost_price.toString());
      setSalePrice(product.sale_price.toString());
    }
  }, [product]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        name,
        store,
        cost_price: parseFloat(costPrice),
        sale_price: parseFloat(salePrice)
      };

      if (product) {
        await axios.put(`${API}/products/${product.id}`, data);
        toast.success('Producto actualizado');
      } else {
        await axios.post(`${API}/products`, data);
        toast.success('Producto creado');
      }

      onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al guardar producto');
      console.error('Error saving product:', error);
    } finally {
      setLoading(false);
    }
  };

  const taxAmount = salePrice ? parseFloat(salePrice) - (parseFloat(salePrice) / 1.19) : 0;
  const profit = costPrice && salePrice ? (parseFloat(salePrice) / 1.19) - parseFloat(costPrice) : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div 
        className="bg-white border-2 border-slate-900 rounded-xl p-6 md:p-8 w-full max-w-2xl"
        style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
        data-testid="product-form-modal"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 
            className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900"
            style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}
          >
            {product ? 'Editar Producto' : 'Nuevo Producto'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            data-testid="close-product-form"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-bold tracking-widest uppercase text-slate-500 mb-2">
              Nombre del Producto *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 font-medium text-slate-900 focus:ring-0 focus:outline-none focus:border-indigo-500 transition-all"
              required
              data-testid="product-name-input"
            />
          </div>

          {/* Store */}
          <div>
            <label className="block text-xs font-bold tracking-widest uppercase text-slate-500 mb-2">
              Tienda *
            </label>
            <select
              value={store}
              onChange={(e) => setStore(e.target.value)}
              className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 font-medium text-slate-900 cursor-pointer focus:ring-0 focus:outline-none focus:border-indigo-500"
              data-testid="product-store-select"
            >
              <option value="A">Tienda A</option>
              <option value="B">Tienda B</option>
            </select>
          </div>

          {/* Prices Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase text-slate-500 mb-2">
                Precio Costo *
              </label>
              <input
                type="number"
                step="0.01"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 font-medium text-slate-900 focus:ring-0 focus:outline-none focus:border-indigo-500 transition-all"
                required
                data-testid="product-cost-input"
              />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase text-slate-500 mb-2">
                Precio Venta *
              </label>
              <input
                type="number"
                step="0.01"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 font-medium text-slate-900 focus:ring-0 focus:outline-none focus:border-indigo-500 transition-all"
                required
                data-testid="product-sale-price-input"
              />
            </div>
          </div>

          {/* Calculations Preview */}
          {costPrice && salePrice && (
            <div 
              className="bg-slate-100 border-2 border-slate-900 rounded-xl p-4"
              data-testid="product-calculations"
            >
              <p className="text-xs font-bold tracking-widest uppercase text-slate-500 mb-3">Cálculos Automáticos</p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-slate-600">Utilidad (sin IVA):</span>
                  <span className="font-mono font-bold text-green-600">${profit.toFixed(0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-slate-600">IVA (19%):</span>
                  <span className="font-mono font-bold text-slate-600">${taxAmount.toFixed(0)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-white text-slate-900 border-2 border-slate-900 rounded-xl px-6 py-3 font-bold transition-all"
              style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
              onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
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
              onMouseEnter={(e) => !loading && (e.target.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
              data-testid="product-submit-btn"
            >
              {loading ? 'Guardando...' : (product ? 'Actualizar' : 'Crear Producto')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductForm;
