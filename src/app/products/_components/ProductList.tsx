'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Product, ProductSort } from '@/shared/types/product';
import {
  normalizeProductSearchTerm,
  ProductPageCursor,
  ProductQueryInput,
  ProductService,
} from '@/shared/services/productService';
import { useCategoriesWithNames } from '@/shared/hooks/useProducts';
import ProductCard from './ProductCard';
import styles from './ProductList.module.css';

const ITEMS_PER_PAGE = 12;
const DEFAULT_PRICE_MAX = 1_000_000;
type PageCursor = ProductPageCursor | null;

interface ProductListProps {
  initialCategory?: string;
  lockCategory?: boolean;
}

function parsePriceParam(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseSortParam(value: string | null): ProductSort {
  const option = sortOptions.find((item) => item.value === value);
  if (!option) return { field: 'createdAt', order: 'desc' };
  const [field, order] = option.value.split('-') as [ProductSort['field'], ProductSort['order']];
  return { field, order };
}

const sortOptions: Array<{ value: string; label: string }> = [
  { value: 'createdAt-desc', label: '최신순' },
  { value: 'price-asc', label: '낮은 가격순' },
  { value: 'price-desc', label: '높은 가격순' },
  { value: 'rating-desc', label: '평점 높은순' },
  { value: 'name-asc', label: '이름순' },
];

export default function ProductList({ initialCategory = '', lockCategory = false }: ProductListProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: categories = [] } = useCategoriesWithNames();
  const currentUrlQuery = searchParams?.toString() || '';
  const initialSearchKeyword = normalizeProductSearchTerm(searchParams?.get('q') || '');
  const initialMinPrice = parsePriceParam(searchParams?.get('minPrice') || null, 0);
  const initialMaxPrice = Math.max(
    initialMinPrice,
    parsePriceParam(searchParams?.get('maxPrice') || null, DEFAULT_PRICE_MAX),
  );
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState(initialSearchKeyword);
  const [searchKeyword, setSearchKeyword] = useState(initialSearchKeyword);
  const [category, setCategory] = useState(
    initialCategory || searchParams?.get('category') || '',
  );
  const [sort, setSort] = useState<ProductSort>(() => parseSortParam(searchParams?.get('sort') || null));
  const [minPrice, setMinPrice] = useState(initialMinPrice);
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice);
  const [minPriceInput, setMinPriceInput] = useState(initialMinPrice);
  const [maxPriceInput, setMaxPriceInput] = useState(initialMaxPrice);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [cursorStack, setCursorStack] = useState<Record<number, PageCursor>>({ 1: null });
  const [hasMoreByPage, setHasMoreByPage] = useState<Record<number, boolean>>({});
  const [cacheByPage, setCacheByPage] = useState<Record<number, Product[]>>({});
  const requestGenerationRef = useRef(0);
  const lastObservedUrlQueryRef = useRef(currentUrlQuery);
  const pendingUrlQueryRef = useRef<string | null>(null);
  const restoringFromUrlRef = useRef(false);

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
  const querySignature = useMemo(
    () => JSON.stringify(queryInput),
    [queryInput],
  );
  const activeQuerySignatureRef = useRef(querySignature);

  useEffect(() => {
    activeQuerySignatureRef.current = querySignature;
  }, [querySignature]);

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

    const requestGeneration = ++requestGenerationRef.current;
    const requestSignature = querySignature;
    if (forceLoad && page === 1) {
      setCursorStack({ 1: null });
      setHasMoreByPage({});
      setCacheByPage({});
    }
    const cached = cacheByPage[page];
    if (!forceLoad && cached) {
      setItems(cached);
      setCurrentPage(page);
      setError(null);
      setLoading(false);
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

      if (
        requestGenerationRef.current !== requestGeneration ||
        activeQuerySignatureRef.current !== requestSignature
      ) {
        return;
      }

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
      if (
        requestGenerationRef.current !== requestGeneration ||
        activeQuerySignatureRef.current !== requestSignature
      ) {
        return;
      }
      console.error('상품 목록 조회 실패:', err);
      setError(err instanceof Error ? err.message : '상품 목록을 불러오지 못했습니다.');
    } finally {
      if (
        requestGenerationRef.current === requestGeneration &&
        activeQuerySignatureRef.current === requestSignature
      ) {
        setLoading(false);
      }
    }
  }, [cacheByPage, cursorStack, queryInput, querySignature]);

  useEffect(() => {
    if (lastObservedUrlQueryRef.current === currentUrlQuery) {
      return;
    }

    lastObservedUrlQueryRef.current = currentUrlQuery;
    if (pendingUrlQueryRef.current === currentUrlQuery) {
      pendingUrlQueryRef.current = null;
      return;
    }
    pendingUrlQueryRef.current = null;
    restoringFromUrlRef.current = true;

    const nextParams = new URLSearchParams(currentUrlQuery);
    const nextSearchKeyword = normalizeProductSearchTerm(nextParams.get('q') || '');
    const nextMinPrice = parsePriceParam(nextParams.get('minPrice'), 0);
    const nextMaxPrice = Math.max(
      nextMinPrice,
      parsePriceParam(nextParams.get('maxPrice'), DEFAULT_PRICE_MAX),
    );

    setSearchInput(nextSearchKeyword);
    setSearchKeyword(nextSearchKeyword);
    setCategory(lockCategory ? initialCategory : nextParams.get('category') || '');
    setSort(parseSortParam(nextParams.get('sort')));
    setMinPrice(nextMinPrice);
    setMaxPrice(nextMaxPrice);
    setMinPriceInput(nextMinPrice);
    setMaxPriceInput(nextMaxPrice);
    resetPagination();
  }, [currentUrlQuery, initialCategory, lockCategory, resetPagination]);

  useEffect(() => {
    if (restoringFromUrlRef.current) {
      restoringFromUrlRef.current = false;
      return;
    }

    const nextParams = new URLSearchParams(currentUrlQuery);
    const setOrDelete = (key: string, value: string, shouldKeep: boolean) => {
      if (shouldKeep) nextParams.set(key, value);
      else nextParams.delete(key);
    };

    setOrDelete('q', searchKeyword, Boolean(searchKeyword));
    setOrDelete('category', category, !lockCategory && Boolean(category));
    const sortValue = `${sort.field}-${sort.order}`;
    setOrDelete('sort', sortValue, sortValue !== 'createdAt-desc');
    setOrDelete('minPrice', String(minPrice), minPrice > 0);
    setOrDelete('maxPrice', String(maxPrice), maxPrice < DEFAULT_PRICE_MAX);

    const nextQuery = nextParams.toString();
    if (nextQuery !== currentUrlQuery) {
      pendingUrlQueryRef.current = nextQuery;
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    }
  }, [category, currentUrlQuery, lockCategory, maxPrice, minPrice, pathname, router, searchKeyword, sort]);

  useEffect(() => {
    let isActive = true;
    const requestGeneration = ++requestGenerationRef.current;
    const requestSignature = querySignature;

    resetPagination();
    setItems([]);

    const loadFirstPage = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await ProductService.queryProducts({
          ...queryInput,
          startAfterDoc: null,
        });

        if (
          !isActive ||
          requestGenerationRef.current !== requestGeneration ||
          activeQuerySignatureRef.current !== requestSignature
        ) return;

        setItems(result.items);
        setCurrentPage(1);
        setHasMoreByPage({ 1: result.hasMore });
        setCacheByPage({ 1: result.items });
        setCursorStack({ 1: null, 2: result.nextCursor || null });
      } catch (err) {
        if (
          !isActive ||
          requestGenerationRef.current !== requestGeneration ||
          activeQuerySignatureRef.current !== requestSignature
        ) return;
        console.error('상품 목록 조회 실패:', err);
        setError(err instanceof Error ? err.message : '상품 목록을 불러오지 못했습니다.');
      } finally {
        if (
          isActive &&
          requestGenerationRef.current === requestGeneration &&
          activeQuerySignatureRef.current === requestSignature
        ) {
          setLoading(false);
        }
      }
    };

    void loadFirstPage();

    return () => {
      isActive = false;
    };
  }, [queryInput, querySignature, resetPagination]);

  const handleSearch = () => {
    const normalizedSearch = normalizeProductSearchTerm(searchInput);
    setSearchInput(normalizedSearch);
    setSearchKeyword(normalizedSearch);
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
    setCategory(lockCategory ? initialCategory : '');
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
    : `현재 페이지 ${items.length}개 상품`;

  if (loading && currentPage === 1 && items.length === 0) {
    return (
      <div className={styles.loading} role="status" aria-live="polite" aria-busy="true">
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
    <div className={styles.container} aria-busy={loading}>
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

        <button
          className={styles.filterToggle}
          type="button"
          aria-expanded={isFiltersOpen}
          aria-controls="product-filter-panel"
          onClick={() => setIsFiltersOpen((isOpen) => !isOpen)}
        >
          {isFiltersOpen ? '상품 필터 닫기' : '상품 필터 열기'}
        </button>

        <div
          id="product-filter-panel"
          className={`${styles.filterPanel} ${isFiltersOpen ? styles.filterPanelOpen : ''}`}
          role="region"
          aria-label="상품 필터"
        >
          <div className={styles.filters}>
            {!lockCategory ? (
              <select aria-label="카테고리 필터" value={category} onChange={(event) => setCategory(event.target.value)} className={styles.filterSelect}>
                <option value="">전체 카테고리</option>
                {categories.map((categoryOption) => (
                  <option key={categoryOption.id} value={categoryOption.id}>
                    {categoryOption.name}
                  </option>
                ))}
              </select>
            ) : null}

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
        </div>
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
