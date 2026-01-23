import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchPricingRules, fetchDiscountTiers } from '@/lib/pricing/engine';
import { PricingRule, DiscountTier } from '@/lib/pricing/types';

export function usePricingRules() {
    const [rules, setRules] = useState<PricingRule[]>([]);
    const [tiers, setTiers] = useState<DiscountTier[]>([]);
    const [rulesLoading, setRulesLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [fetchedRules, fetchedTiers] = await Promise.all([
                    fetchPricingRules(supabase),
                    fetchDiscountTiers(supabase)
                ]);
                setRules(fetchedRules);
                setTiers(fetchedTiers);
            } catch (e) {
                console.error("Failed to load pricing data", e);
            } finally {
                setRulesLoading(false);
            }
        };
        load();
    }, []);

    return { rules, tiers, rulesLoading };
}
