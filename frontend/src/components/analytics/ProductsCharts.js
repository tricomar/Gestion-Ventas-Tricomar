import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Package } from 'lucide-react';

const ProductsCharts = ({ data }) => {
  const [viewMode, setViewMode] = useState('units'); // 'units' or 'revenue'
  
  if (!data) return null;

  const formatCurrency = (value) => `$${Math.round(value).toLocaleString('es-CL')}`;
  
  const currentData = viewMode === 'units' ? data.top_by_units : data.top_by_revenue;
  const dataKey = viewMode === 'units' ? 'units' : 'revenue';
  const label = viewMode === 'units' ? 'Unidades' : 'Ingresos';

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
        <Package className="w-6 h-6" />
        Análisis de Productos
      </h2>

      {/* Top 10 Productos */}
      <div className="bg-white border-2 border-slate-900 rounded-xl p-6" style={{ boxShadow: '6px 6px 0px 0px rgba(15,23,42,1)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Top 10 Productos</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('units')}
              className={`px-4 py-2 rounded-lg font-bold border-2 border-slate-900 transition-all ${viewMode === 'units' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900 hover:bg-slate-50'}`}
            >
              Por Unidades
            </button>
            <button
              onClick={() => setViewMode('revenue')}
              className={`px-4 py-2 rounded-lg font-bold border-2 border-slate-900 transition-all ${viewMode === 'revenue' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900 hover:bg-slate-50'}`}
            >
              Por Ingresos
            </button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={currentData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
            <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={viewMode === 'revenue' ? formatCurrency : undefined} />
            <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11 }} />
            <Tooltip 
              formatter={(value) => viewMode === 'revenue' ? formatCurrency(value) : value}
              contentStyle={{ backgroundColor: 'white', border: '2px solid #0f172a', borderRadius: '8px', fontWeight: 'bold' }}
            />
            <Bar dataKey={dataKey} name={label} fill="#D4F0A5" stroke="#0f172a" strokeWidth={2} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Productos Baja Rotación */}
      {data.low_rotation && data.low_rotation.length > 0 && (
        <div className="bg-white border-2 border-slate-900 rounded-xl p-6" style={{ boxShadow: '6px 6px 0px 0px rgba(15,23,42,1)' }}>
          <h3 className="text-lg font-bold text-slate-900 mb-4">Productos con Menor Rotación</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.low_rotation.map((product, index) => (
              <div key={index} className="p-4 bg-slate-50 border-2 border-slate-900 rounded-lg">
                <p className="font-bold text-slate-900">{product.name}</p>
                <p className="text-sm text-slate-600">{product.units} unidades - {formatCurrency(product.revenue)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsCharts;