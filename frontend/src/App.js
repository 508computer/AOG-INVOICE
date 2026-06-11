import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Toaster } from "sonner";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Invoices from "@/pages/Invoices";
import InvoiceForm from "@/pages/InvoiceForm";
import InvoiceView from "@/pages/InvoiceView";
import Clients from "@/pages/Clients";
import Users from "@/pages/Users";
import ExchangeRates from "@/pages/ExchangeRates";
import Settings from "@/pages/Settings";
import "@/App.css";

function AdminOnly({ children }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/invoices/new" element={<InvoiceForm />} />
            <Route path="/invoices/:id" element={<InvoiceView />} />
            <Route path="/invoices/:id/edit" element={<AdminOnly><InvoiceForm /></AdminOnly>} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/users" element={<AdminOnly><Users /></AdminOnly>} />
            <Route path="/exchange-rates" element={<AdminOnly><ExchangeRates /></AdminOnly>} />
            <Route path="/settings" element={<AdminOnly><Settings /></AdminOnly>} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors closeButton />
    </AuthProvider>
  );
}

export default App;
