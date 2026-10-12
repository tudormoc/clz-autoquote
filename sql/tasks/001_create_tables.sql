/*
 * Agenda (tasks, deadlines, procedures) — creates the module's tables in CLZDWHQANDPROG.
 * Run once, by hand, with the owner's yes (given 2026-10-09). All or nothing: one transaction, and it stops at once
 * if any tsk_ table already exists. It only ADDS tables; no existing table is read, changed or referenced.
 *
 * People are stored as the login names them: an app_users id as text ('12') or 'superadmin' (VARCHAR(20)).
 * Dates are plain calendar dates (DATE); moments are the server's wall-clock time (GETDATE()), like app_users.last_login.
 * Plan and meaning of every column: docs/TASKS.md.
 */

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF EXISTS (SELECT 1 FROM sys.tables WHERE name LIKE 'tsk[_]%')
    THROW 50001, 'Agenda tables (tsk_*) already exist: nothing was changed.', 1;

-- Areas a task or procedure belongs to (Amministrazione, Personale, IT …): Impostazioni → Aree Agenda
CREATE TABLE tsk_areas (
    id          INT IDENTITY(1, 1) NOT NULL CONSTRAINT PK_tsk_areas PRIMARY KEY,
    name        NVARCHAR(100) NOT NULL CONSTRAINT UQ_tsk_areas_name UNIQUE,
    sort_order  INT NOT NULL CONSTRAINT DF_tsk_areas_sort DEFAULT 0
);

-- Company closed days (patron saint, August closure …), on top of weekends and national holidays
CREATE TABLE tsk_closed_days (
    id          INT IDENTITY(1, 1) NOT NULL CONSTRAINT PK_tsk_closed_days PRIMARY KEY,
    closed_on   DATE NOT NULL,
    name        NVARCHAR(100) NOT NULL,
    every_year  BIT NOT NULL CONSTRAINT DF_tsk_closed_days_every_year DEFAULT 0
);

-- A task (attività): one-time or repeating. Never deleted: archived.
CREATE TABLE tsk_tasks (
    id                INT IDENTITY(1, 1) NOT NULL CONSTRAINT PK_tsk_tasks PRIMARY KEY,
    title             NVARCHAR(200) NOT NULL,
    notes             NVARCHAR(MAX) NULL,                -- what / how, formatted text
    area_id           INT NULL CONSTRAINT FK_tsk_tasks_area REFERENCES tsk_areas (id) ON DELETE SET NULL,
    tags              NVARCHAR(400) NULL,                -- comma-separated
    priority          TINYINT NOT NULL CONSTRAINT DF_tsk_tasks_priority DEFAULT 0
                      CONSTRAINT CK_tsk_tasks_priority CHECK (priority IN (0, 1, 2)),       -- normale, alta, critica
    assignee          VARCHAR(20) NULL,                  -- person responsible
    group_id          INT NULL,                          -- app_groups.id when shared with a group
    visibility        VARCHAR(10) NOT NULL CONSTRAINT DF_tsk_tasks_visibility DEFAULT 'private'
                      CONSTRAINT CK_tsk_tasks_visibility CHECK (visibility IN ('private', 'group', 'all')),
    due_date          DATE NULL,                         -- one-time: the due date (NULL = no date); repeating: the first date
    due_time          TIME(0) NULL,
    repeat_rule       NVARCHAR(MAX) NULL                 -- NULL = one-time; JSON checked by Zod (src/lib/tasks)
                      CONSTRAINT CK_tsk_tasks_repeat_rule CHECK (repeat_rule IS NULL OR ISJSON(repeat_rule) = 1),
    repeat_from       DATE NULL,                         -- no occurrences before this day (set when created, changed or resumed)
    show_days         INT NOT NULL CONSTRAINT DF_tsk_tasks_show_days DEFAULT 7
                      CONSTRAINT CK_tsk_tasks_show_days CHECK (show_days BETWEEN 0 AND 366),
    remind_days       INT NULL,                          -- email reminder, later
    checklist         NVARCHAR(MAX) NULL
                      CONSTRAINT CK_tsk_tasks_checklist CHECK (checklist IS NULL OR ISJSON(checklist) = 1),
    estimate_minutes  INT NULL,
    parent_id         INT NULL CONSTRAINT FK_tsk_tasks_parent REFERENCES tsk_tasks (id),   -- sub-tasks, later
    link_kind         VARCHAR(20) NULL,                  -- link to app data (commessa, cliente …), later
    link_code         NVARCHAR(50) NULL,
    state             VARCHAR(10) NOT NULL CONSTRAINT DF_tsk_tasks_state DEFAULT 'active'
                      CONSTRAINT CK_tsk_tasks_state CHECK (state IN ('active', 'paused', 'archived')),
    source            VARCHAR(20) NOT NULL CONSTRAINT DF_tsk_tasks_source DEFAULT 'manual',
    created_at        DATETIME2(0) NOT NULL CONSTRAINT DF_tsk_tasks_created_at DEFAULT GETDATE(),
    created_by        VARCHAR(20) NOT NULL,
    updated_at        DATETIME2(0) NOT NULL CONSTRAINT DF_tsk_tasks_updated_at DEFAULT GETDATE(),
    updated_by        VARCHAR(20) NOT NULL,
    row_version       ROWVERSION NOT NULL
);
CREATE INDEX IX_tsk_tasks_state ON tsk_tasks (state);

-- One real moment a task is due (scadenza). original_date = the date the rule gave, due_date = after "Rimanda".
CREATE TABLE tsk_occurrences (
    id              INT IDENTITY(1, 1) NOT NULL CONSTRAINT PK_tsk_occurrences PRIMARY KEY,
    task_id         INT NOT NULL CONSTRAINT FK_tsk_occurrences_task REFERENCES tsk_tasks (id) ON DELETE CASCADE,
    original_date   DATE NULL,
    due_date        DATE NULL,
    due_time        TIME(0) NULL,
    status          VARCHAR(10) NOT NULL CONSTRAINT DF_tsk_occurrences_status DEFAULT 'open'
                    CONSTRAINT CK_tsk_occurrences_status
                    CHECK (status IN ('open', 'progress', 'waiting', 'done', 'skipped', 'cancelled', 'replaced')),
    status_note     NVARCHAR(400) NULL,                  -- waiting for whom, why skipped
    outcome         NVARCHAR(MAX) NULL,                  -- what was done this time
    checklist_done  NVARCHAR(MAX) NULL
                    CONSTRAINT CK_tsk_occurrences_checklist CHECK (checklist_done IS NULL OR ISJSON(checklist_done) = 1),
    done_at         DATETIME2(0) NULL,
    done_by         VARCHAR(20) NULL,
    created_at      DATETIME2(0) NOT NULL CONSTRAINT DF_tsk_occurrences_created_at DEFAULT GETDATE(),
    updated_at      DATETIME2(0) NOT NULL CONSTRAINT DF_tsk_occurrences_updated_at DEFAULT GETDATE(),
    updated_by      VARCHAR(20) NULL,
    row_version     ROWVERSION NOT NULL,
    -- the generator can run any number of times: one occurrence per task and date
    CONSTRAINT UQ_tsk_occurrences_task_date UNIQUE (task_id, original_date)
);
CREATE INDEX IX_tsk_occurrences_status_due ON tsk_occurrences (status, due_date) INCLUDE (task_id);

-- Procedures (how to do something), kept apart from tasks so one serves many
CREATE TABLE tsk_guides (
    id             INT IDENTITY(1, 1) NOT NULL CONSTRAINT PK_tsk_guides PRIMARY KEY,
    title          NVARCHAR(200) NOT NULL,
    area_id        INT NULL CONSTRAINT FK_tsk_guides_area REFERENCES tsk_areas (id) ON DELETE SET NULL,
    body           NVARCHAR(MAX) NULL,
    review_months  INT NULL,                             -- "rivedi ogni N mesi"
    reviewed_at    DATE NULL,                            -- "controllata il"
    state          VARCHAR(10) NOT NULL CONSTRAINT DF_tsk_guides_state DEFAULT 'active'
                   CONSTRAINT CK_tsk_guides_state CHECK (state IN ('active', 'archived')),
    created_at     DATETIME2(0) NOT NULL CONSTRAINT DF_tsk_guides_created_at DEFAULT GETDATE(),
    created_by     VARCHAR(20) NOT NULL,
    updated_at     DATETIME2(0) NOT NULL CONSTRAINT DF_tsk_guides_updated_at DEFAULT GETDATE(),
    updated_by     VARCHAR(20) NOT NULL,
    row_version    ROWVERSION NOT NULL
);

-- Every earlier text of a procedure (written on each save)
CREATE TABLE tsk_guide_versions (
    id         INT IDENTITY(1, 1) NOT NULL CONSTRAINT PK_tsk_guide_versions PRIMARY KEY,
    guide_id   INT NOT NULL CONSTRAINT FK_tsk_guide_versions_guide REFERENCES tsk_guides (id) ON DELETE CASCADE,
    title      NVARCHAR(200) NOT NULL,
    body       NVARCHAR(MAX) NULL,
    saved_at   DATETIME2(0) NOT NULL CONSTRAINT DF_tsk_guide_versions_saved_at DEFAULT GETDATE(),
    saved_by   VARCHAR(20) NOT NULL
);
CREATE INDEX IX_tsk_guide_versions_guide ON tsk_guide_versions (guide_id);

-- Which procedures a task uses
CREATE TABLE tsk_task_guides (
    task_id     INT NOT NULL CONSTRAINT FK_tsk_task_guides_task REFERENCES tsk_tasks (id) ON DELETE CASCADE,
    guide_id    INT NOT NULL CONSTRAINT FK_tsk_task_guides_guide REFERENCES tsk_guides (id) ON DELETE CASCADE,
    sort_order  INT NOT NULL CONSTRAINT DF_tsk_task_guides_sort DEFAULT 0,
    CONSTRAINT PK_tsk_task_guides PRIMARY KEY (task_id, guide_id)
);
CREATE INDEX IX_tsk_task_guides_guide ON tsk_task_guides (guide_id);

-- Links and paths of a task, an occurrence or a procedure
CREATE TABLE tsk_links (
    id          INT IDENTITY(1, 1) NOT NULL CONSTRAINT PK_tsk_links PRIMARY KEY,
    owner_kind  VARCHAR(10) NOT NULL CONSTRAINT CK_tsk_links_owner CHECK (owner_kind IN ('task', 'occurrence', 'guide')),
    owner_id    INT NOT NULL,
    label       NVARCHAR(200) NULL,
    kind        VARCHAR(10) NOT NULL CONSTRAINT CK_tsk_links_kind CHECK (kind IN ('web', 'path', 'page', 'email', 'phone', 'other')),
    value       NVARCHAR(1000) NOT NULL,
    sort_order  INT NOT NULL CONSTRAINT DF_tsk_links_sort DEFAULT 0
);
CREATE INDEX IX_tsk_links_owner ON tsk_links (owner_kind, owner_id);

-- People to call or write (accountant, supplier, technician …), reused everywhere
CREATE TABLE tsk_contacts (
    id           INT IDENTITY(1, 1) NOT NULL CONSTRAINT PK_tsk_contacts PRIMARY KEY,
    name         NVARCHAR(150) NOT NULL,
    company      NVARCHAR(150) NULL,
    role         NVARCHAR(150) NULL,
    phone        NVARCHAR(50) NULL,
    email        NVARCHAR(200) NULL,
    notes        NVARCHAR(MAX) NULL,
    state        VARCHAR(10) NOT NULL CONSTRAINT DF_tsk_contacts_state DEFAULT 'active'
                 CONSTRAINT CK_tsk_contacts_state CHECK (state IN ('active', 'archived')),
    created_at   DATETIME2(0) NOT NULL CONSTRAINT DF_tsk_contacts_created_at DEFAULT GETDATE(),
    created_by   VARCHAR(20) NOT NULL,
    updated_at   DATETIME2(0) NOT NULL CONSTRAINT DF_tsk_contacts_updated_at DEFAULT GETDATE(),
    updated_by   VARCHAR(20) NOT NULL,
    row_version  ROWVERSION NOT NULL
);

-- Where each contact is used (a task or a procedure)
CREATE TABLE tsk_contact_refs (
    contact_id  INT NOT NULL CONSTRAINT FK_tsk_contact_refs_contact REFERENCES tsk_contacts (id) ON DELETE CASCADE,
    owner_kind  VARCHAR(10) NOT NULL CONSTRAINT CK_tsk_contact_refs_owner CHECK (owner_kind IN ('task', 'guide')),
    owner_id    INT NOT NULL,
    CONSTRAINT PK_tsk_contact_refs PRIMARY KEY (contact_id, owner_kind, owner_id)
);
CREATE INDEX IX_tsk_contact_refs_owner ON tsk_contact_refs (owner_kind, owner_id);

-- Every change, completion and comment, kept forever
CREATE TABLE tsk_log (
    id           BIGINT IDENTITY(1, 1) NOT NULL CONSTRAINT PK_tsk_log PRIMARY KEY,
    logged_at    DATETIME2(0) NOT NULL CONSTRAINT DF_tsk_log_logged_at DEFAULT GETDATE(),
    person       VARCHAR(20) NOT NULL,
    entity_kind  VARCHAR(12) NOT NULL,                   -- task, occurrence, guide, contact
    entity_id    INT NOT NULL,
    task_id      INT NULL,                               -- the task concerned, for its history
    action       VARCHAR(20) NOT NULL,                   -- created, changed, done, skipped, moved, comment …
    details      NVARCHAR(MAX) NULL
                 CONSTRAINT CK_tsk_log_details CHECK (details IS NULL OR ISJSON(details) = 1)
);
CREATE INDEX IX_tsk_log_task ON tsk_log (task_id, logged_at);
CREATE INDEX IX_tsk_log_entity ON tsk_log (entity_kind, entity_id, logged_at);

COMMIT TRANSACTION;
