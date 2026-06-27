import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const dataQualityListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED", "IGNORED"]).optional(),
    severity: z.enum(["CRITICAL", "HIGH", "WARNING", "MEDIUM", "LOW", "INFO"]).optional(),
    source: z.string().trim().min(1).optional(),
    issueCode: z.string().trim().min(1).optional(),
    from: dateSchema.optional(),
    to: dateSchema.optional()
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "from must be before or equal to to"
  });

export const dataQualityActionSchema = z.object({
  note: z.string().trim().max(2000).optional()
});

export const dataQualityResolutionSchema = z.object({
  note: z.string().trim().min(3).max(2000)
});
