"use client";

import { useOfflineContent } from "@/shared/hooks/useSiteContent";
import styles from "./page.module.css";

export default function OfflinePage() {
  const { data, isLoading: loading, error } = useOfflineContent();
  const stores = data?.stores || [];
  const services = data?.services || [];
  const info = data?.info || null;

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>오프라인 매장</h1>
          <p className={styles.pageDescription}>
            전국 STYNA 매장에서 직접 체험하고 구매하세요
          </p>
        </div>

        {loading && <div className={styles.specialNotice}>매장 정보를 불러오는 중입니다.</div>}
        {error && <div className={styles.specialNotice}>매장 정보를 불러오지 못했습니다.</div>}

        {!loading && !error && (
          <>
            <div className={styles.storeGrid}>
              {stores.map((store) => (
                <div key={store.id} className={styles.storeCard}>
                  <div className={styles.storeImage}></div>
                  <div className={styles.storeContent}>
                    <h3 className={styles.storeName}>{store.name}</h3>
                    <div className={styles.storeType}>{store.type}</div>

                    <div className={styles.storeInfo}>
                      <div className={styles.infoRow}>
                        <span className={styles.infoIcon}></span>
                        <span className={styles.infoText}>{store.address}</span>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoIcon}></span>
                        <span className={styles.infoText}>{store.phone}</span>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoIcon}></span>
                        <span className={styles.infoText}>{store.hours}</span>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoIcon}></span>
                        <span className={styles.infoText}>{store.transport}</span>
                      </div>
                    </div>

                    <div className={styles.storeFeatures}>
                      {store.features.map((feature) => (
                        <span key={feature} className={styles.feature}>
                          {feature}
                        </span>
                      ))}
                    </div>

                    <div className={styles.storeActions}>
                      <span className={`${styles.actionButton} ${styles.primaryAction}`} aria-disabled="true">
                        상세보기
                      </span>
                      <a
                        href={`https://map.naver.com/p/search/${encodeURIComponent(store.address)}`}
                        target="_blank"
                        rel="noreferrer"
                        className={`${styles.actionButton} ${styles.secondaryAction}`}
                      >
                        길찾기
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.servicesSection}>
              <h2 className={styles.servicesTitle}>매장 서비스</h2>
              <div className={styles.servicesGrid}>
                {services.map((service) => (
                  <div key={service.id} className={styles.serviceItem}>
                    <span className={styles.serviceIcon}>{service.icon}</span>
                    <h3 className={styles.serviceTitle}>{service.title}</h3>
                    <p className={styles.serviceDescription}>{service.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {info && (
              <>
                <div className={styles.hoursSection}>
                  <h2 className={styles.hoursTitle}>운영시간</h2>
                  <div className={styles.hoursGrid}>
                    <HoursCard title="평일/주말 운영시간" rows={info.weekdayHours} />
                    <HoursCard title="부대 서비스 시간" rows={info.serviceHours} />
                  </div>
                </div>

                <div className={styles.specialNotice}>
                  <h3 className={styles.noticeTitle}>방문 안내사항</h3>
                  <p className={styles.noticeText}>
                    {info.noticeLines.map((line) => (
                      <span key={line}>
                        {line}
                        <br />
                      </span>
                    ))}
                  </p>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function HoursCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string; closed?: boolean }>;
}) {
  return (
    <div className={styles.hoursCard}>
      <h3 className={styles.hoursCardTitle}>{title}</h3>
      <div className={styles.hoursTable}>
        {rows.map((row) => (
          <div key={row.label} className={styles.hoursRow}>
            <span className={styles.dayLabel}>{row.label}</span>
            <span className={`${styles.timeLabel} ${row.closed ? styles.closed : ""}`}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
