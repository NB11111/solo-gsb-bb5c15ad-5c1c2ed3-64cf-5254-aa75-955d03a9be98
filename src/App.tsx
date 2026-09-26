import { useMemo, useState } from "react";
import {
  ALLOWED_DENOMINATORS,
  MAX_TUPLET_DEPTH,
  abs,
  analyze,
  formatFrac,
  validateScore,
  type MeasureResult,
  type ValidationError,
} from "./rhythm";
import { EXAMPLE_TEXT } from "./example";

type Outcome =
  | { kind: "syntax"; message: string }
  | { kind: "invalid"; errors: ValidationError[] }
  | { kind: "ok"; results: MeasureResult[] };

function StatusBadge({ status }: { status: MeasureResult["status"] }) {
  if (status === "ok") return <span className="badge badge-ok">✓ 吻合</span>;
  if (status === "short") return <span className="badge badge-short">不足</span>;
  return <span className="badge badge-over">超出</span>;
}

function ResultTable({ results }: { results: MeasureResult[] }) {
  return (
    <table className="result-table">
      <thead>
        <tr>
          <th>小节</th>
          <th>应有时值</th>
          <th>实际时值</th>
          <th>差值</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        {results.map((r) => (
          <tr key={r.index} className={`row-${r.status}`}>
            <td>第 {r.index} 小节</td>
            <td className="mono">{formatFrac(r.expected)}</td>
            <td className="mono">{formatFrac(r.actual)}</td>
            <td className="mono">
              {r.status === "ok"
                ? "0"
                : r.status === "short"
                  ? `−${formatFrac(abs(r.diff))}`
                  : `+${formatFrac(r.diff)}`}
            </td>
            <td>
              <StatusBadge status={r.status} />
              {r.overflowPath && (
                <div className="overflow-path">
                  首个越界叶事件：
                  <code>{r.overflowPath}</code>
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FormatDocs() {
  return (
    <section className="docs">
      <h2>格式说明</h2>
      <h3>顶层结构</h3>
      <pre>{`{
  "timeSignature": { "numerator": 4, "denominator": 4 },
  "measures": [ { "events": [ …事件… ] }, … ]
}`}</pre>
      <h3>三种事件</h3>
      <table>
        <thead>
          <tr>
            <th>类型</th>
            <th>字段</th>
            <th>说明</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>"note"</code> 音符
            </td>
            <td className="mono">denominator, dot?</td>
            <td>denominator 表示全音符的几分之一；dot 为 true 表示带一个附点</td>
          </tr>
          <tr>
            <td>
              <code>"rest"</code> 休止符
            </td>
            <td className="mono">denominator, dot?</td>
            <td>同上</td>
          </tr>
          <tr>
            <td>
              <code>"tuplet"</code> 连音
            </td>
            <td className="mono">actual, occupied, children</td>
            <td>
              actual 实际数、occupied 占用数、children 子事件数组；最多嵌套{" "}
              {MAX_TUPLET_DEPTH} 层
            </td>
          </tr>
        </tbody>
      </table>
      <h3>时值规则（全音符 = 1）</h3>
      <ul>
        <li>
          音符 / 休止符基础时值 = <code>1 / denominator</code>，附点再乘{" "}
          <code>3/2</code>
        </li>
        <li>
          连音组内所有时值乘 <code>occupied / actual</code>（占用数 ÷
          实际数），嵌套时逐层累乘
        </li>
        <li>
          小节应有时值 = <code>拍号分子 / 拍号分母</code>
        </li>
        <li>所有计算使用精确分数，无浮点误差</li>
      </ul>
      <h3>输入约束</h3>
      <ul>
        <li>拍号分子、连音的实际数与占用数：正整数</li>
        <li>
          拍号、音符与休止符的分母：{ALLOWED_DENOMINATORS.join("、")} 之一
        </li>
        <li>非法输入会逐条列出错误及其树路径</li>
      </ul>
    </section>
  );
}

export default function App() {
  const [text, setText] = useState(EXAMPLE_TEXT);

  const outcome: Outcome = useMemo(() => {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      return { kind: "syntax", message: (e as Error).message };
    }
    const v = validateScore(raw);
    if (!v.ok) return { kind: "invalid", errors: v.errors };
    return { kind: "ok", results: analyze(v.score) };
  }, [text]);

  const formatJson = () => {
    try {
      setText(JSON.stringify(JSON.parse(text), null, 2));
    } catch {
      // 语法错误时不做格式化
    }
  };

  return (
    <div className="page">
      <header>
        <h1>节奏小节校对</h1>
        <p className="subtitle">
          粘贴含拍号与逐小节事件树的 JSON，实时校验每个小节的时值（以全音符为
          1，精确分数计算）
        </p>
      </header>

      <main>
        <section className="editor-card">
          <div className="editor-toolbar">
            <span className="editor-title">JSON 输入</span>
            <div>
              <button onClick={() => setText(EXAMPLE_TEXT)}>载入示例</button>
              <button onClick={formatJson}>格式化</button>
            </div>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            placeholder="在此粘贴 JSON…"
          />
        </section>

        <section className="result-card">
          <h2>校对结果</h2>
          {outcome.kind === "syntax" && (
            <div className="alert alert-error">
              <strong>JSON 语法错误</strong>
              <pre>{outcome.message}</pre>
            </div>
          )}
          {outcome.kind === "invalid" && (
            <div className="alert alert-error">
              <strong>发现 {outcome.errors.length} 处非法输入</strong>
              <ul className="error-list">
                {outcome.errors.map((err, i) => (
                  <li key={i}>
                    <code>{err.path}</code>
                    <span>{err.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {outcome.kind === "ok" && (
            <ResultTable results={outcome.results} />
          )}
        </section>
      </main>

      <FormatDocs />
    </div>
  );
}
