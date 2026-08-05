'use client';

import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useProduct } from '@/context/productProvider';
import { useAuth } from '@/context/authProvider';
import { Product } from '@/shared/types/product';
import EditProductForm from './EditProductForm';
import styles from './EditProductModal.module.css';

export default function EditProductModal() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { getProductById, updateProduct } = useProduct();
  const productId = searchParams.get('edit');

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const closeModal = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('edit');
    const query = nextParams.toString();

    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const requestClose = useCallback(() => {
    if (confirm('변경사항이 저장되지 않습니다. 정말 닫으시겠습니까?')) {
      closeModal();
    }
  }, [closeModal]);

  useEffect(() => {
    if (!productId || authLoading) return;

    if (!user) {
      alert('로그인이 필요합니다.');
      router.replace('/auth/login');
      return;
    }

    if (!isAdmin) {
      alert('관리자 권한이 필요합니다.');
      router.replace('/');
    }
  }, [authLoading, isAdmin, productId, router, user]);

  useEffect(() => {
    if (!productId || !user || !isAdmin) return;

    let isCancelled = false;

    const loadProduct = async () => {
      try {
        setLoading(true);
        setError(null);
        setProduct(null);

        const productData = await getProductById(productId);
        if (isCancelled) return;

        if (!productData) {
          setError('상품을 찾을 수 없습니다.');
          return;
        }

        setProduct(productData);
      } catch (loadError) {
        if (!isCancelled) {
          console.error('상품 로드 실패:', loadError);
          setError('상품을 불러오는데 실패했습니다.');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    void loadProduct();

    return () => {
      isCancelled = true;
    };
  }, [getProductById, isAdmin, productId, user]);

  useEffect(() => {
    if (!productId) return;

    const previousOverflow = document.body.style.overflow;
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        requestClose();
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [productId, requestClose]);

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      requestClose();
    }
  };

  const handleSave = async (updatedProduct: Product) => {
    if (!productId) return;

    try {
      await updateProduct(productId, updatedProduct);
      alert('상품이 성공적으로 수정되었습니다.');
      closeModal();
    } catch (saveError) {
      console.error('상품 수정 실패:', saveError);
      alert('상품 수정에 실패했습니다.');
    }
  };

  if (!productId) {
    return null;
  }

  if (authLoading || !user || !isAdmin) {
    return (
      <div className={styles.overlay} onClick={handleOverlayClick}>
        <div className={styles.container} role="dialog" aria-modal="true" aria-label="상품 편집">
          <div className={styles.loading}>권한을 확인하는 중...</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.overlay} onClick={handleOverlayClick}>
        <div className={styles.container} role="dialog" aria-modal="true" aria-label="상품 편집">
          <div className={styles.loading}>상품 정보를 불러오는 중...</div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className={styles.overlay} onClick={handleOverlayClick}>
        <div className={styles.container} role="dialog" aria-modal="true" aria-labelledby="product-edit-modal-title">
          <button type="button" className={styles.closeButton} onClick={requestClose} aria-label="상품 편집 모달 닫기">
            ✕
          </button>
          <div className={styles.error} role="alert">
            <h2 id="product-edit-modal-title">오류 발생</h2>
            <p>{error || '상품을 불러올 수 없습니다.'}</p>
            <button type="button" className={styles.backButton} onClick={closeModal}>
              상품 목록으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.container} role="dialog" aria-modal="true" aria-labelledby="product-edit-modal-title">
        <div className={styles.header}>
          <button type="button" className={styles.closeButton} onClick={requestClose} aria-label="상품 편집 모달 닫기">
            ✕
          </button>
          <h1 id="product-edit-modal-title" className={styles.title}>상품 편집</h1>
          <div className={styles.breadcrumb}>
            <span onClick={() => router.push('/admin')}>관리자</span>
            <span className={styles.separator}>/</span>
            <span onClick={closeModal}>상품 관리</span>
            <span className={styles.separator}>/</span>
            <span>편집</span>
          </div>
        </div>

        <div className={styles.content}>
          <EditProductForm
            product={product}
            onSave={handleSave}
            onCancel={requestClose}
          />
        </div>
      </div>
    </div>
  );
}
