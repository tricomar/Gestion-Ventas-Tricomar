import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Users, Plus, Edit2, Trash2, Eye, Phone, MapPin, TrendingUp, Home, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CustomerForm from '../components/CustomerForm';
import CustomerDetailPanel from '../components/CustomerDetailPanel';
import BulkDeleteConfirmModal from '../components/BulkDeleteConfirmModal';
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
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  
  // Multi-select for bulk delete
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Búsqueda y paginación
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 30,
    total: 0,
    total_pages: 0
  });

  useEffect(() => {
    fetchCustomers();
  }, [filterStore, searchQuery, currentPage]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '30'
      });
      
      if (filterStore !== 'Todas') {
        params.append('store', filterStore);
      }
      
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }
      
      const response = await axios.get(`${API}/customers?${params.toString()}`);
      setCustomers(response.data.customers);
      setPagination(response.data.pagination);
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

  const handleViewDetail = (customerId) => {
    setSelectedCustomerId(customerId);
    setShowDetailPanel(true);
  };
  
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1); // Resetear a página 1 al buscar
  };
  
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };
  
  const handleStoreFilter = (storeId) => {
    setFilterStore(storeId);
    setCurrentPage(1); // Resetear a página 1 al cambiar filtro
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = customers.map(c => c.id);
      setSelectedCustomers(allIds);
    } else {
      setSelectedCustomers([]);
    }
  };

  const handleSelectCustomer = (customerId) => {
    setSelectedCustomers(prev => {
      const newSelection = prev.includes(customerId)
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId];
      return newSelection;
    });
  };

  const handleOpenDeleteModal = () => {
    setShowDeleteModal(true);
  };

  const handleBulkDelete = async () => {
    if (selectedCustomers.length === 0) return;

    setIsDeleting(true);
    
    try {
      await Promise.all(
        selectedCustomers.map(customerId => 
          axios.delete(`${API}/customers/${customerId}`)
        )
      );
      
      toast.success(`✓ ${selectedCustomers.length} cliente${selectedCustomers.length > 1 ? 's eliminados' : ' eliminado'} exitosamente`, {
        duration: 4000
      });
      
      setSelectedCustomers([]);
      setShowDeleteModal(false);
      fetchCustomers();
    } catch (error) {
      toast.error('Error al eliminar clientes');
      console.error('Error deleting customers:', error);
    } finally {
      setIsDeleting(false);
    }
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
        </div>
      </header>

      <div className="p-8">
        {/* Barra de búsqueda */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, email, teléfono o RUT..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-12 pr-4 py-3 border-2 border-slate-900 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-lime-400"
              style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-3">
            <button
              onClick={() => handleStoreFilter('Todas')}
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
                onClick={() => handleStoreFilter(store.id)}
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
            <p className="text-3xl font-black text-slate-900">{pagination.total}</p>
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
          <div>
            {/* Barra flotante de acciones masivas */}
            {selectedCustomers.length > 0 && (
              <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50">
                <div 
                  className="bg-slate-900 text-white border-4 border-white rounded-2xl px-6 py-4 flex items-center gap-6"
                  style={{ 
                    boxShadow: '0 10px 40px rgba(0,0,0,0.3), 0 0 0 4px rgba(15,23,42,1)',
                    minWidth: '400px'
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-lime-400 text-slate-900 rounded-full flex items-center justify-center font-black text-lg border-2 border-white">
                      {selectedCustomers.length}
                    </div>
                    <span className="font-bold text-base">
                      {selectedCustomers.length} cliente{selectedCustomers.length > 1 ? 's' : ''} seleccionado{selectedCustomers.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  
                  <div className="flex gap-3 ml-auto">
                    <button
                      onClick={handleOpenDeleteModal}
                      className="flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 rounded-lg font-bold transition-colors border-2 border-white"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar ({selectedCustomers.length})
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white border-2 border-slate-900 rounded-xl overflow-hidden" style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}>
              <div className="overflow-x-auto">
                <table className="w-full">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="px-4 py-3 text-center" style={{ width: '50px' }}>
                      <input
                        type="checkbox"
                        checked={selectedCustomers.length === customers.length && customers.length > 0}
                        onChange={handleSelectAll}
                        className="w-5 h-5 rounded border-2 border-white cursor-pointer"
                        title="Seleccionar todos"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase">Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase">Contacto</th>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase">Tienda/Caja</th>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase">Compras</th>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase">Gasto Total</th>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase">Última Compra</th>
                    <th className="px-6 py-3 text-center text-xs font-bold uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer, index) => (
                    <tr key={customer.id} className={`border-t-2 border-slate-200 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                      <td className="px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedCustomers.includes(customer.id)}
                          onChange={() => handleSelectCustomer(customer.id)}
                          className="w-5 h-5 rounded border-2 border-slate-900 cursor-pointer"
                        />
                      </td>
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
                          {getStoreName(customer.store)}
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
                            onClick={() => handleViewDetail(customer.id)}
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
        
        {/* Paginación */}
        {!loading && customers.length > 0 && (
          <div className="mt-6 flex items-center justify-between bg-white border-2 border-slate-900 rounded-xl p-4" style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}>
            <div className="text-sm text-slate-600">
              Mostrando {((currentPage - 1) * 30) + 1} a {Math.min(currentPage * 30, pagination.total)} de {pagination.total} clientes
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`flex items-center gap-1 px-4 py-2 border-2 border-slate-900 rounded-lg font-bold ${
                  currentPage === 1 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                    : 'bg-white hover:bg-slate-100'
                }`}
                style={currentPage === 1 ? {} : { boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>
              
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600">
                  Página {currentPage} de {pagination.total_pages}
                </span>
              </div>
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= pagination.total_pages}
                className={`flex items-center gap-1 px-4 py-2 border-2 border-slate-900 rounded-lg font-bold ${
                  currentPage >= pagination.total_pages 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                    : 'bg-white hover:bg-slate-100'
                }`}
                style={currentPage >= pagination.total_pages ? {} : { boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
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

      {/* Customer Detail Panel */}
      <CustomerDetailPanel
        customerId={selectedCustomerId}
        isOpen={showDetailPanel}
        onClose={() => {
          setShowDetailPanel(false);
          setSelectedCustomerId(null);
        }}
      />

      {/* Bulk Delete Modal */}
      {showDeleteModal && (
        <BulkDeleteConfirmModal
          itemCount={selectedCustomers.length}
          itemType="cliente"
          onConfirm={handleBulkDelete}
          onCancel={() => setShowDeleteModal(false)}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
};

export default CustomersPage;
