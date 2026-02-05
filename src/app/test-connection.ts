'use server'

import { getMSSQLPool } from '@/lib/mssql';

export async function testMSSQLConnection() {
    console.log('--- MSSQL Connection Test ---');
    console.log('Server:', process.env.MSSQL_SERVER);

    try {
        const pool = await getMSSQLPool();
        const [versionResult, tablesResult] = await Promise.all([
            pool.request().query('SELECT @@VERSION as version'),
            pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'")
        ]);

        return {
            success: true,
            message: 'Connected to MSSQL Database!',
            version: versionResult.recordset[0].version,
            tables: tablesResult.recordset.map((r: any) => r.TABLE_NAME)
        };
    } catch (err: any) {
        console.error('❌ FAILURE: Could not connect to MSSQL.');
        return {
            success: false,
            message: err.message,
            code: err.code
        };
    }
}
