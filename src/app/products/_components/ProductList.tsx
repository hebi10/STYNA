'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { Product, ProductSort } from '@/shared/types/product';
import { ProductQueryInput, ProductService } from '@/shared/services/productService';
import { getDefaultCategoryNames } from '@/shared/utils/categoryUtils';
import ProductCard from './ProductCard';
import styles from './ProductList.module.css';

const ITEMS_PER_PAGE = 12;
const DEFAULT_PRICE_MAX = 1_000_000;
const categoryNames = getDefaultCategoryNames();

type PageCursor = QueryDocumentSnapshot<DocumentData> | null;

const sortOptions: Array<{ value: string; label: string }> = [
  { value: 'createdAt-desc', label: '최신순' },
  { value: 'price-asc', label: '낮은 가격순' },
  { value: 'price-desc', label: '높은 가격순' },
  { value: 'rating-desc', label: '평점 높은순' },
  { value: 'name-asc', label: '이름순' },
];

export default function ProductList() {
  const [items, setItems] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<ProductSort>({ field: 'createdAt', order: 'desc' });
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(DEFAULT_PRICE_MAX);
  const [minPriceInput, setMinPriceInput] = useState(0);
  const [maxPriceInput, setMaxPriceInput] = useState(DEFAULT_PRICE_MAX);

  const [currentPage, setCurrentPage] = useState(1);
  const [cursorStack, setCursorStack] = useState<Record<number, PageCursor>>({ 1: null });
  const [hasMoreByPage, setHasMoreByPage] = useState<Record<number, boolean>>({});
  const [cacheByPage, setCacheByPage] = useState<Record<number, Product[]>>({});

  const queryInput = useMemo(
    (): ProductQueryInput => ({
      category: category || undefined,
      keyword: searchKeyword || undefined,
      status: 'active',
      minPrice: minPrice > 0 ? minPrice : undefined,
      maxPrice: maxPrice < DEFAULT_PRICE_MAX ? maxPrice : undefined,
      sort,
      limitCount: ITEMS_PER_PAGE,
    }),
    [category, searchKeyword, minPrice, maxPrice, sort]
  );

  const resetPagination = useCallback(() => {
    setCurrentPage(1);
    setCursorStack({ 1: null });
    setHasMoreByPage({});
    setCacheByPage({});
  }, []);

  const loadPage = useCallback(async (page: number, forceLoad = false) => {
    if (page < 1) {
      return;
    }

    const cached = cacheByPage[page];
    if (!forceLoad && cached) {
      setItems(cached);
      setCurrentPage(page);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const startAfterDoc = page === 1 ? null : cursorStack[page] || null;
      const result = await ProductService.queryProducts({
        ...queryInput,
        startAfterDoc,
      });

      setItems(result.items);
      setCurrentPage(page);
      setHasMoreByPage((prev) => ({ ...prev, [page]: result.hasMore }));
      setCacheByPage((prev) => ({ ...prev, [page]: result.items }));

      if (result.nextCursor) {
        setCursorStack((prev) => ({ ...prev, [page + 1]: result.nextCursor || null }));
      } else {
        setCursorStack((prev) => ({ ...prev, [page + 1]: null }));
      }
    } catch (err) {
      console.error('상품 목록 조회 실패:', err);
      setError(err instanceof Error ? err.message : '상품 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [cacheByPage, cursorStack, queryInput]);

  const loadCategories = useCallback(async () => {
    try {
      const categoryList = await ProductService.getCategories();
      setCategories(categoryList);
    } catch {
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    let isActive = true;

    resetPagination();

    const loadFirstPage = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await ProductService.queryProducts({
          ...queryInput,
          startAfterDoc: null,
        });

        if (!isActive) return;

        setItems(result.items);
        setCurrentPage(1);
        setHasMoreByPage({ 1: result.hasMore });
        setCacheByPage({ 1: result.items });
        setCursorStack({ 1: null, 2: result.nextCursor || null });
      } catch (err) {
        if (!isActive) return;
        console.error('상품 목록 조회 실패:', err);
        setError(err instanceof Error ? err.message : '상품 목록을 불러오지 못했습니다.');
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    void loadFirstPage();

    return () => {
      isActive = false;
    };
  }, [queryInput, resetPagination]);

  const handleSearch = () => {
    setSearchKeyword(searchInput.trim());
  };

  const handleSortChange = (value: string) => {
    const [field, order] = value.split('-') as [ProductSort['field'], ProductSort['order']];
    setSort({ field, order });
  };

  const applyPriceFilter = () => {
    const nextMin = Math.max(0, Number.isFinite(minPriceInput) ? minPriceInput : 0);
    const nextMax = Math.max(nextMin, Number.isFinite(maxPriceInput) ? maxPriceInput : DEFAULT_PRICE_MAX);
    setMinPrice(nextMin);
    setMaxPrice(nextMax);
    setMinPriceInput(nextMin);
    setMaxPriceInput(nextMax);
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearchKeyword('');
    setCategory('');
    setSort({ field: 'createdAt', order: 'desc' });
    setMinPrice(0);
    setMaxPrice(DEFAULT_PRICE_MAX);
    setMinPriceInput(0);
    setMaxPriceInput(DEFAULT_PRICE_MAX);
  };

  const moveToPreviousPage = () => {
    if (currentPage > 1) {
      void loadPage(currentPage - 1);
    }
  };

  const moveToNextPage = () => {
    if (hasMoreByPage[currentPage]) {
      void loadPage(currentPage + 1);
    }
  };

  const resultCountText = items.length === 0
    ? '검색 결과가 없습니다.'
    : `총 ${items.length}개 상품`;

  if (loading && currentPage === 1 && items.length === 0) {
    return (
      <div className={styles.loading} role="status" aria-live="polite">
        <div className={styles.spinner}></div>
        <p>상품 목록을 불러오는 중입니다...</p>
        <div className={styles.loadingGrid}>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className={styles.loadingCard} aria-label="상품 목록 로딩 카드">
              <span className={styles.loadingImage} />
              <span className={styles.loadingLine} />
              <span className={styles.loadingLineShort} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <p>상품 목록 로딩 실패: {error}</p>
        <button onClick={() => void loadPage(1, true)} className={styles.retryButton} type="button">
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.stats}>
        <div className={styles.statItem}>
          <div className={styles.statNumber}>{items.length}</div>
          <div className={styles.statLabel}>현재 페이지 상품</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statNumber}>{items.filter((product) => product.isNew).length}</div>
          <div className={styles.statLabel}>신상품</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statNumber}>{items.filter((product) => product.isSale).length}</div>
          <div className={styles.statLabel}>세일</div>
        </div>
      </div>

      <div className={styles.controls}>
        <div className={styles.searchSection}>
          <input
            type="text"
            aria-label="상품명 검색"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
            placeholder="상품명 검색"
            className={styles.searchInput}
          />
          <button onClick={handleSearch} className={styles.searchButton} type="button">
            검색
          </button>
        </div>

        <div className={styles.filters}>
          <select aria-label="카테고리 필터" value={category} onChange={(event) => setCategory(event.target.value)} className={styles.filterSelect}>
            <option value="">전체 카테고리</option>
            {categories.map((categoryId) => (
              <option key={categoryId} value={categoryId}>
                {categoryNames[categoryId] || categoryId}
              </option>
            ))}
          </select>

          <select aria-label="정렬 기준" value={`${sort.field}-${sort.order}`} onChange={(event) => handleSortChange(event.target.value)} className={styles.sortSelect}>
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button onClick={clearFilters} className={styles.clearButton} type="button">
            필터 초기화
          </button>
        </div>
      </div>

      <div className={styles.priceFilter}>
        <label>가격</label>
        <input
          type="number"
          aria-label="최소 가격"
          value={minPriceInput}
          onChange={(event) => setMinPriceInput(Number(event.target.value))}
          className={styles.priceInput}
        />
        <span>~</span>
        <input
          type="number"
          aria-label="최대 가격"
          value={maxPriceInput}
          onChange={(event) => setMaxPriceInput(Number(event.target.value))}
          className={styles.priceInput}
        />
        <button onClick={applyPriceFilter} className={styles.applyButton} type="button">
          적용
        </button>
      </div>

      <div className={styles.productGrid}>
        {items.map((product) => (
          <ProductCard
            key={product.id}
            id={product.id}
            name={product.name}
            brand={product.brand}
            price={product.price}
            originalPrice={product.originalPrice}
            isNew={product.isNew}
            isSale={product.isSale}
            saleRate={product.saleRate}
            rating={product.rating}
            reviewCount={product.reviewCount}
            image={product.mainImage || product.images[0]}
            stock={product.stock}
          />
        ))}
      </div>

      {items.length === 0 && (
        <div className={styles.emptyState}>
          <p>조건에 맞는 상품이 없습니다.</p>
          <button onClick={clearFilters} className={styles.clearButton} type="button">
            조건 초기화
          </button>
        </div>
      )}

      <div className={styles.pagination}>
        <button className={styles.pageButton} onClick={moveToPreviousPage} disabled={currentPage === 1} type="button">
          이전
        </button>
        <span>{`페이지 ${currentPage}`}</span>
        <button className={styles.pageButton} onClick={moveToNextPage} disabled={!hasMoreByPage[currentPage]} type="button">
          다음
        </button>
      </div>

      <div className={styles.resultInfo} aria-live="polite">
        <span>{resultCountText}</span>
      </div>
    </div>
  );
}
