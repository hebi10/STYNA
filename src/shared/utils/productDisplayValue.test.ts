import {
  formatPaymentMethod,
  formatProductOptionValue,
  hasSizeMeasurements,
} from './productDisplayValue';

describe('product display values', () => {
  test('formats supported payment methods for customer-facing display', () => {
    expect(formatPaymentMethod('card')).toBe('카드 결제');
    expect(formatPaymentMethod('bank_transfer')).toBe('계좌이체');
  });

  test('formats known English product options while retaining unknown source values', () => {
    expect(formatProductOptionValue('yellow gold')).toBe('옐로우 골드');
    expect(formatProductOptionValue('blue')).toBe('블루');
    expect(formatProductOptionValue('limited edition')).toBe('limited edition');
  });

  test('uses a dash for missing values', () => {
    expect(formatPaymentMethod(undefined)).toBe('-');
    expect(formatProductOptionValue('unknown')).toBe('-');
    expect(formatProductOptionValue('')).toBe('-');
  });

  test('recognizes only sizes that include at least one measurement', () => {
    expect(hasSizeMeasurements({ M: {} })).toBe(false);
    expect(hasSizeMeasurements({ M: { chest: 52 } })).toBe(true);
  });
});
