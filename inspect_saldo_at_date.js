/**
 * Check balance (saldo) for account 15010001 at June 30, 2026
 * Run: node inspect_saldo_at_date.js
 */

const fs = require('fs');
const mssql = require('mssql');

// Read .env.local manually
const envPath = '.env.local';
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim();
            if (key && !process.env[key]) {
                process.env[key] = value;
            }
        }
    });
}

const config = {
    user: process.env.MSSQL_USER,
    password: process.env.MSSQL_PASSWORD,
    server: process.env.MSSQL_SERVER || '',
    database: process.env.MSSQL_DATABASE_BUSINESS,
    options: {
        encrypt: true,
        trustServerCertificate: process.env.MSSQL_TRUST_CERT === 'true',
    },
    requestTimeout: 30000,
};

async function checkSaldo() {
    let pool;
    try {
        pool = await mssql.connect(config);
        console.log('✅ Connected to BUSINESS database\n');

        console.log('='.repeat(80));
        console.log('📊 BALANCE (SALDO) at JUNE 30, 2026 - Account 15010001 (IVA c/Acquisti)');
        console.log('='.repeat(80));

        // Balance at June 30, 2026 = SUM of all transactions up to and including June 30, 2026
        const saldoQuery = `
            SELECT 
                ISNULL(SUM(p.pn_importo), 0) as saldo_at_june30_2026,
                COUNT(*) as total_transactions
            FROM prinot p WITH (NOLOCK)
            WHERE p.codditt = 'COOPZANARDI'
              AND p.pn_conto = 15010001
              AND p.pn_datreg <= '2026-06-30'
        `;

        const saldoResult = await pool.request().query(saldoQuery);
        const saldo = saldoResult.recordset[0];

        console.log(`\n💰 Saldo at June 30, 2026: €${saldo.saldo_at_june30_2026.toFixed(2)}`);
        console.log(`📝 Based on ${saldo.total_transactions} transactions (from start to June 30, 2026)\n`);

        // Get monthly balance progression for 2026 - SIMPLER APPROACH
        console.log('='.repeat(80));
        console.log('📊 MONTH-END BALANCE PROGRESSION FOR 2026');
        console.log('='.repeat(80));

        const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
        console.log('\n');
        
        for (let m = 1; m <= 12; m++) {
            const monthEndQuery = `
                SELECT 
                    ISNULL(SUM(p.pn_importo), 0) as balance
                FROM prinot p WITH (NOLOCK)
                WHERE p.codditt = 'COOPZANARDI'
                  AND p.pn_conto = 15010001
                  AND p.pn_datreg <= EOMONTH(DATEFROMPARTS(2026, ${m}, 1))
            `;
            
            const result = await pool.request().query(monthEndQuery);
            const balance = result.recordset[0].balance;
            console.log(`${months[m - 1]} (end of month): €${balance.toFixed(2)}`);
        }
        console.log('');

        // Opening balance for 2026 (balance at end of 2025)
        console.log('='.repeat(80));
        console.log('📊 OPENING BALANCE FOR 2026');
        console.log('='.repeat(80));

        const openingQuery = `
            SELECT 
                ISNULL(SUM(p.pn_importo), 0) as opening_balance_2026
            FROM prinot p WITH (NOLOCK)
            WHERE p.codditt = 'COOPZANARDI'
              AND p.pn_conto = 15010001
              AND p.pn_datreg < '2026-01-01'
        `;

        const openingResult = await pool.request().query(openingQuery);
        const opening = openingResult.recordset[0];

        console.log(`\n💰 Opening Balance (Jan 1, 2026): €${opening.opening_balance_2026.toFixed(2)}`);
        console.log(`   This is the cumulative balance from all transactions before 2026\n`);

        // Show what changed in June 2026
        console.log('='.repeat(80));
        console.log('📊 JUNE 2026 CHANGES');
        console.log('='.repeat(80));

        const juneChangeQuery = `
            SELECT 
                ISNULL(SUM(p.pn_importo), 0) as june_net_change,
                COUNT(*) as june_transactions
            FROM prinot p WITH (NOLOCK)
            WHERE p.codditt = 'COOPZANARDI'
              AND p.pn_conto = 15010001
              AND YEAR(p.pn_datreg) = 2026
              AND MONTH(p.pn_datreg) = 6
        `;

        const juneChangeResult = await pool.request().query(juneChangeQuery);
        const juneChange = juneChangeResult.recordset[0];

        // Balance at end of May
        const mayEndQuery = `
            SELECT 
                ISNULL(SUM(p.pn_importo), 0) as balance_at_may_end
            FROM prinot p WITH (NOLOCK)
            WHERE p.codditt = 'COOPZANARDI'
              AND p.pn_conto = 15010001
              AND p.pn_datreg <= '2026-05-31'
        `;

        const mayEndResult = await pool.request().query(mayEndQuery);
        const mayEnd = mayEndResult.recordset[0].balance_at_may_end;

        console.log(`\n📅 Balance at May 31, 2026: €${mayEnd.toFixed(2)}`);
        console.log(`📝 June 2026 Net Change: €${juneChange.june_net_change.toFixed(2)} (${juneChange.june_transactions} transactions)`);
        console.log(`💰 Balance at June 30, 2026: €${saldo.saldo_at_june30_2026.toFixed(2)}`);
        console.log(`\n✅ Calculation: €${mayEnd.toFixed(2)} + €${juneChange.june_net_change.toFixed(2)} = €${saldo.saldo_at_june30_2026.toFixed(2)}\n`);

        console.log('='.repeat(80));

    } catch (err) {
        console.error('❌ Error:', err.message);
        console.error(err);
    } finally {
        if (pool) {
            await pool.close();
            console.log('\n✅ Connection closed');
        }
    }
}

checkSaldo();
