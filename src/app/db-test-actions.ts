'use server'

import { queryMSSQL } from '@/lib/mssql';

export async function testDatabaseConnections() {
    const results = {
        business: { success: false, message: '', data: null as any },
        netpro: { success: false, message: '', data: null as any }
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

    return results;
}
