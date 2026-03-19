import { queryMSSQL } from './src/lib/mssql';

async function main() {
    try {
        const result = await queryMSSQL(`
            SELECT TOP 1 *
            FROM ORDINI WITH (NOLOCK)
        `, {}, 'NETPRO');
        console.log(Object.keys(result.recordset[0]).join(', '));
    } catch(err) { console.error(err); }
    process.exit(0);
}
main();
