/**
 * Utilidades de fecha para manejar zona horaria de Chile
 */

/**
 * Obtiene la fecha actual en zona horaria de Chile (America/Santiago)
 * en formato YYYY-MM-DD
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
export const getChileDate = () => {
  const now = new Date();
  
  // Convertir a zona horaria de Chile (America/Santiago)
  const chileDate = new Date(now.toLocaleString('en-US', { 
    timeZone: 'America/Santiago' 
  }));
  
  const year = chileDate.getFullYear();
  const month = String(chileDate.getMonth() + 1).padStart(2, '0');
  const day = String(chileDate.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * Obtiene la fecha y hora actual en zona horaria de Chile
 * @returns {Date} Objeto Date en zona horaria de Chile
 */
export const getChileDateTime = () => {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { 
    timeZone: 'America/Santiago' 
  }));
};

/**
 * Formatea una fecha para mostrar en formato chileno
 * @param {Date|string} date - Fecha a formatear
 * @returns {string} Fecha formateada (ej: "02/08/2026")
 */
export const formatChileDate = (date) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-CL');
};
