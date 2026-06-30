import { useState, useEffect } from 'react';
import { Sun, CalendarCheck, UserPlus, History, RefreshCw, AlertCircle, Check, Info } from 'lucide-react';
import { Student, AttendanceRecord } from './types';
import StudentManager from './components/StudentManager';
import AttendanceChecker from './components/AttendanceChecker';
import AttendanceHistory from './components/AttendanceHistory';

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
  const [activeTab, setActiveTab] = useState<'checker' | 'students' | 'history'>('checker');
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

  // 구글 시트 연동 정보 상태 - 사용자가 제공한 지정 주소로 고정
  const FIXED_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbx46XP2e0ctj5XkJBc0TWZ5SF96vGZ5KIvr2uiC0YM4CL1vrfliD-JW4bgFbO2XJXspiQ/exec';
  const [webAppUrl] = useState<string>(FIXED_WEB_APP_URL);
  const [isLiveMode] = useState<boolean>(true);
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
          <div className="flex items-center gap-2" id="sync-status-header">
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-black">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              <span>실시간 구글 시트 연동 중</span>
            </div>
            <button
              disabled={isSyncing}
              onClick={() => handleFetchFromSheet(webAppUrl)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-1.5 rounded-lg transition-colors border-0 cursor-pointer disabled:opacity-50 flex items-center justify-center"
              title="데이터 새로고침 및 동기화"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
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
        </div>
      </main>
    </div>
  );
}
