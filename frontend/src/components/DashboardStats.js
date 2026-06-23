import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DashboardStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600 font-medium">Cargando estadísticas...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600 font-medium">Error al cargar estadísticas</p>
      </div>
    );
  }

  const paymentMethodData = Object.entries(stats.sales_by_payment_method).map(([method, value]) => ({
    name: method,
    value: value
  }));

  const COLORS = ['#D4F0A5', '#FADBB0', '#FFA8A8', '#A8E6FF', '#FFD4A8'];

  return (
    <div className="space-y-6" data-testid="dashboard-stats">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div 
          className="bg-white border-2 border-slate-900 rounded-xl p-6"
          style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)', backgroundColor: '#D4F0A5' }}
        >
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8" />
            <span className="text-xs font-bold uppercase">Hoy</span>
          </div>
          <p className="text-3xl font-black font-mono">
            ${stats.today_sales.toLocaleString('es-CL')}
          </p>
          <p className="text-sm font-medium text-slate-700 mt-1">Ventas</p>
        </div>

        <div 
          className="bg-white border-2 border-slate-900 rounded-xl p-6"
          style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)', backgroundColor: '#FFA8A8' }}
        >
          <div className="flex items-center justify-between mb-2">
            <TrendingDown className="w-8 h-8" />
            <span className="text-xs font-bold uppercase">Hoy</span>
          </div>
          <p className="text-3xl font-black font-mono">
            ${stats.today_expenses.toLocaleString('es-CL')}
          </p>
          <p className="text-sm font-medium text-slate-700 mt-1">Egresos</p>
        </div>

        <div 
          className="bg-white border-2 border-slate-900 rounded-xl p-6"
          style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)', backgroundColor: '#FADBB0' }}
        >
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-8 h-8" />
            <span className="text-xs font-bold uppercase">Mes</span>
          </div>
          <p className="text-3xl font-black font-mono">
            ${stats.monthly_sales.toLocaleString('es-CL')}
          </p>
          <p className="text-sm font-medium text-slate-700 mt-1">Ventas</p>
        </div>

        <div 
          className="bg-white border-2 border-slate-900 rounded-xl p-6"
          style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)', backgroundColor: 'white' }}
        >
          <div className="flex items-center justify-between mb-2">
            <ShoppingCart className="w-8 h-8" />
            <span className="text-xs font-bold uppercase">Neto</span>
          </div>
          <p className="text-3xl font-black font-mono">
            ${stats.today_net.toLocaleString('es-CL')}
          </p>
          <p className="text-sm font-medium text-slate-700 mt-1">Hoy</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Sales Trend */}
        <div 
          className="bg-white border-2 border-slate-900 rounded-xl p-6"
          style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
        >
          <h3 
            className="text-xl font-bold text-slate-900 mb-4"
            style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}
          >
            Ventas Últimos 7 Días
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.daily_sales_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
              <XAxis 
                dataKey="date" 
                stroke="#0f172a"
                style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700 }}
                tickFormatter={(value) => new Date(value).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })}
              />
              <YAxis 
                stroke="#0f172a"
                style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700 }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'white',
                  border: '2px solid #0f172a',
                  borderRadius: '12px',
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 600
                }}
              />
              <Line 
                type="monotone" 
                dataKey="total" 
                stroke="#0f172a" 
                strokeWidth={3}
                fill="#D4F0A5"
                dot={{ fill: '#0f172a', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Methods */}
        <div 
          className="bg-white border-2 border-slate-900 rounded-xl p-6"
          style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
        >
          <h3 
            className="text-xl font-bold text-slate-900 mb-4"
            style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}
          >
            Métodos de Pago (Hoy)
          </h3>
          {paymentMethodData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={paymentMethodData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  stroke="#0f172a"
                  strokeWidth={2}
                >
                  {paymentMethodData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '2px solid #0f172a',
                    borderRadius: '12px',
                    fontFamily: 'Manrope, sans-serif',
                    fontWeight: 600
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-slate-500 py-12">No hay datos de pagos hoy</p>
          )}
        </div>
      </div>

      {/* Top Products */}
      <div 
        className="bg-white border-2 border-slate-900 rounded-xl p-6"
        style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
      >
        <h3 
          className="text-xl font-bold text-slate-900 mb-4"
          style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}
        >
          Top 5 Productos (Este Mes)
        </h3>
        {stats.top_products.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.top_products}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
              <XAxis 
                dataKey="product" 
                stroke="#0f172a"
                style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 600 }}
              />
              <YAxis 
                stroke="#0f172a"
                style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700 }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'white',
                  border: '2px solid #0f172a',
                  borderRadius: '12px',
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 600
                }}
              />
              <Bar 
                dataKey="total" 
                fill="#D4F0A5" 
                stroke="#0f172a"
                strokeWidth={2}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-slate-500 py-12">No hay datos de productos este mes</p>
        )}
      </div>
    </div>
  );
};

export default DashboardStats;
