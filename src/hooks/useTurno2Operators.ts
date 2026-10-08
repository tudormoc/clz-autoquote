'use client';

import { useEffect, useRef, useState } from 'react';
import { getTurno2OperatorsAction, searchOperatorsAction, setOperatorGruppoAction, type OperatorGroupRow } from '@/app/presence/operators-actions';
import { APP_CONFIG } from '@/config/constants';
import { notify } from '@/lib/notify';

const TURNO2 = APP_CONFIG.PRESENCE.TURNO2_GROUP;

export const isTurno2 = (operator: OperatorGroupRow) => (operator.GRUPPO ?? '').toUpperCase() === TURNO2;

/** Operators of the second shift (GRUPPO = TURNO2): the current list, a search to find others, add and remove. */
export function useTurno2Operators() {
    const [members, setMembers] = useState<OperatorGroupRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [term, setTerm] = useState('');
    const [results, setResults] = useState<OperatorGroupRow[]>([]);
    const [searching, setSearching] = useState(false);
    /** Operator code of the change in progress */
    const [busy, setBusy] = useState<string | null>(null);
    // Only the latest search may fill the results
    const searchId = useRef(0);

    useEffect(() => {
        getTurno2OperatorsAction()
            .then((res) => {
                if (res.success) setMembers(res.data);
            })
            .catch(notify.failure)
            .finally(() => setLoading(false));
    }, []);

    const search = async (value: string) => {
        setTerm(value);
        const id = ++searchId.current;
        if (!value.trim()) {
            setResults([]);
            setSearching(false);
            return;
        }
        setSearching(true);
        try {
            const res = await searchOperatorsAction(value);
            if (id === searchId.current && res.success) setResults(res.data);
        } catch (err) {
            notify.failure(err);
        } finally {
            if (id === searchId.current) setSearching(false);
        }
    };

    /** Changes the group of an operator; true when it was saved */
    const changeGroup = async (operator: OperatorGroupRow, group: string) => {
        setBusy(operator.OPERATORE);
        try {
            const res = await setOperatorGruppoAction(operator.OPERATORE, group);
            if (!res.success) notify.failure(res.error);
            return res.success;
        } catch (err) {
            notify.failure(err);
            return false;
        } finally {
            setBusy(null);
        }
    };

    return {
        members,
        loading,
        term,
        results,
        searching,
        busy,
        search,
        add: async (operator: OperatorGroupRow) => {
            if (isTurno2(operator) || !(await changeGroup(operator, TURNO2))) return;
            setMembers((current) =>
                current.some((member) => member.OPERATORE === operator.OPERATORE)
                    ? current
                    : [...current, { ...operator, GRUPPO: TURNO2 }].sort((a, b) => (a.NOME ?? '').localeCompare(b.NOME ?? ''))
            );
            setResults((current) => current.map((found) => (found.OPERATORE === operator.OPERATORE ? { ...found, GRUPPO: TURNO2 } : found)));
        },
        remove: async (operator: OperatorGroupRow) => {
            if (await changeGroup(operator, '')) setMembers((current) => current.filter((member) => member.OPERATORE !== operator.OPERATORE));
        },
    };
}
