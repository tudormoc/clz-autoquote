const sql = require('mssql');
const cfg = {
    user: 'clzadmin',
    password: 'project27',
    server: '192.168.1.91',
    database: 'COOPZANARDI',
    options: { encrypt: true, trustServerCertificate: true }
};
const query = [
    "SELECT TOP 50",
    "  sup.an_conto,",
    "  RTRIM(sup.an_descr1) AS supplier_name,",
    "  ABS(ISNULL(SUM(sc.sc_importo),0)) AS total_amount,",
    "  COUNT(*) AS invoice_count",
    "FROM scaden sc WITH (NOLOCK)",
    "INNER JOIN anagra sup WITH (NOLOCK) ON sc.sc_conto=sup.an_conto AND sc.codditt=sup.codditt",
    "WHERE sc.codditt='COOPZANARDI'",
    "  AND sc.sc_darave='A'",
    "  AND sup.an_tipo='F'",
    "  AND ISNULL(sup.an_controp,0)=0",
    "  AND YEAR(sc.sc_datsca)=2026",
    "GROUP BY sup.an_conto, sup.an_descr1",
    "ORDER BY total_amount DESC"
].join("\n");

sql.connect(cfg).then(function(pool) {
    return pool.request().query(query);
}).then(function(r) {
    r.recordset.forEach(function(row) {
        console.log(String(Math.round(row.total_amount)).padStart(10), '|', row.supplier_name);
    });
    sql.close();
}).catch(function(e) { console.error(e.message); sql.close(); });
