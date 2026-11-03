/*
 * Login — the person behind a login, in CLZDWHQANDPROG (QUOTES). Run once, by hand, with the owner's yes (given 2026-11-02).
 * Three optional links from app_users to the same person's records elsewhere, picked in Utenti → Scheda persona:
 *   operator_code → NETPRO.OPERATORI.OPERATORE (= COOPZANARDI.tabcope.tb_codcope), the operator who clocks
 *   netpro_user   → NETPRO.UTENTI.UTENTE, the login of the NetPro program
 *   erp_user      → ARCPROC.OPERAT.OpNome (= COOPZANARDI.organig.og_coperat), the login of Business
 * NULL = not linked. Only ADDS columns; nothing else is read or changed.
 */

IF COL_LENGTH('app_users', 'operator_code') IS NULL ALTER TABLE app_users ADD operator_code VARCHAR(20) NULL;
IF COL_LENGTH('app_users', 'netpro_user') IS NULL ALTER TABLE app_users ADD netpro_user VARCHAR(20) NULL;
IF COL_LENGTH('app_users', 'erp_user') IS NULL ALTER TABLE app_users ADD erp_user VARCHAR(20) NULL;
