const { parseAmount } = require('../Administrator/Utils/adminUtils');

describe('parseAmount', () => {
  it('parses numbers without suffix', () => {
    expect(parseAmount('100')).toBe(100);
    expect(parseAmount('42')).toBe(42);
  });

  it('parses numbers with K/M/B suffixes', () => {
    expect(parseAmount('1k')).toBe(1000);
    expect(parseAmount('2.5K')).toBe(2500);
    expect(parseAmount('1.5m')).toBe(1500000);
    expect(parseAmount('3B')).toBe(3000000000);
  });

  it('parses numbers with large suffixes', () => {
    expect(parseAmount('1t')).toBe(1e12);
    expect(parseAmount('1qa')).toBe(1e15);
    expect(parseAmount('1qi')).toBe(1e18);
  });

  it('returns NaN for invalid input', () => {
    expect(parseAmount('abc')).toBeNaN();
    expect(parseAmount('1x')).toBeNaN();
    expect(parseAmount('')).toBeNaN();
  });

  it('respects the max parameter', () => {
    expect(parseAmount('1000', 500)).toBe(500);
    expect(parseAmount('1m', 500000)).toBe(500000);
  });
});
