"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/authProvider";
import styles from "./page.module.css";
import { AdminUserService, AdminUserData, UserStats, UserFilter, PointOperation } from "@/shared/services/adminUserService";
import { PointHistory } from "@/shared/types/point";
import { downloadUsersCsv } from "./downloadUsersCsv";

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, isUserDataLoading, loading, isAdmin } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [users, setUsers] = useState<AdminUserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<AdminUserData[]>([]);
  const [stats, setStats] = useState<UserStats>({ total: 0, active: 0, admin: 0, newUsers: 0, totalPoints: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPointModal, setShowPointModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserData | null>(null);
  const [pointAmount, setPointAmount] = useState<number>(0);
  const [pointDescription, setPointDescription] = useState<string>('');
  const [pointOperation, setPointOperation] = useState<'add' | 'subtract'>('add');
  const [showUserDetail, setShowUserDetail] = useState(false);
  const [userPointHistory, setUserPointHistory] = useState<PointHistory[]>([]);

  // 사용자 데이터 로드
  const loadUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const filters: UserFilter = {
        searchTerm: searchTerm || undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      };

      const { users: fetchedUsers } = await AdminUserService.getUsers(filters, currentPage, 10);
      
      const userStats = await AdminUserService.getUserStats();
      
      setUsers(fetchedUsers);
      setStats(userStats);
    } catch (err) {
      console.error('Error loading users:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`사용자 데이터를 불러오는데 실패했습니다: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, roleFilter, statusFilter, currentPage]);

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin, loadUsers]);

  // 필터링된 사용자 설정
  useEffect(() => {
    setFilteredUsers(users);
  }, [users]);

  // 권한 체크 및 로딩 상태
  if (loading || isUserDataLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        fontSize: '1.2rem'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '20px' }}></div>
          <p>권한을 확인하는 중...</p>
        </div>
      </div>
    );
  }

  // 로그인하지 않았거나 관리자가 아닌 경우
  if (!user || !isAdmin) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#f8f9fa',
        color: '#dc3545',
        fontSize: '1.1rem'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '20px' }}></div>
          <p>관리자 권한이 필요합니다.</p>
          <button 
            onClick={() => router.push('/auth/login')}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            로그인하기
          </button>
        </div>
      </div>
    );
  }

  const handleStatusChange = async (userId: string, newStatus: 'active' | 'inactive' | 'banned') => {
    try {
      await AdminUserService.updateUserStatus(userId, newStatus);
      await loadUsers(); // 데이터 새로고침
    } catch (error) {
      console.error('Error updating user status:', error);
      alert('사용자 상태 변경에 실패했습니다.');
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'user' | 'admin') => {
    try {
      await AdminUserService.updateUserRole(userId, newRole);
      await loadUsers(); // 데이터 새로고침
    } catch (error) {
      console.error('Error updating user role:', error);
      alert('사용자 역할 변경에 실패했습니다.');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm('정말 이 사용자를 삭제하시겠습니까?')) {
      try {
        await AdminUserService.deleteUser(userId);
        await loadUsers(); // 데이터 새로고침
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('사용자 삭제에 실패했습니다.');
      }
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "active": return "활성";
      case "inactive": return "비활성";
      case "banned": return "정지";
      default: return status;
    }
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case "admin": return "관리자";
      case "user": return "사용자";
      default: return role;
    }
  };

  const formatDate = (date: Date | { toDate: () => Date }) => {
    const dateValue = date instanceof Date ? date : date.toDate();

    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(dateValue);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  const handleExport = async () => {
    try {
      const csvContent = await AdminUserService.exportUsersToCSV();
      downloadUsersCsv(csvContent);
    } catch (error) {
      console.error('Error exporting users:', error);
      alert('사용자 데이터 내보내기에 실패했습니다.');
    }
  };

  const handlePointManagement = (user: AdminUserData) => {
    setSelectedUser(user);
    setShowPointModal(true);
    setPointAmount(0);
    setPointDescription('');
    setPointOperation('add');
  };

  const handlePointUpdate = async () => {
    if (!selectedUser || pointAmount <= 0) {
      alert('올바른 포인트 금액을 입력해주세요.');
      return;
    }

    if (!pointDescription.trim()) {
      alert('포인트 적립/차감 사유를 입력해주세요.');
      return;
    }

    try {
      const operation: PointOperation = {
        userId: selectedUser.id,
        amount: pointAmount,
        description: pointDescription,
        type: pointOperation
      };

      await AdminUserService.updateUserPoints(operation);
      alert(`포인트가 성공적으로 ${pointOperation === 'add' ? '적립' : '차감'}되었습니다.`);
      setShowPointModal(false);
      await loadUsers(); // 데이터 새로고침
    } catch (error) {
      console.error('Error updating points:', error);
      alert('포인트 업데이트에 실패했습니다.');
    }
  };

  const handleUserDetail = async (user: AdminUserData) => {
    try {
      setSelectedUser(user);
      const pointHistory = await AdminUserService.getUserPointHistory(user.id);
      setUserPointHistory(pointHistory);
      setShowUserDetail(true);
    } catch (error) {
      console.error('Error loading user detail:', error);
      alert('사용자 상세 정보를 불러오는데 실패했습니다.');
    }
  };

  const handleBulkPointGift = async () => {
    const amount = prompt('모든 활성 사용자에게 지급할 포인트 금액을 입력하세요:');
    const description = prompt('포인트 지급 사유를 입력하세요:');
    
    if (amount && description && !isNaN(Number(amount))) {
      if (confirm(`모든 활성 사용자에게 ${amount}포인트를 지급하시겠습니까?`)) {
        try {
          const successCount = await AdminUserService.givePointsToAllUsers(Number(amount), description);
          alert(`${successCount}명의 사용자에게 포인트가 지급되었습니다.`);
          await loadUsers();
        } catch (error) {
          console.error('Error giving bulk points:', error);
          alert('일괄 포인트 지급에 실패했습니다.');
        }
      }
    }
  };

  // 페이지네이션
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* 페이지 헤더 */}
        <div className={styles.pageHeader}>
          <h2 className={styles.pageTitle}>사용자 관리</h2>
          <p className={styles.pageSubtitle}>
            전체 사용자 계정을 관리하고 권한을 설정하세요
          </p>
        </div>

        {/* 통계 카드 */}
        <div className={styles.statsCards}>
          <div className={`${styles.statsCard} ${styles.total}`}>
            <div className={styles.statsValue}>{stats.total}</div>
            <div className={styles.statsLabel}>전체 사용자</div>
          </div>
          <div className={`${styles.statsCard} ${styles.active}`}>
            <div className={styles.statsValue}>{stats.active}</div>
            <div className={styles.statsLabel}>활성 사용자</div>
          </div>
          <div className={`${styles.statsCard} ${styles.admin}`}>
            <div className={styles.statsValue}>{stats.admin}</div>
            <div className={styles.statsLabel}>관리자</div>
          </div>
          <div className={`${styles.statsCard} ${styles.newUsers}`}>
            <div className={styles.statsValue}>{stats.newUsers}</div>
            <div className={styles.statsLabel}>신규 가입</div>
          </div>
          <div className={`${styles.statsCard} ${styles.points}`}>
            <div className={styles.statsValue}>{formatCurrency(stats.totalPoints)}</div>
            <div className={styles.statsLabel}>총 포인트</div>
          </div>
        </div>

        {/* 컨트롤 섹션 */}
        <div className={styles.controlsSection}>
          <div className={styles.controlsGrid}>
            <div className={styles.searchBox}>
              <input
                type="text"
                placeholder="이름, 이메일로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.searchInput}
              />
              <span className={styles.searchIcon}></span>
            </div>
            
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">전체 역할</option>
              <option value="user">사용자</option>
              <option value="admin">관리자</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">전체 상태</option>
              <option value="active">활성</option>
              <option value="inactive">비활성</option>
              <option value="banned">정지</option>
            </select>

            <button onClick={handleBulkPointGift} className={styles.pointButton}>
              일괄 포인트 지급
            </button>

            <button onClick={handleExport} className={styles.exportButton}>
              CSV 내보내기
            </button>
          </div>
        </div>

        {/* 사용자 테이블 */}
        <div className={styles.usersTable}>
          <div className={styles.tableHeader}>
            <h3 className={styles.tableTitle}>사용자 목록</h3>
          </div>
          
          {isLoading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
              <p>사용자 데이터를 불러오는 중...</p>
            </div>
          ) : error ? (
            <div className={styles.errorState}>
              <p>{error}</p>
              <button onClick={loadUsers} className={styles.retryButton}>
                다시 시도
              </button>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className={styles.emptyState}>
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <h3>사용자가 없습니다</h3>
                <p>가입한 사용자가 없거나 현재 검색 조건에 맞는 사용자가 없습니다.</p>
                <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
                  <p>현재 검색 조건:</p>
                  <p>검색어: {searchTerm || '없음'}</p>
                  <p>역할: {roleFilter}</p>
                  <p>상태: {statusFilter}</p>
                </div>
                <div style={{ marginTop: '20px', fontSize: '12px', color: '#999', border: '1px solid #eee', padding: '10px', borderRadius: '5px' }}>
                  <h4>디버그 정보:</h4>
                  <p>총 사용자 수: {users.length}</p>
                  <p>필터된 사용자 수: {filteredUsers.length}</p>
                  <p>로딩 상태: {isLoading ? '로딩 중' : '완료'}</p>
                  <p>오류: {error || '없음'}</p>
                </div>
              </div>
            </div>
          ) : (
            <table className={styles.table}>
            <thead>
              <tr>
                <th>사용자</th>
                <th>역할</th>
                <th>상태</th>
                <th>가입일</th>
                <th>마지막 로그인</th>
                <th>주문수</th>
                <th>총 구매액</th>
                <th>포인트 잔액</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {currentUsers.map((userData) => (
                <tr key={userData.id}>
                  <td>
                    <div className={styles.userInfo}>
                      <div className={styles.userAvatar}>
                        {userData.name.charAt(0)}
                      </div>
                      <div>
                        <div className={styles.userName}>{userData.name}</div>
                        <div className={styles.userEmail}>{userData.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`${styles.userRole} ${styles[userData.role]}`}>
                      {getRoleText(userData.role)}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.userStatus} ${styles[userData.status]}`}>
                      {getStatusText(userData.status)}
                    </span>
                  </td>
                  <td>{userData.joinDate}</td>
                  <td>{formatDate(userData.lastLogin)}</td>
                  <td>{userData.orders}건</td>
                  <td><strong>{formatCurrency(userData.totalSpent)}</strong></td>
                  <td>
                    <span className={styles.pointBalance}>
                      {formatCurrency(userData.pointBalance || 0)}
                    </span>
                  </td>
                  <td>
                    <button 
                      className={`${styles.actionButton} ${styles.primary}`}
                      onClick={() => handleUserDetail(userData)}
                    >
                      상세
                    </button>
                    <button 
                      className={`${styles.actionButton} ${styles.point}`}
                      onClick={() => handlePointManagement(userData)}
                    >
                      포인트
                    </button>
                    {userData.status === "active" ? (
                      <button 
                        className={`${styles.actionButton} ${styles.warning}`}
                        onClick={() => handleStatusChange(userData.id, "banned")}
                      >
                        정지
                      </button>
                    ) : userData.status === "banned" ? (
                      <button 
                        className={styles.actionButton}
                        onClick={() => handleStatusChange(userData.id, "active")}
                      >
                        활성화
                      </button>
                    ) : (
                      <button 
                        className={styles.actionButton}
                        onClick={() => handleStatusChange(userData.id, "active")}
                      >
                        활성화
                      </button>
                    )}
                    {userData.role === "user" ? (
                      <button 
                        className={styles.actionButton}
                        onClick={() => handleRoleChange(userData.id, "admin")}
                      >
                        관리자화
                      </button>
                    ) : (
                      <button 
                        className={styles.actionButton}
                        onClick={() => handleRoleChange(userData.id, "user")}
                      >
                        사용자화
                      </button>
                    )}
                    <button 
                      className={`${styles.actionButton} ${styles.danger}`}
                      onClick={() => handleDeleteUser(userData.id)}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>

        {/* 포인트 관리 모달 */}
        {showPointModal && selectedUser && (
          <div className={styles.modal}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h3>포인트 관리 - {selectedUser.name}</h3>
                <button 
                  className={styles.closeButton}
                  onClick={() => setShowPointModal(false)}
                >
                  ✕
                </button>
              </div>
              <div className={styles.modalBody}>
                <p>현재 포인트 잔액: <strong>{formatCurrency(selectedUser.pointBalance || 0)}</strong></p>
                
                <div className={styles.pointOperationSelect}>
                  <label>
                    <input
                      type="radio"
                      value="add"
                      checked={pointOperation === 'add'}
                      onChange={(e) => setPointOperation(e.target.value as 'add')}
                    />
                    포인트 적립
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="subtract"
                      checked={pointOperation === 'subtract'}
                      onChange={(e) => setPointOperation(e.target.value as 'subtract')}
                    />
                    포인트 차감
                  </label>
                </div>

                <div className={styles.inputGroup}>
                  <label>포인트 금액</label>
                  <input
                    type="number"
                    value={pointAmount}
                    onChange={(e) => setPointAmount(Number(e.target.value))}
                    placeholder="포인트 금액을 입력하세요"
                    min="1"
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>적립/차감 사유</label>
                  <textarea
                    value={pointDescription}
                    onChange={(e) => setPointDescription(e.target.value)}
                    placeholder="포인트 적립/차감 사유를 입력하세요"
                    rows={3}
                  />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button 
                  className={styles.cancelButton}
                  onClick={() => setShowPointModal(false)}
                >
                  취소
                </button>
                <button 
                  className={styles.confirmButton}
                  onClick={handlePointUpdate}
                >
                  {pointOperation === 'add' ? '포인트 적립' : '포인트 차감'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 사용자 상세 모달 */}
        {showUserDetail && selectedUser && (
          <div className={styles.modal}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h3>사용자 상세 정보 - {selectedUser.name}</h3>
                <button 
                  className={styles.closeButton}
                  onClick={() => setShowUserDetail(false)}
                >
                  ✕
                </button>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.userDetailInfo}>
                  <div className={styles.detailSection}>
                    <h4>기본 정보</h4>
                    <p><strong>이름:</strong> {selectedUser.name}</p>
                    <p><strong>이메일:</strong> {selectedUser.email}</p>
                    <p><strong>전화번호:</strong> {selectedUser.phone || '미입력'}</p>
                    <p><strong>역할:</strong> {getRoleText(selectedUser.role)}</p>
                    <p><strong>상태:</strong> {getStatusText(selectedUser.status)}</p>
                    <p><strong>가입일:</strong> {selectedUser.joinDate}</p>
                  </div>
                  
                  <div className={styles.detailSection}>
                    <h4>활동 정보</h4>
                    <p><strong>총 주문수:</strong> {selectedUser.orders}건</p>
                    <p><strong>총 구매액:</strong> {formatCurrency(selectedUser.totalSpent)}</p>
                    <p><strong>포인트 잔액:</strong> {formatCurrency(selectedUser.pointBalance || 0)}</p>
                    <p><strong>등급:</strong> {selectedUser.grade || 'bronze'}</p>
                    <p><strong>마지막 로그인:</strong> {formatDate(selectedUser.lastLogin)}</p>
                  </div>
                </div>

                <div className={styles.pointHistorySection}>
                  <h4>포인트 히스토리</h4>
                  <div className={styles.pointHistoryList}>
                    {userPointHistory.length === 0 ? (
                      <p>포인트 히스토리가 없습니다.</p>
                    ) : (
                      userPointHistory.slice(0, 10).map((history, index) => (
                        <div key={index} className={styles.pointHistoryItem}>
                          <div className={styles.historyInfo}>
                            <span className={`${styles.historyType} ${styles[history.type]}`}>
                              {history.type === 'earn' ? '적립' : 
                               history.type === 'use' ? '사용' : 
                               history.type === 'expire' ? '만료' : history.type}
                            </span>
                            <span className={styles.historyDescription}>
                              {history.description}
                            </span>
                          </div>
                          <div className={styles.historyAmount}>
                            <span className={history.type === 'earn' ? styles.positive : styles.negative}>
                              {history.type === 'earn' ? '+' : '-'}{formatCurrency(history.amount)}
                            </span>
                            <span className={styles.historyDate}>
                              {formatDate(history.date)}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button 
                  className={styles.cancelButton}
                  onClick={() => setShowUserDetail(false)}
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button
              className={styles.pageButton}
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              이전
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                className={`${styles.pageButton} ${currentPage === page ? styles.active : ''}`}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            ))}
            
            <button
              className={styles.pageButton}
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
