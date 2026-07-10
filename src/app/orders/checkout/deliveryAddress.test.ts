import { buildCheckoutDeliveryAddresses } from './deliveryAddress';

describe('buildCheckoutDeliveryAddresses', () => {
  test('uses the saved profile address instead of generating a placeholder delivery address', () => {
    const addresses = buildCheckoutDeliveryAddresses({
      name: '홍길동',
      addresses: [{
        id: 'home',
        name: '집',
        recipient: '홍길동',
        phone: '010-0000-0000',
        address: '서울시 강남구',
        detailAddress: '101호',
        zipCode: '06234',
        isDefault: true,
      }],
    });

    expect(addresses[0]).toMatchObject({
      id: 'home',
      name: '집',
      recipient: '홍길동',
      phone: '010-0000-0000',
      address: '서울시 강남구',
      detailAddress: '101호',
      zipCode: '06234',
      isDefault: true,
    });
  });

  test('returns no delivery address until the user registers one', () => {
    expect(buildCheckoutDeliveryAddresses(null)).toEqual([]);
    expect(buildCheckoutDeliveryAddresses({ name: '테스트사용자' })).toEqual([]);
  });
});
