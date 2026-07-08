import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/shared/libs/firebase/firebase';
import { DEFAULT_CATEGORY_IDS, getDefaultCategoryNames } from '@/shared/utils/categoryUtils';

export interface CategoryOrderConfig {
  id: string;
  order: string[];
  mappedOrder: string[];
  description: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CATEGORY_ORDER_COLLECTION = 'categoryOrder';
const DEFAULT_CATEGORY_NAMES = getDefaultCategoryNames();
const DEFAULT_ORDER_NAMES = DEFAULT_CATEGORY_IDS.map((id) => DEFAULT_CATEGORY_NAMES[id]).filter(Boolean);
const CATEGORY_IMAGES = [
  '/category/main_category01.png',
  '/category/main_category02.png',
  '/category/main_category03.png',
  '/category/main_category04.png',
];

type SortedCategory = { id: string; name: string; order: number };

const MAIN_PAGE_CATEGORY_PRIORITY = ['tops', 'bottoms', 'shoes', 'sports'];
const MAIN_PAGE_CATEGORY_ALIASES: Record<string, string> = {
  top: 'tops',
  clothing: 'tops',
  pants: 'bottoms',
  shoe: 'shoes',
};

function nameToId(name: string): string {
  return Object.entries(DEFAULT_CATEGORY_NAMES).find(([, label]) => label === name)?.[0] || name;
}

function categoryName(id: string, rawName?: string): string {
  return DEFAULT_CATEGORY_NAMES[rawName?.toLowerCase() || ''] || DEFAULT_CATEGORY_NAMES[id] || rawName || id;
}

function normalizeMainPageCategoryId(id: string): string {
  const normalizedId = id.toLowerCase();
  return MAIN_PAGE_CATEGORY_ALIASES[normalizedId] || normalizedId;
}

export function getCuratedMainPageCategories(
  categories: SortedCategory[],
  maxCount: number,
): SortedCategory[] {
  const byCuratedId = new Map<string, SortedCategory>();

  categories.forEach((category) => {
    const curatedId = normalizeMainPageCategoryId(category.id);

    if (!MAIN_PAGE_CATEGORY_PRIORITY.includes(curatedId) || byCuratedId.has(curatedId)) {
      return;
    }

    byCuratedId.set(curatedId, {
      ...category,
      id: curatedId,
      name: categoryName(curatedId, category.name),
    });
  });

  return MAIN_PAGE_CATEGORY_PRIORITY
    .map((id, index) => byCuratedId.get(id) || {
      id,
      name: DEFAULT_CATEGORY_NAMES[id] || id,
      order: index,
    })
    .slice(0, maxCount);
}

export class CategoryOrderService {
  static getDefaultOrderNames(): string[] {
    return [...DEFAULT_ORDER_NAMES];
  }

  static async getCategoryOrderConfig(configId: string = 'mainPageOrder'): Promise<CategoryOrderConfig> {
    try {
      const docSnap = await getDoc(doc(db, CATEGORY_ORDER_COLLECTION, configId));

      if (!docSnap.exists()) {
        return this.createDefaultOrderConfig(configId);
      }

      const data = docSnap.data();
      const order = Array.isArray(data.order) && data.order.length > 0
        ? data.order
        : DEFAULT_ORDER_NAMES;

      return {
        id: docSnap.id,
        order,
        mappedOrder: Array.isArray(data.mappedOrder) && data.mappedOrder.length > 0
          ? data.mappedOrder
          : order.map(nameToId),
        description: data.description || '카테고리 순서 설정',
        isActive: data.isActive ?? true,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };
    } catch (error) {
      console.warn('카테고리 순서 설정을 불러오지 못해 기본 순서를 사용합니다.', error);
      return this.createDefaultOrderConfig(configId);
    }
  }

  static async updateCategoryOrder(
    newOrder: string[],
    configId: string = 'mainPageOrder',
    description: string = '카테고리 순서 설정'
  ): Promise<void> {
    const docRef = doc(db, CATEGORY_ORDER_COLLECTION, configId);
    const docSnap = await getDoc(docRef);
    const orderData = {
      order: newOrder,
      mappedOrder: newOrder.map(nameToId),
      description,
      isActive: true,
      updatedAt: Timestamp.now(),
    };

    if (docSnap.exists()) {
      await updateDoc(docRef, orderData);
      return;
    }

    await setDoc(docRef, {
      ...orderData,
      createdAt: Timestamp.now(),
    });
  }

  static async getSortedCategories(): Promise<{ id: string; name: string; order: number }[]> {
    try {
      const orderConfig = await this.getCategoryOrderConfig();
      const snapshot = await getDocs(query(collection(db, 'categories'), orderBy('createdAt', 'asc')));
      const allCategories = snapshot.docs
        .map((categoryDoc) => {
          const data = categoryDoc.data();

          return {
            id: categoryDoc.id,
            name: categoryName(categoryDoc.id, data.name),
            isActive: data.isActive === true,
          };
        })
        .filter((category) => category.isActive);

      const sortedCategories = orderConfig.order
        .map(nameToId)
        .map((id, index) => {
          const category = allCategories.find((item) => item.id === id);
          return category ? { id: category.id, name: category.name, order: index } : null;
        })
        .filter((category): category is { id: string; name: string; order: number } => Boolean(category));

      allCategories.forEach((category) => {
        if (!sortedCategories.some((item) => item.id === category.id)) {
          sortedCategories.push({
            id: category.id,
            name: category.name,
            order: sortedCategories.length,
          });
        }
      });

      return sortedCategories;
    } catch (error) {
      console.error('정렬된 카테고리 조회 실패:', error);
      return DEFAULT_CATEGORY_IDS.map((id, index) => ({
        id,
        name: DEFAULT_CATEGORY_NAMES[id] || id,
        order: index,
      }));
    }
  }

  static async getMainPageCategories(maxCount: number = 4): Promise<{
    id: string;
    name: string;
    slug: string;
    href: string;
    icon: string;
    image: string;
    count: string;
  }[]> {
    const categories = await this.getSortedCategories();
    const curatedCategories = getCuratedMainPageCategories(categories, maxCount);

    return curatedCategories.map((category, index) => ({
      id: category.id,
      name: category.name,
      slug: category.id,
      href: `/categories/${category.id}`,
      icon: '',
      image: CATEGORY_IMAGES[index] || CATEGORY_IMAGES[0],
      count: '',
    }));
  }

  private static createDefaultOrderConfig(configId: string): CategoryOrderConfig {
    return {
      id: configId,
      order: [...DEFAULT_ORDER_NAMES],
      mappedOrder: [...DEFAULT_CATEGORY_IDS],
      description: '기본 카테고리 순서',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}
