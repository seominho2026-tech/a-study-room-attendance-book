import { useState, useEffect } from 'react';
import { Sun, CalendarCheck, UserPlus, History, Code, ArrowRight, Database, RefreshCw, AlertCircle, Check, ExternalLink, Info } from 'lucide-react';
import { Student, AttendanceRecord } from './types';
import StudentManager from './components/StudentManager';
import AttendanceChecker from './components/AttendanceChecker';
import AttendanceHistory from './components/AttendanceHistory';
import GASGuide from './components/GASGuide';

// 초기 모의 학생 명단 (초보 교사가 앱 로드 시 바로 테스트할 수 있도록 제공)
const MOCK_STUDENTS: Student[] = [
  { id: '1', grade: 1, classNum: 1, number: 1, name: '강백호', studentId: '10101' },
  { id: '2', grade: 1, classNum: 1, number: 2, name: '서태웅', studentId: '10102' },
  { id: '3', grade: 2, classNum: 1, number: 10, name: '송태섭', studentId: '20110' },
  { id: '4', grade: 2, classNum: 2, number: 14, name: '정대만', studentId: '20214' },
  { id: '5', grade: 3, classNum: 1, number: 4, name: '채치수', studentId: '30104' },
  { id: '6', grade: 3, classNum: 1, number: 11, name: '신준섭', studentId: '30111' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'checker' | 'students' | 'history' | 'gas_guide'>('checker');
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

  // 구글 시트 연동 정보 상태
  const [webAppUrl, setWebAppUrl] = useState<string>(() => {
    return localStorage.getItem('gas_webapp_url') || '';
  });
  const [isLiveMode, setIsLiveMode] = useState<boolean>(() => {
    return localStorage.getItem('gas_live_mode') === 'true';
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });

  // 학생 학번을 안전하게 정규화하여 중복 및 빈값 방지
  const normalizeStudentsList = (studentList: Student[]): Student[] => {
    const seenIds = new Set<string>();
    return studentList.map((s, idx) => {
      let sid = String(s.studentId || '').trim();
      if (!sid || sid === 'undefined' || sid === 'null' || sid === '-' || sid === '—') {
        const g = Number(s.grade) || 3; // 기본값 3학년
        const c = String(s.classNum || 1).padStart(2, '0');
        const n = String(s.number || 0).padStart(2, '0');
        sid = `${g}${c}${n}`;
      }
      
      // 중복 방지 (완벽한 고유화)
      let finalSid = sid;
      let counter = 1;
      while (seenIds.has(finalSid)) {
        counter++;
        finalSid = `${sid}_${counter}`;
      }
      seenIds.add(finalSid);

      return {
        ...s,
        grade: Number(s.grade) || 3,
        classNum: Number(s.classNum) || 1,
        number: Number(s.number) || 0,
        name: s.name || '무명학생',
        studentId: finalSid,
      };
    });
  };

  // 구글 시트에서 최신 학생 및 출석 데이터 동기화
  const handleFetchFromSheet = async (urlToUse = webAppUrl): Promise<{ success: boolean; error?: string }> => {
    if (!urlToUse) {
      setSyncStatus({ type: 'error', message: '구글 Apps Script 웹 앱 URL이 등록되지 않았습니다.' });
      return { success: false, error: '구글 Apps Script 웹 앱 URL이 등록되지 않았습니다.' };
    }
    setIsSyncing(true);
    setSyncStatus({ type: '', message: '' });
    try {
      // 1. 학생 데이터 로드
      const studentsRes = await fetch(`${urlToUse}?action=getStudents`);
      const studentsJson = await studentsRes.json();
      if (!studentsJson.success) {
        throw new Error(studentsJson.error || '스프레드시트에서 학생 목록을 불러오는데 실패했습니다.');
      }

      // 2. 출석 데이터 로드
      const attendanceRes = await fetch(`${urlToUse}?action=getAllAttendanceHistory`);
      const attendanceJson = await attendanceRes.json();
      if (!attendanceJson.success) {
        throw new Error(attendanceJson.error || '스프레드시트에서 출석 기록을 불러오는데 실패했습니다.');
      }

      const rawStudents = (studentsJson.data || []).map((s: any, idx: number) => ({
        id: s.id || `sheet_s_${idx}`,
        grade: Number(s.grade),
        classNum: Number(s.classNum),
        number: Number(s.number),
        name: s.name,
        studentId: String(s.studentId || ''),
      }));

      const fetchedStudents = normalizeStudentsList(rawStudents);

      const fetchedRecords = (attendanceJson.data || []).map((r: any, idx: number) => {
        let sid = String(r.studentId || '').trim();
        if (!sid || sid === 'undefined' || sid === 'null' || sid === '-' || sid === '—') {
          const matchingStudent = fetchedStudents.find((st) => st.name === r.name || st.name === r.studentName);
          if (matchingStudent) {
            sid = matchingStudent.studentId;
          } else {
            const g = Number(r.grade) || 3;
            const c = String(r.classNum || 1).padStart(2, '0');
            const n = String(r.number || 0).padStart(2, '0');
            sid = `${g}${c}${n}`;
          }
        }
        const matchingStudent = fetchedStudents.find((st) => st.studentId === sid);
        const gradeClassNo = matchingStudent 
          ? `${matchingStudent.grade}-${matchingStudent.classNum}-${matchingStudent.number}`
          : r.gradeClassNo || '';
        const studentName = r.studentName || r.name || (matchingStudent ? matchingStudent.name : '');

        return {
          id: r.id || `sheet_r_${idx}`,
          date: r.date,
          dayOfWeek: r.dayOfWeek,
          period: Number(r.period),
          studentId: sid,
          studentName: studentName,
          gradeClassNo: gradeClassNo,
          status: r.status as any,
          timestamp: r.timestamp,
          remark: r.remark || '',
        };
      });

      // 로컬 스토리지 저장 및 상태 업데이트
      setStudents(fetchedStudents);
      setAttendanceRecords(fetchedRecords);
      localStorage.setItem('school_students', JSON.stringify(fetchedStudents));
      localStorage.setItem('school_attendance', JSON.stringify(fetchedRecords));

      setSyncStatus({ type: 'success', message: '구글 스프레드시트와 실시간 동기화가 완료되었습니다!' });
      return { success: true };
    } catch (err: any) {
      console.error('Fetch error:', err);
      setSyncStatus({ type: 'error', message: err.message || '네트워크 오류가 발생했습니다. 웹 앱 배포 URL 및 CORS 설정을 확인하세요.' });
      return { success: false, error: err.message || '네트워크 오류가 발생했습니다.' };
    } finally {
      setIsSyncing(false);
    }
  };

  // 1. 컴포넌트 마운트 시 로컬스토리지 복원 및 Live Sync 시도
  useEffect(() => {
    const savedStudents = localStorage.getItem('school_students');
    const savedRecords = localStorage.getItem('school_attendance');

    if (savedStudents) {
      setStudents(normalizeStudentsList(JSON.parse(savedStudents)));
    } else {
      setStudents(normalizeStudentsList(MOCK_STUDENTS));
      localStorage.setItem('school_students', JSON.stringify(normalizeStudentsList(MOCK_STUDENTS)));
    }

    if (savedRecords) {
      setAttendanceRecords(JSON.parse(savedRecords));
    }

    if (isLiveMode && webAppUrl) {
      handleFetchFromSheet(webAppUrl);
    }
  }, []);

  // 2. 학생 등록 핸들러 (개별 추가)
  const handleAddStudent = async (newStudent: Omit<Student, 'id'>): Promise<{ success: boolean; error?: string }> => {
    // 학번 중복 확인
    const isDuplicate = students.some((s) => s.studentId === newStudent.studentId);
    if (isDuplicate) {
      return { success: false, error: `이미 동일한 학번(${newStudent.studentId})을 가진 학생이 존재합니다.` };
    }

    if (isLiveMode && webAppUrl) {
      setIsSyncing(true);
      try {
        const url = `${webAppUrl}?action=addStudent&student=${encodeURIComponent(JSON.stringify(newStudent))}`;
        const res = await fetch(url);
        const json = await res.json();
        if (!json.success) {
          return { success: false, error: json.error || '구글 시트에 학생을 추가하는 도중 에러가 발생했습니다.' };
        }
        await handleFetchFromSheet(webAppUrl);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message || '웹 앱 연결 실패로 등록하지 못했습니다. 주소 또는 네트워크를 확인하세요.' };
      } finally {
        setIsSyncing(false);
      }
    } else {
      const createdStudent: Student = {
        ...newStudent,
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      };

      const updatedStudents = normalizeStudentsList([...students, createdStudent]).sort((a, b) => {
        return Number(a.studentId) - Number(b.studentId);
      });

      setStudents(updatedStudents);
      localStorage.setItem('school_students', JSON.stringify(updatedStudents));
      return { success: true };
    }
  };

  // 3. 학생 일괄 등록 핸들러 (벌크 추가)
  const handleAddStudentsBulk = async (
    newList: Omit<Student, 'id'>[]
  ): Promise<{ addedCount: number; skippedCount: number }> => {
    if (isLiveMode && webAppUrl) {
      setIsSyncing(true);
      try {
        const url = `${webAppUrl}?action=addStudentsBulk&studentList=${encodeURIComponent(JSON.stringify(newList))}`;
        const res = await fetch(url);
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || '구글 시트 일괄 등록에 실패했습니다.');
        }
        await handleFetchFromSheet(webAppUrl);
        return { addedCount: json.addedCount || 0, skippedCount: json.skippedCount || 0 };
      } catch (err) {
        console.error(err);
      } finally {
        setIsSyncing(false);
      }
    }

    let addedCount = 0;
    let skippedCount = 0;
    const currentStudents = [...students];

    newList.forEach((newS) => {
      const isDuplicate = currentStudents.some((s) => s.studentId === newS.studentId);
      if (isDuplicate) {
        skippedCount++;
      } else {
        currentStudents.push({
          ...newS,
          id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
        });
        addedCount++;
      }
    });

    const sortedStudents = normalizeStudentsList(currentStudents).sort((a, b) => Number(a.studentId) - Number(b.studentId));
    setStudents(sortedStudents);
    localStorage.setItem('school_students', JSON.stringify(sortedStudents));

    return { addedCount, skippedCount };
  };

  // 4. 학생 삭제 핸들러
  const handleDeleteStudent = async (studentId: string): Promise<boolean> => {
    if (isLiveMode && webAppUrl) {
      setIsSyncing(true);
      try {
        const url = `${webAppUrl}?action=deleteStudent&studentId=${encodeURIComponent(studentId)}`;
        const res = await fetch(url);
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || '구글 시트에서 삭제에 실패했습니다.');
        }
        await handleFetchFromSheet(webAppUrl);
        return true;
      } catch (err) {
        console.error(err);
        return false;
      } finally {
        setIsSyncing(false);
      }
    } else {
      const updatedStudents = normalizeStudentsList(students.filter((s) => s.studentId !== studentId));
      setStudents(updatedStudents);
      localStorage.setItem('school_students', JSON.stringify(updatedStudents));
      return true;
    }
  };

  // 5. 출결 저장 핸들러 (중복 방지: 동일 날짜 + 교시 + 학번 조합 시 덮어쓰기)
  const handleSaveAttendance = async (
    records: Omit<AttendanceRecord, 'id' | 'timestamp'>[]
  ): Promise<{ success: boolean; inserted: number; updated: number }> => {
    if (isLiveMode && webAppUrl) {
      setIsSyncing(true);
      try {
        // 1차 시도: 대용량 데이터 저장을 위해 POST 전송 (CORS Preflight 피하기 위해 text/plain 타입 사용)
        try {
          const res = await fetch(webAppUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/plain',
            },
            body: JSON.stringify({
              action: 'saveAttendance',
              records: records,
            }),
          });
          const json = await res.json();
          if (json && json.success) {
            await handleFetchFromSheet(webAppUrl);
            return { success: true, inserted: json.inserted || 0, updated: json.updated || 0 };
          }
        } catch (postErr) {
          console.warn('POST 요청 실패, GET 청크 방식으로 대체합니다:', postErr);
        }

        // 2차 시도 (대체 방식): 이전 버전 구글 Apps Script 연동 호환 및 URL 길이 초과(HTTP 414) 에러 방지를 위한 GET 15건 단위 청킹
        const chunkSize = 15;
        let totalInserted = 0;
        let totalUpdated = 0;

        for (let i = 0; i < records.length; i += chunkSize) {
          const chunk = records.slice(i, i + chunkSize);
          const url = `${webAppUrl}?action=saveAttendance&records=${encodeURIComponent(JSON.stringify(chunk))}`;
          const res = await fetch(url);
          const json = await res.json();
          if (!json.success) {
            throw new Error(json.error || '구글 시트 출결 저장 실패 (청크 오류)');
          }
          totalInserted += json.inserted || 0;
          totalUpdated += json.updated || 0;
        }

        await handleFetchFromSheet(webAppUrl);
        return { success: true, inserted: totalInserted, updated: totalUpdated };
      } catch (err: any) {
        console.error('All save attempts failed:', err);
        return { success: false, inserted: 0, updated: 0 };
      } finally {
        setIsSyncing(false);
      }
    } else {
      const currentRecords = [...attendanceRecords];
      let inserted = 0;
      let updated = 0;
      const nowStr = new Date().toLocaleString('ko-KR');

      records.forEach((rec) => {
        const existingIndex = currentRecords.findIndex(
          (r) => r.date === rec.date && r.period === rec.period && r.studentId === rec.studentId
        );

        if (existingIndex > -1) {
          currentRecords[existingIndex] = {
            ...currentRecords[existingIndex],
            status: rec.status,
            remark: rec.remark || '',
            timestamp: nowStr,
          };
          updated++;
        } else {
          currentRecords.push({
            ...rec,
            id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
            timestamp: nowStr,
          });
          inserted++;
        }
      });

      setAttendanceRecords(currentRecords);
      localStorage.setItem('school_attendance', JSON.stringify(currentRecords));

      return { success: true, inserted, updated };
    }
  };

  // 6. 로컬 출석 이력 청소 핸들러
  const handleClearRecords = () => {
    setAttendanceRecords([]);
    localStorage.removeItem('school_attendance');
  };

  // 7. 이력 새로고침
  const handleRefreshRecords = async () => {
    if (isLiveMode && webAppUrl) {
      await handleFetchFromSheet(webAppUrl);
    } else {
      const savedRecords = localStorage.getItem('school_attendance');
      if (savedRecords) {
        setAttendanceRecords(JSON.parse(savedRecords));
      }
    }
  };

  return (
    <div className="min-h-screen bg-sky-50 text-slate-800 font-sans flex flex-col" id="app-container">
      {/* 상단 헤더 배너 - Vibrant Palette Theme */}
      <header className="bg-white border-b-2 border-amber-400 py-2.5 px-4 shadow-sm sticky top-0 z-50" id="app-header">
        <div className="max-w-4xl mx-auto flex flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="bg-amber-400 p-1.5 rounded-lg text-white flex items-center justify-center shadow-sm">
              <Sun className="w-5 h-5 text-white animate-spin-slow" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                여름방학 정독실 출석부
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* 중앙 메인 바디 */}
      <main className="max-w-4xl mx-auto w-full px-4 py-3 space-y-3 flex-1" id="main-content">
        {/* 네비게이션 탭 바 (반응형 모바일 터치 최적화) - Vibrant Amber Outline Theme */}
        <div className="bg-white p-1 rounded-xl shadow-sm border border-amber-200 flex justify-between gap-1 overflow-x-auto" id="navigation-tabs">
          {[
            { id: 'checker', label: '출석 체크', icon: <CalendarCheck className="w-3.5 h-3.5" /> },
            { id: 'students', label: '학생 관리', icon: <UserPlus className="w-3.5 h-3.5" /> },
            { id: 'history', label: '출석 통계 및 조회', icon: <History className="w-3.5 h-3.5" /> },
            { id: 'gas_guide', label: '구글 시트 연동 안내', icon: <Code className="w-3.5 h-3.5" /> },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 min-w-[85px] py-1.5 px-2 rounded-lg text-xs font-black transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-blue-500 text-white shadow-sm scale-[1.01]'
                    : 'text-slate-600 hover:bg-amber-50 hover:text-slate-900'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden text-[10px] whitespace-nowrap">{tab.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        {/* 구글 시트 연동 통합 컨트롤러 (오직 구글 시트 연동 안내 탭에서만 보이도록 제한) */}
        {activeTab === 'gas_guide' && (
          <div className="bg-white rounded-3xl p-5 shadow-md border border-sky-100 space-y-4" id="google-sheet-connector">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <Database className={`w-5 h-5 ${isLiveMode ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`} />
                <div>
                  <h2 className="text-sm font-black text-slate-950 flex items-center gap-1.5">
                    데이터 연동 설정
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      isLiveMode 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {isLiveMode ? '실시간 구글 시트 모드' : '로컬 시뮬레이터 모드'}
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-500 font-bold">
                    {isLiveMode 
                      ? '실시간으로 구글 스프레드시트와 학생 명단 및 출석 기록을 양방향 동기화합니다.' 
                      : '브라우저 쿠키(LocalStorage)에 임시 저장되며 인터넷이 끊겨도 작동합니다.'}
                  </p>
                </div>
              </div>

              {/* 연동 모드 토글 스위치 */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl self-start sm:self-center">
                <button
                  onClick={() => {
                    setIsLiveMode(false);
                    localStorage.setItem('gas_live_mode', 'false');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    !isLiveMode 
                      ? 'bg-white text-slate-900 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  로컬 테스트
                </button>
                <button
                  onClick={() => {
                    setIsLiveMode(true);
                    localStorage.setItem('gas_live_mode', 'true');
                    if (webAppUrl) {
                      handleFetchFromSheet(webAppUrl);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    isLiveMode 
                      ? 'bg-blue-500 text-white shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  구글 시트 연동
                </button>
              </div>
            </div>

            {isLiveMode && (
              <div className="space-y-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-black text-slate-700 flex items-center justify-between">
                    <span>Apps Script 웹 앱 URL (Web App URL)</span>
                    <a
                      href="https://docs.google.com/spreadsheets/d/10gH7ygjXGF47Ee3A8f1QNb4pnfilDekK7EzCYOg1wJk/edit?usp=sharing"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-blue-500 hover:underline flex items-center gap-0.5 font-bold"
                    >
                      내 구글 시트 열기 <ExternalLink className="w-3 h-3" />
                    </a>
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      value={webAppUrl}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        setWebAppUrl(val);
                        localStorage.setItem('gas_webapp_url', val);
                      }}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="flex-1 bg-slate-50 border-2 border-slate-200 focus:border-blue-400 focus:bg-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none transition-all placeholder:text-slate-400"
                    />
                    <button
                      disabled={isSyncing || !webAppUrl}
                      onClick={() => handleFetchFromSheet(webAppUrl)}
                      className="bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white text-xs font-black px-5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer border-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{isSyncing ? '동기화 중...' : '연동 및 동기화'}</span>
                    </button>
                  </div>
                </div>

                {/* 동기화 피드백 상태 메시지 */}
                {syncStatus.message && (
                  <div className={`text-[11px] font-bold p-3 rounded-2xl flex items-center gap-2 ${
                    syncStatus.type === 'success' 
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' 
                      : 'bg-rose-50 border border-rose-200 text-rose-950'
                  }`}>
                    {syncStatus.type === 'success' ? (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    )}
                    <span>{syncStatus.message}</span>
                  </div>
                )}

                {/* 입력 주소 에러 처리 가이드 */}
                {webAppUrl && webAppUrl.includes('docs.google.com/spreadsheets') && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-950 rounded-2xl p-3.5 flex gap-2.5 items-start">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-[11px] font-bold space-y-1">
                      <p className="font-black text-amber-950">잠깐! 입력하신 주소는 구글 스프레드시트 주소입니다.</p>
                      <p className="leading-relaxed text-slate-600">
                        여기에 입력하셔야 하는 주소는 시트 주소가 아닌, 시트에 연동할 수 있도록 만든 <b className="text-slate-900">[구글 Apps Script 웹 앱 URL]</b>입니다.
                      </p>
                      <button
                        onClick={() => setActiveTab('gas_guide')}
                        className="text-blue-600 hover:underline inline-flex items-center gap-0.5 mt-1 cursor-pointer border-0 bg-transparent p-0 font-bold"
                      >
                        Apps Script 웹 앱 URL 생성 및 배포 방법 배우기 <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}

                {!webAppUrl && (
                  <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-3 text-[11px] text-slate-600 font-bold leading-relaxed flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>
                      아직 구글 웹 앱 URL이 없으신가요? <button onClick={() => setActiveTab('gas_guide')} className="text-blue-600 hover:underline cursor-pointer font-bold border-0 bg-transparent p-0"><b>[구글 시트 연동 안내]</b></button> 탭의 설명대로 3분 만에 무료로 생성할 수 있습니다.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 탭 본문 영역 */}
        <div className="pb-16" id="tab-content-container">
          {activeTab === 'checker' && (
            <AttendanceChecker
              students={students}
              attendanceRecords={attendanceRecords}
              onSaveAttendance={handleSaveAttendance}
            />
          )}

          {activeTab === 'students' && (
            <StudentManager
              students={students}
              onAddStudent={handleAddStudent}
              onAddStudentsBulk={handleAddStudentsBulk}
              onDeleteStudent={handleDeleteStudent}
            />
          )}

          {activeTab === 'history' && (
            <AttendanceHistory
              attendanceRecords={attendanceRecords}
              onClearRecords={handleClearRecords}
              onRefreshRecords={handleRefreshRecords}
            />
          )}

          {activeTab === 'gas_guide' && <GASGuide />}
        </div>
      </main>
    </div>
  );
}
