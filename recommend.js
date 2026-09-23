/* ── 사도 추천 페이지 ──────────────────────────────────────────
   data/Recommend_Sections.csv (분류 정의) + data/Recommend_Chara.csv (사도 배치) 를
   읽어 대분류 > 소분류 > 역할 순으로 렌더링합니다.

   카드는 **이 페이지 전용**입니다 (`buildCard`). 메인 그리드의 `char-card` 를
   복제해 쓰다가 떼어냈습니다 — 저/고 강화 게이지는 여기서 답할 질문이 아닙니다.  */

/* ui.js 는 상세 모달 전용. closeDetailModal·toggleSkillMode 등은 import 시 자동 등록됩니다. */
const { openDetailModal, switchTab, updateLowSkillLv, updateHighSkillLv, toggleQuickFilter }
    = await import('./ui.js?v=' + (window.APP_VERSION || ''));

const PERSONALITY_COLORS = {
    '순수': { bg: '#66C17C', border: '#93F4A7' },
    '냉정': { bg: '#85BAEC', border: '#A4D0F7' },
    '광기': { bg: '#EE839D', border: '#F4ACBA' },
    '우울': { bg: '#C784ED', border: '#D8A0FB' },
    '활발': { bg: '#ECDC85', border: '#F9ECA8' },
    '공명': { bg: 'bg-resonance', border: '#FFFEFD' }
};
const ROLE_ORDER = ['딜러', '서포터', '탱커'];

const esc = s => String(s ?? '').replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* 테마 로직은 theme.js 로 분리됨 (window.toggleTheme) */

/* 아이콘 경로. 기본 폴더는 쓰는 쪽이 정하고(`sec_icon`→content,
   `group_icon`→common_icons), **값에 슬래시가 있으면 `assets/icons/` 아래의
   그 경로를 그대로 읽는다.** 역할 아이콘처럼 이미 다른 폴더에 있는 걸
   content 로 복사해 두지 않으려는 것이다 — 예: `role/딜러`
   ⚠ 슬래시는 살려야 하므로 통째로 encodeURIComponent 하면 안 된다. */
const iconUrl = (v, base) => './assets/icons/'
    + (String(v).includes('/') ? '' : base + '/')
    + String(v).split('/').map(encodeURIComponent).join('/') + '.webp';


/* ⚠ 별 그림은 메인 그리드와 같은 규칙이다 (main.js `makeStarHTML`).
   초상화 타일을 그대로 떼왔으므로 이것도 따라온다. */
function makeStarHTML(rarity) {
    const n = parseInt(rarity);
    if (isNaN(n) || n <= 0) return '<div style="height:20px;"></div>';
    const src = `./assets/icons/common_icons/${n >= 3 ? 'star3' : 'star2'}.webp`;
    let s = '';
    for (let i = 0; i < n; i++)
        s += `<img src="${src}" style="width:19px;height:19px;margin:0 -3px;filter:drop-shadow(0 1px 1px rgba(0,0,0,.2));">`;
    return `<div style="display:flex;justify-content:center;align-items:center;margin-top:-3px;height:20px;z-index:3;position:relative;">${s}</div>`;
}

/* 칩 한 장. 글자·아이콘·색은 **전부 `Recommend_Chips.csv` 에서만** 온다.
   ⚠ 칩 목록에 없는 키는 조용히 버리지 않는다 — 오타가 여기서 난다. */
function chipHTML(key) {
    const c = window._rcChips && window._rcChips.get(key);
    if (!c) return `<span class="rc-chip is-unknown"
        data-tooltip="Recommend_Chips.csv 에 없는 키입니다">${esc(key)}?</span>`;
    /* 설명(`chip_tip`)이 비어 있으면 **툴팁을 달지 않는다** — 올려도 아무 일도 안 일어난다 */
    return `<span class="rc-chip"${c.color ? ` style="--rc-chip:${esc(c.color)}"` : ` data-hue="${c.hue}"`}${
        c.tip ? ` data-tooltip="${esc(c.tip)}"` : ''}>${
        c.icon ? `<img src="${iconUrl(c.icon, 'content')}" alt="" onerror="this.remove()">` : ''
    }${esc(c.label)}</span>`;
}

/* 카드에 붙는 칩 = **이 배치 행에 직접 적은 것** + **다른 분류에 배치돼서 자동으로 붙는 것**.
   지금 보고 있는 칸은 뺀다 (중복이라 읽을 게 없다).
   분류가 자동 칩을 낼지는 `sec_chip` 이 정한다 — 비우면 안 낸다. */
function cardChips(name, exceptSecKey, own) {
    const keys = [];
    String(own || '').split(',').map(x => x.trim()).filter(Boolean)
        .forEach(k => { if (!keys.includes(k)) keys.push(k); });
    ((window._rcSecIndex && window._rcSecIndex.get(name)) || [])
        .filter(s => s.key !== exceptSecKey && s.chip)
        .forEach(s => { if (!keys.includes(s.chip)) keys.push(s.chip); });
    return keys.map(chipHTML).join('');
}

/* 추천 카드.

   초상화 타일은 **메인 그리드 카드를 그대로** 쓴다 (`char-card` 의 `card-top`).
   글 영역만 이 페이지 전용이다 — 이 페이지가 답할 것은 "왜 이 사도인가" 라서
   강화 게이지 자리에 추천 이유가 들어간다.                                        */
function buildCard(char, rec, secKey) {
    const reason = rec.reason;
    /* `dim` 은 "지금은 추천하지 않는다" 는 표시이자 그 **이유**다.
       비워두면 평범한 카드. 값이 있으면 흑백 + 그 글자가 뱃지로 붙는다. */
    const dim = String(rec.dim || '').trim();
    /* `pick` 은 그 반대 — 붉은 별이 붙는다. 값은 왜 강추인지 적어두는 메모 겸 툴팁이다. */
    const pick = String(rec.pick || '').trim();
    const card = document.createElement('article');
    card.className = 'rc-card' + (dim ? ' is-dim' : '');
    const p = PERSONALITY_COLORS[char.personality] || PERSONALITY_COLORS['공명'];
    const reso = char.personality === '공명';
    const eldyne = char.Eldyne && char.Eldyne.trim() !== '' && char.Eldyne !== 'X';

    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${char.name} 상세 정보`);
    const open = () => window.openDetailModal(char);
    card.onclick = open;
    card.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };

    const meta = [char.personality, char.line, char.role].filter(Boolean).join(' · ');

    card.innerHTML = `
        <div class="rc-card-row">
        <div class="rc-tile char-card${eldyne ? ' eldyne-card' : ''}">
            <div class="${reso ? 'card-top bg-resonance' : 'card-top'}"
                 style="background:${reso ? 'none' : p.bg};border:3px solid ${p.border};">
                <img class="char-img" src="./assets/icons/chara_image/초상화_${encodeURIComponent(char.name)}.webp"
                     loading="lazy" decoding="async" alt=""
                     style="width:100%;height:100%;object-fit:cover;"
                     onerror="this.onerror=null;this.src='./assets/icons/chara_image/default.webp'">
                <img src="./assets/icons/personality/${encodeURIComponent(char.personality || '')}.webp"
                     style="position:absolute;top:6px;left:6px;width:28px;height:28px;z-index:2;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3));"
                     onerror="this.remove()">
                ${eldyne ? `<img src="./assets/icons/common_icons/Ingame_Icon_HeroGrow_Hidden.webp"
                     class="eldyne-corner-icon" alt="엘다인" data-tooltip="이 별은 이 사도가 엘다인임을 의미합니다. 엘다인은 일반 사도들에 비해 강력한 성능을 가지고 있으며, 픽업과 모집권에서 등장 확률이 낮습니다.">` : ''}
                <div style="position:absolute;bottom:8px;left:0;width:100%;padding:0 8px;display:flex;justify-content:space-between;align-items:center;z-index:2;">
                    <img src="./assets/icons/role/${encodeURIComponent(char.role || '')}.webp"
                         style="width:26px;height:26px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3));" onerror="this.remove()">
                    <img src="./assets/icons/line/${encodeURIComponent(char.line || '')}.webp"
                         style="width:28px;height:28px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3));" onerror="this.remove()">
                </div>
                <div style="position:absolute;bottom:6px;width:100%;z-index:3;">${makeStarHTML(char.star)}</div>
            </div>
        </div>
        <div class="rc-card-text">
            <div class="rc-card-head">
                ${pick ? `<i class="rc-pick-star" title="${esc(pick)}"></i>` : ''}
                <span class="rc-card-name">${esc(char.name)}</span>
                ${dim ? `<span class="rc-dim-badge">${esc(dim)}</span>` : ''}
                ${cardChips(char.name, secKey, rec.chips)}
            </div>
            ${char.title ? `<div class="rc-card-title">${esc(char.title)}</div>` : ''}
            <div class="rc-card-meta">${esc(meta)}</div>
        </div>
        </div>
        ${reason ? `<div class="rc-why"><p>${esc(reason)}</p></div>` : ''}`;
    return card;
}

function buildSection(sec, dbMap, missing, flat) {
    const sEl = document.createElement('section');
    sEl.className = 'rc-sec';

    /* ⚠ 소분류 설명을 툴팁에 숨기지 않는다. 이 페이지에서 가장 자주 읽힐 문장이다. */
    sEl.innerHTML = `
        <header class="rc-sec-head">
            <h3 class="rc-sec-title" role="button" tabindex="0" aria-expanded="true">${sec.icon
                ? `<img class="rc-sec-icon" src="${iconUrl(sec.icon, 'content')}"
                       alt="" onerror="this.remove()">` : ''}${esc(sec.label)}
                <svg class="rc-fold" viewBox="0 0 24 24" width="20" height="20" fill="none"
                     stroke="currentColor" stroke-width="2.6" stroke-linecap="round"
                     stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></h3>
            ${sec.tip ? `<p class="rc-sec-tip">${esc(sec.tip)}</p>` : ''}
        </header>
        <div class="rc-sec-body"></div>`;

    /* 제목을 누르면 접힌다. 설명(`sec_tip`)은 남는다 — 무슨 칸인지는 접어도 보여야 한다.
       ⚠ 설명 문단까지 누름 대상으로 만들면 글자를 못 고른다. 제목 줄만 받는다. */
    const title = sEl.querySelector('.rc-sec-title');
    const fold = () => {
        const off = sEl.classList.toggle('is-folded');
        title.setAttribute('aria-expanded', off ? 'false' : 'true');
    };
    title.onclick = fold;
    title.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fold(); } };
    /* 묶음들은 몸통 하나에 담는다 — subgrid 가 머리/몸통 두 줄만 보게 하려면
       `.rc-sec` 의 자식이 정확히 둘이어야 한다. */
    const body = sEl.querySelector('.rc-sec-body');

    /* 묶음 이름은 `group` 이 있으면 그것, 비었으면 사도의 역할이다.
       분류마다 기준이 달라도 된다 — 어떤 데는 역할로, 어떤 데는 '무토 필수' 로 갈라도 된다. */
    const byRole = new Map();
    sec.rows.forEach(r => {
        const ch = dbMap.get(r.chara_name.trim());
        if (!ch) { missing.push(r.chara_name); return; }
        const role = (r.group || '').trim() || ch.role || '기타';
        if (!byRole.has(role)) byRole.set(role, []);
        byRole.get(role).push({ ch, rec: r, rank: parseInt(r.rank) || 99 });
    });

    /* 역할 이름이 먼저(딜러→서포터→탱커), 직접 지은 이름은 처음 나온 순서로 뒤에.
       ⚠ Map 은 넣은 순서를 기억한다. 그게 곧 CSV 행 순서다 — 이 페이지의 규칙이다. */
    const born = new Map([...byRole.keys()].map((k, i) => [k, i]));
    [...byRole.keys()].sort((a, b) => {
        const ia = ROLE_ORDER.indexOf(a), ib = ROLE_ORDER.indexOf(b);
        if (ia < 0 && ib < 0) return born.get(a) - born.get(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    }).forEach(role => {
        /* 비추천(`dim`)은 **묶음 안에서 맨 뒤로** 민다. 추천 목록인데 "지금은 아니다" 가
           위에 있으면 읽는 순서가 어긋난다.
           ⚠ 묶음을 건너뛰지는 못한다 — 엘다인인 사도를 비엘다인 아래로 보낼 수는 없으니,
             분류 전체의 맨 아래가 아니라 **제 묶음의 맨 아래**다. */
        const dimmed = x => String(x.rec.dim || '').trim() ? 1 : 0;
        const list = byRole.get(role)
            .sort((a, b) => (dimmed(a) - dimmed(b)) || (a.rank - b.rank));
        const rEl = document.createElement('div');
        rEl.className = 'rc-role';
        /* 묶음 이름은 라벨이지 제목이 아니다 — 소분류 제목과 경쟁하지 않게 낮춘다.
           ⚠ 분류 자체가 그 이름일 때는(리세마라 탭의 `딜러`·`탱커`·`서포터`) 패널 제목과
             같은 말이 된다. 그럴 때는 라벨을 뺀다 — 제목 바로 아래 같은 글자가 또 오면
             읽을 게 늘 뿐이다.
           ⚠ 아이콘은 역할 이름일 때만 있다. 직접 지은 이름은 파일이 없으니 조용히 빠진다. */
        const sameAsTitle = role === (sec.label || '').trim();
        /* ⚠ 아이콘은 **역할 이름일 때만 요청한다.** 직접 지은 묶음 이름(`1순위`, `엘다인`…)
             까지 요청하면 onerror 로 화면은 멀쩡해도 콘솔에 404 가 줄줄이 쌓인다. */
        const hasIcon = ROLE_ORDER.includes(role);
        rEl.innerHTML = (sameAsTitle ? '' : `<div class="rc-role-title">
            ${hasIcon ? `<img src="./assets/icons/role/${encodeURIComponent(role)}.webp" alt="">` : ''}
            <span>${esc(role)}</span><em>${list.length}</em>
        </div>`) + `<div class="rc-cards"></div>`;
        const wrap = rEl.querySelector('.rc-cards');
        list.forEach(item => {
            flat.push(item.ch);
            wrap.appendChild(buildCard(item.ch, item.rec, sec.key));
        });
        body.appendChild(rEl);
    });
    return sEl;
}

/* ── 보기 방식 ───────────────────────────────────────────────
   `slide` 한 분류씩 가운데. 양옆 분류가 **흐릿하게 비쳐** 더 있다는 걸 알린다
   `list`  전부 한 줄로 쭉. 분류끼리 나란히 놓고 비교할 때

   ⚠ 고른 값은 이 브라우저에만 남는다 (`localStorage`). 읽는 사람 취향이지
     데이터가 아니다. 값이 없거나 못 읽어도 `slide` 로 돌아간다. */
const VIEWS = ['slide', 'list'];
let rcView = 'slide';
try { const v = localStorage.getItem('rcView'); if (VIEWS.includes(v)) rcView = v; } catch { }

/* ⚠ **좁은 화면에서는 무조건 1열이다.** 슬라이드는 폰에서 못 쓴다 —
     분류 이름이 길어 버튼 줄이 다섯 줄로 접히는데 그게 따라다니느라 카드를 덮고,
     양옆으로 비치는 폭도 30px 남짓이라 "옆에 더 있다"는 신호 구실도 못 한다.
   고른 값(`rcView`)은 그대로 둔다 — 넓은 화면으로 돌아가면 쓰던 대로 복구된다.
   화면에 실제로 적용하는 건 `effView()` 다. */
const RC_NARROW = window.matchMedia('(max-width: 720px)');
const effView = () => RC_NARROW.matches ? 'list' : rcView;
RC_NARROW.addEventListener('change', () => setView(rcView, false));

function setView(mode, remember = true) {
    if (!VIEWS.includes(mode)) return;
    if (remember) {
        rcView = mode;
        try { localStorage.setItem('rcView', mode); } catch { }
    }
    const mode2 = effView();
    /* 버튼은 **고른 값**을 보여 준다 (좁은 화면에서는 어차피 숨어 있다) */
    document.querySelectorAll('.rc-view-btn').forEach(b =>
        b.classList.toggle('on', b.dataset.view === rcView));
    /* 분류 줄은 패널이 아니라 상자 안에 있다 — 표시를 상자에도 달아야 CSS 가 걸린다 */
    document.querySelectorAll('.rc-subhost').forEach(b => {
        b.classList.toggle('is-list', mode2 === 'list');
        b.classList.add('is-switching');
        void b.offsetHeight;
        b.classList.remove('is-switching');
    });
    document.querySelectorAll('.rc-panel').forEach(pn => {
        /* 전환 애니메이션을 끈 채로 값을 바꾼다 — 안 그러면 1열로 갈 때
           슬라이드가 주르륵 미끄러진다 */
        pn.classList.add('is-switching');
        pn.classList.toggle('is-list', mode2 === 'list');
        /* 1열에서는 접기가 살아 있다. 슬라이드에서는 한 분류만 보이니 접을 이유가 없다 */
        if (mode2 === 'slide') pn.querySelectorAll('.rc-sec.is-folded').forEach(el => {
            el.classList.remove('is-folded');
            el.querySelector('.rc-sec-title').setAttribute('aria-expanded', 'true');
        });
        layoutSlides(pn);
        placeInd(pn, true);
        void pn.offsetHeight;          /* 강제 리플로우 — 여기서 새 값이 확정된다 */
        pn.classList.remove('is-switching');
        if (!pn.hidden) replayPanelIn(pn);
    });
}

/* 보기 방식을 바꾸면 **다시 그려진 느낌**이 나야 한다.
   슬라이드가 미끄러지는 건 막아 놨는데(모드 전환은 이동이 아니다) 그러고 나니
   아무 변화도 안 남아 바뀐 줄 모르겠다는 말이 나왔다. 탭을 넘길 때 쓰는 페이드를
   여기서도 한 번 더 돌린다.
   ⚠ 애니메이션을 다시 돌리려면 `none` 으로 끊고 **강제 리플로우**를 넣어야 한다.
     그냥 다시 지정하면 브라우저가 같은 값으로 보고 아무 일도 안 한다. */
function replayPanelIn(panel) {
    panel.style.animation = 'none';
    void panel.offsetHeight;
    panel.style.animation = '';
}

/* 슬라이드 자리를 다시 잰다. 가운데 분류의 높이에 무대를 맞춘다 —
   안 맞추면 제일 긴 분류에 맞춰져 아래가 휑하다. */
function layoutSlides(panel) {
    const stage = panel.querySelector('.rc-stage');
    const track = panel.querySelector('.rc-track');
    if (!stage || !track) return;
    const secs = [...track.children];
    if (!secs.length) return;

    if (panel.classList.contains('is-list')) {
        stage.style.height = '';
        track.style.transform = '';
        stage.style.removeProperty('--rc-slide-w');
        secs.forEach(el => el.classList.remove('is-away'));
        return;
    }
    const i = Math.min(panel._slide || 0, secs.length - 1);
    const W = stage.clientWidth;
    /* ⚠ 폭이 0 이면(아직 안 보이는 패널) 계산하지 않는다. 0 으로 재면 슬라이드 폭이 0 이 되고
         마스크가 화면 전체를 지워버린다. */
    if (!W) return;
    /* 하나뿐이면 꽉 채운다. 여럿이면 양옆이 조금 비치게 좁힌다 */
    const sw = secs.length > 1 ? Math.round(W * (W < 720 ? 0.86 : 0.8)) : W;
    const gap = 16;
    stage.style.setProperty('--rc-slide-w', sw + 'px');
    track.style.transform = 'translateX(' + Math.round((W - sw) / 2 - i * (sw + gap)) + 'px)';
    secs.forEach((el, k) => el.classList.toggle('is-away', k !== i));
    stage.style.height = secs[i].offsetHeight + 'px';
}

function showSlide(panel, i, push) {
    const secs = [...panel.querySelectorAll('.rc-track > .rc-sec')];
    panel._slide = Math.max(0, Math.min(i, secs.length - 1));
    /* ⚠ 분류 줄은 **패널 밖**(상자 안)에 있다. `panel.querySelectorAll` 로는 못 찾는다 —
         그래서 한동안 `.on` 표시와 화살표 비활성이 조용히 안 걸렸다. */
    const sub = panel._sub || panel;
    sub.querySelectorAll('.rc-subtab').forEach((b, k) => {
        const on = k === panel._slide;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    placeInd(panel);
    sub.querySelectorAll('.rc-arrow').forEach(b => {
        b.disabled = Number(b.dataset.dir) < 0
            ? panel._slide === 0
            : panel._slide === secs.length - 1;
    });
    layoutSlides(panel);
    if (push) writeHash(panel);
}

/* 고른 분류 위로 알약을 옮긴다.
   ⚠ 좁은 화면에서는 분류 버튼이 **여러 줄로 접힌다.** 가로만 옮기면 알약이 엉뚱한 줄에
     남으므로 `offsetTop` 까지 같이 본다.
   ⚠ `offsetLeft` 는 트레이의 **안쪽(padding box) 기준**이고 알약도 `top/left: 0` 으로
     같은 자리에서 출발한다. 테두리 두께를 빼면 오히려 1px 어긋난다 (한 번 그랬다).
   ⚠ 안 보이는 동안에는 폭이 0 이다 — 그때 재면 알약이 왼쪽 위로 쭈그러든다. 건너뛴다. */
function placeInd(panel, instant) {
    const tabs = panel._sub && panel._sub.querySelector('.rc-subtabs');
    if (!tabs) return;
    const ind = tabs.querySelector('.rc-subtab-ind');
    const btn = tabs.querySelectorAll('.rc-subtab')[panel._slide || 0];
    if (!ind) return;
    if (!btn || !btn.offsetWidth) { ind.style.opacity = '0'; return; }
    if (instant) ind.style.transition = 'none';
    ind.style.opacity = '1';
    ind.style.width = btn.offsetWidth + 'px';
    ind.style.height = btn.offsetHeight + 'px';
    ind.style.transform = `translate(${btn.offsetLeft}px, ${btn.offsetTop}px)`;
    if (instant) { void ind.offsetWidth; ind.style.transition = ''; }
}

/* 글꼴이 늦게 붙거나 창이 좁아져 버튼이 접히면 알약 자리가 어긋난다 */
const indWatch = new ResizeObserver(() => {
    const panel = document.querySelector('.rc-panel:not([hidden])');
    if (panel) placeInd(panel, true);
});

function writeHash(panel) {
    const key = panel.dataset.key;
    const sec = panel._secKeys && panel._secKeys[panel._slide || 0];
    const want = '#' + key + (effView() === 'slide' && sec ? '/' + sec : '');
    if (location.hash !== want) history.replaceState(null, '', want);
}

/* 분류가 커지거나 줄면(그림이 늦게 뜨는 등) 무대 높이도 따라가야 한다.
   ⚠ `resize` 이벤트는 이 페이지에서 믿을 수 없다 — ResizeObserver 를 쓴다. */
const stageWatch = new ResizeObserver(entries => {
    entries.forEach(e => {
        const panel = e.target.closest('.rc-panel');
        if (panel && !panel.hidden) layoutSlides(panel);
    });
});

/* 분류 묶음이 화면 위에 붙었을 때만 유리로 만든다. 안 붙었을 땐 평평해야
   페이지 맨 위가 무겁지 않다. `top: 8px` 라 1px 여유를 두고 잰다.
   겸해서 맨 위로 버튼도 여기서 켜고 끈다 — 탭 줄이 스크롤로 사라지므로
   돌아갈 길이 있어야 한다. */
function watchStuck() {
    const host = document.querySelector('.rc-subhost');
    if (host) host.classList.toggle('is-stuck', host.getBoundingClientRect().top <= 9);
    const top = document.getElementById('top-btn');
    if (top) top.style.display = window.scrollY > 300 ? 'flex' : 'none';
}
window.addEventListener('scroll', watchStuck, { passive: true });

document.addEventListener('keydown', e => {
    if (effView() !== 'slide') return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const panel = document.querySelector('.rc-panel:not([hidden])');
    if (!panel) return;
    e.preventDefault();
    showSlide(panel, (panel._slide || 0) + (e.key === 'ArrowRight' ? 1 : -1), true);
});

/* 대분류 = 탭. 선택 상태는 URL 해시에 담아 링크로 공유할 수 있게 한다. */
function activateTab(key, secKey) {
    document.querySelectorAll('.rc-tab').forEach(b => {
        const on = b.dataset.key === key;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    let active = null;
    document.querySelectorAll('.rc-panel').forEach(pn => {
        pn.hidden = pn.dataset.key !== key;
        if (!pn.hidden) active = pn;
    });
    /* 고른 탭의 분류 줄만 따라다니는 칸에 둔다 */
    const subhost = document.querySelector('.rc-subhost');
    if (subhost) {
        subhost.querySelectorAll('.rc-subbar').forEach(el => el.remove());
        if (active && active._sub) {
            subhost.appendChild(active._sub);
            /* 붙자마자는 폭이 잡히기 전이라 한 번 더 잰다. 미끄러지지 않게 순간이동. */
            placeInd(active, true);
            requestAnimationFrame(() => placeInd(active, true));
        }
    }
    if (active) {
        const i = secKey && active._secKeys ? active._secKeys.indexOf(secKey) : -1;
        /* ⚠ 숨어 있는 동안에는 폭이 0 이라 자리를 못 잰다. 보이게 된 **뒤에** 다시 잰다. */
        showSlide(active, i >= 0 ? i : (active._slide || 0), false);
        requestAnimationFrame(() => layoutSlides(active));
        /* 1열에서는 옮길 슬라이드가 없다 — `#탭/분류` 로 들어오면 그 분류로 내려 준다.
           ⚠ 탭 버튼을 눌렀을 때는 `secKey` 가 없어 `i` 가 -1 이므로 여기 안 걸린다. */
        if (i >= 0 && effView() === 'list') {
            const el = active.querySelectorAll('.rc-track > .rc-sec')[i];
            if (el) setTimeout(() => el.scrollIntoView({ block: 'start' }), 60);
        }
        writeHash(active);
    }
    window.currentDisplayedList = window._rcFlat ? (window._rcFlat[key] || []) : [];
}

/* 분류 정의(`Recommend_Sections.csv`)와 사도 배치(`Recommend_Chara.csv`)는 **따로** 둔다.
   한 파일에 두면 분류명·설명이 사도 수만큼 반복돼, 설명 한 글자 고치는 데 여러 곳을
   고쳐야 하고 하나만 빠뜨려도 조용히 갈라진다.

   ⚠ 탭·분류가 나오는 순서는 **`Recommend_Sections.csv` 의 행 순서** 그대로다. */
function render(secDefs, recs, dbMap, chipDefs) {
    const body = document.getElementById('rc-body');
    const missing = [];

    /* 칩의 글자·아이콘·색은 여기 한 곳에만 있다. 색을 비우면 이 파일에 나온
       **순서**대로 6색을 돌린다 — 이름으로 해시하면 항목이 하나 늘 때 기존 색이
       통째로 바뀌고, 전부 손으로 채우게 하면 채울 게 는다. */
    window._rcChips = new Map((chipDefs || []).filter(c => (c.chip_key || '').trim())
        .map((c, i) => [(c.chip_key || '').trim(), {
            label: (c.chip_label || '').trim() || (c.chip_key || '').trim(),
            icon: (c.chip_icon || '').trim(),
            color: (c.chip_color || '').trim(),
            tip: (c.chip_tip || '').trim(),
            hue: i % 6,
        }]));

    const groups = new Map();
    const secByKey = new Map();
    secDefs.forEach(d => {
        const gk = (d.group_key || '').trim(), sk = (d.sec_key || '').trim();
        if (!gk || !sk || secByKey.has(sk)) return;
        if (!groups.has(gk)) groups.set(gk,
            { label: d.group_label, icon: d.group_icon, tip: (d.group_tip || '').trim(), secs: new Map() });
        const sec = { key: sk, label: d.sec_label, tip: d.sec_tip, icon: (d.sec_icon || '').trim(),
                      chip: (d.sec_chip || '').trim(), rows: [] };
        groups.get(gk).secs.set(sk, sec);
        secByKey.set(sk, sec);
    });

    /* 어느 분류에도 안 걸리는 배치는 조용히 사라지면 안 된다 — 오타가 여기서 난다 */
    const orphan = [];
    recs.forEach(r => {
        const k = (r.sec_key || '').trim();
        if (!r.chara_name || !k) return;
        const sec = secByKey.get(k);
        if (!sec) { orphan.push(k); return; }
        sec.rows.push(r);
    });

    /* 사도 → 배치된 소분류들. 그 분류의 `sec_chip` 이 카드의 자동 칩이 된다. */
    const secIndex = new Map();
    groups.forEach(g => g.secs.forEach(sec => {
        sec.rows.forEach(r => {
            const n = (r.chara_name || '').trim();
            if (!n) return;
            if (!secIndex.has(n)) secIndex.set(n, []);
            if (!secIndex.get(n).some(x => x.key === sec.key))
                secIndex.get(n).push({ key: sec.key, chip: sec.chip });
        });
    }));
    window._rcSecIndex = secIndex;

    /* 사도가 한 명도 없는 분류는 띄우지 않는다. 제목과 설명만 있는 빈 상자는
       읽을 게 없고, 옆칸 높이까지 끌어올린다. 분류 정의는 CSV 에 남아 있으니
       **사도를 한 명 넣으면 그대로 다시 나온다.**
       ⚠ 그래서 분류가 안 보인다고 지워진 게 아니다. 편집기 목록에는 그대로 있다. */
    groups.forEach(g => g.secs.forEach((sec, k) => { if (!sec.rows.length) g.secs.delete(k); }));
    groups.forEach((g, k) => { if (!g.secs.size) groups.delete(k); });

    body.innerHTML = '';
    if (!groups.size) { body.innerHTML = '<div class="rc-loading">표시할 추천 데이터가 없습니다.</div>'; return; }

    /* 탭 줄과 분류 줄을 한 상자에 담는다. 분류 줄은 패널마다 다르므로
       고른 탭의 것을 상자 아래칸으로 옮겨 붙인다 (`activateTab`). */
    const navbox = document.createElement('div');
    navbox.className = 'rc-navbox';
    const bar = document.createElement('div');
    bar.className = 'rc-tabbar';
    bar.setAttribute('role', 'tablist');
    navbox.appendChild(bar);
    body.appendChild(navbox);

    /* 분류 묶음만 따로 담아 **이쪽만** 화면에 붙게 한다 */
    const subhost = document.createElement('div');
    subhost.className = 'rc-subhost';
    body.appendChild(subhost);

    /* 보기 방식은 **탭마다 따로가 아니라 페이지 전체 설정**이다 (`localStorage` 의 `rcView`).
       패널마다 하나씩 두면 같은 값을 여러 벌 그려놓고 매번 맞춰줘야 한다. 탭 줄에 하나만 둔다.
       ⚠ 탭 버튼을 다 넣은 **뒤에** 붙여야 `margin-left: auto` 로 오른쪽에 선다. */
    const viewsw = document.createElement('div');
    viewsw.className = 'rc-viewsw';
    viewsw.innerHTML = `
        <button class="rc-view-btn" data-view="slide" title="한 분류씩 보기">슬라이드</button>
        <button class="rc-view-btn" data-view="list"  title="전부 한 줄로 보기">1열</button>`;

    window._rcFlat = {};
    /* 패널을 다 만든 뒤에 단을 채운다 (아래 `packPanels()`) */
    groups.forEach((g, key) => {
        const btn = document.createElement('button');
        btn.className = 'rc-tab';
        btn.dataset.key = key;
        btn.setAttribute('role', 'tab');
        /* 대분류 아이콘의 기본 폴더는 `assets/icons/common_icons/` 다.
           파일이 없으면 onerror 로 조용히 빠지고 글자만 남는다. */
        btn.innerHTML = (g.icon
            ? `<img class="rc-tab-icon" alt="" src="${iconUrl(g.icon, 'common_icons')}"
                   onerror="this.remove()">`
            : '') + esc(g.label);
        /* 탭 전체에 걸리는 설명은 버튼에 매단다 (CSS `.rc-tab[data-tip]::after`).
           ⚠ `title` 은 걸지 않는다 — 브라우저 기본 툴팁이 뒤늦게 또 뜬다. */
        if (g.tip) btn.dataset.tip = g.tip;
        btn.onclick = () => activateTab(key);
        bar.appendChild(btn);

        const panel = document.createElement('section');
        panel.className = 'rc-panel';
        panel.dataset.key = key;
        panel.setAttribute('role', 'tabpanel');
        /* 같은 설명을 문단으로도 남긴다. 마우스가 없는 기기에는 툴팁이 안 뜨므로
           거기서는 이쪽을 보여준다 (CSS 가 둘 중 하나만 띄운다). */
        if (g.tip) {
            const t = document.createElement('p');
            t.className = 'rc-group-tip';
            t.textContent = g.tip;
            panel.appendChild(t);
        }
        const flat = [];
        const secList = [...g.secs.values()];
        panel._secKeys = secList.map(sec => sec.key);
        panel._slide = 0;

        /* 분류 고르기 줄 + 보기 방식 */
        const sub = document.createElement('div');
        sub.className = 'rc-subbar';
        /* `‹ 분류들 ›` 을 한 덩어리로 묶어 가운데 두고, 보기 방식만 오른쪽에 붙인다.
           ⚠ 인게임 화살표 그림(`CommonButton_*_5.webp`)을 써 봤는데 이 페이지 버튼들과
             양식이 안 맞았다. 사이트 공통 꼴을 따르는 SVG 로 되돌렸다. */
        sub.innerHTML = `<div class="rc-navgroup">
                <button class="rc-arrow" data-dir="-1" aria-label="이전 분류"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></button>
                <div class="rc-subtabs" role="tablist"><span class="rc-subtab-ind"></span></div>
                <button class="rc-arrow" data-dir="1" aria-label="다음 분류"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>
            </div>`;
        panel._sub = sub;   /* 상자 아래칸으로 옮겨 붙인다 (`activateTab`) */

        const stage = document.createElement('div');
        stage.className = 'rc-stage';
        const track = document.createElement('div');
        track.className = 'rc-track';
        stage.appendChild(track);
        panel.appendChild(stage);

        sub.querySelectorAll('.rc-arrow').forEach(b => {
            b.onclick = () => showSlide(panel, (panel._slide || 0) + Number(b.dataset.dir), true);
        });

        const tabs = sub.querySelector('.rc-subtabs');
        indWatch.observe(tabs);
        secList.forEach((sec, i) => {
            const el = buildSection(sec, dbMap, missing, flat);
            /* 비껴 있는 분류를 눌러도 그쪽으로 간다 — 흐릿한 것도 눌린다는 걸 알려준다.
               ⚠ 캡처 단계에서 가로채야 카드의 상세 모달이 먼저 열리지 않는다. */
            el.addEventListener('click', ev => {
                if (!el.classList.contains('is-away')) return;
                ev.preventDefault(); ev.stopPropagation();
                showSlide(panel, i, true);
            }, true);
            track.appendChild(el);
            stageWatch.observe(el);

            const b = document.createElement('button');
            b.className = 'rc-subtab';
            b.setAttribute('role', 'tab');
            b.innerHTML = (sec.icon
                ? `<img src="${iconUrl(sec.icon, 'content')}" alt="" onerror="this.remove()">` : '')
                + esc(sec.label);
            b.onclick = () => showSlide(panel, i, true);
            tabs.appendChild(b);
        });

        window._rcFlat[key] = flat;
        body.appendChild(panel);
    });

    if (missing.length) {
        const w = document.createElement('div');
        w.className = 'rc-warn';
        w.textContent = `DB.csv에서 찾지 못한 사도: ${[...new Set(missing)].join(', ')}`;
        body.prepend(w);
    }
    if (orphan.length) {
        const w = document.createElement('div');
        w.className = 'rc-warn';
        w.textContent = `Recommend_Sections.csv 에 없는 sec_key: ${[...new Set(orphan)].join(', ')}`;
        body.prepend(w);
    }

    bar.appendChild(viewsw);
    watchStuck();
    viewsw.querySelectorAll('.rc-view-btn').forEach(b => { b.onclick = () => setView(b.dataset.view); });
    setView(rcView);

    const keys = [...groups.keys()];
    /* 해시는 `#탭` 또는 `#탭/분류` */
    const read = () => decodeURIComponent(location.hash.slice(1)).split('/');
    const [wantTab, wantSec] = read();
    activateTab(keys.includes(wantTab) ? wantTab : keys[0], wantSec);
    window.addEventListener('hashchange', () => {
        const [k, sk] = read();
        if (keys.includes(k)) activateTab(k, sk);
    });
}

/* ── 상세 모달용 데이터 컨텍스트 ────────────────────────────────
   main.js 와 동일한 DB 묶음을 만들어 ui.js 에 넘깁니다.            */
function wireDetailModal(ctx) {
    window.openDetailModal = (char) => openDetailModal(char, ctx);
    window.switchTab = switchTab;
    window.updateLowSkillLv = (lv, name) => updateLowSkillLv(lv, name, ctx.lowSkillDB);
    window.updateHighSkillLv = (lv, name) => updateHighSkillLv(lv, name, ctx.highSkillDB);
    window.toggleQuickFilter = (type) => toggleQuickFilter(type);
    window._battleItemDB = ctx.battleItemDB;

    window.navigateApostle = (dir) => {
        const list = window.currentDisplayedList;
        if (!list || !window.currentApostleName) return;
        const idx = list.findIndex(c => c.name === window.currentApostleName);
        if (idx < 0) return;
        const next = list[(idx + dir + list.length) % list.length];
        const card = document.querySelector('#modal-detail .tg-modal-card');
        if (card) {
            card.style.animation = dir > 0
                ? 'tg-slide-out-left 0.15s ease forwards'
                : 'tg-slide-out-right 0.15s ease forwards';
            setTimeout(() => { window._navDir = dir; window.openDetailModal(next); }, 150);
        } else {
            window.openDetailModal(next);
        }
    };
}

/* '무작위 배틀 아이템 생성' 상태에 배틀 아이템 태그를 합쳐 넣는다 (main.js 와 동일) */
function syncBattleItemTags(allStateDB, battleItemDB) {
    const st = allStateDB.find(d => d.state_name === '무작위 배틀 아이템 생성');
    if (!st || !battleItemDB.length) return;
    const tags = new Set();
    battleItemDB.forEach(r => (r.tag || '').split(',').forEach(t => {
        const v = t.trim(); if (v) tags.add(v);
    }));
    tags.add('배틀 아이템 생성');
    st.tag = [...tags].join(',');
}

(async function init() {
    const v = window.APP_VERSION || '';
    const cfg = { header: true, skipEmptyLines: true, trimHeaders: true };
    const get = f => fetch(`./data/${f}?v=${v}`).then(r => r.text());
    try {
        const [secT, rec, chipT, dbT, debuffT, debuffDescT, highT, buffT, buffDescT, normalT, lowT, asideT, spT, itemT] =
            await Promise.all(['Recommend_Sections.csv', 'Recommend_Chara.csv', 'Recommend_Chips.csv',
                'DB.csv', 'debuff_DB.csv', 'debuff_desc_DB.csv',
                'high_skill_DB.csv', 'buff_DB.csv', 'buff_desc_DB.csv', 'normal_Atk_DB.csv',
                'low_skill_DB.csv', 'aside_DB.csv', 'sp_DB.csv', 'battle_item_DB.csv'].map(get));
        const P = t => Papa.parse(t, cfg).data;

        const db = P(dbT);
        const buffDescDB = P(buffDescT), debuffDescDB = P(debuffDescT);
        const allStateDB = [...buffDescDB, ...debuffDescDB];
        const battleItemDB = P(itemT);
        syncBattleItemTags(allStateDB, battleItemDB);

        wireDetailModal({
            debuffDB: P(debuffT), buffDB: P(buffT),
            lowSkillDB: P(lowT), highSkillDB: P(highT),
            allStateDB, debuffDescDB,
            normalAtkDB: P(normalT), asideDB: P(asideT),
            spDB: P(spT), battleItemDB
        });

        const dbMap = new Map(db.filter(r => r.name).map(r => [r.name.trim(), r]));
        render(P(secT), P(rec), dbMap, P(chipT));
    } catch (e) {
        document.getElementById('rc-body').innerHTML =
            `<div class="rc-warn">데이터를 불러오지 못했습니다: ${esc(e.message)}</div>`;
    }
})();
