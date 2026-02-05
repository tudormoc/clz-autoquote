import mssql from 'mssql';

const config: mssql.config = {
    user: process.env.MSSQL_USER,
    password: process.env.MSSQL_PASSWORD,
    server: process.env.MSSQL_SERVER || '',
    database: process.env.MSSQL_DATABASE,
    options: {
        encrypt: true, // Use this if you're on Azure or want encryption
        trustServerCertificate: process.env.MSSQL_TRUST_CERT === 'true', // Change to true for local dev / self-signed certs
    },
};

let poolPromise: Promise<mssql.ConnectionPool> | null = null;

export const getMSSQLPool = async () => {
    if (poolPromise) return poolPromise;

    poolPromise = new mssql.ConnectionPool(config)
        .connect()
        .then((pool) => {
            console.log('Connected to MSSQL Database');
            return pool;
        })
        .catch((err) => {
            poolPromise = null;
            console.error('Database Connection Failed! Bad Config: ', err);
            throw err;
        });

    return poolPromise;
};

/**
 * Execute a query on the MSSQL database
 * @param query SQL query string
 * @param params Optional parameters for the query
 */
export const queryMSSQL = async <T = any>(query: string, params: Record<string, any> = {}) => {
    try {
        const pool = await getMSSQLPool();
        const request = pool.request();

        // Add parameters if provided
        Object.entries(params).forEach(([key, value]) => {
            request.input(key, value);
        });

        const result = await request.query<T>(query);
        return result;
    } catch (err) {
        console.error('SQL error', err);
        throw err;
    }
};
