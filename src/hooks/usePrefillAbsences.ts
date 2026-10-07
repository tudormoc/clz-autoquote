'use client';

import { useState } from 'react';
import { prefillAbsencesAction, type PrefillResult } from '@/app/presence/presence-actions';
import { notify } from '@/lib/notify';
import type { PresenceRulesConfig } from '@/lib/presence';
import { APP_COPY, fmt } from '@/locales';

/** Counts of the dry run, by kind of day */
export type PrefillSummary = Pick<
    PrefillResult,
    'totalCount' | 'absencesCount' | 'partialCount' | 'fullCount' | 'overflowCount' | 'extraCount' | 'fixedCount'
>;

const copy = APP_COPY.analytics.monthlySummary.prefill;

interface Options {
    /** Applied period of the table, null before the first search */
    period: { dateFrom: string; dateTo: string } | null;
    rules: PresenceRulesConfig;
    /** The check also returns the rules it used, so the summary shows the same numbers */
    onRules: (rules: PresenceRulesConfig) => void;
    /** Reloads the table after the hours were written */
    onDone: () => Promise<void>;
}

/**
 * "Precompila e Distribuisci Ore" of the monthly hours: a dry run that counts what would be filled in
 * (shown for confirmation), then the real run on confirm.
 */
export function usePrefillAbsences({ period, rules, onRules, onDone }: Options) {
    const [summary, setSummary] = useState<PrefillSummary | null>(null);
    const [checking, setChecking] = useState(false);
    const [prefilling, setPrefilling] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);

    const check = async () => {
        if (!period || checking || prefilling) return;
        setChecking(true);
        setFeedback(null);
        try {
            const res = await prefillAbsencesAction(period.dateFrom, period.dateTo, true);
            if (!res.success) {
                notify.failure(res.error);
            } else if (res.totalCount > 0) {
                if (res.rules) onRules(res.rules);
                setSummary(res);
            } else {
                setFeedback(res.message ?? copy.noCandidates);
            }
        } catch (err) {
            notify.failure(err);
        } finally {
            setChecking(false);
        }
    };

    const execute = async () => {
        if (!period || prefilling) return;
        setPrefilling(true);
        try {
            const res = await prefillAbsencesAction(period.dateFrom, period.dateTo, false);
            if (res.success) {
                setSummary(null);
                setFeedback(`${res.totalCount} ${fmt(copy.successMessage, { h: rules.workdayHours })}`);
                await onDone();
            } else {
                notify.failure(res.error);
            }
        } catch (err) {
            notify.failure(err);
        } finally {
            setPrefilling(false);
        }
    };

    return { summary, checking, prefilling, feedback, check, execute, cancel: () => setSummary(null) };
}
