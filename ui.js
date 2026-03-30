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
    const bgColor = getGradeColor(grade);
    return `
        <span style="
            display: inline-flex; align-items: center; justify-content: center;
            padding: 2px 10px; border-radius: 12px; background: ${bgColor}; 
            color: white; font-size: 0.75rem; font-weight: 800; 
            margin-left: 8px; vertical-align: middle; line-height: 1.2;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        ">${grade}</span>`;
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
    const { allStateDB, debuffDescDB } = ctx;
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
            themeColor = COLORS.high;
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
            <div style="display: flex; justify-content: space-between; align-items: center; min-height: 58px; margin-bottom: 15px;">
                <div style="display: flex; gap: 15px; align-items: center;">
                    <div style="position: relative; flex-shrink: 0;">
                        ${typeBadgeHTML}
                        <img src="${iconPath}" 
                             style="width: 58px; height: 58px; border-radius: 12px; border: 3px solid ${themeColor}; object-fit: cover;" 
                             onerror="this.src='./assets/icons/skills/default.webp'">
                        ${(showBadge && (type === 'low' || type === 'high')) ? `<div id="${type}-badge" style="position: absolute; right: -5px; bottom: -5px; background: ${COLORS.badge}; color: white; font-size: 0.75rem; font-weight: bold; padding: 3px 7px; border-radius: 7px; border: 1px solid rgba(255,255,255,0.2); z-index:3;">Lv.1</div>` : ''}
                    </div>
                    <div style="display: flex; flex-direction: column; justify-content: center; gap: 2px;">
                        <span style="font-size: 0.85rem; font-weight: bold; color: ${themeColor};">${typeLabel}</span>
                        
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="font-size: 1.3rem; font-weight: 800; color: ${COLORS.textMain}; line-height: 1.2;">${skillName}</span>
                            
                            ${(isRecommend && (type === 'low' || type === 'high')) ? makeGradeBadge(currentApostle[type === 'low' ? 'low_grade' : 'high_grade']) : ''}
                        </div>
                    </div>
                </div>

                ${(type === 'high' && showBadge) ? `
                <div id="mode-toggle-btn" onclick="window.toggleSkillMode()" 
                     style="display: flex; align-items: center; cursor: pointer; background: ${themeColor}; 
                            padding: 2px; border-radius: 20px; width: 65px; height: 26px; 
                            position: relative; transition: all 0.3s ease; border: 1px solid rgba(0,0,0,0.1);">
                    <div style="position: absolute; left: ${currentSkillMode === 'PvE' ? '4px' : '40px'}; width: 20px; height: 20px; background: rgba(255,255,255,0.85); border-radius: 50%; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); box-shadow: 0 1px 2px rgba(0,0,0,0.15);"></div>
                    <span style="font-size: 0.72rem; font-weight: 800; color: #020817; width: 100%; text-align: ${currentSkillMode === 'PvE' ? 'right' : 'left'}; padding: 0 9px; pointer-events: none;">
                        ${currentSkillMode}
                    </span>
                </div>` : ''}
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 12px;">
                ${customContent ? customContent : renderEffectItems(buffString, condString, targetString, ctx.allStateDB, ctx.debuffDescDB)}
            </div>
        </div>`;
}
// 상태이상 개별 아이템 음각 박스 (좌측 컬러 바 적용)
function renderEffectItems(effectString, condString, targetString, allStateDB, debuffDescDB) {
    if (!effectString || effectString === 'X') return '';
    const names = effectString.split(',').map(s => s.trim());
    const conds = condString ? condString.split(',').map(s => s.trim()) : [];
    const targets = targetString ? targetString.split(',').map(s => s.trim()) : [];

    return names.map((raw, index) => {
        const pureName = raw.split('(')[0].trim();
        const info = allStateDB.find(d => d.state_name === pureName);
        const isDebuff = (info && (info.type === "약화" || info.type === "제어" || info.type === "지속피해")) || (debuffDescDB.some(d => d.state_name === pureName));
        const accentColor = isDebuff ? "#FC6881" : "#3488F0"; 
        const iconSrc = (info && info.icon_file) ? `./assets/icons/state/${info.icon_file}` : `./assets/icons/state/버프_아이콘 없음.webp`;

        return `
            <div style="position: relative; background: #f8f9fa; border-radius: 12px; padding: 12px 12px 12px 18px; 
                        box-shadow: inset 0 2px 5px ${COLORS.inset}, inset 3px 0 0 ${accentColor}; 
                        border: 1px solid rgba(0,0,0,0.03); display: flex; align-items: flex-start; gap: 12px; overflow: hidden;">
                <img src="${iconSrc}" style="width: 34px; height: 34px; flex-shrink: 0;" onerror="this.src='./assets/icons/state/버프_아이콘 없음.webp';">
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

// 어사이드 전용 헬퍼 함수
const renderAsideTabContent = (char, asideData) => {
    if (!asideData || !asideData.aside1_name) {
        return `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; text-align: center;">
                <img src="./assets/icons/common_icons/empty.webp" style="width: 80px; opacity: 0.5; margin-bottom: 15px;" onerror="this.src='./assets/icons/state/버프_아이콘 없음.webp'">
                <div style="color: #94a3b8; font-weight: bold;">아직 어사이드 정보가 준비되지 않았어용...</div>
            </div>`;
    }

    let html = '';
    const themeColor = '#A855F7'; 

    // 엘다인 판정: Eldyne 열에 값이 있는지 확인 (문자열인 경우 trim 후 빈값 체크)
    const isEldyne = char.Eldyne && char.Eldyne.toString().trim() !== "";
    const globalStatValue = isEldyne ? '4%' : '3%';

    for (let i = 1; i <= 3; i++) {
        const name = asideData[`aside${i}_name` ];
        const icon = asideData[`aside${i}_icon` ];
        const desc = asideData[`aside${i}_desc` ];
        const template = asideData[`aside${i}_stat_template` ];
        const value = asideData[`aside${i}_stat_value` ];

        if (!name) continue;

html += `
            <div style="background: #ffffff; border-radius: 15px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); margin-bottom: 15px;">
                <div style="display: flex; gap: 15px; align-items: center; margin-bottom: 15px;">
                    <div style="position: relative; flex-shrink: 0;">
                        <img src="./assets/icons/aside/aside_${i}/${icon}" 
                             style="width: 58px; height: 58px; border-radius: 12px; border: 3px solid ${themeColor}; object-fit: cover;" 
                             onerror="this.src='./assets/icons/skills/default.webp'">
                    </div>
                    <div style="display: flex; flex-direction: column; justify-content: center; gap: 2px;">
                        <span style="font-size: 0.85rem; font-weight: bold; color: ${themeColor};">어사이드 ★${i}</span>
                        <span style="font-size: 1.3rem; font-weight: 800; color: ${COLORS.textMain}; line-height: 1.2;">${name}</span>
                    </div>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <div style="font-size: 0.9rem; color: #666; line-height: 1.6;">
                        ${desc?.replace(/\\n/g, '<br>')}
                    </div>
                    
                    ${(template && value) ? `
                    <div style="background: #f8f9fa; border-radius: 12px; padding: 14px; font-size: 0.95rem; color: #333; line-height: 1.6; box-shadow: inset 0 2px 5px ${COLORS.inset}; border: 1px solid rgba(0,0,0,0.03);">
                        ${parseSkillLevelText(template, value, themeColor)}
                    </div>` : ''}

${(i === 3 && asideData.aside_3_global) ? `
                    <div style="background: #f8f9fa; border-radius: 12px; padding: 16px; 
                                box-shadow: inset 0 2px 5px ${COLORS.inset}, inset 3px 0 0 ${themeColor}; 
                                border: 1px solid rgba(0,0,0,0.03); margin-top: 5px;">
                        
                        <div style="margin-bottom: 12px;">
                            <strong style="color: #333333; font-size: 0.95rem;">사도 전체 능력치</strong>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            ${asideData.aside_3_global.split(',').map(stat => {
                                const pureStat = stat.trim();
                                // 기호 앞에 +가 없는 경우 자동 추가 (3성 % 등)
                                const fullVal = globalStatValue.startsWith('+') ? globalStatValue : '+' + globalStatValue;
                                
                                // 숫자(소수점 포함)와 기호를 분리하는 로직
                                const numMatch = fullVal.match(/[0-9.]+/);
                                const numberPart = numMatch ? numMatch[0] : "";
                                const [prefix, suffix] = fullVal.split(numberPart);

                                return `
                                <div style="display: flex; align-items: center; justify-content: space-between; background: #ffffff; padding: 10px 14px; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <img src="./assets/icons/base_stat/${pureStat}.webp" 
                                             style="width: 28px; height: 28px;" 
                                             onerror="this.src='./assets/icons/state/버프_아이콘 없음.webp'">
                                        <span style="font-size: 0.9rem; font-weight: 700; color: #475569;">전체 ${pureStat}</span>
                                    </div>
                                    <span style="font-size: 1.05rem; font-weight: 800; color: #475569;">
                                        ${prefix}<span style="color: ${themeColor};">${numberPart}</span>${suffix}
                                    </span>
                                </div>`;
                            }).join('')}
                        </div>
                        
                        <div style="margin-top: 12px; text-align: center; font-size: 0.75rem; color: ${themeColor}; font-weight: bold; opacity: 0.8;">
                            사도 전체 능력치 효과는 모든 사도에게 적용됩니다.
                        </div>
                    </div>` : ''}
                </div>
            </div>
        `;
    }
    return html;
};

export function openDetailModal(char, dataContext) {
    currentSkillMode = 'PvE';
    currentApostle = char;
    currentDataContext = dataContext;
    const { debuffDB, buffDB, highSkillDB, lowSkillDB, allStateDB, debuffDescDB, normalAtkDB, asideDB } = dataContext;
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
        if (tier.includes('메타 부적합')) return '#7F8C8D';
        if (tier.includes('태생 1성')) return '#BCD3C7';
        return '#e67e22';
    })(char.tier);
   
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

    // 3. 각 탭의 내용물(HTML) 미리 준비하기
    // [Tab 0 준비]
    const lowRecContent = `
    <div style="position: relative; background: #f8f9fa; border-radius: 12px; padding: 14px 18px; 
                box-shadow: inset 0 2px 5px ${COLORS.inset}, inset 3px 0 0 ${getGradeColor(char.low_grade)}; border: 1px solid rgba(0,0,0,0.03);">
        <div style="font-size: 0.95rem; font-weight: bold; color: ${COLORS.textMain}; margin-bottom: 8px;">강화 시 변경점</div>
        <div style="font-size: 0.88rem; color: #555; line-height: 1.7; word-break: keep-all;">
            ${formatDescWithBullets(char.low_desc)} </div>
    </div>`;

    const highRecContent = `
    <div style="position: relative; background: #f8f9fa; border-radius: 12px; padding: 14px 18px; 
                box-shadow: inset 0 2px 5px ${COLORS.inset}, inset 3px 0 0 ${getGradeColor(char.high_grade)}; border: 1px solid rgba(0,0,0,0.03);">
        <div style="font-size: 0.95rem; font-weight: bold; color: ${COLORS.textMain}; margin-bottom: 8px;">강화 시 변경점</div>
        <div style="font-size: 0.88rem; color: #555; line-height: 1.7; word-break: keep-all;">
            ${formatDescWithBullets(char.high_desc)} </div>
    </div>`;
    // [Tab 2 준비]

    let lowDetail = "";
    if (lowSkillData) {
        let maxL = 1; for (let i = 1; i <= 13; i++) { if (lowSkillData[`Lv.${i}`]) maxL = i; }
        lowDetail = `<div style="font-size: 0.9rem; color: #666; line-height: 1.6; margin-bottom: 12px;">${lowSkillData.low_skill_desc?.replace(/\\n/g, '<br>')}</div><div id="low-skill-stat-text" style="background: #f8f9fa; border-radius: 12px; padding: 14px; font-size: 0.95rem; box-shadow: inset 0 2px 5px ${COLORS.inset}; border: 1px solid rgba(0,0,0,0.03);">${parseSkillLevelText(lowSkillData.low_skill_stat_template, lowSkillData['Lv.1'], COLORS.low)}</div><div style="margin-top: 20px;"><input type="range" min="1" max="${maxL}" value="1" style="width:100%; accent-color:${COLORS.low};" oninput="window.updateLowSkillLv(this.value, '${char.name}')"><div style="display: flex; justify-content: space-between; color: #adb5bd; font-size: 0.75rem; margin-top: 8px; font-weight: bold;"><span>Lv.1</span><span>Lv.${maxL}</span></div></div>`;
    }
    let highDetail = "";
    if (skillData) {
        let maxH = 1; const dbM = currentSkillMode === 'PvE' ? 'PvE' : 'PvP'; for (let i = 1; i <= 13; i++) { if (skillData[`Lv.${i}(${dbM})`]) maxH = i; }
        const themeC = currentSkillMode === 'PvE' ? COLORS.high : COLORS.pvp;
        highDetail = `<div id="high-cooldown-text" style="font-size: 0.85rem; color: #495057; font-weight: bold; margin-bottom: 10px;">재사용 대기시간 <span style="color: ${themeC}">${skillData[currentSkillMode === 'PvE' ? 'high_cooldown(PvE)' : 'cooldown(PvP)']}초</span></div><div style="font-size: 0.9rem; color: #666; line-height: 1.6; margin-bottom: 12px;">${skillData['high_skill_desc']?.replace(/\\n/g, '<br>')}</div><div id="high-skill-stat-text" style="background: #f8f9fa; border-radius: 12px; padding: 14px; font-size: 0.95rem; box-shadow: inset 0 2px 5px ${COLORS.inset}; border: 1px solid rgba(0,0,0,0.03);">${parseSkillLevelText(skillData['high_skill_stat_template'], skillData[`Lv.1(${currentSkillMode})`], themeC)}</div><div style="margin-top: 20px;"><input type="range" min="1" max="${maxH}" value="1" id="high-skill-slider" style="width:100%; accent-color:${themeC};" oninput="window.updateHighSkillLv(this.value, '${char.name}')"><div style="display: flex; justify-content: space-between; color: #adb5bd; font-size: 0.75rem; margin-top: 8px; font-weight: bold;"><span>Lv.1</span><span id="high-max-lv-display">Lv.${maxH}</span></div></div>`;
    }
    let normalAtkHTML = "";
    if (normalAtkData) {
        const statColor = char.atk_type === '마법' ? '#339af0' : '#E63946';
        
        const normalContent = `
            <div style="margin-bottom: 15px;">
                <div style="font-size: 0.9rem; color: #666; line-height: 1.6; margin-bottom: 12px;">
                    ${normalAtkData.basic_atk_desc ? normalAtkData.basic_atk_desc.replace(/\\n/g, '<br>') : ''}
                </div>
                <div style="background: #f8f9fa; border-radius: 12px; padding: 14px; font-size: 0.95rem; color: #333; line-height: 1.6; box-shadow: inset 0 2px 5px ${COLORS.inset}; border: 1px solid rgba(0,0,0,0.03);">
                    ${parseSkillLevelText(normalAtkData.basic_stat_template, normalAtkData.basic_atk_value, statColor)}
                </div>
            </div>
            
        ${(normalAtkData.enhance_atk_desc && normalAtkData.enhance_atk_desc !== 'X') ? `
                <div style="height: 1px; background: #eee; margin: 4px 0;"></div>
                
                <div>
                    <div style="font-size: 0.85rem; font-weight: bold; color: #84CC16; margin-top: 4px; margin-bottom: 2px;">일반 공격</div>
                    <div style="font-size: 1.3rem; font-weight: 800; color: ${COLORS.textMain}; margin-bottom: 8px;">강화 공격</div>
                    <div style="font-size: 0.9rem; color: #666; line-height: 1.6; margin-bottom: 12px;">
                        ${normalAtkData.enhance_atk_desc.replace(/\\n/g, '<br>')}
                    </div>
                    <div style="background: #f8f9fa; border-radius: 12px; padding: 14px; font-size: 0.95rem; color: #333; line-height: 1.6; box-shadow: inset 0 2px 5px ${COLORS.inset}; border: 1px solid rgba(0,0,0,0.03);">
                        ${parseSkillLevelText(normalAtkData.enhance_stat_template, normalAtkData.enhance_atk_value, statColor)}
                    </div>
                </div>
            ` : ''}
        `;

        normalAtkHTML = renderEffectCard('normal', { low_skill_name: "기본 공격" }, null, null, null, dataContext, normalContent, false);
    }
    // [Tab 3 준비]
    const asideContentHTML = renderAsideTabContent(char, asideData);

    // 4. 모달에 HTML 때려넣기 (고정 헤더 + 스크롤 본문 구조)
   const modalContent = document.querySelector('#modal-detail .modal-content');

  // [1] 부가 효과 탭(tab-1) 내용물 계산 및 예외 처리 로직
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
        // height: 350px 대신 min-height를 사용하고 부모와 분리된 독립 박스로 구성
        return `
            <div class="empty-tab-wrapper" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; text-align: center; width: 100%;">
                <img src="./assets/icons/common_icons/empty.webp" 
                     style="width: 80px; height: 80px; margin-bottom: 20px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.1));"
                     onerror="this.src='./assets/icons/state/버프_아이콘 없음.webp'">
                <div style="font-size: 1.15rem; font-weight: 800; color: #475569; letter-spacing: -0.5px;">부가 효과가 없어용...</div>
            </div>`;
    }
    return html;
})();
    
   modalContent.innerHTML = `
        <button class="modal-close-x" onclick="document.getElementById('modal-detail').classList.add('hidden'); document.body.style.overflow='auto';">&times;</button>

        <div class="modal-fixed-header" id="modal-header">
            <div style="display: flex; gap: 20px; align-items: center; margin-bottom: 20px; padding-right: 35px;">
                <img src="./assets/images/${char.name}.webp" style="width: 85px; height: 85px; border-radius: 18px; object-fit: cover; box-shadow: 0 4px 10px rgba(0,0,0,0.1);" onerror="this.src='./assets/images/default.webp'">
                <div>
                    <h2 style="margin: 0; font-size: 1.5rem;">${char.name}</h2>
                    <p style="margin: 4px 0; font-weight: bold; font-size: 1rem; color: ${tierColor};">${char.tier || ''}</p>
                    <p style="margin: 0; color: #666; font-size: 0.85rem;">${char.personality} | ${char.role} | ${char.line}</p>
                </div>
            </div>
            <div class="modal-tabs">
                <button class="tab-btn active" onclick="switchTab(0)">강화 추천</button>
                <button class="tab-btn" onclick="switchTab(1)">부가 효과</button>
                <button class="tab-btn" onclick="switchTab(2)">상세 설명</button>
                <button class="tab-btn" onclick="switchTab(3)">어사이드 정보</button> </div>
            </div>
        </div>

        <div id="detail-body-scroll" style="height: 500px; overflow-y: auto; padding-right: 5px; scroll-behavior: smooth;">
            <div id="tab-0" class="tab-content">
                ${renderEffectCard('low', lowSkillData, null, null, null, dataContext, lowRecContent, false, true)}
                ${renderEffectCard('high', skillData, null, null, null, dataContext, highRecContent, false, true)}
                <div style="background: #ffffff; border-radius: 15px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); margin-bottom: 10px;">
                     <div style="display: flex; gap: 15px; align-items: center; margin-bottom: 15px;">
                         <img src="./assets/images/${char.name}.webp" style="width: 58px; height: 58px; border-radius: 12px; border: 3px solid #e67e22; object-fit: cover;">
                         <div style="display: flex; flex-direction: column;"><span style="font-size: 0.85rem; font-weight: bold; color: #e67e22;">종합</span><span style="font-size: 1.3rem; font-weight: 800; color: ${COLORS.textMain};">강화 추천</span></div>
                     </div>
                     ${char.recommend_reason ? `<div style="background: #f8f9fa; border-radius: 12px; padding: 12px 18px; box-shadow: inset 0 2px 5px ${COLORS.inset}, inset 3px 0 0 #e67e22; margin-bottom: 10px;"><strong style="color:#e67e22;">💡 추천 레벨: ${char.recommend_lv}</strong><div style="font-size:0.88rem;">${char.recommend_reason}</div></div>` : ''}
                     ${char.note ? `
                    <div style="background: #fffbe6; border-radius: 12px; padding: 12px 18px; box-shadow: inset 0 2px 5px ${COLORS.inset}, inset 3px 0 0 #fadb14;">
                        <div style="font-size: 0.88rem; line-height: 1.7; word-break: keep-all;">
                            ${char.note.replace(/\\n/g, '<br>').replace(/\n/g, '<br>')}
                        </div>
                    </div>` : ''}
                </div>
            </div>

            <div id="tab-1" class="tab-content hidden">
                ${tab1ContentHTML}
            </div>

            <div id="tab-2" class="tab-content hidden" style="display: block;">
                ${lowSkillData ? renderEffectCard('low', lowSkillData, null, null, null, dataContext, lowDetail, true) : ''}
                ${skillData ? renderEffectCard('high', skillData, null, null, null, dataContext, highDetail, true) : ''}
                ${normalAtkHTML}
            </div>

            <div id="tab-3" class="tab-content hidden">
                ${asideContentHTML}
            </div>
        </div> `;

     // [3] 모달 표시 및 높이 최종 보정
    document.getElementById('modal-detail').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    
    // 탭 전환 시 스크롤 위치를 맨 위로 초기화해주는 센스!
    const scrollArea = document.getElementById('detail-body-scroll');
    if (scrollArea) scrollArea.scrollTop = 0;
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

    // PvP일 땐 보라색, PvE일 땐 고학년 초록색
    const activeColor = isPvE ? COLORS.high : COLORS.pvp;
    const cooldownKey = isPvE ? 'high_cooldown(PvE)' : 'cooldown(PvP)';

    // 1. 토글 버튼 업데이트
    const toggleBtn = document.getElementById('mode-toggle-btn');
    if (toggleBtn) {
        toggleBtn.style.background = activeColor;
        const knob = toggleBtn.querySelector('div');
        knob.style.left = isPvE ? '4px' : '40px';
        const span = toggleBtn.querySelector('span');
        span.innerText = currentSkillMode;
        span.style.textAlign = isPvE ? 'right' : 'left';
    }

    // 2. 대기시간 텍스트 컬러 업데이트
    const cooldownText = document.getElementById('high-cooldown-text');
    if (cooldownText) {
        cooldownText.innerHTML = `재사용 대기시간 <span style="color: ${activeColor}">${skillData[cooldownKey]}초</span>`;
    }

    // 3. [추가] 슬라이더 컬러 및 계수 업데이트
    const slider = document.getElementById('high-skill-slider');
    if (slider) {
        slider.style.accentColor = activeColor; 
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
