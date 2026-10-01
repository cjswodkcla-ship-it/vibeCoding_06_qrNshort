/**
 * 스마트 URL 단축기 (Quick Shortener) 스크립트
 * OpenAPI를 활용한 실시간 URL 단축 및 클립보드 복사
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM 요소 선택
  const urlInput = document.getElementById('urlInput');
  const btnClearInput = document.getElementById('btnClearInput');
  const btnShorten = document.getElementById('btnShorten');
  const shortenForm = document.getElementById('shortenForm');
  const statusMessage = document.getElementById('statusMessage');

  const resultSection = document.getElementById('resultSection');
  const shortenedOutput = document.getElementById('shortenedOutput');
  const btnCopy = document.getElementById('btnCopy');
  const compressionRate = document.getElementById('compressionRate');
  const btnCreateQr = document.getElementById('btnCreateQr');
  const linkOpenShort = document.getElementById('linkOpenShort');
  const toastPopup = document.getElementById('toastPopup');

  const historySection = document.getElementById('historySection');
  const historyList = document.getElementById('historyList');
  const btnClearHistory = document.getElementById('btnClearHistory');

  const corgiCompanion = document.getElementById('corgiCompanion');
  const corgiText = document.getElementById('corgiText');

  let currentShortUrl = '';
  let isLoading = false;

  // ----------------------------------------------------
  // 3-2: 입력 필드가 비어 있으면 '단축하기' 버튼 비활성화
  // ----------------------------------------------------
  function updateButtonState() {
    const val = urlInput.value.trim();
    if (val.length === 0) {
      btnShorten.disabled = true;
      btnClearInput.style.display = 'none';
    } else {
      btnShorten.disabled = false;
      btnClearInput.style.display = 'flex';
    }
  }

  // 초기 상태 확인 및 이벤트 바인딩
  updateButtonState();
  urlInput.addEventListener('input', () => {
    updateButtonState();
    clearStatus();
  });

  // 입력창 지우기 ('X') 버튼
  btnClearInput.addEventListener('click', () => {
    urlInput.value = '';
    updateButtonState();
    clearStatus();
    urlInput.focus();
  });

  // 엔터 키 입력 시 단축 실행
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!btnShorten.disabled && !isLoading) {
        requestShortenUrl();
      }
    }
  });

  btnShorten.addEventListener('click', () => {
    if (!btnShorten.disabled && !isLoading) {
      requestShortenUrl();
    }
  });

  // 상태 메시지 헬퍼
  function showStatus(msg, type = 'info') {
    statusMessage.textContent = msg;
    statusMessage.className = `status-message ${type}`;
  }

  function clearStatus() {
    statusMessage.textContent = '';
    statusMessage.className = 'status-message';
  }

  // ----------------------------------------------------
  // URL 정규화 및 유효성 검사
  // ----------------------------------------------------
  function normalizeUrl(rawUrl) {
    let url = rawUrl.trim();
    if (!url) return '';
    // 프로토콜이 없는 경우 (예: google.com -> https://google.com)
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    return url;
  }

  function isValidUrl(string) {
    try {
      const parsed = new URL(string);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  // ----------------------------------------------------
  // 3-3: OpenAPI 호출하여 URL 단축 요청
  // 1차: spoo.me (최신 CORS 지원 OpenAPI)
  // 2차: is.gd API (안전한 텍스트/JSON 처리)
  // 3차: v.gd API
  // 4차: TinyURL (CORS 프록시 fallback)
  // ----------------------------------------------------
  async function callShortenApi(targetUrl) {
    const encoded = encodeURIComponent(targetUrl);

    // 1차 시도: spoo.me API (CORS 공식 지원)
    try {
      const res = await fetch('https://spoo.me/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: `url=${encoded}`
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.short_url) {
          // http를 https로 보정
          return data.short_url.replace(/^http:\/\//i, 'https://');
        }
      }
    } catch (e1) {
      console.warn('spoo.me 실패, 2차 서비스(is.gd)로 대체 시도:', e1);
    }

    // 2차 시도: is.gd API (안전하게 텍스트 및 JSON 검사)
    try {
      const res = await fetch(`https://is.gd/create.php?format=simple&url=${encoded}`);
      if (res.ok) {
        const text = (await res.text()).trim();
        if (text.startsWith('http://') || text.startsWith('https://')) {
          return text.replace(/^http:\/\//i, 'https://');
        }
      }
    } catch (e2) {
      console.warn('is.gd 실패, 3차 서비스(v.gd)로 대체 시도:', e2);
    }

    // 3차 시도: v.gd API
    try {
      const res = await fetch(`https://v.gd/create.php?format=simple&url=${encoded}`);
      if (res.ok) {
        const text = (await res.text()).trim();
        if (text.startsWith('http://') || text.startsWith('https://')) {
          return text.replace(/^http:\/\//i, 'https://');
        }
      }
    } catch (e3) {
      console.warn('v.gd 실패, 4차 프록시 서비스로 대체 시도:', e3);
    }

    // 4차 시도: TinyURL 프록시 호출
    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent('https://tinyurl.com/api-create.php?url=' + encoded)}`;
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && data.contents) {
          const shortResult = data.contents.trim();
          if (shortResult.startsWith('http://') || shortResult.startsWith('https://')) {
            return shortResult;
          }
        }
      }
    } catch (e4) {
      console.warn('TinyURL 프록시 실패:', e4);
    }

    throw new Error('URL 단축 API 호출에 실패했습니다. 링크 주소를 다시 확인해 주세요.');
  }

  // 단축 요청 실행
  async function requestShortenUrl() {
    const rawVal = urlInput.value.trim();
    if (!rawVal) {
      showStatus('단축할 URL을 입력해 주세요.', 'error');
      urlInput.focus();
      return;
    }

    const processedUrl = normalizeUrl(rawVal);
    if (!isValidUrl(processedUrl)) {
      showStatus('올바른 URL 형식(예: https://example.com)을 입력해 주세요.', 'error');
      urlInput.focus();
      return;
    }

    // 로딩 상태 시작
    isLoading = true;
    btnShorten.disabled = true;
    btnShorten.classList.add('loading');
    showStatus('OpenAPI로 링크를 안전하게 단축하고 있습니다...', 'info');
    setCorgiText('링크를 싹둑싹둑 줄이는 중이다 멍! ✂️');

    try {
      const shortUrl = await callShortenApi(processedUrl);
      currentShortUrl = shortUrl;

      // 3-1 & 3-3: 읽기 전용 출력 상자에 단축 결과 보여주기
      shortenedOutput.value = shortUrl;
      resultSection.style.display = 'block';

      // 길이 절약률 계산
      const origLen = processedUrl.length;
      const shortLen = shortUrl.length;
      const savedPercent = origLen > shortLen 
        ? Math.round(((origLen - shortLen) / origLen) * 100) 
        : 0;
      
      compressionRate.textContent = savedPercent > 0 
        ? `길이 ${savedPercent}% 단축 (${origLen}자 ➔ ${shortLen}자)` 
        : `단축 완료 (${shortLen}자)`;

      // 새 탭 열기 링크 연결
      linkOpenShort.href = shortUrl;

      showStatus('URL 단축이 완료되었습니다! 아래에서 복사해 보세요.', 'success');
      setCorgiText('와우! 짧고 깔끔해졌다 멍! 🐾');

      // 로컬 히스토리에 저장
      saveToHistory(processedUrl, shortUrl);

      // 출력 상자로 포커스 부드럽게 스크롤
      resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (err) {
      console.error(err);
      showStatus(err.message || 'URL 단축 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', 'error');
      setCorgiText('앗, 단축하는 데 문제가 생겼어 멍... 😢');
    } finally {
      isLoading = false;
      updateButtonState();
      btnShorten.classList.remove('loading');
    }
  }

  // ----------------------------------------------------
  // 3-4: '복사' 버튼 클릭 시 클립보드 복사 & '복사하였습니다' 알림창
  // ----------------------------------------------------
  btnCopy.addEventListener('click', () => {
    const textToCopy = shortenedOutput.value;
    if (!textToCopy) return;

    copyToClipboard(textToCopy);
  });

  function copyToClipboard(text) {
    // 1) 클립보드 API 우선 시도
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        onCopySuccess();
      }).catch(() => {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const tempTextArea = document.createElement('textarea');
    tempTextArea.value = text;
    tempTextArea.style.position = 'fixed';
    tempTextArea.style.left = '-9999px';
    document.body.appendChild(tempTextArea);
    tempTextArea.select();
    try {
      document.execCommand('copy');
      onCopySuccess();
    } catch (err) {
      alert('복사에 실패했습니다. 직접 복사해 주세요.');
    } finally {
      document.body.removeChild(tempTextArea);
    }
  }

  function onCopySuccess() {
    // 요구사항: '복사'버튼을 클릭하면 자동으로 복사하고 '복사하였습니다' 알림창이 나타나게 해줘.
    // 사용자 친화적이고 신속한 확인을 위해 alert 및 시각 토스트 팝업 병행
    showToastPopup('복사하였습니다');
    alert('복사하였습니다');
    setCorgiText('클립보드에 쏙 복사했다 멍! 📋');
  }

  function showToastPopup(msg) {
    toastPopup.textContent = msg;
    toastPopup.classList.add('show');
    setTimeout(() => {
      toastPopup.classList.remove('show');
    }, 2800);
  }

  // ----------------------------------------------------
  // 시너지 기능: 단축 URL을 QR코드 생성기로 바로 전달
  // ----------------------------------------------------
  btnCreateQr.addEventListener('click', () => {
    if (!currentShortUrl) return;
    // url2qr로 단축 URL 파라미터를 실어서 이동
    window.location.href = `../url2qr/index.html?url=${encodeURIComponent(currentShortUrl)}`;
  });

  // ----------------------------------------------------
  // 최근 단축 기록 관리 (localStorage)
  // ----------------------------------------------------
  const STORAGE_KEY = 'quick_shortener_history_v1';

  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveToHistory(originalUrl, shortUrl) {
    let list = getHistory();
    // 중복 제거 및 최신 순 추가
    list = list.filter(item => item.shortUrl !== shortUrl);
    list.unshift({ originalUrl, shortUrl, date: new Date().toLocaleDateString('ko-KR') });
    if (list.length > 5) list = list.slice(0, 5); // 최근 5개 유지
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    renderHistory();
  }

  function renderHistory() {
    const list = getHistory();
    if (list.length === 0) {
      historySection.style.display = 'none';
      return;
    }
    historySection.style.display = 'block';
    historyList.innerHTML = '';

    list.forEach(item => {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.innerHTML = `
        <div class="history-urls">
          <a href="${item.shortUrl}" target="_blank" rel="noopener noreferrer" class="history-short">${item.shortUrl}</a>
          <span class="history-original" title="${item.originalUrl}">${item.originalUrl}</span>
        </div>
        <button type="button" class="history-copy-btn">복사</button>
      `;

      li.querySelector('.history-copy-btn').addEventListener('click', () => {
        copyToClipboard(item.shortUrl);
      });

      historyList.appendChild(li);
    });
  }

  btnClearHistory.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    renderHistory();
  });

  // 페이지 로드 시 기존 히스토리 표시
  renderHistory();

  // ----------------------------------------------------
  // 웰시코기 인터랙션
  // ----------------------------------------------------
  const corgiQuotes = [
    '줄이고 싶은 긴 URL을 알려줘 🐾',
    '링크가 너무 길면 보기 싫잖아 멍!',
    'OpenAPI로 순식간에 줄여줄게 멍!',
    '나를 클릭했어? 쓰담쓰담 고마워 멍!',
    '단축한 링크는 바로 QR코드로도 만들 수 있어!'
  ];
  let corgiIndex = 0;

  function setCorgiText(text) {
    corgiText.textContent = text;
  }

  corgiCompanion.addEventListener('click', () => {
    corgiIndex = (corgiIndex + 1) % corgiQuotes.length;
    setCorgiText(corgiQuotes[corgiIndex]);
  });
});
