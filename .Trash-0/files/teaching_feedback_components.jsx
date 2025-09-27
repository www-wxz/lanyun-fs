```jsx
/**
 * TeachingFeedbackAgent - self-contained React component set
 * Includes: FeedbackPanel, HintCard, TeacherDashboard and main TeachingFeedbackApp
 *
 * Paste into a React project (e.g., create-react-app) as a single file component.
 * No external dependencies.
 */

import React, { useEffect, useRef, useState } from "react";

/* ---------- Helper utilities ---------- */
const distance = (a, b) =>
  Math.hypot((a.x - b.x) || 0, (a.y - b.y) || 0);

const triangleAreaByCoords = (a, b, c) =>
  Math.abs(
    (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)) / 2
  );

const timestamp = () => new Date().toISOString();

const downloadBlob = (content, filename, mime = "text/plain") => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/* ---------- HintCard Component ---------- */
function HintCard({ hint, onUse, depth = "light", disabled }) {
  const handleTry = () => {
    if (onUse) onUse(hint);
  };
  return (
    <div style={{
      border: "1px solid #ccc",
      borderRadius: 8,
      padding: 12,
      background: "#fffbe6",
      marginBottom: 8
    }}>
      <div style={{ fontWeight: "600", marginBottom: 6 }}>
        Hint ({depth})
      </div>
      <div style={{ fontSize: 14, marginBottom: 8 }}>{hint}</div>
      <button onClick={handleTry} disabled={disabled}>
        试一试
      </button>
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
  formulaAnimStep,
  formulaSteps,
  showVoice,
  playVoice,
  diagnostics,
  onSubmitAttempt,
  userInput,
  setUserInput,
  explanation,
  setExplanation,
  submitDisabled,
  lastFeedback
}) {
  return (
    <div style={{ padding: 12, width: 360, boxSizing: "border-box" }}>
      <h3>即时反馈与公式演示</h3>

      <div style={{ marginBottom: 8 }}>
        <label>
          精度:
          <select
            value={precision}
            onChange={(e) => setPrecision(Number(e.target.value))}
            style={{ marginLeft: 8 }}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </label>
        <label style={{ marginLeft: 12 }}>
          单位:
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            style={{ width: 60, marginLeft: 6 }}
          />
        </label>
        <label style={{ marginLeft: 12 }}>
          语音:
          <input
            type="checkbox"
            checked={showVoice}
            onChange={(e) => playVoice(e.target.checked)}
            style={{ marginLeft: 6 }}
          />
        </label>
      </div>

      <div style={{
        border: "1px solid #e0e0e0",
        borderRadius: 8,
        padding: 10,
        background: "#fafafa",
        minHeight: 120
      }}>
        <div style={{ fontSize: 14, color: "#666" }}>公式代入（逐步）：</div>
        <div style={{ marginTop: 8, fontSize: 18, height: 48 }}>
          {formulaSteps && formulaSteps.length > 0 ? (
            <div key={formulaAnimStep} style={{
              transition: "opacity 0.3s",
              opacity: 1
            }}>
              {formulaSteps[formulaAnimStep]}
            </div>
          ) : (
            <div>等待顶点变化以显示代入过程...</div>
          )}
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: "#444" }}>
          当前值： base = {base.toFixed(precision)} {unit}, height = {height.toFixed(precision)} {unit}
          ，Area ≈ {area.toFixed(precision)} {unit}²
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 600 }}>诊断</div>
        <div style={{ minHeight: 46 }}>
          {diagnostics.map((d, i) => (
            <div key={i} style={{ color: d.type === "error" ? "#b00020" : "#2b6f2b" }}>
              {d.message}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <div style={{ fontWeight: 600 }}>提交你的结果</div>
        <div style={{ display: "flex", alignItems: "center", marginTop: 6 }}>
          <input
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="填写数值"
            style={{ width: 120, marginRight: 8 }}
          />
          <select value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option>cm</option>
            <option>m</option>
            <option>unit</option>
          </select>
          <div style={{ marginLeft: 8, color: "#666", fontSize: 13 }}>
            （自动显示平方）
          </div>
        </div>
        <textarea
          placeholder="简短解释或录音说明链接"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          style={{ width: "100%", height: 60, marginTop: 8 }}
        />
        <div style={{ marginTop: 8 }}>
          <button onClick={onSubmitAttempt} disabled={submitDisabled}>
            提交答案
          </button>
          {showVoice && (
            <button style={{ marginLeft: 8 }} onClick={() => {
              const synth = window.speechSynthesis;
              if (synth) {
                const msg = new SpeechSynthesisUtterance(`当前三角形面积约等于 ${area.toFixed(precision)} ${unit} 平方单位`);
                synth.speak(msg);
              }
            }}>
              朗读
            </button>
          )}
        </div>

        <div style={{ marginTop: 10, fontSize: 13 }}>
          上次反馈： <span style={{ fontWeight: 700 }}>{lastFeedback || "无"}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- TeacherDashboard Component ---------- */
function TeacherDashboard({
  records,
  events,
  onReplayEvents,
  onExportJSON,
  onExportCSV
}) {
  return (
    <div style={{
      padding: 12,
      borderLeft: "1px dashed #ddd",
      minWidth: 300,
      boxSizing: "border-box"
    }}>
      <h3>教师监控与回放</h3>
      <div style={{ marginBottom: 8 }}>
        <button onClick={() => onExportJSON()}>导出 JSON</button>
        <button onClick={() => onExportCSV()} style={{ marginLeft: 8 }}>导出 CSV</button>
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 600 }}>学生记录（最新 10 条）</div>
        <div style={{
          maxHeight: 160,
          overflow: "auto",
          border: "1px solid #eee",
          padding: 8,
          borderRadius: 6,
          background: "#fff"
        }}>
          {records.length === 0 && <div style={{ color: "#888" }}>暂无记录</div>}
          {records.slice().reverse().slice(0, 10).map((r, idx) => (
            <div key={idx} style={{ marginBottom: 8 }}>
              <div><b>{r.studentId}</b> - {r.taskId}</div>
              <div style={{ fontSize: 12, color: "#555" }}>
                {new Date(r.startTime).toLocaleString()} → {new Date(r.endTime).toLocaleString()}
              </div>
              <div style={{ fontSize: 12, color: "#333" }}>
                score: {r.score?.toFixed(1) ?? "-"} | attempts: {r.attempts} | hints: {r.hintsUsed}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 600 }}>操作日志回放</div>
        <div style={{
          maxHeight: 220,
          overflow: "auto",
          border: "1px solid #eee",
          padding: 8,
          borderRadius: 6,
          background: "#fff",
          marginTop: 6
        }}>
          {events.length === 0 && <div style={{ color: "#888" }}>暂无事件</div>}
          {events.map((ev, idx) => (
            <div key={idx} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 13 }}>
                [{new Date(ev.timestamp).toLocaleTimeString()}] <b>{ev.type}</b>
              </div>
              <div style={{ fontSize: 12, color: "#444" }}>{JSON.stringify(ev.payload)}</div>
              <div>
                <button onClick={() => onReplayEvents(events.slice(0, idx + 1))}>回放到此</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Main App Component ---------- */
export default function TeachingFeedbackApp() {
  const svgW = 600, svgH = 360;
  // initial triangle
  const [vertices, setVertices] = useState([
    { x: 120, y: 260 },
    { x: 420, y: 260 },
    { x: 260, y: 120 }
  ]);
  const [dragIndex, setDragIndex] = useState(null);
  const dragRef = useRef(null);

  const [precision, setPrecision] = useState(2);
  const [unit, setUnit] = useState("cm");
  const [showVoice, setShowVoice] = useState(false);

  // animation of formula steps
  const [formulaSteps, setFormulaSteps] = useState([]);
  const [formulaAnimStep, setFormulaAnimStep] = useState(0);

  // diagnostics messages
  const [diagnostics, setDiagnostics] = useState([]);

  // hints and difficulty
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintLimit, setHintLimit] = useState(3);
  const [hintDisabled, setHintDisabled] = useState(false);
  const [difficulty, setDifficulty] = useState("初级"); // 初级/中级/高级

  // events log for replay
  const [events, setEvents] = useState(() => {
    const loaded = localStorage.getItem("tf_events_v1");
    return loaded ? JSON.parse(loaded) : [];
  });

  // student record storage
  const [records, setRecords] = useState(() => {
    const loaded = localStorage.getItem("tf_records_v1");
    return loaded ? JSON.parse(loaded) : [];
  });

  // user submission
  const [userInput, setUserInput] = useState("");
  const [explanation, setExplanation] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [lastFeedback, setLastFeedback] = useState("");

  // scoring parameters
  const correctnessWeight = 0.6, operationWeight = 0.2, explanationWeight = 0.2;

  // for mid-level challenge
  const [targetArea, setTargetArea] = useState(null);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef(null);

  // compute base/height/area
  const base = distance(vertices[0], vertices[1]);
  const area = triangleAreaByCoords(vertices[0], vertices[1], vertices[2]);
  const height = base > 0 ? (area * 2) / base : 0;

  // diagnostics update whenever vertices change
  useEffect(() => {
    const diags = [];
    // collinear check
    if (area < 1e-6) {
      diags.push({
        type: "error",
        message: "当前三点共线，不能形成三角形，试试拖动任一顶点使其远离底边"
      });
    } else if (height < 3) {
      diags.push({
        type: "warning",
        message: "高度较小，可能是操作误差，尝试移动顶点获得更明显高度"
      });
    } else {
      diags.push({ type: "info", message: "三角形正常" });
    }
    setDiagnostics(diags);

    // prepare formula steps and animate
    const s1 = `Area = 1/2 × base × height`;
    const s2 = `Area = 1/2 × ${base.toFixed(precision)} ${unit} × ${height.toFixed(precision)} ${unit}`;
    const s3 = `Area = ${area.toFixed(precision)} ${unit}²`;
    const steps = [s1, s2, s3];
    setFormulaSteps(steps);
    setFormulaAnimStep(0);

    // animate step progression
    let idx = 0;
    const interval = setInterval(() => {
      idx += 1;
      if (idx >= steps.length) {
        clearInterval(interval);
        return;
      }
      setFormulaAnimStep(idx);
    }, 600);
    return () => clearInterval(interval);
  }, [vertices, precision, unit, area, base, height]);

  // persist events
  useEffect(() => {
    localStorage.setItem("tf_events_v1", JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem("tf_records_v1", JSON.stringify(records));
  }, [records]);

  // dragging handlers
  useEffect(() => {
    const onMove = (e) => {
      if (dragRef.current == null) return;
      const idx = dragRef.current.index;
      const coords = dragRef.current.fromClient ? { x: e.clientX, y: e.clientY } : null;
      const svgRect = svgRef.current.getBoundingClientRect();
      const x = (e.clientX - svgRect.left);
      const y = (e.clientY - svgRect.top);
      if (idx != null) {
        setVertices((prev) => {
          const next = prev.map((p) => ({ ...p }));
          next[idx] = { x: Math.max(10, Math.min(svgW - 10, x)), y: Math.max(10, Math.min(svgH - 10, y)) };
          return next;
        });
        pushEvent("drag", { index: idx, pos: { x, y } });
      }
    };
    const onUp = () => {
      if (dragRef.current != null) {
        pushEvent("dragEnd", { index: dragRef.current.index, pos: vertices[dragRef.current.index] });
      }
      dragRef.current = null;
      setDragIndex(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [vertices]);

  const svgRef = useRef(null);

  function pushEvent(type, payload) {
    const ev = { type, payload, timestamp: timestamp() };
    setEvents((prev) => [...prev, ev]);
  }

  // start dragging
  const onHandleDown = (idx, e) => {
    e.preventDefault();
    setDragIndex(idx);
    dragRef.current = { index: idx, fromClient: true };
    pushEvent("dragStart", { index: idx, pos: vertices[idx] });
  };

  // hint usage
  const handleUseHint = (hintText) => {
    if (hintDisabled) return;
    setHintsUsed((h) => h + 1);
    pushEvent("hint", { hint: hintText, depth: "step" });
    // perform small automatic hint action: show mirrored triangle animation (simulate)
    setHintDisabled(true);
    setTimeout(() => setHintDisabled(false), 1200);
  };

  // voice toggle action
  const playVoice = (val) => {
    setShowVoice(val);
  };

  // submit attempt logic
  const onSubmitAttempt = () => {
    const parsed = parseFloat(userInput);
    setAttempts((a) => a + 1);
    pushEvent("submit", { userInput, explanation, parsed });
    setLastFeedback("正在评估...");
    // scoring logic with simple heuristics and diagnostics
    const toleranceAbs = Math.max(0.5 * Math.pow(10, -precision), Math.abs(area) * 0.02); // either small absolute or 2%
    let correctnessScore = 0;
    let opScore = 0;
    let explScore = 0;
    let feedbackMsg = "";
    if (isNaN(parsed)) {
      feedbackMsg = "提交的数值无法识别，请输入数字。";
      setLastFeedback(feedbackMsg);
      return;
    }
    const diff = Math.abs(parsed - area);
    if (diff <= toleranceAbs) {
      correctnessScore = 1.0;
      feedbackMsg = "正确！数值在允许精度范围内。";
    } else if (Math.abs(parsed - base * height) <= Math.max(1e-6, Math.abs(base * height) * 0.02)) {
      // concept error: used base*height instead of 1/2
      correctnessScore = 0;
      feedbackMsg = "概念错误：看起来你使用了 base × height，注意公式应为 1/2 × base × height。";
      pushEvent("diagnosis", { type: "concept", message: "used base*height" });
    } else if (diff <= toleranceAbs * 4) {
      // operation error (close)
      correctnessScore = 0.6;
      feedbackMsg = "接近正确，检查单位或四舍五入设置。";
      pushEvent("diagnosis", { type: "operation", message: "close but not exact" });
    } else {
      correctnessScore = 0;
      feedbackMsg = "数值明显错误，请检查步骤。";
      pushEvent("diagnosis", { type: "geometry", message: "incorrect value" });
    }

    // operation score: did student use steps? heuristic: attempts and hints influence
    if (attempts <= 1 && hintsUsed === 0) opScore = 1.0;
    else if (hintsUsed > 0 && attempts <= 3) opScore = 0.8;
    else opScore = 0.5;

    // explanation score: length or keywords
    const expl = (explanation || "").toLowerCase();
    const keywords = ["base", "height", "1/2", "半", "面积", "拼接"];
    const kwMatch = keywords.some(k => expl.includes(k));
    if (expl.length > 20 && kwMatch) explScore = 1.0;
    else if (expl.length > 10) explScore = 0.6;
    else explScore = 0.2;

    const finalScore = correctnessScore * correctnessWeight +
      opScore * operationWeight +
      explScore * explanationWeight;

    setLastFeedback(feedbackMsg + ` 评分：${(finalScore * 100).toFixed(0)} 分`);
    // save record
    const rec = {
      studentId: "student_001",
      taskId: "triangle_area_task",
      startTime: events.length > 0 ? events[0].timestamp : timestamp(),
      endTime: timestamp(),
      events,
      finalShape: { vertices },
      base: base,
      height: height,
      area: area,
      hintsUsed,
      attempts: attempts + 1,
      score: finalScore * 100,
      teacherFeedback: feedbackMsg,
      explanation
    };
    setRecords((r) => [...r, rec]);
    // reset attempt counters for next round
    setAttempts(0);
    setUserInput("");
    setExplanation("");
  };

  // difficulty and challenge setups
  const setLevel = (lvl) => {
    setDifficulty(lvl);
    pushEvent("levelChange", { level: lvl });
    if (lvl === "初级") {
      // fix base, allow top vertex move
      setVertices([{ x: 120, y: 260 }, { x: 420, y: 260 }, { x: 260, y: 120 }]);
      setTargetArea(null);
      clearInterval(timerRef.current);
      setTimer(0);
    } else if (lvl === "中级") {
      // fix two vertices and set target area
      setVertices([{ x: 120, y: 260 }, { x: 420, y: 260 }, { x: 260, y: 200 }]);
      // compute a target area slightly different
      const nowArea = triangleAreaByCoords({ x: 120, y: 260 }, { x: 420, y: 260 }, { x: 260, y: 200 });
      const tgt = +(nowArea * 1.5).toFixed(1);
      setTargetArea(tgt);
      setTimer(60); // 60s challenge
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimer((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current);
            pushEvent("challengeTimeout", { targetArea: tgt });
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } else if (lvl === "高级") {
      // free triangle, ask for proof (not implemented) - just set target null
      setVertices([{ x: 150, y: 240 }, { x: 430, y: 220 }, { x: 280, y: 90 }]);
      setTargetArea(null);
      clearInterval(timerRef.current);
      setTimer(0);
    }
  };

  // replay events: apply a sequence of events to reproduce state
  const replayEvents = async (evs) => {
    // disable interactions by setting a flag
    setLastFeedback("正在回放...");
    const savedVertices = vertices.slice();
    // start from initial vertices snapshot if available
    // simple approach: start from first dragStart or first record finalShape
    // We'll step through events applying them with small delays
    for (let i = 0; i < evs.length; i++) {
      const ev = evs[i];
      if (ev.type === "drag" || ev.type === "dragStart" || ev.type === "dragEnd") {
        const idx = ev.payload.index;
        const pos = ev.payload.pos;
        if (pos) {
          setVertices((prev) => {
            const next = prev.map(p => ({ ...p }));
            next[idx] = { x: pos.x, y: pos.y };
            return next;
          });
        }
      } else if (ev.type === "hint") {
        // show ephemeral hint feedback
        setLastFeedback(`回放提示: ${ev.payload.hint}`);
      } else if (ev.type === "submit") {
        setLastFeedback(`回放提交: ${ev.payload.userInput}`);
      } else if (ev.type === "levelChange") {
        setDifficulty(ev.payload.level);
      }
      await new Promise(res => setTimeout(res, 300));
    }
    setLastFeedback("回放结束");
    // restore saved vertices? We'll keep final state of replay.
  };

  // export handlers
  const exportJSON = () => {
    downloadBlob(JSON.stringify(records, null, 2), "records.json", "application/json");
  };

  const exportCSV = () => {
    // simple CSV: studentId,taskId,startTime,endTime,score,hintsUsed,attempts,area
    let csv = "studentId,taskId,startTime,endTime,score,hintsUsed,attempts,area\n";
    for (const r of records) {
      csv += `${r.studentId},${r.taskId},${r.startTime},${r.endTime},${r.score ?? ""},${r.hintsUsed},${r.attempts},${r.area}\n`;
    }
    downloadBlob(csv, "records.csv", "text/csv");
  };

  // small UI feedback animation states
  const [highlight, setHighlight] = useState(null); // 'success' | 'error' | null
  useEffect(() => {
    // set highlight based on last feedback content
    if (!lastFeedback) return;
    if (lastFeedback.includes("正确") || lastFeedback.includes("评分")) {
      setHighlight("success");
      const t = setTimeout(() => setHighlight(null), 900);
      return () => clearTimeout(t);
    } else if (lastFeedback.includes("错误") || lastFeedback.includes("无法识别")) {
      setHighlight("error");
      const t = setTimeout(() => setHighlight(null), 900);
      return () => clearTimeout(t);
    }
  }, [lastFeedback]);

  // generate hint text examples
  const hints = [
    "尝试将一个相同的三角形镜像拼接，观察平行四边形面积变化。",
    "移动第三个顶点垂直于底边，观察高度如何影响面积。",
    "注意公式：Area = 1/2 × base × height。检查是否少乘了 1/2。"
  ];

  // styling helpers
  const containerStyle = {
    display: "flex",
    gap: 12,
    fontFamily: "Arial, sans-serif",
    padding: 12,
    background: "#f6f8fa",
    height: "100vh",
    boxSizing: "border-box"
  };

  return (
    <div style={containerStyle}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8
        }}>
          <div>
            <h2 style={{ margin: 0 }}>即时反馈与步骤提示（画布）</h2>
            <div style={{ fontSize: 13, color: "#666" }}>
              难度：{difficulty} {targetArea ? `| 目标面积: ${targetArea}` : ""} {timer > 0 ? `| 倒计时: ${timer}s` : ""}
            </div>
          </div>
          <div>
            <label>难度：</label>
            <select value={difficulty} onChange={(e) => setLevel(e.target.value)}>
              <option value="初级">初级（引导）</option>
              <option value="中级">中级（探索）</option>
              <option value="高级">高级（推理）</option>
            </select>
          </div>
        </div>

        <div style={{
          display: "flex",
          gap: 12,
          background: "#fff",
          borderRadius: 8,
          padding: 12,
          alignItems: "flex-start",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
        }}>
          <div style={{
            border: `3px solid ${highlight === "success" ? "#8fd19e" : highlight === "error" ? "#f6a6a6" : "#eee"}`,
            borderRadius: 8,
            padding: 8,
            background: "#fff"
          }}>
            <svg
              ref={svgRef}
              width={svgW}
              height={svgH}
              style={{ display: "block", background: "#fefefe", borderRadius: 6 }}
              onMouseDown={(e) => {
                // clicking on empty area could deselect
              }}
            >
              {/* draw base line */}
              <line
                x1={vertices[0].x}
                y1={vertices[0].y}
                x2={vertices[1].x}
                y2={vertices[1].y}
                stroke="#999"
                strokeWidth={2}
              />
              {/* fill triangle with semi-transparent color */}
              <polygon
                points={vertices.map(v => `${v.x},${v.y}`).join(" ")}
                fill={highlight === "success" ? "rgba(37, 150, 66, 0.12)" : "rgba(50, 115, 220, 0.08)"}
                stroke="transparent"
              />
              {/* heights (perpendicular) projection from vertex2 to base */}
              {base > 0 && (() => {
                // projection of point C onto line AB
                const A = vertices[0], B = vertices[1], C = vertices[2];
                const ABx = B.x - A.x, ABy = B.y - A.y;
                const t = ((C.x - A.x) * ABx + (C.y - A.y) * ABy) / (ABx * ABx + ABy * ABy);
                const Px = A.x + t * ABx, Py = A.y + t * ABy;
                return (
                  <>
                    <line x1={C.x} y1={C.y} x2={Px} y2={Py} stroke="#f39c12" strokeDasharray="4 3" />
                    <circle cx={Px} cy={Py} r={3} fill="#f39c12" />
                  </>
                );
              })()}
              {/* vertices handles */}
              {vertices.map((v, i) => (
                <g key={i}>
                  <circle
                    cx={v.x}
                    cy={v.y}
                    r={8}
                    fill="#fff"
                    stroke="#2d6cdf"
                    strokeWidth={2}
                    onMouseDown={(e) => onHandleDown(i, e)}
                    style={{ cursor: "grab" }}
                  />
                  <text x={v.x + 12} y={v.y - 12} fontSize={12} fill="#222">
                    {i === 0 ? "A" : i === 1 ? "B" : "C"}
                  </text>
                </g>
              ))}

              {/* numeric labels */}
              <text x={10} y={20} fontSize={13} fill="#333">
                base: {base.toFixed(precision)} {unit}
              </text>
              <text x={10} y={40} fontSize={13} fill="#333">
                height: {height.toFixed(precision)} {unit}
              </text>
              <text x={10} y={60} fontSize={13} fill="#333">
                area: {area.toFixed(precision)} {unit}²
              </text>
            </svg>
          </div>

          <FeedbackPanel
            base={base}
            height={height}
            area={area}
            precision={precision}
            setPrecision={setPrecision}
            unit={unit}
            setUnit={setUnit}
            formulaAnimStep={formulaAnimStep}
            formulaSteps={formulaSteps}
            showVoice={showVoice}
            playVoice={playVoice}
            diagnostics={diagnostics}
            onSubmitAttempt={onSubmitAttempt}
            userInput={userInput}
            setUserInput={setUserInput}
            explanation={explanation}
            setExplanation={setExplanation}
            submitDisabled={false}
            lastFeedback={lastFeedback}
          />
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>提示与分级引导</div>
            <div style={{ border: "1px solid #eee", padding: 10, borderRadius: 6, background: "#fff" }}>
              <div style={{ marginBottom: 8 }}>
                <HintCard hint={hints[0]} onUse={handleUseHint} depth="步骤提示" disabled={hintDisabled} />
                <HintCard hint={hints[1]} onUse={handleUseHint} depth="示范" disabled={hintDisabled} />
                <HintCard hint={hints[2]} onUse={handleUseHint} depth="概念提示" disabled={hintDisabled} />
              </div>

              <div style={{ marginTop: 8, fontSize: 13 }}>
                已用提示：{hintsUsed} / {hintLimit}
                <button style={{ marginLeft: 8 }} onClick={() => {
                  setHintsUsed(0);
                  setHintDisabled(false);
                }}>重置提示计数</button>
              </div>

              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 600 }}>难度实验建议</div>
                <ul style={{ marginTop: 6 }}>
                  <li>初级：固定底边，拖动顶点观察高度与面积变化。</li>
                  <li>中级：给定两个顶点，调整第三顶点以达到指定面积（限制 hints）。</li>
                  <li>高级：使用拼接工具证明等式并提交文字或语音说明。</li>
                </ul>
              </div>
            </div>
          </div>

          <div style={{ width: 320 }}>
            <div style={{ fontWeight: 600 }}>成绩与记录</div>
            <div style={{
              border: "1px solid #eee",
              borderRadius: 6,
              padding: 8,
              background: "#fff",
              marginTop: 6
            }}>
              <div>尝试次数: {attempts}</div>
              <div>提示使用: {hintsUsed}</div>
              <div>最近评分: {records.length > 0 ? `${records[records.length - 1].score?.toFixed(1) ?? "-"}` : "-"}</div>
              <div style={{ marginTop: 8 }}>
                <button onClick={() => {
                  // quick export last record
                  if (records.length === 0) return;
                  const last = records[records.length - 1];
                  downloadBlob(JSON.stringify(last, null, 2), "last_record.json", "application/json");
                }}>导出最近记录</button>
              </div>
            </div>

            <div style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 600 }}>成果与鼓励</div>
              <div style={{
                border: "1px solid #eee",
                borderRadius: 6,
                padding: 8,
                background: "#fff",
                marginTop: 6
              }}>
                <div>完成任务后将显示徽章/星级与复盘回放按钮。</div>
                <div style={{ marginTop: 6 }}>
                  <button onClick={() => {
                    // simple badge awarding rule
                    const last = records[records.length - 1];
                    if (!last) return alert("暂无记录");
                    if (last.score >= 90) alert("恭喜！获得 金牌徽章 🏅");
                    else if (last.score >= 70) alert("获得 银牌徽章 🥈");
                    else alert("继续努力，获得 铜牌徽章 🥉");
                  }}>显示最近成果徽章</button>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>

      <TeacherDashboard
        records={records}
        events={events}
        onReplayEvents={(evs) => replayEvents(evs)}
        onExportJSON={exportJSON}
        onExportCSV={exportCSV}
      />
    </div>
  );
}
```