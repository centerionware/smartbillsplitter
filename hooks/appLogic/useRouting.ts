import { useState, useCallback, useEffect } from 'react';
import { View, Bill, RecurringBill, Group } from '../../types';

interface RoutingDependencies {
    bills: Bill[];
    recurringBills: RecurringBill[];
    groups: Group[];
}

export const useRouting = ({ bills, recurringBills, groups }: RoutingDependencies) => {
    const [routerState, setRouterState] = useState({
        view: View.Dashboard,
        params: {} as Record<string, any>,
        billConversionSource: undefined as Bill | undefined,
        recurringBillToEdit: undefined as RecurringBill | undefined,
        fromTemplate: undefined as RecurringBill | undefined,
        groupToEdit: undefined as Group | undefined,
        currentGroup: undefined as Group | undefined,
    });

    const navigate = useCallback((view: View, params: Record<string, any> = {}) => {
        let hash = `#/${view}`;
        const urlParams = new URLSearchParams();
        const newParams = {...params};

        if (newParams.recurringBillToEdit) { urlParams.set('editTemplateId', newParams.recurringBillToEdit.id); delete newParams.recurringBillToEdit; }
        if (newParams.fromTemplate) { urlParams.set('fromTemplateId', newParams.fromTemplate.id); delete newParams.fromTemplate; }
        if (newParams.convertFromBill) { urlParams.set('convertFromBillId', newParams.convertFromBill); delete newParams.convertFromBill; }
        if (newParams.groupToEdit) { urlParams.set('editGroupId', newParams.groupToEdit.id); delete newParams.groupToEdit; }
        if (newParams.groupToView) { urlParams.set('groupId', newParams.groupToView.id); delete newParams.groupToView; }
        if (newParams.billId) { urlParams.set('billId', newParams.billId); }
        if (newParams.importedBillId) { urlParams.set('importedBillId', newParams.importedBillId); }
        
        Object.keys(newParams).forEach(key => {
            if (newParams[key] !== undefined && newParams[key] !== null) {
               urlParams.set(key, String(newParams[key]));
            }
        });
    
        const queryString = urlParams.toString();
        if (queryString) {
            hash += `?${queryString}`;
        }
        
        window.location.hash = hash;
    }, []);

    useEffect(() => {
        const parseHash = () => {
            const hash = window.location.hash;
            const pathWithQuery = hash.substring(1);
            const [path, queryString] = pathWithQuery.split('?');
            const viewPath = path.startsWith('/') ? path.substring(1) : path;
            const view = Object.values(View).find(v => v === viewPath) || View.Dashboard;
            const query = new URLSearchParams(queryString || '');
            
            const params: Record<string, any> = {};
            query.forEach((value, key) => { params[key] = value; });
        
            const convertFromBillId = query.get('convertFromBillId');
            const billConversionSource = bills.find(b => b.id === convertFromBillId);
        
            const editTemplateId = query.get('editTemplateId');
            const recurringBillToEdit = recurringBills.find(b => b.id === editTemplateId);
        
            const fromTemplateId = query.get('fromTemplateId');
            const fromTemplate = recurringBills.find(b => b.id === fromTemplateId);

            const editGroupId = query.get('editGroupId');
            const groupToEdit = groups.find(g => g.id === editGroupId);

            const groupId = query.get('groupId');
            const currentGroup = groups.find(g => g.id === groupId);
            
            setRouterState({ view, params, billConversionSource, recurringBillToEdit, fromTemplate, groupToEdit, currentGroup });
        };

        parseHash();
        window.addEventListener('hashchange', parseHash);
        return () => window.removeEventListener('hashchange', parseHash);
    }, [bills, recurringBills, groups]);

    return { ...routerState, navigate };
};
