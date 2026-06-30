export const CODE_GS = `/**
 * 여름방학 자습실 출석 관리 시스템 - Google Apps Script 서버 코드 (Code.gs)
 * 
 * [설치 방법]
 * 1. 구글 스프레드시트를 하나 생성합니다.
 * 2. 상단 메뉴에서 [확장 프로그램] -> [Apps Script]를 클릭합니다.
 * 3. 기존 코드를 모두 지우고 이 코드를 붙여넣습니다.
 * 4. 좌측 [파일] 옆 '+' 버튼을 눌러 HTML 파일을 추가하고 이름을 'Index'로 만듭니다.
 * 5. 'Index.html'에 제공된 HTML 코드를 붙여넣습니다.
 * 6. 우측 상단 [배포] -> [새 배포]를 클릭합니다.
 * 7. 유형 선택(톱니바퀴)에서 [웹 앱]을 선택합니다.
 * 8. 설정을 아래와 같이 합니다.
 *    - 설명: 여름방학 출석관리 웹앱 배포
 *    - 다음 사용자 코드로 실행: 나(선생님 이메일)
 *    - 액세스 권한이 있는 사용자: 모든 사람 (혹은 조직 내 사용자)
 * 9. [배포] 버튼을 누르고 승인 절차를 완료한 뒤 생성된 웹 앱 URL을 복사하여 사용합니다.
 */

// 웹앱 접속 시 최초 화면 로딩 및 API 요청 처리
function doGet(e) {
  // JSON API 요청 처리 (CORS 지원)
  if (e && e.parameter && e.parameter.action) {
    var action = e.parameter.action;
    var result = { success: false, error: "알 수 없는 요청입니다." };
    
    try {
      if (action === "getStudents") {
        result = getStudents();
      } else if (action === "addStudent") {
        var student = JSON.parse(e.parameter.student);
        result = addStudent(student);
      } else if (action === "addStudentsBulk") {
        var studentList = JSON.parse(e.parameter.studentList);
        result = addStudentsBulk(studentList);
      } else if (action === "deleteStudent") {
        result = deleteStudent(e.parameter.studentId);
      } else if (action === "saveAttendance") {
        var records = JSON.parse(e.parameter.records);
        result = saveAttendance(records);
      } else if (action === "getAllAttendanceHistory") {
        result = getAllAttendanceHistory();
      }
    } catch (err) {
      result = { success: false, error: err.toString() };
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('여름방학 자습실 출석 관리 시스템')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// POST API 요청 처리 (CORS preflight 피하기 위해 text/plain으로 수신)
function doPost(e) {
  var result = { success: false, error: "알 수 없는 요청입니다." };
  try {
    var postData = JSON.parse(e.postData.contents);
    var action = postData.action;
    
    if (action === "saveAttendance") {
      result = saveAttendance(postData.records);
    } else if (action === "addStudent") {
      result = addStudent(postData.student);
    } else if (action === "addStudentsBulk") {
      result = addStudentsBulk(postData.studentList);
    } else if (action === "deleteStudent") {
      result = deleteStudent(postData.studentId);
    }
  } catch (err) {
    result = { success: false, error: err.toString() };
  }
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// 스프레드시트 및 시트 초기화/가져오기 함수
function getOrCreateSheet(sheetName, headers) {
  var ss;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error("No active spreadsheet bound");
  } catch (err) {
    // 사용자가 제공한 구글 스프레드시트 ID 연동 fallback
    var SPREADSHEET_ID = "10gH7ygjXGF47Ee3A8f1QNb4pnfilDekK7EzCYOg1wJk";
    ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    // 첫 행 서식 설정 (볼드, 배경색 회색, 고정)
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight("bold")
         .setBackground("#f3f4f6")
         .setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// 1. 학생 목록 가져오기
function getStudents() {
  try {
    var sheet = getOrCreateSheet('Students', ['학년', '반', '번호', '성명', '학번']);
    var data = sheet.getDataRange().getValues();
    
    var students = [];
    if (data.length > 1) {
      for (var i = 1; i < data.length; i++) {
        students.push({
          grade: Number(data[i][0]),
          classNum: Number(data[i][1]),
          number: Number(data[i][2]),
          name: data[i][3],
          studentId: String(data[i][4])
        });
      }
    }
    
    // 학번 기준 정렬 (학년 -> 반 -> 번호 순)
    students.sort(function(a, b) {
      return Number(a.studentId) - Number(b.studentId);
    });
    
    return { success: true, data: students };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// 2. 학생 개별 추가
function addStudent(student) {
  try {
    var sheet = getOrCreateSheet('Students', ['학년', '반', '번호', '성명', '학번']);
    var data = sheet.getDataRange().getValues();
    
    // 이미 존재하는 학번인지 확인
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][4]) === String(student.studentId)) {
        return { success: false, error: "이미 등록된 학번(" + student.studentId + ")입니다." };
      }
    }
    
    // 행 추가
    sheet.appendRow([
      Number(student.grade),
      Number(student.classNum),
      Number(student.number),
      student.name,
      String(student.studentId)
    ]);
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// 3. 학생 일괄 추가 (CSV/텍스트 입력 지원)
function addStudentsBulk(studentList) {
  try {
    var sheet = getOrCreateSheet('Students', ['학년', '반', '번호', '성명', '학번']);
    var data = sheet.getDataRange().getValues();
    
    // 기존 학번 목록 추출
    var existingIds = {};
    for (var i = 1; i < data.length; i++) {
      existingIds[String(data[i][4])] = true;
    }
    
    var addedCount = 0;
    var skippedCount = 0;
    
    for (var j = 0; j < studentList.length; j++) {
      var s = studentList[j];
      if (existingIds[String(s.studentId)]) {
        skippedCount++;
        continue;
      }
      sheet.appendRow([
        Number(s.grade),
        Number(s.classNum),
        Number(s.number),
        s.name,
        String(s.studentId)
      ]);
      existingIds[String(s.studentId)] = true;
      addedCount++;
    }
    
    return { success: true, addedCount: addedCount, skippedCount: skippedCount };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// 4. 학생 삭제
function deleteStudent(studentId) {
  try {
    var sheet = getOrCreateSheet('Students', ['학년', '반', '번호', '성명', '학번']);
    var data = sheet.getDataRange().getValues();
    
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][4]) === String(studentId)) {
        sheet.deleteRow(i + 1);
        return { success: true };
      }
    }
    return { success: false, error: "학생을 찾을 수 없습니다." };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// 5. 출석 데이터 저장 (동일 날짜, 동일 교시, 동일 학생은 기존 데이터 수정하여 중복 방지)
function saveAttendance(records) {
  try {
    var sheet = getOrCreateSheet('Attendance', ['날짜', '요일', '교시', '학번', '이름', '상태', '저장시간', '비고']);
    var data = sheet.getDataRange().getValues();
    
    // 행의 맵 생성 (키: 날짜_교시_학번, 값: 행 번호)
    var rowMap = {};
    if (data.length > 1) {
      for (var i = 1; i < data.length; i++) {
        // 날짜 값 포맷팅 (시트의 Date 객체를 안전한 YYYY-MM-DD 문자열로 변환)
        var rawDate = data[i][0];
        var dateStr = "";
        if (rawDate instanceof Date) {
          dateStr = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
        } else {
          dateStr = String(rawDate).split("T")[0]; // 만약 문자열이라면
        }
        
        var period = String(data[i][2]);
        var studentId = String(data[i][3]);
        var key = dateStr + "_" + period + "_" + studentId;
        rowMap[key] = i + 1; // 1-based index (시트 기준 행번호)
      }
    }
    
    var nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    var updatedCount = 0;
    var insertedCount = 0;
    
    for (var j = 0; j < records.length; j++) {
      var r = records[j];
      var key = r.date + "_" + r.period + "_" + r.studentId;
      
      if (rowMap[key]) {
        // 기존 행 존재 시 상태, 저장시간, 비고 업데이트
        var rowNum = rowMap[key];
        sheet.getRange(rowNum, 6).setValue(r.status); // 상태
        sheet.getRange(rowNum, 7).setValue(nowStr); // 저장시간
        sheet.getRange(rowNum, 8).setValue(r.remark || ""); // 비고
        updatedCount++;
      } else {
        // 존재하지 않을 시 신규 행 추가
        sheet.appendRow([
          r.date,
          r.dayOfWeek,
          Number(r.period),
          String(r.studentId),
          r.studentName,
          r.status,
          nowStr,
          r.remark || ""
        ]);
        insertedCount++;
      }
    }
    
    return { success: true, updated: updatedCount, inserted: insertedCount };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// 6. 특정 날짜/교시의 출석 기록 가져오기 (출석 체크 수정 화면에 기존 기록 바인딩용)
function getAttendanceForDateAndPeriod(date, period) {
  try {
    var sheet = getOrCreateSheet('Attendance', ['날짜', '요일', '교시', '학번', '이름', '상태', '저장시간', '비고']);
    var data = sheet.getDataRange().getValues();
    
    var records = {};
    if (data.length > 1) {
      for (var i = 1; i < data.length; i++) {
        var rawDate = data[i][0];
        var dateStr = "";
        if (rawDate instanceof Date) {
          dateStr = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
        } else {
          dateStr = String(rawDate).split("T")[0];
        }
        
        var rowPeriod = Number(data[i][2]);
        if (dateStr === date && rowPeriod === Number(period)) {
          var studentId = String(data[i][3]);
          records[studentId] = {
            status: data[i][5],
            timestamp: data[i][6],
            remark: data[i][7] || ""
          };
        }
      }
    }
    return { success: true, data: records };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// 7. 전체 출석 기록 가져오기 (출석 통계 및 조회용)
function getAllAttendanceHistory() {
  try {
    var sheet = getOrCreateSheet('Attendance', ['날짜', '요일', '교시', '학번', '이름', '상태', '저장시간', '비고']);
    var data = sheet.getDataRange().getValues();
    
    var history = [];
    if (data.length > 1) {
      for (var i = data.length - 1; i >= 1; i--) { // 최신 기록이 먼저 나오도록 역순 조회
        var rawDate = data[i][0];
        var dateStr = "";
        if (rawDate instanceof Date) {
          dateStr = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
        } else {
          dateStr = String(rawDate).split("T")[0];
        }
        
        history.push({
          date: dateStr,
          dayOfWeek: data[i][1],
          period: Number(data[i][2]),
          studentId: String(data[i][3]),
          studentName: data[i][4],
          status: data[i][5],
          timestamp: data[i][6],
          remark: data[i][7] || ""
        });
      }
    }
    return { success: true, data: history };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}
`;

export const INDEX_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>여름방학 자습실 출석 관리 시스템</title>
  <!-- Bootstrap 5 CSS CDN -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <!-- Bootstrap Icons CDN -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
  <!-- Google Fonts (Pretendard or sans-serif) -->
  <link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.8/dist/web/static/pretendard.css" />
  <style>
    body {
      font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f4f6f9;
      color: #333;
    }
    .navbar {
      background-color: #2b3a4a !important;
    }
    .card {
      border: none;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }
    .status-btn {
      transition: all 0.2s ease-in-out;
      border-radius: 8px;
    }
    .status-btn.active-present { background-color: #198754 !important; color: white !important; border-color: #198754 !important; }
    .status-btn.active-absent { background-color: #dc3545 !important; color: white !important; border-color: #dc3545 !important; }
    .status-btn.active-late { background-color: #ffc107 !important; color: #212529 !important; border-color: #ffc107 !important; }
    .status-btn.active-early { background-color: #0dcaf0 !important; color: #212529 !important; border-color: #0dcaf0 !important; }
    
    .status-badge-출석 { background-color: #d1e7dd; color: #0f5132; }
    .status-badge-결석 { background-color: #f8d7da; color: #842029; }
    .status-badge-지각 { background-color: #fff3cd; color: #664d03; }
    .status-badge-조퇴 { background-color: #cff4fc; color: #087990; }
    
    .nav-tabs .nav-link {
      color: #495057;
      border: none;
      padding: 12px 20px;
      font-weight: 500;
    }
    .nav-tabs .nav-link.active {
      color: #2b3a4a;
      border-bottom: 3px solid #2b3a4a;
      background: transparent;
      font-weight: bold;
    }
    .loading-spinner {
      display: none;
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(255, 255, 255, 0.7);
      z-index: 9999;
      justify-content: center;
      align-items: center;
      flex-direction: column;
    }
    .student-card {
      border-left: 5px solid #6c757d;
      transition: transform 0.15s ease-in-out;
    }
    .student-card:hover {
      transform: translateY(-2px);
    }
    .student-card.marked-출석 { border-left-color: #198754; }
    .student-card.marked-결석 { border-left-color: #dc3545; }
    .student-card.marked-지각 { border-left-color: #ffc107; }
    .student-card.marked-조퇴 { border-left-color: #0dcaf0; }
  </style>
</head>
<body>

  <!-- 로딩 스피너 -->
  <div id="loadingSpinner" class="loading-spinner">
    <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
      <span class="visually-hidden">로딩 중...</span>
    </div>
    <div class="mt-3 fw-bold text-dark">데이터를 처리하고 있습니다...</div>
  </div>

  <!-- 상단 네비게이션 -->
  <nav class="navbar navbar-dark sticky-top shadow-sm">
    <div class="container-fluid">
      <span class="navbar-brand mb-0 h1">
        <i class="bi bi-calendar-check-fill me-2"></i>여름방학 자습실 출석 관리
      </span>
      <span class="text-white-50 d-none d-sm-inline small">
        <i class="bi bi-person-fill"></i> 담임 교사용 모바일 웹앱
      </span>
    </div>
  </nav>

  <div class="container py-3" style="max-width: 800px;">
    
    <!-- 탭 메뉴 버튼 -->
    <ul class="nav nav-tabs nav-fill mb-3 bg-white rounded shadow-sm" id="mainTab" role="tablist">
      <li class="nav-item" role="presentation">
        <button class="nav-link active" id="attendance-tab" data-bs-toggle="tab" data-bs-target="#attendance-pane" type="button" role="tab" aria-selected="true">
          <i class="bi bi-check2-circle me-1"></i>출석 체크
        </button>
      </li>
      <li class="nav-item" role="presentation">
        <button class="nav-link" id="student-tab" data-bs-toggle="tab" data-bs-target="#student-pane" type="button" role="tab" aria-selected="false">
          <i class="bi bi-people me-1"></i>학생 관리
        </button>
      </li>
      <li class="nav-item" role="presentation">
        <button class="nav-link" id="history-tab" data-bs-toggle="tab" data-bs-target="#history-pane" type="button" role="tab" aria-selected="false">
          <i class="bi bi-bar-chart me-1"></i>출석 통계 및 조회
        </button>
      </li>
    </ul>

    <!-- 탭 내용 영역 -->
    <div class="tab-content" id="mainTabContent">
      
      <!-- 1. 출석 체크 탭 -->
      <div class="tab-pane fade show active" id="attendance-pane" role="tabpanel" aria-labelledby="attendance-tab">
        <div class="card p-3 mb-3">
          <div class="row g-2 align-items-center">
            <!-- 날짜 선택 -->
            <div class="col-6 col-sm-4">
              <label class="form-label small text-muted mb-1">날짜 선택</label>
              <input type="date" id="attendanceDate" class="form-control" onchange="onAttendanceConfigChange()">
            </div>
            <!-- 요일 (자동/수동) -->
            <div class="col-6 col-sm-3">
              <label class="form-label small text-muted mb-1">요일</label>
              <select id="attendanceDay" class="form-select">
                <option value="월">월요일</option>
                <option value="화">화요일</option>
                <option value="수">수요일</option>
                <option value="목">목요일</option>
                <option value="금">금요일</option>
              </select>
            </div>
            <!-- 교시 선택 -->
            <div class="col-12 col-sm-5">
              <label class="form-label small text-muted mb-1">교시 선택</label>
              <select id="attendancePeriod" class="form-select" onchange="onAttendanceConfigChange()">
                <option value="1">1교시 (09:00 ~ 10:00)</option>
                <option value="2">2교시 (10:10 ~ 11:10)</option>
                <option value="3">3교시 (11:20 ~ 12:20)</option>
                <option value="4">4교시 (13:30 ~ 14:30)</option>
                <option value="5">5교시 (14:40 ~ 15:40)</option>
                <option value="6">6교시 (15:50 ~ 16:50)</option>
                <option value="7">7교시 (17:00 ~ 18:00)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- 출석 통계 요약 요약 카드 -->
        <div class="row g-2 mb-3 text-center">
          <div class="col-3">
            <div class="bg-white p-2 rounded shadow-sm border-start border-3 border-secondary">
              <div class="small text-muted">대상</div>
              <div class="fw-bold fs-5" id="cntTotal">0명</div>
            </div>
          </div>
          <div class="col-3">
            <div class="bg-white p-2 rounded shadow-sm border-start border-3 border-success">
              <div class="small text-success">출석</div>
              <div class="fw-bold fs-5 text-success" id="cntPresent">0명</div>
            </div>
          </div>
          <div class="col-3">
            <div class="bg-white p-2 rounded shadow-sm border-start border-3 border-danger">
              <div class="small text-danger">결석</div>
              <div class="fw-bold fs-5 text-danger" id="cntAbsent">0명</div>
            </div>
          </div>
          <div class="col-3">
            <div class="bg-white p-2 rounded shadow-sm border-start border-3 border-warning">
              <div class="small text-warning">지각/조퇴</div>
              <div class="fw-bold fs-5 text-warning" id="cntLateEarly">0명</div>
            </div>
          </div>
        </div>

        <!-- 일괄 처리 버튼 -->
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="fw-bold text-dark"><i class="bi bi-person-lines-fill me-1"></i>학생 출석 현황</span>
          <div>
            <button class="btn btn-outline-success btn-sm me-1" onclick="setAllStatus('출석')">전원 출석</button>
            <button class="btn btn-outline-secondary btn-sm" onclick="setAllStatus('결석')">전원 미지정</button>
          </div>
        </div>

        <!-- 학생 출석 리스트 (동적 생성) -->
        <div id="attendanceList" class="d-grid gap-2 mb-4">
          <!-- 로딩 메시지 또는 빈 학생 안내가 여기에 표시됨 -->
          <div class="text-center py-4 bg-white rounded shadow-sm">
            <i class="bi bi-people text-muted fs-1"></i>
            <p class="mt-2 text-muted">등록된 학생이 없거나 목록을 불러오는 중입니다.</p>
          </div>
        </div>

        <!-- 대형 저장 버튼 -->
        <div class="sticky-bottom bg-faded py-2 text-center" style="bottom: 10px;">
          <button class="btn btn-primary w-100 py-3 shadow fw-bold fs-5" onclick="saveAttendanceData()">
            <i class="bi bi-cloud-arrow-up-fill me-2"></i>해당 교시 출석 정보 구글 시트에 저장
          </button>
        </div>
      </div>

      <!-- 2. 학생 관리 탭 -->
      <div class="tab-pane fade" id="student-pane" role="tabpanel" aria-labelledby="student-tab">
        <!-- 학생 추가 폼 -->
        <div class="card p-3 mb-3">
          <h5 class="card-title fw-bold text-dark mb-3"><i class="bi bi-person-plus me-1"></i>신규 학생 추가</h5>
          <form id="studentForm" onsubmit="registerStudent(event)">
            <div class="row g-2">
              <div class="col-3">
                <input type="number" id="stdGrade" class="form-control" placeholder="학년" min="1" max="3" required>
              </div>
              <div class="col-3">
                <input type="number" id="stdClass" class="form-control" placeholder="반" min="1" max="15" required>
              </div>
              <div class="col-3">
                <input type="number" id="stdNo" class="form-control" placeholder="번호" min="1" max="40" required>
              </div>
              <div class="col-3">
                <input type="text" id="stdName" class="form-control" placeholder="이름" required>
              </div>
              <div class="col-12 mt-2">
                <button type="submit" class="btn btn-dark w-100">
                  <i class="bi bi-plus-circle me-1"></i>학생 등록하기
                </button>
              </div>
            </div>
          </form>
        </div>

        <!-- 대량 등록 접이식 아코디언 -->
        <div class="card p-3 mb-3">
          <h6 class="fw-bold text-dark" style="cursor:pointer;" onclick="toggleElement('bulkRegisterArea')">
            <i class="bi bi-file-earmark-text me-1"></i>텍스트로 여러 명 일괄 등록 (펼치기/접기)
          </h6>
          <div id="bulkRegisterArea" style="display:none;" class="mt-3">
            <p class="small text-muted mb-2">한 줄에 한 명씩 <b>[학년, 반, 번호, 성명]</b> 형식으로 입력해주세요. (구분자는 공백 또는 쉼표 가능)</p>
            <textarea id="bulkText" class="form-control mb-2" rows="5" placeholder="예시:&#10;1 3 15 홍길동&#10;1 3 16 이순신&#10;1 4 01 강감찬"></textarea>
            <button class="btn btn-outline-dark btn-sm w-100" onclick="registerBulkStudents()">
              <i class="bi bi-file-earmark-arrow-up me-1"></i>일괄 등록 실행
            </button>
          </div>
        </div>

        <!-- 학생 수 요약 및 검색 -->
        <div class="d-flex justify-content-between align-items-center mb-2 px-1">
          <span class="text-muted small">총 <b id="totalStudentCount">0</b>명 등록됨</span>
          <span class="text-danger small">* 학년, 반, 번호를 기준으로 자동 정렬됩니다.</span>
        </div>

        <!-- 학생 목록 테이블 -->
        <div class="card bg-white shadow-sm overflow-hidden">
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0 text-center">
              <thead class="table-light">
                <tr>
                  <th>학번</th>
                  <th>학년</th>
                  <th>반</th>
                  <th>번호</th>
                  <th>성명</th>
                  <th>삭제</th>
                </tr>
              </thead>
              <tbody id="studentTableBody">
                <tr>
                  <td colspan="6" class="text-muted py-4">등록된 학생 정보가 없습니다.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 3. 출석 통계 및 조회 탭 -->
      <div class="tab-pane fade" id="history-pane" role="tabpanel" aria-labelledby="history-tab">
        <div class="card p-3 mb-3">
          <div class="d-flex justify-content-between align-items-center">
            <h5 class="fw-bold m-0"><i class="bi bi-clock-history me-1"></i>출석 기록 조회</h5>
            <button class="btn btn-sm btn-outline-primary" onclick="loadAllHistory()">
              <i class="bi bi-arrow-clockwise me-1"></i>새로고침
            </button>
          </div>
        </div>

        <!-- 간이 통계 카드 -->
        <div class="card p-3 mb-3 bg-white">
          <h6 class="fw-bold text-dark"><i class="bi bi-pie-chart-fill me-1"></i>상태별 누적 출석 통계</h6>
          <div class="row text-center mt-3">
            <div class="col-3">
              <div class="text-success fw-bold fs-4" id="statPresent">0</div>
              <div class="small text-muted">출석</div>
            </div>
            <div class="col-3">
              <div class="text-danger fw-bold fs-4" id="statAbsent">0</div>
              <div class="small text-muted">결석</div>
            </div>
            <div class="col-3">
              <div class="text-warning fw-bold fs-4" id="statLate">0</div>
              <div class="small text-muted">지각</div>
            </div>
            <div class="col-3">
              <div class="text-info fw-bold fs-4" id="statEarly">0</div>
              <div class="small text-muted">조퇴</div>
            </div>
          </div>
        </div>

        <!-- 검색 필터 -->
        <div class="row g-2 mb-3">
          <div class="col-6">
            <input type="text" id="filterName" class="form-control" placeholder="학생 이름 검색..." onkeyup="applyHistoryFilter()">
          </div>
          <div class="col-6">
            <select id="filterStatus" class="form-select" onchange="applyHistoryFilter()">
              <option value="">모든 상태</option>
              <option value="출석">출석</option>
              <option value="결석">결석</option>
              <option value="지각">지각</option>
              <option value="조퇴">조퇴</option>
            </select>
          </div>
        </div>

        <!-- 출석 이력 리스트 -->
        <div class="card bg-white shadow-sm overflow-hidden">
          <div class="table-responsive" style="max-height: 450px;">
            <table class="table table-hover align-middle mb-0 text-center">
              <thead class="table-light sticky-top" style="z-index: 1;">
                <tr>
                  <th>날짜 (교시)</th>
                  <th>학번</th>
                  <th>이름</th>
                  <th>출석 상태</th>
                </tr>
              </thead>
              <tbody id="historyTableBody">
                <tr>
                  <td colspan="4" class="text-muted py-4">출석 이력이 없습니다. 상단 새로고침을 누르거나 첫 출결을 체크해보세요.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  </div>

  <!-- Bootstrap 5 JS Bundle CDN -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>

  <script>
    // 전역 상태 변수들
    let studentsList = [];
    let attendanceMap = {}; // 학번 -> 상태
    let allHistory = [];

    // 앱 로드 시 자동 실행
    document.addEventListener("DOMContentLoaded", function() {
      // 오늘 날짜 및 요일 설정
      const today = new Date();
      const yyyy = today.getFullYear();
      let mm = today.getMonth() + 1;
      let dd = today.getDate();
      mm = mm < 10 ? '0' + mm : mm;
      dd = dd < 10 ? '0' + dd : dd;
      
      const dateString = yyyy + '-' + mm + '-' + dd;
      document.getElementById('attendanceDate').value = dateString;
      
      const week = ['일', '월', '화', '수', '목', '금', '토'];
      const dayName = week[today.getDay()];
      
      // 월~금인 경우만 자동매핑, 주말은 월요일 기본값
      if (['월','화','수','목','금'].includes(dayName)) {
        document.getElementById('attendanceDay').value = dayName;
      } else {
        document.getElementById('attendanceDay').value = '월';
      }

      // 최초 데이터 가져오기
      showLoading(true);
      google.script.run
        .withSuccessHandler(function(response) {
          showLoading(false);
          if (response.success) {
            studentsList = response.data;
            renderStudents();
            onAttendanceConfigChange(); // 현재 날짜교시 출석 기록 로딩
            loadAllHistory();
          } else {
            alert("학생 목록 로딩 실패: " + response.error);
          }
        })
        .withFailureHandler(function(err) {
          showLoading(false);
          alert("네트워크 오류가 발생했습니다: " + err);
        })
        .getStudents();
    });

    // 로딩 토글
    function showLoading(show) {
      document.getElementById('loadingSpinner').style.display = show ? 'flex' : 'none';
    }

    // 아코디언 토글
    function toggleElement(id) {
      const el = document.getElementById(id);
      el.style.display = el.style.display === 'none' ? 'block' : 'none';
    }

    // 학번 계산기 (포맷 맞추기: 학년(1) + 반(2자리) + 번호(2자리))
    function calculateStudentId(grade, classNum, no) {
      const padClass = String(classNum).padStart(2, '0');
      const padNo = String(no).padStart(2, '0');
      return grade + padClass + padNo;
    }

    // ------------------------------------------
    // 학생 관리 함수들
    // ------------------------------------------

    // 신규 학생 등록 버튼 이벤트
    function registerStudent(e) {
      e.preventDefault();
      
      const grade = parseInt(document.getElementById('stdGrade').value);
      const classNum = parseInt(document.getElementById('stdClass').value);
      const number = parseInt(document.getElementById('stdNo').value);
      const name = document.getElementById('stdName').value.trim();
      const studentId = calculateStudentId(grade, classNum, number);

      const studentData = {
        grade: grade,
        classNum: classNum,
        number: number,
        name: name,
        studentId: studentId
      };

      showLoading(true);
      google.script.run
        .withSuccessHandler(function(response) {
          showLoading(false);
          if (response.success) {
            alert(name + " 학생이 성공적으로 등록되었습니다.");
            document.getElementById('studentForm').reset();
            refreshStudentList();
          } else {
            alert("학생 등록 실패: " + response.error);
          }
        })
        .withFailureHandler(function(err) {
          showLoading(false);
          alert("오류 발생: " + err);
        })
        .addStudent(studentData);
    }

    // 텍스트 일괄 등록
    function registerBulkStudents() {
      const bulkText = document.getElementById('bulkText').value.trim();
      if (!bulkText) {
        alert("내용을 입력해주세요.");
        return;
      }

      const lines = bulkText.split('\\n');
      const listToRegister = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // 공백 혹은 쉼표로 분할
        const parts = line.split(/[\\s,]+/);
        if (parts.length < 4) {
          alert("포맷 오류 (한 줄은 [학년 반 번호 이름] 형식이어야 합니다): " + line);
          return;
        }

        const grade = parseInt(parts[0]);
        const classNum = parseInt(parts[1]);
        const number = parseInt(parts[2]);
        const name = parts.slice(3).join(" "); // 이름에 공백이 있을 수 있으므로

        if (isNaN(grade) || isNaN(classNum) || isNaN(number) || !name) {
          alert("숫자 변환 오류가 있습니다: " + line);
          return;
        }

        const studentId = calculateStudentId(grade, classNum, number);

        listToRegister.push({
          grade: grade,
          classNum: classNum,
          number: number,
          name: name,
          studentId: studentId
        });
      }

      if (listToRegister.length === 0) return;

      if (!confirm(listToRegister.length + "명의 학생을 등록하시겠습니까?")) return;

      showLoading(true);
      google.script.run
        .withSuccessHandler(function(response) {
          showLoading(false);
          if (response.success) {
            alert("일괄 등록 성공! " + response.addedCount + "명 등록 완료 / " + response.skippedCount + "명 중복 패스");
            document.getElementById('bulkText').value = "";
            document.getElementById('bulkRegisterArea').style.display = 'none';
            refreshStudentList();
          } else {
            alert("등록 실패: " + response.error);
          }
        })
        .withFailureHandler(function(err) {
          showLoading(false);
          alert("서버 연결 실패: " + err);
        })
        .addStudentsBulk(listToRegister);
    }

    // 학생 삭제 실행
    function requestDeleteStudent(studentId, name) {
      if (!confirm("정말 '" + name + " (학번: " + studentId + ")' 학생을 삭제하시겠습니까?\\n삭제 시 기존 학생 명단에서 제외됩니다.")) return;

      showLoading(true);
      google.script.run
        .withSuccessHandler(function(response) {
          showLoading(false);
          if (response.success) {
            alert("삭제 완료되었습니다.");
            refreshStudentList();
          } else {
            alert("삭제 실패: " + response.error);
          }
        })
        .withFailureHandler(function(err) {
          showLoading(false);
          alert("오류 발생: " + err);
        })
        .deleteStudent(studentId);
    }

    // 학생 목록 새로고침
    function refreshStudentList() {
      showLoading(true);
      google.script.run
        .withSuccessHandler(function(response) {
          showLoading(false);
          if (response.success) {
            studentsList = response.data;
            renderStudents();
            renderAttendanceList(); // 출결 목록도 갱신
          }
        })
        .getStudents();
    }

    // 학생 관리 테이블 그리기
    function renderStudents() {
      const tbody = document.getElementById('studentTableBody');
      const totalCountSpan = document.getElementById('totalStudentCount');
      
      totalCountSpan.textContent = studentsList.length;

      if (studentsList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-muted py-4">등록된 학생 정보가 없습니다.</td></tr>';
        return;
      }

      let html = '';
      for (let i = 0; i < studentsList.length; i++) {
        const s = studentsList[i];
        html += '<tr>' +
          '<td><span class="badge bg-secondary">' + s.studentId + '</span></td>' +
          '<td>' + s.grade + '학년</td>' +
          '<td>' + s.classNum + '반</td>' +
          '<td>' + s.number + '번</td>' +
          '<td class="fw-bold text-dark">' + s.name + '</td>' +
          '<td><button class="btn btn-outline-danger btn-sm px-2 py-1" onclick="requestDeleteStudent(\\'' + s.studentId + '\\', \\'' + s.name + '\\')"><i class="bi bi-trash-fill"></i></button></td>' +
          '</tr>';
      }
      tbody.innerHTML = html;
    }

    // ------------------------------------------
    // 출석 체크 함수들
    // ------------------------------------------

    // 날짜 또는 교시 변경 시 구글 시트에서 해당 타임의 기존 기록 로딩하여 세팅
    function onAttendanceConfigChange() {
      const date = document.getElementById('attendanceDate').value;
      const period = document.getElementById('attendancePeriod').value;
      
      if (!date || !period) return;

      // 자동 요일 지정 설정
      const d = new Date(date);
      const week = ['일', '월', '화', '수', '목', '금', '토'];
      const dayName = week[d.getDay()];
      if (['월','화','수','목','금'].includes(dayName)) {
        document.getElementById('attendanceDay').value = dayName;
      }

      showLoading(true);
      google.script.run
        .withSuccessHandler(function(response) {
          showLoading(false);
          attendanceMap = {}; // 기존 맵 초기화
          
          if (response.success) {
            const savedRecords = response.data; // { '10315': { status: '출석' } } 형태
            
            // 학생 목록을 돌며 기존 구글 시트 기록이 있으면 매핑하고, 없으면 기본값(미지정) 처리
            for (let i = 0; i < studentsList.length; i++) {
              const s = studentsList[i];
              if (savedRecords[s.studentId]) {
                attendanceMap[s.studentId] = savedRecords[s.studentId].status;
              } else {
                attendanceMap[s.studentId] = ''; // 기본값: 미지정
              }
            }
            renderAttendanceList();
            updateAttendanceStats();
          } else {
            alert("기존 출석 기록 로딩 실패: " + response.error);
          }
        })
        .withFailureHandler(function(err) {
          showLoading(false);
          alert("출석 불러오기 실패: " + err);
        })
        .getAttendanceForDateAndPeriod(date, period);
    }

    // 전원 상태 일괄 세팅
    function setAllStatus(status) {
      for (let i = 0; i < studentsList.length; i++) {
        const s = studentsList[i];
        attendanceMap[s.studentId] = status;
      }
      renderAttendanceList();
      updateAttendanceStats();
    }

    // 개별 학생 출석 상태 변경
    function selectStudentStatus(studentId, status) {
      attendanceMap[studentId] = status;
      
      // 개별 카드 시각효과 갱신
      const card = document.getElementById('card-' + studentId);
      if (card) {
        card.className = 'student-card card p-3 bg-white marked-' + (status || 'unmarked');
      }

      // 상태 버튼 클래스 갱신
      const btnGroup = document.getElementById('group-' + studentId);
      if (btnGroup) {
        const btns = btnGroup.querySelectorAll('.status-btn');
        btns.forEach(btn => {
          const btnStatus = btn.getAttribute('data-status');
          btn.className = 'btn btn-outline-secondary btn-sm status-btn'; // 리셋
          if (btnStatus === status) {
            if (status === '출석') btn.classList.add('active-present');
            if (status === '결석') btn.classList.add('active-absent');
            if (status === '지각') btn.classList.add('active-late');
            if (status === '조퇴') btn.classList.add('active-early');
          }
        });
      }

      updateAttendanceStats();
    }

    // 출석 체크 목록 UI 그리기
    function renderAttendanceList() {
      const container = document.getElementById('attendanceList');
      
      if (studentsList.length === 0) {
        container.innerHTML = '<div class="text-center py-4 bg-white rounded shadow-sm"><i class="bi bi-people text-muted fs-1"></i><p class="mt-2 text-muted">등록된 학생이 없습니다. 학생 관리 탭에서 등록해 주세요.</p></div>';
        return;
      }

      let html = '';
      for (let i = 0; i < studentsList.length; i++) {
        const s = studentsList[i];
        const currentStatus = attendanceMap[s.studentId] || '';
        
        // 카드 보더 색상 설정
        const borderClass = currentStatus ? 'marked-' + currentStatus : '';
        
        html += '<div id="card-' + s.studentId + '" class="student-card card p-3 bg-white ' + borderClass + '">' +
          '<div class="row align-items-center g-2">' +
            '<div class="col-12 col-md-4 d-flex align-items-center justify-content-between justify-content-md-start">' +
              '<div>' +
                '<span class="badge bg-light text-dark border me-2">' + s.studentId + '</span>' +
                '<span class="fw-bold text-dark fs-5">' + s.name + '</span>' +
              '</div>' +
              '<span class="text-muted small d-md-none">' + s.grade + '학년 ' + s.classNum + '반 ' + s.number + '번</span>' +
            '</div>' +
            '<div class="col-12 col-md-8 text-end">' +
              '<div class="btn-group w-100" id="group-' + s.studentId + '" role="group">' +
                '<button type="button" class="btn btn-sm btn-outline-secondary status-btn ' + (currentStatus === '출석' ? 'active-present' : '') + '" data-status="출석" onclick="selectStudentStatus(\\'' + s.studentId + '\\', \\'출석\\')">출석</button>' +
                '<button type="button" class="btn btn-sm btn-outline-secondary status-btn ' + (currentStatus === '결석' ? 'active-absent' : '') + '" data-status="결석" onclick="selectStudentStatus(\\'' + s.studentId + '\\', \\'결석\\')">결석</button>' +
                '<button type="button" class="btn btn-sm btn-outline-secondary status-btn ' + (currentStatus === '지각' ? 'active-late' : '') + '" data-status="지각" onclick="selectStudentStatus(\\'' + s.studentId + '\\', \\'지각\\')">지각</button>' +
                '<button type="button" class="btn btn-sm btn-outline-secondary status-btn ' + (currentStatus === '조퇴' ? 'active-early' : '') + '" data-status="조퇴" onclick="selectStudentStatus(\\'' + s.studentId + '\\', \\'조퇴\\')">조퇴</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      }
      container.innerHTML = html;
    }

    // 출결 요약 통계 갱신
    function updateAttendanceStats() {
      let total = studentsList.length;
      let present = 0;
      let absent = 0;
      let lateEarly = 0;

      for (let i = 0; i < studentsList.length; i++) {
        const s = studentsList[i];
        const status = attendanceMap[s.studentId];
        if (status === '출석') present++;
        else if (status === '결석') absent++;
        else if (status === '지각' || status === '조퇴') lateEarly++;
      }

      document.getElementById('cntTotal').textContent = total + "명";
      document.getElementById('cntPresent').textContent = present + "명";
      document.getElementById('cntAbsent').textContent = absent + "명";
      document.getElementById('cntLateEarly').textContent = lateEarly + "명";
    }

    // 구글 시트에 최종 저장 전송
    function saveAttendanceData() {
      const date = document.getElementById('attendanceDate').value;
      const dayOfWeek = document.getElementById('attendanceDay').value;
      const period = parseInt(document.getElementById('attendancePeriod').value);

      if (!date || !period) {
        alert("날짜와 교시를 정확히 입력해 주세요.");
        return;
      }

      // 출석 입력되지 않은 학생 체크
      const unMarkedStudents = [];
      const recordsToSubmit = [];

      for (let i = 0; i < studentsList.length; i++) {
        const s = studentsList[i];
        const status = attendanceMap[s.studentId];
        
        if (!status) {
          unMarkedStudents.push(s.name);
        } else {
          recordsToSubmit.push({
            date: date,
            dayOfWeek: dayOfWeek,
            period: period,
            studentId: s.studentId,
            studentName: s.name,
            status: status
          });
        }
      }

      if (unMarkedStudents.length > 0) {
        if (!confirm("출석 상태를 정하지 않은 학생(" + unMarkedStudents.length + "명: " + unMarkedStudents.slice(0, 3).join(",") + "...)이 있습니다.\\n이 학생들을 제외하고 우선 저장하시겠습니까?")) {
          return;
        }
      }

      if (recordsToSubmit.length === 0) {
        alert("저장할 출결 내역이 존재하지 않습니다.");
        return;
      }

      showLoading(true);
      google.script.run
        .withSuccessHandler(function(response) {
          showLoading(false);
          if (response.success) {
            alert("성공적으로 저장되었습니다!\\n[신규 입력]: " + response.inserted + "건, [기존 수정]: " + response.updated + "건");
            loadAllHistory(); // 이력 자동 갱신
          } else {
            alert("저장 실패: " + response.error);
          }
        })
        .withFailureHandler(function(err) {
          showLoading(false);
          alert("서버 전송 오류: " + err);
        })
        .saveAttendance(recordsToSubmit);
    }

    // ------------------------------------------
    // 출석 이력 조회 및 통계
    // ------------------------------------------

    // 전체 이력 불러오기
    function loadAllHistory() {
      showLoading(true);
      google.script.run
        .withSuccessHandler(function(response) {
          showLoading(false);
          if (response.success) {
            allHistory = response.data;
            calculateAccumulatedStats();
            applyHistoryFilter();
          } else {
            alert("기존 이력 로딩 실패: " + response.error);
          }
        })
        .withFailureHandler(function(err) {
          showLoading(false);
          alert("이력 로드 실패: " + err);
        })
        .getAllAttendanceHistory();
    }

    // 누적 통계 계산
    function calculateAccumulatedStats() {
      let present = 0;
      let absent = 0;
      let late = 0;
      let early = 0;

      for (let i = 0; i < allHistory.length; i++) {
        const r = allHistory[i];
        if (r.status === '출석') present++;
        else if (r.status === '결석') absent++;
        else if (r.status === '지각') late++;
        else if (r.status === '조퇴') early++;
      }

      document.getElementById('statPresent').textContent = present;
      document.getElementById('statAbsent').textContent = absent;
      document.getElementById('statLate').textContent = late;
      document.getElementById('statEarly').textContent = early;
    }

    // 필터링 적용
    function applyHistoryFilter() {
      const nameFilter = document.getElementById('filterName').value.trim().toLowerCase();
      const statusFilter = document.getElementById('filterStatus').value;
      const tbody = document.getElementById('historyTableBody');

      const filtered = allHistory.filter(r => {
        const matchName = r.studentName.toLowerCase().includes(nameFilter) || r.studentId.includes(nameFilter);
        const matchStatus = !statusFilter || r.status === statusFilter;
        return matchName && matchStatus;
      });

      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-muted py-4">조건에 일치하는 출석 내역이 없습니다.</td></tr>';
        return;
      }

      let html = '';
      for (let i = 0; i < filtered.length; i++) {
        const r = filtered[i];
        html += '<tr>' +
          '<td>' + r.date + ' (' + r.period + '교시)</td>' +
          '<td><span class="badge bg-light text-dark border">' + r.studentId + '</span></td>' +
          '<td class="fw-bold">' + r.studentName + '</td>' +
          '<td><span class="badge status-badge-' + r.status + ' px-3 py-2">' + r.status + '</span></td>' +
          '</tr>';
      }
      tbody.innerHTML = html;
    }
  </script>
</body>
</html>
`;
