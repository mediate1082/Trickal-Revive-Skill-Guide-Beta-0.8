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
    let tip = null, raf = 0;

    function box() {
        if (!tip) {
            tip = document.createElement('div');
            tip.className = 'tg-tip';
            tip.setAttribute('role', 'tooltip');
            document.body.appendChild(tip);
        }
        return tip;
    }

    function place(target) {
        const t = box();
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
    }

    function show(target) {
        const text = target.getAttribute('data-tooltip');
        if (!text) return;
        const t = box();
        t.textContent = text;
        t.classList.add('is-on');
        /* 글자를 넣은 **뒤에** 재야 폭이 맞다 */
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => place(target));
        place(target);
    }

    const hide = () => { if (tip) tip.classList.remove('is-on'); };
    const near = e => (e.target && e.target.closest) ? e.target.closest('[data-tooltip]') : null;

    document.addEventListener('mouseover', e => { const t = near(e); if (t) show(t); });
    document.addEventListener('mouseout', e => { if (near(e)) hide(); });
    /* 키보드로 훑을 때도 보여야 한다 */
    document.addEventListener('focusin', e => { const t = near(e); if (t) show(t); });
    document.addEventListener('focusout', hide);
    window.addEventListener('scroll', hide, { passive: true });
})();
