import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Home, Calendar as CalendarIcon, TrendingUp, DollarSign, Plus, Edit2, Trash2, Eye, ShoppingCart, User } from 'lucide-react';
import { toast } from 'sonner';
import PastCartSaleForm from '../components/PastCartSaleForm';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const SalesRecordPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [daySales, setDaySales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPastSaleForm, setShowPastSaleForm] = useState(false);
  const [editModal, setEditModal] = useState({ open: false, data: null, isCartSale: false });
  const [detailsModal, setDetailsModal] = useState({ open: false, sale: null });

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  // Permisos de edición: solo admin y supervisor
  const canEdit = user?.role === 'account_admin' || user?.role === 'supervisor';

  useEffect(() => {
    fetchCalendarData();
  }, [currentYear, currentMonth]);

  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/sales-records/calendar/${currentYear}/${currentMonth}`);
      setCalendarData(response.data);
    } catch (error) {
      console.error('Error al cargar calendario:', error);
      toast.error('Error al cargar datos del calendario');
    } finally {
      setLoading(false);
    }
  };

  const fetchDaySales = async (day) => {
    const dateStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    try {
      const response = await axios.get(`${API}/sales-records/day/${dateStr}`);
      setDaySales(response.data.sales);
      setSelectedDay(day);
    } catch (error) {
      console.error('Error al cargar ventas del día:', error);
      toast.error('Error al cargar ventas del día');
    }
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 2, 1));
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth, 1));
    setSelectedDay(null);
  };

  const handlePastSaleSuccess = () => {
    fetchCalendarData();
    if (selectedDay) {
      fetchDaySales(selectedDay);
    }
  };

  const handleDeleteSale = async (saleId) => {
    if (!window.confirm('¿Estás seguro de eliminar esta venta?')) {
      return;
    }

    try {
      await axios.delete(`${API}/sales/${saleId}`);
      toast.success('Venta eliminada exitosamente');
      fetchCalendarData();
      if (selectedDay) {
        fetchDaySales(selectedDay);
      }
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error('No tienes permisos para eliminar registros');
      } else {
        toast.error('Error al eliminar venta');
      }
      console.error('Error deleting sale:', error);
    }
  };

  const handleEditSale = (sale) => {
    // Determinar si es venta de carrito o venta individual
    const isCartSale = !!(sale.cart_id || (sale.items && sale.items.length > 0));
    
    console.log('Editing sale:', {
      sale_number: sale.sale_number,
      cart_id: sale.cart_id,
      items: sale.items,
      isCartSale
    });
    
    // Para ventas de carrito, copiar los items para poder editarlos
    const editableData = { ...sale };
    if (isCartSale && sale.items) {
      editableData.items = sale.items.map(item => ({ ...item }));
    } else if (isCartSale && !sale.items) {
      // Si es carrito pero no tiene items (error de datos), usar array vacío
      editableData.items = [];
      console.warn('Venta de carrito sin items:', sale);
    }
    
    setEditModal({ 
      open: true, 
      data: editableData,
      isCartSale: isCartSale
    });
  };

  const handleUpdateSale = async (e) => {
    e.preventDefault();
    
    try {
      // Si es venta de carrito
      if (editModal.isCartSale) {
        // Recalcular totales basados en items editados
        const itemsTotal = editModal.data.items.reduce((sum, item) => 
          sum + (item.quantity * item.unit_price), 0
        );
        const subtotalSinIVA = itemsTotal / 1.19;
        const ivaCalculado = itemsTotal - subtotalSinIVA;
        
        // Actualizar venta de carrito con items y totales recalculados
        await axios.patch(`${API}/sales/${editModal.data.id}/cart-sale`, {
          customer_name: editModal.data.customer_name || 'Cliente General',
          payment_method: editModal.data.payment_method,
          items: editModal.data.items,
          subtotal: subtotalSinIVA,
          iva: ivaCalculado,
          total: itemsTotal
        });
      } else {
        // Para ventas individuales, usar el payload completo
        const payload = {
          product_id: editModal.data.product_id,
          product_name: editModal.data.product_name,
          quantity: parseFloat(editModal.data.quantity),
          price: parseFloat(editModal.data.price),
          total: parseFloat(editModal.data.total),
          cost_price: parseFloat(editModal.data.cost_price || 0),
          store: editModal.data.store,
          has_tax: editModal.data.has_tax,
          customer_id: editModal.data.customer_id || null,
          customer_name: editModal.data.customer_name || null,
          payment_method: editModal.data.payment_method
        };

        await axios.put(`${API}/sales/${editModal.data.id}`, payload);
      }
      
      toast.success('Venta actualizada exitosamente');
      setEditModal({ open: false, data: null, isCartSale: false });
      fetchCalendarData();
      if (selectedDay) {
        fetchDaySales(selectedDay);
      }
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error('No tienes permisos para editar registros');
      } else {
        toast.error('Error al actualizar venta');
      }
      console.error('Error updating sale:', error);
    }
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...editModal.data.items];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: parseFloat(value) || 0
    };
    
    // Recalcular subtotal del item
    if (field === 'quantity' || field === 'unit_price') {
      updatedItems[index].subtotal = updatedItems[index].quantity * updatedItems[index].unit_price;
    }
    
    setEditModal({
      ...editModal,
      data: {
        ...editModal.data,
        items: updatedItems
      }
    });
  };

  const handleRemoveItem = (index) => {
    const updatedItems = editModal.data.items.filter((_, i) => i !== index);
    
    if (updatedItems.length === 0) {
      toast.error('Debe haber al menos un producto en la venta');
      return;
    }
    
    setEditModal({
      ...editModal,
      data: {
        ...editModal.data,
        items: updatedItems
      }
    });
    toast.success('Producto eliminado');
  };

  const getTotalFromItems = () => {
    if (!editModal.data.items) return 0;
    return editModal.data.items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
  };

  const getDaysInMonth = () => {
    return new Date(currentYear, currentMonth, 0).getDate();
  };

  const getFirstDayOfMonth = () => {
    return new Date(currentYear, currentMonth - 1, 1).getDay();
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth();
    const firstDay = getFirstDayOfMonth();
    const days = [];

    // Días vacíos antes del primer día del mes
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="p-2"></div>);
    }

    // Días del mes
    for (let day = 1; day <= daysInMonth; day++) {
      const dayTotal = calendarData?.daily_totals[day] || 0;
      const isToday = 
        day === new Date().getDate() && 
        currentMonth === new Date().getMonth() + 1 && 
        currentYear === new Date().getFullYear();
      const isSelected = day === selectedDay;

      days.push(
        <div
          key={day}
          onClick={() => fetchDaySales(day)}
          className={`
            relative p-3 border-2 border-slate-900 rounded-lg cursor-pointer transition-all
            ${isSelected ? 'bg-[#D4F0A5] ring-2 ring-slate-900' : 'bg-white hover:bg-slate-50'}
            ${isToday ? 'ring-2 ring-indigo-500' : ''}
          `}
          style={{ 
            boxShadow: isSelected ? '4px 4px 0px 0px rgba(15,23,42,1)' : '2px 2px 0px 0px rgba(15,23,42,0.3)',
            minHeight: '80px'
          }}
        >
          <div className="font-bold text-slate-900 mb-1">{day}</div>
          {dayTotal > 0 && (
            <div className="text-xs font-mono font-bold text-slate-700">
              ${dayTotal.toLocaleString('es-CL')}
            </div>
          )}
          {isToday && (
            <div className="absolute top-1 right-1 w-2 h-2 bg-indigo-500 rounded-full"></div>
          )}
        </div>
      );
    }

    return days;
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F4F4F0' }}>
      {/* Header */}
      <header className="bg-white border-b-2 border-slate-900 py-4 px-6 md:px-8 sticky top-0 z-50">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div>
              <h1 
                className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900"
                style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}
              >
                Registro de Ventas
              </h1>
              <p className="text-sm font-medium text-slate-600">Historial completo de ventas</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/pos')}
              className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-slate-900 rounded-xl font-bold hover:bg-slate-50 transition-all"
              style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
            >
              <Home className="w-5 h-5" />
              Volver al POS
            </button>
            
            {canEdit && (
              <button
                onClick={() => setShowPastSaleForm(true)}
                className="px-4 py-2 bg-[#D4F0A5] border-2 border-slate-900 rounded-lg font-bold hover:bg-[#c5e196] transition-all flex items-center gap-2"
                style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
              >
                <Plus className="w-5 h-5" />
                Registrar Venta Pasada
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel Principal: Calendario */}
          <div className="lg:col-span-2">
            <div 
              className="bg-white border-2 border-slate-900 rounded-xl p-6"
              style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
            >
              {/* Navegación de Mes */}
              <div className="flex justify-between items-center mb-6">
                <button
                  onClick={handlePrevMonth}
                  className="p-2 border-2 border-slate-900 rounded-lg hover:bg-slate-100 transition-all"
                  style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <div className="text-center">
                  <h2 
                    className="text-2xl font-bold text-slate-900"
                    style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}
                  >
                    {MONTHS_ES[currentMonth - 1]} {currentYear}
                  </h2>
                </div>
                
                <button
                  onClick={handleNextMonth}
                  className="p-2 border-2 border-slate-900 rounded-lg hover:bg-slate-100 transition-all"
                  style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Encabezados de Días */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {DAYS_ES.map(day => (
                  <div key={day} className="text-center text-xs font-bold uppercase text-slate-500 p-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Cuadrícula del Calendario */}
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
                  <p className="mt-4 text-slate-600">Cargando...</p>
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-2">
                  {renderCalendar()}
                </div>
              )}
            </div>
          </div>

          {/* Panel Derecho: Resumen y Ventas del Día */}
          <div className="space-y-6">
            {/* Totales */}
            <div 
              className="bg-white border-2 border-slate-900 rounded-xl p-6"
              style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
            >
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Resumen
              </h3>
              
              <div className="space-y-4">
                <div className="p-4 bg-[#D4F0A5] border-2 border-slate-900 rounded-lg">
                  <p className="text-xs font-bold uppercase text-slate-600 mb-1">Total del Mes</p>
                  <p 
                    className="text-2xl font-black text-slate-900"
                    style={{ fontFamily: 'JetBrains Mono, monospace' }}
                  >
                    ${(calendarData?.monthly_total || 0).toLocaleString('es-CL')}
                  </p>
                </div>

                <div className="p-4 bg-[#FADBB0] border-2 border-slate-900 rounded-lg">
                  <p className="text-xs font-bold uppercase text-slate-600 mb-1">Total del Año</p>
                  <p 
                    className="text-2xl font-black text-slate-900"
                    style={{ fontFamily: 'JetBrains Mono, monospace' }}
                  >
                    ${(calendarData?.yearly_total || 0).toLocaleString('es-CL')}
                  </p>
                </div>

                <div className="p-4 bg-slate-100 border-2 border-slate-900 rounded-lg">
                  <p className="text-xs font-bold uppercase text-slate-600 mb-1">Ventas del Mes</p>
                  <p className="text-xl font-bold text-slate-900">
                    {calendarData?.total_sales_count || 0} registros
                  </p>
                </div>
              </div>
            </div>

            {/* Ventas del Día Seleccionado */}
            {selectedDay && (
              <div 
                className="bg-white border-2 border-slate-900 rounded-xl p-6"
                style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
              >
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5" />
                  Día {selectedDay} de {MONTHS_ES[currentMonth - 1]}
                </h3>
                
                {daySales.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">
                    No hay ventas registradas
                  </p>
                ) : (
                  <>
                    <div className="mb-3 p-2 bg-slate-100 border border-slate-300 rounded-lg">
                      <p className="text-xs font-bold text-slate-600">
                        📦 {daySales.length} {daySales.length === 1 ? 'venta registrada' : 'ventas registradas'}
                      </p>
                    </div>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                    {daySales.map((sale, index) => {
                      // Extraer hora de la fecha
                      let timeStr = '';
                      if (sale.date) {
                        try {
                          const dateObj = new Date(sale.date);
                          timeStr = dateObj.toLocaleTimeString('es-CL', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            hour12: false 
                          });
                        } catch (e) {
                          timeStr = '';
                        }
                      }
                      
                      return (
                        <div 
                          key={index}
                          className="p-3 border-2 border-slate-900 rounded-lg bg-slate-50"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              {/* Si es venta de carrito (tiene cart_id), mostrar número de venta y cliente */}
                              {sale.cart_id || sale.items ? (
                                <div>
                                  <div className="font-bold text-sm flex items-center gap-2">
                                    <ShoppingCart className="w-4 h-4" />
                                    {sale.sale_number || `VENTA-${sale.id?.slice(0, 8)}`}
                                  </div>
                                  {sale.customer_name && (
                                    <div className="text-xs text-slate-600 flex items-center gap-1 mt-1">
                                      <User className="w-3 h-3" />
                                      {sale.customer_name}
                                    </div>
                                  )}
                                  {sale.items && (
                                    <div className="text-xs text-blue-600 font-semibold mt-1">
                                      🛒 {sale.items.length} {sale.items.length === 1 ? 'producto' : 'productos'}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="font-bold text-sm">{sale.product_name}</div>
                              )}
                              {timeStr && (
                                <div className="text-xs text-indigo-600 font-mono font-bold mt-0.5">
                                  🕐 {timeStr}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <div 
                                className="text-sm font-mono font-bold"
                                style={{ fontFamily: 'JetBrains Mono, monospace' }}
                              >
                                ${(sale.total || 0).toLocaleString('es-CL')}
                              </div>
                              <div className="flex items-center gap-1">
                                {/* Botón ver detalles solo para ventas con carrito */}
                                {(sale.cart_id || sale.items) && (
                                  <button
                                    onClick={() => setDetailsModal({ open: true, sale })}
                                    className="p-1 hover:bg-blue-100 rounded transition-colors"
                                    title="Ver detalles"
                                  >
                                    <Eye className="w-4 h-4 text-blue-600" />
                                  </button>
                                )}
                                {canEdit && (
                                  <>
                                    <button
                                      onClick={() => handleEditSale(sale)}
                                      className="p-1 hover:bg-slate-200 rounded transition-colors"
                                      title="Editar"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSale(sale.id)}
                                      className="p-1 hover:bg-red-100 rounded transition-colors"
                                      title="Eliminar"
                                    >
                                      <Trash2 className="w-4 h-4 text-red-600" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {sale.payment_method && (
                            <div className="text-xs text-slate-500 flex items-center gap-2">
                              <span>💳 {sale.payment_method}</span>
                              {!sale.cart_id && sale.quantity && (
                                <span>• Cant: {sale.quantity}</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Registrar Venta Pasada */}
      {showPastSaleForm && (
        <PastCartSaleForm
          onClose={() => setShowPastSaleForm(false)}
          onSuccess={handlePastSaleSuccess}
        />
      )}

      {/* Modal de Edición */}
      {editModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div 
            className="bg-white border-2 border-slate-900 rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
          >
            <h3 className="text-xl font-bold mb-4">
              {editModal.isCartSale ? 'Editar Venta de Carrito' : 'Editar Venta'}
            </h3>
            
            <form onSubmit={handleUpdateSale} className="space-y-4">
              {/* Mostrar campos según tipo de venta */}
              {editModal.isCartSale ? (
                <>
                  {/* Campos para venta de carrito - Similar al modal de detalles pero editable */}
                  
                  {/* Header con número de venta */}
                  <div className="mb-4 p-3 bg-slate-100 border-2 border-slate-900 rounded-lg">
                    <p className="text-xs font-bold text-slate-600">Número de Venta</p>
                    <p className="text-lg font-black">{editModal.data.sale_number || 'N/A'}</p>
                    <p className="text-xs text-slate-500 mt-1">ID Carrito: #{editModal.data.cart_id?.slice(0, 8).toUpperCase() || 'N/A'}</p>
                  </div>
                  
                  {/* Cliente editable */}
                  <div>
                    <label className="block text-sm font-bold mb-2">Cliente:</label>
                    <input
                      type="text"
                      value={editModal.data.customer_name || 'Cliente General'}
                      onChange={(e) => setEditModal({
                        ...editModal,
                        data: { ...editModal.data, customer_name: e.target.value }
                      })}
                      className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg font-bold bg-blue-50"
                      placeholder="Nombre del cliente"
                    />
                  </div>

                  {/* Lista de productos editables */}
                  <div className="border-2 border-slate-900 rounded-lg p-4 bg-slate-50">
                    <h4 className="text-lg font-bold mb-3">Productos ({editModal.data.items?.length || 0})</h4>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {editModal.data.items && editModal.data.items.map((item, idx) => (
                        <div 
                          key={idx}
                          className="p-3 border-2 border-slate-900 rounded-lg bg-white relative"
                          style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="font-bold text-sm">{item.product_name}</div>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1 hover:bg-red-100 rounded transition-colors"
                              title="Eliminar producto"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-xs font-bold mb-1">Cantidad</label>
                              <input
                                type="number"
                                step="1"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                className="w-full px-2 py-1 border-2 border-slate-900 rounded text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold mb-1">Precio Unit.</label>
                              <input
                                type="number"
                                step="1"
                                min="0"
                                value={Math.round(item.unit_price)}
                                onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                                className="w-full px-2 py-1 border-2 border-slate-900 rounded text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold mb-1">Subtotal</label>
                              <input
                                type="text"
                                value={`$${Math.round(item.subtotal || 0).toLocaleString('es-CL')}`}
                                className="w-full px-2 py-1 border-2 border-slate-900 rounded text-sm bg-slate-100 font-mono"
                                disabled
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Totales con estilo similar al modal de detalles */}
                    <div className="mt-4 pt-4 border-t-2 border-slate-900 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Subtotal (sin IVA):</span>
                        <span className="font-bold">${Math.round(getTotalFromItems() / 1.19).toLocaleString('es-CL')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">IVA (19%):</span>
                        <span className="font-bold">${Math.round(getTotalFromItems() - (getTotalFromItems() / 1.19)).toLocaleString('es-CL')}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t-2 border-slate-900">
                        <span className="font-black text-lg">TOTAL:</span>
                        <span className="font-black text-2xl font-mono">
                          ${Math.round(getTotalFromItems()).toLocaleString('es-CL')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Método de Pago editable */}
                  <div className="border-2 border-slate-900 rounded-lg p-3 bg-green-50">
                    <label className="block text-xs font-bold text-slate-600 mb-2">Método de Pago:</label>
                    <select
                      value={editModal.data.payment_method}
                      onChange={(e) => setEditModal({
                        ...editModal,
                        data: { ...editModal.data, payment_method: e.target.value }
                      })}
                      className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg font-bold text-lg"
                    >
                      <option value="Efectivo">Efectivo</option>
                      <option value="Tarjeta">Tarjeta</option>
                      <option value="Transferencia">Transferencia</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  {/* Campos para venta individual */}
                  <div>
                    <label className="block text-sm font-bold mb-2">Producto</label>
                    <input
                      type="text"
                      value={editModal.data.product_name}
                      className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg bg-slate-100"
                      disabled
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold mb-2">Cantidad</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={editModal.data.quantity}
                        onChange={(e) => setEditModal({
                          ...editModal,
                          data: { ...editModal.data, quantity: e.target.value }
                        })}
                        className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold mb-2">Precio Unit.</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editModal.data.price}
                        onChange={(e) => setEditModal({
                          ...editModal,
                          data: { ...editModal.data, price: e.target.value }
                        })}
                        className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold mb-2">Total</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={editModal.data.total}
                      onChange={(e) => setEditModal({
                        ...editModal,
                        data: { ...editModal.data, total: e.target.value }
                      })}
                      className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg"
                      required
                    />
                    <p className="text-xs text-slate-500 mt-1">El total debe ser mayor a 0</p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold mb-2">Método de Pago</label>
                    <select
                      value={editModal.data.payment_method}
                      onChange={(e) => setEditModal({
                        ...editModal,
                        data: { ...editModal.data, payment_method: e.target.value }
                      })}
                      className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg"
                    >
                      <option value="Efectivo">Efectivo</option>
                      <option value="Tarjeta">Tarjeta</option>
                      <option value="Transferencia">Transferencia</option>
                    </select>
                  </div>
                </>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800"
                >
                  Guardar Cambios
                </button>
                <button
                  type="button"
                  onClick={() => setEditModal({ open: false, data: null, isCartSale: false })}
                  className="flex-1 px-4 py-2 bg-slate-200 text-slate-900 rounded-lg font-bold hover:bg-slate-300"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Detalles de Venta (Carrito) */}
      {detailsModal.open && detailsModal.sale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div 
            className="bg-white border-2 border-slate-900 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-black flex items-center gap-2">
                  <ShoppingCart className="w-6 h-6" />
                  {detailsModal.sale.sale_number || 'Detalles de Venta'}
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  ID Carrito: #{detailsModal.sale.cart_id?.slice(0, 8).toUpperCase() || 'N/A'}
                </p>
              </div>
              <button
                onClick={() => setDetailsModal({ open: false, sale: null })}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Cliente */}
            {detailsModal.sale.customer_name && (
              <div className="mb-4 p-3 bg-blue-50 border-2 border-blue-900 rounded-lg">
                <p className="text-xs font-bold text-blue-900">Cliente:</p>
                <p className="text-sm font-bold text-slate-900">{detailsModal.sale.customer_name}</p>
              </div>
            )}

            {/* Productos */}
            <div className="mb-4">
              <h4 className="text-lg font-bold mb-3">Productos ({detailsModal.sale.items?.length || 0})</h4>
              <div className="space-y-2">
                {detailsModal.sale.items && detailsModal.sale.items.length > 0 ? (
                  detailsModal.sale.items.map((item, idx) => (
                    <div 
                      key={idx}
                      className="p-3 border-2 border-slate-900 rounded-lg bg-gradient-to-br from-purple-50 to-pink-50"
                      style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-bold text-sm">{item.product_name}</p>
                          <p className="text-xs text-slate-600 mt-1">
                            Cantidad: {item.quantity} × ${Math.round(item.unit_price || 0).toLocaleString('es-CL')}
                          </p>
                        </div>
                        <p className="text-lg font-black" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                          ${Math.round(item.subtotal || 0).toLocaleString('es-CL')}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">No hay productos registrados</p>
                )}
              </div>
            </div>

            {/* Totales */}
            <div className="border-t-2 border-slate-200 pt-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Subtotal (sin IVA):</span>
                  <span className="font-bold">${Math.round(detailsModal.sale.subtotal || 0).toLocaleString('es-CL')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">IVA (19%):</span>
                  <span className="font-bold">${Math.round(detailsModal.sale.iva || 0).toLocaleString('es-CL')}</span>
                </div>
                <div className="flex justify-between text-lg pt-2 border-t-2 border-slate-900">
                  <span className="font-black">TOTAL:</span>
                  <span className="font-black" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    ${Math.round(detailsModal.sale.total || 0).toLocaleString('es-CL')}
                  </span>
                </div>
              </div>

              {/* Método de pago */}
              {detailsModal.sale.payment_method && (
                <div className="mt-4 p-3 bg-green-50 border-2 border-green-900 rounded-lg">
                  <p className="text-xs font-bold text-green-900">Método de Pago:</p>
                  <p className="text-sm font-bold text-slate-900">{detailsModal.sale.payment_method}</p>
                </div>
              )}

              {/* Usuario que registró */}
              {detailsModal.sale.user_name && (
                <div className="mt-2 text-xs text-slate-500">
                  Registrado por: {detailsModal.sale.user_name}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesRecordPage;
