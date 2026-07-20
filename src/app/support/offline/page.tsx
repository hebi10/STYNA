"use client";

import { useEffect, useState } from "react";
import {
  OfflineInfoContent,
  OfflineServiceContent,
  OfflineStoreContent,
  SiteContentService,
} from "@/shared/services/siteContentService";
import styles from "./page.module.css";

export default function OfflinePage() {
  const [stores, setStores] = useState<OfflineStoreContent[]>([]);
  const [services, setServices] = useState<OfflineServiceContent[]>([]);
  const [info, setInfo] = useState<OfflineInfoContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      SiteContentService.getOfflineStores(),
      SiteContentService.getOfflineServices(),
      SiteContentService.getOfflineInfo(),
    ])
      .then(([nextStores, nextServices, nextInfo]) => {
        setStores(nextStores);
        setServices(nextServices);
        setInfo(nextInfo);
      })
      .catch((err) => {
        console.error("오프라인 매장 정보 조회 실패:", err);
        setError("매장 정보를 불러오지 못했습니다.");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>오프라인 매장</h1>
          <p className={styles.pageDescription}>
            포트폴리오 데모용 가상 매장 정보입니다. 실제 방문이나 구매는 제공하지 않습니다.
          </p>
        </div>

        {loading && <div className={styles.specialNotice}>매장 정보를 불러오는 중입니다.</div>}
        {error && <div className={styles.specialNotice}>{error}</div>}

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
