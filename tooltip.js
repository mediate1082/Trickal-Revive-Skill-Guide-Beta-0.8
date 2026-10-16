/* ── 떠 있는 툴팁 ────────────────────────────────────────────
   `data-tooltip="설명"` 을 붙인 요소에 마우스를 올리면 뜹니다.

   왜 CSS `::after` 가 아니라 이 방식인가 —
   ⚠ 툴팁을 띄우고 싶은 자리가 **`overflow: hidden` 안**인 경우가 많다.
     엘다인 별은 `.card-top`(초상화 프레임) 안에 있고, 그 위로 `.rc-stage` 도
     잘라낸다. `::after` 로는 어느 쪽에든 잘린다.
     `<body>` 바로 아래 하나 띄워 두고 자리만 옮기면 아무것도 못 자른다.
   ⚠ 브라우저 기본 `title` 은 **뜨기까지 1초 넘게 걸리고 꼴도 못 맞춘다.**

   ⚠ `.rc-tab[data-tip]` 는 **다른 것**이다 (탭 설명, CSS `::after`).
     이름이 비슷하니 헷갈리지 말 것 — 이쪽은 `data-tooltip` 이다.        */

(function () {
    let tip = null, tip2 = null, raf = 0;

    function box() {
        if (!tip) {
            tip = document.createElement('div');
            tip.className = 'tg-tip';
            tip.setAttribute('role', 'tooltip');
            document.body.appendChild(tip);
        }
        return tip;
    }
    /* 둘째 상자 — `data-tooltip-2` 가 있을 때만 쓴다.
       ⚠ 한 상자에 `
` 으로 줄을 나누는 것과 **다른 쓰임**이다. 줄바꿈은 같은 이야기의
         연장이고, 둘째 상자는 **성격이 다른 정보**(이름 ↔ 배치 규칙)를 따로 세울 때 쓴다. */
    function box2() {
        if (!tip2) {
            tip2 = document.createElement('div');
            tip2.className = 'tg-tip tg-tip-2';
            tip2.setAttribute('role', 'tooltip');
            document.body.appendChild(tip2);
        }
        return tip2;
    }

    function place(target) {
        const t = box();
        const extra = tip2 && tip2.classList.contains('is-on') ? tip2 : null;
        /* ⚠ `offsetWidth/Height` 로 잰다. `getBoundingClientRect` 는 나타날 때
             걸어 둔 `transform` 까지 반영해서 몇 px 어긋난다. */
        const w = t.offsetWidth, h = t.offsetHeight;
        const r = target.getBoundingClientRect();
        const gap = 10;
        let y = r.top - h - gap;
        if (y < 8) y = r.bottom + gap;            /* 위가 좁으면 아래로 */
        let x = r.left + r.width / 2 - w / 2;
        x = Math.max(8, Math.min(x, innerWidth - w - 8));   /* 화면 밖으로 안 나가게 */
        t.style.left = Math.round(x) + 'px';
        t.style.top = Math.round(y) + 'px';
        /* 둘째 상자는 첫째 **바로 아래**에 쌓는다. 가로는 첫째의 가운데에 맞춘다 */
        if (extra) {
            const w2 = extra.offsetWidth, h2 = extra.offsetHeight;
            let x2 = r.left + r.width / 2 - w2 / 2;
            x2 = Math.max(8, Math.min(x2, innerWidth - w2 - 8));
            let y2 = y + h + 6;
            if (y2 + h2 > innerHeight - 8) y2 = y - h2 - 6;   /* 아래가 좁으면 위로 */
            extra.style.left = Math.round(x2) + 'px';
            extra.style.top = Math.round(y2) + 'px';
        }
    }

    function show(target) {
        const text = target.getAttribute('data-tooltip');
        if (!text) return;
        const t = box();
        t.textContent = text;
        t.classList.add('is-on');
        const more = target.getAttribute('data-tooltip-2');
        if (more) { const t2 = box2(); t2.textContent = more; t2.classList.add('is-on'); }
        else if (tip2) tip2.classList.remove('is-on');
        /* 글자를 넣은 **뒤에** 재야 폭이 맞다 */
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => place(target));
        place(target);
    }

    const hide = () => {
        if (tip) tip.classList.remove('is-on');
        if (tip2) tip2.classList.remove('is-on');
    };
    const near = e => (e.target && e.target.closest) ? e.target.closest('[data-tooltip]') : null;

    document.addEventListener('mouseover', e => { const t = near(e); if (t) show(t); });
    document.addEventListener('mouseout', e => { if (near(e)) hide(); });
    /* 키보드로 훑을 때도 보여야 한다 */
    document.addEventListener('focusin', e => { const t = near(e); if (t) show(t); });
    document.addEventListener('focusout', hide);
    window.addEventListener('scroll', hide, { passive: true });
})();
