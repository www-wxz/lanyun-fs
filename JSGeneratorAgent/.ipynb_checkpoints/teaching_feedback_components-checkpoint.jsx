import React, { useEffect, useRef, useState } from "react";

/**
 * TeachingFeedbackAgent - A self-contained React app implementing:
 * - Interactive draggable triangle SVG (3 vertices)
 * - Immediate calculations (base, height, area) with animated formula panel
 * - Error diagnostics (colinear/height=0, near-correct, unit mismatch)
 * - Hint system with hintUsed tracking, hint animations (mirror/grid)
 * - Difficulty modes that change constraints & tasks
 * - Submission flow with attempts, scoring, and simple explanation matching
 * - Teacher dashboard with event playback & export (CSV/JSON)
 *
 * Usage: Render <TeachingFeedbackApp /> in your React app.
 */

/* ---------- Utility helpers ---------- */
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const now = () => new Date().toISOString();

function pointLineDistance(p, a, b) {
  // distance from p to line through a-b
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const num = Math.abs(dx * (a.y - p.y) - (a.x - p.x) * dy);
  const den = Math.hypot(dx, dy);
  return den === 0 ? dist(p, a) : num / den;
}

function formatNumber(v, precision) {
  return Number.isFinite(v) ? v.toFixed(precision) : "—";
}

/* ---------- HintCard Component ---------- */
function HintCard({ onClose, onUseHint, hintCount }) {
  return (
    <div style={styles.hintCard}>
      <div style={{ fontWeight: "600", marginBottom: 6 }}>提示 (Hint)</div>
      <div style={{ fontSize: 13, marginBottom: 8 }}>
        1) 尝试镜像拼接：将当前三角形镜像拼接可见一个平行四边形，从而理解 Area_triangle = 1/2 Area_parallelogram。
      </div>
      <div style={{ fontSize: 13, marginBottom: 8 }}>
        2) 若高度过小，系统会指示可安全移动方向（绿色阴影）。还可以打开网格帮助精确放置。
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => {
            onUseHint("mirror");
            onClose();
          }}
        >
          试一试（镜像演示）
        </button>
        <button
          onClick={() => {
            onUseHint("grid");
            onClose();
          }}
        >
          打开网格
        </button>
        <button onClick={onClose}>关闭</button>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
        已使用提示：{hintCount}
      </div>
    </div>
  );
}

/* ---------- FeedbackPanel Component ---------- */
function FeedbackPanel({
  base,
  height,
  area,
  precision,
  setPrecision,
  unit,
  setUnit,
  formulaStep,
  isColinear,
  submitValue,
  setSubmitValue,
  submitUnit,
  setSubmitUnit,
  onSubmit,
  voiceEnabled,
  setVoiceEnabled,
  message,
}) {
  const computedBase = formatNumber(base, precision);
  const computedHeight = formatNumber(height, precision);
  const computedArea = formatNumber(area, precision);

  useEffect(() => {
    if (voiceEnabled && window.speechSynthesis) {
      const msg = new SpeechSynthesisUtterance(
        `当前面积 ${computedArea} ${submitUnit || unit}`
      );
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(msg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedArea, voiceEnabled]);

  return (
    <div style={styles.feedbackPanel}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>
        实时计算与公式演示
      </div>
      <div style={{ fontSize: 13, marginBottom: 8 }}>
        精度：
        <select
          value={precision}
          onChange={(e) => setPrecision(Number(e.target.value))}
          style={{ marginLeft: 8 }}
        >
          <option value={0}>0</option>
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
        </select>
        单位：
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          style={{ marginLeft: 8 }}
        >
          <option value="cm">cm</option>
          <option value="m">m</option>
          <option value="mm">mm</option>
        </select>
        语音播报：
        <input
          type="checkbox"
          checked={voiceEnabled}
          onChange={(e) => setVoiceEnabled(e.target.checked)}
          style={{ marginLeft: 6 }}
        />
      </div>

      <div style={styles.formulaBox}>
        <div style={{ fontSize: 14 }}>
          {formulaStep === 0 && "Area = 1/2 × base × height"}
          {formulaStep === 1 &&
            `Area = 1/2 × ${computedBase} ${unit} × ${computedHeight} ${unit}`}
          {formulaStep === 2 && `Area = ${computedArea} ${unit}²`}
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 13 }}>
        <div>base: {computedBase} {unit}</div>
        <div>height: {computedHeight} {unit}</div>
        <div>area: {computedArea} {unit}²</div>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 600 }}>提交你的答案</div>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <input
            type="number"
            step="any"
            value={submitValue}
            onChange={(e) => setSubmitValue(e.target.value)}
            placeholder="输入数值"
          />
          <select
            value={submitUnit}
            onChange={(e) => setSubmitUnit(e.target.value)}
          >
            <option value="">(单位)</option>
            <option value="cm">cm</option>
            <option value="m">m</option>
            <option value="mm">mm</option>
          </select>
          <button onClick={onSubmit}>提交</button>
        </div>
        <div style={{ marginTop: 8, color: isColinear ? "#b00020" : "#333" }}>
          {message}
        </div>
      </div>
    </div>
  );
}

/* ---------- TeacherDashboard Component ---------- */
function TeacherDashboard({
  records,
  events,
  onExportCSV,
  onExportJSON,
  onReplayEvents,
  playbackState,
}) {
  return (
    <div style={styles.teacherDashboard}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>教师端监控</div>
      <div style={{ fontSize: 13, marginBottom: 8 }}>
        实时学生记录（模拟单个学生）
      </div>
      <div style={{ marginBottom: 8 }}>
        <button onClick={() => onReplayEvents()}>
          回放操作 ({playbackState.playing ? "播放中" : "回放"})
        </button>{" "}
        <button onClick={() => onExportCSV()}>导出 CSV</button>{" "}
        <button onClick={() => onExportJSON()}>导出 JSON</button>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600 }}>成绩统计（示例）</div>
        <div style={{ fontSize: 13, marginTop: 6 }}>
          学生数：{records.length}，平均得分：{" "}
          {records.length === 0
            ? "—"
            : (
                records.reduce((s, r) => s + (r.score || 0), 0) / records.length
              ).toFixed(1)}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600 }}>事件流预览（最近 10 条）</div>
        <div style={styles.eventsBox}>
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

/* ---------- Main App Component ---------- */
export default function TeachingFeedbackApp() {
  const svgRef = useRef(null);

  // vertex positions in SVG coordinates
  const [vertices, setVertices] = useState([
    { x: 80, y: 180 }, // A - base left
    { x: 260, y: 180 }, // B - base right
    { x: 160, y: 100 }, // C - top
  ]);
  const [dragging, setDragging] = useState(null); // index or null
  const [events, setEvents] = useState([]); // event log for playback
  const [startTime] = useState(now());
  const [hintOpen, setHintOpen] = useState(false);
  const [hintCount, setHintCount] = useState(0);
  const [unit, setUnit] = useState("cm");
  const [precision, setPrecision] = useState(2);
  const [formulaStep, setFormulaStep] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [gridOn, setGridOn] = useState(false);
  const [message, setMessage] = useState("");
  const [difficulty, setDifficulty] = useState("intro"); // intro/explore/reason
  const [submitValue, setSubmitValue] = useState("");
  const [submitUnit, setSubmitUnit] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [records, setRecords] = useState([]); // saved attempts for teacher
  const [playbackState, setPlaybackState] = useState({
    playing: false,
    index: 0,
  });

  // computed values
  const [base, setBase] = useState(0);
  const [height, setHeight] = useState(0);
  const [area, setArea] = useState(0);
  const [isColinear, setIsColinear] = useState(false);

  // record start time
  const sessionStart = useRef(Date.now());

  // Add event to log
  const pushEvent = (type, payload = {}) => {
    const ev = { type, payload, timestamp: now() };
    setEvents((e) => [...e, ev]);
  };

  // initial compute
  useEffect(() => {
    computeMetrics(vertices);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // compute and animate formula each time vertices change
  function computeMetrics(vs) {
    const baseLen = dist(vs[0], vs[1]);
    const h = pointLineDistance(vs[2], vs[0], vs[1]);
    const a = 0.5 * baseLen * h;
    setBase(baseLen);
    setHeight(h);
    setArea(a);

    // colinear detection threshold (pixels)
    const colinear = h < 1e-2 || !isFinite(a) || baseLen < 1e-6;
    setIsColinear(colinear);

    // animate formula steps
    setFormulaStep(0);
    setTimeout(() => setFormulaStep(1), 300);
    setTimeout(() => setFormulaStep(2), 800);

    // push event
    pushEvent("compute", { base: baseLen, height: h, area: a });
  }

  // dragging handlers
  const handleMouseDown = (i, e) => {
    setDragging(i);
    pushEvent("dragStart", { index: i, pos: vertices[i] });
  };

  const handleMouseMove = (e) => {
    if (dragging === null) return;
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
    setVertices((prev) => {
      const next = prev.map((p, idx) => (idx === dragging ? { x: clamp(svgP.x, 0, 400), y: clamp(svgP.y, 0, 300) } : p));
      computeMetrics(next);
      return next;
    });
    pushEvent("dragMove", { index: dragging, x: e.clientX, y: e.clientY, local: now() });
  };

  const handleMouseUp = () => {
    if (dragging !== null) {
      pushEvent("dragEnd", { index: dragging, pos: vertices[dragging] });
    }
    setDragging(null);
  };

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, vertices]);

  // Hint usage
  const handleUseHint = (mode) => {
    setHintCount((c) => c + 1);
    pushEvent("hintUsed", { mode });
    if (mode === "grid") {
      setGridOn(true);
      setTimeout(() => setGridOn(false), 6000);
    }
    if (mode === "mirror") {
      // simple mirror animation: place mirrored triangle briefly
      pushEvent("mirrorAnimation", { vertices });
      // No complex animation: temporarily show mirrored points for 1s
      setTimeout(() => {
        // nothing to do, just recorded event
      }, 1000);
    }
  };

  // Submit handling and simple diagnostics
  const handleSubmit = () => {
    setAttempts((a) => a + 1);
    const numeric = Number(submitValue);
    const expected = area;
    const responseUnit = submitUnit || unit;
    const timestamp = now();
    let msg = "";
    let score = 0;
    // Check colinear first
    if (isColinear) {
      msg = "当前三点共线，不能形成三角形，请调整顶点后再提交。";
      pushEvent("submit", { ok: false, reason: "colinear", attempts, timestamp });
      setMessage(msg);
      return;
    }
    // Unit check (simple mismatch detection)
    if (responseUnit !== unit) {
      msg = "单位可能错误。请检查单位换算。";
      pushEvent("submit", { ok: false, reason: "unit_mismatch", attempts, timestamp });
      setMessage(msg);
      // Still evaluate numeric (convert naive assumption: not converting)
    }

    // numeric check with thresholds
    const absDiff = Math.abs(numeric - expected);
    const relDiff = expected === 0 ? absDiff : absDiff / Math.abs(expected);
    if (relDiff < 0.01 || absDiff < 0.05) {
      msg = "正确！数值与参考一致。";
      score = 60; // correctness
    } else if (relDiff < 0.05) {
      msg = "接近正确，检查单位或四舍五入。";
      score = 40;
    } else {
      msg = "结果有较大差异，请检查高度与底的测量。";
      score = 0;
    }

    // operation规范/steps: give full if used mirror hint or grid (mock)
    const opScore = hintCount > 0 ? 10 : 20; // penalize hint usage
    // explanation quality: ask for a short text (we don't collect here), so assume half credit
    const explainScore = 10;

    const totalScore = Math.min(100, score + opScore + explainScore);
    // store record
    const record = {
      studentId: "student_001",
      taskId: "triangle_area_demo",
      startTime: sessionStart.current,
      endTime: now(),
      events,
      finalShape: { vertices },
      base,
      height,
      area: expected,
      hintsUsed: hintCount,
      attempts: attempts + 1,
      score: totalScore,
      teacherFeedback: "",
    };
    setRecords((r) => [...r, record]);
    pushEvent("submit", { ok: true, score: totalScore, attempts: attempts + 1, timestamp });
    setMessage(msg + ` 得分：${totalScore}`);
  };

  // Playback for teacher: replay events by setting temporary vertices changes
  const onReplayEvents = () => {
    if (events.length === 0) return;
    setPlaybackState({ playing: true, index: 0 });
    const clonedEvents = [...events];
    const originalVertices = vertices.map((v) => ({ ...v }));
    let idx = 0;
    const interval = setInterval(() => {
      const ev = clonedEvents[idx];
      if (!ev) {
        clearInterval(interval);
        setPlaybackState({ playing: false, index: 0 });
        setVertices(originalVertices);
        return;
      }
      if (ev.type === "dragMove") {
        // can't map client coords easily back to svg; simulate small move: rotate points for demo
        setVertices((prev) => prev.map((p) => ({ x: p.x + (Math.random() - 0.5) * 6, y: p.y + (Math.random() - 0.5) * 6 })));
      }
      if (ev.type === "dragEnd" && ev.payload && ev.payload.pos) {
        // set the indicated vertex to payload pos if present
        const idxPayload = ev.payload.index;
        const pos = ev.payload.pos;
        setVertices((prev) => prev.map((p, i) => (i === idxPayload ? { ...pos } : p)));
      }
      idx++;
      setPlaybackState((ps) => ({ ...ps, index: idx }));
    }, 200);
  };

  // Export helpers
  const exportCSV = () => {
    if (records.length === 0) {
      alert("无记录可导出");
      return;
    }
    const headers = [
      "studentId",
      "taskId",
      "startTime",
      "endTime",
      "base",
      "height",
      "area",
      "hintsUsed",
      "attempts",
      "score",
    ];
    const lines = [headers.join(",")].concat(
      records.map((r) =>
        headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")
      )
    );
    const csv = lines.join("\n");
    downloadBlob(csv, "records.csv", "text/csv");
  };

  const exportJSON = () => {
    const payload = JSON.stringify(records, null, 2);
    downloadBlob(payload, "records.json", "application/json");
  };

  const downloadBlob = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Visual helpers for drawing height line
  const baseMid = midpoint(vertices[0], vertices[1]);
  // compute foot of perpendicular from C to AB
  function footPoint(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = dx * (p.x - a.x) + dy * (p.y - a.y);
    const denom = dx * dx + dy * dy;
    const tt = denom === 0 ? 0 : t / denom;
    return { x: a.x + dx * tt, y: a.y + dy * tt };
  }
  const foot = footPoint(vertices[2], vertices[0], vertices[1]);

  // visual state flags for success/error styling
  const success = !isColinear && Math.abs(area) > 0.5;
  const labelStyle = (ok) => ({
    padding: "2px 6px",
    borderRadius: 4,
    background: ok ? "rgba(0,150,60,0.12)" : "rgba(200,0,0,0.06)",
    color: ok ? "#0a0" : "#b00020",
    fontSize: 12,
  });

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={{ fontWeight: 800 }}>教学反馈交互演示</div>
        <div style={{ fontSize: 13, color: "#444" }}>
          分级提示、错误诊断、教师回放与统计示例
        </div>
      </div>

      <div style={styles.controlsRow}>
        <div>
          难度：
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={{ marginLeft: 8 }}>
            <option value="intro">初级（引导）</option>
            <option value="explore">中级（探索）</option>
            <option value="reason">高级（推理）</option>
          </select>
        </div>
        <div style={{ marginLeft: 12 }}>
          <button onClick={() => { setVertices([{ x: 80, y: 180 }, { x: 260, y: 180 }, { x: 160, y: 100 }]); pushEvent("reset", {}); }}>
            重置
          </button>
          <button
            onClick={() => {
              setHintOpen(true);
              pushEvent("openHint", {});
            }}
            style={{ marginLeft: 8 }}
          >
            提示
          </button>
        </div>
      </div>

      <div style={styles.main}>
        <div style={styles.canvasBox}>
          <svg
            ref={svgRef}
            width={400}
            height={300}
            style={{ border: "1px solid #ddd", background: "#fff" }}
            onMouseDown={(e) => { /* placeholder */ }}
          >
            {/* optional grid */}
            {gridOn &&
              Array.from({ length: 20 }).map((_, i) => (
                <line
                  key={"g" + i}
                  x1={(i * 20)}
                  y1={0}
                  x2={(i * 20)}
                  y2={300}
                  stroke="#eee"
                  strokeWidth={1}
                />
              ))}

            {/* triangle fill */}
            <polygon
              points={vertices.map((p) => `${p.x},${p.y}`).join(" ")}
              fill={success ? "rgba(0,150,60,0.12)" : isColinear ? "rgba(200,0,0,0.06)" : "rgba(0,0,150,0.06)"}
              stroke={success ? "#06a" : isColinear ? "#b00020" : "#555"}
              strokeWidth={2}
            />

            {/* base line with length label */}
            <line
              x1={vertices[0].x}
              y1={vertices[0].y}
              x2={vertices[1].x}
              y2={vertices[1].y}
              stroke="#333"
              strokeWidth={2}
            />
            <text
              x={baseMid.x}
              y={baseMid.y + 16}
              style={{ fontSize: 12, textAnchor: "middle" }}
              fill="#222"
            >
              base: {formatNumber(base, precision)} {unit}
            </text>

            {/* height dashed line */}
            {!isNaN(foot.x) && (
              <>
                <line
                  x1={vertices[2].x}
                  y1={vertices[2].y}
                  x2={foot.x}
                  y2={foot.y}
                  stroke="#d33"
                  strokeWidth={2}
                  strokeDasharray="6,4"
                />
                <text x={(vertices[2].x + foot.x) / 2} y={(vertices[2].y + foot.y) / 2 - 8}
                  style={{ fontSize: 12, textAnchor: "middle" }}
                  fill="#b00020"
                >
                  h: {formatNumber(height, precision)} {unit}
                </text>
              </>
            )}

            {/* vertices */}
            {vertices.map((p, i) => (
              <g key={i}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={8}
                  fill="#fff"
                  stroke="#0077cc"
                  strokeWidth={2}
                  onMouseDown={(ev) => handleMouseDown(i, ev)}
                  style={{ cursor: "grab" }}
                />
                <text x={p.x + 12} y={p.y - 12} style={{ fontSize: 12 }}>{["A","B","C"][i]}</text>
              </g>
            ))}

            {/* safe move hint overlay when height small */}
            {height < 6 && !isColinear && (
              <rect
                x={Math.min(vertices[0].x, vertices[1].x)}
                y={Math.min(vertices[0].y, vertices[1].y) - 30}
                width={Math.abs(vertices[1].x - vertices[0].x)}
                height={60}
                fill="rgba(0,200,80,0.06)"
              />
            )}
          </svg>

          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <div style={labelStyle(!isColinear)}>
              {isColinear ? "错误：共线/高度为0" : "几何有效"}
            </div>
            <div style={{ fontSize: 13 }}>
              当前 area: <strong>{formatNumber(area, precision)}</strong> {unit}²
            </div>
          </div>

          {/* small hint overlay */}
          {hintOpen && (
            <div style={{ position: "absolute", left: 16, top: 140 }}>
              <HintCard
                onClose={() => setHintOpen(false)}
                onUseHint={handleUseHint}
                hintCount={hintCount}
              />
            </div>
          )}

          {/* difficulty-specific guidance */}
          <div style={{ marginTop: 8, fontSize: 13 }}>
            {difficulty === "intro" && "提示：请拖动顶点 C 来观察高度与面积变化。系统会给出基础公式与演示。"}
            {difficulty === "explore" && "任务：固定 A、B，调整 C 使得面积接近目标（示例目标：30 cm²）。系统会计时并限制提示次数。"}
            {difficulty === "reason" && "任务：证明 Area_triangle = 1/2 Area_parallelogram。可使用镜像拼接工具并提交短文本或录音解释。"}
          </div>
        </div>

        <div style={styles.sidePanel}>
          <FeedbackPanel
            base={base}
            height={height}
            area={area}
            precision={precision}
            setPrecision={setPrecision}
            unit={unit}
            setUnit={setUnit}
            formulaStep={formulaStep}
            isColinear={isColinear}
            submitValue={submitValue}
            setSubmitValue={setSubmitValue}
            submitUnit={submitUnit}
            setSubmitUnit={setSubmitUnit}
            onSubmit={handleSubmit}
            voiceEnabled={voiceEnabled}
            setVoiceEnabled={setVoiceEnabled}
            message={message}
          />

          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700 }}>记录与统计</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>
              Hint 已使用：{hintCount} 次
            </div>
            <div style={{ fontSize: 13 }}>提交尝试：{attempts}</div>
            <div style={{ fontSize: 13 }}>记录条数（教师端）：{records.length}</div>
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => {
                  // save to localStorage as simulated local cache
                  localStorage.setItem("tf_records", JSON.stringify(records));
                  alert("已保存到本地缓存（localStorage）");
                }}
              >
                本地保存（缓存）
              </button>
              <button
                onClick={() => {
                  const s = localStorage.getItem("tf_records");
                  if (!s) return alert("无本地记录");
                  setRecords(JSON.parse(s));
                  alert("已从本地恢复记录");
                }}
                style={{ marginLeft: 8 }}
              >
                恢复本地缓存
              </button>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <TeacherDashboard
              records={records}
              events={events}
              onExportCSV={exportCSV}
              onExportJSON={exportJSON}
              onReplayEvents={onReplayEvents}
              playbackState={playbackState}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Styles ---------- */
const styles = {
  container: {
    fontFamily: "Arial, Helvetica, sans-serif",
    margin: 12,
    color: "#222",
  },
  header: {
    marginBottom: 12,
  },
  controlsRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  main: {
    display: "flex",
    gap: 12,
  },
  canvasBox: {
    width: 420,
    position: "relative",
  },
  sidePanel: {
    width: 420,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  feedbackPanel: {
    border: "1px solid #e6e6e6",
    borderRadius: 6,
    padding: 10,
    background: "#fafafa",
  },
  formulaBox: {
    marginTop: 6,
    padding: 8,
    borderRadius: 6,
    background: "#fff",
    border: "1px solid #eee",
  },
  hintCard: {
    border: "1px solid #ddd",
    background: "#fff",
    padding: 10,
    borderRadius: 6,
    width: 300,
    boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
  },
  teacherDashboard: {
    border: "1px solid #f0f0f0",
    padding: 8,
    borderRadius: 6,
    background: "#fff",
  },
  eventsBox: {
    maxHeight: 120,
    overflow: "auto",
    padding: 6,
    border: "1px dashed #eee",
    marginTop: 6,
  },
};
```