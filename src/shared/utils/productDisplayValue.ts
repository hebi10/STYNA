import type { Product } from '@/shared/types/product';
import type { PaymentMethod } from '@/shared/types/order';

const PAYMENT_METHOD_LABELS: Partial<Record<PaymentMethod, string>> = {
  card: '카드 결제',
  '카드결제': '카드 결제',
  bank_transfer: '계좌이체',
  '계좌이체': '계좌이체',
  virtual_account: '무통장입금',
  '무통장입금': '무통장입금',
  phone: '휴대폰 결제',
  point: '포인트 결제',
  기타: '기타',
};

const PRODUCT_OPTION_LABELS: Record<string, string> = {
  black: '블랙',
  white: '화이트',
  blue: '블루',
  red: '레드',
  green: '그린',
  yellow: '옐로우',
  purple: '퍼플',
  pink: '핑크',
  orange: '오렌지',
  gray: '그레이',
  grey: '그레이',
  navy: '네이비',
  beige: '베이지',
  brown: '브라운',
  silver: '실버',
  gold: '골드',
  'white gold': '화이트 골드',
  'yellow gold': '옐로우 골드',
  'rose gold': '로즈 골드',
  cotton: '코튼',
  polyester: '폴리에스터',
  nylon: '나일론',
  spandex: '스판덱스',
  leather: '가죽',
};

function formatMappedValue(value: string | null | undefined, labels: Record<string, string>): string {
  const normalizedValue = value?.trim();

  if (!normalizedValue || normalizedValue.toLowerCase() === 'unknown') {
    return '-';
  }

  return labels[normalizedValue.toLowerCase()] ?? normalizedValue;
}

export function formatPaymentMethod(value: PaymentMethod | string | null | undefined): string {
  return formatMappedValue(value, PAYMENT_METHOD_LABELS);
}

export function formatProductOptionValue(value: string | null | undefined): string {
  return formatMappedValue(value, PRODUCT_OPTION_LABELS);
}

export function hasSizeMeasurements(
  sizes: Product['details']['sizes'] | null | undefined,
): boolean {
  return Object.values(sizes ?? {}).some((measurements) =>
    Object.values(measurements).some((value) => typeof value === 'number' && Number.isFinite(value)),
  );
}
