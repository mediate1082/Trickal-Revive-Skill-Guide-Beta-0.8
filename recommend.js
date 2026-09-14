/* ── 사도 추천 페이지 ──────────────────────────────────────────
   data/Recommend_Chara.csv 를 읽어 대분류 > 소분류 > 역할 순으로 렌더링합니다.

   ⚠ 카드 마크업은 main.js 의 displayCards() 와 동일한 구조를 복제한 것입니다.
     (tiermaker.js 와 같은 방식) 카드 디자인을 고칠 때는 두 곳을 함께 고쳐야 합니다.
     추후 card.js 로 분리하면 이 중복을 없앨 수 있습니다.                    */

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

/* 테마 로직은 theme.js 로 분리됨 (window.toggleTheme) */

function makeStarHTML(rarity) {
    const n = parseInt(rarity);
    if (isNaN(n) || n <= 0) return '<div style="height:20px;"></div>';
    const src = `./assets/icons/common_icons/${n >= 3 ? 'star3' : 'star2'}.webp`;
    let s = '';
    for (let i = 0; i < n; i++)
        s += `<img src="${src}" style="width:19px;height:19px;margin:0 -3px;filter:drop-shadow(0 1px 1px rgba(0,0,0,.2));">`;
    return `<div style="display:flex;justify-content:center;align-items:center;margin-top:-3px;height:20px;z-index:3;position:relative;">${s}</div>`;
}

function getGaugeInfo(grade) {
    /* main.js 와 동일한 토큰을 쓴다 (막대 = --grade-*, 글자 = --grade-*-text) */
    if (!grade || grade === 'X') return { width: '0%', color: 'var(--grade-x)', text: 'var(--grade-x-text)', label: 'X' };
    const g = String(grade).trim();
    if (g.includes('10+')) return { width: '100%', color: 'var(--grade-10)', text: 'var(--grade-10-text)', label: '10+' };
    if (g.includes('7+'))  return { width: '65%',  color: 'var(--grade-7p)', text: 'var(--grade-7p-text)', label: '7+' };
    if (g.includes('7-'))  return { width: '35%',  color: 'var(--grade-7m)', text: 'var(--grade-7m-text)', label: '7-' };
    return { width: '0%', color: 'var(--grade-x)', text: 'var(--grade-x-text)', label: g };
}

function makeSkillGauge(tag, grade) {
    const g = getGaugeInfo(grade);
    return `<div style="display:flex;align-items:center;gap:3px;flex:1;min-width:0;">
        <span style="font-size:.8rem;color:var(--text-muted);font-weight:800;flex-shrink:0;">${tag}</span>
        <div style="flex:1;height:5px;border-radius:99px;background:var(--border-soft);overflow:hidden;min-width:0;">
            <div style="width:${g.width};height:100%;background:${g.color};border-radius:99px;"></div>
        </div>
        <span style="font-size:.75rem;font-weight:800;color:${g.text};flex-shrink:0;">${g.label}</span>
    </div>`;
}

function buildCard(char, reason) {
    const card = document.createElement('div');
    card.className = 'char-card rc-card';
    const p = PERSONALITY_COLORS[char.personality] || PERSONALITY_COLORS['공명'];
    const reso = char.personality === '공명';
    const eldyne = char.Eldyne && char.Eldyne.trim() !== '' && char.Eldyne !== 'X';
    if (eldyne) card.classList.add('eldyne-card');
    if (reason) { card.dataset.tip = reason; card.classList.add('rc-tip'); }
    card.onclick = () => window.openDetailModal(char);

    card.innerHTML = `
        <div class="${reso ? 'card-top bg-resonance' : 'card-top'}"
             style="background:${reso ? 'none' : p.bg};border:3px solid ${p.border};border-bottom:none;">
            <img src="./assets/icons/chara_image/초상화_${char.name}.webp" class="char-img" loading="lazy" decoding="async"
                 style="width:100%;height:100%;object-fit:cover;"
                 onerror="this.src='./assets/icons/chara_image/default.webp'">
            <img src="./assets/icons/personality/${char.personality}.webp"
                 style="position:absolute;top:6px;left:6px;width:28px;height:28px;z-index:2;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3));">
            ${eldyne ? '<img src="./assets/icons/common_icons/Ingame_Icon_HeroGrow_Hidden.webp" class="eldyne-corner-icon">' : ''}
            <div style="position:absolute;bottom:8px;left:0;width:100%;padding:0 8px;display:flex;justify-content:space-between;align-items:center;z-index:2;">
                <img src="./assets/icons/role/${char.role}.webp" style="width:26px;height:26px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3));">
                <img src="./assets/icons/line/${char.line}.webp" style="width:28px;height:28px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3));">
            </div>
            <div style="position:absolute;bottom:6px;width:100%;z-index:3;">${makeStarHTML(char.star)}</div>
        </div>
        <div class="card-bottom" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80px;padding:8px 6px;border-radius:0 0 15px 15px;">
            <div class="char-name" style="font-size:1.25rem;font-weight:800;margin-bottom:8px;text-align:center;width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${char.name}</div>
            <div style="display:flex;align-items:center;width:100%;gap:4px;padding:0 4px;">
                ${makeSkillGauge('저', char.low_grade)}
                <div style="width:1px;height:10px;background:var(--border-soft);flex-shrink:0;"></div>
                ${makeSkillGauge('고', char.high_grade)}
            </div>
        </div>`;
    return card;
}

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function buildSection(sec, dbMap, missing, flat) {
    const sEl = document.createElement('div');
    sEl.className = 'rc-sec';
    const tip = sec.tip ? ` <span class="rc-tip rc-sec-mark" data-tip="${esc(sec.tip)}" tabindex="0">?</span>` : '';
    sEl.innerHTML = `<h3 class="rc-sec-title">${esc(sec.label)}${tip}</h3>`;

    /* 역할별로 나눈 뒤 rank 순 정렬 */
    const byRole = new Map();
    sec.rows.forEach(r => {
        const ch = dbMap.get(r.chara_name.trim());
        if (!ch) { missing.push(r.chara_name); return; }
        const role = ch.role || '기타';
        if (!byRole.has(role)) byRole.set(role, []);
        byRole.get(role).push({ ch, reason: r.reason, rank: parseInt(r.rank) || 99 });
    });

    [...byRole.keys()].sort((a, b) => {
        const ia = ROLE_ORDER.indexOf(a), ib = ROLE_ORDER.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    }).forEach(role => {
        const list = byRole.get(role).sort((a, b) => a.rank - b.rank);
        const rEl = document.createElement('div');
        rEl.className = 'rc-role';
        rEl.innerHTML = `<h4 class="rc-role-title">
            <img src="./assets/icons/role/${encodeURIComponent(role)}.webp" alt="" onerror="this.style.display='none'">${esc(role)}
        </h4><div class="rc-cards"></div>`;
        const wrap = rEl.querySelector('.rc-cards');
        list.forEach(item => { flat.push(item.ch); wrap.appendChild(buildCard(item.ch, item.reason)); });
        sEl.appendChild(rEl);
    });
    return sEl;
}

/* 대분류 = 탭. 선택 상태는 URL 해시에 담아 링크로 공유할 수 있게 한다. */
function activateTab(key) {
    document.querySelectorAll('.rc-tab').forEach(b => {
        const on = b.dataset.key === key;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.rc-panel').forEach(pn => { pn.hidden = pn.dataset.key !== key; });
    if (location.hash.slice(1) !== key) history.replaceState(null, '', '#' + key);
    window.currentDisplayedList = window._rcFlat ? (window._rcFlat[key] || []) : [];
}

function render(recs, dbMap) {
    const body = document.getElementById('rc-body');
    const missing = [];

    /* 대분류 > 소분류 순서를 CSV 등장 순서대로 유지 */
    const groups = new Map();
    recs.forEach(r => {
        if (!r.group_key || !r.chara_name) return;
        if (!groups.has(r.group_key)) groups.set(r.group_key, { label: r.group_label, icon: r.group_icon, secs: new Map() });
        const g = groups.get(r.group_key);
        if (!g.secs.has(r.sec_key)) g.secs.set(r.sec_key, { label: r.sec_label, tip: r.sec_tip, rows: [] });
        g.secs.get(r.sec_key).rows.push(r);
    });

    body.innerHTML = '';
    if (!groups.size) { body.innerHTML = '<div class="rc-loading">표시할 추천 데이터가 없습니다.</div>'; return; }

    const bar = document.createElement('div');
    bar.className = 'rc-tabbar';
    bar.setAttribute('role', 'tablist');
    body.appendChild(bar);

    window._rcFlat = {};
    groups.forEach((g, key) => {
        const btn = document.createElement('button');
        btn.className = 'rc-tab';
        btn.dataset.key = key;
        btn.setAttribute('role', 'tab');
        btn.innerHTML = `<span class="rc-tab-icon">${esc(g.icon || '★')}</span>${esc(g.label)}`;
        btn.onclick = () => activateTab(key);
        bar.appendChild(btn);

        const panel = document.createElement('section');
        panel.className = 'rc-panel';
        panel.dataset.key = key;
        panel.setAttribute('role', 'tabpanel');
        const flat = [];
        g.secs.forEach(sec => panel.appendChild(buildSection(sec, dbMap, missing, flat)));
        window._rcFlat[key] = flat;
        body.appendChild(panel);
    });

    if (missing.length) {
        const w = document.createElement('div');
        w.className = 'rc-warn';
        w.textContent = `DB.csv에서 찾지 못한 사도: ${[...new Set(missing)].join(', ')}`;
        body.prepend(w);
    }

    const keys = [...groups.keys()];
    const want = decodeURIComponent(location.hash.slice(1));
    activateTab(keys.includes(want) ? want : keys[0]);
    window.addEventListener('hashchange', () => {
        const k = decodeURIComponent(location.hash.slice(1));
        if (keys.includes(k)) activateTab(k);
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
        const [rec, dbT, debuffT, debuffDescT, highT, buffT, buffDescT, normalT, lowT, asideT, spT, itemT] =
            await Promise.all(['Recommend_Chara.csv', 'DB.csv', 'debuff_DB.csv', 'debuff_desc_DB.csv',
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
        render(P(rec), dbMap);
    } catch (e) {
        document.getElementById('rc-body').innerHTML =
            `<div class="rc-warn">데이터를 불러오지 못했습니다: ${esc(e.message)}</div>`;
    }
})();
