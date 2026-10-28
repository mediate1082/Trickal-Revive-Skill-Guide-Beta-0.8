// 사이트 공용 탭 줄 — 네 페이지가 같은 목록을 쓴다.
// 페이지마다 <nav class="tg-sitenav" data-page="…"></nav> 만 두면 여기서 채운다.
// ⚠ 페이지를 더하면 이 목록 한 곳만 고친다 (HTML 네 벌을 따로 고치지 않게 하려는 것)
(function () {
    // color — 그 페이지 알약 색. 아이콘의 주색에서 뽑았다 (CSS 가 30% 로 섞어 쓴다)
    const PAGES = [
        { key: 'skill',     href: './',               label: '스킬 가이드', icon: 'NerIcon2.webp',           color: '#B9DD63' },
        { key: 'recommend', href: './recommend.html', label: '사도 추천',   icon: '아이콘_사도 추천.webp',   color: '#6CCB5F' },
        { key: 'artifact',  href: './artifact.html',  label: '아티팩트',    icon: '아이콘_카드.webp',        color: '#9A86E8' },
        { key: 'tier',      href: './tiermaker.html', label: '티어 메이커', icon: '아이콘_티어 메이커.webp', color: '#F2B13C' },
    ];
    const v = typeof APP_VERSION !== 'undefined' ? '?v=' + APP_VERSION : '';
    document.querySelectorAll('.tg-sitenav').forEach(nav => {
        const cur = PAGES.find(p => p.key === nav.dataset.page);
        nav.setAttribute('aria-label', '사이트 메뉴');
        // 알약에 이름(site-pill)을 달아 두면 페이지를 넘길 때 옛 탭에서 새 탭으로 미끄러지며 색이 바뀐다.
        // ⚠ 알약은 탭 뒤에 깔린 **따로 된 조각**이다. 탭 자체에 배경을 주면 탭마다 이름이 달라
        //   "옮겨 가는" 게 아니라 한쪽이 꺼지고 다른 쪽이 켜진다
        nav.innerHTML = '<div class="tg-sitenav-inner"><div class="tg-sitenav-row">' +
            (cur ? '<span class="tg-sitenav-pill" style="--pc:' + cur.color + '"></span>' : '') +
            PAGES.map(p =>
                '<a class="tg-sitenav-tab' + (p === cur ? ' on" aria-current="page' : '') + '" href="' + p.href + '">' +
                '<img src="assets/icons/common_icons/' + p.icon + v + '" alt="">' + p.label + '</a>'
            ).join('') + '</div></div>';
        // 헤더 줄 안(로고와 오른쪽 버튼 사이)으로 옮긴다. 한 줄로 둘지 아래 줄로 내릴지는 CSS 가 폭을 보고 정한다.
        // ⚠ HTML 에서는 헤더 **밖**에 둔다 — 이 스크립트가 못 돌아도 탭 줄은 헤더 아래에 멀쩡히 남는다
        const hi = document.querySelector('.tg-header-inner');
        if (hi && hi.lastElementChild) hi.insertBefore(nav, hi.lastElementChild);
        const row = nav.querySelector('.tg-sitenav-row'), pill = row.querySelector('.tg-sitenav-pill');
        const on = row.querySelector('.on');
        if (!on) return;
        // 알약 자리는 글자 폭에 달려 있어 잰다. 웹폰트가 늦게 오면 폭이 바뀌므로 크기를 지켜본다
        const place = () => { pill.style.left = on.offsetLeft + 'px'; pill.style.width = on.offsetWidth + 'px'; };
        place();
        new ResizeObserver(place).observe(on);

        // ── 알약이 옛 탭에서 새 탭으로 미끄러지기 ──
        // ⚠ 페이지 전환(View Transitions)에 알약을 맡기지 않는다. 탭마다 폭이 달라 브라우저가
        //   알약의 **크기**를 애니메이션하는데, 크기는 메인 스레드에서 돈다 — 사도 추천처럼 열자마자
        //   무거운 페이지에서 그 일과 부딪혀 알약이 덜컥거렸다.
        //   대신 떠나기 전 자리를 적어 두고, 새 페이지에서 그 자리부터 transform 으로만 옮긴다 (GPU 담당)
        row.addEventListener('click', e => {
            if (!e.target.closest('.tg-sitenav-tab')) return;
            try { sessionStorage.setItem('tgPill', JSON.stringify({ l: pill.offsetLeft, w: pill.offsetWidth })); } catch (_) {}
        });
        let from = null;
        try { from = JSON.parse(sessionStorage.getItem('tgPill')); sessionStorage.removeItem('tgPill'); } catch (_) {}
        if (from && from.w && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
            const dx = from.l - on.offsetLeft, sx = from.w / on.offsetWidth;
            if (Math.abs(dx) > 1) {
                pill.style.transformOrigin = '0 50%';
                pill.style.transform = 'translateX(' + dx + 'px) scaleX(' + sx + ')';
                pill.getBoundingClientRect();   // 시작 자리를 먼저 그리게 한다
                pill.style.transition = 'transform .34s cubic-bezier(.2, .7, .2, 1)';
                pill.style.transform = '';
                pill.addEventListener('transitionend', () => { pill.style.transition = ''; }, { once: true });
            }
        }
        // 좁은 화면에서 가로로 밀릴 때 지금 페이지가 보이게
        nav.firstChild.scrollLeft = on.offsetLeft - 16;
    });

    // ── 첫 화면 카드 차례 등장 ──
    // 페이지를 열면 카드가 왼쪽 위부터 차례로 떠오른다. 카드는 CSV 를 읽은 **뒤에** 그려지므로
    // 나타나기를 지켜보다가 처음 한 번만 건다.
    // ⚠ 화면에 보이는 카드만, 최대 MAX 장. 전부 걸면 136명째가 몇 초 뒤에야 나와 스크롤이 답답하다
    // ⚠ 투명도·위치만 움직인다 (CSS `.tg-card-in`) — GPU 가 혼자 돌려 그리기 작업과 안 부딪힌다
    // ⚠ 티어 메이커는 뺀다 — 작은 카드가 촘촘한 게 그 페이지의 성격이라 하나씩 떠오르면 어수선하다
    //   (그 페이지 카드도 `.char-card` 를 같이 달고 있어 `.tm-card` 로 따로 걸러야 한다)
    const CARDS = '.char-card:not(.tm-card), .ar-card, .rc-card, .rc-home-card';
    // LEAD — 조작 영역(필터 바·탭 상자, CSS `tg-ctrl-in`)이 먼저 자리 잡게 카드를 한 박자 늦춘다
    const MAX = 20, STEP = 22, LEAD = 80;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const seen = new WeakSet();
    let pending = 0;
    function stagger() {
        pending = 0;
        let i = 0;
        for (const el of document.querySelectorAll(CARDS)) {
            if (seen.has(el)) continue;
            // ⚠ 막 붙은 카드는 아직 폭이 0 일 수 있다 — 거르기만 하고 '본 것' 으로 치지 않아야
            //   다음 차례에 다시 본다 (먼저 표시했다가 한 장도 안 걸린 적이 있다)
            const r = el.getBoundingClientRect();
            if (!r.width || r.top > innerHeight || r.bottom < 0 || i >= MAX) continue;
            seen.add(el);
            el.style.setProperty('--tg-in-delay', (LEAD + i++ * STEP) + 'ms');
            el.classList.add('tg-card-in');
            el.addEventListener('animationend', () => el.classList.remove('tg-card-in'), { once: true });
        }
        if (i) mo.disconnect();   // 한 번 걸었으면 끝 — 필터·탭 전환은 각 페이지의 애니메이션이 맡는다
    }
    const mo = new MutationObserver(() => { if (!pending) pending = requestAnimationFrame(stagger); });
    // 속성도 본다 — 카드를 숨긴 채 다 그려 두고 나중에 `hidden`·클래스만 풀어 보이는 페이지가 있다
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    setTimeout(() => mo.disconnect(), 5000);   // 데이터가 끝내 안 오면 지켜보기를 그만둔다
})();
