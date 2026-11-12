import mssql from 'mssql';
import { APP_CONFIG } from '@/config/constants';
import { AppFault, faultKind, logFault } from '@/lib/utils';

/** Named values of a query (@name in the SQL) */
export type SqlParams = Record<string, unknown>;

export type MSSQL_DB = (typeof APP_CONFIG.DATABASES)[number];

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

const pools: Record<string, Promise<mssql.ConnectionPool> | undefined> = {};

/**
 * Get or create a connection pool for a specific database
 */
export const getMSSQLPool = async (db: MSSQL_DB = 'BUSINESS') => {
    const dbName = Object.hasOwn(databaseNames, db) ? databaseNames[db] : undefined;

    if (!dbName) {
        throw new AppFault(`Database name for ${db} is not configured in environment variables`);
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

            // Connection lost: the pool is closed and forgotten, the next query opens a new one
            pool.on('error', (err) => {
                console.error(`MSSQL Pool Error for ${db}:`, err);
                delete pools[db];
                void pool.close().catch(() => undefined);
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

/** Runs one statement: queryMSSQL itself, or its twin inside withTransactions */
export type SqlRunner = <T = Record<string, unknown>>(query: string, params?: SqlParams, db?: MSSQL_DB) => Promise<mssql.IResult<T>>;

/**
 * Execute a query on the specified MSSQL database.
 * A read names its row type (`queryMSSQL<{ total: number }>(…)`); without one a row is a record of unknown values.
 * @param query SQL query string
 * @param params Optional parameters for the query
 * @param db The database to query (defaults to 'BUSINESS')
 * @param timeout Optional request timeout in ms (overrides pool default of 15000ms)
 */
export const queryMSSQL = async <T = Record<string, unknown>>(
    query: string,
    params: SqlParams = {},
    db: MSSQL_DB = 'BUSINESS',
    timeout?: number
) => {
    try {
        let pool: mssql.ConnectionPool;

        if (timeout !== undefined && timeout !== 15000) {
            // Use a cached pool with custom timeout (avoids creating/destroying pools per query)
            pool = await getCustomTimeoutPool(db, timeout);
        } else {
            pool = await getMSSQLPool(db);
        }

        const request = pool.request();

        Object.entries(params).forEach(([key, value]) => {
            request.input(key, value);
        });

        return await request.query<T>(query);
    } catch (err) {
        logFault(`SQL error in ${db}:`, err);
        throw err;
    }
};

/**
 * Runs `work` with one transaction per listed database: every statement `run` sends goes into the transaction of
 * its database, and at the end all of them are committed, or all rolled back when `work` throws (a failed statement
 * included). A statement for a database not listed is refused.
 * SQL Server cannot commit two databases as one: the transactions commit one after the other, so a change can only
 * be left half-done between those two commits, never between two statements.
 */
export async function withTransactions<T>(dbs: readonly MSSQL_DB[], work: (run: SqlRunner) => Promise<T>): Promise<T> {
    const open = new Map<MSSQL_DB, mssql.Transaction>();
    const rollbackAll = async () => {
        for (const transaction of open.values()) await transaction.rollback().catch(() => undefined);
    };
    try {
        for (const db of dbs) {
            const transaction = new mssql.Transaction(await getMSSQLPool(db));
            await transaction.begin();
            open.set(db, transaction);
        }
        const run: SqlRunner = async (query, params = {}, db = 'BUSINESS') => {
            const transaction = open.get(db);
            if (!transaction) throw new AppFault(`No transaction open on ${db}`);
            const request = new mssql.Request(transaction);
            Object.entries(params).forEach(([key, value]) => request.input(key, value));
            return request.query(query);
        };
        const result = await work(run);
        for (const transaction of open.values()) await transaction.commit();
        return result;
    } catch (err) {
        await rollbackAll();
        // What the app refused itself (a text for the person) is no fault of the databases
        if (faultKind(err)) logFault(`SQL error in a transaction on ${dbs.join(' + ')}:`, err);
        throw err;
    }
}

// Cache for pools with custom timeouts (keyed by "db:timeout")
const customTimeoutPools: Record<string, Promise<mssql.ConnectionPool> | undefined> = {};

/**
 * Get or create a cached pool with a custom request timeout.
 * Pools are reused across calls with the same db + timeout combination.
 */
async function getCustomTimeoutPool(db: MSSQL_DB, timeout: number): Promise<mssql.ConnectionPool> {
    const key = `${db}:${timeout}`;
    if (customTimeoutPools[key]) return customTimeoutPools[key]!;

    const dbName = Object.hasOwn(databaseNames, db) ? databaseNames[db] : undefined;
    if (!dbName) {
        throw new AppFault(`Database name for ${db} is not configured in environment variables`);
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
                void pool.close().catch(() => undefined);
            });
            return pool;
        })
        .catch((err) => {
            delete customTimeoutPools[key];
            throw err;
        });

    return customTimeoutPools[key]!;
}

