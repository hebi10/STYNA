'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { useSearchParams, useRouter } from 'next/navigation';
import PageHeader from '../_components/PageHeader';
import ProductCard from '@/app/products/_components/ProductCard';
import { Product, ProductFilter, ProductSort } from '@/shared/types/product';
import { ProductQueryInput, ProductService } from '@/shared/services/productService';
import styles from './page.module.css';

interface SearchState {
  query: string;
  committedQuery: string;
  filters: ProductFilter;
  sortBy: ProductSort;
  currentPage: number;
  results: Product[];
  loading: boolean;
  hasSearched: boolean;
  error: string | null;
}

type SearchCursor = QueryDocumentSnapshot<DocumentData> | null;

const ITEMS_PER_PAGE = 20;

const sortOptions: Array<{ value: string; label: string }> = [
  { value: 'name-asc', label: '이름순' },
  { value: 'createdAt-desc', label: '최신순' },
  { value: 'price-asc', label: '낮은 가격순' },
  { value: 'price-desc', label: '높은 가격순' },
  { value: 'rating-desc', label: '평점 높은순' },
];

const popularSearchTerms = ['원피스', '가방', '탑', '신발', '아우터', '후드'];

export default function SearchClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [state, setState] = useState<SearchState>({
    query: '',
    committedQuery: '',
    filters: {},
    sortBy: { field: 'createdAt', order: 'desc' },
    currentPage: 1,
    results: [],
    loading: false,
    hasSearched: false,
    error: null,
  });

  const [cursorByPage, setCursorByPage] = useState<Record<number, SearchCursor>>({ 1: null });
  const [cacheByPage, setCacheByPage] = useState<Record<number, Product[]>>({});
  const [hasMoreByPage, setHasMoreByPage] = useState<Record<number, boolean>>({});
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  const queryInput = useMemo((): ProductQueryInput => ({
    keyword: state.committedQuery,
    category: state.filters.category,
    brand: state.filters.brand,
    minPrice: state.filters.minPrice,
    maxPrice: state.filters.maxPrice,
    minRating: state.filters.rating,
    isNew: state.filters.isNew,
    isSale: state.filters.isSale,
    status: 'active',
    sort: state.sortBy,
    limitCount: ITEMS_PER_PAGE,
  }), [state.committedQuery, state.filters, state.sortBy]);

  const resetPaging = useCallback(() => {
    setState((prev) => ({ ...prev, currentPage: 1, results: [] }));
    setCursorByPage({ 1: null });
    setCacheByPage({});
    setHasMoreByPage({});
  }, []);

  const loadPage = useCallback(async (page: number, forceReload = false) => {
    if (!state.committedQuery) {
      return;
    }

    const cached = !forceReload ? cacheByPage[page] : undefined;
    if (cached) {
      setState((prev) => ({ ...prev, results: cached, currentPage: page }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const startAfterDoc = cursorByPage[page] || null;
      const result = await ProductService.queryProducts({
        ...queryInput,
        startAfterDoc,
      });

      setState((prev) => ({ ...prev, results: result.items, currentPage: page }));
      setCacheByPage((prev) => ({ ...prev, [page]: result.items }));
      setHasMoreByPage((prev) => ({ ...prev, [page]: result.hasMore }));

      if (result.nextCursor) {
        setCursorByPage((prev) => ({ ...prev, [page + 1]: result.nextCursor as SearchCursor }));
      } else {
        setCursorByPage((prev) => ({ ...prev, [page + 1]: null }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : '검색 결과를 불러오지 못했습니다.',
      }));
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [cacheByPage, cursorByPage, queryInput, state.committedQuery]);

  const submitSearch = useCallback((nextQuery: string) => {
    const trimmed = nextQuery.trim();
    setState((prev) => ({
      ...prev,
      query: trimmed,
      committedQuery: trimmed,
      hasSearched: Boolean(trimmed),
    }));
    resetPaging();

    if (trimmed) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push('/search');
    }
  }, [resetPaging, router]);

  const updateFilters = useCallback((filters: ProductFilter) => {
    setState((prev) => ({ ...prev, filters }));
    resetPaging();
  }, [resetPaging]);

  const updateSort = useCallback((sortBy: ProductSort) => {
    setState((prev) => ({ ...prev, sortBy }));
    resetPaging();
  }, [resetPaging]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categories = await ProductService.getCategories();
        setAvailableCategories(categories);
      } catch {
        setAvailableCategories([]);
      }
    };

    void loadCategories();
  }, []);

  useEffect(() => {
    const nextQuery = searchParams?.get('q')?.trim() || '';

    if (nextQuery !== state.committedQuery) {
      setState((prev) => ({
        ...prev,
        query: nextQuery,
        committedQuery: nextQuery,
        hasSearched: Boolean(nextQuery),
      }));
      resetPaging();
    }
  }, [searchParams, state.committedQuery, resetPaging]);

  useEffect(() => {
    if (!state.committedQuery) {
      setState((prev) => ({ ...prev, hasSearched: false, results: [], loading: false }));
      return;
    }

    let isActive = true;

    const loadFirstPage = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const result = await ProductService.queryProducts({
          ...queryInput,
          startAfterDoc: null,
        });

        if (!isActive) return;

        setState((prev) => ({ ...prev, results: result.items, currentPage: 1 }));
        setCacheByPage({ 1: result.items });
        setHasMoreByPage({ 1: result.hasMore });
        setCursorByPage({ 1: null, 2: result.nextCursor as SearchCursor });
      } catch (error) {
        if (!isActive) return;
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : '검색 결과를 불러오지 못했습니다.',
        }));
      } finally {
        if (isActive) {
          setState((prev) => ({ ...prev, loading: false }));
        }
      }
    };

    void loadFirstPage();

    return () => {
      isActive = false;
    };
  }, [state.committedQuery, state.filters, state.sortBy, queryInput]);

  const handleSortChange = useCallback((value: string) => {
    const [field, order] = value.split('-') as [ProductSort['field'], ProductSort['order']];
    updateSort({ field, order });
  }, [updateSort]);

  const handleFormSubmit = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitSearch(state.query);
  }, [state.query, submitSearch]);

  const handleSearchInput = useCallback((value: string) => {
    setState((prev) => ({ ...prev, query: value }));
  }, []);

  const handlePreviousPage = () => {
    if (state.currentPage > 1 && state.committedQuery) {
      void loadPage(state.currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (state.committedQuery && hasMoreByPage[state.currentPage]) {
      void loadPage(state.currentPage + 1);
    }
  };

  const start = (state.currentPage - 1) * ITEMS_PER_PAGE + 1;
  const end = start + state.results.length - 1;

  return (
    <div className={styles.container}>
      <PageHeader title="상품 검색" />

      <div className={styles.content}>
        <div className={styles.searchHeader}>
          <form onSubmit={handleFormSubmit} className={styles.searchInputWrapper}>
            <input
              type="text"
              aria-label="상품 검색어"
              value={state.query}
              onChange={(event) => handleSearchInput(event.target.value)}
              placeholder="상품명을 입력해 검색하세요"
              className={styles.searchInput}
            />
            <button type="submit" disabled={state.loading} className={styles.searchButton}>
              {state.loading ? '검색중...' : '검색'}
            </button>
          </form>
        </div>

        {!state.hasSearched && (
          <div className={styles.initialState}>
            <div className={styles.searchTip}>
              <h3>인기 검색어</h3>
              <div className={styles.popularSearchTags}>
                {popularSearchTerms.map((term) => (
                  <button key={term} type="button" className={styles.popularTag} onClick={() => submitSearch(term)}>
                    {term}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {state.hasSearched && (
          <div className={styles.resultsSection}>
            <div className={styles.resultsHeader}>
              <div className={styles.resultsInfo}>
                <h2 className={styles.resultsTitle}>{`'${state.committedQuery}' 검색 결과`}</h2>
                <p className={styles.resultsCount}>{`총 ${state.results.length}개`}</p>
              </div>

              <div className={styles.controlsWrapper}>
                <select
                  aria-label="정렬 기준"
                  value={`${state.sortBy.field}-${state.sortBy.order}`}
                  onChange={(event) => handleSortChange(event.target.value)}
                  className={styles.sortSelect}
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.filtersSection}>
              <div className={styles.filterGroup}>
                <label htmlFor="search-category" className={styles.filterLabel}>카테고리</label>
                <select
                  id="search-category"
                  value={state.filters.category || ''}
                  onChange={(event) => updateFilters({ ...state.filters, category: event.target.value || undefined })}
                  className={styles.filterSelect}
                >
                  <option value="">전체</option>
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.filterGroup}>
                <label htmlFor="search-max-price" className={styles.filterLabel}>최대 가격</label>
                <select
                  id="search-max-price"
                  value={state.filters.maxPrice ? String(state.filters.maxPrice) : ''}
                  onChange={(event) =>
                    updateFilters({
                      ...state.filters,
                      maxPrice: event.target.value ? Number(event.target.value) : undefined,
                    })
                  }
                  className={styles.filterSelect}
                >
                  <option value="">전체</option>
                  <option value="30000">3만원 이하</option>
                  <option value="50000">5만원 이하</option>
                  <option value="100000">10만원 이하</option>
                  <option value="200000">20만원 이하</option>
                </select>
              </div>

              <div className={styles.filterTags}>
                <button
                  type="button"
                  className={`${styles.filterTag} ${state.filters.isNew ? styles.active : ''}`}
                  aria-pressed={state.filters.isNew === true}
                  onClick={() => updateFilters({ ...state.filters, isNew: state.filters.isNew ? undefined : true })}
                >
                  신상품
                </button>
                <button
                  type="button"
                  className={`${styles.filterTag} ${state.filters.isSale ? styles.active : ''}`}
                  aria-pressed={state.filters.isSale === true}
                  onClick={() => updateFilters({ ...state.filters, isSale: state.filters.isSale ? undefined : true })}
                >
                  세일
                </button>
                <button
                  type="button"
                  className={`${styles.filterTag} ${state.filters.rating ? styles.active : ''}`}
                  aria-pressed={state.filters.rating === 4}
                  onClick={() => updateFilters({ ...state.filters, rating: state.filters.rating ? undefined : 4 })}
                >
                  평점 4점 이상
                </button>
              </div>
            </div>

            {state.loading && <p>검색 중...</p>}

            {!state.loading && state.error && (
              <div className={styles.error}>
                <p>{state.error}</p>
                <button type="button" className={styles.retryButton} onClick={() => void loadPage(1, true)}>
                  다시 시도
                </button>
              </div>
            )}

            {!state.loading && !state.error && state.results.length === 0 && (
              <div className={styles.noResults}>
                <h3>검색 결과가 없습니다.</h3>
                <p>{`'${state.committedQuery}'에 대한 결과가 없습니다.`}</p>
              </div>
            )}

            {!state.loading && state.results.length > 0 && (
              <>
                <div className={styles.productGrid}>
                  {state.results.map((product) => (
                    <ProductCard
                      key={product.id}
                      id={product.id}
                      name={product.name}
                      brand={product.brand}
                      price={product.price}
                      originalPrice={product.originalPrice}
                      image={product.mainImage || product.images[0]}
                      isNew={product.isNew}
                      isSale={product.isSale}
                      saleRate={product.saleRate}
                      rating={product.rating}
                      reviewCount={product.reviewCount}
                      stock={product.stock}
                    />
                  ))}
                </div>

                <div className={styles.pagination}>
                  <button
                    type="button"
                    onClick={handlePreviousPage}
                    disabled={state.currentPage === 1}
                    className={styles.pageButton}
                  >
                    이전
                  </button>
                  <span>{`페이지 ${state.currentPage}`}</span>
                  <button
                    type="button"
                    onClick={handleNextPage}
                    disabled={!hasMoreByPage[state.currentPage]}
                    className={styles.pageButton}
                  >
                    다음
                  </button>
                </div>

                <div className={styles.resultInfo} aria-live="polite">
                  {state.results.length > 0 ? `${start}~${end}번째` : '조회된 결과가 없습니다.'}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
