/* ── 아티팩트 페이지 (artifact.html) ─────────────────────────────
   목록 + 상세 모달. 시안은 tools/artifact/artifact-preview.html.
   읽는 CSV — artifact_DB · Artifact_Stats · Artifact_Effects · Artifact_Attach ·
   Artifact_Tags · buff_desc_DB · debuff_desc_DB
   ⚠ 상세 모달은 **다른 페이지도 쓴다** (사도 추천의 아티팩트 슬롯).
     window.openArtifactModal(이름) 이 입구이고, 목록·필터 쪽은 #ar-grid 가 있을 때만 돈다.
     모달 껍데기(#ar-dim)가 없는 페이지에서는 여기서 만들어 붙인다                */
(() => {
const GRADES = ['일반', '고급', '희귀', '전설'];
const GRADE_COLOR = { 일반: '#8D9A86', 고급: '#4FA45E', 희귀: '#4C86D9', 전설: '#A35BDB' };
const STAT_ICONS = ['HP', 'SP', '공격 속도', '마법 공격력', '마법 방어력', '물리 공격력', '물리 방어력', '치명 피해 저항', '치명 피해', '치명타 저항', '치명타'];
/* 애착 스킬 종류 — Artifact_Attach.skill_type */
const SKT = { low: { label: '저학년', icon: '저학년_아이콘.webp' }, high: { label: '고학년', icon: '고학년_아이콘.webp' }, normal: { label: '일반 공격' } };
const SORTS = [{ value: 'grade', label: '등급순' }, { value: 'name', label: '이름순' }, { value: 'cost', label: '코스트순' }];

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const load = f => fetch('data/' + f + '?v=' + APP_VERSION).then(r => r.text())
    .then(t => Papa.parse(t.replace(/^﻿/, ''), { header: true, skipEmptyLines: true }).data);
/* 템플릿은 글자 `\n` 으로, Lv.N 값은 실제 줄바꿈으로 가른다 (CLAUDE.md) */
const lines = s => String(s ?? '').split('\\n');
const lvVals = (row, lv) => String(row?.['Lv.' + lv] ?? '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
const lastLv = row => { let n = 0; for (let i = 1; i <= 12; i++) if (lvVals(row, i).length) n = i; return n; };
const $ = id => document.getElementById(id);
const PAGE = !!$('ar-grid');
if (!$('ar-dim')) document.body.insertAdjacentHTML('beforeend',
    '<div class="ar-dim" id="ar-dim" hidden><div class="ar-modal" role="dialog" aria-modal="true" id="ar-modal"></div></div>');

let A = [], STATS = {}, EFF = {}, ATT = {}, TAGS = [], TERMS = {};
const F = { group: null, tags: new Set(), grades: new Set(), attach: false, stat: null, q: '', sort: 'grade', desc: false };

const READY = Promise.all(['artifact_DB.csv', 'Artifact_Stats.csv', 'Artifact_Effects.csv', 'Artifact_Attach.csv', 'Artifact_Tags.csv',
    'buff_desc_DB.csv', 'debuff_desc_DB.csv'].map(load))
.then(([art, st, ef, at, tg, bd, dd]) => {
    A = art; TAGS = tg;
    st.forEach(r => STATS[r.name] = r); ef.forEach(r => EFF[r.name] = r); at.forEach(r => ATT[r.name] = r);
    /* 말풍선은 읽어서 뜻이 바로 안 서는 것만 — 사도가 거는 제어·지속피해 + 몇몇 특수 용어.
       회복·보호막·SP 회복처럼 글자 그대로인 건 달지 않는다 */
    const KEEP = new Set(['직접 피해', '무적']);
    [...bd.filter(r => KEEP.has(r.state_name)), ...dd.filter(r => r.type === '제어' || r.type === '지속피해')]
        .forEach(r => { if (r.state_name && r.description && !r.description.includes('{')) TERMS[r.state_name.trim()] = r.description; });
    if (!PAGE) return;
    buildFilters(); render();
    /* artifact.html#이름 으로 들어오면 그 모달을 연다 */
    const h = decodeURIComponent(location.hash.slice(1));
    if (h) openModal(h);
}).catch(err => { if (PAGE) $('ar-grid').innerHTML = `<p class="ar-empty">데이터를 불러오지 못했어요 (${esc(err.message)})</p>`; });

/* 기본 스탯: "라벨 : {0}%" 줄 → {label, idx, unit}. 비용 줄은 스탯이 아니다 */
function statLines(name) {
    const r = STATS[name]; if (!r) return [];
    return lines(r.stat_template).map(l => {
        const m = l.match(/^(.+?)\s*:\s*\{(\d+)\}(.*)$/);
        return m && { label: m[1].trim(), idx: +m[2], unit: m[3].trim() };
    }).filter(Boolean);
}
const realStats = name => statLines(name).filter(s => s.label !== '비용');
const statIcon = label => { const b = label.replace(/\s*(증가|감소)$/, ''); return STAT_ICONS.includes(b) ? 'assets/icons/base_stat/' + b + '.webp' : null; };
const short = label => label.replace(/ 증가$/, '');
const costAt = (name, lv) => {
    const c = statLines(name).find(s => s.label === '비용');
    return c ? (lvVals(STATS[name], lv)[c.idx] ?? STATS[name].cost) : STATS[name]?.cost;
};

/* 필터 박스가 상단에 붙었는지 — main.js 의 watchStuck 과 같다.
   붙은 동안에만 .tg-nav 가 프리즘 글라스가 되고, 아닐 때는 그리드 색 띠다 */
if (PAGE && 'IntersectionObserver' in window) {
    const sub = document.querySelector('.tg-subheader');
    const mark = document.createElement('div');
    mark.setAttribute('aria-hidden', 'true'); mark.style.cssText = 'height:0;margin:0;padding:0;border:0;';
    sub.parentNode.insertBefore(mark, sub);
    new IntersectionObserver(([e]) => sub.classList.toggle('is-stuck', !e.isIntersecting), { threshold: 0 }).observe(mark);
}

/* ── 정렬 드롭다운 — main.js 의 initSortDropdown 과 같은 마크업·클래스 ── */
if (PAGE) (function initSort() {
    const root = $('arSort'), btn = root.querySelector('.tg-dropdown-btn'), label = root.querySelector('.tg-dropdown-label');
    let menu = null;
    const close = () => { if (!menu) return; menu.remove(); menu = null; btn.setAttribute('aria-expanded', 'false'); document.removeEventListener('mousedown', onDoc); };
    const onDoc = e => { if (!root.contains(e.target)) close(); };
    btn.addEventListener('click', () => {
        if (menu) return close();
        menu = document.createElement('div'); menu.className = 'tg-dropdown-menu'; menu.setAttribute('role', 'listbox');
        SORTS.forEach(o => {
            const it = document.createElement('button'); it.type = 'button'; it.className = 'tg-dropdown-item'; it.setAttribute('role', 'option');
            it.setAttribute('aria-selected', String(o.value === F.sort));
            it.innerHTML = `<span>${o.label}</span>${o.value === F.sort ? '<span class="tg-dropdown-item-check">✓</span>' : ''}`;
            it.onclick = () => { F.sort = o.value; label.textContent = o.label; close(); render(); };
            menu.appendChild(it);
        });
        root.appendChild(menu); btn.setAttribute('aria-expanded', 'true'); document.addEventListener('mousedown', onDoc);
    });
    root._close = close;
})();
if (PAGE) {
$('ar-order').onclick = () => { F.desc = !F.desc; $('ar-order').textContent = F.desc ? '▲' : '▼'; render(); };
$('ar-search').oninput = e => { F.q = e.target.value.trim(); render(); };
$('ar-filter-btn').onclick = () => {
    const box = $('ar-filters'); box.hidden = !box.hidden;
    $('ar-filter-btn').setAttribute('aria-expanded', String(!box.hidden));
};
$('ar-grid').onclick = e => { const c = e.target.closest('.ar-card'); if (c) openModal(c.dataset.name); };
window.addEventListener('scroll', () => { $('top-btn').style.display = window.scrollY > 300 ? 'flex' : 'none'; });
}

/* ── 필터 ── */
function buildFilters() {
    const groups = [...new Set(TAGS.map(t => t.tag_group))];
    const labels = new Map();
    A.forEach(a => realStats(a.name).forEach(s => labels.set(s.label, (labels.get(s.label) || 0) + 1)));
    const box = $('ar-filters');
    box.innerHTML = `
        <div class="ar-frow"><b>특징</b>${groups.map(g => `<button class="ar-chip" data-group="${esc(g)}">${esc(g)}</button>`).join('')}
            <span class="ar-subs" id="ar-subs"></span></div>
        <div class="ar-frow"><b>등급</b>${GRADES.map(g => `<button class="ar-chip" data-grade="${g}">${g}</button>`).join('')}
            <button class="ar-chip" data-attach>애착만</button></div>
        <div class="ar-frow"><b>스탯</b>${[...labels].sort((a, b) => b[1] - a[1]).map(([l]) =>
            `<button class="ar-chip" data-stat="${esc(l)}">${statIcon(l) ? `<img src="${statIcon(l)}" alt="">` : ''}${esc(short(l))}</button>`).join('')}</div>
        <div class="ar-frow ar-freset"><button class="ar-chip" data-reset>필터 초기화</button></div>`;
    box.onclick = e => {
        const b = e.target.closest('.ar-chip'); if (!b) return;
        if (b.dataset.group != null) { F.group = F.group === b.dataset.group ? null : b.dataset.group; F.tags.clear(); }
        else if (b.dataset.tag != null) F.tags.has(b.dataset.tag) ? F.tags.delete(b.dataset.tag) : F.tags.add(b.dataset.tag);
        else if (b.dataset.grade) F.grades.has(b.dataset.grade) ? F.grades.delete(b.dataset.grade) : F.grades.add(b.dataset.grade);
        else if (b.hasAttribute('data-attach')) F.attach = !F.attach;
        else if (b.dataset.stat) F.stat = F.stat === b.dataset.stat ? null : b.dataset.stat;
        else if (b.hasAttribute('data-reset')) { F.group = null; F.tags.clear(); F.grades.clear(); F.attach = false; F.stat = null; }
        render();
    };
}
function syncChips() {
    const box = $('ar-filters');
    box.querySelectorAll('[data-group]').forEach(b => b.classList.toggle('on', b.dataset.group === F.group));
    box.querySelectorAll('[data-grade]').forEach(b => b.classList.toggle('on', F.grades.has(b.dataset.grade)));
    box.querySelector('[data-attach]').classList.toggle('on', F.attach);
    box.querySelectorAll('[data-stat]').forEach(b => b.classList.toggle('on', b.dataset.stat === F.stat));
    $('ar-subs').innerHTML = F.group ? TAGS.filter(t => t.tag_group === F.group).map(t =>
        `<button class="ar-chip sub${F.tags.has(t.tag_key) ? ' on' : ''}" data-tag="${esc(t.tag_key)}" style="--c:${t.tag_color}">${esc(t.tag_label || t.tag_key)}</button>`).join('') : '';
    const n = (F.group ? 1 : 0) + F.tags.size + F.grades.size + (F.attach ? 1 : 0) + (F.stat ? 1 : 0);
    $('ar-filter-count').textContent = n || '';
}
const tagsOf = a => String(a.tags || '').split(',').map(s => s.trim()).filter(Boolean);
function match(a) {
    const tg = tagsOf(a);
    if (F.q && !a.name.includes(F.q)) return false;
    if (F.group && !tg.some(t => TAGS.find(x => x.tag_key === t)?.tag_group === F.group)) return false;
    if (F.tags.size && ![...F.tags].every(t => tg.includes(t))) return false;
    if (F.grades.size && !F.grades.has(a.grade)) return false;
    if (F.attach && !a.attach) return false;
    if (F.stat && !realStats(a.name).some(s => s.label === F.stat)) return false;
    return true;
}
const byName = (x, y) => x.name.localeCompare(y.name, 'ko');
function sorted(list) {
    /* 기본 = 높은 등급 먼저, 같은 등급은 가나다. ▲ 를 누르면 통째로 뒤집는다 */
    const cmp = {
        grade: (x, y) => GRADES.indexOf(y.grade) - GRADES.indexOf(x.grade) || byName(x, y),
        name: byName,
        cost: (x, y) => (+costAt(y.name, 1) || 0) - (+costAt(x.name, 1) || 0) || byName(x, y),
    }[F.sort];
    const out = [...list].sort(cmp);
    return F.desc ? out.reverse() : out;
}

/* ── 카드 ── */
const baseImg = a => 'assets/icons/artifact_card/Ingame_CardBase_Artifact_' + (a.attach ? 'SignatureCard' : 'Grade_' + (GRADES.indexOf(a.grade) + 1)) + '.webp';
const face = (a, lv = 1) => `<div class="ar-face" data-grade="${esc(a.grade)}" style="--base:url('${baseImg(a)}')">
    <div class="ar-frame"><div class="ar-inner"><div class="ar-bg"></div></div></div>
    <img class="ic" src="assets/icons/artifacts/ArtifactIcon_${a.icon_no}.webp" alt="" loading="lazy">
    <span class="ar-label" style="--n:${a.name.length}">${esc(a.name)}</span>
    <span class="ar-cost">${esc(costAt(a.name, lv) ?? '')}</span>
    ${a.attach ? `<span class="ar-att" style="background-image:url('assets/images/${encodeURIComponent(a.attach)}.webp')" data-tooltip="${esc(a.attach)} 애착"></span>` : ''}</div>`;
function render() {
    syncChips();
    const list = sorted(A.filter(match));
    $('ar-count').textContent = `${list.length} / ${A.length}종`;
    $('ar-grid').innerHTML = list.length ? list.map(a =>
        `<button class="ar-card" data-name="${esc(a.name)}" aria-label="${esc(a.name)}">${face(a)}</button>`).join('')
        : '<p class="ar-empty">조건에 맞는 아티팩트가 없어요. 필터를 하나 풀어 보세요.</p>';
}
/* ── 효과문: 자리표 숫자만 강조, 용어는 .tg-term ── */
function termify(html) {
    const names = Object.keys(TERMS).filter(n => n.length >= 2).sort((a, b) => b.length - a.length);
    if (!names.length) return html;
    const re = new RegExp('(' + names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'g');
    return html.split(/(<[^>]+>)/).map(p => p.startsWith('<') ? p
        : p.replace(re, m => `<span class="tg-term" tabindex="0" data-tooltip="${esc(m + '\n' + TERMS[m])}">${m}</span>`)).join('');
}
function effectHTML(name, lv) {
    const r = EFF[name]; if (!r) return '<span class="ar-none">특별한 기능이 없지만 기본에 충실하다.</span>';
    const vals = lvVals(r, lv).length ? lvVals(r, lv) : lvVals(r, 1);
    /* `4×{0}` 꼴은 곱한 값으로 (장난감 망원경) */
    const text = lines(r.effect_desc).map(l => esc(l)
        .replace(/(\d+(?:\.\d+)?)×\{(\d+)\}/g, (_, k, i) => vals[i] == null ? '?' : `\u0001${+(k * vals[i]).toFixed(2)}\u0002`)
        .replace(/\{(\d+)\}/g, (_, i) => `\u0001${vals[i] ?? '?'}\u0002`)).join('<br>');
    return termify(text).replace(/\u0001([^\u0002]*)\u0002/g, '<span class="v">$1</span>');
}

/* ── 모달 ── */
let lastFocus = null;
function attachHTML(a, att) {
    const skt = SKT[att.skill_type];
    const chk = 'assets/icons/common_icons/애착 아티팩트_체크_';
    return `<div class="ar-attach">
        <div class="ar-attach-h"><span class="ar-attach-title"><img class="ar-attach-face" src="assets/images/${encodeURIComponent(a.attach)}.webp" alt="">${esc(a.attach)}의 애착 아티팩트</span></div>
        <p class="ar-attach-note">아래 효과는 애착 사도에게만 적용되며, 중복 적용되지 않습니다.</p>
        <div class="ar-attach-steps">
            <div class="ar-step" data-step="1"><div class="ar-step-l"><img class="ar-chk" src="${chk}true.webp" alt=""><span class="ar-leaf">1</span><b>Lv.1</b></div>
                <div class="ar-step-r"><div class="ar-attach-skill">애착 아티팩트 스킬 : <em>${esc(att.skill_name)}</em>${skt ? `<span class="ar-skt">${skt.icon ? `<img src="assets/icons/skill_type/${skt.icon}" alt="">` : ''}${skt.label}</span>` : ''}</div>
                    <div>${termify(lines(att.skill_desc).map(esc).join('<br>'))}</div>
                    <div class="ar-kv">${lines(att.stat_template).filter(Boolean).map(l => { const [k, v] = l.split(/\s*:\s*/); return `<div>${esc(k)} : <b>${esc(v ?? '')}</b></div>`; }).join('')}</div></div></div>
            <div class="ar-step" data-step="3"><div class="ar-step-l"><img class="ar-chk" src="${chk}true.webp" data-on="${chk}true.webp" data-off="${chk}false.webp" alt=""><span class="ar-leaf">2</span><b>Lv.3</b></div>
                <div class="ar-step-r"><div>${esc(att.lv3_desc).replace(/(\d+(?:\.\d+)?%?)/g, '<b>$1</b>')}</div></div></div>
        </div></div>`;
}
function openModal(name) {
    const a = A.find(x => x.name === name); if (!a) return;
    lastFocus = document.activeElement;
    const top = Math.max(1, lastLv(STATS[name]));
    const att = ATT[name];
    const m = $('ar-modal');
    m.innerHTML = `
        <div class="ar-mhead">
            <div id="ar-mface"></div>
            <div>
                <div class="ar-title"><h2>${esc(a.name)}</h2><span class="ar-grade" style="--g:${GRADE_COLOR[a.grade]}">${esc(a.grade)}</span>${a.attach ? '<span class="ar-grade" style="--g:#C9A227">애착</span>' : ''}</div>
                <div class="ar-stats" id="ar-mstats"></div>
                <p class="ar-effect" id="ar-meff"></p>
            </div>
            <button class="ar-x" aria-label="닫기" type="button">×</button>
        </div>
        <div class="ar-body">
            <div class="ar-lv${top === 1 ? ' locked' : ''}">
                <div class="ar-track"><input type="range" min="1" max="${top}" value="1" id="ar-mrange" ${top === 1 ? 'disabled' : ''} aria-label="아티팩트 레벨">
                    <span class="ar-end" id="ar-mlo">Lv.1</span><span class="ar-end hi" id="ar-mhi">Lv.${top}</span><b class="ar-lvnow" id="ar-mlv">Lv.1</b></div>
                <div class="ar-lvmax">${top === 1 ? 'Lv.1 수치만 공개돼 있어요.' : top < 12 ? `Lv.${top} 까지만 공개돼 있어요.` : ''}</div>
            </div>
            ${att ? `<div class="ar-sec">${attachHTML(a, att)}</div>` : ''}
            <div class="ar-sec"><h3>특징</h3><div class="ar-tags">${tagsOf(a).map(t => { const d = TAGS.find(x => x.tag_key === t);
                return `<button class="ar-tag" style="--c:${d?.tag_color || '#888'}" data-t="${esc(t)}" data-g="${esc(d?.tag_group || '')}">${esc(d?.tag_label || t)}</button>`; }).join('') || '<span class="ar-none">태그 없음</span>'}</div></div>
        </div>`;
    const draw = lv => {
        $('ar-mface').innerHTML = face(a, lv);
        const lb = $('ar-mlv'), t = top > 1 ? (lv - 1) / (top - 1) : 0;
        lb.textContent = 'Lv.' + lv; lb.style.left = `calc(${t * 100}% + ${8 - t * 16}px)`;
        $('ar-mlo').hidden = t < .12; $('ar-mhi').hidden = t > .88;
        const v = lvVals(STATS[name], lv);
        $('ar-mstats').innerHTML = realStats(name).map(s =>
            `<span class="ar-stat">${statIcon(s.label) ? `<img src="${statIcon(s.label)}" alt="">` : ''}${esc(short(s.label))} <b>+${esc(v[s.idx] ?? '?')}${esc(s.unit)}</b></span>`).join('');
        $('ar-meff').innerHTML = effectHTML(name, lv);
        m.querySelector('.ar-step[data-step="3"]')?.classList.toggle('off', lv < 3);
        const ck = m.querySelector('.ar-chk[data-off]'); if (ck) ck.src = lv < 3 ? ck.dataset.off : ck.dataset.on;
    };
    draw(1);
    $('ar-mrange').oninput = e => draw(+e.target.value);
    m.querySelector('.ar-x').onclick = closeModal;
    m.querySelector('.ar-tags').onclick = e => { const t = e.target.closest('.ar-tag'); if (!t) return;
        if (!PAGE) return;   /* 다른 페이지에서는 거를 목록이 없다 */
        F.group = t.dataset.g || null; F.tags = new Set([t.dataset.t]);
        $('ar-filters').hidden = false; $('ar-filter-btn').setAttribute('aria-expanded', 'true');
        closeModal(); render(); };
    $('ar-dim').hidden = false; document.body.style.overflow = 'hidden';
    m.querySelector('.ar-body').scrollTop = 0; m.querySelector('.ar-x').focus();
}
function closeModal() { $('ar-dim').hidden = true; document.body.style.overflow = ''; lastFocus?.focus(); }
$('ar-dim').onclick = e => { if (e.target.id === 'ar-dim') closeModal(); };
document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('ar-dim').hidden) { e.stopImmediatePropagation(); closeModal(); } else $('arSort')?._close?.();
});
window.openArtifactModal = name => READY.then(() => openModal(name));
})();
