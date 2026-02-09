import { useEffect, useState } from 'react';
import { getPricingRulesAction, getDiscountTiersAction, getSignatureTypesAction, getFormatSurchargesAction } from '@/app/actions';
import { PricingRule, DiscountTier, SignatureType } from '@/lib/pricing/types';
import { FormatSurcharge } from '@/types';

export function usePricingRules() {
    const [rules, setRules] = useState<PricingRule[]>([]);
    const [tiers, setTiers] = useState<DiscountTier[]>([]);
    const [signatureTypes, setSignatureTypes] = useState<SignatureType[]>([]);
    const [formatSurcharges, setFormatSurcharges] = useState<FormatSurcharge[]>([]);
    const [rulesLoading, setRulesLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [fetchedRules, fetchedTiers, fetchedSignatures, fetchedSurcharges] = await Promise.all([
                    getPricingRulesAction(),
                    getDiscountTiersAction(),
                    getSignatureTypesAction(),
                    getFormatSurchargesAction()
                ]);
                setRules(fetchedRules);
                setTiers(fetchedTiers);
                setSignatureTypes(fetchedSignatures);
                setFormatSurcharges(fetchedSurcharges);
            } catch (e) {
                console.error("Failed to load pricing data", e);
            } finally {
                setRulesLoading(false);
            }
        };
        load();
    }, []);

    return { rules, tiers, signatureTypes, formatSurcharges, rulesLoading };
}
