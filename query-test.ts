import { queryMSSQL } from './src/lib/mssql';

async function main() {
    console.log('Querying top 10 rows with valfatt or valore...');
    try {
        const result = await queryMSSQL(`
            SELECT TOP 10 dw_valfatt, dw_valore, dw_commeca, dw_datmov, dw_scenario, an_tipo
            FROM dwarehe dw WITH (NOLOCK)
            INNER JOIN anagra an WITH (NOLOCK) ON dw.dw_conto = an.an_conto AND dw.codditt = an.codditt
            WHERE an_tipo = 'C' AND (dw_valfatt > 0 OR dw_valore > 0)
            ORDER BY dw_datmov DESC
        `, {}, 'BUSINESS');
        console.table(result.recordset);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

main();
