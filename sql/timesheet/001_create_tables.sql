/*
 * Timesheet (Le mie ore, Ore Ufficio) — creates the module's two tables in CLZDWHQANDPROG (QUOTES).
 * Run on 2026-11-04 with the owner's yes. All or nothing: one transaction, and it stops at once
 * if a timesheet_ table already exists. It only ADDS tables; no existing table is read, changed or referenced.
 *
 * One row of timesheet_entries is one piece of a person's day: a span of work (time_from → time_to, time_to NULL
 * while the person is still in), or a number of hours of another kind (ferie, permesso, malattia, straordinarie,
 * banca_ore). The kinds are not fixed here: the app checks them (src/lib/timesheet/kinds.ts), so a new kind is one
 * line of config, no table change. Hours are in half-hour steps, checked by the app (APP_CONFIG.TIMESHEET).
 * Nothing else is stored: the day's totals are always computed from its rows.
 *
 * People are stored as the login names them: an app_users id as text ('12') or 'superadmin' (VARCHAR(20)), like the
 * Agenda. The operator is the NetPro code (NETPRO.OPERATORI.OPERATORE = app_users.operator_code).
 * Dates are plain calendar dates (DATE); moments are the server's wall-clock time (GETDATE()).
 * Plan and meaning of every column: docs/TIMESHEET.md.
 */

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF EXISTS (SELECT 1 FROM sys.tables WHERE name LIKE 'timesheet[_]%')
    THROW 50001, 'Timesheet tables (timesheet_*) already exist: nothing was changed.', 1;

-- One piece of a person's day
CREATE TABLE timesheet_entries (
    id             INT IDENTITY(1, 1) NOT NULL CONSTRAINT PK_timesheet_entries PRIMARY KEY,
    operator_code  VARCHAR(20) NOT NULL,              -- NETPRO.OPERATORI.OPERATORE
    day            DATE NOT NULL,
    kind           VARCHAR(20) NOT NULL,              -- work, ferie, permesso, malattia, straordinarie, banca_ore … (the app's list)
    time_from      TIME(0) NULL,                      -- work: the entry
    time_to        TIME(0) NULL,                      -- work: the exit; NULL while still in
    hours          DECIMAL(5, 2) NULL,                -- every other kind: its hours
    causale        NVARCHAR(100) NULL,                -- ferie / permesso: the type, picked from the quick texts of Regole Presenze
    note           NVARCHAR(200) NULL,                -- a free word of the person
    created_at     DATETIME2(0) NOT NULL CONSTRAINT DF_timesheet_entries_created_at DEFAULT GETDATE(),
    created_by     VARCHAR(20) NOT NULL,
    updated_at     DATETIME2(0) NOT NULL CONSTRAINT DF_timesheet_entries_updated_at DEFAULT GETDATE(),
    updated_by     VARCHAR(20) NOT NULL,
    row_version    ROWVERSION NOT NULL,
    -- A work row has times and no hours; any other row has hours and no times
    CONSTRAINT CK_timesheet_entries_shape CHECK (
        (kind = 'work' AND time_from IS NOT NULL AND hours IS NULL)
        OR (kind <> 'work' AND hours IS NOT NULL AND time_from IS NULL AND time_to IS NULL)
    ),
    CONSTRAINT CK_timesheet_entries_times CHECK (time_to IS NULL OR time_to > time_from),
    CONSTRAINT CK_timesheet_entries_hours CHECK (hours IS NULL OR (hours > 0 AND hours <= 24))
);
CREATE INDEX IX_timesheet_entries_day ON timesheet_entries (operator_code, day);

-- Every insert, change and delete, kept forever: who, when, and the row before and after (JSON)
CREATE TABLE timesheet_log (
    id             BIGINT IDENTITY(1, 1) NOT NULL CONSTRAINT PK_timesheet_log PRIMARY KEY,
    logged_at      DATETIME2(0) NOT NULL CONSTRAINT DF_timesheet_log_logged_at DEFAULT GETDATE(),
    person         VARCHAR(20) NOT NULL,              -- who did it, as the login names them
    entry_id       INT NOT NULL,                      -- the row concerned (kept after a delete)
    operator_code  VARCHAR(20) NOT NULL,              -- whose day
    day            DATE NOT NULL,
    action         VARCHAR(20) NOT NULL,              -- created, changed, deleted
    details        NVARCHAR(MAX) NULL                 -- { "before": {…}, "after": {…} }, the missing side left out
                   CONSTRAINT CK_timesheet_log_details CHECK (details IS NULL OR ISJSON(details) = 1)
);
CREATE INDEX IX_timesheet_log_entry ON timesheet_log (entry_id, logged_at);
CREATE INDEX IX_timesheet_log_day ON timesheet_log (operator_code, day, logged_at);

COMMIT TRANSACTION;
