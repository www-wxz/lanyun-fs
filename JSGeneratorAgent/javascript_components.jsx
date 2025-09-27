import React, { useState, useRef, useEffect, useCallback } from "react";

/**
 * CircleGeometryController
 *
 * 这个组件负责管理与绘制圆与扇形的交互逻辑、动画和状态控制。
 * 假设存在三个预先实现的 UI 组件:
 *   - <MainCanvasArea canvasRef={svgContainerRef} />   // 提供一个容器用来挂载 SVG；组件应把 ref 所指向的 DOM 节点渲染到页面上
 *   - <ToolBar {...toolProps} />                      // 提供滑块/输入/按钮，接收回调 props
 *   - <HintPanel hints={hints} />                     // 显示提示信息列表
 *
 * 注意：此文件仅包含交互逻辑与动画控制，不包含具体的 HTML/SVG 样式（由其它 Agent 提供）。
 */

export default function CircleGeometryController() {
  // Public reactive UI state
  const [radius, setRadius] = useState(50);
  const [sectors, setSectors] = useState(12);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [animationProgress, setAnimationProgress] = useState(0); // 0..1
  const [hints, setHints] = useState([]); // [{text, level, id}]

  // Internal refs for DOM and animation control
  const svgContainerRef = useRef(null); // 用于 MainCanvasArea 提供的容器
  const svgRef = useRef(null);
  const circleRef = useRef(null);
  const sectorsGroupRef = useRef(null);
  const radiusLineRef = useRef(null);
  const radiusHandleRef = useRef(null);
  const rafIdRef = useRef(null);
  const animationResolverRef = useRef(null); // 当动画完成时 resolve
  const animQueueRef = useRef([]); // 队列式动画管理
  const draggingRef = useRef(false);
  const dragStartRef = useRef(null);
  const stateRef = useRef({
    radius: 50,
    sectors: 12,
    isPlaying: false,
    currentStep: 0,
    animationProgress: 0,
  });

  // Constraints
  const MIN_RADIUS = 10;
  const MAX_RADIUS = 200;

  // Utility calculations
  const computeCircumference = useCallback((r) => {
    return 2 * Math.PI * r;
  }, []);

  const computeArea = useCallback((r) => {
    return Math.PI * r * r;
  }, []);

  const formatNumber = useCallback((num, decimals = 2) => {
    if (!isFinite(num)) return "—";
    return Number(num).toFixed(decimals);
  }, []);

  // Hint utility
  const showHint = useCallback((text, level = "info") => {
    const id = Date.now() + Math.random();
    const entry = { id, text, level };
    setHints((prev) => [...prev, entry]);
    // keep hints limited
    setTimeout(() => {
      setHints((prev) => prev.filter((h) => h.id !== id));
    }, 15000);
    return id;
  }, []);

  // Initialize SVG and elements
  const init = useCallback(() => {
    const container = svgContainerRef.current;
    if (!container) return;

    // If SVG already exists, clear & reuse
    if (svgRef.current) {
      while (container.firstChild) container.removeChild(container.firstChild);
      svgRef.current = null;
      circleRef.current = null;
      sectorsGroupRef.current = null;
      radiusLineRef.current = null;
      radiusHandleRef.current = null;
    }

    // Create SVG
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", "-250 -150 500 300"); // center at 0,0
    svg.style.touchAction = "none"; // allow touch dragging
    svgRef.current = svg;
    container.appendChild(svg);

    // Groups
    const sectorsGroup = document.createElementNS(svgNS, "g");
    sectorsGroupRef.current = sectorsGroup;
    svg.appendChild(sectorsGroup);

    // Circle main
    const circleMain = document.createElementNS(svgNS, "circle");
    circleMain.setAttribute("cx", "0");
    circleMain.setAttribute("cy", "0");
    circleMain.setAttribute("r", String(stateRef.current.radius));
    circleMain.setAttribute("class", "circle-main");
    circleRef.current = circleMain;
    svg.appendChild(circleMain);

    // Radius line
    const radiusLine = document.createElementNS(svgNS, "line");
    radiusLine.setAttribute("x1", "0");
    radiusLine.setAttribute("y1", "0");
    radiusLine.setAttribute("x2", String(stateRef.current.radius));
    radiusLine.setAttribute("y2", "0");
    radiusLine.setAttribute("class", "radius-line");
    radiusLineRef.current = radiusLine;
    svg.appendChild(radiusLine);

    // Radius handle (small circle at circumference)
    const handle = document.createElementNS(svgNS, "circle");
    handle.setAttribute("cx", String(stateRef.current.radius));
    handle.setAttribute("cy", "0");
    handle.setAttribute("r", "6");
    handle.setAttribute("class", "radius-handle");
    radiusHandleRef.current = handle;
    svg.appendChild(handle);

    // Bind events to handle
    bindEvents();
    // Draw sectors and update values
    drawSectors(stateRef.current.radius, stateRef.current.sectors);
    drawCircle(stateRef.current.radius);
    updateValues();
  }, [bindEvents, drawCircle, drawSectors, updateValues]);

  // Draw circle (main, radius line, handle)
  const drawCircle = useCallback(
    (r) => {
      stateRef.current.radius = r;
      setRadius(r);
      if (!svgRef.current) return;
      if (circleRef.current) circleRef.current.setAttribute("r", String(r));
      if (radiusLineRef.current) {
        radiusLineRef.current.setAttribute("x2", String(r));
        radiusLineRef.current.setAttribute("y2", "0");
      }
      if (radiusHandleRef.current) {
        radiusHandleRef.current.setAttribute("cx", String(r));
        radiusHandleRef.current.setAttribute("cy", "0");
      }
      // update sectors positions because radius changed
      drawSectors(r, stateRef.current.sectors);
      updateValues();
    },
    [drawSectors, updateValues]
  );

  // Draw sectors (simple pie slices)
  const drawSectors = useCallback((r, n) => {
    stateRef.current.sectors = n;
    setSectors(n);
    if (!svgRef.current || !sectorsGroupRef.current) return;
    const svgNS = "http://www.w3.org/2000/svg";
    const g = sectorsGroupRef.current;
    // Clear previous sectors
    while (g.firstChild) g.removeChild(g.firstChild);

    const anglePer = (2 * Math.PI) / n;
    for (let i = 0; i < n; i++) {
      const startAngle = i * anglePer;
      const endAngle = startAngle + anglePer;
      const x1 = r * Math.cos(startAngle);
      const y1 = r * Math.sin(startAngle);
      const x2 = r * Math.cos(endAngle);
      const y2 = r * Math.sin(endAngle);

      // create path for sector (triangle-like with arc)
      const largeArcFlag = anglePer > Math.PI ? 1 : 0;
      const d = [
        `M 0 0`,
        `L ${x1} ${y1}`,
        `A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        `Z`,
      ].join(" ");

      const path = document.createElementNS(svgNS, "path");
      path.setAttribute("d", d);
      path.setAttribute("class", "sector");
      path.setAttribute("data-index", String(i));
      // Assign transform origin at 0,0 by default
      path.style.transformOrigin = "0px 0px";
      g.appendChild(path);
    }
  }, []);

  // Update DOM-displayed numerical values and simple feedback
  const updateValues = useCallback(() => {
    const r = stateRef.current.radius;
    const n = stateRef.current.sectors;
    const circ = computeCircumference(r);
    const area = computeArea(r);

    // update React state for UI
    setAnimationProgress((p) => p); // force potential update
    // We keep radius, sectors in state already via drawCircle/drawSectors

    // Show subtle feedback
    // If circumference approximates sum of sector arc lengths: always true mathematically
    showHint(
      `半径: ${formatNumber(r)}，周长: ${formatNumber(circ)}，面积: ${formatNumber(
        area
      )}`,
      "info"
    );
  }, [computeArea, computeCircumference, formatNumber, showHint]);

  // Drag handling
  const onDragStart = useCallback((evt) => {
    evt.preventDefault();
    draggingRef.current = true;
    // Pause playing while dragging
    if (isPlaying) {
      setIsPlaying(false);
      stateRef.current.isPlaying = false;
    }
    showHint("拖动以改变半径", "hint");
  }, [isPlaying, showHint]);

  const getEvtPoint = (evt) => {
    // support mouse or touch
    const point = { x: 0, y: 0 };
    if (evt.touches && evt.touches[0]) {
      point.x = evt.touches[0].clientX;
      point.y = evt.touches[0].clientY;
    } else {
      point.x = evt.clientX;
      point.y = evt.clientY;
    }
    return point;
  };

  const svgClientToSvgCoords = (clientX, clientY) => {
    // convert client coordinates to SVG coordinates
    if (!svgRef.current) return { x: 0, y: 0 };
    const pt = svgRef.current.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const inv = ctm.inverse();
    const svgP = pt.matrixTransform(inv);
    return { x: svgP.x, y: svgP.y };
  };

  const onDragRadius = useCallback(
    (evt) => {
      if (!draggingRef.current) return;
      evt.preventDefault();
      const clientPoint = getEvtPoint(evt);
      const svgP = svgClientToSvgCoords(clientPoint.x, clientPoint.y);
      // radius equals distance from origin (0,0)
      let newR = Math.sqrt(svgP.x * svgP.x + svgP.y * svgP.y);
      // clamp
      newR = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, newR));
      // update state + redraw
      drawCircle(newR);
      showHint("已更新半径，观察数值如何变化。", "info");
    },
    [drawCircle, showHint]
  );

  const onDragEnd = useCallback((evt) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    showHint("拖动结束", "info");
  }, [showHint]);

  // Bind dragging to handle and document
  const bindEvents = useCallback(() => {
    const handle = radiusHandleRef.current;
    const svg = svgRef.current;
    if (!handle || !svg) return;

    // Pointer events could unify, but follow mousedown/touchstart per spec
    const onHandleDown = (e) => {
      onDragStart(e);
    };

    const onDocumentMove = (e) => {
      onDragRadius(e);
    };

    const onDocumentUp = (e) => {
      onDragEnd(e);
    };

    handle.addEventListener("mousedown", onHandleDown, { passive: false });
    handle.addEventListener("touchstart", onHandleDown, { passive: false });

    document.addEventListener("mousemove", onDocumentMove, { passive: false });
    document.addEventListener("touchmove", onDocumentMove, { passive: false });

    document.addEventListener("mouseup", onDocumentUp, { passive: false });
    document.addEventListener("touchend", onDocumentUp, { passive: false });

    // cleanup function in case of rebind
    return () => {
      handle.removeEventListener("mousedown", onHandleDown);
      handle.removeEventListener("touchstart", onHandleDown);
      document.removeEventListener("mousemove", onDocumentMove);
      document.removeEventListener("touchmove", onDocumentMove);
      document.removeEventListener("mouseup", onDocumentUp);
      document.removeEventListener("touchend", onDocumentUp);
    };
  }, [onDragEnd, onDragRadius, onDragStart]);

  // Animation manager with a single RAF loop
  const runRafLoop = useCallback(() => {
    if (rafIdRef.current) return; // already running
    let lastTime = performance.now();

    const loop = (time) => {
      const dt = time - lastTime;
      lastTime = time;
      // process current animation step if any
      const currentAnim = animQueueRef.current[0];
      if (currentAnim) {
        const { start, duration, tick, onDone } = currentAnim;
        const t = Math.min(1, (time - start) / duration);
        try {
          tick(t);
        } catch (err) {
          console.error("tick error", err);
        }
        if (t >= 1) {
          // finish this anim
          try {
            onDone && onDone();
          } catch (err) {
            console.error("onDone error", err);
          }
          animQueueRef.current.shift();
        }
      } else {
        // idle: stop loop to save CPU
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
        return;
      }
      rafIdRef.current = requestAnimationFrame(loop);
    };

    rafIdRef.current = requestAnimationFrame(loop);
  }, []);

  const enqueueAnimation = useCallback((tick, duration = 800) => {
    // tick: (t:0..1) => void
    // returns a Promise that resolves when finished
    return new Promise((resolve) => {
      const now = performance.now();
      const anim = {
        start: now,
        duration,
        tick,
        onDone: resolve,
      };
      animQueueRef.current.push(anim);
      runRafLoop();
    });
  }, [runRafLoop]);

  // Unwrap animation: 将扇形沿 x 轴展开成一条接近周长的折线
  const animateUnwrap = useCallback(() => {
    if (!sectorsGroupRef.current) return Promise.resolve();
    const g = sectorsGroupRef.current;
    const paths = Array.from(g.querySelectorAll("path.sector"));
    const n = paths.length;
    if (n === 0) return Promise.resolve();

    // Prepare: compute each sector arc length (approx)
    const r = stateRef.current.radius;
    const arcLenPer = (2 * Math.PI * r) / n;
    // Create clones for animation to avoid disturbing original
    const clones = paths.map((p) => {
      const clone = p.cloneNode(true);
      clone.setAttribute("class", "sector-unwrapped");
      svgRef.current.appendChild(clone);
      return clone;
    });

    // hide original sectors during animation
    paths.forEach((p) => p.classList.add("dimmed"));

    // target positions: arrange sequentially along x axis centered vertically
    const totalLength = arcLenPer * n;
    // We'll map each sector to a rectangle-like segment of width = arcLenPer and height ~ r
    let offset = -totalLength / 2;
    const targets = clones.map((c, i) => {
      const x = offset + i * arcLenPer;
      offset += 0; // already using i
      // We'll place each clone at (x + arcLenPer/2, -r/2) with rotation 0
      return { tx: x + arcLenPer * 0.5, ty: -r * 0.5, rot: 0 };
    });

    const duration = 1200;
    // animate using enqueueAnimation
    return enqueueAnimation((t) => {
      // easing (easeInOutQuad)
      const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      setAnimationProgress(e);
      clones.forEach((c, i) => {
        const target = targets[i];
        // starting transform: identity; ending transform: translate(target.tx * scale, target.ty) rotate
        const tx = target.tx * 1; // no additional scale
        const ty = target.ty;
        // interpolation
        const curTx = tx * e;
        const curTy = ty * e;
        const transform = `translate(${curTx} ${curTy}) rotate(${target.rot * e})`;
        c.setAttribute("transform", transform);
        // highlight when nearly positioned
        if (e > 0.9 && i === Math.floor(n / 2)) {
          c.classList.add("highlight");
          showHint("展开接近完成：观察线段总长度接近 2πr", "hint");
        } else {
          c.classList.remove("highlight");
        }
      });
    }, duration).then(() => {
      // after animation cleanup
      // compute total line length and show hint
      const circ = computeCircumference(r);
      showHint(`展开完成：展开线段总长 ≈ ${formatNumber(circ)}（2πr）`, "answer");
      // remove clones after short delay
      setTimeout(() => {
        clones.forEach((c) => c.parentNode && c.parentNode.removeChild(c));
        paths.forEach((p) => p.classList.remove("dimmed"));
      }, 300);
    });
  }, [computeCircumference, enqueueAnimation, formatNumber, showHint]);

  // Rearrange sectors: move sectors into two rows alternating to suggest rectangle with base ~ πr and height ~ r
  const animateRearrangeSectors = useCallback(() => {
    if (!sectorsGroupRef.current) return Promise.resolve();
    const g = sectorsGroupRef.current;
    const paths = Array.from(g.querySelectorAll("path.sector"));
    const n = paths.length;
    if (n === 0) return Promise.resolve();
    const r = stateRef.current.radius;
    const arcLenPer = (2 * Math.PI * r) / n;
    // choose two rows target positions
    const cols = Math.ceil(n / 2);
    const baseWidth = arcLenPer * cols; // approx πr
    const spacing = 2; // small spacing between pieces

    // animate each original path by applying transforms
    const duration = 1000;
    return enqueueAnimation((t) => {
      const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      setAnimationProgress(e);
      paths.forEach((p, i) => {
        const row = i % 2; // 0 or 1
        const col = Math.floor(i / 2);
        // target x centered
        const tx = -baseWidth / 2 + col * (arcLenPer + spacing) + arcLenPer / 2;
        const ty = row === 0 ? -r * 0.5 : r * 0.5;
        // interpolation (move from original to target)
        // original position is at origin (each sector path drawn around origin), so transform to target
        const curTx = tx * e;
        const curTy = ty * e;
        p.setAttribute("transform", `translate(${curTx} ${curTy}) rotate(${(90 * (1 - e))})`);
        // highlight center connections when nearly done
        if (e > 0.85 && i === 0) {
          p.classList.add("highlight");
        } else {
          p.classList.remove("highlight");
        }
      });
      // display convergence hint mid animation
      if (e > 0.6 && e < 0.62) {
        showHint("重排后看底边长度接近 πr，高接近 r，扇形数越多收敛越明显。", "hint");
      }
    }, duration).then(() => {
      // finalize
      showHint(
        `重排完成：底边 ≈ ${formatNumber(Math.PI * r)} (πr)，高度 ≈ ${formatNumber(r)}。`,
        "answer"
      );
    });
  }, [enqueueAnimation, formatNumber, showHint]);

  // Play step sequence: step 0 = show circle, step 1 = unwrap, step 2 = rearrange
  const playStepSequence = useCallback(async () => {
    if (isPlaying) {
      // stop
      setIsPlaying(false);
      stateRef.current.isPlaying = false;
      return;
    }
    setIsPlaying(true);
    stateRef.current.isPlaying = true;
    showHint("开始自动演示", "info");

    let step = stateRef.current.currentStep;
    while (stateRef.current.isPlaying && step <= 2) {
      setCurrentStep(step);
      stateRef.current.currentStep = step;
      if (step === 0) {
        showHint("步骤 0：观察圆与其数值。", "hint");
        // small pause
        await enqueueAnimation((t) => {
          // just wait animation progress to show idle progress
          setAnimationProgress(t);
        }, 600);
      } else if (step === 1) {
        await animateUnwrap();
      } else if (step === 2) {
        await animateRearrangeSectors();
      }
      // auto advance
      if (!stateRef.current.isPlaying) break;
      step += 1;
      stateRef.current.currentStep = step;
      setCurrentStep(step);
      // small inter-step pause
      await enqueueAnimation((t) => {}, 300);
    }
    setIsPlaying(false);
    stateRef.current.isPlaying = false;
    showHint("自动演示结束", "info");
  }, [animateRearrangeSectors, animateUnwrap, enqueueAnimation, isPlaying, showHint]);

  // goto a specific step
  const gotoStep = useCallback(
    (stepIndex) => {
      const step = Math.max(0, Math.min(2, stepIndex));
      setCurrentStep(step);
      stateRef.current.currentStep = step;
      showHint(`切换到步骤 ${step}`, "info");
      // immediate effect: highlight related elements
      if (step === 0) {
        // restore original transforms
        const g = sectorsGroupRef.current;
        if (g) {
          Array.from(g.querySelectorAll("path.sector")).forEach((p) => {
            p.setAttribute("transform", "");
            p.classList.remove("highlight", "dimmed");
          });
        }
      } else if (step === 1) {
        // start unwrap animation but do not set isPlaying (it's a manual step)
        animateUnwrap();
      } else if (step === 2) {
        animateRearrangeSectors();
      }
    },
    [animateRearrangeSectors, animateUnwrap, showHint]
  );

  // Handlers for toolbar controls (expected to be wired by ToolBar component)
  const onRadiusSliderChange = useCallback((val) => {
    // val assumed numeric
    let newR = Number(val);
    if (isNaN(newR)) return;
    newR = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, newR));
    drawCircle(newR);
    showHint("使用滑块更改半径", "info");
  }, [drawCircle, showHint]);

  const onRadiusInputChange = useCallback((val) => {
    let newR = Number(val);
    if (isNaN(newR)) {
      showHint("输入无效，请输入数字", "warning");
      return;
    }
    newR = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, newR));
    drawCircle(newR);
    showHint("已应用输入的半径", "info");
  }, [drawCircle, showHint]);

  const onSectorsRangeChange = useCallback((val) => {
    let n = parseInt(val, 10);
    if (isNaN(n) || n < 2) n = 2;
    setSectors(n);
    stateRef.current.sectors = n;
    drawSectors(stateRef.current.radius, n);
    showHint("改变扇形数量以观察收敛性", "info");
  }, [drawSectors, showHint]);

  const onNextStep = useCallback(() => {
    gotoStep(stateRef.current.currentStep + 1);
  }, [gotoStep]);

  const onPrevStep = useCallback(() => {
    gotoStep(stateRef.current.currentStep - 1);
  }, [gotoStep]);

  const onPlayPause = useCallback(() => {
    playStepSequence();
  }, [playStepSequence]);

  const onReset = useCallback(() => {
    // reset to defaults
    const defaultState = { radius: 50, sectors: 12, isPlaying: false, currentStep: 0 };
    stateRef.current = { ...stateRef.current, ...defaultState };
    setRadius(defaultState.radius);
    setSectors(defaultState.sectors);
    setIsPlaying(false);
    setCurrentStep(0);
    drawCircle(defaultState.radius);
    drawSectors(defaultState.radius, defaultState.sectors);
    setHints([]);
    showHint("已重置为默认状态", "info");
  }, [drawCircle, drawSectors, showHint]);

  const onToggleFormula = useCallback((checked) => {
    // For UI only: show/hide overlay; here we simply show a hint
    showHint(checked ? "显示公式覆盖" : "隐藏公式覆盖", "info");
  }, [showHint]);

  // Initialize on mount
  useEffect(() => {
    init();
    // cleanup on unmount
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      // remove svg if present
      const container = svgContainerRef.current;
      if (container) {
        while (container.firstChild) container.removeChild(container.firstChild);
      }
      // remove document event listeners (if any are still referenced)
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expose toolbar props
  const toolProps = {
    radius,
    sectors,
    isPlaying,
    currentStep,
    animationProgress,
    onRadiusSliderChange,
    onRadiusInputChange,
    onSectorsRangeChange,
    onNextStep,
    onPrevStep,
    onPlayPause,
    onReset,
    onToggleFormula,
    minRadius: MIN_RADIUS,
    maxRadius: MAX_RADIUS,
  };

  // Render UI hooks into higher-level components (no raw HTML / CSS here)
  // The MainCanvasArea is expected to accept canvasRef prop (or 'containerRef') so we can mount our SVG.
  return (
    <>
      <MainCanvasArea canvasRef={svgContainerRef} />
      <ToolBar {...toolProps} />
      <HintPanel hints={hints} />
    </>
  );
}