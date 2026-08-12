import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Check, Loader, ShoppingCart, RefreshCw, Package, Tag, Users, FileText, MessageSquare, Image, ShoppingBag } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Definición de recursos disponibles para sincronizar
// Estructura de recursos organizados por etapas secuenciales
const SYNC_STAGES = {
  // ETAPA 1: Categorías (Obligatorio primero)
  stage1: {
    id: 'stage1',
    title: 'Paso 1: Sincronizar Categorías',
    description: 'Primero debes sincronizar las categorías para organizar correctamente tus productos',
    required: true,
    resources: [
      {
        id: 'categories',
        label: 'Categorías',
        description: 'Estructura completa de categorías y subcategorías de tu tienda',
        icon: Tag,
        color: 'green',
        stage: 1
      }
    ]
  },
  
  // ETAPA 2: Productos (Después de categorías)
  stage2: {
    id: 'stage2',
    title: 'Paso 2: Sincronizar Productos Completos',
    description: 'Ahora puedes sincronizar productos con toda su información',
    required: true,
    dependsOn: 'stage1',
    resources: [
      {
        id: 'products',
        label: 'Productos Completos',
        description: 'Marca, Precio, Stock, Imagen, SKU, Código de Barra, Resumen, Descripción, Peso y Combinaciones',
        icon: Package,
        color: 'purple',
        stage: 2
      }
    ]
  },
  
  // ETAPA 3: Resto de recursos (Después de productos)
  stage3: {
    id: 'stage3',
    title: 'Paso 3: Sincronizar Datos Adicionales',
    description: 'Complementa tu integración con órdenes, clientes y más',
    required: false,
    dependsOn: 'stage2',
    resources: [
      {
        id: 'orders',
        label: 'Órdenes / Pedidos',
        description: 'Historial de pedidos completados con detalles',
        icon: ShoppingBag,
        color: 'orange',
        stage: 3
      },
      {
        id: 'customers',
        label: 'Clientes',
        description: 'Información de clientes: nombres, emails, teléfonos',
        icon: Users,
        color: 'teal',
        stage: 3
      },
      {
        id: 'messages',
        label: 'Mensajes e Hilos',
        description: 'Conversaciones y mensajes de clientes',
        icon: MessageSquare,
        color: 'pink',
        stage: 3
      },
      {
        id: 'abandoned_carts',
        label: 'Carritos Abandonados',
        description: 'Carritos no finalizados para estrategias de recuperación',
        icon: ShoppingCart,
        color: 'red',
        stage: 3
      }
    ]
  }
};

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
  
  // Estados para sincronización de stock (Fase 2)
  const [syncingStock, setSyncingStock] = useState(false);
  const [stockConflicts, setStockConflicts] = useState([]);
  const [showConflictsModal, setShowConflictsModal] = useState(false);
  const [loadingConflicts, setLoadingConflicts] = useState(false);
  
  // Estados para etapas de sincronización secuencial
  const [completedStages, setCompletedStages] = useState({
    stage1: false,    // Etapa 1: Categorías
    stage2: false,    // Etapa 2: Productos
    stage3: false     // Etapa 3: Resto (órdenes, clientes, etc.)
  });
  
  const [currentStage, setCurrentStage] = useState('stage1'); // Etapa actual visible

  useEffect(() => {
    if (integration) {
      setShopUrl(integration.shop_url);
      setSelectedStoreId(integration.store_id);
      setIntegrationId(integration.id);
      setConnectionStatus('connected');
      setStep(2); // Si ya existe integración, ir directo a sincronización
      
      // Verificar qué etapas ya están completadas - pasar integration.id directamente
      checkCompletedStages(integration.id, integration.store_id);
    }
  }, [integration]);
  
  const checkCompletedStages = async (integId, storeId) => {
    if (!integId) return;
    
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      
      // Verificar si hay categorías sincronizadas PARA ESTA INTEGRACIÓN
      const categoriesResponse = await axios.get(`${API}/categories`, { headers });
      const categories = categoriesResponse.data || [];
      const hasCategories = categories.some(cat => 
        cat.prestashop_integration_id === integId || cat.store_id === storeId
      );
      
      // Verificar si hay productos sincronizados PARA ESTA INTEGRACIÓN
      const productsResponse = await axios.get(`${API}/products/search?query=`, { headers });
      const products = productsResponse.data || [];
      const hasProducts = products.some(prod => 
        prod.prestashop_integration_id === integId || prod.store_id === storeId
      );
      
      // Determinar si hay integración existente
      const hasExistingIntegration = hasCategories || hasProducts;
      
      setCompletedStages({
        stage1: hasCategories,
        stage2: hasProducts,
        stage3: false // Por ahora, órdenes/clientes no son verificables fácilmente
      });
      
      // Si ya existe integración previa, ir directo a vista de resincronización (stage3)
      // En lugar del flujo secuencial
      if (hasExistingIntegration) {
        setCurrentStage('stage3'); // Mostrar todos los recursos con checkboxes
      } else {
        // Primera vez: flujo secuencial
        if (!hasCategories) {
          setCurrentStage('stage1');
        } else if (!hasProducts) {
          setCurrentStage('stage2');
        } else {
          setCurrentStage('stage3');
        }
      }
    } catch (error) {
      console.error('Error verificando etapas completadas:', error);
    }
  };

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

  const handleSyncResources = async (resources = null) => {
    if (!integrationId) return;
    
    // Si no se pasan recursos, obtener de syncResources
    const selectedResources = resources || Object.keys(syncResources).filter(key => syncResources[key]);
    
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
            
            // Marcar etapa 1 (categorías) como completada
            if (selectedResources.includes('categories')) {
              setCompletedStages(prev => ({ ...prev, stage1: true }));
              setCurrentStage('stage2');
            }
            
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
      // Iniciar sincronización RÁPIDA (optimizada con offset)
      const response = await axios.post(
        `${API}/integrations/prestashop/${integrationId}/sync-products-fast`
      );
      
      const jobId = response.data.job_id;
      setBatchProgress(prev => ({ ...prev, job_id: jobId, status: 'running' }));
      
      toast.success('🚀 Sincronización rápida iniciada', {
        duration: 5000
      });
      
      // Polling para verificar progreso
      const pollInterval = setInterval(async () => {
        try {
          const progressResponse = await axios.get(
            `${API}/integrations/prestashop/sync-progress-v2/${jobId}`
          );
          
          const progress = progressResponse.data;
          
          // El BatchSyncService puede devolver status 'running', 'completed', 'error'
          if (!progress) {
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
            products_created: progress.products_created || 0,
            products_updated: progress.products_updated || 0,
            products_skipped: progress.products_skipped || 0,
            job_id: jobId,
            errors_count: progress.errors_count || 0,
            incomplete_count: progress.incomplete_count || 0,
            report_path: progress.report_path || null
          });
          
          if (progress.status === 'completed') {
            clearInterval(pollInterval);
            setBatchSyncing(false);
            
            // Mensaje detallado con estadísticas
            const stats = [
              `✓ ${progress.synced_products} productos`,
              progress.products_created > 0 ? `✨ ${progress.products_created} nuevos` : null,
              progress.products_updated > 0 ? `🔄 ${progress.products_updated} actualizados` : null,
              progress.products_skipped > 0 ? `⏩ ${progress.products_skipped} sin cambios` : null,
              progress.failed_products > 0 ? `❌ ${progress.failed_products} fallidos` : null
            ].filter(Boolean).join(' | ');
            
            // Comparar con total disponible
            const completeness = progress.total_products && progress.total_products > progress.synced_products
              ? `\n⚠️  ${progress.synced_products}/${progress.total_products} sincronizados`
              : `\n✅ 100% completado`;
            
            toast.success(`Sincronización completada\n${stats}${completeness}`, { duration: 8000 });
            
            // Marcar etapa 2 como completada
            setCompletedStages(prev => ({ ...prev, stage2: true }));
            setCurrentStage('stage3');
            
            // Mostrar opción de descargar reporte si hay errores
            if (progress.failed_products > 0) {
              setShowBatchReport(true);
            }
            
            // Recargar categorías si corresponde
            window.dispatchEvent(new CustomEvent('reloadCategories'));
          } else if (progress.status === 'failed') {
            clearInterval(pollInterval);
            setBatchSyncing(false);
            toast.error(`Error en sincronización: ${progress.error || 'Error desconocido'}`);
          }
        } catch (error) {
          console.error('Error polling batch progress:', error);
        }
      }, 2000); // Polling cada 2 segundos
      
      // Timeout de seguridad aumentado (15 minutos, más que suficiente para 10k productos)
      setTimeout(() => {
        clearInterval(pollInterval);
        if (batchSyncing) {
          setBatchSyncing(false);
          toast.warning('⏱️ Sincronización tomó más de lo esperado. Verifica en Inventario.');
        }
      }, 900000); // 15 minutos (vs 30 minutos anterior, ahora es mucho más rápido)
      
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

  // ============================================================================
  // FUNCIONES DE SINCRONIZACIÓN DE STOCK (FASE 2)
  // ============================================================================
  
  const handleSyncStockFromPrestaShop = async () => {
    if (!integration?.id) return;
    
    setSyncingStock(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/integrations/prestashop/${integration.id}/stock/sync-from-ps`,
        { product_ids: null }, // null = sincronizar todos los productos
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.success) {
        toast.success(`✅ Stock sincronizado: ${response.data.synced_count} productos actualizados`);
        
        if (response.data.conflicts_detected > 0) {
          toast.warning(`⚠️ ${response.data.conflicts_detected} conflictos detectados`);
        }
        
        // Recargar para reflejar cambios
        if (onSuccess) onSuccess();
      }
    } catch (error) {
      console.error('Error sincronizando stock:', error);
      toast.error(error.response?.data?.detail || 'Error al sincronizar stock desde PrestaShop');
    } finally {
      setSyncingStock(false);
    }
  };
  
  const handleDetectConflicts = async () => {
    if (!integration?.id) return;
    
    setLoadingConflicts(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/integrations/prestashop/${integration.id}/stock/conflicts`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      setStockConflicts(response.data.conflicts || []);
      setShowConflictsModal(true);
      
      if (response.data.conflicts && response.data.conflicts.length > 0) {
        toast.warning(`⚠️ Se encontraron ${response.data.total_conflicts} conflictos de stock`);
      } else {
        toast.success('✅ No hay conflictos de stock');
      }
    } catch (error) {
      console.error('Error detectando conflictos:', error);
      toast.error('Error al detectar conflictos de stock');
    } finally {
      setLoadingConflicts(false);
    }
  };
  
  const handleResolveConflict = async (productId, resolution, customQuantity = null) => {
    if (!integration?.id) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/integrations/prestashop/stock/resolve-conflict`,
        {
          integration_id: integration.id,
          product_id: productId,
          resolution: resolution, // 'use_local', 'use_prestashop', 'use_custom'
          custom_quantity: customQuantity
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      toast.success('✅ Conflicto resuelto');
      
      // Recargar conflictos
      handleDetectConflicts();
      
      // Recargar productos
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error resolviendo conflicto:', error);
      toast.error(error.response?.data?.detail || 'Error al resolver conflicto');
    }
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
                {/* Badge de estado de Webhook */}
                {integration?.webhook_active && (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-600 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <div>
                        <h4 className="font-bold text-green-900">Webhook Activo</h4>
                        <p className="text-sm text-green-800">
                          Las órdenes y cambios de stock se sincronizan automáticamente en tiempo real desde PrestaShop.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Navegación de etapas - permite volver a etapas anteriores */}
                {(completedStages.stage1 || completedStages.stage2) && (
                  <div className="bg-slate-100 border-2 border-slate-900 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-700">Navegación rápida:</span>
                      <div className="flex gap-2">
                        {completedStages.stage1 && (
                          <button
                            onClick={() => setCurrentStage('stage1')}
                            className={`px-3 py-1.5 text-sm font-bold border-2 border-slate-900 rounded-lg transition-colors ${
                              currentStage === 'stage1' 
                                ? 'bg-green-500 text-white' 
                                : 'bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            ✓ Categorías
                          </button>
                        )}
                        {completedStages.stage2 && (
                          <button
                            onClick={() => setCurrentStage('stage2')}
                            className={`px-3 py-1.5 text-sm font-bold border-2 border-slate-900 rounded-lg transition-colors ${
                              currentStage === 'stage2' 
                                ? 'bg-purple-500 text-white' 
                                : 'bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            ✓ Productos
                          </button>
                        )}
                        {(completedStages.stage1 && completedStages.stage2) && (
                          <button
                            onClick={() => setCurrentStage('stage3')}
                            className={`px-3 py-1.5 text-sm font-bold border-2 border-slate-900 rounded-lg transition-colors ${
                              currentStage === 'stage3' 
                                ? 'bg-blue-500 text-white' 
                                : 'bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            Otros Recursos
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Mostrar solo la etapa actual */}
                {currentStage === 'stage1' && (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-600 rounded-xl p-4">
                      <h3 className="font-bold text-lg text-slate-900 mb-2">
                        {SYNC_STAGES.stage1.title}
                      </h3>
                      <p className="text-sm text-slate-700">
                        {SYNC_STAGES.stage1.description}
                      </p>
                    </div>
                    
                    {/* Recursos de Etapa 1 */}
                    <div className="space-y-3">
                      {SYNC_STAGES.stage1.resources.map((resource) => {
                        const Icon = resource.icon;
                        const colorClasses = {
                          green: 'from-green-50 to-green-100 border-green-600',
                          purple: 'from-purple-50 to-purple-100 border-purple-600',
                          orange: 'from-orange-50 to-orange-100 border-orange-600',
                          teal: 'from-teal-50 to-teal-100 border-teal-600',
                          pink: 'from-pink-50 to-pink-100 border-pink-600',
                          red: 'from-red-50 to-red-100 border-red-600'
                        };

                        return (
                          <div
                            key={resource.id}
                            className={`border-2 rounded-xl p-4 bg-gradient-to-br ${colorClasses[resource.color]}`}
                          >
                            <div className="flex items-start gap-3">
                              <Icon className="w-6 h-6 flex-shrink-0" />
                              <div className="flex-1">
                                <h4 className="font-bold text-slate-900 mb-1">
                                  {resource.label}
                                </h4>
                                <p className="text-sm text-slate-700">
                                  {resource.description}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="flex justify-between gap-3 pt-4 border-t-2 border-slate-200">
                      <button
                        onClick={onClose}
                        className="px-6 py-3 bg-slate-100 border-2 border-slate-900 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                      >
                        Cancelar
                      </button>
                      
                      <button
                        onClick={() => handleSyncResources(['categories'])}
                        disabled={syncing}
                        className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white border-2 border-slate-900 rounded-xl font-bold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
                      >
                        {syncing ? (
                          <>
                            <Loader className="w-5 h-5 animate-spin" />
                            Sincronizando...
                          </>
                        ) : (
                          <>
                            <Tag className="w-5 h-5" />
                            Sincronizar Categorías
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
                
                {/* ETAPA 2: Productos */}
                {currentStage === 'stage2' && (
                  <div className="space-y-4">
                    {completedStages.stage2 && (
                      <div className="bg-blue-50 border-2 border-blue-600 rounded-xl p-3">
                        <p className="text-sm text-blue-900 font-semibold">
                          ℹ️ Esta etapa ya fue completada. Puedes resincronizar para actualizar los productos.
                        </p>
                      </div>
                    )}
                    
                    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-600 rounded-xl p-4">
                      <h3 className="font-bold text-lg text-slate-900 mb-2">
                        {SYNC_STAGES.stage2.title}
                      </h3>
                      <p className="text-sm text-slate-700">
                        {SYNC_STAGES.stage2.description}
                      </p>
                    </div>
                    
                    {/* Recursos de Etapa 2 */}
                    <div className="space-y-3">
                      {SYNC_STAGES.stage2.resources.map((resource) => {
                        const Icon = resource.icon;
                        const colorClasses = {
                          green: 'from-green-50 to-green-100 border-green-600',
                          purple: 'from-purple-50 to-purple-100 border-purple-600',
                          orange: 'from-orange-50 to-orange-100 border-orange-600',
                          teal: 'from-teal-50 to-teal-100 border-teal-600',
                          pink: 'from-pink-50 to-pink-100 border-pink-600',
                          red: 'from-red-50 to-red-100 border-red-600'
                        };

                        return (
                          <div
                            key={resource.id}
                            className={`border-2 rounded-xl p-4 bg-gradient-to-br ${colorClasses[resource.color]}`}
                          >
                            <div className="flex items-start gap-3">
                              <Icon className="w-6 h-6 flex-shrink-0" />
                              <div className="flex-1">
                                <h4 className="font-bold text-slate-900 mb-1">
                                  {resource.label}
                                </h4>
                                <p className="text-sm text-slate-700">
                                  {resource.description}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="flex justify-between gap-3 pt-4 border-t-2 border-slate-200">
                      <button
                        onClick={onClose}
                        className="px-6 py-3 bg-slate-100 border-2 border-slate-900 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                      >
                        Cancelar
                      </button>
                      
                      <button
                        onClick={handleBatchSync}
                        disabled={batchSyncing}
                        className="flex items-center gap-2 px-6 py-3 bg-purple-500 text-white border-2 border-slate-900 rounded-xl font-bold hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
                            Sincronizar Productos
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
                
                {/* ETAPA 3: Recursos adicionales o Resincronización completa */}
                {currentStage === 'stage3' && (
                  <div className="space-y-4">
                    {/* Banner informativo */}
                    {(completedStages.stage1 || completedStages.stage2) ? (
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-600 rounded-xl p-4">
                        <h3 className="font-bold text-lg text-slate-900 mb-2">
                          ✓ Resincronizar Recursos
                        </h3>
                        <p className="text-sm text-slate-700">
                          Ya tienes una integración activa. Selecciona los recursos que deseas actualizar.
                        </p>
                      </div>
                    ) : (
                      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-600 rounded-xl p-4">
                        <h3 className="font-bold text-lg text-slate-900 mb-2">
                          {SYNC_STAGES.stage3.title}
                        </h3>
                        <p className="text-sm text-slate-700">
                          {SYNC_STAGES.stage3.description}
                        </p>
                      </div>
                    )}
                    
                    {/* SI HAY INTEGRACIÓN PREVIA: Mostrar Categorías y Productos también */}
                    {(completedStages.stage1 || completedStages.stage2) && (
                      <div className="space-y-3">
                        <p className="text-sm font-bold text-slate-600 uppercase tracking-wide">
                          Recursos Base
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Categorías */}
                          <div
                            className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                              syncResources.categories 
                                ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-600' 
                                : 'bg-slate-50 border-slate-300 hover:border-slate-400'
                            }`}
                            onClick={() => setSyncResources(prev => ({ ...prev, categories: !prev.categories }))}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={syncResources.categories || false}
                                onChange={() => {}}
                                className="w-5 h-5 rounded border-2 border-slate-900 cursor-pointer mt-0.5"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Tag className="w-5 h-5" />
                                  <h4 className="font-bold text-slate-900">
                                    Categorías {completedStages.stage1 && <span className="text-green-600">✓</span>}
                                  </h4>
                                </div>
                                <p className="text-xs text-slate-700">
                                  Actualizar categorías de productos
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Productos */}
                          <div
                            className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                              syncResources.products 
                                ? 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-600' 
                                : 'bg-slate-50 border-slate-300 hover:border-slate-400'
                            }`}
                            onClick={() => setSyncResources(prev => ({ ...prev, products: !prev.products }))}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={syncResources.products || false}
                                onChange={() => {}}
                                className="w-5 h-5 rounded border-2 border-slate-900 cursor-pointer mt-0.5"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Package className="w-5 h-5" />
                                  <h4 className="font-bold text-slate-900">
                                    Productos {completedStages.stage2 && <span className="text-purple-600">✓</span>}
                                  </h4>
                                </div>
                                <p className="text-xs text-slate-700">
                                  Actualizar catálogo completo de productos
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <p className="text-sm font-bold text-slate-600 uppercase tracking-wide mt-4">
                          Recursos Adicionales
                        </p>
                      </div>
                    )}
                    
                    {/* Recursos de Etapa 3 (órdenes, clientes, etc) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {SYNC_STAGES.stage3.resources.map((resource) => {
                        const Icon = resource.icon;
                        const isSelected = syncResources[resource.id] || false;
                        const colorClasses = {
                          green: 'from-green-50 to-green-100 border-green-600',
                          purple: 'from-purple-50 to-purple-100 border-purple-600',
                          orange: 'from-orange-50 to-orange-100 border-orange-600',
                          teal: 'from-teal-50 to-teal-100 border-teal-600',
                          pink: 'from-pink-50 to-pink-100 border-pink-600',
                          red: 'from-red-50 to-red-100 border-red-600'
                        };

                        return (
                          <div
                            key={resource.id}
                            className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                              isSelected 
                                ? `bg-gradient-to-br ${colorClasses[resource.color]}` 
                                : 'bg-slate-50 border-slate-300 hover:border-slate-400'
                            }`}
                            onClick={() => setSyncResources(prev => ({ ...prev, [resource.id]: !prev[resource.id] }))}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="w-5 h-5 rounded border-2 border-slate-900 cursor-pointer mt-0.5"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Icon className="w-5 h-5" />
                                  <h4 className="font-bold text-slate-900">
                                    {resource.label}
                                  </h4>
                                </div>
                                <p className="text-xs text-slate-700">
                                  {resource.description}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="flex justify-between gap-3 pt-4 border-t-2 border-slate-200">
                      <button
                        onClick={onClose}
                        className="px-6 py-3 bg-slate-100 border-2 border-slate-900 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                      >
                        Cerrar
                      </button>
                      
                      <button
                        onClick={() => {
                          const selectedResources = Object.keys(syncResources).filter(k => syncResources[k]);
                          if (selectedResources.length === 0) {
                            toast.error('Selecciona al menos un recurso');
                            return;
                          }
                          
                          // Si seleccionó productos, usar batch sync
                          if (selectedResources.includes('products')) {
                            handleBatchSync();
                          } else {
                            // Para otros recursos (categorías, órdenes, etc), usar sync normal
                            handleSyncResources(selectedResources);
                          }
                        }}
                        disabled={syncing || batchSyncing}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white border-2 border-slate-900 rounded-xl font-bold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
                      >
                        {(syncing || batchSyncing) ? (
                          <>
                            <Loader className="w-5 h-5 animate-spin" />
                            Sincronizando...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-5 h-5" />
                            Sincronizar Recursos
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
                
                {/* FASE 2: Sincronización de Stock Bidireccional */}
                {integration && (completedStages.stage2) && (
                  <div className="mt-6 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-600 rounded-xl">
                    <h3 className="font-bold text-lg text-slate-900 mb-2 flex items-center gap-2">
                      <Package className="w-6 h-6 text-blue-600" />
                      Sincronización de Stock
                    </h3>
                    <p className="text-sm text-slate-700 mb-4">
                      Mantén el stock sincronizado entre Negocio Feliz y PrestaShop
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Botón: Sincronizar Stock desde PrestaShop */}
                      <button
                        onClick={handleSyncStockFromPrestaShop}
                        disabled={syncingStock}
                        className="flex items-center gap-2 px-4 py-3 bg-blue-500 text-white border-2 border-slate-900 rounded-lg font-bold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
                      >
                        {syncingStock ? (
                          <>
                            <Loader className="w-5 h-5 animate-spin" />
                            Sincronizando...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-5 h-5" />
                            Sincronizar Stock desde PS
                          </>
                        )}
                      </button>
                      
                      {/* Botón: Detectar Conflictos */}
                      <button
                        onClick={handleDetectConflicts}
                        disabled={loadingConflicts}
                        className="flex items-center gap-2 px-4 py-3 bg-yellow-500 text-white border-2 border-slate-900 rounded-lg font-bold hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
                      >
                        {loadingConflicts ? (
                          <>
                            <Loader className="w-5 h-5 animate-spin" />
                            Buscando...
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="w-5 h-5" />
                            Detectar Conflictos
                          </>
                        )}
                      </button>
                    </div>
                    
                    <div className="mt-3 p-3 bg-blue-100 border-2 border-blue-600 rounded-lg">
                      <p className="text-xs text-slate-700">
                        <span className="font-bold">💡 Nota:</span> La sincronización de stock también se ejecuta automáticamente al editar stock en Inventario o al realizar ventas en POS.
                      </p>
                    </div>
                  </div>
                )}

                {/* Barra de progreso de sincronización rápida */}
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
      
      {/* Modal de Conflictos de Stock */}
      {showConflictsModal && (
        <>
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-[60]"
            onClick={() => setShowConflictsModal(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
            <div 
              className="bg-white border-4 border-slate-900 rounded-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden"
              style={{ boxShadow: '12px 12px 0px 0px rgba(15,23,42,1)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-yellow-500 to-orange-600 text-white px-6 py-4 flex justify-between items-center border-b-4 border-slate-900">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <ShoppingCart className="w-6 h-6" />
                  Conflictos de Stock ({stockConflicts.length})
                </h2>
                <button
                  onClick={() => setShowConflictsModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Contenido */}
              <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
                {stockConflicts.length === 0 ? (
                  <div className="text-center py-8">
                    <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-slate-900 mb-2">
                      ¡Sin conflictos!
                    </h3>
                    <p className="text-slate-600">
                      El stock está sincronizado correctamente entre Negocio Feliz y PrestaShop.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {stockConflicts.map((conflict, index) => (
                      <div 
                        key={index}
                        className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-600 rounded-xl p-4"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-bold text-slate-900">{conflict.product_name}</h4>
                            <p className="text-sm text-slate-600">SKU: {conflict.sku}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-red-600">
                              Diferencia: {conflict.difference}
                            </span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="bg-blue-100 border-2 border-blue-600 rounded-lg p-3">
                            <div className="text-xs text-slate-600 mb-1">Negocio Feliz</div>
                            <div className="text-2xl font-bold text-blue-600">{conflict.local_stock}</div>
                          </div>
                          <div className="bg-purple-100 border-2 border-purple-600 rounded-lg p-3">
                            <div className="text-xs text-slate-600 mb-1">PrestaShop</div>
                            <div className="text-2xl font-bold text-purple-600">{conflict.prestashop_stock}</div>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleResolveConflict(conflict.product_id, 'use_local')}
                            className="flex-1 px-3 py-2 bg-blue-500 text-white border-2 border-slate-900 rounded-lg text-sm font-bold hover:bg-blue-600 transition-all"
                            style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
                          >
                            Usar Local ({conflict.local_stock})
                          </button>
                          <button
                            onClick={() => handleResolveConflict(conflict.product_id, 'use_prestashop')}
                            className="flex-1 px-3 py-2 bg-purple-500 text-white border-2 border-slate-900 rounded-lg text-sm font-bold hover:bg-purple-600 transition-all"
                            style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
                          >
                            Usar PrestaShop ({conflict.prestashop_stock})
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default PrestashopModal;
