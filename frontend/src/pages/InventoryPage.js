import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Package, Plus, Edit, Trash2 } from 'lucide-react';
import ProductForm from '../components/ProductForm';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const InventoryPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API}/products`);
      setProducts(response.data);
    } catch (error) {
      toast.error('Error al cargar productos');
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('¿Estás seguro de eliminar este producto?')) return;

    try {
      await axios.delete(`${API}/products/${productId}`);
      toast.success('Producto eliminado');
      fetchProducts();
    } catch (error) {
      toast.error('Error al eliminar producto');
      console.error('Error deleting product:', error);
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingProduct(null);
    fetchProducts();
  };

  return (
    <div className="p-6 md:p-8" style={{ backgroundColor: '#F4F4F0', minHeight: '100vh' }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 
            className="text-3xl sm:text-4xl font-black tracking-tighter text-slate-900"
            style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}
          >
            Gestión de Inventario
          </h1>
          <p className="text-base font-medium text-slate-600">Administra tu catálogo de productos</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-slate-900 border-2 border-slate-900 rounded-xl px-6 py-3 font-bold transition-all"
          style={{
            backgroundColor: '#D4F0A5',
            boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)'
          }}
          onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
          onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
          data-testid="add-product-btn"
        >
          <Plus className="w-5 h-5" />
          Nuevo Producto
        </button>
      </div>

      {/* Products Grid */}
      {loading ? (
        <p className="text-center text-slate-600 font-medium">Cargando productos...</p>
      ) : products.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-16 h-16 mx-auto text-slate-400 mb-4" />
          <p className="text-slate-600 font-medium">No hay productos registrados</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => {
            const taxAmount = product.sale_price - (product.sale_price / 1.19);
            const profit = (product.sale_price / 1.19) - product.cost_price;
            
            return (
              <div
                key={product.id}
                className="bg-white border-2 border-slate-900 rounded-xl p-6"
                style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
                data-testid={`product-card-${product.id}`}
              >
                {/* Store Badge */}
                <div className="flex justify-between items-start mb-4">
                  <span 
                    className="px-3 py-1 rounded-full text-xs font-bold uppercase border-2 border-slate-900"
                    style={{ backgroundColor: product.store === 'A' ? '#D4F0A5' : '#FADBB0' }}
                  >
                    Tienda {product.store}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(product)}
                      className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                      data-testid={`edit-product-${product.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                      data-testid={`delete-product-${product.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Product Name */}
                <h3 className="text-xl font-bold text-slate-900 mb-4">{product.name}</h3>

                {/* Prices */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-slate-600">Costo:</span>
                    <span className="font-mono font-bold">${product.cost_price.toLocaleString('es-CL')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-slate-600">Venta:</span>
                    <span className="font-mono font-bold text-lg">${product.sale_price.toLocaleString('es-CL')}</span>
                  </div>
                </div>

                {/* Calculations */}
                <div className="border-t-2 border-slate-900 pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs font-bold uppercase text-slate-500">Utilidad:</span>
                    <span className="font-mono font-bold text-green-600">${profit.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-bold uppercase text-slate-500">IVA (19%):</span>
                    <span className="font-mono font-bold text-slate-600">${taxAmount.toFixed(0)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Product Form Modal */}
      {showForm && (
        <ProductForm
          product={editingProduct}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
};

export default InventoryPage;
