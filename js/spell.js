/* ══ 심해 대격돌 · 스펠 카드 ═══════════════════════════════════════
   사도 추천 페이지(`recommend.js`)가 **스펠이 있는 덱을 처음 그릴 때** 불러온다 (`loadMods`).
   스타일은 `css/spell.css` + 코스트 배지 `.fa-cost` 가 있는 `css/frontier.css` (둘 다 그때 붙는다).
   데이터 맵(`SPELLS`)은 `recommend.js` 가 채워 `setup` 으로 넘긴다. */

let esc, SPELLS;
export function setup(ctx) {
    ({ esc, spells: SPELLS } = ctx);
}

const SPELL_GRADE_N = { 일반: 1, 고급: 2, 희귀: 3, 전설: 4 };
export function buildSpellCard(name, count, note) {
    const s = SPELLS.get(name);
    if (!s) return null;
    const n = SPELL_GRADE_N[s.grade] || 1;
    /* ⚠ `url()` 을 사용자 속성으로 넘기면 스타일시트(css/) 기준으로 풀린다 — 절대 주소로 넘긴다 */
    const abs = p => new URL(p, document.baseURI).href;
    const el = document.createElement('div');
    el.className = 'rc-spell';
    el.dataset.grade = s.grade;
    el.style.cssText = `--base:url('${abs(`assets/icons/spell_card/Ingame_CardBase_Grade_${n}.webp`)}');`
        + `--art:url('${abs(`assets/icons/spells/SpellCardIcon_${s.no}.webp`)}')`;
    if (note) el.dataset.tooltip = `${name}\n${note}`;
    el.innerHTML = `<div class="rc-spell-rim"></div><div class="rc-spell-band"></div><div class="rc-spell-base"></div><div class="rc-spell-art"></div><div class="rc-spell-plate"></div>
        <img class="rc-spell-hat" src="assets/icons/spell_card/Ingame_CardIcon_Spell.webp" alt="">
        ${count > 1 ? `<span class="rc-spell-cnt"><img src="assets/icons/spell_card/Ingame_Spell_Icon_2.webp" alt=""><b>×${count}</b></span>` : ''}
        <span class="rc-spell-name"${name.length >= 9 ? ' data-long' : ''}>${esc(name)}</span>
        ${s.cost ? `<span class="fa-cost rc-spell-cost"><i class="base"></i><i class="wheel"></i><i class="rim"></i><b>${esc(s.cost)}</b></span>` : ''}`;
    el.setAttribute('aria-label', count > 1 ? `${name} ${count}장` : name);
    return el;
}
