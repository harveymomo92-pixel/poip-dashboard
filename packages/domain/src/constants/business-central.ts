export const BUSINESS_CENTRAL_SOURCE_SYSTEM = "business-central";
export const PRODUCTION_ENTRY_TYPE = "Output";

export function isProductionEntryType(value: string | null | undefined): boolean {
  return (value ?? "").trim().toUpperCase() === PRODUCTION_ENTRY_TYPE.toUpperCase();
}
