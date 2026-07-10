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
