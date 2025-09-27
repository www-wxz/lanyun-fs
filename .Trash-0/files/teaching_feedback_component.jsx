import React, { useEffect, useRef, useState } from "react";

/**
 * TeachingFeedbackAgent React Component Suite
 * - Self-contained TSX code (can be converted to JSX by removing type annotations if needed)
 * - Components:
 *    - App: top-level
 *    - TriangleEditor: interactive SVG with draggable vertices
 *    - FeedbackPanel: shows instant feedback, suggestions, decimal/tolerance settings
 *    - HintCard: manages hint levels and usage logging
 *    - TeacherDashboard: aggregated logs, exports, replay
 *
 * Features implemented (per requirements):
 * - Instant area computation (shoelace / cross-product) and optional base×height/2 view
 * - Base selection, height computation (perpendicular projection)
 * - Error diagnostics: degenerate triangle, mismatch to target, non-perpendicular height
 * - Hint hierarchy: weak, strong, solution; teacher-configurable hint strictness
 * - Event logging of key actions with snapshot (vertices, base selection, area, height)
 * - Export logs CSV/JSON, simple replay of vertex sequences
 * - Settings: decimal places toggling, relative tolerance
 *
 * Notes:
 * - This is a frontend-only mockup; persistent backend calls are simulated by local state.
 * - The code uses basic math and DOM events; no external libraries required.
 */

/* ---------------------------
   Types
   --------------------------- */
type Point = { x: number; y: number };
type LogEvent = {
  ts: number;
  action: string;
  details: any;
  snapshot: { vertices: Point[]; baseIndices: [number, number] };
};
type Feedback = {
  area: number;
  baseLength: number;
  height: number;
  status: "ok" | "warning" | "error";
  errors: string[]; // error codes
  suggestions: string[];
};

/* ---------------------------
   Utilities
   --------------------------- */

const now = () => Date.now();

const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const polygonArea = (pts: Point[]) => {
  // shoelace / cross product absolute /2
  const [p0, p1, p2] = pts;
  const cross =
    p0.x * (p1.y - p2.y) + p1.x * (p2.y - p0.y) + p2.x * (p0.y - p1.y);
  return Math.abs(cross) / 2;
};

const projectPointToLine = (p: Point, a: Point, b: Point): Point => {
  // projection of p onto line ab
  const ap = { x: p.x - a.x, y: p.y - a.y };
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const ab2 = ab.x * ab.x + ab.y * ab.y;
  const t = ab2 === 0 ? 0 : (ap.x * ab.x + ap.y * ab.y) / ab2;
  return { x: a.x + ab.x * t, y: a.y + ab.y * t };
};

const angleBetween = (a: Point, b: Point) => {
  // angle between vectors a and b
  const dot = a.x * b.x + a.y * b.y;
  const na = Math.hypot(a.x, a.y);
  const nb = Math.hypot(b.x, b.y);
  if (na === 0 || nb === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (na * nb)));
  return Math.acos(cos); // radians
};

const formatNumber = (v: number, decimals: number) =>
  Number.isFinite(v) ? v.toFixed(decimals) : "--";

/* ---------------------------
   Feedback Engine
   --------------------------- */

const computeFeedback = (
  vertices: Point[],
  baseIndices: [number, number],
  options: {
    decimals: number;
    toleranceRel: number; // relative tolerance e.g., 0.05
    expectedArea?: number | null;
    perpendicularThresholdDeg: number; // allowed angle deviation in degrees
  }
): Feedback => {
  const area = polygonArea(vertices);
  // base endpoints
  const a = vertices[baseIndices[0]];
  const b = vertices[baseIndices[1]];
  const baseLen = distance(a, b);

  // determine which vertex is the "apex" (the third one not in base)
  const apexIndex = [0, 1, 2].find((i) => !baseIndices.includes(i))!;
  const apex = vertices[apexIndex];

  // perpendicular projection of apex onto base
  const proj = projectPointToLine(apex, a, b);
  const height = distance(apex, proj);

  // angle between (apex->proj) and line base direction; ideally 90 deg
  const baseVec = { x: b.x - a.x, y: b.y - a.y };
  const heightVec = { x: apex.x - proj.x, y: apex.y - proj.y };
  const ang = angleBetween(baseVec, heightVec); // radians
  const angDeg = (ang * 180) / Math.PI;
  const angDeviation = Math.abs(90 - angDeg);

  // errors
  const errors: string[] = [];
  // degenerate if area close to zero or base length ~0
  if (area < 1e-3 || baseLen < 1e-3) {
    errors.push("degenerate");
  }
  // non-perpendicular if deviation > threshold
  if (angDeviation > options.perpendicularThresholdDeg) {
    errors.push("height_not_perpendicular");
  }
  // mismatch with expected area
  if (options.expectedArea != null) {
    const expected = options.expectedArea;
    const relErr = expected === 0 ? Math.abs(area - expected) : Math.abs(area - expected) / expected;
    if (relErr > options.toleranceRel) {
      errors.push("area_mismatch");
    }
  }

  // Status prioritization
  let status: Feedback["status"] = "ok";
  if (errors.length > 0) {
    status = errors.includes("degenerate") ? "error" : "warning";
  }

  // suggestions
  const suggestions: string[] = [];
  if (errors.includes("degenerate")) {
    suggestions.push("三角形退化（面积接近 0）。请移动顶点以形成明显的三角形。");
  }
  if (errors.includes("height_not_perpendicular")) {
    suggestions.push("构造高时应与底边垂直。尝试把顶点拖到底边上方制作直角投影，或开启参考线。");
  }
  if (errors.includes("area_mismatch")) {
    suggestions.push("面积与期望值不匹配。检查底或高是否输入/构造错误，并核对单位。");
  }
  if (status === "ok") {
    suggestions.push("当前结果在容差范围内。可继续下一个练习或请求更高难度。");
  }

  return {
    area: Number(area.toFixed(options.decimals + 2)), // keep extra precision internally
    baseLength: Number(baseLen.toFixed(options.decimals + 2)),
    height: Number(height.toFixed(options.decimals + 2)),
    status,
    errors,
    suggestions,
  };
};

/* ---------------------------
   Components
   --------------------------- */

const HintCard: React.FC<{
  errors: string[];
  onApplySolution?: () => void;
  onUseHint: (level: "weak" | "strong" | "solution") => void;
  hintStrictness: "lenient" | "normal" | "strict";
}> = ({ errors, onApplySolution, onUseHint, hintStrictness }) => {
  // Provide different messages for errors with three hint levels
  const getWeak = (e: string) => {
    switch (e) {
      case "degenerate":
        return "注意：当前三角形面积极小。试着把顶点稍微分开。";
      case "height_not_perpendicular":
        return "提示：高应垂直于所选的底边。你可以开启参考线以帮助构造直角。";
      case "area_mismatch":
        return "提示：你的面积与目标不匹配。检查底或高的数值或构造方法。";
      default:
        return "";
    }
  };
  const getStrong = (e: string) => {
    switch (e) {
      case "degenerate":
        return "强化提示：把任意一个顶点移动至少 50px 以形成明显三角形，或者使用“重置”按钮快速恢复。";
      case "height_not_perpendicular":
        return "强化提示：尝试将顶点拖动到几何上垂直于底边的投影位置，或选择另一条更适合的底边作为基准。";
      case "area_mismatch":
        return "强化提示：显示底与高的数值，比较是否与目标相差超过 5%。若是，优先检查高的构造。";
      default:
        return "";
    }
  };
  const getSolution = (e: string) => {
    switch (e) {
      case "degenerate":
        return "解答提示：系统可自动调整顶点为一个标准样例三角形。";
      case "height_not_perpendicular":
        return "解答提示：系统会将顶点投影到底边上并展示正确的垂足位置。可选择“应用解答”查看修正。";
      case "area_mismatch":
        return "解答提示：系统可给出一个符合目标面积的示例（或显示计算步骤）。";
      default:
        return "";
    }
  };

  // Choose which hints to render based on hintStrictness (teacher setting)
  const availableLevels: ("weak" | "strong" | "solution")[] =
    hintStrictness === "lenient"
      ? ["weak"]
      : hintStrictness === "normal"
      ? ["weak", "strong"]
      : ["weak", "strong", "solution"];

  return (
    <div style={{ border: "1px solid #ddd", padding: 10, borderRadius: 6, marginTop: 8 }}>
      <strong>提示卡片</strong>
      {errors.length === 0 && <div style={{ marginTop: 6 }}>当前无错误，系统建议：继续探索或请求更高难度练习。</div>}
      {errors.map((e) => (
        <div key={e} style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 600 }}>{e}</div>
          {availableLevels.includes("weak") && (
            <div style={{ marginTop: 4 }}>
              <em>弱提示：</em>
              <span>{getWeak(e)}</span>
              <button
                onClick={() => onUseHint("weak")}
                style={{ marginLeft: 8, padding: "2px 6px" }}
              >
                已使用弱提示
              </button>
            </div>
          )}
          {availableLevels.includes("strong") && (
            <div style={{ marginTop: 4 }}>
              <em>强化提示：</em>
              <span>{getStrong(e)}</span>
              <button
                onClick={() => onUseHint("strong")}
                style={{ marginLeft: 8, padding: "2px 6px" }}
              >
                已使用强化提示
              </button>
            </div>
          )}
          {availableLevels.includes("solution") && (
            <div style={{ marginTop: 4 }}>
              <em>解答提示：</em>
              <span>{getSolution(e)}</span>
              <button
                onClick={() => {
                  onUseHint("solution");
                  onApplySolution && onApplySolution();
                }}
                style={{ marginLeft: 8, padding: "2px 6px" }}
              >
                应用解答
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const FeedbackPanel: React.FC<{
  vertices: Point[];
  baseIndices: [number, number];
  feedback: Feedback;
  decimals: number;
  showFormula: "cross" | "base*height";
  onDecimalsChange: (d: number) => void;
  onDecimalsToggle: () => void;
  onShowFormulaToggle: () => void;
  onRequestHint: (level: "weak" | "strong" | "solution") => void;
  hintStrictness: "lenient" | "normal" | "strict";
  onApplySolution: () => void;
  expectedAreaInput: string;
  setExpectedAreaInput: (v: string) => void;
  toleranceRel: number;
  setToleranceRel: (t: number) => void;
}> = ({
  vertices,
  baseIndices,
  feedback,
  decimals,
  showFormula,
  onDecimalsChange,
  onDecimalsToggle,
  onShowFormulaToggle,
  onRequestHint,
  hintStrictness,
  onApplySolution,
  expectedAreaInput,
  setExpectedAreaInput,
  toleranceRel,
  setToleranceRel,
}) => {
  const [showDetails, setShowDetails] = useState(true);
  const [showOverlayValues, setShowOverlayValues] = useState(true);

  const a = vertices[baseIndices[0]];
  const b = vertices[baseIndices[1]];
  const apexIndex = [0, 1, 2].find((i) => !baseIndices.includes(i))!;
  const apex = vertices[apexIndex];
  const proj = projectPointToLine(apex, a, b);

  return (
    <div style={{ border: "1px solid #e6e6e6", padding: 12, borderRadius: 6, width: 360 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>即时反馈与提示</strong>
        <div>
          <label style={{ fontSize: 12, color: "#666" }}>小数位：</label>
          <select
            value={decimals}
            onChange={(e) => onDecimalsChange(Number(e.target.value))}
            style={{ marginLeft: 6 }}
          >
            {[0, 1, 2, 3, 4].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div>
            <div>
              当前面积:{" "}
              <strong style={{ color: feedback.status === "ok" ? "green" : feedback.status === "warning" ? "orange" : "red" }}>
                {formatNumber(feedback.area, decimals)}
              </strong>
            </div>
            <div>底长度: {formatNumber(feedback.baseLength, decimals)}</div>
            <div>高: {formatNumber(feedback.height, decimals)}</div>
            <div style={{ marginTop: 6 }}>
              状态:
              <span style={{ marginLeft: 8, fontWeight: 600 }}>
                {feedback.status.toUpperCase()}
              </span>
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <label>期望面积（可选）:</label>
            <input
              value={expectedAreaInput}
              onChange={(e) => setExpectedAreaInput(e.target.value)}
              placeholder="例如 120"
              style={{ width: "100%", marginTop: 6, padding: 6 }}
            />
          </div>

          <div style={{ marginTop: 8 }}>
            <label>容差（相对 %）: {Math.round(toleranceRel * 100)}</label>
            <input
              type="range"
              min={0}
              max={20}
              value={Math.round(toleranceRel * 100)}
              onChange={(e) => setToleranceRel(Number(e.target.value) / 100)}
              style={{ width: "100%" }}
            />
          </div>

          <div style={{ marginTop: 8 }}>
            <button onClick={() => onRequestHint("weak")} style={{ marginRight: 6 }}>
              请求弱提示
            </button>
            <button onClick={() => onRequestHint("strong")} style={{ marginRight: 6 }}>
              请求强化提示
            </button>
            <button onClick={() => onRequestHint("solution")}>请求解答</button>
          </div>
        </div>

        <div style={{ width: 180, borderLeft: "1px dashed #eee", paddingLeft: 10 }}>
          <div style={{ fontSize: 13 }}>公式面板</div>
          <div style={{ marginTop: 6 }}>
            <label>
              <input type="checkbox" checked={showOverlayValues} onChange={() => setShowOverlayValues(!showOverlayValues)} />
              显示底/高数值覆盖层
            </label>
          </div>

          <div style={{ marginTop: 6 }}>
            <label>
              <input type="checkbox" checked={showDetails} onChange={() => setShowDetails(!showDetails)} />
              展开计算细节
            </label>
          </div>

          {showDetails && (
            <div style={{ marginTop: 8, fontSize: 13 }}>
              <div>
                当前公式视图: <strong>{showFormula === "cross" ? "叉积法 (S=|...|/2)" : "底×高/2"}</strong>
              </div>
              <button onClick={onShowFormulaToggle} style={{ marginTop: 6 }}>
                切换公式显示
              </button>

              {showFormula === "cross" ? (
                <div style={{ marginTop: 6 }}>
                  S = |x1(y2 - y3) + x2(y3 - y1) + x3(y1 - y2)| / 2
                </div>
              ) : (
                <div style={{ marginTop: 6 }}>
                  S = (base × height) / 2 = ({formatNumber(feedback.baseLength, decimals)} ×{" "}
                  {formatNumber(feedback.height, decimals)}) / 2
                </div>
              )}
              <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
                若需更精确的提示，教师可调整提示严格度（在教师面板中设置）。
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 600 }}>系统建议</div>
        <ul style={{ marginTop: 6 }}>
          {feedback.suggestions.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 13, marginBottom: 6 }}>投影点（高的脚）坐标</div>
        <div style={{ fontSize: 12, color: "#333" }}>
          ({formatNumber(projectPointToLineString(proj), decimals)})
        </div>
        <div style={{ marginTop: 6 }}>
          <small style={{ color: "#999" }}>
            注：若高非垂直，系统将标记并提供重建或投影步骤。
          </small>
        </div>
      </div>
    </div>
  );
};

// Helper to format projection point inline (simple)
const projectPointToLineString = (p: Point) => `${p.x.toFixed(1)}, ${p.y.toFixed(1)}`;

const TriangleEditor: React.FC<{
  vertices: Point[];
  setVertices: (v: Point[]) => void;
  baseIndices: [number, number];
  setBaseIndices: (b: [number, number]) => void;
  onDragEnd: (eventName?: string) => void;
}> = ({ vertices, setVertices, baseIndices, setBaseIndices, onDragEnd }) => {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // map coordinates to SVG (we'll use same units)
  const toSVG = (p: Point) => p;
  const fromSVG = (evt: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const ctm = svg.getScreenCTM()?.inverse();
    if (!ctm) return { x: evt.clientX, y: evt.clientY };
    const loc = pt.matrixTransform(ctm);
    return { x: loc.x, y: loc.y };
  };

  const handleMouseDown = (e: React.MouseEvent, idx: number) => {
    setDragIdx(idx);
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragIdx == null) return;
    const pt = fromSVG(e);
    const newVerts = vertices.map((p, i) => (i === dragIdx ? { x: pt.x, y: pt.y } : p));
    setVertices(newVerts);
  };
  const handleMouseUp = () => {
    if (dragIdx != null) {
      setDragIdx(null);
      onDragEnd("dragEnd");
    }
  };

  const handleBaseSelect = (i0: number, i1: number) => {
    setBaseIndices([i0, i1]);
    onDragEnd("baseSelect");
  };

  return (
    <div style={{ border: "1px solid #eaeaea", borderRadius: 6, padding: 10 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>图形编辑（拖拽顶点）</div>
      <svg
        ref={svgRef}
        width={520}
        height={320}
        style={{ background: "#fafafa", borderRadius: 4 }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* base selection: clickable segments */}
        {[ [0,1], [1,2], [2,0] ].map(([i,j]) => {
          const a = vertices[i];
          const b = vertices[j];
          const isSelected = baseIndices[0] === i && baseIndices[1] === j;
          return (
            <g key={`${i}-${j}`}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={isSelected ? "#2a9d8f" : "#999"}
                strokeWidth={isSelected ? 4 : 2}
                strokeDasharray={isSelected ? undefined : "6 6"}
                onClick={() => handleBaseSelect(i, j)}
                style={{ cursor: "pointer" }}
              />
            </g>
          );
        })}
        {/* triangle fill */}
        <polygon
          points={vertices.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="#264653"
          fillOpacity={0.06}
          stroke="#264653"
          strokeWidth={1}
        />
        {/* vertices */}
        {vertices.map((p, i) => (
          <g key={i} transform={`translate(${p.x},${p.y})`} style={{ cursor: "grab" }}>
            <circle
              r={8}
              fill={i === 0 ? "#e76f51" : i === 1 ? "#f4a261" : "#2a9d8f"}
              stroke="#fff"
              strokeWidth={2}
              onMouseDown={(e) => handleMouseDown(e, i)}
            />
            <text x={12} y={4} fontSize={12} fill="#333">
              V{i + 1} ({Math.round(p.x)},{Math.round(p.y)})
            </text>
          </g>
        ))}
      </svg>

      <div style={{ marginTop: 8, fontSize: 12 }}>
        <div>点击边线以选择作为底边（当前选中边以实线显示）。</div>
        <div style={{ marginTop: 6 }}>
          <button
            onClick={() => {
              // reset to sample
              setVertices([{ x: 120, y: 240 }, { x: 420, y: 240 }, { x: 260, y: 80 }]);
              setBaseIndices([0, 1]);
              onDragEnd("reset");
            }}
          >
            重置示例三角形
          </button>
        </div>
      </div>
    </div>
  );
};

const TeacherDashboard: React.FC<{
  logs: LogEvent[];
  hintUsageCounts: Record<string, number>;
  onExportJSON: () => void;
  onExportCSV: () => void;
  onReplay: (speed?: number) => void;
  setHintStrictness: (s: "lenient" | "normal" | "strict") => void;
  hintStrictness: "lenient" | "normal" | "strict";
}> = ({ logs, hintUsageCounts, onExportJSON, onExportCSV, onReplay, setHintStrictness, hintStrictness }) => {
  // aggregate quick stats
  const submissions = logs.filter((l) => l.action === "submit").length;
  const resets = logs.filter((l) => l.action === "reset").length;
  const hintsRequested = hintUsageCounts;
  const errorCounts: Record<string, number> = {};
  logs.forEach((l) => {
    if (l.details && Array.isArray(l.details.errors)) {
      l.details.errors.forEach((e: string) => {
        errorCounts[e] = (errorCounts[e] || 0) + 1;
      });
    }
  });

  return (
    <div style={{ border: "1px solid #e6e6e6", padding: 12, borderRadius: 6, marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>教师监控与仪表盘</strong>
        <div>
          提示严格度:
          <select value={hintStrictness} onChange={(e) => setHintStrictness(e.target.value as any)} style={{ marginLeft: 6 }}>
            <option value="lenient">宽松</option>
            <option value="normal">正常</option>
            <option value="strict">严格</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: 8, display: "flex", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div>完成提交次数: {submissions}</div>
          <div>重置次数: {resets}</div>
          <div style={{ marginTop: 8 }}>
            <div style={{ fontWeight: 600 }}>常见错误分布</div>
            <ul>
              {Object.entries(errorCounts).length === 0 && <li>暂无错误记录</li>}
              {Object.entries(errorCounts).map(([k, v]) => (
                <li key={k}>
                  {k}: {v}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div style={{ width: 360 }}>
          <div style={{ fontWeight: 600 }}>提示使用统计</div>
          <ul>
            {Object.entries(hintsRequested).map(([k, v]) => (
              <li key={k}>
                {k}: {v}
              </li>
            ))}
          </ul>

          <div style={{ marginTop: 8 }}>
            <button onClick={onExportJSON} style={{ marginRight: 6 }}>
              导出 JSON
            </button>
            <button onClick={onExportCSV} style={{ marginRight: 6 }}>
              导出 CSV
            </button>
            <button onClick={() => onReplay(1)}>回放操作（速率 1x）</button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600 }}>事件日志（最近 20 条）</div>
        <div style={{ maxHeight: 200, overflow: "auto", border: "1px solid #f0f0f0", padding: 8, marginTop: 6 }}>
          {logs.slice(-20).reverse().map((l, i) => (
            <div key={i} style={{ fontSize: 12, marginBottom: 6 }}>
              <div>
                <strong>{new Date(l.ts).toLocaleTimeString()}</strong> - {l.action}
              </div>
              <div style={{ color: "#444" }}>{JSON.stringify(l.details)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ---------------------------
   App (Main)
   --------------------------- */

export const App: React.FC = () => {
  // initial triangle
  const [vertices, setVertices] = useState<Point[]>([
    { x: 120, y: 240 },
    { x: 420, y: 240 },
    { x: 260, y: 80 },
  ]);

  const [baseIndices, setBaseIndices] = useState<[number, number]>([0, 1]);

  // settings
  const [decimals, setDecimals] = useState<number>(2);
  const [showFormula, setShowFormula] = useState<"cross" | "base*height">("cross");
  const [toleranceRel, setToleranceRel] = useState<number>(0.05);
  const [perpThresholdDeg, setPerpThresholdDeg] = useState<number>(10); // allowed deviation
  const [expectedAreaInput, setExpectedAreaInput] = useState<string>("");

  // teacher settings
  const [hintStrictness, setHintStrictness] = useState<"lenient" | "normal" | "strict">("normal");

  // logs
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [hintUsageCounts, setHintUsageCounts] = useState<Record<string, number>>({
    weak: 0,
    strong: 0,
    solution: 0,
  });

  // for replay
  const [replayPoints, setReplayPoints] = useState<Point[][]>([]); // list of snapshots (vertices)
  const replayTimerRef = useRef<number | null>(null);

  // compute feedback on the fly
  const expectedArea = expectedAreaInput.trim() === "" ? null : Number(expectedAreaInput);
  const feedback = computeFeedback(vertices, baseIndices, {
    decimals,
    toleranceRel,
    expectedArea,
    perpendicularThresholdDeg: perpThresholdDeg,
  });

  // event logging helper
  const logEvent = (action: string, details: any = {}) => {
    const ev: LogEvent = {
      ts: now(),
      action,
      details,
      snapshot: { vertices: JSON.parse(JSON.stringify(vertices)), baseIndices },
    };
    setLogs((s) => [...s, ev]);
  };

  // record every significant change to replay points
  useEffect(() => {
    setReplayPoints((prev) => [...prev, JSON.parse(JSON.stringify(vertices))].slice(-200));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vertices]);

  // handlers
  const handleDragEnd = (eventName?: string) => {
    logEvent(eventName || "dragEnd", {
      area: feedback.area,
      base: feedback.baseLength,
      height: feedback.height,
      errors: feedback.errors,
    });
  };

  const handleRequestHint = (level: "weak" | "strong" | "solution") => {
    // increment hint counters
    setHintUsageCounts((s) => ({ ...s, [level]: (s[level] || 0) + 1 }));
    logEvent("hintRequested", { level, errors: feedback.errors });
    // For solution requests we may auto-apply a correction (projection)
    if (level === "solution") {
      applyProjectionCorrection();
    }
  };

  const applyProjectionCorrection = () => {
    // This will move apex to its perpendicular projection to base (simulate "fix")
    const [i0, i1] = baseIndices;
    const apexIndex = [0, 1, 2].find((i) => !baseIndices.includes(i))!;
    const a = vertices[i0];
    const b = vertices[i1];
    const apex = vertices[apexIndex];
    const proj = projectPointToLine(apex, a, b);
    const newVerts = vertices.map((p, i) => (i === apexIndex ? proj : p));
    setVertices(newVerts);
    logEvent("applySolution", { method: "projection_to_base", apexIndex, newApex: proj });
  };

  const handleSubmit = () => {
    logEvent("submit", {
      area: feedback.area,
      result: feedback.status,
      errors: feedback.errors,
    });
    alert(`提交已记录。当前状态：${feedback.status.toUpperCase()}`);
  };

  const exportJSON = () => {
    const payload = { logs, hintUsageCounts, settings: { decimals, toleranceRel, hintStrictness } };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "teaching_feedback_export.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    // Flatten logs into CSV: ts,action,errors,area,base,height
    const header = ["ts", "action", "errors", "area", "base", "height"];
    const rows = logs.map((l) => {
      const { ts, action, details } = l;
      const errs = Array.isArray(details.errors) ? details.errors.join("|") : "";
      const area = details.area ?? "";
      const base = details.base ?? "";
      const height = details.height ?? "";
      return [new Date(ts).toISOString(), action, errs, area, base, height];
    });
    const csv = [header.join(","), ...rows.map((r) => r.map((c) => `"${String(c)}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "teaching_feedback_logs.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const replay = (speed = 1) => {
    // Play replayPoints sequentially
    if (replayPoints.length === 0) {
      alert("暂无回放数据");
      return;
    }
    let i = 0;
    if (replayTimerRef.current) {
      window.clearInterval(replayTimerRef.current);
      replayTimerRef.current = null;
    }
    const interval = 500 / speed;
    replayTimerRef.current = window.setInterval(() => {
      const snap = replayPoints[i];
      setVertices(JSON.parse(JSON.stringify(snap)));
      i++;
      if (i >= replayPoints.length) {
        if (replayTimerRef.current) {
          window.clearInterval(replayTimerRef.current);
          replayTimerRef.current = null;
        }
      }
    }, interval);
  };

  // small helper to update decimals
  const onDecimalsChange = (d: number) => setDecimals(d);

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      <h2>教学反馈与提示（交互演示）</h2>

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <TriangleEditor
            vertices={vertices}
            setVertices={setVertices}
            baseIndices={baseIndices}
            setBaseIndices={setBaseIndices}
            onDragEnd={handleDragEnd}
          />

          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <button onClick={handleSubmit}>提交答案</button>
            <button
              onClick={() => {
                setVertices([{ x: 120, y: 240 }, { x: 420, y: 240 }, { x: 260, y: 80 }]);
                setBaseIndices([0, 1]);
                logEvent("reset", {});
              }}
            >
              重置
            </button>
            <button
              onClick={() => {
                // toggle formula
                setShowFormula((s) => (s === "cross" ? "base*height" : "cross"));
              }}
            >
              切换公式视图
            </button>
            <button
              onClick={() => {
                applyProjectionCorrection();
              }}
            >
              应用投影（示例解答）
            </button>
          </div>

          <div style={{ marginTop: 8 }}>
            <small style={{ color: "#666" }}>
              事件日志将记录关键事件（提交/请求提示/重置/拖拽结束），并保存图形快照（顶点坐标与所选底边）。
            </small>
          </div>
        </div>

        <div style={{ width: 400 }}>
          <FeedbackPanel
            vertices={vertices}
            baseIndices={baseIndices}
            feedback={feedback}
            decimals={decimals}
            showFormula={showFormula}
            onDecimalsChange={onDecimalsChange}
            onDecimalsToggle={() => setDecimals((d) => (d === 2 ? 3 : 2))}
            onShowFormulaToggle={() => setShowFormula((s) => (s === "cross" ? "base*height" : "cross"))}
            onRequestHint={(lvl) => handleRequestHint(lvl)}
            hintStrictness={hintStrictness}
            onApplySolution={applyProjectionCorrection}
            expectedAreaInput={expectedAreaInput}
            setExpectedAreaInput={setExpectedAreaInput}
            toleranceRel={toleranceRel}
            setToleranceRel={setToleranceRel}
          />

          <div style={{ marginTop: 10 }}>
            <HintCard
              errors={feedback.errors}
              onApplySolution={applyProjectionCorrection}
              onUseHint={(level) => handleRequestHint(level)}
              hintStrictness={hintStrictness}
            />
          </div>
        </div>
      </div>

      <TeacherDashboard
        logs={logs}
        hintUsageCounts={hintUsageCounts}
        onExportJSON={exportJSON}
        onExportCSV={exportCSV}
        onReplay={replay}
        setHintStrictness={setHintStrictness}
        hintStrictness={hintStrictness}
      />
    </div>
  );
};

/* ---------------------------
   Render (if using standalone)
   --------------------------- */
// If you're embedding this file into an existing React app, export App and use it.
// For quick testing in Codesandbox or similar, uncomment the lines below:

// import { createRoot } from "react-dom/client";
// const root = createRoot(document.getElementById("root")!);
// root.render(<App />);

export default App;