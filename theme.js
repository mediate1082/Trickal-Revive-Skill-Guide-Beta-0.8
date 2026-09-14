/* ── 테마 (라이트/다크) — 전 페이지 공용 ──────────────────────────
   index.html · tiermaker.html · recommend.html 이 이 파일 하나를 참조합니다.

   ⚠ data-theme 은 항상 'light' 또는 'dark' 를 **명시**합니다.
     속성을 지우는 방식으로 바꾸면 [data-theme="light"] 셀렉터가 전부 무력화됩니다.

   <head> 에서 classic script 로 먼저 불러 초기 플래시를 막고,
   버튼 아이콘은 DOM 이 준비된 뒤 다시 한 번 칠합니다.                  */
(function () {
    var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/></svg>';
    var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

    function paintIcon(theme) {
        var btn = document.getElementById('theme-toggle');
        if (btn) btn.innerHTML = theme === 'dark' ? SUN : MOON;
    }

    function current() {
        return document.documentElement.getAttribute('data-theme') || 'light';
    }

    /* 초기 적용 — 저장값 > OS 설정 > 라이트 */
    var saved = null;
    try { saved = localStorage.getItem('theme'); } catch (e) { /* 사생활 보호 모드 등 */ }
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', saved || (prefersDark ? 'dark' : 'light'));

    window.toggleTheme = function () {
        var next = current() === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('theme', next); } catch (e) { /* 무시 */ }
        paintIcon(next);

        var btn = document.getElementById('theme-toggle');
        if (btn) {
            btn.classList.remove('is-pulsing');
            void btn.offsetWidth;                       // 리플로우로 애니메이션 재시작
            btn.classList.add('is-pulsing');
            btn.addEventListener('animationend', function () {
                btn.classList.remove('is-pulsing');
            }, { once: true });
        }
    };

    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', function () { paintIcon(current()); });
    else
        paintIcon(current());
})();
