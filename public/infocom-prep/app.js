(function(){
const D = window.APPDATA;
const view = document.getElementById('view');
const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// ---------- state ----------
const LS = {
  get(k,def){ try{return JSON.parse(localStorage.getItem('icp_'+k))??def}catch(e){return def} },
  set(k,v){ localStorage.setItem('icp_'+k, JSON.stringify(v)); }
};
let stH = LS.get('hoedok',{}), stA = LS.get('amgi',{}), stS = LS.get('sched',{}), stSrs = LS.get('srs',{}), stWeak = LS.get('weak',{});
let stWrong = LS.get('wrong',{}), stMemo = LS.get('memo',{});
// 기출 PDF는 로컬 개발 서버에서만 번들 → 네이티브/공개웹에선 버튼 숨김(재배포 방지)
const PDFON = location.protocol==='http:' && (location.hostname==='localhost'||location.hostname==='127.0.0.1'||/^(192|10|172)\./.test(location.hostname));

// ---------- dates ----------
const examDate=new Date(D.examDate+'T00:00:00'), startDate=new Date(D.studyStart+'T00:00:00');
const today=new Date(); today.setHours(0,0,0,0);
const dday=()=>Math.ceil((examDate-today)/86400000);
const flatDays=[]; (function(){let i=0;
  D.schedule.forEach(w=>w.days.forEach(d=>{const dt=new Date(startDate);dt.setDate(dt.getDate()+i);flatDays.push({...d,week:w.label,wid:w.id,idx:i,dt});i++;}));})();
const sameDay=(a,b)=>a.toDateString()===b.toDateString();
const todayDay=flatDays.find(d=>sameDay(d.dt,today));
const kdate=d=>`${d.getMonth()+1}월 ${d.getDate()}일`;

// ---------- deck + SRS (간격 반복 학습 엔진) ----------
const DECK=[
  ...D.seongchwi.map(s=>({id:'s:'+s.code,type:'성취기준',area:s.area||s.level,front:'['+s.code+'] '+(s.area||s.level),back:s.text})),
  ...(D.concepts||[]).map((c,i)=>({id:'c:'+i,type:'개념',area:c.area,front:c.front,back:c.back}))
];
const byId={}; DECK.forEach(c=>byId[c.id]=c);
const CAREAS=[...new Set(DECK.filter(c=>c.type==='개념').map(c=>c.area))];  // 개념카드가 있는 영역
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
// 회독 영역 → 개념/노트 영역 매핑 (이름 차이 흡수)
const AREA2CONCEPT={'운영체제':'운영체제','데이터베이스':'데이터베이스','프로그래밍·언어론':'프로그래밍','컴퓨터구조·논리회로':'컴퓨터구조','컴퓨터네트워크':'컴퓨터네트워크','알고리즘':'알고리즘','자료구조':'자료구조','인공지능·기계학습':'인공지능','정보과교육과정':'정보과교육과정','교수·학습방법':'교수학습','평가':'평가','정보윤리교육':'정보과교육과정'};
const blankify=t=>t.split(' ').map((w,i)=>(i%3===2&&w.length>1)?`<span class="blank">${esc(w)}</span>`:esc(w)).join(' ');
const INTERVALS=[0,1,3,7,16,35];
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const todayStr=ymd(today);
const addDays=n=>{const d=new Date(today);d.setDate(d.getDate()+n);return ymd(d);};
const srsOf=id=>stSrs[id]||{box:0,due:todayStr};
const isDue=id=>srsOf(id).due<=todayStr;
function grade(id,g){let b=srsOf(id).box; if(g===0)b=0; else if(g===2)b=Math.min(5,b+1); stSrs[id]={box:b,due:addDays(INTERVALS[b])}; LS.set('srs',stSrs);}
const NEW_PER_DAY=30;  // 신규 카드 일일 상한(복습은 전부, 신규만 제한)
function reviewQueue(){const seen=[],fresh=[];DECK.forEach(c=>{if(!isDue(c.id))return;(stSrs[c.id]?seen:fresh).push(c.id);});
  const q=seen.concat(fresh.slice(0,NEW_PER_DAY));
  return q.sort((a,b)=>(stWeak[byId[b].area]?1:0)-(stWeak[byId[a].area]?1:0));}  // 약함 영역 우선
const deckLearned=()=>DECK.filter(c=>srsOf(c.id).box>=3).length;
// 기존 암기함 기록 → SRS 흡수(1회)
(function(){let ch=false;Object.keys(stA).forEach(code=>{if(stA[code]){const id='s:'+code;if(!stSrs[id]){stSrs[id]={box:2,due:addDays(3)};ch=true;}}});if(ch)LS.set('srs',stSrs);})();

// ---------- progress ----------
function hoedokDone(){let n=0,t=0;D.hoedok.forEach(a=>a.questions.forEach(q=>{t++;if((stH[q.src]||[]).some(Boolean))n++;}));return[n,t];}
function schedDone(){return[Object.values(stS).filter(Boolean).length,flatDays.length];}
const pct=(n,t)=>t?Math.max(n?1:0,Math.round(n/t*100)):0;
const bar=(n,t,amber,thin)=>`<div class="bar ${amber?'amber':''} ${thin?'thin':''}"><i style="width:${pct(n,t)}%"></i></div>`;

// ---------- HOME ----------
function weekStatus(){ if(today<startDate) return '준비 주차'; if(todayDay) return `${todayDay.wid} · ${todayDay.week}`; return '마무리'; }
function todoCard(){
  if(todayDay){
    const done=stS[todayDay.idx];
    return `<div class="card todo">
      <div class="between"><span class="tagblue">오늘 할 일</span><span class="mono" style="font-size:11px;color:var(--mut)">${todayDay.wid} · ${todayDay.date} (${todayDay.dow})</span></div>
      <div style="margin-top:11px;font-size:18px;font-weight:700;color:var(--ink)">${esc(todayDay.week)}</div>
      ${todayDay.am?`<div class="am"><span class="seg">오전</span><span class="txt">${esc(todayDay.am)}</span></div>`:''}
      ${todayDay.pm?`<div class="am"><span class="seg">오후</span><span class="txt">${esc(todayDay.pm)}</span></div>`:''}
      <button class="btn ${done?'':'pri'} block" id="dayChk" style="margin-top:14px">${done?'✓ 오늘 완료됨':'오늘 학습 완료'}<span class="ckcircle">✓</span></button>
    </div>`;
  }
  if(today<startDate){
    const dn=Math.ceil((startDate-today)/86400000), f=flatDays[0];
    return `<div class="card todo">
      <div class="between"><span class="tagblue">시작 준비</span><span class="mono" style="font-size:11px;color:var(--mut)">${f.date}(${f.dow}) 시작</span></div>
      <div style="margin-top:11px;font-size:18px;font-weight:700;color:var(--ink)">학습 시작까지 D-${dn}</div>
      ${f.am?`<div class="am"><span class="seg">첫날 오전</span><span class="txt">${esc(f.am)}</span></div>`:''}
      ${f.pm?`<div class="am"><span class="seg">첫날 오후</span><span class="txt">${esc(f.pm)}</span></div>`:''}
    </div>`;
  }
  return `<div class="card todo"><span class="tagblue">2단계 종료</span><div style="margin-top:11px;font-size:16px;font-weight:700">기출 회독(3단계)로</div></div>`;
}
function renderHome(){
  const [hn,ht]=hoedokDone(),[sn,st]=schedDone();
  const dl=deckLearned(), dt=DECK.length, due=reviewQueue().length;
  const dayLab = todayDay?('DAY '+(todayDay.idx+1)):(today<startDate?'시작 전':'종료');
  const weak=D.hoedok.map(a=>{const n=a.questions.filter(q=>(stH[q.src]||[]).some(Boolean)).length;return{nm:a.area,n,t:a.questions.length};})
    .sort((x,y)=>pct(x.n,x.t)-pct(y.n,y.t)).slice(0,5);
  view.innerHTML=`
    <div class="vhead today">
      <div class="htop"><span class="brand">합격노트</span><span class="pill">시험일 ${examDate.getFullYear()}.${examDate.getMonth()+1}.${examDate.getDate()} (토)</span></div>
      <div class="lab">1차 시험까지</div>
      <div class="ddrow"><div class="dday">${dday()>=0?'D-'+dday():'완료'}</div><div class="ddmeta">오늘 ${kdate(today)}<br>${weekStatus()}</div></div>
    </div>
    <div class="vbody">
      ${todoCard()}
      ${due?`<button class="btn pri block" id="goReview" style="height:52px;font-size:15px">🎴 오늘 복습 ${due}장 시작 →</button>`
           :`<div class="card" style="text-align:center;color:var(--mut);font-size:13px">오늘 복습할 카드가 없어요 · 학습 탭에서 영역별로 둘러볼 수 있어요</div>`}
      <div class="card">
        <div class="between" style="margin-bottom:12px"><span class="cardtitle">진척</span><span class="mono" style="font-size:10.5px;color:var(--mut3)">${dayLab}</span></div>
        <div class="prow"><span class="k">기출 회독</span><span class="v">${hn} / ${ht}</span></div>${bar(hn,ht)}
        <div class="prow" style="margin-top:11px"><span class="k">카드 학습</span><span class="v">${dl} / ${dt}</span></div>${bar(dl,dt)}
        <div class="prow" style="margin-top:11px"><span class="k">일정</span><span class="v">${sn} / ${st}일</span></div>${bar(sn,st)}
      </div>
      <div class="card">
        <div class="cardtitle" style="margin-bottom:6px">약점 · 회독 미진 Top 5</div>
        ${weak.map(o=>`<div class="weak"><span class="nm">${esc(o.nm)}</span><div class="bar amber thin" style="flex:1 1 0;margin-top:0"><i style="width:${pct(o.n,o.t)}%"></i></div><span class="ct">${o.n}/${o.t}</span></div>`).join('')}
      </div>
    </div>`;
  const c=document.getElementById('dayChk'); if(c)c.onclick=()=>{stS[todayDay.idx]=stS[todayDay.idx]?0:1;LS.set('sched',stS);renderHome();};
  const r=document.getElementById('goReview'); if(r)r.onclick=()=>{learnMode='복습';larea=null;playList=null;go('learn');};
}

// ---------- HOEDOK ----------
let openArea=0, openQ=null;
function renderHoedok(){
  const [hn,ht]=hoedokDone();
  const body=D.hoedok.map((a,ai)=>{
    const done=a.questions.filter(q=>(stH[q.src]||[]).some(Boolean)).length;
    const badge=a.dae.includes('교육')?'<span class="badge edu">교육학</span>':'<span class="badge in">내용학</span>';
    if(openArea===ai){
      return `<div class="card hl">
        <div class="between tap" data-ai="${ai}"><div style="display:flex;align-items:center;gap:8px"><span class="aname">${esc(a.area)}</span>${badge}</div><span class="mono" style="font-size:11px;color:var(--mut)">${done} / ${a.questions.length}</span></div>
        ${bar(done,a.questions.length,false,true)}
        <div style="margin-top:6px">
        ${a.questions.map(q=>{const s=stH[q.src]||[false,false,false];const open=openQ===q.src;const wrong=stWrong[q.src];const memo=stMemo[q.src]||'';
          return `<div class="arow${wrong?' wrong':''}"><div class="meta tapq" data-q="${esc(q.src)}"><div class="src">${esc(q.src)} · ${esc(q.jeom)}${wrong?' <span class="wtag">오답</span>':''}${q.sol?' <span class="soldot">풀이</span>':''}</div><div class="tp">${esc(q.topic)}</div></div>
            <div class="dots" data-src="${esc(q.src)}">${[0,1,2].map(i=>`<span class="dot ${s[i]?'on':''}" data-i="${i}"></span>`).join('')}</div></div>
            ${open?`<div class="qdet">
              ${q.sol?`<div class="qsol"><span class="qsoltag">핵심 풀이</span>${esc(q.sol)}</div>`:`<div class="qsol none">이 문항 해설은 아직 없어요 · 고빈도 3영역(OS·DB·프로그래밍)부터 추가 중</div>`}
              <button class="btn sm wbtn${wrong?' on':''}" data-wrong="${esc(q.src)}">${wrong?'★ 오답으로 표시됨':'☆ 오답 표시'}</button>
              ${(()=>{const ca=AREA2CONCEPT[a.area];if(!ca||!DECK.some(c=>c.area===ca))return '';return `<button class="btn sm block" style="margin-top:8px;color:var(--blue)" data-qjump="${ca}" data-qtopic="${esc(q.topic)}">🎴 이 주제 개념카드로 →</button>`;})()}
              <textarea class="qmemo" data-memo="${esc(q.src)}" placeholder="오답 노트·메모 (자동 저장)">${esc(memo)}</textarea>
            </div>`:''}`;}).join('')}
        </div>
        ${(a.pdf&&PDFON)?`<a class="btn sm block" style="margin-top:11px;color:var(--blue)" href="pdfs/${a.pdf}" target="_blank">문제 PDF 열기</a>`:''}
        ${(()=>{const ca=AREA2CONCEPT[a.area];if(!ca)return '';const n=DECK.filter(c=>c.area===ca).length;const w=stWeak[ca];
          return `<div style="display:flex;gap:8px;margin-top:9px">
            <button class="btn sm" style="flex:1;color:var(--blue)" data-concept="${ca}">🎴 개념 ${n}장 학습</button>
            <button class="btn sm" style="flex:0 0 auto;${w?'color:#b9791a;border-color:#f0d9a6':''}" data-weak="${ca}">${w?'★ 약함':'☆ 약함'}</button></div>`;})()}
        <div class="foot"><span class="mono">1→2→3</span> 회독 누적 · 칸이 채워질수록 정착${stWeak[AREA2CONCEPT[a.area]]?' · 약함 표시→복습 우선':''}</div>
      </div>`;
    }
    return `<div class="card sm tap" data-ai="${ai}"><div class="between"><div style="display:flex;align-items:center;gap:8px"><span class="aname col">${esc(a.area)}</span>${badge}</div><span class="mono" style="font-size:11px;color:var(--mut)">${done} / ${a.questions.length}</span></div>${bar(done,a.questions.length,false,true)}</div>`;
  }).join('');
  view.innerHTML=`
    <div class="vhead"><div class="hrow"><div><div class="htitle">회독</div><div class="hsub">12개년 기출 269문항 · 3회독 누적</div></div><span class="hcount">${hn} / ${ht}</span></div></div>
    <div class="vbody"><div class="hint"><span></span><span class="r">빈도순 ↓</span></div>${body}</div>`;
  view.querySelectorAll('[data-ai]').forEach(h=>h.onclick=e=>{if(e.target.closest('.dots')||e.target.closest('a'))return;const ai=+h.dataset.ai;openArea=openArea===ai?-1:ai;renderHoedok();});
  view.querySelectorAll('.dots .dot').forEach(d=>d.onclick=e=>{e.stopPropagation();const src=d.parentNode.dataset.src,i=+d.dataset.i;const arr=stH[src]||[false,false,false];arr[i]=!arr[i];stH[src]=arr;LS.set('hoedok',stH);renderHoedok();});
  view.querySelectorAll('.tapq').forEach(m=>m.onclick=e=>{e.stopPropagation();const q=m.dataset.q;openQ=openQ===q?null:q;renderHoedok();});
  view.querySelectorAll('[data-wrong]').forEach(b=>b.onclick=e=>{e.stopPropagation();const src=b.dataset.wrong;if(stWrong[src])delete stWrong[src];else stWrong[src]=1;LS.set('wrong',stWrong);renderHoedok();});
  view.querySelectorAll('.qmemo').forEach(t=>t.oninput=()=>{const src=t.dataset.memo;if(t.value.trim())stMemo[src]=t.value;else delete stMemo[src];LS.set('memo',stMemo);});
  view.querySelectorAll('[data-concept]').forEach(b=>b.onclick=e=>{e.stopPropagation();learnMode='영역';startArea(b.dataset.concept);go('learn');});
  view.querySelectorAll('[data-qjump]').forEach(b=>b.onclick=e=>{e.stopPropagation();learnMode='영역';startAreaFocused(b.dataset.qjump,b.dataset.qtopic);go('learn');});
  view.querySelectorAll('[data-weak]').forEach(b=>b.onclick=e=>{e.stopPropagation();const ca=b.dataset.weak;if(stWeak[ca])delete stWeak[ca];else stWeak[ca]=1;LS.set('weak',stWeak);renderHoedok();});
}

// ---------- LEARN (간격 반복 + 영역 학습) ----------
const NEDU=new Set(['정보과교육과정','교수학습','평가']);
let learnMode='복습', larea=null, playList=null, playPtr=0, playReveal=false, blankLevel='전체', blankIdx=0;
let matchArea=null, matchPool=null, matchIdx=0, matchChoices=null, matchPicked=null, matchRight=0, matchSeen=0, matchMissed=0;
const blankFilter=()=>D.seongchwi.filter(s=>blankLevel==='전체'||s.level.startsWith(blankLevel));
function startReview(){ playList=reviewQueue(); playPtr=0; playReveal=false; }
function startArea(a){ larea=a; playList=DECK.filter(c=>c.area===a).map(c=>c.id); playPtr=0; playReveal=false; }
// 회독 문항 → 해당 영역 개념카드, 문항 주제 키워드와 겹치는 카드를 앞으로
function startAreaFocused(a,topic){ larea=a;
  const kws=(topic||'').split(/[^가-힣A-Za-z0-9]+/).filter(w=>w.length>=2);
  const score=c=>{const t=c.front+' '+c.back;return kws.reduce((s,k)=>s+(t.includes(k)?1:0),0);};
  playList=DECK.filter(c=>c.area===a).map(c=>c.id).sort((x,y)=>score(byId[y])-score(byId[x]));
  playPtr=0; playReveal=false; }
function doGrade(g){ const id=playList[playPtr]; grade(id,g); if(g===0)playList.push(id); playPtr++; playReveal=false; renderLearn(); }
// 매칭(용어↔정의): 개념카드 질문에 정답 정의를 4지선다로. SRS 점수는 건드리지 않음(인출 아닌 재인)
const matchDeck=()=>DECK.filter(c=>c.type==='개념'&&(matchArea===null||c.area===matchArea));
function startMatch(){ matchPool=shuffle(matchDeck().slice()); matchIdx=0; matchPicked=null; matchRight=0; matchSeen=0; matchMissed=0; buildChoices(); }
function buildChoices(){ const c=matchPool[matchIdx]; if(!c){matchChoices=null;return;}
  const same=DECK.filter(x=>x.type==='개념'&&x.id!==c.id&&x.area===c.area);
  const pool=same.length>=3?same:DECK.filter(x=>x.type==='개념'&&x.id!==c.id);
  const distract=shuffle(pool.slice()).slice(0,3).map(x=>x.back);
  matchChoices=shuffle([c.back,...distract]); matchPicked=null; }
function pickMatch(ans){ if(matchPicked!==null)return; matchPicked=ans; matchSeen++;
  const c=matchPool[matchIdx];
  if(ans===c.back){ matchRight++; }        // 정답은 운일 수 있어 SRS 상승 없음(재인)
  else { grade(c.id,0); matchMissed++; }    // 오답=모름 → 복습 큐로 즉시 재부상
  renderLearn(); }
function nextMatch(){ matchIdx++; buildChoices(); renderLearn(); }
function renderLearn(){
  if(learnMode==='복습' && playList===null) startReview();
  const head=`<div class="vhead"><div class="hrow"><div><div class="htitle">학습</div><div class="hsub">능동 인출 · 간격 반복</div></div><span class="hcount">${deckLearned()} / ${DECK.length}</span></div></div>`;
  const chips=`<div class="chips">
    <span class="chip ${learnMode==='복습'?'on':''}" data-m="복습">복습 ${reviewQueue().length}</span>
    <span class="chip ${learnMode==='영역'?'on':''}" data-m="영역">영역별</span>
    <span class="chip ${learnMode==='빈칸'?'on':''}" data-m="빈칸">빈칸</span>
    <span class="chip ${learnMode==='매칭'?'on':''}" data-m="매칭">매칭</span></div>`;
  let body;
  if(learnMode==='매칭'){
    if(matchPool===null)startMatch();
    const areas=['전체',...CAREAS];
    const filt=`<div class="chips" style="margin-bottom:2px">${areas.map(a=>`<span class="chip ${((a==='전체'&&matchArea===null)||a===matchArea)?'on':''}" data-ma="${esc(a)}">${esc(a)}</span>`).join('')}</div>`;
    const c=matchPool[matchIdx];
    if(!c){
      body=filt+`<div class="card" style="text-align:center;padding:34px 18px"><div style="font-size:34px">🎯</div>
        <div style="font-size:15px;font-weight:700;margin-top:8px;color:var(--ink)">매칭 완료 · ${matchRight} / ${matchSeen} 정답</div>
        <div class="mut" style="margin-top:6px;font-size:12.5px">${matchMissed?`틀린 ${matchMissed}장은 복습 큐로 보냈어요 · 학습(복습)에서 다시 인출`:'전부 맞혔어요 · 인출 정착은 복습(SRS)에서'}</div>
        ${matchMissed?`<button class="btn pri block" id="matchToReview" style="margin-top:14px">🎴 복습 ${reviewQueue().length}장 하러 가기 →</button>`:''}
        <button class="btn block" id="matchAgain" style="margin-top:${matchMissed?'8px':'16px'}">다시 섞기</button></div>`;
    } else {
      body=filt+`<div class="between" style="margin-top:2px">
          <span class="mono" style="font-size:11.5px;color:var(--mut2)">CARD ${matchIdx+1} / ${matchPool.length}</span>
          <span class="mscore">${matchRight} / ${matchSeen}</span></div>
        <div class="fc" style="min-height:auto"><div class="fmeta"><span class="fcode">개념</span><span class="farea">${esc(c.area)}</span></div>
          <div class="fmid" style="padding:16px 4px 6px"><div class="stmt">${esc(c.front)}</div></div>
          <div style="margin-top:6px">${matchChoices.map(ch=>{let cls='';if(matchPicked!==null){if(ch===c.back)cls=' correct';else if(ch===matchPicked)cls=' wrong';}
            return `<button class="mchoice${cls}" data-ch="${esc(ch)}"${matchPicked!==null?' disabled':''}>${esc(ch)}</button>`;}).join('')}</div></div>
        ${matchPicked!==null?`<div style="margin-top:9px;font-size:12px;font-weight:600;color:${matchPicked===c.back?'#1f7a3d':'#c0392b'}">${matchPicked===c.back?'✓ 정답':'↻ 모름 처리 · 복습 큐로 보냈어요'}</div>
          <div class="fnav"><button class="main on" id="matchNext">${matchIdx+1>=matchPool.length?'결과 보기':'다음 →'}</button></div>`:''}`;
    }
  }
  else if(learnMode==='빈칸'){
    const levels=['전체',...new Set(D.seongchwi.map(s=>s.level.split(' ')[0]))];
    const list=blankFilter(); if(blankIdx>=list.length)blankIdx=0;
    const s=list[blankIdx]||{code:'',area:'',level:'',text:''};
    body=`<div class="chips" style="margin-bottom:2px">${levels.map(l=>`<span class="chip ${l===blankLevel?'on':''}" data-bl="${l}">${l}</span>`).join('')}</div>
      <div class="between"><span class="mono" style="font-size:11.5px;color:var(--mut2)">CARD ${blankIdx+1} / ${list.length}</span><span style="font-size:11.5px;color:var(--mut)">파란 칸 탭하면 공개</span></div>
      <div class="fc" id="bcard"><div class="fmeta"><span class="fcode">[${esc(s.code)}]</span><span class="farea">${esc(s.area||s.level)}</span></div>
        <div class="fmid" style="justify-content:flex-start;padding-top:24px"><div class="stmt">${blankify(s.text)}</div></div></div>
      <div class="fnav"><button class="side" id="bprev">이전</button><button class="main on" id="brev">전체 공개</button><button class="side" id="bnext">다음</button></div>`;
  }
  else if(learnMode==='영역' && !larea){
    body=[...new Set(DECK.map(c=>c.area))].map(a=>{
      const cs=DECK.filter(c=>c.area===a), learned=cs.filter(c=>srsOf(c.id).box>=3).length;
      return `<div class="nrow tap" data-area="${esc(a)}"><span class="ndot ${NEDU.has(a)?'edu':''}"></span><div class="nbody"><div class="nname">${esc(a)}</div><div class="ndesc">${cs.length}장 · 학습 ${learned}</div></div><span class="narr">›</span></div>`;
    }).join('');
  } else if(!playList || playPtr>=playList.length){
    const done=playList&&playList.length;
    const msg=learnMode==='영역'?'이 영역 한 바퀴 완료':(done?'오늘 복습 완료':'오늘 복습할 카드가 없어요');
    body=`<div class="card" style="text-align:center;padding:34px 18px">
      <div style="font-size:34px">🎉</div>
      <div style="font-size:15px;font-weight:700;margin-top:8px;color:var(--ink)">${msg}</div>
      <div class="mut" style="margin-top:6px;font-size:12.5px">간격 반복으로 카드가 알맞은 날 다시 나옵니다</div>
      ${learnMode==='영역'?'<button class="btn block" id="backArea" style="margin-top:16px">← 영역 목록</button>':''}</div>`;
  } else {
    const c=byId[playList[playPtr]];
    const meta = c.type==='성취기준'
      ? `<span class="fcode">${esc(c.front.split(']')[0]+']')}</span><span class="farea">${esc(c.area)}</span>`
      : `<span class="fcode">개념</span><span class="farea">${esc(c.area)}</span>`;
    const mid = playReveal
      ? `<div class="fmid"><div class="stmt">${esc(c.back)}</div></div>`
      : (c.type==='개념'
         ? `<div class="fmid"><div class="stmt" style="color:var(--t2)">${esc(c.front)}</div><div class="revtip" style="margin-top:20px"><div class="ic">↳</div><div class="t">탭하여 정답</div></div></div>`
         : `<div class="fmid"><div class="skel"><span style="width:88%"></span><span style="width:74%"></span><span style="width:58%"></span></div><div class="revtip"><div class="ic">↳</div><div class="t">탭하여 정답 확인</div><div class="s">진술문을 먼저 떠올리기</div></div></div>`);
    body=`<div class="between" style="margin-top:2px">
        <span class="mono" style="font-size:11.5px;color:var(--mut2)">${learnMode==='영역'?esc(larea):'복습'} · ${playList.length-playPtr}장 남음</span>
        ${learnMode==='영역'?'<span class="tap" id="backArea2" style="font-size:12px;color:var(--mut);font-weight:600">← 목록</span>':''}</div>
      <div class="fc" id="card"><div class="fmeta">${meta}</div>${mid}</div>
      ${playReveal
        ? `<div class="fnav"><button class="main" id="g0" style="background:#fff;border-color:#e6c9cd;color:#c0392b">모름</button><button class="main" id="g1" style="background:#fff;border-color:#e3e8f2;color:var(--t3)">애매</button><button class="main on" id="g2">암</button></div>`
        : `<div class="fnav"><button class="main on" id="reveal">정답 확인</button></div>`}`;
  }
  view.innerHTML=head+`<div class="vbody">${chips}${body}</div>`;
  view.querySelectorAll('.chip[data-m]').forEach(b=>b.onclick=()=>{learnMode=b.dataset.m;larea=null;playList=(learnMode==='복습')?null:[];playReveal=false;if(learnMode==='매칭')matchPool=null;renderLearn();});
  view.querySelectorAll('.chip[data-bl]').forEach(b=>b.onclick=()=>{blankLevel=b.dataset.bl;blankIdx=0;renderLearn();});
  view.querySelectorAll('.chip[data-ma]').forEach(b=>b.onclick=()=>{matchArea=b.dataset.ma==='전체'?null:b.dataset.ma;matchPool=null;renderLearn();});
  view.querySelectorAll('.mchoice[data-ch]').forEach(b=>b.onclick=()=>pickMatch(b.dataset.ch));
  const mn=document.getElementById('matchNext'); if(mn)mn.onclick=nextMatch;
  const mag=document.getElementById('matchAgain'); if(mag)mag.onclick=()=>{startMatch();renderLearn();};
  const mtr=document.getElementById('matchToReview'); if(mtr)mtr.onclick=()=>{learnMode='복습';larea=null;playList=null;renderLearn();};
  const bcard=document.getElementById('bcard');
  if(bcard)bcard.querySelectorAll('.blank').forEach(x=>x.onclick=()=>x.classList.toggle('show'));
  const brev=document.getElementById('brev'); if(brev)brev.onclick=()=>document.querySelectorAll('#bcard .blank').forEach(x=>x.classList.add('show'));
  const bp=document.getElementById('bprev'),bn=document.getElementById('bnext');
  if(bp)bp.onclick=()=>{const L=blankFilter().length;blankIdx=(blankIdx-1+L)%L;renderLearn();};
  if(bn)bn.onclick=()=>{const L=blankFilter().length;blankIdx=(blankIdx+1)%L;renderLearn();};
  view.querySelectorAll('[data-area]').forEach(r=>r.onclick=()=>{startArea(r.dataset.area);renderLearn();});
  const ba=document.getElementById('backArea'), ba2=document.getElementById('backArea2');
  if(ba)ba.onclick=()=>{larea=null;playList=[];renderLearn();};
  if(ba2)ba2.onclick=()=>{larea=null;playList=[];renderLearn();};
  const card=document.getElementById('card'); if(card&&!playReveal)card.onclick=()=>{playReveal=true;renderLearn();};
  const rv=document.getElementById('reveal'); if(rv)rv.onclick=()=>{playReveal=true;renderLearn();};
  ['g0','g1','g2'].forEach((gid,gi)=>{const b=document.getElementById(gid);if(b)b.onclick=()=>doGrade(gi);});
}

// ---------- NOTE ----------
const NSUB={운영체제:'프로세스·스케줄링·동기화·메모리·파일',데이터베이스:'SQL·정규화·ER·트랜잭션·무결성',프로그래밍:'변수범위·포인터·재귀·비트연산',컴퓨터구조:'논리회로·명령어·데이터패스·캐시',컴퓨터네트워크:'TCP·IP/서브넷·라우팅·MAC',알고리즘:'정렬·탐색·DP·그래프·복잡도',자료구조:'트리·연결리스트·해싱·스택/큐',인공지능:'탐색·기계학습·추론',데이터과학:'데이터 처리·통계·시각화·윤리',정보과교육과정:'2022 개정·영역·성취기준 체계',교수학습:'ARCS·PBL·협동학습·교수설계',평가:'성취평가제·루브릭·피드백'};
let openNote=null;
function mdRender(md){
  const lines=md.split('\n');let out=[],inList=false;const flush=()=>{if(inList){out.push('</ul>');inList=false;}};
  const inline=s=>s.replace(/`([^`]+)`/g,'<code>$1</code>');
  for(let ln of lines){let m;
    if(m=ln.match(/^#\s+(.*)/)){flush();out.push('<h1>'+esc(m[1])+'</h1>');}
    else if(m=ln.match(/^##\s+(.*)/)){flush();out.push('<h2>'+esc(m[1])+'</h2>');}
    else if(m=ln.match(/^###\s+(.*)/)){flush();out.push('<h3>'+esc(m[1])+'</h3>');}
    else if(m=ln.match(/^-\s+(.*)/)){if(!inList){out.push('<ul>');inList=true;}out.push('<li>'+inline(esc(m[1]))+'</li>');}
    else if(ln.trim()===''){flush();}
    else{flush();out.push('<p>'+inline(esc(ln))+'</p>');}}
  flush();return out.join('');
}
function renderNote(){
  if(openNote!==null){const n=D.notes[openNote];
    view.innerHTML=`<div class="vhead"><div class="hrow"><div><div class="htitle">${esc(n.key)}</div><div class="hsub">선개념 압축노트</div></div><span class="hcount" id="back" style="cursor:pointer">← 목록</span></div></div>
      <div class="vbody"><div class="card note-body">${mdRender(n.md)}</div>
      <button class="btn pri block" id="quizFromNote" style="height:48px">🎴 이 과목 카드로 자가테스트 →</button></div>`;
    document.getElementById('back').onclick=()=>{openNote=null;renderNote();};
    const q=document.getElementById('quizFromNote');
    if(q)q.onclick=()=>{const a=n.key; if(DECK.some(c=>c.area===a)){learnMode='영역';startArea(a);go('learn');}};
    return;}
  view.innerHTML=`
    <div class="vhead"><div class="hrow"><div><div class="htitle">선개념</div><div class="hsub">회독 전 골격 잡기용 압축노트</div></div><span class="hcount">${D.notes.length}과목</span></div></div>
    <div class="vbody">${D.notes.map((n,i)=>`<div class="nrow tap" data-i="${i}"><span class="ndot ${NEDU.has(n.key)?'edu':''}"></span><div class="nbody"><div class="nname">${esc(n.key)}</div><div class="ndesc">${esc(NSUB[n.key]||'')}</div></div><span class="narr">›</span></div>`).join('')}</div>`;
  view.querySelectorAll('.nrow').forEach(c=>c.onclick=()=>{openNote=+c.dataset.i;renderNote();});
}

// ---------- tabs ----------
const tabs={home:renderHome,hoedok:renderHoedok,learn:renderLearn,note:renderNote};
function go(t){if(!tabs[t])t='home';document.querySelectorAll('#tabbar button').forEach(x=>x.classList.toggle('active',x.dataset.tab===t));window.scrollTo(0,0);location.hash=t;tabs[t]();}
document.querySelectorAll('#tabbar button').forEach(b=>b.onclick=()=>go(b.dataset.tab));
go((location.hash||'#home').slice(1));

// ---------- splash ----------
const sp=document.getElementById('splash');
function hideSplash(){if(sp)sp.classList.add('hide');}
if(sp){sp.onclick=hideSplash;setTimeout(hideSplash,1600);}

// ---------- PWA ----------
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
