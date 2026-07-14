import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { ChevronLeft, ChevronRight, ArrowLeft, Calendar as CalendarIcon, TrendingUp, DollarSign, Plus } from 'lucide-react';
import { toast } from 'sonner';
import PastSaleForm from '../components/PastSaleForm';

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

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  // Permisos de edición: solo admin y supervisor
  const canEdit = user?.role === 'admin' || user?.role === 'supervisor';

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
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-all"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
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
          
          {canEdit ? (
            <button
              onClick={() => setShowPastSaleForm(true)}
              className="px-4 py-2 bg-[#D4F0A5] border-2 border-slate-900 rounded-lg font-bold hover:bg-[#c5e196] transition-all flex items-center gap-2"
              style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
            >
              <Plus className="w-5 h-5" />
              Registrar Venta Pasada
            </button>
          ) : (
            <div className="text-xs bg-amber-100 border-2 border-slate-900 rounded-lg px-3 py-2">
              📖 Solo lectura
            </div>
          )}
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
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {daySales.map((sale, index) => (
                      <div 
                        key={index}
                        className="p-3 border-2 border-slate-900 rounded-lg bg-slate-50"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-bold text-sm">{sale.product_name}</div>
                          <div 
                            className="text-sm font-mono font-bold"
                            style={{ fontFamily: 'JetBrains Mono, monospace' }}
                          >
                            ${sale.total.toLocaleString('es-CL')}
                          </div>
                        </div>
                        <div className="text-xs text-slate-600">
                          Cantidad: {sale.quantity} • {sale.payment_method}
                        </div>
                        {sale.customer_name && (
                          <div className="text-xs text-slate-600 mt-1">
                            Cliente: {sale.customer_name}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Registrar Venta Pasada */}
      {showPastSaleForm && (
        <PastSaleForm
          onClose={() => setShowPastSaleForm(false)}
          onSuccess={handlePastSaleSuccess}
          initialDate={`${currentYear}-${currentMonth.toString().padStart(2, '0')}-${new Date().getDate().toString().padStart(2, '0')}`}
        />
      )}
    </div>
  );
};

export default SalesRecordPage;
