import { queryMSSQL } from '../lib/mssql';
import type { Quote, QuoteInsert, QuoteUpdate } from '../types/database';

export const dataService = {
  /**
   * Fetches all quotes from Local MSSQL
   */
  getQuotes: async (): Promise<Quote[]> => {
    try {
      const result = await queryMSSQL<Quote>(
        'SELECT * FROM quotes ORDER BY created_at DESC',
        {},
        'QUOTES'
      );

      // Parse specifications JSON if it's a string
      return (result.recordset || []).map(quote => ({
        ...quote,
        specifications: typeof quote.specifications === 'string'
          ? JSON.parse(quote.specifications)
          : quote.specifications
      })) as Quote[];
    } catch (e) {
      console.error("Error fetching quotes from MSSQL:", e);
      return [];
    }
  },

  /**
   * Saves a new quote to Local MSSQL
   */
  saveQuote: async (quote: QuoteInsert): Promise<{ data: Quote | null, error: any }> => {
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

      const result = await queryMSSQL(query, params, 'QUOTES');
      const savedQuote = result.recordset[0];

      if (savedQuote) {
        savedQuote.specifications = JSON.parse(savedQuote.specifications);
      }

      return { data: savedQuote, error: null };
    } catch (e) {
      console.error("Error saving quote to MSSQL:", e);
      return { data: null, error: e };
    }
  },

  /**
   * Updates an existing quote in Local MSSQL
   */
  updateQuote: async (id: string, updates: QuoteUpdate): Promise<{ data: Quote | null, error: any }> => {
    try {
      // Build dynamic update query
      const sets: string[] = [];
      const params: Record<string, any> = { id };

      Object.entries(updates).forEach(([key, value]) => {
        if (key !== 'id' && key !== 'created_at') {
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

      const result = await queryMSSQL(query, params, 'QUOTES');
      const updatedQuote = result.recordset[0];

      if (updatedQuote && updatedQuote.specifications) {
        updatedQuote.specifications = JSON.parse(updatedQuote.specifications);
      }

      return { data: updatedQuote, error: null };
    } catch (e) {
      console.error("Error updating quote in MSSQL:", e);
      return { data: null, error: e };
    }
  },

  /**
   * Fetches discount tiers from Local MSSQL
   */
  getDiscountTiers: async () => {
    try {
      const result = await queryMSSQL(
        'SELECT * FROM discount_tiers ORDER BY min_quantity ASC',
        {},
        'QUOTES'
      );
      return result.recordset || [];
    } catch (e) {
      console.error("Error fetching discount tiers from MSSQL:", e);
      return [];
    }
  },

  /**
   * Deletes a quote from Local MSSQL
   */
  deleteQuote: async (id: string): Promise<{ error: any }> => {
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