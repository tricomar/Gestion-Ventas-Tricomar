import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { LogOut, TrendingUp, TrendingDown, DollarSign, PlusCircle, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SalesForm from '../components/SalesForm';
import ExpenseForm from '../components/ExpenseForm';
import OtherIncomeForm from '../components/OtherIncomeForm';
import DailySidebar from '../components/DailySidebar';
import DashboardStats from '../components/DashboardStats';
import RealtimeMetrics from '../components/RealtimeMetrics';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('sales');
  const [todayTotal, setTodayTotal] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refresh = () => setRefreshTrigger(prev => prev + 1);

  useEffect(() => {
    const fetchTodayTotal = async () => {
      try {
        const response = await axios.get(`${API}/dashboard/stats`);
        setTodayTotal(response.data.today_sales);
      } catch (error) {
        console.error('Error fetching today total:', error);
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
          className="bg-white border-b-2 border-slate-900 py-4 px-6 md:px-8 flex justify-between items-center sticky top-0 z-50"
          data-testid="dashboard-header"
        >
          <div>
            <h1 
              className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900"
              style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}
            >
              Gestión de Ventas
            </h1>
            <p className="text-sm font-medium text-slate-600">Bienvenido, {user?.name}</p>
          </div>
          
          <div className="flex items-center gap-6">
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
        </header>

        {/* Realtime Metrics */}
        <div className="p-6 md:p-8 pb-0">
          <RealtimeMetrics refreshTrigger={refreshTrigger} />
        </div>

        {/* Content */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto">
          {/* Tab Navigation */}
          <div className="mb-6 flex gap-4 flex-wrap">
            <button
              onClick={() => navigate('/inventory')}
              className="px-6 py-3 rounded-xl font-bold border-2 border-slate-900 bg-white text-slate-600 hover:bg-slate-50 transition-all"
              style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
              data-testid="inventory-nav-btn"
            >
              <Package className="inline w-5 h-5 mr-2" />
              Inventario
            </button>
            <button
              onClick={() => setActiveTab('sales')}
              className={`px-6 py-3 rounded-xl font-bold border-2 border-slate-900 transition-all ${
                activeTab === 'sales' 
                  ? 'text-slate-900' 
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
              style={{
                backgroundColor: activeTab === 'sales' ? '#D4F0A5' : 'white',
                boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)'
              }}
              data-testid="sales-tab-btn"
            >
              <PlusCircle className="inline w-5 h-5 mr-2" />
              Ventas
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-6 py-3 rounded-xl font-bold border-2 border-slate-900 transition-all ${
                activeTab === 'expenses' 
                  ? 'text-slate-900' 
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
              style={{
                backgroundColor: activeTab === 'expenses' ? '#FFA8A8' : 'white',
                boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)'
              }}
              data-testid="expenses-tab-btn"
            >
              <TrendingDown className="inline w-5 h-5 mr-2" />
              Egresos
            </button>
            <button
              onClick={() => setActiveTab('income')}
              className={`px-6 py-3 rounded-xl font-bold border-2 border-slate-900 transition-all ${
                activeTab === 'income' 
                  ? 'text-slate-900' 
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
              style={{
                backgroundColor: activeTab === 'income' ? '#FADBB0' : 'white',
                boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)'
              }}
              data-testid="income-tab-btn"
            >
              <TrendingUp className="inline w-5 h-5 mr-2" />
              Otros Ingresos
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-6 py-3 rounded-xl font-bold border-2 border-slate-900 transition-all ${
                activeTab === 'dashboard' 
                  ? 'text-slate-900' 
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
              style={{
                backgroundColor: activeTab === 'dashboard' ? '#D4F0A5' : 'white',
                boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)'
              }}
              data-testid="dashboard-tab-btn"
            >
              <DollarSign className="inline w-5 h-5 mr-2" />
              Dashboard
            </button>
          </div>

          {/* Tab Content */}
          <div>
            {activeTab === 'sales' && <SalesForm onSuccess={refresh} />}
            {activeTab === 'expenses' && <ExpenseForm onSuccess={refresh} />}
            {activeTab === 'income' && <OtherIncomeForm onSuccess={refresh} />}
            {activeTab === 'dashboard' && <DashboardStats />}
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <DailySidebar refreshTrigger={refreshTrigger} onDelete={refresh} />
    </div>
  );
};

export default DashboardPage;
