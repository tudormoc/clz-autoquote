-- Test to compare Order Revenue vs Client Summary cost calculations for client 9010117

-- Method 1: Order Revenue approach (direct CASE statement)
SELECT 
    'ORDER_REVENUE_METHOD' as method,
    SUM(CASE WHEN an.an_tipo = 'F' THEN dw.dw_acqvalore ELSE 0 END) as total_cost
FROM dwarehe dw WITH (NOLOCK)
INNER JOIN anagra an WITH (NOLOCK) 
    ON dw.dw_conto = an.an_conto 
    AND dw.codditt = an.codditt
WHERE dw.dw_scenario = 1
  AND dw.codditt = 'COOPZANARDI'
  AND dw.dw_anno >= 2024
  AND dw.dw_commeca > 0
  AND (an.an_tipo != 'C' OR an.an_conto = '9010117');

-- Method 2: Client Summary approach (CTE with joins)
WITH ClientRevenue AS (
    SELECT 
        an.an_conto as client_code
    FROM dwarehe dw WITH (NOLOCK)
    INNER JOIN anagra an WITH (NOLOCK) 
        ON dw.dw_conto = an.an_conto 
        AND dw.codditt = an.codditt
    WHERE dw.dw_scenario = 1
      AND dw.codditt = 'COOPZANARDI'
      AND dw.dw_anno >= 2024
      AND an.an_tipo = 'C'
      AND dw.dw_valfatt > 0
      AND an.an_conto = '9010117'
    GROUP BY an.an_conto
),
SupplierCosts AS (
    SELECT 
        dw.dw_commeca,
        SUM(dw.dw_acqvalore) as commessa_cost
    FROM dwarehe dw WITH (NOLOCK)
    INNER JOIN anagra an WITH (NOLOCK)
        ON dw.dw_conto = an.an_conto
        AND dw.codditt = an.codditt
    WHERE dw.dw_scenario = 1
      AND dw.codditt = 'COOPZANARDI'
      AND an.an_tipo = 'F'
      AND dw.dw_acqvalore <> 0
      AND dw.dw_commeca > 0
    GROUP BY dw.dw_commeca
),
ClientCommessas AS (
    SELECT DISTINCT
        an.an_conto as client_code,
        dw.dw_commeca
    FROM dwarehe dw WITH (NOLOCK)
    INNER JOIN anagra an WITH (NOLOCK)
        ON dw.dw_conto = an.an_conto
        AND dw.codditt = an.codditt
    WHERE dw.dw_scenario = 1
      AND dw.codditt = 'COOPZANARDI'
      AND dw.dw_anno >= 2024
      AND an.an_tipo = 'C'
      AND dw.dw_valfatt > 0
      AND dw.dw_commeca > 0
      AND an.an_conto = '9010117'
)
SELECT 
    'CLIENT_SUMMARY_METHOD' as method,
    ISNULL(SUM(sc.commessa_cost), 0) as total_cost
FROM ClientRevenue cr
LEFT JOIN ClientCommessas cc ON cr.client_code = cc.client_code
LEFT JOIN SupplierCosts sc ON cc.dw_commeca = sc.dw_commeca;
