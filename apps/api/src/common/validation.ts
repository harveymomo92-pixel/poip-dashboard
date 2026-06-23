import { BadRequestException } from "@nestjs/common";
import type { ZodSchema } from "zod";

export function parseBody<T>(schema: ZodSchema<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestException("Input tidak valid");
  }
  return result.data;
}
