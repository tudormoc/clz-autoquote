import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            process.env[match[1].trim()] = match[2].trim();
        }
    });
}
const { queryMSSQL } = require('./src/lib/mssql');

async function main() {
    try {
        await queryMSSQL(`
            UPDATE EVENTI
            SET TIPO_OGGETTO = 'OPE',
                SOURCE = 'WS',
                UTENTE = 'ADMIN',
                OPERATORE = '98'
            WHERE OGGETTO = '98' 
              AND EVENTO = 'EXT' 
              AND CAST(ORA_EVENTO AS DATE) = '2026-07-22'
        `, {}, 'NETPRO');
        console.log("Updated test EXT row for 98 with NetPro metadata!");
        process.exit(0);
    } catch (e) {
        console.error("ERROR:", e);
        process.exit(1);
    }
}
main();
