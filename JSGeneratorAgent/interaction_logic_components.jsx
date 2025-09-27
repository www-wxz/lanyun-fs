import React, { useState, useRef, useEffect, useCallback } from "react";

/**
 * CircleLessonController
 * - 逻辑控制层：管理 state、动画、交互事件
 * - 假定 UI 层由 <MainCanvasArea />, <ToolBar />, <HintPanel /> 提供
 *
 * 说明：
 * - 不生成具体 HTML/CSS；只把逻辑和数据通过 props 传给 UI 组件
 * - 每个功能拆成独立函数，便于单元测试与扩展
 */

export default function CircleLessonController(props) {
  // Primary state (exposed to UI)
  const [radius, setRadius] = useState(50);
  const [center, setCenter] = useState({ x: 320, y: 240 });
  const [sectorsCount, setSectorsCount] = useState(8);
  const [piValue, setPiValue] = useState(3.14);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Derived measurements
  const [circumference, setCircumference] = useState(
    computeCircumference(radius, piValue)
  );
  const [area, setArea] = useState(computeArea(radius, piValue));

  // Hint panel text
  const [hint, setHint] = useState({
    message: "欢迎！拖动半径或使用滑块观察圆的变化。",
    level: "info",
  });

  // Computed svg-data for MainCanvasArea
  const [svgData, setSvgData] = useState(() =>
    renderSVG({
      radius,
      center,
      sectorsCount,
      piValue,
    })
  );

  // Refs for animation loop and drag throttling
  const rafRef = useRef(null);
  const lastDragTimeRef = useRef(0);
  const isMountedRef = useRef(true);
  const animationStateRef = useRef({
    // generic animation state: { name, startTime, duration, params, onComplete }
    active: null,
  });

  // Refs for pointer capture
  const pointerIdRef = useRef(null);

  // Initialize: bind/unbind global listeners
  useEffect(() => {
    isMountedRef.current = true;
    const onMove = (evt) => {
      // unified mouse/touch move
      if (isDragging) {
        dragHandleMove(evt);
      }
    };
    const onUp = (evt) => {
      if (isDragging) {
        dragHandleEnd(evt);
      }
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchend", onUp);

    return () => {
      isMountedRef.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchend", onUp);
      cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging]);

  // updateMeasurements whenever radius or pi changes
  useEffect(() => {
    updateMeasurements(radius, piValue);
    // rebuild svgData
    setSvgData(
      renderSVG({
        radius,
        center,
        sectorsCount,
        piValue,
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius, piValue, center, sectorsCount]);

  // Animation loop controller
  useEffect(() => {
    if (isPlaying && !animationStateRef.current.active) {
      // If playing but no active animation, start step animation
      startStepAnimation(currentStep);
    }
    if (!isPlaying && animationStateRef.current.active) {
      // pause
      cancelAnimationFrame(rafRef.current);
      animationStateRef.current.active = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, currentStep]);

  /* ----------------- Core compute functions ----------------- */

  function computeCircumference(r, pi) {
    return 2 * pi * r;
  }

  function computeArea(r, pi) {
    return pi * r * r;
  }

  /* ----------------- renderSVG / data generation ----------------- */
  // Returns object describing shapes to render in MainCanvasArea
  // (MainCanvasArea负责把这些数据转成真正的 SVG 元素)
  function renderSVG({ radius, center, sectorsCount, piValue }) {
    const circle = {
      cx: center.x,
      cy: center.y,
      r: radius,
      stroke: "#333",
      strokeWidth: 2,
      fill: "none",
    };

    // radius line end point
    const handle = {
      x: center.x + radius,
      y: center.y,
    };

    // generate sectors
    const sectors = generateSectors(sectorsCount, radius, center);

    // string representation for circumference demo: sample a polyline along circle
    const stringPolyline = generateStringPolyline(radius, center, sectorsCount);

    return {
      circle,
      handle,
      center,
      sectors,
      stringPolyline,
      highlights: {
        circumferenceId: "circ-1",
      },
    };
  }

  // helper: sample polyline approximating circle for "string" animation
  function generateStringPolyline(radius, center, resolution = 64) {
    const points = [];
    for (let i = 0; i <= resolution; i++) {
      const theta = (i / resolution) * 2 * Math.PI;
      const x = center.x + radius * Math.cos(theta);
      const y = center.y + radius * Math.sin(theta);
      points.push({ x, y });
    }
    return { points };
  }

  // generateSectors: returns array [{index, startAngle, endAngle, pathD, arcLength, areaFraction}, ...]
  function generateSectors(n = sectorsCount, r = radius, centerPoint = center) {
    const sectors = [];
    const twoPi = Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const start = (i / n) * twoPi;
      const end = ((i + 1) / n) * twoPi;
      const largeArcFlag = end - start > Math.PI ? 1 : 0;
      const x1 = centerPoint.x + r * Math.cos(start);
      const y1 = centerPoint.y + r * Math.sin(start);
      const x2 = centerPoint.x + r * Math.cos(end);
      const y2 = centerPoint.y + r * Math.sin(end);
      // SVG path for sector (move to center, line to arc start, arc to end, close)
      const d = `M ${centerPoint.x} ${centerPoint.y} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
      const arcLength = r * (end - start);
      const areaFraction = (0.5 * r * r * (end - start)) / (Math.PI * r * r); // fraction of full circle
      sectors.push({
        index: i,
        startAngle: start,
        endAngle: end,
        pathD: d,
        arcLength,
        areaFraction,
        center: centerPoint,
        r,
      });
    }
    return sectors;
  }

  /* ----------------- Measurements update ----------------- */
  function updateMeasurements(r, pi) {
    const C = computeCircumference(r, pi);
    const A = computeArea(r, pi);
    setCircumference(C);
    setArea(A);
    // provide contextual hint
    showHint(
      `当前 r=${r}px，C≈${C.toFixed(2)}（px），A≈${A.toFixed(2)}（px²）`,
      "info"
    );
  }

  /* ----------------- Sliders & inputs handlers ----------------- */
  function onRadiusSliderChange(value) {
    const v = Number(value);
    setRadius(v);
    // immediate feedback: highlight circumference
    showHint("半径已调整，观察周长与面积的变化。", "observe");
  }

  function onSectorsSliderChange(value) {
    const n = Math.max(1, Math.floor(Number(value)));
    setSectorsCount(n);
    // regenerate sectors (renderSVG effect will run)
    showHint(`将圆切成 ${n} 份。可在步骤 3-4 看到重排效果。`, "observe");
    // If currently in sector rearrange step, animate re-arrange
    if (currentStep === 4) {
      animateRearrangeSectors(n);
    }
  }

  function onPiInputChange(value) {
    const p = Number(value) || 3.14;
    setPiValue(p);
    showHint(`使用 π=${p} 进行计算。`, "info");
  }

  /* ----------------- Dragging radius handle ----------------- */
  function getPointerPos(evt) {
    if (evt.touches && evt.touches[0]) {
      const t = evt.touches[0];
      return { x: t.clientX, y: t.clientY };
    } else if (evt.clientX !== undefined) {
      return { x: evt.clientX, y: evt.clientY };
    } else if (evt.pageX !== undefined) {
      return { x: evt.pageX, y: evt.pageY };
    }
    return null;
  }

  // throttle wrapper using requestAnimationFrame
  function rafThrottle(fn) {
    let scheduled = false;
    return function throttled(...args) {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        fn(...args);
      });
    };
  }

  const applyDragMove = useCallback(
    rafThrottle((clientX, clientY) => {
      // compute distance from center
      const dx = clientX - center.x;
      const dy = clientY - center.y;
      const dist = Math.max(10, Math.sqrt(dx * dx + dy * dy));
      // clamp: assume canvas area maybe 640x480, clamp to reasonable max
      const maxR = Math.min(400, Math.max(50, Math.min(center.x, center.y)));
      const clamped = Math.min(dist, maxR);
      setRadius(clamped);
      // update svg data happens via useEffect
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [center]
  );

  function dragHandleStart(evt) {
    evt.preventDefault();
    setIsDragging(true);
    // capture pointer id for touch
    if (evt.touches && evt.touches[0]) {
      pointerIdRef.current = evt.touches[0].identifier;
    }
    showHint("拖动中：调整半径并观察周长与面积变化。", "observe");
  }

  function dragHandleMove(evt) {
    if (!isDragging) return;
    const p = getPointerPos(evt);
    if (!p) return;
    applyDragMove(p.x, p.y);
    // prevent default touch scroll while dragging
    if (evt.touches) evt.preventDefault();
  }

  function dragHandleEnd(evt) {
    setIsDragging(false);
    pointerIdRef.current = null;
    showHint("已停止拖动。可以继续观察或开始下一步。", "info");
  }

  /* ----------------- Step controller & animations ----------------- */
  const stepsList = [
    { id: 0, key: "intro", title: "介绍与观察" },
    { id: 1, key: "measureCircumference", title: "测量周长（字符串示意）" },
    { id: 2, key: "formulaCircumference", title: "周长公式演示" },
    { id: 3, key: "cutIntoSectors", title: "切成扇形" },
    { id: 4, key: "rearrangeSectors", title: "扇形重排形成矩形近似" },
    { id: 5, key: "formulaArea", title: "面积公式推导" },
    { id: 6, key: "quiz", title: "小测验" },
  ];

  function stepController(dirOrIndex) {
    let nextIndex;
    if (dirOrIndex === "next") nextIndex = Math.min(currentStep + 1, stepsList.length - 1);
    else if (dirOrIndex === "prev") nextIndex = Math.max(currentStep - 1, 0);
    else if (typeof dirOrIndex === "number") nextIndex = Math.max(0, Math.min(dirOrIndex, stepsList.length - 1));
    else return;
    setCurrentStep(nextIndex);
    showHint(`进入步骤：${stepsList[nextIndex].title}`, "guide");

    // Trigger step-specific animations
    if (nextIndex === 1) {
      // measure circumference: animate unwrap string
      animateUnwrapString();
    } else if (nextIndex === 4) {
      animateRearrangeSectors(sectorsCount);
    } else if (nextIndex === 2) {
      // highlight formula
      // simple flash hint
      showHint("高亮公式 C = 2πr，并替换数值。", "guide");
    } else if (nextIndex === 5) {
      showHint("推导面积公式 A = πr²，并展示数值化比较。", "guide");
    }
  }

  function playAnimation() {
    if (isPlaying) return;
    setIsPlaying(true);
    showHint("播放动画。", "info");
  }

  function pauseAnimation() {
    setIsPlaying(false);
    cancelAnimationFrame(rafRef.current);
    animationStateRef.current.active = null;
    showHint("已暂停动画。", "info");
  }

  function resetState() {
    setRadius(50);
    setCenter({ x: 320, y: 240 });
    setSectorsCount(8);
    setPiValue(3.14);
    setCurrentStep(0);
    setIsPlaying(false);
    setIsDragging(false);
    animationStateRef.current.active = null;
    cancelAnimationFrame(rafRef.current);
    showHint("已重置为初始状态。", "info");
  }

  /* ----------------- Animations: Unwrap String ----------------- */
  function animateUnwrapString(duration = 1200) {
    // Simulate taking a polyline along circle and straightening it to a line of length ≈ circumference
    const start = performance.now();
    const startPoints = svgData.stringPolyline.points;
    const centerPt = center;
    const r = radius;
    const C = computeCircumference(r, piValue);

    // build target: straight horizontal line with same number of points
    const n = startPoints.length;
    const targetPoints = [];
    const leftX = centerPt.x - C / 2;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = leftX + C * t;
      const y = centerPt.y; // straight line at center.y
      targetPoints.push({ x, y });
    }

    animationStateRef.current.active = {
      name: "unwrap",
      start,
      duration,
      params: { startPoints, targetPoints },
      onComplete: () => {
        animationStateRef.current.active = null;
        setIsPlaying(false); // stop after demo
        showHint("字符串已被拉直，长度等于圆周。", "conclude");
      },
    };

    function step(now) {
      if (!isMountedRef.current) return;
      const state = animationStateRef.current.active;
      if (!state || state.name !== "unwrap") return;
      const t = Math.min(1, (now - state.start) / state.duration);
      const ease = easeInOutCubic(t);
      // interpolate points
      const interpPoints = state.params.startPoints.map((p, i) => {
        const tp = state.params.targetPoints[i];
        return {
          x: p.x + (tp.x - p.x) * ease,
          y: p.y + (tp.y - p.y) * ease,
        };
      });
      // update svgData with animated polyline
      setSvgData((prev) => ({ ...prev, stringPolyline: { points: interpPoints } }));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        // completed
        state.onComplete && state.onComplete();
      }
    }

    rafRef.current = requestAnimationFrame(step);
  }

  /* ----------------- Animations: Rearrange Sectors ----------------- */
  // The animation will compute transforms for each sector element rather than regenerating path strings
  // Here we set up a per-sector transform map (MainCanvasArea expected to apply transform style)
  function animateRearrangeSectors(n = sectorsCount, duration = 1600) {
    const sectors = generateSectors(n, radius, center);
    // target arrangement: alternate up/down to form approximated rectangle
    // compute width ≈ πr, height ≈ r, so each sector's width ~ (πr)/n*2? But we just arrange sequentially
    const totalWidth = Math.PI * radius; // approximate
    const cellWidth = totalWidth / n;
    const cellHeight = radius;

    // initial transforms: identity
    const startTransforms = sectors.map(() => ({ tx: 0, ty: 0, rot: 0, sx: 1, sy: 1, opacity: 1 }));
    // targets: position x along row, alternated y offset
    const targetTransforms = sectors.map((s, i) => {
      const x = center.x - totalWidth / 2 + cellWidth * (i + 0.5);
      const y = center.y + (i % 2 === 0 ? -cellHeight / 2 : cellHeight / 2);
      // we will translate sector centroid to (x, y) and rotate to 0
      return { tx: x - center.x, ty: y - center.y, rot: 0, sx: 1, sy: 1, opacity: 1 };
    });

    animationStateRef.current.active = {
      name: "rearrange",
      start: performance.now(),
      duration,
      params: { sectors, startTransforms, targetTransforms },
      onComplete: () => {
        animationStateRef.current.active = null;
        setIsPlaying(false);
        showHint(
          `重排完成。矩形近似：长 ≈ πr = ${ (Math.PI * radius).toFixed(2) }，高 ≈ r = ${radius}`,
          "conclude"
        );
      },
      transient: { transforms: startTransforms.slice() },
    };

    function step(now) {
      if (!isMountedRef.current) return;
      const state = animationStateRef.current.active;
      if (!state || state.name !== "rearrange") return;
      const t = Math.min(1, (now - state.start) / state.duration);
      const ease = easeOutCubic(t);
      const transforms = state.params.startTransforms.map((st, i) => {
        const tg = state.params.targetTransforms[i];
        return {
          tx: st.tx + (tg.tx - st.tx) * ease,
          ty: st.ty + (tg.ty - st.ty) * ease,
          rot: st.rot + (tg.rot - st.rot) * ease,
          sx: st.sx + (tg.sx - st.sx) * ease,
          sy: st.sy + (tg.sy - st.sy) * ease,
          opacity: st.opacity + (tg.opacity - st.opacity) * ease,
        };
      });

      // update svgData with new transforms (MainCanvasArea will pick them up)
      setSvgData((prev) => ({
        ...prev,
        sectors: state.params.sectors.map((s, idx) => ({
          ...s,
          __transform: transforms[idx],
        })),
      }));

      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        state.onComplete && state.onComplete();
      }
    }

    rafRef.current = requestAnimationFrame(step);
    showHint("开始将扇形重排列成近似矩形...", "guide");
  }

  /* ----------------- Step animation starter ----------------- */
  function startStepAnimation(stepIndex) {
    // Play relevant animation for the step
    setIsPlaying(true);
    if (stepIndex === 1) {
      animateUnwrapString();
    } else if (stepIndex === 4) {
      animateRearrangeSectors(sectorsCount);
    } else {
      // default: short highlight
      setTimeout(() => {
        setIsPlaying(false);
      }, 700);
    }
  }

  /* ----------------- Sector interactions ----------------- */
  function handleSectorClick(sectorIndex) {
    // highlight selected sector and show arc length & approximated area
    const sectors = generateSectors(sectorsCount, radius, center);
    const s = sectors[sectorIndex];
    if (!s) return;
    const arcLen = s.arcLength;
    const sectorArea = (0.5 * radius * radius * (s.endAngle - s.startAngle));
    showHint(
      `扇形 ${sectorIndex + 1}：弧长 ≈ ${arcLen.toFixed(2)}，面积 ≈ ${sectorArea.toFixed(2)} (px²)`,
      "observe"
    );
    // mark highlight in svg data
    setSvgData((prev) => ({
      ...prev,
      sectors: prev.sectors.map((sec) =>
        sec.index === sectorIndex ? { ...sec, __highlight: true } : { ...sec, __highlight: false }
      ),
    }));
  }

  /* ----------------- Quiz check ----------------- */
  function quizCheck(answer) {
    // simple quiz: given radius r, check C and A
    // expected: answer = { r: number, C: number, A: number }
    const r = Number(answer.r);
    const expectedC = computeCircumference(r, piValue);
    const expectedA = computeArea(r, piValue);
    const okC = Math.abs(Number(answer.C) - expectedC) < 0.1 * Math.max(1, expectedC); // 10% tolerance
    const okA = Math.abs(Number(answer.A) - expectedA) < 0.1 * Math.max(1, expectedA);
    if (okC && okA) {
      showHint("回答正确！周长与面积计算都匹配。", "positive");
      return { ok: true, message: "全部正确" };
    } else {
      const msgs = [];
      if (!okC) msgs.push(`周长应约为 ${expectedC.toFixed(2)}`);
      if (!okA) msgs.push(`面积应约为 ${expectedA.toFixed(2)}`);
      showHint(msgs.join("；"), "corrective");
      return { ok: false, message: msgs.join("；") };
    }
  }

  /* ----------------- Hints ----------------- */
  function showHint(message, level = "info") {
    setHint({ message, level });
    // Optionally inform parent
    if (props.onHint) props.onHint({ message, level });
  }

  /* ----------------- Utility easing ----------------- */
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  /* ----------------- Exported handlers to ToolBar / MainCanvasArea ----------------- */

  // For ToolBar:
  const toolHandlers = {
    onRadiusSliderChange,
    onSectorsSliderChange,
    onPiInputChange,
    onNext: () => stepController("next"),
    onPrev: () => stepController("prev"),
    onPlay: playAnimation,
    onPause: pauseAnimation,
    onReset: resetState,
    onGoStep: (i) => stepController(i),
  };

  // For MainCanvasArea:
  const canvasHandlers = {
    svgData,
    onRadiusHandleDown: dragHandleStart,
    onSectorClick: handleSectorClick,
    onCanvasClick: (evt) => {
      // future expansion: respond to clicks on empty canvas
    },
    // exposes some state for visual highlight mapping
    highlights: {
      circumferenceId: svgData?.highlights?.circumferenceId,
      circumferenceValue: circumference,
      areaValue: area,
      radiusValue: radius,
      piValue,
    },
  };

  /* ----------------- Return: wire to assumed UI components ----------------- */
  return (
    <>
      {/* MainCanvasArea: 负责渲染 svg 元素，根据 svgData 与事件处理回调 */}
      <MainCanvasArea
        svgData={canvasHandlers.svgData}
        onRadiusHandleDown={canvasHandlers.onRadiusHandleDown}
        onSectorClick={canvasHandlers.onSectorClick}
        highlights={canvasHandlers.highlights}
        isDragging={isDragging}
      />

      {/* ToolBar: 负责显示滑块/按钮等控件，接收 handler */}
      <ToolBar
        radius={radius}
        sectorsCount={sectorsCount}
        piValue={piValue}
        onRadiusChange={toolHandlers.onRadiusSliderChange}
        onSectorsChange={toolHandlers.onSectorsSliderChange}
        onPiChange={toolHandlers.onPiInputChange}
        onNext={toolHandlers.onNext}
        onPrev={toolHandlers.onPrev}
        onPlay={toolHandlers.onPlay}
        onPause={toolHandlers.onPause}
        onReset={toolHandlers.onReset}
        currentStep={currentStep}
      />

      {/* HintPanel: 展示引导文本；假定它会使用 aria-live */}
      <HintPanel hint={hint} />
    </>
  );
}

/* ----------------- Notes for Integrators -----------------
- MainCanvasArea should:
  - Draw circle at svgData.circle
  - Draw radius handle at svgData.handle and bind onMouseDown/onTouchStart to onRadiusHandleDown
  - Render sectors from svgData.sectors, read __transform and __highlight for animated transforms and highlighting
  - Render stringPolyline as polyline (svgData.stringPolyline.points)
  - Apply color/highlight based on highlights and hint levels
- ToolBar should expose range inputs and buttons and call provided handlers with numeric values
- HintPanel should render hint.message and set aria-live region for screen readers
- The controller keeps animations and state logic separated from rendering; transforms are provided in __transform fields
- For performance: MainCanvasArea is encouraged to apply CSS transforms to sector groups rather than re-creating path nodes.
----------------------------------------------------------- */