'use strict';
/* ════════════════════════════════════════
   main.js — UI·렌더링·API 호출
   analyzer.js 이후에 로드되어야 합니다.
════════════════════════════════════════ */

/* ─────────────────────────────────────────────
   시계
───────────────────────────────────────────── */
const DAYS = ['일','월','화','수','목','금','토'];

function updateClock() {
  const d   = new Date();
  const dow = d.getDay();
  const hh  = String(d.getHours()).padStart(2,'0');
  const mm  = String(d.getMinutes()).padStart(2,'0');
  const ss  = String(d.getSeconds()).padStart(2,'0');

  document.getElementById('clock-date').textContent =
    `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
  document.getElementById('clock-time').textContent = `${hh}:${mm}:${ss}`;

  const dp = document.getElementById('day-pill');
  dp.textContent = `${DAYS[dow]}요일`;
  dp.className   = 'day-pill ' + (dow === 0 || dow === 6 ? 'we' : 'wd');

  const mins   = d.getHours() * 60 + d.getMinutes();
  const isOpen = dow >= 1 && dow <= 5 && mins >= 540 && mins < 930;
  const mp = document.getElementById('mkt-pill');
  mp.textContent = isOpen ? '▶ 장중' : '■ 장마감';
  mp.className   = 'mkt-pill ' + (isOpen ? 'mkt-open' : 'mkt-closed');
}
updateClock();
setInterval(updateClock, 1000);

/* ─────────────────────────────────────────────
   사이드바 토글
───────────────────────────────────────────── */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}
document.addEventListener('click', e => {
  const sb = document.getElementById('sidebar');
  if (sb.classList.contains('open') &&
      !sb.contains(e.target) &&
      !e.target.closest('.panel-btn'))
    sb.classList.remove('open');
});

/* ─────────────────────────────────────────────
   서버 헬스체크
───────────────────────────────────────────── */
let SERVER_ONLINE = false;

async function checkServer() {
  const el  = document.getElementById('srv-status');
  const msg = document.getElementById('srv-msg');
  try {
    // Vercel 환경에서는 /api/rss 자체로 alive 여부 확인
    const r = await fetch('/api/rss?sources=hankyung', { signal: AbortSignal.timeout(4000) });
    if (r.ok) {
      SERVER_ONLINE = true;
      el.className    = 'srv-status online';
      msg.textContent = '서버 연결됨 — RSS 직접 수집 가능';
      return;
    }
  } catch {}
  SERVER_ONLINE = false;
  el.className    = 'srv-status offline';
  msg.textContent = '서버 오프라인 — CORS 프록시로 수집';
}
checkServer();

/* ─────────────────────────────────────────────
   RSS URL (CORS 프록시 fallback용)
───────────────────────────────────────────── */
const RSS_URLS = {
  hankyung:   'https://www.hankyung.com/feed/all-news',
  mk:         'https://www.mk.co.kr/rss/40300001/',
  edaily:     'https://rss.edaily.co.kr/edaily/section/economy.xml',
  yonhap:     'https://www.yonhapnewstv.co.kr/browse/feed/',
  biz:        'https://biz.chosun.com/arc/outboundfeeds/rss/?outputType=xml',
  sedaily:    'https://www.sedaily.com/RSS/V7.xml',
  etnews:     'https://rss.etnews.com/Section901.xml',
  yonhap_all: 'https://www.yonhapnews.co.kr/RSS/headline.xml',
  chosun:     'https://www.chosun.com/arc/outboundfeeds/rss/?outputType=xml',
  joongang:   'https://rss.joins.com/joins_news_list.xml',
  donga:      'https://rss.donga.com/total.xml',
  kbs:        'https://world.kbs.co.kr/rss/rss_news.htm?lang=k',
  mbc:        'https://imnews.imbc.com/rss/news/news_00.xml',
  sbs:        'https://news.sbs.co.kr/news/newsflash.do?plink=rss&cooper=sbs&division=01',
};

/* CORS 프록시 목록 */
const CORS_PROXIES = [
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  u => `https://thingproxy.freeboard.io/fetch/${u}`,
];

async function fetchViaProxy(url) {
  for (const proxy of CORS_PROXIES) {
    try {
      const r = await fetch(proxy(url), { signal: AbortSignal.timeout(9000) });
      if (!r.ok) continue;
      const t = await r.text();
      if (t && t.length > 200) return t;
    } catch {}
  }
  return null;
}

function parseRSSBrowser(xml, sourceKey) {
  try {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror')) return [];
    return [...doc.querySelectorAll('item')].slice(0, 35).map(el => {
      const raw = t =>
        (t || '').replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '')
                 .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();
      const title = raw(el.querySelector('title')?.textContent);
      const link  = raw(el.querySelector('link')?.textContent ||
                        el.querySelector('guid')?.textContent || '#');
      return { title, link, source: sourceKey };
    }).filter(i => i.title && i.title.length > 3);
  } catch { return []; }
}

/* ─────────────────────────────────────────────
   중복 그룹핑
───────────────────────────────────────────── */
const STOP = new Set(['및','의','을','를','이','가','은','는','에','서','로','와','과','하','했','한','등','위해','대한','통해','관련','따른','오는','이번','올해','지난','내년','현재','계획','예정','발표']);

function keywords(title) {
  return title.split(/[\s,·\[\]【】「」『』〈〉<>()（）!?…]+/)
    .map(w => w.trim()).filter(w => w.length >= 2 && !STOP.has(w)).slice(0, 7);
}

function groupDups(cards) {
  const groups = []; const done = new Set();
  cards.forEach((card, i) => {
    if (done.has(i)) return;
    const kwA   = keywords(card.item.title);
    const group = [card]; done.add(i);
    cards.forEach((other, j) => {
      if (i === j || done.has(j)) return;
      const kwB = keywords(other.item.title);
      const ov  = kwA.filter(k => kwB.includes(k)).length;
      if (ov / Math.max(kwA.length, kwB.length, 1) >= 0.5) {
        group.push(other); done.add(j);
      }
    });
    groups.push(group);
  });
  return groups;
}

/* ─────────────────────────────────────────────
   진행률
───────────────────────────────────────────── */
function setProg(pct, msg) {
  document.getElementById('prog-fill').style.width = pct + '%';
  document.getElementById('prog-msg').textContent  = msg;
}

/* ─────────────────────────────────────────────
   전역 상태
───────────────────────────────────────────── */
let allCards = [], allGroups = [];
let curSector = 'all', curSent = 'all', curSort = 'default';

/* ─────────────────────────────────────────────
   메인 수집 함수
───────────────────────────────────────────── */
async function fetchAllNews() {
  const btn  = document.getElementById('run-btn');
  const grid = document.getElementById('news-grid');

  btn.disabled = true; btn.textContent = '⏳ 수집 중...';
  grid.innerHTML =
    '<div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-text">RSS 수집 중...</div></div>';
  document.getElementById('filter-bar').style.display = 'none';
  document.getElementById('fail-wrap').style.display  = 'none';
  document.querySelectorAll('.src-cnt').forEach(el => {
    el.textContent = '-'; el.className = 'src-cnt';
  });
  setProg(5, '소스 확인 중...');

  const checked = [...document.querySelectorAll('.src-list input:checked')].map(i => i.value);
  if (!checked.length) { showToast('소스를 1개 이상 선택하세요'); resetBtn(btn); return; }

  const rawItems = []; const failed = [];
  const SRC_LABELS = window.SRC_LABELS;

  if (SERVER_ONLINE) {
    /* ── Vercel 서버 모드 (가장 안정적) ── */
    setProg(20, `서버에 RSS 요청 중... (${checked.length}개 소스)`);
    try {
      const r    = await fetch(`/api/rss?sources=${checked.join(',')}`, { signal: AbortSignal.timeout(30000) });
      const data = await r.json();
      if (data.success && data.items?.length) {
        rawItems.push(...data.items);
        Object.entries(data.sourceStats || {}).forEach(([k, v]) => {
          const el = document.getElementById(`cnt-${k}`);
          if (!el) return;
          el.textContent = v.count;
          el.className   = 'src-cnt ' + (v.ok ? 'ok' : 'err');
        });
        Object.entries(data.errors || {}).forEach(([k, msg]) => {
          if (msg) failed.push(SRC_LABELS[k] || k);
        });
      }
    } catch (e) {
      failed.push(...checked.map(k => SRC_LABELS[k] || k));
    }
  } else {
    /* ── CORS 프록시 fallback ── */
    for (let i = 0; i < checked.length; i++) {
      const key = checked[i];
      const url = RSS_URLS[key];
      if (!url) continue;
      const pct = 15 + Math.round((i / checked.length) * 55);
      setProg(pct, `${SRC_LABELS[key] || key} 수집 중... (${i+1}/${checked.length})`);
      const xml = await fetchViaProxy(url);
      const el  = document.getElementById(`cnt-${key}`);
      if (xml) {
        const items = parseRSSBrowser(xml, key);
        rawItems.push(...items);
        if (el) { el.textContent = items.length; el.className = 'src-cnt ok'; }
      } else {
        if (el) { el.textContent = '✕'; el.className = 'src-cnt err'; }
        failed.push(SRC_LABELS[key] || key);
      }
    }
  }

  setProg(75, `${rawItems.length}건 수집 → 분석 중...`);

  if (!rawItems.length) {
    showFailBanner(failed);
    resetBtn(btn); setProg(0, '수집 실패');
    return;
  }

  /* 중복 제거 */
  const seen = new Set();
  const deduped = rawItems.filter(i => {
    const k = i.title.slice(0, 22);
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });

  setProg(88, '분석 중...');
  const cards = deduped.map((item, idx) => {
    const analyzed = window.analyzeItem(item);
    return { ...analyzed, idx };
  });

  setProg(95, '그룹핑...');
  const groups = groupDups(cards);

  allCards = cards; allGroups = groups;
  curSector = 'all'; curSent = 'all'; curSort = 'default';

  renderGroups(groups);
  renderSectorSidebar(cards);
  renderFilterBar(cards);
  updateStats(cards, groups);

  const now       = new Date();
  const fmtTime   = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const tickerCnt = cards.filter(c => c.stocks.length > 0).length;
  const noiseCnt  = cards.filter(c => c.noise.isNoise).length;
  document.getElementById('main-sub').textContent =
    `${fmtTime} 기준 · ${cards.length}건 수집 · 종목 감지 ${tickerCnt}건 · 노이즈 ${noiseCnt}건`;

  if (failed.length)
    showToast(`${failed.length}개 소스 수집 실패: ${failed.slice(0,3).join(', ')}${failed.length>3?'…':''}`);

  setProg(100, `✓ 완료 — ${cards.length}건`);
  setTimeout(() => setProg(0, '대기 중...'), 3000);
  resetBtn(btn);
}

function resetBtn(btn) {
  btn.disabled = false; btn.textContent = '🔍 뉴스 검색';
}

/* ─────────────────────────────────────────────
   실패 배너
───────────────────────────────────────────── */
function showFailBanner(failed) {
  const wrap = document.getElementById('fail-wrap');
  wrap.style.display = 'block';
  wrap.innerHTML = `
    <div class="fail-banner">
      <strong>⚠ RSS 수집 실패 — 원인 및 해결 방법</strong><br>
      ${failed.length ? `<br>실패한 소스: <strong>${failed.join(', ')}</strong><br>` : ''}
      <br>
      <strong>원인 1 — Vercel 미배포</strong><br>
      <code>vercel dev</code> 또는 <code>vercel deploy</code>로 서버를 실행하세요.<br>
      <br>
      <strong>원인 2 — CORS 프록시 차단</strong><br>
      브라우저 직접 fetch는 CORS 정책으로 차단됩니다.
      무료 프록시(<code>allorigins.win</code> 등)가 일시적으로 다운됐을 수 있습니다.<br>
      <br>
      <strong>빠른 확인 — 샘플 데이터로 UI 테스트</strong><br>
      <button class="sample-btn" onclick="loadSample()">📋 샘플 데이터 로드</button>
    </div>
  `;
  document.getElementById('news-grid').innerHTML =
    '<div class="empty-state"><div class="empty-icon">📡</div><div class="empty-text">수집된 뉴스가 없습니다</div><div class="empty-sub">위 안내를 확인하거나 샘플 데이터를 로드하세요</div></div>';
}

/* ─────────────────────────────────────────────
   샘플 데이터
───────────────────────────────────────────── */
function loadSample() {
  document.getElementById('fail-wrap').style.display = 'none';
  const raw = [
    { t:'삼성전자, 2분기 영업이익 10조원 돌파 전망… HBM 수요 급증',         s:'hankyung' },
    { t:'SK하이닉스, 엔비디아와 HBM4 독점 공급 계약 체결 확정',             s:'mk' },
    { t:'에코프로비엠 2차전지 양극재 수주 5조원 달성… 역대 최대',           s:'edaily' },
    { t:'한국은행, 기준금리 동결… 하반기 인하 가능성 열어둬',               s:'yonhap' },
    { t:'현대차·기아, 미국 전기차 시장 점유율 20% 돌파',                   s:'biz' },
    { t:'LG에너지솔루션, 폭스바겐과 전고체 배터리 공동개발 협약',           s:'sedaily' },
    { t:'셀트리온 바이오시밀러 FDA 승인 임박… 주가 급등 가능성',            s:'hankyung' },
    { t:'포스코홀딩스 리튬 사업 흑자 전환 성공, 2차전지 가치 재조명',       s:'mk' },
    { t:'네이버 생성형 AI 서비스 월 활성 이용자 1000만 돌파',               s:'edaily' },
    { t:'한화에어로스페이스 K9 자주포 폴란드 추가 수주 1조원',              s:'yonhap' },
    { t:'HD현대중공업, LNG선 10척 수주… 수주잔고 역대 최대 30조 돌파',     s:'hankyung' },
    { t:'카카오, AI 구독 서비스 출시… 월정액 1만5천원 책정',               s:'mk' },
    { t:'알테오젠, 미국 빅파마와 기술수출 계약 5억달러 체결',               s:'edaily' },
    { t:'HLB, 신약 FDA 임상 3상 최종 결과 발표 임박… 승인 기대감',         s:'yonhap' },
    { t:'두산에너빌리티, SMR 소형 원전 사업 수주 2030년 본격화',           s:'hankyung' },
    { t:'삼성SDI, 유럽 전기차 배터리 공장 추가 투자 결정',                 s:'mk' },
    { t:'한화시스템, 위성통신 안테나 사업 수출 계약 체결',                  s:'edaily' },
    { t:'현대로템, K2 전차 폴란드 2차 물량 수주 가시화',                   s:'yonhap' },
    // 노이즈 샘플
    { t:'아이돌 그룹 멤버 열애설 확인, 소속사 "사생활 존중"',              s:'sbs' },
    { t:'대통령, 여야 정상회담 제안… 야당 "진정성 없다" 거부',             s:'kbs' },
    { t:'태풍 북상 중, 제주도 강풍 경보 발령 예상',                        s:'mbc' },
    { t:'KBO 한국시리즈 1차전 결과, 팬들 열기 뜨거워',                     s:'sbs' },
    { t:'검찰, 대기업 임원 횡령 혐의 기소… 해당 계열사 주가 하락 우려',    s:'yonhap_all' },
    // 중복 그룹 테스트
    { t:'삼성전자 영업이익 10조원 전망, 반도체 초호황 신호탄',              s:'mk' },
    { t:'SK하이닉스 엔비디아 HBM 공급 계약 체결 최종 확정',                s:'sedaily' },
    { t:'LG에너지솔루션 전고체 배터리 개발 협약, 양산은 2027년',           s:'etnews' },
  ];

  const srcMap = {};
  const cards  = raw.map(({ t, s }, idx) => {
    srcMap[s] = (srcMap[s] || 0) + 1;
    const item     = { title: t, link: '#', source: s };
    const analyzed = window.analyzeItem(item);
    return { ...analyzed, idx };
  });

  Object.entries(srcMap).forEach(([k, v]) => {
    const el = document.getElementById(`cnt-${k}`);
    if (el) { el.textContent = v; el.className = 'src-cnt ok'; }
  });

  const groups = groupDups(cards);
  allCards = cards; allGroups = groups;
  curSector = 'all'; curSent = 'all'; curSort = 'default';

  renderGroups(groups);
  renderSectorSidebar(cards);
  renderFilterBar(cards);
  updateStats(cards, groups);

  const tickerCnt = cards.filter(c => c.stocks.length > 0).length;
  const noiseCnt  = cards.filter(c => c.noise.isNoise).length;
  document.getElementById('main-sub').textContent =
    `샘플 데이터 · ${cards.length}건 · 종목 감지 ${tickerCnt}건 · 노이즈 ${noiseCnt}건`;
  setProg(100, '✓ 샘플 로드 완료');
  setTimeout(() => setProg(0, '대기 중...'), 2000);
  showToast('샘플 데이터 로드 완료');
}

/* ─────────────────────────────────────────────
   렌더링
───────────────────────────────────────────── */
function renderGroups(groups) {
  const container = document.getElementById('news-grid');
  if (!groups.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">조건에 맞는 뉴스 없음</div></div>';
    return;
  }
  const frag = document.createDocumentFragment();
  groups.forEach((group, gi) => {
    if (group.length === 1) {
      frag.appendChild(makeCard(group[0]));
    } else {
      const lead = [...group].sort((a,b) => b.strength - a.strength)[0];
      const wrap = document.createElement('div');
      wrap.className = 'group-wrap';

      const hdr = document.createElement('div');
      hdr.className = 'group-hdr';
      hdr.innerHTML = `
        <span class="group-title">📎 ${esc(lead.item.title.slice(0,38))}${lead.item.title.length>38?'…':''}</span>
        <span class="group-badge">${group.length}개 매체</span>
        <span class="group-arrow" id="ga-${gi}">▼</span>`;
      hdr.onclick = () => toggleGroup(gi);

      const body = document.createElement('div');
      body.className = 'group-body'; body.id = `gb-${gi}`;
      group.forEach(card => body.appendChild(makeCard(card)));

      wrap.appendChild(hdr); wrap.appendChild(body);
      frag.appendChild(wrap);
    }
  });
  container.innerHTML = '';
  container.appendChild(frag);
}

function toggleGroup(gi) {
  const body  = document.getElementById(`gb-${gi}`);
  const arrow = document.getElementById(`ga-${gi}`);
  const hidden = body.style.display === 'none';
  body.style.display = hidden ? '' : 'none';
  arrow.textContent  = hidden ? '▼' : '▶';
}

/* ── 카드 생성 ── */
function makeCard(d) {
  const SECTOR_COL = window.SECTOR_COL;
  const SRC_LABELS = window.SRC_LABELS;

  const card = document.createElement('div');
  card.className = 'news-card' + (d.noise.isNoise ? ' noise-card' : '');
  card.style.animationDelay = `${Math.min(d.idx * 0.022, 0.44)}s`;
  card.dataset.sectors   = d.sectors.join(',');
  card.dataset.sentiment = d.sentiment.cls;
  card.dataset.noise     = d.noise.isNoise ? '1' : '0';

  /* 섹터 태그 */
  const tagHtml = d.sectors.length
    ? d.sectors.map(s => {
        const col = SECTOR_COL[s] || '#2563a8';
        return `<span class="sector-tag" style="background:${rgba(col,0.08)};color:${col};border-color:${rgba(col,0.18)}">${esc(s)}</span>`;
      }).join('')
    : '<span class="sector-tag tag-gray">미분류</span>';

  /* 종목 태그 — 네이버 금융 링크 */
  const tickerHtml = d.stocks.length
    ? '<div class="ticker-row">' + d.stocks.map(s =>
        `<a href="https://finance.naver.com/item/main.naver?code=${s.c}" target="_blank" class="ticker-tag${s.m==='KOSDAQ'?' kq':''}">
          📈 ${esc(s.name)} <span class="mkt-lbl">${s.m}</span></a>`
      ).join('') + '</div>'
    : '';

  /* 재료강도 pip */
  const pipClass = ['','f1','f2','f3','f4','f5'];
  const pips = [1,2,3,4,5].map(n =>
    `<div class="pip${n <= d.strength ? ' '+pipClass[d.strength] : ''}"></div>`
  ).join('');
  const strLbl = ['','관망','약한 재료','보통 재료','강한 재료','핵심 재료'];

  /* 노이즈 이유 박스 */
  const noiseHtml = d.noise.isNoise ? `
    <div class="noise-reason">
      <span class="nr-icon">⚠</span>
      <div>
        <div class="nr-label">${esc(d.noise.label)} — 노이즈 가능성 ${d.noise.lv==='high'?'높음':'보통'}</div>
        <div class="nr-detail">${esc(d.noise.tip)}</div>
      </div>
    </div>` : '';

  card.innerHTML = `
    <div class="card-top">
      <div class="card-title">
        <a href="${d.item.link}" target="_blank" rel="noopener">${esc(d.item.title)}</a>
      </div>
      <div class="card-right">
        <span class="sent-badge ${d.sentiment.cls}">${d.sentiment.label}</span>
        <button class="share-btn" onclick="shareItem('${encodeURIComponent(d.item.title)}','${esc(d.item.link)}')" title="공유">↗</button>
      </div>
    </div>
    <div class="card-meta">
      <span class="src-badge">${esc(SRC_LABELS[d.item.source] || d.item.source)}</span>
    </div>
    ${noiseHtml}
    <div class="material-row">
      <div class="pip-bar">${pips}</div>
      <span class="pip-lbl">${strLbl[d.strength]}</span>
    </div>
    <div class="tag-row">${tagHtml}</div>
    ${tickerHtml}
  `;
  return card;
}

/* ── 섹터 사이드바 ── */
function renderSectorSidebar(cards) {
  const SECTOR_COL = window.SECTOR_COL;
  const map = {};
  cards.forEach(c => c.sectors.forEach(s => { map[s] = (map[s]||0)+1; }));
  const el = document.getElementById('sector-list');
  let html = `<div class="sector-row ${curSector==='all'?'active':''}" onclick="filterSector('all')">
    <div class="sector-dot" style="background:var(--accent)"></div>
    <span class="sector-name">전체</span><span class="sector-cnt">${cards.length}</span></div>`;
  Object.entries(map).sort((a,b)=>b[1]-a[1]).forEach(([s,n]) => {
    const col = SECTOR_COL[s] || '#888';
    html += `<div class="sector-row ${curSector===s?'active':''}" onclick="filterSector('${s}')">
      <div class="sector-dot" style="background:${col}"></div>
      <span class="sector-name">${s}</span><span class="sector-cnt">${n}</span></div>`;
  });
  el.innerHTML = html;
}

/* ── 필터바 ── */
function renderFilterBar(cards) {
  const bar = document.getElementById('filter-bar');
  bar.style.display = 'flex';
  const pos   = cards.filter(c => c.sentiment.cls === 'sent-pos').length;
  const neg   = cards.filter(c => c.sentiment.cls === 'sent-neg').length;
  const noise = cards.filter(c => c.noise.isNoise).length;

  const fb = (val, label, style='') =>
    `<button class="flt-btn ${curSent===val?'active':''}" onclick="filterSent('${val}')" style="${style}">${label}</button>`;

  bar.innerHTML = `
    ${fb('all',        `전체 ${cards.length}`)}
    ${fb('sent-pos',   `▲ 긍정 ${pos}`,   curSent==='sent-pos' ?'':'color:var(--green);border-color:rgba(46,125,82,0.3)')}
    ${fb('sent-neg',   `▼ 부정 ${neg}`,   curSent==='sent-neg' ?'':'color:var(--red);border-color:rgba(192,57,43,0.3)')}
    ${fb('sent-neu',   `— 중립`)}
    ${fb('noise-only', `⚠ 노이즈 ${noise}`, curSent==='noise-only'?'':'color:var(--orange);border-color:rgba(212,80,10,0.3)')}
    <select class="sort-sel" onchange="sortCards(this.value)">
      <option value="default"     ${curSort==='default'    ?'selected':''}>기본순</option>
      <option value="strength-hi" ${curSort==='strength-hi'?'selected':''}>재료강도↑</option>
      <option value="strength-lo" ${curSort==='strength-lo'?'selected':''}>재료강도↓</option>
      <option value="ticker"      ${curSort==='ticker'     ?'selected':''}>종목 우선</option>
      <option value="no-noise"    ${curSort==='no-noise'   ?'selected':''}>노이즈 제외</option>
    </select>
  `;
}

/* ── 통계 ── */
function updateStats(cards, groups) {
  document.getElementById('st-total').textContent  = cards.length;
  document.getElementById('st-group').textContent  = groups.filter(g=>g.length>1).length;
  document.getElementById('st-pos').textContent    = cards.filter(c=>c.sentiment.cls==='sent-pos').length;
  document.getElementById('st-neg').textContent    = cards.filter(c=>c.sentiment.cls==='sent-neg').length;
  document.getElementById('st-ticker').textContent = cards.filter(c=>c.stocks.length>0).length;
  document.getElementById('st-noise').textContent  = cards.filter(c=>c.noise.isNoise).length;
}

/* ─────────────────────────────────────────────
   필터 & 정렬
───────────────────────────────────────────── */
function applyAll() {
  let filtered = [...allCards];
  if (curSector !== 'all')
    filtered = filtered.filter(c => c.sectors.includes(curSector));
  if (curSent === 'noise-only')
    filtered = filtered.filter(c => c.noise.isNoise);
  else if (curSent !== 'all')
    filtered = filtered.filter(c => c.sentiment.cls === curSent);

  if (curSort === 'strength-hi')  filtered.sort((a,b) => b.strength - a.strength);
  else if (curSort === 'strength-lo') filtered.sort((a,b) => a.strength - b.strength);
  else if (curSort === 'ticker')  filtered.sort((a,b) => b.stocks.length - a.stocks.length);
  else if (curSort === 'no-noise') filtered = filtered.filter(c => !c.noise.isNoise);

  renderGroups(groupDups(filtered));
}

function filterSector(s) {
  curSector = s; applyAll(); renderSectorSidebar(allCards);
  if (window.innerWidth <= 720) document.getElementById('sidebar').classList.remove('open');
}
function filterSent(s) { curSent = s; applyAll(); renderFilterBar(allCards); }
function sortCards(mode) { curSort = mode; applyAll(); }

/* ─────────────────────────────────────────────
   공유 / 유틸
───────────────────────────────────────────── */
async function shareItem(title, url) {
  const decoded = decodeURIComponent(title);
  if (navigator.share) { try { await navigator.share({ title: decoded, url }); return; } catch {} }
  try { await navigator.clipboard.writeText(url); showToast('링크 복사됨'); }
  catch { prompt('링크:', url); }
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

function rgba(hex, a) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
