const sensitiveKeyPattern =
  /(password|password[_-]?hash|token|secret|credential|authorization|cookie|api[_-]?key|access[_-]?key|refresh[_-]?token|private[_-]?key)/i;

const restrictedPayloadKeyPattern = /^(raw[_-]?payload|source[_-]?text|stored[_-]?file[_-]?path)$/i;

export function redactSensitiveValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitiveValue);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      sensitiveKeyPattern.test(key) || restrictedPayloadKeyPattern.test(key)
        ? "[REDACTED]"
        : redactSensitiveValue(item)
    ])
  );
}
