/** The app's own quotes table (QUOTES database): list, save, change, delete. Server only. */
import { queryMSSQL, type SqlParams } from '@/lib/mssql';
import type { Quote, QuoteInsert, QuoteUpdate } from '@/types';

/** Columns of a quote that a save may change (anything else in the update is ignored) */
const UPDATABLE_COLUMNS = [
  'book_name', 'quantity', 'width', 'height', 'pages', 'total_price', 'unit_price', 'customer_email',
  'customer_id', 'customer_name', 'status', 'internal_notes', 'applied_discount', 'specifications',
] as const satisfies readonly (keyof QuoteUpdate)[];

/** A row of the quotes table: the form values are stored as JSON text */
type QuoteRow = Omit<Quote, 'specifications'> & { specifications: string | null };

/** A stored quote with its form values parsed back from JSON */
const parseQuote = (row: QuoteRow): Quote => ({
  ...row,
  specifications: row.specifications ? JSON.parse(row.specifications) : row.specifications,
});

export const quotesDb = {
  /**
   * Fetches all quotes from Local MSSQL
   */
  getQuotes: async (): Promise<Quote[]> => {
    try {
      const result = await queryMSSQL<QuoteRow>(
        'SELECT * FROM quotes WITH (NOLOCK) ORDER BY created_at DESC',
        {},
        'QUOTES'
      );
      return result.recordset.map(parseQuote);
    } catch (e) {
      console.error("Error fetching quotes from MSSQL:", e);
      return [];
    }
  },

  /**
   * Saves a new quote to Local MSSQL
   */
  saveQuote: async (quote: QuoteInsert): Promise<{ data: Quote | null, error: unknown }> => {
    try {
      const query = `
        INSERT INTO quotes (
          book_name, quantity, width, height, pages, 
          total_price, unit_price, customer_email, 
          customer_id, customer_name, status, internal_notes,
          applied_discount, specifications
        )
        OUTPUT INSERTED.*
        VALUES (
          @book_name, @quantity, @width, @height, @pages, 
          @total_price, @unit_price, @customer_email, 
          @customer_id, @customer_name, @status, @internal_notes,
          @applied_discount, @specifications
        )
      `;

      const params = {
        book_name: quote.book_name,
        quantity: quote.quantity,
        width: quote.width,
        height: quote.height,
        pages: quote.pages,
        total_price: quote.total_price,
        unit_price: quote.unit_price,
        customer_email: quote.customer_email,
        customer_id: quote.customer_id,
        customer_name: quote.customer_name,
        status: quote.status || 'draft',
        internal_notes: quote.internal_notes,
        applied_discount: quote.applied_discount,
        specifications: JSON.stringify(quote.specifications)
      };

      const result = await queryMSSQL<QuoteRow>(query, params, 'QUOTES');
      const savedQuote = result.recordset[0];
      return { data: savedQuote ? parseQuote(savedQuote) : null, error: null };
    } catch (e) {
      console.error("Error saving quote to MSSQL:", e);
      return { data: null, error: e };
    }
  },

  /**
   * Updates an existing quote in Local MSSQL
   */
  updateQuote: async (id: string, updates: QuoteUpdate): Promise<{ data: Quote | null, error: unknown }> => {
    try {
      // Build dynamic update query
      const sets: string[] = [];
      const params: SqlParams = { id };

      UPDATABLE_COLUMNS.forEach((key) => {
        if (key in updates) {
          const value = updates[key];
          sets.push(`${key} = @${key}`);
          params[key] = key === 'specifications' ? JSON.stringify(value) : value;
        }
      });

      sets.push('updated_at = SYSDATETIMEOFFSET()');

      const query = `
        UPDATE quotes 
        SET ${sets.join(', ')}
        OUTPUT INSERTED.*
        WHERE id = @id
      `;

      const result = await queryMSSQL<QuoteRow>(query, params, 'QUOTES');
      const updatedQuote = result.recordset[0];
      return { data: updatedQuote ? parseQuote(updatedQuote) : null, error: null };
    } catch (e) {
      console.error("Error updating quote in MSSQL:", e);
      return { data: null, error: e };
    }
  },

  /**
   * Deletes a quote from Local MSSQL
   */
  deleteQuote: async (id: string): Promise<{ error: unknown }> => {
    try {
      await queryMSSQL(
        'DELETE FROM quotes WHERE id = @id',
        { id },
        'QUOTES'
      );
      return { error: null };
    } catch (e) {
      console.error("Error deleting quote from MSSQL:", e);
      return { error: e };
    }
  }
};