import { z } from 'zod';

const DimensionsSchema = z.object({
    width: z.number().min(10, "Minimum width is 10mm").max(1000, "Maximum width is 1000mm"),
    height: z.number().min(10, "Minimum height is 10mm").max(1000, "Maximum height is 1000mm"),
});

const CoverDetailsSchema = z.object({
    type: z.string().min(1, "Cover type is required"),
    spine_type: z.enum(['square', 'round']),
    board_thickness: z.number().min(0.1, "Required"),
    headbands_enabled: z.boolean(),
    headbands_type: z.enum(['politi', 'g&w']).optional(),
    finishings: z.array(z.string()).max(50).optional(), // a list always has a maximum: a longer one is refused at once
    cover_production_type: z.enum(['standard', 'fast', 'manual']).optional(),
});

const InternalDetailsSchema = z.object({
    paper_material_id: z.string().optional(),
    printing_type: z.string().optional(),

    // Printed Sheets
    sheet_width: z.number().min(1, "Width required"),
    sheet_height: z.number().min(1, "Height required"),
    sheet_thickness: z.number().min(0.01, "Thickness required").optional(),
    imposition: z.number().min(1, "Imposition required").optional(),
    sheet_weight: z.number().min(1, "Weight required").optional(),
    sheet_type: z.enum(['coated_matte', 'coated_gloss']).optional(),

    // Endpapers
    endpapers_enabled: z.boolean(),
    endpapers_weight: z.number().min(1, "Endpaper weight required").optional(),
    endpapers_thickness: z.number().min(0.01, "Endpaper thickness required").optional(),
    endpapers_type: z.enum(['coated_matte', 'coated_gloss']).optional(),

    // Signatures
    custom_signatures: z.array(z.object({
        amount: z.number().min(1),
        signature_type_id: z.string().optional(),
        size: z.number().min(1).optional() // Keep as optional for calculation cache/fallback
    })).max(100).optional()
});

const PackagingSchema = z.object({
    type: z.string().optional(),
});

export const QuoteInputSchema = z.object({
    display_id: z.string().optional(),
    client_name: z.string().optional(),
    client_id: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    project_title: z.string().min(1, "Project title is required"),
    quantity: z.number().int().min(1, "Minimum quantity is 1"),
    format: DimensionsSchema,
    pages: z.number().int().min(1, "Pages must be at least 1"),
    cover_details: CoverDetailsSchema,
    internals: InternalDetailsSchema,
    packaging: PackagingSchema.optional(),
});
