'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FeaturedProductService } from '@/shared/services/featuredProductService';
import { ProductService } from '@/shared/services/productService';
import { Product } from '@/shared/types/product';
import Image from 'next/image';
import styles from './page.module.css';

export default function FeaturedProductManagePage() {
  const router = useRouter();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 폼 상태
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [heroImage, setHeroImage] = useState('/style-now/autumn/style-now-autumn-main.webp');
  const [maxCount] = useState(3);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('관리자 페이지 데이터 로딩 시작...');

      const [configData, productsData] = await Promise.all([
        FeaturedProductService.getFeaturedProductConfig(),
        ProductService.getAllProducts()
      ]);

      console.log('로드된 설정:', configData);
      console.log('로드된 상품 개수:', productsData.length);
      console.log('상품 샘플:', productsData.slice(0, 3));

      setAllProducts(productsData);

      if (configData) {
        setTitle(configData.title);
        setSubtitle(configData.subtitle);
        setDescription(configData.description);
        setHeroImage(configData.heroImage);
        setIsActive(configData.isActive);

        // 선택된 상품들 로드
        if (configData.productIds && configData.productIds.length > 0) {
          console.log('선택된 상품 ID들:', configData.productIds);
          const selectedProductsData = productsData.filter(product => 
            configData.productIds.includes(product.id)
          );
          console.log('매칭된 선택된 상품들:', selectedProductsData);
          setSelectedProducts(selectedProductsData);
        } else {
          console.log('선택된 상품 ID가 없습니다.');
        }
      } else {
        console.log('설정 데이터가 없습니다.');
      }
    } catch (err) {
      console.error('데이터 로딩 실패:', err);
      setError(`데이터를 불러오는데 실패했습니다: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleProductSelect = (product: Product) => {
    if (selectedProducts.find(p => p.id === product.id)) {
      // 이미 선택된 상품이면 제거
      setSelectedProducts(prev => prev.filter(p => p.id !== product.id));
    } else {
      // 새로운 상품 추가 (최대 개수 제한)
      if (selectedProducts.length < maxCount) {
        setSelectedProducts(prev => [...prev, product]);
      } else {
        alert(`최대 ${maxCount}개까지만 선택할 수 있습니다.`);
      }
    }
  };

  const handleProductReorder = (fromIndex: number, toIndex: number) => {
    const newSelectedProducts = [...selectedProducts];
    const [movedProduct] = newSelectedProducts.splice(fromIndex, 1);
    newSelectedProducts.splice(toIndex, 0, movedProduct);
    setSelectedProducts(newSelectedProducts);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      console.log('저장 시작...', { selectedProducts: selectedProducts.length });

      const productIds = selectedProducts.map(p => p.id);
      
      await FeaturedProductService.updateFeaturedProductConfig(
        productIds,
        'mainPageFeatured',
        {
          title,
          subtitle,
          description,
          heroImage,
          maxCount,
          isActive
        }
      );

      setSuccess('추천 상품 설정이 성공적으로 저장되었습니다!');
      setTimeout(() => setSuccess(null), 3000);
      
      // 데이터 새로고침
      await loadData();
    } catch (err) {
      console.error('저장 실패:', err);
      setError(`저장에 실패했습니다: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAutoSelect = () => {
    if (allProducts.length === 0) {
      setError('상품이 없습니다. 먼저 상품을 등록해주세요.');
      return;
    }

    // 평점과 리뷰 수를 기준으로 정렬해서 상위 4개 선택
    const topProducts = [...allProducts]
      .filter(product => product.rating >= 4.0) // 평점 4.0 이상만
      .sort((a, b) => {
        // 평점 * 리뷰수로 점수 계산
        const scoreA = (a.rating || 4.0) * (a.reviewCount || 1);
        const scoreB = (b.rating || 4.0) * (b.reviewCount || 1);
        return scoreB - scoreA;
      })
      .slice(0, maxCount);

    if (topProducts.length === 0) {
      setError('평점 4.0 이상의 상품이 없습니다.');
      return;
    }

    setSelectedProducts(topProducts);
    setSuccess(`자동으로 ${topProducts.length}개 상품을 선택했습니다!`);
    setTimeout(() => setSuccess(null), 3000);

    console.log('자동 선택된 상품들:', topProducts.map(p => `${p.name} (평점: ${p.rating})`));
  };

  const filteredProducts = allProducts.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.brand.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>추천 상품 관리</h1>
        </div>
        <div className={styles.loading}>로딩 중...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleContainer}>
          <h1 className={styles.title}>추천 상품 관리</h1>
          <button 
            onClick={() => router.push('/admin/')} 
            className={styles.backButton}
          >
            대시보드로 돌아가기
          </button>
        </div>
        <p className={styles.description}>
          메인 페이지에 표시될 추천 상품을 설정하고 관리하세요.
        </p>
      </div>

      {error && (
        <div className={styles.errorAlert}>
          <span className={styles.errorIcon}>[X]</span>
          {error}
        </div>
      )}

      {success && (
        <div className={styles.successAlert}>
          <span className={styles.successIcon}>[O]</span>
          {success}
        </div>
      )}

      <div className={styles.content}>
        {/* 설정 폼 */}
        <div className={styles.configSection}>
          <h2 className={styles.sectionTitle}>기본 설정</h2>
          
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.label}>제목</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={styles.input}
                placeholder="추천 상품 섹션 제목"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>부제목</label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className={styles.input}
                placeholder="추천 상품 섹션 부제목"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>표시 상품 수</label>
              <input
                type="text"
                value="3개 고정"
                className={styles.input}
                aria-label="표시 상품 수"
                disabled
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className={styles.checkbox}
                />
                활성화
              </label>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>설명</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={styles.textarea}
              placeholder="추천 상품 섹션 설명"
              rows={3}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="featured-hero-image" className={styles.label}>무드 이미지 경로</label>
            <input
              id="featured-hero-image"
              type="text"
              value={heroImage}
              onChange={(e) => setHeroImage(e.target.value)}
              className={styles.input}
              placeholder="/style-now/autumn/style-now-autumn-main.webp"
            />
          </div>
        </div>

        {/* 선택된 상품들 */}
        <div className={styles.selectedSection}>
          <h2 className={styles.sectionTitle}>
            선택된 추천 상품 ({selectedProducts.length}/{maxCount})
          </h2>
          
          {selectedProducts.length === 0 ? (
            <div className={styles.emptyState}>
              <p>아직 선택된 상품이 없습니다.</p>
              <p>아래에서 상품을 선택해주세요.</p>
            </div>
          ) : (
            <div className={styles.selectedProductGrid}>
              {selectedProducts.map((product, index) => (
                <div key={product.id} className={styles.selectedProductCard}>
                  <div className={styles.rankBadge}>{index + 1}</div>
                  <div className={styles.productImage}>
                    <Image
                      src={product.mainImage || product.images[0] || '/product-placeholder.jpg'}
                      alt={product.name}
                      fill
                      style={{ objectFit: 'cover' }}
                    />
                  </div>
                  <div className={styles.productInfo}>
                    <h4 className={styles.productName}>{product.name}</h4>
                    <p className={styles.productBrand}>{product.brand}</p>
                    <p className={styles.productPrice}>
                      {product.price.toLocaleString()}원
                    </p>
                  </div>
                  <div className={styles.productActions}>
                    <button
                      onClick={() => handleProductSelect(product)}
                      className={styles.removeButton}
                    >
                      제거
                    </button>
                    {index > 0 && (
                      <button
                        onClick={() => handleProductReorder(index, index - 1)}
                        className={styles.moveButton}
                      >
                        ↑
                      </button>
                    )}
                    {index < selectedProducts.length - 1 && (
                      <button
                        onClick={() => handleProductReorder(index, index + 1)}
                        className={styles.moveButton}
                      >
                        ↓
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 상품 검색 및 선택 */}
        <div className={styles.searchSection}>
          <h2 className={styles.sectionTitle}>상품 선택</h2>
          
          <div className={styles.searchBox}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="상품명 또는 브랜드로 검색..."
              className={styles.searchInput}
            />
          </div>

          <div className={styles.productGrid}>
            {filteredProducts.map(product => (
              <div 
                key={product.id} 
                className={`${styles.productCard} ${
                  selectedProducts.find(p => p.id === product.id) ? styles.selected : ''
                }`}
                onClick={() => handleProductSelect(product)}
              >
                <div className={styles.productImage}>
                  <Image
                    src={product.mainImage || product.images[0] || '/product-placeholder.jpg'}
                    alt={product.name}
                    fill
                    style={{ objectFit: 'cover' }}
                  />
                </div>
                <div className={styles.productInfo}>
                  <h4 className={styles.productName}>{product.name}</h4>
                  <p className={styles.productBrand}>{product.brand}</p>
                  <p className={styles.productPrice}>
                    {product.price.toLocaleString()}원
                  </p>
                  <div className={styles.productMeta}>
                    <span className={styles.rating}>평점: {product.rating}</span>
                    <span className={styles.stock}>재고: {product.stock}</span>
                  </div>
                </div>
                {selectedProducts.find(p => p.id === product.id) && (
                  <div className={styles.selectedBadge}>✓</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 저장 버튼 */}
        <div className={styles.saveSection}>
          <button
            onClick={handleAutoSelect}
            disabled={loading || allProducts.length === 0}
            className={`${styles.saveButton} ${styles.secondary}`}
            style={{ marginRight: '1rem' }}
          >
            자동 선택 (높은 평점 순)
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={styles.saveButton}
          >
            {saving ? '저장 중...' : '설정 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
