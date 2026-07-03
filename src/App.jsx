import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import ProtectedRoute from './routes/ProtectedRoute';

// Layouts
import AuthLayout from './layouts/AuthLayout';
import AppLayout from './layouts/AppLayout';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';

// Module Pages
import DashboardPage from './pages/dashboard/DashboardPage';
import ApproachedPage from './pages/approached/ApproachedPage';
import CommunicationPage from './pages/communication/CommunicationPage';
import RequirementsPage from './pages/requirements/RequirementsPage';
import RequirementTypesPage from './pages/requirement-types/RequirementTypesPage';
import OrderProcessingPage from './pages/order-processing/OrderProcessingPage';
import PaymentCyclePage from './pages/payment-cycle/PaymentCyclePage';
import EmployeeManagementPage from './pages/employee-management/EmployeeManagementPage';
import SettingsPage from './pages/settings/SettingsPage';
import NotFoundPage from './components/common/NotFoundPage';

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <Router>
          <Routes>
            {/* Guest/Auth routes */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            </Route>

            {/* Protected internal portal routes */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<DashboardPage />} />
              <Route path="/approached" element={<ApproachedPage />} />
              <Route path="/communication" element={<CommunicationPage />} />
              <Route path="/requirements" element={<RequirementsPage />} />
              <Route path="/requirement-types" element={<RequirementTypesPage />} />
              <Route path="/order-processing" element={<OrderProcessingPage />} />
              <Route path="/payment-cycle" element={<PaymentCyclePage />} />
              <Route path="/employee-management" element={<EmployeeManagementPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              
              {/* Fallback internal page */}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Router>
      </AppProvider>
    </AuthProvider>
  );
}
