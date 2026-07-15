'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import ProductCard from '@/app/products/_components/ProductCard';
import { Event, EventUiVariant } from '@/shared/types/event';
import { Product } from '@/shared/types/product';
import {
  getEventProductSectionMeta,
  loadEventProducts,
} from '../eventProductSelection';
import styles from './EventProductShowcase.module.css';

interface EventProductShowcaseProps {
  event: Event;
  variant: EventUiVariant;
}

type LoadStatus = 'loading' | 'success' | 'error';

interface LoadRequest {
  cancelled: boolean;
}

export default function EventProductShowcase({
  event,
  variant,
}: EventProductShowcaseProps) {
  const sectionMeta = getEventProductSectionMeta(variant);
  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const activeRequest = useRef<LoadRequest | null>(null);

  const load = useCallback(async () => {
    if (activeRequest.current) {
      activeRequest.current.cancelled = true;
    }

    const request: LoadRequest = { cancelled: false };
    activeRequest.current = request;
    setStatus('loading');

    try {
      const loadedProducts = await loadEventProducts({ event, variant, limit: 8 });
      if (request.cancelled) return;

      setProducts(loadedProducts.slice(0, 8));
      setStatus('success');
    } catch {
      if (request.cancelled) return;

      setProducts([]);
      setStatus('error');
    }
  }, [event, variant]);

  useEffect(() => {
    void load();

    return () => {
      if (activeRequest.current) {
        activeRequest.current.cancelled = true;
      }
    };
  }, [load]);

  const sectionLink = (
    <Link className={styles.sectionLink} href={sectionMeta.href}>
      {sectionMeta.linkLabel}
    </Link>
  );

  return (
    <section className={styles.showcase} aria-labelledby="event-product-showcase-title">
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="event-product-showcase-title">{sectionMeta.title}</h2>
          <p>{sectionMeta.description}</p>
        </div>
      </div>

      {status === 'loading' && <p role="status">상품을 불러오는 중입니다.</p>}

      {status === 'error' && (
        <div className={styles.feedback} role="alert">
          <p>상품을 불러오지 못했습니다.</p>
          <div className={styles.feedbackActions}>
            <button type="button" onClick={() => void load()}>
              상품 다시 불러오기
            </button>
            {sectionLink}
          </div>
        </div>
      )}

      {status === 'success' && products.length > 0 && (
        <>
          <div className={styles.productGrid}>
            {products.map(product => (
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
          <div className={styles.sectionFooter}>{sectionLink}</div>
        </>
      )}

      {status === 'success' && products.length === 0 && (
        <div className={styles.emptyState}>{sectionLink}</div>
      )}
    </section>
  );
}
