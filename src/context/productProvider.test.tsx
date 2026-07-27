import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ProductProvider, useProduct } from "./productProvider";
import { ProductService } from "@/shared/services/productService";
import type { Product } from "@/shared/types/product";
import { productKeys } from "@/shared/hooks/queryKeys";

jest.mock("@/shared/services/productService", () => ({
  ProductService: {
    getAllProducts: jest.fn(),
    getProductById: jest.fn(),
    createProduct: jest.fn(),
    updateProduct: jest.fn(),
    deleteProduct: jest.fn(),
  },
}));

function product(id: string, images: string[] = []): Product {
  return {
    id,
    name: id,
    description: "상품 설명",
    price: 10_000,
    brand: "STYNA",
    category: "tops",
    images,
    sizes: [],
    colors: [],
    stock: 1,
    rating: 0,
    reviewCount: 0,
    isNew: false,
    isSale: false,
    tags: [],
    status: "active",
    createdAt: new Date("2026-07-21T00:00:00.000Z"),
    updatedAt: new Date("2026-07-21T00:00:00.000Z"),
    details: {
      material: "",
      origin: "",
      manufacturer: "",
      precautions: "",
      sizes: {},
    },
  };
}

function createProductInput(
  source: Product,
): Omit<Product, "id" | "createdAt" | "updatedAt"> {
  const input: Partial<Product> = { ...source };
  delete input.id;
  delete input.createdAt;
  delete input.updatedAt;
  return input as Omit<Product, "id" | "createdAt" | "updatedAt">;
}

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ProductProvider>{children}</ProductProvider>
    </QueryClientProvider>
  );
}

describe("ProductProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    queryClient.clear();
    jest.restoreAllMocks();
  });

  test("관리자 상품 목록만 한 번 조회하고 이미지를 정규화한다", async () => {
    jest.mocked(ProductService.getAllProducts).mockResolvedValue([
      product("product-1", ["/product.webp"]),
    ]);
    const { result } = renderHook(() => useProduct(), { wrapper });

    await act(async () => {
      await Promise.all([
        result.current.loadProducts(true),
        result.current.loadProducts(true),
      ]);
    });

    expect(ProductService.getAllProducts).toHaveBeenCalledTimes(1);
    expect(result.current.products[0]).toMatchObject({
      id: "product-1",
      mainImage: "/product.webp",
    });
  });

  test("목록에 없는 단일 상품 조회 오류를 누락 상품으로 숨기지 않는다", async () => {
    jest.mocked(ProductService.getProductById).mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useProduct(), { wrapper });

    await expect(result.current.getProductById("missing")).rejects.toThrow("network");
  });

  test("관리자 전체 목록 조회 실패를 빈 목록 성공으로 숨기지 않는다", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.mocked(ProductService.getAllProducts).mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useProduct(), { wrapper });

    await act(async () => {
      await result.current.loadProducts(true);
    });

    expect(result.current.error).toBe("상품 목록을 불러오지 못했습니다.");
    expect(result.current.products).toEqual([]);
  });

  test("늦은 전체 목록 응답이 더 최근의 관리자 수정을 덮어쓰지 않는다", async () => {
    const original = product("product-1", ["/old.webp"]);
    const stale = { ...original, name: "이전 이름" };
    const updated = { ...original, name: "최신 이름" };
    let resolveReload: ((products: Product[]) => void) | undefined;

    jest.mocked(ProductService.getAllProducts)
      .mockResolvedValueOnce([original])
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveReload = resolve;
      }));
    jest.mocked(ProductService.updateProduct).mockResolvedValue(updated);
    const { result } = renderHook(() => useProduct(), { wrapper });

    await act(async () => {
      await result.current.loadProducts(true);
    });

    let reloadPromise: Promise<void>;
    await act(async () => {
      reloadPromise = result.current.loadProducts(true);
      await result.current.updateProduct("product-1", { name: "최신 이름" });
    });
    await act(async () => {
      resolveReload?.([stale]);
      await reloadPromise!;
    });

    expect(result.current.products[0].name).toBe("최신 이름");
  });

  test("최신 수정 뒤 도착한 이전 목록 실패가 현재 상태를 오류로 바꾸지 않는다", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const original = product("product-1", ["/old.webp"]);
    const updated = { ...original, name: "최신 이름" };
    let rejectReload: ((reason?: unknown) => void) | undefined;

    jest.mocked(ProductService.getAllProducts)
      .mockResolvedValueOnce([original])
      .mockReturnValueOnce(new Promise((_resolve, reject) => {
        rejectReload = reject;
      }));
    jest.mocked(ProductService.updateProduct).mockResolvedValue(updated);
    const { result } = renderHook(() => useProduct(), { wrapper });

    await act(async () => {
      await result.current.loadProducts(true);
    });

    let reloadPromise: Promise<void>;
    await act(async () => {
      reloadPromise = result.current.loadProducts(true);
      await result.current.updateProduct("product-1", { name: "최신 이름" });
    });
    await act(async () => {
      rejectReload?.(new Error("stale reload failed"));
      await reloadPromise!;
    });

    expect(result.current.products[0].name).toBe("최신 이름");
    expect(result.current.error).toBeNull();
  });

  test("관리자 생성·수정·삭제 성공마다 공개 상품 쿼리를 무효화한다", async () => {
    const created = product("created-product", ["/created.webp"]);
    const updated = { ...created, name: "수정된 상품" };
    const createInput = createProductInput(created);
    jest.mocked(ProductService.createProduct).mockResolvedValue(created);
    jest.mocked(ProductService.updateProduct).mockResolvedValue(updated);
    jest.mocked(ProductService.deleteProduct).mockResolvedValue(undefined);
    const invalidateQueries = jest.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useProduct(), { wrapper });

    await act(async () => {
      await result.current.createProduct(createInput);
    });
    expect(invalidateQueries).toHaveBeenLastCalledWith({ queryKey: productKeys.all });

    invalidateQueries.mockClear();
    await act(async () => {
      await result.current.updateProduct(created.id, { name: updated.name });
    });
    expect(invalidateQueries).toHaveBeenLastCalledWith({ queryKey: productKeys.all });

    invalidateQueries.mockClear();
    await act(async () => {
      await result.current.deleteProduct(created.id);
    });
    expect(invalidateQueries).toHaveBeenLastCalledWith({ queryKey: productKeys.all });
  });
});
