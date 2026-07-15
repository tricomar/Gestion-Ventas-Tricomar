import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { LogOut, TrendingUp, TrendingDown, DollarSign, PlusCircle, Package, FileText, Settings, Users, Menu, ChevronDown, Calendar as CalendarIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SalesForm from '../components/SalesForm';
import ExpenseForm from '../components/ExpenseForm';
import OtherIncomeForm from '../components/OtherIncomeForm';
import DailySidebar from '../components/DailySidebar';
import DashboardStats from '../components/DashboardStats';
import RealtimeMetrics from '../components/RealtimeMetrics';
import EconomicIndicators from '../components/EconomicIndicators';
import NotesCalendar from '../components/NotesCalendar';
import DailyNotes from '../components/DailyNotes';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('sales');
  const [todayTotal, setTodayTotal] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showMenu, setShowMenu] = useState(false);
  const [showRecordsMenu, setShowRecordsMenu] = useState(false);

  const refresh = () => setRefreshTrigger(prev => prev + 1);

  // Cerrar dropdown de registros al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showRecordsMenu && !event.target.closest('[data-testid="records-dropdown-btn"]')) {
        setShowRecordsMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showRecordsMenu]);

  useEffect(() => {
    const fetchTodayTotal = async () => {
      try {
        const response = await axios.get(`${API}/dashboard/realtime-metrics`);
        setTodayTotal(response.data.today_sales || 0);
      } catch (error) {
        console.error('Error fetching today total:', error);
        setTodayTotal(0);
      }
    };

    fetchTodayTotal();
    const interval = setInterval(fetchTodayTotal, 10000);
    return () => clearInterval(interval);
  }, [refreshTrigger]);

  return (
    <div className="flex w-full min-h-screen" style={{ backgroundColor: '#F4F4F0' }}>
      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header 
          className="bg-white border-b-2 border-slate-900 py-4 px-6 md:px-8 sticky top-0 z-50"
          data-testid="dashboard-header"
        >
          {/* Primera fila: Título y Total del Día */}
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 
                className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900"
                style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}
              >
                Gestión de Ventas
              </h1>
              <p className="text-sm font-medium text-slate-600">Bienvenido, {user?.name}</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs font-bold tracking-widest uppercase text-slate-500">Total Hoy</p>
                <p 
                  className="text-4xl sm:text-5xl font-black text-slate-900"
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                  data-testid="daily-total-display"
                >
                  ${todayTotal.toLocaleString('es-CL')}
                </p>
              </div>
              
              {/* Dropdown de Registros */}
              <div className="relative">
                <button
                  onClick={() => setShowRecordsMenu(!showRecordsMenu)}
                  className="px-4 py-2 bg-white border-2 border-slate-900 rounded-xl hover:bg-slate-50 transition-all font-bold text-sm flex items-center gap-2"
                  style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
                  onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                  data-testid="records-dropdown-btn"
                >
                  <CalendarIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">REGISTROS</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showRecordsMenu ? 'rotate-180' : ''}`} />
                </button>

                {showRecordsMenu && (
                  <div
                    className="absolute right-0 mt-2 w-64 bg-white border-2 border-slate-900 rounded-xl shadow-lg z-50"
                    style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
                  >
                    <div className="py-2">
                      <button
                        onClick={() => {
                          navigate('/sales-records');
                          setShowRecordsMenu(false);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-all flex items-center gap-3 font-medium"
                      >
                        <TrendingUp className="w-5 h-5 text-green-600" />
                        <span>Registro de Ventas</span>
                      </button>
                      <button
                        onClick={() => {
                          navigate('/expenses-records');
                          setShowRecordsMenu(false);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-all flex items-center gap-3 font-medium"
                      >
                        <TrendingDown className="w-5 h-5 text-red-600" />
                        <span>Registro de Egresos</span>
                      </button>
                      <button
                        onClick={() => {
                          navigate('/income-records');
                          setShowRecordsMenu(false);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-all flex items-center gap-3 font-medium"
                      >
                        <DollarSign className="w-5 h-5 text-blue-600" />
                        <span>Registro de Otros Ingresos</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              <button
                onClick={logout}
                className="p-3 bg-white border-2 border-slate-900 rounded-xl hover:bg-slate-50 transition-all"
                style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
                onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                data-testid="logout-btn"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Segunda fila: Indicadores Económicos */}
          <div className="border-t border-slate-200 pt-3">
            <EconomicIndicators />
          </div>
        </header>

        {/* Main Content Area - Layout Vertical */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto">
          {/* Navigation Menu */}
          <div className="mb-4 relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="px-4 py-2 text-sm rounded-lg font-bold border-2 border-slate-900 bg-white hover:bg-slate-50 flex items-center gap-2"
              style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
            >
              <Menu className="w-4 h-4" />
              Menú
            </button>
            
            {showMenu && (
              <div className="absolute z-50 mt-2 w-48 bg-white border-2 border-slate-900 rounded-xl shadow-lg" style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}>
                <button
                  onClick={() => { navigate('/customers'); setShowMenu(false); }}
                  className="w-full text-left px-4 py-2 hover:bg-slate-100 font-bold flex items-center gap-2 border-b-2 border-slate-200"
                >
                  <Users className="w-4 h-4" />
                  Clientes
                </button>
                <button
                  onClick={() => { navigate('/inventory'); setShowMenu(false); }}
                  className="w-full text-left px-4 py-2 hover:bg-slate-100 font-bold flex items-center gap-2 border-b-2 border-slate-200"
                >
                  <Package className="w-4 h-4" />
                  Inventario
                </button>
                <button
                  onClick={() => { navigate('/reports'); setShowMenu(false); }}
                  className="w-full text-left px-4 py-2 hover:bg-slate-100 font-bold flex items-center gap-2 border-b-2 border-slate-200"
                >
                  <FileText className="w-4 h-4" />
                  Reportes
                </button>
                <button
                  onClick={() => { navigate('/settings'); setShowMenu(false); }}
                  className="w-full text-left px-4 py-2 hover:bg-slate-100 font-bold flex items-center gap-2 rounded-b-lg"
                >
                  <Settings className="w-4 h-4" />
                  Configuración
                </button>
              </div>
            )}
          </div>

          {/* Tab Buttons for Forms */}
          <div className="mb-4 flex gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab('sales')}
              className={`px-4 py-2 text-sm rounded-lg font-bold border-2 border-slate-900 transition-all ${
                activeTab === 'sales' ? 'text-slate-900' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
              style={{
                backgroundColor: activeTab === 'sales' ? '#D4F0A5' : 'white',
                boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)'
              }}
            >
              <PlusCircle className="inline w-4 h-4 mr-1" />
              Ventas
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-4 py-2 text-sm rounded-lg font-bold border-2 border-slate-900 transition-all ${
                activeTab === 'expenses' ? 'text-slate-900' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
              style={{
                backgroundColor: activeTab === 'expenses' ? '#FFA8A8' : 'white',
                boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)'
              }}
            >
              <TrendingDown className="inline w-4 h-4 mr-1" />
              Egresos
            </button>
            <button
              onClick={() => setActiveTab('income')}
              className={`px-4 py-2 text-sm rounded-lg font-bold border-2 border-slate-900 transition-all ${
                activeTab === 'income' ? 'text-slate-900' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
              style={{
                backgroundColor: activeTab === 'income' ? '#FADBB0' : 'white',
                boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)'
              }}
            >
              <TrendingUp className="inline w-4 h-4 mr-1" />
              Otros Ingresos
            </button>
          </div>

          {/* Form Content - Ocupa todo el ancho */}
          <div className="mb-6">
            {activeTab === 'sales' && <SalesForm onSuccess={refresh} />}
            {activeTab === 'expenses' && <ExpenseForm onSuccess={refresh} />}
            {activeTab === 'income' && <OtherIncomeForm onSuccess={refresh} />}
          </div>

          {/* Calendario y Notas - Abajo del formulario */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <NotesCalendar 
              onDateSelect={setSelectedDate}
              selectedDate={selectedDate}
            />
            <DailyNotes 
              selectedDate={selectedDate}
              onNoteChange={refresh}
            />
          </div>

          {/* Métricas en Tiempo Real - Parte inferior */}
          <div className="mt-6">
            <RealtimeMetrics refreshTrigger={refreshTrigger} />
          </div>
        </div>
      </div>

      {/* Right Sidebar - Registros del Día */}
      <DailySidebar refreshTrigger={refreshTrigger} onDelete={refresh} />
    </div>
  );
};

export default DashboardPage;
