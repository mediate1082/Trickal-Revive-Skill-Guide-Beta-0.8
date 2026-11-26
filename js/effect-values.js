/* 부가 효과 수치 — 효과 이름으로 스킬 표의 자리표를 찾아 계수 · 지속시간 · 쿨을 꺼낸다 (2026-11-21)
   ────────────────────────────────────────────────────────────────────────────
   부가 효과 탭(`ui.js` 의 `renderEffectItems`)과 검수 페이지(`tools/effect-values-trial/review.html`)가 같이 쓴다.
   ⚠ 규칙을 고치면 검수 페이지를 다시 열어 특이 사항 목록이 어떻게 바뀌는지 볼 것.

   ── 어디서 찾나 ──
     low    low_skill_DB    low_skill_stat_template   / Lv.10
     high   high_skill_DB   high_skill_stat_template  / Lv.10(PvE) · Lv.10(PvP) · high_cooldown(PvE) · cooldown(PvP)
     normal normal_Atk_DB   basic_stat_template       / basic_atk_value
     power  normal_Atk_DB   enhance_stat_template     / enhance_atk_value
     aside  aside_DB        aside2_stat_template      / aside2_stat_value
   - 스킬 표에서 못 찾으면 **어사이드 ★2 표**에서 한 번 더 찾는다 — ★2 가 스킬에 효과를 더하는 경우 (롤렛 저학년의 공격력 감소)
   - 조건에 `애착` 이 있으면 **애착 아티팩트 표**(`Artifact_Attach.stat_template`)에서 찾는다 — 아래 `attachStat` 로 Lv.10 을 채운 것.
     일반 공격 애착은 레벨이 없어 값이 박혀 있다 (`기절 지속시간 : 3초`)
   - 레벨은 **Lv.10 고정**이다. 강화를 10 이상 권하는 게 바로 계수가 핵심인 경우라서 (사용자 결정)

   ── 어떻게 짝짓나 ──
     계수  자리표 줄 이름이 효과 이름과 같다 (`공격력 감소 : {3}%`), 아니면 `이름 + 량` (`모든 방어력 감소량`)
     지속  `이름 + 지속시간`, 없으면 **여러 효과를 묶은** 지속시간 줄 (롤렛 `공격력, 공격 속도 감소 지속시간` — 아래 `bundles`)
           ← 이 두 번째 규칙은 `notes` 에 `지속 대체 규칙` 으로 남긴다
     띄어쓰기는 무시한다. ★2 표 대체는 조건에 A2 가 있을 때만 한다.
     틀린 값이 나가느니 못 찾는 게 낫다 — 규칙은 일부러 좁게 둔다
   효과 이름의 괄호(`무적(개전)`)는 떼고 찾는다.

   ── 같은 칸의 다른 효과 (2026-11-24, 벨라) ──
     후보 줄이 여럿이면 **앞말에 같은 칸의 다른 효과 이름이 든 줄**을 먼저 고른다.
       벨라 저학년(★2) `받는 피해량 감소` ← `존속 발동 시 받는 피해량 감소` (같은 칸에 존속이 있다) · 지속도 `회복 및 …` 쪽
     그 줄은 **그 칸의 몫**이라, 같은 표를 보는 다른 칸(벨라 어사이드)에서는 후보에서 뺀다.
     칸 목록은 ctx 의 buffDB · debuffDB 에서 읽는다 (없으면 이 규칙은 쉰다)

   ── 조건별로 값이 둘 이상 (2026-11-24, 사용자 결정) ──
     같은 효과가 조건에 따라 세지는 줄은 `alts` 로 같이 낸다. 화면은 `계수 15% · 30% (부유함 30중첩)`
       피라 고학년 `치명타 증가` / `부유함 30중첩 치명타 증가` · 에스피 `일반 공격 적중 시 …` / `적 처치 시 …`
     조건 앞말만 (`…시` · `…당` · `중첩` · `마다`). 대상(`아군` · `자신`)·단계(`초당` · `첫 번째` · `즉시` · `지속`)는 아직 안 낸다

   돌려주는 것 — { val, valCond, alts: [{val, pvpVal, cond}], dur, pvpVal, pvpDur, cd: {pve, pvp} | null, src, notes: [...], lines: [...] }
     valCond — 계수를 앞말 붙은 줄에서 찾았을 때 그 조건 (`중첩마다`). 화면은 `계수 19% (중첩마다)`
     값이 하나도 없으면 null. `notes` · `src` · `lines` 는 검수용이다 (화면은 안 쓴다)          */

export const EFFECT_LV = 10;
const NL = '\\' + 'n';      // CSV 안의 줄바꿈은 역슬래시+n 두 글자다 (tools/stat-parse.js 참조)

const nameOf = r => (r?.chara_name || r?.name || '').trim();
const byName = (rows, n) => (rows || []).find(r => nameOf(r) === n) || null;
const split = s => String(s || '').split(',').map(x => x.trim());
/* 값 칸 — 진짜 줄바꿈으로 나뉜다. 예전 파일 일부는 ` / ` 로 적혀 있다 */
const vals = s => String(s || '').split(/\r?\n|\s\/\s/).map(x => x.trim());

/** 자리표 → [{ label, idx, idx2?, unit, line }]
 *  범위 값(`{3}% ~ {4}%` · `{6}~{7}초`)은 idx2 에 두 번째 자리를 둔다 — 띠는 `10~100%` (이드(재활) · 포셔, 2026-11-24) */
export function templateSlots(tpl) {
    return String(tpl || '').split(NL).flatMap(line => {
        /* 옛 꼴 `빨간 조명 : {0}초 동안 받는 피해량 감소 {1}%` — 인게임 표기 그대로 둔다(사용자 결정, 페스타).
           계수 줄 `받는 피해량 감소` 와 지속 줄 `받는 피해량 감소 지속시간` 둘로 풀어 읽는다 */
        const old = /:\s*\{(\d+)\}\s*초\s*동안\s+(.+?)\s*\{(\d+)\}\s*(%)?\s*$/.exec(line);
        if (old) return [{ label: old[2].trim(), idx: +old[3], unit: old[4] || '', line: line.trim() },
                         { label: old[2].trim() + ' 지속시간', idx: +old[1], unit: '초', line: line.trim() }];
        const m = /\{(\d+)\}\s*(%|초)?/.exec(line);
        if (!m) return null;
        const label = (line.includes(':') ? line.slice(0, line.indexOf(':')) : line.replace(/\{\d+\}.*/, '')).trim();
        const r = /\{\d+\}\s*(?:%|초)?\s*~\s*\{(\d+)\}\s*(%|초)?/.exec(line);
        return { label, idx: +m[1], idx2: r ? +r[1] : undefined, unit: m[2] || (r && r[2]) || '', line: line.trim() };
    }).filter(Boolean);
}

/** 애착 아티팩트 스킬 수치 → `라벨 : 값` 줄 배열 (2026-11-24, 사용자 결정 — 스킬 슬라이더를 따라간다)
 *  - 저학년·고학년 애착은 `stat_template` 이 자리표이고 값은 `Lv.1`~`Lv.13` 칸 (저학년 표와 같은 꼴). 출처는 트릭컬 노트
 *  - 일반 공격 애착은 레벨이 없다 — 값이 박힌 그대로 (`Lv.1` 칸이 비어 있다). `fixed: true`
 *  - 그 레벨 칸이 없으면 **그 아래 가장 가까운 레벨** (레비는 Lv.10 까지다)
 *  - `pvp` 면 `pvp_diff` 의 같은 라벨 줄로 갈아 끼운다 (제이드 `SP 회복 : 0%`)
 *  ⚠ 아티팩트 모달은 Lv.1 고정 — 다른 아티팩트 수치도 전부 Lv.1 이라서 (사용자 결정). `artifact.js` 는 이 파일을 안 싣고 같은 일을 따로 한다 */
export function attachStat(row, lv = 1, pvp = false) {
    const tpl = String(row?.stat_template || '');
    let use = 0;
    for (let i = 1; i <= Math.min(13, +lv || 1); i++) if (String(row?.['Lv.' + i] || '').trim()) use = i;
    const v = use ? vals(row['Lv.' + use]) : [];
    const lab = l => (l.includes(':') ? l.slice(0, l.indexOf(':')) : l).trim();
    const diff = pvp ? new Map(String(row?.pvp_diff || '').split(NL).filter(l => l.trim()).map(l => [lab(l), l.trim()])) : new Map();
    const lines = tpl.split(NL).map(l => l.trim()).filter(Boolean)
        .map(l => diff.get(lab(l)) || l.replace(/\{(\d+)\}/g, (m, k) => v[+k] ?? m));
    return { lines, lv: use, fixed: !use };
}

/* 띄어쓰기는 무시하고 비교한다 — `이동속도 증가` = `이동 속도 증가` */
const sq = s => String(s || '').replace(/\s+/g, '');

/* 지속시간 줄의 앞부분(`… 지속시간` 을 뗀 것)이 효과를 **묶어서** 가리키는가.
 *   `회복 및 받는 피해량 감소`  ← `받는 피해량 감소` : 맨 앞 · `, ` 뒤 · `및 ` 뒤에서 시작하고 끝까지 가면 맞다
 *   `최대 HP, 피해량 증가`      ← `피해량 증가`
 *   `공격력, 공격 속도 감소`    ← `공격력 감소` : 앞말(`공격력`)이 쉼표 목록에 있고 끝말(`감소`)로 끝나면 맞다
 *   `받는 피해량 증가`          ← `피해량 증가` 는 **아니다** (앞에 `받는` 이 붙으면 다른 효과)
 * ⚠ 예전엔 「효과 첫 낱말이 든 지속시간 줄」 이었는데, 피해량 증가에 받는 피해량 증가 지속시간을 붙이는 등 틀린 값이 나갔다 */
function bundles(rest, eff) {
    const r = sq(rest), e = sq(eff);
    if (r === e) return true;
    for (const part of rest.split(/\s*,\s*|\s+및\s+/)) if (sq(part) === e || prefixed(part, eff)) return true;
    /* `공격 및 이동 속도 감소` ← `공격 속도 감소` — 앞 낱말이 뒤 묶음의 꼬리를 나눠 쓴다 (그윈 고학년) */
    const m = /^(.+?)\s+및\s+(.+)$/.exec(rest.trim());
    if (m) {
        const w = m[2].split(/\s+/);
        for (let k = 1; k < w.length; k++) if (sq(m[1] + w.slice(k).join('')) === e) return true;
    }
    const sp = eff.lastIndexOf(' ');
    if (sp > 0) {
        const front = eff.slice(0, sp), tail = eff.slice(sp + 1);
        const parts = rest.split(/\s*,\s*/);
        if (parts.length > 1 && parts.some(p => sq(p) === sq(front)) && sq(parts[parts.length - 1]).endsWith(sq(tail))) return true;
    }
    return false;
}

/* 앞말 붙은 같은 효과 — `HP 회복`·`지속 HP 회복` ← `회복`, `총 SP 회복량` ← `SP 회복`, `주는 피해량 증가`·`적 1명당 피해량 증가` ← `피해량 증가`.
 * 이름이 그 효과로 **끝나고**(띄어쓰기 무시, 끝에 `량` 허용) 앞말이 다른 효과를 만들지 않으면 맞다.
 *   ✗ `받는 …` (받는 피해량 증가 ≠ 피해량 증가) · ✗ `SP …` (SP 회복 ≠ 회복)
 * 정확히 맞는 줄이 없을 때만 쓰고 `notes` 에 `앞말 붙은 줄` 로 남긴다 — 조건부 값(`거대화 시 …`)일 수 있어서다 */
/* 돌려주는 것 — 맞으면 앞말(`중첩마다` · `HP` …), 아니면 '' */
function prefixed(label, eff) {
    const l = label.trim(), e = eff.trim();
    for (const tail of [e, e + '량']) {
        if (!sq(l).endsWith(sq(tail)) || sq(l) === sq(tail)) continue;
        /* 앞말 — 띄어쓰기를 살린 채 끝에서 효과 글자 수만큼 뗀다 */
        let n = sq(tail).length, i = l.length;
        while (n > 0 && i > 0) { i--; if (!/\s/.test(l[i])) n--; }
        const pre = l.slice(0, i).trim();
        if (!pre || !/\s$/.test(l.slice(0, i))) continue;   // 낱말 중간에서 잘리면 다른 낱말이다 (`지속HP회복` 류는 안 받는다)
        const last = pre.split(/\s+/).pop();
        if (/^받는$/.test(last) && !/^받는/.test(e)) continue;
        if (/^SP$/i.test(last)) continue;
        /* `스킬 피해량 증가` · `일반 공격 피해량 증가` · `마법 피해량 증가` 는 `피해량 증가` 와 다른 효과다 (마스터에 따로 있다).
           시스트 ★2 `고학년 스킬 피해량 증가 15%` 를 아군 `피해량 증가` 값으로 집었다 — 인게임 확인 2026-11-24 */
        if (/^(스킬|공격|마법|물리)$/.test(last) && /^피해량?\s/.test(e)) continue;
        return pre;
    }
    return '';
}

/* 앞말 가운데 화면에 붙일 조건 — 뜻이 없는 낱말은 뗀다. 남는 게 없으면 '' (사용자 결정 2026-11-22: 조건부 값은 `계수 19% (중첩마다)`)
 *   `HP` · `총` · `주는` · `기본` → 뗀다   /   `초당` · `중첩마다` · `적 1명당` · `거대화 시` · `아군` → 붙인다 */
const PLAIN = new Set(['HP', '총', '주는', '기본',
    /* 노트 꼴 `현재 고학년 스킬 재사용 대기시간 즉시 감소` 의 `현재` — 조건이 아니다 (리스티 강화 공격 애착, 2026-11-25) */
    '현재',
    /* 보호막에 이름만 붙인 것 — 특별한 효과가 아니다 (사용자 확인 2026-11-22: 화산 · 야광 · 은방울). 존재의 보호막도 같은 꼴 */
    '화산', '야광', '은방울', '존재의',
    /* 대상 — 대상 칩(buff/debuff_DB 의 _target)이 이미 보여 준다 (사용자 지적 2026-11-22) */
    '아군', '자신', '적']);
/* `치명타, 치명 피해 증가` 처럼 쉼표로 끝나는 앞말은 조건이 아니라 효과 나열이다 — 붙이지 않는다 */
/* ⚠ `적 1명당` 의 `적` 은 대상이 아니라 「적 수만큼」 이라는 뜻이다 — 바로 뒤가 `○명당` 이면 남긴다 */
const condOf = (pre, slot) => {
    if (/,$/.test(pre.trim())) return '';
    for (const sw of SLOT_WORDS[slot] || []) pre = pre.replace(sw, ' ');   // 칸 이름(`강화 공격`)은 칩이 이미 말한다
    const w = pre.trim().split(/\s+/).filter(Boolean);
    return w.filter((x, i) => !PLAIN.has(x) || (x === '적' && /^(\d+명당|처치)$/.test(w[i + 1] || ''))).join(' ');
};
/* 칸 이름 — 그 칸을 가리키는 앞말 (★2 표의 `강화 공격 HP 회복`) */
const SLOT_WORDS = { low: ['저학년 스킬', '저학년'], high: ['고학년 스킬', '고학년'], normal: ['일반 공격', '기본 공격'], power: ['강화 공격'] };
/* 조건 낱말로 고를 때 뺄 것 — 너무 흔하다 */
const COND_STOP = new Set(['배치', '시', '이상', '이하', '미만', '상태', '사용', 'A2', '중']);
/* 이름 붙은 상태 → 스킬 표의 자리표 줄 이름 (`비비의 관심` ← 비비 저학년 `모든 방어력 감소량` · `모든 방어력 감소 지속시간`) */
const STATE_STAT = { '비비의 관심': ['모든 방어력 감소'],
    /* 리뉴아 고학년 자리표는 인게임 그대로 `적 정지 지속시간` — 상태는 2026-11-26 에 `시간 정지` 로 합쳤다 (강화 공격은 `시간 정지 지속시간`) */
    '시간 정지': ['적 정지'] };
/* 이름이 다른 같은 효과 — 자리표 줄 이름 쪽 (2026-11-24) */
function aliasesOf(eff) {
    const out = [];
    /* 노트(2026-11-19 데이터)는 즉시 줄어드는 쿨을 `재사용 대기시간 즉시 감소` 로 적는다 */
    if (eff === '고학년 쿨타임 감소') out.push('재사용 대기시간 감소', '재사용 대기시간 즉시 감소', '고학년 스킬 재사용 대기시간 감소',
        '고학년 스킬 재사용 대기시간 즉시 감소', '대기시간 감소');   // 티그(영웅) `… 고학년 스킬 대기 시간 감소`
    if (eff === '고학년 쿨타임 증가') out.push('재사용 대기시간 증가', '재사용 대기시간 즉시 증가');
    if (eff === '모든 행동 가속') out.push('가속');                               // 리뉴아 고학년 `아군 가속`
    /* 이름 붙은 상태 — 스킬 표는 그 상태가 하는 일로 적는다 (2026-11-25, 사용자 확인: 인게임에선 비비의 관심 디버프가 걸린다) */
    if (STATE_STAT[eff]) out.push(...STATE_STAT[eff]);
    if (/^주는\s/.test(eff)) out.push(eff.replace(/^주는\s+/, ''));            // 셰럼 ★2 `피해량 감소` ← 주는 피해량 감소
    const r = eff.replace(/(회복|피해)(?=\s)/, '$1량');                         // 디아나(왕년) `기본 SP 회복량 감소` ← SP 회복 감소
    if (r !== eff) out.push(r);
    return out;
}
/* 조건 앞말인가 — 단계(초당 · 첫 번째 …)와 대상은 아니고, 조건 꼴(…시 · …당 · 중첩 · 마다)이다 */
const STEP = /첫 번째|두 번째|즉시|지속|초당|타수당|1회당/;
const isCond = c => !!c && !STEP.test(c) && /(시|당|중첩|마다)(\s|$)/.test(c);
/* 앞말에 이름이 들었나 (띄어쓰기 무시) */
const hasName = (pre, names) => names.some(n => n && sq(pre).includes(sq(n)));

/* 줄 목록에서 계수 · 지속 줄을 고른다. 줄 꼴은 { label, … } 이면 된다
 *   sibs  — 같은 칸의 다른 효과 이름 (그 이름이 앞말에 든 줄을 먼저 고른다)
 *   taken — 다른 칸이 가져간 이름 (그 이름이 앞말에 든 줄은 후보에서 뺀다) */
function pickLines(lines, eff, sibs = [], taken = [], target = '', opt = {}) {
    const notes = [];
    if (taken.length) lines = lines.filter(s => { const pre = prefixed(s.label.replace(/\s*지속\s*시간$/, ''), eff); return !pre || !hasName(pre, taken); });
    let vs = lines.filter(s => sq(s.label) === sq(eff) || sq(s.label) === sq(eff) + '량');
    let dur = lines.find(s => sq(s.label) === sq(eff) + '지속시간');
    let dropped = [];
    /* 대상이 아군 쪽(대상 칸에 `자신` 이 없음)이면 `아군 …` 줄을 먼저 — 이드 저학년 보호막(파티)은 `아군 보호막 45%`,
       에피카 공속(주변)은 `아군 공격 속도 증가 12.5%` (2026-11-24). 정확히 맞는 줄이 있을 때만 — 자신 값 / 아군 값 중에서 고르는 규칙이다 */
    if (vs.length && target && !/자신/.test(target)) {
        const ally = lines.find(s => !/지속\s*시간$/.test(s.label) && /(^|\s)아군(\s|$)/.test(prefixed(s.label, eff)));
        if (ally && !vs.includes(ally)) {
            dropped = vs; vs = [ally]; notes.push('대상이 아군이라 아군 줄을 고름');
            const ad = lines.find(s => sq(s.label) === sq(ally.label) + '지속시간');
            if (ad) dur = ad;
        }
    }
    if (!dur) {
        dur = lines.find(s => /지속\s*시간$/.test(s.label) && bundles(s.label.replace(/\s*지속\s*시간$/, ''), eff));
        if (dur) notes.push('지속 대체 규칙');
    }
    /* 정확한 줄이 없으면 앞말 붙은 줄 */
    let valCond = '';
    if (!vs.length) {
        vs = lines.filter(s => !/지속\s*시간$/.test(s.label) && prefixed(s.label, eff));
        /* 대상이 안 맞는 줄은 뺀다 — 대상 칸에 `자신` 이 없는데 `자신 HP 회복` 을 집으면 안 된다 (다야(퓨어샤인) ★2: 주변 아군 회복은 `스타☆샤인 HP 회복`) */
        if (vs.length > 1 && target) {
            const who = s => (prefixed(s.label, eff).match(/(^|\s)(자신|아군)(\s|$)/) || [])[2];
            const fit = vs.filter(s => { const w = who(s); return !w || (w === '자신' ? /자신/.test(target) : !/^자신$/.test(target)); });
            if (fit.length && fit.length < vs.length) { dropped = [...dropped, ...vs.filter(s => !fit.includes(s))]; notes.push('대상 안 맞는 줄 뺌: ' + dropped.map(s => s.label).join(' / ')); vs = fit; }
        }
        /* 조건 · 칸 낱말이 앞말에 든 줄을 먼저 — 죠안 강화 공격 `피해량 증가`(후열 배치 시) ← `후열 배치 아군 주는 피해량 증가`,
           레비(졸업) 강화 공격 `회복`(A2) ← ★2 `강화 공격 HP 회복` (2026-11-24) */
        if (vs.length > 1) {
            const words = [...String(opt.cond || '').split(/[\s\/+,&()]+/).filter(w => w.length >= 2 && !COND_STOP.has(w)), ...(SLOT_WORDS[opt.slot] || [])];
            const score = s => words.filter(w => sq(prefixed(s.label, eff)).includes(sq(w))).length;
            const best = Math.max(...vs.map(score));
            const top = vs.filter(s => score(s) === best);
            if (best > 0 && top.length === 1) { notes.push('조건 낱말로 고름: ' + top[0].label); dropped = [...dropped, ...vs.filter(s => s !== top[0])]; vs = [top[0]]; }
        }
        if (vs.length) {
            notes.push('앞말 붙은 줄: ' + vs.map(s => s.label).join(' / '));
            valCond = condOf(prefixed(vs[0].label, eff), opt.slot);
        }
    }
    if (!dur) {
        dur = lines.find(s => /지속\s*시간$/.test(s.label) && prefixed(s.label.replace(/\s*지속\s*시간$/, ''), eff));
        if (dur) notes.push('앞말 붙은 지속: ' + dur.label);
    }
    /* 계수 줄과 지속 줄의 대상(자신 / 아군)이 어긋나면 지속을 버린다 — 벨라 고학년 `자신 HP 회복`(즉시)에
       `아군 회복 지속시간 4초` 가 붙었다 (2026-11-24) */
    const whoOf = l => (String(l || '').match(/(^|\s)(자신|아군)(\s|$)/) || [])[2];
    if (dur && vs[0] && whoOf(vs[0].label) && whoOf(dur.label) && whoOf(vs[0].label) !== whoOf(dur.label)) {
        notes.push('대상 다른 지속 뺌: ' + dur.label); dur = null;
    }
    /* 이름이 조금 다른 지속 줄 — `받는` · `량` 을 빼고 같으면 (벨벳 `물리 피해 감소 지속시간` ← 받는 물리 피해량 감소) */
    if (!dur && vs.length) {
        const loose = x => sq(x).replace(/^받는/, '').replace(/량/g, '');
        dur = lines.find(s => /지속\s*시간$/.test(s.label) && loose(s.label.replace(/\s*지속\s*시간$/, '')) === loose(eff));
        if (dur) notes.push('이름 비슷한 지속: ' + dur.label);
    }
    /* 칸 전체에 걸리는 지속 줄 — 계수 줄을 찾았을 때만.
       `효과 지속 시간`(슈로) · `지속시간`(바리에) · `버프 지속시간`(우이 ★2) · `피해량 변화 지속시간`(캬롯 · 헤일리, 피해량 효과만).
       ⚠ 어사이드 칸 자신의 패시브(opt.passive)는 상시라 붙이지 않는다 — 우이 ★2 `받는 피해량 감소` 에 버프 지속 10초가 붙는다 */
    if (!dur && vs.length && !opt.passive) {
        dur = lines.find(s => /^(효과|버프)?\s*지속\s*시간$/.test(s.label))
           || (/피해량/.test(eff) ? lines.find(s => /^피해량\s*변화\s*지속\s*시간$/.test(s.label)) : null);
        if (dur) notes.push('공통 지속: ' + dur.label);
    }
    /* 즉시 값에는 지속을 붙이지 않는다 — 같은 효과의 `지속 …` 줄이 따로 있으면 그 지속시간은 그쪽 몫이다
       (루드 저학년 `즉시 HP 회복 20%` / `지속 HP 회복 20% · 3초`, 힐데 `파동 HP 회복 950%` / `지속 HP 회복 642% · 6초`) */
    if (dur && vs[0] && !/지속/.test(vs[0].label) && lines.some(s => s !== vs[0] && /(^|\s)지속(\s|$)/.test(prefixed(s.label, eff)))) {
        notes.push('즉시 값이라 지속 뺌: ' + dur.label); dur = null;
    }
    /* 「○○ 유지 중」 조건인데 ○○ 이름이 든 같은 효과 줄이 따로 있으면, 이 지속시간은 그 줄 몫이다
       (아라그니아 자신 `진주 구슬 유지 중` 받는 피해량 감소 ↔ 아군 `진주 구슬 받는 피해량 감소` · 8초).
       ⚠ 「유지 중」 만으로 빼지 않는다 — 네르(빡침) `성전의 휘장 유지 중` 은 매초 거는 3초짜리 버프다 */
    const keep = /([^+,&/]+?)\s*유지\s*중/.exec(opt.cond || '');
    if (dur && keep && vs[0] && lines.some(s => s !== vs[0] && sq(prefixed(s.label, eff)).includes(sq(keep[1])))) {
        notes.push('유지 중 조건이라 지속 뺌'); dur = null;
    }
    /* 같은 칸의 다른 효과 이름이 앞말에 든 줄 — 그 칸 몫이다. 정확히 맞는 줄이 있으면 쉰다 (아라그니아 `받는 피해량 감소` 는 그대로) */
    if (sibs.length && notes.some(x => x.startsWith('앞말 붙은 줄'))) {
        const own = lines.find(s => !/지속\s*시간$/.test(s.label) && hasName(prefixed(s.label, eff), sibs));
        if (own) {
            vs = [own]; valCond = condOf(prefixed(own.label, eff));
            notes.push('같은 칸 효과 이름으로 고름: ' + own.label);
            const d = lines.find(s => /지속\s*시간$/.test(s.label) && bundles(s.label.replace(/\s*지속\s*시간$/, ''), eff)
                                   && hasName(s.label.replace(eff, ''), sibs));
            if (d) dur = d;
            return { val: own, dur: dur || null, valCond, alts: [], notes };
        }
    }
    /* 이름이 똑같은 줄이 둘 — 기준만 다르다 (델리아 강화 공격 `HP 회복 : 최대 HP의 30%` / `HP 회복 : 입힌 피해량의 33%`). 둘 다 기준을 붙여 낸다 */
    if (vs.length > 1 && vs.every(s => sq(s.label) === sq(vs[0].label))) {
        const basis = s => String(s.line || '').replace(/^[^:]*:\s*/, '').replace(/\{.*$/, '').replace(/의\s*$/, '').trim();
        if (vs.every(basis)) {
            notes.push('조건별 값 같이 냄');
            return { val: vs[0], dur: dur || null, valCond: basis(vs[0]), alts: vs.slice(1).map(s => ({ line: s, cond: basis(s) })), notes };
        }
    }
    if (vs.length > 1) notes.push('계수 줄 여럿');
    /* 대상만 다른 같은 효과 줄 — 로네 `아군 받는 피해량 감소` 처럼. 화면엔 첫 줄만 나간다.
       `받는 …` 은 다른 효과라 뺀다 (`스킬 피해량 증가` ≠ `받는 스킬 피해량 증가`) */
    /* 앞말 규칙(`prefixed`)을 같이 쓴다 — `SP 회복` 이 `회복` 의 비슷한 줄로 잡히던 잡음을 막는다 */
    const more = lines.filter(s => !vs.includes(s) && !dropped.includes(s) && s !== dur && !/지속\s*시간$/.test(s.label) && prefixed(s.label, eff));
    if (more.length) notes.push('비슷한 줄 더 있음: ' + more.map(s => s.label).join(' / '));
    /* 같은 효과의 다른 값 — 같이 낸다 (2026-11-22 조건별, 2026-11-24 넓힘). 이런 줄만:
     *   조건   `부유함 30중첩` · `적 처치 시`                       피라 · 에스피 · 벨라 강화 공격 `존속 시`
     *   단계   `첫 번째` · `두 번째`                                디아나 저학년
     *   최대   `최대 받는 피해량 감소`                              리츠 저학년
     *   아군   대상 칸이 자신 + 아군일 때 `아군 …` 줄 (지속이 다르면 같이)   로네 `65% · 59% (아군, 6초)` · 헤일리 ★2
     * 다른 칸 이름이 든 줄(`저학년 스킬 추가 HP 회복`)은 그 칸 몫이라 뺀다. 기준이 다르면(최대 HP / 공격력) 기준을 붙인다 */
    let alts = [];
    /* 어사이드 칸은 ★2 자기 표라 `저학년 스킬 적중 시` 도 자기 조건이다 (벨리타) — 스킬 칸일 때만 거른다 */
    const otherSlot = s => !!SLOT_WORDS[opt.slot] && Object.entries(SLOT_WORDS).some(([k, ws]) => k !== opt.slot && ws.some(w => prefixed(s.label, eff).includes(w)));
    const both = /자신/.test(target) && /아군|파티|주변|열/.test(target);
    const ORD = /^(첫|두|세|네) 번째$/;
    const fine = c => isCond(c) || ORD.test(c) || c === '최대';
    if (vs[0] && (!valCond || fine(valCond))) {
        const rest = [...vs.slice(1), ...more].filter(s => !otherSlot(s));
        const cand = rest.map(s => {
            const ally = both && whoOf(s.label) === '아군';
            const c = condOf(prefixed(s.label, eff), opt.slot);
            const d = lines.find(x => sq(x.label) === sq(s.label) + '지속시간');
            return { line: s, cond: ally ? ['아군', c].filter(Boolean).join(' ') : c, ally, durLine: d && d !== dur ? d : null };
        });
        if (cand.length && cand.every(a => a.ally || fine(a.cond))) {
            const basis = s => String(s.line || '').replace(/^[^:]*:\s*/, '').replace(/\{.*$/, '').replace(/의\s*$/, '').trim();
            const bs = [vs[0], ...cand.map(a => a.line)].map(basis);
            if (new Set(bs).size > 1) {      // 기준이 다르다 — `10% (첫 번째, 최대 HP) · 2079% (두 번째, 공격력)`
                valCond = [valCond, bs[0]].filter(Boolean).join(', ');
                cand.forEach((a, i) => { a.cond = [a.cond, bs[i + 1]].filter(Boolean).join(', '); });
            }
            alts = cand;
            notes.push('조건별 값 같이 냄');
        }
    }
    return { val: vs[0] || null, dur: dur || null, valCond, alts, notes };
}

/* 같은 칸의 다른 효과(sibs)와, ★2 표를 같이 보는 다른 칸이 가져갈 이름(taken).
 * taken — 조건에 A2 가 있는 같은 효과를 가진 다른 칸의 효과 이름들 (그 칸은 ★2 표에서 자기 이름 든 줄을 가져간다) */
function slotNames(ctx, name, slot, eff) {
    const rows = [['buff', byName(ctx.buffDB, name)], ['debuff', byName(ctx.debuffDB, name)]].filter(x => x[1]);
    if (!rows.length) return { sibs: [], taken: [] };
    const SLOTS = ['low', 'high', 'normal', 'power', 'aside'];
    const list = (s) => rows.flatMap(([k, r]) => {
        const effs = split(s === 'aside' ? r.aside_passive : r[`${s}_${k}`]), conds = split(r[`${s === 'aside' ? 'aside' : s}_cond`]);
        return effs.map((e, i) => ({ eff: e.split('(')[0].trim(), cond: conds[i] || '' })).filter(x => x.eff && x.eff !== 'X');
    });
    const sibs = list(slot).map(x => x.eff).filter(e => sq(e) !== sq(eff));
    const taken = SLOTS.filter(s => s !== slot).flatMap(s => {
        const l = list(s);
        return l.some(x => sq(x.eff) === sq(eff) && /A2/.test(x.cond)) ? l.map(x => x.eff).filter(e => sq(e) !== sq(eff)) : [];
    });
    return { sibs, taken };
}

/** 한 효과의 수치. ctx — { lowSkillDB, highSkillDB, asideDB, normalAtkDB, artifactDB, attachDB, buffDB?, debuffDB? } */
export function effectNumbers(ctx, name, slot, effRaw, cond = '', target = '') {
    const eff = String(effRaw || '').split('(')[0].trim();
    if (!eff) return null;
    const lv = EFFECT_LV;
    const notes = [];
    let cd = null;
    const high = slot === 'high' ? byName(ctx.highSkillDB, name) : null;
    if (high) {
        cd = { pve: (high['high_cooldown(PvE)'] || '').trim(), pvp: (high['cooldown(PvP)'] || '').trim() };
        if (!cd.pve) cd = null; else if (cd.pvp === cd.pve) cd.pvp = '';
    }

    const { sibs, taken } = slotNames(ctx, name, slot, eff);
    /* 효과 이름 → 안 되면 다른 이름(aliasesOf)으로. 스킬 표와 애착 표가 같이 쓴다 */
    const findIn = (ls, sb, tk, passive = false) => {
        const o = { cond, slot, passive };
        let r = pickLines(ls, eff, sb, tk, target, o);
        for (const al of aliasesOf(eff)) {
            if (r.val || r.dur) break;
            r = pickLines(ls, al, sb, tk, target, o);
            if (r.val || r.dur) {
                r.notes.push('다른 이름으로 찾음: ' + al);
                if (/쿨타임/.test(eff)) r.valCond = String(r.valCond || '').replace(/고학년(\s*스킬)?/, '').trim();
            }
        }
        return r;
    };

    /* 애착 아티팩트 — 값이 박힌 설명에서 */
    if (String(cond).includes('애착')) {
        const art = (ctx.artifactDB || []).find(a => split(a.attach).includes(name));
        const row = art && (ctx.attachDB || []).find(x => (x.name || '').trim() === (art.name || '').trim());
        if (!row) return { miss: true, cd, src: 'attach', notes: ['애착 아티팩트 표에 없음'], lines: [] };
        /* 조건이 `애착 아티팩트 Lv.3 이상` 이면 Lv.3 능력치 문장에서 — 셀리네 `고학년 스킬 재사용 대기시간이 10초 감소한다` (2026-11-25).
           문장을 `고학년 스킬 재사용 대기시간 감소 : 10초` 꼴로 푼다 */
        const src = /Lv\.\s*3|3레벨/.test(cond)     // `애착 아티팩트 Lv.3 이상` (2026-11-25 표기)
            ? String(row.lv3_desc || '').split(/\.\s*/).map(t => /^(?:\S+의\s+)?(.+?)[이가]\s+(-?\d[\d.]*\s*(?:%|초)?)\s*(?:로\s*)?(증가|감소)/.exec(t.trim()))
                .filter(Boolean).map(m => `${m[1]} ${m[3]} : ${m[2]}`)
            : attachStat(row, EFFECT_LV).lines;
        const lines = src.map(l => {
            const i = l.indexOf(':');
            /* 값은 끝의 숫자만 — 노트 꼴은 `보호막 : 최대 HP의 89%` 처럼 기준이 값 쪽에 붙어 있다 (스킬 표 자리표와 같게) */
            const v = l.slice(i + 1).trim(), m = /(-?\d[\d.,]*\s*(?:%|초|개)?)\s*$/.exec(v);
            return i < 0 ? null : { label: l.slice(0, i).trim(), value: m ? m[1].replace(/\s+/g, '') : v, line: l.trim() };
        }).filter(Boolean);
        const p = findIn(lines, [], []);     // 리스티 `고학년 쿨타임 감소` ← `현재 고학년 스킬 재사용 대기시간 즉시 감소`
        if (!p.val && !p.dur) return { miss: true, cd, src: 'attach', notes: ['애착 아티팩트 설명에 수치 없음'], lines: [] };
        return { val: p.val?.value || '', valCond: p.valCond, alts: [], dur: p.dur?.value || '', pvpVal: '', pvpDur: '', cd, src: 'attach',
                 notes: p.notes, lines: [p.val?.line, p.dur?.line].filter(Boolean) };
    }

    /* 스킬 표 */
    let tpl = '', pve = [], pvp = [], src = slot;
    if (slot === 'low') {
        const r = byName(ctx.lowSkillDB, name);
        tpl = r?.low_skill_stat_template;
        let use = lv;
        if (r && !r[`Lv.${lv}`]) {   // Lv.10 이 비면 있는 것 중 가장 높은 레벨
            for (let i = lv - 1; i >= 1; i--) if (r[`Lv.${i}`]) { use = i; break; }
            notes.push(`Lv.${lv} 값 없음 → Lv.${use}`);
        }
        pve = vals(r?.[`Lv.${use}`]);
    } else if (high) {
        tpl = high.high_skill_stat_template;
        pve = vals(high[`Lv.${lv}(PvE)`]);
        pvp = vals(high[`Lv.${lv}(PvP)`]);
        if (!high[`Lv.${lv}(PvE)`]) notes.push(`Lv.${lv}(PvE) 값 없음`);
    } else if (slot === 'normal' || slot === 'power') {
        const r = byName(ctx.normalAtkDB, name);
        tpl = slot === 'normal' ? r?.basic_stat_template : r?.enhance_stat_template;
        pve = vals(slot === 'normal' ? r?.basic_atk_value : r?.enhance_atk_value);
    } else if (slot === 'aside') {
        const r = byName(ctx.asideDB, name);
        tpl = r?.aside2_stat_template; pve = vals(r?.aside2_stat_value);
    }
    const find = (t, tk, passive = false) => findIn(templateSlots(t), sibs, tk, passive);
    let p = { val: null, dur: null, notes: [] };
    /* 조건에 A2 가 있으면 **어사이드 ★2 표를 먼저** 본다 — ★2 가 그 스킬에 더하는 효과의 값은 ★2 표에 있다.
       스킬 표를 먼저 보면 같은 이름의 기본 값(코미 거대화 공속 250% · 비비 자신 보호막 45%)을 집는다 (2026-11-24).
       ★2 표에 없을 때만 스킬 표. 조건 없이 ★2 표를 보면 엉뚱한 효과 값을 끌어오므로 A2 일 때만 */
    const a2 = slot !== 'aside' && /A2/.test(cond);
    if (a2) {
        const a = byName(ctx.asideDB, name);
        /* ★2 표는 여러 칸이 같이 본다 — 다른 칸 이름이 든 줄은 그 칸 몫 (벨라 고학년 A2 받는 피해량 감소 ↔ 저학년 `존속 발동 시 …`).
           같은 칸에도 있는 이름(회복)은 빼지 않는다 */
        const q = find(a?.aside2_stat_template, taken.filter(x => !sibs.some(s => sq(s) === sq(x))));
        if (q.val || q.dur) { p = q; pve = vals(a.aside2_stat_value); pvp = []; src = 'aside'; notes.push('어사이드 ★2 표에서 찾음'); }
    }
    if (!p.val && !p.dur) p = find(tpl, slot === 'aside' ? taken : [], slot === 'aside');
    /* 강화 공격 표에 없으면 기본 공격 표 — 네티 강화 공격의 광물 효과는 기본 공격 자리표에 있다 */
    if (!p.val && !p.dur && slot === 'power') {
        const r = byName(ctx.normalAtkDB, name);
        const q = find(r?.basic_stat_template, []);
        if (q.val || q.dur) { p = q; pve = vals(r.basic_atk_value); pvp = []; src = 'normal'; notes.push('기본 공격 표에서 찾음'); }
    }
    if (!p.val && !p.dur) return { miss: true, cd, src, notes: [...notes, '자리표에서 못 찾음'], lines: [] };

    const get = (arr, s) => {
        if (!s || arr[s.idx] === undefined || arr[s.idx] === '') return '';
        const b = s.idx2 !== undefined ? arr[s.idx2] : undefined;   // 범위 값 `10~100%`
        return arr[s.idx] + (b !== undefined && b !== '' ? '~' + b : '') + s.unit;
    };
    const out = {
        val: get(pve, p.val), valCond: p.valCond, dur: get(pve, p.dur),
        /* 다른 값 — 지속이 따로 있으면 괄호에 같이 (`59% (아군, 6초)`). 값이 첫 값과 같은 아군 줄은 뺀다 (슈로 자신 24% = 아군 24%) */
        alts: (p.alts || []).map(a => {
            const d0 = a.durLine ? get(pve, a.durLine) : '';
            const d = d0 && d0 !== get(pve, p.dur) ? d0 : '';
            return { val: get(pve, a.line), pvpVal: pvp.length ? get(pvp, a.line) : '', cond: [a.cond, d].filter(Boolean).join(', '), line: a.line.line, ally: a.ally };
        }).map(a => (a.pvpVal === a.val ? { ...a, pvpVal: '' } : a))
          /* 아군 값이 첫 값과 같고 지속도 같으면 뺀다 — 기준 글자(`최대 HP` / `대상 최대 HP`)만 다른 건 같은 값이다 */
          .filter(a => a.val && !(a.ally && a.val === get(pve, p.val) && !(a.durLine && get(pve, a.durLine) !== get(pve, p.dur)))),
        pvpVal: pvp.length ? get(pvp, p.val) : '', pvpDur: pvp.length ? get(pvp, p.dur) : '',
        cd, src, notes: [...notes, ...p.notes], lines: [p.val?.line, p.dur?.line].filter(Boolean),
    };
    if ((p.val && !out.val) || (p.dur && !out.dur)) out.notes.push('자리는 찾았는데 값 칸이 빔');
    if (out.pvpVal === out.val) out.pvpVal = '';
    if (out.pvpDur === out.dur) out.pvpDur = '';
    if (!out.val && !out.dur) return { ...out, miss: true };
    return out;
}
