'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CaseUpper, Check, UserRound } from 'lucide-react';
import { AlignIcon } from '@/components/ui/AlignIcon';
import type { UserView } from '@/app/access-actions';
import { alignEmailAction, alignNameAction, getPersonCardAction, getPersonChoicesAction, setPersonLinksAction, type PersonCard, type PersonChoices } from '@/app/person-actions';
import { AlignEmailDialog } from '@/components/admin/access/AlignEmailDialog';
import { AlignNameDialog } from '@/components/admin/access/AlignNameDialog';
import { PersonComparison } from '@/components/admin/access/PersonComparison';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { LoadState } from '@/components/ui/LoadState';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { notify } from '@/lib/notify';
import { NO_LINKS, distinctValues, driftCount, type Fact, type FactKey, type NameParts, type PersonLinks } from '@/lib/persons/places';
import { errorMessage } from '@/lib/utils';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.admin.person;

interface PersonCardDialogProps {
    user: UserView;
    /** After links are saved or a fact aligned: the Utenti list reloads (and with it the "≠" marks) */
    onSaved: () => Promise<void>;
    onClose: () => void;
}

const sameLinks = (a: PersonLinks, b: PersonLinks) => a.operatorCode === b.operatorCode && a.netproUser === b.netproUser && a.erpUser === b.erpUser;

/**
 * "Scheda persona", laid out like the order comparison: the links of the login (three selects, saved in app_users),
 * the status badge and the Allinea buttons, then one row per fact with a column per place (PersonComparison).
 */
export function PersonCardDialog({ user, onSaved, onClose }: PersonCardDialogProps) {
    const [choices, setChoices] = useState<PersonChoices | null>(null);
    const [card, setCard] = useState<PersonCard | null>(null);
    const [links, setLinks] = useState<PersonLinks>(NO_LINKS);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [confirming, setConfirming] = useState<FactKey | null>(null);

    const load = useCallback(async () => {
        try {
            const [loadedChoices, loadedCard] = await Promise.all([getPersonChoicesAction(), getPersonCardAction(user.id)]);
            if (!loadedChoices.success) throw new Error(loadedChoices.error);
            if (!loadedCard.success) throw new Error(loadedCard.error);
            setChoices(loadedChoices.choices);
            setCard(loadedCard.card);
            setLinks(loadedCard.card.links);
            setError(null);
        } catch (err) {
            setError(errorMessage(err));
        }
    }, [user.id]);

    useEffect(() => {
        load();
    }, [load]);

    /** Runs a write, tells how it went, reloads the list and the card; true when done */
    const write = async (save: () => Promise<{ success: true } | { success: false; error: string }>, done: () => string) => {
        setBusy(true);
        try {
            const result = await save();
            if (!result.success) {
                notify.error(result.error);
                return false;
            }
            notify.success(done());
            await onSaved();
            await load();
            return true;
        } catch (err) {
            notify.failure(err);
            return false;
        } finally {
            setBusy(false);
        }
    };

    const saveLinks = () => write(() => setPersonLinksAction(user.id, links), () => copy.linksSaved);
    /** Runs an Allinea and says how many rows it changed */
    const alignWith = async (save: () => Promise<{ success: true; written: number } | { success: false; error: string }>, done: (count: number) => string) => {
        let written = 0;
        const ok = await write(
            async () => {
                const result = await save();
                if (result.success) written = result.written;
                return result;
            },
            () => done(written)
        );
        if (ok) setConfirming(null);
    };
    const alignEmail = (email: string) => alignWith(() => alignEmailAction(user.id, email), (count) => fmt(copy.alignEmail.done, { count }));
    const alignName = (parts: NameParts) => alignWith(() => alignNameAction(user.id, parts), (count) => fmt(copy.alignName.done, { count }));

    const option = (value: string, label: string) => ({ value, label: label ? `${value} · ${label}` : value });
    const withNone = (options: { value: string; label: string }[]) => [{ value: '', label: copy.notLinked }, ...options];
    const set = (change: Partial<PersonLinks>) => setLinks((current) => ({ ...current, ...change }));
    const value = (e: React.ChangeEvent<HTMLSelectElement>) => e.target.value || null;

    const factOf = (key: FactKey) => card?.facts.find((fact) => fact.key === key);
    /** Allinea is offered when the fact differs and some place takes a write */
    const canAlign = (fact: Fact | undefined): fact is Fact => Boolean(fact?.differs && fact.values.some((item) => item.writable));
    const email = factOf('email');
    const name = factOf('name');
    const drift = card ? driftCount(card.facts) : 0;

    return (
        <Modal title={fmt(copy.title, { name: user.name })} icon={UserRound} size="2xl" onClose={onClose} busy={busy} footer={<Button onClick={onClose} disabled={busy}>{APP_COPY.common.close}</Button>}>
            {!card || !choices ? (
                <LoadState loading={!error} error={error} />
            ) : (
                <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Field label={copy.operator}>
                            <Select value={links.operatorCode ?? ''} onChange={(e) => set({ operatorCode: value(e) })} options={withNone(choices.operators.map((row) => option(row.code, row.name)))} disabled={busy} />
                        </Field>
                        <Field label={copy.netproUser}>
                            <Select value={links.netproUser ?? ''} onChange={(e) => set({ netproUser: value(e) })} options={withNone(choices.netproUsers.map((row) => option(row.user, row.name)))} disabled={busy} />
                        </Field>
                        <Field label={copy.erpUser}>
                            <Select value={links.erpUser ?? ''} onChange={(e) => set({ erpUser: value(e) })} options={withNone(choices.erpUsers.map((row) => option(row.user, row.name)))} disabled={busy} />
                        </Field>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="secondary" size="sm" onClick={saveLinks} disabled={busy || sameLinks(links, card.links)}>
                            {copy.saveLinks}
                        </Button>
                        <div className="ml-auto flex items-center gap-2">
                            {drift > 0 ? (
                                <StatusBadge tone="warning" size="md">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    {fmt(copy.driftStatus, { count: drift })}
                                </StatusBadge>
                            ) : (
                                <StatusBadge tone="success" size="md">
                                    <Check className="w-3.5 h-3.5" />
                                    {copy.alignedStatus}
                                </StatusBadge>
                            )}
                            {canAlign(email) && (
                                <Button variant="warning" size="sm" onClick={() => setConfirming('email')} disabled={busy}>
                                    <AlignIcon className="w-3.5 h-3.5" />
                                    {copy.alignEmail.align}
                                </Button>
                            )}
                            {canAlign(name) && (
                                <Button variant="warning" size="sm" onClick={() => setConfirming('name')} disabled={busy}>
                                    <CaseUpper className="w-3.5 h-3.5" />
                                    {copy.alignName.align}
                                </Button>
                            )}
                        </div>
                    </div>

                    <PersonComparison facts={card.facts} />

                    {confirming === 'email' && email && <AlignEmailDialog name={user.name} options={distinctValues(email)} aligning={busy} onConfirm={alignEmail} onClose={() => setConfirming(null)} />}
                    {confirming === 'name' && name && (
                        <AlignNameDialog name={user.name} options={distinctValues(name)} records={card.records} aligning={busy} onConfirm={alignName} onClose={() => setConfirming(null)} />
                    )}
                </div>
            )}
        </Modal>
    );
}
