const { openDetailModal, switchTab, updateLowSkillLv, updateHighSkillLv, toggleQuickFilter, renderFilterCheckbox, updateSegmentedIndicator }
    = await import('./ui.js?v=' + (window.APP_VERSION || ''));

// ── 테마 (라이트/다크) ─────────────────────────
const _SVG_SUN  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/></svg>`;
const _SVG_MOON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

function _updateThemeIcon(theme) {
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.innerHTML = theme === 'dark' ? _SVG_SUN : _SVG_MOON;
}

(function initTheme() {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    _updateThemeIcon(theme);
})();

window.toggleTheme = function () {
    const btn = document.getElementById('theme-toggle');
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    _updateThemeIcon(next);

    if (btn) {
        btn.classList.remove('is-pulsing');
        // eslint-disable-next-line no-unused-expressions
        btn.offsetWidth;
        btn.classList.add('is-pulsing');
        btn.addEventListener('animationend', () => btn.classList.remove('is-pulsing'), { once: true });
    }
};

// [2] 전역 변수 설정
let db = [], 
    debuffDB = [], 
    lowSkillDB = [],
    highSkillDB = [], 
    debuffDescDB = [], 
    buffDB = [], 
    buffDescDB = [], 
    allStateDB = [],
    normalAtkDB = [],
    asideDB = []; // 쉼표로 연결하여 let 선언 공유
    

let infoText = "", isAscending = true, selectedStatees = new Set(), pendingStatees = new Set(), currentFilterTab = 'all';

// [3] HTML onclick 이벤트와 연결하기
window.openDetailModal = (char) => {
    // ui.js로 모든 DB 뭉치를 전달.
    openDetailModal(char, {
        debuffDB,
        buffDB,
        lowSkillDB,
        highSkillDB,
        allStateDB,
        debuffDescDB,
        normalAtkDB,
        asideDB
    });
};

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
        setTimeout(() => {
            window._navDir = dir;
            window.openDetailModal(next);
        }, 150);
    } else {
        window.openDetailModal(next);
    }
};

window.switchTab = switchTab;
window.updateLowSkillLv = (lv, name) => updateLowSkillLv(lv, name, lowSkillDB);
window.updateHighSkillLv = (lv, name) => updateHighSkillLv(lv, name, highSkillDB);
window.toggleQuickFilter = (type) => toggleQuickFilter(type);

window.handleSortFilter = handleSortFilter;
window.toggleOrder = toggleOrder;
window.updateAsideFilterCount = _updateAsideFilterCount;
window.openFilterModal = openFilterModal;
window.closeFilterModal = closeFilterModal;
window.applyFilterModal = applyFilterModal;
window.setFilterTab = setFilterTab;
window.resetFilters = resetFilters;
window.openInfoModal = openInfoModal;
window.closeModal = closeModal;
window.scrollToTop = scrollToTop;
window.refreshFilterList = refreshFilterList;
window.toggleStateFilter = toggleStateFilter;

// [+1] 성격별 컬러 및 테두리 데이터 설정
const PERSONALITY_COLORS = {
    '순수': { bg: '#66C17C', border: '#93F4A7' },
    '냉정': { bg: '#85BAEC', border: '#A4D0F7' },
    '광기': { bg: '#EE839D', border: '#F4ACBA' },
    '우울': { bg: '#C784ED', border: '#D8A0FB' },
    '활발': { bg: '#ECDC85', border: '#F9ECA8' },
    '공명': { bg: 'bg-resonance', border: '#FFFEFD' } // 공명은 CSS 클래스명 사용
};

// [+2] 성급 별 이미지 생성 함수 수정 (새로운 경로 및 파일명 적용)
function makeStarHTML(rarity) {
    // DB에서 가져온 값이 숫자가 아니거나 없을 경우를 대비해 확실히 숫자로 변환
    const starCount = parseInt(rarity);

    // 숫자가 아니거나 0 이하면 별을 그리지 않음
    if (isNaN(starCount) || starCount <= 0) {
        console.warn(`Rarity data missing or invalid: ${rarity}`); // 개발자 도구에서 확인용
        return '<div style="height: 20px;"></div>'; // 공간만 차지
    }

    // 3성은 노란별(star3.webp), 2성 이하는 초록별(star2.webp)
    const starImg = starCount >= 3 ? 'star3.webp' : 'star2.webp';
    
    let stars = '';
    const starSrc = `./assets/icons/common_icons/${starImg}`;
    
    // 아이콘 크기 살짝 증대 (16px -> 19px) 및 쫀득하게 겹치기
    for (let i = 0; i < starCount; i++) {
        stars += `<img src="${starSrc}" style="width: 19px; height: 19px; margin: 0 -3px; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.2));">`;
    }
    // 별 영역 y축 위치 미세 조정 (margin-top)
    return `<div style="display: flex; justify-content: center; align-items: center; margin-top: -3px; height: 20px; z-index: 3; position: relative;">${stars}</div>`;
}


// [4] 데이터 로직 및 필터 함수들
async function loadExternalData() {
    try {
        const v = window.APP_VERSION || '';
        const [res1, res2, res3, res4, res5, res6, res7, res8, res9, res10] = await Promise.all([
            fetch(`./data/DB.csv?v=${v}`).then(res => res.text()),
            fetch(`./data/debuff_DB.csv?v=${v}`).then(res => res.text()),
            fetch(`./data/debuff_desc_DB.csv?v=${v}`).then(res => res.text()),
            fetch(`./data/high_skill_DB.csv?v=${v}`).then(res => res.text()),
            fetch(`./data/info.txt?v=${v}`).then(res => res.text()),
            fetch(`./data/buff_DB.csv?v=${v}`).then(res => res.text()),
            fetch(`./data/buff_desc_DB.csv?v=${v}`).then(res => res.text()),
            fetch(`./data/normal_Atk_DB.csv?v=${v}`).then(res => res.text()),
            fetch(`./data/low_skill_DB.csv?v=${v}`).then(res => res.text()),
            fetch(`./data/aside_DB.csv?v=${v}`).then(res => res.text()),
        ]);

        const cfg = { header: true, skipEmptyLines: true, trimHeaders: true };
        db = Papa.parse(res1, cfg).data;
        debuffDB = Papa.parse(res2, cfg).data;
        debuffDescDB = Papa.parse(res3, cfg).data;
        highSkillDB = Papa.parse(res4, cfg).data;
        infoText = res5;
        buffDB = Papa.parse(res6, cfg).data;
        buffDescDB = Papa.parse(res7, cfg).data;
        normalAtkDB = Papa.parse(res8, cfg).data;
        lowSkillDB = Papa.parse(res9, cfg).data; 
        asideDB = Papa.parse(res10, cfg).data; 
        
        allStateDB = [...buffDescDB, ...debuffDescDB];

        setupFilterModal();
        document.getElementById('loading-text').classList.add('hidden');
        handleSortFilter(); 

        // --- [타이틀 클릭 시 모든 상태 초기화 로직] ---
        const mainTitle = document.querySelector('.main-title');
        if (mainTitle) {
            mainTitle.style.cursor = 'pointer'; // 클릭 가능하다는 시각적 힌트
            mainTitle.title = "클릭 시 필터 및 검색 초기화"; // 툴팁 추가

            mainTitle.onclick = () => {
                // 1. 검색어 초기화 및 X 버튼 숨기기
                const searchInput = document.getElementById('search-input');
                if (searchInput) {
                    searchInput.value = '';
                    const clearBtn = document.getElementById('search-clear-btn');
                    if (clearBtn) clearBtn.classList.add('hidden');
                }

                // 2. 선택된 필터(Set) 비우기
                if (typeof selectedStatees !== 'undefined') {
                    selectedStatees.clear();
                }

                // 3. 필터 모달 내 체크박스 UI 초기화
                const filterCheckboxes = document.querySelectorAll('#filter-checkbox-group input[type="checkbox"]');
                filterCheckboxes.forEach(cb => cb.checked = false);

                // 4. 필터 검색창 및 탭 초기화
                const filterSearch = document.getElementById('filter-search');
                if (filterSearch) filterSearch.value = '';
                if (typeof setFilterTab === 'function') setFilterTab('all');

                // 5. 정렬 상태를 기본(이름순, 오름차순)으로 리셋
                const sortSelect = document.getElementById('sort-select');
                if (sortSelect) sortSelect.value = 'name';
                const sortDropdown = document.getElementById('sortDropdown');
                if (sortDropdown?._resetDropdown) sortDropdown._resetDropdown('name', '이름순');
                
                isAscending = true;
                const orderBtn = document.getElementById('order-btn');
                if (orderBtn) orderBtn.innerText = "▲";

                // 6. '본인 대상 제외' 토글 해제
                const excludeSelf = document.getElementById('exclude-self-toggle');
                if (excludeSelf) excludeSelf.checked = false;

                // 7. 화면 갱신 및 애니메이션 적용
                const grid = document.getElementById('main-grid');
                if (grid) {
                    grid.classList.remove('reset-ani');
                    void grid.offsetWidth; // 브라우저 리플로우 강제 발생 (애니메이션 재시작용)
                    grid.classList.add('reset-ani');
                }

                // 8. [추가] 어사이드 필터 초기화
                if (typeof window.resetAsideFilter === 'function') {
                    // 모달을 열지 않고 데이터만 초기화하기 위해 로직 분리 호출
                    window.activeAsideFilters = { targets: [], effects: [] };
                    const asideCount = document.getElementById('aside-filter-count');
                    if (asideCount) asideCount.innerText = '';
                }

                handleSortFilter(); // 필터링 실행
                window.scrollTo({ top: 0, behavior: 'smooth' });

            };
        }
    } catch (e) { console.error("로드 실패:", e); }
}

function setupFilterModal() { refreshFilterList(); }


function _updateAsideFilterCount() {
    const af = window.activeAsideFilters || { targets: [], effects: [] };
    const n = af.targets.filter(v => !v.includes('무관')).length + af.effects.filter(v => !v.includes('무관')).length;
    const btn = document.getElementById('aside-filter-count');
    if (btn) btn.innerText = n > 0 ? String(n) : '';
    const mc = document.getElementById('modal-aside-count');
    if (mc) { mc.hidden = n === 0; if (n > 0) mc.textContent = `${n}개`; }
}

function updateFilterTags() {
    const container = document.getElementById('active-filters');
    if (!container) return;
    container.innerHTML = '';

    const hasSearch = document.getElementById('search-input').value.trim() !== '';
    const hasState = selectedStatees && selectedStatees.size > 0;

    const chips = [];

    function makeChip(text, tgClass, onRemove) {
        const chip = document.createElement('div');
        chip.className = 'tg-chip' + (tgClass ? ' ' + tgClass : '');
        chip.innerHTML = `<span>${text}</span><span class="tg-x">✕</span>`;
        chip.querySelector('.tg-x').onclick = (e) => { e.stopPropagation(); onRemove(); };
        chips.push(chip);
    }

    if (hasSearch) {
        makeChip(`검색: ${document.getElementById('search-input').value}`, '', () => {
            document.getElementById('search-input').value = '';
            document.getElementById('search-clear-btn').classList.add('hidden');
            handleSortFilter(); triggerGridRefresh();
        });
    }

    if (hasState) {
        selectedStatees.forEach(tagName => {
            const isInBuff = buffDescDB.some(b => b.state_name === tagName || (b.tag && b.tag.split(',').map(t => t.trim()).includes(tagName)));
            const isInDebuff = debuffDescDB.some(d => d.state_name === tagName || (d.tag && d.tag.split(',').map(t => t.trim()).includes(tagName)));
            const tgClass = (isInBuff && isInDebuff) ? 'tg-chip-neutral' : (isInBuff ? 'tg-chip-buff' : (isInDebuff ? 'tg-chip-debuff' : ''));
            const icon = (isInBuff && isInDebuff) ? '-' : (isInBuff ? '▲' : (isInDebuff ? '▼' : ''));
            makeChip(`${icon} ${tagName}`, tgClass, () => {
                selectedStatees.delete(tagName);
                const cb = document.querySelector(`#filter-checkbox-group input[value="${tagName}"]`);
                if (cb) cb.checked = false;
                handleSortFilter(); triggerGridRefresh();
            });
        });
    }

    // 어사이드 필터 칩
    const asideFilters = window.activeAsideFilters || { targets: [], effects: [] };
    const asideTargets = asideFilters.targets.filter(v => !v.includes('무관'));
    const asideEffects = asideFilters.effects.filter(v => !v.includes('무관'));

    asideTargets.forEach(t => {
        makeChip(`대상: ${t}`, 'tg-chip-aside', () => {
            window.activeAsideFilters.targets = [];
            _updateAsideFilterCount();
            handleSortFilter(); triggerGridRefresh();
        });
    });
    asideEffects.forEach(ef => {
        makeChip(`효과: ${ef}`, 'tg-chip-aside', () => {
            window.activeAsideFilters.effects = window.activeAsideFilters.effects.filter(v => v !== ef);
            _updateAsideFilterCount();
            handleSortFilter(); triggerGridRefresh();
        });
    });

    if (chips.length > 1) {
        const clearChip = document.createElement('div');
        clearChip.className = 'tg-chip tg-chip-clear';
        clearChip.innerHTML = '<span>전체 해제</span>';
        clearChip.onclick = () => {
            document.getElementById('search-input').value = '';
            const clearBtn = document.getElementById('search-clear-btn');
            if (clearBtn) clearBtn.classList.add('hidden');
            selectedStatees.clear();
            document.querySelectorAll('#filter-checkbox-group input:checked').forEach(cb => cb.checked = false);
            window.activeAsideFilters = { targets: [], effects: [] };
            _updateAsideFilterCount();
            handleSortFilter(); triggerGridRefresh();
        };
        chips.push(clearChip);
    }

    if (chips.length === 0) {
        container.style.display = 'none';
        return;
    }
    container.style.display = '';
    const chipsDiv = document.createElement('div');
    chipsDiv.className = 'tg-chips';
    chips.forEach(c => chipsDiv.appendChild(c));
    container.appendChild(chipsDiv);
}

function handleSortFilter() {
    const query = document.getElementById('search-input').value.toLowerCase().trim();
    const sort = document.getElementById('sort-select').value;
    const mode = document.querySelector('input[name="filter-mode"]:checked').value;
    const excludeSelf = document.getElementById('exclude-self-toggle')?.checked || false;

    let filtered = db.filter(char => {
        const nameMatch = (char.name || "").toLowerCase().includes(query);
        if (!nameMatch) return false;

        if (window.activeAsideFilters) {
            const aData = asideDB.find(a => a.chara_name === char.name);
            const selT = activeAsideFilters.targets.filter(t => !t.includes('무관'));
            const selE = activeAsideFilters.effects.filter(e => !e.includes('무관'));

            if (selT.length > 0 || selE.length > 0) {
                if (!aData) return false; 
                const tMatch = selT.length === 0 || selT.some(t =>
                    (aData.aside3_target_tags || '').includes(t.replace(' 아군', '').replace('파티 ', ''))
                );
                const eMatch = selE.length === 0 || selE.some(e =>
                    (aData.aside3_effect_tags || '').includes(e)
                );
                if (!(tMatch && eMatch)) return false;
            }
        }
        let stateMatch = true;
        if (selectedStatees.size > 0) {
            const selected = Array.from(selectedStatees);
                const check = (s) => {
                const b = buffDB.find(x => x.name === char.name);
                const d = debuffDB.find(x => x.name === char.name);
                let myData = []; // 변경: 이름과 조건을 묶어서 담을 배열

                if (b) {
                    ['low_buff', 'high_buff', 'normal_buff', 'power_buff', 'aside_passive'].forEach(key => {
                        if (b[key] && b[key] !== 'X') {
                            const targetKey = key.replace('_buff', '_target').replace('_passive', '_target');
                            const condKey = key.replace('_buff', '_cond').replace('_passive', '_cond'); // 조건 키 찾기
                            
                            const effs = b[key].split(',').map(e => e.trim());
                            const targets = b[targetKey] ? b[targetKey].split(',').map(t => t.trim()) : [];
                            const conds = b[condKey] ? b[condKey].split(',').map(c => c.trim()) : [];
                            
                            effs.forEach((eff, idx) => {
                                if (excludeSelf && targets[idx] === '자신') return;
                                // 이름(name)과 조건(cond)을 세트로 묶어서 저장!
                                myData.push({ name: eff, cond: conds[idx] || '' }); 
                            });
                        }
                    });
                }
                if (d) {
                    ['low_debuff', 'high_debuff', 'normal_debuff', 'power_debuff', 'aside_passive'].forEach(key => {
                        if (d[key] && d[key] !== 'X') {
                            // targetKey 교체 로직은 debuffDB에 맞게 _debuff를 _target으로 바꿉니다.
                            const targetKey = key.replace('_debuff', '_target').replace('_passive', '_target');
                            const condKey = key.replace('_debuff', '_cond').replace('_passive', '_cond'); // 조건 키 찾기
                            
                            const effs = d[key].split(',').map(e => e.trim());
                            const targets = d[targetKey] ? d[targetKey].split(',').map(t => t.trim()) : [];
                            const conds = d[condKey] ? d[condKey].split(',').map(c => c.trim()) : [];

                            effs.forEach((eff, idx) => {
                                if (excludeSelf && targets[idx] === '자신') return;
                                myData.push({ name: eff, cond: conds[idx] || '' }); 
                            });
                        }
                    }); 
                }
                // 배열을 checkTagMatch로 넘깁니다.
                return checkTagMatch(myData, s);
            };
            stateMatch = (mode === 'AND') ? selected.every(s => check(s)) : selected.some(s => check(s));
        }
        return stateMatch;
    });

    filtered.sort((a, b) => {
        let res = (sort === 'name') ? a.name.localeCompare(b.name) : (a[sort] || "").localeCompare(b[sort] || "") || a.name.localeCompare(b.name);
        return isAscending ? res : -res;
    });

    window.currentDisplayedList = filtered;

    const grid = document.getElementById('main-grid');
    grid.innerHTML = "";
    if (sort === 'name') {
        displayCards(filtered, 'main-grid');
    } else {
        const groups = filtered.reduce((acc, o) => { 
            const k = o[sort] || "기타"; if (!acc[k]) acc[k] = []; acc[k].push(o); return acc; 
        }, {});
        let keys = Object.keys(groups).sort();
        if (sort === 'line') keys = ['전열', '중열', '후열', '전체열'].filter(k => groups[k]);
        // 티어순: [n] 숫자로 정렬, 없으면 맨 뒤
        if (sort === 'tier') keys.sort((a, b) => {
            const na = parseInt(a.match(/^\[(\d+)\]/)?.[1] ?? '99');
            const nb = parseInt(b.match(/^\[(\d+)\]/)?.[1] ?? '99');
            return na - nb;
        });
        if (!isAscending) keys.reverse();
        keys.forEach(k => {
            const t = document.createElement('div');
            t.className = 'group-title';
            // 티어순: [n] 접두사를 제거하고 이름만 표시
            const displayName = sort === 'tier' ? k.replace(/^\[\d+\]\s*/, '') : k;
            t.innerText = displayName;
            if (sort === 'personality') t.setAttribute('data-personality', k);
            if (sort === 'tier')        t.setAttribute('data-tier', displayName);
            if (sort === 'line')        t.setAttribute('data-line', k);
            if (sort === 'role')        t.setAttribute('data-role', k);
            grid.appendChild(t);
            displayCards(groups[k], 'main-grid', true);
        });
    }
    document.getElementById('filter-count').innerText = selectedStatees.size > 0 ? String(selectedStatees.size) : '';
    _updateAsideFilterCount();
    updateFilterTags();
}

// 검색창 클리어 기능
window.clearSearch = () => {
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear-btn');
    
    searchInput.value = ''; // 입력값 초기화
    clearBtn.classList.add('hidden'); // 버튼 숨기기
    
    // 원래 검색창이 하던 '정렬 및 필터' 로직을 그대로 실행 (전체 목록 복구)
    if (typeof handleSortFilter === 'function') {
        handleSortFilter();
    }
    
    searchInput.focus(); // 바로 다시 검색할 수 있게 포커스
};

// 입력 시 버튼 보여주기/숨기기 로직 (기존 handleSortFilter에 추가하거나 별도로 등록)
const searchInput = document.getElementById('search-input');
const clearBtn = document.getElementById('search-clear-btn');

if (searchInput) {
    searchInput.addEventListener('input', () => {
        if (searchInput.value.length > 0) {
            clearBtn.classList.remove('hidden');
        } else {
            clearBtn.classList.add('hidden');
        }
    });
}

function checkTagMatch(list, kw) {
    if (!list || list.length === 0) return false;
    
    return list.some(item => {
        const targetKw = kw.trim();
        const pureName = item.name.split('(')[0].trim();

        // ★ 1차 검사: '조건(cond)' 텍스트 안에 필터 키워드(예: "개전")가 포함되어 있는지!
        if (item.cond && item.cond.includes(targetKw)) return true;

        // ★ 2차 검사: 버프 이름(원본)에 키워드가 있는지
        if (item.name.includes(targetKw)) return true;

        // ★ 3차 검사: 괄호를 제외한 순수 이름 일치 여부
        if (pureName === targetKw) return true;

        // ★ 4차 검사: allStateDB의 'tag' 속성 검사
        const info = allStateDB.find(d => (d.state_name || "").trim() === pureName);
        if (info && info.tag) {
            const tags = info.tag.split(',').map(t => t.trim());
            return tags.includes(targetKw);
        }
        return false;
    });
}

function refreshFilterList() {
    const group = document.getElementById('filter-checkbox-group');
    const search = document.getElementById('filter-search').value.toLowerCase().trim();
    if (!group) return; 
    const sourceData = (currentFilterTab === 'all') ? allStateDB : (currentFilterTab === 'buff' ? buffDescDB : debuffDescDB);

    const tagSet = new Set();
    sourceData.forEach(item => {
        if (item.tag) {
            item.tag.split(',').forEach(t => {
                const cleanTag = t.trim();
                if (cleanTag !== "") tagSet.add(cleanTag);
            });
        }
    });

    const items = Array.from(tagSet)
        .filter(tagName => tagName.toLowerCase().includes(search))
        .sort((a, b) => a.localeCompare(b));

    if (items.length === 0) {
        group.innerHTML = '<div class="tg-filter-grid--empty">검색 결과가 없습니다</div>';
        return;
    }

    group.innerHTML = items.map(tagName => {
            const isChecked = pendingStatees.has(tagName);
            const isInBuff = buffDescDB.some(b => b.state_name === tagName || (b.tag && b.tag.split(',').map(t => t.trim()).includes(tagName)));
            const isInDebuff = debuffDescDB.some(d => d.state_name === tagName || (d.tag && d.tag.split(',').map(t => t.trim()).includes(tagName)));
            const type = (isInBuff && isInDebuff) ? 'neutral' : (isInBuff ? 'buff' : 'debuff');
            const markerHTML = type === 'neutral'
                ? '<span class="tg-neutral-bar"></span>'
                : (type === 'buff' ? '▲' : '▼');
            return `<label class="filter-label" data-type="${type}">
                <input type="checkbox" value="${tagName}" ${isChecked ? 'checked' : ''} onchange="toggleStateFilter('${tagName}')">
                <span class="tg-type-mark">${markerHTML}</span>
                <span class="tg-name">${tagName}</span>
            </label>`;
        })
        .join('');
}
function getGradeColor(grade) {
    if (!grade || grade === 'X' || grade === '?') return '#94a3b8';
    if (grade.includes('10')) return '#22C55E'; // 기존 O (~Lv.10+)
    if (grade.includes('-')) return '#EF4444';  // 기존 X (~Lv.7-)
    return '#F59E0B';                           // 기존 △ (~Lv.7+)
}

async function displayCards(data, id, append = false) {
    const container = document.getElementById(id); 
    if (!container) return;
    if (!append) container.innerHTML = "";
    
    const activeContext = data; 

    data.forEach(char => {
        const card = document.createElement('div');
        const pData = PERSONALITY_COLORS[char.personality] || PERSONALITY_COLORS['공명'];
        const isResonance = char.personality === '공명';

        card.className = 'char-card';
        
        // 1. [엘다인 체크] Eldyne 열에 값이 있으면 클래스 + 아이콘 준비
        const isEldyne = char.Eldyne && char.Eldyne.trim() !== "" && char.Eldyne !== "X";
        if (isEldyne) card.classList.add('eldyne-card');
        const eldyneIcon = isEldyne
            ? `<img src="./assets/icons/common_icons/Ingame_Icon_HeroGrow_Hidden.webp" class="eldyne-corner-icon">`
            : '';
        
        card.onclick = () => {
            if (typeof window.openDetailModal === 'function') {
                window.openDetailModal(char, activeContext);
            }
        };

        // 2. [상단 테두리 설정] 초상화 영역에만 성격 색상 테두리 부여
        const topStyle = `
            background: ${isResonance ? 'none' : pData.bg};
            border: 3px solid ${pData.border};
            border-bottom: none; /* 하단 이름표와 깔끔하게 연결 */
        `;
        const topBgClass = isResonance ? `card-top bg-resonance` : `card-top`;

        card.innerHTML = `
            <div class="${topBgClass}" style="${topStyle}">
                <img src="./assets/icons/chara_image/초상화_${char.name}.webp" class="char-img"
                    style="width: 100%; height: 100%; object-fit: cover;"
                    onerror="this.src='./assets/icons/chara_image/default.webp'">
                
                <img src="./assets/icons/personality/${char.personality}.webp" style="position: absolute; top: 6px; left: 6px; width: 28px; height: 28px; z-index: 2; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));">
                ${eldyneIcon}
                <div style="position: absolute; bottom: 8px; left: 0; width: 100%; padding: 0 8px; display: flex; justify-content: space-between; align-items: center; z-index: 2;">
                    <img src="./assets/icons/role/${char.role}.webp" style="width: 26px; height: 26px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));">
                    <img src="./assets/icons/line/${char.line}.webp" style="width: 28px; height: 28px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));">
                </div>

                <div style="position: absolute; bottom: 6px; width: 100%; z-index: 3;">
                    ${makeStarHTML(char.star)}
                </div>
            </div>

            <div class="card-bottom" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80px; padding: 8px 6px; border-radius: 0 0 15px 15px;">

                <div class="char-name" style="font-size: 1rem; font-weight: 800; margin-bottom: 8px; text-align: center; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${char.name}
                </div>
                
                <div style="display: flex; align-items: center; width: 100%; gap: 4px; padding: 0 4px;">
                    ${makeSkillGauge('저', char.low_grade)}
                    <div style="width: 1px; height: 10px; background: #eee; flex-shrink: 0;"></div>
                    ${makeSkillGauge('고', char.high_grade)}
                </div>
            </div>`;
            
        container.appendChild(card);
    });
}

// 등급 텍스트에 따른 게이지 정보를 반환하는 헬퍼 함수
function getGaugeInfo(grade) {
    if (!grade || grade === 'X') return { width: '0%', color: '#cbd5e1', label: 'X' };
    const g = grade.trim();
    // 텍스트에서 숫자와 기호만 추출 (예: "~ Lv. 10+" -> "10+")
    const label = g.match(/\d+[\+\-]?/g) ? g.match(/\d+[\+\-]?/g)[0] : g;
    // 1. [초록색] 10+ (100% 게이지)
    if (g.includes('10+')) { return { width: '100%', color: '#22C55E', label };}
    // 2. [주황색] 7+ (65% 게이지)
    if (g.includes('7+')) {return { width: '65%', color: '#F59E0B', label }; }
    // 3. [빨간색] 7- (30% 게이지)
    if (g.includes('7-')) {return { width: '30%', color: '#EF4444', label };}
    // 기본값 (예외 상황 대비)
    return { width: '40%', color: '#94a3b8', label };
}

// 게이지 바 HTML을 생성하는 함수
function makeSkillGauge(typeLabel, grade) {
    const info = getGaugeInfo(grade);
    return `
        <div style="display: flex; align-items: center; gap: 2px; flex: 1; min-width: 0;">
            <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: 800; flex-shrink: 0;">${typeLabel}</span>
            <div style="flex: 1; height: 5px; background: var(--border-soft); border-radius: 3px; overflow: hidden; min-width: 0;">
                <div style="width: ${info.width}; background: ${info.color}; height: 100%; border-radius: 3px;"></div>
            </div>
            <span style="font-size: 0.6rem; color: ${info.color}; font-weight: 800; flex-shrink: 0; min-width: 14px; text-align: right;">${info.label}</span>
        </div>
    `;
}

function toggleOrder() { isAscending = !isAscending; document.getElementById('order-btn').innerText = isAscending ? "▲" : "▼"; handleSortFilter(); }
function triggerGridRefresh() {
    const grid = document.getElementById('main-grid');
    if (!grid) return;
    grid.classList.remove('is-refreshing');
    void grid.offsetWidth;
    grid.classList.add('is-refreshing');
    grid.addEventListener('animationend', () => grid.classList.remove('is-refreshing'), { once: true });
}
function refreshClearAllBtn() {
    const btn = document.getElementById('filter-clear-all-btn');
    if (!btn) return;
    const count = pendingStatees.size;
    if (count > 0) {
        btn.style.visibility = 'visible'; btn.tabIndex = 0; btn.removeAttribute('aria-hidden');
        btn.textContent = `모두 해제 (${count})`;
    } else {
        btn.style.visibility = 'hidden'; btn.tabIndex = -1; btn.setAttribute('aria-hidden', 'true');
    }
}
function refreshModalCount() {
    const el = document.getElementById('modal-filter-count');
    const n = pendingStatees.size;
    if (el) { if (n > 0) { el.hidden = false; el.textContent = `${n}개`; } else { el.hidden = true; } }
}
function toggleStateFilter(s) {
    // 모달 내 pending 상태만 변경 — 적용 버튼 누를 때까지 카드 목록 갱신 안 함
    pendingStatees.has(s) ? pendingStatees.delete(s) : pendingStatees.add(s);
    refreshClearAllBtn();
    refreshModalCount();
}
function setFilterTab(t) {
    currentFilterTab = t;
    document.querySelectorAll('#filter-segmented .tg-segmented-btn').forEach(b => b.classList.toggle('is-active', b.id === `tab-${t}`));
    updateSegmentedIndicator('filter-segmented');
    const scroll = document.getElementById('filter-checkbox-scroll');
    if (scroll) { scroll.scrollTop = 0; scroll.classList.remove('is-scrolled'); }
    refreshFilterList();
}
function initScrollFade(el) {
    if (!el || el._scrollFadeInit) return;
    el._scrollFadeInit = true;
    el.addEventListener('scroll', () => {
        el.classList.toggle('is-scrolled', el.scrollTop > 0);
    }, { passive: true });
}
function openFilterModal() {
    pendingStatees = new Set(selectedStatees); // 현재 적용 상태를 pending으로 복사
    document.getElementById('modal-filter').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    document.body.classList.add('modal-open');
    updateSegmentedIndicator('filter-segmented');
    refreshClearAllBtn();
    refreshModalCount();
    refreshFilterList();
    initScrollFade(document.getElementById('filter-checkbox-scroll'));
}
function applyFilterModal() {
    selectedStatees = new Set(pendingStatees); // pending → 실제 적용
    document.getElementById('modal-filter').classList.add('hidden');
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
    handleSortFilter();
    triggerGridRefresh();
}
function closeFilterModal() {
    // X 버튼 / 배경 클릭: pending 버리고 닫기 (필터 적용 안 함)
    document.getElementById('modal-filter').classList.add('hidden');
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
}
function resetFilters() {
    selectedStatees.clear();
    pendingStatees.clear();
    const searchInput = document.getElementById('filter-search');
    if (searchInput) searchInput.value = '';
    setFilterTab('all');
    refreshClearAllBtn();
    refreshModalCount();
    handleSortFilter();
    triggerGridRefresh();
}
function openInfoModal() { document.getElementById('info-content').innerText = infoText; document.getElementById('modal-info').classList.remove('hidden'); document.body.style.overflow='hidden'; document.body.classList.add('modal-open'); }
function closeModal(id) {
    // 1. 상세 정보 모달(modal-detail)을 닫을 때만 플래그 상태 리셋
    if (id === 'modal-detail') {
        const flags = document.querySelectorAll('.tg-quickfilter-chip');
        flags.forEach(flag => flag.classList.remove('is-active'));

        const blurredItems = document.querySelectorAll('.tg-effect-item.is-blurred');
        blurredItems.forEach(item => item.classList.remove('is-blurred'));
    }
    const modal = document.getElementById(id);
    if (modal) {modal.classList.add('hidden');}
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
}
function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

function initSortDropdown(rootEl, options, currentValue, onChange) {
    if (!rootEl) return;
    const btn = rootEl.querySelector('.tg-dropdown-btn');
    const label = rootEl.querySelector('.tg-dropdown-label');
    let value = currentValue;
    let menu = null;

    const close = () => {
        if (!menu) return;
        menu.remove(); menu = null;
        btn.setAttribute('aria-expanded', 'false');
        document.removeEventListener('mousedown', onDocClick);
        document.removeEventListener('keydown', onKey);
    };
    const onDocClick = (e) => { if (!rootEl.contains(e.target)) close(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };

    const open = () => {
        menu = document.createElement('div');
        menu.className = 'tg-dropdown-menu';
        menu.setAttribute('role', 'listbox');
        options.forEach(o => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'tg-dropdown-item';
            item.setAttribute('role', 'option');
            item.setAttribute('aria-selected', String(o.value === value));
            item.innerHTML = `<span>${o.label}</span>${o.value === value ? '<span class="tg-dropdown-item-check">✓</span>' : ''}`;
            item.addEventListener('click', () => {
                value = o.value;
                label.textContent = o.label;
                onChange(o.value);
                close();
            });
            menu.appendChild(item);
        });
        rootEl.appendChild(menu);
        btn.setAttribute('aria-expanded', 'true');
        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onKey);
    };

    btn.addEventListener('click', () => {
        btn.getAttribute('aria-expanded') === 'true' ? close() : open();
    });

    rootEl._resetDropdown = (v, l) => { value = v; label.textContent = l; };
}

loadExternalData();

initSortDropdown(
    document.getElementById('sortDropdown'),
    [
        { value: 'name',        label: '이름순' },
        { value: 'tier',        label: '티어순' },
        { value: 'personality', label: '성격순' },
        { value: 'role',        label: '역할순' },
        { value: 'line',        label: '배치순' },
    ],
    'name',
    (v) => {
        document.getElementById('sort-select').value = v;
        handleSortFilter();
    }
);

window.onscroll = () => { document.getElementById("top-btn").style.display = (window.scrollY > 300) ? "flex" : "none"; };

window.addEventListener('keydown', (e) => {
    const detailModal = document.getElementById('modal-detail');
    const filterModal = document.getElementById('modal-filter');
    const asideModal = document.getElementById('modal-aside-filter');
    const isDetailVisible = !detailModal.classList.contains('hidden');
    const isFilterVisible = filterModal && !filterModal.classList.contains('hidden');
    const isAsideVisible = asideModal && !asideModal.classList.contains('hidden');

    if (e.key === 'Escape') {
        if (isDetailVisible) {
            if (typeof window.closeDetailModal === 'function') window.closeDetailModal();
        }
        if (typeof window.closeFilterModal === 'function') window.closeFilterModal();
        if (typeof window.closeAsideFilter === 'function') window.closeAsideFilter();
    }

    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && isDetailVisible) {
        e.preventDefault();
        window.navigateApostle(e.key === 'ArrowRight' ? 1 : -1);
        return;
    }

    if (e.key === 'Tab') {
        if (isDetailVisible) {
            e.preventDefault();
            const btns = document.querySelectorAll('#detail-segmented .tg-segmented-btn');
            let currentIdx = Array.from(btns).findIndex(b => b.classList.contains('is-active'));
            let nextIdx = (currentIdx + 1) % btns.length;
            if (typeof window.switchTab === 'function') {
                window.switchTab(nextIdx);
            } else {
                btns[nextIdx].click();
            }
        } else if (isFilterVisible) {
            e.preventDefault();
            const order = ['all', 'buff', 'debuff'];
            const curIdx = order.indexOf(currentFilterTab);
            const nextTab = order[(curIdx + 1) % order.length];
            setFilterTab(nextTab);
        } else if (isAsideVisible) {
            e.preventDefault();
            const asideTabs = document.querySelectorAll('#aside-segmented .tg-segmented-btn');
            const asideCurIdx = Array.from(asideTabs).findIndex(b => b.classList.contains('is-active'));
            const asideNextIdx = (asideCurIdx + 1) % asideTabs.length;
            if (typeof window.switchAsideFilterTab === 'function') window.switchAsideFilterTab(asideNextIdx);
        }
    }
});

// 모바일 스와이프로 사도 이동
let _touchStartX = 0;
document.addEventListener('touchstart', (e) => {
    if (document.getElementById('modal-detail')?.classList.contains('hidden')) return;
    _touchStartX = e.touches[0].clientX;
}, { passive: true });
document.addEventListener('touchend', (e) => {
    if (document.getElementById('modal-detail')?.classList.contains('hidden')) return;
    const delta = e.changedTouches[0].clientX - _touchStartX;
    if (Math.abs(delta) > 60) window.navigateApostle(delta > 0 ? -1 : 1);
}, { passive: true });

window.addEventListener('mouseup', (e) => {
    if (e.button !== 3) return;

    // 마우스 4번 버튼: 열려 있는 모달 닫기
    const detailModal = document.getElementById('modal-detail');
    const filterModal = document.getElementById('modal-filter');
    const asideModal = document.getElementById('modal-aside-filter');
    const infoModal = document.getElementById('modal-info');

    if (detailModal && !detailModal.classList.contains('hidden')) {
        e.preventDefault();
        if (typeof window.closeDetailModal === 'function') window.closeDetailModal();
    } else if (filterModal && !filterModal.classList.contains('hidden')) {
        e.preventDefault();
        closeFilterModal();
    } else if (asideModal && !asideModal.classList.contains('hidden')) {
        e.preventDefault();
        if (typeof window.closeAsideFilter === 'function') window.closeAsideFilter();
    } else if (infoModal && !infoModal.classList.contains('hidden')) {
        e.preventDefault();
        closeModal('modal-info');
    }
});

