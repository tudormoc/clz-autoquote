import mssql from 'mssql';

export type MSSQL_DB = 'BUSINESS' | 'NETPRO' | 'QUOTES';

const baseConfig: Omit<mssql.config, 'database'> = {
    user: process.env.MSSQL_USER,
    password: process.env.MSSQL_PASSWORD,
    server: process.env.MSSQL_SERVER || '',
    options: {
        encrypt: true,
        trustServerCertificate: process.env.MSSQL_TRUST_CERT === 'true',
    },
    requestTimeout: 15000, // Default timeout in milliseconds
};

const databaseNames: Record<MSSQL_DB, string | undefined> = {
    BUSINESS: process.env.MSSQL_DATABASE_BUSINESS,
    NETPRO: process.env.MSSQL_DATABASE_NETPRO,
    QUOTES: process.env.MSSQL_DATABASE_QUOTES,
};

// Store pools for each database
const pools: Record<string, Promise<mssql.ConnectionPool> | undefined> = {};

/**
 * Get or create a connection pool for a specific database
 */
export const getMSSQLPool = async (db: MSSQL_DB = 'BUSINESS') => {
    const dbName = databaseNames[db];

    if (!dbName) {
        throw new Error(`Database name for ${db} is not configured in environment variables`);
    }

    if (pools[db]) return pools[db];

    const config: mssql.config = {
        ...baseConfig,
        database: dbName,
    };

    pools[db] = new mssql.ConnectionPool(config)
        .connect()
        .then((pool) => {
            console.log(`Connected to MSSQL Database: ${db} (${dbName})`);

            // Critical: Handle connection loss
            pool.on('error', (err) => {
                console.error(`MSSQL Pool Error for ${db}:`, err);
                // Invalidate the pool so next request creates a new one
                delete pools[db];
            });

            return pool;
        })
        .catch((err) => {
            delete pools[db];
            console.error(`Database Connection Failed for ${db}!`, err);
            throw err;
        });

    return pools[db];
};

/**
 * Execute a query on the specified MSSQL database
 * @param query SQL query string
 * @param params Optional parameters for the query
 * @param db The database to query (defaults to 'BUSINESS')
 * @param timeout Optional request timeout in ms (overrides pool default of 15000ms)
 */
export const queryMSSQL = async <T = any>(
    query: string,
    params: Record<string, any> = {},
    db: MSSQL_DB = 'BUSINESS',
    timeout?: number
) => {
    try {
        let pool: mssql.ConnectionPool;

        if (timeout !== undefined && timeout !== 15000) {
            // Use a cached pool with custom timeout (avoids creating/destroying pools per query)
            pool = await getCustomTimeoutPool(db, timeout);
        } else {
            // Use the default shared pool
            pool = await getMSSQLPool(db);
        }

        const request = pool.request();

        // Add parameters if provided
        Object.entries(params).forEach(([key, value]) => {
            request.input(key, value);
        });

        return await request.query<T>(query);
    } catch (err) {
        console.error(`SQL error in ${db}:`, err);
        throw err;
    }
};

// Cache for pools with custom timeouts (keyed by "db:timeout")
const customTimeoutPools: Record<string, Promise<mssql.ConnectionPool> | undefined> = {};

/**
 * Get or create a cached pool with a custom request timeout.
 * Pools are reused across calls with the same db + timeout combination.
 */
async function getCustomTimeoutPool(db: MSSQL_DB, timeout: number): Promise<mssql.ConnectionPool> {
    const key = `${db}:${timeout}`;
    if (customTimeoutPools[key]) return customTimeoutPools[key]!;

    const dbName = databaseNames[db];
    if (!dbName) {
        throw new Error(`Database name for ${db} is not configured in environment variables`);
    }

    const config: mssql.config = {
        ...baseConfig,
        database: dbName,
        requestTimeout: timeout,
    };

    customTimeoutPools[key] = new mssql.ConnectionPool(config)
        .connect()
        .then((pool) => {
            console.log(`Connected to MSSQL (custom timeout ${timeout}ms): ${db} (${dbName})`);
            pool.on('error', (err) => {
                console.error(`MSSQL Custom Pool Error for ${key}:`, err);
                delete customTimeoutPools[key];
            });
            return pool;
        })
        .catch((err) => {
            delete customTimeoutPools[key];
            throw err;
        });

    return customTimeoutPools[key]!;
}

