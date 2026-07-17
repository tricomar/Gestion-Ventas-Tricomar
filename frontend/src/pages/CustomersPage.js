import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Users, Plus, Edit2, Trash2, Eye, Phone, MapPin, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CustomerForm from '../components/CustomerForm';
import { useSettings } from '../context/SettingsContext';
import { useStores } from '../hooks/useStores';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CustomersPage = () => {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { stores, getStoreName } = useStores();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [filterStore, setFilterStore] = useState('Todas');

  useEffect(() => {
    fetchCustomers();
  }, [filterStore]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const url = filterStore === 'Todas' 
        ? `${API}/customers`
        : `${API}/customers?store=${filterStore}`;
      const response = await axios.get(url);
      setCustomers(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Error al cargar clientes');
      setLoading(false);
    }
  };

  const handleDelete = async (customerId, customerName) => {
    if (!window.confirm(`¿Estás seguro de eliminar a ${customerName}?`)) return;

    try {
      await axios.delete(`${API}/customers/${customerId}`);
      toast.success('Cliente eliminado');
      fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error('Error al eliminar cliente');
    }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setShowForm(true);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b-2 border-slate-900 py-6 px-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
              <Users className="w-8 h-8" />
              Gestión de Clientes
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Administra la información de tus clientes y su historial de compras
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-white border-2 border-slate-900 rounded-xl font-bold hover:bg-slate-50"
            style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
          >
            ← Volver al Dashboard
          </button>
        </div>
      </header>

      <div className="p-8">
        {/* Controls */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-3">
            <button
              onClick={() => setFilterStore('Todas')}
              className={`px-4 py-2 rounded-lg font-bold border-2 border-slate-900 ${
                filterStore === 'Todas' ? 'bg-slate-900 text-white' : 'bg-white'
              }`}
              style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
            >
              Todas
            </button>
            {stores && stores.map((store, index) => (
              <button
                key={store.id}
                onClick={() => setFilterStore(store.id)}
                className={`px-4 py-2 rounded-lg font-bold border-2 border-slate-900 ${
                  filterStore === store.id 
                    ? index === 0 ? 'bg-lime-200' : 'bg-orange-200'
                    : 'bg-white'
                }`}
                style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
              >
                {store.name}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              setEditingCustomer(null);
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-lime-200 border-2 border-slate-900 rounded-xl font-bold hover:bg-lime-300"
            style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
          >
            <Plus className="w-5 h-5" />
            Nuevo Cliente
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border-2 border-slate-900 rounded-xl p-4" style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}>
            <p className="text-xs font-bold text-slate-500 uppercase">Total Clientes</p>
            <p className="text-3xl font-black text-slate-900">{customers.length}</p>
          </div>
          <div className="bg-white border-2 border-slate-900 rounded-xl p-4" style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}>
            <p className="text-xs font-bold text-slate-500 uppercase">Compras Totales</p>
            <p className="text-3xl font-black text-slate-900">
              {customers.reduce((sum, c) => sum + (c.purchase_count || 0), 0)}
            </p>
          </div>
          <div className="bg-white border-2 border-slate-900 rounded-xl p-4" style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}>
            <p className="text-xs font-bold text-slate-500 uppercase">Gasto Total</p>
            <p className="text-3xl font-black text-slate-900">
              ${customers.reduce((sum, c) => sum + (c.total_spent || 0), 0).toLocaleString('es-CL')}
            </p>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-12">Cargando clientes...</div>
        ) : customers.length === 0 ? (
          <div className="text-center py-12 bg-white border-2 border-slate-900 rounded-xl">
            <Users className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">No hay clientes registrados</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 px-6 py-2 bg-lime-200 border-2 border-slate-900 rounded-lg font-bold"
            >
              Crear primer cliente
            </button>
          </div>
        ) : (
          <div className="bg-white border-2 border-slate-900 rounded-xl overflow-hidden" style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase">Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase">Contacto</th>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase">Tienda</th>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase">Compras</th>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase">Gasto Total</th>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase">Última Compra</th>
                    <th className="px-6 py-3 text-center text-xs font-bold uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer, index) => (
                    <tr key={customer.id} className={`border-t-2 border-slate-200 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{customer.name}</div>
                        {customer.address && (
                          <div className="text-xs text-slate-600 flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" />
                            {customer.address}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {customer.phone ? (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="w-4 h-4 text-slate-400" />
                            {customer.phone}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 border-slate-900 ${
                          customer.store === 'A' ? 'bg-lime-200' :
                          customer.store === 'B' ? 'bg-orange-200' :
                          'bg-blue-200'
                        }`}>
                          {customer.store === 'Ambas' ? 'Ambas' : `Tienda ${customer.store}`}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                          <span className="font-bold">{customer.purchase_count || 0}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-green-600">
                          ${(customer.total_spent || 0).toLocaleString('es-CL')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {customer.last_purchase_date || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => navigate(`/customers/${customer.id}`)}
                            className="p-2 bg-blue-100 border-2 border-slate-900 rounded-lg hover:bg-blue-200"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(customer)}
                            className="p-2 bg-yellow-100 border-2 border-slate-900 rounded-lg hover:bg-yellow-200"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(customer.id, customer.name)}
                            className="p-2 bg-red-100 border-2 border-slate-900 rounded-lg hover:bg-red-200"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Customer Form Modal */}
      {showForm && (
        <CustomerForm
          customer={editingCustomer}
          storeAName={settings.store_a_name}
          storeBName={settings.store_b_name}
          onClose={() => {
            setShowForm(false);
            setEditingCustomer(null);
          }}
          onSuccess={() => {
            fetchCustomers();
          }}
        />
      )}
    </div>
  );
};

export default CustomersPage;
