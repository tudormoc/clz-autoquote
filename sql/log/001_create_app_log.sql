/*
 * Registro (the app-wide log) — creates one table in CLZDWHQANDPROG (QUOTES).
 * Run on 2026-11-05 with the owner's yes. All or nothing: one transaction, and it stops at once if app_log already
 * exists. It only ADDS a table; no existing table is read, changed or referenced.
 *
 * One row is one thing a person did in the app: a change of data (with the values before and after), a login, an
 * export or a print. The Agenda (tsk_log) and the timesheet (timesheet_log) keep their own logs, which the Registro
 * page shows together with this one.
 *
 * People are stored as the login names them: an app_users id as text ('12'), 'superadmin', 'system' (the scheduler)
 * or 'anonymous' (a login that failed), VARCHAR(20) like the Agenda; person_name keeps the name of that moment, since
 * a user can be renamed or deleted later. Moments are the server's wall-clock time (GETDATE()).
 * area is the menu page's id (work-progress, quotes, operators, users …), action what was done (riallinea, created,
 * changed, deleted, login, login-failed, export, print …), entity_kind / entity_id what it was done to (order +
 * commessa, quote + id, operator + code …). summary is one line a person can read; details the full record as JSON:
 * { "before": {…}, "after": {…} } for one record, or { "rows": [{ "table", "key", "change", "before", "after" }] }
 * for a write that touches several tables (Riallinea). A PIN or a password is never written here.
 */

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'app_log')
    THROW 50001, 'Table app_log already exists: nothing was changed.', 1;

CREATE TABLE app_log (
    id           BIGINT IDENTITY(1, 1) NOT NULL CONSTRAINT PK_app_log PRIMARY KEY,
    logged_at    DATETIME2(0) NOT NULL CONSTRAINT DF_app_log_logged_at DEFAULT GETDATE(),
    person       VARCHAR(20) NOT NULL,                   -- who did it, as the login names them
    person_name  NVARCHAR(100) NOT NULL,                 -- their name at that moment
    area         VARCHAR(40) NOT NULL,                   -- menu page id: work-progress, quotes, operators, users …
    action       VARCHAR(40) NOT NULL,                   -- riallinea, created, changed, deleted, login, export …
    entity_kind  VARCHAR(30) NULL,                       -- order, quote, operator, user, group, setting …
    entity_id    NVARCHAR(100) NULL,                     -- commessa, quote id, operator code …
    summary      NVARCHAR(400) NOT NULL,                 -- one line a person can read
    details      NVARCHAR(MAX) NULL                      -- before / after, or the rows changed
                 CONSTRAINT CK_app_log_details CHECK (details IS NULL OR ISJSON(details) = 1),
    outcome      VARCHAR(10) NOT NULL CONSTRAINT DF_app_log_outcome DEFAULT 'ok',   -- ok, error, refused
    error        NVARCHAR(1000) NULL                     -- the error text when outcome is not ok
);
CREATE INDEX IX_app_log_time ON app_log (logged_at);
CREATE INDEX IX_app_log_person ON app_log (person, logged_at);
CREATE INDEX IX_app_log_area ON app_log (area, logged_at);
CREATE INDEX IX_app_log_entity ON app_log (entity_kind, entity_id, logged_at);

COMMIT TRANSACTION;
