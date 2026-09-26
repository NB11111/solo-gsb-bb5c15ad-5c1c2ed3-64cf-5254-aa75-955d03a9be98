/**
 * 节奏小节校对核心逻辑：精确分数运算、JSON 结构校验、逐小节时值分析。
 * 所有时值均以「全音符 = 1」为单位，用分数精确表示，避免浮点误差。
 */

// ---------------------------------------------------------------------------
// 精确分数
// ---------------------------------------------------------------------------

export interface Frac {
  /** 分子（已约分，符号在分子上） */
  n: number;
  /** 分母（已约分，恒为正） */
  d: number;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** 由整数分子分母构造约分后的分数 */
export function frac(n: number, d = 1): Frac {
  if (!Number.isInteger(n) || !Number.isInteger(d) || d === 0) {
    throw new Error(`非法分数: ${n}/${d}`);
  }
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(Math.abs(n), d) || 1;
  return { n: n / g, d: d / g };
}

export const ZERO: Frac = { n: 0, d: 1 };

export const add = (a: Frac, b: Frac): Frac =>
  frac(a.n * b.d + b.n * a.d, a.d * b.d);

export const sub = (a: Frac, b: Frac): Frac =>
  frac(a.n * b.d - b.n * a.d, a.d * b.d);

export const mul = (a: Frac, b: Frac): Frac => frac(a.n * b.n, a.d * b.d);

/** 比较：返回负数 / 0 / 正数 */
export const cmp = (a: Frac, b: Frac): number =>
  Math.sign(a.n * b.d - b.n * a.d);

export const abs = (a: Frac): Frac => ({ n: Math.abs(a.n), d: a.d });

/** 格式化为 "3"、"3/4" 形式 */
export const formatFrac = (f: Frac): string =>
  f.d === 1 ? String(f.n) : `${f.n}/${f.d}`;

// ---------------------------------------------------------------------------
// 数据模型
// ---------------------------------------------------------------------------

export const ALLOWED_DENOMINATORS: readonly number[] = [1, 2, 4, 8, 16, 32];
export const MAX_TUPLET_DEPTH = 3;

export interface TimeSignature {
  numerator: number;
  denominator: number;
}

export interface NoteEvent {
  type: "note" | "rest";
  denominator: number;
  dot?: boolean;
}

export interface TupletEvent {
  type: "tuplet";
  /** 实际数：连音实际包含的音符个数 */
  actual: number;
  /** 占用数：连音占用同样时值音符的个数 */
  occupied: number;
  children: EventNode[];
}

export type EventNode = NoteEvent | TupletEvent;

export interface Measure {
  events: EventNode[];
}

export interface Score {
  timeSignature: TimeSignature;
  measures: Measure[];
}

// ---------------------------------------------------------------------------
// 校验（所有错误均带树路径）
// ---------------------------------------------------------------------------

export interface ValidationError {
  /** 树路径，如 $.measures[0].events[2].children[1].denominator */
  path: string;
  message: string;
}

export type Validation =
  | { ok: true; score: Score }
  | { ok: false; errors: ValidationError[] };

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isPosInt = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v > 0;

const isValidDenominator = (v: unknown): v is number =>
  typeof v === "number" && ALLOWED_DENOMINATORS.includes(v);

const DENOM_HINT = `分母必须是 ${ALLOWED_DENOMINATORS.join(" / ")} 之一（全音符的几分之一）`;

function validateEvent(
  raw: unknown,
  path: string,
  depth: number,
  errors: ValidationError[],
): EventNode | null {
  if (!isObj(raw)) {
    errors.push({ path, message: "事件必须是对象" });
    return null;
  }
  const type = raw.type;

  if (type === "note" || type === "rest") {
    let ok = true;
    if (!isValidDenominator(raw.denominator)) {
      errors.push({ path: `${path}.denominator`, message: DENOM_HINT });
      ok = false;
    }
    if (raw.dot !== undefined && typeof raw.dot !== "boolean") {
      errors.push({ path: `${path}.dot`, message: "dot（附点）必须是布尔值" });
      ok = false;
    }
    if (!ok) return null;
    // 已通过 isValidDenominator 校验，此处断言安全
    const node: NoteEvent = { type, denominator: raw.denominator as number };
    if (raw.dot === true) node.dot = true;
    return node;
  }

  if (type === "tuplet") {
    if (depth > MAX_TUPLET_DEPTH) {
      errors.push({
        path,
        message: `连音嵌套超过 ${MAX_TUPLET_DEPTH} 层（当前第 ${depth} 层）`,
      });
      return null;
    }
    let ok = true;
    if (!isPosInt(raw.actual)) {
      errors.push({
        path: `${path}.actual`,
        message: "连音实际数 actual 必须是正整数",
      });
      ok = false;
    }
    if (!isPosInt(raw.occupied)) {
      errors.push({
        path: `${path}.occupied`,
        message: "连音占用数 occupied 必须是正整数",
      });
      ok = false;
    }
    if (!Array.isArray(raw.children) || raw.children.length === 0) {
      errors.push({
        path: `${path}.children`,
        message: "连音子事件 children 必须是非空数组",
      });
      ok = false;
    }
    if (!ok) return null;
    const children: EventNode[] = [];
    (raw.children as unknown[]).forEach((c, k) => {
      const node = validateEvent(c, `${path}.children[${k}]`, depth + 1, errors);
      if (node) children.push(node);
    });
    return {
      type: "tuplet",
      actual: raw.actual as number,
      occupied: raw.occupied as number,
      children,
    };
  }

  errors.push({
    path: `${path}.type`,
    message: `未知事件类型 ${JSON.stringify(type)}，应为 "note" / "rest" / "tuplet"`,
  });
  return null;
}

/** 校验解析后的 JSON，返回类型化乐谱或全部错误（含树路径） */
export function validateScore(raw: unknown): Validation {
  const errors: ValidationError[] = [];

  if (!isObj(raw)) {
    return {
      ok: false,
      errors: [{ path: "$", message: "顶层必须是 JSON 对象" }],
    };
  }

  // 拍号
  let timeSignature: TimeSignature | null = null;
  const ts = raw.timeSignature;
  if (!isObj(ts)) {
    errors.push({
      path: "$.timeSignature",
      message: "缺少拍号对象 timeSignature（含 numerator / denominator）",
    });
  } else {
    const numOk = isPosInt(ts.numerator);
    const denOk = isValidDenominator(ts.denominator);
    if (!numOk) {
      errors.push({
        path: "$.timeSignature.numerator",
        message: "拍号分子必须是正整数",
      });
    }
    if (!denOk) {
      errors.push({
        path: "$.timeSignature.denominator",
        message: DENOM_HINT,
      });
    }
    if (numOk && denOk) {
      timeSignature = {
        numerator: ts.numerator as number,
        denominator: ts.denominator as number,
      };
    }
  }

  // 小节
  const measures: Measure[] = [];
  const ms = raw.measures;
  if (!Array.isArray(ms) || ms.length === 0) {
    errors.push({ path: "$.measures", message: "measures 必须是非空数组" });
  } else {
    ms.forEach((m, i) => {
      const mPath = `$.measures[${i}]`;
      if (!isObj(m) || !Array.isArray(m.events)) {
        errors.push({
          path: mPath,
          message: "每个小节必须是含 events 数组的对象",
        });
        return;
      }
      const events: EventNode[] = [];
      (m.events as unknown[]).forEach((ev, j) => {
        const node = validateEvent(ev, `${mPath}.events[${j}]`, 1, errors);
        if (node) events.push(node);
      });
      measures.push({ events });
    });
  }

  if (errors.length > 0 || !timeSignature) {
    return { ok: false, errors };
  }
  return { ok: true, score: { timeSignature, measures } };
}

// ---------------------------------------------------------------------------
// 时值计算与逐小节分析
// ---------------------------------------------------------------------------

export interface MeasureResult {
  /** 小节序号（从 1 开始） */
  index: number;
  /** 应有时值（拍号决定，全音符 = 1） */
  expected: Frac;
  /** 实际时值 */
  actual: Frac;
  /** 实际 - 应有 */
  diff: Frac;
  status: "ok" | "short" | "over";
  /** 超出时：首个越界叶事件的树路径 */
  overflowPath?: string;
}

/** 音符 / 休止符的基础时值（含附点 ×3/2） */
function leafBase(ev: NoteEvent): Frac {
  const base = frac(1, ev.denominator);
  return ev.dot ? mul(base, frac(3, 2)) : base;
}

/** 递归求事件列表总时值；factor 为外层连音累积的缩放因子 */
function sumEvents(events: EventNode[], factor: Frac): Frac {
  let acc = ZERO;
  for (const ev of events) {
    if (ev.type === "tuplet") {
      // 组内时值 × 占用数 / 实际数
      const inner = mul(factor, frac(ev.occupied, ev.actual));
      acc = add(acc, sumEvents(ev.children, inner));
    } else {
      acc = add(acc, mul(leafBase(ev), factor));
    }
  }
  return acc;
}

/**
 * 按顺序累计时值，定位首个使累计值超过 limit 的叶事件（音符 / 休止符）。
 * 调用前提：总时值确实超过 limit，保证能返回路径。
 */
function findOverflowLeaf(
  events: EventNode[],
  acc: Frac,
  limit: Frac,
  factor: Frac,
  path: string,
): string | undefined {
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const p = `${path}[${i}]`;
    if (ev.type === "tuplet") {
      const inner = mul(factor, frac(ev.occupied, ev.actual));
      const total = sumEvents(ev.children, inner);
      if (cmp(add(acc, total), limit) > 0) {
        // 越界发生在该连音组内部，递归定位到叶
        return findOverflowLeaf(ev.children, acc, limit, inner, `${p}.children`);
      }
      acc = add(acc, total);
    } else {
      const dur = mul(leafBase(ev), factor);
      if (cmp(add(acc, dur), limit) > 0) return p;
      acc = add(acc, dur);
    }
  }
  return undefined;
}

/** 逐小节分析：应有时值、实际时值、差值、越界叶路径 */
export function analyze(score: Score): MeasureResult[] {
  const expected = frac(
    score.timeSignature.numerator,
    score.timeSignature.denominator,
  );
  return score.measures.map((m, i) => {
    const actual = sumEvents(m.events, frac(1));
    const diff = sub(actual, expected);
    const c = cmp(diff, ZERO);
    const status: MeasureResult["status"] =
      c === 0 ? "ok" : c > 0 ? "over" : "short";
    const overflowPath =
      status === "over"
        ? findOverflowLeaf(m.events, ZERO, expected, frac(1), `$.measures[${i}].events`)
        : undefined;
    return { index: i + 1, expected, actual, diff, status, overflowPath };
  });
}
