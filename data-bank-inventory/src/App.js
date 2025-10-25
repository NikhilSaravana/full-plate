import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './backend/contexts/AuthContext';
import { LanguageProvider } from './backend/contexts/LanguageContext';
import { NotificationProvider } from './backend/contexts/NotificationContext';
import Dashboard from './frontend/pages/Dashboard';
import Login from './frontend/components/Auth/Login';
import Register from './frontend/components/Auth/Register';
import ForgotPassword from './frontend/components/Auth/ForgotPassword';
import HelpButton from './frontend/components/HelpButton';
import GlobalSearch from './frontend/components/GlobalSearch';
import NotificationContainer from './frontend/components/NotificationContainer';
import KeyboardShortcuts from './frontend/components/KeyboardShortcuts';
import './frontend/styles/App.css';

// Protected Route wrapper
function ProtectedRoute({ children }) {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/login" />;
}

// Public Route wrapper (redirects to dashboard if already logged in)
function PublicRoute({ children }) {
  const { currentUser } = useAuth();
  return currentUser ? <Navigate to="/" /> : children;
}

function AppRoutes() {
  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } 
        />
        <Route 
          path="/register" 
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          } 
        />
        <Route 
          path="/forgot-password" 
          element={
            <PublicRoute>
              <ForgotPassword />
            </PublicRoute>
          } 
        />
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <div className="App">
      <LanguageProvider>
        <NotificationProvider>
          <AuthProvider>
            <AppRoutes />
            <HelpButton />
            <NotificationContainer />
            <KeyboardShortcuts />
          </AuthProvider>
        </NotificationProvider>
      </LanguageProvider>
    </div>
  );
}

export default App;