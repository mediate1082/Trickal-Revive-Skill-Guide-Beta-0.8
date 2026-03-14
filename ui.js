let currentSkillMode = 'PvE'; // PvE로 고정
let currentApostle = null;
let currentDataContext = null;

// [컬러 가이드]
const COLORS = {
    low: '#22C55E',      // 저학년 테마
    high: '#16A34A',     // 고학년 테마 (PvE)
    pvp: '#D8B4FE',      // 고학년 테마 (PvP)
    normal: '#339af0',   // 일반공격 테마
    sliderBg: '#F1F5F9', // 슬라이더 배경 (옅은 회색)
    badge: '#333333',    // 레벨 뱃지 배경
    inset: 'rgba(0, 0, 0, 0.08)', // 음각 박스 깊이감
    textMain: '#020817'
};

// 개별 스킬별 부가 효과 카드 렌더링 함수
function renderEffectCard(type, skillInfo, buffString, condString, targetString, ctx, customContent = null, showBadge = false) {
    const { allStatusDB, debuffDescDB } = ctx;
    let iconPath = "", typeLabel = "", skillName = "", themeColor = "";
    
    // 타입 배지 (저학년/고학년 전용 아이콘)
   let typeBadgeHTML = "";
    if (type === 'low') {
        typeBadgeHTML = `<img src="./assets/icons/skill_type/저학년_아이콘.webp" style="position: absolute; top: -5px; left: -5px; width: 22px; height: 22px; z-index: 2;">`;
    } else if (type === 'high') {
        typeBadgeHTML = `<img src="./assets/icons/skill_type/고학년_아이콘.webp" style="position: absolute; top: -5px; left: -5px; width: 22px; height: 22px; z-index: 2;">`;
    }

   switch(type) {
        case 'low':
            iconPath = `./assets/icons/low_skill/${skillInfo?.low_skill_icon || 'default.webp'}`;
            typeLabel = "저학년 스킬";
            skillName = skillInfo?.low_skill_name || "정보 없음";
            themeColor = COLORS.low;
            break;
        case 'high':
            iconPath = `./assets/images/${skillInfo?.high_skill_icon?.trim() || 'default.webp'}`;
            typeLabel = "고학년 스킬";
            skillName = skillInfo?.high_skill_name || "정보 없음";
            themeColor = currentSkillMode === 'PvE' ? COLORS.high : COLORS.pvp;
            break;
        case 'normal':
        case 'power':
            iconPath = `./assets/icons/atk_type/${currentApostle.atk_type || '물리'}.webp`;
            typeLabel = "일반 공격";
            skillName = type === 'normal' ? "기본 공격" : "강화 공격";
            themeColor = '#84CC16';
            break;
        case 'aside':
            const safeInfo = skillInfo || {}; 
            const fileName = safeInfo.aside2_icon || `어사이드_${currentApostle.name}_2.webp`;
            iconPath = `./assets/icons/aside/aside_2/${fileName}`; 
            typeLabel = "어사이드 ★2";
            skillName = safeInfo.aside2_name || "★2 추가 효과";
            themeColor = '#A855F7';
            break;
    }

    return `
        <div style="background: #ffffff; border-radius: 15px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); margin-bottom: 15px;">
            <div style="display: flex; gap: 15px; align-items: center; min-height: 58px; margin-bottom: 15px;">
                <div style="position: relative; flex-shrink: 0;">
                    ${typeBadgeHTML}
                    <img src="${iconPath}" 
                         style="width: 58px; height: 58px; border-radius: 12px; border: 3px solid ${themeColor}; object-fit: cover;" 
                         onerror="this.src='./assets/icons/skills/default.webp'">
                    ${(showBadge && (type === 'low' || type === 'high')) ? `<div id="${type}-badge" style="position: absolute; right: -5px; bottom: -5px; background: ${COLORS.badge}; color: white; font-size: 0.75rem; font-weight: bold; padding: 3px 7px; border-radius: 7px; border: 1px solid rgba(255,255,255,0.2); z-index:3;">Lv.1</div>` : ''}
                </div>
                <div style="display: flex; flex-direction: column; justify-content: center; gap: 2px;">
                    <span style="font-size: 0.85rem; font-weight: bold; color: ${themeColor};">${typeLabel}</span>
                    <span style="font-size: 1.3rem; font-weight: 800; color: ${COLORS.textMain}; line-height: 1.2;">${skillName}</span>
                </div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 12px;">
                ${customContent ? customContent : renderEffectItems(buffString, condString, targetString, allStatusDB, debuffDescDB)}
            </div>
        </div>`;
}

// 상태이상 개별 아이템 음각 박스 (좌측 컬러 바 적용)
function renderEffectItems(effectString, condString, targetString, allStatusDB, debuffDescDB) {
    if (!effectString || effectString === 'X') return '';
    const names = effectString.split(',').map(s => s.trim());
    const conds = condString ? condString.split(',').map(s => s.trim()) : [];
    const targets = targetString ? targetString.split(',').map(s => s.trim()) : [];

    return names.map((raw, index) => {
        const pureName = raw.split('(')[0].trim();
        const info = allStatusDB.find(d => d.status_name === pureName);
        const isDebuff = (info && (info.type === "약화" || info.type === "제어" || info.type === "지속피해")) || (debuffDescDB.some(d => d.status_name === pureName));
        const accentColor = isDebuff ? "#FC6881" : "#3488F0"; 
        const iconSrc = (info && info.icon_file) ? `./assets/icons/status/${info.icon_file}` : `./assets/icons/status/버프_아이콘 없음.webp`;

        return `
            <div style="position: relative; background: #f8f9fa; border-radius: 12px; padding: 12px 12px 12px 18px; 
                        box-shadow: inset 0 2px 5px ${COLORS.inset}, inset 3px 0 0 ${accentColor}; 
                        border: 1px solid rgba(0,0,0,0.03); display: flex; align-items: flex-start; gap: 12px; overflow: hidden;">
                <img src="${iconSrc}" style="width: 34px; height: 34px; flex-shrink: 0;" onerror="this.src='./assets/icons/status/버프_아이콘 없음.webp';">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 4px;">
                        <strong style="color: ${COLORS.textMain}; font-size: 1rem;">${raw}</strong>
                        ${conds[index] ? `<span style="font-size: 0.7rem; background: #fff3e0; color: #e65100; padding: 2px 6px; border-radius: 6px; font-weight: bold;">${conds[index]}</span>` : ''}
                        ${targets[index] ? `<span style="font-size: 0.7rem; background: #DCFCE7; color: #166534; padding: 2px 6px; border-radius: 6px; font-weight: bold;">${targets[index]}</span>` : ''}
                    </div>
                    <div style="font-size: 0.88rem; color: #555; line-height: 1.5; word-break: keep-all;">
                        ${info ? info.description : "상세 정보가 없습니다."}
                    </div>
                </div>
            </div>`;
    }).join('');
}


export function openDetailModal(char, dataContext) {
    currentApostle = char;
    currentDataContext = dataContext;

    const { debuffDB, buffDB, highSkillDB, lowSkillDB, allStatusDB, debuffDescDB, normalAtkDB, asideDB } = dataContext;
    const apostleDebuffs = debuffDB.find(d => d.name.trim() === char.name.trim());
    const apostleBuffs = buffDB.find(b => b.name.trim() === char.name.trim());
    const skillData = highSkillDB.find(s => s['chara_name']?.trim() === char.name.trim());
    const lowSkillData = lowSkillDB ? lowSkillDB.find(s => s['chara_name']?.trim() === char.name.trim()) : null;
    const normalAtkData = normalAtkDB ? normalAtkDB.find(n => n.chara_name?.trim() === char.name.trim()) : null;
    const asideData = asideDB ? asideDB.find(a => a.chara_name?.trim() === char.name.trim()) : null;

    const body = document.getElementById('detail-body');
    const tierColor = (tier => {
        if (!tier) return '#888'; 
        if (tier.includes('메타픽')) return '#E91E63';
        if (tier.includes('성격덱')) return '#2980B9';
        return '#e67e22';
    })(char.tier);

    const getGradeClass = (g) => g === 'O' ? 'color-O' : g === '△' ? 'color-delta' : g === 'X' ? 'color-X' : '';
    const makeBadge = (grade) => `<span style="display: inline-flex; justify-content: center; align-items: center; width: 28px; height: 28px; border-radius: 50%; background: #fff; border: 2px solid currentColor; margin-right: 10px; font-size: 1rem; font-weight: bold;" class="${getGradeClass(grade)}">${grade || '?'}</span>`;

    // --- [콘텐츠 준비: Tab 0] ---
    const lowRecContent = `<div style="position: relative; background: #f8f9fa; border-radius: 12px; padding: 12px 18px; box-shadow: inset 0 2px 5px ${COLORS.inset}, inset 3px 0 0 ${char.low_grade === 'O' ? '#22C55E' : char.low_grade === '△' ? '#F59E0B' : '#EF4444'}; border: 1px solid rgba(0,0,0,0.03);"><div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">${makeBadge(char.low_grade)} <strong style="color: ${COLORS.textMain};">강화 가이드</strong></div><div style="font-size: 0.88rem; color: #555; line-height: 1.6;">${(char.low_desc || '').split('↑').join('↑<br>')}</div></div>`;
    const highRecContent = `<div style="position: relative; background: #f8f9fa; border-radius: 12px; padding: 12px 18px; box-shadow: inset 0 2px 5px ${COLORS.inset}, inset 3px 0 0 ${char.high_grade === 'O' ? '#22C55E' : char.high_grade === '△' ? '#F59E0B' : '#EF4444'}; border: 1px solid rgba(0,0,0,0.03);"><div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">${makeBadge(char.high_grade)} <strong style="color: ${COLORS.textMain};">강화 가이드</strong></div><div style="font-size: 0.88rem; color: #555; line-height: 1.6;">${(char.high_desc || '').split('↑').join('↑<br>')}</div></div>`;

    // --- [콘텐츠 준비: Tab 1] ---
    const getMergedSafe = (nameStr, condStr, targetStr) => {
        if (!nameStr || nameStr === 'X') return { names: [], conds: [], targets: [] };
        const names = nameStr.split(',').map(s => s.trim());
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

    // --- [콘텐츠 준비: Tab 2] ---
    let lowDetail = "";
    if (lowSkillData) {
        let maxL = 1; for (let i = 1; i <= 13; i++) { if (lowSkillData[`Lv.${i}`]) maxL = i; }
        lowDetail = `
            <div style="font-size: 0.9rem; color: #666; line-height: 1.6; margin-bottom: 12px;">${lowSkillData.low_skill_desc?.replace(/\\n/g, '<br>')}</div>
            <div id="low-skill-stat-text" style="background: #f8f9fa; border-radius: 12px; padding: 14px; font-size: 0.95rem; box-shadow: inset 0 2px 5px ${COLORS.inset}; border: 1px solid rgba(0,0,0,0.03);">
                ${parseSkillLevelText(lowSkillData.low_skill_stat_template, lowSkillData['Lv.1'], COLORS.low)}
            </div>
            <div style="margin-top: 20px;">
                <input type="range" min="1" max="${maxL}" value="1" style="width:100%; accent-color:${COLORS.low};" oninput="window.updateLowSkillLv(this.value, '${char.name}')">
                <div style="display: flex; justify-content: space-between; color: #adb5bd; font-size: 0.75rem; margin-top: 8px; font-weight: bold;"><span>Lv.1</span><span>Lv.${maxL}</span></div>
            </div>`;
    }
    let highDetail = "";
    if (skillData) {
        let maxH = 1; const dbM = currentSkillMode === 'PvE' ? 'PvE' : 'PvP'; for (let i = 1; i <= 13; i++) { if (skillData[`Lv.${i}(${dbM})`]) maxH = i; }
        const themeC = currentSkillMode === 'PvE' ? COLORS.high : COLORS.pvp;
        highDetail = `
            <div id="high-cooldown-text" style="font-size: 0.85rem; color: #495057; font-weight: bold; margin-bottom: 10px;">재사용 대기시간 <span style="color: ${themeC}">${skillData[currentSkillMode === 'PvE' ? 'high_cooldown(PvE)' : 'cooldown(PvP)']}초</span></div>
            <div style="font-size: 0.9rem; color: #666; line-height: 1.6; margin-bottom: 12px;">${skillData['high_skill_desc']?.replace(/\\n/g, '<br>')}</div>
            <div id="high-skill-stat-text" style="background: #f8f9fa; border-radius: 12px; padding: 14px; font-size: 0.95rem; box-shadow: inset 0 2px 5px ${COLORS.inset}; border: 1px solid rgba(0,0,0,0.03);">
                ${parseSkillLevelText(skillData['high_skill_stat_template'], skillData[`Lv.1(${currentSkillMode})`], themeC)}
            </div>
            <div style="margin-top: 20px;">
                <input type="range" min="1" max="${maxH}" value="1" id="high-skill-slider" style="width:100%; accent-color:${themeC};" oninput="window.updateHighSkillLv(this.value, '${char.name}')">
                <div style="display: flex; justify-content: space-between; color: #adb5bd; font-size: 0.75rem; margin-top: 8px; font-weight: bold;"><span>Lv.1</span><span id="high-max-lv-display">Lv.${maxH}</span></div>
            </div>`;
    }

    // --- [메인 렌더링] ---
    body.innerHTML = `
        <div style="display: flex; gap: 20px; align-items: center; margin-bottom: 20px;">
            <img src="./assets/images/${char.name}.webp" style="width: 110px; height: 110px; border-radius: 20px; object-fit: cover; box-shadow: 0 4px 12px rgba(0,0,0,0.12);" onerror="this.src='./assets/images/default.webp'">
            <div>
                <h2 style="margin: 0; font-size: 1.6rem;">${char.name}</h2>
                <p style="margin: 5px 0; font-weight: bold; font-size: 1.1rem; color: ${tierColor};">${char.tier || ''}</p>
                <p style="margin: 0; color: #666; font-size: 0.9rem;">${char.personality} | ${char.role} | ${char.line}</p>
            </div>
        </div>

        <div class="modal-tabs">
            <button class="tab-btn active" onclick="switchTab(0)">강화 추천</button>
            <button class="tab-btn" onclick="switchTab(1)">부가 효과</button>
            <button class="tab-btn" onclick="switchTab(2)">상세 설명</button>
        </div>

        <div id="tab-0" class="tab-content" style="background: #f1f3f5; padding: 15px; border-radius: 20px;">
            ${renderEffectCard('low', lowSkillData, null, null, null, dataContext, lowRecContent)}
            ${renderEffectCard('high', skillData, null, null, null, dataContext, highRecContent)}
            <div style="background: #ffffff; border-radius: 15px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                 <div style="display: flex; gap: 15px; align-items: center; margin-bottom: 15px;">
                     <img src="./assets/images/${char.name}.webp" style="width: 58px; height: 58px; border-radius: 12px; border: 3px solid #e67e22; object-fit: cover;">
                     <div style="display: flex; flex-direction: column;"><span style="font-size: 0.85rem; font-weight: bold; color: #e67e22;">종합 가이드</span><span style="font-size: 1.3rem; font-weight: 800; color: ${COLORS.textMain};">성장 요약</span></div>
                 </div>
                 ${char.recommend_reason ? `<div style="background: #f8f9fa; border-radius: 12px; padding: 12px 18px; box-shadow: inset 0 2px 5px ${COLORS.inset}, inset 3px 0 0 #e67e22; margin-bottom: 10px;"><strong style="color:#e67e22;">💡 추천 레벨: ${char.recommend_lv}</strong><div style="font-size:0.88rem;">${char.recommend_reason.split('↑').join('↑<br>')}</div></div>` : ''}
                 ${char.note ? `<div style="background: #fffbe6; border-radius: 12px; padding: 12px 18px; box-shadow: inset 0 2px 5px ${COLORS.inset}, inset 3px 0 0 #fadb14;"><strong style="color:#856404;">📝 참고사항</strong><div style="font-size:0.88rem;">${char.note.split('↑').join('↑<br>')}</div></div>` : ''}
            </div>
        </div>

        <div id="tab-1" class="tab-content hidden" style="background: #f1f3f5; padding: 15px; border-radius: 20px;">
            ${['low','high','normal','power'].map(t => {
                const d = combineTab1(t);
                const has = (t==='low' && apostleBuffs?.low_buff !== 'X') || (t==='high' && apostleBuffs?.high_buff !== 'X') || (t==='normal' && apostleBuffs?.normal_buff !== 'X') || (t==='power' && apostleBuffs?.power_buff !== 'X');
                return (d.n ? renderEffectCard(t, t==='low'?lowSkillData:skillData, d.n, d.c, d.t, dataContext) : '');
            }).join('')}
           ${(char.has_aside && asideData) ? (()=>{ 
            const a = combineTab1('aside'); 
            // 실제 효과 이름(a.n)이 존재하고 'X'가 아닐 때만 카드를 생성합니다.
            if (a.n && a.n !== 'X') {
                return renderEffectCard('aside', asideData, a.n, a.c, a.t, dataContext); 
            }
            return ''; // 내용 없으면 빈 문자열 반환
            })() : ''}
        </div>

        <div id="tab-2" class="tab-content hidden" style="background: #f1f3f5; padding: 15px; border-radius: 20px;">
            ${lowSkillData ? renderEffectCard('low', lowSkillData, null, null, null, dataContext, lowDetail, true) : ''}
            ${skillData ? renderEffectCard('high', skillData, null, null, null, dataContext, highDetail, true) : ''}
            
            ${typeof normalAtkHTML !== 'undefined' ? normalAtkHTML : ''}
        </div>
    `;

    document.getElementById('modal-detail').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

export function updateLowSkillLv(lv, name, lowSkillDB) {
    const info = lowSkillDB.find(s => s['chara_name']?.trim() === name.trim());
    if (!info) return;
    const rawVal = info[`Lv.${lv}`];
    const statBox = document.getElementById('low-skill-stat-text');
    const badge = document.getElementById('low-badge');
    if (statBox) statBox.innerHTML = parseSkillLevelText(info['low_skill_stat_template'], rawVal, COLORS.low);
    if (badge) badge.innerText = `Lv.${lv}`;
}

export function updateHighSkillLv(lv, name, highSkillDB) {
    const info = highSkillDB.find(s => s['chara_name']?.trim() === name.trim());
    if (!info) return;
    const isPvE = currentSkillMode === 'PvE';
    const themeColor = isPvE ? COLORS.high : COLORS.pvp;
    const rawVal = info[`Lv.${lv}(${isPvE ? 'PvE' : 'PvP'})`]; 
    if (rawVal) {
        const statBox = document.getElementById('high-skill-stat-text');
        const badge = document.getElementById('high-badge');
        if (statBox) statBox.innerHTML = parseSkillLevelText(info['high_skill_stat_template'], rawVal, themeColor);
        if (badge) badge.innerText = `Lv.${lv}`;
    }
}

window.toggleSkillMode = () => {
    currentSkillMode = (currentSkillMode === 'PvE') ? 'PvP' : 'PvE';
    const isPvE = currentSkillMode === 'PvE';
    const skillData = currentDataContext.highSkillDB.find(s => s['chara_name']?.trim() === currentApostle.name.trim());
    if (!skillData) return;

    const themeColor = isPvE ? COLORS.high : COLORS.pvp;
    const currentLabelColor = isPvE ? COLORS.pve_label : COLORS.pvp;
    const cooldownKey = isPvE ? 'high_cooldown(PvE)' : 'cooldown(PvP)';

const toggleBtn = document.getElementById('mode-toggle-btn');
    if (toggleBtn) {
        toggleBtn.style.background = themeColor;
        
        const knob = toggleBtn.querySelector('div');
        knob.style.left = isPvE ? '4px' : '40px';
        
        const span = toggleBtn.querySelector('span');
        span.innerText = currentSkillMode;
        
        span.style.textAlign = isPvE ? 'right' : 'left';
        
        span.style.padding = isPvE ? '0 10px 0 0' : '0 0 0 10px';
    }
    const cooldownText = document.getElementById('high-cooldown-text');
    if (cooldownText) {
        cooldownText.innerHTML = `재사용 대기시간 <span style="color: ${themeColor}">${skillData[cooldownKey]}초</span>`;
    }
    const slider = document.getElementById('high-skill-slider');
    if (slider) {
        let maxHighLv = 1;
        for (let i = 1; i <= 13; i++) {
            if (skillData[`Lv.${i}(${currentSkillMode})`] && String(skillData[`Lv.${i}(${currentSkillMode})`]).trim() !== "") maxHighLv = i;
        }
        slider.max = maxHighLv;
        slider.style.accentColor = themeColor;
        document.getElementById('high-max-lv-display').innerText = `Lv.${maxHighLv}`;
        updateHighSkillLv(slider.value, currentApostle.name, currentDataContext.highSkillDB);
    }
};

export function parseSkillLevelText(template, raw, color = '#e74c3c') {
    if (!template || !raw) return template || "정보 없음";
    let res = String(template).replace(/\\n/g, '<br>').replace(/\n/g, '<br>');
    const values = String(raw).split('\n').map(v => v.trim());
    values.forEach((v, i) => { res = res.split(`{${i}}`).join(`<b style="color:${color}; font-size: 1.05rem;">${v}</b>`); });
    return res;
}

export function switchTab(idx) {
    const contents = document.querySelectorAll('#modal-detail .tab-content');
    const btns = document.querySelectorAll('#modal-detail .tab-btn');
    contents.forEach((c, i) => i === idx ? c.classList.remove('hidden') : c.classList.add('hidden'));
    btns.forEach((b, i) => i === idx ? b.classList.add('active') : b.classList.remove('active'));
}
