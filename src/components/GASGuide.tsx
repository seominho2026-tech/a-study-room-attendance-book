import { useState } from 'react';
import { Copy, Check, FileText, CheckCircle, Table, Terminal, HelpCircle } from 'lucide-react';
import { CODE_GS, INDEX_HTML } from '../data/gasCode';

export default function GASGuide() {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);

  const copyToClipboard = (text: string, type: 'code' | 'html') => {
    navigator.clipboard.writeText(text);
    if (type === 'code') {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedHtml(true);
      setTimeout(() => setCopiedHtml(false), 2000);
    }
  };

  return (
    <div className="space-y-6" id="gas-guide-container">
      {/* 웰컴 인트로 - Vibrant Amber Hero Card */}
      <div className="bg-amber-100/75 rounded-3xl p-6 text-slate-800 shadow-md border-2 border-amber-300" id="guide-hero">
        <h2 className="text-xl md:text-2xl font-black mb-2 flex items-center gap-2 text-slate-900">
          <Terminal className="w-6 h-6 text-amber-500" />
          구글 스프레드시트 연동 및 웹앱 배포 가이드
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed font-bold">
          이 웹앱은 학교 현장에서 초보 교사분들도 추가 비용 없이 <b className="text-slate-900">100% 무료</b>로 개인 구글 드라이브(스프레드시트)와 연동하여 실제 출석부로 사용할 수 있게 제작되었습니다. 아래 단계별 가이드를 그대로 따라 하시면 5분 안에 선생님만의 모바일 출석 웹앱을 만들 수 있습니다!
        </p>
      </div>

      {/* 단계별 가이드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="guide-steps-grid">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl space-y-4" id="step-1-card">
          <div className="flex items-center gap-2.5 font-black text-slate-900 text-base">
            <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-black">1</span>
            구글 스프레드시트 준비
          </div>
          <p className="text-xs text-slate-500 leading-relaxed font-bold">
            1. 새 스프레드시트를 생성하고 제목을 <b className="text-slate-800">"여름방학 정독실 출석부"</b> 등으로 설정합니다.<br />
            2. 시트 생성 후 시트의 이름 변경은 필요 없습니다. 웹앱 코드가 자동으로 <b className="text-blue-600">'Students'</b>(학생 명단용) 시트와 <b className="text-blue-600">'Attendance'</b>(출석 기록용) 시트를 생성하고 초기 헤더를 세팅합니다.
          </p>
          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
            <div className="text-xs font-black text-amber-800 flex items-center gap-1 mb-1.5">
              <Table className="w-4 h-4 text-emerald-600" /> 생성되는 시트 구성
            </div>
            <ul className="text-[11px] text-slate-600 space-y-1 list-disc pl-4 font-bold">
              <li><b>Students 시트</b>: 학년, 반, 번호, 성명, 학번 (자동 정렬)</li>
              <li><b>Attendance 시트</b>: 날짜, 요일, 교시, 학번, 이름, 상태, 저장시간, 비고</li>
            </ul>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl space-y-4" id="step-2-card">
          <div className="flex items-center gap-2.5 font-black text-slate-900 text-base">
            <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-black">2</span>
            구글 앱스 스크립트(GAS) 열기
          </div>
          <p className="text-xs text-slate-500 leading-relaxed font-bold">
            1. 스프레드시트 상단 메뉴에서 <b>[확장 프로그램]</b> → <b>[Apps Script]</b>를 클릭합니다.<br />
            2. 새 탭으로 구글 앱스 스크립트 편집기 창이 뜹니다.<br />
            3. 기본으로 작성되어 있는 <code className="bg-slate-100 px-1 rounded text-red-500 font-mono font-bold">myFunction()</code> 코드를 깨끗하게 다 지워줍니다.
          </p>
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200">
            <div className="text-xs font-black text-blue-800 flex items-center gap-1 mb-1.5">
              <HelpCircle className="w-4 h-4 text-blue-500" /> 왜 무료인가요?
            </div>
            <p className="text-[11px] text-blue-700 leading-relaxed font-bold">
              구글이 제공하는 무료 서버리스 환경(Google Apps Script)과 개인 구글 드라이브를 데이터베이스로 직접 사용하여 별도의 도메인이나 호스팅 서버 구매 비용이 전혀 들지 않습니다.
            </p>
          </div>
        </div>
      </div>

      {/* 코드 다운로드/복사 섹션 */}
      <div className="space-y-4" id="code-copy-section">
        {/* Code.gs 카드 */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl" id="codegs-card">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-3">
            <div className="flex items-center gap-2 font-black text-slate-900 text-base">
              <FileText className="w-5 h-5 text-blue-500" />
              <span>1단계: Code.gs 소스 코드 복사</span>
              <span className="text-xs text-blue-700 font-bold bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">서버 사이드 파일</span>
            </div>
            <button
              onClick={() => copyToClipboard(CODE_GS, 'code')}
              className={`flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-bold transition-all self-start sm:self-auto cursor-pointer border-0 ${
                copiedCode
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'bg-blue-500 text-white hover:bg-blue-600 shadow-md'
              }`}
            >
              {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedCode ? '복사 완료!' : 'Code.gs 코드 복사하기'}
            </button>
          </div>
          <p className="text-xs text-slate-500 mb-3 leading-relaxed font-bold">
            아래 복사 버튼을 누르거나 코드를 전체 복사하여, 스프레드시트 Apps Script의 <b className="text-slate-800">Code.gs</b>(또는 코드.gs) 파일 안에 그대로 붙여넣고 <kbd className="bg-slate-100 px-1.5 py-0.5 border rounded shadow-sm text-xs font-mono">Ctrl + S</kbd> (Mac은 <kbd className="bg-slate-100 px-1.5 py-0.5 border rounded shadow-sm text-xs font-mono">Cmd + S</kbd>)를 눌러 저장해 주세요.
          </p>
          <div className="relative">
            <pre className="bg-slate-900 text-slate-300 p-4 rounded-2xl text-xs overflow-x-auto max-h-48 font-mono leading-relaxed">
              {CODE_GS}
            </pre>
            <div className="absolute bottom-2 right-2 bg-slate-800 text-[10px] text-slate-400 px-2 py-1 rounded font-bold">
              JavaScript (GAS)
            </div>
          </div>
        </div>

        {/* Index.html 카드 */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl" id="indexhtml-card">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-3">
            <div className="flex items-center gap-2 font-black text-slate-900 text-base">
              <FileText className="w-5 h-5 text-emerald-500" />
              <span>2단계: Index.html 소스 코드 복사</span>
              <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">클라이언트 사이드 파일</span>
            </div>
            <button
              onClick={() => copyToClipboard(INDEX_HTML, 'html')}
              className={`flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-bold transition-all self-start sm:self-auto cursor-pointer border-0 ${
                copiedHtml
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md'
              }`}
            >
              {copiedHtml ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedHtml ? '복사 완료!' : 'Index.html 코드 복사하기'}
            </button>
          </div>
          <p className="text-xs text-slate-500 mb-3 leading-relaxed font-bold">
            Apps Script 에디터 좌측 상단의 <b>[파일] 옆 '+' 버튼</b>을 눌러 <b>[HTML]</b>을 추가한 후, 파일 이름을 대소문자 정확히 <b className="text-slate-800">"Index"</b>로 설정합니다 (자동으로 .html이 붙어 Index.html이 됩니다). 생성된 파일 내부의 모든 내용을 지우고 아래 코드를 그대로 붙여넣은 뒤 저장해 주세요.
          </p>
          <div className="relative">
            <pre className="bg-slate-900 text-slate-300 p-4 rounded-xl text-xs overflow-x-auto max-h-48 font-mono leading-relaxed">
              {INDEX_HTML}
            </pre>
            <div className="absolute bottom-2 right-2 bg-slate-800 text-[10px] text-slate-400 px-2 py-1 rounded font-bold">
              HTML5 / Bootstrap 5
            </div>
          </div>
        </div>
      </div>

      {/* 마지막 배포 가이드 */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl space-y-4" id="deploy-instructions-card">
        <h3 className="font-black text-slate-900 flex items-center gap-2 text-lg">
          <CheckCircle className="w-5 h-5 text-amber-500 animate-pulse" />
          마지막 단계: 웹 앱으로 배포하기 (가장 중요 ⭐)
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed font-bold">
          코드를 다 붙여넣고 저장했으면, 스마트폰이나 PC에서 실제로 접속할 수 있는 단독 사이트 URL 링크를 발행해 주어야 합니다.
        </p>
        <div className="space-y-3.5 text-xs text-slate-500 pl-3 border-l-2 border-amber-300 font-bold" id="deploy-steps-list">
          <p>
            1. Apps Script 편집기 우측 상단에서 <b className="text-slate-800">[배포] → [새 배포]</b>를 클릭합니다.
          </p>
          <p>
            2. 설정창이 뜨면 왼쪽 상단 톱니바퀴 모양 아이콘을 누르고 <b className="text-slate-800">[웹 앱]</b>을 선택합니다.
          </p>
          <p>
            3. 상세 옵션창에서 아래 설정을 지정해 줍니다.
            <ul className="list-disc pl-5 mt-1.5 space-y-1 text-[11px] text-slate-600 font-bold">
              <li><b>설명</b>: <span className="text-slate-700">여름방학 출석 앱 1.0 배포</span> (자유롭게 입력 가능)</li>
              <li><b>다음 사용자로 실행</b>: <span className="text-blue-600 font-semibold">나 (선생님 구글 메일 주소)</span></li>
              <li><b>액세스 권한이 있는 사용자</b>: <span className="text-blue-600 font-semibold">모든 사람</span> (또는 학교 구글 워크스페이스 도메인을 사용하는 조직원)</li>
            </ul>
          </p>
          <p>
            4. 아래 파란색 <b className="text-blue-700">[배포]</b> 버튼을 누릅니다.
          </p>
          <p>
            5. 구글 계정 액세스 권한 승인 창이 뜹니다. <b>[권한 검토]</b>를 누르고, 선생님 구글 계정을 선택한 후, <span className="text-red-500 font-semibold">"Advanced(고급)" → "Go to 여름방학 정독실 출석 관리 시스템 (unsafe)"</span> 순서로 클릭하고 <b>[Allow(허용)]</b>를 완료합니다. (구글에 개인 앱 등록을 안 한 상태이기 때문에 경고 문구가 뜨지만, 본인이 만든 코드이므로 100% 안전합니다.)
          </p>
          <p>
            6. 배포가 완료되면 <b>"웹 앱 URL"</b>이 제공됩니다. 이 URL을 복사하여 즐겨찾기 해두거나, 스마트폰 바탕화면에 바로가기 홈 화면 아이콘을 추가하여 출석을 체크할 때마다 모바일로 터치하여 편리하게 사용하시면 됩니다!
          </p>
        </div>
      </div>
    </div>
  );
}
