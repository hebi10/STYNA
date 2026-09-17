const fs = require('fs');

function replaceExact(file, from, to, expectedCount = 1) {
  const source = fs.readFileSync(file, 'utf8');
  const count = source.split(from).length - 1;
  if (count !== expectedCount) {
    throw new Error(`${file}: expected ${expectedCount} occurrence(s), found ${count}: ${from}`);
  }
  fs.writeFileSync(file, source.split(from).join(to));
}

const checkoutTest = 'src/app/orders/checkout/page.test.tsx';
replaceExact(
  checkoutTest,
  "expect(await screen.findByRole('status')).toHaveTextContent('주문 정보를 불러올 수 없습니다');",
  "expect(await screen.findByRole('alert')).toHaveTextContent('주문 정보를 불러올 수 없습니다');",
);

const productDetailTest = 'src/app/products/_components/ProductDetailClient.test.tsx';
replaceExact(
  productDetailTest,
  "expect(screen.getByRole('button', { name: '리뷰 (0)' })).toBeInTheDocument();",
  "expect(screen.getByRole('tab', { name: '리뷰 (0)' })).toBeInTheDocument();",
);
replaceExact(
  productDetailTest,
  "expect(screen.queryByRole('button', { name: '리뷰 (13)' })).not.toBeInTheDocument();",
  "expect(screen.queryByRole('tab', { name: '리뷰 (13)' })).not.toBeInTheDocument();",
  2,
);
replaceExact(
  productDetailTest,
  "expect(screen.getByRole('button', { name: '리뷰 정보 확인 필요' })).toBeInTheDocument();",
  "expect(screen.getByRole('tab', { name: '리뷰 정보 확인 필요' })).toBeInTheDocument();",
);
replaceExact(
  productDetailTest,
  "fireEvent.click(screen.getByRole('button', { name: '사이즈 가이드' }));",
  "fireEvent.click(screen.getByRole('tab', { name: '사이즈 가이드' }));",
  2,
);
replaceExact(
  productDetailTest,
  "fireEvent.click(screen.getByRole('button', { name: 'Q&A' }));",
  "fireEvent.click(screen.getByRole('tab', { name: 'Q&A' }));",
);
replaceExact(
  productDetailTest,
  "expect(await screen.findByRole('alert')).toHaveTextContent('옵션을 다시 선택해 주세요.');",
  "expect(await screen.findByRole('status')).toHaveTextContent('옵션을 다시 선택해 주세요.');",
);

const cartTest = 'src/app/orders/cart/page.test.tsx';
replaceExact(
  cartTest,
  "    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => undefined);\n",
  '',
);
replaceExact(
  cartTest,
  "    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('쿠폰 없이 주문하려면'));",
  "    expect(screen.getByRole('alert')).toHaveTextContent('쿠폰 없이 주문하려면');",
);

const eventFormTest = 'src/app/admin/events/_components/EventForm.test.tsx';
replaceExact(
  eventFormTest,
  "    jest.spyOn(window, 'alert').mockImplementation(() => {});",
  "    jest.spyOn(window, 'dispatchEvent');",
);
replaceExact(
  eventFormTest,
  "    expect(window.alert).toHaveBeenCalledWith(\n      '구매 자격 이벤트에는 대상 상품 ID가 필요합니다.'\n    );",
  "    expect(window.dispatchEvent).toHaveBeenCalledWith(\n      expect.objectContaining({\n        type: 'styna:feedback',\n        detail: expect.objectContaining({\n          message: '구매 자격 이벤트에는 대상 상품 ID가 필요합니다.',\n        }),\n      }),\n    );",
  2,
);
replaceExact(
  eventFormTest,
  "    expect(window.alert).toHaveBeenCalledWith(\n      '쿠폰 보상에는 유효한 쿠폰 관리 문서 ID가 필요합니다.'\n    );",
  "    expect(window.dispatchEvent).toHaveBeenCalledWith(\n      expect.objectContaining({\n        type: 'styna:feedback',\n        detail: expect.objectContaining({\n          message: '쿠폰 보상에는 유효한 쿠폰 관리 문서 ID가 필요합니다.',\n        }),\n      }),\n    );",
);

console.log('Phase 4 test contracts migrated successfully.');
