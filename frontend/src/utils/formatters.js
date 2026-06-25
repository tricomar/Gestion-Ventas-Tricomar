// Utility function para formatear montos sin decimales
export const formatCurrency = (amount) => {
  return Math.round(amount).toLocaleString('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
};
