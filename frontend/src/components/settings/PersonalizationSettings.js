import React, { useState } from 'react';
import { toast } from 'sonner';
import { Globe, DollarSign, Save } from 'lucide-react';
import { useAppSettings } from '../../hooks/useAppSettings';

const PersonalizationSettings = () => {
  const { settings, timezones, currencies, updateSettings } = useAppSettings();
  const [selectedTimezone, setSelectedTimezone] = useState(settings.timezone);
  const [selectedCurrency, setSelectedCurrency] = useState(settings.currency_code);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateSettings({
        timezone: selectedTimezone,
        currency_code: selectedCurrency
      });

      if (result.success) {
        toast.success('Configuración actualizada', {
          description: 'Los cambios se aplicarán en toda la aplicación'
        });
        
        // Reload page to apply changes everywhere
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        toast.error('Error al guardar', {
          description: result.error || 'Intenta nuevamente'
        });
      }
    } catch (error) {
      toast.error('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = selectedTimezone !== settings.timezone || selectedCurrency !== settings.currency_code;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Personalización</h2>
        <p className="text-sm text-slate-600 mt-1">
          Configura la zona horaria y moneda para tu negocio
        </p>
      </div>

      {/* Timezone Selection */}
      <div 
        className="bg-white border-4 border-slate-900 rounded-xl p-6"
        style={{ boxShadow: '6px 6px 0px 0px rgba(15,23,42,1)' }}
      >
        <div className="flex items-center gap-3 mb-4">
          <Globe className="w-6 h-6 text-blue-600" />
          <h3 className="text-lg font-bold">Zona Horaria</h3>
        </div>
        
        <p className="text-sm text-slate-600 mb-4">
          Todas las ventas, gastos e ingresos se agruparán según esta zona horaria para cálculos diarios exactos.
        </p>

        <select
          value={selectedTimezone}
          onChange={(e) => setSelectedTimezone(e.target.value)}
          className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 font-medium text-slate-900 focus:ring-0 focus:outline-none focus:border-blue-500"
        >
          {timezones.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>

        <div className="mt-3 p-3 bg-blue-50 border-2 border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800">
            <strong>Zona actual:</strong> {settings.timezone}
          </p>
        </div>
      </div>

      {/* Currency Selection */}
      <div 
        className="bg-white border-4 border-slate-900 rounded-xl p-6"
        style={{ boxShadow: '6px 6px 0px 0px rgba(15,23,42,1)' }}
      >
        <div className="flex items-center gap-3 mb-4">
          <DollarSign className="w-6 h-6 text-green-600" />
          <h3 className="text-lg font-bold">Moneda</h3>
        </div>
        
        <p className="text-sm text-slate-600 mb-4">
          Todos los montos se mostrarán con el símbolo de moneda seleccionado en el POS y Dashboard.
        </p>

        <select
          value={selectedCurrency}
          onChange={(e) => setSelectedCurrency(e.target.value)}
          className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 font-medium text-slate-900 focus:ring-0 focus:outline-none focus:border-green-500"
        >
          {currencies.map((curr) => (
            <option key={curr.code} value={curr.code}>
              {curr.symbol} - {curr.name} ({curr.code})
            </option>
          ))}
        </select>

        <div className="mt-3 p-3 bg-green-50 border-2 border-green-200 rounded-lg">
          <p className="text-xs text-green-800">
            <strong>Moneda actual:</strong> {settings.currency_code} ({settings.currency_symbol})
          </p>
        </div>
      </div>

      {/* Save Button */}
      {hasChanges && (
        <div 
          className="bg-yellow-50 border-4 border-yellow-400 rounded-xl p-4"
          style={{ boxShadow: '6px 6px 0px 0px rgba(250,204,21,1)' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-yellow-900">Tienes cambios sin guardar</p>
              <p className="text-sm text-yellow-800">
                Los cambios se aplicarán en toda la aplicación después de guardar
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-slate-900 text-white border-2 border-slate-900 rounded-xl px-6 py-3 font-bold transition-all hover:bg-slate-800 disabled:opacity-50"
              style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
            >
              <Save className="w-5 h-5" />
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="p-4 bg-slate-50 border-2 border-slate-300 rounded-lg">
        <p className="text-xs text-slate-700">
          <strong>💡 Nota:</strong> Los cambios de zona horaria y moneda afectarán:
        </p>
        <ul className="text-xs text-slate-600 mt-2 ml-4 space-y-1">
          <li>• Dashboard: cálculos de ventas diarias</li>
          <li>• Reportes: agrupación por fecha local</li>
          <li>• POS: visualización de montos</li>
          <li>• Todas las transacciones futuras se guardarán con esta configuración</li>
        </ul>
      </div>
    </div>
  );
};

export default PersonalizationSettings;
