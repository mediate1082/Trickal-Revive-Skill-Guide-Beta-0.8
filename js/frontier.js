/* ══ 엘리아스 프론티어 · 보스 패턴 섹션 ══════════════════════════════
   사도 추천 페이지(`recommend.js`)와 편집기(`tools/frontier/frontier-preview.html`)가 **같이** 쓴다.
   그래서 편집기에서 보는 모습이 곧 사이트 모습이다 — 그리는 코드를 두 벌 두지 않는다.
   스타일은 `css/frontier.css` (역시 둘이 같이 싣는다). 자세한 건 `FRONTIER.md`.

       [보스 이름 · 난이도]                [1페이즈|2페이즈] [그리드|1열]
       ── 기믹 ─────────
         세계수의 기운 (인게임 UI 재현 + 꽃 1·2·3)
         행동불가 (영상)
         상시 효과 카드들 (이 페이즈에 없는 것은 흐리게)
       ── 핵심 패턴 ────   대처할 것 — 펼친 채
       ── 일반 패턴 ────   스펙으로 버티는 것 — 접힌 채 [펼치기]

   ⚠ 영상은 **화면에 보일 때만** 받는다 (IntersectionObserver). 한 보스에 15MB 라 미리 받으면 안 된다.
   ⚠ 표기 — 대충돌 2.0 과 같은 약속 (`CRASH2.md` 「설명문 표기」)
       [[용어]] 보스 쪽 용어 · 강조. 상태 표에 **설명이 있으면** 말풍선(이름·설명·아이콘)
       ((용어)) 사도가 거는 효과 — 하늘색 칩
       **…**    굵게   ·   <br> 은 그대로 줄바꿈 (편집기에서 손으로 적는다)          */

const KIND = {
    normal: { label: '평타',   c: 'var(--text-body)' },
    skill:  { label: '스킬',   c: 'var(--debuff)' },
    mark:   { label: '표식',   c: 'var(--neutral)' },
    sp:     { label: 'SP',     c: 'var(--term-accent)' },
    enter:  { label: '진입기', c: 'var(--neutral)' },
};
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const VIEW_KEY = 'fpView';

/* 칩 아이콘 — 시계(첫 사용) · 순환 화살표(주기) · 과녁(대상). 라벨 글자 대신 아이콘 + 말풍선 */
const ICON = {
    first:  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="8" cy="8" r="6.2"/><path d="M8 4.6V8l2.3 1.5"/></svg>',
    cycle:  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13.2 6.2A5.4 5.4 0 0 0 3.4 5"/><path d="M3.2 2.6V5.2h2.6"/><path d="M2.8 9.8A5.4 5.4 0 0 0 12.6 11"/><path d="M12.8 13.4v-2.6h-2.6"/></svg>',
    target: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="8" r="6.2"/><circle cx="8" cy="8" r="2.6"/><circle cx="8" cy="8" r=".6" fill="currentColor"/></svg>',
};
const TIP = { first: '첫 사용', cycle: '주기', target: '대상' };
const ZOOM_SVG = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2h4v4M6 14H2v-4M14 2 9.5 6.5M2 14l4.5-4.5M2 6V2h4M14 10v4h-4M2 2l4.5 4.5M14 14l-4.5-4.5"/></svg>';

/* 상태 표 — 이름 → { icon(문서 기준 경로), desc } */
export function makeFmt(states) {
    const term = (n, cls) => {
        const st = states.get(n);
        /* 설명이 빈 상태는 말풍선 없이 색만 — 아이콘은 부가 효과 칩에서만 쓴다 (회복 제한이 그렇다) */
        if (!st || !st.desc) return `<em${cls ? ` class="${cls}"` : ''}>${n}</em>`;
        return `<em class="fp-term${cls ? ' ' + cls : ''}" tabindex="0" data-tooltip="${esc(n)}&#10;${esc(st.desc)}"`
             + `${st.icon ? ` data-tooltip-icon="${esc(st.icon)}"` : ''}>${n}</em>`;
    };
    return s => String(s ?? '').replace(/\[\[(.+?)\]\]/g, (_, n) => term(n))
        .replace(/\(\((.+?)\)\)/g, (_, n) => term(n, 'cc'))
        .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

/* ── 영상: 보일 때만 src 를 달고 재생, 벗어나면 멈춤 ── */
const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(es => es.forEach(e => {
    const v = e.target;
    if (e.isIntersecting) { if (!v.src) v.src = v.dataset.src; v.play().catch(() => {}); }
    else v.pause();
}), { rootMargin: '200px' }) : null;

/* ── 크게 보기 — 페이지에 하나만 만들어 둔다 ── */
let lb = null, lbOpener = null;
function lightbox() {
    if (lb) return lb;
    lb = document.createElement('div');
    lb.className = 'fp-lb'; lb.hidden = true;
    lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', '크게 보기');
    lb.innerHTML = `<div class="fp-lb-box"><div class="fp-lb-stage"><video muted loop playsinline></video></div>
        <div class="fp-lb-cap"></div><button type="button" class="fp-lb-close" aria-label="닫기">✕</button></div>`;
    document.body.appendChild(lb);
    const close = () => {
        const v = lb.querySelector('video');
        lb.hidden = true; v.pause(); v.removeAttribute('src'); v.load();
        document.documentElement.classList.remove('fp-lb-open');
        lbOpener?.focus();
    };
    lb.addEventListener('click', e => { if (e.target === lb || e.target.closest('.fp-lb-close')) close(); });
    document.addEventListener('keydown', e => {
        if (lb.hidden) return;
        if (e.key === 'Escape') { e.stopPropagation(); close(); }
        if (e.key === 'Tab') { e.preventDefault(); lb.querySelector('.fp-lb-close').focus(); }   // 안에 누를 것이 하나뿐
    }, true);
    return lb;
}
function openLb(src, cap, opener) {
    const box = lightbox(), v = box.querySelector('video');
    lbOpener = opener;
    v.src = src; v.play().catch(() => {});
    box.querySelector('.fp-lb-cap').innerHTML = cap;
    box.hidden = false;
    document.documentElement.classList.add('fp-lb-open');
    box.querySelector('.fp-lb-close').focus();
}

/* ══ 그리기 ══════════════════════════════════════════════════════
   D    — 표 두 장을 묶은 자료 (`frontierFrom` · 편집기의 `fromRows`)
   opt  — base   자산 경로 앞에 붙일 것 (사이트 '' · 편집기 '../../')
          states 상태 표 Map (이름 → { icon, desc })
          ed     (경로, 태그, 클래스) → HTML. 편집기가 `data-ed` 를 달려고 바꿔 끼운다
          edit   () → 편집 모드인가. 켜지면 빈 칸도 그리고 편집 단추를 단다           */
export function buildFrontier(D, opt = {}) {
    const base = opt.base || '', states = opt.states || new Map();
    const fmt = makeFmt(states);
    const EDIT = () => !!(opt.edit && opt.edit());
    const getAt = path => path.split('.').reduce((o, k) => o?.[k], D);
    const ed = opt.ed || ((path, tag = 'span', cls = '') => {
        const v = getAt(path);
        return `<${tag}${cls ? ` class="${cls}"` : ''}>${v ? fmt(v) : ''}</${tag}>`;
    });
    const MEDIA = n => `${base}assets/video/frontier/${n}.webm`;
    const UI = n => `${base}assets/icons/frontier/Ingame_Death_${n}.webp`;

    const root = document.createElement('section');
    root.className = 'fp-section';
    root.innerHTML = `
        <div class="fp-head">
            <h3 class="fp-title">${esc(D.boss.name)}</h3>
            <div class="fp-tabs" role="tablist" aria-label="페이즈">
                <button type="button" class="fp-tab" role="tab" data-phase="1" aria-selected="true">1페이즈</button>
                <button type="button" class="fp-tab" role="tab" data-phase="2" aria-selected="false">2페이즈</button>
            </div>
            <div class="fp-viewsw" role="group" aria-label="보기 방식">
                <button type="button" class="fp-view-btn" data-view="grid">그리드</button>
                <button type="button" class="fp-view-btn" data-view="list">1열</button>
            </div>
        </div>
        <div class="fp-panel"></div>`;
    const panel = root.querySelector('.fp-panel');

    /* 보기 방식 — 1열이 기본. 고른 것은 브라우저에 기억한다 */
    let view = 'list';
    try { if (localStorage.getItem(VIEW_KEY) === 'grid') view = 'grid'; } catch (e) {}
    const applyView = () => {
        root.querySelectorAll('.fp-view-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
        panel.querySelectorAll('.fp-grid').forEach(g => g.classList.toggle('is-list', view === 'list'));
    };
    root.querySelector('.fp-viewsw').addEventListener('click', e => {
        const b = e.target.closest('.fp-view-btn'); if (!b || b.dataset.view === view) return;
        view = b.dataset.view;
        try { localStorage.setItem(VIEW_KEY, view); } catch (e) {}
        applyView();
    });

    const videoEl = name => {
        const v = document.createElement('video');
        Object.assign(v, { muted: true, loop: true, playsInline: true, preload: 'none' });
        v.dataset.src = MEDIA(name);
        v.setAttribute('aria-hidden', 'true');
        v.addEventListener('loadeddata', () => v.parentElement?.querySelector('.fp-load')?.remove(), { once: true });
        if (io) io.observe(v); else v.src = v.dataset.src;
        return v;
    };
    const zoomBtn = (getSrc, title) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'fp-zoom'; b.innerHTML = ZOOM_SVG;
        b.setAttribute('aria-label', '크게 보기'); b.dataset.tooltip = '크게 보기';
        b.addEventListener('click', () => openLb(getSrc(), title(), b));
        return b;
    };

    function stage(p) {
        const s = document.createElement('div');
        s.className = 'fp-stage';
        const k = KIND[p.kind] || KIND.skill;
        s.innerHTML = `<span class="fp-kind" style="--c:${k.c}">${k.label}</span><span class="fp-load">불러오는 중</span>`;
        const v = videoEl(p.media); s.appendChild(v);
        let showing = '보스';
        s.appendChild(zoomBtn(() => v.dataset.src, () => `${esc(p.name)}${p.fx ? `<span>${showing}</span>` : ''}`));
        if (p.fx) {
            const sw = document.createElement('div');
            sw.className = 'fp-swap';
            sw.innerHTML = '<button type="button" aria-pressed="true">보스</button><button type="button" aria-pressed="false">이펙트</button>';
            sw.addEventListener('click', e => {
                const b = e.target.closest('button'); if (!b || b.getAttribute('aria-pressed') === 'true') return;
                sw.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
                showing = b.textContent;
                v.src = MEDIA(showing === '보스' ? p.media : p.fx); v.dataset.src = v.src; v.play().catch(() => {});
            });
            s.appendChild(sw);
        }
        return s;
    }

    const chip = (k, v) => `<span class="fp-chip" data-k="${k}" data-tooltip="${TIP[k]}">${ICON[k]}<b>${v}</b></span>`;
    const effChip = (e, path) => {
        const t = e.match(/\[\[(.+?)\]\]/)?.[1], st = t && states.get(t);
        return `<span class="fp-eff">${st?.icon ? `<img src="${esc(st.icon)}" alt="">` : ''}${ed(path)}</span>`;
    };
    const counterBox = (p, P) => {
        if (p.counter || EDIT()) return `<div class="fp-counter">${D.labels.counterHead || EDIT() ? ed('labels.counterHead', 'strong') : ''}${ed(P + '.counter')}</div>`;
        return p.spec ? '' : `<div class="fp-counter is-empty">${ed('labels.empty')}</div>`;   // 일반 패턴은 대처 칸 없이
    };

    function card(p) {
        const c = document.createElement('article');
        c.className = 'fp-card';
        c.appendChild(stage(p));
        const idx = D.patterns.indexOf(p), P = `patterns.${idx}`;
        const chips = [];
        if (p.first != null) chips.push(chip('first', p.first === 0 ? '개전 즉시' : `${p.first}초에 첫 사용`));
        if (p.cycle) chips.push(chip('cycle', `${p.cycle}초마다`));
        if (p.target || EDIT()) chips.push(chip('target', ed(P + '.target')));
        const effs = (p.eff || []).map((e, j) => effChip(e, `${P}.eff.${j}`)).join('')
            + (EDIT() ? `<button type="button" class="fp-ed-add" data-add="${P}.eff">+ 효과</button>` : '');
        const body = document.createElement('div');
        body.className = 'fp-body';
        body.innerHTML = `${ed(P + '.name', 'h4', 'fp-name')}
            <div class="fp-chips">${chips.join('')}</div>
            ${p.note || EDIT() ? ed(P + '.note', 'p', 'fp-desc') : ''}
            <dl class="fp-rows">
                ${p.dmg || EDIT() ? `<div class="fp-row"><dt>피해</dt>${ed(P + '.dmg', 'dd')}</div>` : ''}
                ${p.eff?.length || EDIT() ? `<div class="fp-row"><dt>부가 효과</dt><dd class="fp-effs">${effs}</dd></div>` : ''}
            </dl>
            ${counterBox(p, P)}
            ${EDIT() ? `<button type="button" class="fp-ed-spec" data-spec="${idx}">${p.spec ? '↑ 핵심 패턴으로' : '↓ 일반 패턴으로'}</button>` : ''}`;
        c.appendChild(body);
        return c;
    }

    /* 세계수의 기운 — 인게임 좌상단 UI 를 부품으로 다시 쌓는다 */
    const treeUI = () => {
        const slot = i => `<span class="fp-tree-slot" data-i="${i}">
            <img class="on" src="${UI('GaugeOnBG')}" alt=""><img class="flower" src="${UI('GaugeOn3')}" alt="">
            <img class="off" src="${UI('GaugeOFF')}" alt=""><img class="flash" src="${UI('GaugeOFF2')}" alt=""></span>`;
        return `<div class="fp-tree" style="--fill:.62" role="img" aria-label="세계수의 기운 게이지 — 가득 찰 때마다 꽃이 하나씩 부서진다">
            <img class="bg" src="${UI('TreeGaugeBG')}" alt=""><img class="fill" src="${UI('TreeGauge')}" alt="">
            <img class="tree" src="${UI('TreeGaugeIcon')}" alt="">
            <div class="slots">${slot(1)}${slot(2)}${slot(3)}</div></div>`;
    };
    /* 게이지가 차서 가득 → 왼쪽 꽃부터 하나씩 터진다. 3단계를 돌고 처음으로. 화면에 보일 때만 돈다 */
    const FILL_MS = 1800, AFTER_MS = 900, HOLD_MS = 1800;
    let treeIO = null;
    function runTree(g) {
        const t = g.querySelector('.fp-tree'); if (!t) return;
        const slots = [...t.querySelectorAll('.fp-tree-slot')], steps = [...g.querySelectorAll('.fp-step')];
        const mark = n => steps.forEach(s => s.classList.toggle('is-now', +s.dataset.n === n));
        const fill = (v, ms) => { t.style.setProperty('--fill-ms', ms + 'ms'); t.style.setProperty('--fill', v); };
        if (matchMedia('(prefers-reduced-motion: reduce)').matches || typeof IntersectionObserver !== 'function') return;
        let timer = null, n = 0, on = false;
        const tick = () => {
            if (n < 3) {
                fill(1, FILL_MS);
                timer = setTimeout(() => {
                    const sl = slots[n]; sl.classList.add('is-off'); sl.classList.remove('is-burst'); void sl.offsetWidth; sl.classList.add('is-burst');
                    n++; mark(n); fill(0, 0);
                    timer = setTimeout(tick, n < 3 ? AFTER_MS : HOLD_MS);
                }, FILL_MS);
            } else {
                slots.forEach(sl => sl.classList.remove('is-off', 'is-burst')); n = 0; mark(0);
                timer = setTimeout(tick, AFTER_MS);
            }
        };
        treeIO?.disconnect();
        treeIO = new IntersectionObserver(([e]) => {
            if (e.isIntersecting && !on) { on = true; tick(); }
            else if (!e.isIntersecting && on) { on = false; clearTimeout(timer); }
        });
        treeIO.observe(t);
        treeIO.stop = () => { clearTimeout(timer); };
    }

    function gimmick(ph) {
        const g = document.createElement('div');
        g.className = 'fp-gim';
        const G = D.gimmick;
        const lines = (path, arr) => (arr || []).map((_, j) => ed(`${path}.${j}`, 'p')).join('');
        /* 상시 효과 — 이름 · 아이콘 · 인게임 해설은 `Frontier_States.csv`, 덧붙이는 공략 글(lines)은 기믹 표.
           이 페이즈에 없는 효과도 보여 주되 흐리게 — "아직 안 걸린다" 가 읽히게 */
        const stateCard = (st, i) => {
            const P = `gimmick.states.${i}`, ls = st.lines?.length ? st.lines : (EDIT() ? [''] : []);
            const off = !st.phases.includes(+ph), S = states.get(st.name);
            return `<div class="fp-gim-card fp-state${off ? ' is-off' : ''}"${off ? ' aria-disabled="true"' : ''}>${
                off ? `<span class="fp-state-off">${Math.min(...st.phases)}페이즈부터</span>` : ''}
                <div class="fp-state-head">${S?.icon ? `<img src="${esc(S.icon)}" alt="">` : ''}
                    <h4>${esc(st.name)}</h4><span class="fp-state-who" data-who="${esc(st.who)}">${esc(st.who)}</span></div>
                ${S?.desc ? `<p class="fp-state-desc">${fmt(S.desc)}</p>` : ''}
                ${ls.map((_, j) => ed(`${P}.lines.${j}`, 'p')).join('')}</div>`;
        };
        const step = (n, fin) => `<div class="fp-step${fin ? ' is-final' : ''}" data-n="${n}"><strong>꽃 ${n}</strong><ul>${
            (G.tree.steps[n - 1] || []).map((_, j) => ed(`gimmick.tree.steps.${n - 1}.${j}`, 'li')).join('')}</ul></div>`;
        const haltMedia = G.groggy.media?.[ph];
        g.innerHTML = `
            <div class="fp-gim-card">
                <div class="fp-tree-head">${treeUI()}
                    <div>${ed('gimmick.tree.title', 'h4')}${ed('gimmick.tree.desc', 'p')}</div></div>
                <div class="fp-steps">${step(1)}${step(2)}${step(3, true)}</div>
            </div>
            <div class="fp-gim-card fp-gim-media">${haltMedia ? '<div class="fp-stage" data-v></div>' : ''}
                <div><h4>${ed('gimmick.groggy.title')} ${G.groggy.badge || EDIT() ? ed('gimmick.groggy.badge', 'small', 'fp-gim-sub') : ''}</h4>
                ${lines('gimmick.groggy.lines', G.groggy.lines)}</div></div>
            ${G.states?.length ? `${G.statesNote || EDIT() ? ed('gimmick.statesNote', 'p', 'fp-states-note') : ''}
                <div class="fp-states">${G.states.map(stateCard).join('')}</div>` : ''}`;
        runTree(g);
        const hs = g.querySelector('[data-v]');
        if (hs) {
            const v = videoEl(haltMedia); hs.appendChild(v);
            hs.appendChild(zoomBtn(() => v.dataset.src, () => esc(G.groggy.title)));
        }
        return g;
    }

    let phase = '1', restOpen = false;
    function setFold(open) {
        const b = panel.querySelector('.fp-fold'), g = panel.querySelector('.fp-grid.is-rest');
        if (!b || !g) return;
        g.hidden = !open; restOpen = open;
        b.setAttribute('aria-expanded', String(open)); b.textContent = open ? '접기' : '펼치기';
    }
    function show(ph) {
        phase = ph;
        panel.querySelectorAll('video').forEach(v => io?.unobserve(v));
        treeIO?.stop?.(); treeIO?.disconnect();
        panel.textContent = '';
        const list = D.patterns.filter(p => String(p.phase) === ph);
        panel.insertAdjacentHTML('beforeend', '<h4 class="fp-h">기믹</h4>');
        panel.appendChild(gimmick(ph));
        /* 핵심 = 전투 중에 할 일이 있는 패턴 · 일반 = 스펙으로 버티는 패턴. 일반은 접어서 시작 */
        const core = list.filter(p => !p.spec), rest = list.filter(p => p.spec);
        const mkGrid = (ps, cls) => {
            const g = document.createElement('div');
            g.className = 'fp-grid' + (cls ? ' ' + cls : '');
            ps.forEach(p => g.appendChild(card(p)));
            return g;
        };
        panel.insertAdjacentHTML('beforeend', `<h4 class="fp-h">${ed('labels.coreHead')}<small>${ed('labels.coreSub')} ${core.length}</small></h4>`);
        panel.appendChild(mkGrid(core));
        if (rest.length || EDIT()) {
            panel.insertAdjacentHTML('beforeend', `<h4 class="fp-h">${ed('labels.restHead')}<small>${ed('labels.restSub')} ${rest.length}</small>
                <button type="button" class="fp-fold" aria-expanded="false">펼치기</button></h4>`);
            const rg = mkGrid(rest, 'is-rest'); rg.hidden = true;
            panel.appendChild(rg);
            if (restOpen) setFold(true);
        }
        applyView();
        opt.onShow?.(panel);
    }
    panel.addEventListener('click', e => {
        const b = e.target.closest('.fp-fold'); if (b) setFold(b.getAttribute('aria-expanded') !== 'true');
    });
    root.querySelector('.fp-tabs').addEventListener('click', e => {
        const b = e.target.closest('.fp-tab'); if (!b || b.getAttribute('aria-selected') === 'true') return;
        root.querySelectorAll('.fp-tab').forEach(x => x.setAttribute('aria-selected', String(x === b)));
        restOpen = false; show(b.dataset.phase);
    });

    show('1');
    /* 편집기가 다시 그릴 때 쓴다 — 지금 페이즈·펼침 상태를 지킨 채 */
    root.fpRedraw = () => show(phase);
    root.fpPanel = panel;
    return root;
}

/* ══ 사이트 쪽 — PapaParse 로 읽은 표 세 장 → D · 상태 Map ══════════════
   ⚠ 편집기는 `tools/frontier/frontier-csv.js` 의 `fromRows` 로 같은 일을 한다 (거기가 열 정의의 원본).
     열을 바꾸면 **둘 다** 고칠 것.
   allStates — 사이트 상태 표(`buff_desc_DB` + `debuff_desc_DB`). 쓰라림 · 기절 · 침묵 같은 **사도 쪽 상태**의
     말풍선도 같이 단다. 보스 고유 상태(`Frontier_States`)가 이름이 겹치면 이긴다. */
export function frontierFrom(secKey, pRows, gRows, sRows, allStates, base = '') {
    const T = v => String(v ?? '').trim();
    const states = new Map();
    (allStates || []).forEach(r => {
        const n = T(r.state_name); if (!n) return;
        states.set(n, { icon: T(r.icon_file) ? `${base}assets/icons/state/${T(r.icon_file)}` : '', desc: T(r.description) });
    });
    (sRows || []).filter(r => T(r.sec_key) === secKey && T(r.name)).forEach(r =>
        states.set(T(r.name), { icon: T(r.icon) ? `${base}assets/icons/frontier/${T(r.icon)}.webp` : '', desc: T(r.desc) }));

    const ps = (pRows || []).filter(r => T(r.sec_key) === secKey && T(r.name));
    if (!ps.length) return null;
    const D = { boss: { name: '', badge: '' }, labels: {},
        gimmick: { tree: { title: '', desc: '', steps: [[], [], []] },
                   groggy: { title: '', badge: '', lines: [], media: {} }, statesNote: '', states: [] },
        patterns: [] };
    ps.sort((a, b) => (+a.phase - +b.phase) || ((parseInt(a.order) || 0) - (parseInt(b.order) || 0)));
    ps.forEach(r => {
        const p = { phase: +T(r.phase), kind: T(r.kind), name: T(r.name), media: T(r.media) };
        if (T(r.fx)) p.fx = T(r.fx);
        if (T(r.first) !== '') p.first = +T(r.first);
        if (T(r.cycle) !== '') p.cycle = +T(r.cycle);
        ['target', 'note', 'dmg', 'counter'].forEach(k => { if (T(r[k])) p[k] = T(r[k]); });
        const eff = T(r.eff).split(/\s*\|\s*/).filter(Boolean);
        if (eff.length) p.eff = eff;
        if (T(r.core) !== 'Y') p.spec = true;
        D.patterns.push(p);
    });
    const G = D.gimmick, byOrder = new Map();
    (gRows || []).filter(r => T(r.sec_key) === secKey).forEach(r => {
        switch (T(r.kind)) {
            case 'boss': D.boss = { name: T(r.name), badge: T(r.badge) }; break;
            case 'label': D.labels[T(r.name)] = T(r.text); break;
            case 'tree': G.tree.title = T(r.name); G.tree.desc = T(r.text); break;
            case 'step': (G.tree.steps[(parseInt(r.order) || 1) - 1] ??= []).push(T(r.text)); break;
            case 'halt': G.groggy.title = T(r.name); G.groggy.badge = T(r.badge); if (T(r.text)) G.groggy.lines.push(T(r.text)); break;
            case 'halt_media': G.groggy.media[T(r.phase)] = T(r.media); break;
            case 'state_note': G.statesNote = T(r.text); break;
            case 'state': {
                const o = T(r.order);
                let st = byOrder.get(o);
                if (!st) {
                    st = { name: T(r.name), who: T(r.who), phases: T(r.phase).split(',').map(Number).filter(Boolean), lines: [] };
                    if (!st.phases.length) st.phases = [1, 2];
                    byOrder.set(o, st); G.states.push(st);
                }
                if (T(r.text)) st.lines.push(T(r.text));
                break;
            }
        }
    });
    return { D, states };
}
