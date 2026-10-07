/** Browser download helpers */

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
