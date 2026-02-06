import { useEffect, useState } from 'react';
import { getPricingRulesAction, getDiscountTiersAction } from '@/app/actions';
import { PricingRule, DiscountTier } from '@/lib/pricing/types';

export function usePricingRules() {
    const [rules, setRules] = useState<PricingRule[]>([]);
    const [tiers, setTiers] = useState<DiscountTier[]>([]);
    const [rulesLoading, setRulesLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [fetchedRules, fetchedTiers] = await Promise.all([
                    getPricingRulesAction(),
                    getDiscountTiersAction()
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
