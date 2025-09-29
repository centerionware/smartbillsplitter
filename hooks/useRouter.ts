
import { useState, useCallback, useEffect } from 'react';
import { View, Bill } from '../types';
import { useBills } from './useBills'; // To find the source bill

export interface RouterState {
  view: View;
  params: Record<string, any>;
  billConversionSource?: Bill;
}

export const useRouter = (initialView: View = View.Dashboard) => {
  const { bills } = useBills();
  const [routerState, setRouterState] = useState<RouterState>({ view: initialView, params: {}, billConversionSource: undefined });

  const navigate = useCallback((view: View, params: Record<string, any> = {}) => {
    let hash = `#/${view}`;
    const urlParams = new URLSearchParams();

    if (params.billConversionSource) {
        urlParams.set('convertFromBill', params.billConversionSource.id);
        delete params.billConversionSource;
    }

    Object.keys(params).forEach(key => {
        if (params[key]) {
           urlParams.set(key, params[key]);
        }
    });

    const queryString = urlParams.toString();
    if (queryString) {
        hash += `?${queryString}`;
    }
    
    window.location.hash = hash;
  }, []);

  const parseHash = useCallback(() => {
    const hash = window.location.hash;
    const path = hash.split('?')[0].slice(2);
    const query = new URLSearchParams(hash.split('?')[1] || '');
    
    const view = Object.values(View).find(v => v === path) || View.Dashboard;
    const params: Record<string, any> = {};
    query.forEach((value, key) => {
        params[key] = value;
    });

    let billConversionSource: Bill | undefined = undefined;
    const convertFromBillId = query.get('convertFromBill');
    if (convertFromBillId) {
        billConversionSource = bills.find(b => b.id === convertFromBillId);
    }
    
    setRouterState({ view, params, billConversionSource });
  }, [bills]);

  useEffect(() => {
    parseHash(); // Parse on initial load and when bills data changes
    window.addEventListener('hashchange', parseHash);
    return () => window.removeEventListener('hashchange', parseHash);
  }, [parseHash]);

  return { ...routerState, navigate };
};
