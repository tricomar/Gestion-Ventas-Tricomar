import React, { useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

const TemporalCharts = ({ data }) => {
  if (!data) return null;

  const formatCurrency = (value) => {
    return `$${Math.round(value).toLocaleString('es-CL')}`;
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
        <TrendingUp className="w-6 h-6" />
        Comportamiento Temporal
      </h2>

      {/* Ventas Diarias */}
      <div className="bg-white border-2 border-slate-900 rounded-xl p-6" style={{ boxShadow: '6px 6px 0px 0px rgba(15,23,42,1)' }}>
        <h3 className="text-lg font-bold text-slate-900 mb-4">Ventas Diarias (Últimos 30 días)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.daily}>
            <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => new Date(value).getDate()}
            />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={formatCurrency} />
            <Tooltip 
              formatter={(value) => formatCurrency(value)}
              labelFormatter={(label) => new Date(label).toLocaleDateString('es-CL')}
              contentStyle={{ backgroundColor: 'white', border: '2px solid #0f172a', borderRadius: '8px', fontWeight: 'bold' }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="sales" 
              name="Ventas" 
              stroke="#84cc16" 
              strokeWidth={3}
              dot={{ fill: '#84cc16', r: 4 }}
            />
            <Line 
              type="monotone" 
              dataKey="avg_7_days" 
              name="Promedio 7 días" 
              stroke="#f97316" 
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Ventas Mensuales */}
      <div className="bg-white border-2 border-slate-900 rounded-xl p-6" style={{ boxShadow: '6px 6px 0px 0px rgba(15,23,42,1)' }}>
        <h3 className="text-lg font-bold text-slate-900 mb-4">Ventas Mensuales (Últimos 12 meses)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.monthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
            <XAxis 
              dataKey="month_name" 
              tick={{ fontSize: 12 }}
            />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={formatCurrency} />
            <Tooltip 
              formatter={(value) => formatCurrency(value)}
              contentStyle={{ backgroundColor: 'white', border: '2px solid #0f172a', borderRadius: '8px', fontWeight: 'bold' }}
            />
            <Bar 
              dataKey="sales" 
              name="Ventas" 
              fill="#D4F0A5" 
              stroke="#0f172a"
              strokeWidth={2}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Ventas por Hora y Día de Semana */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Por Hora */}
        <div className="bg-white border-2 border-slate-900 rounded-xl p-6" style={{ boxShadow: '6px 6px 0px 0px rgba(15,23,42,1)' }}>
          <h3 className="text-lg font-bold text-slate-900 mb-4">Ventas por Hora del Día</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.hourly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
              <XAxis 
                dataKey="hour" 
                tick={{ fontSize: 11 }}
                tickFormatter={(hour) => `${hour}:00`}
              />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={formatCurrency} />
              <Tooltip 
                formatter={(value) => formatCurrency(value)}
                labelFormatter={(hour) => `${hour}:00 - ${hour}:59`}
                contentStyle={{ backgroundColor: 'white', border: '2px solid #0f172a', borderRadius: '8px', fontWeight: 'bold' }}
              />
              <Bar 
                dataKey="sales" 
                name="Ventas" 
                fill="#FADBB0" 
                stroke="#0f172a"
                strokeWidth={2}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Por Día de Semana */}
        <div className="bg-white border-2 border-slate-900 rounded-xl p-6" style={{ boxShadow: '6px 6px 0px 0px rgba(15,23,42,1)' }}>
          <h3 className="text-lg font-bold text-slate-900 mb-4">Ventas por Día de Semana</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.weekday}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
              <XAxis 
                dataKey="day" 
                tick={{ fontSize: 11 }}
              />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={formatCurrency} />
              <Tooltip 
                formatter={(value) => formatCurrency(value)}
                contentStyle={{ backgroundColor: 'white', border: '2px solid #0f172a', borderRadius: '8px', fontWeight: 'bold' }}
              />
              <Bar 
                dataKey="sales" 
                name="Ventas" 
                fill="#FFE4E6" 
                stroke="#0f172a"
                strokeWidth={2}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default TemporalCharts;
