import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trash2, DollarSign, TrendingUp, TrendingDown, Edit2, X } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DailySidebar = ({ refreshTrigger, onDelete }) => {
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [income, setIncome] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState({ open: false, type: null, data: null });

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

  const handleEdit = (type, record) => {
    setEditModal({ open: true, type, data: record });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const { type, data } = editModal;

    try {
      let endpoint = '';
      let payload = {};

      if (type === 'sales') {
        endpoint = `${API}/sales/${data.id}`;
        payload = {
          product_id: data.product_id,
          product_name: data.product_name,
          quantity: parseFloat(data.quantity),
          price: parseFloat(data.price),
          total: parseFloat(data.total),
          cost_price: parseFloat(data.cost_price),
          store: data.store,
          has_tax: data.has_tax,
          customer: data.customer || null,
          payment_method: data.payment_method
        };
      } else if (type === 'expenses') {
        endpoint = `${API}/expenses/${data.id}`;
        payload = {
          description: data.description,
          amount: parseFloat(data.amount),
          category: data.category
        };
      } else if (type === 'other-income') {
        endpoint = `${API}/other-income/${data.id}`;
        payload = {
          description: data.description,
          amount: parseFloat(data.amount)
        };
      }

      await axios.put(endpoint, payload);
      toast.success('Registro actualizado');
      setEditModal({ open: false, type: null, data: null });
      fetchTodayData();
      if (onDelete) onDelete(); // Trigger refresh in parent
    } catch (error) {
      toast.error('Error al actualizar');
      console.error('Error updating:', error);
    }
  };

  const updateEditData = (field, value) => {
    setEditModal(prev => ({
      ...prev,
      data: { ...prev.data, [field]: value }
    }));
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
                        onClick={() => handleEdit(
                          isSale ? 'sales' : isExpense ? 'expenses' : 'other-income',
                          record
                        )}
                        className="p-1 hover:bg-slate-900 hover:text-white rounded transition-colors"
                        data-testid={`edit-record-${record.id}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
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
                      <p className="font-bold text-slate-900">{record.product_name || record.product}</p>
                      <p className="text-sm text-slate-700">
                        {record.quantity} x ${record.price.toLocaleString('es-CL')}
                      </p>
                      <p className="text-xs text-slate-600">
                        Tienda {record.store} {record.has_tax ? '(Con IVA)' : '(Sin IVA)'}
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

      {/* Edit Modal */}
      {editModal.open && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          data-testid="edit-modal"
          onClick={() => setEditModal({ open: false, type: null, data: null })}
        >
          <div 
            className="bg-white border-2 border-slate-900 rounded-xl p-6 max-w-md w-full"
            style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>
                Editar Registro
              </h3>
              <button
                onClick={() => setEditModal({ open: false, type: null, data: null })}
                className="p-1 hover:bg-slate-100 rounded"
                data-testid="close-edit-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              {editModal.type === 'sales' && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Producto</label>
                    <input
                      type="text"
                      value={editModal.data.product_name}
                      onChange={(e) => updateEditData('product_name', e.target.value)}
                      className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      required
                      data-testid="edit-product-name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Cantidad</label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={editModal.data.quantity}
                        onChange={(e) => updateEditData('quantity', e.target.value)}
                        className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                        required
                        data-testid="edit-quantity"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Precio</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editModal.data.price}
                        onChange={(e) => updateEditData('price', e.target.value)}
                        className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                        required
                        data-testid="edit-price"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Total</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editModal.data.total}
                      onChange={(e) => updateEditData('total', e.target.value)}
                      className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      required
                      data-testid="edit-total"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Método de Pago</label>
                    <select
                      value={editModal.data.payment_method}
                      onChange={(e) => updateEditData('payment_method', e.target.value)}
                      className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      required
                      data-testid="edit-payment-method"
                    >
                      <option value="Efectivo">Efectivo</option>
                      <option value="Tarjeta">Tarjeta</option>
                      <option value="Transferencia">Transferencia</option>
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editModal.data.has_tax}
                        onChange={(e) => updateEditData('has_tax', e.target.checked)}
                        className="w-4 h-4"
                        data-testid="edit-has-tax"
                      />
                      <span className="text-sm font-bold text-slate-700">Incluye IVA</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Cliente (opcional)</label>
                    <input
                      type="text"
                      value={editModal.data.customer || ''}
                      onChange={(e) => updateEditData('customer', e.target.value)}
                      className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      data-testid="edit-customer"
                    />
                  </div>
                </>
              )}

              {editModal.type === 'expenses' && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Descripción</label>
                    <input
                      type="text"
                      value={editModal.data.description}
                      onChange={(e) => updateEditData('description', e.target.value)}
                      className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      required
                      data-testid="edit-expense-description"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Monto</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editModal.data.amount}
                      onChange={(e) => updateEditData('amount', e.target.value)}
                      className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      required
                      data-testid="edit-expense-amount"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Categoría</label>
                    <select
                      value={editModal.data.category}
                      onChange={(e) => updateEditData('category', e.target.value)}
                      className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      required
                      data-testid="edit-expense-category"
                    >
                      <option value="compra_inventario">Compra Inventario</option>
                      <option value="retiros">Retiros</option>
                      <option value="compras_informales">Compras Informales</option>
                      <option value="otros">Otros</option>
                    </select>
                  </div>
                </>
              )}

              {editModal.type === 'other-income' && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Descripción</label>
                    <input
                      type="text"
                      value={editModal.data.description}
                      onChange={(e) => updateEditData('description', e.target.value)}
                      className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      required
                      data-testid="edit-income-description"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Monto</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editModal.data.amount}
                      onChange={(e) => updateEditData('amount', e.target.value)}
                      className="w-full px-3 py-2 border-2 border-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      required
                      data-testid="edit-income-amount"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModal({ open: false, type: null, data: null })}
                  className="flex-1 px-4 py-2 border-2 border-slate-900 rounded-lg font-bold hover:bg-slate-50 transition-colors"
                  data-testid="cancel-edit-btn"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#D4F0A5] border-2 border-slate-900 rounded-lg font-bold hover:bg-[#c5e196] transition-colors"
                  style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
                  data-testid="save-edit-btn"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailySidebar;
