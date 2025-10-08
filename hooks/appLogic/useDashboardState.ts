import { useState, useCallback } from 'react';
import type { DashboardView, SummaryFilter } from '../../types';

export const useDashboardState = () => {
    const [dashboardView, setDashboardView] = useState<DashboardView>('bills');
    const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
    const [dashboardStatusFilter, setDashboardStatusFilter] = useState<'active' | 'archived'>('active');
    const [dashboardSummaryFilter, setDashboardSummaryFilter] = useState<SummaryFilter>('total');
    const [budgetDate, setBudgetDate] = useState<{ year: number; month: number } | 'last30days'>('last30days');

    const onSelectParticipant = useCallback((name: string | null) => {
        if (name) {
            setDashboardView('participants');
        }
        setSelectedParticipant(name);
    }, []);

    const onClearParticipant = useCallback(() => {
        setSelectedParticipant(null);
    }, []);
    
    // FIX: Renamed state setters to 'onSet...' to align with prop naming conventions in AppRouter and Dashboard components.
    return {
        dashboardView,
        onSetDashboardView: setDashboardView,
        selectedParticipant,
        setSelectedParticipant,
        dashboardStatusFilter,
        onSetDashboardStatusFilter: setDashboardStatusFilter,
        dashboardSummaryFilter,
        onSetDashboardSummaryFilter: setDashboardSummaryFilter,
        budgetDate,
        setBudgetDate,
        onSelectParticipant,
        onClearParticipant,
    };
};