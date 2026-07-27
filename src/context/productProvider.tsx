"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ProductService } from "@/shared/services/productService";
import { productKeys } from "@/shared/hooks/queryKeys";
import type { Product } from "@/shared/types/product";

interface ProductContextType {
  products: Product[];
  loading: boolean;
  error: string | null;
  loadProducts: (forceReload?: boolean) => Promise<void>;
  getProductById: (productId: string) => Promise<Product | null>;
  createProduct: (
    product: Omit<Product, "id" | "createdAt" | "updatedAt">,
  ) => Promise<Product>;
  updateProduct: (
    productId: string,
    updates: Partial<Omit<Product, "id" | "createdAt">>,
  ) => Promise<Product>;
  deleteProduct: (productId: string) => Promise<void>;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

function normalizeProduct(product: Product): Product {
  const images = product.images ?? [];
  const mainImage = product.mainImage && images.includes(product.mainImage)
    ? product.mainImage
    : images[0];

  return {
    ...product,
    images,
    mainImage,
  };
}

export function useProduct(): ProductContextType {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error("useProduct must be used within a ProductProvider");
  }
  return context;
}

export function ProductProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [pendingOperations, setPendingOperations] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const lastFetchTimeRef = useRef(0);
  const loadingPromiseRef = useRef<Promise<void> | null>(null);
  const mutationGenerationRef = useRef(0);

  const beginOperation = useCallback(() => {
    setPendingOperations((count) => count + 1);
  }, []);

  const endOperation = useCallback(() => {
    setPendingOperations((count) => Math.max(0, count - 1));
  }, []);

  const loadProducts = useCallback(async (forceReload = false): Promise<void> => {
    const now = Date.now();
    const cacheDuration = 10_000;

    if (loadingPromiseRef.current) {
      return loadingPromiseRef.current;
    }

    if (!forceReload && now - lastFetchTimeRef.current < cacheDuration) {
      return;
    }

    const mutationGeneration = mutationGenerationRef.current;
    const request = (async () => {
      beginOperation();
      setError(null);
      try {
        const allProducts = await ProductService.getAllProducts();
        if (mutationGenerationRef.current === mutationGeneration) {
          setProducts(allProducts.map(normalizeProduct));
          lastFetchTimeRef.current = Date.now();
        }
      } catch (error) {
        if (mutationGenerationRef.current === mutationGeneration) {
          setError("상품 목록을 불러오지 못했습니다.");
          console.error("상품 조회 실패:", error);
        }
      } finally {
        endOperation();
        loadingPromiseRef.current = null;
      }
    })();

    loadingPromiseRef.current = request;
    return request;
  }, [beginOperation, endOperation]);

  const getProductById = useCallback(async (productId: string): Promise<Product | null> => {
    const cachedProduct = products.find((product) => product.id === productId);
    if (cachedProduct) {
      return cachedProduct;
    }

    const product = await ProductService.getProductById(productId);
    return product ? normalizeProduct(product) : null;
  }, [products]);

  const createProduct = useCallback(async (
    product: Omit<Product, "id" | "createdAt" | "updatedAt">,
  ): Promise<Product> => {
    beginOperation();
    setError(null);
    try {
      const createdProduct = normalizeProduct(await ProductService.createProduct(product));
      mutationGenerationRef.current += 1;
      setProducts((currentProducts) => [...currentProducts, createdProduct]);
      void queryClient.invalidateQueries({ queryKey: productKeys.all });
      return createdProduct;
    } catch (operationError) {
      setError("상품을 생성하지 못했습니다.");
      throw operationError;
    } finally {
      endOperation();
    }
  }, [beginOperation, endOperation, queryClient]);

  const updateProduct = useCallback(async (
    productId: string,
    updates: Partial<Omit<Product, "id" | "createdAt">>,
  ): Promise<Product> => {
    beginOperation();
    setError(null);
    try {
      const updatedProduct = normalizeProduct(
        await ProductService.updateProduct(productId, updates),
      );
      mutationGenerationRef.current += 1;
      setProducts((currentProducts) => currentProducts.map((product) => (
        product.id === productId ? updatedProduct : product
      )));
      void queryClient.invalidateQueries({ queryKey: productKeys.all });
      return updatedProduct;
    } catch (operationError) {
      setError("상품을 수정하지 못했습니다.");
      throw operationError;
    } finally {
      endOperation();
    }
  }, [beginOperation, endOperation, queryClient]);

  const deleteProduct = useCallback(async (productId: string): Promise<void> => {
    beginOperation();
    setError(null);
    try {
      await ProductService.deleteProduct(productId);
      mutationGenerationRef.current += 1;
      setProducts((currentProducts) => currentProducts.filter((product) => (
        product.id !== productId
      )));
      void queryClient.invalidateQueries({ queryKey: productKeys.all });
    } catch (operationError) {
      setError("상품을 삭제하지 못했습니다.");
      throw operationError;
    } finally {
      endOperation();
    }
  }, [beginOperation, endOperation, queryClient]);

  return (
    <ProductContext.Provider value={{
      products,
      loading: pendingOperations > 0,
      error,
      loadProducts,
      getProductById,
      createProduct,
      updateProduct,
      deleteProduct,
    }}>
      {children}
    </ProductContext.Provider>
  );
}
