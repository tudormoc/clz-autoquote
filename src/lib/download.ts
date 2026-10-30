/** Download helpers and file names */
import { foldText } from '@/lib/utils';

/** Text → safe file-name part: "Area Taglio/2" → "area-taglio-2", accents dropped ("Attività" → "attivita") */
export function fileSlug(text: string): string {
    return foldText(text)
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

/** File name of a report export: its name as in the app, then the period ("report-clienti_2025-01-01_2025-12-31.xlsx") */
export function reportFileName(reportName: string, parts: (string | undefined)[], extension: string): string {
    return [fileSlug(reportName), ...parts.filter(Boolean)].join('_') + `.${extension}`;
}

/** A base64 payload as a local object URL */
function base64Url(base64: string, mimeType: string): string {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

/** Save a base64 payload (e.g. a PDF from a server action) as a file */
export function downloadBase64File(base64: string, fileName: string, mimeType = 'application/pdf') {
    const url = base64Url(base64, mimeType);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Give the browser time to start the download before releasing the data
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * A new tab for a PDF that is still being made: opened now, during the click (later the browser would block it),
 * then `show` puts the PDF in it, or `close` drops it when making the PDF failed.
 */
export function openPdfTab() {
    const tab = window.open('', '_blank');
    return {
        show(base64: string) {
            const url = base64Url(base64, 'application/pdf');
            if (tab) tab.location.href = url;
            else window.open(url, '_blank');
        },
        close() {
            tab?.close();
        },
    };
}

/** Pause between consecutive downloads so the browser does not block them */
export const DOWNLOAD_GAP_MS = 600;

export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
