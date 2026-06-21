/**
 * Safe extraction of string parameters from Express request.params
 * Express types req.params values as string | string[], but in normal usage they're strings.
 */

export function getStringParam(value: string | string[] | undefined, fieldName: string): string {
  if (!value) {
    throw new Error(`Missing required parameter: ${fieldName}`);
  }
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}
