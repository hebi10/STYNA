export interface DeliveryAddress {
  id: string;
  name: string;
  recipient: string;
  phone: string;
  address: string;
  detailAddress: string;
  zipCode: string;
  isDefault: boolean;
}

export interface ManualDeliveryAddressInput {
  name: string;
  recipient: string;
  phone: string;
  address: string;
  detailAddress: string;
  zipCode: string;
}

export type ManualDeliveryAddressErrors = Partial<Record<keyof ManualDeliveryAddressInput, string>>;

interface CheckoutUserProfile {
  name?: string | null;
  addresses?: unknown;
  address?: unknown;
}

function normalizeAddress(value: unknown): DeliveryAddress | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const address = value as Partial<DeliveryAddress>;
  if (
    !address.id || !address.name || !address.recipient || !address.phone ||
    !address.address || !address.zipCode
  ) {
    return null;
  }

  return {
    id: address.id,
    name: address.name,
    recipient: address.recipient,
    phone: address.phone,
    address: address.address,
    detailAddress: address.detailAddress || '',
    zipCode: address.zipCode,
    isDefault: address.isDefault === true,
  };
}

export function validateManualDeliveryAddress(
  input: ManualDeliveryAddressInput
): ManualDeliveryAddressErrors {
  const errors: ManualDeliveryAddressErrors = {};

  if (!input.name.trim()) {
    errors.name = '배송지명을 입력해주세요.';
  }
  if (!input.recipient.trim()) {
    errors.recipient = '받는 분을 입력해주세요.';
  }
  if (!input.phone.trim()) {
    errors.phone = '연락처를 입력해주세요.';
  } else if (!/^01[0-9]-?[0-9]{4}-?[0-9]{4}$/.test(input.phone.trim())) {
    errors.phone = '올바른 휴대전화 번호를 입력해주세요.';
  }
  if (!input.address.trim()) {
    errors.address = '주소를 입력해주세요.';
  }
  if (!input.zipCode.trim()) {
    errors.zipCode = '우편번호를 입력해주세요.';
  }

  return errors;
}

export function createManualDeliveryAddress(
  input: ManualDeliveryAddressInput,
  id: string,
  isDefault: boolean
): DeliveryAddress {
  return {
    id,
    name: input.name.trim(),
    recipient: input.recipient.trim(),
    phone: input.phone.trim(),
    address: input.address.trim(),
    detailAddress: input.detailAddress.trim(),
    zipCode: input.zipCode.trim(),
    isDefault,
  };
}

export function buildCheckoutDeliveryAddresses(
  userData: CheckoutUserProfile | null | undefined
): DeliveryAddress[] {
  const addressList = Array.isArray(userData?.addresses)
    ? userData.addresses.map(normalizeAddress).filter((address): address is DeliveryAddress => Boolean(address))
    : [];
  const legacyAddress = normalizeAddress(userData?.address);

  return legacyAddress && !addressList.some((address) => address.id === legacyAddress.id)
    ? [legacyAddress, ...addressList]
    : addressList;
}
