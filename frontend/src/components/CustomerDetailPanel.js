import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, User, Phone, MapPin, Calendar, TrendingUp, ShoppingBag, Clock, AlertCircle, Package } from 'lucide-react';
import { toast } from 'sonner';
import { useStores } from '../hooks/useStores';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CustomerDetailPanel = ({ customerId, isOpen, onClose }) => {
  const { getStoreName } = useStores();
  const [loading, setLoading] = useState(true);
  const [customerDetail, setCustomerDetail] = useState(null);

  useEffect(() => {
    if (isOpen && customerId) {
      fetchCustomerDetail();
    }
  }, [isOpen, customerId]);

  const fetchCustomerDetail = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/customers/${customerId}/detail`);
      setCustomerDetail(response.data);
    } catch (error) {
      console.error('Error fetching customer detail:', error);
      toast.error('Error al cargar detalle del cliente');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('es-CL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDaysUntilPurchase = (dateString) => {
    if (!dateString) return null;
    const today = new Date();
    const predictedDate = new Date(dateString);
    const diffTime = predictedDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel lateral */}
      <div 
        className={`fixed right-0 top-0 h-full w-full md:w-[600px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <User className="w-6 h-6" />
            <h2 className="text-xl font-bold">Detalle del Cliente</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-80px)] overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-slate-600">Cargando información...</div>
            </div>
          ) : !customerDetail ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-red-600">Error al cargar información</div>
            </div>
          ) : (
            <>
              {/* Información del Cliente */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-slate-900 rounded-xl p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Información Personal
                </h3>
                <div className="space-y-3">
                  {/* Tipo de Cliente */}
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase">Tipo de Cliente</label>
                    <p className="inline-block mt-1 px-3 py-1 bg-white border-2 border-slate-900 rounded-full text-sm font-bold">
                      {customerDetail.customer.customer_type || 'Persona'}
                    </p>
                  </div>

                  {/* Nombre/Razón Social */}
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase">
                      {customerDetail.customer.customer_type === 'Empresa' ? 'Razón Social' : 'Nombre'}
                    </label>
                    <p className="text-lg font-bold text-slate-900">{customerDetail.customer.name}</p>
                  </div>
                  
                  {/* RUT */}
                  {customerDetail.customer.rut && !customerDetail.customer.sin_rut && (
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase">RUT</label>
                      <p className="text-slate-900 font-mono font-semibold">{customerDetail.customer.rut}</p>
                    </div>
                  )}
                  
                  {customerDetail.customer.sin_rut && (
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase">RUT</label>
                      <p className="text-slate-500 italic">Sin RUT</p>
                    </div>
                  )}

                  {/* Nombre de Fantasía (solo Empresa) */}
                  {customerDetail.customer.customer_type === 'Empresa' && customerDetail.customer.nombre_fantasia && (
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase">Nombre de Fantasía</label>
                      <p className="text-slate-900">{customerDetail.customer.nombre_fantasia}</p>
                    </div>
                  )}

                  {/* Giro (solo Empresa) */}
                  {customerDetail.customer.customer_type === 'Empresa' && customerDetail.customer.giro && (
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase">Giro</label>
                      <p className="text-slate-900">{customerDetail.customer.giro}</p>
                    </div>
                  )}
                  
                  {/* Teléfono */}
                  {customerDetail.customer.phone && (
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase">Teléfono</label>
                      <div className="flex items-center gap-2 text-slate-900">
                        <Phone className="w-4 h-4" />
                        <p className="font-medium">{customerDetail.customer.phone}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Email */}
                  {customerDetail.customer.email && (
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase">Email</label>
                      <p className="text-slate-900">{customerDetail.customer.email}</p>
                    </div>
                  )}
                  
                  {/* Dirección */}
                  {(customerDetail.customer.direccion || customerDetail.customer.address) && (
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase">Dirección</label>
                      <div className="flex items-start gap-2 text-slate-900">
                        <MapPin className="w-4 h-4 mt-1" />
                        <p>{customerDetail.customer.direccion || customerDetail.customer.address}</p>
                      </div>
                    </div>
                  )}

                  {/* Ciudad */}
                  {customerDetail.customer.ciudad && (
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase">Ciudad</label>
                      <p className="text-slate-900">{customerDetail.customer.ciudad}</p>
                    </div>
                  )}
                  
                  {/* Tienda */}
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase">Tienda/Caja Principal</label>
                    <p className="inline-block mt-1 px-3 py-1 bg-white border-2 border-slate-900 rounded-full text-sm font-bold">
                      {getStoreName(customerDetail.customer.store)}
                    </p>
                  </div>
                  
                  {/* Cliente desde */}
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase">Cliente desde</label>
                    <div className="flex items-center gap-2 text-slate-900">
                      <Calendar className="w-4 h-4" />
                      <p>{formatDate(customerDetail.customer.created_at)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Estadísticas */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 border-2 border-slate-900 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ShoppingBag className="w-5 h-5 text-green-600" />
                    <p className="text-xs font-bold text-slate-600 uppercase">Total Compras</p>
                  </div>
                  <p className="text-3xl font-black text-slate-900">
                    {customerDetail.customer.purchase_count || 0}
                  </p>
                </div>
                <div className="bg-purple-50 border-2 border-slate-900 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                    <p className="text-xs font-bold text-slate-600 uppercase">Gasto Total</p>
                  </div>
                  <p className="text-2xl font-black text-slate-900">
                    ${(customerDetail.customer.total_spent || 0).toLocaleString('es-CL')}
                  </p>
                </div>
              </div>

              {/* Últimas Compras */}
              <div className="bg-white border-2 border-slate-900 rounded-xl p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Últimas 3 Compras
                </h3>
                {customerDetail.recent_purchases.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">No hay compras registradas</p>
                ) : (
                  <div className="space-y-3">
                    {customerDetail.recent_purchases.map((purchase, index) => (
                      <div 
                        key={index}
                        className="bg-slate-50 border-2 border-slate-200 rounded-lg p-4 hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <p className="font-bold text-slate-900">{purchase.product_name}</p>
                            <p className="text-sm text-slate-600">
                              Cantidad: {purchase.quantity} | {getStoreName(purchase.store)}
                            </p>
                          </div>
                          <p className="font-bold text-green-600">
                            ${purchase.total.toLocaleString('es-CL')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Clock className="w-3 h-3" />
                          {formatDateTime(purchase.date)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Predicción de Próxima Compra */}
              <div 
                className={`border-2 border-slate-900 rounded-xl p-6 ${
                  customerDetail.prediction.status === 'success' 
                    ? 'bg-gradient-to-br from-orange-50 to-orange-100' 
                    : 'bg-gray-50'
                }`}
              >
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Predicción de Próxima Compra
                </h3>
                
                {customerDetail.prediction.status === 'insufficient_data' ? (
                  <div className="flex items-start gap-3 bg-yellow-100 border-2 border-yellow-600 rounded-lg p-4">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-yellow-900 mb-1">Datos Insuficientes para Predicción</p>
                      <p className="text-sm text-yellow-800">
                        Se necesitan al menos 2 compras en los últimos 3 meses para generar una predicción confiable.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-white border-2 border-slate-900 rounded-lg p-4">
                      <label className="text-xs font-bold text-slate-600 uppercase block mb-2">
                        Fecha Estimada de Próxima Compra
                      </label>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Calendar className="w-6 h-6 text-orange-600" />
                          <div>
                            <p className="text-xl font-black text-slate-900">
                              {formatDate(customerDetail.prediction.next_purchase_date)}
                            </p>
                            {getDaysUntilPurchase(customerDetail.prediction.next_purchase_date) !== null && (
                              <p className="text-sm text-slate-600">
                                {getDaysUntilPurchase(customerDetail.prediction.next_purchase_date) > 0 
                                  ? `En ${getDaysUntilPurchase(customerDetail.prediction.next_purchase_date)} días`
                                  : getDaysUntilPurchase(customerDetail.prediction.next_purchase_date) === 0
                                  ? 'Hoy'
                                  : `Hace ${Math.abs(getDaysUntilPurchase(customerDetail.prediction.next_purchase_date))} días (retrasado)`
                                }
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-600">Confianza</p>
                          <p className="text-2xl font-bold text-orange-600">
                            {customerDetail.prediction.confidence_level}%
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white border border-slate-300 rounded-lg p-3">
                        <p className="text-xs text-slate-600 mb-1">Promedio entre compras</p>
                        <p className="text-lg font-bold text-slate-900">
                          {customerDetail.prediction.avg_days_between_purchases} días
                        </p>
                      </div>
                      <div className="bg-white border border-slate-300 rounded-lg p-3">
                        <p className="text-xs text-slate-600 mb-1">Compras analizadas</p>
                        <p className="text-lg font-bold text-slate-900">
                          {customerDetail.prediction.total_purchases_analyzed}
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs font-bold text-blue-900 mb-2">
                        💡 Basado en el análisis de compras de los últimos 3 meses
                      </p>
                      <p className="text-xs text-blue-800">
                        Esta predicción combina el promedio de días entre compras y el análisis de frecuencia de productos.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default CustomerDetailPanel;
