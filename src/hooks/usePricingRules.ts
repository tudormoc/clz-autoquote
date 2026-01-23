import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchPricingRules } from '@/lib/pricing/engine';
import { PricingRule } from '@/lib/pricing/types';

export function usePricingRules() {
    const [rules, setRules] = useState<PricingRule[]>([]);
    const [rulesLoading, setRulesLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                // fetchPricingRules expects a supabase client. 
                // We use the singleton which is configured with public key.
                const fetched = await fetchPricingRules(supabase);
                setRules(fetched);
            } catch (e) {
                console.error("Failed to load pricing rules", e);
            } finally {
                setRulesLoading(false);
            }
        };
        load();
    }, []);

    return { rules, rulesLoading };
}
