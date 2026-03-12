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

export function openDetailModal(char, dataContext) {
    currentApostle = char;
    currentDataContext = dataContext;

    const { debuffDB, buffDB, highSkillDB, lowSkillDB, allStatusDB, debuffDescDB, normalAtkDB } = dataContext;
    const apostleDebuffs = debuffDB.find(d => d.name.trim() === char.name.trim());
    const apostleBuffs = buffDB.find(b => b.name.trim() === char.name.trim());
    const skillData = highSkillDB.find(s => s['chara_name']?.trim() === char.name.trim());
    const lowSkillData = lowSkillDB ? lowSkillDB.find(s => s['chara_name']?.trim() === char.name.trim()) : null;
    const normalAtkData = normalAtkDB ? normalAtkDB.find(n => n.chara_name?.trim() === char.name.trim()) : null;

    const body = document.getElementById('detail-body');
    // 티어 색상 및 배지 (기존 유지)
    const getTierColor = (tier) => {
        if (!tier) return '#888'; 
        if (tier.includes('메타픽')) return '#E91E63';
        if (tier.includes('성격덱')) return '#2980B9';
        if (tier.includes('메타 부적합')) return '#7F8C8D';
        if (tier.includes('태생 1성')) return '#BCD3C7';
        return '#e67e22';
    };
    const tierColor = getTierColor(char.tier);
    const getGradeClass = (g) => g === 'O' ? 'color-O' : g === '△' ? 'color-delta' : g === 'X' ? 'color-X' : '';
    const makeBadge = (grade) => `<span style="display: inline-flex; justify-content: center; align-items: center; width: 28px; height: 28px; border-radius: 50%; background: #fff; border: 2px solid currentColor; margin-right: 10px; font-size: 1rem; font-weight: bold;" class="${getGradeClass(grade)}">${grade || '?'}</span>`;

    // [Tab 1: 부가 효과 구성] (기존 로직 유지)
    let tab1HTML = "";
    const hasLow = (apostleBuffs?.low_buff && apostleBuffs.low_buff !== 'X') || (apostleDebuffs?.low_debuff && apostleDebuffs.low_debuff !== 'X');
    const hasHigh = (apostleBuffs?.high_buff && apostleBuffs.high_buff !== 'X') || (apostleDebuffs?.high_debuff && apostleDebuffs.high_debuff !== 'X');
    const hasNormal = (apostleBuffs?.normal_buff && apostleBuffs.normal_buff !== 'X') || (apostleDebuffs?.normal_debuff && apostleDebuffs.normal_debuff !== 'X');
    const hasPower = (apostleBuffs?.power_buff && apostleBuffs.power_buff !== 'X') || (apostleDebuffs?.power_debuff && apostleDebuffs.power_debuff !== 'X');
    const hasAside = (apostleBuffs?.aside_passive && apostleBuffs.aside_passive !== 'X') || (apostleDebuffs?.aside_passive && apostleDebuffs.aside_passive !== 'X');

    if (!hasLow && !hasHigh && !hasNormal && !hasPower && !hasAside) {
        tab1HTML = `<div style="text-align: center; padding: 60px 20px; color: #888;"><div style="font-size: 3rem; margin-bottom: 10px;">🍃</div><div>부가 효과가 없어용...</div></div>`;
    } else {
        tab1HTML = `
            ${hasLow ? `<div class="skill-effect-container border-low-high"><div class="skill-section-title"> 저학년 스킬 효과</div>${renderSkillEffects(apostleBuffs?.low_buff, apostleBuffs?.low_cond, apostleBuffs?.low_target, allStatusDB, debuffDescDB)}${renderSkillEffects(apostleDebuffs?.low_debuff, apostleDebuffs?.low_cond, apostleDebuffs?.low_target, allStatusDB, debuffDescDB)}</div>` : ''}
            ${hasHigh ? `<div class="skill-effect-container border-low-high"><div class="skill-section-title"> 고학년 스킬 효과</div>${renderSkillEffects(apostleBuffs?.high_buff, apostleBuffs?.high_cond, apostleBuffs?.high_target, allStatusDB, debuffDescDB)}${renderSkillEffects(apostleDebuffs?.high_debuff, apostleDebuffs?.high_cond, apostleDebuffs?.high_target, allStatusDB, debuffDescDB)}</div>` : ''}
            ${hasNormal ? `<div class="skill-effect-container border-normal-power"><div class="skill-section-title"> 일반 공격 효과</div>${renderSkillEffects(apostleBuffs?.normal_buff, apostleBuffs?.normal_cond, apostleBuffs?.normal_target, allStatusDB, debuffDescDB)}${renderSkillEffects(apostleDebuffs?.normal_debuff, apostleDebuffs?.normal_cond, apostleDebuffs?.normal_target, allStatusDB, debuffDescDB)}</div>` : ''}
            ${hasPower ? `<div class="skill-effect-container border-normal-power"><div class="skill-section-title"> 강화 공격 효과</div>${renderSkillEffects(apostleBuffs?.power_buff, apostleBuffs?.power_cond, apostleBuffs?.power_target, allStatusDB, debuffDescDB)}${renderSkillEffects(apostleDebuffs?.power_debuff, apostleDebuffs?.power_cond, apostleDebuffs?.power_target, allStatusDB, debuffDescDB)}</div>` : ''}
            ${hasAside ? `<div class="skill-effect-container border-aside"><div class="skill-section-title"> 어사이드 ★2 추가 효과</div>${renderSkillEffects(apostleBuffs?.aside_passive, apostleBuffs?.aside_cond, apostleBuffs?.aside_target, allStatusDB, debuffDescDB)}${renderSkillEffects(apostleDebuffs?.aside_passive, apostleDebuffs?.aside_cond, apostleDebuffs?.aside_target, allStatusDB, debuffDescDB)}</div>` : ''}
        `;
    }

    // [Tab 2: 상세 설명]
    // 1. 저학년 스킬 카드
    let lowSkillHTML = "";
    if (lowSkillData) {
        let maxLowLv = 1;
        for (let i = 1; i <= 13; i++) {
            if (lowSkillData[`Lv.${i}`] && String(lowSkillData[`Lv.${i}`]).trim() !== "") maxLowLv = i;
        }

        lowSkillHTML = `
            <div style="background: #ffffff; border-radius: 15px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); margin-bottom: 15px;">
                <div style="display: flex; gap: 15px; align-items: center; min-height: 58px; margin-bottom: 15px;">
                    <div style="position: relative; flex-shrink: 0;">
                        <img src="./assets/icons/low_skill/${lowSkillData.low_skill_icon}" 
                             style="width: 58px; height: 58px; border-radius: 12px; border: 3px solid ${COLORS.low};" 
                             onerror="this.src='./assets/icons/skills/default.webp'">
                        <div id="low-badge" style="position: absolute; right: -5px; bottom: -5px; background: ${COLORS.badge}; color: white; font-size: 0.75rem; font-weight: bold; padding: 3px 7px; border-radius: 7px; box-shadow: 1px 2px 4px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2);">Lv.1</div>
                    </div>
                    <div style="display: flex; flex-direction: column; justify-content: center; gap: 2px;">
                        <span style="font-size: 0.85rem; font-weight: bold; color: ${COLORS.low};">저학년 스킬</span>
                        <span style="font-size: 1.3rem; font-weight: 800; color: ${COLORS.textMain}; line-height: 1.2;">${lowSkillData.low_skill_name}</span>
                    </div>
                </div>
                <div style="font-size: 0.9rem; color: #666; line-height: 1.6; margin-bottom: 12px;">
                    ${lowSkillData.low_skill_desc ? lowSkillData.low_skill_desc.replace(/\\n/g, '<br>') : ''}
                </div>
                <div id="low-skill-stat-text" style="background: #f8f9fa; border-radius: 12px; padding: 14px; font-size: 0.95rem; color: #333; line-height: 1.6; box-shadow: inset 0 2px 5px ${COLORS.inset}; border: 1px solid rgba(0,0,0,0.03);">
                    ${parseSkillLevelText(lowSkillData.low_skill_stat_template, lowSkillData['Lv.1'], COLORS.low)}
                </div>
                <div style="margin-top: 20px; padding: 0 5px;">
                    <input type="range" min="1" max="${maxLowLv}" value="1" 
                           style="width: 100%; height: 8px; cursor: pointer; accent-color: ${COLORS.low}; background: ${COLORS.sliderBg}; border-radius: 10px; appearance: none; -webkit-appearance: none;" 
                           oninput="window.updateLowSkillLv(this.value, '${char.name}')">
                    <div style="display: flex; justify-content: space-between; color: #adb5bd; font-size: 0.75rem; margin-top: 8px; font-weight: bold;">
                        <span>Lv.1</span><span>Lv.${maxLowLv}</span>
                    </div>
                </div>
            </div>
        `;
    }

    // 2. 고학년 스킬 카드
    let highSkillHTML = "";
    if (skillData) {
        let maxHighLv = 1;
        const dbMode = currentSkillMode === 'PvE' ? 'PvE' : 'PvP';
        for (let i = 1; i <= 13; i++) {
            if (skillData[`Lv.${i}(${dbMode})`] && String(skillData[`Lv.${i}(${dbMode})`]).trim() !== "") maxHighLv = i;
        }

        const highIconPath = `./assets/images/${skillData.high_skill_icon.trim()}`;
        const isPvE = currentSkillMode === 'PvE';
        const themeColor = isPvE ? COLORS.high : COLORS.pvp;
        const currentLabelColor = isPvE ? COLORS.pve_label : COLORS.pvp; // labelColor 선언
        const cooldownKey = isPvE ? 'high_cooldown(PvE)' : 'cooldown(PvP)';

        highSkillHTML = `
            <div style="background: #ffffff; border-radius: 15px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); margin-bottom: 15px; position: relative;">
                <div style="display: flex; justify-content: space-between; align-items: center; min-height: 58px; margin-bottom: 12px;">
                    <div style="display: flex; gap: 15px; align-items: center;">
                        <div style="position: relative; flex-shrink: 0;">
                            <img src="${highIconPath}" 
                                 style="width: 58px; height: 58px; border-radius: 12px; border: 3px solid ${themeColor}; object-fit: cover;" 
                                 onerror="this.src='./assets/images/default.webp'">
                            <div id="high-badge" style="position: absolute; right: -5px; bottom: -5px; background: ${COLORS.badge}; color: white; font-size: 0.75rem; font-weight: bold; padding: 3px 7px; border-radius: 7px; box-shadow: 1px 2px 4px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2);">Lv.1</div>
                        </div>
                        <div style="display: flex; flex-direction: column; justify-content: center; gap: 2px;">
                            <span style="font-size: 0.85rem; font-weight: bold; color: ${themeColor};">고학년 스킬</span>
                            <span style="font-size: 1.3rem; font-weight: 800; color: ${COLORS.textMain}; line-height: 1.2;">${skillData['high_skill_name']}</span>
                        </div>
                    </div>

                    <div id="mode-toggle-btn" onclick="window.toggleSkillMode()" 
                         style="display: flex; align-items: center; cursor: pointer; background: ${themeColor}; 
                                padding: 2px; border-radius: 20px; width: 65px; height: 26px; 
                                position: relative; transition: all 0.3s ease; border: 1px solid rgba(0,0,0,0.1);">
                        <div style="position: absolute; left: ${isPvE ? '4px' : '40px'}; width: 20px; height: 20px; background: rgba(255,255,255,0.85); backdrop-filter: blur(2px); border-radius: 50%; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); box-shadow: 0 1px 2px rgba(0,0,0,0.15);"></div>
                        <span style="font-size: 0.72rem; font-weight: 800; color: #020817; width: 100%; text-align: ${isPvE ? 'right' : 'left'}; padding: 0 9px; pointer-events: none;">
                            ${currentSkillMode}
                        </span>
                    </div>
                </div>

                <div id="high-cooldown-text" style="font-size: 0.85rem; color: #495057; font-weight: bold; margin-bottom: 15px; display: flex; align-items: center; gap: 4px;">
                    재사용 대기시간 <span style="color: ${themeColor}">${skillData[cooldownKey]}초</span>
                </div>

                <div style="font-size: 0.9rem; color: #666; line-height: 1.6; margin-bottom: 12px;">
                    ${skillData['high_skill_desc'] ? skillData['high_skill_desc'].replace(/\\n/g, '<br>') : ''}
                </div>

                <div id="high-skill-stat-text" style="background: #f8f9fa; border-radius: 12px; padding: 14px; font-size: 0.95rem; color: #333; line-height: 1.6; box-shadow: inset 0 2px 5px ${COLORS.inset}; border: 1px solid rgba(0,0,0,0.03);">
                    ${parseSkillLevelText(skillData['high_skill_stat_template'], skillData[`Lv.1(${currentSkillMode})`], themeColor)}
                </div>

                <div style="margin-top: 20px; padding: 0 5px;">
                    <input type="range" min="1" max="${maxHighLv}" value="1" id="high-skill-slider"
                           style="width: 100%; height: 8px; cursor: pointer; accent-color: ${themeColor}; background: ${COLORS.sliderBg}; border-radius: 10px; appearance: none; -webkit-appearance: none;" 
                           oninput="window.updateHighSkillLv(this.value, '${char.name}')">
                    <div style="display: flex; justify-content: space-between; color: #adb5bd; font-size: 0.75rem; margin-top: 8px; font-weight: bold;">
                        <span>Lv.1</span><span id="high-max-lv-display">Lv.${maxHighLv}</span>
                    </div>
                </div>
            </div>
        `;
    }

    // 3. 일반 공격 카드 (ReferenceError 수정)
let normalAtkHTML = "";
    if (normalAtkData) {
        const atkIconPath = `./assets/icons/atk_type/${char.atk_type || '물리'}.webp`;
        const isMagic = char.atk_type === '마법';
        
        // [테마 컬러 분리]
        const normalTheme = '#84CC16'; // 텍스트용: 아유르베다 그린
        const glowColor = '#D9F99D';   // 아이콘 글로우용: 기존 라임
        const statColor = isMagic ? '#339af0' : '#E63946';

        normalAtkHTML = `
            <div style="background: #ffffff; border-radius: 15px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); margin-top: 15px; width: 100%; box-sizing: border-box;">
                
                <div style="display: flex; gap: 15px; align-items: center; min-height: 58px; margin-bottom: 15px;">
                    <div style="position: relative; flex-shrink: 0;">
                        <img src="${atkIconPath}" 
                             style="width: 58px; height: 58px; border-radius: 12px; border: 3px solid ${glowColor}; box-shadow: 0 0 15px ${glowColor};" 
                             onerror="this.src='./assets/icons/atk_type/물리.webp'">
                    </div>
                    <div style="display: flex; flex-direction: column; justify-content: center; gap: 2px;">
                        <span style="font-size: 0.85rem; font-weight: bold; color: ${normalTheme};">일반 공격</span>
                        <span style="font-size: 1.3rem; font-weight: 800; color: ${COLORS.textMain}; line-height: 1.2;">기본 공격</span>
                    </div>
                </div>
                <div style="font-size: 0.9rem; color: #666; line-height: 1.6; margin-bottom: 12px;">
                    ${normalAtkData.basic_atk_desc ? normalAtkData.basic_atk_desc.replace(/\\n/g, '<br>') : ''}
                </div>
                <div style="background: #f8f9fa; border-radius: 12px; padding: 14px; font-size: 0.95rem; color: #333; line-height: 1.6; box-shadow: inset 0 2px 5px ${COLORS.inset}; border: 1px solid rgba(0,0,0,0.03); margin-bottom: 25px;">
                    ${parseSkillLevelText(normalAtkData.basic_stat_template, normalAtkData.basic_atk_value, statColor)}
                </div>

                <div style="height: 1px; background: #eee; margin-bottom: 25px;"></div>

                ${(normalAtkData.enhance_atk_desc && normalAtkData.enhance_atk_desc !== 'X') ? `
                <div style="display: flex; flex-direction: column; gap: 2px; margin-bottom: 15px;">
                     <span style="font-size: 0.85rem; font-weight: bold; color: ${normalTheme};">일반 공격</span>
                     <span style="font-size: 1.3rem; font-weight: 800; color: ${COLORS.textMain};">강화 공격</span>
                </div>
                <div style="font-size: 0.9rem; color: #666; line-height: 1.6; margin-bottom: 12px;">
                    ${normalAtkData.enhance_atk_desc.replace(/\\n/g, '<br>')}
                </div>
                <div style="background: #f8f9fa; border-radius: 12px; padding: 14px; font-size: 0.95rem; color: #333; line-height: 1.6; box-shadow: inset 0 2px 5px ${COLORS.inset}; border: 1px solid rgba(0,0,0,0.03);">
                    ${parseSkillLevelText(normalAtkData.enhance_stat_template, normalAtkData.enhance_atk_value, statColor)}
                </div>` : ''}
            </div>
        `;
    }

    body.innerHTML = `
        <div style="display: flex; gap: 20px; align-items: center; margin-bottom: 20px; text-align: left;">
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
        <div id="tab-0" class="tab-content">
            <div style="text-align: left;">
                ${(char.recommend_lv || char.recommend_reason) ? `<div class="skill-box" style="border-left: 5px solid #e67e22; background: #fffaf5;"><div style="color:#e67e22; font-weight:bold; margin-bottom:8px; font-size: 1.15rem;">💡 강화 추천</div>${char.recommend_lv ? `<div style="font-weight:bold; margin-bottom:5px; font-size: 1rem;">권장 레벨: ${char.recommend_lv}</div>` : ''}<div style="font-size: 0.95rem; color: #444; line-height: 1.5;">${(char.recommend_reason || '').split('↑').join('↑<br>')}</div></div>` : ''}
                <div class="skill-box" style="border-left: 5px solid ${COLORS.low};"><div style="display:flex; align-items:center; font-weight:bold; font-size: 1.1rem; margin-bottom:8px; color: ${COLORS.low};">${makeBadge(char.low_grade)} 저학년 스킬</div><div style="font-size: 0.95rem; color: #666; padding-left: 38px; line-height: 1.5;">${(char.low_desc || '').split('↑').join('↑<br>')}</div></div>
                <div class="skill-box" style="border-left: 5px solid ${COLORS.high};"><div style="display:flex; align-items:center; font-weight:bold; font-size: 1.1rem; margin-bottom:8px; color: ${COLORS.high};">${makeBadge(char.high_grade)} 고학년 스킬</div><div style="font-size: 0.95rem; color: #666; padding-left: 38px; line-height: 1.5;">${(char.high_desc || '').split('↑').join('↑<br>')}</div></div>
                ${char.note ? `<div class="skill-box" style="background:#fffbe6; border: 1px solid #ffe58f; border-left: 5px solid #fadb14;"><div style="font-weight:bold; color: #856404; margin-bottom:8px; font-size: 1.1rem;">📝 참고사항</div><div style="font-size: 0.95rem; color: #666; line-height: 1.6;">${char.note.split('↑').join('↑<br>')}</div></div>` : ''}
            </div>
        </div>
        <div id="tab-1" class="tab-content hidden"><div style="text-align: left;">${tab1HTML}</div></div>
        <div id="tab-2" class="tab-content hidden" style="background: #f1f3f5; padding: 15px; border-radius: 20px;">
            ${lowSkillHTML} ${highSkillHTML} ${normalAtkHTML}
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
    const modeKey = isPvE ? 'PvE' : 'PvP';
    const rawVal = info[`Lv.${lv}(${modeKey})`]; 
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
    values.forEach((v, i) => {
        res = res.split(`{${i}}`).join(`<b style="color:${color}; font-size: 1.05rem;">${v}</b>`);
    });
    return res;
}

export function switchTab(idx) {
    const contents = document.querySelectorAll('#modal-detail .tab-content');
    const btns = document.querySelectorAll('#modal-detail .tab-btn');
    contents.forEach((c, i) => i === idx ? c.classList.remove('hidden') : c.classList.add('hidden'));
    btns.forEach((b, i) => i === idx ? b.classList.add('active') : b.classList.remove('active'));
}

export function renderSkillEffects(effectString, condString, targetString, allStatusDB, debuffDescDB) {
    if (!effectString || effectString === 'X' || effectString === '') return '';
    const names = effectString.split(',').map(s => s.trim()).filter(s => s !== '');
    const conds = condString ? condString.split(',').map(s => s.trim()) : [];
    const targets = targetString ? targetString.split(',').map(s => s.trim()) : [];
    
    return names.map((raw, index) => {
        const pureName = raw.split('(')[0].trim();
        const info = allStatusDB.find(d => d.status_name === pureName);
        const bracketMatch = raw.match(/\(([^)]+)\)/);
        const bracketText = bracketMatch ? bracketMatch[1] : null;
        const isDebuff = (info && (info.type === "약화" || info.type === "제어" || info.type === "지속피해")) || (debuffDescDB.some(d => d.status_name === pureName));
        const boxColor = isDebuff ? "#FC6881" : "#3488F0";
        const bgColor = isDebuff ? "#FFF5F6" : "#F0F7FF";
        const iconSrc = (info && info.icon_file) ? `./assets/icons/status/${info.icon_file}` : `./assets/icons/status/버프_아이콘 없음.webp`;

        return `
            <div style="display:flex; align-items:center; gap:10px; background:${bgColor}; padding:8px; border-radius:10px; border:1px solid ${boxColor}; margin-top:8px;">
                <img src="${iconSrc}" style="width:24px; height:24px;" onerror="this.src='./assets/icons/status/버프_아이콘 없음.webp';">
                <div style="font-size:0.8rem;">
                    <strong style="color:#333;">${pureName}${bracketText ? ` (${bracketText})` : ''}</strong>
                    ${conds[index] ? `<span style="font-size:0.7rem; background:#fff3e0; color:#e65100; padding:1px 4px; border-radius:4px; margin-left:4px;">${conds[index]}</span>` : ''}
                    ${targets[index] ? `<span style="font-size:0.7rem; background:#e8f5e9; color:#2e7d32; padding:1px 4px; border-radius:4px; margin-left:4px;">${targets[index]}</span>` : ''}<br>
                    <span style="color:#777; font-size:0.75rem;">${info ? info.description : "정보 없음"}</span>
                </div>
            </div>`;
    }).join('');
}