import React from 'react';
import { Users, User } from 'lucide-react';

const CustomersCharts = ({ data }) => {
  if (!data) return null;

  const formatCurrency = (value) => `$${Math.round(value).toLocaleString('es-CL')}`;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
        <Users className="w-6 h-6" />
        Análisis de Clientes
      </h2>

      {/* Nuevos vs Recurrentes */}
      {data.new_vs_recurring && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-[#E0E7FF] border-2 border-slate-900 rounded-xl" style={{ boxShadow: '6px 6px 0px 0px rgba(15,23,42,1)' }}>
            <h4 className="text-sm font-bold text-slate-700 uppercase mb-2">Clientes Nuevos</h4>
            <p className="text-4xl font-black text-slate-900">{data.new_vs_recurring.new}</p>
            <p className="text-sm text-slate-600 mt-1">Una sola compra</p>
          </div>
          <div className="p-6 bg-[#D4F0A5] border-2 border-slate-900 rounded-xl" style={{ boxShadow: '6px 6px 0px 0px rgba(15,23,42,1)' }}>
            <h4 className="text-sm font-bold text-slate-700 uppercase mb-2">Clientes Recurrentes</h4>
            <p className="text-4xl font-black text-slate-900">{data.new_vs_recurring.recurring}</p>
            <p className="text-sm text-slate-600 mt-1">Más de una compra</p>
          </div>
          <div className="p-6 bg-[#FADBB0] border-2 border-slate-900 rounded-xl" style={{ boxShadow: '6px 6px 0px 0px rgba(15,23,42,1)' }}>
            <h4 className="text-sm font-bold text-slate-700 uppercase mb-2">Frecuencia Promedio</h4>
            <p className="text-4xl font-black text-slate-900">{data.avg_purchase_frequency_days?.toFixed(1) || 0}</p>
            <p className="text-sm text-slate-600 mt-1">Días entre compras</p>
          </div>
        </div>
      )}

      {/* Ventas Identificadas vs Anónimas */}
      <div className="bg-white border-2 border-slate-900 rounded-xl p-6" style={{ boxShadow: '6px 6px 0px 0px rgba(15,23,42,1)' }}>
        <h3 className="text-lg font-bold text-slate-900 mb-4">Ventas Identificadas vs Anónimas</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-[#D4F0A5] border-2 border-slate-900 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <User className="w-6 h-6 text-slate-900" />
              <h4 className="text-sm font-bold text-slate-700 uppercase">Clientes Identificados</h4>
            </div>
            <p className="text-4xl font-black text-slate-900">{formatCurrency(data.identified_vs_anonymous.identified.total)}</p>
            <div className="mt-3 space-y-1">
              <p className="text-sm text-slate-700">
                <span className="font-bold">{data.identified_vs_anonymous.identified.percentage.toFixed(1)}%</span> del total
              </p>
              <p className="text-sm text-slate-700">
                <span className="font-bold">{data.identified_vs_anonymous.identified.count}</span> transacciones
              </p>
              <p className="text-sm text-slate-700">
                Ticket promedio: <span className="font-bold">{formatCurrency(data.identified_vs_anonymous.identified.avg_ticket)}</span>
              </p>
            </div>
          </div>
          <div className="p-6 bg-[#FECACA] border-2 border-slate-900 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-6 h-6 text-slate-900" />
              <h4 className="text-sm font-bold text-slate-700 uppercase">Ventas Anónimas</h4>
            </div>
            <p className="text-4xl font-black text-slate-900">{formatCurrency(data.identified_vs_anonymous.anonymous.total)}</p>
            <div className="mt-3 space-y-1">
              <p className="text-sm text-slate-700">
                <span className="font-bold">{data.identified_vs_anonymous.anonymous.percentage.toFixed(1)}%</span> del total
              </p>
              <p className="text-sm text-slate-700">
                <span className="font-bold">{data.identified_vs_anonymous.anonymous.count}</span> transacciones
              </p>
              <p className="text-sm text-slate-700">
                Ticket promedio: <span className="font-bold">{formatCurrency(data.identified_vs_anonymous.anonymous.avg_ticket)}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Clientes */}
      {data.top_customers && data.top_customers.length > 0 && (
        <div className="bg-white border-2 border-slate-900 rounded-xl p-6" style={{ boxShadow: '6px 6px 0px 0px rgba(15,23,42,1)' }}>
          <h3 className="text-lg font-bold text-slate-900 mb-4">Top 10 Clientes</h3>
          <div className="space-y-3">
            {data.top_customers.map((customer, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-slate-50 border-2 border-slate-900 rounded-lg hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 flex items-center justify-center bg-[#D4F0A5] border-2 border-slate-900 rounded-full">
                    <span className="font-black text-slate-900">#{index + 1}</span>
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{customer.name}</p>
                    <p className="text-sm text-slate-600">{customer.count} compras</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-slate-900">{formatCurrency(customer.total)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomersCharts;