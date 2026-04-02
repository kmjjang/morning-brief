'use strict';
/* ════════════════════════════════════════
   analyzer.js — 분석 데이터 & 순수 함수
   main.js보다 먼저 로드되어야 합니다.
════════════════════════════════════════ */

/* ── 소스 라벨 ── */
const SRC_LABELS = {
  hankyung:'한국경제', mk:'매일경제', edaily:'이데일리',
  yonhap:'연합뉴스', biz:'조선비즈', sedaily:'서울경제', etnews:'전자신문',
  yonhap_all:'연합(전체)', chosun:'조선일보', joongang:'중앙일보',
  donga:'동아일보', kbs:'KBS', mbc:'MBC', sbs:'SBS',
};

/* ── 섹터 키워드 맵 ── */
const KW_SECTOR = {
  '반도체':'반도체','HBM':'반도체','DRAM':'반도체','낸드':'반도체','파운드리':'반도체',
  '엔비디아':'반도체','삼성전자':'반도체','SK하이닉스':'반도체','TSMC':'반도체','웨이퍼':'반도체','칩':'반도체',
  '인공지능':'AI·인공지능','AI':'AI·인공지능','챗GPT':'AI·인공지능','LLM':'AI·인공지능',
  '생성형':'AI·인공지능','GPT':'AI·인공지능','딥러닝':'AI·인공지능','데이터센터':'AI·인공지능',
  '배터리':'2차전지','2차전지':'2차전지','양극재':'2차전지','전고체':'2차전지',
  '에코프로':'2차전지','포스코퓨처엠':'2차전지','엘앤에프':'2차전지','리튬':'2차전지','SDI':'2차전지',
  '전기차':'전기차·자동차','자동차':'전기차·자동차','현대차':'전기차·자동차',
  '테슬라':'전기차·자동차','기아':'전기차·자동차','자율주행':'전기차·자동차',
  '바이오':'바이오·제약','제약':'바이오·제약','신약':'바이오·제약','FDA':'바이오·제약',
  '임상':'바이오·제약','셀트리온':'바이오·제약','삼성바이오':'바이오·제약','항암':'바이오·제약',
  '금리':'금융·보험','한국은행':'금융·보험','연준':'금융·보험','증권':'금융·보험',
  '은행':'금융·보험','보험':'금융·보험','채권':'금융·보험','환율':'금융·보험','기준금리':'금융·보험',
  '핀테크':'핀테크·인터넷','간편결제':'핀테크·인터넷','가상자산':'핀테크·인터넷',
  '코인':'핀테크·인터넷','카카오':'핀테크·인터넷','네이버':'핀테크·인터넷','블록체인':'핀테크·인터넷',
  '원전':'원전·신재생','태양광':'원전·신재생','수소':'원전·신재생','풍력':'원전·신재생','SMR':'원전·신재생',
  '방산':'방산·우주','무기':'방산·우주','우주':'방산·우주','발사체':'방산·우주','드론':'방산·우주','위성':'방산·우주',
  '조선':'조선·해운','해운':'조선·해운','선박':'조선·해운','LNG선':'조선·해운',
  '부동산':'건설·부동산','아파트':'건설·부동산','건설':'건설·부동산','분양':'건설·부동산','재건축':'건설·부동산',
  '유통':'유통·소비','소비':'유통·소비','백화점':'유통·소비','편의점':'유통·소비','쿠팡':'유통·소비',
  '철강':'철강·화학','석유화학':'철강·화학','포스코':'철강·화학',
  '엔터':'엔터·미디어','연예':'엔터·미디어','아이돌':'엔터·미디어','드라마':'엔터·미디어','OTT':'엔터·미디어',
  '하이브':'엔터·미디어','SM엔터':'엔터·미디어','JYP':'엔터·미디어','YG':'엔터·미디어',
  '관광':'관광·레저','여행':'관광·레저','카지노':'관광·레저','면세':'관광·레저',
  '식품':'식품·농업','농업':'식품·농업',
};

/* ── 섹터 색상 ── */
const SECTOR_COL = {
  '반도체':'#4e9af1','AI·인공지능':'#7c6fcd','2차전지':'#e67e22',
  '전기차·자동차':'#27ae60','바이오·제약':'#e91e8c','금융·보험':'#1a7a68',
  '핀테크·인터넷':'#2980b9','원전·신재생':'#8bc34a','방산·우주':'#795548',
  '조선·해운':'#00bcd4','건설·부동산':'#ff7043','유통·소비':'#ab47bc',
  '철강·화학':'#607d8b','엔터·미디어':'#f06292','관광·레저':'#26c6da','식품·농업':'#66bb6a',
};

/* ── 종목 DB (긴 이름 우선 정렬) ── */
const STOCK_RAW = {
  // KOSPI
  '삼성전자':{c:'005930',m:'KOSPI'},'SK하이닉스':{c:'000660',m:'KOSPI'},
  'LG에너지솔루션':{c:'373220',m:'KOSPI'},'삼성바이오로직스':{c:'207940',m:'KOSPI'},
  '현대차':{c:'005380',m:'KOSPI'},'셀트리온':{c:'068270',m:'KOSPI'},
  '기아':{c:'000270',m:'KOSPI'},'포스코홀딩스':{c:'005490',m:'KOSPI'},
  '포스코퓨처엠':{c:'003670',m:'KOSPI'},'LG화학':{c:'051910',m:'KOSPI'},
  '삼성SDI':{c:'006400',m:'KOSPI'},'KB금융':{c:'105560',m:'KOSPI'},
  '신한지주':{c:'055550',m:'KOSPI'},'하나금융지주':{c:'086790',m:'KOSPI'},
  '카카오':{c:'035720',m:'KOSPI'},'네이버':{c:'035420',m:'KOSPI'},
  'HD현대중공업':{c:'329180',m:'KOSPI'},'HD현대':{c:'267250',m:'KOSPI'},
  '삼성중공업':{c:'010140',m:'KOSPI'},'한화오션':{c:'042660',m:'KOSPI'},
  '두산에너빌리티':{c:'034020',m:'KOSPI'},'한화에어로스페이스':{c:'012450',m:'KOSPI'},
  'LIG넥스원':{c:'079550',m:'KOSPI'},'현대건설':{c:'000720',m:'KOSPI'},
  '삼성물산':{c:'028260',m:'KOSPI'},'한국전력':{c:'015760',m:'KOSPI'},
  'SK텔레콤':{c:'017670',m:'KOSPI'},'LG전자':{c:'066570',m:'KOSPI'},
  '현대모비스':{c:'012330',m:'KOSPI'},'한화솔루션':{c:'009830',m:'KOSPI'},
  '롯데케미칼':{c:'011170',m:'KOSPI'},'한미약품':{c:'128940',m:'KOSPI'},
  '유한양행':{c:'000100',m:'KOSPI'},'종근당':{c:'185750',m:'KOSPI'},
  '삼성생명':{c:'032830',m:'KOSPI'},'삼성화재':{c:'000810',m:'KOSPI'},
  '메리츠금융지주':{c:'138040',m:'KOSPI'},'현대제철':{c:'004020',m:'KOSPI'},
  '이마트':{c:'139480',m:'KOSPI'},'하이브':{c:'352820',m:'KOSPI'},
  '크래프톤':{c:'259960',m:'KOSPI'},'현대로템':{c:'064350',m:'KOSPI'},
  '한국항공우주':{c:'047810',m:'KOSPI'},'효성중공업':{c:'298040',m:'KOSPI'},
  '씨에스윈드':{c:'112610',m:'KOSPI'},'HMM':{c:'011200',m:'KOSPI'},
  '팬오션':{c:'028670',m:'KOSPI'},'한미반도체':{c:'042700',m:'KOSPI'},
  '한화시스템':{c:'272210',m:'KOSPI'},'두산퓨얼셀':{c:'336260',m:'KOSPI'},
  'KT&G':{c:'033780',m:'KOSPI'},'KT':{c:'030200',m:'KOSPI'},
  // KOSDAQ
  '에코프로비엠':{c:'247540',m:'KOSDAQ'},'에코프로':{c:'086520',m:'KOSDAQ'},
  '엘앤에프':{c:'066970',m:'KOSDAQ'},'카카오뱅크':{c:'323410',m:'KOSDAQ'},
  '카카오페이':{c:'377300',m:'KOSDAQ'},'알테오젠':{c:'196170',m:'KOSDAQ'},
  'HLB':{c:'028300',m:'KOSDAQ'},'파마리서치':{c:'214450',m:'KOSDAQ'},
  '리노공업':{c:'058470',m:'KOSDAQ'},'HPSP':{c:'403870',m:'KOSDAQ'},
  '레인보우로보틱스':{c:'277810',m:'KOSDAQ'},'솔브레인':{c:'357780',m:'KOSDAQ'},
  '클래시스':{c:'214150',m:'KOSDAQ'},'더블유씨피':{c:'393890',m:'KOSDAQ'},
  '이오테크닉스':{c:'039030',m:'KOSDAQ'},'원익IPS':{c:'240810',m:'KOSDAQ'},
  '펄어비스':{c:'263750',m:'KOSDAQ'},'SM엔터테인먼트':{c:'041510',m:'KOSDAQ'},
  'JYP엔터':{c:'035900',m:'KOSDAQ'},'YG엔터테인먼트':{c:'122870',m:'KOSDAQ'},
  '실리콘투':{c:'257720',m:'KOSDAQ'},
};
/* 긴 이름 먼저 정렬 → "SK하이닉스"가 "SK"에 먹히지 않음 */
const STOCK_SORTED = Object.entries(STOCK_RAW).sort((a,b) => b[0].length - a[0].length);

/* 영문 단독 약어 (단어경계 필요) */
const SHORT_STOCKS = {
  'HLB' :{c:'028300',m:'KOSDAQ'},
  'HMM' :{c:'011200',m:'KOSPI'},
  'HPSP':{c:'403870',m:'KOSDAQ'},
  'KT'  :{c:'030200',m:'KOSPI'},
};

/* ── 노이즈 규칙 ── */
const NOISE_RULES = [
  { re:/연예인|배우|가수|아이돌|결혼|이혼|열애|교제|스캔들|사생활/,
    lv:'high',  label:'연예 사생활', tip:'엔터 종목 직접 언급 시만 참고' },
  { re:/국회의원|대통령|여당|야당|탄핵|선거|공천|의석|정치권/,
    lv:'high',  label:'정치 뉴스',   tip:'정책·규제 변화로 이어질 때만 체크' },
  { re:/날씨|기상|태풍|홍수|지진|폭염|한파/,
    lv:'medium',label:'날씨·재해',   tip:'물류·보험·건설 간접 영향 가능' },
  { re:/스포츠|올림픽|월드컵|야구|축구|농구|배구|골프/,
    lv:'medium',label:'스포츠',      tip:'중계권·스폰서십 관련 종목만 참고' },
  { re:/검찰|재판|구속|기소|판결|유죄|무죄/,
    lv:'medium',label:'사법 뉴스',   tip:'해당 기업 직접 연관 여부 확인 필요' },
  { re:/외교|정상회담|조약|협약|유엔|나토/,
    lv:'medium',label:'외교·국제',   tip:'방산·무역 관련 종목 간접 영향 가능' },
];

/* ── 감성 키워드 ── */
const POS = ['상승','증가','성장','호실적','수주','흑자','돌파','급등','강세','개선','회복','반등','최대','역대','확대','수익','호조','성공','계약','협력','승인','허가','최고'];
const NEG = ['하락','감소','적자','리스크','우려','위기','제재','손실','침체','급락','약세','부진','악화','폭락','불안','둔화','축소','지연','취소','실패','부도','제한'];

/* ── 재료강도 규칙 ── */
const STR_RULES = [
  { re:/수주|계약|수익|실적|영업이익|매출|흑자|상장|IPO|배당/, v:2 },
  { re:/적자|손실|부도|상장폐지|회계|횡령|분식/, v:2 },
  { re:/FDA|임상|승인|허가|특허/, v:2 },
  { re:/인수|합병|M&A|지분|매각/, v:2 },
  { re:/금리|기준금리|연준|한국은행|통화정책/, v:2 },
  { re:/삼성전자|SK하이닉스|현대차|셀트리온|LG에너지/, v:1 },
  { re:/급등|급락|폭등|폭락|서킷브레이커/, v:2 },
  { re:/정치|연예|스포츠|날씨|외교/, v:-2 },
  { re:/우려|전망|예상|분석|관측/, v:-1 },
];

/* ════════════════════════════════════════
   분석 함수 — window에 노출
════════════════════════════════════════ */

window.SRC_LABELS  = SRC_LABELS;
window.KW_SECTOR   = KW_SECTOR;
window.SECTOR_COL  = SECTOR_COL;
window.STOCK_RAW   = STOCK_RAW;
window.STOCK_SORTED = STOCK_SORTED;
window.SHORT_STOCKS = SHORT_STOCKS;
window.NOISE_RULES = NOISE_RULES;

window.detectStocks = function(title) {
  const found = []; const used = new Set();
  for (const [name, info] of STOCK_SORTED) {
    if (used.has(info.c)) continue;
    if (title.includes(name)) { found.push({ name, ...info }); used.add(info.c); }
  }
  for (const [sym, info] of Object.entries(SHORT_STOCKS)) {
    if (used.has(info.c)) continue;
    if (new RegExp(`(?<![가-힣A-Za-z0-9])${sym}(?![가-힣A-Za-z0-9&])`).test(title)) {
      found.push({ name: sym, ...info }); used.add(info.c);
    }
  }
  return found;
};

window.detectSectors = function(title) {
  const s = new Set();
  for (const [kw, sec] of Object.entries(KW_SECTOR)) if (title.includes(kw)) s.add(sec);
  return [...s];
};

window.detectSentiment = function(title) {
  let s = 0;
  POS.forEach(w => { if (title.includes(w)) s++; });
  NEG.forEach(w => { if (title.includes(w)) s--; });
  if (s > 0) return { label:'▲ 긍정', cls:'sent-pos' };
  if (s < 0) return { label:'▼ 부정', cls:'sent-neg' };
  return { label:'— 중립', cls:'sent-neu' };
};

window.analyzeNoise = function(title) {
  for (const r of NOISE_RULES) {
    if (r.re.test(title))
      return { isNoise: true, lv: r.lv, label: r.label, tip: r.tip };
  }
  return { isNoise: false };
};

window.calcStrength = function(title, sectors, stocks) {
  let s = 1;
  STR_RULES.forEach(r => { if (r.re.test(title)) s += r.v; });
  if (stocks.length) s++;
  if (sectors.length) s += 0.5;
  return Math.max(1, Math.min(5, Math.round(s)));
};

/* main.js에서 호출하는 통합 분석 함수 */
window.analyzeItem = function(item) {
  const sectors   = window.detectSectors(item.title);
  const sentiment = window.detectSentiment(item.title);
  const stocks    = window.detectStocks(item.title);
  const noise     = window.analyzeNoise(item.title);
  const strength  = window.calcStrength(item.title, sectors, stocks);
  return { item, sectors, sentiment, stocks, noise, strength };
};
