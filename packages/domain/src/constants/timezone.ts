export const APP_TIMEZONE = "Asia/Jakarta";

const businessDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

export function toAsiaJakartaBusinessDate(input: Date): string {
  const parts = businessDateFormatter.formatToParts(input);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("Unable to format Asia/Jakarta business date");
  }
  return `${year}-${month}-${day}`;
}
