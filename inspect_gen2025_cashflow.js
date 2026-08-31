/**
 * Quick script to check bank data (prinot) for January 2025
 * Run: node inspect_gen2025_cashflow.js
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

// Bank accounts from cashflowConfig (enabled ones)
const bankAccounts = [9020021, 9020037, 12010001, 12010003, 12010004];

async function inspectJan2025() {
    let pool;
    try {
        pool = await mssql.connect(config);
        console.log('✅ Connected to BUSINESS database\n');

        // 1. Check if there's ANY data for January 2025
        console.log('='.repeat(80));
        console.log('📊 CHECKING JANUARY 2025 BANK DATA (prinot table)');
        console.log('='.repeat(80));

        const jan2025Query = `
            SELECT 
                p.pn_conto AS account_code,
                a.an_descr1 AS account_name,
                p.pn_datreg AS transaction_date,
                p.pn_importo AS amount,
                COUNT(*) OVER (PARTITION BY p.pn_conto) as transactions_count
            FROM prinot p WITH (NOLOCK)
            JOIN anagra a WITH (NOLOCK) 
                ON p.pn_conto = a.an_conto 
                AND p.codditt = a.codditt
            WHERE p.codditt = 'COOPZANARDI'
              AND p.pn_conto IN (${bankAccounts.join(',')})
              AND YEAR(p.pn_datreg) = 2025
              AND MONTH(p.pn_datreg) = 1
            ORDER BY p.pn_conto, p.pn_datreg
        `;

        const jan2025Result = await pool.request().query(jan2025Query);

        if (jan2025Result.recordset.length === 0) {
            console.log('❌ NO DATA FOUND for January 2025\n');
        } else {
            console.log(`✅ Found ${jan2025Result.recordset.length} transactions in January 2025:\n`);
            
            // Group by account
            const byAccount = {};
            jan2025Result.recordset.forEach(row => {
                const code = row.account_code;
                if (!byAccount[code]) {
                    byAccount[code] = {
                        name: row.account_name,
                        transactions: [],
                        total: 0
                    };
                }
                byAccount[code].transactions.push({
                    date: row.transaction_date,
                    amount: row.amount
                });
                byAccount[code].total += row.amount;
            });

            Object.entries(byAccount).forEach(([code, data]) => {
                console.log(`\n📌 Account ${code}: ${data.name}`);
                console.log(`   Transactions: ${data.transactions.length}`);
                console.log(`   Total: €${data.total.toFixed(2)}`);
                data.transactions.slice(0, 5).forEach(t => {
                    console.log(`   - ${new Date(t.date).toLocaleDateString('it-IT')}: €${t.amount.toFixed(2)}`);
                });
                if (data.transactions.length > 5) {
                    console.log(`   ... and ${data.transactions.length - 5} more`);
                }
            });
        }

        // 2. Check the opening balance for 2025 (all movements before 2025)
        console.log('\n' + '='.repeat(80));
        console.log('📊 OPENING BALANCE FOR 2025 (All movements before 2025)');
        console.log('='.repeat(80));

        const openingQuery = `
            SELECT 
                ISNULL(SUM(p.pn_importo), 0) as total_opening_balance,
                COUNT(*) as total_transactions
            FROM prinot p WITH (NOLOCK)
            WHERE p.codditt = 'COOPZANARDI'
              AND p.pn_conto IN (${bankAccounts.join(',')})
              AND YEAR(p.pn_datreg) < 2025
        `;

        const openingResult = await pool.request().query(openingQuery);
        const opening = openingResult.recordset[0];
        
        console.log(`\n💰 Total Opening Balance (sum of all movements before 2025): €${opening.total_opening_balance.toFixed(2)}`);
        console.log(`📝 Based on ${opening.total_transactions} transactions\n`);

        // 3. Check what's the earliest and latest data we have
        console.log('='.repeat(80));
        console.log('📊 DATA RANGE IN prinot TABLE');
        console.log('='.repeat(80));

        const rangeQuery = `
            SELECT 
                MIN(p.pn_datreg) as earliest_date,
                MAX(p.pn_datreg) as latest_date,
                COUNT(*) as total_transactions
            FROM prinot p WITH (NOLOCK)
            WHERE p.codditt = 'COOPZANARDI'
              AND p.pn_conto IN (${bankAccounts.join(',')})
        `;

        const rangeResult = await pool.request().query(rangeQuery);
        const range = rangeResult.recordset[0];

        console.log(`\n📅 Earliest transaction: ${range.earliest_date ? new Date(range.earliest_date).toLocaleDateString('it-IT') : 'N/A'}`);
        console.log(`📅 Latest transaction: ${range.latest_date ? new Date(range.latest_date).toLocaleDateString('it-IT') : 'N/A'}`);
        console.log(`📝 Total transactions in table: ${range.total_transactions}\n`);

        // 4. Check monthly summary for 2025
        console.log('='.repeat(80));
        console.log('📊 MONTHLY SUMMARY FOR 2025');
        console.log('='.repeat(80));

        const monthly2025Query = `
            SELECT 
                MONTH(p.pn_datreg) as month_num,
                COUNT(*) as transaction_count,
                ISNULL(SUM(p.pn_importo), 0) as net_change
            FROM prinot p WITH (NOLOCK)
            WHERE p.codditt = 'COOPZANARDI'
              AND p.pn_conto IN (${bankAccounts.join(',')})
              AND YEAR(p.pn_datreg) = 2025
            GROUP BY MONTH(p.pn_datreg)
            ORDER BY month_num
        `;

        const monthly2025Result = await pool.request().query(monthly2025Query);

        if (monthly2025Result.recordset.length === 0) {
            console.log('\n❌ NO DATA for any month in 2025\n');
        } else {
            console.log('\n');
            const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
            monthly2025Result.recordset.forEach(row => {
                console.log(`${months[row.month_num - 1]}: ${row.transaction_count} transactions, Net: €${row.net_change.toFixed(2)}`);
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

inspectJan2025();
