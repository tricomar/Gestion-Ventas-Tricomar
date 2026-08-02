import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AdminDashboard from './pages/AdminDashboard';
import DatabaseManagementPage from './pages/DatabaseManagementPage';
import TiendasGlobalesPage from './pages/TiendasGlobalesPage';
import InventoryPage from './pages/InventoryPage';
import ReportsPage from './pages/ReportsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import CustomersPage from './pages/CustomersPage';
import SalesRecordPage from './pages/SalesRecordPage';
import ExpensesRecordPage from './pages/ExpensesRecordPage';
import IncomeRecordPage from './pages/IncomeRecordPage';
import SuperAdminPage from './pages/SuperAdminPage';
import SessionExpiredModal from './components/SessionExpiredModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AccountProvider } from './context/AccountContext';
import { SettingsProvider } from './context/SettingsContext';
import { setupAxiosInterceptor } from './utils/axiosInterceptor';
import './App.css';

// Componente para redirigir según rol
const RoleBasedRedirect = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      if (user.role === 'super_admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, navigate]);

  return null;
};

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
};

const SuperAdminRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'super_admin') return <Navigate to="/dashboard" replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { user } = useAuth();
  return !user ? children : <Navigate to="/" replace />;
};

function AppRoutes() {
  const { 
    user, 
    showSessionExpired, 
    setShowSessionExpired, 
    handleSessionExpired, 
    reauthenticate, 
    logout,
    sessionExpiredReason 
  } = useAuth();
  const navigate = useNavigate();

  // Configurar interceptor de Axios
  useEffect(() => {
    setupAxiosInterceptor(handleSessionExpired);
  }, [handleSessionExpired]);

  // Manejar logout desde el modal
  const handleLogoutFromModal = () => {
    logout('manual');
    setShowSessionExpired(false);
    navigate('/login');
  };

  return (
    <>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <RoleBasedRedirect />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <SuperAdminRoute>
              <AdminDashboard />
            </SuperAdminRoute>
          }
        />
        <Route
          path="/inventory"
          element={
            <ProtectedRoute>
              <InventoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customers"
          element={
            <ProtectedRoute>
              <CustomersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-records"
          element={
            <ProtectedRoute>
              <SalesRecordPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/expenses-records"
          element={
            <ProtectedRoute>
              <ExpensesRecordPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/income-records"
          element={
            <ProtectedRoute>
              <IncomeRecordPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin"
          element={
            <SuperAdminRoute>
              <SuperAdminPage />
            </SuperAdminRoute>
          }
        />
        <Route
          path="/database-management"
          element={
            <SuperAdminRoute>
              <DatabaseManagementPage />
            </SuperAdminRoute>
          }
        />
        <Route
          path="/tiendas-globales"
          element={
            <SuperAdminRoute>
              <TiendasGlobalesPage />
            </SuperAdminRoute>
          }
        />
      </Routes>
      
      {/* Modal de Sesión Expirada */}
      <SessionExpiredModal 
        isOpen={showSessionExpired}
        onReauthenticate={reauthenticate}
        onLogout={handleLogoutFromModal}
      />
      
      <Toaster position="top-right" />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AccountProvider>
        <SettingsProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </SettingsProvider>
      </AccountProvider>
    </AuthProvider>
  );
}

export default App;
