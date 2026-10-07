import { errorMessage } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { APP_CONFIG } from '@/config/constants';
import { netproAuthenticatedGet } from '@/lib/netproSession';

/**
 * Fetch a single commessa PDF from NetPro Crystal Reports service
 */
async function fetchNetProPDF(netproId: string): Promise<ArrayBuffer> {
    const fparams = JSON.stringify({
        FReport: APP_CONFIG.REPORTS.COMMESSA_REPORT_NAME,
        FCmdParameters: [
            {
                FCmdKey: 'frm_netproid',
                FCmdLabel: null,
                FCmdValue: netproId,
                FCmdSource: {
                    SQLSelect: null,
                    FixedValues: [],
                    ComboValue: null,
                    ComboText: null,
                    SourceReadOnly: true,
                    Id: null,
                    Name: null
                },
                Required: false,
                Visible: true,
                FcmdType: 0,
                Format: null,
                Id: null,
                Name: 'frm_netproid'
            }
        ],
        ShowCmdParameters: false,
        ExportType: 0,
        IsForPrinting: false,
        IsReportServerPrinting: false,
        IPprinter: '',
        Printers: null,
        AskNumberOfCopies: false,
        DefaultNumberOfCopies: 1,
        SuggestedFileName: null,
        Title: 'COMMESSA',
        Visible: true,
        AttachmentType: 2,
        Orientation: 1,
        AttachmentMenuGroup: null,
        ButtonWidth: 0,
        Id: null,
        Name: 'RIEPILOGO_COMM'
    });

    const targetUrl = `${APP_CONFIG.REPORTS.NETPRO_PDF_ENDPOINT}?fparams=${encodeURIComponent(fparams)}`;

    // Authenticated with the stored NetPro service account (the report service requires a login)
    const buffer = await netproAuthenticatedGet(targetUrl);

    // NetPro answers with an HTML redirect to its login page when the report service needs a session
    const head = new TextDecoder().decode(buffer.slice(0, 600));
    if (!head.startsWith('%PDF')) {
        if (/Account\/Login/i.test(head)) {
            throw new Error('Il servizio report di NetPro richiede il login (risposta: redirect a QualitasWebClient/Account/Login). Nessun PDF ricevuto.');
        }
        throw new Error(`Il servizio report di NetPro non ha restituito un PDF per ${netproId}.`);
    }

    if (buffer.byteLength < 500) {
        const text = new TextDecoder().decode(buffer);
        if (text.includes('Error') || text.includes('no found')) {
            throw new Error(`Report generation failed for ${netproId}: ${text}`);
        }
    }

    return buffer;
}

/**
 * Commessa PDF Report Proxy
 * Supports single netproId or comma-separated netproIds (merges into a single multi-page PDF).
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const netproId = searchParams.get('netproId');
        const netproIdsParam = searchParams.get('netproIds');

        const ids = netproIdsParam
            ? netproIdsParam.split(',').map(id => id.trim()).filter(Boolean)
            : (netproId ? [netproId.trim()] : []);

        if (ids.length === 0) {
            return NextResponse.json(
                { error: 'Missing required parameter: netproId or netproIds' },
                { status: 400 }
            );
        }

        // If only 1 order ID requested
        if (ids.length === 1) {
            const buffer = await fetchNetProPDF(ids[0]);
            const safeFileName = `commessa_${ids[0].replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

            return new NextResponse(buffer, {
                status: 200,
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `inline; filename="${safeFileName}"`,
                    'Content-Length': buffer.byteLength.toString(),
                    'Cache-Control': 'no-store, no-cache, must-revalidate',
                }
            });
        }

        // If multiple IDs requested, fetch all in parallel and merge
        const buffers = await Promise.all(ids.map(fetchNetProPDF));

        const mergedPdf = await PDFDocument.create();
        for (const buf of buffers) {
            const doc = await PDFDocument.load(buf);
            const copiedPages = await mergedPdf.copyPages(doc, doc.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }

        const mergedBytes = await mergedPdf.save();
        const safeFileName = `commesse_${ids.length}_edizioni.pdf`;

        return new NextResponse(Buffer.from(mergedBytes), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${safeFileName}"`,
                'Content-Length': mergedBytes.length.toString(),
                'Cache-Control': 'no-store, no-cache, must-revalidate',
            }
        });
    } catch (err) {
        console.error('Error generating commessa PDF:', err);
        return NextResponse.json(
            { error: errorMessage(err) || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
