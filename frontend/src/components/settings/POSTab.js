import React, { useState, useEffect } from 'react';
import { Plus, X, Trash2, Save, Percent, CreditCard } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const POSTab = () => {
  const [discountPercentages, setDiscountPercentages] = useState([0, 5, 10, 15, 20, 25, 30, 50]);
  const [paymentMethods, setPaymentMethods] = useState(['Efectivo', 'Tarjeta', 'Transferencia']);
  const [newPercentage, setNewPercentage] = useState('');
  const [newPaymentMethod, setNewPaymentMethod] = useState('');
  const [editingMethodIndex, setEditingMethodIndex] = useState(null);
  const [editMethodValue, setEditMethodValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/settings`);
      if (response.data.pos_discount_percentages) {
        setDiscountPercentages(response.data.pos_discount_percentages);
      }
      if (response.data.pos_payment_methods) {
        setPaymentMethods(response.data.pos_payment_methods);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/settings`, {
        pos_discount_percentages: discountPercentages.sort((a, b) => a - b),
        pos_payment_methods: paymentMethods
      });
      toast.success('Configuración de POS guardada exitosamente');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleAddPercentage = () => {
    const percent = parseInt(newPercentage);
    if (isNaN(percent) || percent < 0 || percent > 100) {
      toast.error('Ingresa un porcentaje válido (0-100)');
      return;
    }
    if (discountPercentages.includes(percent)) {
      toast.error('Este porcentaje ya existe');
      return;
    }
    setDiscountPercentages([...discountPercentages, percent].sort((a, b) => a - b));
    setNewPercentage('');
    toast.success(`Agregado ${percent}%`);
  };

  const handleRemovePercentage = (percent) => {
    if (percent === 0) {
      toast.error('No puedes eliminar el 0% (sin descuento)');
      return;
    }
    setDiscountPercentages(discountPercentages.filter(p => p !== percent));
    toast.success(`Eliminado ${percent}%`);
  };

  const handleAddPaymentMethod = () => {
    if (!newPaymentMethod.trim()) {
      toast.error('Ingresa un nombre de método de pago');
      return;
    }
    if (paymentMethods.includes(newPaymentMethod.trim())) {
      toast.error('Este método de pago ya existe');
      return;
    }
    setPaymentMethods([...paymentMethods, newPaymentMethod.trim()]);
    setNewPaymentMethod('');
    toast.success(`Agregado ${newPaymentMethod}`);
  };

  const handleEditPaymentMethod = (index) => {
    setEditingMethodIndex(index);
    setEditMethodValue(paymentMethods[index]);
  };

  const handleSaveEditedMethod = () => {
    if (!editMethodValue.trim()) {
      toast.error('El nombre no puede estar vacío');
      return;
    }
    const newMethods = [...paymentMethods];
    newMethods[editingMethodIndex] = editMethodValue.trim();
    setPaymentMethods(newMethods);
    setEditingMethodIndex(null);
    toast.success('Método de pago actualizado');
  };

  const handleRemovePaymentMethod = (index) => {
    if (paymentMethods.length <= 1) {
      toast.error('Debe haber al menos un método de pago');
      return;
    }
    const methodName = paymentMethods[index];
    setPaymentMethods(paymentMethods.filter((_, i) => i !== index));
    toast.success(`Eliminado ${methodName}`);
  };

  if (loading) {
    return <div className="text-center py-12">Cargando configuración...</div>;
  }

  return (
    <div className="bg-white border-2 border-slate-900 rounded-xl p-6" style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-slate-900">Configuración del POS</h2>
        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 border-2 border-slate-900 rounded-xl font-bold text-white hover:bg-green-600 disabled:opacity-50 transition-all"
          style={{ boxShadow: '3px 3px 0px 0px rgba(15,23,42,1)' }}
        >
          <Save className="w-5 h-5" />
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Porcentajes de Descuento */}
        <div className="border-2 border-slate-900 rounded-xl p-6 bg-purple-50">
          <div className="flex items-center gap-2 mb-4">
            <Percent className="w-6 h-6 text-purple-600" />
            <h3 className="text-xl font-bold text-slate-900">Descuentos Porcentuales</h3>
          </div>
          
          <p className="text-sm text-slate-600 mb-4">
            Configura los porcentajes de descuento disponibles para productos individuales en el carrito.
          </p>

          {/* Agregar nuevo porcentaje */}
          <div className="flex gap-2 mb-4">
            <input
              type="number"
              min="0"
              max="100"
              value={newPercentage}
              onChange={(e) => setNewPercentage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddPercentage()}
              placeholder="Ej: 35"
              className="flex-1 px-3 py-2 border-2 border-slate-900 rounded-lg font-bold"
            />
            <button
              onClick={handleAddPercentage}
              className="px-4 py-2 bg-purple-500 border-2 border-slate-900 rounded-lg font-bold text-white hover:bg-purple-600 transition-all"
              style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Lista de porcentajes */}
          <div className="flex flex-wrap gap-2">
            {discountPercentages.map((percent) => (
              <div
                key={percent}
                className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-slate-900 rounded-lg"
                style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
              >
                <span className="font-bold">{percent === 0 ? 'Sin descuento' : `-${percent}%`}</span>
                {percent !== 0 && (
                  <button
                    onClick={() => handleRemovePercentage(percent)}
                    className="p-1 hover:bg-red-100 rounded transition-colors"
                  >
                    <X className="w-4 h-4 text-red-600" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Métodos de Pago */}
        <div className="border-2 border-slate-900 rounded-xl p-6 bg-blue-50">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-6 h-6 text-blue-600" />
            <h3 className="text-xl font-bold text-slate-900">Métodos de Pago</h3>
          </div>
          
          <p className="text-sm text-slate-600 mb-4">
            Configura los métodos de pago disponibles al momento de cobrar en el POS.
          </p>

          {/* Agregar nuevo método */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newPaymentMethod}
              onChange={(e) => setNewPaymentMethod(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddPaymentMethod()}
              placeholder="Ej: Débito, Crédito"
              className="flex-1 px-3 py-2 border-2 border-slate-900 rounded-lg font-bold"
              maxLength={30}
            />
            <button
              onClick={handleAddPaymentMethod}
              className="px-4 py-2 bg-blue-500 border-2 border-slate-900 rounded-lg font-bold text-white hover:bg-blue-600 transition-all"
              style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Lista de métodos */}
          <div className="space-y-2">
            {paymentMethods.map((method, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-slate-900 rounded-lg"
                style={{ boxShadow: '2px 2px 0px 0px rgba(15,23,42,1)' }}
              >
                {editingMethodIndex === index ? (
                  <>
                    <input
                      type="text"
                      value={editMethodValue}
                      onChange={(e) => setEditMethodValue(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSaveEditedMethod()}
                      className="flex-1 px-2 py-1 border-2 border-slate-900 rounded font-bold"
                      maxLength={30}
                      autoFocus
                    />
                    <button
                      onClick={handleSaveEditedMethod}
                      className="p-1 hover:bg-green-100 rounded transition-colors"
                    >
                      <Save className="w-4 h-4 text-green-600" />
                    </button>
                    <button
                      onClick={() => setEditingMethodIndex(null)}
                      className="p-1 hover:bg-slate-100 rounded transition-colors"
                    >
                      <X className="w-4 h-4 text-slate-600" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-bold">{method}</span>
                    <button
                      onClick={() => handleEditPaymentMethod(index)}
                      className="p-1 hover:bg-blue-100 rounded transition-colors text-xs text-blue-600 font-bold"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleRemovePaymentMethod(index)}
                      className="p-1 hover:bg-red-100 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Info adicional */}
      <div className="mt-6 p-4 bg-yellow-50 border-2 border-yellow-900 rounded-lg">
        <p className="text-sm text-yellow-900">
          <strong>💡 Tip:</strong> Los cambios se aplicarán inmediatamente en el POS después de guardar. Asegúrate de informar a tu equipo sobre los nuevos métodos de pago o descuentos configurados.
        </p>
      </div>
    </div>
  );
};

export default POSTab;
