import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Package, Plus, Edit, Trash2, Home, Download, Search, Filter, Calculator, ChevronUp, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { useStores } from '../hooks/useStores';
import { useData } from '../context/DataContext';
import ProductForm from '../components/ProductForm';
import PriceCalculatorModal from '../components/PriceCalculatorModal';
import BulkDeleteConfirmModal from '../components/BulkDeleteConfirmModal';
import * as XLSX from 'xlsx';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const InventoryPage = () => {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { stores, getStoreName } = useStores();
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showPriceCalculator, setShowPriceCalculator] = useState(false);
  const [hasActiveEcommerce, setHasActiveEcommerce] = useState(false);
  const [togglingProduct, setTogglingProduct] = useState(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStore, setSelectedStore] = useState('all');
  const [expiryDateFilter, setExpiryDateFilter] = useState('all'); // all, expired, expiring_soon, expiring_month, valid
  const [customExpiryStart, setCustomExpiryStart] = useState('');
  const [customExpiryEnd, setCustomExpiryEnd] = useState('');
  
  // Sorting
  const [sortBy, setSortBy] = useState(null); // 'name', 'price', 'brand', 'expiry_date', 'stock'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc', 'desc'
  
  // Multi-select for bulk delete
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(30);
  
  // Available categories (from settings + unique from products)
  const [availableCategories, setAvailableCategories] = useState([]);
  const [allCategories, setAllCategories] = useState([]); // Todas las categorías de DB

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    checkEcommerceIntegrations();
  }, []);
  
  useEffect(() => {
    filterProducts();
  }, [products, searchQuery, selectedCategory, selectedStore, sortBy, sortOrder, expiryDateFilter, customExpiryStart, customExpiryEnd]);

  useEffect(() => {
    // Filtrar categorías según la tienda seleccionada
    filterCategoriesByStore();
  }, [selectedStore, allCategories, products]);

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API}/categories`);
      setAllCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const filterCategoriesByStore = () => {
    let categoriesToShow = [];
    
    if (selectedStore === 'all') {
      // Mostrar todas las categorías de la DB + las de productos
      const dbCategories = allCategories.map(c => c.name);
      const productCategories = [...new Set(products.map(p => p.category).filter(Boolean))];
      categoriesToShow = [...new Set([...dbCategories, ...productCategories])];
    } else {
      // Filtrar categorías solo de la tienda seleccionada
      const selectedStoreObj = stores.find(s => s.id === selectedStore);
      const storeName = selectedStoreObj?.name;
      const storeKey = selectedStoreObj?.key;
      
      if (storeName && storeKey) {
        const dbCategoriesForStore = allCategories
          .filter(c => c.store === storeName)
          .map(c => c.name);
        const productCategoriesForStore = [
          ...new Set(
            products
              .filter(p => p.store === storeKey && p.category)
              .map(p => p.category)
          )
        ];
        categoriesToShow = [...new Set([...dbCategoriesForStore, ...productCategoriesForStore])];
      }
    }
    
    setAvailableCategories(categoriesToShow.sort());
    
    // Si la categoría seleccionada no está disponible en la nueva tienda, resetear
    if (selectedCategory !== 'all' && !categoriesToShow.includes(selectedCategory)) {
      setSelectedCategory('all');
    }
  };

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


  const checkEcommerceIntegrations = async () => {
    try {
      const response = await axios.get(`${API}/integrations/prestashop/list`);
      const activeIntegrations = response.data.filter(i => i.is_active);
      setHasActiveEcommerce(activeIntegrations.length > 0);
    } catch (error) {
      console.error('Error checking integrations:', error);
      setHasActiveEcommerce(false);
    }
  };

  const handleToggleEcommercePublication = async (productId, currentState) => {
    try {
      setTogglingProduct(productId);
      const newState = !currentState;
      
      await axios.patch(`${API}/products/${productId}/ecommerce-publication?active=${newState}`);
      
      // Actualizar el producto local
      setProducts(prev => prev.map(p => 
        p.id === productId 
          ? { ...p, ecommerce_active: newState }
          : p
      ));
      
      toast.success(`Producto ${newState ? 'activado' : 'desactivado'} en ecommerce`);
    } catch (error) {
      console.error('Error toggling publication:', error);
      toast.error(error.response?.data?.detail || 'Error al actualizar publicación');
    } finally {
      setTogglingProduct(null);
    }
  };

  
  const filterProducts = useCallback(() => {
    let filtered = [...products];
    
    // Filter by search query (name or SKU)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(product => 
        product.name.toLowerCase().includes(query) ||
        (product.sku && product.sku.toLowerCase().includes(query))
      );
    }
    
    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }
    
    // Filter by store - Comparar usando el código de tienda (key)
    if (selectedStore !== 'all') {
      const selectedStoreObj = stores.find(s => s.id === selectedStore);
      const storeKey = selectedStoreObj?.key; // Obtener el código (PS, GS, etc.)
      if (storeKey) {
        filtered = filtered.filter(product => product.store === storeKey);
      }
    }
    
    // Filter by expiry date
    if (expiryDateFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      filtered = filtered.filter(product => {
        if (!product.expiry_date) return false;
        
        const expiryDate = new Date(product.expiry_date);
        expiryDate.setHours(0, 0, 0, 0);
        
        switch (expiryDateFilter) {
          case 'expired':
            return expiryDate < today;
          case 'expiring_soon': // Próximos 7 días
            const sevenDaysFromNow = new Date(today);
            sevenDaysFromNow.setDate(today.getDate() + 7);
            return expiryDate >= today && expiryDate <= sevenDaysFromNow;
          case 'expiring_month': // Próximos 30 días
            const thirtyDaysFromNow = new Date(today);
            thirtyDaysFromNow.setDate(today.getDate() + 30);
            return expiryDate >= today && expiryDate <= thirtyDaysFromNow;
          case 'valid': // Vigentes (no vencidos)
            return expiryDate >= today;
          case 'custom': // Rango personalizado
            if (customExpiryStart && customExpiryEnd) {
              const startDate = new Date(customExpiryStart);
              const endDate = new Date(customExpiryEnd);
              startDate.setHours(0, 0, 0, 0);
              endDate.setHours(23, 59, 59, 999);
              return expiryDate >= startDate && expiryDate <= endDate;
            }
            return true;
          default:
            return true;
        }
      });
    }
    
    // Apply sorting
    if (sortBy === 'name') {
      filtered.sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        return sortOrder === 'asc' 
          ? nameA.localeCompare(nameB) 
          : nameB.localeCompare(nameA);
      });
    } else if (sortBy === 'price') {
      filtered.sort((a, b) => {
        const priceA = a.sale_price || 0;
        const priceB = b.sale_price || 0;
        return sortOrder === 'asc' 
          ? priceA - priceB 
          : priceB - priceA;
      });
    } else if (sortBy === 'brand') {
      filtered.sort((a, b) => {
        const brandA = (a.brand || '').toLowerCase();
        const brandB = (b.brand || '').toLowerCase();
        // Poner productos sin marca al final
        if (!brandA && !brandB) return 0;
        if (!brandA) return 1;
        if (!brandB) return -1;
        return sortOrder === 'asc' 
          ? brandA.localeCompare(brandB) 
          : brandB.localeCompare(brandA);
      });
    } else if (sortBy === 'expiry_date') {
      filtered.sort((a, b) => {
        const dateA = a.expiry_date ? new Date(a.expiry_date).getTime() : null;
        const dateB = b.expiry_date ? new Date(b.expiry_date).getTime() : null;
        
        // Poner productos sin fecha al final
        if (dateA === null && dateB === null) return 0;
        if (dateA === null) return 1;
        if (dateB === null) return -1;
        
        return sortOrder === 'asc' 
          ? dateA - dateB 
          : dateB - dateA;
      });
    } else if (sortBy === 'stock') {
      filtered.sort((a, b) => {
        const stockA = a.stock !== undefined && a.stock !== null ? a.stock : 0;
        const stockB = b.stock !== undefined && b.stock !== null ? b.stock : 0;
        
        return sortOrder === 'asc' 
          ? stockA - stockB 
          : stockB - stockA;
      });
    }
    
    setFilteredProducts(filtered);
  }, [products, searchQuery, selectedCategory, selectedStore, expiryDateFilter, customExpiryStart, customExpiryEnd, sortBy, sortOrder, stores]);

  useEffect(() => {
    filterProducts();
  }, [filterProducts]);

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

  const handleExportToExcel = () => {
    if (products.length === 0) {
      toast.error('No hay productos para exportar');
      return;
    }

    // Preparar datos para Excel
    const excelData = products.map(product => ({
      'Tienda/Caja': getStoreName(product.store),
      'Código Tienda/Caja': product.store,
      'Nombre Producto': product.name,
      'Marca': product.brand || '',
      'SKU': product.sku || '',
      'Categoría': product.category || '',
      'Precio Costo': product.cost_price,
      'Precio Venta': product.sale_price,
      'IVA (19%)': product.sale_price ? (product.sale_price - (product.sale_price / 1.19)).toFixed(0) : 0,
      'Ganancia': product.sale_price ? ((product.sale_price / 1.19) - product.cost_price).toFixed(0) : 0,
      'Fecha Creación': new Date(product.created_at).toLocaleDateString('es-CL'),
    }));

    // Crear workbook y worksheet
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario');

    // Ajustar ancho de columnas
    const colWidths = [
      { wch: 15 }, // Tienda/Caja
      { wch: 12 }, // Código Tienda/Caja
      { wch: 30 }, // Nombre Producto
      { wch: 15 }, // Marca
      { wch: 15 }, // SKU
      { wch: 15 }, // Categoría
      { wch: 12 }, // Precio Costo
      { wch: 12 }, // Precio Venta
      { wch: 12 }, // IVA
      { wch: 12 }, // Ganancia
      { wch: 15 }, // Fecha Creación
    ];
    ws['!cols'] = colWidths;

    // Generar archivo Excel
    const fileName = `inventario_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast.success(`✓ Inventario exportado: ${fileName}`, {
      duration: 4000,
      style: {
        background: '#D4F0A5',
        color: '#0f172a',
        border: '2px solid #0f172a',
        fontWeight: 'bold',
      }
    });
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

  const handleCalculatorClose = () => {
    setShowPriceCalculator(false);
  };

  const handleProductUpdated = () => {
    fetchProducts(); // Refrescar lista de productos después de aplicar precio
  };

  // Multi-select handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = filteredProducts.map(p => p.id);
      setSelectedProducts(allIds);
      // NO abrir modal automáticamente, solo mostrar barra
    } else {
      setSelectedProducts([]);
    }
  };

  const handleSelectProduct = (productId) => {
    setSelectedProducts(prev => {
      const newSelection = prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId];
      
      // NO abrir modal automáticamente
      return newSelection;
    });
  };

  const handleOpenDeleteModal = () => {
    // Modal solo se abre cuando el usuario hace click en "Eliminar"
    setShowDeleteModal(true);
  };

  const handleBulkDelete = async () => {
    if (selectedProducts.length === 0) return;

    setIsDeleting(true);
    
    try {
      // Eliminar productos en paralelo
      await Promise.all(
        selectedProducts.map(productId => 
          axios.delete(`${API}/products/${productId}`)
        )
      );
      
      toast.success(`✓ ${selectedProducts.length} producto${selectedProducts.length > 1 ? 's eliminados' : ' eliminado'} exitosamente`, {
        duration: 4000,
        style: {
          background: '#D4F0A5',
          color: '#0f172a',
          border: '2px solid #0f172a',
          fontWeight: 'bold',
        }
      });
      
      setSelectedProducts([]);
      setShowDeleteModal(false);
      fetchProducts();
    } catch (error) {
      toast.error('Error al eliminar productos');
      console.error('Error deleting products:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
  };

  const handleCloseSelectionBar = () => {
    setSelectedProducts([]);
    setShowDeleteModal(false);
  };



  const handleSort = (field) => {
    if (sortBy === field) {
      // Ya estamos ordenando por este campo, alternar dirección
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Nuevo campo, empezar con orden ascendente
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleExportSelected = () => {
    if (selectedProducts.length === 0) return;
    
    // Filtrar solo productos seleccionados
    const selectedProductsData = products.filter(p => selectedProducts.includes(p.id));
    
    const dataToExport = selectedProductsData.map(p => ({
      'Tienda/Caja': getStoreName(p.store),
      'Nombre': p.name,
      'Marca': p.brand || '',
      'SKU': p.sku || '',
      'Categoría': p.category || '',
      'Costo': p.cost_price || 0,
      'Precio Venta': p.sale_price || 0,
      'Stock': p.stock || 0,
      'Stock Mínimo': p.min_stock || 0
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos Seleccionados');
    XLSX.writeFile(wb, `productos_seleccionados_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast.success(`✓ ${selectedProducts.length} productos exportados`, {
      duration: 3000,
      style: {
        background: '#D4F0A5',
        color: '#0f172a',
        border: '2px solid #0f172a',
        fontWeight: 'bold',
      }
    });
  };

  return (
    <div className="p-6 md:p-8" style={{ backgroundColor: '#F4F4F0', minHeight: '100vh' }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
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
        <div className="flex gap-3">
          <button
            onClick={() => setShowPriceCalculator(true)}
            className="flex items-center gap-2 text-slate-900 border-2 border-slate-900 rounded-xl px-6 py-3 font-bold transition-all hover:bg-purple-100"
            style={{
              backgroundColor: '#E9D5FF',
              boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)'
            }}
            data-testid="price-calculator-btn"
          >
            <Calculator className="w-5 h-5" />
            <span className="hidden sm:inline">Calculadora</span>
          </button>
<button
            onClick={handleExportToExcel}
            className="flex items-center gap-2 text-slate-900 border-2 border-slate-900 rounded-xl px-6 py-3 font-bold transition-all hover:bg-slate-50"
            style={{
              backgroundColor: '#FADBB0',
              boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)'
            }}
            data-testid="export-inventory-btn"
          >
            <Download className="w-5 h-5" />
            <span className="hidden sm:inline">Exportar Excel</span>
          </button>
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
            <span className="hidden sm:inline">Nuevo Producto</span>
          </button>
        </div>
      </div>

      {/* Selection Action Bar - Appears from top when products are selected */}
      {selectedProducts.length > 0 && (
        <div 
          className="fixed top-0 left-0 right-0 z-40 bg-slate-900 border-b-4 border-slate-900 shadow-2xl"
          style={{ 
            animation: 'slideDown 0.3s ease-out',
            boxShadow: '0 8px 16px rgba(0,0,0,0.3)'
          }}
        >
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            {/* Left: Counter */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-xl bg-blue-400 border-2 border-white flex items-center justify-center font-black text-xl"
                  style={{ boxShadow: '2px 2px 0px 0px rgba(255,255,255,0.5)' }}
                >
                  {selectedProducts.length}
                </div>
                <div>
                  <p className="text-white font-black text-lg">
                    {selectedProducts.length} producto{selectedProducts.length > 1 ? 's' : ''} seleccionado{selectedProducts.length > 1 ? 's' : ''}
                  </p>
                  <p className="text-slate-300 text-sm font-medium">
                    Elige una acción para continuar
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleCloseSelectionBar}
                className="px-6 py-3 bg-white border-2 border-white rounded-xl font-bold text-slate-900 hover:bg-slate-100 transition-all"
                style={{ boxShadow: '4px 4px 0px 0px rgba(255,255,255,0.3)' }}
              >
                Cerrar
              </button>
              <button
                onClick={handleExportSelected}
                className="flex items-center gap-2 px-6 py-3 bg-blue-400 border-2 border-white rounded-xl font-bold text-slate-900 hover:bg-blue-500 transition-all"
                style={{ boxShadow: '4px 4px 0px 0px rgba(255,255,255,0.3)' }}
              >
                <Download className="w-5 h-5" />
                Exportar ({selectedProducts.length})
              </button>
              <button
                onClick={handleOpenDeleteModal}
                className="flex items-center gap-2 px-6 py-3 bg-red-500 border-2 border-white rounded-xl font-bold text-white hover:bg-red-600 transition-all"
                style={{ boxShadow: '4px 4px 0px 0px rgba(255,255,255,0.3)' }}
              >
                <Trash2 className="w-5 h-5" />
                Eliminar ({selectedProducts.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal - Only appears when clicking "Eliminar" button */}
      {showDeleteModal && (
        <BulkDeleteConfirmModal
          selectedCount={selectedProducts.length}
          onConfirm={handleBulkDelete}
          onCancel={handleCancelDelete}
          isDeleting={isDeleting}
        />
      )}

      <style>{`
        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>

      {/* Search and Filter Bar */}
      <div className="mb-6 space-y-4">
        {/* Filter by Store - Alone on top */}
        <div className="w-full md:w-1/3">
          <div className="relative">
            <Package className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-900 rounded-xl font-medium text-slate-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-900"
              data-testid="filter-store-select"
            >
              <option value="all">Todas las tiendas</option>
              {stores && stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search and Category Filter - Side by side */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search by Name or SKU */}
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre o SKU..."
                className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-900 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                data-testid="search-products-input"
              />
            </div>
          </div>
          
          {/* Filter by Category */}
          <div>
            <div className="relative">
              <Filter className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-900 rounded-xl font-medium text-slate-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-900"
                data-testid="filter-category-select"
              >
                <option value="all">Todas las categorías</option>
                {availableCategories.map((cat, idx) => (
                  <option key={idx} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Filter by Expiry Date */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <select
              value={expiryDateFilter}
              onChange={(e) => setExpiryDateFilter(e.target.value)}
              className="w-full px-4 py-3 bg-white border-2 border-slate-900 rounded-xl font-medium text-slate-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="all">📅 Todas las fechas</option>
              <option value="expired">🔴 Vencidos</option>
              <option value="expiring_soon">🟡 Por vencer (7 días)</option>
              <option value="expiring_month">🟠 Por vencer (30 días)</option>
              <option value="valid">🟢 Vigentes</option>
              <option value="custom">🔵 Rango personalizado</option>
            </select>
          </div>
          
          {expiryDateFilter === 'custom' && (
            <>
              <div>
                <input
                  type="date"
                  value={customExpiryStart}
                  onChange={(e) => setCustomExpiryStart(e.target.value)}
                  className="w-full px-4 py-3 bg-white border-2 border-slate-900 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="Fecha inicio"
                />
              </div>
              <div>
                <input
                  type="date"
                  value={customExpiryEnd}
                  onChange={(e) => setCustomExpiryEnd(e.target.value)}
                  className="w-full px-4 py-3 bg-white border-2 border-slate-900 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="Fecha fin"
                />
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Results count and Pagination controls */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-600">
            Mostrando <strong>{Math.min((currentPage - 1) * itemsPerPage + 1, filteredProducts.length)}</strong> - <strong>{Math.min(currentPage * itemsPerPage, filteredProducts.length)}</strong> de <strong>{filteredProducts.length}</strong> productos
            {searchQuery && ` con "${searchQuery}"`}
            {selectedCategory !== 'all' && ` en categoría "${selectedCategory}"`}
          </p>
        </div>
        
        {/* Items per page selector */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600 font-medium">Mostrar:</span>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1); // Reset to first page
            }}
            className="px-3 py-2 bg-white border-2 border-slate-900 rounded-lg font-medium text-slate-900 cursor-pointer"
          >
            <option value={30}>30</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="text-sm text-slate-600 font-medium">por página</span>
        </div>
      </div>

      {/* Products Table */}
      {loading ? (
        <p className="text-center text-slate-600 font-medium">Cargando productos...</p>
      ) : products.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-16 h-16 mx-auto text-slate-400 mb-4" />
          <p className="text-slate-600 font-medium">No hay productos registrados</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-16 h-16 mx-auto text-slate-400 mb-4" />
          <p className="text-slate-600 font-medium">No se encontraron productos con los filtros seleccionados</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}
            className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all"
          >
            Limpiar filtros
          </button>
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
                  <th className="px-4 py-4 text-center" style={{ width: '50px' }}>
                    <input
                      type="checkbox"
                      checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                      onChange={handleSelectAll}
                      className="w-5 h-5 rounded border-2 border-white cursor-pointer"
                      title="Seleccionar todos"
                    />
                  </th>
                  <th className="px-4 py-4 text-center text-xs font-bold uppercase tracking-wider" style={{ width: '80px' }}>
                    Imagen
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                    Tienda/Caja
                  </th>
                  <th 
                    className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-800 transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-2">
                      Nombre Producto
                      {sortBy === 'name' && (
                        sortOrder === 'asc' ? 
                          <ChevronUp className="w-4 h-4" /> : 
                          <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-800 transition-colors"
                    onClick={() => handleSort('brand')}
                  >
                    <div className="flex items-center gap-2">
                      Marca
                      {sortBy === 'brand' && (
                        sortOrder === 'asc' ? 
                          <ChevronUp className="w-4 h-4" /> : 
                          <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                    Categoría
                  </th>
                  <th 
                    className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-800 transition-colors"
                    onClick={() => handleSort('expiry_date')}
                  >
                    <div className="flex items-center gap-2">
                      Fecha Vencimiento
                      {sortBy === 'expiry_date' && (
                        sortOrder === 'asc' ? 
                          <ChevronUp className="w-4 h-4" /> : 
                          <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-800 transition-colors"
                    onClick={() => handleSort('stock')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      Stock Disponible
                      {sortBy === 'stock' && (
                        sortOrder === 'asc' ? 
                          <ChevronUp className="w-4 h-4" /> : 
                          <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </th>
                  {hasActiveEcommerce && (
                    <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider">
                      Publicado Ecommerce
                    </th>
                  )}
                  <th 
                    className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-800 transition-colors"
                    onClick={() => handleSort('price')}
                  >
                    <div className="flex items-center justify-end gap-2">
                      Precio Venta
                      {sortBy === 'price' && (
                        sortOrder === 'asc' ? 
                          <ChevronUp className="w-4 h-4" /> : 
                          <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-900">
                {(() => {
                  // Calculate pagination
                  const startIndex = (currentPage - 1) * itemsPerPage;
                  const endIndex = startIndex + itemsPerPage;
                  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);
                  
                  return paginatedProducts.map((product, index) => (
                    <tr 
                      key={product.id}
                      className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                      data-testid={`product-row-${product.id}`}
                    >
                    <td className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product.id)}
                        onChange={() => handleSelectProduct(product.id)}
                        className="w-5 h-5 rounded border-2 border-slate-900 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-4 text-center">
                      {product.image_url ? (
                        <img 
                          src={product.image_url} 
                          alt={product.name}
                          className="w-12 h-12 object-cover rounded border-2 border-slate-900 mx-auto"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-12 h-12 bg-slate-200 rounded border-2 border-slate-900 flex items-center justify-center text-xs text-slate-400 mx-auto">
                          Sin img
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span 
                        className="px-3 py-1 rounded-full text-xs font-bold uppercase border-2 border-slate-900"
                        style={{ backgroundColor: product.store === 'A' ? '#D4F0A5' : '#FADBB0' }}
                      >
                        {getStoreName(product.store)}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      {product.name}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-600 font-medium">
                        {product.brand || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-mono text-sm">
                      {product.sku || '-'}
                    </td>
                    <td className="px-6 py-4">
                      {product.category ? (
                        <span className="px-2 py-1 bg-slate-100 border border-slate-900 rounded text-xs font-medium">
                          {product.category}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {product.expiry_date ? (
                        (() => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const expiryDate = new Date(product.expiry_date);
                          expiryDate.setHours(0, 0, 0, 0);
                          const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
                          
                          let badgeColor = 'bg-green-200 border-green-600 text-green-900';
                          let emoji = '🟢';
                          
                          if (daysUntilExpiry < 0) {
                            badgeColor = 'bg-red-200 border-red-600 text-red-900';
                            emoji = '🔴';
                          } else if (daysUntilExpiry <= 7) {
                            badgeColor = 'bg-yellow-200 border-yellow-600 text-yellow-900';
                            emoji = '🟡';
                          } else if (daysUntilExpiry <= 30) {
                            badgeColor = 'bg-orange-200 border-orange-600 text-orange-900';
                            emoji = '🟠';
                          }
                          
                          return (
                            <div className="flex flex-col gap-1">
                              <span className={`px-2 py-1 border-2 border-slate-900 rounded text-xs font-bold ${badgeColor}`}>
                                {emoji} {new Date(product.expiry_date).toLocaleDateString('es-CL')}
                              </span>
                              {daysUntilExpiry < 0 && (
                                <span className="text-xs text-red-600 font-bold">
                                  Vencido hace {Math.abs(daysUntilExpiry)} días
                                </span>
                              )}
                              {daysUntilExpiry >= 0 && daysUntilExpiry <= 30 && (
                                <span className="text-xs text-slate-600 font-medium">
                                  {daysUntilExpiry === 0 ? 'Vence hoy' : `${daysUntilExpiry} días`}
                                </span>
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-lg text-sm font-bold border-2 border-slate-900 ${
                        (product.stock || 0) <= 0 
                          ? 'bg-red-200 text-red-900' 
                          : (product.stock || 0) <= (product.min_stock || 5)
                          ? 'bg-yellow-200 text-yellow-900'
                          : 'bg-green-200 text-green-900'
                      }`}>
                        {product.stock || 0}
                      </span>
                    </td>
                    {hasActiveEcommerce && (
                      <td className="px-6 py-4 text-center">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={product.ecommerce_active || false}
                            disabled={togglingProduct === product.id}
                            onChange={() => handleToggleEcommercePublication(product.id, product.ecommerce_active)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 border-2 border-slate-900"></div>
                          <span className="ms-3 text-sm font-medium text-gray-900">
                            {togglingProduct === product.id ? '...' : (product.ecommerce_active ? '✓' : '✗')}
                          </span>
                        </label>
                      </td>
                    )}
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
                  ));
                })()}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {filteredProducts.length > 0 && (
            <div className="mt-6 flex items-center justify-between px-6">
              <div className="text-sm text-slate-600">
                Página <strong>{currentPage}</strong> de <strong>{Math.ceil(filteredProducts.length / itemsPerPage)}</strong>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className={`px-4 py-2 border-2 border-slate-900 rounded-xl font-bold transition-all ${
                    currentPage === 1
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-white text-slate-900 hover:bg-slate-50'
                  }`}
                  style={{ boxShadow: currentPage === 1 ? 'none' : '2px 2px 0px 0px rgba(15,23,42,1)' }}
                >
                  ← Anterior
                </button>
                
                <div className="flex items-center gap-1">
                  {(() => {
                    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
                    const pages = [];
                    
                    // Show first page
                    if (currentPage > 3) {
                      pages.push(
                        <button
                          key={1}
                          onClick={() => setCurrentPage(1)}
                          className="w-10 h-10 border-2 border-slate-900 rounded-lg font-bold bg-white text-slate-900 hover:bg-slate-50"
                        >
                          1
                        </button>
                      );
                      if (currentPage > 4) {
                        pages.push(<span key="dots1" className="px-2">...</span>);
                      }
                    }
                    
                    // Show pages around current
                    for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
                      pages.push(
                        <button
                          key={i}
                          onClick={() => setCurrentPage(i)}
                          className={`w-10 h-10 border-2 border-slate-900 rounded-lg font-bold transition-all ${
                            i === currentPage
                              ? 'bg-slate-900 text-white'
                              : 'bg-white text-slate-900 hover:bg-slate-50'
                          }`}
                          style={{ boxShadow: i === currentPage ? '2px 2px 0px 0px rgba(15,23,42,1)' : 'none' }}
                        >
                          {i}
                        </button>
                      );
                    }
                    
                    // Show last page
                    if (currentPage < totalPages - 2) {
                      if (currentPage < totalPages - 3) {
                        pages.push(<span key="dots2" className="px-2">...</span>);
                      }
                      pages.push(
                        <button
                          key={totalPages}
                          onClick={() => setCurrentPage(totalPages)}
                          className="w-10 h-10 border-2 border-slate-900 rounded-lg font-bold bg-white text-slate-900 hover:bg-slate-50"
                        >
                          {totalPages}
                        </button>
                      );
                    }
                    
                    return pages;
                  })()}
                </div>
                
                <button
                  onClick={() => setCurrentPage(Math.min(Math.ceil(filteredProducts.length / itemsPerPage), currentPage + 1))}
                  disabled={currentPage >= Math.ceil(filteredProducts.length / itemsPerPage)}
                  className={`px-4 py-2 border-2 border-slate-900 rounded-xl font-bold transition-all ${
                    currentPage >= Math.ceil(filteredProducts.length / itemsPerPage)
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-white text-slate-900 hover:bg-slate-50'
                  }`}
                  style={{ boxShadow: currentPage >= Math.ceil(filteredProducts.length / itemsPerPage) ? 'none' : '2px 2px 0px 0px rgba(15,23,42,1)' }}
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Product Form Modal */}
      {showForm && (
        <ProductForm
          product={editingProduct}
          onClose={handleFormClose}
        />
      )}

      {/* Price Calculator Modal */}
      {showPriceCalculator && (
        <PriceCalculatorModal
          isOpen={showPriceCalculator}
          onClose={handleCalculatorClose}
          onProductUpdated={handleProductUpdated}
        />
      )}
    </div>
  );
};

export default InventoryPage;
