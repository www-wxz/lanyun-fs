/* ParallelogramLesson.jsx
 *
 * 教学演示组件集合（面向 "探索平行四边形的面积计算公式"）
 *
 * 包含组件：
 * - StepGuide: 逐步展示教学步骤并高亮当前步骤
 * - HintPanel: 动态提示区域，随交互状态更新提示语与教师建议
 * - Visualizer: SVG 平面几何交互动画，支持观察、分割、平移、拼接与数值验证
 * - ParallelogramLesson: 将以上组件组合成一个教学演示单元（便于集成）
 *
 * 说明（设计原则）：
 * - 平面几何使用 SVG 实现交互与动画（满足题目要求）
 * - 将复杂的底层交互策略留有明确钩子（callbacks & events），以便 InteractiveLogicAgent 做更细致实现或与全局状态管理结合
 * - 组件内提供直观的视觉反馈（高亮、虚线投影、格子填充、数值板）与占位的公式展示（KaTeX/MathJax 可由宿主应用挂载）
 *
 * 使用注意：
 * - 本文件不包含整体页面布局、主题样式或路由等（由 UIdesignAgent 负责）
 * - 若需支持 KaTeX 渲染，请在宿主页面载入 KaTeX/MathJax 并在 HintPanel 中渲染公式占位元素
 *
 * 依赖：
 * - React（函数组件、hooks）
 * - 无第三方可视化库（SVG即可满足平面几何需求）
 *
 * 作者：TeachingFeedbackAgent
 * 时间：2025-09
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';

/* -------------------------
   StepGuide
   - props:
     - steps: [{ id, title, summary }]
     - currentStep: number (0-based)
     - onStepChange(stepIndex)
     - compact: boolean (render compact)
   - 功能：
     - 高亮当前步骤、支持点击跳转（回调）
     - 显示进度条（基于当前步骤）
   ------------------------- */
export function StepGuide({ steps = [], currentStep = 0, onStepChange = () => {}, compact = false }) {
  const progress = steps.length > 0 ? ((currentStep + 1) / steps.length) * 100 : 0;

  return (
    <div style={{ padding: compact ? 8 : 12, fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: '#4caf50', transition: 'width 300ms' }} />
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#666' }}>{`${currentStep + 1} / ${steps.length}`}</div>
      </div>

      <ol style={{ marginTop: 10, paddingLeft: 18 }}>
        {steps.map((s, idx) => {
          const isActive = idx === currentStep;
          return (
            <li
              key={s.id || idx}
              onClick={() => onStepChange(idx)}
              style={{
                marginBottom: 8,
                cursor: 'pointer',
                background: isActive ? 'rgba(76,175,80,0.08)' : 'transparent',
                padding: isActive ? 8 : 0,
                borderRadius: 6,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: isActive ? '#2e7d32' : '#222' }}>{s.title}</strong>
                {isActive && <span style={{ fontSize: 12, color: '#2e7d32' }}>当前</span>}
              </div>
              {!compact && <div style={{ fontSize: 12, color: '#555' }}>{s.summary}</div>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* -------------------------
   HintPanel
   - props:
     - messages: array of strings (stacked)
     - activeHint: string (priority)
     - teacherMode: boolean (若为教师模式展示更多建议)
     - teacherNotes: array of strings
   - 功能：显示动态提示、交互提示气泡、公式占位
   ------------------------- */
export function HintPanel({ messages = [], activeHint = '', teacherMode = false, teacherNotes = [] }) {
  const merged = [activeHint, ...messages].filter(Boolean);
  return (
    <div style={{ padding: 12, fontFamily: 'sans-serif', color: '#222' }}>
      {merged.length > 0 ? (
        merged.map((m, i) => (
          <div key={i} style={{ marginBottom: 8, background: '#fffbea', padding: 8, borderRadius: 6, border: '1px solid #ffe58f' }}>
            <div style={{ fontSize: 13 }}>{m}</div>
          </div>
        ))
      ) : (
        <div style={{ fontSize: 13, color: '#888' }}>请开始交互，系统将提供提示。</div>
      )}

      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 12, color: '#444', marginBottom: 6 }}>关键结论（占位公式）</div>
        <div style={{ background: '#f6f8fa', padding: 8, borderRadius: 6, border: '1px dashed #ddd' }}>
          {/* KaTeX / MathJax 渲染占位：宿主可替换此处元素以调用 KaTeX/MathJax */}
          <div className="math-placeholder" style={{ fontSize: 16, color: '#111' }}>
            Area = b × h
          </div>
        </div>
      </div>

      {teacherMode && teacherNotes && teacherNotes.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: '#0b5345' }}>
          <strong>教师提示：</strong>
          <ul style={{ marginTop: 6 }}>
            {teacherNotes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* -------------------------
   Utility: point operations
   ------------------------- */
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a, b, t) => a + (b - a) * t;

/* -------------------------
   Visualizer (核心)
   - props:
     - width, height
     - base: number (initial base length)
     - heightVal: number (initial height)
     - grid: boolean
     - step: number (current step index) -> 控制展示各步骤动画
     - onStateChange(state) // callback when shape params change (expose b,h,tilt)
     - onInteraction(event) // generic interaction events
     - teacherMode: boolean
   - 功能：
     - 绘制一个可拖拽平行四边形（拖动顶点改变倾斜度）
     - 显示底 b 与高度 h（高度为垂直距离，投影为虚线）
     - 支持“切割并平移”动画控制（由当前 step 控制）
     - 数值面板显示 b、h与面积（Area = b*h）
     - 提供格子填充切换展示（grid）
   - 说明：
     - 交互实现以 React state+events 提供直观演示
     - 对于更复杂的拖拽/碰撞/动画控制，可通过 onInteraction 与上层逻辑协同实现
   ------------------------- */
export function Visualizer({
  width = 700,
  height = 420,
  base = 300,
  heightVal = 150,
  grid = true,
  step = 0,
  onStateChange = () => {},
  onInteraction = () => {},
  teacherMode = false,
}) {
  const svgRef = useRef(null);
  // Coordinates: we'll position base on bottom-left at (100, baseY)
  const margin = 40;
  const baseLeftX = margin + 60;
  const baseY = height - margin;
  // Represent parallelogram by bottom-left point (x0,y0), base length b, tilt dx (top-left = bottom-left + dx horizontally), and vertical height h
  const [b, setB] = useState(Math.max(40, Math.min(base, 400)));
  const [hVal, setHVal] = useState(Math.max(20, Math.min(heightVal, baseY - margin - 20)));
  const [tilt, setTilt] = useState(80); // horizontal offset from bottom-left to top-left (positive = tilt right)
  // For animation: cut position (t between 0 and 1 from left), and translation progress
  const [cutT, setCutT] = useState(0.25);
  const [translateProgress, setTranslateProgress] = useState(0); // 0..1
  const [showGrid, setShowGrid] = useState(grid);
  const [draggingVertex, setDraggingVertex] = useState(null);

  // Derived points
  const bottomLeft = { x: baseLeftX, y: baseY };
  const bottomRight = { x: baseLeftX + b, y: baseY };
  const topLeft = { x: baseLeftX + tilt, y: baseY - hVal };
  const topRight = { x: baseLeftX + tilt + b, y: baseY - hVal };

  useEffect(() => {
    onStateChange({ b, h: hVal, tilt, cutT, translateProgress });
  }, [b, hVal, tilt, cutT, translateProgress]);

  // Area
  const area = useMemo(() => Math.round(b * hVal), [b, hVal]);

  // Mouse handlers for dragging top-left/top-right to change tilt or dragging top edge to change height.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let isDown = false;
    let active = null;

    const toSvgPoint = (evt) => {
      const pt = svg.createSVGPoint();
      pt.x = evt.clientX; pt.y = evt.clientY;
      const ctm = svg.getScreenCTM().inverse();
      const p = pt.matrixTransform(ctm);
      return { x: p.x, y: p.y };
    };

    const onPointerDown = (e) => {
      // Determine if near top-left or top-right or top edge center
      const p = toSvgPoint(e);
      const near = (pt) => dist(pt, p) < 12;
      if (near(topLeft)) active = 'topLeft';
      else if (near(topRight)) active = 'topRight';
      else {
        // check near top edge line
        const edgeCenter = { x: (topLeft.x + topRight.x) / 2, y: (topLeft.y + topRight.y) / 2 };
        if (near(edgeCenter)) active = 'topEdge';
      }
      if (active) {
        isDown = true;
        setDraggingVertex(active);
        svg.setPointerCapture(e.pointerId);
        onInteraction({ type: 'dragStart', target: active });
      }
    };

    const onPointerMove = (e) => {
      if (!isDown || !active) return;
      const p = toSvgPoint(e);
      if (active === 'topLeft') {
        // change tilt based on delta x from bottomLeft
        const newTilt = Math.round(Math.max(-b + 20, Math.min(p.x - bottomLeft.x, b - 20)));
        setTilt(newTilt);
        onInteraction({ type: 'tiltChange', tilt: newTilt });
      } else if (active === 'topRight') {
        // change tilt based on topRight x relative to topLeft
        const desiredTopRightX = p.x;
        const newTilt = Math.round(desiredTopRightX - bottomLeft.x - b);
        setTilt(newTilt);
        onInteraction({ type: 'tiltChange', tilt: newTilt });
      } else if (active === 'topEdge') {
        // change height based on vertical position
        const newH = Math.round(Math.max(10, Math.min(baseY - margin - 10, bottomLeft.y - p.y)));
        setHVal(newH);
        onInteraction({ type: 'heightChange', h: newH });
      }
    };

    const onPointerUp = (e) => {
      if (isDown) {
        isDown = false;
        setDraggingVertex(null);
        onInteraction({ type: 'dragEnd', target: active });
        active = null;
      }
    };

    svg.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      svg.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [bottomLeft.x, bottomLeft.y, topLeft, topRight, b, tilt, onInteraction, baseY, margin]);

  // Step animation control: when step changes, animate translateProgress accordingly
  useEffect(() => {
    // step mapping:
    // 0 - 初始观察（translateProgress 0, cutT default)
    // 1 - 分割演示（show cut line, translateProgress 0)
    // 2 - 平移拼接（animate translateProgress from 0 to 1)
    // 3 - 拼接成矩形（translateProgress 1)
    // 4 - 数值验证 / 总结 (unchanged)
    let target = 0;
    if (step === 2 || step === 3) target = 1;
    else target = 0;
    let raf = null;
    const duration = 700;
    const start = performance.now();
    const from = translateProgress;
    const animate = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
      const val = lerp(from, target, eased);
      setTranslateProgress(val);
      if (p < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // cut triangle geometry: cut at fraction cutT along top edge measured from top-left toward top-right
  const cutPointTop = { x: topLeft.x + (topRight.x - topLeft.x) * cutT, y: topLeft.y + (topRight.y - topLeft.y) * cutT };
  // Corresponding point on bottom edge (same x along base) to cut vertical from top to base? For this animation, we cut a triangle at left top corner: line from top-left to some point on top edge (toward top-right) then down along slanted side to bottom-left.
  // We'll implement simple cut: an isosceles triangular region at leftmost with vertices [topLeft, cutPointTop, bottomLeftProjected]
  const cutBottomProjected = { x: bottomLeft.x + (cutPointTop.x - topLeft.x), y: bottomLeft.y }; // translate horizontally same offset
  // For visual correctness, we clip with polygon [topLeft, cutPointTop, correspondingBasePoint]
  const cutTriangle = [topLeft, cutPointTop, cutBottomProjected];

  // When translateProgress > 0, the cut triangle moves to the right to fit on the opposite side -> new position angle: translate horizontally by (b + tilt) approx.
  const translationDistance = b; // move by base length to the right
  const cutTriangleTranslated = cutTriangle.map((p) => ({ x: p.x + translationDistance * translateProgress, y: p.y }));

  // For rendering grid in rectangle after translation: we also compute rectangle bounds: width = b, height = hVal, placed at (bottomLeft.x, bottomLeft.y - hVal)
  const rectX = bottomLeft.x;
  const rectY = bottomLeft.y - hVal;
  const rectW = b;
  const rectH = hVal;

  // Helper to render dashed projection (height)
  const projX = topLeft.x; // vertical projection x
  const heightProjectionLine = { x1: projX, y1: topLeft.y, x2: projX, y2: bottomLeft.y };

  return (
    <div style={{ display: 'flex', gap: 12, fontFamily: 'sans-serif' }}>
      <svg ref={svgRef} width={width} height={height} style={{ background: '#f8f9fb', borderRadius: 6 }}>
        {/* grid background */}
        {showGrid && (
          <g>
            <defs>
              <pattern id="smallGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#eee" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect x={0} y={0} width={width} height={height} fill="url(#smallGrid)" />
          </g>
        )}

        {/* Parallelogram (base-left -> base-right -> top-right -> top-left) */}
        <polygon
          points={`${bottomLeft.x},${bottomLeft.y} ${bottomRight.x},${bottomRight.y} ${topRight.x},${topRight.y} ${topLeft.x},${topLeft.y}`}
          fill="#dcedc8"
          stroke="#6aa84f"
          strokeWidth="2"
          opacity={1 - (step >= 2 ? 0.15 : 0)}
        />

        {/* base line and label */}
        <line x1={bottomLeft.x} y1={bottomLeft.y} x2={bottomRight.x} y2={bottomRight.y} stroke="#333" strokeWidth="2" />
        <text x={(bottomLeft.x + bottomRight.x) / 2} y={bottomLeft.y + 18} fontSize={13} textAnchor="middle" fill="#222">
          b = {b}px
        </text>

        {/* height dashed projection */}
        <line x1={heightProjectionLine.x1} y1={heightProjectionLine.y1} x2={heightProjectionLine.x2} y2={heightProjectionLine.y2} stroke="#ff6f61" strokeWidth="1.5" strokeDasharray="6 4" />
        <circle cx={heightProjectionLine.x1} cy={heightProjectionLine.y1} r={3} fill="#ff6f61" />
        <text x={heightProjectionLine.x1 + 8} y={(heightProjectionLine.y1 + heightProjectionLine.y2) / 2} fontSize={12} fill="#c62828">
          h = {hVal}px
        </text>

        {/* optionally show the triangle cut area (step 1-3) */}
        {step >= 1 && (
          <>
            {/* cut triangle original */}
            <polygon
              points={cutTriangle.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="#ffe0b2"
              stroke="#f57c00"
              strokeWidth="1.5"
              opacity={1 - translateProgress}
            />
            {/* highlight target slot on right side (where triangle will move to) */}
            <polygon
              points={cutTriangleTranslated.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="#fff3e0"
              stroke="#ff8a65"
              strokeWidth="1.2"
              opacity={0.9}
            />
            {/* arrow showing motion */}
            <g opacity={translateProgress < 0.95 ? 1 : 0.0}>
              <line
                x1={cutTriangle[1].x}
                y1={cutTriangle[1].y - 10}
                x2={cutTriangle[1].x + translationDistance * Math.max(0.05, translateProgress)}
                y2={cutTriangle[1].y - 10}
                stroke="#ff8a65"
                strokeWidth="1.2"
                markerEnd="url(#arrowhead)"
                strokeDasharray="4 3"
              />
            </g>
          </>
        )}

        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 L2,3 z" fill="#ff8a65" />
          </marker>
        </defs>

        {/* After translation, show the formed rectangle overlay */}
        {translateProgress > 0.01 && (
          <g opacity={translateProgress}>
            {/* rectangle outline */}
            <rect x={rectX} y={rectY} width={rectW} height={rectH} fill="#bbdefb" stroke="#1976d2" strokeWidth="2" />
            {/* optionally grid fill inside rectangle to visualize area */}
            {showGrid && (
              <g clipPath="none" opacity={0.6}>
                {/* simple pattern of small rects */}
                {[...Array(Math.max(2, Math.floor(rectW / 20)))].map((_, i) =>
                  [...Array(Math.max(2, Math.floor(rectH / 20)))].map((__, j) => (
                    <rect
                      key={`${i}-${j}`}
                      x={rectX + i * 20 + 2}
                      y={rectY + j * 20 + 2}
                      width={16}
                      height={16}
                      fill={j % 2 === 0 ? '#e3f2fd' : '#bbdefb'}
                      opacity={0.8}
                    />
                  ))
                )}
              </g>
            )}
          </g>
        )}

        {/* draggable handles: topLeft, topRight */}
        <circle cx={topLeft.x} cy={topLeft.y} r={6} fill={draggingVertex === 'topLeft' ? '#ff7043' : '#fff'} stroke="#ff7043" strokeWidth={2} />
        <circle cx={topRight.x} cy={topRight.y} r={6} fill={draggingVertex === 'topRight' ? '#ff7043' : '#fff'} stroke="#ff7043" strokeWidth={2} />
        {/* topEdge center handle */}
        <rect
          x={(topLeft.x + topRight.x) / 2 - 6}
          y={(topLeft.y + topRight.y) / 2 - 6}
          width={12}
          height={12}
          rx={2}
          ry={2}
          fill={draggingVertex === 'topEdge' ? '#ef5350' : '#fff'}
          stroke="#ef5350"
          strokeWidth={2}
        />

        {/* labels for steps (small) */}
        <text x={10} y={20} fontSize={13} fill="#333">
          步骤：{step + 1}
        </text>
      </svg>

      {/* Right-side control / info panel (focused on教学反馈 & 数值) */}
      <div style={{ width: 260, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ padding: 10, background: '#fff', borderRadius: 6, border: '1px solid #eee' }}>
          <div style={{ fontSize: 13, color: '#111', marginBottom: 6 }}><strong>数值面板</strong></div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: 12, width: 50 }}>b (底)</div>
            <input
              type="range"
              min={40}
              max={400}
              value={b}
              onChange={(e) => {
                setB(Number(e.target.value));
                onInteraction({ type: 'bChange', b: Number(e.target.value) });
              }}
              style={{ flex: 1 }}
            />
            <div style={{ width: 46, textAlign: 'right', fontSize: 12 }}>{b}px</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: 12, width: 50 }}>h (高)</div>
            <input
              type="range"
              min={10}
              max={baseY - margin - 10}
              value={hVal}
              onChange={(e) => {
                setHVal(Number(e.target.value));
                onInteraction({ type: 'hChange', h: Number(e.target.value) });
              }}
              style={{ flex: 1 }}
            />
            <div style={{ width: 46, textAlign: 'right', fontSize: 12 }}>{hVal}px</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 12, width: 50 }}>倾斜</div>
            <input
              type="range"
              min={-b + 20}
              max={b - 20}
              value={tilt}
              onChange={(e) => {
                setTilt(Number(e.target.value));
                onInteraction({ type: 'tiltChange', tilt: Number(e.target.value) });
              }}
              style={{ flex: 1 }}
            />
            <div style={{ width: 46, textAlign: 'right', fontSize: 12 }}>{tilt}px</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <div style={{ fontSize: 13 }}><strong>面积</strong></div>
            <div style={{ fontSize: 16, color: '#0b63c6', fontWeight: 600 }}>{area} px²</div>
          </div>

          <div style={{ marginTop: 8, fontSize: 12, color: '#555' }}>
            提示：拖动上方的顶点或调整滑块，可以改变平行四边形的形状。高度 h 为到对边的垂直距离（虚线投影）。
          </div>
        </div>

        {/* Controls for cut position and grid toggle */}
        <div style={{ padding: 10, background: '#fff', borderRadius: 6, border: '1px solid #eee' }}>
          <div style={{ fontSize: 13, marginBottom: 6 }}><strong>分割与拼接</strong></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: 12, width: 60 }}>切割位置</div>
            <input
              type="range"
              min={0.05}
              max={0.45}
              step={0.01}
              value={cutT}
              onChange={(e) => {
                setCutT(Number(e.target.value));
                onInteraction({ type: 'cutChange', t: Number(e.target.value) });
              }}
              style={{ flex: 1 }}
              disabled={step >= 2} // during animation disable changing cut position
            />
            <div style={{ width: 36, textAlign: 'right', fontSize: 12 }}>{Math.round(cutT * 100)}%</div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                // trigger step 1: cut
                onInteraction({ type: 'gotoStep', step: 1 });
              }}
              style={{ flex: 1, padding: '6px 8px', background: '#fff', border: '1px solid #ddd', borderRadius: 6 }}
            >
              显示切割
            </button>
            <button
              onClick={() => {
                // trigger step 2: animate translation; host app may change step prop to 2 to animate
                onInteraction({ type: 'gotoStep', step: 2 });
              }}
              style={{ flex: 1, padding: '6px 8px', background: '#1976d2', color: '#fff', borderRadius: 6, border: 'none' }}
            >
              平移拼接
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <input id="gridToggle" type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
            <label htmlFor="gridToggle" style={{ fontSize: 12 }}>格子填充</label>
          </div>

          {teacherMode && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#0b5345' }}>
              教师提示：可先示范一次从“切割”到“平移”完整过程，再让学生尝试改变 b/h 观察面积变化。
            </div>
          )}
        </div>

        {/* Simple telemetry / feedback area */}
        <div style={{ padding: 10, background: '#fff', borderRadius: 6, border: '1px solid #eee', fontSize: 12 }}>
          <div style={{ marginBottom: 6 }}><strong>交互反馈</strong></div>
          <div style={{ color: '#666' }}>
            b = {b}px, h = {hVal}px, tilt = {tilt}px
            <br />
            当前面积（计算） = b × h = {b} × {hVal} = {area} px²
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------
   ParallelogramLesson (组合组件)
   - props:
     - teacherMode
     - initialStep
     - onAnswer / onComplete callbacks (expose)
   - 说明：
     - 该组件把 StepGuide / Visualizer / HintPanel 结合，管理当前步骤索引（简易本地管理）
     - 复杂课堂控制（逐步模式、教师暂停询问等）建议由上层控制并通过 onStepChange 等回调整合
   ------------------------- */
export function ParallelogramLesson({
  teacherMode = false,
  initialStep = 0,
  onComplete = () => {},
  onStepChange = () => {},
  onUserInteraction = () => {},
}) {
  const steps = [
    { id: 'observe', title: '初始观察', summary: '识别底 b 与高度 h，并尝试拖拽顶点观察高度定义不变。' },
    { id: 'cut', title: '分割演示', summary: '将顶角剪切下一个三角形，并准备平移到另一侧。' },
    { id: 'translate', title: '平移拼接', summary: '把被剪出的三角形平移，观察它与剩余部分如何拼成矩形。' },
    { id: 'verify', title: '数值验证', summary: '修改 b 或 h，观察面积如何随之变化。' },
    { id: 'summary', title: '总结扩展', summary: '观察公式并完成练习题提示。' },
  ];

  const [currentStep, setCurrentStep] = useState(initialStep);
  const [messages, setMessages] = useState([]);
  const [activeHint, setActiveHint] = useState('');

  useEffect(() => {
    onStepChange(currentStep);
  }, [currentStep, onStepChange]);

  // Handlers from Visualizer interactions
  const handleVisualizerInteraction = (evt) => {
    // evt: { type: ..., ... }
    onUserInteraction(evt);
    // Update hints or messages according to evt
    if (evt.type === 'dragStart') {
      setActiveHint('请拖动顶点，注意高度是到对边的垂直距离。');
    } else if (evt.type === 'dragEnd') {
      setActiveHint('观察：底 b 是否改变？高度 h 是否保持为垂直距离？');
      setMessages((m) => [`已拖拽 ${evt.target}`, ...m].slice(0, 6));
    } else if (evt.type === 'gotoStep') {
      //上层可能会 change step; we adjust local step too
      setCurrentStep(evt.step);
      setActiveHint(`进入步骤：${steps[evt.step]?.title || evt.step}`);
    } else if (evt.type === 'bChange' || evt.type === 'hChange' || evt.type === 'tiltChange') {
      //实时数值反馈
      setActiveHint(`实时计算：Area = b × h ，当前结果会随 b/h 变动。`);
    } else if (evt.type === 'cutChange') {
      setActiveHint('尝试不同切割位置，验证拼接后是否总能构成相同矩形。');
    }
  };

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {/* Left: StepGuide */}
      <div style={{ width: 260 }}>
        <StepGuide
          steps={steps}
          currentStep={currentStep}
          onStepChange={(idx) => {
            setCurrentStep(idx);
            setActiveHint(steps[idx]?.summary || '');
          }}
        />
      </div>

      {/* Middle: Visualizer */}
      <div style={{ flex: 1 }}>
        <Visualizer
          width={760}
          height={420}
          grid={true}
          step={currentStep}
          teacherMode={teacherMode}
          onInteraction={handleVisualizerInteraction}
          onStateChange={(s) => {
            // Optionally update hints when specific numeric thresholds reached
            // e.g., if area matches some value we might suggest a question
            // Expose state to hosting logic
            // Here we just append a short telemetry
            // (Detailed eval / assessment left for AssessmentAgent)
            // No heavy logic here - just pass-through
          }}
        />

        {/* Bottom hint controls or quick actions */}
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              // go previous
              setCurrentStep((p) => Math.max(0, p - 1));
              setActiveHint('已退回上一步，可继续观察或提问学生。');
            }}
          >
            上一步
          </button>
          <button
            onClick={() => {
              setCurrentStep((p) => Math.min(steps.length - 1, p + 1));
              setActiveHint('前往下一步：观察并回答引导问题。');
            }}
          >
            下一步
          </button>

          <button
            onClick={() => {
              // quick verify: simulate finishing
              onComplete({ finishedStep: currentStep });
              setActiveHint('演示已标记为完成。可点击“总结”显示证明与练习。');
            }}
          >
            标记完成
          </button>
        </div>
      </div>

      {/* Right: HintPanel */}
      <div style={{ width: 320 }}>
        <HintPanel
          messages={messages}
          activeHint={activeHint}
          teacherMode={teacherMode}
          teacherNotes={[
            '建议先演示一遍完整动画，再让学生操作。',
            '重点强调：高度为垂直距离而非斜边长度。',
            '课堂控制：逐步播放并在每步停顿提问。',
            ... (teacherMode ? ['可启用教师模式查看标准答案与教学建议。'] : []),
          ]}
        />
      </div>
    </div>
  );
}

/* -------------------------
   导出默认（供集成）
   ------------------------- */
export default ParallelogramLesson;

/* End of file
 *
 * 集成建议（给集成开发者 / InteractiveLogicAgent / UIdesignAgent）：
 * - 如果需要把 px 值换算为真实度量（如厘米），可在外层把 b/h 做单位转换并传入 Visualizer 的 props 或通过 onStateChange 回调接收实际数值进行转换展示。
 * - 若欲用 KaTeX / MathJax 渲染公式，请在宿主页面将 math-placeholder 内容替换或在 HintPanel 中插入经 KaTeX 渲染的 HTML。
 * - 本组件已暴露较多交互回调（onInteraction、onStateChange、onStepChange、onComplete），建议在集成时由 InteractiveLogicAgent 进一步实现数据记录、学生作答评估与课堂控制逻辑。
 */