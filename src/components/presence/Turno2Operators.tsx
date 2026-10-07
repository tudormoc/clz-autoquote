'use client';

import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Row, RowList } from '@/components/ui/RowList';
import { Spinner } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { APP_CONFIG } from '@/config/constants';
import { isTurno2, useTurno2Operators } from '@/hooks/useTurno2Operators';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.analytics.presenceSettings;
const GROUP_LABEL = APP_CONFIG.PRESENCE.TURNO2_GROUP;

/** Who is on the second shift: search an operator to add, list of the current ones with a remove button. */
export function Turno2Operators() {
    const turno2 = useTurno2Operators();

    return (
        <div className="space-y-4">
            <Field label={copy.turno2Search}>
                <div className="relative">
                    <Input placeholder={copy.turno2SearchPlaceholder} value={turno2.term} onChange={(e) => turno2.search(e.target.value)} />
                    {turno2.searching && <Spinner size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary" />}
                </div>
                {turno2.results.length > 0 && (
                    <div className="mt-2">
                        <RowList>
                            {turno2.results.map((operator) => (
                                <Row key={operator.OPERATORE} label={operator.NOME} code={operator.OPERATORE}>
                                    {isTurno2(operator) ? (
                                        <StatusBadge tone="info" mono>{GROUP_LABEL}</StatusBadge>
                                    ) : (
                                        <Button variant="ghost" size="sm" onClick={() => turno2.add(operator)} disabled={turno2.busy === operator.OPERATORE}>
                                            {turno2.busy === operator.OPERATORE ? <Spinner size={12} /> : <Check size={13} />}
                                            {copy.add}
                                        </Button>
                                    )}
                                </Row>
                            ))}
                        </RowList>
                    </div>
                )}
            </Field>

            <Field label={copy.turno2Current}>
                {turno2.loading ? (
                    <div className="p-6 flex justify-center">
                        <Spinner size={20} className="text-primary" />
                    </div>
                ) : turno2.members.length === 0 ? (
                    <div className="p-6 text-center text-fg-subtle text-sm border border-border/60 rounded-lg">{copy.turno2Empty}</div>
                ) : (
                    <RowList>
                        {turno2.members.map((operator) => (
                            <Row key={operator.OPERATORE} label={operator.NOME} code={operator.OPERATORE}>
                                <StatusBadge tone="info" mono>{GROUP_LABEL}</StatusBadge>
                                <Button variant="ghost" size="sm" onClick={() => turno2.remove(operator)} disabled={turno2.busy === operator.OPERATORE}>
                                    {turno2.busy === operator.OPERATORE ? <Spinner size={12} /> : <X size={13} />}
                                    {copy.remove}
                                </Button>
                            </Row>
                        ))}
                    </RowList>
                )}
            </Field>
        </div>
    );
}
