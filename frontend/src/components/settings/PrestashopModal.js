import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Check, Loader, ShoppingCart, RefreshCw, Package, Tag, Users, FileText, MessageSquare, Image, ShoppingBag } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Definición de recursos disponibles para sincronizar
const SYNC_RESOURCES = [
  {
    id: 'products',
    label: 'Productos y Marcas',
    description: 'Importa el catálogo completo de productos incluyendo nombres, SKU, marcas y descripciones',
    icon: Package,
    color: 'green',
    essential: true
  },
  {
    id: 'categories',
    label: 'Categorías',
    description: 'Importa la estructura de categorías y subcategorías de tu tienda',
    icon: Tag,
    color: 'purple',
    essential: true
  },
  {
    id: 'prices',
    label: 'Precios',
    description: 'Sincroniza precios de venta y precios de costo',
    icon: '$',
    color: 'yellow',
    essential: true
  },
  {
    id: 'stock',
    label: 'Stock / Inventario',
    description: 'Mantén actualizado el stock de productos en ambas plataformas',
    icon: Package,
    color: 'blue',
    essential: true
  },
  {
    id: 'images',
    label: 'Imágenes de Productos',
    description: 'Descarga y asocia las imágenes de productos a tu inventario local',
    icon: Image,
    color: 'indigo',
    essential: true
  },
  {
    id: 'orders',
    label: 'Órdenes / Pedidos',
    description: 'Importa pedidos completados con detalles de productos, clientes y pagos',
    icon: ShoppingBag,
    color: 'orange',
    essential: true
  },
  {
    id: 'customers',
    label: 'Clientes',
    description: 'Sincroniza información de clientes: nombres, emails, teléfonos y direcciones',
    icon: Users,
    color: 'teal',
    essential: false
  },
  {
    id: 'messages',
    label: 'Mensajes e Hilos',
    description: 'Importa conversaciones y mensajes de clientes para seguimiento',
    icon: MessageSquare,
    color: 'pink',
    essential: false
  },
  {
    id: 'abandoned_carts',
    label: 'Carritos Abandonados',
    description: 'Rastrea carritos de compra no finalizados para estrategias de recuperación',
    icon: ShoppingCart,
    color: 'red',
    essential: false
  },
  {
    id: 'completed_carts',
    label: 'Carritos Finalizados',
    description: 'Historial completo de carritos de compra convertidos en órdenes',
    icon: Check,
    color: 'emerald',
    essential: false
  }
];

const PrestashopModal = ({ isOpen, onClose, integration, onSuccess, stores }) => {
  const [step, setStep] = useState(1); // 1: Conexión, 2: Sincronización
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  
  // Formulario de conexión
  const [shopUrl, setShopUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [connectionStatus, setConnectionStatus] = useState(null);
  
  // Sincronización
  const [integrationId, setIntegrationId] = useState(null);
  const [syncingCategories, setSyncingCategories] = useState(false);
  const [syncingProducts, setSyncingProducts] = useState(false);
  const [categoriesCount, setCategoriesCount] = useState(0);
  const [productsCount, setProductsCount] = useState(0);
  const [syncProgress, setSyncProgress] = useState(0); // Porcentaje 0-100
  
  // Recursos a sincronizar (checkboxes)
  const [syncResources, setSyncResources] = useState({
    products: true,          // Productos (incluye marcas) - ESENCIAL
    categories: true,        // Categorías - ESENCIAL
    customers: false,        // Clientes
    orders: true,            // Órdenes/Pedidos - ESENCIAL
    messages: false,         // Mensajes e hilos de clientes
    images: true,            // Imágenes de productos - ESENCIAL
    abandoned_carts: false,  // Carritos abandonados
    completed_carts: false,  // Carritos finalizados
    stock: true,             // Stock de productos - ESENCIAL
    prices: true             // Precios de productos - ESENCIAL
  });
  
  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState({});
  
  // Estados para sincronización por lotes profesional
  const [batchSyncing, setBatchSyncing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({
    status: 'idle',
    progress_percentage: 0,
    current_batch: 0,
    total_batches: 0,
    synced_products: 0,
    failed_products: 0,
    total_products: 0,
    job_id: null
  });
  const [showBatchReport, setShowBatchReport] = useState(false);

  useEffect(() => {
    if (integration) {
      setShopUrl(integration.shop_url);
      setSelectedStoreId(integration.store_id);
      setIntegrationId(integration.id);
      setConnectionStatus('connected');
      setStep(2); // Si ya existe integración, ir directo a sincronización
    }
  }, [integration]);

  const handleTestConnection = async () => {
    if (!shopUrl || !apiKey) {
      toast.error('Completa todos los campos');
      return;
    }

    setTesting(true);
    try {
      // Intentar conectar (esto también valida la conexión)
      await axios.post(`${API}/integrations/prestashop/connect`, {
        shop_url: shopUrl,
        api_key: apiKey,
        store_id: selectedStoreId
      });
      
      setConnectionStatus('success');
      toast.success('✓ Conexión exitosa con PrestaShop');
    } catch (error) {
      setConnectionStatus('error');
      
      // Manejar diferentes tipos de errores
      let errorMsg = 'Error al conectar con PrestaShop';
      
      if (error.response?.data) {
        const data = error.response.data;
        
        // Si es un error de validación de Pydantic (422)
        if (Array.isArray(data.detail)) {
          errorMsg = data.detail.map(err => err.msg).join(', ');
        } else if (typeof data.detail === 'string') {
          errorMsg = data.detail;
        } else if (data.message) {
          errorMsg = data.message;
        }
      }
      
      toast.error(errorMsg);
    } finally {
      setTesting(false);
    }
  };

  const handleConnect = async (e) => {
    e.preventDefault();
    
    if (!shopUrl || !apiKey || !selectedStoreId) {
      toast.error('Completa todos los campos');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/integrations/prestashop/connect`, {
        shop_url: shopUrl,
        api_key: apiKey,
        store_id: selectedStoreId
      });
      
      setIntegrationId(response.data.integration_id);
      setConnectionStatus('connected');
      toast.success('Integración configurada exitosamente');
      
      // Refrescar lista de integraciones inmediatamente
      onSuccess();
      
      setStep(2); // Pasar a sincronización
    } catch (error) {
      // Manejar diferentes tipos de errores
      let errorMsg = 'Error al configurar integración';
      
      if (error.response?.data) {
        const data = error.response.data;
        
        // Si es un error de validación de Pydantic (422)
        if (Array.isArray(data.detail)) {
          errorMsg = data.detail.map(err => err.msg).join(', ');
        } else if (typeof data.detail === 'string') {
          errorMsg = data.detail;
        } else if (data.message) {
          errorMsg = data.message;
        }
      }
      
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncResources = async () => {
    if (!integrationId) return;
    
    // Obtener solo los recursos seleccionados
    const selectedResources = Object.keys(syncResources).filter(key => syncResources[key]);
    
    if (selectedResources.length === 0) {
      toast.error('Selecciona al menos un recurso para sincronizar');
      return;
    }

    setSyncing(true);
    setSyncProgress(0);
    setSyncResults({});
    
    try {
      // Iniciar sincronización
      const response = await axios.post(
        `${API}/integrations/prestashop/${integrationId}/sync`,
        { resources: selectedResources }
      );
      
      const jobId = response.data.job_id;
      
      // Polling para verificar progreso
      const pollInterval = setInterval(async () => {
        try {
          const jobResponse = await axios.get(`${API}/integrations/jobs/${jobId}`);
          const job = jobResponse.data;
          
          // Actualizar progreso
          setSyncProgress(job.progress || 0);
          setSyncResults(job.results || {});
          
          if (job.status === 'completed') {
            clearInterval(pollInterval);
            setSyncProgress(100);
            setSyncing(false);
            
            // Mostrar resumen
            const totalSynced = Object.values(job.results || {}).reduce((sum, val) => sum + (val || 0), 0);
            toast.success(`✓ Sincronización completada: ${totalSynced} elementos`, {
              duration: 5000
            });
            
            // DISPARAR EVENTO GLOBAL para recargar categorías
            console.log('🔔 Disparando evento reloadCategories');
            window.dispatchEvent(new CustomEvent('reloadCategories'));
          } else if (job.status === 'failed') {
            clearInterval(pollInterval);
            setSyncing(false);
            toast.error(`Error: ${job.message}`);
          }
        } catch (error) {
          console.error('Error polling job:', error);
        }
      }, 2000);
      
      // Timeout de seguridad (10 minutos)
      setTimeout(() => {
        clearInterval(pollInterval);
        if (syncing) {
          setSyncing(false);
          toast.error('Sincronización tomó demasiado tiempo. Verifica el estado más tarde.');
        }
      }, 600000);
      
    } catch (error) {
      let errorMsg = 'Error al sincronizar recursos';
      
      if (error.response?.data) {
        const data = error.response.data;
        if (Array.isArray(data.detail)) {
          errorMsg = data.detail.map(err => err.msg).join(', ');
        } else if (typeof data.detail === 'string') {
          errorMsg = data.detail;
        } else if (data.message) {
          errorMsg = data.message;
        }
      }
      
      toast.error(errorMsg);
      setSyncing(false);
    }
  };

  // Sincronización por lotes profesional (para productos)
  const handleBatchSync = async () => {
    if (!integrationId) return;
    
    setBatchSyncing(true);
    setBatchProgress({
      status: 'starting',
      progress_percentage: 0,
      current_batch: 0,
      total_batches: 0,
      synced_products: 0,
      failed_products: 0,
      total_products: 0,
      job_id: null
    });
    
    try {
      // Iniciar sincronización por lotes
      const response = await axios.post(
        `${API}/integrations/prestashop/${integrationId}/sync-batch`,
        {
          batch_size: 100,
          pause_seconds: 0.5,
          max_products: null // null = todos los productos
        }
      );
      
      const jobId = response.data.job_id;
      setBatchProgress(prev => ({ ...prev, job_id: jobId, status: 'running' }));
      
      toast.success('Sincronización por lotes iniciada');
      
      // Polling para verificar progreso
      const pollInterval = setInterval(async () => {
        try {
          const progressResponse = await axios.get(
            `${API}/integrations/prestashop/${integrationId}/sync-progress`
          );
          
          const progress = progressResponse.data;
          
          if (progress.status === 'not_started') {
            return;
          }
          
          setBatchProgress({
            status: progress.status,
            progress_percentage: progress.progress_percentage || 0,
            current_batch: progress.current_batch || 0,
            total_batches: progress.total_batches || 0,
            synced_products: progress.synced_products || 0,
            failed_products: progress.failed_products || 0,
            total_products: progress.total_products || 0,
            job_id: progress.id,
            errors_count: progress.errors_count || 0,
            incomplete_count: progress.incomplete_count || 0,
            report_path: progress.report_path
          });
          
          if (progress.status === 'completed') {
            clearInterval(pollInterval);
            setBatchSyncing(false);
            
            const message = `✓ Sincronización completada: ${progress.synced_products} productos sincronizados`;
            toast.success(message, { duration: 5000 });
            
            // Mostrar opción de descargar reporte
            if (progress.errors_count > 0 || progress.incomplete_count > 0) {
              setShowBatchReport(true);
            }
            
            // Recargar categorías si corresponde
            window.dispatchEvent(new CustomEvent('reloadCategories'));
          } else if (progress.status === 'error') {
            clearInterval(pollInterval);
            setBatchSyncing(false);
            toast.error(`Error en sincronización: ${progress.error_message || 'Error desconocido'}`);
          }
        } catch (error) {
          console.error('Error polling batch progress:', error);
        }
      }, 2000); // Polling cada 2 segundos
      
      // Timeout de seguridad (30 minutos para muchos productos)
      setTimeout(() => {
        clearInterval(pollInterval);
        if (batchSyncing) {
          setBatchSyncing(false);
          toast.warning('Sincronización tomó demasiado tiempo. Verifica el progreso manualmente.');
        }
      }, 1800000); // 30 minutos
      
    } catch (error) {
      let errorMsg = 'Error al iniciar sincronización por lotes';
      
      if (error.response?.data) {
        const data = error.response.data;
        if (typeof data.detail === 'string') {
          errorMsg = data.detail;
        } else if (data.message) {
          errorMsg = data.message;
        }
      }
      
      toast.error(errorMsg);
      setBatchSyncing(false);
    }
  };
  
  const downloadBatchReport = async () => {
    if (!batchProgress.job_id) return;
    
    try {
      const response = await axios.get(
        `${API}/sync-reports/${batchProgress.job_id}/download`,
        { responseType: 'blob' }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sync_report_${batchProgress.job_id}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Reporte descargado');
    } catch (error) {
      toast.error('Error descargando reporte');
    }
  };



  const handleToggleResource = (resourceId) => {
    setSyncResources(prev => ({
      ...prev,
      [resourceId]: !prev[resourceId]
    }));
  };

  const handleSelectAll = () => {
    const newState = {};
    SYNC_RESOURCES.forEach(resource => {
      newState[resource.id] = true;
    });
    setSyncResources(newState);
  };

  const handleSelectEssential = () => {
    const newState = {};
    SYNC_RESOURCES.forEach(resource => {
      newState[resource.id] = resource.essential;
    });
    setSyncResources(newState);
  };

  const handleFinish = () => {
    onSuccess();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div 
          className="bg-white border-4 border-slate-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          style={{ boxShadow: '12px 12px 0px 0px rgba(15,23,42,1)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-pink-500 to-rose-600 text-white px-6 py-4 flex justify-between items-center border-b-4 border-slate-900">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-6 h-6" />
              <h2 className="text-xl font-bold">
                {integration ? 'Configurar' : 'Conectar'} PrestaShop
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Steps indicator */}
          <div className="px-6 py-4 bg-slate-50 border-b-2 border-slate-200">
            <div className="flex items-center justify-center gap-4">
              <div className={`flex items-center gap-2 ${step >= 1 ? 'text-pink-600' : 'text-slate-400'}`}>
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold ${
                  step >= 1 ? 'bg-pink-100 border-pink-600' : 'border-slate-300'
                }`}>
                  {connectionStatus === 'connected' ? <Check className="w-5 h-5" /> : '1'}
                </div>
                <span className="font-semibold text-sm">Conexión</span>
              </div>
              
              <div className={`w-16 h-0.5 ${step >= 2 ? 'bg-pink-600' : 'bg-slate-300'}`} />
              
              <div className={`flex items-center gap-2 ${step >= 2 ? 'text-pink-600' : 'text-slate-400'}`}>
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold ${
                  step >= 2 ? 'bg-pink-100 border-pink-600' : 'border-slate-300'
                }`}>
                  2
                </div>
                <span className="font-semibold text-sm">Sincronización</span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {step === 1 && (
              <form onSubmit={handleConnect} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    URL de tu tienda PrestaShop
                  </label>
                  <input
                    type="url"
                    value={shopUrl}
                    onChange={(e) => setShopUrl(e.target.value)}
                    placeholder="https://tu-tienda.com"
                    className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-pink-500"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Ejemplo: https://tricomarpets.cl
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    API Key de PrestaShop
                  </label>
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="WN6A2FY5787TFLFXQ16VTM21377PDU5V"
                    className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Encuentra tu API Key en: PrestaShop → Parámetros Avanzados → Webservice
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Tienda/Caja asociada
                  </label>
                  <select
                    value={selectedStoreId}
                    onChange={(e) => setSelectedStoreId(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-pink-500"
                    required
                  >
                    <option value="">Selecciona una tienda...</option>
                    {stores && stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name} ({store.code})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Esta será el canal de ventas de PrestaShop
                  </p>
                  {stores && stores.length === 0 && (
                    <div className="mt-2 bg-yellow-50 border-2 border-yellow-600 rounded-lg p-3">
                      <p className="text-xs text-yellow-900 font-semibold">
                        ⚠️ No tienes tiendas configuradas. Ve a Configuración → Tiendas para crear una tienda primero.
                      </p>
                    </div>
                  )}
                </div>

                {connectionStatus === 'error' && (
                  <div className="bg-red-50 border-2 border-red-600 rounded-lg p-4">
                    <p className="text-sm text-red-900 font-semibold">
                      ✗ No se pudo conectar. Verifica la URL y API Key.
                    </p>
                  </div>
                )}

                {connectionStatus === 'success' && (
                  <div className="bg-green-50 border-2 border-green-600 rounded-lg p-4">
                    <p className="text-sm text-green-900 font-semibold">
                      ✓ Conexión exitosa con PrestaShop
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testing || !shopUrl || !apiKey || !selectedStoreId}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-100 text-blue-900 border-2 border-slate-900 rounded-xl px-6 py-3 font-bold hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {testing ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Probando...
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        Probar Conexión
                      </>
                    )}
                  </button>

                  <button
                    type="submit"
                    disabled={loading || connectionStatus !== 'success'}
                    className="flex-1 flex items-center justify-center gap-2 bg-pink-500 text-white border-2 border-slate-900 rounded-xl px-6 py-3 font-bold hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
                  >
                    {loading ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Conectando...
                      </>
                    ) : (
                      <>
                        Conectar y Continuar
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-900 rounded-xl p-4">
                  <p className="text-sm text-blue-900">
                    <strong>🔄 Selecciona los recursos a sincronizar</strong><br/>
                    Elige qué información quieres importar desde tu tienda PrestaShop. Los recursos esenciales están preseleccionados.
                  </p>
                </div>

                {/* Botones de selección rápida */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleSelectEssential}
                    className="flex-1 px-4 py-2 bg-green-100 border-2 border-green-600 rounded-lg font-bold text-green-900 hover:bg-green-200 transition-colors text-sm"
                  >
                    ✓ Solo Esenciales
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="flex-1 px-4 py-2 bg-blue-100 border-2 border-blue-600 rounded-lg font-bold text-blue-900 hover:bg-blue-200 transition-colors text-sm"
                  >
                    Seleccionar Todo
                  </button>
                </div>

                {/* Lista de recursos con checkboxes */}
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {SYNC_RESOURCES.map((resource) => {
                    const Icon = resource.icon;
                    const isSelected = syncResources[resource.id];
                    const colorClasses = {
                      green: 'from-green-50 to-green-100 border-green-600',
                      purple: 'from-purple-50 to-purple-100 border-purple-600',
                      yellow: 'from-yellow-50 to-yellow-100 border-yellow-600',
                      blue: 'from-blue-50 to-blue-100 border-blue-600',
                      indigo: 'from-indigo-50 to-indigo-100 border-indigo-600',
                      orange: 'from-orange-50 to-orange-100 border-orange-600',
                      teal: 'from-teal-50 to-teal-100 border-teal-600',
                      pink: 'from-pink-50 to-pink-100 border-pink-600',
                      red: 'from-red-50 to-red-100 border-red-600',
                      emerald: 'from-emerald-50 to-emerald-100 border-emerald-600'
                    };

                    return (
                      <div
                        key={resource.id}
                        className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                          isSelected 
                            ? `bg-gradient-to-br ${colorClasses[resource.color]} shadow-md` 
                            : 'bg-slate-50 border-slate-300 hover:border-slate-400'
                        }`}
                        onClick={() => handleToggleResource(resource.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex items-center pt-0.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-5 h-5 rounded border-2 border-slate-900 cursor-pointer"
                            />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {typeof Icon === 'string' ? (
                                <span className="text-lg">{Icon}</span>
                              ) : (
                                <Icon className="w-5 h-5" />
                              )}
                              <h4 className="font-bold text-slate-900">
                                {resource.label}
                                {resource.essential && (
                                  <span className="ml-2 px-2 py-0.5 bg-yellow-100 border border-yellow-600 rounded text-xs font-bold text-yellow-900">
                                    ESENCIAL
                                  </span>
                                )}
                              </h4>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {resource.description}
                            </p>
                            
                            {/* Mostrar resultado de sincronización si existe */}
                            {syncResults[resource.id] !== undefined && (
                              <div className="mt-2 flex items-center gap-2">
                                <Check className="w-4 h-4 text-green-600" />
                                <span className="text-xs font-bold text-green-800">
                                  {syncResults[resource.id]} elementos sincronizados
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Barra de progreso de sincronización */}
                {syncing && (
                  <div className="bg-white border-2 border-slate-900 rounded-xl p-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-700 font-semibold">Sincronizando recursos...</span>
                      <span className="text-slate-600 font-bold">{Math.round(syncProgress)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3 border-2 border-slate-900 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-pink-500 to-rose-600 h-full transition-all duration-500 ease-out"
                        style={{ width: `${syncProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-2 flex items-center gap-2">
                      <Loader className="w-3 h-3 animate-spin" />
                      Este proceso puede tardar varios minutos dependiendo de la cantidad de datos...
                    </p>
                  </div>
                )}

                {/* Mensaje de éxito */}
                {Object.keys(syncResults).length > 0 && !syncing && (
                  <div className="bg-green-50 border-2 border-green-600 rounded-lg p-4">
                    <p className="text-sm text-green-900 font-semibold mb-2">
                      ✓ Sincronización completada exitosamente
                    </p>
                    <p className="text-xs text-green-800">
                      Los recursos seleccionados se sincronizarán automáticamente cada 15 minutos.
                      Puedes volver a sincronizar manualmente cuando lo necesites.
                    </p>
                  </div>
                )}

                {/* Botones de acción */}
                <div className="flex justify-between gap-3 pt-4 border-t-2 border-slate-200">
                  <button
                    onClick={onClose}
                    className="px-6 py-3 bg-slate-100 border-2 border-slate-900 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                  >
                    {Object.keys(syncResults).length > 0 ? 'Cerrar' : 'Cancelar'}
                  </button>
                  
                  <div className="flex gap-3">
                    {/* Botón de Sincronización por Lotes (Profesional) */}
                    {syncResources.products && (
                      <button
                        onClick={handleBatchSync}
                        disabled={batchSyncing || syncing}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white border-2 border-slate-900 rounded-xl font-bold hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
                      >
                        {batchSyncing ? (
                          <>
                            <Loader className="w-5 h-5 animate-spin" />
                            Sincronizando...
                          </>
                        ) : (
                          <>
                            <Package className="w-5 h-5" />
                            Sincronización Profesional
                          </>
                        )}
                      </button>
                    )}
                    
                    <button
                      onClick={handleSyncResources}
                      disabled={syncing || batchSyncing || Object.keys(syncResources).filter(k => syncResources[k]).length === 0}
                      className="flex items-center gap-2 px-6 py-3 bg-pink-500 text-white border-2 border-slate-900 rounded-xl font-bold hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
                    >
                      {syncing ? (
                        <>
                          <Loader className="w-5 h-5 animate-spin" />
                          Sincronizando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-5 h-5" />
                          Sincronizar Rápida
                        </>
                      )}
                    </button>
                  </div>
                </div>
                
                {/* Barra de Progreso de Sincronización por Lotes */}
                {batchSyncing && (
                  <div className="mt-6 p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-600 rounded-xl">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-lg text-slate-900">Sincronización en Progreso</h3>
                      <div className="text-2xl font-bold text-green-600">
                        {batchProgress.progress_percentage}%
                      </div>
                    </div>
                    
                    {/* Barra de progreso visual */}
                    <div className="w-full h-6 bg-slate-200 rounded-full overflow-hidden mb-4 border-2 border-slate-900">
                      <div 
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500 ease-out flex items-center justify-end pr-2"
                        style={{ width: `${batchProgress.progress_percentage}%` }}
                      >
                        {batchProgress.progress_percentage > 10 && (
                          <span className="text-white font-bold text-sm">
                            {batchProgress.progress_percentage}%
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Estadísticas detalladas */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="bg-white p-3 rounded-lg border-2 border-slate-900">
                        <div className="text-xs text-slate-600 mb-1">Lote Actual</div>
                        <div className="text-xl font-bold text-slate-900">
                          {batchProgress.current_batch} / {batchProgress.total_batches}
                        </div>
                      </div>
                      
                      <div className="bg-white p-3 rounded-lg border-2 border-slate-900">
                        <div className="text-xs text-slate-600 mb-1">Total Productos</div>
                        <div className="text-xl font-bold text-slate-900">
                          {batchProgress.total_products}
                        </div>
                      </div>
                      
                      <div className="bg-white p-3 rounded-lg border-2 border-slate-900">
                        <div className="text-xs text-green-600 mb-1">✓ Sincronizados</div>
                        <div className="text-xl font-bold text-green-600">
                          {batchProgress.synced_products}
                        </div>
                      </div>
                      
                      <div className="bg-white p-3 rounded-lg border-2 border-slate-900">
                        <div className="text-xs text-red-600 mb-1">✗ Fallidos</div>
                        <div className="text-xl font-bold text-red-600">
                          {batchProgress.failed_products}
                        </div>
                      </div>
                    </div>
                    
                    {/* Mensaje de estado */}
                    <div className="text-center text-sm text-slate-700 font-medium">
                      {batchProgress.total_batches > 0 && (
                        <p>
                          Procesando lote {batchProgress.current_batch} de {batchProgress.total_batches}: 
                          <span className="font-bold text-green-600 ml-2">
                            {batchProgress.synced_products}/{batchProgress.total_products} productos
                          </span>
                        </p>
                      )}
                      {batchProgress.status === 'starting' && (
                        <p className="text-blue-600 font-bold">Iniciando sincronización...</p>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Reporte Final */}
                {showBatchReport && !batchSyncing && (
                  <div className="mt-6 p-6 bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-600 rounded-xl">
                    <h3 className="font-bold text-lg text-slate-900 mb-4">📊 Reporte de Sincronización</h3>
                    
                    <div className="space-y-3">
                      {batchProgress.errors_count > 0 && (
                        <div className="p-4 bg-red-50 border-2 border-red-600 rounded-lg">
                          <p className="text-red-900 font-bold">
                            ⚠️ {batchProgress.errors_count} productos fallaron
                          </p>
                          <p className="text-sm text-red-700 mt-1">
                            Revisa el reporte para ver detalles
                          </p>
                        </div>
                      )}
                      
                      {batchProgress.incomplete_count > 0 && (
                        <div className="p-4 bg-orange-50 border-2 border-orange-600 rounded-lg">
                          <p className="text-orange-900 font-bold">
                            📝 {batchProgress.incomplete_count} productos con datos incompletos
                          </p>
                          <p className="text-sm text-orange-700 mt-1">
                            (Sin imagen, descripción, marca o categoría)
                          </p>
                        </div>
                      )}
                      
                      <button
                        onClick={downloadBatchReport}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white border-2 border-slate-900 rounded-lg font-bold hover:bg-blue-600 transition-all"
                        style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
                      >
                        <FileText className="w-5 h-5" />
                        Descargar Reporte Completo (JSON)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default PrestashopModal;
