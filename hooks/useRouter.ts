import { useState, useEffect, useCallback } from 'react';
import type { Bill, ImportedBill, RecurringBill, SummaryFilter } from '../types.ts';
import { View } from '../types.ts';

// Determine if the app is running in an iframe.
const isInIframe = window.self !== window.top;

interface RouterProps {
  bills: Bill[];
  importedBills: ImportedBill[];
  recurringBills: RecurringBill[];
}

export const useRouter = ({ bills, importedBills, recurringBills }: RouterProps) => {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return isInIframe ? '#/' : (window.location.hash || '#/');
  });
  
  const [view, setView] = useState<View>(View.Dashboard);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [selectedImportedBill, setSelectedImportedBill] = useState<ImportedBill | null>(null);
  const [billCreationTemplate, setBillCreationTemplate] = useState<RecurringBill | { forEditing: RecurringBill } | null>(null);
  
  // Dashboard-specific view state
  const [dashboardView, setDashboardView] = useState<'bills' | 'participants'>('bills');
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState<'active' | 'archived'>('active');
  const [dashboardParticipant, setDashboardParticipant] = useState<string | null>(null);
  const [dashboardSummaryFilter, setDashboardSummaryFilter] = useState<SummaryFilter>('total');

  const navigate = useCallback((hash: string, options?: { replace?: boolean }) => {
    setCurrentPath(hash);
    if (!isInIframe) {
      const method = options?.replace ? 'replaceState' : 'pushState';
      const currentHash = window.location.hash || '#/';
      if (method === 'pushState' && currentHash === hash) return;
      window.history[method](null, '', hash);
    }
  }, [isInIframe]);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.hash || '#/');
    if (!isInIframe) {
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [isInIframe]);

  useEffect(() => {
    const hash = currentPath;
    const [path, queryString] = hash.split('?');
    const params = new URLSearchParams(queryString || '');

    setSelectedBill(null);
    setSelectedImportedBill(null);
    setBillCreationTemplate(null);
    setDashboardParticipant(null);

    const statusParam = params.get('status');
    const status = statusParam === 'archived' ? 'archived' : 'active';
    const summaryFilterParam = params.get('summaryFilter');
    const summaryFilter: SummaryFilter = (summaryFilterParam === 'othersOweMe' || summaryFilterParam === 'iOwe') ? summaryFilterParam : 'total';
    
    if (path.startsWith('#/bill/')) {
      const billId = path.substring(7);
      const bill = bills.find(b => b.id === billId);
      if (bill) {
        setSelectedBill(bill);
        setView(View.BillDetails);
      } else {
        navigate('#/', { replace: true });
      }
    } else if (path.startsWith('#/imported-bill/')) {
      const billId = path.substring(16);
      const bill = importedBills.find(b => b.id === billId);
      if (bill) {
        setSelectedImportedBill(bill);
        setView(View.ImportedBillDetails);
      } else {
        navigate('#/', { replace: true });
      }
    } else if (path.startsWith('#/view-bill')) {
      setView(View.ViewSharedBill);
    } else if (path === '#/create') {
      const fromTemplateId = params.get('fromTemplate');
      const editTemplateId = params.get('editTemplate');
      if (fromTemplateId) {
        const template = recurringBills.find(rb => rb.id === fromTemplateId);
        setBillCreationTemplate(template || null);
      } else if (editTemplateId) {
        const template = recurringBills.find(rb => rb.id === editTemplateId);
        setBillCreationTemplate(template ? { forEditing: template } : null);
      } else {
        setBillCreationTemplate(null);
      }
      setView(View.CreateBill);
    } else if (path === '#/settings') {
      setView(View.Settings);
    } else if (path === '#/manage-subscription') {
      setView(View.ManageSubscriptionPage);
    } else if (path === '#/sync') {
      setView(View.Sync);
    } else if (path === '#/disclaimer') {
      setView(View.Disclaimer);
    } else if (path === '#/recurring') {
      setView(View.RecurringBills);
    } else if (path.startsWith('#/participants/')) {
      const participantName = decodeURIComponent(path.substring(15));
      setDashboardParticipant(participantName);
      setDashboardView('participants');
      setDashboardStatusFilter(status);
      setView(View.Dashboard);
    } else {
      const view = path.startsWith('#/participants') ? 'participants' : 'bills';
      setDashboardView(view);
      setDashboardStatusFilter(status);
      setDashboardSummaryFilter(summaryFilter);
      setView(View.Dashboard);
    }
  }, [currentPath, bills, recurringBills, importedBills, navigate]);

  return {
    view,
    selectedBill,
    selectedImportedBill,
    billCreationTemplate,
    dashboardView,
    dashboardStatusFilter,
    dashboardSummaryFilter,
    dashboardParticipant,
    navigate,
    currentPath
  };
};
