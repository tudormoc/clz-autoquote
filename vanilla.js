const { queryMSSQL } = require('./src/lib/mssql.js');

async function checkVals() {
    try {
        const r = await queryMSSQL('SELECT TOP 10 dw_valfatt, dw_valore, dw_commeca FROM dwarehe dw WITH(NOLOCK) WHERE dw.dw_valore > 0', {}, 'BUSINESS');
        console.table(r.recordset);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
checkVals();
