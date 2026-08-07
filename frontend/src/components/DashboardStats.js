import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, ShoppingBag, Package } from 'lucide-react';

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

  const paymentMethodData = Object.entries(stats.sales_by_payment_method || {}).map(([method, value]) => ({
    name: method,
    value: value
  }));

  const COLORS = ['#D4F0A5', '#FADBB0', '#FFA8A8', '#A8E6FF', '#FFD4A8'];
  
  const currencySymbol = stats.currency_symbol || '$';
  const todayNet = stats.today_sales - stats.today_expenses;

  return (
    <div className="space-y-6" data-testid="dashboard-stats">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today Sales */}
        <div 
          className="bg-white border-2 border-slate-900 rounded-xl p-6"
          style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)', backgroundColor: '#D4F0A5' }}
        >
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8" />
            <span className="text-xs font-bold uppercase">Hoy</span>
          </div>
          <p className="text-3xl font-black font-mono">
            {currencySymbol}{Math.round(stats.today_sales).toLocaleString('es-CL')}
          </p>
          <p className="text-sm font-medium text-slate-700 mt-1">Ventas Totales</p>
          <div className="mt-3 space-y-1">
            <p className="text-xs font-medium text-slate-600">
              POS: {currencySymbol}{Math.round(stats.today_pos_sales).toLocaleString('es-CL')}
            </p>
            <p className="text-xs font-medium text-slate-600">
              Ecommerce: {currencySymbol}{Math.round(stats.today_ecommerce_sales).toLocaleString('es-CL')}
            </p>
          </div>
        </div>

        {/* Today Expenses */}
        <div 
          className="bg-white border-2 border-slate-900 rounded-xl p-6"
          style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)', backgroundColor: '#FFA8A8' }}
        >
          <div className="flex items-center justify-between mb-2">
            <TrendingDown className="w-8 h-8" />
            <span className="text-xs font-bold uppercase">Hoy</span>
          </div>
          <p className="text-3xl font-black font-mono">
            {currencySymbol}{Math.round(stats.today_expenses).toLocaleString('es-CL')}
          </p>
          <p className="text-sm font-medium text-slate-700 mt-1">Egresos</p>
        </div>

        {/* Monthly Sales */}
        <div 
          className="bg-white border-2 border-slate-900 rounded-xl p-6"
          style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)', backgroundColor: '#FADBB0' }}
        >
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-8 h-8" />
            <span className="text-xs font-bold uppercase">Mes</span>
          </div>
          <p className="text-3xl font-black font-mono">
            {currencySymbol}{Math.round(stats.monthly_sales).toLocaleString('es-CL')}
          </p>
          <p className="text-sm font-medium text-slate-700 mt-1">Ventas Totales</p>
          <div className="mt-3 space-y-1">
            <p className="text-xs font-medium text-slate-600">
              POS: {currencySymbol}{Math.round(stats.monthly_pos_sales).toLocaleString('es-CL')}
            </p>
            <p className="text-xs font-medium text-slate-600">
              Ecommerce: {currencySymbol}{Math.round(stats.monthly_ecommerce_sales).toLocaleString('es-CL')}
            </p>
          </div>
        </div>

        {/* Net Today */}
        <div 
          className="bg-white border-2 border-slate-900 rounded-xl p-6"
          style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)', backgroundColor: todayNet >= 0 ? '#A8E6FF' : '#FFD4A8' }}
        >
          <div className="flex items-center justify-between mb-2">
            <ShoppingCart className="w-8 h-8" />
            <span className="text-xs font-bold uppercase">Neto</span>
          </div>
          <p className="text-3xl font-black font-mono">
            {currencySymbol}{Math.round(todayNet).toLocaleString('es-CL')}
          </p>
          <p className="text-sm font-medium text-slate-700 mt-1">Hoy</p>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div 
          className="bg-white border-2 border-slate-900 rounded-xl p-4"
          style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
        >
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-6 h-6 text-slate-900" />
            <div>
              <p className="text-2xl font-black font-mono">{stats.today_transactions}</p>
              <p className="text-xs font-medium text-slate-600">Transacciones Hoy</p>
            </div>
          </div>
        </div>

        <div 
          className="bg-white border-2 border-slate-900 rounded-xl p-4"
          style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
        >
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-slate-900" />
            <div>
              <p className="text-2xl font-black font-mono">{stats.total_products}</p>
              <p className="text-xs font-medium text-slate-600">Productos Totales</p>
            </div>
          </div>
        </div>

        <div 
          className="bg-white border-2 border-slate-900 rounded-xl p-4"
          style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
        >
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-6 h-6 text-slate-900" />
            <div>
              <p className="text-2xl font-black font-mono">{stats.ecommerce_orders_count}</p>
              <p className="text-xs font-medium text-slate-600">Órdenes Ecommerce (Mes)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Sales Chart (Last 30 days) */}
        <div 
          className="bg-white border-2 border-slate-900 rounded-xl p-6"
          style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
        >
          <h3 
            className="text-xl font-bold text-slate-900 mb-4"
            style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}
          >
            Ventas Últimos 30 Días
          </h3>
          {stats.daily_sales_chart && stats.daily_sales_chart.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.daily_sales_chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                <XAxis 
                  dataKey="date" 
                  stroke="#0f172a"
                  style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700 }}
                  tickFormatter={(value) => {
                    const parts = value.split('-');
                    return `${parts[2]}/${parts[1]}`;
                  }}
                />
                <YAxis 
                  stroke="#0f172a"
                  style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700 }}
                  tickFormatter={(value) => `${currencySymbol}${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '2px solid #0f172a',
                    borderRadius: '12px',
                    fontFamily: 'Manrope, sans-serif',
                    fontWeight: 600
                  }}
                  formatter={(value) => [`${currencySymbol}${Math.round(value).toLocaleString('es-CL')}`, 'Total']}
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
          ) : (
            <p className="text-center text-slate-500 py-12">No hay datos de ventas</p>
          )}
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
            Métodos de Pago (Este Mes)
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
                  formatter={(value) => [`${currencySymbol}${Math.round(value).toLocaleString('es-CL')}`, 'Total']}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-slate-500 py-12">No hay datos de pagos este mes</p>
          )}
        </div>
      </div>

      {/* Recent Sales */}
      {stats.recent_sales && stats.recent_sales.length > 0 && (
        <div 
          className="bg-white border-2 border-slate-900 rounded-xl p-6"
          style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
        >
          <h3 
            className="text-xl font-bold text-slate-900 mb-4"
            style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}
          >
            Ventas Recientes
          </h3>
          <div className="space-y-2">
            {stats.recent_sales.slice(0, 10).map((sale, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex-1">
                  <p className="font-semibold text-sm">{sale.product}</p>
                  <p className="text-xs text-slate-600">{sale.date}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg font-mono">{currencySymbol}{Math.round(sale.total).toLocaleString('es-CL')}</p>
                  <span className={`text-xs font-medium px-2 py-1 rounded ${
                    sale.type === 'POS' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {sale.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardStats;
