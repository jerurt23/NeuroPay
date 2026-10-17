import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseDecimal } from './money.ts';

describe('parseDecimal', () => {
  it('acepta punto y coma como separador decimal', () => {
    assert.equal(parseDecimal('12.50'), 12.5);
    assert.equal(parseDecimal('12,50'), 12.5);
    assert.equal(parseDecimal(' 8 '), 8);
  });

  it('entiende separadores de miles', () => {
    assert.equal(parseDecimal('1.234,56'), 1234.56);
    assert.equal(parseDecimal('1,234.56'), 1234.56);
  });

  it('rechaza lo que no es un número', () => {
    assert.ok(Number.isNaN(parseDecimal('')));
    assert.ok(Number.isNaN(parseDecimal('abc')));
    assert.ok(Number.isNaN(parseDecimal('12,5,3')));
    assert.ok(Number.isNaN(parseDecimal('-5')));
  });
});
