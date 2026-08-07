import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Search, Plus, ShoppingCart, X, ChevronDown, FileText, TrendingDown, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStores } from '../hooks/useStores';
import CartSidebar from '../components/pos/CartSidebar';
import SaleDocument from '../components/pos/SaleDocument';
import ExpenseForm from '../components/ExpenseForm';
import OtherIncomeForm from '../components/OtherIncomeForm';
import { v4 as uuidv4 } from 'uuid';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const POSPage = () => {
  const navigate = useNavigate();
  const { stores } = useStores();
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [cartId] = useState(() => uuidv4());
  const [showDocument, setShowDocument] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [showRecordsMenu, setShowRecordsMenu] = useState(false);
  const recordsMenuRef = useRef(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [todayStats, setTodayStats] = useState(null);
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [cartDiscount, setCartDiscount] = useState({ type: 'none', value: 0 }); // type: 'percent' | 'amount' | 'none'
  const [discountPercentages, setDiscountPercentages] = useState([0, 5, 10, 15, 20, 25, 30, 50]); // Configurables

  useEffect(() => {
    fetchFrequentProducts();
    fetchTodayStats();
    fetchPOSSettings();
  }, []);

  const fetchPOSSettings = async () => {
    try {
      const response = await axios.get(`${API}/settings`);
      if (response.data.pos_discount_percentages) {
        setDiscountPercentages(response.data.pos_discount_percentages);
      }
      if (response.data.pos_payment_methods) {
        // Los métodos de pago se usarán en CartSidebar
      }
    } catch (error) {
      console.error('Error fetching POS settings:', error);
    }
  };

  const fetchTodayStats = async () => {
    try {
      const response = await axios.get(`${API}/pos-stats/today`);
      setTodayStats(response.data);
    } catch (error) {
      console.error('Error fetching today stats:', error);
    }
  };

  // Click outside to close records menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (recordsMenuRef.current && !recordsMenuRef.current.contains(event.target)) {
        setShowRecordsMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  const fetchFrequentProducts = async () => {
    try {
      const response = await axios.get(`${API}/products/top-selling?limit=20`);
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

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

  const recordsMenuItems = [
    { path: '/sales-records', icon: FileText, label: 'Registro de Ventas', color: 'from-green-400 to-emerald-400' },
    { path: '/expenses-records', icon: TrendingDown, label: 'Registro de Egresos', color: 'from-red-400 to-pink-400' },
    { path: '/income-records', icon: DollarSign, label: 'Registro de Ingresos Extras', color: 'from-yellow-400 to-orange-400' },
  ];

  const addToCart = (product) => {
    const existingItem = cartItems.find(item => item.product.id === product.id);
    
    if (existingItem) {
      setCartItems(cartItems.map(item => 
        item.product.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
      toast.success(`Cantidad actualizada: ${product.name}`);
    } else {
      setCartItems([...cartItems, { product, quantity: 1, discount: 0, id: uuidv4() }]); // Agregar campo discount
      toast.success(`Agregado al carrito: ${product.name}`);
    }
    
    setSearchQuery('');
    setSearchResults([]);
  };

  const updateQuantity = (itemId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    
    setCartItems(cartItems.map(item => 
      item.id === itemId 
        ? { ...item, quantity: newQuantity }
        : item
    ));
  };

  const removeFromCart = (itemId) => {
    setCartItems(cartItems.filter(item => item.id !== itemId));
    toast.info('Producto eliminado del carrito');
  };

  const updateItemDiscount = (itemId, discountPercent) => {
    setCartItems(cartItems.map(item =>
      item.id === itemId ? { ...item, discount: discountPercent } : item
    ));
  };

  const clearCart = () => {
    setCartItems([]);
    setSelectedCustomer(null);
    toast.info('Carrito limpiado');
  };

  const handlePayment = async (paymentMethod) => {
    if (cartItems.length === 0) {
      toast.error('El carrito está vacío');
      return;
    }

    try {
      // Calcular totales
      const subtotal = cartItems.reduce((sum, item) => 
        sum + (item.product.sale_price * item.quantity), 0
      );
      const iva = subtotal - (subtotal / 1.19);
      const total = subtotal;

      // Preparar datos de venta
      const saleData = {
        cart_id: cartId,
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
        subtotal: subtotal / 1.19,
        iva: iva,
        total: total,
        date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString()
      };

      // Guardar venta
      const response = await axios.post(`${API}/sales/cart`, saleData);
      
      setCompletedSale({
        ...saleData,
        id: response.data.id,
        sale_number: response.data.sale_number || `VENTA-${Date.now()}`
      });
      
      setShowDocument(true);
      
      toast.success('¡Venta registrada exitosamente!', {
        duration: 3000,
        style: {
          background: '#D4F0A5',
          color: '#0f172a',
          border: '2px solid #0f172a',
          fontWeight: 'bold',
        }
      });
      
      // Limpiar carrito
      clearCart();
      
      // Refrescar estadísticas del día
      fetchTodayStats();
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Error al procesar el pago');
    }
  };

  const ProductCard = ({ product }) => (
    <div 
      className="bg-white border-2 border-slate-900 rounded-xl p-4 hover:scale-105 transition-all cursor-pointer"
      style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
      onClick={() => addToCart(product)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-bold text-slate-900 mb-1 line-clamp-2">{product.name}</h3>
          <p className="text-xs text-slate-600">{product.sku || 'Sin SKU'}</p>
        </div>
        <div className="p-2 bg-gradient-to-br from-purple-400 to-pink-400 border border-slate-900 rounded-lg">
          <Plus className="w-4 h-4 text-white" />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-2xl font-black text-slate-900">${Math.round(product.sale_price || 0).toLocaleString('es-CL')}</p>
        <span className="px-2 py-1 bg-yellow-100 border border-slate-900 rounded text-xs font-bold">
          Stock: {product.stock || 0}
        </span>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex" style={{ backgroundColor: '#F4F4F0' }}>
      {/* Main Content - Product Selection */}
      <div className="flex-1 overflow-y-auto p-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 
              className="text-4xl font-black text-slate-900 mb-2"
              style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}
            >
              🛒 Punto de Venta
            </h1>
            <p className="text-slate-600 font-medium">Selecciona productos para agregar al carrito</p>
          </div>

          {/* Registros Históricos Dropdown */}
          <div className="relative" ref={recordsMenuRef}>
            <button
              onClick={() => setShowRecordsMenu(!showRecordsMenu)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-slate-900 font-bold transition-all ${
                showRecordsMenu
                  ? 'bg-slate-900 text-white' 
                  : 'bg-white text-slate-900 hover:bg-slate-50'
              }`}
              style={{ 
                boxShadow: showRecordsMenu ? '4px 4px 0px 0px rgba(15,23,42,1)' : '3px 3px 0px 0px rgba(15,23,42,1)'
              }}
              data-testid="pos-records-dropdown"
            >
              <FileText className="w-5 h-5" />
              <span className="text-sm">Registros Históricos</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showRecordsMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {showRecordsMenu && (
              <div 
                className="absolute top-full mt-2 right-0 w-64 bg-white border-2 border-slate-900 rounded-xl shadow-lg z-50 overflow-hidden"
                style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
              >
                {recordsMenuItems.map((record) => {
                  const RecordIcon = record.icon;
                  return (
                    <button
                      key={record.path}
                      onClick={() => {
                        navigate(record.path);
                        setShowRecordsMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gradient-to-r hover:from-slate-50 hover:to-slate-100 transition-colors border-b-2 border-slate-900 last:border-b-0"
                      data-testid={`record-${record.path}`}
                    >
                      <div className={`p-2 rounded-lg bg-gradient-to-br ${record.color}`}>
                        <RecordIcon className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm font-bold text-slate-900">{record.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons - Egresos e Ingresos Extras */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => setShowExpenseForm(true)}
            className="flex items-center gap-2 px-4 py-3 bg-white border-2 border-slate-900 rounded-xl font-bold text-slate-900 hover:scale-105 transition-all"
            style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
            data-testid="pos-expenses-button"
          >
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-red-400 to-pink-400">
              <TrendingDown className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm">Egresos</span>
          </button>

          <button
            onClick={() => setShowIncomeForm(true)}
            className="flex items-center gap-2 px-4 py-3 bg-white border-2 border-slate-900 rounded-xl font-bold text-slate-900 hover:scale-105 transition-all"
            style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
            data-testid="pos-income-button"
          >
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-400">
              <DollarSign className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm">Ingresos Extras</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar productos por nombre o SKU..."
              className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-900 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
            />
          </div>
          
          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div 
              className="mt-2 bg-white border-2 border-slate-900 rounded-xl overflow-hidden"
              style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
            >
              {searchResults.slice(0, 5).map((product) => (
                <div
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="p-4 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 cursor-pointer border-b-2 border-slate-900 last:border-b-0"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{product.name}</p>
                      <p className="text-xs text-slate-600">{product.sku} - Stock: {product.stock}</p>
                    </div>
                    <p className="text-xl font-black text-slate-900">${Math.round(product.sale_price || 0).toLocaleString('es-CL')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Customer Selection */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              value={selectedCustomer ? selectedCustomer.name : customerSearch}
              onChange={(e) => {
                setSelectedCustomer(null);
                setCustomerSearch(e.target.value);
              }}
              placeholder="Cliente (opcional) - Buscar por nombre..."
              className="w-full px-4 py-3 bg-white border-2 border-slate-900 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            {selectedCustomer && (
              <button
                onClick={() => {
                  setSelectedCustomer(null);
                  setCustomerSearch('');
                }}
                className="absolute right-4 top-1/2 transform -translate-y-1/2"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            )}
          </div>
          
          {customerResults.length > 0 && !selectedCustomer && (
            <div 
              className="mt-2 bg-white border-2 border-slate-900 rounded-xl overflow-hidden"
              style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
            >
              {customerResults.slice(0, 5).map((customer) => (
                <div
                  key={customer.id}
                  onClick={() => {
                    setSelectedCustomer(customer);
                    setCustomerResults([]);
                  }}
                  className="p-3 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 cursor-pointer border-b-2 border-slate-900 last:border-b-0"
                >
                  <p className="font-bold text-slate-900">{customer.name}</p>
                  <p className="text-xs text-slate-600">{customer.email || customer.phone || 'Sin contacto'}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Product Grid */}
        <div>
          <h2 className="text-xl font-black text-slate-900 mb-4">
            Productos Más Vendidos
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </div>

      {/* Cart Sidebar */}
      <CartSidebar 
        cartItems={cartItems}
        cartId={cartId}
        onUpdateQuantity={updateQuantity}
        onRemove={removeFromCart}
        onClear={clearCart}
        onPayment={handlePayment}
        customer={selectedCustomer}
        todayStats={todayStats}
        onUpdateItemDiscount={updateItemDiscount}
        discountPercentages={discountPercentages}
      />

      {/* Sale Document Modal */}
      {showDocument && completedSale && (
        <SaleDocument 
          sale={completedSale}
          onClose={() => {
            setShowDocument(false);
            setCompletedSale(null);
          }}
        />
      )}

      {/* Expense Form */}
      {showExpenseForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-2xl w-full">
            <button
              onClick={() => setShowExpenseForm(false)}
              className="absolute -top-4 -right-4 z-10 p-2 bg-white border-2 border-slate-900 rounded-full hover:bg-slate-100 transition-all"
              style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
            >
              <X className="w-5 h-5" />
            </button>
            <ExpenseForm
              onSuccess={() => {
                setShowExpenseForm(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Income Form */}
      {showIncomeForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-2xl w-full">
            <button
              onClick={() => setShowIncomeForm(false)}
              className="absolute -top-4 -right-4 z-10 p-2 bg-white border-2 border-slate-900 rounded-full hover:bg-slate-100 transition-all"
              style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
            >
              <X className="w-5 h-5" />
            </button>
            <OtherIncomeForm
              onSuccess={() => {
                setShowIncomeForm(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default POSPage;
