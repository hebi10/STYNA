'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/shared/libs/firebase/firebase';
import { DEFAULT_CATEGORY_IDS, getDefaultCategoryNames } from '@/shared/utils/categoryUtils';
import { normalizeCategoryId } from '@/shared/utils/categoryRouting';

interface Category {
  id: string;
  name: string;
  description: string;
  order: number;
  isActive: boolean;
  icon: string;
  imageUrl?: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

interface CategoryContextType {
  categories: Category[];
  loading: boolean;
  error: string | null;
  refreshCategories: () => Promise<void>;
}

const CategoryContext = createContext<CategoryContextType | undefined>(undefined);

interface CategoryProviderProps {
  children: ReactNode;
}

const fallbackCategories: Category[] = DEFAULT_CATEGORY_IDS.map((id, index) => {
  const categoryNames = getDefaultCategoryNames();
  const now = new Date();

  return {
    id,
    name: categoryNames[id] || id,
    description: `${categoryNames[id] || id} category`,
    icon: '',
    color: '#000000',
    order: index + 1,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
});

export function CategoryProvider({ children }: CategoryProviderProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const snapshot = await getDocs(collection(db, 'categories'));
      const categoryList = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          const rawName = data.name || '';
          const categoryNames = getDefaultCategoryNames();
          const id = normalizeCategoryId(doc.id);
          const displayName =
            categoryNames[rawName.toLowerCase()] || rawName || categoryNames[id] || id;

          return {
            id,
            name: displayName,
            description: data.description || '',
            order: data.order || 0,
            isActive: data.isActive ?? true,
            icon: data.icon || '',
            imageUrl: data.imageUrl || data.image || undefined,
            color: data.color || '#000000',
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          } as Category;
        })
        .filter((category) => category.id && category.name);

      if (categoryList.length > 0) {
        const normalizedCategories = categoryList
          .filter((category) => category.isActive)
          .sort((a, b) => a.order - b.order)
          .reduce<Category[]>((result, category) => {
            const existingIndex = result.findIndex((item) => item.id === category.id);

            if (existingIndex === -1) {
              result.push(category);
            }

            return result;
          }, []);

        setCategories(normalizedCategories);
      } else {
        setCategories(fallbackCategories);
      }
    } catch (err) {
      console.error('카테고리 목록 조회 실패:', err);
      setCategories(fallbackCategories);
      setError(err instanceof Error ? err.message : '카테고리 목록 조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshCategories = async () => {
    await fetchCategories();
  };

  useEffect(() => {
    void fetchCategories();
  }, [fetchCategories]);

  const value: CategoryContextType = {
    categories,
    loading,
    error,
    refreshCategories,
  };

  return <CategoryContext.Provider value={value}>{children}</CategoryContext.Provider>;
}

export function useCategories() {
  const context = useContext(CategoryContext);
  if (context === undefined) {
    throw new Error('useCategories must be used within a CategoryProvider');
  }
  return context;
}
