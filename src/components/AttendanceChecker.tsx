import { useState, useEffect } from 'react';
import { Calendar, Database, Info } from 'lucide-react';
import { Student, AttendanceStatus, AttendanceRecord } from '../types';
import Modal from './Modal';

interface AttendanceCheckerProps {
  students: Student[];
  attendanceRecords: AttendanceRecord[];
  onSaveAttendance: (records: Omit<AttendanceRecord, 'id' | 'timestamp'>[]) => Promise<{ success: boolean; inserted: number; updated: number }>;
}

export default function AttendanceChecker({
  students,
  attendanceRecords,
  onSaveAttendance,
}: AttendanceCheckerProps) {
  // 날짜 설정 (기본값 오늘)
  const [date, setDate] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  // 요일 설정 (기본값 오늘 요일, 주말은 월요일)
  const [dayOfWeek, setDayOfWeek] = useState<string>(() => {
    const today = new Date();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const currentDay = days[today.getDay()];
    return ['월', '화', '수', '목', '금'].includes(currentDay) ? currentDay : '월';
  });

  // 현 세션 출석 맵 (학번 -> { 교시: 상태 })
  const [attendanceMap, setAttendanceMap] = useState<Record<string, Record<number, '출석' | '결석'>>>({});
  // 현 세션 비고 맵 (학번 -> 비고 사유)
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>({});

  // 학년 필터 상태: '' (전체), '1' (1학년), '2' (2학년), '3' (3학년)
  const [gradeFilter, setGradeFilter] = useState<string>('');

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

  // 날짜 선택이 바뀔 때 자동으로 요일을 매칭해주는 기능
  const handleDateChange = (newDateStr: string) => {
    setDate(newDateStr);
    if (!newDateStr) return;
    const d = new Date(newDateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const currentDay = days[d.getDay()];
    if (['월', '화', '수', '목', '금'].includes(currentDay)) {
      setDayOfWeek(currentDay);
    }
  };

  // 날짜나 학생 목록이 바뀔 때 기존 기록이 스프레드시트/이력에 있는지 확인하여 바인딩
  useEffect(() => {
    const tempMap: Record<string, Record<number, '출석' | '결석'>> = {};
    const tempRemarksMap: Record<string, string> = {};

    // 1. 학생 목록 기준으로 초기화
    students.forEach((s) => {
      tempMap[s.studentId] = {
        1: '출석',
        2: '출석',
        3: '출석',
        4: '출석',
        5: '출석',
        6: '출석',
        7: '출석'
      };
      tempRemarksMap[s.studentId] = '';
    });

    // 2. 해당 날짜에 해당하는 기존 출석 정보 검색
    const existingRecords = attendanceRecords.filter(
      (r) => r.date === date
    );

    // 3. 기록이 존재하면 맵에 반영
    existingRecords.forEach((r) => {
      if (tempMap[r.studentId] !== undefined && r.period >= 1 && r.period <= 7) {
        // 기존 상태가 결석/지각/조퇴 등인 경우 결석으로 처리, 아니면 출석
        const statusVal: '출석' | '결석' = (r.status === '결석' || r.status === '지각' || r.status === '조퇴') ? '결석' : '출석';
        tempMap[r.studentId][r.period] = statusVal;
        if (r.remark) {
          tempRemarksMap[r.studentId] = r.remark;
        }
      }
    });

    setAttendanceMap(tempMap);
    setRemarksMap(tempRemarksMap);
  }, [date, students, attendanceRecords]);

  // 개별 교시 출결 상태 전환 (출석 <-> 결석)
  const togglePeriodStatus = (studentId: string, periodNum: number) => {
    setAttendanceMap((prev) => {
      const studentPeriods = prev[studentId] ? { ...prev[studentId] } : {
        1: '출석', 2: '출석', 3: '출석', 4: '출석', 5: '출석', 6: '출석', 7: '출석'
      };
      const currentStatus = studentPeriods[periodNum] || '출석';
      const newStatus = currentStatus === '출석' ? '결석' : '출석';
      return {
        ...prev,
        [studentId]: {
          ...studentPeriods,
          [periodNum]: newStatus,
        },
      };
    });
  };

  // 개별 비고 변경 핸들러
  const changeRemark = (studentId: string, remark: string) => {
    setRemarksMap((prev) => ({
      ...prev,
      [studentId]: remark,
    }));
  };

  // 일괄 처리: 전원 특정 상태로 변경
  const setAllStatus = (status: '출석' | '결석') => {
    const updated = { ...attendanceMap };
    students.forEach((s) => {
      updated[s.studentId] = {
        1: status,
        2: status,
        3: status,
        4: status,
        5: status,
        6: status,
        7: status
      };
    });
    setAttendanceMap(updated);
  };

  // 구글 시트에 출석부 저장 실행
  const handleSave = async () => {
    if (!date || !dayOfWeek) {
      showAlert('입력 오류', '날짜와 요일을 올바르게 지정해주세요.', 'warning');
      return;
    }

    const recordsToSubmit: Omit<AttendanceRecord, 'id' | 'timestamp'>[] = [];

    students.forEach((s) => {
      const studentPeriods = attendanceMap[s.studentId] || {
        1: '출석', 2: '출석', 3: '출석', 4: '출석', 5: '출석', 6: '출석', 7: '출석'
      };
      for (let p = 1; p <= 7; p++) {
        const status = studentPeriods[p] || '출석';
        recordsToSubmit.push({
          date,
          dayOfWeek,
          period: p,
          studentId: s.studentId,
          studentName: s.name,
          gradeClassNo: `${s.grade}-${s.classNum}-${s.number}`,
          status,
          remark: remarksMap[s.studentId] || '',
        });
      }
    });

    if (recordsToSubmit.length === 0) {
      showAlert('저장 오류', '저장할 출결 대상 학생이 없습니다.', 'warning');
      return;
    }

    const performSave = async () => {
      const response = await onSaveAttendance(recordsToSubmit);
      if (response.success) {
        showAlert(
          '저장 성공',
          `🎉 구글 시트 저장 성공!\n\n` +
          `- 총 반영된 출결 정보: ${response.inserted + response.updated}건 (1~7교시 일괄 반영 완료)\n\n` +
          `수정 사항이 스프레드시트에 즉각 반영되었습니다.`,
          'success'
        );
      } else {
        showAlert('저장 실패', '저장 도중 알 수 없는 에러가 발생했습니다.', 'alert');
      }
    };

    performSave();
  };

  // 통계 계산 (선택된 학년에 맞게 동적 계산)
  const statsStudents = gradeFilter === ''
    ? students
    : students.filter((s) => String(s.grade) === gradeFilter);

  const totalStudents = statsStudents.length;
  let presentCount = 0; // 전원 출석 학생 수
  let absentCount = 0;  // 결석이 1개라도 있는 학생 수

  statsStudents.forEach((s) => {
    const studentPeriods = attendanceMap[s.studentId] || {
      1: '출석', 2: '출석', 3: '출석', 4: '출석', 5: '출석', 6: '출석', 7: '출석'
    };
    let hasAbsent = false;
    for (let p = 1; p <= 7; p++) {
      if (studentPeriods[p] === '결석') {
        hasAbsent = true;
        break;
      }
    }
    if (hasAbsent) {
      absentCount++;
    } else {
      presentCount++;
    }
  });

  // 필터링 적용된 학생들
  const filteredStudents = gradeFilter === ''
    ? students
    : students.filter((s) => String(s.grade) === gradeFilter);

  return (
    <div className="space-y-2.5" id="attendance-checker-root">
      {/* 셋업 및 요약 정보 바 - Vibrant Amber & White Combo */}
      <div className="bg-amber-50 py-1.5 px-3.5 rounded-2xl border border-amber-300 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3" id="setup-card">
        <div className="flex flex-row gap-2 items-center bg-white p-1 rounded-xl shadow-sm border border-amber-200 w-full md:w-auto justify-between sm:justify-start">
          {/* 일자 */}
          <div className="flex flex-col px-2.5 py-0.5">
            <label className="text-[9px] font-bold text-amber-600 uppercase tracking-widest flex items-center gap-1">
              <Calendar className="w-2.5 h-2.5" /> Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              className="text-xs font-black bg-transparent outline-none cursor-pointer text-slate-800"
            />
          </div>

          <div className="block w-px h-6 bg-amber-200"></div>

          {/* 요일 */}
          <div className="flex flex-col px-2.5 py-0.5">
            <label className="text-[9px] font-bold text-amber-600 uppercase tracking-widest">Day</label>
            <span className="text-xs font-black text-slate-700">
              {dayOfWeek}요일 ({dayOfWeek === '월' ? 'MON' : dayOfWeek === '화' ? 'TUE' : dayOfWeek === '수' ? 'WED' : dayOfWeek === '목' ? 'THU' : 'FRI'})
            </span>
          </div>
        </div>

        {/* 학년 필터 선택 칩 (사용자가 표시한 파란 상자 영역) */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl shadow-sm border border-amber-200" id="grade-filter-chips">
          {[
            { value: '', label: '전체' },
            { value: '1', label: '1학년' },
            { value: '2', label: '2학년' },
            { value: '3', label: '3학년' },
          ].map((tab) => {
            const isActive = gradeFilter === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setGradeFilter(tab.value)}
                className={`text-[11px] font-black px-3 py-1 rounded-lg transition-all shrink-0 cursor-pointer border-0 ${
                  isActive
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 출석 현황 통계 배지 - Vibrant Accent Colors */}
        <div className="flex items-center gap-1.5 text-xs font-black shrink-0">
          <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-200 shadow-sm">전원 출석: {presentCount}명</span>
          <span className="bg-rose-100 text-rose-700 px-2.5 py-1 rounded-lg border border-rose-200 shadow-sm">결석 있음: {absentCount}명</span>
        </div>
      </div>

      {/* 도움말 배너 */}
      <div className="bg-blue-50 border border-blue-100 py-1.5 px-3 rounded-xl flex items-center gap-2 text-blue-900 text-[11px] font-bold leading-relaxed">
        <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
        <span>💡 <b>출결 토글 가이드</b>: 각 학생의 교시 번호 버튼을 누르면 <b>출석</b>과 <b>결석</b>이 전환됩니다. (<span className="text-emerald-600 font-extrabold">초록색은 출석</span>, <span className="text-rose-600 font-extrabold">빨간색은 결석</span> 상태입니다.)</span>
      </div>

      {/* 리스트 목록 - Vibrant Grid Table layout */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden flex flex-col" id="attendance-list-grid">
        {students.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <Info className="w-8 h-8 mx-auto text-slate-300" />
            <p className="font-bold text-sm text-slate-600">아직 등록된 정독실 학생이 없습니다.</p>
            <p className="text-[11px] text-slate-400">상단의 '학생 관리' 탭에서 학생 명단을 먼저 입력해 주세요.</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <p className="text-xs font-bold">선택한 필터 조건에 부합하는 학생이 없습니다.</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-slate-100">
            {/* 테이블 헤더 */}
            <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-150 py-2.5 px-3.5 font-black text-[11px] text-slate-500 uppercase tracking-wider text-center">
              <div className="col-span-1 text-left pl-1">번호</div>
              <div className="col-span-1">학번</div>
              <div className="col-span-2 text-left pl-2">성명</div>
              <div className="col-span-6 flex justify-around px-1 font-black text-slate-500">
                <span>1교시</span>
                <span>2교시</span>
                <span>3교시</span>
                <span>4교시</span>
                <span>5교시</span>
                <span>6교시</span>
                <span>7교시</span>
              </div>
              <div className="col-span-2 text-left pl-3">비고 (사유)</div>
            </div>

            {/* 행 출력 */}
            {filteredStudents.map((s, index) => {
              const formattedIndex = String(index + 1).padStart(2, '0');

              return (
                <div
                  key={s.studentId}
                  className="grid grid-cols-12 py-3 px-3.5 items-center hover:bg-sky-50/40 transition-colors"
                  id={`checker-item-${s.studentId}`}
                >
                  {/* 번호 */}
                  <div className="col-span-1 font-black text-slate-400 text-left pl-1 text-xs">
                    {formattedIndex}
                  </div>

                  {/* 학번 */}
                  <div className="col-span-1 font-mono text-[11px] text-center font-bold text-slate-600 bg-slate-50 px-1 py-0.5 rounded max-w-[70px] mx-auto text-ellipsis overflow-hidden whitespace-nowrap">
                    {s.studentId}
                  </div>

                  {/* 성명 */}
                  <div className="col-span-2 text-left pl-2">
                    <div className="font-black text-slate-900 text-sm leading-tight">{s.name}</div>
                  </div>

                  {/* 상태 선택 버튼 (1~7교시) */}
                  <div className="col-span-6 flex justify-around gap-0.5 px-1">
                    {[1, 2, 3, 4, 5, 6, 7].map((p) => {
                      const studentPeriods = attendanceMap[s.studentId] || {
                        1: '출석', 2: '출석', 3: '출석', 4: '출석', 5: '출석', 6: '출석', 7: '출석'
                      };
                      const currentPStatus = studentPeriods[p] || '출석';
                      return (
                        <button
                          key={p}
                          onClick={() => togglePeriodStatus(s.studentId, p)}
                          className={`w-7 h-7 rounded-full text-xs font-black flex items-center justify-center transition-all cursor-pointer border-0 shadow-sm hover:scale-110 active:scale-95 ${
                            currentPStatus === '출석'
                              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                              : 'bg-rose-500 text-white hover:bg-rose-600 animate-pulse-subtle'
                          }`}
                          title={`${p}교시: ${currentPStatus}`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>

                  {/* 비고란 */}
                  <div className="col-span-2 pl-3 flex items-center">
                    <input
                      type="text"
                      value={remarksMap[s.studentId] || ''}
                      onChange={(e) => changeRemark(s.studentId, e.target.value)}
                      placeholder="비고 입력"
                      className="w-full bg-slate-50 border-2 rounded-lg px-2 py-1 text-[11px] font-bold outline-none transition-all placeholder:text-slate-400 border-slate-200 focus:border-blue-300 focus:bg-white"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 테이블 푸터 정보 */}
        {students.length > 0 && (
          <div className="py-1.5 px-3.5 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-[10px] font-bold text-slate-400">
            <span>보이는 학생: {filteredStudents.length} / 전체: {students.length}</span>
            <div className="flex gap-1">
              <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">1</span>
            </div>
          </div>
        )}
      </div>

      {/* 최종 시트 저장 영역 - Bottom Bar styled with Vibrant Amber Save */}
      {students.length > 0 && (
        <div className="bg-white p-3 shadow-[0_-2px_10px_rgba(0,0,0,0.03)] border border-slate-100 rounded-2xl flex flex-row items-center justify-between gap-3" id="attendance-submit-section">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-black text-slate-500">구글 스프레드시트 동기화 준비 완료</span>
          </div>

          <button
            onClick={handleSave}
            className="px-6 py-2 bg-amber-500 text-white rounded-xl font-black text-sm shadow hover:bg-amber-600 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 cursor-pointer border-0 animate-pulse-subtle"
          >
            <Database className="w-4 h-4 text-white" />
            <span>정독실 1~7교시 출결 저장하기</span>
          </button>
        </div>
      )}

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
