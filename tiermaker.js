(function () {

const TM_TIER_MAP = {
    '[1]메타픽':      '메타픽',
    '[2]성격덱':      '성격덱',
    '[3]메타 부적합': '메타 부적합',
};

const TM_SWATCH = [
    '#EF4444','#F97316','#F59E0B','#EAB308',
    '#22C55E','#14B8A6','#3B82F6','#6366F1',
    '#A855F7','#EC4899','#6B7280','#1E293B',
];

const TM_P_COLORS = {
    '순수': { bg: '#66C17C', border: '#93F4A7' },
    '냉정': { bg: '#85BAEC', border: '#A4D0F7' },
    '광기': { bg: '#EE839D', border: '#F4ACBA' },
    '우울': { bg: '#C784ED', border: '#D8A0FB' },
    '활발': { bg: '#ECDC85', border: '#F9ECA8' },
    '공명': { bg: 'none',    border: '#FFFEFD' },
};

let _tiers = [];
let _pool  = [];
let _dragging   = null;
let _dragGhost  = null;
let _dragRAF    = null;
let _popupId    = null;
let _pFilter    = '';
let _addTierId  = null;
let _addFilter  = '';

// ── Open / Close ──────────────────────────────────────────────────────────────
window.openTierMaker = function () {
    const modal = document.getElementById('tm-modal');
    if (!modal) return;
    _tmInit();
    _tmRender();
    modal.classList.remove('tm-leaving');
    modal.style.display = 'block';
    requestAnimationFrame(() => modal.classList.add('tm-entering'));
    document.body.style.overflow = 'hidden';
};

function _tmClose() {
    const modal = document.getElementById('tm-modal');
    if (!modal) return;
    _tmClosePopupEl();
    _tmCloseAddOverlay();
    modal.classList.remove('tm-entering');
    modal.classList.add('tm-leaving');
    setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.remove('tm-leaving');
        document.body.style.overflow = '';
        _popupId = null;
        _pFilter = '';
        const psearch = document.getElementById('tm-pool-search');
        if (psearch) psearch.value = '';
    }, 200);
}
window._tmClose = _tmClose;

// ── Init ──────────────────────────────────────────────────────────────────────
function _tmInit() {
    _tiers = [
        { id: 't1', name: '메타픽',      color: '#E91E63', chars: [] },
        { id: 't2', name: '성격덱',      color: '#2980B9', chars: [] },
        { id: 't3', name: '메타 부적합', color: '#7F8C8D', chars: [] },
    ];
    _pool = [];
    const chars = window._tmDB || [];
    chars.forEach(char => {
        if (parseInt(char.star) <= 2) { _pool.push(char.name); return; }
        const tierName = TM_TIER_MAP[char.tier];
        const tier = tierName && _tiers.find(t => t.name === tierName);
        if (tier) tier.chars.push(char.name);
        else _pool.push(char.name);
    });
}

// ── Star HTML (standalone — no dependency on main.js) ─────────────────────────
function _tmStarHTML(rarity) {
    const n = parseInt(rarity);
    if (isNaN(n) || n <= 0) return '<div style="height:14px"></div>';
    const src = `./assets/icons/common_icons/${n >= 3 ? 'star3' : 'star2'}.webp`;
    let s = '';
    for (let i = 0; i < n; i++)
        s += `<img draggable="false" src="${src}" style="width:13px;height:13px;margin:0 -2px;filter:drop-shadow(0 1px 1px rgba(0,0,0,.2));pointer-events:none">`;
    return `<div style="display:flex;justify-content:center;align-items:center;margin-top:-2px;height:14px;position:relative;z-index:3;pointer-events:none">${s}</div>`;
}

// ── Card HTML ─────────────────────────────────────────────────────────────────
function _tmCard(char) {
    if (!char) return '';
    const p = TM_P_COLORS[char.personality] || TM_P_COLORS['공명'];
    const isRes = char.personality === '공명';
    const isEld = char.Eldyne && char.Eldyne.trim() !== '' && char.Eldyne !== 'X';
    const topCls = isRes ? 'card-top bg-resonance' : 'card-top';
    const topSt  = `background:${isRes ? 'none' : p.bg};border:3px solid ${p.border};border-bottom:none;box-sizing:border-box;`;
    const eldIcon = isEld
        ? `<img draggable="false" src="./assets/icons/common_icons/Ingame_Icon_HeroGrow_Hidden.webp" class="eldyne-corner-icon" style="pointer-events:none">`
        : '';
    const safeName = char.name.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    return `<div class="char-card tm-card" draggable="true" data-name="${safeName}"
        ondragstart="window._tmDragStart(event)" ondragend="window._tmDragEnd(event)">
        <div class="${topCls}" style="${topSt};pointer-events:none">
            <img draggable="false" src="./assets/icons/chara_image/초상화_${char.name}.webp" class="char-img"
                style="width:100%;height:100%;object-fit:cover;pointer-events:none"
                onerror="this.src='./assets/icons/chara_image/default.webp'">
            <img draggable="false" src="./assets/icons/personality/${char.personality}.webp"
                style="position:absolute;top:4px;left:4px;width:18px;height:18px;z-index:2;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3));pointer-events:none">
            ${eldIcon}
            <div style="position:absolute;bottom:4px;left:0;width:100%;padding:0 5px;display:flex;justify-content:space-between;align-items:center;z-index:2;pointer-events:none">
                <img draggable="false" src="./assets/icons/role/${char.role}.webp"
                    style="width:17px;height:17px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3));pointer-events:none">
                <img draggable="false" src="./assets/icons/line/${char.line}.webp"
                    style="width:17px;height:17px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3));pointer-events:none">
            </div>
            <div style="position:absolute;bottom:4px;width:100%;z-index:3;pointer-events:none">${_tmStarHTML(char.star)}</div>
        </div>
        <div class="card-bottom tm-card-bottom" style="pointer-events:none">
            <div class="tm-card-name">${char.name}</div>
        </div>
    </div>`;
}

// ── Render ────────────────────────────────────────────────────────────────────
function _tmRender() {
    const chars = window._tmDB || [];
    const getChar = name => chars.find(c => c.name === name);
    const n = _tiers.length;

    document.getElementById('tm-board').innerHTML = _tiers.map((t, i) => `
        <div class="tm-row">
            <div class="tm-lbl" style="background:${t.color}" onclick="window._tmStartRename('${t.id}')">
                <div class="tm-lbl-content">
                    <span id="tm-ls-${t.id}">${t.name}</span>
                    <span class="tm-lbl-edit-hint">✎</span>
                </div>
            </div>
            <div class="tm-zone" id="tm-z-${t.id}"
                ondragover="window._tmDragOver(event,'${t.id}')"
                ondragleave="window._tmDragLeave(event)"
                ondrop="window._tmDrop(event,'${t.id}')">
                ${t.chars.map(name => _tmCard(getChar(name))).join('')}
                ${t.chars.length === 0 ? '<span class="tm-zone-empty">드래그해서 놓기</span>' : ''}
                <div class="tm-add-slot" onclick="window._tmOpenAddModal('${t.id}')" title="미배치 사도 추가">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                </div>
            </div>
            <div class="tm-row-ctrl">
                <button class="tm-btn-gear" onclick="window._tmOpenPopup('${t.id}',this)"
                    aria-label="티어 설정" title="티어 설정">⚙</button>
                <button onclick="window._tmMoveRow('${t.id}',-1)" aria-label="위로" title="위로"
                    ${i === 0 ? 'disabled' : ''}>▲</button>
                <button onclick="window._tmMoveRow('${t.id}',1)" aria-label="아래로" title="아래로"
                    ${i === n - 1 ? 'disabled' : ''}>▼</button>
            </div>
        </div>`).join('');

    const TM_P_ORDER = ['순수', '냉정', '광기', '우울', '활발', '공명'];
    const vis = _pool.filter(nm => !_pFilter || nm.includes(_pFilter));
    let poolHTML = '';
    TM_P_ORDER.forEach(p => {
        const group = vis.filter(nm => { const c = getChar(nm); return c && c.personality === p; });
        if (!group.length) return;
        poolHTML += `<div class="tm-pool-group">
            <div class="tm-pool-group-hdr">
                <img draggable="false" src="./assets/icons/personality/${p}.webp" class="tm-pool-group-icon">
                <span>${p}</span>
            </div>
            <div class="tm-pool-group-cards">${group.map(nm => _tmCard(getChar(nm))).join('')}</div>
        </div>`;
    });
    document.getElementById('tm-pool').innerHTML = poolHTML ||
        `<span class="tm-zone-empty">${_pFilter ? `"${_pFilter}" 없음` : '미배치 없음'}</span>`;
}

// ── Drag & Drop ───────────────────────────────────────────────────────────────

// 멀티행 flex 그리드에서 커서와 가장 가까운 카드를 찾아 삽입 기준 반환
function _ghostTarget(zone, clientX, clientY) {
    const cards = [...zone.querySelectorAll('.tm-card')];
    if (!cards.length) return null; // 빈 존: 맨 뒤에 붙임
    let bestIdx = 0, bestDist = Infinity;
    cards.forEach((card, i) => {
        const r = card.getBoundingClientRect();
        const dist = Math.hypot(clientX - (r.left + r.width / 2), clientY - (r.top + r.height / 2));
        if (dist < bestDist) { bestDist = dist; bestIdx = i; }
    });
    const br = cards[bestIdx].getBoundingClientRect();
    if (clientX < br.left + br.width / 2) return cards[bestIdx];         // 해당 카드 앞
    return bestIdx < cards.length - 1 ? cards[bestIdx + 1] : null;       // 해당 카드 뒤 (null = 맨 뒤)
}

window._tmDragStart = function (e) {
    _dragging = e.currentTarget.dataset.name;
    setTimeout(() => e.currentTarget.classList.add('tm-dragging'), 0);
    e.dataTransfer.effectAllowed = 'move';
    _tmClosePopupEl();
};

window._tmDragEnd = function (e) {
    if (_dragRAF) { cancelAnimationFrame(_dragRAF); _dragRAF = null; }
    e.currentTarget.classList.remove('tm-dragging');
    document.querySelectorAll('.tm-over').forEach(el => el.classList.remove('tm-over'));
    if (_dragGhost && _dragGhost.parentNode) _dragGhost.parentNode.removeChild(_dragGhost);
    _dragGhost = null;
    // 유효 존에 드롭되지 않은 경우 (_tmDrop에서 null로 클리어됨) → 미배치 복귀
    if (_dragging) {
        const name = _dragging; _dragging = null;
        _tiers.forEach(t => { t.chars = t.chars.filter(n => n !== name); });
        if (!_pool.includes(name)) _pool.push(name);
        _tmRender();
    }
};

window._tmDragOver = function (e, tid) {
    e.preventDefault();
    e.stopPropagation();
    if (_dragRAF) return;
    const cx = e.clientX, cy = e.clientY;
    _dragRAF = requestAnimationFrame(() => {
        _dragRAF = null;
        document.querySelectorAll('.tm-over').forEach(el => el.classList.remove('tm-over'));

        const isPool = tid === 'pool';
        const zone = isPool ? document.getElementById('tm-pool') : document.getElementById('tm-z-' + tid);
        if (!zone) return;
        zone.classList.add('tm-over');
        if (isPool) return;

        if (!_dragGhost) {
            _dragGhost = document.createElement('div');
            _dragGhost.className = 'tm-drag-ghost';
        }

        const insertBefore = _ghostTarget(zone, cx, cy);
        const addSlot = zone.querySelector('.tm-add-slot');
        if (insertBefore) zone.insertBefore(_dragGhost, insertBefore);
        else if (addSlot) zone.insertBefore(_dragGhost, addSlot);
        else zone.appendChild(_dragGhost);

        const emptyEl = zone.querySelector('.tm-zone-empty');
        if (emptyEl) emptyEl.style.display = 'none';
    });
};

window._tmDragLeave = function (e) {
    if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.classList.remove('tm-over');
};

window._tmDrop = function (e, tid) {
    e.preventDefault();
    document.querySelectorAll('.tm-over').forEach(el => el.classList.remove('tm-over'));
    if (!_dragging) return;
    const name = _dragging; _dragging = null;

    // 고스트 위치로 삽입 인덱스 계산
    let insertIdx = -1;
    if (_dragGhost && _dragGhost.parentNode && tid !== 'pool') {
        const zone = _dragGhost.parentNode;
        const siblings = [...zone.children];
        const ghostPos = siblings.indexOf(_dragGhost);
        // 고스트 앞에 있는 tm-card 수 = 삽입 인덱스 (드래그 중인 카드 제외)
        insertIdx = siblings.slice(0, ghostPos).filter(
            el => el.classList.contains('tm-card') && el.dataset.name !== name
        ).length;
    }

    // 고스트 제거
    if (_dragGhost && _dragGhost.parentNode) _dragGhost.parentNode.removeChild(_dragGhost);
    _dragGhost = null;

    // 데이터 업데이트
    _tiers.forEach(t => { t.chars = t.chars.filter(n => n !== name); });
    _pool = _pool.filter(n => n !== name);

    if (tid === 'pool') {
        _pool.push(name);
    } else {
        const t = _tiers.find(t => t.id === tid);
        if (t) {
            if (insertIdx >= 0) t.chars.splice(insertIdx, 0, name);
            else t.chars.push(name);
        }
    }
    _tmRender();
};

// ── Tier Management ───────────────────────────────────────────────────────────
window._tmMoveRow = function (tierId, dir) {
    const i = _tiers.findIndex(t => t.id === tierId);
    const j = i + dir;
    if (j < 0 || j >= _tiers.length) return;
    [_tiers[i], _tiers[j]] = [_tiers[j], _tiers[i]];
    _tmRender();
};

window._tmStartRename = function (tierId) {
    const t = _tiers.find(t => t.id === tierId);
    if (!t) return;
    const spEl = document.getElementById('tm-ls-' + tierId);
    if (!spEl || spEl.tagName === 'INPUT') return;
    const inp = document.createElement('input');
    inp.value = t.name;
    inp.className = 'tm-lbl-input';
    inp.onclick = e => e.stopPropagation();
    inp.onkeydown = e => {
        if (e.key === 'Enter' || e.key === 'Escape') {
            if (e.key === 'Enter' && inp.value.trim()) t.name = inp.value.trim();
            _tmRender();
        }
    };
    inp.onblur = () => { if (inp.value.trim()) t.name = inp.value.trim(); _tmRender(); };
    spEl.replaceWith(inp);
    setTimeout(() => { inp.focus(); inp.select(); }, 10);
};

window._tmAddTier = function () {
    const cols = ['#EF4444','#8B5CF6','#10B981','#EC4899','#F97316','#06B6D4'];
    const id = 'tc' + Date.now();
    _tiers.push({ id, name: '새 티어', color: cols[_tiers.length % cols.length], chars: [] });
    _tmRender();
    setTimeout(() => window._tmStartRename(id), 30);
};

// ── Popup ─────────────────────────────────────────────────────────────────────
window._tmOpenPopup = function (tierId, btnEl) {
    if (_popupId === tierId) { _tmClosePopupEl(); return; }
    _popupId = tierId;
    const t = _tiers.find(t => t.id === tierId);
    if (!t) return;
    const popup  = document.getElementById('tm-popup');
    const modal  = document.getElementById('tm-modal');
    const bRect  = btnEl.getBoundingClientRect();
    const mRect  = modal.getBoundingClientRect();
    popup.style.top   = (bRect.bottom - mRect.top + modal.scrollTop + 4) + 'px';
    popup.style.right = (mRect.right - bRect.right + 2) + 'px';
    popup.innerHTML = `
        <p class="tm-popup-title">티어 설정 — ${t.name}</p>
        <div class="tm-popup-field">
            <span class="tm-popup-lbl">이름</span>
            <input class="tm-popup-input" value="${t.name.replace(/"/g,'&quot;')}"
                onchange="window._tmSetName('${tierId}',this.value)"
                onkeydown="if(event.key==='Enter')window._tmSetName('${tierId}',this.value)">
        </div>
        <div class="tm-popup-field">
            <span class="tm-popup-lbl">색상</span>
            <div class="tm-swatches">
                ${TM_SWATCH.map(c =>
                    `<div class="tm-sw${t.color === c ? ' tm-sw-active' : ''}" style="background:${c}"
                        onclick="window._tmSetColor('${tierId}','${c}')"></div>`
                ).join('')}
            </div>
        </div>
        <div class="tm-popup-divider"></div>
        <button class="tm-popup-btn" onclick="window._tmClearTier('${tierId}')">전체 미배치로 이동</button>
        <button class="tm-popup-btn tm-popup-btn-danger" onclick="window._tmDeleteTier('${tierId}')">티어 삭제</button>`;
    popup.style.display = 'block';
};

function _tmClosePopupEl() {
    _popupId = null;
    const p = document.getElementById('tm-popup');
    if (p) p.style.display = 'none';
}

window._tmSetName = function (tierId, val) {
    const t = _tiers.find(t => t.id === tierId);
    if (t && val.trim()) t.name = val.trim();
    _tmClosePopupEl();
    _tmRender();
};

window._tmSetColor = function (tierId, color) {
    const t = _tiers.find(t => t.id === tierId);
    if (t) t.color = color;
    _tmClosePopupEl();
    _tmRender();
};

window._tmClearTier = function (tierId) {
    const t = _tiers.find(t => t.id === tierId);
    if (t) { _pool.push(...t.chars); t.chars = []; }
    _tmClosePopupEl();
    _tmRender();
};

window._tmDeleteTier = function (tierId) {
    const t = _tiers.find(t => t.id === tierId);
    if (t) { _pool.push(...t.chars); _tiers = _tiers.filter(x => x.id !== tierId); }
    _tmClosePopupEl();
    _tmRender();
};

window._tmSetFilter = function (val) {
    _pFilter = val.trim();
    _tmRender();
};

// ── PNG Export ────────────────────────────────────────────────────────────────
window._tmExport = async function () {
    const SCALE   = 1.5;  // 출력 해상도 배수
    const LABEL_W = 140;
    const CARD_W  = 112;
    const CARD_H  = 112;
    const NAME_H  = 24;
    const PAD     = 9;
    const STRIDE  = CARD_W + PAD;
    const ICON_SZ = 20;
    const STAR_SZ = 15;

    const active = _tiers.filter(t => t.chars.length > 0);
    if (!active.length) { alert('배치된 캐릭터가 없습니다.'); return; }

    const chars = window._tmDB || [];

    const CPR = 10; // 행당 카드 수 고정

    // 필요한 이미지 전체 수집 후 일괄 프리로드
    const imgCache = {};
    const loadImg  = src => new Promise(resolve => {
        if (imgCache[src]) return resolve();
        const img = new Image();
        img.onload  = () => { imgCache[src] = img; resolve(); };
        img.onerror = () => resolve();
        img.src = src;
    });
    const paths = new Set();
    paths.add('./assets/icons/common_icons/star2.webp');
    paths.add('./assets/icons/common_icons/star3.webp');
    paths.add('./assets/icons/common_icons/Ingame_Icon_HeroGrow_Hidden.webp');
    active.forEach(t => t.chars.forEach(name => {
        const c = chars.find(ch => ch.name === name);
        paths.add(`./assets/icons/chara_image/초상화_${name}.webp`);
        if (!c) return;
        if (c.role) paths.add(`./assets/icons/role/${c.role}.webp`);
        if (c.line) paths.add(`./assets/icons/line/${c.line}.webp`);
    }));
    await Promise.all([...paths].map(loadImg));

    // 캔버스 크기 계산
    const ROW_H  = CARD_H + NAME_H + PAD;
    const tierHs = active.map(t => Math.max(1, Math.ceil(t.chars.length / CPR)) * ROW_H + PAD);
    const W = PAD + LABEL_W + CPR * STRIDE;
    const H = PAD + tierHs.reduce((a, b) => a + b, 0);

    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(W * SCALE);
    canvas.height = Math.round(H * SCALE);
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);  // 이후 모든 좌표는 논리 픽셀로 그리면 됨
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    ctx.fillStyle = isDark ? '#1a1a1a' : '#f4f5f9';
    ctx.fillRect(0, 0, W, H);

    // shadow helper
    const drawIcon = (src, ix, iy, sz) => {
        const im = imgCache[src];
        if (!im) return;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = 3;
        ctx.drawImage(im, ix, iy, sz, sz);
        ctx.restore();
    };

    let baseY = PAD;
    active.forEach(tier => {
        const th = tierHs.shift();

        // 티어 행 배경 (사이트의 .tm-row 스타일과 동일)
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.06)';
        ctx.shadowBlur  = 6;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle   = isDark ? '#212121' : '#FFFFFF';
        _rrect(ctx, PAD / 2, baseY, W - PAD, th - PAD, 10);
        ctx.fill();
        ctx.restore();
        // 테두리
        ctx.strokeStyle = isDark ? '#383838' : '#E5E7EB';
        ctx.lineWidth   = 1.5;
        _rrect(ctx, PAD / 2, baseY, W - PAD, th - PAD, 10);
        ctx.stroke();

        // 티어 라벨
        ctx.fillStyle = tier.color;
        _rrect(ctx, PAD / 2, baseY, LABEL_W - PAD, th - PAD, 10);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = "bold 17px 'OneMobilePop', sans-serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
            tier.name.length > 7 ? tier.name.slice(0, 7) + '…' : tier.name,
            PAD / 2 + (LABEL_W - PAD) / 2,
            baseY + (th - PAD) / 2
        );

        // 카드
        tier.chars.forEach((name, ci) => {
            const col   = ci % CPR;
            const row   = Math.floor(ci / CPR);
            const x     = PAD + LABEL_W + col * STRIDE;
            const y     = baseY + PAD / 2 + row * ROW_H;
            const char  = chars.find(c => c.name === name);
            const pData = (char && TM_P_COLORS[char.personality]) || TM_P_COLORS['공명'];
            const isRes = char && char.personality === '공명';
            const botY  = y + CARD_H;
            const CR    = 8; // corner radius

            // ① 카드 전체 그림자 (초상화 + 이름 영역 통합 경로)
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.18)';
            ctx.shadowBlur  = 10;
            ctx.shadowOffsetY = 4;
            ctx.fillStyle = isDark ? '#27272A' : '#FFFFFF';
            ctx.beginPath();
            ctx.moveTo(x + CR, y);
            ctx.lineTo(x + CARD_W - CR, y);
            ctx.arcTo(x + CARD_W, y,              x + CARD_W, y + CR,                  CR);
            ctx.lineTo(x + CARD_W, botY + NAME_H - CR);
            ctx.arcTo(x + CARD_W, botY + NAME_H,  x + CARD_W - CR, botY + NAME_H,      CR);
            ctx.lineTo(x + CR,    botY + NAME_H);
            ctx.arcTo(x,          botY + NAME_H,  x,          botY + NAME_H - CR,       CR);
            ctx.lineTo(x, y + CR);
            ctx.arcTo(x, y,       x + CR, y,                                             CR);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            // ② 성격 배경색 (초상화 영역, 라운드 클립)
            ctx.save();
            _rrect(ctx, x, y, CARD_W, CARD_H, CR);
            ctx.clip();
            if (isRes) {
                // 공명: 무지개 그라디언트 근사
                const g = ctx.createLinearGradient(x, y, x + CARD_W, y + CARD_H);
                g.addColorStop(0,   '#FFD1D1');
                g.addColorStop(0.2, '#FFFDCE');
                g.addColorStop(0.4, '#D1FFD1');
                g.addColorStop(0.6, '#D1FFFF');
                g.addColorStop(0.8, '#D1D1FF');
                g.addColorStop(1,   '#FFD1FF');
                ctx.fillStyle = g;
            } else {
                ctx.fillStyle = pData.bg || '#EEEEEE';
            }
            ctx.fillRect(x, y, CARD_W, CARD_H);
            ctx.restore();

            // ③ 초상화
            ctx.save();
            _rrect(ctx, x, y, CARD_W, CARD_H, CR);
            ctx.clip();
            const portrait = imgCache[`./assets/icons/chara_image/초상화_${name}.webp`];
            if (portrait) ctx.drawImage(portrait, x, y, CARD_W, CARD_H);
            ctx.restore();

            // ④ 성격 테두리 (초상화 위)
            ctx.strokeStyle = pData.border;
            ctx.lineWidth = 3;
            _rrect(ctx, x, y, CARD_W, CARD_H, CR);
            ctx.stroke();

            // ⑤ 이름 영역 배경 (하단 라운드)
            ctx.save();
            ctx.fillStyle = isDark ? '#27272A' : '#FFFFFF';
            ctx.beginPath();
            ctx.moveTo(x, botY);
            ctx.lineTo(x + CARD_W, botY);
            ctx.lineTo(x + CARD_W, botY + NAME_H - CR);
            ctx.arcTo(x + CARD_W, botY + NAME_H, x + CARD_W - CR, botY + NAME_H, CR);
            ctx.lineTo(x + CR, botY + NAME_H);
            ctx.arcTo(x, botY + NAME_H, x, botY + NAME_H - CR, CR);
            ctx.lineTo(x, botY);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            if (char) {
                // ⑥ 아이콘 오버레이 (성격 아이콘은 배경색으로 대체하므로 생략)
                if (char.role) drawIcon(`./assets/icons/role/${char.role}.webp`, x + 3, y + CARD_H - ICON_SZ - 3, ICON_SZ);
                if (char.line) drawIcon(`./assets/icons/line/${char.line}.webp`, x + CARD_W - ICON_SZ - 3, y + CARD_H - ICON_SZ - 3, ICON_SZ);
                if (char.Eldyne && char.Eldyne.trim() !== '' && char.Eldyne !== 'X')
                    drawIcon('./assets/icons/common_icons/Ingame_Icon_HeroGrow_Hidden.webp', x + CARD_W - ICON_SZ - 2, y + 2, ICON_SZ);

                // ⑦ 별 (초상화 하단 중앙)
                const starN = parseInt(char.star) || 0;
                if (starN > 0) {
                    const starImg = imgCache[`./assets/icons/common_icons/${starN >= 3 ? 'star3' : 'star2'}.webp`];
                    if (starImg) {
                        const OVR  = 2;
                        const totW = starN * STAR_SZ - (starN - 1) * OVR;
                        let sx = x + (CARD_W - totW) / 2;
                        const sy = y + CARD_H - STAR_SZ - 2;
                        ctx.save();
                        ctx.shadowColor = 'rgba(0,0,0,0.4)';
                        ctx.shadowBlur = 2;
                        for (let si = 0; si < starN; si++) {
                            ctx.drawImage(starImg, sx, sy, STAR_SZ, STAR_SZ);
                            sx += STAR_SZ - OVR;
                        }
                        ctx.restore();
                    }
                }
            }

            // ⑧ 이름 텍스트
            ctx.fillStyle = isDark ? '#e2e8f0' : '#1e293b';
            ctx.font = "600 12px 'OneMobilePop', sans-serif";
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
                name.length > 7 ? name.slice(0, 7) + '…' : name,
                x + CARD_W / 2, botY + NAME_H / 2
            );
        });

        baseY += th;
    });

    const a = document.createElement('a');
    a.download = '트릭컬_티어표.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
};

function _rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}

// ── 사도 추가 모달 ────────────────────────────────────────────────────────────

function _tmCardPickable(char) {
    if (!char) return '';
    const p     = TM_P_COLORS[char.personality] || TM_P_COLORS['공명'];
    const isRes = char.personality === '공명';
    const isEld = char.Eldyne && char.Eldyne.trim() !== '' && char.Eldyne !== 'X';
    const topSt = `background:${isRes ? 'none' : p.bg};border:3px solid ${p.border};border-bottom:none;box-sizing:border-box;`;
    const eldIcon = isEld
        ? `<img draggable="false" src="./assets/icons/common_icons/Ingame_Icon_HeroGrow_Hidden.webp" class="eldyne-corner-icon" style="pointer-events:none">`
        : '';
    const safeName = char.name.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    return `<div class="char-card tm-card tm-pick-card" draggable="false" data-name="${safeName}"
        onclick="window._tmPickChar(this.dataset.name)">
        <div class="${isRes ? 'card-top bg-resonance' : 'card-top'}" style="${topSt};pointer-events:none">
            <img draggable="false" src="./assets/icons/chara_image/초상화_${char.name}.webp" class="char-img"
                style="width:100%;height:100%;object-fit:cover;pointer-events:none"
                onerror="this.src='./assets/icons/chara_image/default.webp'">
            <img draggable="false" src="./assets/icons/personality/${char.personality}.webp"
                style="position:absolute;top:4px;left:4px;width:18px;height:18px;z-index:2;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3));pointer-events:none">
            ${eldIcon}
            <div style="position:absolute;bottom:4px;left:0;width:100%;padding:0 5px;display:flex;justify-content:space-between;align-items:center;z-index:2;pointer-events:none">
                <img draggable="false" src="./assets/icons/role/${char.role}.webp"
                    style="width:17px;height:17px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3));pointer-events:none">
                <img draggable="false" src="./assets/icons/line/${char.line}.webp"
                    style="width:17px;height:17px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3));pointer-events:none">
            </div>
            <div style="position:absolute;bottom:4px;width:100%;z-index:3;pointer-events:none">${_tmStarHTML(char.star)}</div>
        </div>
        <div class="card-bottom tm-card-bottom" style="pointer-events:none">
            <div class="tm-card-name">${char.name}</div>
        </div>
    </div>`;
}

function _tmRenderAddBody() {
    const chars  = window._tmDB || [];
    const getChar = nm => chars.find(c => c.name === nm);
    const ORDER  = ['순수', '냉정', '광기', '우울', '활발', '공명'];
    const vis    = _pool.filter(nm => !_addFilter || nm.includes(_addFilter));
    let html = '';
    ORDER.forEach(p => {
        const group = vis.filter(nm => { const c = getChar(nm); return c && c.personality === p; });
        if (!group.length) return;
        html += `<div class="tm-pool-group">
            <div class="tm-pool-group-hdr">
                <img draggable="false" src="./assets/icons/personality/${p}.webp" class="tm-pool-group-icon">
                <span>${p}</span>
            </div>
            <div class="tm-pool-group-cards">${group.map(nm => _tmCardPickable(getChar(nm))).join('')}</div>
        </div>`;
    });
    const body = document.getElementById('tm-add-pbody');
    if (body) body.innerHTML = html ||
        `<span class="tm-zone-empty">${_addFilter ? `"${_addFilter}" 없음` : '미배치 없음'}</span>`;
}

function _tmCloseAddOverlay() {
    const ov = document.getElementById('tm-add-overlay');
    if (ov) ov.style.display = 'none';
    _addTierId = null;
    _addFilter = '';
}
window._tmCloseAddModal = _tmCloseAddOverlay;

window._tmOpenAddModal = function (tierId) {
    _addTierId = tierId;
    _addFilter = '';
    const tier  = _tiers.find(t => t.id === tierId);
    const title = document.getElementById('tm-add-ptitle');
    if (title && tier) title.textContent = tier.name + ' 에 추가';
    const search = document.getElementById('tm-add-psearch');
    if (search) search.value = '';
    _tmRenderAddBody();
    const ov = document.getElementById('tm-add-overlay');
    if (ov) ov.style.display = 'flex';
};

window._tmAddSearch = function (val) {
    _addFilter = val.trim();
    _tmRenderAddBody();
};

window._tmPickChar = function (name) {
    if (!_addTierId) return;
    const tier = _tiers.find(t => t.id === _addTierId);
    if (!tier) return;
    _pool = _pool.filter(n => n !== name);
    tier.chars.push(name);
    _tmRender();
    _tmRenderAddBody();
};

// ── Popup 외부 클릭 닫기 ──────────────────────────────────────────────────────
document.addEventListener('click', e => {
    if (!_popupId) return;
    const popup = document.getElementById('tm-popup');
    if (popup && !popup.contains(e.target) && !e.target.closest('.tm-row-ctrl')) _tmClosePopupEl();
});

})();
