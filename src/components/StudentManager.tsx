import React, { useState } from 'react';
import { Plus, Trash2, Search, Users, Upload, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { Student } from '../types';
import Modal from './Modal';

interface StudentManagerProps {
  students: Student[];
  onAddStudent: (student: Omit<Student, 'id'>) => Promise<{ success: boolean; error?: string }>;
  onAddStudentsBulk: (studentsList: Omit<Student, 'id'>[]) => Promise<{ addedCount: number; skippedCount: number }>;
  onDeleteStudent: (studentId: string) => Promise<boolean>;
}

export default function StudentManager({
  students,
  onAddStudent,
  onAddStudentsBulk,
  onDeleteStudent,
}: StudentManagerProps) {
  // 개별 등록 폼 상태
  const [grade, setGrade] = useState<string>('');
  const [classNum, setClassNum] = useState<string>('');
  const [number, setNumber] = useState<string>('');
  const [name, setName] = useState<string>('');

  // 벌크 등록 상태
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');

  // 검색 상태
  const [searchQuery, setSearchQuery] = useState('');

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

  // 학번 자동계산 (학년 + 반 2자리 + 번호 2자리)
  const getCalculatedId = () => {
    if (!grade || !classNum || !number) return '';
    const padClass = classNum.padStart(2, '0');
    const padNo = number.padStart(2, '0');
    return `${grade}${padClass}${padNo}`;
  };

  // 학생 등록 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grade || !classNum || !number || !name.trim()) {
      showAlert('입력 오류', '모든 정보를 채워주세요.', 'warning');
      return;
    }

    const newStudent: Omit<Student, 'id'> = {
      grade: parseInt(grade),
      classNum: parseInt(classNum),
      number: parseInt(number),
      name: name.trim(),
      studentId: getCalculatedId(),
    };

    const result = await onAddStudent(newStudent);
    if (result.success) {
      // 폼 초기화 (성명, 번호만 초기화하고 학년, 반은 유지하면 연속 입력하기가 매우 편합니다!)
      setNumber('');
      setName('');
      // 번호 인풋에 포커싱해주면 선생님들이 극찬하십니다
      const noInput = document.getElementById('reg_number');
      if (noInput) noInput.focus();
    } else if (result.error) {
      showAlert('등록 실패', result.error, 'alert');
    }
  };

  // 대량 텍스트 파싱 및 등록
  const handleBulkSubmit = async () => {
    if (!bulkText.trim()) {
      showAlert('입력 오류', '일괄 등록할 텍스트 내용을 입력해주세요.', 'warning');
      return;
    }

    const lines = bulkText.split('\n');
    const parsedStudents: Omit<Student, 'id'>[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // 공백 또는 쉼표 기준으로 자르기
      const parts = line.split(/[\s,]+/);
      if (parts.length < 4) {
        showAlert('형식 오류', `줄 ${i + 1}: "${line}"\n[학년 반 번호 이름] 형식이어야 합니다.`, 'warning');
        return;
      }

      const g = parseInt(parts[0]);
      const c = parseInt(parts[1]);
      const n = parseInt(parts[2]);
      const nm = parts.slice(3).join(' ').trim();

      if (isNaN(g) || isNaN(c) || isNaN(n) || !nm) {
        showAlert('파싱 오류', `숫자나 이름을 올바르게 읽을 수 없습니다.\n줄 ${i + 1}: "${line}"`, 'warning');
        return;
      }

      const padClass = String(c).padStart(2, '0');
      const padNo = String(n).padStart(2, '0');
      const studentId = `${g}${padClass}${padNo}`;

      parsedStudents.push({
        grade: g,
        classNum: c,
        number: n,
        name: nm,
        studentId,
      });
    }

    if (parsedStudents.length === 0) {
      showAlert('오류', '등록할 학생 정보가 파싱되지 않았습니다.', 'warning');
      return;
    }

    showConfirm(
      '일괄 등록 확인',
      `${parsedStudents.length}명의 학생을 일괄 등록하시겠습니까?`,
      async () => {
        const result = await onAddStudentsBulk(parsedStudents);
        showAlert(
          '일괄 등록 완료',
          `성공적으로 일괄 등록되었습니다!\n\n- 새로 등록됨: ${result.addedCount}명\n- 학번 중복으로 건너뜀: ${result.skippedCount}명`,
          'success'
        );
        setBulkText('');
        setBulkOpen(false);
      }
    );
  };

  // 학생 삭제 핸들러
  const handleDelete = (studentId: string, sName: string) => {
    showConfirm(
      '명단 제외 확인',
      `정말 '${sName} (학번: ${studentId})' 학생을 목록에서 삭제하시겠습니까?\n삭제하더라도 이전의 출석 기록 데이터는 안전하게 유지됩니다.`,
      async () => {
        const success = await onDeleteStudent(studentId);
        if (success) {
          showAlert('제외 완료', `'${sName}' 학생이 성공적으로 명단에서 제외되었습니다.`, 'success');
        } else {
          showAlert('제외 실패', '삭제 처리 중 오류가 발생했습니다.', 'alert');
        }
      },
      'warning'
    );
  };

  // 필터링된 학생 명단
  const filteredStudents = students.filter(
    (s) =>
      s.name.includes(searchQuery) ||
      s.studentId.includes(searchQuery) ||
      `${s.grade}학년`.includes(searchQuery) ||
      `${s.classNum}반`.includes(searchQuery)
  );

  return (
    <div className="space-y-6" id="student-manager-root">
      {/* 학생 추가 섹션 - Vibrant White Card with Amber Icon Box */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl" id="single-add-card">
        <h3 className="text-xl font-black text-slate-900 tracking-tight mb-4 flex items-center gap-3">
          <div className="bg-amber-400 p-2 rounded-xl text-white shadow-sm flex items-center justify-center">
            <Plus className="w-5 h-5 text-white" />
          </div>
          개별 학생 신규 등록
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 pl-1">학년</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-200 text-slate-800 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all cursor-pointer"
                required
              >
                <option value="">학년 선택</option>
                <option value="1">1학년</option>
                <option value="2">2학년</option>
                <option value="3">3학년</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 pl-1">반</label>
              <input
                type="number"
                placeholder="반 번호"
                min="1"
                max="15"
                value={classNum}
                onChange={(e) => setClassNum(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-200 text-slate-800 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 pl-1">번호</label>
              <input
                id="reg_number"
                type="number"
                placeholder="번호"
                min="1"
                max="40"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-200 text-slate-800 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 pl-1">성명</label>
              <input
                type="text"
                placeholder="이름"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-200 text-slate-800 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all"
                required
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <div className="text-xs font-bold text-slate-500 pl-1">
              {getCalculatedId() ? (
                <span className="text-sm font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 font-mono inline-block">
                  예상 학번: {getCalculatedId()}
                </span>
              ) : (
                '학년, 반, 번호를 입력하면 학번이 자동 연산됩니다.'
              )}
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-blue-500 text-white rounded-full font-bold shadow-md hover:bg-blue-600 active:scale-95 transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer border-0"
            >
              <Plus className="w-4 h-4" />
              학생 등록하기
            </button>
          </div>
        </form>
      </div>

      {/* 대량 추가 섹션 - Accordion with custom Amber BG */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden" id="bulk-add-card">
        <button
          onClick={() => setBulkOpen(!bulkOpen)}
          className="w-full flex justify-between items-center text-left text-sm font-black text-slate-700 hover:text-blue-600 transition-all bg-amber-50 px-5 py-4 border-b border-amber-200 cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-amber-500" />
            여러 명 한 번에 일괄 등록 (나이스 학적 복사/붙여넣기용)
          </span>
          {bulkOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </button>

        {bulkOpen && (
          <div className="p-5 space-y-4" id="bulk-input-container">
            <div className="bg-amber-50/75 p-4 rounded-2xl border border-amber-200 flex items-start gap-2.5 text-slate-700 text-xs leading-relaxed font-bold">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <b>[학년 반 번호 성명]</b> 순서로 한 줄에 한 명씩 입력해주세요.<br />
                구분 기호는 띄어쓰기(공백) 또는 쉼표(,) 모두 가능합니다. 엑셀이나 나이스 학적 리스트에서 그대로 드래그 복사해 붙여넣으면 엄청 빠릅니다.
              </div>
            </div>
            <textarea
              rows={5}
              placeholder="예시:&#10;1 3 15 홍길동&#10;1 3 16 이순신&#10;1 4 01 강감찬"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-200 text-slate-800 font-mono rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all placeholder:text-slate-350"
            />
            <button
              onClick={handleBulkSubmit}
              className="w-full px-5 py-3.5 bg-slate-800 text-white rounded-full font-bold shadow-md hover:bg-slate-900 active:scale-95 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer border-0"
            >
              <Upload className="w-4 h-4" />
              일괄 등록 실행하기
            </button>
          </div>
        )}
      </div>

      {/* 등록 명단 관리 섹션 - Vibrant Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col" id="student-list-card">
        <div className="p-5 border-b border-slate-150 bg-slate-50 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-blue-500 p-2 rounded-xl text-white">
              <Users className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-base font-black text-slate-900 tracking-tight">
              학급 학생 등록 명단 
              <span className="text-blue-700 font-black ml-2 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 text-xs inline-block">
                {students.length}명
              </span>
            </h3>
          </div>
          {/* 검색 바 */}
          <div className="relative max-w-xs w-full">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
              <Search className="w-4 h-4 text-slate-400" />
            </span>
            <input
              type="text"
              placeholder="이름, 학번으로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border-2 border-slate-200 rounded-full pl-10 pr-4 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all"
            />
          </div>
        </div>

        {/* 테이블 테이블 리스트 */}
        <div className="overflow-x-auto" id="student-table-container">
          <table className="w-full text-center border-collapse text-xs md:text-sm">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-150 text-slate-500 font-black tracking-wider uppercase">
                <th className="py-3 px-4">학번</th>
                <th className="py-3 px-2">학년</th>
                <th className="py-3 px-2">반</th>
                <th className="py-3 px-2">번호</th>
                <th className="py-3 px-4 text-left">이름</th>
                <th className="py-3 px-4">명단 제외</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-slate-400 text-center font-bold">
                    {searchQuery ? '검색 결과가 없습니다.' : '등록된 학생이 아직 없습니다. 상단에서 추가해 주세요.'}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-sky-50/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-black text-blue-700">
                      <span className="bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                        {student.studentId}
                      </span>
                    </td>
                    <td className="py-3.5 px-2 text-slate-600 font-bold">{student.grade}학년</td>
                    <td className="py-3.5 px-2 text-slate-600 font-bold">{student.classNum}반</td>
                    <td className="py-3.5 px-2 text-slate-600 font-bold">{student.number}번</td>
                    <td className="py-3.5 px-4 text-left font-black text-slate-800 text-base">{student.name}</td>
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleDelete(student.studentId, student.name)}
                        className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl border border-red-100 transition-colors inline-flex font-bold text-xs cursor-pointer"
                        title="명단 제외"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        제외
                      </button>
                    </td>
                  </tr>
                ))
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
