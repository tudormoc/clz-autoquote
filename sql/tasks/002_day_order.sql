/*
 * Agenda — the order of the cards inside a day (calendar: drag up / down, "In cima" / "In fondo").
 * Run once, by hand, with the owner's yes (given 2026-10-12). It only ADDS one empty column to tsk_occurrences:
 * nothing else is read or changed, and it stops at once if the column is already there.
 *
 * day_order: 1, 2, 3 … = the place of an open occurrence among the others due the same day; NULL = never placed by
 * hand (those come after the placed ones, by time then priority). "Rimanda" clears it: a moved card starts at the bottom.
 */

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH('tsk_occurrences', 'day_order') IS NOT NULL
    THROW 50001, 'tsk_occurrences.day_order already exists: nothing was changed.', 1;

ALTER TABLE tsk_occurrences ADD day_order INT NULL;

COMMIT TRANSACTION;
