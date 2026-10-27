'use client';

import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { generateOperatorChecklistPDFAction, getOperatorStatiAction } from '@/app/presence/operators-actions';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { ToggleChips } from '@/components/ui/ToggleChips';
import { openPdfTab } from '@/lib/download';
import { notify } from '@/lib/notify';
import { EMPLOYEE_CATEGORIES } from '@/lib/presence/categories';
import { toggleInSet } from '@/lib/utils';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.analytics.operators;

const CATEGORY_OPTIONS = EMPLOYEE_CATEGORIES.map((c) => ({ key: c.key, label: c.label }));

/** Window of the printable operator list: pick categories and stati fisici, then open the PDF in a new tab */
export function OperatorChecklistModal({ onClose }: { onClose: () => void }) {
    const [categories, setCategories] = useState<Set<string>>(() => new Set(EMPLOYEE_CATEGORIES.map((c) => c.key)));
    const [allStati, setAllStati] = useState<string[]>([]);
    const [stati, setStati] = useState<Set<string>>(new Set());
    const [showDate, setShowDate] = useState(true);
    const [showChecks, setShowChecks] = useState(true);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        getOperatorStatiAction().then((result) => {
            if (!result.success) return notify.failure(result.error);
            setAllStati(result.data);
            setStati(new Set(result.data));
        });
    }, []);

    const openPdf = async () => {
        const tab = openPdfTab();
        setBusy(true);
        try {
            const result = await generateOperatorChecklistPDFAction(Array.from(categories), Array.from(stati), showDate, showChecks);
            if (!result.success) {
                tab.close();
                notify.error(result.error);
                return;
            }
            tab.show(result.pdf);
            onClose();
        } catch (err) {
            tab.close();
            notify.failure(err);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            title={copy.checklist.title}
            icon={FileText}
            onClose={onClose}
            busy={busy}
            footer={
                <>
                    <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
                        {APP_COPY.common.cancel}
                    </Button>
                    <Button type="button" onClick={openPdf} disabled={busy || categories.size === 0 || stati.size === 0}>
                        {busy ? <Spinner size={16} /> : <FileText size={16} />}
                        {copy.checklist.open}
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <p className="text-sm text-fg-soft">{copy.checklist.intro}</p>
                <ToggleChips
                    label={copy.headers.categoria}
                    options={CATEGORY_OPTIONS}
                    active={categories}
                    onToggle={(key) => setCategories(toggleInSet(categories, key))}
                />
                {allStati.length > 0 ? (
                    <ToggleChips
                        label={copy.headers.statoFisico}
                        options={allStati.map((stato) => ({ key: stato, label: stato }))}
                        active={stati}
                        onToggle={(key) => setStati(toggleInSet(stati, key))}
                    />
                ) : (
                    <Spinner />
                )}
                <Checkbox id="checklist-show-date" label={copy.checklist.showDate} checked={showDate} onChange={(e) => setShowDate(e.target.checked)} />
                <Checkbox
                    id="checklist-show-checks"
                    label={copy.checklist.showChecks}
                    checked={showChecks}
                    onChange={(e) => setShowChecks(e.target.checked)}
                />
            </div>
        </Modal>
    );
}
