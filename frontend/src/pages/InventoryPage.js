import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Package, Plus, Edit, Trash2, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import ProductForm from '../components/ProductForm';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const InventoryPage = () => {
  const navigate = useNavigate();
  const { settings } = useSettings();
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
    // Find product name for better feedback
    const product = products.find(p => p.id === productId);
    const productName = product ? product.name : 'este producto';
    
    if (!window.confirm(`¿Estás seguro de eliminar "${productName}"?`)) return;

    try {
      // Add visual feedback - mark row as deleting
      const row = document.querySelector(`[data-testid="product-row-${productId}"]`);
      if (row) {
        row.style.opacity = '0.5';
        row.style.transition = 'opacity 0.3s';
      }

      await axios.delete(`${API}/products/${productId}`);
      
      // Success toast with product name
      toast.success(`✓ "${productName}" eliminado exitosamente`, {
        duration: 4000,
        style: {
          background: '#D4F0A5',
          color: '#0f172a',
          border: '2px solid #0f172a',
          fontWeight: 'bold',
        }
      });
      
      // Fade out animation before removing
      if (row) {
        row.style.opacity = '0';
        setTimeout(() => fetchProducts(), 300);
      } else {
        fetchProducts();
      }
    } catch (error) {
      // Error toast with more details
      toast.error(`✗ No se pudo eliminar "${productName}"`, {
        duration: 4000,
        style: {
          background: '#FFA8A8',
          color: '#0f172a',
          border: '2px solid #0f172a',
          fontWeight: 'bold',
        }
      });
      console.error('Error deleting product:', error);
      
      // Restore row opacity on error
      const row = document.querySelector(`[data-testid="product-row-${productId}"]`);
      if (row) {
        row.style.opacity = '1';
      }
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
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-3 bg-white border-2 border-slate-900 rounded-xl hover:bg-slate-50 transition-all"
            style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
            data-testid="back-to-dashboard-btn"
          >
            <Home className="w-5 h-5" />
          </button>
          <div>
            <h1 
              className="text-3xl sm:text-4xl font-black tracking-tighter text-slate-900"
              style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}
            >
              Gestión de Inventario
            </h1>
            <p className="text-base font-medium text-slate-600">Administra tu catálogo de productos</p>
          </div>
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

      {/* Products Table */}
      {loading ? (
        <p className="text-center text-slate-600 font-medium">Cargando productos...</p>
      ) : products.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-16 h-16 mx-auto text-slate-400 mb-4" />
          <p className="text-slate-600 font-medium">No hay productos registrados</p>
        </div>
      ) : (
        <div 
          className="bg-white border-2 border-slate-900 rounded-xl overflow-hidden"
          style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                    Tienda
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                    Nombre Producto
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider">
                    Precio Venta
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-900">
                {products.map((product, index) => (
                  <tr 
                    key={product.id}
                    className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                    data-testid={`product-row-${product.id}`}
                  >
                    <td className="px-6 py-4">
                      <span 
                        className="px-3 py-1 rounded-full text-xs font-bold uppercase border-2 border-slate-900"
                        style={{ backgroundColor: product.store === 'A' ? '#D4F0A5' : '#FADBB0' }}
                      >
                        {product.store === 'A' ? settings.store_a_name : settings.store_b_name}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      {product.name}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-lg text-slate-900">
                      ${(product.sale_price || 0).toLocaleString('es-CL')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleEdit(product)}
                          className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                          data-testid={`edit-product-${product.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                          data-testid={`delete-product-${product.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
