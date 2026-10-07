'use server'

import { queryMSSQL } from '@/lib/mssql';

export async function testDatabaseConnections() {
    const results = {
        business: { success: false, message: '', data: null as any },
        netpro: { success: false, message: '', data: null as any },
        quotes: { success: false, message: '', data: null as any }
    };

    // Test Business (COOPZANARDI)
    try {
        const businessResult = await queryMSSQL('SELECT TOP 1 * FROM anagra', {}, 'BUSINESS');
        results.business.success = true;
        results.business.message = 'Successfully connected to Business DB';
        results.business.data = businessResult.recordset[0];
    } catch (err: any) {
        results.business.message = err.message;
    }

    // Test NetPro (NETPRO)
    try {
        // Assuming there is some table we can query in NETPRO, 
        // if we don't know one, we can just try to connect by querying something generic like 'SELECT 1'
        const netproResult = await queryMSSQL('SELECT 1 as connection_test', {}, 'NETPRO');
        results.netpro.success = true;
        results.netpro.message = 'Successfully connected to NetPro DB';
        results.netpro.data = netproResult.recordset[0];
    } catch (err: any) {
        results.netpro.message = err.message;
    }

    // Test Quotes (CLZDWHQANDPROG)
    try {
        const quotesResult = await queryMSSQL('SELECT TOP 1 * FROM signature_types', {}, 'QUOTES');
        results.quotes.success = true;
        results.quotes.message = 'Successfully connected to Quotes DB';
        results.quotes.data = quotesResult.recordset[0];
    } catch {
        // Fallback if signatures table doesn't exist yet or is empty
        try {
            const fallback = await queryMSSQL('SELECT 1 as connection_test', {}, 'QUOTES');
            results.quotes.success = true;
            results.quotes.message = 'Successfully connected to Quotes DB (Fallback)';
            results.quotes.data = fallback.recordset[0];
        } catch (innerErr: any) {
            results.quotes.message = innerErr.message;
        }
    }

    return results;
}

export async function inspectCommessTableAction() {
    try {
        // Get columns
        const cols = await queryMSSQL(`
            SELECT COLUMN_NAME, DATA_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'commess'
            ORDER BY ORDINAL_POSITION
        `, {}, 'BUSINESS');

        // Get sample data
        const sample = await queryMSSQL(`
            SELECT TOP 5 *
            FROM commess WITH (NOLOCK)
            WHERE codditt = 'COOPZANARDI'
            ORDER BY co_commeca DESC
        `, {}, 'BUSINESS');

        return {
            success: true,
            columns: cols.recordset,
            sample: sample.recordset
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message
        };
    }
}
