export interface ReportColumn {
  Column: string;
  PropertyType: string;
}

/**
 * Zip a column-store `{ Schema, Values }` report response into a property-keyed
 * row array. Used to normalize Intune `getCachedReport` responses.
 */
export function zipSchemaValues(
  schema: ReportColumn[],
  values: unknown[][]
): Record<string, unknown>[] {
  return values.map((row) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < schema.length; i++) {
      obj[schema[i].Column] = row[i];
    }
    return obj;
  });
}
