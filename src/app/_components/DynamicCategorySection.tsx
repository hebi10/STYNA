'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import Image from "next/image";
import { CategoryOrderService } from '@/shared/services/categoryOrderService';
import { CATEGORY_IMAGE_URLS } from '@/shared/constants/categoryImages';
import { DEFAULT_CATEGORY_IDS, getDefaultCategoryNames } from '@/shared/utils/categoryUtils';
import styles from '../page.module.css';

interface CategoryCardProps {
  id: string;
  name: string;
  slug: string;
  href: string;
  icon: string;
  image: string;
  count: string;
}

interface DynamicCategorySectionProps {
  maxCategories?: number;
  className?: string;
  visualMode?: 'image' | 'text';
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  tops: '매일 입기 좋은 기본 상의',
  bottoms: '실루엣을 잡아주는 기본 하의',
  shoes: '오래 걸어도 편한 데일리 슈즈',
  sports: '가볍게 움직이기 좋은 액티브웨어',
};

const TEXT_MODE_CATEGORY_IDS = ['tops', 'bottoms', 'shoes', 'sports'] as const;

function getCategoryDescription(category: CategoryCardProps) {
  return category.count || CATEGORY_DESCRIPTIONS[category.id] || '상품 준비 중';
}

function getFallbackCategories(
  maxCategories: number,
  categoryIds: readonly string[] = DEFAULT_CATEGORY_IDS,
): CategoryCardProps[] {
  const categoryNames = getDefaultCategoryNames();

  return categoryIds.slice(0, maxCategories).map((id, index) => ({
    id,
    name: categoryNames[id] || id,
    slug: id,
    href: `/categories/${id}`,
    icon: '',
    image: CATEGORY_IMAGE_URLS[index] || CATEGORY_IMAGE_URLS[0],
    count: '',
  }));
}

export default function DynamicCategorySection({ 
  maxCategories = 4, 
  className = '',
  visualMode = 'image',
}: DynamicCategorySectionProps) {
  const [categories, setCategories] = useState<CategoryCardProps[]>(() =>
    visualMode === 'text' ? getFallbackCategories(maxCategories, TEXT_MODE_CATEGORY_IDS) : [],
  );
  const [loading, setLoading] = useState(visualMode === 'image');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        setLoading(visualMode === 'image');
        const categoryData = await CategoryOrderService.getMainPageCategories(maxCategories);
        setCategories(categoryData);
        setError(null);
      } catch (err) {
        console.error('카테고리 로딩 실패:', err);
        if (visualMode === 'image') {
          setError('카테고리를 불러오는데 실패했습니다.');
          setCategories(getFallbackCategories(maxCategories));
        } else {
          setError(null);
          setCategories(getFallbackCategories(maxCategories, TEXT_MODE_CATEGORY_IDS));
        }
      } finally {
        setLoading(false);
      }
    };

    loadCategories();
  }, [maxCategories, visualMode]);

  if (loading) {
    return (
      <div className={`${styles.categoryGrid} ${className}`}>
        {Array.from({ length: maxCategories }).map((_, index) => (
          <div
            key={index}
            className={`${styles.categoryCard} ${styles.loading} ${
              visualMode === 'text' ? styles.categoryCardTextOnly : ''
            }`}
          >
            {visualMode === 'image' ? (
              <div className={styles.categoryImageWrapper}>
                <div className={`${styles.categoryImagePlaceholder} ${styles.loadingShimmer}`}></div>
              </div>
            ) : null}
            <div className={styles.categoryInfo}>
              <span className={styles.categoryLabel}>로딩 중...</span>
              <span className={styles.categoryCount}>상품 수 확인 중</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${styles.errorContainer} ${className}`}>
        <p className={styles.errorMessage}>{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className={styles.retryButton}
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className={`${styles.categoryGrid} ${className}`}>
      {categories.map((category) => (
        <Link
          key={category.id} 
          href={category.href} 
          className={`${styles.categoryCard} ${
            visualMode === 'text' ? styles.categoryCardTextOnly : ''
          }`}
        >
          {visualMode === 'image' ? (
            <div className={styles.categoryImageWrapper}>
              <div className={styles.categoryImagePlaceholder}>
                <Image
                  src={category.image}
                  alt={category.name}
                  fill
                  style={{ objectFit: 'cover' }}
                  className={styles.categoryImage}
                />
              </div>
            </div>
          ) : null}
          <div className={styles.categoryInfo}>
            <span className={styles.categoryLabel}>{category.name}</span>
            <span className={styles.categoryCount}>
              {getCategoryDescription(category)}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
