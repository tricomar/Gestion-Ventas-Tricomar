import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package, Store, Wallet } from 'lucide-react';

const KPICards = ({ data }) => {
  if (!data) return null;

  const formatCurrency = (value) => {
    return `$${Math.round(value).toLocaleString('es-CL')}`;
  };

  const formatPercentage = (value) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const kpis = [
    {
      title: 'Ventas Totales',
      value: formatCurrency(data.total_sales.value),
      variation: data.total_sales.variation,
      previous: formatCurrency(data.total_sales.previous),
      icon: DollarSign,
      color: '#D4F0A5'
    },
    {
      title: 'N° de Ventas',
      value: data.num_sales.value.toLocaleString('es-CL'),
      variation: data.num_sales.variation,
      previous: data.num_sales.previous.toLocaleString('es-CL'),
      icon: ShoppingCart,
      color: '#FADBB0'
    },
    {
      title: 'Ticket Promedio',
      value: formatCurrency(data.avg_ticket.value),
      icon: Wallet,
      color: '#FFE4E6'
    },
    {
      title: 'Producto Top',
      value: data.top_product?.name || 'N/A',
      subtitle: data.top_product ? `${data.top_product.quantity} unidades` : '',
      icon: Package,
      color: '#E0E7FF'
    },
    {
      title: 'Tienda/Caja Top',
      value: data.top_store?.name || 'N/A',
      subtitle: data.top_store ? formatCurrency(data.top_store.total) : '',
      icon: Store,
      color: '#FEF3C7'
    },
    {
      title: 'Ventas Netas',
      value: formatCurrency(data.net_sales.value),
      subtitle: `Ventas: ${formatCurrency(data.net_sales.sales)} - Egresos: ${formatCurrency(data.net_sales.expenses)}`,
      icon: TrendingUp,
      color: data.net_sales.value >= 0 ? '#D1FAE5' : '#FECACA'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {kpis.map((kpi, index) => {
        const Icon = kpi.icon;
        const hasVariation = typeof kpi.variation === 'number';
        const isPositive = kpi.variation >= 0;

        return (
          <div
            key={index}
            className="bg-white border-2 border-slate-900 rounded-xl p-6"
            style={{ 
              boxShadow: '6px 6px 0px 0px rgba(15,23,42,1)',
              backgroundColor: kpi.color
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-1">
                  {kpi.title}
                </p>
                <h3 className="text-3xl font-black text-slate-900">
                  {kpi.value}
                </h3>
                {kpi.subtitle && (
                  <p className="text-xs text-slate-600 mt-1 font-medium">
                    {kpi.subtitle}
                  </p>
                )}
              </div>
              <div className="p-3 bg-white border-2 border-slate-900 rounded-lg">
                <Icon className="w-6 h-6 text-slate-900" />
              </div>
            </div>

            {hasVariation && (
              <div className="flex items-center gap-2 pt-3 border-t-2 border-slate-900">
                {isPositive ? (
                  <TrendingUp className="w-5 h-5 text-green-700" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-700" />
                )}
                <span className={`text-sm font-bold ${isPositive ? 'text-green-700' : 'text-red-700'}`}>
                  {formatPercentage(kpi.variation)}
                </span>
                <span className="text-xs text-slate-600">
                  vs. periodo anterior ({kpi.previous})
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default KPICards;
