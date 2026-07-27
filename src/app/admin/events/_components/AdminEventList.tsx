'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Event } from '@/shared/types/event';
import { EventService } from '@/shared/services/eventService';
import Button from '@/app/_components/Button';
import styles from './AdminEventList.module.css';

type AdminEventStatus = 'active' | 'upcoming' | 'ended' | 'inactive';
type StatusFilter = 'all' | AdminEventStatus;
type TypeFilter = 'all' | Event['eventType'];

const EVENT_TYPE_LABELS: Record<Event['eventType'], string> = {
  sale: '세일',
  coupon: '쿠폰',
  special: '특별',
  new: '신상',
};

const STATUS_LABELS: Record<AdminEventStatus, string> = {
  active: '진행중',
  upcoming: '예정',
  ended: '종료',
  inactive: '비활성',
};

export default function AdminEventList() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [filterType, setFilterType] = useState<TypeFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const eventsData = await EventService.getAdminEvents();
      setEvents(eventsData);
    } catch (error) {
      console.error('Error loading events:', error);
      alert('이벤트를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getEventStatus = (event: Event): AdminEventStatus => {
    const now = new Date();
    if (!event.isActive) return 'inactive';
    if (now < event.startDate) return 'upcoming';
    if (now > event.endDate) return 'ended';
    return 'active';
  };

  const filteredEvents = events.filter(event => {
    const status = getEventStatus(event);
    const matchesStatus = filterStatus === 'all' || filterStatus === status;
    
    const matchesType = filterType === 'all' || event.eventType === filterType;
    
    const matchesSearch = searchTerm === '' || 
      event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesStatus && matchesType && matchesSearch;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEvents(filteredEvents.map(event => event.id));
    } else {
      setSelectedEvents([]);
    }
  };

  const handleSelectEvent = (eventId: string, checked: boolean) => {
    if (checked) {
      setSelectedEvents([...selectedEvents, eventId]);
    } else {
      setSelectedEvents(selectedEvents.filter(id => id !== eventId));
    }
  };

  const handleToggleActive = async (eventId: string) => {
    try {
      await EventService.toggleEventStatus(eventId);
      setEvents(events.map(event => 
        event.id === eventId 
          ? { ...event, isActive: !event.isActive }
          : event
      ));
      alert('이벤트 상태가 변경되었습니다.');
    } catch (error) {
      console.error('Error toggling event status:', error);
      alert('이벤트 상태 변경에 실패했습니다.');
    }
  };

  const handleDeleteEvents = async () => {
    if (selectedEvents.length === 0) {
      alert('삭제할 이벤트를 선택해주세요.');
      return;
    }
    
    if (confirm(`선택한 ${selectedEvents.length}개의 이벤트를 삭제하시겠습니까?`)) {
      try {
        await Promise.all(selectedEvents.map(id => EventService.deleteEvent(id)));
        setEvents(events.filter(event => !selectedEvents.includes(event.id)));
        setSelectedEvents([]);
        alert('선택한 이벤트가 삭제되었습니다.');
      } catch (error) {
        console.error('Error deleting events:', error);
        alert('이벤트 삭제에 실패했습니다.');
      }
    }
  };

  const getEventTypeLabel = (type: Event['eventType']) => EVENT_TYPE_LABELS[type];

  if (loading) {
    return (
      <div className={styles.loading}>
        <p>이벤트를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 통계 정보 */}
      <div className={styles.stats}>
        <div className={styles.statItem}>
          <div className={styles.statNumber}>{events.length}</div>
          <div className={styles.statLabel}>전체 이벤트</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statNumber}>
            {events.filter(e => getEventStatus(e) === 'active').length}
          </div>
          <div className={styles.statLabel}>진행중</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statNumber}>
            {events.filter(e => getEventStatus(e) === 'upcoming').length}
          </div>
          <div className={styles.statLabel}>예정</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statNumber}>
            {events.reduce((sum, e) => sum + e.participantCount, 0).toLocaleString()}
          </div>
          <div className={styles.statLabel}>총 참여자</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statNumber}>
            {events.filter(e => getEventStatus(e) === 'ended').length}
          </div>
          <div className={styles.statLabel}>종료</div>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className={styles.controls}>
        <div className={styles.searchSection}>
          <input
            type="text"
            placeholder="이벤트 제목, 설명으로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.filters}>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
            className={styles.statusFilter}
            aria-label="이벤트 상태 필터"
          >
            <option value="all">전체 상태</option>
            <option value="active">진행중</option>
            <option value="upcoming">예정</option>
            <option value="ended">종료</option>
            <option value="inactive">비활성</option>
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as TypeFilter)}
            className={styles.typeFilter}
            aria-label="이벤트 유형 필터"
          >
            <option value="all">전체 유형</option>
            <option value="sale">세일</option>
            <option value="coupon">쿠폰</option>
            <option value="special">특별</option>
            <option value="new">신상</option>
          </select>
        </div>

        <div className={styles.actionSection}>
          <Link href="/admin/events/create">
            <Button variant="primary">새 이벤트 생성</Button>
          </Link>
        </div>
      </div>

      {/* 일괄 작업 */}
      <div className={styles.bulkActions}>
        <label className={styles.selectAll}>
          <input
            type="checkbox"
            checked={selectedEvents.length === filteredEvents.length && filteredEvents.length > 0}
            onChange={(e) => handleSelectAll(e.target.checked)}
          />
          전체 선택 ({selectedEvents.length}개 선택됨)
        </label>

        <div className={styles.actionButtons}>
          <Button
            variant="outline"
            onClick={handleDeleteEvents}
            disabled={selectedEvents.length === 0}
          >
            선택 삭제
          </Button>
        </div>
      </div>

      {/* 이벤트 목록 */}
      <div className={styles.eventList}>
        {filteredEvents.map(event => {
          const status = getEventStatus(event);
          return (
            <div key={event.id} className={styles.eventItem}>
              <div className={styles.eventHeader}>
                <label className={styles.eventSelect}>
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(event.id)}
                    onChange={(e) => handleSelectEvent(event.id, e.target.checked)}
                  />
                </label>

                <div className={styles.eventImage}>
                  <Image
                    src={event.thumbnailImage}
                    alt={event.title}
                    width={80}
                    height={60}
                    className={styles.thumbnail}
                  />
                </div>

                <div className={styles.eventInfo}>
                  <div className={styles.eventTitle}>
                    {event.title}
                    <div className={styles.eventBadges}>
                      <span className={`${styles.typeBadge} ${styles[event.eventType]}`}>
                        {getEventTypeLabel(event.eventType)}
                      </span>
                      <span className={`${styles.statusBadge} ${styles[status]}`}>
                        {STATUS_LABELS[status]}
                      </span>
                    </div>
                  </div>
                  <div className={styles.eventDescription}>{event.description}</div>
                  <div className={styles.eventMeta}>
                    <span className={styles.period}>
                      {event.startDate.toLocaleDateString()} ~ {event.endDate.toLocaleDateString()}
                    </span>
                    <span className={styles.participants}>
                      참여자: {event.participantCount.toLocaleString()}명
                      {event.hasMaxParticipants && event.maxParticipants && event.maxParticipants > 0 ? (
                        <span className={styles.maxParticipants}>
                          / {event.maxParticipants.toLocaleString()}명
                        </span>
                      ) : (
                        <span className={styles.noLimit}>
                          (제한 없음)
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                <div className={styles.eventActions}>
                  <Link href={`/admin/events/${event.id}/edit`}>
                    <Button variant="outline" size="sm">수정</Button>
                  </Link>
                  <Button
                    variant={event.isActive ? "outline" : "primary"}
                    size="sm"
                    onClick={() => handleToggleActive(event.id)}
                  >
                    {event.isActive ? '비활성화' : '활성화'}
                  </Button>
                </div>
              </div>

              <div className={styles.eventDetails}>
                {event.discountRate && event.discountRate > 0 ? (
                  <div className={styles.eventBenefit}>
                    할인율: {event.discountRate}%
                  </div>
                ) : null}
                {event.discountAmount && event.discountAmount > 0 ? (
                  <div className={styles.eventBenefit}>
                    할인 표시 금액: {event.discountAmount.toLocaleString()}원
                  </div>
                ) : null}
                {event.couponCode && (
                  <div className={styles.eventBenefit}>
                    쿠폰코드: {event.couponCode}
                  </div>
                )}
                {event.targetCategories && (
                  <div className={styles.eventBenefit}>
                    대상 카테고리: {event.targetCategories.join(', ')}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredEvents.length === 0 && (
        <div className={styles.emptyState}>
          <p>조건에 맞는 이벤트가 없습니다.</p>
        </div>
      )}
    </div>
  );
}
