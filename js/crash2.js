/* ══ 대충돌 2.0 · 차원 대충돌 — 정보 섹션 · 덱 옆 파편 스트립 ══════════════
   사도 추천 페이지(`recommend.js`)가 **그 분류를 처음 그릴 때** 불러온다 (`loadMods`).
   스타일은 `css/crash2.css` — 역시 그때 붙는다. 자세한 건 `CRASH2.md`.

   ⚠ 데이터(보스 상태 · 파편 그림 맵)는 `recommend.js` 가 CSV 를 읽어 채우고 `setup` 으로 넘긴다.
     이 파일은 **그리기만** 한다 — 여기서 CSV 를 따로 읽으면 요청이 한 번에 안 나간다 (CLAUDE.md 「다음 페이지 미리 받기」)
   ⚠ 대충돌 1.0(`crash`)도 같은 상자를 쓴다 (`buildCrash2Panel` 의 `is2`) */

let esc, iconUrl, BOSS_STATES, SHARD_ART;
export function setup(ctx) {
    ({ esc, iconUrl, bossStates: BOSS_STATES, shardArt: SHARD_ART } = ctx);
}

/* 덱 편성판 **오른쪽**에 서는 파편 레벨 스트립.
   ⚠ 정보 섹션의 큰 파편 카드를 가져다 쓰지 않는다 — 325:375 라 세로로 길어 편성판
     옆에 세 장을 세우면 보드보다 높아진다. 인게임 아이콘이 **256 정사각**이라
     그걸 그대로 틀에 넣는다.
   ⚠ 틀 색은 보스 기믹 아이콘과 **같은 값**(`--rc-boss-ico-*`)이다. 둘 다 "인게임
     아이콘을 우리 틀에 끼운 것" 이라 같은 꼴이어야 한다.
   ⚠⚠ **스크롤 껍데기(`.rc-board-scroll`) 안에 넣지 말 것.** 최소 폭 460px 을 같이
     물려받아 폰에서 스트립까지 옆으로 밀린다. 형제로 두고 줄(`.rc-board-row`)로 묶는다. */
export function buildDeckShards(rows) {
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
export function buildCrash2Panel(sec) {
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
        /* ⚠ 이 상자는 **대충돌 1.0(`crash`)도 쓴다** (2026-11-04). 콘텐츠 이름과 제목 아이콘을
             분류 키로 가른다 — 2.0 은 흑화 영춘 월드 보스 아이콘, 그 밖은 보스 초상화 */
        const is2 = sec.key.startsWith('crash2');
        const tIcon = is2 ? './assets/icons/boss/CommonIcon_MonsterWorldBoss_YC00_Mad.webp'
                          : (boss.portrait ? iconUrl(boss.portrait, 'dimension') : '');
        t.innerHTML = `${tIcon ? `<img src="${tIcon}" alt="" onerror="this.remove()">` : ''}<b>${
                            is2 ? '대충돌 2.0' : '차원 대충돌'}${season ? ' ' + esc(season) : ''} — ${esc(boss.boss_name)}${
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
    /* ⚠ 초상화도 서술도 없으면 그리지 않는다 — 빈 흰 띠만 남는다 (대충돌 1.0 을 보스·규칙만으로 먼저 올렸을 때) */
    if ((boss && boss.portrait) || sec.notes.length) {
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
    // ⚠ 사용자 속성 속 url() 은 **그 var() 를 쓰는 스타일시트(css/) 기준**으로 풀린다 — 절대 주소로 넘긴다
    art.style.setProperty('--art', `url('${new URL(iconUrl(s.art, 'dimension'), document.baseURI).href}')`);
    if ((s.art_pos || '').trim()) art.style.setProperty('--art-pos', s.art_pos.trim());
    return el;
}
