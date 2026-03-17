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
    // ui.js로 모든 DB 뭉치를 전달합니다.
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

function displayCards(data, id, append = false) {
    const container = document.getElementById(id); 
    if (!append) container.innerHTML = "";
    
    data.forEach(char => {
        const card = document.createElement('div');
        card.className = 'card';
        card.onclick = () => window.openDetailModal(char);
        
        // char.low_grade 등이 undefined일 경우를 대비해 빈 문자열 처리
        const low = char.low_grade || '?';
        const high = char.high_grade || '?';

    card.innerHTML = `
        <div class="image-wrapper">
            <img src="./assets/images/${char.name}.webp" class="char-img" onerror="this.src='./assets/images/default.webp'">
            <img src="./assets/icons/personality/${char.personality}.webp" class="icon p-icon">
            <img src="./assets/icons/role/${char.role}.webp" class="icon r-icon">
            <img src="./assets/icons/line/${char.line}.webp" class="icon l-icon">
        </div>
        <div class="char-name" style="font-size: 1.05rem; margin-bottom: 4px;">${char.name}</div>
        
        <div class="grade-info" style="display: flex; flex-direction: column; gap: 8px; align-items: center; margin-top: 10px; padding: 0 5px;">
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; max-width: 100px;">
                <span style="font-size: 0.75rem; color: #555; font-weight: 800; flex-shrink: 0;">저학년</span>
                ${makeMainBadge(char.low_grade)}
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; max-width: 100px;">
                <span style="font-size: 0.75rem; color: #555; font-weight: 800; flex-shrink: 0;">고학년</span>
                ${makeMainBadge(char.high_grade)}
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