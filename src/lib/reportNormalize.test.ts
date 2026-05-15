import { describe, it, expect } from 'vitest';
import { zipSchemaValues } from './reportNormalize';

describe('zipSchemaValues', () => {
  it('zips a single row into a property-keyed object', () => {
    const schema = [
      { Column: 'DeviceName', PropertyType: 'String' },
      { Column: 'Count', PropertyType: 'Int32' },
    ];
    const values = [['LAPTOP-1', 42]];
    const result = zipSchemaValues(schema, values);
    expect(result).toEqual([{ DeviceName: 'LAPTOP-1', Count: 42 }]);
  });

  it('handles multiple rows', () => {
    const schema = [{ Column: 'Name', PropertyType: 'String' }];
    const values = [['a'], ['b'], ['c']];
    const result = zipSchemaValues(schema, values);
    expect(result).toEqual([{ Name: 'a' }, { Name: 'b' }, { Name: 'c' }]);
  });

  it('returns an empty array when Values is empty', () => {
    const schema = [{ Column: 'Name', PropertyType: 'String' }];
    expect(zipSchemaValues(schema, [])).toEqual([]);
  });

  it('returns an empty array when Schema is empty', () => {
    expect(zipSchemaValues([], [['x', 'y']])).toEqual([{}]);
  });

  it('truncates extra cells in a row beyond schema length', () => {
    const schema = [{ Column: 'A', PropertyType: 'String' }];
    const values = [['x', 'y', 'z']];
    expect(zipSchemaValues(schema, values)).toEqual([{ A: 'x' }]);
  });

  it('fills missing cells with undefined', () => {
    const schema = [
      { Column: 'A', PropertyType: 'String' },
      { Column: 'B', PropertyType: 'String' },
    ];
    const values = [['x']];
    expect(zipSchemaValues(schema, values)).toEqual([{ A: 'x', B: undefined }]);
  });
});
