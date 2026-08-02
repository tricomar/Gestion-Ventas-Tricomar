import React, { useState, useEffect } from 'react';
import { X, Calculator, DollarSign, TrendingUp, Percent, CreditCard, Search, Check } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PriceCalculatorModal = ({ isOpen, onClose, onProductUpdated }) => {
  const [costo, setCosto] = useState('');
  const [margen, setMargen] = useState('30');
  const [iva, setIva] = useState('19');
  const [comisionPOS, setComisionPOS] = useState('3');
  const [comisionAfectaIVA, setComisionAfectaIVA] = useState(true);

  // Búsqueda de productos
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const [resultados, setResultados] = useState({
    costoProducto: 0,
    margenGanancia: 0,
    precioSinIVA: 0,
    precioConIVA: 0,
    comisionMaquina: 0
  });

  useEffect(() => {
    if (costo && margen) {
      calcularPrecio();
    }
  }, [costo, margen, iva, comisionPOS, comisionAfectaIVA]);

  // Búsqueda de productos con debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchProducts();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const calcularPrecio = () => {
    const costoNum = parseFloat(costo) || 0;
    const margenNum = parseFloat(margen) || 0;
    const ivaNum = parseFloat(iva) || 19;
    const comisionNum = parseFloat(comisionPOS) || 0;

    if (costoNum <= 0) {
      setResultados({
        costoProducto: 0,
        margenGanancia: 0,
        precioSinIVA: 0,
        precioConIVA: 0,
        comisionMaquina: 0
      });
      return;
    }

    // Fórmula: precio = costo ÷ (1 − margen/100)
    const precioSinIVA = costoNum / (1 - margenNum / 100);
    
    // Margen de ganancia en pesos
    const margenPesos = precioSinIVA - costoNum;
    
    // Precio con IVA
    const precioConIVA = precioSinIVA * (1 + ivaNum / 100);
    
    // Comisión POS
    let comisionMaquina = 0;
    if (comisionAfectaIVA) {
      // La comisión se calcula sobre el precio con IVA
      comisionMaquina = precioConIVA * (comisionNum / 100);
    } else {
      // La comisión se calcula sobre el precio sin IVA
      comisionMaquina = precioSinIVA * (comisionNum / 100);
    }

    setResultados({
      costoProducto: costoNum,
      margenGanancia: margenPesos,
      precioSinIVA: precioSinIVA,
      precioConIVA: precioConIVA,
      comisionMaquina: comisionMaquina
    });
  };

  const searchProducts = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      console.log('🔍 Buscando productos:', searchQuery);
      const response = await axios.get(`${API}/products/search`, {
        params: { q: searchQuery }
      });
      console.log('✅ Resultados encontrados:', response.data);
      setSearchResults(response.data);
    } catch (error) {
      console.error('❌ Error searching products:', error);
      toast.error('Error al buscar productos');
    } finally {
      setIsSearching(false);
    }
  };

  const selectProduct = (product) => {
    setSelectedProduct(product);
    setSearchQuery(product.name);
    setSearchResults([]);
    // Pre-llenar el costo si existe
    if (product.cost_price) {
      setCosto(product.cost_price.toString());
    }
  };

  const applyPriceToProduct = async () => {
    if (!selectedProduct) {
      toast.error('Debes seleccionar un producto primero');
      return;
    }

    if (!resultados.precioConIVA || resultados.precioConIVA <= 0) {
      toast.error('Calcula un precio válido primero');
      return;
    }

    setIsApplying(true);
    try {
      const updatedProductData = {
        name: selectedProduct.name,
        sku: selectedProduct.sku,
        category: selectedProduct.category,
        store: selectedProduct.store,
        cost_price: resultados.costoProducto,
        sale_price: Math.round(resultados.precioConIVA) // Redondear al entero más cercano
      };

      await axios.put(`${API}/products/${selectedProduct.id}`, updatedProductData);
      
      toast.success(`✓ Precio aplicado a "${selectedProduct.name}"`, {
        duration: 4000,
        style: {
          background: '#D4F0A5',
          color: '#0f172a',
          border: '2px solid #0f172a',
          fontWeight: 'bold',
        }
      });

      // Notificar al padre que se actualizó un producto
      if (onProductUpdated) {
        onProductUpdated();
      }

      // Limpiar selección
      setSelectedProduct(null);
      setSearchQuery('');
      setCosto('');
    } catch (error) {
      console.error('Error applying price:', error);
      toast.error('✗ Error al aplicar el precio al producto', {
        duration: 4000,
        style: {
          background: '#FFA8A8',
          color: '#0f172a',
          border: '2px solid #0f172a',
          fontWeight: 'bold',
        }
      });
    } finally {
      setIsApplying(false);
    }
  };

  const clearSelection = () => {
    setSelectedProduct(null);
    setSearchQuery('');
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(value);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div 
        className="bg-white border-4 border-slate-900 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        style={{ boxShadow: '12px 12px 0px 0px rgba(15,23,42,1)' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b-4 border-slate-900 px-8 py-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#D4F0A5] border-2 border-slate-900 rounded-xl">
              <Calculator className="w-6 h-6 text-slate-900" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900">Calculadora de Precio de Venta</h2>
              <p className="text-sm text-slate-600">Calcula el precio ideal considerando IVA y comisiones</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 space-y-6">
          {/* Sección de Búsqueda de Producto (Opcional) */}
          <div 
            className="bg-blue-50 border-2 border-blue-900 rounded-xl p-6"
            style={{ boxShadow: '4px 4px 0px 0px rgba(59,130,246,0.3)' }}
          >
            <h3 className="text-lg font-black text-blue-900 mb-3 flex items-center gap-2">
              <Search className="w-5 h-5" />
              Aplicar a Producto (Opcional)
            </h3>
            <p className="text-sm text-blue-800 mb-4">
              Busca un producto de tu inventario para aplicarle directamente el precio calculado
            </p>
            
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre o SKU..."
                className="w-full pl-12 pr-4 py-3 border-2 border-slate-900 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={selectedProduct !== null}
              />
              {selectedProduct && (
                <button
                  onClick={clearSelection}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-600 hover:text-slate-900"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Resultados de búsqueda */}
            {searchResults.length > 0 && !selectedProduct && (
              <div className="mt-3 bg-white border-2 border-slate-900 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                {searchResults.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => selectProduct(product)}
                    className="w-full px-4 py-3 text-left hover:bg-slate-100 border-b border-slate-200 last:border-b-0 transition-colors"
                  >
                    <div className="font-bold text-slate-900">{product.name}</div>
                    {product.sku && (
                      <div className="text-xs text-slate-500 font-mono">SKU: {product.sku}</div>
                    )}
                    {product.cost_price && (
                      <div className="text-xs text-slate-600 mt-1">
                        Costo actual: ${product.cost_price.toLocaleString('es-CL')}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Producto seleccionado */}
            {selectedProduct && (
              <div className="mt-3 bg-white border-2 border-green-600 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-green-600" />
                      <span className="font-bold text-slate-900">{selectedProduct.name}</span>
                    </div>
                    {selectedProduct.sku && (
                      <div className="text-xs text-slate-500 font-mono ml-7">SKU: {selectedProduct.sku}</div>
                    )}
                    <div className="text-sm text-slate-600 ml-7 mt-1">
                      Precio actual: ${(selectedProduct.sale_price || 0).toLocaleString('es-CL')}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isSearching && (
              <div className="mt-3 text-center text-sm text-slate-600">
                Buscando...
              </div>
            )}
          </div>

          {/* Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Costo */}
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                <DollarSign className="w-4 h-4" />
                Costo Total Unitario del Producto
              </label>
              <input
                type="number"
                value={costo}
                onChange={(e) => setCosto(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-3 border-2 border-slate-900 rounded-xl font-mono text-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <p className="text-xs text-slate-500 mt-1">
                Todo lo que te cuesta: compra/producción + envío
              </p>
            </div>

            {/* Margen */}
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                <TrendingUp className="w-4 h-4" />
                Margen de Ganancia que Quieres
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={margen}
                  onChange={(e) => setMargen(e.target.value)}
                  placeholder="30"
                  className="w-full px-4 py-3 pr-12 border-2 border-slate-900 rounded-xl font-mono text-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-600">%</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Ej: $10.000 con 30% → $14.285 (30% del precio de venta)
              </p>
            </div>

            {/* IVA */}
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                <Percent className="w-4 h-4" />
                IVA
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={iva}
                  onChange={(e) => setIva(e.target.value)}
                  placeholder="19"
                  className="w-full px-4 py-3 pr-12 border-2 border-slate-900 rounded-xl font-mono text-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-600">%</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                En Chile es 19%
              </p>
            </div>

            {/* Comisión POS */}
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                <CreditCard className="w-4 h-4" />
                Comisión POS
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={comisionPOS}
                  onChange={(e) => setComisionPOS(e.target.value)}
                  placeholder="3"
                  className="w-full px-4 py-3 pr-12 border-2 border-slate-900 rounded-xl font-mono text-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-600">%</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Lo que te cobra tu máquina por venta
              </p>
            </div>
          </div>

          {/* Checkbox */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="comision-iva"
              checked={comisionAfectaIVA}
              onChange={(e) => setComisionAfectaIVA(e.target.checked)}
              className="w-5 h-5 border-2 border-slate-900 rounded"
            />
            <label htmlFor="comision-iva" className="text-sm font-medium text-slate-700">
              La comisión del POS está afecta a IVA (lo habitual)
            </label>
          </div>

          {/* Resultados */}
          <div 
            className="bg-gradient-to-br from-[#D4F0A5] to-[#c5e196] border-4 border-slate-900 rounded-2xl p-6"
            style={{ boxShadow: '6px 6px 0px 0px rgba(15,23,42,1)' }}
          >
            <h3 className="text-xl font-black text-slate-900 mb-4">Resultados</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b-2 border-slate-900/20">
                <span className="font-medium text-slate-700">Costo del producto</span>
                <span className="font-mono font-bold text-lg">{formatCurrency(resultados.costoProducto)}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b-2 border-slate-900/20">
                <span className="font-medium text-slate-700">Margen de ganancia</span>
                <span className="font-mono font-bold text-lg text-green-700">{formatCurrency(resultados.margenGanancia)}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b-2 border-slate-900/20">
                <span className="font-medium text-slate-700">Precio de venta sin IVA</span>
                <span className="font-mono font-bold text-lg">{formatCurrency(resultados.precioSinIVA)}</span>
              </div>
              
              <div className="flex justify-between items-center py-3 bg-white border-2 border-slate-900 rounded-xl px-4 mt-4">
                <span className="font-bold text-slate-900 text-lg">Tu Precio de Venta con IVA</span>
                <span className="font-mono font-black text-2xl text-slate-900">{formatCurrency(resultados.precioConIVA)}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-t-2 border-slate-900/20 pt-3">
                <span className="font-medium text-slate-700">Comisión de la máquina (IVA incluido)</span>
                <span className="font-mono font-bold text-lg text-red-700">-{formatCurrency(resultados.comisionMaquina)}</span>
              </div>
            </div>
          </div>

          {/* Info adicional */}
          <div className="bg-blue-50 border-2 border-blue-900 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>💡 Fórmula utilizada:</strong> Precio = Costo ÷ (1 − Margen%)
              <br />
              Tu ganancia será el {margen || 0}% del precio de venta final.
            </p>
          </div>

          {/* Botón Aplicar Precio (solo si hay producto seleccionado) */}
          {selectedProduct && (
            <div className="flex gap-3">
              <button
                onClick={applyPriceToProduct}
                disabled={isApplying || !resultados.precioConIVA || resultados.precioConIVA <= 0}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white border-2 border-slate-900 rounded-xl px-6 py-4 font-bold hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ boxShadow: '4px 4px 0px 0px rgba(15,23,42,1)' }}
              >
                {isApplying ? (
                  <>Aplicando...</>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Aplicar Precio a "{selectedProduct.name}"
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PriceCalculatorModal;
