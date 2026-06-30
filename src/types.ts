export type AttendanceStatus = '출석' | '결석' | '지각' | '조퇴';

export interface Student {
  id: string; // 고유 ID
  grade: number; // 학년 (예: 1)
  classNum: number; // 반 (예: 3)
  number: number; // 번호 (예: 15)
  name: string; // 성명 (예: 홍길동)
  studentId: string; // 학번 (예: "10315" - 학년, 반, 번호 조합)
}

export interface AttendanceRecord {
  id: string; // 고유 ID
  date: string; // 날짜 (YYYY-MM-DD)
  dayOfWeek: string; // 요일 (월, 화, 수, 목, 금)
  period: number; // 교시 (1 ~ 7교시)
  studentId: string; // 학번
  studentName: string; // 학생 성명
  gradeClassNo: string; // 학년-반-번호 (예: 1-3-15)
  status: AttendanceStatus; // 출석 상태
  timestamp: string; // 저장 시각
  remark?: string; // 비고 (결석이나 조퇴 사유 등)
}
