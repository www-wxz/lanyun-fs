Here's a self-contained React (TypeScript / TSX) component file that implements the requested interactive teaching feedback UI. It includes a draggable SVG triangle with optional constructed height, instant feedback (area/base/height), error diagnostics, a HintCard with three hint levels and usage logging, and a TeacherDashboard aggregating logs and allowing CSV/JSON export and anonymization. You can paste this into a Create React App TypeScript project (src/App.tsx) or adapt to your setup.

Note: This is self-contained and does not depend on external files.

```tsx
import React, { useState, useRef, useEffect } from "react";

/**
 * TeachingFeedbackAgent - Interactive triangle area feedback + teacher dashboard
 *
 * Features:
 * - Draggable triangle vertices (A, B, C) in an SVG canvas
 * - Optional draggable foot point F on base AB to explicitly construct "height"
 * - Instant area calculation via shoelace (叉积) and "base × height / 2" display
 * - Diagnostics: degenerate triangle, perpendicular-height mismatch, numeric inconsistency with manual input
 * - HintCard with three levels (weak/strong/solution) and usage logging
 * - Event logging for key actions (dragEnd, hintRequested, submit, reset)
 * - TeacherDashboard aggregates logs: completion, average correctness, error distribution, per-student timelines
 * - Export CSV/JSON with anonymization option
 */

/* ------------------------- Utilities ------------------------- */

type Point = { x: number; y: number };
const dist = (p: Point, q: Point) =>
  Math.hypot(p.x - q.x, p.y - q.y);
const round = (v: number, d: number) =>
  Number(v.toFixed(d));
const nowISO = () => new Date().toISOString();

function shoelaceArea(a: Point, b: Point, c: Point) {
  // returns positive area
  const val = Math.abs(
    a.x * (b.y - c.y) +
      b.x * (c.y - a.y) +
      c.x * (a.y - b.y)
  );
  return val / 2;
}

// projection of C onto line AB; returns foot point F
function projectOntoLine(A: Point, B: Point, C: Point): Point {
  const ABx = B.x - A.x;
  const ABy = B.y - A.y;
  const t =
    ((C.x - A.x) * ABx + (C.y - A.y) * ABy) /
    (ABx * ABx + ABy * ABy || 1);
  return { x: A.x + t * ABx, y: A.y + t * ABy };
}

// check if point F is on segment AB (inclusive)
function isOnSegment(A: Point, B: Point, F: Point, eps = 1e-6) {
  const dTotal = dist(A, B);
  const dAF = dist(A, F);
  const dFB = dist(F, B);
  return Math.abs(dAF + dFB - dTotal) <= eps;
}

/* ------------------------- Types ------------------------- */

type EventType =
  | "dragEnd"
  | "submit"
  | "hintRequested"
  | "reset"
  | "export";
type ErrorType =
  | "degenerate"
  | "height_not_perpendicular"
  | "numeric_mismatch"
  | "none";

type EventLog = {
  id: string;
  ts: string;
  type: EventType;
  student: string;
  payload?: any;
  snapshot?: {
    A: Point;
    B: Point;
    C: Point;
    F?: Point;
    computed: { area: number; base: number; height: number };
  };
};

/* ------------------------- Components ------------------------- */

export default function App() {
  // Student identity
  const [studentName, setStudentName] = useState("Student01");

  // Canvas / geometry state
  const [A, setA] = useState<Point>({ x: 120, y: 60 });
  const [B, setB] = useState<Point>({ x: 320, y: 160 });
  const [C, setC] = useState<Point>({ x: 180, y: 200 });
  // optional constructed foot point F on AB (draggable)
  const defaultF = projectOntoLine(A, B, C);
  const [F, setF] = useState<Point | null>(defaultF);

  // settings
  const [decimals, setDecimals] = useState(2);
  const [tolerancePercent, setTolerancePercent] = useState(5); // ±5%
  const [anonymizeExport, setAnonymizeExport] = useState(false);

  // manual inputs for checking numeric inconsistency
  const [manualAreaInput, setManualAreaInput] = useState<string>("");

  // logs for teacher dashboard
  const [logs, setLogs] = useState<EventLog[]>([]);

  // hint usage counts & last hint content
  const [hintHistory, setHintHistory] = useState<
    { level: "weak" | "strong" | "solution"; ts: string }[]
  >([]);

  // computed values
  const computedArea = shoelaceArea(A, B, C);
  const baseLength = dist(A, B);
  const proj = projectOntoLine(A, B, C);
  const height = dist(C, proj);
  const baseAndHeightProductHalf = (baseLength * height) / 2;

  // diagnostic checks
  const degenerate = computedArea < 1e-3;
  // if F exists and is significantly different from perpendicular foot -> not perpendicular
  const heightConstructedOk =
    !F ||
    (isOnSegment(A, B, F, 1e-2) &&
      dist(F, proj) <= Math.max(2, (tolerancePercent / 100) * Math.max(baseLength, height)));

  // numeric mismatch: if user entered a manualAreaInput and it's outside tolerance
  const manualArea = manualAreaInput === "" ? null : Number(manualAreaInput);
  const areaMismatch =
    manualArea !== null
      ? Math.abs(manualArea - computedArea) >
        (tolerancePercent / 100) * Math.max(1e-6, computedArea)
      : false;

  const determineErrorType = (): ErrorType => {
    if (degenerate) return "degenerate";
    if (!heightConstructedOk && F) return "height_not_perpendicular";
    if (areaMismatch) return "numeric_mismatch";
    return "none";
  };

  const errorType = determineErrorType();

  // status string & suggestions
  const statusColor =
    errorType === "none" ? "green" : errorType === "degenerate" ? "red" : "orange";
  const suggestions = generateSuggestions(errorType);

  // Event logging helper
  function pushLog(entry: Omit<EventLog, "id" | "ts">) {
    const log: EventLog = {
      id: Math.random().toString(36).slice(2, 9),
      ts: nowISO(),
      ...entry,
    };
    setLogs((s) => [log, ...s]);
  }

  // Trigger a dragEnd event (call when user finishes dragging any draggable point)
  function handleDragEnd() {
    pushLog({
      type: "dragEnd",
      student: studentName,
      payload: {
        decimals,
        tolerancePercent,
        manualAreaInput,
      },
      snapshot: {
        A,
        B,
        C,
        F: F || undefined,
        computed: {
          area: round(computedArea, decimals),
          base: round(baseLength, decimals),
          height: round(height, decimals),
        },
      },
    });
  }

  // Reset triangle
  function handleReset() {
    const A0 = { x: 100, y: 80 };
    const B0 = { x: 300, y: 140 };
    const C0 = { x: 180, y: 220 };
    setA(A0);
    setB(B0);
    setC(C0);
    setF(projectOntoLine(A0, B0, C0));
    setManualAreaInput("");
    pushLog({
      type: "reset",
      student: studentName,
      payload: null,
      snapshot: {
        A: A0,
        B: B0,
        C: C0,
        F: projectOntoLine(A0, B0, C0),
        computed: {
          area: round(shoelaceArea(A0, B0, C0), decimals),
          base: round(dist(A0, B0), decimals),
          height: round(dist(C0, projectOntoLine(A0, B0, C0)), decimals),
        },
      },
    });
  }

  // Submit (teacher evaluates as correct/incorrect based on errorType)
  function handleSubmit() {
    const correct = errorType === "none";
    pushLog({
      type: "submit",
      student: studentName,
      payload: {
        correct,
        errorType,
        manualAreaInput,
      },
      snapshot: {
        A,
        B,
        C,
        F: F || undefined,
        computed: {
          area: round(computedArea, decimals),
          base: round(baseLength, decimals),
          height: round(height, decimals),
        },
      },
    });
    alert(correct ? "提交：正确" : `提交：存在问题（${errorType}），查看建议`);
  }

  // Hint request
  function requestHint(level: "weak" | "strong" | "solution") {
    setHintHistory((h) => [{ level, ts: nowISO() }, ...h]);
    pushLog({
      type: "hintRequested",
      student: studentName,
      payload: { level },
      snapshot: {
        A,
        B,
        C,
        F: F || undefined,
        computed: {
          area: round(computedArea, decimals),
          base: round(baseLength, decimals),
          height: round(height, decimals),
        },
      },
    });
  }

  // Exports
  function exportJSON() {
    const payload = anonymizeExport
      ? logs.map((l) => ({ ...l, student: "ANON" }))
      : logs;
    const data = JSON.stringify(payload, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "logs.json";
    a.click();
    URL.revokeObjectURL(url);
    pushLog({ type: "export", student: studentName, payload: { format: "json", anonymizeExport } });
  }

  function exportCSV() {
    const rows = logs.map((l) => ({
      id: l.id,
      ts: l.ts,
      type: l.type,
      student: anonymizeExport ? "ANON" : l.student,
      payload: JSON.stringify(l.payload || ""),
      snapshot: JSON.stringify(l.snapshot || ""),
    }));
    const header = Object.keys(rows[0] || { id: "", ts: "", type: "", student: "", payload: "", snapshot: "" });
    const csv = [header.join(",")]
      .concat(rows.map((r) => header.map((h) => `"${(r as any)[h] ?? ""}"`).join(",")))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "logs.csv";
    a.click();
    URL.revokeObjectURL(url);
    pushLog({ type: "export", student: studentName, payload: { format: "csv", anonymizeExport } });
  }

  // Keep F updated when triangle moves (default to perpendicular foot)
  useEffect(() => {
    // if F is null, keep it null; otherwise update toward projection
    setF((prev) => (prev ? projectOntoLine(A, B, C) : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [A, B, C]);

  // minimal responsive layout
  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: 12 }}>
      <h2>即时反馈与提示（探索阶段） - 三角形面积实验</h2>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 400 }}>
          <TriangleCanvas
            A={A}
            B={B}
            C={C}
            F={F}
            onAChange={setA}
            onBChange={setB}
            onCChange={setC}
            onFChange={setF}
            onDragEnd={handleDragEnd}
          />
          <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
            <label>
              学生名:
              <input value={studentName} onChange={(e) => setStudentName(e.target.value)} style={{ marginLeft: 6 }} />
            </label>
            <button onClick={() => setF((f) => (f ? null : projectOntoLine(A, B, C)))}>
              {F ? "隐藏构造高" : "显示构造高（可拖拽）"}
            </button>
            <button onClick={handleReset}>重置</button>
            <button onClick={handleSubmit} style={{ background: "#0b79d0", color: "white" }}>
              提交
            </button>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
            <div style={{ padding: 10, border: "1px solid #ddd", borderRadius: 6, width: 320 }}>
              <h4>MeasurementOverlay</h4>
              <div>
                当前面积 (叉积法): <strong>{round(computedArea, decimals)}</strong>
              </div>
              <div>
                底 (AB): <strong>{round(baseLength, decimals)}</strong>
              </div>
              <div>
                高: <strong>{round(height, decimals)}</strong>
              </div>
              <div>
                底×高/2: <strong>{round(baseAndHeightProductHalf, decimals)}</strong>
              </div>
              <div style={{ marginTop: 6 }}>
                手动输入面积用于比对:
                <input
                  value={manualAreaInput}
                  onChange={(e) => setManualAreaInput(e.target.value)}
                  style={{ marginLeft: 8, width: 100 }}
                />
                <button onClick={() => pushLog({ type: "submit", student: studentName, payload: { manualCheck: manualAreaInput }, snapshot: { A, B, C, F: F || undefined, computed: { area: round(computedArea, decimals), base: round(baseLength, decimals), height: round(height, decimals) } } })} style={{ marginLeft: 8 }}>
                  记录一次检查
                </button>
              </div>
              <div style={{ marginTop: 8 }}>
                显示小数位:
                <select value={decimals} onChange={(e) => setDecimals(Number(e.target.value))} style={{ marginLeft: 8 }}>
                  <option value={0}>0</option>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </div>
              <div style={{ marginTop: 6 }}>
                公差 (相对误差 %):
                <input
                  type="number"
                  value={tolerancePercent}
                  onChange={(e) => setTolerancePercent(Number(e.target.value))}
                  style={{ width: 60, marginLeft: 8 }}
                />
              </div>
            </div>

            <div style={{ width: 360 }}>
              <FeedbackPanel
                area={round(computedArea, decimals)}
                base={round(baseLength, decimals)}
                height={round(height, decimals)}
                statusColor={statusColor}
                errorType={errorType}
                suggestions={suggestions}
                onRequestHint={requestHint}
              />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <HintCard history={hintHistory} onRequestHint={requestHint} />
          </div>
        </div>

        <div style={{ width: 520 }}>
          <TeacherDashboard
            logs={logs}
            anonymizeExport={anonymizeExport}
            setAnonymizeExport={setAnonymizeExport}
            exportJSON={exportJSON}
            exportCSV={exportCSV}
            decimals={decimals}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------- TriangleCanvas ------------------------- */

function TriangleCanvas(props: {
  A: Point;
  B: Point;
  C: Point;
  F: Point | null;
  onAChange: (p: Point) => void;
  onBChange: (p: Point) => void;
  onCChange: (p: Point) => void;
  onFChange: (p: Point | null) => void;
  onDragEnd: () => void;
}) {
  const { A, B, C, F, onAChange, onBChange, onCChange, onFChange, onDragEnd } = props;
  const [dragging, setDragging] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  function toPoint(e: React.MouseEvent) {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const cursorpt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: cursorpt.x, y: cursorpt.y };
  }

  function handleMouseDown(which: "A" | "B" | "C" | "F", e: React.MouseEvent) {
    e.preventDefault();
    setDragging(which);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging) return;
    const p = toPoint(e);
    if (dragging === "A") onAChange(p);
    if (dragging === "B") onBChange(p);
    if (dragging === "C") onCChange(p);
    if (dragging === "F") {
      // constrain F to segment AB
      const t = projectTOnSegment(props.A, props.B, p);
      const Fx = props.A.x + t * (props.B.x - props.A.x);
      const Fy = props.A.y + t * (props.B.y - props.A.y);
      onFChange({ x: Fx, y: Fy });
    }
  }

  function handleMouseUp() {
    if (dragging) {
      setDragging(null);
      onDragEnd();
    }
  }

  // projection scalar t in [0,1] of point P onto segment AB
  function projectTOnSegment(A: Point, B: Point, P: Point) {
    const ABx = B.x - A.x;
    const ABy = B.y - A.y;
    const denom = ABx * ABx + ABy * ABy || 1;
    const t = ((P.x - A.x) * ABx + (P.y - A.y) * ABy) / denom;
    return Math.max(0, Math.min(1, t));
  }

  const width = 420;
  const height = 360;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      style={{ border: "1px solid #ccc", background: "#fafafa", width: "100%", height: 360, touchAction: "none" }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* base line */}
      <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#888" strokeWidth={1} />
      {/* triangle */}
      <polygon points={`${A.x},${A.y} ${B.x},${B.y} ${C.x},${C.y}`} fill="#b3d4fc" stroke="#0b79d0" strokeWidth={1} opacity={0.6} />
      {/* height line (perpendicular) */}
      {F ? (
        <>
          <line x1={F.x} y1={F.y} x2={C.x} y2={C.y} stroke="#ff8c00" strokeWidth={2} strokeDasharray="4 3" />
          {/* foot marker */}
          <circle cx={F.x} cy={F.y} r={6} fill="#ff8c00" stroke="#fff" onMouseDown={(e) => handleMouseDown("F", e)} style={{ cursor: "move" }} />
        </>
      ) : (
        // show projection lightly
        (() => {
          const proj = projectOntoLine(A, B, C);
          return <line x1={proj.x} y1={proj.y} x2={C.x} y2={C.y} stroke="#ffd8a6" strokeWidth={1} strokeDasharray="3 3" />;
        })()
      )}

      {/* vertices */}
      <Vertex x={A.x} y={A.y} label="A" onMouseDown={(e) => handleMouseDown("A", e)} />
      <Vertex x={B.x} y={B.y} label="B" onMouseDown={(e) => handleMouseDown("B", e)} />
      <Vertex x={C.x} y={C.y} label="C" onMouseDown={(e) => handleMouseDown("C", e)} />
    </svg>
  );
}

function Vertex({ x, y, label, onMouseDown }: any) {
  return (
    <>
      <circle cx={x} cy={y} r={8} fill="#fff" stroke="#0b79d0" strokeWidth={2} onMouseDown={onMouseDown} style={{ cursor: "move" }} />
      <text x={x + 10} y={y - 10} fontSize={12} fill="#333">
        {label}
      </text>
    </>
  );
}

/* ------------------------- FeedbackPanel ------------------------- */

function FeedbackPanel(props: {
  area: number;
  base: number;
  height: number;
  statusColor: string;
  errorType: ErrorType;
  suggestions: string[];
  onRequestHint: (level: "weak" | "strong" | "solution") => void;
}) {
  const { area, base, height, statusColor, errorType, suggestions, onRequestHint } = props;
  return (
    <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 6 }}>
      <h4>即时反馈卡片</h4>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ width: 12, height: 12, borderRadius: 12, background: statusColor }} />
        <div>
          状态: <strong>{errorType === "none" ? "通过" : `问题: ${errorType}`}</strong>
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <div>当前面积: <strong>{area}</strong></div>
        <div>当前底: <strong>{base}</strong></div>
        <div>当前高: <strong>{height}</strong></div>
      </div>

      <div style={{ marginTop: 10 }}>
        <strong>建议</strong>
        <ul>
          {suggestions.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <button onClick={() => onRequestHint("weak")}>弱提示</button>
        <button onClick={() => onRequestHint("strong")}>强化提示</button>
        <button onClick={() => onRequestHint("solution")}>解答提示</button>
      </div>
    </div>
  );
}

/* ------------------------- HintCard ------------------------- */

function HintCard(props: {
  history: { level: "weak" | "strong" | "solution"; ts: string }[];
  onRequestHint: (level: "weak" | "strong" | "solution") => void;
}) {
  const { history, onRequestHint } = props;
  return (
    <div style={{ border: "1px dashed #ddd", padding: 10, borderRadius: 6 }}>
      <h4>提示面板</h4>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onRequestHint("weak")}>弱提示（提示如何改进）</button>
        <button onClick={() => onRequestHint("strong")}>强化提示（给出局部建议）</button>
        <button onClick={() => onRequestHint("solution")}>解答提示（展示步骤）</button>
      </div>
      <div style={{ marginTop: 10 }}>
        <strong>提示记录</strong>
        <ul>
          {history.length === 0 && <li>尚未请求提示</li>}
          {history.map((h, i) => (
            <li key={i}>
              [{h.ts}] - {h.level}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------- TeacherDashboard ------------------------- */

function TeacherDashboard(props: {
  logs: EventLog[];
  anonymizeExport: boolean;
  setAnonymizeExport: (b: boolean) => void;
  exportJSON: () => void;
  exportCSV: () => void;
  decimals: number;
}) {
  const { logs, anonymizeExport, setAnonymizeExport, exportJSON, exportCSV, decimals } = props;

  // Aggregations
  const total = logs.length;
  const submits = logs.filter((l) => l.type === "submit");
  const submissionsCount = submits.length;
  const avgCorrect =
    submissionsCount === 0
      ? 0
      : Math.round(
          (submits.filter((s) => s.payload?.correct).length / submissionsCount) * 100
        );

  // error distribution
  const errorCounts: Record<string, number> = {};
  for (const l of logs) {
    if (l.payload?.errorType) {
      errorCounts[l.payload.errorType] = (errorCounts[l.payload.errorType] || 0) + 1;
    } else if (l.type === "hintRequested") {
      errorCounts["hintRequested"] = (errorCounts["hintRequested"] || 0) + 1;
    }
  }

  // student list with low pass or many hints
  const perStudent = logs.reduce((acc: Record<string, { hints: number; submits: number; corrects: number }>, l) => {
    const k = l.student;
    if (!acc[k]) acc[k] = { hints: 0, submits: 0, corrects: 0 };
    if (l.type === "hintRequested") acc[k].hints += 1;
    if (l.type === "submit") {
      acc[k].submits += 1;
      if (l.payload?.correct) acc[k].corrects += 1;
    }
    return acc;
  }, {});
  const needsIntervention = Object.entries(perStudent)
    .filter(([_, v]) => v.hints > 2 || (v.submits > 0 && v.corrects / v.submits < 0.6))
    .map(([k, v]) => ({ student: k, stats: v }));

  return (
    <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 6 }}>
      <h4>教师监控仪表盘</h4>
      <div>总事件: {total}</div>
      <div>提交次数: {submissionsCount}</div>
      <div>平均通过率: {avgCorrect}%</div>
      <div style={{ marginTop: 8 }}>
        常见错误分布:
        <ul>
          {Object.keys(errorCounts).length === 0 && <li>暂无错误记录</li>}
          {Object.entries(errorCounts).map(([k, v]) => (
            <li key={k}>
              {k}: {v}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: 8 }}>
        需要教师干预的学生:
        <ul>
          {needsIntervention.length === 0 && <li>目前无</li>}
          {needsIntervention.map((n) => (
            <li key={n.student}>
              {n.student} - hints: {n.stats.hints}, submits: {n.stats.submits}, corrects: {n.stats.corrects}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: 8 }}>
        <details>
          <summary>细粒度日志（最新 20 条）</summary>
          <div style={{ maxHeight: 260, overflow: "auto", marginTop: 6 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ borderBottom: "1px solid #eee", textAlign: "left" }}>ts</th>
                  <th style={{ borderBottom: "1px solid #eee", textAlign: "left" }}>type</th>
                  <th style={{ borderBottom: "1px solid #eee", textAlign: "left" }}>student</th>
                  <th style={{ borderBottom: "1px solid #eee", textAlign: "left" }}>payload</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 20).map((l) => (
                  <tr key={l.id}>
                    <td style={{ borderBottom: "1px solid #fafafa", padding: "6px 4px" }}>{l.ts}</td>
                    <td style={{ borderBottom: "1px solid #fafafa", padding: "6px 4px" }}>{l.type}</td>
                    <td style={{ borderBottom: "1px solid #fafafa", padding: "6px 4px" }}>{anonymizeExport ? "ANON" : l.student}</td>
                    <td style={{ borderBottom: "1px solid #fafafa", padding: "6px 4px" }}>{JSON.stringify(l.payload || "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
        <label>
          <input type="checkbox" checked={anonymizeExport} onChange={(e) => setAnonymizeExport(e.target.checked)} />
          匿名导出
        </label>
        <button onClick={exportJSON}>导出 JSON</button>
        <button onClick={exportCSV}>导出 CSV</button>
        <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>显示小数位: {decimals}</div>
      </div>
    </div>
  );
}

/* ------------------------- Helpers ------------------------- */

function generateSuggestions(errorType: ErrorType) {
  if (errorType === "none") {
    return ["当前图形与数值匹配。可尝试改变顶点观察面积变化，或点击提交。"];
  }
  if (errorType === "degenerate") {
    return [
      "三角形退化（面积接近 0）。请将顶点稍微分开以构成有效三角形。",
      "弱提示：请尝试拖动一个顶点，观察面积是否增加。",
      "强化提示：确保三点不在同一直线上，移动 C 点离开 AB 线段。",
    ];
  }
  if (errorType === "height_not_perpendicular") {
    return [
      "构造的高线与底边未垂直或未正确放在底边上。",
      "弱提示：将构造点移动到底边上",
      "强化提示：把脚点移动到从顶点向底边的垂直投影处（系统已显示虚线投影位置），或隐藏构造高让系统自动计算。",
      "解答提示：系统建议的脚点位置已展示为投影点，可将构造点移到该位置。",
    ];
  }
  if (errorType === "numeric_mismatch") {
    return [
      "手动输入的面积值与系统计算值不符（超出容差）。",
      "弱提示：检查是否使用了底×高/2 的数值对应正确的底和高。",
      "强化提示：启用更多小数位，或使用系统给出的底和高替换手动输入。",
    ];
  }
  return [];
}
```

Usage notes:
- Paste into a CRA TypeScript project's src/App.tsx (replace existing).
- The triangle is draggable: click and drag vertices labeled A, B, C. If you toggle "显示构造高（可拖拽）", a foot point F appears on AB and can be dragged along AB to explicitly construct the height. The system compares F to the true perpendicular projection and flags if it's not properly constructed.
- HintCard provides three hint levels and logs hint requests.
- TeacherDashboard aggregates logs; you can export logs to JSON/CSV and toggle anonymization.

This implements the main requested features: immediate feedback, error diagnosis with layered suggestions, calculation details (shoelace formula used internally and shown numerically), tolerance settings, hint levels with usage logging, teacher-side logs & export, and simple per-student aggregation for monitoring.