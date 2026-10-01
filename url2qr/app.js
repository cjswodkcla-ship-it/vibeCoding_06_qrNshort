/**
 * QR Studio - QR코드 생성 및 다운로드 로직
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM 요소 선택
  const mainWrapper = document.getElementById('mainWrapper');
  const urlForm = document.getElementById('urlForm');
  const urlInput = document.getElementById('urlInput');
  const btnClear = document.getElementById('btnClear');
  const btnSubmit = document.getElementById('btnSubmit');
  const toastMessage = document.getElementById('toastMessage');
  
  const qrCard = document.getElementById('qrCard');
  const qrcodeContainer = document.getElementById('qrcode');
  const qrUrlPreview = document.getElementById('qrUrlPreview');
  const btnDownloadJpg = document.getElementById('btnDownloadJpg');
  const btnCopyLink = document.getElementById('btnCopyLink');
  const logoWrapper = document.querySelector('.logo-wrapper');

  let qrCodeInstance = null;
  let currentTargetUrl = '';

  // 1. 입력창 내용 변경에 따른 'X' 지우기 버튼 토글
  urlInput.addEventListener('input', () => {
    btnClear.style.display = urlInput.value.trim() ? 'flex' : 'none';
  });

  // 'X' 버튼 클릭 시 지우기
  btnClear.addEventListener('click', () => {
    urlInput.value = '';
    btnClear.style.display = 'none';
    urlInput.focus();
  });

  // 2. URL 입력 후 확인 (QR 생성) - 폼 제출 & 버튼 직접 클릭 둘 다 처리
  urlForm.addEventListener('submit', (e) => {
    e.preventDefault();
    generateQRCode();
  });

  btnSubmit.addEventListener('click', (e) => {
    e.preventDefault();
    generateQRCode();
  });

  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      generateQRCode();
    }
  });

  function showToast(msg, duration = 3000) {
    toastMessage.textContent = msg;
    toastMessage.classList.add('show');
    setTimeout(() => {
      toastMessage.classList.remove('show');
    }, duration);
  }

  function formatUrl(rawUrl) {
    let url = rawUrl.trim();
    if (!url) return '';
    // 프로토콜이 없고 도메인 형태나 텍스트인 경우
    if (!/^https?:\/\//i.test(url) && !/^[a-zA-Z0-9]+:\/\//i.test(url)) {
      // 일반적인 웹사이트 도메인 형식이면 https:// 자동 추가
      if (url.includes('.') && !url.includes(' ')) {
        return `https://${url}`;
      }
    }
    return url;
  }

  function generateQRCode() {
    const rawVal = urlInput.value.trim();
    if (!rawVal) {
      showToast('생성할 URL이나 텍스트를 입력해 주세요.');
      urlInput.focus();
      return;
    }

    const processedUrl = formatUrl(rawVal);
    currentTargetUrl = processedUrl;

    // QR 컨테이너 초기화
    qrcodeContainer.innerHTML = '';

    try {
      if (typeof QRCode !== 'undefined') {
        // QRCode.js 라이브러리 사용 (고화질 240x240, 고보정 레벨 H)
        qrCodeInstance = new QRCode(qrcodeContainer, {
          text: processedUrl,
          width: 240,
          height: 240,
          colorDark: '#0f172a',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.H
        });
      } else {
        // 혹시 CDN이 차단된 환경을 대비한 Canvas 순수 생성 또는 API 폴백
        createFallbackQR(processedUrl);
      }
    } catch (err) {
      console.error('QR 생성 오류:', err);
      createFallbackQR(processedUrl);
    }

    // 미리보기 URL 텍스트 갱신
    qrUrlPreview.textContent = processedUrl;

    // 레이아웃 전환: 입력창 하단 이동 + QR코드 정중앙 등장
    mainWrapper.classList.add('has-qr');

    // 웰시코기 축하 반응
    const corgiBubbleEl = document.getElementById('corgiText');
    const corgiCompanionEl = document.getElementById('corgiCompanion');
    if (corgiBubbleEl) {
      corgiBubbleEl.textContent = 'QR코드 완성! 클릭해서 받아가 멍! 🎉';
    }
    if (corgiCompanionEl) {
      corgiCompanionEl.classList.add('jump');
      setTimeout(() => corgiCompanionEl.classList.remove('jump'), 650);
    }

    // 입력창 포커스 해제
    urlInput.blur();
  }

  // 폴백 QR 이미지 생성 (CDN 오프라인 대비)
  function createFallbackQR(text) {
    const img = document.createElement('img');
    img.width = 240;
    img.height = 240;
    img.alt = 'QR Code';
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(text)}&margin=1`;
    qrcodeContainer.appendChild(img);
  }

  // 3. JPG 파일로 다운로드 기능
  // QR 코드 클릭 시 & "JPG 이미지 저장" 버튼 클릭 시 모두 동작
  function downloadAsJPG() {
    if (!currentTargetUrl) return;

    // #qrcode 내부의 캔버스 또는 이미지 탐색
    const canvas = qrcodeContainer.querySelector('canvas');
    const img = qrcodeContainer.querySelector('img');

    // 최종 다운로드용 고해상도 캔버스 생성 (흰색 여백 추가)
    const exportCanvas = document.createElement('canvas');
    const ctx = exportCanvas.getContext('2d');
    const padding = 32; // QR 코드 주위의 깔끔한 화이트 여백

    const triggerDownload = (sourceDrawable, width, height) => {
      exportCanvas.width = width + padding * 2;
      exportCanvas.height = height + padding * 2;

      // 1) JPG는 투명 영역을 지원하지 않으므로 배경을 완전한 순백색(#FFFFFF)으로 채움
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

      // 2) QR 코드 이미지 그리기
      ctx.drawImage(sourceDrawable, padding, padding, width, height);

      // 3) JPG 데이터 URL 생성 (품질 0.95)
      const jpgUrl = exportCanvas.toDataURL('image/jpeg', 0.95);

      // 4) 다운로드 트리거
      const link = document.createElement('a');
      // 도메인 추출하여 친절한 파일명 생성
      let filename = 'qrcode.jpg';
      try {
        const parsed = new URL(currentTargetUrl);
        const host = parsed.hostname.replace(/[^a-zA-Z0-9_-]/g, '_');
        if (host) filename = `qr_${host}.jpg`;
      } catch {
        filename = 'qrcode.jpg';
      }

      link.download = filename;
      link.href = jpgUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 시각적 피드백
      flashDownloadFeedback();
    };

    if (canvas) {
      triggerDownload(canvas, canvas.width, canvas.height);
    } else if (img) {
      if (img.complete && img.naturalWidth !== 0) {
        triggerDownload(img, img.naturalWidth || 240, img.naturalHeight || 240);
      } else {
        img.onload = () => {
          triggerDownload(img, img.naturalWidth || 240, img.naturalHeight || 240);
        };
      }
    } else {
      showToast('QR 코드를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
    }
  }

  function flashDownloadFeedback() {
    const originalText = btnDownloadJpg.querySelector('span').textContent;
    btnDownloadJpg.querySelector('span').textContent = 'JPG 저장 완료!';
    btnDownloadJpg.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    
    // QR 카드 살짝 바운스 피드백
    qrCard.style.transform = 'translateY(-2px) scale(0.98)';
    setTimeout(() => {
      qrCard.style.transform = '';
    }, 180);

    setTimeout(() => {
      btnDownloadJpg.querySelector('span').textContent = originalText;
      btnDownloadJpg.style.background = '';
    }, 1800);
  }

  // QR 카드 클릭 시 다운로드 (요구사항 4: QR코드 클릭하면 jpg 파일로 다운로드할 수 있어)
  qrCard.addEventListener('click', (e) => {
    // URL 복사 버튼 클릭인 경우 중복 다운로드 방지
    if (e.target.closest('#btnCopyLink')) return;
    downloadAsJPG();
  });

  // "JPG 이미지 저장" 버튼 별도 클릭 리스너
  btnDownloadJpg.addEventListener('click', (e) => {
    e.stopPropagation();
    downloadAsJPG();
  });

  // 4. URL 클립보드 복사 기능
  btnCopyLink.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!currentTargetUrl) return;

    navigator.clipboard.writeText(currentTargetUrl)
      .then(() => {
        btnCopyLink.classList.add('copy-success');
        const span = btnCopyLink.querySelector('span');
        const prev = span.textContent;
        span.textContent = '복사 완료!';
        setTimeout(() => {
          btnCopyLink.classList.remove('copy-success');
          span.textContent = prev;
        }, 1800);
      })
      .catch(() => {
        showToast('클립보드 복사에 실패했습니다.');
      });
  });

  // 5. 로고 클릭 시 처음 상태로 복귀
  logoWrapper.addEventListener('click', () => {
    mainWrapper.classList.remove('has-qr');
    urlInput.value = '';
    btnClear.style.display = 'none';
    qrcodeContainer.innerHTML = '';
    currentTargetUrl = '';
    urlInput.focus();
    if (corgiText) corgiText.textContent = '멍! URL을 입력해줘 🐾';
  });

  // ========================================================
  // 6. 귀여운 웰시코기 마우스 커서 인터랙션
  // ========================================================
  const corgiCompanion = document.getElementById('corgiCompanion');
  const corgiActor = document.getElementById('corgiActor');
  const corgiImg = document.getElementById('corgiImg');
  const corgiText = document.getElementById('corgiText');

  const corgiQuotes = [
    '멍멍! 반가워! 🐶',
    '링크 넣고 확인 눌러봐! ✨',
    'QR코드 예쁘게 만들어줄게! 🐾',
    '궁디 팡팡 조아 멍! 💛',
    '오늘도 좋은 하루 보내 멍! 🦴',
    '확인 버튼 누르면 슝 내려가! 🚀'
  ];
  let quoteIndex = 0;

  // 웰시코기 클릭 시 통통 점프 & 말풍선 변경
  if (corgiCompanion) {
    corgiCompanion.addEventListener('click', () => {
      corgiCompanion.classList.add('jump');
      quoteIndex = (quoteIndex + 1) % corgiQuotes.length;
      if (corgiText) {
        corgiText.textContent = corgiQuotes[quoteIndex];
      }
      setTimeout(() => {
        corgiCompanion.classList.remove('jump');
      }, 650);
    });
  }

  // 마우스 커서 위치에 따른 웰시코기 유기적 움직임 (시선 추적 + 패럴랙스 기울임)
  let mouseMoveTimeout;
  window.addEventListener('mousemove', (e) => {
    if (!corgiActor || !corgiImg) return;

    const rect = corgiActor.getBoundingClientRect();
    const corgiCenterX = rect.left + rect.width / 2;
    const corgiCenterY = rect.top + rect.height / 2;

    const dx = e.clientX - corgiCenterX;
    const dy = e.clientY - corgiCenterY;

    // 마우스가 왼쪽에 있는지 오른쪽에 있는지에 따라 쳐다보는 방향(좌우 반전)
    const isLeft = dx < 0;
    const lookScaleX = isLeft ? -1 : 1;

    // 마우스 거리 및 방향에 따른 회전 각도 (-12deg ~ +12deg)
    const angle = Math.max(-14, Math.min(14, (dx / window.innerWidth) * 28));

    // 마우스 커서 쪽으로 살짝 이동하는 패럴랙스 효과 (최대 ±12px)
    const shiftX = Math.max(-12, Math.min(12, (dx / window.innerWidth) * 24));
    const shiftY = Math.max(-10, Math.min(10, (dy / window.innerHeight) * 20));

    // 부드러운 반응 적용
    corgiActor.style.transform = `translate(${shiftX}px, ${shiftY}px) rotate(${angle}deg)`;
    corgiImg.style.transform = `scaleX(${lookScaleX})`;

    // 마우스가 멈췄을 때 자연스럽게 중앙 복귀
    clearTimeout(mouseMoveTimeout);
    mouseMoveTimeout = setTimeout(() => {
      if (corgiActor) {
        corgiActor.style.transform = '';
      }
    }, 1200);
  });

  // ----------------------------------------------------
  // URL 쿼리 파라미터(?url=...) 자동 수신 및 QR 즉시 생성
  // (URL단축기 등 외부 서비스 연동 지원)
  // ----------------------------------------------------
  const urlParams = new URLSearchParams(window.location.search);
  const targetUrlParam = urlParams.get('url');
  if (targetUrlParam) {
    urlInput.value = targetUrlParam;
    btnClear.style.display = 'flex';
    setTimeout(() => {
      generateQRCode();
      showToast('전달받은 URL로 QR코드를 생성했습니다!');
    }, 200);
  }
});
