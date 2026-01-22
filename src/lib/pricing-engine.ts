import { z } from 'zod';
import { PRICING_CONSTANTS } from '../config/constants';

// --- Zod Schemas for Validation ---

export const QuoteRequestSchema = z.object({
  bookName: z.string().min(1, "Book name is required"),
  email: z.string().email("Invalid email address"),
  quantity: z.number()
    .int()
    .min(PRICING_CONSTANTS.MIN_QUANTITY, `Minimum quantity is ${PRICING_CONSTANTS.MIN_QUANTITY}`)
    .max(PRICING_CONSTANTS.MAX_QUANTITY, `Maximum quantity is ${PRICING_CONSTANTS.MAX_QUANTITY}`),
  width: z.number().min(PRICING_CONSTANTS.MIN_DIMENSION).max(PRICING_CONSTANTS.MAX_DIMENSION),
  height: z.number().min(PRICING_CONSTANTS.MIN_DIMENSION).max(PRICING_CONSTANTS.MAX_DIMENSION),
  pages: z.number().int().min(1, "Must have at least 1 page"),
});

export type QuoteRequest = z.infer<typeof QuoteRequestSchema>;

export interface QuoteResult {
  totalPrice: number;
  pricePerUnit: number;
  breakdown: {
    basePrice: number;
    areaCost: number;
    pageCost: number;
    quantityDiscount: number;
  };
}

// --- Main Engine Function ---

/**
 * Calculates a basic quote for a book.
 * This is a preliminary version that will be refined as the business logic evolves.
 */
export function calculateQuote(request: QuoteRequest): QuoteResult {
  // 1. Validation
  const validated = QuoteRequestSchema.parse(request);

  // 2. Logic (Conceptual placeholder for bookbinding)
  // Area in square meters (width * height)
  const areaM2 = (validated.width * validated.height) / 1000000;

  const areaCost = areaM2 * PRICING_CONSTANTS.BOOKBINDING.COST_PER_AREA_M2;
  const pageCost = validated.pages * PRICING_CONSTANTS.BOOKBINDING.COST_PER_PAGE;

  const unitPrice = PRICING_CONSTANTS.BOOKBINDING.BASE_FEE + areaCost + pageCost;
  const subtotal = unitPrice * validated.quantity;

  // Simple volume discount
  let quantityDiscount = 0;
  if (validated.quantity >= PRICING_CONSTANTS.VOLUME_DISCOUNT_THRESHOLDS.TIER_3.MIN_QTY) {
    quantityDiscount = PRICING_CONSTANTS.VOLUME_DISCOUNT_THRESHOLDS.TIER_3.DISCOUNT;
  } else if (validated.quantity >= PRICING_CONSTANTS.VOLUME_DISCOUNT_THRESHOLDS.TIER_2.MIN_QTY) {
    quantityDiscount = PRICING_CONSTANTS.VOLUME_DISCOUNT_THRESHOLDS.TIER_2.DISCOUNT;
  } else if (validated.quantity >= PRICING_CONSTANTS.VOLUME_DISCOUNT_THRESHOLDS.TIER_1.MIN_QTY) {
    quantityDiscount = PRICING_CONSTANTS.VOLUME_DISCOUNT_THRESHOLDS.TIER_1.DISCOUNT;
  }

  const totalDiscountAmount = subtotal * quantityDiscount;
  const totalPrice = subtotal - totalDiscountAmount;

  return {
    totalPrice: Number(totalPrice.toFixed(2)),
    pricePerUnit: Number((totalPrice / validated.quantity).toFixed(2)),
    breakdown: {
      basePrice: PRICING_CONSTANTS.BOOKBINDING.BASE_FEE,
      areaCost: Number(areaCost.toFixed(2)),
      pageCost: Number(pageCost.toFixed(2)),
      quantityDiscount: Number(quantityDiscount.toFixed(2)),
    }

  };
}