'use server'

import { queryMSSQL } from '@/lib/mssql';

export async function getClientDetailsAction() {
    console.log('--- Inspecting anagra table ---');
    try {
        // Fetch top 5 rows to see column names and data
        const result = await queryMSSQL('SELECT TOP 5 * FROM anagra');

        return {
            success: true,
            columns: result.recordset.length > 0 ? Object.keys(result.recordset[0]) : [],
            sample: result.recordset
        };
    } catch (err: any) {
        return {
            success: false,
            message: err.message
        };
    }
}

export async function searchClientsAction(searchTerm: string) {
    if (!searchTerm || searchTerm.length < 2) return [];

    try {
        // We'll update the WHERE clause once we know the column names (e.g., TIPO = 'C' or similar)
        // For now, let's just search by a generic 'RAGIONE_SOCIALE' or 'NOME' placeholder
        // which we will fix after inspection
        const result = await queryMSSQL(
            `SELECT TOP 10 * FROM anagra WHERE rag_soc1 LIKE @term OR rag_soc2 LIKE @term`,
            { term: `%${searchTerm}%` }
        );
        return result.recordset;
    } catch (err) {
        console.error('Search error:', err);
        return [];
    }
}
