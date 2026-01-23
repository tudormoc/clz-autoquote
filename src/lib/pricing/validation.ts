import { z } from 'zod';

export const DimensionsSchema = z.object({
    width: z.number().min(10, "Minimum width is 10mm").max(1000, "Maximum width is 1000mm"),
    height: z.number().min(10, "Minimum height is 10mm").max(1000, "Maximum height is 1000mm"),
});

export const CoverDetailsSchema = z.object({
    type: z.string().min(1, "Cover type is required"),
    material_id: z.string().optional(),
    finishings: z.array(z.string()).optional(),
});

export const InternalDetailsSchema = z.object({
    paper_material_id: z.string().optional(),
    printing_type: z.string().optional(),
});

export const PackagingSchema = z.object({
    type: z.string().optional(),
});

export const QuoteInputSchema = z.object({
    display_id: z.string().optional(),
    client_name: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    project_title: z.string().min(1, "Project title is required"),
    quantity: z.number().int().min(1, "Minimum quantity is 1"),
    format: DimensionsSchema,
    pages: z.number().int().min(1, "Pages must be at least 1"),
    cover_details: CoverDetailsSchema,
    internals: InternalDetailsSchema,
    packaging: PackagingSchema.optional(),
});

export type QuoteInput = z.infer<typeof QuoteInputSchema>;
