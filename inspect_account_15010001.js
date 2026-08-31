/**
 * Check account 15010001 (IVA c/Acquisti) for June 2026
 * Run: node inspect_account_15010001.js
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

async function inspectAccount15010001() {
    let pool;
    try {
        pool = await mssql.connect(config);
        console.log('✅ Connected to BUSINESS database\n');

        console.log('='.repeat(80));
        console.log('📊 ACCOUNT 15010001 (IVA c/Acquisti) - JUNE 2026');
        console.log('='.repeat(80));

        // 1. Get account name
        const accountInfoQuery = `
            SELECT 
                an_conto,
                an_descr1 as name
            FROM anagra WITH (NOLOCK)
            WHERE codditt = 'COOPZANARDI'
              AND an_conto = 15010001
        `;

        const accountInfo = await pool.request().query(accountInfoQuery);
        if (accountInfo.recordset.length > 0) {
            console.log(`\n📌 Account: ${accountInfo.recordset[0].an_conto} - ${accountInfo.recordset[0].name}\n`);
        }

        // 2. Check June 2026 transactions
        const june2026Query = `
            SELECT 
                p.pn_datreg AS transaction_date,
                p.pn_importo AS amount,
                p.pn_numdoc AS doc_number,
                COUNT(*) OVER () as total_transactions
            FROM prinot p WITH (NOLOCK)
            WHERE p.codditt = 'COOPZANARDI'
              AND p.pn_conto = 15010001
              AND YEAR(p.pn_datreg) = 2026
              AND MONTH(p.pn_datreg) = 6
            ORDER BY p.pn_datreg
        `;

        const june2026Result = await pool.request().query(june2026Query);

        if (june2026Result.recordset.length === 0) {
            console.log('❌ NO TRANSACTIONS found for June 2026\n');
        } else {
            const transactions = june2026Result.recordset;
            let total = 0;
            
            console.log(`✅ Found ${transactions.length} transactions in June 2026:\n`);
            
            transactions.forEach((t, idx) => {
                const date = new Date(t.transaction_date).toLocaleDateString('it-IT');
                const amount = t.amount;
                total += amount;
                console.log(`${idx + 1}. ${date}: €${amount.toFixed(2)} ${t.doc_number ? `(Doc: ${t.doc_number})` : ''}`);
            });

            console.log(`\n${'─'.repeat(60)}`);
            console.log(`💰 TOTAL for June 2026: €${total.toFixed(2)}`);
            console.log(`${'─'.repeat(60)}\n`);
        }

        // 3. Get cash-out only (negative amounts) for June 2026 - this is what cashflow shows
        const cashOutQuery = `
            SELECT
                MONTH(p.pn_datreg) AS month_num,
                ABS(ISNULL(SUM(CASE WHEN p.pn_importo < 0 THEN p.pn_importo ELSE 0 END), 0)) AS cash_out
            FROM prinot p WITH (NOLOCK)
            WHERE p.codditt = 'COOPZANARDI'
              AND p.pn_conto = 15010001
              AND YEAR(p.pn_datreg) = 2026
              AND MONTH(p.pn_datreg) = 6
            GROUP BY MONTH(p.pn_datreg)
        `;

        const cashOutResult = await pool.request().query(cashOutQuery);
        
        console.log('='.repeat(80));
        console.log('💸 CASHFLOW CALCULATION (Only negative amounts = Cash Out)');
        console.log('='.repeat(80));
        
        if (cashOutResult.recordset.length > 0) {
            const cashOut = cashOutResult.recordset[0].cash_out;
            console.log(`\n💸 Cash Out (expenses) for June 2026: €${cashOut.toFixed(2)}`);
            console.log(`\nℹ️  This is the amount shown in the Cashflow dashboard`);
            console.log(`    (Only negative pn_importo values, converted to positive)\n`);
        } else {
            console.log('\n✅ No cash-out transactions (no negative amounts) for June 2026\n');
        }

        // 4. Monthly summary for all of 2026
        console.log('='.repeat(80));
        console.log('📊 MONTHLY SUMMARY FOR 2026 (Account 15010001)');
        console.log('='.repeat(80));

        const monthly2026Query = `
            SELECT 
                MONTH(p.pn_datreg) as month_num,
                COUNT(*) as transaction_count,
                ISNULL(SUM(p.pn_importo), 0) as net_total,
                ABS(ISNULL(SUM(CASE WHEN p.pn_importo < 0 THEN p.pn_importo ELSE 0 END), 0)) AS cash_out
            FROM prinot p WITH (NOLOCK)
            WHERE p.codditt = 'COOPZANARDI'
              AND p.pn_conto = 15010001
              AND YEAR(p.pn_datreg) = 2026
            GROUP BY MONTH(p.pn_datreg)
            ORDER BY month_num
        `;

        const monthly2026Result = await pool.request().query(monthly2026Query);

        if (monthly2026Result.recordset.length === 0) {
            console.log('\n❌ NO DATA for any month in 2026\n');
        } else {
            console.log('\n');
            const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
            monthly2026Result.recordset.forEach(row => {
                console.log(`${months[row.month_num - 1]}: ${row.transaction_count} txn, Net: €${row.net_total.toFixed(2)}, Cash Out: €${row.cash_out.toFixed(2)}`);
            });
            console.log('');
        }

        console.log('='.repeat(80));

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        if (pool) {
            await pool.close();
            console.log('\n✅ Connection closed');
        }
    }
}

inspectAccount15010001();
