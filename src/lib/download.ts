/** Download helpers and file names */

/** Text → safe file-name part: "Area Taglio/2" → "area-taglio-2", accents dropped ("Attività" → "attivita") */
export function fileSlug(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

/** File name of a report export: its name as in the app, then the period ("report-clienti_2025-01-01_2025-12-31.xlsx") */
export function reportFileName(reportName: string, parts: (string | undefined)[], extension: string): string {
    return [fileSlug(reportName), ...parts.filter(Boolean)].join('_') + `.${extension}`;
}

/** Save a base64 payload (e.g. a PDF from a server action) as a file */
export function downloadBase64File(base64: string, fileName: string, mimeType = 'application/pdf') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Give the browser time to start the download before releasing the data
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Pause between consecutive downloads so the browser does not block them */
export const DOWNLOAD_GAP_MS = 600;

export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
