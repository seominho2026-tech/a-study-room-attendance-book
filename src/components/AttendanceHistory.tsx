import { useState } from 'react';
import { Search, Calendar, RefreshCw, Filter, Trash, AlertCircle } from 'lucide-react';
import { AttendanceRecord } from '../types';
import Modal from './Modal';

interface AttendanceHistoryProps {
  attendanceRecords: AttendanceRecord[];
  onClearRecords: () => void;
  onRefreshRecords: () => void;
}

export default function AttendanceHistory({
  attendanceRecords,
  onClearRecords,
  onRefreshRecords,
}: AttendanceHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // 모달 상태 및 유틸리티
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'info' | 'confirm' | 'alert' | 'success' | 'warning'>('info');
  const [modalOnConfirm, setModalOnConfirm] = useState<(() => void) | null>(null);

  const showAlert = (title: string, message: string, type: 'info' | 'success' | 'warning' | 'alert' = 'info') => {
    setModalTitle(title);
    setModalMessage(message);
    setModalType(type);
    setModalOnConfirm(null);
    setModalOpen(true);
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void, type: 'confirm' | 'warning' | 'alert' = 'confirm') => {
    setModalTitle(title);
    setModalMessage(message);
    setModalType(type);
    setModalOnConfirm(() => onConfirm);
    setModalOpen(true);
  };

  // 전체 및 학년별 통계 계산
  const totalCount = attendanceRecords.length;
  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  let earlyCount = 0;

  // 학년별 출결 데이터 계산 (1학년, 2학년, 3학년)
  const gradeStats = {
    1: { present: 0, absent: 0, late: 0, early: 0 },
    2: { present: 0, absent: 0, late: 0, early: 0 },
    3: { present: 0, absent: 0, late: 0, early: 0 },
  };

  attendanceRecords.forEach((r) => {
    if (r.status === '출석') presentCount++;
    else if (r.status === '결석') absentCount++;
    else if (r.status === '지각') lateCount++;
    else if (r.status === '조퇴') earlyCount++;

    // 학년별 파싱 및 누적
    let gradeNum = 0;
    if (r.gradeClassNo && r.gradeClassNo.includes('-')) {
      const g = parseInt(r.gradeClassNo.split('-')[0], 10);
      if (g >= 1 && g <= 3) gradeNum = g;
    } else if (r.studentId && r.studentId.length >= 5) {
      const g = parseInt(r.studentId[0], 10);
      if (g >= 1 && g <= 3) gradeNum = g;
    }

    if (gradeNum === 1 || gradeNum === 2 || gradeNum === 3) {
      const stats = gradeStats[gradeNum as 1 | 2 | 3];
      if (r.status === '출석') stats.present++;
      else if (r.status === '결석') stats.absent++;
      else if (r.status === '지각') stats.late++;
      else if (r.status === '조퇴') stats.early++;
    }
  });

  // 필터 적용 (역순 - 최신 기록순)
  const filteredRecords = [...attendanceRecords]
    .reverse()
    .filter((r) => {
      const matchSearch =
        r.studentName.includes(searchQuery) ||
        r.studentId.includes(searchQuery);
      const matchStatus = !statusFilter || r.status === statusFilter;
      const matchDate = !dateFilter || r.date === dateFilter;

      return matchSearch && matchStatus && matchDate;
    });

  const handleResetData = () => {
    showConfirm(
      '데이터 초기화 확인',
      '주의: 모든 정독실 출석 로컬 테스트 데이터를 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.',
      () => {
        onClearRecords();
        showAlert('초기화 완료', '모든 출석 기록 데이터가 정상적으로 초기화되었습니다.', 'success');
      },
      'alert'
    );
  };

  return (
    <div className="space-y-6" id="history-section-root">
      {/* 학년별 누적 통계 보드 - Grade-by-grade stats as requested */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl" id="accumulated-stats-card">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            학년별 누적 출결 통계
          </h3>
          <button
            onClick={onRefreshRecords}
            className="text-xs bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all font-black shadow-sm cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            통계 새로고침
          </button>
        </div>

        {/* 학년별 출결 통계 (1학년, 2학년, 3학년 각각 출석/결석) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((g) => {
            const stats = gradeStats[g as 1 | 2 | 3];
            return (
              <div key={g} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between hover:border-blue-200 hover:bg-blue-50/10 transition-all shadow-sm">
                <div className="text-xs font-black text-slate-800 border-b border-slate-200/80 pb-2 mb-3 flex justify-between items-center">
                  <span className="text-blue-600 text-sm font-black">{g}학년 통계</span>
                  <span className="text-[10px] text-slate-400 font-bold">누적 이력 기준</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5 text-center">
                  <div className="bg-emerald-100/40 border border-emerald-100/70 py-2.5 rounded-xl">
                    <div className="text-xl font-black text-emerald-700 leading-tight">{stats.present}</div>
                    <div className="text-[10px] font-bold text-emerald-600 mt-0.5">출석</div>
                  </div>
                  <div className="bg-rose-100/40 border border-rose-100/70 py-2.5 rounded-xl">
                    <div className="text-xl font-black text-rose-700 leading-tight">{stats.absent}</div>
                    <div className="text-[10px] font-bold text-rose-600 mt-0.5">결석</div>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-200/60 text-[10px] font-bold text-slate-400">
                  <span>지각: <b className="text-slate-600">{stats.late}</b></span>
                  <span>조퇴: <b className="text-slate-600">{stats.early}</b></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 필터 세팅 - Custom vibrant Inputs */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-md" id="history-filter-card">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 이름 학번 검색 */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
              <Search className="w-4 h-4 text-slate-400" />
            </span>
            <input
              type="text"
              placeholder="학생 이름, 학번 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all text-slate-800 placeholder:text-slate-400"
            />
          </div>

          {/* 상태 필터 */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
              <Filter className="w-4 h-4 text-slate-400" />
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all text-slate-800 cursor-pointer"
            >
              <option value="">모든 출석 상태</option>
              <option value="출석">출석</option>
              <option value="결석">결석</option>
              <option value="지각">지각</option>
              <option value="조퇴">조퇴</option>
            </select>
          </div>

          {/* 날짜 필터 */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
              <Calendar className="w-4 h-4 text-slate-400" />
            </span>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all text-slate-800"
            />
          </div>
        </div>
      </div>

      {/* 출결 테이블 리스트 - Vibrant Header and Clean layout */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col" id="history-records-card">
        <div className="p-5 border-b border-slate-150 bg-slate-50 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-700">
            총 <b className="text-blue-700 font-black bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100 ml-1 text-xs inline-block">{filteredRecords.length}건</b> 검색됨
          </span>
          {totalCount > 0 && (
            <button
              onClick={handleResetData}
              className="text-xs font-black text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3.5 py-2 rounded-xl border border-red-100 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Trash className="w-4 h-4" />
              로컬 테스트 데이터 전체 삭제
            </button>
          )}
        </div>

        <div className="overflow-y-auto max-h-[380px]" id="history-table-container">
          <table className="w-full text-center border-collapse text-xs md:text-sm">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-150 text-slate-500 font-black tracking-wider uppercase z-10">
              <tr>
                <th className="py-3 px-4">일자(교시)</th>
                <th className="py-3 px-2">학번</th>
                <th className="py-3 px-4 text-left">학생 성명</th>
                <th className="py-3 px-4">출결 상태</th>
                <th className="py-3 px-4 text-left">비고 (사유)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-slate-400 text-center font-bold">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300 animate-pulse" />
                    {searchQuery || statusFilter || dateFilter
                      ? '필터 조건에 부합하는 출결 기록이 없습니다.'
                      : '아직 기록된 출결 이력이 존재하지 않습니다. 첫 출석 체크를 마친 후 저장해 주세요.'}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  let badgeStyle = 'bg-slate-100 text-slate-700';
                  if (record.status === '출석') badgeStyle = 'bg-emerald-500 text-white font-black shadow-sm';
                  else if (record.status === '결석') badgeStyle = 'bg-rose-500 text-white font-black shadow-sm';
                  else if (record.status === '지각') badgeStyle = 'bg-amber-500 text-slate-900 font-black shadow-sm';
                  else if (record.status === '조퇴') badgeStyle = 'bg-sky-500 text-slate-900 font-black shadow-sm';

                  return (
                    <tr key={record.id} className="hover:bg-sky-50/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-500 font-bold text-center">
                        {record.date} <span className="font-black text-slate-800 font-sans">({record.period}교시)</span>
                      </td>
                      <td className="py-3.5 px-2 font-mono text-slate-500 font-bold text-center">
                        <span className="bg-slate-50 border border-slate-200 px-2.5 py-0.5 rounded-md font-bold text-xs">{record.studentId}</span>
                      </td>
                      <td className="py-3.5 px-4 text-left">
                        <div className="font-black text-slate-800 text-base">{record.studentName}</div>
                        <div className="text-[10px] text-slate-400 font-bold block sm:inline">
                          {record.gradeClassNo}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-3.5 py-1.5 rounded-full text-xs inline-block text-center ${badgeStyle}`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-left font-bold text-xs">
                        {record.remark ? (
                          <span className={`px-2.5 py-1 rounded-lg text-xs max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap inline-block ${
                            record.status === '결석'
                              ? 'bg-rose-50 border border-rose-100 text-rose-800'
                              : record.status === '조퇴'
                              ? 'bg-sky-50 border border-sky-100 text-sky-800'
                              : record.status === '지각'
                              ? 'bg-amber-50 border border-amber-100 text-amber-800'
                              : 'bg-slate-50 border border-slate-100 text-slate-700'
                          }`} title={record.remark}>
                            {record.remark}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        type={modalType}
        onConfirm={modalOnConfirm || undefined}
        confirmLabel="확인"
        cancelLabel="취소"
      >
        {modalMessage}
      </Modal>
    </div>
  );
}
