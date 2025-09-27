import React, { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

/**
 * App.jsx - 统一整合的 React 教学几何 Web 应用
 * 组合模块：
 * - 画布与几何交互（GeometryCanvas）
 * - 工具栏（ToolBar）
 * - 右侧步骤/公式（RightPanel）
 * - 教学反馈与提交（FeedbackPanel + HintCard）
 * - 教师监控与导出（TeacherDashboard）
 *
 * 特性：
 * - 顶点拖拽（pointer events + requestAnimationFrame 节流）
 * - 底边锁定、垂线与面积实时计算
 * - 共线检测与自动修正、最小高度阈值
 * - 拼接演示动画（镜像+平移）支持暂停/跳过/速率
 * - 撤销/重做/重置，网格吸附
 * - 提示系统、单位与精度、语音播报
 * - 教师事件回放、CSV/JSON 导出
 */

/* ----------------------------- Helpers & Types ---------------------------- */

const styles = {
  app: {
    fontFamily: "Inter, Arial, sans-serif",
    height: "100vh",
    display: "grid",
    gridTemplateRows: "56px 1fr",
  },
  topbar: {
    height: 56,
    background: "#2B7AEB",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    padding: "0 16px",
    gap: 12,
  },
  container: {
    display: "grid",
    gridTemplateColumns: "240px 1fr 400px",
    gap: 12,
    padding: 12,
    alignItems: "stretch",
    height: "calc(100vh - 56px)",
  },
  leftPanel: {
    background: "#fff",
    borderRadius: 8,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    overflow: "auto",
  },
  centerPanel: {
    background: "#f7fbff",
    borderRadius: 8,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  rightPanel: {
    background: "#fff",
    borderRadius: 8,
    padding: 12,
    overflow: "auto",
  },
  toolbarBtn: {
    background: "#fff",
    border: "1px solid #e6eefc",
    borderRadius: 6,
    padding: "8px 10px",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  },
  smallText: { fontSize: 13, color: "#333" },
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const uid = (prefix = "") => `${prefix}${Math.random().toString(36).slice(2, 9)}`;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (v, s) => ({ x: v.x * s, y: v.y * s });
const vec = (a, b) => ({ x: b.x - a.x, y: b.y - a.y });
const dot = (u, v) => u.x * v.x + u.y * v.y;
const cross = (u, v) => u.x * v.y - u.y * v.x;
const length = (v) => Math.hypot(v.x, v.y);
const nearlyEqual = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const nowISO = () => new Date().toISOString();

/** 投影点：把 P 投影到线 AB 上，返回投影点（无限直线） */
function projectPointToLine(P, A, B) {
  const ABx = B.x - A.x;
  const ABy = B.y - A.y;
  const APx = P.x - A.x;
  const APy = P.y - A.y;
  const ab2 = ABx * ABx + ABy * ABy;
  const t = ab2 === 0 ? 0 : (APx * ABx + APy * ABy) / ab2;
  return { x: A.x + ABx * t, y: A.y + ABy * t };
}

/** 点到直线距离 */
function pointLineDistance(P, A, B) {
  const proj = projectPointToLine(P, A, B);
  return dist(P, proj);
}

function triangleArea(pts) {
  const [A, B, C] = pts;
  return Math.abs(cross(vec(A, B), vec(A, C))) / 2;
}

function isCollinear(pts) {
  return nearlyEqual(triangleArea(pts), 0);
}

function computeBaseAndHeight(pts, baseIndices) {
  const [i, j] = baseIndices;
  const A = pts[i];
  const B = pts[j];
  const k = [0, 1, 2].find((t) => t !== i && t !== j);
  const baseV = vec(A, B);
  const baseLength = length(baseV);
  const heightVal = Math.abs(cross(baseV, vec(A, pts[k]))) / (baseLength || 1);
  return { baseLength, height: heightVal, baseA: A, baseB: B, apexIdx: k };
}

function footOnBase(pts, baseIndices) {
  const { baseA, baseB, apexIdx } = computeBaseAndHeight(pts, baseIndices);
  const baseV = vec(baseA, baseB);
  const baseUnit = mul(baseV, 1 / (length(baseV) || 1));
  const AP = vec(baseA, pts[apexIdx]);
  const proj = dot(AP, baseUnit);
  return add(baseA, mul(baseUnit, proj));
}

/* ------------------------------- Components ------------------------------- */

/* HintCard */
function HintCard({ onClose, onUseHint, hintCount }) {
  return (
    <div style={{ border: "1px solid #ddd", background: "#fff", padding: 10, borderRadius: 6, width: 300, boxShadow: "0 4px 14px rgba(0,0,0,0.06)" }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>提示 (Hint)</div>
      <div style={{ fontSize: 13, marginBottom: 8 }}>
        1) 尝试镜像拼接：将当前三角形镜像拼接可见一个平行四边形，从而理解 Area_triangle = 1/2 Area_parallelogram。
      </div>
      <div style={{ fontSize: 13, marginBottom: 8 }}>
        2) 若高度过小，打开网格帮助精确放置，或沿垂直方向移动顶点 C 增大高度。
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => { onUseHint("mirror"); onClose(); }}>试一试（镜像演示）</button>
        <button onClick={() => { onUseHint("grid"); onClose(); }}>打开网格</button>
        <button onClick={onClose}>关闭</button>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>已使用提示：{hintCount}</div>
    </div>
  );
}

/* ToolBar */
function ToolBar({
  activeTool,
  setActiveTool,
  onReset,
  onUndo,
  onRedo,
  onDemo,
  lockedBase,
  setLockedBase,
  onCopyLaTeX,
  onSpeak,
  onAlignToGrid,
  gridOn,
  setGridOn,
  animRunning,
  animPaused,
  onAnimPauseToggle,
  onAnimSkip,
  animSpeed,
  setAnimSpeed,
  onSubmitAnswer,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button aria-pressed={activeTool === "select"} onClick={() => setActiveTool("select")} style={styles.toolbarBtn} title="选择 (Select)">
          选择
        </button>
        <button aria-pressed={activeTool === "vertex"} onClick={() => setActiveTool("vertex")} style={styles.toolbarBtn} title="顶点移动">
          顶点
        </button>
        <button onClick={onDemo} style={styles.toolbarBtn} title="拼接演示">拼接演示</button>
        <button onClick={onUndo} style={styles.toolbarBtn} title="撤销">撤销</button>
        <button onClick={onRedo} style={styles.toolbarBtn} title="重做">重做</button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={onReset} style={styles.toolbarBtn} title="重置">重置</button>
        <button onClick={() => setLockedBase(!lockedBase)} style={styles.toolbarBtn} title="锁定/解锁底边">
          {lockedBase ? "解锁底边" : "锁定底边"}
        </button>
        <button onClick={onAlignToGrid} style={styles.toolbarBtn} title="吸附网格">吸附网格</button>
        <button onClick={() => setGridOn(!gridOn)} style={styles.toolbarBtn} title="网格开关">
          {gridOn ? "关闭网格" : "打开网格"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={onCopyLaTeX} style={styles.toolbarBtn} title="复制 LaTeX">复制 LaTeX</button>
        <button onClick={onSpeak} style={styles.toolbarBtn} title="朗读公式">语音播报</button>
        <button onClick={onSubmitAnswer} style={styles.toolbarBtn} title="提交答案">提交</button>
      </div>

      <div style={{ borderTop: "1px solid #eef2ff", marginTop: 8, paddingTop: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>动画控制</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={onDemo} style={styles.toolbarBtn} disabled={animRunning} title="开始演示">开始</button>
          <button onClick={onAnimPauseToggle} style={styles.toolbarBtn} disabled={!animRunning}>{animPaused ? "继续" : "暂停"}</button>
          <button onClick={onAnimSkip} style={styles.toolbarBtn} disabled={!animRunning}>跳过</button>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            速率
            <input type="range" min="0.25" max="3" step="0.25" value={animSpeed} onChange={(e) => setAnimSpeed(Number(e.target.value))} />
            <span style={{ fontSize: 12 }}>{animSpeed}×</span>
          </label>
        </div>
      </div>
    </div>
  );
}

/* RightPanel */
function RightPanel({ baseLen, height, area, onCopyLaTeX, onSpeak }) {
  const latex = `\\text{Area}_{triangle} = \\tfrac{1}{2} \\times base \\times height = \\tfrac{1}{2} \\times ${baseLen.toFixed(2)} \\times ${height.toFixed(2)} = ${area.toFixed(2)}`;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>步骤与公式</h3>
        <div />
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#2B7AEB" }}>Area = 1/2 × base × height</div>
          <div style={{ marginTop: 8 }}>{`代入当前数值： base = ${baseLen.toFixed(2)}, height = ${height.toFixed(2)}`}</div>
          <div style={{ marginTop: 8, fontWeight: 700 }}>{`Area = ${area.toFixed(2)} (单位²)`}</div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>逐步推导</div>
          <ol>
            <li>选取底边 AB 作为 base。</li>
            <li>从顶点 C 到 AB 作垂线，得到高度 h。</li>
            <li>计算三角形面积：1/2 × base × height。</li>
          </ol>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={onCopyLaTeX} style={styles.toolbarBtn}>复制 LaTeX</button>
          <button onClick={onSpeak} style={styles.toolbarBtn}>语音播报</button>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, color: "#666" }}>无障碍提示：可使用键盘选中顶点并微调位置（方向键，Shift 加大步长）。</div>
        </div>

        <div style={{ marginTop: 16, fontSize: 12, color: "#888" }}>
          LaTeX: {latex}
        </div>
      </div>
    </div>
  );
}

/* FeedbackPanel */
function FeedbackPanel({
  base,
  height,
  area,
  precision,
  setPrecision,
  unit,
  setUnit,
  formulaStep,
  voiceEnabled,
  setVoiceEnabled,
  message,
  submitValue,
  setSubmitValue,
  submitUnit,
  setSubmitUnit,
  onSubmit,
}) {
  const format = (v) => (Number.isFinite(v) ? v.toFixed(precision) : "—");

  useEffect(() => {
    if (voiceEnabled && window.speechSynthesis) {
      const msg = new SpeechSynthesisUtterance(`当前面积 ${format(area)} ${submitUnit || unit}平方`);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(msg);
    }
  }, [area, precision, unit, submitUnit, voiceEnabled]);

  return (
    <div style={{ border: "1px solid #e6e6e6", borderRadius: 6, padding: 10, background: "#fafafa" }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>实时计算与公式演示</div>
      <div style={{ fontSize: 13, marginBottom: 8 }}>
        精度：
        <select value={precision} onChange={(e) => setPrecision(Number(e.target.value))} style={{ marginLeft: 8 }}>
          <option value={0}>0</option>
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
        </select>
        单位：
        <select value={unit} onChange={(e) => setUnit(e.target.value)} style={{ marginLeft: 8 }}>
          <option value="cm">cm</option>
          <option value="m">m</option>
          <option value="mm">mm</option>
        </select>
        语音播报：
        <input type="checkbox" checked={voiceEnabled} onChange={(e) => setVoiceEnabled(e.target.checked)} style={{ marginLeft: 6 }} />
      </div>

      <div style={{ marginTop: 6, padding: 8, borderRadius: 6, background: "#fff", border: "1px solid #eee" }}>
        <div style={{ fontSize: 14 }}>
          {formulaStep === 0 && "Area = 1/2 × base × height"}
          {formulaStep === 1 && `Area = 1/2 × ${format(base)} ${unit} × ${format(height)} ${unit}`}
          {formulaStep === 2 && `Area = ${format(area)} ${unit}²`}
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 13 }}>
        <div>base: {format(base)} {unit}</div>
        <div>height: {format(height)} {unit}</div>
        <div>area: {format(area)} {unit}²</div>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 600 }}>提交你的答案</div>
        <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
          <input type="number" step="any" value={submitValue} onChange={(e) => setSubmitValue(e.target.value)} placeholder="输入数值" />
          <select value={submitUnit} onChange={(e) => setSubmitUnit(e.target.value)}>
            <option value="">(单位)</option>
            <option value="cm">cm</option>
            <option value="m">m</option>
            <option value="mm">mm</option>
          </select>
          <button onClick={onSubmit}>提交</button>
        </div>
        <div style={{ marginTop: 8 }}>
          {message}
        </div>
      </div>
    </div>
  );
}

/* TeacherDashboard */
function TeacherDashboard({ records, events, onExportCSV, onExportJSON, onReplayEvents, playbackState }) {
  return (
    <div style={{ border: "1px solid #f0f0f0", padding: 8, borderRadius: 6, background: "#fff" }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>教师端监控</div>
      <div style={{ fontSize: 13, marginBottom: 8 }}>实时事件与导出</div>
      <div style={{ marginBottom: 8 }}>
        <button onClick={onReplayEvents}>{playbackState.playing ? "播放中…" : "回放操作"}</button>{" "}
        <button onClick={onExportCSV}>导出 CSV</button>{" "}
        <button onClick={onExportJSON}>导出 JSON</button>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600 }}>成绩统计（示例）</div>
        <div style={{ fontSize: 13, marginTop: 6 }}>
          学生数：{records.length}，平均得分：{records.length === 0 ? "—" : (records.reduce((s, r) => s + (r.score || 0), 0) / records.length).toFixed(1)}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600 }}>事件流预览（最近 10 条）</div>
        <div style={{ maxHeight: 160, overflow: "auto", padding: 6, border: "1px dashed #eee", marginTop: 6 }}>
          {events.slice(-10).map((ev, i) => (
            <div key={i} style={{ fontSize: 12 }}>
              [{ev.timestamp}] {ev.type} {JSON.stringify(ev.payload)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* GeometryCanvas - 核心交互画布（RAF 节流、拖拽、动画镜像拼接） */
function GeometryCanvas({
  points,
  baseIndices,
  baseLocked,
  gridOn,
  onPartialDragUpdate,
  onDragStart,
  onDragEnd,
  selectedVertex,
  setSelectedVertex,
  animCopy,
  showParallelogram,
  animRunning,
  messageText,
}) {
  const svgRef = useRef(null);
  const draggingRef = useRef({ active: false, pointerId: null, vertexIdx: null });
  const rafRef = useRef(null);
  const latestPointer = useRef(null);

  const clientToSvg = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: clientX, y: clientY };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM().inverse();
    const loc = pt.matrixTransform(ctm);
    return { x: loc.x, y: loc.y };
  }, []);

  const onPointerDownVertex = (e, idx) => {
    if (animRunning) return;
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const p = clientToSvg(e.clientX, e.clientY);
    draggingRef.current.active = true;
    draggingRef.current.pointerId = e.pointerId;
    draggingRef.current.vertexIdx = idx;
    setSelectedVertex(idx);
    svg.setPointerCapture(e.pointerId);
    latestPointer.current = p;
    onDragStart(idx, p);
    if (!rafRef.current) rafRef.current = requestAnimationFrame(dragLoop);
  };

  const onPointerMove = (e) => {
    if (!draggingRef.current.active || e.pointerId !== draggingRef.current.pointerId) return;
    latestPointer.current = clientToSvg(e.clientX, e.clientY);
  };

  const onPointerUp = (e) => {
    if (!draggingRef.current.active) return;
    const idx = draggingRef.current.vertexIdx;
    const p = latestPointer.current;
    draggingRef.current.active = false;
    const svg = svgRef.current;
    try {
      svg.releasePointerCapture(draggingRef.current.pointerId);
    } catch {}
    draggingRef.current.pointerId = null;
    draggingRef.current.vertexIdx = null;
    setSelectedVertex(null);
    cancelAnimationFrame(rafRef.current || 0);
    rafRef.current = null;
    onDragEnd(idx, p);
  };

  const dragLoop = () => {
    if (!draggingRef.current.active) {
      rafRef.current = null;
      return;
    }
    const idx = draggingRef.current.vertexIdx;
    const p = latestPointer.current;
    if (typeof idx === "number" && p) {
      onPartialDragUpdate(idx, p);
    }
    rafRef.current = requestAnimationFrame(dragLoop);
  };

  // Keyboard micro-adjust
  useEffect(() => {
    const onKey = (ev) => {
      if (selectedVertex == null || animRunning) return;
      const step = ev.shiftKey ? 10 : 1;
      let dx = 0, dy = 0;
      if (ev.key === "ArrowLeft") dx = -step;
      if (ev.key === "ArrowRight") dx = step;
      if (ev.key === "ArrowUp") dy = -step;
      if (ev.key === "ArrowDown") dy = step;
      if (dx || dy) {
        ev.preventDefault();
        const p = points[selectedVertex];
        onPartialDragUpdate(selectedVertex, { x: p.x + dx, y: p.y + dy }, true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedVertex, animRunning, points, onPartialDragUpdate]);

  const A = points[baseIndices[0]];
  const B = points[baseIndices[1]];
  const otherIdx = [0, 1, 2].find((i) => i !== baseIndices[0] && i !== baseIndices[1]);
  const C = points[otherIdx];
  const baseLen = dist(A, B);
  const proj = projectPointToLine(C, A, B);
  const h = pointLineDistance(C, A, B);
  const area = 0.5 * baseLen * h;
  const baseMid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}>
      <svg
        ref={svgRef}
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "100%", borderRadius: 8, background: "linear-gradient(90deg,#f7fbff, #fff)", touchAction: "none" }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        aria-label="Geometry Canvas"
        role="img"
      >
        {/* Grid */}
        {gridOn &&
          Array.from({ length: 21 }).map((_, i) => {
            const x = i * 40;
            return <line key={`v${i}`} x1={x} y1={0} x2={x} y2={600} stroke="#eef6ff" strokeWidth={1} />;
          })}
        {gridOn &&
          Array.from({ length: 16 }).map((_, j) => {
            const y = j * 40;
            return <line key={`h${j}`} x1={0} y1={y} x2={800} y2={y} stroke="#eef6ff" strokeWidth={1} />;
          })}

        <defs>
          <linearGradient id="areaFill" x1="0" x2="1">
            <stop offset="0%" stopColor="#27AE60" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#27AE60" stopOpacity={0.08} />
          </linearGradient>
          <linearGradient id="gfill" x1="0" x2="1">
            <stop offset="0%" stopColor="#ffd" />
            <stop offset="100%" stopColor="#ffd" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Triangle primary */}
        <polygon
          points={points.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="url(#areaFill)"
          stroke="#2B7AEB"
          strokeWidth={2}
          opacity={showParallelogram ? 0.5 : 1}
          style={{ transition: "all 300ms cubic-bezier(.2,.9,.2,1)" }}
        />

        {/* Parallelogram after animation */}
        {showParallelogram && !animCopy && (() => {
          const [i, j] = baseIndices;
          const k = [0, 1, 2].find((t) => t !== i && t !== j);
          const A_ = points[i], B_ = points[j], P = points[k];
          const baseV = vec(A_, B_);
          const baseUnit = mul(baseV, 1 / (length(baseV) || 1));
          const normal = { x: -baseUnit.y, y: baseUnit.x };
          const AP = vec(A_, P);
          const along = dot(AP, baseUnit);
          const across = dot(AP, normal);
          const Pref = add(A_, add(mul(baseUnit, along), mul(normal, -across)));
          const Ptrans = add(Pref, baseV);
          const quad = [A_, B_, Ptrans, P];
          return <polygon points={quad.map((q) => `${q.x},${q.y}`).join(" ")} fill="url(#gfill)" stroke="#fa541c" strokeWidth={1.5} opacity={0.9} />;
        })()}

        {/* Animating copy */}
        {animCopy && (
          <polygon
            points={animCopy.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="#ffd6e7"
            stroke="#eb2f96"
            strokeWidth={1.5}
            opacity={0.9}
          />
        )}

        {/* Height dashed */}
        <line x1={C.x} y1={C.y} x2={proj.x} y2={proj.y} stroke="#F39C12" strokeWidth={2} strokeDasharray="6 6" />

        {/* Base highlight */}
        <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#52c41a" strokeWidth={baseLocked ? 4 : 3} opacity={0.9} />

        {/* Labels */}
        <g fontSize={13} fill="#111">
          <text x={baseMid.x + 8} y={baseMid.y - 8} fill="#2B7AEB" style={{ fontWeight: 600 }}>
            {`base = ${baseLen.toFixed(2)}`}
          </text>
          <text x={(C.x + proj.x) / 2 + 12} y={(C.y + proj.y) / 2 - 6} fill="#F39C12" style={{ fontWeight: 600 }}>
            {`h = ${h.toFixed(2)}`}
          </text>
          <text x={baseMid.x - 40} y={baseMid.y + 20} fill="#27AE60" style={{ fontWeight: 700 }}>
            {`Area = ${area.toFixed(2)}`}
          </text>
        </g>

        {/* Vertex handles */}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={14}
              fill="transparent"
              onPointerDown={(e) => onPointerDownVertex(e, i)}
              style={{ cursor: baseLocked && (i === baseIndices[0] || i === baseIndices[1]) ? "grab" : "grab", touchAction: "none" }}
              aria-label={`vertex-${i}`}
              tabIndex={0}
              onFocus={() => setSelectedVertex(i)}
            />
            <circle
              cx={p.x}
              cy={p.y}
              r={6}
              fill={i === baseIndices[0] || i === baseIndices[1] ? "#2B7AEB" : "#F39C12"}
              stroke="#fff"
              strokeWidth={2}
              pointerEvents="none"
            />
            <text x={p.x + 10} y={p.y - 10} fontSize="12" fill="#333">{["A", "B", "C"][i]}</text>
          </g>
        ))}
      </svg>

      <div style={{ marginTop: 8, display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "#666" }}>
          Tip: 拖动蓝/橙色点。方向键微调（Shift 加大步长）。
        </span>
        {animRunning && <span style={{ color: "#e67e22" }}>演示进行中…控制已锁定</span>}
        {messageText && <span style={{ color: "#555" }}>{messageText}</span>}
      </div>
    </div>
  );
}

/* ------------------------------ Global State ------------------------------ */

const initialShape = [
  { x: 200, y: 400 }, // A
  { x: 500, y: 420 }, // B
  { x: 300, y: 150 }, // C
];

const initialState = {
  id: uid("s-"),
  points: initialShape,
  baseIndices: [0, 1],
  baseLocked: false,
  gridOn: true,
  activeTool: "vertex",
  selectedVertex: null,

  history: [initialShape],
  historyIdx: 0,

  precision: 2,
  unit: "cm",
  voiceEnabled: false,

  hintOpen: false,
  hintCount: 0,

  events: [],
  records: [],
  playback: { playing: false, index: 0 },

  message: "",

  // Formula animation step
  formulaStep: 2,

  // Animation
  anim: { running: false, paused: false, speed: 1, progress: 0 },
  animCopy: null,
  showParallelogram: false,

  // Submission
  submitValue: "",
  submitUnit: "",
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_POINTS": {
      return { ...state, points: action.points };
    }
    case "PUSH_HISTORY": {
      const h = state.history.slice(0, state.historyIdx + 1);
      h.push(state.points.map((p) => ({ ...p })));
      return { ...state, history: h, historyIdx: h.length - 1 };
    }
    case "UNDO": {
      if (state.historyIdx <= 0) return state;
      const idx = state.historyIdx - 1;
      return { ...state, historyIdx: idx, points: state.history[idx].map((p) => ({ ...p })) };
    }
    case "REDO": {
      if (state.historyIdx >= state.history.length - 1) return state;
      const idx = state.historyIdx + 1;
      return { ...state, historyIdx: idx, points: state.history[idx].map((p) => ({ ...p })) };
    }
    case "RESET": {
      return { ...initialState, gridOn: state.gridOn, precision: state.precision, unit: state.unit };
    }
    case "SET_BASE_LOCK": return { ...state, baseLocked: action.value };
    case "SET_GRID": return { ...state, gridOn: action.value };
    case "SET_ACTIVE_TOOL": return { ...state, activeTool: action.value };
    case "SET_SELECTED_VERTEX": return { ...state, selectedVertex: action.value };
    case "SET_MESSAGE": return { ...state, message: action.value };
    case "SET_PRECISION": return { ...state, precision: action.value };
    case "SET_UNIT": return { ...state, unit: action.value };
    case "SET_VOICE": return { ...state, voiceEnabled: action.value };
    case "OPEN_HINT": return { ...state, hintOpen: true };
    case "CLOSE_HINT": return { ...state, hintOpen: false };
    case "INC_HINT": return { ...state, hintCount: state.hintCount + 1 };
    case "LOG_EVENT": return { ...state, events: [...state.events, action.event] };
    case "ADD_RECORD": return { ...state, records: [...state.records, action.record] };
    case "SET_PLAYBACK": return { ...state, playback: { ...state.playback, ...action.playback } };
    case "SET_FORMULA_STEP": return { ...state, formulaStep: action.value };
    case "ANIM_START": return { ...state, anim: { ...state.anim, running: true, paused: false, progress: 0 }, animCopy: action.startCopy, showParallelogram: false };
    case "ANIM_TICK": return { ...state, anim: { ...state.anim, progress: action.progress }, animCopy: action.copy };
    case "ANIM_PAUSE_TOGGLE": return { ...state, anim: { ...state.anim, paused: !state.anim.paused } };
    case "ANIM_SKIP": return { ...state, anim: { ...state.anim, running: false, progress: 1, paused: false }, animCopy: null, showParallelogram: true };
    case "ANIM_END": return { ...state, anim: { ...state.anim, running: false, paused: false, progress: 1 }, animCopy: null, showParallelogram: true };
    case "SET_ANIM_SPEED": return { ...state, anim: { ...state.anim, speed: action.value } };
    case "SET_SUBMIT_VALUE": return { ...state, submitValue: action.value };
    case "SET_SUBMIT_UNIT": return { ...state, submitUnit: action.value };
    default:
      return state;
  }
}

/* ---------------------------------- App ---------------------------------- */

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Derived metrics
  const { baseLength, height, apexIdx } = useMemo(() => computeBaseAndHeight(state.points, state.baseIndices), [state.points, state.baseIndices]);
  const area = useMemo(() => 0.5 * baseLength * height, [baseLength, height]);

  // Formula step animation on points change
  useEffect(() => {
    dispatch({ type: "SET_FORMULA_STEP", value: 0 });
    const t1 = setTimeout(() => dispatch({ type: "SET_FORMULA_STEP", value: 1 }), 300);
    const t2 = setTimeout(() => dispatch({ type: "SET_FORMULA_STEP", value: 2 }), 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [state.points]);

  // Events helper
  const logEvent = useCallback((type, payload = {}) => {
    dispatch({ type: "LOG_EVENT", event: { type, payload, timestamp: nowISO() } });
  }, []);

  // Handlers: drag start / partial update / end
  const MIN_HEIGHT = 6;

  const onDragStart = useCallback((idx, p) => {
    dispatch({ type: "PUSH_HISTORY" });
    dispatch({ type: "SET_MESSAGE", value: "" });
    logEvent("dragStart", { index: idx, pos: p });
  }, [logEvent]);

  const applyBaseLockConstraint = (pts, idx, p) => {
    const [i, j] = state.baseIndices;
    if (state.baseLocked && (idx === i || idx === j)) {
      const otherIdx = idx === i ? j : i;
      const A = pts[otherIdx];
      const B = pts[idx];
      const lineV = vec(A, B);
      const AP = vec(A, p);
      const proj = dot(AP, lineV) / (dot(lineV, lineV) || 1);
      return add(A, mul(lineV, proj));
    }
    return p;
  };

  const onPartialDragUpdate = useCallback((idx, p, fromKeyboard = false) => {
    // throttle update: update points with constraint, avoid collinear freeze check for in-flight
    const next = state.points.map((pt, i) => (i === idx ? applyBaseLockConstraint(state.points, idx, p) : pt));
    if (!isCollinear(next)) {
      dispatch({ type: "SET_POINTS", points: next });
      logEvent(fromKeyboard ? "keyboardAdjust" : "dragMove", { index: idx, pos: p });
    } else {
      dispatch({ type: "SET_MESSAGE", value: "将导致三点共线，操作受限" });
    }
  }, [state.points, state.baseIndices, state.baseLocked, logEvent]);

  const onDragEnd = useCallback((idx, p) => {
    logEvent("dragEnd", { index: idx, pos: p });
    const pts = state.points;
    if (isCollinear(pts)) {
      // auto correct apex
      const [i, j] = state.baseIndices;
      const A = pts[i];
      const B = pts[j];
      const baseV = vec(A, B);
      const n = { x: -baseV.y, y: baseV.x };
      const nlen = length(n) || 1;
      const norm = mul(n, 14 / nlen);
      const newPts = pts.map((q, k) => (k === apexIdx ? add(q, norm) : q));
      dispatch({ type: "SET_POINTS", points: newPts });
      dispatch({ type: "SET_MESSAGE", value: "检测到三点共线，已自动微调" });
      logEvent("autoCorrect", { apexIdx });
      return;
    }
    const { height: hNow } = computeBaseAndHeight(pts, state.baseIndices);
    if (hNow < MIN_HEIGHT) {
      dispatch({ type: "UNDO" });
      dispatch({ type: "SET_MESSAGE", value: "高度过小，已回退到最近合法位置" });
      logEvent("heightTooSmall", {});
    } else {
      dispatch({ type: "SET_MESSAGE", value: "拖拽完成" });
    }
  }, [state.points, state.baseIndices, apexIdx, logEvent]);

  // Align to grid
  const onAlignToGrid = useCallback(() => {
    const grid = 20;
    const snapped = state.points.map((p) => ({ x: Math.round(p.x / grid) * grid, y: Math.round(p.y / grid) * grid }));
    dispatch({ type: "SET_POINTS", points: snapped });
    dispatch({ type: "PUSH_HISTORY" });
    dispatch({ type: "SET_MESSAGE", value: "已吸附到网格" });
    logEvent("alignToGrid", { grid });
  }, [state.points, logEvent]);

  // Undo/Redo/Reset
  const onUndo = useCallback(() => { dispatch({ type: "UNDO" }); logEvent("undo"); }, [logEvent]);
  const onRedo = useCallback(() => { dispatch({ type: "REDO" }); logEvent("redo"); }, [logEvent]);
  const onReset = useCallback(() => { dispatch({ type: "RESET" }); logEvent("reset"); }, [logEvent]);

  // Copy LaTeX & Speak
  const onCopyLaTeX = useCallback(async () => {
    const latex = `\\text{Area}_{triangle} = \\frac{1}{2} \\times ${baseLength.toFixed(2)} \\times ${height.toFixed(2)} = ${area.toFixed(2)}`;
    try { await navigator.clipboard.writeText(latex); dispatch({ type: "SET_MESSAGE", value: "LaTeX 已复制" }); } catch { dispatch({ type: "SET_MESSAGE", value: "复制失败" }); }
    logEvent("copyLaTeX");
  }, [baseLength, height, area, logEvent]);

  const onSpeak = useCallback(() => {
    const s = new SpeechSynthesisUtterance(`当前三角形的底为 ${baseLength.toFixed(2)}，高为 ${height.toFixed(2)}，面积为 ${area.toFixed(2)} 平方单位。`);
    window.speechSynthesis.speak(s);
    logEvent("speak");
  }, [baseLength, height, area, logEvent]);

  // Animation: mirror + translate to form parallelogram
  const animRAF = useRef(null);
  const animStartTs = useRef(0);

  const startSpliceAnimation = useCallback(() => {
    if (state.anim.running) return;
    const pts = state.points.map((p) => ({ ...p }));
    dispatch({ type: "ANIM_START", startCopy: pts });
    logEvent("animStart", {});
    animStartTs.current = performance.now();

    const [i, j] = state.baseIndices;
    const k = [0, 1, 2].find((t) => t !== i && t !== j);
    const A = pts[i], B = pts[j];
    const baseVec_ = vec(A, B);
    const baseLenNow = length(baseVec_);
    const baseUnit = mul(baseVec_, 1 / (baseLenNow || 1));
    const normal = { x: -baseUnit.y, y: baseUnit.x };

    const mirrored = pts.map((p) => {
      const AP = vec(A, p);
      const along = dot(AP, baseUnit);
      const across = dot(AP, normal);
      return add(A, add(mul(baseUnit, along), mul(normal, -across)));
    });
    const translated = mirrored.map((p) => add(p, baseVec_));

    const startPts = pts;
    const endPts = translated;

    const step = (now) => {
      if (!state.anim.running && state.anim.paused === false && state.anim.progress === 0) return;
      const duration = 1200 / (state.anim.speed || 1);
      if (!animStartTs.current) animStartTs.current = now;
      let elapsed = now - animStartTs.current;
      if (state.anim.paused) {
        animStartTs.current = now - elapsed; // freeze start reference
        animRAF.current = requestAnimationFrame(step);
        return;
      }
      let t = clamp(elapsed / duration, 0, 1);
      const interp = startPts.map((p, idx) => {
        const e = endPts[idx];
        return { x: p.x + (e.x - p.x) * t, y: p.y + (e.y - p.y) * t };
      });
      dispatch({ type: "ANIM_TICK", progress: t, copy: interp });
      if (t >= 1) {
        dispatch({ type: "ANIM_END" });
        logEvent("animEnd");
      } else {
        animRAF.current = requestAnimationFrame(step);
      }
    };
    cancelAnimationFrame(animRAF.current || 0);
    animRAF.current = requestAnimationFrame(step);
  }, [state.points, state.baseIndices, state.anim.running, state.anim.speed, state.anim.paused, state.anim.progress, logEvent]);

  const onAnimPauseToggle = useCallback(() => {
    if (!state.anim.running) return;
    dispatch({ type: "ANIM_PAUSE_TOGGLE" });
    logEvent("animPauseToggle", { paused: !state.anim.paused });
  }, [state.anim.running, state.anim.paused, logEvent]);

  const onAnimSkip = useCallback(() => {
    if (!state.anim.running) return;
    cancelAnimationFrame(animRAF.current || 0);
    dispatch({ type: "ANIM_SKIP" });
    logEvent("animSkip");
  }, [state.anim.running, logEvent]);

  const setAnimSpeed = useCallback((v) => {
    dispatch({ type: "SET_ANIM_SPEED", value: v });
    logEvent("animSpeed", { speed: v });
  }, [logEvent]);

  // Hints
  const handleUseHint = useCallback((mode) => {
    dispatch({ type: "INC_HINT" });
    if (mode === "grid") {
      dispatch({ type: "SET_GRID", value: true });
      setTimeout(() => dispatch({ type: "SET_GRID", value: false }), 6000);
    }
    if (mode === "mirror") {
      startSpliceAnimation();
    }
    logEvent("hintUsed", { mode });
  }, [startSpliceAnimation, logEvent]);

  // Submit & scoring
  const onSubmitAnswer = useCallback(() => {
    const numeric = Number(state.submitValue);
    const expected = area;
    const responseUnit = state.submitUnit || state.unit;
    let msg = "";
    let score = 0;
    const hNow = height;
    if (hNow < 1e-2 || isCollinear(state.points)) {
      msg = "当前三点共线，不能形成三角形，请调整顶点后再提交。";
      dispatch({ type: "SET_MESSAGE", value: msg });
      logEvent("submit", { ok: false, reason: "colinear" });
      return;
    }
    if (responseUnit !== state.unit) {
      msg = "单位可能错误。请检查单位换算。";
    }
    const absDiff = Math.abs(numeric - expected);
    const relDiff = expected === 0 ? absDiff : absDiff / Math.abs(expected);
    if (relDiff < 0.01 || absDiff < 0.05) {
      score = 60;
      msg = (msg ? msg + "；" : "") + "正确！数值与参考一致。";
    } else if (relDiff < 0.05) {
      score = 40;
      msg = (msg ? msg + "；" : "") + "接近正确，检查单位或四舍五入。";
    } else {
      score = 0;
      msg = (msg ? msg + "；" : "") + "结果有较大差异，请检查高度与底的测量。";
    }
    const opScore = state.hintCount > 0 ? 10 : 20;
    const explainScore = 10;
    const totalScore = Math.min(100, score + opScore + explainScore);
    dispatch({ type: "SET_MESSAGE", value: `${msg} 得分：${totalScore}` });
    const record = {
      studentId: "student_001",
      taskId: "triangle_area_demo",
      time: nowISO(),
      points: state.points,
      base: baseLength,
      height,
      area: expected,
      hintsUsed: state.hintCount,
      score: totalScore,
    };
    dispatch({ type: "ADD_RECORD", record });
    logEvent("submit", { ok: true, score: totalScore });
  }, [state.submitValue, state.submitUnit, state.unit, state.points, baseLength, height, area, state.hintCount, logEvent]);

  // Export CSV/JSON
  const onExportCSV = useCallback(() => {
    if (state.records.length === 0) { alert("无记录可导出"); return; }
    const headers = ["studentId", "taskId", "time", "base", "height", "area", "hintsUsed", "score"];
    const lines = [headers.join(",")].concat(
      state.records.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","))
    );
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "records.csv"; a.click(); URL.revokeObjectURL(url);
  }, [state.records]);
  const onExportJSON = useCallback(() => {
    const payload = JSON.stringify(state.records, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "records.json"; a.click(); URL.revokeObjectURL(url);
  }, [state.records]);

  // Replay events (simple)
  const onReplayEvents = useCallback(() => {
    if (state.events.length === 0) return;
    dispatch({ type: "SET_PLAYBACK", playback: { playing: true, index: 0 } });
    const events = [...state.events];
    const original = state.points.map((p) => ({ ...p }));
    let idx = 0;
    const handle = setInterval(() => {
      const ev = events[idx];
      if (!ev) {
        clearInterval(handle);
        dispatch({ type: "SET_PLAYBACK", playback: { playing: false, index: 0 } });
        dispatch({ type: "SET_POINTS", points: original });
        return;
      }
      if (ev.type === "dragMove" && ev.payload && ev.payload.index != null && ev.payload.pos) {
        const i = ev.payload.index;
        dispatch({
          type: "SET_POINTS",
          points: state.points.map((p, k) => (k === i ? { ...p, x: p.x + (Math.random() - 0.5) * 6, y: p.y + (Math.random() - 0.5) * 6 } : p)),
        });
      }
      if (ev.type === "dragEnd" && ev.payload && ev.payload.index != null && ev.payload.pos) {
        const i = ev.payload.index;
        const pos = ev.payload.pos;
        dispatch({ type: "SET_POINTS", points: state.points.map((p, k) => (k === i ? { ...pos } : p)) });
      }
      idx++;
      dispatch({ type: "SET_PLAYBACK", playback: { index: idx } });
    }, 200);
  }, [state.events, state.points]);

  // Copy latex also used in RightPanel
  const onCopyLaTeXRight = onCopyLaTeX;
  const onSpeakRight = onSpeak;

  return (
    <div style={styles.app}>
      <header style={styles.topbar}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>教育几何练习</div>
        <div style={{ marginLeft: "auto", fontSize: 13 }}>交互 · 反馈 · 动画演示</div>
      </header>

      <main style={styles.container}>
        <aside style={styles.leftPanel}>
          <ToolBar
            activeTool={state.activeTool}
            setActiveTool={(t) => dispatch({ type: "SET_ACTIVE_TOOL", value: t })}
            onReset={onReset}
            onUndo={onUndo}
            onRedo={onRedo}
            onDemo={startSpliceAnimation}
            lockedBase={state.baseLocked}
            setLockedBase={(v) => { dispatch({ type: "SET_BASE_LOCK", value: v }); logEvent("baseLock", { locked: v }); }}
            onCopyLaTeX={onCopyLaTeX}
            onSpeak={onSpeak}
            onAlignToGrid={onAlignToGrid}
            gridOn={state.gridOn}
            setGridOn={(v) => { dispatch({ type: "SET_GRID", value: v }); logEvent("gridToggle", { on: v }); }}
            animRunning={state.anim.running}
            animPaused={state.anim.paused}
            onAnimPauseToggle={onAnimPauseToggle}
            onAnimSkip={onAnimSkip}
            animSpeed={state.anim.speed}
            setAnimSpeed={setAnimSpeed}
            onSubmitAnswer={onSubmitAnswer}
          />

          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>示例操作</div>
            <ul style={{ fontSize: 13, paddingLeft: 18 }}>
              <li>拖动顶点改变形状。</li>
              <li>按箭头键微调（Shift 加大步长）。</li>
              <li>锁定底边后，底边端点沿底边滑动。</li>
            </ul>
          </div>

          <div style={{ marginTop: 8 }}>
            <button style={styles.toolbarBtn} onClick={() => dispatch({ type: "OPEN_HINT" })}>提示</button>
            {state.hintOpen && (
              <div style={{ marginTop: 8 }}>
                <HintCard
                  onClose={() => dispatch({ type: "CLOSE_HINT" })}
                  onUseHint={handleUseHint}
                  hintCount={state.hintCount}
                />
              </div>
            )}
          </div>

          <div style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
            最近操作：{state.anim.running ? "演示中" : "空"} · 历史长度：{state.history.length} · 事件数：{state.events.length}
          </div>
        </aside>

        <section style={styles.centerPanel}>
          <GeometryCanvas
            points={state.points}
            baseIndices={state.baseIndices}
            baseLocked={state.baseLocked}
            gridOn={state.gridOn}
            onPartialDragUpdate={onPartialDragUpdate}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            selectedVertex={state.selectedVertex}
            setSelectedVertex={(i) => dispatch({ type: "SET_SELECTED_VERTEX", value: i })}
            animCopy={state.animCopy}
            showParallelogram={state.showParallelogram}
            animRunning={state.anim.running}
            messageText={state.message}
          />
        </section>

        <aside style={styles.rightPanel}>
          <RightPanel baseLen={baseLength} height={height} area={area} onCopyLaTeX={onCopyLaTeXRight} onSpeak={onSpeakRight} />

          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700 }}>教学反馈</div>
            <FeedbackPanel
              base={baseLength}
              height={height}
              area={area}
              precision={state.precision}
              setPrecision={(v) => dispatch({ type: "SET_PRECISION", value: v })}
              unit={state.unit}
              setUnit={(u) => dispatch({ type: "SET_UNIT", value: u })}
              formulaStep={state.formulaStep}
              voiceEnabled={state.voiceEnabled}
              setVoiceEnabled={(v) => dispatch({ type: "SET_VOICE", value: v })}
              message={state.message}
              submitValue={state.submitValue}
              setSubmitValue={(v) => dispatch({ type: "SET_SUBMIT_VALUE", value: v })}
              submitUnit={state.submitUnit}
              setSubmitUnit={(v) => dispatch({ type: "SET_SUBMIT_UNIT", value: v })}
              onSubmit={onSubmitAnswer}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <TeacherDashboard
              records={state.records}
              events={state.events}
              onExportCSV={onExportCSV}
              onExportJSON={onExportJSON}
              onReplayEvents={onReplayEvents}
              playbackState={state.playback}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <h4>当前数值</h4>
            <div style={{ fontSize: 13 }}>
              <div>base: {baseLength.toFixed(2)}</div>
              <div>height: {height.toFixed(2)}</div>
              <div>area: {area.toFixed(2)}</div>
            </div>
          </div>
        </aside>
      </main>

      <style>{`
        @media (max-width: 1279px) {
          main { grid-template-columns: 220px 1fr; }
          main > aside:last-child { display: none; }
        }
        @media (max-width: 767px) {
          main { grid-template-columns: 1fr; grid-auto-rows: auto; }
          main > aside:last-child { display: none; }
        }
      `}</style>
    </div>
  );
}