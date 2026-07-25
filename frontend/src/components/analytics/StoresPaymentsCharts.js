import React from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Store, CreditCard } from 'lucide-react';

const StoresPaymentsCharts = ({ data, stores }) => {
  if (!data) return null;

  const formatCurrency = (value) => `$${Math.round(value).toLocaleString('es-CL')}`;
  
  const COLORS = ['#D4F0A5', '#FADBB0', '#FFE4E6', '#E0E7FF', '#FEF3C7'];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
        <Store className="w-6 h-6" />
        Tiendas y Métodos de Pago
      </h2>

      {/* Comparativa Tiendas */}
      {data.stores_comparison && data.stores_comparison.length > 1 && (
        <div className="bg-white border-2 border-slate-900 rounded-xl p-6" style={{ boxShadow: '6px 6px 0px 0px rgba(15,23,42,1)' }}>
          <h3 className="text-lg font-bold text-slate-900 mb-4">Comparativa entre Tiendas</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.stores_comparison}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={formatCurrency} />
              <Tooltip 
                formatter={(value) => formatCurrency(value)}
                contentStyle={{ backgroundColor: 'white', border: '2px solid #0f172a', borderRadius: '8px', fontWeight: 'bold' }}
              />
              <Legend />
              <Bar dataKey="total" name="Ventas Totales" fill="#D4F0A5" stroke="#0f172a" strokeWidth={2} />
              <Bar dataKey="count" name="N° Ventas" fill="#FADBB0" stroke="#0f172a" strokeWidth={2} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Métodos de Pago */}
      <div className="bg-white border-2 border-slate-900 rounded-xl p-6" style={{ boxShadow: '6px 6px 0px 0px rgba(15,23,42,1)' }}>
        <h3 className="text-lg font-bold text-slate-900 mb-4">Distribución por Método de Pago</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.payment_distribution}
                dataKey="total"
                nameKey="method"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={(entry) => `${entry.method}: ${entry.percentage.toFixed(1)}%`}
                stroke="#0f172a"
                strokeWidth={2}
              >
                {data.payment_distribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value) => formatCurrency(value)}
                contentStyle={{ backgroundColor: 'white', border: '2px solid #0f172a', borderRadius: '8px', fontWeight: 'bold' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-3">
            {data.payment_distribution.map((payment, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-slate-50 border-2 border-slate-900 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-slate-900" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="font-bold text-slate-900">{payment.method}</span>
                </div>
                <div className="text-right">
                  <p className="font-black text-slate-900">{formatCurrency(payment.total)}</p>
                  <p className="text-xs text-slate-600">{payment.count} transacciones ({payment.percentage.toFixed(1)}%)</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoresPaymentsCharts;