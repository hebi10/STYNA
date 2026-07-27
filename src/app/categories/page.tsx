'use client';

import Link from 'next/link';
import { useCategories } from '@/context/categoryProvider';
import { CategoryProvider } from '@/context/categoryProvider';
import styles from './page.module.css';

function CategoriesContent() {
  const { categories, loading, error } = useCategories();

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingSection}>
          <div className={styles.spinner}></div>
          <span className={styles.loadingText}>카테고리를 불러오는 중...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorSection}>
          <div className={styles.errorTitle}>오류가 발생했습니다</div>
          <div className={styles.errorMessage}>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 페이지 헤더 */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderInner}>
          <h1 className={styles.pageTitle}>카테고리</h1>
          <p className={styles.pageSubtitle}>전체 {categories.length}개</p>
        </div>
      </div>

      <div className={styles.contentSection}>
        {/* Categories Grid */}
        <div className={styles.categoriesGrid}>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/categories/${category.id}`}
              className={styles.categoryCard}
            >
              <div className={styles.categoryImage}>
                {category.icon ? (
                  <span className={styles.categoryIcon}>
                    {category.icon}
                  </span>
                ) : (
                  <div className={styles.iconPlaceholder}>
                    <p className={styles.placeholderText}>{category.name}</p>
                  </div>
                )}
              </div>
              <div className={styles.categoryContent}>
                <h3 className={styles.categoryName}>{category.name}</h3>
                <p className={styles.categoryDescription}>
                  {category.description}
                </p>
                <div className={styles.categoryAction}>
                  보러가기
                  <span className={styles.arrow}>→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Empty State */}
        {categories.length === 0 && !loading && (
          <div className={styles.emptyState}>
            <h3 className={styles.emptyTitle}>등록된 카테고리가 없습니다</h3>
            <p className={styles.emptyMessage}>잠시 후 다시 시도해주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  return (
    <CategoryProvider>
      <CategoriesContent />
    </CategoryProvider>
  );
}
