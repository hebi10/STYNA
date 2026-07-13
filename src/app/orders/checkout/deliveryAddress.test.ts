import {
  buildCheckoutDeliveryAddresses,
  createManualDeliveryAddress,
  validateManualDeliveryAddress,
} from './deliveryAddress';

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

  test('validates required manual delivery address fields and phone format', () => {
    expect(validateManualDeliveryAddress({
      name: '',
      recipient: '',
      phone: '02-123-4567',
      address: '',
      detailAddress: '',
      zipCode: '',
    })).toEqual({
      name: '배송지명을 입력해주세요.',
      recipient: '받는 분을 입력해주세요.',
      phone: '올바른 휴대전화 번호를 입력해주세요.',
      address: '주소를 입력해주세요.',
      zipCode: '우편번호를 입력해주세요.',
    });
  });

  test('creates a normalized manual delivery address', () => {
    expect(createManualDeliveryAddress({
      name: ' 집 ',
      recipient: ' 홍길동 ',
      phone: ' 010-1234-5678 ',
      address: ' 서울시 강남구 ',
      detailAddress: ' 101호 ',
      zipCode: ' 06234 ',
    }, 'checkout-address-1', true)).toEqual({
      id: 'checkout-address-1',
      name: '집',
      recipient: '홍길동',
      phone: '010-1234-5678',
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
