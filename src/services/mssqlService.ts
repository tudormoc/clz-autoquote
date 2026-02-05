import { queryMSSQL } from '../lib/mssql';

export const mssqlService = {
    /**
     * Example: Fetch inventory or prices from the local MSSQL database
     */
    getExternalData: async (tableName: string) => {
        try {
            // Validate table name to prevent basic SQL injection if it's dynamic
            if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
                throw new Error('Invalid table name');
            }

            const result = await queryMSSQL(`SELECT TOP 10 * FROM ${tableName}`);
            return result.recordset;
        } catch (error) {
            console.error(`MSSQL Error fetching from ${tableName}:`, error);
            return [];
        }
    },

    /**
     * Example: Execute a custom stored procedure or specific query
     */
    getLegacyCustomer: async (email: string) => {
        try {
            const result = await queryMSSQL(
                'SELECT * FROM Customers WHERE Email = @email',
                { email }
            );
            return result.recordset[0] || null;
        } catch (error) {
            console.error('MSSQL Error fetching customer:', error);
            return null;
        }
    }
};
