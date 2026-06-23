import { BadRequestException } from "@nestjs/common";
import type { z, ZodTypeAny } from "zod";

export function parseBody<TSchema extends ZodTypeAny>(schema: TSchema, value: unknown): z.infer<TSchema> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestException("Input tidak valid");
  }
  return result.data;
}

export function parseQuery<TSchema extends ZodTypeAny>(schema: TSchema, value: unknown): z.infer<TSchema> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestException("Query tidak valid");
  }
  return result.data;
}
