import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProductDetailClient from '../_components/ProductDetailClient';
import { ProductService } from '@/shared/services/productService';
import { serializeProduct } from '@/shared/utils/serialize';
import { ReviewProvider } from '@/context/reviewProvider';
import {
  buildProductJsonLd,
  canonicalUrl,
  getOpenGraphImage,
  serializeJsonLd,
} from '@/shared/constants/seo';

interface ProductPageProps {
  params: Promise<{
    productId: string;
  }>;
}

const getPublicProduct = cache((productId: string) => (
  ProductService.getPublicProductById(productId)
));

function getMissingProductMetadata(): Metadata {
  return {
    title: '상품을 찾을 수 없습니다 - STYNA',
    description: 'STYNA에서 현재 판매 중인 상품을 확인해 주세요.',
    robots: { index: false, follow: false },
  };
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { productId } = await params;
  const product = await getPublicProduct(productId);
  if (!product) {
    return getMissingProductMetadata();
  }

  const productImage = product.mainImage || product.images[0] || '/thum.png';
  const formattedPrice = new Intl.NumberFormat('ko-KR').format(product.price);
  const description = `${product.description} | 가격: ${formattedPrice}원 | STYNA`;
  const canonical = canonicalUrl(`/products/${encodeURIComponent(productId)}`);
  const openGraphImage = getOpenGraphImage(
    productImage,
    `${product.name} - ${product.brand}`,
  );

  return {
    title: `${product.name} - ${product.brand} | STYNA`,
    description,
    keywords: [product.name, product.brand, product.category, '쇼핑몰', 'STYNA', ...(product.tags || [])],
    alternates: { canonical },
    openGraph: {
      title: `${product.name} - ${product.brand}`,
      description,
      images: [openGraphImage],
      type: 'website',
      siteName: 'STYNA',
      url: canonical,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${product.name} - ${product.brand}`,
      description,
      images: [openGraphImage.url],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { productId } = await params;
  const product = await getPublicProduct(productId);
  if (!product) {
    notFound();
  }

  const serializedProduct = serializeProduct(product);
  const productJsonLd = serializeJsonLd(buildProductJsonLd(product));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: productJsonLd }}
      />
      <ReviewProvider>
        <ProductDetailClient product={serializedProduct} />
      </ReviewProvider>
    </>
  );
}
