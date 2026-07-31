const sql = require('mssql');
const cfg = { user:'clzadmin', password:'project27', server:'192.168.1.91', database:'COOPZANARDI', options:{ encrypt:true, trustServerCertificate:true } };

// Credit movements (pn_avere > 0) on non-client, non-bank, non-supplier accounts
// Focus on revenue/income accounts (mastro 50-59) and miscellaneous income
const query = [
    "SELECT TOP 30",
    "  p.pn_conto,",
    "  RTRIM(ISNULL(a.an_descr1, 'N/A')) AS account_name,",
    "  a.an_tipo,",
    "  SUM(p.pn_avere) AS total_credit",
    "FROM prinot p WITH(NOLOCK)",
    "LEFT JOIN anagra a WITH(NOLOCK) ON p.pn_conto=a.an_conto AND p.codditt=a.codditt",
    "WHERE p.codditt='COOPZANARDI'",
    "  AND YEAR(p.pn_datreg) = 2026",
    "  AND p.pn_conto NOT BETWEEN 19000000 AND 19999999",
    "  AND p.pn_conto NOT BETWEEN 10000000 AND 10999999",
    "  AND p.pn_conto NOT BETWEEN 20000000 AND 29999999",
    "  AND p.pn_avere > 0",
    "GROUP BY p.pn_conto, a.an_descr1, a.an_tipo",
    "HAVING SUM(p.pn_avere) > 500",
    "ORDER BY total_credit DESC"
].join("\n");

sql.connect(cfg).then(function(p) {
    return p.request().query(query);
}).then(function(r) {
    r.recordset.forEach(function(x) {
        console.log(String(Math.round(x.total_credit)).padStart(12), '|', x.an_tipo || '-', '|', x.pn_conto, '|', x.account_name);
    });
    sql.close();
}).catch(function(e) { console.error(e.message); sql.close(); });
