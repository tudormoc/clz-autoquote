import { useEffect, useState } from 'react';
import { getPricingRulesAction, getDiscountTiersAction, getSignatureTypesAction } from '@/app/actions';
import { PricingRule, DiscountTier, SignatureType } from '@/lib/pricing/types';

export function usePricingRules() {
    const [rules, setRules] = useState<PricingRule[]>([]);
    const [tiers, setTiers] = useState<DiscountTier[]>([]);
    const [signatureTypes, setSignatureTypes] = useState<SignatureType[]>([]);
    const [rulesLoading, setRulesLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [fetchedRules, fetchedTiers, fetchedSignatures] = await Promise.all([
                    getPricingRulesAction(),
                    getDiscountTiersAction(),
                    getSignatureTypesAction()
                ]);
                setRules(fetchedRules);
                setTiers(fetchedTiers);
                setSignatureTypes(fetchedSignatures);
            } catch (e) {
                console.error("Failed to load pricing data", e);
            } finally {
                setRulesLoading(false);
            }
        };
        load();
    }, []);

    return { rules, tiers, signatureTypes, rulesLoading };
}
