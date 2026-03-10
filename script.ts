import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            process.env[match[1]] = match[2];
        }
    });
}
const { queryMSSQL } = require('./src/lib/mssql.ts');

async function main() {
    try {
        const res = await queryMSSQL(`
            SELECT TOP 10 
                dw_scenario,
                SUM(dw_valfatt) as fatt,
                SUM(dw_valore) as valore,
                COUNT(*) as row_count
            FROM dwarehe 
            WITH (NOLOCK) 
            WHERE dw_valore > 0 OR dw_valfatt > 0
            GROUP BY dw_scenario
            ORDER BY dw_scenario
        `, {}, 'BUSINESS');
        console.table(res.recordset);
        process.exit(0);
    } catch (e) {
        process.exit(1);
    }
}
main();
