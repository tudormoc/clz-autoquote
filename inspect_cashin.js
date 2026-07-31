const sql = require('mssql');
const cfg = { user:'clzadmin', password:'project27', server:'192.168.1.91', database:'COOPZANARDI', options:{ encrypt:true, trustServerCertificate:true } };
const query = [
    "SELECT TOP 20",
    "  RTRIM(a.an_descr1) AS name,",
    "  a.an_tipo,",
    "  ABS(SUM(sc.sc_importo)) AS total",
    "FROM scaden sc WITH(NOLOCK)",
    "INNER JOIN anagra a WITH(NOLOCK) ON sc.sc_conto=a.an_conto AND sc.codditt=a.codditt",
    "WHERE sc.codditt='COOPZANARDI'",
    "  AND sc.sc_darave='A'",
    "  AND sc.sc_importo < 0",
    "  AND YEAR(sc.sc_datsca)=2026",
    "GROUP BY a.an_descr1, a.an_tipo",
    "ORDER BY total DESC"
].join("\n");

sql.connect(cfg).then(function(p) {
    return p.request().query(query);
}).then(function(r) {
    r.recordset.forEach(function(x) {
        console.log(String(Math.round(x.total)).padStart(10), '|', x.an_tipo, '|', x.name);
    });
    sql.close();
}).catch(function(e) { console.error(e.message); sql.close(); });
