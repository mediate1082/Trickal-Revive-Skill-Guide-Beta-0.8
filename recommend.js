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
    /* ⚠ 설명은 `data-tooltip` 으로 단다. `title` 은 뜨기까지 1초 넘게 걸리고
         꼴도 못 맞춘다 (칩·엘다인 별과 같은 말풍선을 써야 한다). */
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
                 style="background:${reso ? 'none' : p.bg};border:3px solid ${p.border};border-bottom:none;">
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
                ${pick ? `<i class="rc-pick-star" data-tooltip="${esc(pick)}"></i>` : ''}
                <span class="rc-card-name">${esc(char.name)}</span>
                ${dim ? `<span class="rc-dim-badge">${esc(dim)}</span>` : ''}
                ${cardChips(char.name, secKey, rec.chips)}
            </div>
            ${char.title ? `<div class="rc-card-title">${esc(char.title)}</div>` : ''}
            <div class="rc-card-meta">${esc(meta)}</div>
        </div>
        </div>
        ${reason ? `<div class="rc-why"><p>${linkify(reason)}</p></div>` : ''}`;
    return card;
}

/* ── 덱 편성 (`Recommend_Decks.csv`) ───────────────────────────
   줘팸터처럼 **덱 단위로 돌아가는** 콘텐츠용. 행 하나가 덱 하나다
   (`Recommend_Chara.csv` 는 행 하나가 사도 하나라 모양이 다르다 — 그래서 파일을 갈랐다).

   ⚠ 분류의 **맨 위**에 온다. 조합을 먼저 보고 개별 추천을 나중에 보는 순서다. */

/* 초상화만 있는 작은 타일. 큰 카드(`buildCard`)의 `.rc-tile` 과 **같은 마크업**이라
   성격 배경·테두리, 성격/역할/배치 아이콘, 별이 그대로 따라온다. 폭만 작다.
   ⚠ 레벨 뱃지는 넣지 않는다 — 인게임엔 있지만 여긴 추천이라 레벨이 없다. */
/* 빈 자리 — `members` 에 `?` (또는 `???`) 를 쓰면 "여긴 상대 보고 고르세요" 가 된다.
   ⚠ 쉼표만 남기는 빈칸은 쓰지 않는다. CSV 에서 눈에 안 보이고, 끝 쉼표가 항목을
     한 칸씩 미는 함정이 이 프로젝트에 이미 있다. */
/* ── 글 속의 주소를 링크로 ───────────────────────────────────────
   `deck_sub` · `sec_tip` · `reason` 처럼 **사람이 쓴 문장**에 쓴다.

   받는 꼴 둘 —
     [라벨](https://…)   라벨을 보여준다
     https://…           **도메인만** 보여준다

   ⚠ 맨 주소를 그대로 찍지 않는다. 지금 들어 있는 디시 공략 주소가 70자라
     줄을 통째로 먹고 폰에서는 두 줄이 된다. 도메인만 보여도 "어디로 가는가" 는
     오히려 더 잘 읽힌다.
   ⚠ `esc` 를 먼저 돌리고 정규식을 태우면 안 된다. `&` 가 `&amp;` 로 바뀌어
     주소가 끊긴다 (디시 주소에 `&no=` 가 있다). **원문에서 잘라 조각마다 따로 escape 한다.**
   ⚠ 바깥 사이트로 나가므로 `rel="noopener noreferrer"` 를 반드시 붙인다. */
const LINK_RE = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+)/g;
const LINK_ICON =
    '<svg class="rc-link-ico" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"'
  + ' fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"'
  + ' stroke-linejoin="round"><path d="M14 4h6v6"/><path d="M20 4l-8.5 8.5"/>'
  + '<path d="M18 14.5V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H10"/></svg>';

function linkify(raw) {
    const s = String(raw ?? '');
    let out = '', last = 0, m;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(s)) !== null) {
        out += esc(s.slice(last, m.index));
        let url = m[2] || m[3], tail = '';
        /* 맨 주소 뒤에 붙은 문장부호는 주소가 아니다 — `…3848757 참조` 는 괜찮지만
           `…3848757.` 이면 마침표까지 먹는다 */
        if (!m[2]) {
            const t = url.match(/[.,;:!?)\]}]+$/);
            if (t) { tail = t[0]; url = url.slice(0, -tail.length); }
        }
        const label = m[1] || url.replace(/^https?:\/\//, '').replace(/[/?#].*$/, '');
        out += `<a class="rc-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer"`
             + `><span class="rc-link-t">${esc(label)}</span>${LINK_ICON}</a>` + esc(tail);
        last = m.index + m[0].length;
    }
    return out + esc(s.slice(last));
}

const isFreeSlot = n => /^\?+$/.test(String(n || '').trim());

/* 인게임 줘팸터 랭킹의 '조합 숨김' 칸과 같은 꼴 — 성격색도 별도 없는 평평한 회색 타일에
   물음표 하나. 에셋도 게임의 그것(`PVP_HidingIcon`)을 그대로 쓴다.
   ⚠ 누를 게 없으므로 클릭·포커스·툴팁을 붙이지 않는다. */
function buildFreeTile(altCount, label, tip) {
    const el = document.createElement('div');
    el.className = 'rc-dtile is-free';
    /* ⚠ 문구를 코드에 박지 않는다. 줘팸터는 '상대를 보고 고르는 자리' 지만
         심해 대격돌은 '그 해역 성격 사도로 채우는 자리' 라 뜻이 다르다. */
    el.dataset.tooltip = tip || '상황에 맞춰 고르는 자리입니다';
    /* 인게임 '조합 숨김' 기호(`PVP_HidingIcon`)를 그대로 쓰되, **글자를 같이 둔다.**
       기호만으로는 "미정" 인지 "비워두라" 인지 갈리지 않는다. 점선 테두리도 같은 신호다. */
    el.innerHTML = `
        <div class="rc-free-box">
            <img src="./assets/icons/common_icons/PVP_HidingIcon.webp" alt="" onerror="this.remove()">
            <span class="rc-free-label">${esc(label || '자유')}</span>
            ${altCount ? `<span class="rc-free-count">후보 ${altCount}명</span>` : ''}
        </div>`;
    return el;
}

/* 이름표 아래 작은 뱃지 둘. 메인 그리드 카드에서 **강화 게이지가 있던 자리**다 —
   덱에서는 강화 수준보다 "고학년을 쓰나 / 어사이드가 필요한가" 가 할 말이다.
   ⚠ `aside` 가 비면 **아무것도 안 그린다.** 42행이 다 빈 지금 상태에서 `무관` 으로
     간주하면 전부 "무관" 이라는 **틀린 정보**가 깔린다. 비었다 = 아직 안 적었다. */
/* 이름표 아래 뱃지. **지금은 어사이드뿐이다** — 고학년은 글자 뱃지였다가
   초상화 위 `gradeMarkHTML()` 로 옮겼다 (인게임 아이콘이 있으니 글자보다 낫다).
   ⚠ `aside` 가 비면 아무것도 안 그린다. 비었다 = *아직 안 적었다* 다 —
     `무관` 으로 간주하면 안 채운 행 전부에 틀린 정보가 깔린다. */
function badgeHTML(info) {
    if (!info) return '';
    const aside = (info.aside || '').trim();
    if (!aside) return '';
    const cls = aside === '필수' ? 'is-req' : aside === '권장' ? 'is-rec' : 'is-none';
    return `<span class="rc-dtile-badges">
        <span class="rc-badge rc-badge-a2 ${cls}"
              data-tooltip="어사이드 ★2 ${esc(aside)}">A2 ${esc(aside)}</span></span>`;
}

/* 초상화 **머리 위**에 얹는 고학년 표지. 인게임 자리 그대로다.
   사용 = 학사모만, 봉인 = 학사모 + 금지 표지 → **두 상태가 같은 꼴**이라 짝으로 읽힌다.

   ⚠ 두 에셋 모두 **색이 구워진 완성 아이콘**이다 (흰 마스크가 아니다).
     `mask` 로 물들이려 하지 말 것 — 원본 색이 곧 인게임의 그 색이다.
   ⚠ 금지 표지를 **가운데 같은 크기로 겹치지 말 것.** 학사모가 통째로 가려져
     "무엇을 금지하는지" 가 사라진다. 72% 로 오른쪽 아래에 물린다.
   ⚠ `info` 가 없으면(후보 줄의 타일) 빈 문자열을 돌려준다 — 거긴 편성이 아니라
     고학년을 쓰네 마네 할 맥락이 없다. 그때는 **왼쪽 위에 성격 아이콘**이 돌아온다
     (학사모가 그 자리를 비켜 주던 것이므로 빈 채로 둘 이유가 없다). */
function gradeMarkHTML(info) {
    if (!info || info.seal === undefined) return '';
    const seal = (info.seal || '').trim();
    const tip = seal ? `고학년 봉인 — ${esc(seal)}` : '고학년 스킬을 사용합니다';
    return `<span class="rc-dtile-grade${seal ? ' is-off' : ''}" data-tooltip="${tip}">
        <img src="./assets/icons/common_icons/Graduate_Skill_Icon.webp" class="g-cap" alt="고학년">
        ${seal ? '<img src="./assets/icons/common_icons/Deck_AutoForbiddenIcon.webp" class="g-no" alt="봉인">' : ''}
    </span>`;
}

function buildDeckTile(char, info, noGrade) {
    const p = PERSONALITY_COLORS[char.personality] || PERSONALITY_COLORS['공명'];
    const reso = char.personality === '공명';
    const eldyne = char.Eldyne && char.Eldyne.trim() !== '' && char.Eldyne !== 'X';
    const el = document.createElement('div');
    el.className = 'rc-dtile';
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `${char.name} 상세 정보`);
    el.dataset.tooltip = `${char.name}${char.title ? ' · ' + char.title : ''}`;
    const open = () => window.openDetailModal(char);
    el.onclick = open;
    el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
    el.innerHTML = `
        <div class="rc-tile char-card${eldyne ? ' eldyne-card' : ''}">
            <div class="${reso ? 'card-top bg-resonance' : 'card-top'}"
                 style="background:${reso ? 'none' : p.bg};border:3px solid ${p.border};border-bottom:none;">
                <img class="char-img" src="./assets/icons/chara_image/초상화_${encodeURIComponent(char.name)}.webp"
                     loading="lazy" decoding="async" alt=""
                     style="width:100%;height:100%;object-fit:cover;"
                     onerror="this.onerror=null;this.src='./assets/icons/chara_image/default.webp'">
                ${(noGrade ? '' : gradeMarkHTML(info)) || `<img src="./assets/icons/personality/${encodeURIComponent(char.personality || '')}.webp"
                     class="rc-dtile-pers" onerror="this.remove()">`}
                <div class="rc-dtile-row">
                    <img src="./assets/icons/role/${encodeURIComponent(char.role || '')}.webp"
                         onerror="this.remove()">
                    <img src="./assets/icons/line/${encodeURIComponent(char.line || '')}.webp"
                         onerror="this.remove()">
                </div>
                ${eldyne ? `<img src="./assets/icons/common_icons/Ingame_Icon_HeroGrow_Hidden.webp"
                     class="eldyne-corner-icon" alt="엘다인" data-tooltip="이 별은 이 사도가 엘다인임을 의미합니다. 엘다인은 일반 사도들에 비해 강력한 성능을 가지고 있으며, 픽업과 모집권에서 등장 확률이 낮습니다.">` : ''}
            </div>
            <div class="card-bottom rc-dtile-plate">
                <span class="char-name">${esc(char.name)}</span>
                ${badgeHTML(info)}
            </div>
        </div>`;
    return el;
}

/* `artifact_DB.csv` 를 이름으로 찾는 표. `art_*` 쪽도 한글 이름이 키라 같은 입구를 쓴다. */
const ARTIFACTS = new Map();
/* 아무 아티팩트나 괜찮다는 표시. 덱 빈자리의 `자유` 와 **같은 말**을 쓴다 —
   사용자가 한 번만 배우면 되도록. */
const FREE_ART = '자유';
const GRADE_FRAME = {
    '':     './assets/icons/common_icons/Ingame_ArtifactBase_Empty.webp',
    '일반': './assets/icons/common_icons/Ingame_ArtifactBase_Rarity_1.webp',
    '고급': './assets/icons/common_icons/Ingame_ArtifactBase_Rarity_2.webp',
    '희귀': './assets/icons/common_icons/Ingame_ArtifactBase_Rarity_3.webp',
    '전설': './assets/icons/common_icons/Ingame_ArtifactBase_Rarity_4.webp',
};

/* ── 아티팩트 슬롯 카드 ────────────────────────────────────
   **덱 타일(`buildDeckTile`)을 그대로 재사용**하고 아래에 슬롯만 붙인다.
   초상화·이름표·고학년 표지를 새로 짜지 않는다 — 같은 사도가 배치 격자와
   아티팩트 줄에 동시에 나오므로, 두 곳이 다르게 생기면 같은 사도로 안 읽힌다.

   `equip` 이 켜진 덱(`buildDeck`)에서 부른다. 이름은 `Recommend_Deck_Members.artifact`,
   아이콘·등급은 `artifact_DB` 에서 온다 (`ARTIFACTS`).

   `slots` 는 최소 몇 칸을 그릴지다. 적힌 아티팩트가 더 많으면 그만큼 (최대 3). */
/* ── 편성판 (쐐기 보드) ────────────────────────────────
   인게임 편성 화면을 그대로 옮긴다. 좌표는 CLAUDE.md 의 **실측표**를 비율로 환산한 값이고,
   이 상수들을 손으로 고치지 말 것 — 실측표에서 다시 환산한다.

   ⚠ 예전에 **평면 카드**로 쐐기를 만들었다가 되돌린 적이 있다. 그때는 "왜 한 줄만 밀렸지"
     로만 읽혔는데, 지금은 카드가 아니라 **핀**이라 바닥에 꽂힌 것으로 읽힌다.
     카드로 돌아갈 거면 쐐기도 같이 버려야 한다. */
const BOARD = {
    x: { 후열: [23.85, 33.65, 23.56], 중열: [49.04, 58.85, 48.75], 전열: [74.52, 84.42, 74.33] },
    y: [23.33, 49.44, 76.39],          // 상 · 중 · 하
    tile: [15.87, 17.22],              // 발판 폭·높이 (%)
    /* 열 띠의 경계선 — 위에서부터 (바깥, 상, 중, 하, 바깥) */
    edge: [[2.44, 11.18, 20.96, 10.87, 2.02],
           [27.68, 36.44, 46.25, 36.15, 27.31],
           [52.97, 61.78, 71.63, 61.54, 52.69],
           [78.32, 87.19, 97.12, 87.02, 78.17]],
};
const BY = [0, BOARD.y[0], BOARD.y[1], BOARD.y[2], 100];
const COL_ORDER = ['후열', '중열', '전열'];   // ⚠ 왼쪽부터. 적이 오른쪽에 있다

function bandClip(i) {
    const L = BOARD.edge[i], R = BOARD.edge[i + 1];
    const pts = L.map((x, k) => `${x}% ${BY[k]}%`)
        .concat(R.map((x, k) => `${x}% ${BY[k]}%`).reverse());
    return `polygon(${pts.join(',')})`;
}

/* 핀 하나. 얼굴은 **고학년 아이콘**(불투명 정사각이라 원에 꽉 찬다),
   테두리는 역할색, 고정이면 압정이 얹힌다. */
function buildPin(char, info) {
    const role = (char.role || '').trim();
    const fixed = (info.fixed || '').trim();
    /* 어사이드 의존도. 보드에서는 **`필수` 만 그린다** — 아홉 칸에 핀이 빽빽해서
       세 상태를 다 달면 난잡하다. `권장`·`무관` 은 아래 아티팩트 카드와 상세 모달에서 본다.
       ⚠ 빈 값은 당연히 안 그린다 (비었다 = 아직 안 적었다). */
    const aside = (info.aside || '').trim();
    const pin = document.createElement('div');
    pin.className = 'rc-pin' + (fixed ? ' is-fixed' : '');
    pin.dataset.role = role;
    pin.tabIndex = 0;
    pin.setAttribute('role', 'button');
    pin.setAttribute('aria-label', `${char.name} 상세 정보`);
    /* ⚠ 이명(`title`)은 **넣지 않는다.** 핀은 얼굴만 보이는 자리라 말풍선이
       이름을 확인하는 용도인데, 이명까지 붙으면 정작 이름이 눈에 안 들어온다. */
    const move = (info.move || '').trim();
    pin.dataset.tooltip = char.name + (fixed ? `\n고정 — ${fixed}` : '');
    /* 배치 규칙은 **상자를 따로** 세운다 — 이름과 성격이 다른 정보라 한 상자에 섞으면
       둘 다 흘려 읽게 된다 (`tooltip.js` 의 `data-tooltip-2`) */
    if (move) pin.setAttribute('data-tooltip-2', move);
    const open = () => window.openDetailModal(char);
    pin.onclick = open;
    pin.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
    pin.innerHTML = `
        <span class="p-head">
            <img class="p-face" src="./assets/images/${encodeURIComponent(char.name)}.webp"
                 alt="" onerror="this.remove()">
        </span>
        <img class="p-role" src="${iconUrl(role, 'role')}" alt="" onerror="this.remove()">
        ${fixed ? '<img class="p-fix" src="./assets/icons/common_icons/PIN.webp" alt="고정">' : ''}
        ${aside === '필수' ? '<span class="p-aside" data-tooltip="어사이드 필수">A2</span>' : ''}`;
    return pin;
}

/* 덱 편성판 **오른쪽**에 서는 파편 레벨 스트립.
   ⚠ 정보 섹션의 큰 파편 카드를 가져다 쓰지 않는다 — 325:375 라 세로로 길어 편성판
     옆에 세 장을 세우면 보드보다 높아진다. 인게임 아이콘이 **256 정사각**이라
     그걸 그대로 틀에 넣는다.
   ⚠ 틀 색은 보스 기믹 아이콘과 **같은 값**(`--rc-boss-ico-*`)이다. 둘 다 "인게임
     아이콘을 우리 틀에 끼운 것" 이라 같은 꼴이어야 한다.
   ⚠⚠ **스크롤 껍데기(`.rc-board-scroll`) 안에 넣지 말 것.** 최소 폭 460px 을 같이
     물려받아 폰에서 스트립까지 옆으로 밀린다. 형제로 두고 줄(`.rc-board-row`)로 묶는다. */
function buildDeckShards(rows) {
    const el = document.createElement('div');
    el.className = 'rc-deck-shards';
    el.innerHTML = rows.map(r => {
        const art = SHARD_ART.get((r.shard_name || '').trim());
        const lv = Math.max(0, Math.min(8, parseInt(r.level) || 0));
        return `<div class="rc-deck-shard" data-tooltip="${esc(r.shard_name)}&#10;Lv.${lv}">
            ${art ? `<img src="${iconUrl(art, 'dimension')}" alt=""
                          onerror="this.remove()">` : ''}
            <b>Lv.${lv}</b>
        </div>`;
    }).join('');
    return el;
}

function buildBoard(members, pick, freeCount, freeLabel, noGrade, bg, shardRows) {
    /* 보드는 **제 상자 안에** 가둔다. 핀이 발판 위로 한참 솟기 때문에(머리 + 고학년 표지)
       상자 없이 두면 위쪽 덱 제목·설명을 침범하고 분류 테두리까지 닿는다. */
    /* 좁은 화면에서는 상자를 **가로로 밀어** 본다. 보드가 2.9:1 이라 폭을 따라 줄면
       세로까지 같이 줄어드는데, 375px 폰에서 핀이 32px·역할 뱃지가 12px 까지 내려가
       누가 어디 있는지를 못 읽었다. 최소 폭을 지키고 미는 쪽이 낫다 (CSS 가 맡는다). */
    /* ⚠ 보드 아래 글(규칙 줄·상세 설명)은 **스크롤 껍데기 밖**이다. 안에 두면
         최소 폭 460px 을 같이 물려받아 폰에서 글까지 옆으로 밀린다. */
    const zone = document.createElement('div');
    zone.className = 'rc-boardzone';
    const scroll = document.createElement('div');
    scroll.className = 'rc-board-scroll';
    const wrap = document.createElement('div');
    wrap.className = 'rc-board-wrap';
    scroll.appendChild(wrap);
    /* 밀 수 있다는 신호. 좁은 화면에서만 CSS 가 보여준다 — 넓은 화면에서는 안 밀리므로
       띄우면 거짓말이 된다. 스크롤러 안에 `sticky` 로 두어 밀어도 왼쪽에 남는다 */
    scroll.insertAdjacentHTML('beforeend',
        '<span class="rc-board-hint" aria-hidden="true">좌우로 밀어서 전체 보기</span>');
    /* 배경은 **덱마다 고른다** (`board_bg`). 비우면 기본 편성창(`Deck_Bg`).
       ⚠ 배경마다 초점이 다르다 — 자리 잡기는 CSS 의 `[data-bg]` 규칙이 맡는다. */
    if (bg) { wrap.dataset.bg = bg; wrap.style.backgroundImage = `url('./assets/bg/${encodeURIComponent(bg)}.webp')`; }
    /* ⚠ 여백은 **안쪽 칸**이 쥔다. 상자에 직접 `padding: 13%` 를 주면 그 %가
       상자의 제 폭이 아니라 **바깥 컨테이너 폭** 기준으로 풀린다 — 좁은 화면에서
       상자가 `min-width: 460px` 으로 버티는 동안 컨테이너는 300px 이라
       위 여백이 39px 밖에 안 나와 **학사모가 잘렸다.**
       한 겹 안으로 넣으면 %가 상자 폭(460) 기준이 돼 어느 폭에서나 맞는다. */
    const pad = document.createElement('div');
    pad.className = 'rc-board-pad';
    wrap.appendChild(pad);
    const board = document.createElement('div');
    board.className = 'rc-board';
    pad.appendChild(board);
    COL_ORDER.forEach((_, i) => {
        const b = document.createElement('div');
        b.className = 'rc-band';
        b.style.clipPath = bandClip(i);
        board.appendChild(b);
    });

    const at = new Map(members.filter(m => m.col && m.row).map(m => [`${m.col}/${m.row}`, m]));
    COL_ORDER.forEach(c => BOARD.y.forEach((_, ri) => {
        const r = ['상', '중', '하'][ri];
        const m = at.get(`${c}/${r}`);
        const x = BOARD.x[c][ri], y = BOARD.y[ri];

        const pad = document.createElement('div');
        pad.className = 'rc-pad'
            + (m ? ((m.fixed || '').trim() ? ' is-fixed' : ' is-on') : '');
        pad.style.cssText = `left:${x}%;top:${y}%;width:${BOARD.tile[0]}%;height:${BOARD.tile[1]}%`;
        board.appendChild(pad);

        if (!m) return;
        /* 자리가 상대에 따라 바뀌는 사도는 **발 밑에 장판**을 깐다.
           ⚠ 발판 위·핀 아래다 (`z-index: 1`). 핀 위로 올리면 얼굴을 덮는다. */
        let decal = null;
        if ((m.move || '').trim()) {
            const dc = document.createElement('img');
            dc.className = 'rc-decal';
            dc.src = './assets/icons/common_icons/movable.webp';
            dc.alt = '';
            dc.onerror = () => dc.remove();
            dc.style.cssText = `left:${x}%;top:${y}%`;
            board.appendChild(dc);
            decal = dc;
        }
        const ch = isFreeSlot(m.name) ? null : pick(m.name);
        const el = ch ? buildPin(ch, m) : buildFreePin(freeCount, freeLabel);
        /* ⚠ 장판은 핀의 **형제**라 CSS `:hover` 로는 짝을 못 집는다 (`:has` 를 쓰면
             보드 안의 장판이 전부 걸린다). 만든 자리에서 짝지어 손으로 켜고 끈다. */
        if (decal) {
            const on = () => decal.classList.add('is-hot');
            const off = () => decal.classList.remove('is-hot');
            el.addEventListener('mouseenter', on);
            el.addEventListener('mouseleave', off);
            el.addEventListener('focus', on);
            el.addEventListener('blur', off);
        }
        el.style.cssText = `left:${x}%;top:${y}%`;
        if (ch && !noGrade) el.classList.add('has-grade');
        if (ch && !noGrade) el.insertAdjacentHTML('afterbegin', gradeMarkHTML(m));
        board.appendChild(el);
    }));

    /* 자리가 바뀌는 사도는 **글자로도** 낸다.
       ⚠ `tooltip.js` 는 `mouseover`·`focusin` 만 듣는다 — **폰에서는 말풍선이 안 뜬다.**
         핀을 탭하면 상세 모달이 열려 버려서 말풍선이 설 자리도 없다. 이 규칙이 덱의
         핵심인 경우가 있어(줘팸터 카운터 덱) 호버에만 맡기면 모바일에서 통째로 사라진다. */
    /* 보드와 스트립이 한 줄. 스트립이 없으면 줄을 만들지 않는다 (빈 칸이 안 남게) */
    if (shardRows && shardRows.length) {
        const line = document.createElement('div');
        line.className = 'rc-board-row';
        line.appendChild(scroll);
        line.appendChild(buildDeckShards(shardRows));
        zone.appendChild(line);
    } else {
        zone.appendChild(scroll);
    }

    const movers = members.filter(m => (m.move || '').trim() && !isFreeSlot(m.name));
    if (movers.length) {
        const ul = document.createElement('ul');
        ul.className = 'rc-board-moves';
        ul.innerHTML = movers.map(m =>
            `<li><b>${esc(m.name)}</b> ${esc(m.move.trim())}</li>`).join('');
        zone.appendChild(ul);
    }

    /* 사도별 메모는 **접어 둔다.** 보드에서 핀에 띄울 자리가 없어 여태 어디에도
       안 나왔는데(레졸의 배치 4분기가 그랬다), 그렇다고 펼쳐 두면 보드보다 글이 길어진다. */
    const noted = members.filter(m => (m.note || '').trim() && !isFreeSlot(m.name));
    if (noted.length) {
        const wrapN = document.createElement('div');
        wrapN.className = 'rc-board-notes';
        const id = 'bn' + Math.random().toString(36).slice(2, 8);
        wrapN.innerHTML =
            `<button type="button" class="rc-notes-btn" aria-expanded="false" aria-controls="${id}">
                 사도별 배치 메모 <span class="rc-notes-caret" aria-hidden="true">▾</span>
             </button>
             <div class="rc-notes-body" id="${id}" hidden></div>`;
        /* ⚠ **후보 줄(`.rc-alt`)을 그대로 쓴다.** 같은 페이지에서 "사도 + 딸린 설명" 이
             두 가지 꼴로 보이면 안 된다 — 카드도 음각 박스도 저쪽 양식을 빌린다. */
        const bodyN = wrapN.querySelector('.rc-notes-body');
        noted.forEach(m => {
            const ch = pick(m.name);
            if (!ch) return;
            const r = document.createElement('div');
            r.className = 'rc-alt';
            r.appendChild(buildDeckTile(ch));
            const t = document.createElement('div');
            t.className = 'rc-alt-text';
            t.innerHTML = `<span class="rc-alt-note">${
                (m.move || '').trim() ? '<i class="rc-notes-mark" aria-label="자리가 바뀜"></i>' : ''
            }${esc(m.note.trim())}</span>`;
            r.appendChild(t);
            bodyN.appendChild(r);
        });
        const btn = wrapN.querySelector('.rc-notes-btn');
        const body = wrapN.querySelector('.rc-notes-body');
        btn.onclick = () => {
            const on = btn.getAttribute('aria-expanded') === 'true';
            btn.setAttribute('aria-expanded', String(!on));
            body.hidden = on;
        };
        zone.appendChild(wrapN);
    }
    return zone;
}

/* 빈자리 핀 — 누가 설지 정해지지 않은 칸 */
function buildFreePin(count, label) {
    const pin = document.createElement('div');
    pin.className = 'rc-pin is-free';
    pin.dataset.tooltip = (label ? `${label} 사도로 채우는 자리입니다` : '상황에 맞춰 고르는 자리입니다')
        + (count ? `\n후보 ${count}명` : '');
    pin.innerHTML = `<span class="p-head">
            <img class="p-face" src="./assets/icons/common_icons/PVP_HidingIcon.webp" alt="빈자리">
        </span>`;
    return pin;
}

function buildEquipCard(char, info, slots = 3) {
    const card = document.createElement('div');
    card.className = 'rc-equip';

    /* 위쪽은 덱 타일 그대로. 고학년 표지(학사모 + 금지)도 여기서 같이 온다 */
    const tile = buildDeckTile(char, info);
    tile.classList.add('rc-equip-head');
    card.appendChild(tile);

    /* 슬롯은 `^` 꼴 — 위 한 칸, 아래 두 칸.
       ⚠ 한 줄로 늘어놓지 않는 이유: 카드 폭이 타일에 묶여 있어 세 칸을 가로로 넣으면
         칸이 타일 폭의 1/3 로 쪼그라든다. `^` 는 같은 폭에서 칸을 크게 쓴다.
       ⚠⚠ 슬롯은 **이름표(`.card-bottom`) 안**에 넣는다. 흰 띠가 아래로 늘어나
         이름과 슬롯이 한 장으로 묶인다 — 밖에 두면 카드가 두 조각으로 보인다. */
    const list = (info && info.artifacts) || [];
    const n = Math.max(1, Math.min(3, Math.max(slots, list.length)));
    const box = document.createElement('div');
    box.className = 'rc-equip-slots' + (n === 3 ? ' is-caret' : '');
    for (let i = 0; i < n; i++) {
        const nm = list[i];
        const art = nm && nm !== FREE_ART ? ARTIFACTS.get(nm) : null;
        const sl = document.createElement('span');
        sl.className = 'rc-equip-slot' + (art ? '' : ' is-empty');
        if (art) {
            /* 등급 프레임 위에 아이콘을 얹는다 — 인게임과 같은 짜임.
               ⚠ 애착 정보는 **넣지 않는다.** 실제로 거의 안 쓰는 값이라 말풍선만 길어진다. */
            sl.innerHTML =
                `<img class="s-base" src="${GRADE_FRAME[art.grade] || GRADE_FRAME['']}" alt="">
                 <img class="s-icon" src="./assets/icons/artifacts/ArtifactIcon_${esc(art.icon_no)}.webp"
                      alt="" onerror="this.remove()">`;
            sl.dataset.tooltip = `${nm} · ${art.grade}`;
            /* 누르면 아티팩트 상세 모달 — artifact.js 가 window.openArtifactModal 로 연다.
               카드 자체도 눌리는(사도 모달) 자리라 전파를 끊는다 */
            /* ⚠ 핸들러는 아래 문서 위임으로 단다 — 슬라이드 복제본(cloneNode)은 onclick 을 못 물려받는다 */
            sl.classList.add('is-link'); sl.tabIndex = 0; sl.setAttribute('role', 'button'); sl.dataset.art = nm;
        } else if (nm === FREE_ART) {
            /* `자유` — **아무거나 껴도 되는 칸**이다. 빈 칸과 눈으로 갈라야 한다.
               비워 두면 "아직 안 적었나" 로 읽힌다 (어사이드 `무관` 과 같은 이유).
               표시는 덱 빈자리가 쓰는 `PVP_HidingIcon` 을 그대로 쓴다 — 같은 뜻, 같은 그림. */
            sl.innerHTML =
                `<img class="s-base" src="${GRADE_FRAME['']}" alt="">
                 <img class="s-free" src="./assets/icons/common_icons/PVP_HidingIcon.webp" alt="자유">`;
            sl.dataset.tooltip = '아무 아티팩트나 괜찮습니다';
        } else if (nm) {
            /* ⚠ 표에 없는 이름을 **조용히 비우지 않는다.** 오타를 못 잡는다.
               `?` 는 위의 `자유` 가 쓰므로 여기는 `!` 다 — 이쪽은 오류다. */
            sl.classList.add('is-unknown');
            sl.textContent = '!';
            sl.dataset.tooltip = `artifact_DB 에 없는 이름 — ${nm}`;
        } else {
            sl.innerHTML = `<img class="s-base" src="${GRADE_FRAME['']}" alt="">`;
            sl.dataset.tooltip = '아직 안 적었습니다';
        }
        box.appendChild(sl);
    }
    (tile.querySelector('.card-bottom') || card).appendChild(box);
    return card;
}

/* `swaps` 는 `원픽>대체` 쌍을 쉼표로 늘어놓는다. 같은 원픽이 여러 번 나오면 한 줄로 묶는다.
   ⚠ 중첩 구분자(`A>B;C|D>E`)를 쓰지 않는다 — 쉼표 리스트는 이 프로젝트의 관례이고,
     중첩을 넣는 순간 손으로 못 읽는 데이터가 된다. */
/* 후보는 이제 `Recommend_Deck_Swaps.csv` 의 **행 하나가 후보 하나**다.
   예전엔 `swaps` 한 셀에 이름·대상·메모를 쑤셔 넣어 쉼표로 갈랐는데, 그 탓에
   **메모에 쉼표를 못 쓰는** 규칙이 생겼고 셀이 770자까지 자랐다.
   ⚠ `from` 이 비었거나 `?` 면 빈자리 후보, 이름이면 그 사도 대신이다. */
function groupSwaps(rows, deckKey) {
    const out = new Map();
    (rows || []).forEach(r => {
        if ((r.deck_key || '').trim() !== deckKey) return;
        const name = (r.chara_name || '').trim();
        if (!name) return;
        let from = (r.from || '').trim();
        if (!from || isFreeSlot(from)) from = '?';
        if (!out.has(from)) out.set(from, []);
        out.get(from).push({ name, note: (r.note || '').trim() });
    });
    return out;
}

/* 편성도 `Recommend_Deck_Members.csv` 의 **행 하나가 사도 하나**다.
   ⚠ 예전엔 `members` 한 셀의 쉼표 리스트였다. 거기에 좌표와 고학년 플래그를
     **나란한 리스트로** 더하면 `buff_DB` 의 슬롯 정렬 함정이 그대로 재현된다 —
     하나만 어긋나면 화면에서 조용히 사라지고 경고도 안 난다. */
function groupMembers(rows, deckKey) {
    return (rows || [])
        .filter(r => (r.deck_key || '').trim() === deckKey)
        .map(r => ({
            name:  (r.chara_name || '').trim(),
            col:   (r.col || '').trim(),
            row:   (r.row || '').trim(),
            seal:  (r.high_skill || '').trim(),   // 값이 있으면 고학년 봉인 + 그 사유
            aside: (r.aside || '').trim(),        // 필수 · 권장 · 무관 (비면 안 그림)
            /* 비면 자유, 값이 있으면 **그 자리에 고정**이고 그 값이 곧 사유다
               (`high_skill` 과 같은 관례 — 사유가 있어야 "왜 못 옮기지" 가 안 생긴다) */
            fixed: (r.fixed || '').trim(),
            /* 자리가 상대에 따라 바뀌는 사도. 값이 곧 그 규칙이다 */
            move: (r.move || '').trim(),
            /* 쉼표로 여러 개. ⚠ 다른 열과 **짝지어 세지 않는다** — 이름만 늘어놓을 뿐이라
               `buff_DB` 의 슬롯 정렬 함정이 생기지 않는다. 사유를 적고 싶어지면 행으로 풀 것. */
            artifacts: (r.artifact || '').split(',').map(v => v.trim()).filter(Boolean),
            note:  (r.note || '').trim(),
        }))
        .filter(m => m.name);
}

function buildDeck(deck, dbMap, missing, flat, swapRows, memberRows) {
    const box = document.createElement('article');
    box.className = 'rc-deck';
    /* 상자 바탕을 성격색으로 물들인다 (심해 대격돌의 성격별 해역).
       ⚠ 색은 `.group-title[data-personality]` 과 **같은 파스텔**을 쓴다 — 새로 정하지 않는다.
       ⚠ 안쪽 타일·음각 칸은 흰색 그대로 둔다. 바탕끼리 색이 갈리면 상자가 쪼개져 보인다. */
    const pers = (deck.personality || '').trim();
    if (pers) box.dataset.personality = pers;
    /* `high_auto` — 고학년이 **자동으로 터지는** 콘텐츠면 학사모를 아예 안 그린다.
       줘팸터가 그렇다: 유저가 쓸지 고르는 버튼이 없으므로 "봉인" 이라는 선택지 자체가 없다.
       ⚠ 분류(`sec_key`)가 아니라 **덱**에 둔 까닭 — 같은 분류 안에 성질이 다른 덱이
         생길 수 있고, 무엇보다 이건 콘텐츠의 규칙이라 코드에 박으면 덱이 늘 때마다 고쳐야 한다. */
    const autoHigh = !!(deck.high_auto || '').trim();
    const freeLabel = (deck.free_label || '').trim();
    const sub = (deck.deck_sub || '').trim();
    const deckKey = (deck.deck_key || '').trim();
    const swaps = groupSwaps(swapRows, deckKey);
    const members = groupMembers(memberRows, deckKey);

    /* 읽는 순서 = **이 조합이 뭔지 → 구성 → 빈자리 후보.** 설명을 오른쪽 칸에 세웠던 적이
       있는데, 그건 타일이 남는 폭을 못 먹어 오른쪽이 비던 시절의 처방이었다. 타일이
       늘어나게 고친 뒤로는 그 칸이 할 일이 없어졌고, 눈만 오른쪽 끝으로 튀게 했다.
       ⚠ 세로 구분선도 같이 걷어냈다 — 덱이 여러 개 쌓이면 짧은 글 옆에 빈 기둥이 반복된다. */
    box.innerHTML = `
        <header class="rc-deck-head">
            <h4 class="rc-deck-name">${esc((deck.deck_name || '').trim() || '이름 없는 덱')}</h4>
            ${sub ? `<p class="rc-deck-sub">${linkify(sub)}</p>` : ''}
        </header>
        <div class="rc-deck-tiles"></div>
        <section class="rc-deck-block is-equip" hidden>
            <h5 class="rc-deck-eyebrow">아티팩트</h5>
            <div class="rc-equip-row"></div>
        </section>
        <section class="rc-deck-block is-swaps" hidden>
            <h5 class="rc-deck-eyebrow"></h5>
            <div class="rc-deck-swapwrap"></div>
        </section>`;

    const tiles = box.querySelector('.rc-deck-tiles');
    const pick = n => {
        const ch = dbMap.get(String(n || '').trim());
        if (!ch) { if (String(n || '').trim()) missing.push(n); return null; }
        flat.push(ch);
        return ch;
    };

    /* 후보를 **먼저 풀어둔다.** 빈자리 타일의 `후보 N명` 은 실제로 그려질 줄 수여야 한다 —
       ⚠ CSV 에 적힌 개수를 그대로 세면 이름에 오타가 있을 때 숫자와 줄 수가 어긋난다
         (그 줄은 못 그리는데 숫자만 남는다). */
    const resolved = new Map();
    swaps.forEach((list, from) => {
        resolved.set(from, list.map(({ name, note }) => {
            const ch = pick(name);
            return ch ? { ch, note } : null;
        }).filter(Boolean));
    });
    const freeCount = (resolved.get('?') || []).length;
    const hasFree = members.some(m => isFreeSlot(m.name));

    /* 좌표(`col`·`row`)가 **하나라도** 있으면 인게임과 같은 3×3 쐐기 격자로 그린다.
       전부 비어 있으면 지금까지처럼 한 줄이다 — 공명 덱처럼 "실제 편성이 아니라
       안내" 인 상자는 좌표가 없는 게 맞다. */
    const COLS = ['후열', '중열', '전열'];   // ⚠ 왼쪽부터. 적이 오른쪽에 있다
    const ROWS = ['상', '중', '하'];
    const placed = members.some(m => m.col && m.row);
    if (placed) tiles.classList.add('is-grid');

    const put = m => {
        if (isFreeSlot(m.name)) {
            return buildFreeTile(freeCount, freeLabel,
                freeLabel ? `${freeLabel} 사도로 채우는 자리입니다` : null);
        }
        const ch = pick(m.name);
        if (!ch) return null;
        const tile = buildDeckTile(ch, m, autoHigh);
        if (m.note) tile.dataset.tooltip = `${ch.name} — ${m.note}`;
        return tile;
    };

    if (placed) {
        /* 좌표가 있으면 **인게임 편성판**을 그린다 (쐐기 보드 + 핀).
           ⚠ 사도 카드가 아니라 핀이다 — 바닥에 꽂히는 꼴이라야 쐐기가 원근으로 읽힌다. */
        tiles.classList.remove('is-grid');
        tiles.appendChild(buildBoard(members, pick, freeCount, freeLabel, autoHigh,
                                     (deck.board_bg || '').trim(),
                                     DECK_SHARDS.get(deckKey) || []));
        /* 좌표가 없는 멤버는 격자에 못 놓는다 — 아래에 따로 붙여 잃어버리지 않게 한다 */
        members.filter(m => !(m.col && m.row)).forEach(m => {
            const t = put(m);
            if (t) { t.classList.add('is-unplaced'); tiles.appendChild(t); }
        });
    } else {
        members.forEach(m => {
            const t = put(m);
            if (t) tiles.appendChild(t);
        });
    }

    /* 후보 한 줄 = [타일][이름][언제 쓰는지].
       ⚠ 얼굴만 늘어놓으면 "뭘 보고 고르라는 건지" 가 빠진다 — 고르는 기준이 핵심이다. */
    const wrap = box.querySelector('.rc-deck-swapwrap');
    const row = (ch, note) => {
        const r = document.createElement('div');
        r.className = 'rc-alt';
        r.appendChild(buildDeckTile(ch));
        /* 이름은 **타일 이름표**가 말한다 — 여기선 '언제 쓰는지' 만 남긴다.
           ⚠ 메모가 없으면 박스를 아예 안 그린다. 빈 음각 홈만 남으면 뭔가 빠진 것처럼 보인다 */
        if (note) {
            const t = document.createElement('div');
            t.className = 'rc-alt-text';
            t.innerHTML = `<span class="rc-alt-note">${esc(note)}</span>`;
            r.appendChild(t);
        }
        return r;
    };
    let label = '';
    resolved.forEach((list, from) => {
        if (!list.length) return;
        if (from === '?') {
            /* 같은 `?` 라도 뜻이 둘이다 — 편성에 빈자리가 있으면 "그 자리의 후보",
               6칸을 다 채웠으면 "미보유/미육성이면 이걸로 바꿔라" 는 대체픽이다.
               ⚠ 빈자리가 없는데 `빈자리 후보` 라고 쓰면 읽는 사람이 빈칸을 찾는다. */
            label = label || (hasFree ? '빈자리 후보' : '대체 후보');
            list.forEach(({ ch, note }) => wrap.appendChild(row(ch, note)));
        } else {
            const chFrom = dbMap.get(from);
            if (!chFrom) return;
            label = label || '대체픽';
            list.forEach(({ ch, note }) => wrap.appendChild(row(ch, note || `${chFrom.name} 대신`)));
        }
    });
    if (wrap.children.length) {
        box.querySelector('.is-swaps').hidden = false;
        box.querySelector('.is-swaps .rc-deck-eyebrow').textContent = label;
    }

    /* 아티팩트 줄 — **편성에 들어간 사도만**. 후보는 아티팩트를 달 자리가 아니다.
       ⚠ 빈자리(`?`)도 뺀다. 누가 설지 모르는 칸에 아티팩트 슬롯은 뜻이 없다.

       **역할로 묶는다** — 같은 역할이면 받는 아티팩트 유형이 비슷해서, 묶어 두면
       "이 묶음엔 이런 걸 준다" 가 한 번에 읽힌다. 묶음 순서는 `ROLE_ORDER`. */
    /* `equip` — 아티팩트 줄을 그릴지. **덱마다 따로**다.
       값을 넣은 덱에서만 보이므로, 비워 두면 화면에 아무 영향이 없다. */
    if ((deck.equip || '').trim()) {
        const erow = box.querySelector('.rc-equip-row');
        const byRole = new Map();
        members.forEach(m => {
            if (isFreeSlot(m.name)) return;
            const ch = dbMap.get(m.name);
            if (!ch) return;
            const role = (ch.role || '기타').trim();
            if (!byRole.has(role)) byRole.set(role, []);
            byRole.get(role).push([ch, m]);
        });
        const order = [...byRole.keys()].sort((a, b) => {
            const ia = ROLE_ORDER.indexOf(a), ib = ROLE_ORDER.indexOf(b);
            return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
        });
        order.forEach(role => {
            const g = document.createElement('section');
            g.className = 'rc-equip-group';
            g.dataset.role = role;
            /* 탭은 **박스 바깥 위**에 붙는다 — 안으로 파고들면 첫 아티팩트 카드와 싸운다.
               아래 2px 만 박스를 물어 "붙어 있다" 를 만든다 (떼면 떠 보인다). */
            g.innerHTML = `<span class="rc-equip-tab">
                    <img src="${iconUrl(role, 'role')}" alt="" onerror="this.remove()">
                    ${esc(role)}
                </span><div class="rc-equip-cards"></div>`;
            const wrap = g.querySelector('.rc-equip-cards');
            byRole.get(role).forEach(([ch, m]) => wrap.appendChild(buildEquipCard(ch, m)));
            erow.appendChild(g);
        });
        if (erow.children.length) box.querySelector('.is-equip').hidden = false;
    }
    return box;
}

/* ══ 대충돌 2.0 · 보스 전용 상태 (`Crash2_Boss_Skills.csv` 의 `kind=state` 행) ══
     sec_key, kind, order, name, icon, icon2, desc

   ⚠⚠ **`buff_desc_DB`/`debuff_desc_DB` 에 섞지 않는다.** 모양은 같지만 그 둘은
     *사도가 거는* 상태의 마스터이고, 부가 효과 필터가 그 목록을 그대로 선택지로 낸다 —
     `앵그리` 를 넣으면 "앵그리를 거는 사도" 를 고르는 칸이 생긴다. 거는 건 보스다.
   ⚠ `icon2` 는 상태 아이콘 **옆에 나란히** 세울 둘째 그림이다 (보스가 걸었다는 표지).
     인게임은 겹쳐 놓지만 작게 겹치면 어느 쪽이 본체인지 안 읽혀 `/` 로 가른다.
   ⚠ `desc` 가 **비면 말풍선을 안 단다.** 대신 본문 글줄에 아이콘이 붙는다 —
     `기절 카운트` 처럼 세는 물건은 "무엇인가" 를 설명할 게 없고 모양만 보이면 된다. */
const BOSS_STATES = new Map();

/* 파편 이름 → 그림 (`Crash2_Shards` 에서 뽑는다). 덱 옆 스트립이 이것만 쓴다 */
const SHARD_ART = new Map();
/* `Crash2_Deck_Shards.csv` — deck_key, shard_name, level.
   ⚠⚠ **`Recommend_Decks` 에 `3,0,6` 식 쉼표 열로 넣지 않는다.** 그러면 `Crash2_Shards`
     의 **행 순서와 위치로 짝지어지는데**, 파편을 하나 더하거나 순서를 바꾸면 레벨이
     통째로 한 칸씩 밀린다. 경고도 안 난다 — `buff_DB` 의 슬롯 정렬 함정 그대로다.
   ⚠ 이름으로 잇는다 (`artifact` 열과 같은 관례). 파편 이름이 `되XX 수 X어` 처럼
     깨져 보여도 **인게임 이름이 그렇다** — 고치지 말 것. */
const DECK_SHARDS = new Map();

/* 설명문 표기 → 태그.
     [[용어]]  보스 고유 용어 — 상태 표에 있으면 아이콘·말풍선이 따라온다
     ((용어))  **사도가 거는 CC** — 편성에 반영할 것

   ⚠ 둘을 한 표시로 묶지 않는다. 읽는 사람이 찾는 건 "내가 무엇을 넣어야 하나" 이고
     그건 CC 쪽뿐이다. 밑줄 친 것만 세면 "기절 둘" 이 바로 잡힌다.
   ⚠ 본문 글줄에는 **글자만** 둔다. 읽는 글 사이에 그림이 섞이면 글이 끊긴다 —
     그림은 "이게 무엇인가" 를 보여주는 말풍선 쪽 일이다 (`data-tooltip-icon`).
   ⚠ 표에 없는 용어(스킬 이름 상호참조)는 색만 입히고 넘어간다 — 설명을 지어내지 않는다. */
function bossMark(text) {
    return esc(text)
        .replace(/\[\[(.+?)\]\]/g, (_, n) => {
            const st = BOSS_STATES.get(n);
            if (!st) return `<em>${n}</em>`;
            if (!st.desc) {
                return `<em>${n}<span class="rc-crash2-sico"><img
                            src="${iconUrl(st.icon, 'dimension')}" alt=""
                            onerror="this.parentNode.remove()"></span></em>`;
            }
            const ics = [iconUrl(st.icon, 'dimension')]
                .concat(st.with ? [iconUrl(st.with, 'dimension')] : []).join(', ');
            return `<em data-tooltip="${esc(n)}&#10;${esc(st.desc)}"
                        data-tooltip-icon="${ics}" tabindex="0">${n}</em>`;
        })
        .replace(/\(\((.+?)\)\)/g, '<em class="cc">$1</em>');
}

/* ══ 대충돌 2.0 · 정보 섹션 (`buildCrash2Panel`) ═══════════════════
   보스 기믹 · 시즌 규칙 · 이면의 파편 · 메타를 **한 상자**로 묶는다. 분류의 맨 위,
   덱보다 먼저 온다 — "누구와 어떤 규칙으로 싸우는가" 가 "무엇을 데려가는가" 보다 앞이다.

       ┌ 흑화 영춘 — 광기 ┐              ← 제목 알약 (상자 위에 걸친 탭)
       ┌────────┬──────────────────┐
       │ 초상화  │ 시즌 소개 / 기믹 수행 / 메타 │   ← 머리
       └────────┴──────────────────┘
       ── 보스 기믹 ───────────   ← 행마다 같은 무게의 머리글
         [카드] [카드] [카드]
       ┌ 시즌 규칙 (흰 카드) ──┐
       └──────────────────┘
       ── 이면의 파편 ─────────   (어두운 상자)
         [파편] [파편] [파편]

   ⚠⚠ **2단으로 나란히 놓지 않는다.** 한 번 기믹 ↔ 규칙·파편을 좌우로 놨다가 되돌렸다 —
     파편 카드는 그림 비율(325:375)이 높이의 바닥을 깔고 기믹 카드는 글 길이만큼만
     자라, 두 단의 자연 높이가 두 배쯤 벌어져 한쪽 아래가 길게 빈다.
     세로로 쌓으면 뒤엣것이 하위 항목처럼 읽히는데, **가르는 건 자리가 아니라 라벨**이다.
   ⚠ 어느 한 덩이가 없어도 그려진다 — 보스만, 파편만 있는 분류가 있을 수 있다. */
function buildCrash2Panel(sec) {
    const wrap = document.createElement('section');
    wrap.className = 'rc-crash2-wrap';
    const boss = sec.boss;

    /* ── 제목 탭 ─────────────────────────────────────────────
       ⚠ 상자 **바깥 위**에 두고 아래만 살짝 문다 (아티팩트 묶음의 포스트잇 탭과 같은 꼴).
         안에 넣으면 머리의 초상화·서술과 한 덩어리로 보여 "무엇의 제목인가" 가 흐려진다. */
    if (boss) {
        const t = document.createElement('div');
        t.className = 'rc-crash2-title';
        /* `대충돌 2.0 베타 시즌 9 — 흑화 영춘 (광기)`.
           ⚠ `season` 은 숫자가 아니라 **자유 문구**다 (`베타 시즌 9`). 시즌 표기가
             콘텐츠마다 다르고 베타 꼬리표도 언젠가 떨어지므로 코드에 틀을 박지 않는다. */
        const season = (boss.season || '').trim();
        t.innerHTML = `<img src="./assets/icons/boss/CommonIcon_MonsterWorldBoss_YC00_Mad.webp"
                            alt="" onerror="this.remove()"
                       ><b>대충돌 2.0${season ? ' ' + esc(season) : ''} — ${esc(boss.boss_name)}${
                            boss.personality ? ` (${esc(boss.personality)})` : ''}</b>`;
        wrap.appendChild(t);
    }

    const box = document.createElement('div');
    box.className = 'rc-crash2';
    if (boss && boss.personality) box.dataset.personality = boss.personality;
    wrap.appendChild(box);

    /* ── 머리 — 초상화 + 서술 줄들 ───────────────────────────
       ⚠ 서술은 `Crash2_Lines.csv` 의 `kind=note` 행 하나가 **줄 하나**다. `label` 이 있으면
         앞에 굵게 붙고 없으면 글만 나온다 — 시즌 소개처럼 이름 붙일 게 없는 줄이 있다. */
    if (boss || sec.notes.length) {
        const head = document.createElement('div');
        head.className = 'rc-crash2-head';
        head.innerHTML = `
            ${boss && boss.portrait ? `<div class="rc-boss-portrait">
                <img src="${iconUrl(boss.portrait, 'dimension')}" alt=""
                     onerror="this.remove()"></div>` : ''}
            <div class="rc-crash2-notes">${sec.notes.map(n => `
                <p>${(n.label || '').trim()
                    ? `<b>${esc(n.label.trim())}</b>` : ''}${bossMark(n.text || '')}</p>`).join('')}
            </div>`;
        box.appendChild(head);
    }

    /* ── 세 행 — 기믹 · 시즌 규칙 · 이면의 파편 ─────────────
       ⚠⚠ **2단으로 나란히 놓지 않는다.** 파편 카드는 그림 비율(325:375)이 높이의 바닥을
         깔지만 기믹 카드는 글 길이만큼만 자란다 — 두 단의 자연 높이가 두 배쯤 벌어져
         한쪽 아래가 길게 빈다. 조정으로 못 메운다 (인게임 문구라 글 길이가 정해져 있다).
         폭을 반씩 나누는 탓에 기믹 글이 서너 단어마다 끊기는 손해도 있었다.
       ⚠ 대신 **세 행에 같은 무게의 머리**를 단다. 세로로 쌓으면 뒤엣것이 앞엣것의 하위
         항목처럼 읽히는데, 가르는 건 자리가 아니라 라벨이다 (후보 칸 머리글과 같은 꼴). */
    const row = (label, kind) => {
        const r = document.createElement('div');
        r.className = 'rc-crash2-row' + (kind ? ' ' + kind : '');
        if (label) r.innerHTML = `<div class="rc-crash2-rowhead"><b>${label}</b></div>`;
        box.appendChild(r);
        return r;
    };

    if (sec.bossSkills.length) {
        row('보스 기믹').insertAdjacentHTML('beforeend',
            `<div class="rc-boss-skills">${sec.bossSkills.map(bossSkillCard).join('')}</div>`);
    }
    /* ⚠ 시즌 규칙 행은 **머리 라벨을 안 단다.** 인게임 블롭 그림에 이미 `시즌 규칙` 이
         적혀 있어, 라벨까지 붙이면 같은 말이 두 번이다. 그림이 곧 이 행의 머리다. */
    if (sec.rules.length) row('', 'is-card').appendChild(buildRuleBox(sec.rules));
    if (sec.shards.length) {
        const r = row('이면의 파편', 'is-dim');
        const line = document.createElement('div');
        line.className = 'rc-shards';
        sec.shards.forEach(sh => line.appendChild(buildShard(sh)));
        r.appendChild(line);
    }

    return wrap;
}

/* 기믹 카드 한 장. 꼬리 줄은 그 본문이 실제로 가리킨 상태 중 **설명이 있는 것**만 낸다. */
function bossSkillCard(s) {
    const seen = [];
    ((s.desc || '').match(/\[\[(.+?)\]\]/g) || []).forEach(m => {
        const n = m.slice(2, -2), st = BOSS_STATES.get(n);
        if (st && st.desc && !seen.includes(n)) seen.push(n);
    });
    const gl = seen.map(n => `<i><b>${esc(n)}</b> — ${esc(BOSS_STATES.get(n).desc)}</i>`).join('');
    return `<div class="rc-boss-skill">
        <span class="rc-boss-ico"><img src="${iconUrl(s.icon, 'dimension')}"
              alt="" onerror="this.parentNode.remove()"></span>
        <b>${esc(s.name)}</b>
        <p>${bossMark(s.desc || '')}</p>
        ${gl ? `<div class="rc-boss-gloss">${gl}</div>` : ''}
    </div>`;
}

/* 시즌 규칙 상자. 인게임은 메인 로비의 **블롭 버튼**을 누르면 팝업으로 보여준다 —
   여기서는 누를 데가 없으니 그 버튼 그림을 상자 머리로 쓰고 내용을 바로 편다. */
function buildRuleBox(rules) {
    const box = document.createElement('div');
    box.className = 'rc-rulebox';
    box.innerHTML = `
        <div class="rc-rule-head">
            <img src="${iconUrl('DimensionalClash_MainLobby_SeasonRule_BG', 'dimension')}"
                 alt="" onerror="this.remove()">
            <b>시즌 규칙</b>
        </div>
        <div class="rc-rule-list">${rules.map(r => `
            <div class="rc-rule">
                <img src="${iconUrl((r.kind || '').trim() === 'rule_neg'
                                    ? 'SeasonRuleIcon_Negative' : 'SeasonRuleIcon_Positive',
                                    'dimension')}" alt="" onerror="this.remove()">
                <span>${esc(r.text)}</span>
            </div>`).join('')}</div>`;
    return box;
}


/* 레벨 → 테두리 색. 인게임에서 뽑은 값이다. */
const SHARD_TIERS = [
    { max: 0, col: '#868C94' }, { max: 2, col: '#FFF5EE' },
    { max: 4, col: '#D1B48C' }, { max: 6, col: '#FF8E61' }, { max: 8, col: '#FF6245' },
];
const shardColor = lv => (SHARD_TIERS.find(t => lv <= t.max) || SHARD_TIERS[4]).col;
/* 레벨이 오를수록 글로우를 세게 — 인게임도 7–8 에서 확 밝아진다 */
const shardGlow = lv => (0.25 + lv * 0.09).toFixed(2);

const shardFill = (tpl, vals) => String(tpl).replace(/\{(\d+)\}/g, (_, i) => vals[+i] ?? '?');

function buildShard(s) {
    const el = document.createElement('div');
    el.className = 'rc-shard';
    const lv = Math.max(0, Math.min(8, parseInt(s.rec_level) || 0));
    /* ⚠ Lv.0 은 아직 안 얻은 상태지만 인게임이 **Lv.1 수치를 미리 보여준다** —
         그래서 0 과 1 이 같은 줄을 쓴다. */
    const vals = String(s['Lv.' + Math.max(lv, 1)] || '').split(',').map(v => v.trim());

    el.style.setProperty('--col', shardColor(lv));
    el.style.setProperty('--glow', shardGlow(lv));
    el.innerHTML = `
        <div class="rc-shard-card">
            <div class="rc-shard-glow"></div>
            <div class="rc-shard-art"></div>
            <div class="rc-shard-border"></div>
            <i class="rc-shard-deco d1"></i><i class="rc-shard-deco d2"></i>
            <i class="rc-shard-deco d3"></i><i class="rc-shard-deco d4"></i>
            <span class="rc-shard-lv">Lv.${lv}</span>
        </div>
        <div class="rc-shard-title">
            <img src="${iconUrl('Dimension_BuffSlot_TitleDeco_01', 'dimension')}"
                 alt="" onerror="this.remove()">
            <b>${esc(s.shard_name)}</b>
            <img class="t2" src="${iconUrl('Dimension_BuffSlot_TitleDeco_02', 'dimension')}"
                 alt="" onerror="this.remove()">
        </div>
        <div class="rc-shard-fx">${esc(shardFill(s.effect || '', vals))}${
            (s.sub || '').trim()
                ? `<span class="rc-shard-sub">${shardFill(s.sub, vals).split(' · ')
                      .map(t => `<i>${esc(t)}</i>`).join('')}</span>`
                : ''}</div>`;

    const art = el.querySelector('.rc-shard-art');
    art.style.setProperty('--art', `url('${iconUrl(s.art, 'dimension')}')`);
    if ((s.art_pos || '').trim()) art.style.setProperty('--art-pos', s.art_pos.trim());
    return el;
}

function buildSection(sec, dbMap, missing, flat, swapRows, memberRows) {
    const sEl = document.createElement('section');
    sEl.className = 'rc-sec';
    /* 폰에서는 **접힌 채로 시작한다.** 1열이라 분류가 세로로 줄줄이 이어지는데
       전부 펼쳐져 있으면 무슨 분류들이 있는지가 한 화면에 안 들어온다 —
       머리(제목 + `sec_tip`)만 남겨 목차처럼 읽히게 한다.
       ⚠ **처음 그릴 때만** 본다. 창을 줄였다고 사용자가 펼쳐 둔 걸 도로 접지 않는다. */
    if (RC_NARROW.matches) sEl.classList.add('is-folded');
    /* 지난 시즌·끝난 이벤트 — 색만 빼고 글은 그대로 둔다 (`sec_stale`). */
    if (sec.stale) sEl.classList.add('is-stale');

    /* ⚠ 소분류 설명을 툴팁에 숨기지 않는다. 이 페이지에서 가장 자주 읽힐 문장이다. */
    sEl.innerHTML = `
        <header class="rc-sec-head">
            <h3 class="rc-sec-title" role="button" tabindex="0"
                aria-expanded="${sEl.classList.contains('is-folded') ? 'false' : 'true'}">${sec.icon
                ? `<img class="rc-sec-icon" src="${iconUrl(sec.icon, 'content')}"
                       alt="" onerror="this.remove()">` : ''}${esc(sec.label)}
                <svg class="rc-fold" viewBox="0 0 24 24" width="20" height="20" fill="none"
                     stroke="currentColor" stroke-width="2.6" stroke-linecap="round"
                     stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></h3>
            ${sec.stale ? `<p class="rc-sec-stale">${esc(sec.stale)}</p>` : ''}
            ${sec.tip ? `<p class="rc-sec-tip">${linkify(sec.tip)}</p>` : ''}
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

    /* 대충돌 2.0 정보 섹션은 덱보다 **먼저** 온다 —
       "누구와 어떤 규칙으로 싸우는가" 가 "무엇을 데려가는가" 보다 앞이다. */
    if (sec.boss || sec.rules.length || sec.shards.length || sec.notes.length)
        body.appendChild(buildCrash2Panel(sec));

    /* 덱이 있으면 역할 묶음보다 **먼저** 그린다. */
    if (sec.decks && sec.decks.length) {
        const dWrap = document.createElement('div');
        dWrap.className = 'rc-decks';
        sec.decks.forEach(d => dWrap.appendChild(buildDeck(d, dbMap, missing, flat, swapRows, memberRows)));
        body.appendChild(dWrap);
    }

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
function layoutSlides(panel, instant) {
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
    /* ⚠ 트랙에는 양끝 복제본이 있어 **칸 번호가 분류 번호와 다르다.**
         복제본이 있으면 분류 k 는 칸 k+1 이다. `_via` 는 복제본을 거쳐 가는 중이라는 표시. */
    const off = track.firstElementChild?.dataset.clone !== undefined ? 1 : 0;
    const i = panel._via != null ? panel._via
            : Math.min((panel._slide || 0) + off, secs.length - 1);
    const W = stage.clientWidth;
    /* ⚠ 폭이 0 이면(아직 안 보이는 패널) 계산하지 않는다. 0 으로 재면 슬라이드 폭이 0 이 되고
         마스크가 화면 전체를 지워버린다. */
    if (!W) return;
    /* 하나뿐이면 꽉 채운다. 여럿이면 양옆이 조금 비치게 좁힌다 */
    const sw = secs.length > 1 ? Math.round(W * (W < 720 ? 0.86 : 0.8)) : W;
    const gap = 16;
    stage.style.setProperty('--rc-slide-w', sw + 'px');
    if (instant) { track.style.transition = 'none'; void track.offsetWidth; }
    track.style.transform = 'translateX(' + Math.round((W - sw) / 2 - i * (sw + gap)) + 'px)';
    if (instant) { void track.offsetWidth; track.style.transition = ''; }
    secs.forEach((el, k) => el.classList.toggle('is-away', k !== i));
    stage.style.height = secs[i].offsetHeight + 'px';
}

function showSlide(panel, i, push) {
    const n = (panel._secKeys || []).length;
    if (!n) return;
    /* 범위를 벗어나면 **복제본까지 미끄러진 뒤** 반대쪽 진짜 자리로 갈아탄다.
       `_via` 는 그 '거쳐 가는 칸' 번호다 (0 = 복제된 마지막, n+1 = 복제된 처음). */
    const looped = n > 1;
    let via = null;
    if (looped && i < 0) { via = 0; i = n - 1; }
    else if (looped && i >= n) { via = n + 1; i = 0; }
    panel._slide = Math.max(0, Math.min(i, n - 1));
    panel._via = via;

    clearTimeout(panel._snap);
    if (via != null) {
        /* 전환이 끝날 즈음 소리 없이 진짜 자리로. 전환 시간(.35s)보다 아주 조금 뒤 */
        panel._snap = setTimeout(() => { panel._via = null; layoutSlides(panel, true); }, 380);
    }
    /* ⚠ 분류 줄은 **패널 밖**(상자 안)에 있다. `panel.querySelectorAll` 로는 못 찾는다 —
         그래서 한동안 `.on` 표시와 화살표 비활성이 조용히 안 걸렸다. */
    const sub = panel._sub || panel;
    sub.querySelectorAll('.rc-subtab').forEach((b, k) => {
        const on = k === panel._slide;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    placeInd(panel);
    /* 이어져 있으니 화살표는 끝에서도 죽지 않는다 (분류가 하나일 때만 끈다) */
    sub.querySelectorAll('.rc-arrow').forEach(b => { b.disabled = n < 2; });
    layoutSlides(panel);
    if (push) writeHash(panel);
}

/* 고른 분류 위로 알약을 옮긴다.
   ⚠ 좁은 화면에서는 분류 버튼이 **여러 줄로 접힌다.** 가로만 옮기면 알약이 엉뚱한 줄에
     남으므로 `offsetTop` 까지 같이 본다.
   ⚠ `offsetLeft` 는 트레이의 **안쪽(padding box) 기준**이고 알약도 `top/left: 0` 으로
     같은 자리에서 출발한다. 테두리 두께를 빼면 오히려 1px 어긋난다 (한 번 그랬다).
   ⚠ 안 보이는 동안에는 폭이 0 이다 — 그때 재면 알약이 왼쪽 위로 쭈그러든다. 건너뛴다. */
/* 트레이가 한 줄을 넘치면 **끝쪽을 흐리게** 해서 더 있다는 걸 알린다.
   ⚠ 넘치지 않을 때 흐리게 하면 멀쩡한 첫·마지막 버튼이 잘려 보인다. 그래서 넘칠 때만,
     그리고 **아직 남은 쪽만** 흐리게 한다 (끝에 닿으면 그쪽은 도로 선명해진다).
   ⚠ 흐리게 하는 건 `mask` 다. 배경에 기대지 않으므로 따라다닐 때 유리로 바뀌어도 맞는다
     — 트레이는 `is-stuck` 에서 제 배경을 버린다. */
function fadeEdges(tabs) {
    const over = tabs.scrollWidth - tabs.clientWidth;
    /* 점도 **넘칠 때만** 띄운다. 트레이에 전부 보이면 같은 말을 두 번 하는 셈이고,
       이 페이지는 내비게이션이 화면을 먹으면 안 된다 (카드가 핵심이다). */
    const dots = tabs.closest('.rc-navgroup');
    if (dots) dots.querySelector('.rc-dots').hidden = over <= 1;
    if (over <= 1) { tabs.dataset.fade = 'none'; return; }
    const l = tabs.scrollLeft > 1, r = tabs.scrollLeft < over - 1;
    tabs.dataset.fade = l && r ? 'both' : l ? 'left' : r ? 'right' : 'none';
}

function placeInd(panel, instant) {
    const tabs = panel._sub && panel._sub.querySelector('.rc-subtrack');
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

    /* 고른 분류를 트레이 가운데로 끌어온다 — 아래 무대가 가운데 분류를 보여주므로
       위아래가 같이 움직여야 읽는 눈이 안 어긋난다.
       ⚠ `scrollIntoView` 는 조상까지 같이 굴려 페이지가 튄다. 직접 `scrollLeft` 를 준다.
       ⚠ **부드러운 스크롤에 기대지 말 것.** `scrollTo({behavior:'smooth'})` 도,
         CSS `scroll-behavior: smooth` 도 이 페이지를 띄워 보는 환경에서 조용히
         아무 일도 안 했다 (즉시 대입은 멀쩡했다). 둘 중 하나라도 걸려 있으면
         **트레이가 통째로 안 움직인다.** 자리를 맞추는 게 먼저다. */
    tabs.scrollLeft = Math.max(0, btn.offsetLeft - (tabs.clientWidth - btn.offsetWidth) / 2);

    /* 지금 점은 **채우지 않고 늘린다.** 점이 작아서 색만으로 구분하면 어두운 화면이나
       색각 이상에서 안 읽힌다 — 모양이 달라야 한다 (분류 트레이의 흰 알약과 같은 원리). */
    const dots = panel._sub.querySelectorAll('.rc-dot');
    dots.forEach((d, k) => d.classList.toggle('on', k === (panel._slide || 0)));

    fadeEdges(tabs);
}

/* 글꼴이 늦게 붙거나 창이 좁아져 버튼이 접히면 알약 자리가 어긋난다 */
const indWatch = new ResizeObserver(() => {
    const panel = document.querySelector('.rc-panel:not([hidden])');
    if (panel) placeInd(panel, true);   /* 넘침 판정(`fadeEdges`)도 여기서 다시 돈다 */
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

/* 아티팩트 슬롯 → 아티팩트 상세 모달 (artifact.js). 카드(사도 모달)로 전파되지 않게 끊는다 */
document.addEventListener('click', e => {
    const sl = e.target.closest('.rc-equip-slot.is-link'); if (!sl) return;
    e.stopPropagation(); window.openArtifactModal?.(sl.dataset.art);
}, true);
document.addEventListener('keydown', e => {
    const sl = (e.key === 'Enter' || e.key === ' ') && e.target.closest?.('.rc-equip-slot.is-link'); if (!sl) return;
    e.preventDefault(); e.stopPropagation(); window.openArtifactModal?.(sl.dataset.art);
}, true);

document.addEventListener('keydown', e => {
    if (effView() !== 'slide') return;
    if (document.getElementById('ar-dim')?.hidden === false) return;   /* 아티팩트 모달이 떠 있으면 넘기지 않는다 */
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
            /* ⚠ 트랙 칸 번호 ≠ 분류 번호다. 슬라이드용 복제본이 트랙 양끝에 있어
                   그냥 세면 한 칸씩 밀린다 (1열에서는 숨어 있을 뿐 DOM 에는 있다). */
                const el = active.querySelectorAll('.rc-track > .rc-sec:not([data-clone])')[i];
            if (el) {
                /* ⚠ 폰은 접힌 채로 시작하므로, 분류를 콕 집어 들어온 사람에게는
                   그 분류만 펼쳐 준다 — 안 그러면 링크를 타고 와서 머리글만 본다. */
                el.classList.remove('is-folded');
                el.querySelector('.rc-sec-title')?.setAttribute('aria-expanded', 'true');
                setTimeout(() => el.scrollIntoView({ block: 'start' }), 60);
            }
        }
        writeHash(active);
    }
    window.currentDisplayedList = window._rcFlat ? (window._rcFlat[key] || []) : [];
}

/* 분류 정의(`Recommend_Sections.csv`)와 사도 배치(`Recommend_Chara.csv`)는 **따로** 둔다.
   한 파일에 두면 분류명·설명이 사도 수만큼 반복돼, 설명 한 글자 고치는 데 여러 곳을
   고쳐야 하고 하나만 빠뜨려도 조용히 갈라진다.

   ⚠ 탭·분류가 나오는 순서는 **`Recommend_Sections.csv` 의 행 순서** 그대로다. */
function render(secDefs, recs, dbMap, chipDefs, deckDefs, swapRows, memberRows,
                bossRows, bossSkillRows, ruleRows, shardRows, noteRows) {
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
                      chip: (d.sec_chip || '').trim(),
                      /* `sec_hide` — 값이 있으면 **안 그린다.** 그 값이 곧 "왜 숨겼나" 다
                         (`pick`·`dim` 과 같은 관례).
                         ⚠ 배치를 지워 숨기지 말 것. 끝난 이벤트는 내년에 돌아오는데
                           사도 수십 행을 지웠다 되살리는 건 손으로 할 일이 아니다.
                         `sec_stale` — **그릴 건 다 그리되 "지난 것" 이라고 알린다.**
                         ⚠ 숨김과 다른 쓰임이다. 끝난 시즌 정보도 다음 메타가 올 때까지는
                           육성 방향을 고르는 데 쓸모가 있어 읽을 수 있어야 한다. */
                      hide: (d.sec_hide || '').trim(), stale: (d.sec_stale || '').trim(),
                      rows: [], decks: [],
                      boss: null, bossSkills: [], rules: [], shards: [], notes: [] };
        groups.get(gk).secs.set(sk, sec);
        secByKey.set(sk, sec);
    });

    /* 보스 기믹 — 분류에 매단다.
       ⚠ 분류당 보스는 **하나**다. 시즌이 바뀌면 그 행을 갈아끼운다 (행을 늘리지 않는다) —
         지난 시즌 보스를 같이 띄우면 지금 무엇과 싸우는지가 흐려진다. */
    (bossRows || []).forEach(r => {
        const sec = secByKey.get((r.sec_key || '').trim());
        if (sec && !sec.boss && (r.boss_name || '').trim()) sec.boss = r;
    });
    (bossSkillRows || []).forEach(r => {
        const sec = secByKey.get((r.sec_key || '').trim());
        if (sec && (r.name || '').trim()) sec.bossSkills.push(r);
    });
    /* 시즌 규칙과 이면의 파편도 분류에 매단다 */
    (ruleRows || []).forEach(r => {
        const sec = secByKey.get((r.sec_key || '').trim());
        if (sec && (r.text || '').trim()) sec.rules.push(r);
    });
    (shardRows || []).forEach(r => {
        const sec = secByKey.get((r.sec_key || '').trim());
        if (sec && (r.shard_name || '').trim()) sec.shards.push(r);
    });
    (noteRows || []).forEach(r => {
        const sec = secByKey.get((r.sec_key || '').trim());
        if (sec && (r.text || '').trim()) sec.notes.push(r);
    });
    /* `order` 로 세운다. 비면 **적힌 순서**가 그대로 화면 순서다 (다른 표들과 같은 관례) */
    const byOrder = (a, b) => (parseInt(a.order) || 0) - (parseInt(b.order) || 0);
    secByKey.forEach(sec => {
        sec.bossSkills.sort(byOrder); sec.rules.sort(byOrder);
        sec.shards.sort(byOrder); sec.notes.sort(byOrder);
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

    /* 덱도 같은 `sec_key` 로 붙는다. 행 순서가 곧 화면 순서다. */
    (deckDefs || []).forEach(d => {
        const k = (d.sec_key || '').trim();
        if (!k || !(d.deck_name || '').trim()) return;
        const sec = secByKey.get(k);
        if (!sec) { orphan.push(k); return; }
        sec.decks.push(d);
    });

    /* 사도 → 배치된 소분류들. 그 분류의 `sec_chip` 이 카드의 자동 칩이 된다.
       ⚠⚠ **숨긴 분류(`sec_hide`)는 칩도 내지 않는다.** 칩은 "저기 가서 고르세요" 라는
         안내인데 갈 곳이 없으면 거짓말이 된다. 이 색인이 솎아내기보다 **먼저** 돌기
         때문에, 여기서 안 걸러주면 숨긴 분류의 칩이 다른 탭 카드에 계속 붙는다. */
    const secIndex = new Map();
    /* 덱 멤버를 분류별로 모아 둔다 (아래에서 배치와 같이 센다) */
    const memByDeck = new Map();
    (memberRows || []).forEach(r => {
        const k = (r.deck_key || '').trim();
        if (!k) return;
        if (!memByDeck.has(k)) memByDeck.set(k, []);
        memByDeck.get(k).push(r);
    });
    groups.forEach(g => g.secs.forEach(sec => {
        if (sec.hide) return;
        const add = raw => {
            const n = (raw || '').trim();
            if (!n || isFreeSlot(n)) return;
            if (!secIndex.has(n)) secIndex.set(n, []);
            if (!secIndex.get(n).some(x => x.key === sec.key))
                secIndex.get(n).push({ key: sec.key, chip: sec.chip });
        };
        sec.rows.forEach(r => add(r.chara_name));
        /* ⚠ **덱 편성에 선 사도도 그 분류의 추천픽이다.** 배치(`Recommend_Chara`)만
             세면 덱 전용 분류가 칩을 아예 못 낸다 — 심해는 배치 0명에 편성 22명,
             줘팸터는 0명에 9명이었다.
           ⚠ **후보(`Recommend_Deck_Swaps`)는 안 센다.** 칩은 "이 콘텐츠의 추천픽" 이라는
             뜻인데 후보는 "미보유면 이걸로" 라는 차선책이라 무게가 다르다. 세면 심해에만
             24명이 더 붙어 칩이 뜻을 잃는다.
           ⚠ 빈자리(`?`)는 거른다 — 사도가 아니다. */
        (sec.decks || []).forEach(d =>
            (memByDeck.get((d.deck_key || '').trim()) || []).forEach(m => add(m.chara_name)));
    }));
    window._rcSecIndex = secIndex;

    /* 사도가 한 명도 없는 분류는 띄우지 않는다. 제목과 설명만 있는 빈 상자는
       읽을 게 없고, 옆칸 높이까지 끌어올린다. 분류 정의는 CSV 에 남아 있으니
       **사도를 한 명 넣으면 그대로 다시 나온다.**
       ⚠ 그래서 분류가 안 보인다고 지워진 게 아니다. 편집기 목록에는 그대로 있다. */
    groups.forEach(g => g.secs.forEach((sec, k) => {
        if (sec.hide || (!sec.rows.length && !sec.decks.length)) g.secs.delete(k);
    }));
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
        /* ⚠ 점(`.rc-dots`)은 글라스(`.rc-navgroup`) **안**에 둔다. 밖에 두면 따라다닐 때
             유리 아래에 덩그러니 떨어져 붙는다. 그래서 글라스를 세로로 쪼갠다. */
        sub.innerHTML = `<div class="rc-navgroup">
              <div class="rc-navrow">
                <button class="rc-arrow" data-dir="-1" aria-label="이전 분류"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></button>
                <div class="rc-subtabs"><div class="rc-subtrack" role="tablist"><span class="rc-subtab-ind"></span></div></div>
                <button class="rc-arrow" data-dir="1" aria-label="다음 분류"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>
              </div>
              <div class="rc-dots" aria-hidden="true" hidden></div>
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

        const tabs = sub.querySelector('.rc-subtrack');
        indWatch.observe(tabs);
        /* 끝에 닿았는지에 따라 어느 쪽을 흐리게 할지 정한다 (`fadeEdges`) */
        tabs.addEventListener('scroll', () => fadeEdges(tabs), { passive: true });
        secList.forEach((sec, i) => {
            const el = buildSection(sec, dbMap, missing, flat, swapRows, memberRows);
            /* 비껴 있는 분류를 눌러도 그쪽으로 간다 — 흐릿한 것도 눌린다는 걸 알려준다.
               ⚠ 캡처 단계에서 가로채야 카드의 상세 모달이 먼저 열리지 않는다. */
            el.addEventListener('click', ev => {
                if (!el.classList.contains('is-away')) return;
                ev.preventDefault(); ev.stopPropagation();
                showSlide(panel, i, true);
            }, true);
            track.appendChild(el);
            stageWatch.observe(el);

            /* 점은 분류 버튼과 **기능이 겹친다.** 스크린리더에는 버튼만 읽히게 두고
               (`aria-hidden`), 점은 눈과 마우스를 위한 것으로 남긴다. */
            const dot = document.createElement('span');
            dot.className = 'rc-dot';
            dot.onclick = () => showSlide(panel, i, true);
            sub.querySelector('.rc-dots').appendChild(dot);

            const b = document.createElement('button');
            b.className = 'rc-subtab';
            b.setAttribute('role', 'tab');
            b.innerHTML = (sec.icon
                ? `<img src="${iconUrl(sec.icon, 'content')}" alt="" onerror="this.remove()">` : '')
                + esc(sec.label);
            b.onclick = () => showSlide(panel, i, true);
            tabs.appendChild(b);
        });

        /* 처음과 끝을 이어 붙인다. **양끝에 복제본을 하나씩** 둬서,
           첫 분류 왼쪽에는 마지막이, 마지막 오른쪽에는 첫 분류가 비친다.
           끝을 넘어가면 복제본까지 미끄러진 뒤 **전환을 끄고** 진짜 자리로 옮긴다 —
           생김새가 같아서 갈아타는 순간이 안 보인다.
           ⚠ `cloneNode` 는 **JS 로 붙인 이벤트를 복사하지 않는다.** 복제본을 눌렀을 때
             그쪽으로 넘어가려면 손으로 다시 달아야 한다 (안 달면 먹통인 칸이 된다).
           ⚠ 하나뿐이면 이을 것이 없다. */
        if (secList.length > 1) {
            const reals = [...track.children];
            const last = reals[reals.length - 1].cloneNode(true);
            const first = reals[0].cloneNode(true);
            [[last, reals.length - 1, 'afterbegin'], [first, 0, 'beforeend']]
                .forEach(([clone, to, where]) => {
                    clone.dataset.clone = to;
                    clone.addEventListener('click', ev => {
                        ev.preventDefault(); ev.stopPropagation();
                        showSlide(panel, to, true);
                    }, true);
                    track.insertAdjacentElement(where, clone);
                });
        }

        /* ⚠ **이름으로 한 번씩만** 남긴다 (처음 나온 자리 순서). 같은 사도가 편성판·메모·
             후보·분류 카드에 여러 번 나오는데, `navigateApostle` 이 `findIndex` 로 **첫 자리**를
             찾으므로 겹치면 ← → 가 앞쪽으로 되돌아가 고리에 갇혔다 —
             콘텐츠 탭에서 62명 중 19명밖에 못 돌았다. */
        window._rcFlat[key] = [...new Map(flat.map(c => [c.name, c])).values()];
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
    /* 제목을 누르면 첫 탭으로 돌아가 맨 위로 — 스킬 가이드·아티팩트의 '제목 클릭 초기화' 와 짝.
       ⚠ 로고를 링크로 감싸지 않는다 (한때 스킬 가이드로 이동해 버렸다) */
    const title = document.querySelector('.rc-brand .main-title');
    if (title) {
        title.style.cursor = 'pointer';
        title.title = '클릭 시 첫 탭으로';
        title.onclick = () => {
            /* 첫 분류부터 — `secKey` 로 넘기면 1열에서 그 분류로 스크롤해 버리므로 슬라이드 번호를 직접 되돌린다 */
            const first = document.querySelector(`.rc-panel[data-key="${CSS.escape(keys[0])}"]`);
            if (first) first._slide = 0;
            activateTab(keys[0]); window.scrollTo({ top: 0, behavior: 'smooth' });
        };
    }
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
        const [secT, rec, chipT, deckT, swapT, memT, dbT, debuffT, debuffDescT, highT, buffT, buffDescT, normalT, lowT, asideT, spT, itemT, artT, immT,
               bossT, bossPartT, lineT, shardT, deckShardT] =
            await Promise.all(['Recommend_Sections.csv', 'Recommend_Chara.csv', 'Recommend_Chips.csv',
                'Recommend_Decks.csv', 'Recommend_Deck_Swaps.csv', 'Recommend_Deck_Members.csv',
                'DB.csv', 'debuff_DB.csv', 'debuff_desc_DB.csv',
                'high_skill_DB.csv', 'buff_DB.csv', 'buff_desc_DB.csv', 'normal_Atk_DB.csv',
                'low_skill_DB.csv', 'aside_DB.csv', 'sp_DB.csv', 'battle_item_DB.csv',
                'artifact_DB.csv', 'Immunity_DB.csv',
                'Crash2_Boss.csv', 'Crash2_Boss_Skills.csv', 'Crash2_Lines.csv',
                'Crash2_Shards.csv', 'Crash2_Deck_Shards.csv'].map(get));
        const P = t => Papa.parse(t, cfg).data;

        const db = P(dbT);
        const buffDescDB = P(buffDescT), debuffDescDB = P(debuffDescT);
        const allStateDB = [...buffDescDB, ...debuffDescDB];
        const battleItemDB = P(itemT);
        syncBattleItemTags(allStateDB, battleItemDB);

        /* 제어 면역 — `ui.js` 의 효과 박스가 `window._immunityDB` 로 직접 읽는다.
           (스킬 가이드 쪽은 `main.js` 가 같은 이름으로 심는다) */
        window._immunityDB = P(immT);

        wireDetailModal({
            debuffDB: P(debuffT), buffDB: P(buffT),
            lowSkillDB: P(lowT), highSkillDB: P(highT),
            allStateDB, debuffDescDB,
            normalAtkDB: P(normalT), asideDB: P(asideT),
            spDB: P(spT), battleItemDB
        });

        /* 아티팩트 표 — 이름이 키다 (`art_*` 도 한글 이름으로 가리킨다) */
        P(artT).forEach(r => {
            const n = (r.name || '').trim();
            if (n) ARTIFACTS.set(n, { icon_no: (r.icon_no || '').trim(),
                                      grade: (r.grade || '').trim(),
                                      attach: (r.attach || '').trim() });
        });

        /* `Crash2_Boss_Skills.csv` 한 장에 **기믹 카드와 보스 상태가 같이** 들어 있다
           (`kind` 로 가른다). 둘 다 "보스가 가진 것" 이고 `이름 + 아이콘 + 설명` 으로
           모양이 같아서, 한두 행짜리 파일을 늘리느니 한 표에 둔다.
           ⚠ 상태 맵은 **분류를 안 따진다** (이름이 키다). 보스가 둘 이상인 분류가
             생기고 이름이 겹치면 그때 `sec_key` 까지 키로 쓸 것.
           ⚠ `desc` 가 비면 말풍선을 안 단다 — 본문 글줄에 아이콘만 붙는다 (`bossMark`) */
        const bossParts = P(bossPartT);
        bossParts.filter(r => (r.kind || '').trim() === 'state').forEach(r => {
            const n = (r.name || '').trim();
            if (n) BOSS_STATES.set(n, { icon: (r.icon || '').trim(),
                                        with: (r.icon2 || '').trim(),
                                        desc: (r.desc || '').trim() });
        });
        const bossSkillRows = bossParts.filter(r => (r.kind || '').trim() !== 'state');

        /* `Crash2_Lines.csv` 도 한 장에 **서술 줄과 시즌 규칙**이 같이 있다.
           둘 다 "시즌에 달린 한 줄 글" 이라 헤더가 사실상 같았다. */
        const lineRows = P(lineT);
        const noteRows = lineRows.filter(r => (r.kind || '').trim() === 'note');
        const ruleRows = lineRows.filter(r => (r.kind || '').trim().startsWith('rule'));

        /* 파편 그림표 + 덱별 레벨. 둘 다 **이름으로 잇는다** */
        const shardRows = P(shardT);
        shardRows.forEach(r => {
            const n = (r.shard_name || '').trim();
            if (n) SHARD_ART.set(n, (r.art || '').trim());
        });
        P(deckShardT).forEach(r => {
            const k = (r.deck_key || '').trim();
            if (!k || !(r.shard_name || '').trim()) return;
            if (!DECK_SHARDS.has(k)) DECK_SHARDS.set(k, []);
            DECK_SHARDS.get(k).push(r);
        });

        const dbMap = new Map(db.filter(r => r.name).map(r => [r.name.trim(), r]));
        render(P(secT), P(rec), dbMap, P(chipT), P(deckT), P(swapT), P(memT),
               P(bossT), bossSkillRows, ruleRows, shardRows, noteRows);
    } catch (e) {
        document.getElementById('rc-body').innerHTML =
            `<div class="rc-warn">데이터를 불러오지 못했습니다: ${esc(e.message)}</div>`;
    }
})();
