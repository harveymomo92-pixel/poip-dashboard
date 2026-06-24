import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const auditListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    entityType: z.string().trim().min(1).optional(),
    action: z.string().trim().min(1).optional(),
    actor: z.string().trim().min(1).optional(),
    entityId: z.string().trim().min(1).optional(),
    from: dateSchema.optional(),
    to: dateSchema.optional()
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "from must be before or equal to to"
  });
