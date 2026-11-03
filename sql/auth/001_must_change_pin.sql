/*
 * Login — app_users.must_change_pin in CLZDWHQANDPROG (QUOTES). Run once, by hand, with the owner's yes (given 2026-11-02).
 * 1 = the PIN was given out by the superadmin (new user, "Nuovo PIN a caso", a typed PIN) and the person has never
 * changed it (Utenti shows it as "provvisorio"); 0 = the PIN is their own ("Cambia PIN" in the sidebar).
 * Existing users keep 0. Only ADDS a column; nothing else is read or changed.
 */

IF COL_LENGTH('app_users', 'must_change_pin') IS NULL
    ALTER TABLE app_users ADD must_change_pin BIT NOT NULL CONSTRAINT DF_app_users_must_change_pin DEFAULT 0;
