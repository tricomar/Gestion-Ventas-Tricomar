import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Trash2, Settings, ShoppingCart, Package, Download, Webhook, Activity, Clock, AlertCircle } from 'lucide-react';
import PrestashopModal from './PrestashopModal';
import { useStores } from '../../hooks/useStores';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const IntegrationsTab = () => {
  const { stores } = useStores();
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPrestashopModal, setShowPrestashopModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [webhookStatus, setWebhookStatus] = useState({}); // Estado de webhooks por integration_id
  const [showWebhookLogs, setShowWebhookLogs] = useState(false);
  const [webhookLogs, setWebhookLogs] = useState([]);
  const [selectedIntegrationForLogs, setSelectedIntegrationForLogs] = useState(null);

  useEffect(() => {
    fetchIntegrations();
  }, []);

  useEffect(() => {
    // Verificar estado de webhooks cada 30 segundos
    const interval = setInterval(() => {
      integrations.forEach(integration => {
        checkWebhookStatus(integration.id);
      });
    }, 30000);

    return () => clearInterval(interval);
  }, [integrations]);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/integrations/prestashop/list`);
      setIntegrations(response.data);
      
      // Verificar estado de webhooks para cada integración
      response.data.forEach(integration => {
        checkWebhookStatus(integration.id);
      });
    } catch (error) {
      console.error('Error fetching integrations:', error);
      toast.error('Error al cargar integraciones');
    } finally {
      setLoading(false);
    }
  };

  const checkWebhookStatus = async (integrationId) => {
    try {
      // Verificar últimos eventos de webhook
      const response = await axios.get(`${API}/integrations/webhooks/prestashop/${integrationId}/status`);
      
      setWebhookStatus(prev => ({
        ...prev,
        [integrationId]: response.data
      }));
    } catch (error) {
      // Si no hay endpoint de status, usar lógica por defecto
      setWebhookStatus(prev => ({
        ...prev,
        [integrationId]: {
          status: 'unknown',
          message: 'No configurado'
        }
      }));
    }
  };

  const getWebhookStatusBadge = (integrationId) => {
    const status = webhookStatus[integrationId];
    
    if (!status) {
      return {
        color: 'gray',
        bgColor: 'bg-slate-100',
        borderColor: 'border-slate-400',
        textColor: 'text-slate-700',
        label: 'Sin verificar',
        icon: '⚪'
      };
    }

    // Determinar estado basado en última actividad
    if (status.status === 'active') {
      return {
        color: 'green',
        bgColor: 'bg-green-100',
        borderColor: 'border-green-600',
        textColor: 'text-green-800',
        label: 'Webhook Activo',
        icon: '🟢'
      };
    } else if (status.status === 'inactive') {
      return {
        color: 'yellow',
        bgColor: 'bg-yellow-100',
        borderColor: 'border-yellow-600',
        textColor: 'text-yellow-800',
        label: 'Webhook Inactivo',
        icon: '🟡'
      };
    } else if (status.status === 'configured') {
      return {
        color: 'cyan',
        bgColor: 'bg-cyan-100',
        borderColor: 'border-cyan-600',
        textColor: 'text-cyan-800',
        label: 'Configurado',
        icon: '🔵'
      };
    } else if (status.status === 'not_configured') {
      return {
        color: 'slate',
        bgColor: 'bg-slate-100',
        borderColor: 'border-slate-500',
        textColor: 'text-slate-700',
        label: 'Sin configurar',
        icon: '⚪'
      };
    } else if (status.status === 'error') {
      return {
        color: 'red',
        bgColor: 'bg-red-100',
        borderColor: 'border-red-600',
        textColor: 'text-red-800',
        label: 'Webhook Error',
        icon: '🔴'
      };
    } else {
      return {
        color: 'gray',
        bgColor: 'bg-slate-100',
        borderColor: 'border-slate-400',
        textColor: 'text-slate-700',
        label: 'No configurado',
        icon: '⚪'
      };
    }
  };

  const handleDeleteIntegration = async (integrationId) => {
    if (!window.confirm('¿Estás seguro de eliminar esta integración? Se perderán todos los datos sincronizados.')) {
      return;
    }

    try {
      await axios.delete(`${API}/integrations/prestashop/${integrationId}`);
      toast.success('Integración eliminada exitosamente');
      fetchIntegrations();
    } catch (error) {
      console.error('Error deleting integration:', error);
      toast.error('Error al eliminar integración');
    }
  };

  const handleConfigureIntegration = (integration) => {
    setSelectedIntegration(integration);
    setShowPrestashopModal(true);
  };

  const handleNewIntegration = () => {
    setSelectedIntegration(null);
    setShowPrestashopModal(true);
  };

  const handleDownloadModule = () => {
    const downloadUrl = `${API}/integrations/prestashop/download-module`;
    
    // Crear link temporal y hacer clic
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'emergent_webhooks.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Descargando módulo de PrestaShop...', {
      description: 'Instálalo en tu tienda para sincronización en tiempo real'
    });
  };

  const handleCopyWebhookUrl = (integrationId) => {
    const webhookUrl = `${BACKEND_URL}/api/integrations/webhooks/prestashop/${integrationId}`;
    
    // Copiar al portapapeles
    navigator.clipboard.writeText(webhookUrl).then(() => {
      toast.success('URL de Webhook copiada', {
        description: 'Pégala en la configuración del módulo PrestaShop',
        duration: 4000
      });
    }).catch(() => {
      // Fallback para navegadores que no soportan clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = webhookUrl;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        toast.success('URL de Webhook copiada');
      } catch (err) {
        toast.error('No se pudo copiar la URL');
      }
      document.body.removeChild(textArea);
    });
  };

  const handleTestWebhook = async (integrationId) => {
    try {
      const response = await axios.post(`${API}/integrations/webhooks/prestashop/${integrationId}/test`);
      
      toast.success('Webhook de prueba enviado', {
        description: response.data.instructions,
        duration: 6000
      });
      
      // Actualizar estado inmediatamente
      setTimeout(() => {
        checkWebhookStatus(integrationId);
      }, 1000);
      
    } catch (error) {
      console.error('Error testing webhook:', error);
      toast.error('Error al enviar webhook de prueba');
    }
  };

  const handleViewWebhookLogs = async (integration) => {
    try {
      setSelectedIntegrationForLogs(integration);
      const response = await axios.get(`${API}/integrations/webhooks/prestashop/${integration.id}/logs`);
      setWebhookLogs(response.data);
      setShowWebhookLogs(true);
    } catch (error) {
      console.error('Error fetching webhook logs:', error);
      toast.error('Error al cargar logs de webhooks');
    }
  };

  const ecommercePlatforms = [
    {
      id: 'prestashop',
      name: 'PrestaShop',
      icon: '🛒',
      color: 'from-pink-500 to-rose-600',
      description: 'Conecta con tu tienda PrestaShop',
      available: true
    },
    {
      id: 'woocommerce',
      name: 'WooCommerce',
      icon: '🌐',
      color: 'from-purple-500 to-indigo-600',
      description: 'Conecta con tu tienda WooCommerce',
      available: false
    },
    {
      id: 'shopify',
      name: 'Shopify',
      icon: '🛍️',
      color: 'from-green-500 to-teal-600',
      description: 'Conecta con tu tienda Shopify',
      available: false
    },
    {
      id: 'jumpseller',
      name: 'JumpSeller',
      icon: '📦',
      color: 'from-orange-500 to-amber-600',
      description: 'Conecta con tu tienda JumpSeller',
      available: false
    }
  ];

  return (
    <div 
      className="bg-white border-2 border-slate-900 rounded-xl p-8"
      style={{ boxShadow: '8px 8px 0px 0px rgba(15,23,42,1)' }}
    >
      <div className="flex items-center gap-3 mb-6">
        <ShoppingCart className="w-6 h-6" />
        <h2 className="text-2xl font-bold text-slate-900">Integraciones Ecommerce</h2>
      </div>
      
      <div className="bg-blue-50 border-2 border-blue-900 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-900">
          <strong>🔗 Conecta tu negocio con plataformas ecommerce</strong><br/>
          Sincroniza productos, categorías y stock automáticamente con tus tiendas online.
        </p>
      </div>

      {/* Integraciones Activas */}
      {integrations.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Integraciones Activas</h3>
          <div className="space-y-4">
            {integrations.map((integration) => (
              <div 
                key={integration.id}
                className="border-2 border-slate-900 rounded-xl p-4 bg-gradient-to-r from-pink-50 to-rose-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-pink-500 border-2 border-slate-900 rounded-lg flex items-center justify-center text-2xl">
                        🛒
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-slate-900">{integration.store_name}</h4>
                        <p className="text-sm text-slate-600">{integration.shop_url}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-auto">
                        {integration.is_active ? (
                          <span className="px-3 py-1 bg-green-100 border-2 border-green-600 rounded-full text-xs font-bold text-green-800 flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            Conectado
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-red-100 border-2 border-red-600 rounded-full text-xs font-bold text-red-800 flex items-center gap-1">
                            <XCircle className="w-4 h-4" />
                            Desconectado
                          </span>
                        )}
                        
                        {/* Badge de estado del webhook */}
                        {(() => {
                          const webhookBadge = getWebhookStatusBadge(integration.id);
                          return (
                            <span 
                              className={`px-3 py-1 ${webhookBadge.bgColor} border-2 ${webhookBadge.borderColor} rounded-full text-xs font-bold ${webhookBadge.textColor} flex items-center gap-1`}
                              title={webhookBadge.label}
                            >
                              <span>{webhookBadge.icon}</span>
                              {webhookBadge.label}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                      <div>
                        <p className="text-slate-600">Última sincronización:</p>
                        <p className="font-semibold text-slate-900">
                          {integration.last_sync_products 
                            ? new Date(integration.last_sync_products).toLocaleString('es-CL', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'Nunca'}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-600">Intervalo:</p>
                        <p className="font-semibold text-slate-900">{integration.sync_interval_minutes} minutos</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Canal de ventas:</p>
                        <p className="font-semibold text-slate-900">PrestaShop</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleConfigureIntegration(integration)}
                      className="p-2 bg-blue-100 border-2 border-slate-900 rounded-lg hover:bg-blue-200 transition-colors"
                      title="Configurar"
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                    
                    <button
                      onClick={() => handleViewWebhookLogs(integration)}
                      className="p-2 bg-indigo-100 border-2 border-slate-900 rounded-lg hover:bg-indigo-200 transition-colors"
                      title="Ver Logs de Webhooks"
                    >
                      <Activity className="w-5 h-5 text-indigo-700" />
                    </button>
                    
                    <button
                      onClick={() => handleCopyWebhookUrl(integration.id)}
                      className="p-2 bg-purple-100 border-2 border-slate-900 rounded-lg hover:bg-purple-200 transition-colors"
                      title="Copiar URL de Webhook"
                    >
                      <Webhook className="w-5 h-5 text-purple-700" />
                    </button>
                    
                    <button
                      onClick={() => handleTestWebhook(integration.id)}
                      className="p-2 bg-amber-100 border-2 border-slate-900 rounded-lg hover:bg-amber-200 transition-colors"
                      title="Probar Webhook"
                    >
                      <span className="text-lg">🧪</span>
                    </button>
                    
                    <button
                      onClick={() => handleDeleteIntegration(integration.id)}
                      className="p-2 bg-red-100 border-2 border-slate-900 rounded-lg hover:bg-red-200 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plataformas Disponibles */}
      <h3 className="text-lg font-bold text-slate-900 mb-4">Plataformas Disponibles</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {ecommercePlatforms.map((platform) => (
          <div
            key={platform.id}
            className={`border-2 border-slate-900 rounded-xl p-6 ${
              platform.available 
                ? 'cursor-pointer hover:scale-105 transition-transform' 
                : 'opacity-60 cursor-not-allowed'
            }`}
            style={{ 
              background: platform.available 
                ? `linear-gradient(135deg, var(--tw-gradient-stops))` 
                : '#f1f5f9',
              boxShadow: platform.available ? '4px 4px 0px 0px rgba(15,23,42,1)' : 'none'
            }}
            onClick={() => platform.available && platform.id === 'prestashop' && handleNewIntegration()}
          >
            <div className="text-center">
              <div className="text-5xl mb-3">{platform.icon}</div>
              <h4 className="text-lg font-bold text-slate-900 mb-2">{platform.name}</h4>
              <p className="text-xs text-slate-700 mb-4">{platform.description}</p>
              
              {platform.available ? (
                <div className="space-y-2">
                  <button 
                    className="w-full px-4 py-2 bg-white border-2 border-slate-900 rounded-lg font-bold hover:bg-slate-50 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNewIntegration();
                    }}
                  >
                    Conectar
                  </button>
                  
                  {platform.id === 'prestashop' && (
                    <button
                      className="w-full px-4 py-2 bg-green-500 text-white border-2 border-slate-900 rounded-lg font-bold hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadModule();
                      }}
                      title="Descargar módulo de webhooks"
                    >
                      <Download className="w-4 h-4" />
                      Módulo Webhooks
                    </button>
                  )}
                </div>
              ) : (
                <div className="px-4 py-2 bg-slate-300 border-2 border-slate-400 rounded-lg font-bold text-slate-600">
                  Próximamente
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal de PrestaShop */}
      {showPrestashopModal && (
        <PrestashopModal
          isOpen={showPrestashopModal}
          onClose={() => {
            setShowPrestashopModal(false);
            setSelectedIntegration(null);
          }}
          integration={selectedIntegration}
          onSuccess={() => {
            fetchIntegrations();
            setShowPrestashopModal(false);
            setSelectedIntegration(null);
          }}
          stores={stores}
        />
      )}

      {/* Modal de Logs de Webhooks */}
      {showWebhookLogs && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border-4 border-slate-900 rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
               style={{ boxShadow: '12px 12px 0px 0px rgba(15,23,42,1)' }}>
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 border-b-4 border-slate-900 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Activity className="w-6 h-6 text-white" />
                  <div>
                    <h3 className="text-2xl font-bold text-white">Logs de Webhooks</h3>
                    <p className="text-indigo-100 text-sm">
                      {selectedIntegrationForLogs?.store_name} • {webhookLogs.length} evento{webhookLogs.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowWebhookLogs(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
              {webhookLogs.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📭</div>
                  <p className="text-slate-600 text-lg font-semibold mb-2">No hay eventos registrados</p>
                  <p className="text-slate-500 text-sm">
                    Usa el botón <span className="font-bold">🧪 Probar Webhook</span> o realiza cambios en tu tienda PrestaShop para ver eventos aquí.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {webhookLogs.map((log, index) => (
                    <div
                      key={log.id || index}
                      className={`border-2 rounded-lg p-4 ${
                        log.test 
                          ? 'border-amber-400 bg-amber-50'
                          : log.error
                          ? 'border-red-400 bg-red-50'
                          : log.processed
                          ? 'border-green-400 bg-green-50'
                          : 'border-blue-400 bg-blue-50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {log.test && <span className="text-xl">🧪</span>}
                          {log.error && <span className="text-xl">🔴</span>}
                          {!log.test && !log.error && log.processed && <span className="text-xl">✅</span>}
                          {!log.test && !log.error && !log.processed && <span className="text-xl">⏳</span>}
                          
                          <div>
                            <p className="font-bold text-slate-900">
                              {log.event_type || 'Evento'} - {log.resource_type || 'Recurso'}
                            </p>
                            <p className="text-xs text-slate-600 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(log.timestamp || log.created_at).toLocaleString('es-CL', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-1">
                          {log.test && (
                            <span className="px-2 py-0.5 bg-amber-200 border border-amber-600 rounded text-xs font-bold text-amber-900">
                              PRUEBA
                            </span>
                          )}
                          {log.processed && !log.error && (
                            <span className="px-2 py-0.5 bg-green-200 border border-green-600 rounded text-xs font-bold text-green-900">
                              PROCESADO
                            </span>
                          )}
                          {log.error && (
                            <span className="px-2 py-0.5 bg-red-200 border border-red-600 rounded text-xs font-bold text-red-900">
                              ERROR
                            </span>
                          )}
                        </div>
                      </div>

                      {log.resource_id && (
                        <p className="text-sm text-slate-700 mb-2">
                          <strong>ID Recurso:</strong> {log.resource_id}
                        </p>
                      )}

                      {log.data && (
                        <details className="mt-2">
                          <summary className="text-xs font-semibold text-slate-700 cursor-pointer hover:text-slate-900">
                            Ver datos del evento
                          </summary>
                          <pre className="mt-2 p-2 bg-slate-100 border border-slate-300 rounded text-xs overflow-x-auto">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        </details>
                      )}

                      {log.error && (
                        <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded">
                          <p className="text-xs font-semibold text-red-900">Error:</p>
                          <p className="text-xs text-red-800">{log.error}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t-4 border-slate-900 p-4 bg-slate-50">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => handleViewWebhookLogs(selectedIntegrationForLogs)}
                  className="px-4 py-2 bg-blue-500 text-white border-2 border-slate-900 rounded-lg font-bold hover:bg-blue-600 transition-colors"
                >
                  🔄 Refrescar
                </button>
                <button
                  onClick={() => setShowWebhookLogs(false)}
                  className="px-4 py-2 bg-slate-200 border-2 border-slate-900 rounded-lg font-bold hover:bg-slate-300 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntegrationsTab;
