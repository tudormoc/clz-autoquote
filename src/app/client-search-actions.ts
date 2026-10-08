'use server'

import { queryMSSQL } from '@/lib/mssql';

export async function searchMSSQLClientsAction(searchTerm: string) {
    if (!searchTerm || searchTerm.length < 2) return [];

    try {
        const result = await queryMSSQL<{ id: string; name: string }>(
            `SELECT TOP 20 
                RTRIM(an_conto) as id,
                RTRIM(an_descr1) + ' ' + RTRIM(ISNULL(an_descr2, '')) as name,
                CASE 
                    WHEN an_descr1 LIKE @startTerm THEN 1 
                    WHEN an_descr1 LIKE @term THEN 2 
                    ELSE 3 
                END as priority
             FROM anagra WITH (NOLOCK)
             WHERE an_tipo = 'C' 
               AND (an_descr1 LIKE @term OR an_descr2 LIKE @term)
             ORDER BY priority, an_descr1`,
            {
                term: `%${searchTerm}%`,
                startTerm: `${searchTerm}%`
            }
        );
        return result.recordset.map((r) => ({
            id: r.id.trim(),
            name: r.name.trim()
        }));
    } catch (err) {
        console.error('MSSQL Client Search error:', err);
        return [];
    }
}
