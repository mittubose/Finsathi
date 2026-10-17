import { useState } from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { VaultLock } from './shared/ui/VaultLock';
import { FloatingTasks } from './shared/ui/FloatingTasks';
import { Sidebar } from './shared/ui/Sidebar';
import { MobileNav } from './shared/ui/MobileNav';
import { ToastProvider } from './shared/ui/Toast';
import { ErrorBoundary } from './shared/ui/ErrorBoundary';
import { useKeyboardShortcuts } from './shared/hooks/useKeyboardShortcuts';
import { Onboarding } from './domains/auth/Onboarding';
import { Dashboard } from './domains/ledger/Dashboard';
import { Ledger } from './domains/ledger/Ledger';
import { TaxEngine } from './domains/tax/TaxEngine';
import { AdvanceTax } from './domains/tax/AdvanceTax';
import { Trades } from './domains/trades/Trades';
import { Reminders } from './domains/reminders/Reminders';
import { Recurring } from './domains/recurring/Recurring';
import { Imports } from './domains/imports/Imports';
import { ExcelImport } from './domains/imports/ExcelImport';
import { Reports } from './domains/reports/Reports';
import { FYSummary } from './domains/reports/FYSummary';
import { InflationCalc } from './domains/reports/InflationCalc';
import { FinancialCalc } from './domains/reports/FinancialCalc';
import { Settings } from './domains/auth/Settings';
import { AuditTrail } from './domains/settings/AuditTrail';
import { TaxHelp } from './domains/help/TaxHelp';
import { SalaryStructure } from './domains/salary/SalaryStructure';
import { FinancialChecklist } from './domains/checklist/FinancialChecklist';
import { AnnualInsights } from './domains/reports/AnnualInsights';
import { CommandPalette } from './shared/ui/CommandPalette';
import { GlobalVariables } from './domains/settings/GlobalVariables';
import { FamilyHub } from './domains/family/FamilyHub';
import { InsurancePortfolio } from './domains/risk/InsurancePortfolio';
import { LossHarvesting } from './domains/tax/LossHarvesting';
import { DebtOptimizer } from './domains/planning/DebtOptimizer';
import { BudgetBuckets } from './domains/planning/BudgetBuckets';
import { EducationPlanner } from './domains/planning/EducationPlanner';
import { PlanningHub } from './domains/planning/PlanningHub';
import { FinancialAssistantPage } from './domains/assistant/FinancialAssistantPage';
import { ITR3Wizard } from './domains/tax/ITR3Wizard';
import { ScheduleCG } from './domains/tax/schedules/ScheduleCG';
import { ScheduleBP } from './domains/tax/schedules/ScheduleBP';
import { ScheduleS } from './domains/tax/schedules/ScheduleS';
import { ScheduleHP } from './domains/tax/schedules/ScheduleHP';
import { ScheduleOS } from './domains/tax/schedules/ScheduleOS';
import { ScheduleVIA } from './domains/tax/schedules/ScheduleVIA';
import { ScheduleAIS } from './domains/tax/schedules/ScheduleAIS';
import { ServerSetupWizard } from './shared/ui/ServerSetupWizard';
import { useCommandStore } from './shared/hooks/useCommandStore';
import { useAppStore } from './shared/hooks/useAppStore';
import { initializeFinSathiSystem } from './shared/lib/initializer';
import { useEffect } from 'react';
import './App.css';

function AppLayout() {
  useKeyboardShortcuts();
  const { isServerWizardOpen, closeServerWizard } = useCommandStore();

  return (
    <>
      <Sidebar />
      <main className="app-main">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <MobileNav />
      <TaxHelp />
      <FloatingTasks />
      <CommandPalette />
      <VaultLock />
      <ServerSetupWizard isOpen={isServerWizardOpen} onClose={closeServerWizard} />
    </>
  );
}


function AppRoutes({ onboardDone }: { onboardDone: () => void }) {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/assistant" element={<FinancialAssistantPage />} />
          <Route path="/ledger" element={<Ledger />} />
          <Route path="/tax" element={<TaxEngine />} />
          <Route path="/advance-tax" element={<AdvanceTax />} />
          <Route path="/trades" element={<Trades />} />
          <Route path="/imports" element={<Imports />} />
          <Route path="/imports/excel" element={<ExcelImport />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/fy-summary" element={<FYSummary />} />
          <Route path="/inflation" element={<InflationCalc />} />
          <Route path="/financial-calc" element={<FinancialCalc />} />
          <Route path="/insights" element={<AnnualInsights />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/global-variables" element={<GlobalVariables />} />
          <Route path="/audit" element={<AuditTrail />} />
          <Route path="/family" element={<FamilyHub />} />
          <Route path="/insurance" element={<InsurancePortfolio />} />
          <Route path="/loss-harvesting" element={<LossHarvesting />} />
          
          {/* ITR-3 Routes */}
          <Route path="/itr3" element={<ITR3Wizard />} />
          <Route path="/itr3/cg" element={<ScheduleCG />} />
          <Route path="/itr3/bp" element={<ScheduleBP />} />
          <Route path="/itr3/s" element={<ScheduleS />} />
          <Route path="/itr3/hp" element={<ScheduleHP />} />
          <Route path="/itr3/os" element={<ScheduleOS />} />
          <Route path="/itr3/via" element={<ScheduleVIA />} />
          <Route path="/itr3/ais" element={<ScheduleAIS />} />

          <Route path="/planning" element={<PlanningHub />} />
          <Route path="/debt-optimizer" element={<PlanningHub />} />
          <Route path="/budget" element={<PlanningHub />} />
          <Route path="/education-planner" element={<PlanningHub />} />
          <Route path="/wealth-projector" element={<PlanningHub />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  const [onboarded, setOnboarded] = useState(() =>
    Boolean(localStorage.getItem('finsathi-onboarded'))
  );

  useEffect(() => {
    // Check if device was opened from a Mobile Pairing QR Code
    if (typeof window !== 'undefined' && window.location.search) {
      try {
        const params = new URLSearchParams(window.location.search);
        const auth = params.get('auth');
        const host = params.get('host');
        if (auth) {
          const targetHost = host || window.location.origin;
          useAppStore.getState().setServerConfig(targetHost, auth);
          // Clean address bar without triggering reload
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        }
      } catch (err) {
        console.warn('Failed to parse pairing URL params:', err);
      }
    }
    // Initialize database, profile state isolation, and data recovery
    initializeFinSathiSystem();
  }, []);

  return (
    <ToastProvider>
      {!onboarded ? (
        // Onboarding needs BrowserRouter for useNavigate
        <BrowserRouter>
          <Onboarding onComplete={() => setOnboarded(true)} />
        </BrowserRouter>
      ) : (
        <AppRoutes onboardDone={() => setOnboarded(true)} />
      )}
    </ToastProvider>
  );
}


export default App;
