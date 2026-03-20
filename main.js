import { openDetailModal, switchTab, updateLowSkillLv, updateHighSkillLv } from './ui.js';

// [2] 전역 변수 설정
let db = [], 
    debuffDB = [], 
    lowSkillDB = [],
    highSkillDB = [], 
    debuffDescDB = [], 
    buffDB = [], 
    buffDescDB = [], 
    allStatusDB = [],
    normalAtkDB = [],
    asideDB = []; // 쉼표로 연결하여 let 선언 공유
    

let infoText = "", isAscending = true, selectedStatuses = new Set(), currentFilterTab = 'all';

// [3] HTML onclick 이벤트와 연결하기
window.openDetailModal = (char) => {
    // ui.js로 모든 DB 뭉치를 전달.
    openDetailModal(char, { 
        debuffDB, 
        buffDB, 
        lowSkillDB, 
        highSkillDB, 
        allStatusDB, 
        debuffDescDB, 
        normalAtkDB,
        asideDB 
    });
};

window.switchTab = switchTab;
window.updateLowSkillLv = (lv, name) => updateLowSkillLv(lv, name, lowSkillDB);
window.updateHighSkillLv = (lv, name) => updateHighSkillLv(lv, name, highSkillDB);

window.handleSortFilter = handleSortFilter;
window.toggleOrder = toggleOrder;
window.openFilterModal = openFilterModal;
window.closeFilterModal = closeFilterModal;
window.setFilterTab = setFilterTab;
window.resetFilters = resetFilters;
window.openInfoModal = openInfoModal;
window.closeModal = closeModal;
window.scrollToTop = scrollToTop;
window.refreshFilterList = refreshFilterList;
window.toggleStatusFilter = toggleStatusFilter;

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
        const [res1, res2, res3, res4, res5, res6, res7, res8, res9, res10] = await Promise.all([
            fetch('./data/DB.csv').then(res => res.text()),
            fetch('./data/debuff_DB.csv').then(res => res.text()),
            fetch('./data/debuff_desc_DB.csv').then(res => res.text()),
            fetch('./data/high_skill_DB.csv').then(res => res.text()),
            fetch('./data/info.txt').then(res => res.text()),
            fetch('./data/buff_DB.csv').then(res => res.text()),
            fetch('./data/buff_desc_DB.csv').then(res => res.text()),
            fetch('./data/normal_Atk_DB.csv').then(res => res.text()),
            fetch('./data/low_skill_DB.csv').then(res => res.text()),
            fetch('./data/aside_DB.csv').then(res => res.text()),
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
        
        allStatusDB = [...buffDescDB, ...debuffDescDB];

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
                if (typeof selectedStatuses !== 'undefined') {
                    selectedStatuses.clear();
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

                handleSortFilter(); // 필터링 실행
                window.scrollTo({ top: 0, behavior: 'smooth' });

            };
        }
    } catch (e) { console.error("로드 실패:", e); }
}

function setupFilterModal() { refreshFilterList(); }

function handleSortFilter() {
    const query = document.getElementById('search-input').value.toLowerCase().trim();
    const sort = document.getElementById('sort-select').value;
    const mode = document.querySelector('input[name="filter-mode"]:checked').value;
    const excludeSelf = document.getElementById('exclude-self-toggle')?.checked || false;

    let filtered = db.filter(char => {
        const nameMatch = (char.name || "").toLowerCase().includes(query);
        if (!nameMatch) return false;

        let statusMatch = true;
        if (selectedStatuses.size > 0) {
            const selected = Array.from(selectedStatuses);
            const check = (s) => {
                const b = buffDB.find(x => x.name === char.name);
                const d = debuffDB.find(x => x.name === char.name);
                let myEffects = [];

                if (b) {
                    ['low_buff', 'high_buff', 'normal_buff', 'power_buff', 'aside_passive'].forEach(key => {
                        if (b[key] && b[key] !== 'X') {
                            const targetKey = key.replace('_buff', '_target').replace('_passive', '_target');
                            const effs = b[key].split(',').map(e => e.trim());
                            const targets = b[targetKey] ? b[targetKey].split(',').map(t => t.trim()) : [];
                            effs.forEach((eff, idx) => {
                                if (excludeSelf && targets[idx] === '자신') return;
                                myEffects.push(eff);
                            });
                        }
                    });
                }
                if (d) {
                    ['low_debuff', 'high_debuff', 'normal_debuff', 'power_debuff', 'aside_passive'].forEach(key => {
                        if (d[key] && d[key] !== 'X') {
                            const splitEffs = d[key].split(',').map(e => e.trim());
                            myEffects.push(...splitEffs);
                        }
                    }); 
                }
                return checkTagMatch(myEffects, s);
            };
            statusMatch = (mode === 'AND') ? selected.every(s => check(s)) : selected.some(s => check(s));
        }
        return statusMatch;
    });

    filtered.sort((a, b) => {
        let res = (sort === 'name') ? a.name.localeCompare(b.name) : (a[sort] || "").localeCompare(b[sort] || "") || a.name.localeCompare(b.name);
        return isAscending ? res : -res;
    });

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
        if (!isAscending) keys.reverse();
        keys.forEach(k => {
            const t = document.createElement('div'); t.className = 'group-title'; t.innerText = k; grid.appendChild(t);
            displayCards(groups[k], 'main-grid', true);
        });
    }
    document.getElementById('filter-count').innerText = selectedStatuses.size > 0 ? `(${selectedStatuses.size})` : '';
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
    return list.some(n => {
        const pureName = n.split('(')[0].trim();
        const targetKw = kw.trim();
        if (pureName === targetKw) return true;
        const info = allStatusDB.find(d => (d.status_name || "").trim() === pureName);
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
    group.innerHTML = '';

    let sourceData = (currentFilterTab === 'all') ? allStatusDB : (currentFilterTab === 'buff' ? buffDescDB : debuffDescDB);

    let tagSet = new Set();
    sourceData.forEach(item => {
        if (item.tag) {
            item.tag.split(',').forEach(t => {
                const cleanTag = t.trim();
                if (cleanTag !== "") tagSet.add(cleanTag);
            });
        }
    });

    Array.from(tagSet)
        .filter(tagName => tagName.toLowerCase().includes(search))
        .sort((a, b) => a.localeCompare(b))
        .forEach(tagName => {
            const isChecked = selectedStatuses.has(tagName);
            const isInBuff = buffDescDB.some(b => b.status_name === tagName || (b.tag && b.tag.split(',').map(t => t.trim()).includes(tagName)));
            const isInDebuff = debuffDescDB.some(d => d.status_name === tagName || (d.tag && d.tag.split(',').map(t => t.trim()).includes(tagName)));

            let typeIcon = (isInBuff && isInDebuff) ? '<span style="display:inline-block; width:12px; height:4px; background:#A361FF; vertical-align:middle; border-radius:1px;"></span>' : (isInBuff ? '<span style="color:#3488F0;">▲</span>' : '<span style="color:#FC6881;">▼</span>');

            const label = document.createElement('label');
            label.className = 'filter-label';
            label.innerHTML = `<input type="checkbox" value="${tagName}" ${isChecked ? 'checked' : ''} onchange="toggleStatusFilter('${tagName}')"> ${typeIcon} <span style="margin-left:4px;">${tagName}</span>`;
            group.appendChild(label);
        });
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
        card.style.border = `3px solid ${pData.border}`;
        
        // --- [엘다인 금색 글로우 로직] ---
        if (char.Eldyne && char.Eldyne.trim() !== "" && char.Eldyne !== "X") {card.classList.add('eldyne-card');}


        card.onclick = () => {
            if (typeof window.openDetailModal === 'function') {
                window.openDetailModal(char, activeContext);
            }
        };
        
        const topBgAttr = isResonance 
            ? `class="card-top bg-resonance"` 
            : `class="card-top" style="background: ${pData.bg};"`;

        card.innerHTML = `
            <div ${topBgAttr} style="position: relative; width: 100%; aspect-ratio: 1 / 1; overflow: hidden; border-radius: 12px 12px 0 0; display: block;">
                <img src="./assets/icons/chara_image/초상화_${char.name}.webp" class="char-img" 
                     style="width: 100%; height: 100%; object-fit: cover;" 
                     onerror="this.src='./assets/icons/chara_image/default.webp'">
                
                <img src="./assets/icons/personality/${char.personality}.webp" style="position: absolute; top: 6px; left: 6px; width: 28px; height: 28px; z-index: 2; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));">
                
                <div style="position: absolute; bottom: 8px; left: 0; width: 100%; padding: 0 8px; display: flex; justify-content: space-between; align-items: center; z-index: 2;">
                    <img src="./assets/icons/role/${char.role}.webp" style="width: 26px; height: 26px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));">
                    <img src="./assets/icons/line/${char.line}.webp" style="width: 28px; height: 28px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));">
                </div>

                <div style="position: absolute; bottom: 6px; width: 100%; z-index: 3;">
                    ${makeStarHTML(char.star)}
                </div>
            </div>

            <div class="card-bottom" style="background: #ffffff; padding: 10px 5px; border-top: 1px solid rgba(0,0,0,0.05); display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 85px;">
                
                <div class="char-name" style="font-size: 1.1rem; font-weight: 800; color: #333; margin-bottom: 6px; text-align: center; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${char.name}
                </div>
                
                <div class="grade-info" style="display: flex; flex-direction: column; gap: 4px; align-items: center; width: 100%;">
                    <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; max-width: 95px;">
                        <span style="font-size: 0.72rem; color: #777; font-weight: 800;">저</span>
                        ${makeMainBadge(char.low_grade)}
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; max-width: 95px;">
                        <span style="font-size: 0.72rem; color: #777; font-weight: 800;">고</span>
                        ${makeMainBadge(char.high_grade)}
                    </div>
                </div>
            </div>`;
            
        container.appendChild(card);
    });
}

function makeMainBadge(grade) {
    if (!grade || grade === 'X' || grade === '?') return '<span style="color:#ccc; font-size:0.8rem;">-</span>';
    
    const color = getGradeColor(grade);
    return `
        <span style="
            background: ${color}; 
            color: white; 
            font-size: 0.72rem;    /* 폰트 크기 업 */
            font-weight: 900;     /* 더 두껍게 */
            padding: 3px 8px;     /* 여백 대폭 증가 */
            border-radius: 6px;   /* 둥근 느낌 유지 */
            line-height: 1;
            white-space: nowrap;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1); /* 미세한 입체감 */
        ">
            ${grade}
        </span>
    `;
}

function toggleOrder() { isAscending = !isAscending; document.getElementById('order-btn').innerText = isAscending ? "▲" : "▼"; handleSortFilter(); }
function toggleStatusFilter(s) { selectedStatuses.has(s) ? selectedStatuses.delete(s) : selectedStatuses.add(s); handleSortFilter(); }
function setFilterTab(t) { currentFilterTab = t; document.querySelectorAll('#modal-filter .tab-btn').forEach(b => b.classList.toggle('active', b.id === `tab-${t}`)); refreshFilterList(); }
function openFilterModal() { document.getElementById('modal-filter').classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
function closeFilterModal() { document.getElementById('modal-filter').classList.add('hidden'); document.body.style.overflow = 'auto'; }
function resetFilters() {
    selectedStatuses.clear();
    const searchInput = document.getElementById('filter-search');
    if (searchInput) searchInput.value = '';
    setFilterTab('all');
    handleSortFilter(); 
}
function openInfoModal() { document.getElementById('info-content').innerText = infoText; document.getElementById('modal-info').classList.remove('hidden'); document.body.style.overflow='hidden';}
function closeModal(id) { document.getElementById(id).classList.add('hidden'); document.body.style.overflow='auto';}
function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

loadExternalData();
window.onscroll = () => { document.getElementById("top-btn").style.display = (window.scrollY > 300) ? "flex" : "none"; };