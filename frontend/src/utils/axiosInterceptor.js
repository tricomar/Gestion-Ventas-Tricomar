import axios from 'axios';

let sessionExpiredHandler = null;

export const setupAxiosInterceptor = (handleSessionExpired) => {
  sessionExpiredHandler = handleSessionExpired;

  // Interceptor para respuestas
  axios.interceptors.response.use(
    (response) => {
      // Si la respuesta es exitosa, simplemente la retornamos
      return response;
    },
    (error) => {
      // Si hay un error de autenticación (401)
      if (error.response && error.response.status === 401) {
        const token = localStorage.getItem('token');
        
        // Solo mostrar el modal si había un token (usuario estaba autenticado)
        if (token && sessionExpiredHandler) {
          sessionExpiredHandler();
        }
      }
      
      // Rechazar la promesa con el error original
      return Promise.reject(error);
    }
  );
};

export const clearAxiosInterceptor = () => {
  sessionExpiredHandler = null;
};
