import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "@/services/authConfig";
import Index from "./pages/Index";
import Policies from "./pages/Policies";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/Dashboard";
import DashboardCompliance from "./pages/DashboardCompliance";
import GroupLookup from "./pages/GroupLookup";
import Audit from "@/pages/Audit";

const queryClient = new QueryClient();
const msalInstance = new PublicClientApplication(msalConfig);

const App = () => (
  <MsalProvider instance={msalInstance}>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="intune-dashboard-theme">
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/filter" element={<Index />} />
            <Route path="/demo" element={<Index />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="/policies" element={<Policies />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/compliance" element={<DashboardCompliance />} />
            <Route path="/groups" element={<GroupLookup />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </MsalProvider>
);

export default App;
