import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trash2, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DailySidebar = ({ refreshTrigger, onDelete }) => {
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [income, setIncome] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTodayData();
  }, [refreshTrigger]);

  const fetchTodayData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [salesRes, expensesRes, incomeRes] = await Promise.all([
        axios.get(`${API}/sales?date=${today}`),
        axios.get(`${API}/expenses?date=${today}`),
        axios.get(`${API}/other-income?date=${today}`)
      ]);

      setSales(salesRes.data);
      setExpenses(expensesRes.data);
      setIncome(incomeRes.data);
    } catch (error) {
      console.error('Error fetching today data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm('¿Estás seguro de eliminar este registro?')) return;

    try {
      await axios.delete(`${API}/${type}/${id}`);
      toast.success('Registro eliminado');
      fetchTodayData();
      if (onDelete) onDelete();
    } catch (error) {
      toast.error('Error al eliminar');
      console.error('Error deleting:', error);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  };

  const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const totalIncome = income.reduce((sum, inc) => sum + inc.amount, 0);

  return (
    <div 
      className="w-full md:w-80 lg:w-96 hidden md:flex border-l-2 border-slate-900 bg-white flex-col h-screen overflow-y-auto"
      data-testid="daily-sidebar"
    >
      <div className="sticky top-0 bg-white border-b-2 border-slate-900 p-4 z-10">
        <h3 
          className="text-xl font-bold text-slate-900"
          style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}
        >
          Registros del Día
        </h3>
        <p className="text-sm font-medium text-slate-600">
          {new Date().toLocaleDateString('es-CL', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="p-4 space-y-3 border-b-2 border-slate-900">
        <div className="bg-[#D4F0A5] border-2 border-slate-900 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              <span className="text-xs font-bold uppercase">Ventas</span>
            </div>
            <span className="font-mono font-bold text-lg">
              ${totalSales.toLocaleString('es-CL')}
            </span>
          </div>
        </div>

        <div className="bg-[#FFA8A8] border-2 border-slate-900 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5" />
              <span className="text-xs font-bold uppercase">Egresos</span>
            </div>
            <span className="font-mono font-bold text-lg">
              ${totalExpenses.toLocaleString('es-CL')}
            </span>
          </div>
        </div>

        <div className="bg-[#FADBB0] border-2 border-slate-900 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              <span className="text-xs font-bold uppercase">Otros</span>
            </div>
            <span className="font-mono font-bold text-lg">
              ${totalIncome.toLocaleString('es-CL')}
            </span>
          </div>
        </div>
      </div>

      {/* Records List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <p className="text-center text-slate-500">Cargando...</p>
        ) : (
          [...sales, ...expenses, ...income]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .map((record) => {
              const isSale = 'product' in record;
              const isExpense = 'description' in record && !('product' in record) && record.amount < 0 || (!('product' in record) && expenses.find(e => e.id === record.id));
              const isIncome = 'description' in record && !isSale && !isExpense;

              let bgColor = '#D4F0A5';
              let type = 'Venta';
              let icon = DollarSign;

              if (isExpense) {
                bgColor = '#FFA8A8';
                type = 'Egreso';
                icon = TrendingDown;
              } else if (isIncome) {
                bgColor = '#FADBB0';
                type = 'Ingreso';
                icon = TrendingUp;
              }

              const Icon = icon;

              return (
                <div
                  key={record.id}
                  className="border-2 border-slate-900 rounded-xl p-3 transition-all hover:shadow-lg"
                  style={{ backgroundColor: bgColor }}
                  data-testid={`record-item-${record.id}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase">{type}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">
                        {formatTime(record.created_at)}
                      </span>
                      <button
                        onClick={() => handleDelete(
                          isSale ? 'sales' : isExpense ? 'expenses' : 'other-income',
                          record.id
                        )}
                        className="p-1 hover:bg-slate-900 hover:text-white rounded transition-colors"
                        data-testid={`delete-record-${record.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {isSale ? (
                    <>
                      <p className="font-bold text-slate-900">{record.product}</p>
                      <p className="text-sm text-slate-700">
                        {record.quantity} x ${record.price.toLocaleString('es-CL')}
                      </p>
                      {record.customer && (
                        <p className="text-sm text-slate-600">Cliente: {record.customer}</p>
                      )}
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs bg-slate-900 text-white px-2 py-1 rounded-full">
                          {record.payment_method}
                        </span>
                        <span className="font-mono font-bold text-lg">
                          ${record.total.toLocaleString('es-CL')}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="font-bold text-slate-900">{record.description}</p>
                      <p className="font-mono font-bold text-lg mt-2">
                        ${record.amount.toLocaleString('es-CL')}
                      </p>
                    </>
                  )}
                </div>
              );
            })
        )}

        {!loading && sales.length === 0 && expenses.length === 0 && income.length === 0 && (
          <p className="text-center text-slate-500 mt-8">No hay registros hoy</p>
        )}
      </div>
    </div>
  );
};

export default DailySidebar;
