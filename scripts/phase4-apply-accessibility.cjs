const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function write(relativePath, source) {
  fs.writeFileSync(path.join(root, relativePath), source);
}

function mustReplace(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Missing expected source for ${label}`);
  }
  return source.replace(search, replacement);
}

function mustReplaceAll(source, search, replacement, expectedCount, label) {
  const parts = source.split(search);
  const actualCount = parts.length - 1;
  if (actualCount !== expectedCount) {
    throw new Error(`${label}: expected ${expectedCount}, got ${actualCount}`);
  }
  return parts.join(replacement);
}

// Product detail accessibility and inline validation.
{
  const file = 'src/app/products/_components/ProductDetailClient.tsx';
  let source = read(file);

  source = mustReplace(
    source,
    "import { useCallback, useEffect, useRef, useState } from 'react';",
    "import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';",
    'product detail keyboard event import',
  );

  source = mustReplace(
    source,
    "interface Props {\n  product: Product;\n}\n",
    "interface Props {\n  product: Product;\n}\n\ntype ProductDetailTab = 'detail' | 'size' | 'review' | 'qna';\nconst PRODUCT_DETAIL_TABS: ProductDetailTab[] = ['detail', 'size', 'review', 'qna'];\n",
    'product detail tab type',
  );

  source = mustReplace(
    source,
    "  const [activeTab, setActiveTab] = useState<'detail' | 'size' | 'review' | 'qna'>('detail');\n",
    "  const [activeTab, setActiveTab] = useState<ProductDetailTab>('detail');\n  const [optionError, setOptionError] = useState<string | null>(null);\n  const tabRefs = useRef<Record<ProductDetailTab, HTMLButtonElement | null>>({\n    detail: null,\n    size: null,\n    review: null,\n    qna: null,\n  });\n",
    'product detail state',
  );

  source = mustReplaceAll(
    source,
    "      publishFeedback('사이즈를 선택해주세요.');",
    "      setOptionError('사이즈를 선택해주세요.');",
    2,
    'size inline validation',
  );
  source = mustReplaceAll(
    source,
    "      publishFeedback('색상을 선택해주세요.');",
    "      setOptionError('색상을 선택해주세요.');",
    2,
    'color inline validation',
  );
  source = mustReplaceAll(
    source,
    "      publishFeedback('재고가 부족합니다.');",
    "      setOptionError('재고가 부족합니다.');",
    2,
    'stock inline validation',
  );

  source = mustReplaceAll(
    source,
    "    // 옵션 선택 확인 (사이즈나 색상이 있는 경우에만)\n",
    "    setOptionError(null);\n\n    // 옵션 선택 확인 (사이즈나 색상이 있는 경우에만)\n",
    2,
    'clear option error before purchase action',
  );

  source = mustReplace(
    source,
    "  const reviewLabel = reviewSummaryState.status === 'ready'\n    ? `리뷰 (${reviewSummaryState.summary?.totalReviews ?? 0})`\n    : reviewSummaryState.status === 'error' ? '리뷰 정보 확인 필요' : '리뷰 확인 중';\n",
    "  const reviewLabel = reviewSummaryState.status === 'ready'\n    ? `리뷰 (${reviewSummaryState.summary?.totalReviews ?? 0})`\n    : reviewSummaryState.status === 'error' ? '리뷰 정보 확인 필요' : '리뷰 확인 중';\n\n  const handleTabKeyDown = (\n    event: ReactKeyboardEvent<HTMLButtonElement>,\n    currentTab: ProductDetailTab,\n  ) => {\n    const currentIndex = PRODUCT_DETAIL_TABS.indexOf(currentTab);\n    let nextIndex = currentIndex;\n\n    if (event.key === 'ArrowRight') {\n      nextIndex = (currentIndex + 1) % PRODUCT_DETAIL_TABS.length;\n    } else if (event.key === 'ArrowLeft') {\n      nextIndex = (currentIndex - 1 + PRODUCT_DETAIL_TABS.length) % PRODUCT_DETAIL_TABS.length;\n    } else if (event.key === 'Home') {\n      nextIndex = 0;\n    } else if (event.key === 'End') {\n      nextIndex = PRODUCT_DETAIL_TABS.length - 1;\n    } else {\n      return;\n    }\n\n    event.preventDefault();\n    const nextTab = PRODUCT_DETAIL_TABS[nextIndex];\n    setActiveTab(nextTab);\n    tabRefs.current[nextTab]?.focus();\n  };\n",
    'tab keyboard handler',
  );

  source = mustReplace(
    source,
    "                      onClick={() => setSelectedSize(size)}\n                      disabled={!inStock}\n",
    "                      aria-pressed={selectedSize === size}\n                      onClick={() => {\n                        setSelectedSize(size);\n                        setOptionError(null);\n                      }}\n                      disabled={!inStock}\n",
    'size pressed state',
  );

  source = mustReplace(
    source,
    "                      onClick={() => setSelectedColor(color)}\n                      title={formatProductOptionValue(color)}\n                      aria-label={`${formatProductOptionValue(color)} 색상 선택`}\n",
    "                      aria-pressed={selectedColor === color}\n                      onClick={() => {\n                        setSelectedColor(color);\n                        setOptionError(null);\n                      }}\n                      title={formatProductOptionValue(color)}\n                      aria-label={`${formatProductOptionValue(color)} 색상 선택`}\n",
    'color pressed state',
  );

  source = mustReplace(
    source,
    "                  onClick={() => setQuantity(Math.max(1, quantity - 1))}\n                  disabled={!inStock}\n",
    "                  aria-label={`수량 ${quantity}개 감소`}\n                  onClick={() => setQuantity(Math.max(1, quantity - 1))}\n                  disabled={!inStock || quantity <= 1}\n",
    'quantity decrease semantics',
  );

  source = mustReplace(
    source,
    "                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}\n                  disabled={!inStock}\n",
    "                  aria-label={`수량 ${quantity}개 증가`}\n                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}\n                  disabled={!inStock || quantity >= product.stock}\n",
    'quantity increase semantics',
  );

  source = mustReplace(
    source,
    "          {resumeIntentFeedback && (\n            <p role=\"alert\">{resumeIntentFeedback}</p>\n          )}\n",
    "          {optionError && (\n            <p role=\"alert\">{optionError}</p>\n          )}\n          {resumeIntentFeedback && (\n            <p role=\"status\" aria-live=\"polite\">{resumeIntentFeedback}</p>\n          )}\n",
    'inline option error',
  );

  const oldTabs = `        <div className={styles.tabHeaders}>\n          <button\n            className={\`${'${styles.tabHeader} ${activeTab === \'detail\' ? styles.active : \'\'}'}\`}\n            onClick={() => setActiveTab('detail')}\n          >\n            상품상세\n          </button>\n          <button\n            className={\`${'${styles.tabHeader} ${activeTab === \'size\' ? styles.active : \'\'}'}\`}\n            onClick={() => setActiveTab('size')}\n          >\n            사이즈 가이드\n          </button>\n          <button\n            className={\`${'${styles.tabHeader} ${activeTab === \'review\' ? styles.active : \'\'}'}\`}\n            onClick={() => setActiveTab('review')}\n          >\n            {reviewLabel}\n          </button>\n          <button\n            className={\`${'${styles.tabHeader} ${activeTab === \'qna\' ? styles.active : \'\'}'}\`}\n            onClick={() => setActiveTab('qna')}\n          >\n            Q&A\n          </button>\n        </div>`;

  const newTabs = `        <div className={styles.tabHeaders} role="tablist" aria-label="상품 상세 정보">\n          <button\n            ref={(node) => { tabRefs.current.detail = node; }}\n            id="product-tab-detail"\n            role="tab"\n            aria-selected={activeTab === 'detail'}\n            aria-controls="product-panel-detail"\n            tabIndex={activeTab === 'detail' ? 0 : -1}\n            className={\`${'${styles.tabHeader} ${activeTab === \'detail\' ? styles.active : \'\'}'}\`}\n            onClick={() => setActiveTab('detail')}\n            onKeyDown={(event) => handleTabKeyDown(event, 'detail')}\n          >\n            상품상세\n          </button>\n          <button\n            ref={(node) => { tabRefs.current.size = node; }}\n            id="product-tab-size"\n            role="tab"\n            aria-selected={activeTab === 'size'}\n            aria-controls="product-panel-size"\n            tabIndex={activeTab === 'size' ? 0 : -1}\n            className={\`${'${styles.tabHeader} ${activeTab === \'size\' ? styles.active : \'\'}'}\`}\n            onClick={() => setActiveTab('size')}\n            onKeyDown={(event) => handleTabKeyDown(event, 'size')}\n          >\n            사이즈 가이드\n          </button>\n          <button\n            ref={(node) => { tabRefs.current.review = node; }}\n            id="product-tab-review"\n            role="tab"\n            aria-selected={activeTab === 'review'}\n            aria-controls="product-panel-review"\n            tabIndex={activeTab === 'review' ? 0 : -1}\n            className={\`${'${styles.tabHeader} ${activeTab === \'review\' ? styles.active : \'\'}'}\`}\n            onClick={() => setActiveTab('review')}\n            onKeyDown={(event) => handleTabKeyDown(event, 'review')}\n          >\n            {reviewLabel}\n          </button>\n          <button\n            ref={(node) => { tabRefs.current.qna = node; }}\n            id="product-tab-qna"\n            role="tab"\n            aria-selected={activeTab === 'qna'}\n            aria-controls="product-panel-qna"\n            tabIndex={activeTab === 'qna' ? 0 : -1}\n            className={\`${'${styles.tabHeader} ${activeTab === \'qna\' ? styles.active : \'\'}'}\`}\n            onClick={() => setActiveTab('qna')}\n            onKeyDown={(event) => handleTabKeyDown(event, 'qna')}\n          >\n            Q&A\n          </button>\n        </div>`;

  source = mustReplace(source, oldTabs, newTabs, 'tablist markup');

  source = mustReplace(
    source,
    "            <div className={styles.detailContent}>",
    "            <div\n              id=\"product-panel-detail\"\n              role=\"tabpanel\"\n              aria-labelledby=\"product-tab-detail\"\n              className={styles.detailContent}\n            >",
    'detail tabpanel',
  );
  source = mustReplace(
    source,
    "            <div className={styles.sizeGuide}>",
    "            <div\n              id=\"product-panel-size\"\n              role=\"tabpanel\"\n              aria-labelledby=\"product-tab-size\"\n              className={styles.sizeGuide}\n            >",
    'size tabpanel',
  );
  source = mustReplace(
    source,
    "          {activeTab === 'review' && (\n            <ProductReviews productId={product.id} />\n          )}",
    "          {activeTab === 'review' && (\n            <div id=\"product-panel-review\" role=\"tabpanel\" aria-labelledby=\"product-tab-review\">\n              <ProductReviews productId={product.id} />\n            </div>\n          )}",
    'review tabpanel',
  );
  source = mustReplace(
    source,
    "            <div className={styles.qnaContent}>",
    "            <div\n              id=\"product-panel-qna\"\n              role=\"tabpanel\"\n              aria-labelledby=\"product-tab-qna\"\n              className={styles.qnaContent}\n            >",
    'qna tabpanel',
  );

  // Success/error feedback is non-blocking; remove the follow-up confirm dialog.
  source = mustReplace(
    source,
    "      publishFeedback('장바구니에 추가되었습니다.');\n\n      if (confirm('장바구니로 이동하시겠습니까?')) {\n        router.push('/orders/cart');\n      }",
    "      publishFeedback({ message: '장바구니에 추가되었습니다.', tone: 'success' });",
    'cart success feedback',
  );
  source = source.replace(
    "publishFeedback('장바구니 추가에 실패했습니다. 다시 시도해주세요.');",
    "publishFeedback({ message: '장바구니 추가에 실패했습니다. 다시 시도해주세요.', tone: 'error' });",
  );

  write(file, source);
}

// Cart: shared async states and non-blocking validation feedback.
{
  const file = 'src/app/orders/cart/page.tsx';
  let source = read(file);

  source = mustReplace(
    source,
    "          <div className={styles.loading}>장바구니를 불러오는 중...</div>",
    "          <AsyncStatePanel\n            kind=\"loading\"\n            title=\"장바구니를 불러오는 중입니다.\"\n          />",
    'cart loading state',
  );

  source = mustReplace(
    source,
    "          <div className={styles.error}>\n            장바구니를 불러오는 중 오류가 발생했습니다.\n            <Button onClick={() => window.location.reload()}>다시 시도</Button>\n          </div>",
    "          <AsyncStatePanel\n            kind=\"error\"\n            title=\"장바구니를 불러오지 못했습니다\"\n            description=\"일시적인 연결 문제일 수 있습니다. 다시 시도해 주세요.\"\n            primaryAction={{ label: \"다시 시도\", onClick: () => window.location.reload() }}\n          />",
    'cart error state',
  );

  const emptyStart = "          <div className={styles.emptyCart}>\n            <div className={styles.emptyIcon}></div>\n            <h2 className={styles.emptyTitle}>주문할 상품이 없습니다</h2>\n            <p className={styles.emptyDescription}>\n              장바구니에서 상품을 선택하고 주문을 진행해주세요.\n            </p>\n            <Link href=\"/recommend\" className={styles.backButton}>\n              쇼핑 계속하기\n            </Link>\n          </div>";
  source = mustReplace(
    source,
    emptyStart,
    "          <AsyncStatePanel\n            kind=\"empty\"\n            title=\"장바구니가 비어 있습니다\"\n            description=\"상품을 담은 뒤 이곳에서 수량과 쿠폰을 확인할 수 있습니다.\"\n            primaryAction={{ label: \"쇼핑 계속하기\", href: \"/recommend\" }}\n          />",
    'cart empty state',
  );

  source = source.replace(/publishFeedback\(([^;]+)\);/g, (match, expression) => {
    if (/실패|오류|없습니다|확인하는 중|사용할 수 없습니다|충족하지 않습니다/.test(expression)) {
      return `publishFeedback({ message: ${expression}, tone: 'error' });`;
    }
    return match;
  });

  write(file, source);
}

// Checkout: shared loading/recovery state and error feedback.
{
  const file = 'src/app/orders/checkout/page.tsx';
  let source = read(file);

  source = mustReplace(
    source,
    'import PageHeader from "../../_components/PageHeader";\n',
    'import PageHeader from "../../_components/PageHeader";\nimport AsyncStatePanel from "../../_components/AsyncStatePanel";\n',
    'checkout async state import',
  );

  source = mustReplace(
    source,
    "  if (authLoading || !user) {\n    return <div>로그인 / 주문 정보 확인 중...</div>;\n  }",
    "  if (authLoading || !user) {\n    return (\n      <AsyncStatePanel\n        kind=\"loading\"\n        title=\"로그인과 주문 정보를 확인하고 있습니다.\"\n        headingLevel=\"h1\"\n      />\n    );\n  }",
    'checkout auth loading',
  );

  source = mustReplace(
    source,
    "          <div className={styles.recoveryPanel} role=\"status\" aria-live=\"polite\">\n            <h2 className={styles.recoveryTitle}>주문 정보를 불러올 수 없습니다</h2>\n            <p className={styles.recoveryDescription}>\n              장바구니에서 주문할 상품을 다시 선택하면 결제를 이어갈 수 있습니다.\n            </p>\n            <Link href=\"/orders/cart\" className={styles.recoveryButton}>\n              장바구니로 돌아가기\n            </Link>\n          </div>",
    "          <AsyncStatePanel\n            kind=\"error\"\n            title=\"주문 정보를 불러올 수 없습니다\"\n            description=\"장바구니에서 주문할 상품을 다시 선택하면 결제를 이어갈 수 있습니다.\"\n            primaryAction={{ label: \"장바구니로 돌아가기\", href: \"/orders/cart\" }}\n          />",
    'checkout recovery state',
  );

  source = mustReplace(
    source,
    "  if (!orderData) {\n    return <div>주문 정보 확인 중...</div>;\n  }",
    "  if (!orderData) {\n    return (\n      <AsyncStatePanel\n        kind=\"loading\"\n        title=\"주문 정보를 확인하고 있습니다.\"\n        headingLevel=\"h1\"\n      />\n    );\n  }",
    'checkout draft loading',
  );

  source = source.replace(/publishFeedback\(([^;]+)\);/g, (match, expression) => {
    if (/실패|없습니다|선택해주세요|입력해주세요|사용할 수 없습니다/.test(expression)) {
      return `publishFeedback({ message: ${expression}, tone: 'error' });`;
    }
    return match;
  });

  write(file, source);
}

console.log('Phase 4 accessibility migration applied.');
