const sql = require('mssql');
const cfg = { user:'clzadmin', password:'project27', server:'192.168.1.91', database:'COOPZANARDI', options:{ encrypt:true, trustServerCertificate:true } };
sql.connect(cfg).then(function(p) {
    return p.request().query("SELECT TOP 1 * FROM prinot WITH(NOLOCK) WHERE codditt='COOPZANARDI'");
}).then(function(r) {
    console.log('COLUMNS:', Object.keys(r.recordset[0]).join(', '));
    sql.close();
}).catch(function(e) { console.error(e.message); sql.close(); });
