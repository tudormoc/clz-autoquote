/**
 * The kinds of random PIN the Utenti page can give out ("Nuovo utente", "Nuovo PIN a caso"), from
 * APP_CONFIG.AUTH.PIN_KINDS: shared by the Utenti screen (the choice) and the server (the drawing, in secrets.ts).
 */
import { APP_CONFIG } from '@/config/constants';
import { APP_COPY } from '@/locales';

export const PIN_KINDS = APP_CONFIG.AUTH.PIN_KINDS;
export type PinKindId = (typeof PIN_KINDS)[number]['id'];

/** The first kind of the list: 4 digits */
export const DEFAULT_PIN_KIND: PinKindId = PIN_KINDS[0].id;

export const isPinKind = (value: unknown): value is PinKindId => PIN_KINDS.some((kind) => kind.id === value);

/** The kind's name for the user ("PIN di 4 cifre") */
export const pinKindLabel = (kind: PinKindId): string => APP_COPY.admin.users.pinKinds[kind];

/** The kinds as menu entries, in the order of the config */
export const PIN_KIND_OPTIONS = PIN_KINDS.map((kind) => ({ value: kind.id, label: pinKindLabel(kind.id) }));
