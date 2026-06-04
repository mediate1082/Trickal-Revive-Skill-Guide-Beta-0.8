let currentSkillMode = 'PvE'; // PvE로 고정
let currentApostle = null;
let currentDataContext = null;
window.activeAsideFilters = {
    targets: [],
    effects: []
};
// [컬러 가이드]
const COLORS = {
    low: '#22C55E',      // 저학년 테마
    high: '#16A34A',     // 고학년 테마 (PvE)
    pvp: '#A361FF',      // 고학년 테마 (PvP)
    normal: '#339af0',   // 일반공격 테마
    sliderBg: '#F1F5F9', // 슬라이더 배경 (옅은 회색)
    badge: '#333333',    // 레벨 뱃지 배경
    inset: 'rgba(0, 0, 0, 0.08)', // 음각 박스 깊이감
    textMain: '#020817'
};

// [추가] 색상 판별 함수 (파일 어디서든 접근 가능하도록 밖으로 추출)
const getGradeColor = (grade) => {
    if (!grade || grade === 'X') return '#94a3b8';
    if (grade.includes('10')) return '#22C55E';
    if (grade.includes('-')) return '#EF4444';
    return '#F59E0B';
};

// [추가] 뱃지 생성 함수 (파일 어디서든 접근 가능하도록 밖으로 추출)
const makeGradeBadge = (grade) => {
    if (!grade || grade.trim() === "" || grade === 'X') return '';
    return `<span class="tg-grade-badge" data-grade="${grade.trim()}">${grade}</span>`;
};

// [1] 자동 불렛 생성 헬퍼 함수
const formatDescWithBullets = (text) => {
    if (!text || text === 'X') return '';
    
    // 1. \n 또는 <br>로 문장을 나눕니다.
    const lines = text.split(/\\n|<br>|\n/);
    
    // 2. 각 줄 앞에 불렛(•)을 붙이고 다시 합칩니다.
    return lines
        .map(line => line.trim())
        .filter(line => line.length > 0) // 빈 줄 제거
        .map(line => `• ${line}`)         // 원하는 기호로 변경 가능
        .join('<br>');
};

// 개별 스킬별 부가 효과 카드 렌더링 함수
function renderEffectCard(type, skillInfo, buffString, condString, targetString, ctx, customContent = null, showBadge = false, isRecommend = false) {
    let iconPath = "", typeLabel = "", skillName = "";

    let typeBadgeHTML = "";
    if (type === 'low') {
        typeBadgeHTML = `<img class="tg-skill-card-icon-badge" src="./assets/icons/skill_type/저학년_아이콘.webp">`;
    } else if (type === 'high') {
        typeBadgeHTML = `<img class="tg-skill-card-icon-badge" src="./assets/icons/skill_type/고학년_아이콘.webp">`;
    }

    switch(type) {
        case 'low':
            iconPath = `./assets/icons/low_skill/${skillInfo?.low_skill_icon || 'default.webp'}`;
            typeLabel = "저학년 스킬"; skillName = skillInfo?.low_skill_name || "정보 없음";
            break;
        case 'high':
            iconPath = `./assets/images/${skillInfo?.high_skill_icon?.trim() || 'default.webp'}`;
            typeLabel = "고학년 스킬"; skillName = skillInfo?.high_skill_name || "정보 없음";
            break;
        case 'normal':
        case 'power':
            iconPath = `./assets/icons/atk_type/${currentApostle.atk_type || '물리'}.webp`;
            typeLabel = "일반 공격"; skillName = type === 'normal' ? "기본 공격" : "강화 공격";
            break;
        case 'aside': {
            const safeInfo = skillInfo || {};
            const fileName = safeInfo.aside2_icon || `어사이드_${currentApostle.name}_2.webp`;
            iconPath = `./assets/icons/aside/aside_2/${fileName}`;
            typeLabel = "어사이드 ★2"; skillName = safeInfo.aside2_name || "★2 추가 효과";
            break;
        }
    }

    const lvBadgeHTML = (showBadge && (type === 'low' || type === 'high'))
        ? `<div id="${type}-badge" class="tg-skill-card-icon-lv">Lv.1</div>`
        : '';

    const modeToggleHTML = (type === 'high' && showBadge)
        ? `<div class="tg-mode-switch-mini${currentSkillMode === 'PvP' ? ' is-pvp' : ''}" id="mode-toggle-btn">
               <label><input type="radio" name="skill-mode" value="PvE" ${currentSkillMode === 'PvE' ? 'checked' : ''} onchange="window.toggleSkillMode('PvE')">PvE</label>
               <label><input type="radio" name="skill-mode" value="PvP" ${currentSkillMode === 'PvP' ? 'checked' : ''} onchange="window.toggleSkillMode('PvP')">PvP</label>
               <div class="tg-mode-glider-mini"></div>
           </div>`
        : '';

    const gradeBadgeHTML = (isRecommend && (type === 'low' || type === 'high'))
        ? makeGradeBadge(currentApostle[type === 'low' ? 'low_grade' : 'high_grade'])
        : '';

    return `
    <div class="tg-skill-card" data-type="${type}">
        <div class="tg-skill-card-head">
            <div class="tg-skill-card-icon-wrap">
                <div class="tg-skill-card-icon-rel">
                    ${typeBadgeHTML}
                    <img class="tg-skill-card-icon" src="${iconPath}" onerror="this.src='./assets/icons/skills/default.webp'">
                    ${lvBadgeHTML}
                </div>
                <div class="tg-skill-card-titles">
                    <span class="tg-skill-card-type-label">${typeLabel}</span>
                    <div class="tg-skill-card-name-row">
                        <span class="tg-skill-card-name">${skillName}</span>
                        ${gradeBadgeHTML}
                    </div>
                </div>
            </div>
            ${modeToggleHTML}
        </div>
        <div class="tg-skill-card-body">
            ${customContent ? customContent : renderEffectItems(buffString, condString, targetString, ctx.allStateDB, ctx.debuffDescDB)}
            ${!customContent ? '<div class="tg-effect-empty">표시할 효과가 없습니다</div>' : ''}
        </div>
    </div>`;
}
// 상태이상 개별 아이템 음각 박스
function renderEffectItems(effectString, condString, targetString, allStateDB, debuffDescDB) {
    if (!effectString || effectString === 'X') return '';
    const names = effectString.split(',').map(s => s.trim());
    const conds = condString ? condString.split(',').map(s => s.trim()) : [];
    const targets = targetString ? targetString.split(',').map(s => s.trim()) : [];

    return names.map((raw, index) => {
        // 1. 원본 텍스트(예: "무적(개전)") 그대로 DB에 전용 설명이 있는지 먼저 검색
        let info = allStateDB.find(d => d.state_name === raw);

        // 2. 전용 정보가 없으면 괄호 제거 이름으로 재검색
        const pureName = raw.split('(')[0].trim();
        if (!info) info = allStateDB.find(d => d.state_name === pureName);

        // 3. 디버프 판별
        const isDebuff = (info && (info.type === "약화" || info.type === "제어" || info.type === "지속피해"))
                      || (debuffDescDB.some(d => d.state_name === pureName || d.state_name === raw));

        const defaultIcon = isDebuff ? '디버프_아이콘 없음.webp' : '버프_아이콘 없음.webp';
        const iconSrc = (info && info.icon_file)
            ? `./assets/icons/state/${info.icon_file}`
            : `./assets/icons/state/${defaultIcon}`;

        return `
        <div class="tg-effect-item" data-kind="${isDebuff ? 'debuff' : 'buff'}"
             data-cond="${conds[index] || ''}" data-target="${targets[index] || ''}">
            <div class="tg-effect-item-icon"><img src="${iconSrc}" onerror="this.src='./assets/icons/state/${defaultIcon}'"></div>
            <div class="tg-effect-item-body">
                <div class="tg-effect-item-head">
                    <strong class="tg-effect-item-name">${raw}</strong>
                    ${conds[index] ? `<span class="tg-effect-item-chip" data-kind="cond">${conds[index]}</span>` : ''}
                    ${targets[index] ? `<span class="tg-effect-item-chip" data-kind="target">${targets[index]}</span>` : ''}
                </div>
                <div class="tg-effect-item-desc">${info ? info.description : "상세 정보가 없습니다."}</div>
            </div>
        </div>`;
    }).join('');
}

// 어사이드 전용 헬퍼 함수 (전체 버전)
const renderAsideTabContent = (char, asideData) => {
    if (!asideData || !asideData.aside1_name) {
        return `
            <div class="tg-empty-state">
                <img src="./assets/icons/common_icons/empty.webp" onerror="this.src='./assets/icons/state/버프_아이콘 없음.webp'">
                <div class="tg-empty-state-text">아직 사념이 깊지 않은 것 같다...</div>
            </div>`;
    }

    let html = '';

    for (let i = 1; i <= 3; i++) {
        const name     = asideData[`aside${i}_name`];
        const icon     = asideData[`aside${i}_icon`];
        const desc     = asideData[`aside${i}_desc`];
        const template = asideData[`aside${i}_stat_template`];
        const value    = asideData[`aside${i}_stat_value`];

        if (!name) continue;

        html += `
            <div class="tg-aside-card">
                <div class="tg-skill-card-head">
                    <div class="tg-skill-card-icon-wrap">
                        <div class="tg-skill-card-icon-rel">
                            <img class="tg-skill-card-icon" src="./assets/icons/aside/aside_${i}/${icon}"
                                 onerror="this.src='./assets/icons/skills/default.webp'">
                        </div>
                        <div class="tg-skill-card-titles">
                            <span class="tg-skill-card-type-label">어사이드 ★${i}</span>
                            <span class="tg-skill-card-name">${name}</span>
                        </div>
                    </div>
                </div>
                <div class="tg-skill-card-body">
                    <div class="tg-aside-desc">${desc?.replace(/\\n/g, '<br>')}</div>
                    ${(template && value) ? `<div class="tg-skill-stat-box">${parseSkillLevelText(template, value)}</div>` : ''}
                    ${(i === 3 && asideData.aside_3_global) ? renderAsideGlobalBox(char, asideData) : ''}
                </div>
            </div>`;
    }
    return html;
};

function renderAsideGlobalBox(char, asideData) {
    const isEldyne = char.Eldyne && char.Eldyne.toString().trim() !== "";
    const rawGlobalValue = asideData.aside_3_global_value ? asideData.aside_3_global_value.toString().trim() : "";
    const statNames  = asideData.aside_3_global.split(',').map(s => s.trim());
    const statValues = rawGlobalValue !== "" ? rawGlobalValue.split(',').map(v => v.trim()) : [];

    const items = statNames.map((pureStat, idx) => {
        const currentVal = statValues[idx] || (isEldyne ? '4%' : '3%');
        const fullValStr = currentVal.startsWith('+') ? currentVal : '+' + currentVal;
        const numMatch   = fullValStr.match(/[0-9.]+/);
        const numberPart = numMatch ? numMatch[0] : "";
        const [prefix, suffix] = fullValStr.split(numberPart);
        return `
        <div class="tg-aside-global-item">
            <div class="tg-aside-global-item-left">
                <img src="./assets/icons/base_stat/${pureStat}.webp" onerror="this.src='./assets/icons/state/버프_아이콘 없음.webp'">
                <span class="tg-aside-global-item-label">전체 ${pureStat}</span>
            </div>
            <span class="tg-aside-global-item-value">${prefix}<span class="num">${numberPart}</span>${suffix}</span>
        </div>`;
    }).join('');

    return `
    <div class="tg-aside-global-box">
        <div class="tg-aside-global-title"><strong>사도 전체 능력치</strong></div>
        <div class="tg-aside-global-list">${items}</div>
        <div class="tg-aside-global-footer">사도 전체 능력치 효과는 모든 사도에게 적용됩니다.</div>
    </div>`;
}

export function openDetailModal(char, dataContext) {
    currentSkillMode = 'PvE';
    currentApostle = char;
    currentDataContext = dataContext;
    window.currentApostleName = char.name;
    const { debuffDB, buffDB, highSkillDB, lowSkillDB, allStateDB, debuffDescDB, normalAtkDB, asideDB } = dataContext;
    const apostleDebuffs = debuffDB.find(d => d.name.trim() === char.name.trim());
    const apostleBuffs = buffDB.find(b => b.name.trim() === char.name.trim());
    const skillData = highSkillDB.find(s => s['chara_name']?.trim() === char.name.trim());
    const lowSkillData = lowSkillDB ? lowSkillDB.find(s => s['chara_name']?.trim() === char.name.trim()) : null;
    const normalAtkData = normalAtkDB ? normalAtkDB.find(n => n.chara_name?.trim() === char.name.trim()) : null;
    const asideData = asideDB ? asideDB.find(a => a.chara_name?.trim() === char.name.trim()) : null;

    // 등급 → data-grade 속성값 변환
    const gradeToAttr = (grade) => {
        if (!grade || grade === 'X') return '7-';
        if (grade.includes('10')) return '10+';
        if (grade.includes('-')) return '7-';
        return '7+';
    };

    const getMergedSafe = (nameStr, condStr, targetStr) => {
        if (!nameStr || nameStr === 'X' || nameStr.trim() === '') return { names: [], conds: [], targets: [] };
        const names = nameStr.split(',').map(s => s.trim()).filter(s => s !== '');
        const rawConds = (condStr && condStr !== 'X') ? condStr.split(',').map(s => s.trim()) : [];
        const rawTargets = (targetStr && targetStr !== 'X') ? targetStr.split(',').map(s => s.trim()) : [];
        return { names, conds: names.map((_, i) => rawConds[i] || ""), targets: names.map((_, i) => rawTargets[i] || "") };
    };
    const combineTab1 = (type) => {
        const keys = { low: ['low_buff', 'low_debuff', 'low_cond', 'low_target'], high: ['high_buff', 'high_debuff', 'high_cond', 'high_target'], normal: ['normal_buff', 'normal_debuff', 'normal_cond', 'normal_target'], power: ['power_buff', 'power_debuff', 'power_cond', 'power_target'], aside: ['aside_passive', 'aside_passive', 'aside_cond', 'aside_target'] };
        const [bK, dK, cK, tK] = keys[type];
        const b = getMergedSafe(apostleBuffs?.[bK], apostleBuffs?.[cK], apostleBuffs?.[tK]);
        const d = getMergedSafe(apostleDebuffs?.[dK], apostleDebuffs?.[cK], apostleDebuffs?.[tK]);
        return { n: [...b.names, ...d.names].join(', '), c: [...b.conds, ...d.conds].join(', '), t: [...b.targets, ...d.targets].join(', ') };
    };

    // ── 종합-강화추천 탭 본문 빌더 ────────────────────────────────────────────
    function buildOverallBody(c) {
        // 메타픽([1]) · 성격덱([2]) 티어만 신규 UI 적용
        const isTargetTier = /^\[1\]|\[2\]/.test(c.tier || '');
        const hasNew = isTargetTier && (
            c.detail_role || c.pvp || c.invasion || c.colosseum ||
            c.col2_rim || c.col2_shady || c.frontier || c.art_main
        );

        // ── 구 방식 fallback (대상 티어 아니거나 신규 데이터 없을 때) ──
        if (!hasNew) {
            return `
                ${c.recommend_reason ? `<div class="tg-recommend-summary">
                    <strong>추천 레벨: ${c.recommend_lv}</strong>
                    <div>${c.recommend_reason}</div>
                </div>` : ''}
                ${c.note ? `<div class="tg-recommend-note">
                    ${c.note.replace(/\\n/g, '<br>').replace(/\n/g, '<br>')}
                </div>` : ''}`;
        }

        // ── 파싱 헬퍼 ──
        // "A|CC기 핵심픽" → { grade:'A', note:'CC기 핵심픽' }
        const parseScore = (raw) => {
            if (!raw) return null;
            const [grade, ...rest] = raw.split('|');
            return { grade: grade.trim(), note: rest.join('|').trim() };
        };

        // ── 1. 세부 역할 버블 ──
        const roleHTML = c.detail_role ? (() => {
            const chips = c.detail_role.split(',').map(t => t.trim()).filter(Boolean)
                .map(t => `<span class="tg-role-chip">${t}</span>`).join('');
            return `<div class="tg-overall-section">
                <div class="tg-overall-section-title">세부 역할</div>
                <div class="tg-role-chips">${chips}</div>
            </div>`;
        })() : '';

        // ── 2. 콘텐츠별 활용도 카드 그리드 ──
        const CONTENT_LIST = [
            { key: 'pvp',       label: '줘팸터',         cat: 'pvp',  icon: '⚔️' },
            { key: 'invasion',  label: '침략',            cat: 'pve',  icon: '🏰' },
            { key: 'colosseum', label: '차원대충돌',      cat: 'pve',  icon: '🌀' },
            { key: 'col2_rim',  label: '림의 차원',       cat: 'pve',  icon: '🌊' },
            { key: 'col2_shady',label: '셰이디의 차원',   cat: 'pve',  icon: '⭐' },
            { key: 'frontier',  label: '엘리아스 프론티어', cat: 'pve', icon: '🏆' },
        ];
        const hasContent = CONTENT_LIST.some(ci => c[ci.key]);
        const contentHTML = hasContent ? (() => {
            const cards = CONTENT_LIST.map((ci, idx) => {
                const score = parseScore(c[ci.key]);
                const checker = idx % 2 === 0 ? 'is-even' : 'is-odd';
                if (!score) return `<div class="tg-content-card ${checker} is-empty"></div>`;
                return `<div class="tg-content-card ${checker}">
                    <div class="tg-content-card-head">
                        <span class="tg-content-icon">${ci.icon}</span>
                        <span class="tg-content-name">${ci.label}</span>
                    </div>
                    <div class="tg-content-grade" data-grade="${score.grade}">${score.grade}</div>
                    ${score.note ? `<div class="tg-content-note">${score.note}</div>` : ''}
                </div>`;
            }).join('');
            return `<div class="tg-overall-section">
                <div class="tg-overall-section-title">콘텐츠별 활용도</div>
                <div class="tg-content-grid">${cards}</div>
            </div>`;
        })() : '';

        // ── 3. 아티팩트 추천 ──
        const renderArtCombo = (raw, note, label) => {
            if (!raw) return '';
            const arts = raw.split('|').map(a => a.trim());
            const slots = Array.from({length: 3}, (_, i) => {
                const name = arts[i] || '';
                return name
                    ? `<div class="tg-art-slot" data-name="${name}" title="${name}">
                           <img src="./assets/icons/artifacts/${name}.webp"
                                onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
                                alt="${name}">
                           <div class="tg-art-slot-fallback" style="display:none">${name.slice(0,2)}</div>
                       </div>`
                    : `<div class="tg-art-slot is-empty"></div>`;
            }).join('');
            return `<div class="tg-art-combo">
                <div class="tg-art-combo-label">${label}</div>
                <div class="tg-art-slots">${slots}</div>
                ${note ? `<div class="tg-art-combo-note">${note}</div>` : ''}
            </div>`;
        };

        const artHTML = c.art_main ? `<div class="tg-overall-section">
            <div class="tg-overall-section-title">아티팩트 추천</div>
            <div class="tg-art-section">
                ${renderArtCombo(c.art_main,  c.art_main_note,  '기본')}
                ${renderArtCombo(c.art_alt1,  c.art_alt1_note,  '대체 1')}
                ${renderArtCombo(c.art_alt2,  c.art_alt2_note,  '대체 2')}
            </div>
        </div>` : '';

        // ── 기존 note는 신규 데이터 있어도 보존 ──
        const noteHTML = c.note ? `<div class="tg-overall-section">
            <div class="tg-overall-section-title">종합 메모</div>
            <div class="tg-recommend-note">
                ${c.note.replace(/\\n/g, '<br>').replace(/\n/g, '<br>')}
            </div>
        </div>` : '';

        return `<div class="tg-overall-body">
            ${roleHTML}
            <div class="tg-overall-2col">
                <div class="tg-overall-left">${contentHTML}</div>
                <div class="tg-overall-right">${artHTML}</div>
            </div>
            ${noteHTML}
        </div>`;
    }

    // 3. 각 탭의 내용물(HTML) 미리 준비하기
    // [Tab 0 준비]
    const lowRecContent = `
    <div class="tg-recommend-box" data-grade="${gradeToAttr(char.low_grade)}">
        <div class="tg-recommend-box-title">강화 시 변경점</div>
        <div class="tg-recommend-box-body">${formatDescWithBullets(char.low_desc)}</div>
    </div>`;

    const highRecContent = `
    <div class="tg-recommend-box" data-grade="${gradeToAttr(char.high_grade)}">
        <div class="tg-recommend-box-title">강화 시 변경점</div>
        <div class="tg-recommend-box-body">${formatDescWithBullets(char.high_desc)}</div>
    </div>`;

    // [Tab 2 준비]
    const makeTicks = (max) => Array.from({length: max}, (_, i) => {
        const lv = i + 1;
        return `<div class="tg-lv-tick${(lv === 7 || lv === 10) ? ' is-major' : ''}"></div>`;
    }).join('');

    let lowDetail = "";
    if (lowSkillData) {
        let maxL = 1;
        for (let i = 1; i <= 13; i++) { if (lowSkillData[`Lv.${i}`]) maxL = i; }
        lowDetail = `
            <div class="tg-skill-desc">${lowSkillData.low_skill_desc?.replace(/\\n/g, '<br>')}</div>
            <div id="low-skill-stat-text" class="tg-skill-stat-box">${parseSkillLevelText(lowSkillData.low_skill_stat_template, lowSkillData['Lv.1'])}</div>
            <div class="tg-lv-slider" style="--lv-progress:0%">
                <input type="range" min="1" max="${maxL}" value="1" id="low-skill-slider" oninput="window.updateLowSkillLv(this.value, '${char.name}')">
                <div class="tg-lv-ticks">${makeTicks(maxL)}</div>
                <div class="tg-lv-slider-marks"><span>Lv.1</span><span>Lv.${maxL}</span></div>
            </div>`;
    }
    let highDetail = "";
    if (skillData) {
        let maxH = 1;
        for (let i = 1; i <= 13; i++) { if (skillData[`Lv.${i}(PvE)`]) maxH = i; }
        highDetail = `
            <div id="high-cooldown-text" class="tg-skill-cooldown"><img class="tg-skill-cooldown-icon" src="./assets/icons/common_icons/재사용 대기시간.webp" alt="">재사용 대기시간 <b>${skillData['high_cooldown(PvE)']}초</b></div>
            <div class="tg-skill-desc">${skillData['high_skill_desc']?.replace(/\\n/g, '<br>')}</div>
            <div id="high-skill-stat-text" class="tg-skill-stat-box">${parseSkillLevelText(skillData['high_skill_stat_template'], skillData['Lv.1(PvE)'])}</div>
            <div class="tg-lv-slider" style="--lv-progress:0%">
                <input type="range" min="1" max="${maxH}" value="1" id="high-skill-slider" oninput="window.updateHighSkillLv(this.value, '${char.name}')">
                <div class="tg-lv-ticks">${makeTicks(maxH)}</div>
                <div class="tg-lv-slider-marks"><span>Lv.1</span><span>Lv.${maxH}</span></div>
            </div>`;
    }
    let normalAtkHTML = "";
    if (normalAtkData) {
        const normalContent = `
            <div class="tg-normal-section">
                <div class="tg-skill-desc">${normalAtkData.basic_atk_desc ? normalAtkData.basic_atk_desc.replace(/\\n/g, '<br>') : ''}</div>
                <div class="tg-skill-stat-box">${parseSkillLevelText(normalAtkData.basic_stat_template, normalAtkData.basic_atk_value)}</div>
            </div>
            ${(normalAtkData.enhance_atk_desc && normalAtkData.enhance_atk_desc !== 'X') ? `
            <div class="tg-skill-card-divider"></div>
            <div class="tg-normal-section">
                <div class="tg-normal-sub-head">
                    <div class="tg-normal-sub-type">일반 공격</div>
                    <div class="tg-normal-sub-name">강화 공격</div>
                </div>
                <div class="tg-skill-desc">${normalAtkData.enhance_atk_desc.replace(/\\n/g, '<br>')}</div>
                <div class="tg-skill-stat-box">${parseSkillLevelText(normalAtkData.enhance_stat_template, normalAtkData.enhance_atk_value)}</div>
            </div>` : ''}`;
        normalAtkHTML = renderEffectCard('normal', { low_skill_name: "기본 공격" }, null, null, null, dataContext, normalContent, false);
    }

    // [Tab 1 준비]
    let hasEffects = false;
    const tab1ContentHTML = (() => {
        const types = ['low', 'high', 'normal', 'power'];
        let html = types.map(t => {
            const d = combineTab1(t);
            return (d.n && d.n !== 'X' && d.n.trim() !== "" ? renderEffectCard(t, t === 'low' ? lowSkillData : skillData, d.n, d.c, d.t, dataContext) : '');
        }).join('');
        if (char.has_aside && asideData) {
            const a = combineTab1('aside');
            if (a.n && a.n !== 'X' && a.n.trim() !== "") html += renderEffectCard('aside', asideData, a.n, a.c, a.t, dataContext);
        }
        if (!html.trim()) {
            return `
                <div class="tg-empty-state">
                    <img src="./assets/icons/common_icons/empty.webp" onerror="this.src='./assets/icons/state/버프_아이콘 없음.webp'">
                    <div class="tg-empty-state-text">부가 효과가 없어용...</div>
                </div>`;
        }
        hasEffects = true;
        return html;
    })();

    // [Tab 3 준비]
    const asideContentHTML = renderAsideTabContent(char, asideData);

    // 헤더 배지 데이터
    const tierDisplay = (char.tier || '').replace(/\[.*?\]\s*/g, '').trim();
    const eldyneName = char.Eldyne?.toString().trim();
    const iconEldyne = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 L13.5 10.5 L21 12 L13.5 13.5 L12 21 L10.5 13.5 L3 12 L10.5 10.5 Z"/></svg>`;
    const eldyneHTML = eldyneName
        ? `<span class="tg-detail-eldyne" data-eldyne="${eldyneName}"><span class="tg-detail-eldyne-icon">${iconEldyne}</span>${eldyneName}</span>`
        : '';

    const attrIcons = [
        { label: char.personality, path: `./assets/icons/personality/${char.personality}.webp` },
        { label: char.role,        path: `./assets/icons/role/${char.role}.webp` },
        { label: char.line,        path: `./assets/icons/line/${char.line}.webp` },
        { label: char.atk_type,   path: `./assets/icons/atk_type/공격 타입_${char.atk_type}.webp` },
    ];
    const attrsHTML = attrIcons.map(a => `
        <span class="tg-detail-attr">
            <img class="tg-detail-attr-icon" src="${a.path}" onerror="this.style.display='none'" alt="">
            <span>${a.label}</span>
        </span>`).join('');

    const iconX = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>`;
    const iconChevL = `<svg width="28" height="28" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="19 7 11 16 19 25"/><polyline points="25 7 17 16 25 25"/></svg>`;
    const iconChevR = `<svg width="28" height="28" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 7 21 16 13 25"/><polyline points="7 7 15 16 7 25"/></svg>`;

    // 4. 모달에 HTML 주입
    const overlay = document.getElementById('modal-detail');
    overlay.innerHTML = `
        <button class="tg-modal-nav prev" onclick="window.navigateApostle(-1)" aria-label="이전 사도">${iconChevL}</button>
        <button class="tg-modal-nav next" onclick="window.navigateApostle(1)" aria-label="다음 사도">${iconChevR}</button>
        <div class="tg-modal-card">
            <div class="tg-detail-header">
                <div class="tg-detail-header-row">
                    <img class="tg-detail-portrait" src="./assets/images/${char.name}.webp" onerror="this.src='./assets/images/default.webp'" alt="${char.name}">
                    <div class="tg-detail-meta">
                        <span class="tg-detail-eyebrow">APOSTLE DETAIL</span>
                        <div class="tg-detail-name-row">
                            <h2 class="tg-detail-name">${char.name}</h2>
                            <div class="tg-detail-tier-row">
                                <span class="tg-detail-tier" data-tier="${tierDisplay}">${tierDisplay}</span>
                                ${eldyneHTML}
                            </div>
                        </div>
                        <div class="tg-detail-attrs">${attrsHTML}</div>
                    </div>
                </div>
                <button class="tg-modal-close" onclick="window.closeDetailModal()" aria-label="닫기">${iconX}</button>
            </div>

            <div class="tg-detail-tabs-wrap">
                <div class="tg-segmented" id="detail-segmented">
                    <button class="tg-segmented-btn is-active" onclick="switchTab(0)">강화 추천</button>
                    <button class="tg-segmented-btn" onclick="switchTab(1)">부가 효과</button>
                    <button class="tg-segmented-btn" onclick="switchTab(2)">스킬 정보</button>
                    <button class="tg-segmented-btn" onclick="switchTab(3)">어사이드</button>
                    <div class="tg-segmented-indicator"></div>
                </div>
            </div>

            <div class="tg-modal-body">
                <div class="tg-quickfilters-row hidden" id="detail-quickfilters" data-has-effects="${hasEffects}">
                    <button class="tg-quickfilter-chip" id="flag-aside" onclick="window.toggleQuickFilter('aside')">
                        <span>A2 효과 제외</span><span class="tg-qf-suffix"> 됨<span class="tg-quickfilter-chip-check">✓</span></span>
                    </button>
                    <button class="tg-quickfilter-chip" id="flag-artifact" onclick="window.toggleQuickFilter('artifact')">
                        <span>애착 아티팩트 제외</span><span class="tg-qf-suffix"> 됨<span class="tg-quickfilter-chip-check">✓</span></span>
                    </button>
                    <button class="tg-quickfilter-chip" id="flag-self" onclick="window.toggleQuickFilter('self')">
                        <span>자신 대상 제외</span><span class="tg-qf-suffix"> 됨<span class="tg-quickfilter-chip-check">✓</span></span>
                    </button>
                </div>
                <div class="tg-scroll-area is-at-top">
                    <div class="tg-detail-scroll">
                        <div id="tab-0" class="tab-content">
                            ${renderEffectCard('low', lowSkillData, null, null, null, dataContext, lowRecContent, false, true)}
                            ${renderEffectCard('high', skillData, null, null, null, dataContext, highRecContent, false, true)}
                            <div class="tg-skill-card" data-type="overall">
                                <div class="tg-skill-card-head">
                                    <div class="tg-skill-card-icon-wrap">
                                        <div class="tg-skill-card-icon-rel">
                                            <img class="tg-skill-card-icon" src="./assets/images/${char.name}.webp" onerror="this.src='./assets/images/default.webp'">
                                        </div>
                                        <div class="tg-skill-card-titles">
                                            <span class="tg-skill-card-type-label">종합</span>
                                            <span class="tg-skill-card-name">강화 추천</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="tg-skill-card-body">
                                    ${buildOverallBody(char)}
                                </div>
                            </div>
                        </div>

                        <div id="tab-1" class="tab-content hidden">
                            ${tab1ContentHTML}
                        </div>

                        <div id="tab-2" class="tab-content hidden">
                            ${lowSkillData ? renderEffectCard('low', lowSkillData, null, null, null, dataContext, lowDetail, true) : ''}
                            ${skillData ? renderEffectCard('high', skillData, null, null, null, dataContext, highDetail, true) : ''}
                            ${normalAtkHTML}
                        </div>

                        <div id="tab-3" class="tab-content hidden">
                            ${asideContentHTML}
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

    // 5. 모달 표시
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    document.body.classList.add('modal-open');

    // 세그멘티드 인디케이터 초기 위치 + 사도 이동 슬라이드-인 애니메이션
    requestAnimationFrame(() => {
        updateSegmentedIndicator('detail-segmented');
        if (window._navDir !== undefined) {
            const card = overlay.querySelector('.tg-modal-card');
            if (card) {
                card.style.animation = window._navDir > 0
                    ? 'tg-slide-in-right 0.2s ease forwards'
                    : 'tg-slide-in-left 0.2s ease forwards';
            }
            window._navDir = undefined;
        }
    });

    // 스크롤 페이드 옵저버
    requestAnimationFrame(() => {
        const scrollArea = overlay.querySelector('.tg-scroll-area');
        const scrollEl = overlay.querySelector('.tg-detail-scroll');
        if (!scrollArea || !scrollEl || scrollEl._scrollFadeInit) return;
        scrollEl._scrollFadeInit = true;
        const updateFade = () => {
            const atTop = scrollEl.scrollTop <= 0;
            const atBottom = scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 1;
            scrollArea.classList.toggle('is-at-top', atTop);
            scrollArea.classList.toggle('is-at-bottom', atBottom);
        };
        scrollEl.addEventListener('scroll', updateFade, { passive: true });
        new ResizeObserver(updateFade).observe(scrollEl);
        updateFade();
    });
}

export function updateLowSkillLv(lv, name, lowSkillDB) {
    const info = lowSkillDB.find(s => s['chara_name']?.trim() === name.trim());
    if (!info) return;
    const rawVal = info[`Lv.${lv}`];
    const statBox = document.getElementById('low-skill-stat-text');
    const badge = document.getElementById('low-badge');
    if (statBox) statBox.innerHTML = parseSkillLevelText(info['low_skill_stat_template'], rawVal);
    if (badge) badge.innerText = `Lv.${lv}`;
    const slider = document.getElementById('low-skill-slider');
    if (slider) {
        const max = parseInt(slider.max);
        const progress = max > 1 ? (lv - 1) / (max - 1) : 0;
        slider.closest('.tg-lv-slider')?.style.setProperty('--lv-progress', (progress * 100).toFixed(1) + '%');
    }
}

export function updateHighSkillLv(lv, name, highSkillDB) {
    const info = highSkillDB.find(s => s['chara_name']?.trim() === name.trim());
    if (!info) return;
    const isPvE = currentSkillMode === 'PvE';
    const rawVal = info[`Lv.${lv}(${isPvE ? 'PvE' : 'PvP'})`];
    if (rawVal) {
        const statBox = document.getElementById('high-skill-stat-text');
        const badge = document.getElementById('high-badge');
        if (statBox) statBox.innerHTML = parseSkillLevelText(info['high_skill_stat_template'], rawVal);
        if (badge) badge.innerText = `Lv.${lv}`;
    }
    const slider = document.getElementById('high-skill-slider');
    if (slider) {
        const max = parseInt(slider.max);
        const progress = max > 1 ? (lv - 1) / (max - 1) : 0;
        slider.closest('.tg-lv-slider')?.style.setProperty('--lv-progress', (progress * 100).toFixed(1) + '%');
    }
}

window.toggleSkillMode = (mode) => {
    currentSkillMode = mode || (currentSkillMode === 'PvE' ? 'PvP' : 'PvE');
    const isPvE = currentSkillMode === 'PvE';
    const skillData = currentDataContext.highSkillDB.find(s => s['chara_name']?.trim() === currentApostle.name.trim());
    if (!skillData) return;

    // 1. tab-2 내 고학년 카드에만 is-pvp 토글 → --card-accent 자동 전환 (쿨다운·수치·슬라이더 컬러 일괄 반영)
    const highCard = document.querySelector('#tab-2 .tg-skill-card[data-type="high"]');
    if (highCard) highCard.classList.toggle('is-pvp', !isPvE);

    // 2. 모드 스위치 is-pvp 토글 + 라디오 동기화
    const modeSwitch = document.getElementById('mode-toggle-btn');
    if (modeSwitch) {
        modeSwitch.classList.toggle('is-pvp', !isPvE);
        modeSwitch.querySelectorAll('input[name="skill-mode"]').forEach(r => { r.checked = r.value === currentSkillMode; });
    }

    // 3. 쿨다운 텍스트 값 업데이트 (컬러는 CSS --card-accent 자동)
    const cooldownKey = isPvE ? 'high_cooldown(PvE)' : 'cooldown(PvP)';
    const cooldownText = document.getElementById('high-cooldown-text');
    if (cooldownText) cooldownText.innerHTML = `<img class="tg-skill-cooldown-icon" src="./assets/icons/common_icons/재사용 대기시간.webp" alt="">재사용 대기시간 <b>${skillData[cooldownKey]}초</b>`;

    // 4. 레벨 슬라이더 수치 업데이트 (컬러는 CSS --card-accent 자동)
    const slider = document.getElementById('high-skill-slider');
    if (slider) updateHighSkillLv(slider.value, currentApostle.name, currentDataContext.highSkillDB);
};

export function parseSkillLevelText(template, raw, color = '#e74c3c') {
    if (!template || !raw) return template || "정보 없음";
    let res = String(template).replace(/\\n/g, '<br>').replace(/\n/g, '<br>');
    const values = String(raw).split('\n').map(v => v.trim());
    values.forEach((v, i) => { res = res.split(`{${i}}`).join(`<b>${v}</b>`); });
    return res;
}

export function switchTab(idx) {
    const contents = document.querySelectorAll('#modal-detail .tab-content');
    const btns = document.querySelectorAll('#detail-segmented .tg-segmented-btn');
    const quickfilters = document.getElementById('detail-quickfilters');
    const scrollEl = document.querySelector('#modal-detail .tg-detail-scroll');

    contents.forEach((c, i) => i === idx ? c.classList.remove('hidden') : c.classList.add('hidden'));
    btns.forEach((b, i) => b.classList.toggle('is-active', i === idx));

    if (quickfilters) {
        const showFilters = idx === 1 && quickfilters.dataset.hasEffects === 'true';
        quickfilters.classList.toggle('hidden', !showFilters);
    }
    if (scrollEl) scrollEl.scrollTop = 0;

    updateSegmentedIndicator('detail-segmented');
}

// [1] 필터 데이터 정의 (항목 매칭용)
let currentAsideTab = 0;
const ASIDE_TARGETS = ['파티 전체', '전열 아군', '중열 아군', '후열 아군', '동일 성격 아군'];
const ASIDE_EFFECTS = [
    '주는 피해량 증가', '받는 피해량 감소', '받는 물리 피해량 감소', '받는 마법 피해량 감소',
    '스킬 피해량 증가', '공격 속도 증가', '최대 HP 증가', 'SP 회복량 증가',
    '치명타 증가', '치명 피해 증가', '치명타 저항 증가', '치명 피해 저항 증가'
];

// [2] 모달 열기
window.openAsideFilter = () => {
    document.getElementById('modal-aside-filter').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    document.body.classList.add('modal-open');
    window.switchAsideFilterTab(0);
    updateSegmentedIndicator('aside-segmented');
    const scroll = document.getElementById('aside-filter-scroll');
    if (scroll && !scroll._scrollFadeInit) {
        scroll._scrollFadeInit = true;
        scroll.addEventListener('scroll', () => {
            scroll.classList.toggle('is-scrolled', scroll.scrollTop > 0);
        }, { passive: true });
    }
};

// 세그멘티드 탭 인디케이터 슬라이드 (두 모달 공유)
export function updateSegmentedIndicator(segId) {
    const seg = document.getElementById(segId);
    if (!seg) return;
    const indicator = seg.querySelector('.tg-segmented-indicator');
    const btns = seg.querySelectorAll('.tg-segmented-btn');
    if (!indicator || btns.length === 0) return;
    const activeIdx = Array.from(btns).findIndex(b => b.classList.contains('is-active'));
    if (activeIdx < 0) return;
    const w = 100 / btns.length;
    indicator.style.width = `calc(${w}% - 8px)`;
    indicator.style.transform = `translateX(calc(${activeIdx * 100}% + ${activeIdx * 8}px))`;
}

// 어사이드 "무관" 배너 상태 갱신
function refreshAsideAnyOption() {
    const anyEl = document.getElementById('aside-any-option');
    const input = document.getElementById('aside-any-input');
    const set = currentAsideTab === 0 ? window.activeAsideFilters.targets : window.activeAsideFilters.effects;
    const isAny = set.length === 0 || set.some(v => v.includes('무관'));
    if (anyEl) anyEl.classList.toggle('is-active', isAny);
    if (input) input.checked = isAny;
}

// 어사이드 "모두 해제" 버튼 visibility 갱신
function refreshAsideClearAllBtn() {
    const btn = document.getElementById('aside-clear-all-btn');
    if (!btn) return;
    const set = currentAsideTab === 0 ? window.activeAsideFilters.targets : window.activeAsideFilters.effects;
    const count = set.filter(v => !v.includes('무관')).length;
    if (count > 0) {
        btn.style.visibility = 'visible'; btn.tabIndex = 0; btn.removeAttribute('aria-hidden');
        btn.textContent = `모두 해제 (${count})`;
    } else {
        btn.style.visibility = 'hidden'; btn.tabIndex = -1; btn.setAttribute('aria-hidden', 'true');
    }
}

// [3] 탭 전환 로직
window.switchAsideFilterTab = (idx) => {
    currentAsideTab = idx;
    const group = document.getElementById('aside-filter-group');
    const btns = document.querySelectorAll('.aside-tab');
    if (!group) return;

    btns.forEach((b, i) => b.classList.toggle('is-active', i === idx));
    updateSegmentedIndicator('aside-segmented');

    const scroll = document.getElementById('aside-filter-scroll');
    if (scroll) { scroll.scrollTop = 0; scroll.classList.remove('is-scrolled'); }

    const hint = document.getElementById('aside-any-hint');
    const sectionTitle = document.getElementById('aside-section-title');
    if (idx === 0) {
        if (hint) hint.textContent = '이 적용 대상은 필터링하지 않음';
        if (sectionTitle) sectionTitle.textContent = '대상 선택 · 단일 선택';
        group.innerHTML = ASIDE_TARGETS.map(t => renderAsideOption('targets', t, 'radio')).join('');
    } else {
        if (hint) hint.textContent = '이 적용 효과는 필터링하지 않음';
        if (sectionTitle) sectionTitle.textContent = '효과 선택 · 다중 선택';
        group.innerHTML = ASIDE_EFFECTS.map(e => renderAsideOption('effects', e, 'checkbox')).join('');
    }
    refreshAsideAnyOption();
    refreshAsideClearAllBtn();
    if (typeof window.updateAsideFilterCount === 'function') window.updateAsideFilterCount();
};

// [공통] 필터 체크박스 아이템 렌더링 — 두 필터 모달이 공유
export function renderFilterCheckbox(value, isChecked, onchangeAttr, prefixHTML = '') {
    return `<label class="filter-label">
        <input type="checkbox" value="${value}" ${isChecked ? 'checked' : ''} onchange="${onchangeAttr}">
        ${prefixHTML}<span style="margin-left: 4px;">${value}</span>
    </label>`;
}

// [4] 옵션 렌더링
const ASIDE_EFFECT_ICONS = {
    '주는 피해량 증가':      'assets/icons/state/버프_피해량 증가.webp',
    '받는 피해량 감소':      'assets/icons/state/버프_받는 피해량 감소.webp',
    '스킬 피해량 증가':      'assets/icons/state/버프_스킬 피해량 증가.webp',
    '받는 물리 피해량 감소':  'assets/icons/base_stat/물리 방어력.webp',
    '받는 마법 피해량 감소':  'assets/icons/base_stat/마법 방어력.webp',
    '공격 속도 증가':        'assets/icons/base_stat/공격 속도.webp',
    '최대 HP 증가':          'assets/icons/base_stat/HP.webp',
    'SP 회복량 증가':        'assets/icons/base_stat/SP.webp',
    '치명타 증가':           'assets/icons/base_stat/치명타.webp',
    '치명 피해 증가':        'assets/icons/base_stat/치명 피해.webp',
    '치명타 저항 증가':      'assets/icons/base_stat/치명타 저항.webp',
    '치명 피해 저항 증가':   'assets/icons/base_stat/치명 피해 저항.webp',
};

const ASIDE_TARGET_ICONS = {
    '파티 전체':    'assets/icons/line/전체열.webp',
    '전열 아군':    'assets/icons/line/전열.webp',
    '중열 아군':    'assets/icons/line/중열.webp',
    '후열 아군':    'assets/icons/line/후열.webp',
    '동일 성격 아군': 'assets/icons/personality/동일성격.webp',
};

function renderAsideOption(type, value, inputType = 'checkbox') {
    const isChecked = window.activeAsideFilters[type].includes(value);
    const iconMap = type === 'targets' ? ASIDE_TARGET_ICONS : ASIDE_EFFECT_ICONS;
    const iconPath = iconMap[value] ?? null;
    const iconHTML = iconPath
        ? `<img src="${iconPath}" alt="${value}" class="aside-line-icon">`
        : '';
    return `<label class="filter-label">
        <input type="${inputType}" value="${value}" ${isChecked ? 'checked' : ''} onchange="window.toggleAsideFilter('${type}', '${value}', this)">
        ${iconHTML}<span class="tg-name">${value}</span>
    </label>`;
}

// [5] 필터 토글 (무관 처리 포함)
window.toggleAsideFilter = (type, value, checkbox) => {
    // 어사이드 대상(targets)은 단일 선택 (라디오 동작)
    if (type === 'targets') {
        window.activeAsideFilters[type] = [value];
    } else {
        window.activeAsideFilters[type] = window.activeAsideFilters[type].filter(v => !v.includes('무관'));
        const index = window.activeAsideFilters[type].indexOf(value);
        if (index > -1) window.activeAsideFilters[type].splice(index, 1);
        else window.activeAsideFilters[type].push(value);
    }
    const tabIdx = type === 'targets' ? 0 : 1;
    window.switchAsideFilterTab(tabIdx);
};

// [6] 필터 적용 함수
window.applyAsideFilter = () => {
    const t = window.activeAsideFilters.targets.filter(v => !v.includes('무관')).length;
    const e = window.activeAsideFilters.effects.filter(v => !v.includes('무관')).length;
    const asideN = t + e;
    const asideCount = document.getElementById('modal-aside-count');
    if (asideCount) { if (asideN > 0) { asideCount.hidden = false; asideCount.textContent = `${asideN}개`; } else { asideCount.hidden = true; } }

    window.closeAsideFilter();

    if (typeof window.handleSortFilter === 'function') {
        window.handleSortFilter();
    }
};

// [7] 초기화 함수
window.resetAsideFilter = () => {
    window.activeAsideFilters = { targets: [], effects: [] };
    const asideCount = document.getElementById('modal-aside-count');
    if (asideCount) asideCount.hidden = true;
    window.switchAsideFilterTab(0);
    if (typeof window.handleSortFilter === 'function') {
        window.handleSortFilter();
    }
};

// [8] 어사이드 현재 탭 전체 해제
window.clearAsideFilter = () => {
    const key = currentAsideTab === 0 ? 'targets' : 'effects';
    window.activeAsideFilters[key] = [];
    window.switchAsideFilterTab(currentAsideTab);
};

window.addEventListener('click', (e) => {
    const asideModal = document.getElementById('modal-aside-filter');
    const filterModal = document.getElementById('modal-filter');
    const infoModal = document.getElementById('modal-info');
    const detailModal = document.getElementById('modal-detail');

    // 어사이드 필터 배경 클릭
    if (e.target === asideModal) {
        window.closeAsideFilter();
    }
    // 부가 효과 필터 배경 클릭 (main.js에 함수가 있다면 window로 호출)
    if (e.target === filterModal) {
        if (typeof window.closeFilterModal === 'function') window.closeFilterModal();
        else if (typeof closeFilterModal === 'function') closeFilterModal();
    }
    // 정보 모달 배경 클릭
    if (e.target === infoModal) {
        if (typeof window.closeModal === 'function') window.closeModal('modal-info');
        else if (typeof closeModal === 'function') closeModal('modal-info');
    }
    // 상세 정보 모달 배경 클릭
    if (e.target === detailModal) {
        window.closeDetailModal();
    }
});

window.closeDetailModal = () => {
    const overlay = document.getElementById('modal-detail');
    if (!overlay) return;
    overlay.classList.add('is-closing');
    setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.classList.remove('is-closing');
        document.body.style.overflow = '';
        document.body.classList.remove('modal-open');
        document.querySelectorAll('.tg-quickfilter-chip').forEach(c => c.classList.remove('is-active'));
        document.querySelectorAll('.tg-effect-item.is-hidden').forEach(i => i.classList.remove('is-hidden'));
    }, 200);
};

// closeAsideFilter
window.closeAsideFilter = () => {
    const modal = document.getElementById('modal-aside-filter');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
        document.body.classList.remove('modal-open');
    }
};

// "무관" 배너 클릭 핸들러
(function attachAnyOptionHandler() {
    const anyOption = document.getElementById('aside-any-option');
    if (!anyOption) return;
    anyOption.addEventListener('click', (e) => {
        e.preventDefault();
        const key = currentAsideTab === 0 ? 'targets' : 'effects';
        window.activeAsideFilters[key] = ['무관(상관없음)'];
        window.switchAsideFilterTab(currentAsideTab);
    });
})();


// 플래그 토글 및 블러 처리 함수
export function toggleQuickFilter(type) {
    const flag = document.getElementById(`flag-${type}`);
    if (!flag) return;

    flag.classList.toggle('is-active');
    const isActive = flag.classList.contains('is-active');
    
    const items = document.querySelectorAll('.tg-effect-item');
    items.forEach(item => {
        const cond = item.getAttribute('data-cond') || "";
        const target = item.getAttribute('data-target') || "";
        
        let shouldHide = false;
        if (type === 'aside' && (cond.includes('A2') || cond.includes('어사이드'))) shouldHide = isActive;
        if (type === 'artifact' && cond.includes('애착')) shouldHide = isActive;
        if (type === 'self' && target === '자신') shouldHide = isActive;

        if (shouldHide) {
            item.classList.add('is-hidden'); // 클래스명 변경
        } else {
            checkRemainingFilters(item);
        }
    });
}

// 모든 필터 조건을 검사해서 블러를 유지할지 결정
function checkRemainingFilters(item) {
    const cond = item.getAttribute('data-cond') || "";
    const target = item.getAttribute('data-target') || "";
    
    const asideActive = document.getElementById('flag-aside')?.classList.contains('is-active');
    const artActive = document.getElementById('flag-artifact')?.classList.contains('is-active');
    const selfActive = document.getElementById('flag-self')?.classList.contains('is-active');

    let stillNeedHide = false;
    if (asideActive && (cond.includes('A2') || cond.includes('어사이드'))) stillNeedHide = true;
    if (artActive && cond.includes('애착')) stillNeedHide = true;
    if (selfActive && target === '자신') stillNeedHide = true;

    if (!stillNeedHide) item.classList.remove('is-hidden');
}