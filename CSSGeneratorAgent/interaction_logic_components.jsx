import React, { useState, useRef, useEffect, useCallback } from "react";

/*
  InteractiveParallelogramLogic
  - React 交互逻辑组件（仅包含逻辑，不包含样式）
  - 假设存在 UI 组件：<MainCanvasArea />, <ToolBar />, <HintPanel />
  - 提供独立函数以便后续扩展
*/

/* -------------------- 辅助向量函数 -------------------- */
const vec = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1]],
  mul: (a, k) => [a[0] * k, a[1] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1],
  len: (a) => Math.hypot(a[0], a[1]),
  normalize: (a) => {
    const l = Math.hypot(a[0], a[1]) || 1;
    return [a[0] / l, a[1] / l];
  },
  perp: (a) => [-a[1], a[0]],
};

/* -------------------- 缓动函数 -------------------- */
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/* -------------------- 面积计算与推导函数 -------------------- */
/** 计算平行四边形以边 [v0,v1] 为底时的高度和面积 */
function computeBaseHeightArea(verts, baseIndex = 0, nextIndex = 1) {
  const a = verts[baseIndex];
  const b = verts[nextIndex];
  // 选取对边上的任意一点 p（取第三点）
  const p = verts[(baseIndex + 2) % 4];

  const baseVec = vec.sub(b, a);
  const baseLen = vec.len(baseVec);
  // 高度是点 p 到直线 ab 的距离： |(p-a) × baseUnit| = |cross|/|base|
  const ap = vec.sub(p, a);
  // 2D cross product magnitude
  const cross = Math.abs(ap[0] * baseVec[1] - ap[1] * baseVec[0]);
  const height = baseLen === 0 ? 0 : cross / baseLen;
  const area = baseLen * height;

  return { baseLen, height, area, baseVec, cross };
}

/* -------------------- 动画步骤/推导内容 -------------------- */
const derivationSteps = [
  "选择一条边作为底 b",
  "在底上作出与对边平行的高 h",
  "平行四边形面积等于底 b 乘以高 h",
  "公式：面积 = b × h",
];

/* -------------------- 主逻辑组件 -------------------- */
export default function ParallelogramInteraction() {
  // 顶点数组（默认为一个简单平行四边形）
  const [verts, setVerts] = useState([
    [150, 100],
    [320, 120],
    [270, 240],
    [120, 220],
  ]);

  // 被拖拽的顶点索引，-1 表示未拖拽
  const [dragIndex, setDragIndex] = useState(-1);

  // 拖拽偏移（避免顶点跳跃）
  const dragOffsetRef = useRef([0, 0]);

  // 动画控制
  const [isAnimating, setIsAnimating] = useState(false);
  const animRef = useRef({ rafId: null, startTime: 0, duration: 1200, fromVerts: null, toVerts: null });

  // 逐步推导索引
  const [stepIndex, setStepIndex] = useState(0);

  // 高亮/闪烁状态（用于提示）
  const [highlight, setHighlight] = useState({ vertices: [], edges: [], flash: false });

  // 标签（面积、底、height）实时文本
  const [labels, setLabels] = useState({
    base: "",
    height: "",
    area: "",
  });

  // 闪烁定时器引用
  const flashRef = useRef({ intervalId: null, on: false });

  // Canvas ref 供 MainCanvasArea 使用或事件监听
  const canvasRef = useRef(null);

  /* -------------------- 事件绑定：拖拽逻辑 -------------------- */
  // pointerDown: 开始拖拽顶点
  function onVertexPointerDown(index, clientX, clientY) {
    setDragIndex(index);
    const v = verts[index];
    dragOffsetRef.current = [v[0] - clientX, v[1] - clientY];
    // 高亮此顶点
    setHighlight((h) => ({ ...h, vertices: [index], flash: false }));
  }

  // pointerMove: 拖拽时更新顶点
  const onPointerMove = useCallback(
    (clientX, clientY) => {
      if (dragIndex === -1) return;
      const offset = dragOffsetRef.current;
      const newPos = [clientX + offset[0], clientY + offset[1]];
      setVerts((prev) => {
        const next = prev.map((p) => [...p]);
        next[dragIndex] = newPos;
        // 若拖拽的是平行关系约束的顶点，可在此处实现约束（例如保持对边平行）
        return next;
      });
    },
    [dragIndex]
  );

  // pointerUp: 结束拖拽
  function onPointerUp() {
    setDragIndex(-1);
    // 更新标签和高亮
    updateDerivedLabels();
    setHighlight((h) => ({ ...h, vertices: [], flash: false }));
  }

  /* -------------------- 绑定原生指针事件（可扩展到 MainCanvasArea 内） -------------------- */
  useEffect(() => {
    function down(e) {
      // 这里并不知道点击的是哪个顶点，实际项目中 MainCanvasArea 会在每个顶点元素上调用 onVertexPointerDown。
      // 但为安全起见，我们监听全局 mouseup 以结束拖拽。
    }
    function up() {
      onPointerUp();
    }
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchend", up);
    };
  }, []);

  /* -------------------- 面积、底、高度标签更新 -------------------- */
  function updateDerivedLabels(baseIndex = 0, nextIndex = 1) {
    const { baseLen, height, area } = computeBaseHeightArea(verts, baseIndex, nextIndex);
    setLabels({
      base: `b = ${baseLen.toFixed(1)}`,
      height: `h = ${height.toFixed(1)}`,
      area: `S = ${area.toFixed(1)}`,
    });
  }

  // 初始化标签
  useEffect(() => {
    updateDerivedLabels();
  }, []); // 组件挂载初始化一次

  // 当顶点改变时，实时更新标签（但节流以避免频繁 setState：这里简单直接更新）
  useEffect(() => {
    updateDerivedLabels();
  }, [verts]);

  /* -------------------- 动画：从当前形状平滑过渡到目标形状 -------------------- */
  function animateTo(targetVerts, duration = 1000) {
    if (!Array.isArray(targetVerts) || targetVerts.length !== verts.length) return;
    cancelAnimation();
    const start = performance.now();
    animRef.current = {
      rafId: null,
      startTime: start,
      duration,
      fromVerts: verts.map((v) => [...v]),
      toVerts: targetVerts.map((v) => [...v]),
    };
    setIsAnimating(true);

    function step(now) {
      const { startTime, duration, fromVerts, toVerts } = animRef.current;
      const t = Math.min(1, (now - startTime) / duration);
      const e = easeInOutCubic(t);
      const interpolated = fromVerts.map((fv, i) => {
        const tv = toVerts[i];
        return [fv[0] + (tv[0] - fv[0]) * e, fv[1] + (tv[1] - fv[1]) * e];
      });
      setVerts(interpolated);
      if (t < 1) {
        animRef.current.rafId = requestAnimationFrame(step);
      } else {
        setIsAnimating(false);
        animRef.current.rafId = null;
        animRef.current.fromVerts = null;
        animRef.current.toVerts = null;
      }
    }
    animRef.current.rafId = requestAnimationFrame(step);
  }

  function cancelAnimation() {
    if (animRef.current.rafId) {
      cancelAnimationFrame(animRef.current.rafId);
      animRef.current.rafId = null;
    }
    setIsAnimating(false);
  }

  /* -------------------- 播放/暂停/步骤控制 -------------------- */
  function playAutoDerivation() {
    // 自动播放推导动画：依次高亮、显示文字、闪烁
    setIsAnimating(true);
    setStepIndex(0);
    // 使用一个简单的时间线：每步持续 duration ms
    const totalSteps = derivationSteps.length;
    const stepDur = 1200;
    let start = performance.now();

    function loop(now) {
      const elapsed = now - start;
      const curStep = Math.min(totalSteps - 1, Math.floor(elapsed / stepDur));
      setStepIndex(curStep);

      // 设置高亮（例如高亮底边在第0-1步，高亮高度第1-2步）
      if (curStep === 0) {
        setHighlight({ vertices: [0, 1], edges: [0], flash: false });
      } else if (curStep === 1) {
        setHighlight({ vertices: [], edges: [2], flash: true });
      } else {
        setHighlight({ vertices: [], edges: [], flash: false });
      }

      if (elapsed < totalSteps * stepDur) {
        animRef.current.rafId = requestAnimationFrame(loop);
      } else {
        setIsAnimating(false);
        animRef.current.rafId = null;
      }
    }
    animRef.current.rafId = requestAnimationFrame(loop);
  }

  function pauseAutoDerivation() {
    cancelAnimation();
    setIsAnimating(false);
  }

  function stepForward() {
    setStepIndex((s) => Math.min(derivationSteps.length - 1, s + 1));
    // 更新高亮基于 stepIndex
    setHighlight((h) => {
      const next = Math.min(derivationSteps.length - 1, stepIndex + 1);
      if (next === 0) return { vertices: [0, 1], edges: [0], flash: false };
      if (next === 1) return { vertices: [], edges: [2], flash: true };
      return { vertices: [], edges: [], flash: false };
    });
  }

  function stepBackward() {
    setStepIndex((s) => Math.max(0, s - 1));
    setHighlight((h) => {
      const prev = Math.max(0, stepIndex - 1);
      if (prev === 0) return { vertices: [0, 1], edges: [0], flash: false };
      if (prev === 1) return { vertices: [], edges: [2], flash: true };
      return { vertices: [], edges: [], flash: false };
    });
  }

  /* -------------------- 闪烁控制（用于持续提示） -------------------- */
  function startFlashing(interval = 500) {
    if (flashRef.current.intervalId) return;
    let on = false;
    flashRef.current.intervalId = setInterval(() => {
      on = !on;
      setHighlight((h) => ({ ...h, flash: on }));
    }, interval);
    flashRef.current.on = true;
  }

  function stopFlashing() {
    if (flashRef.current.intervalId) {
      clearInterval(flashRef.current.intervalId);
      flashRef.current.intervalId = null;
      flashRef.current.on = false;
      setHighlight((h) => ({ ...h, flash: false }));
    }
  }

  /* -------------------- 常用动作函数（独立） -------------------- */
  // 重置为默认平行四边形
  function resetToDefault() {
    cancelAnimation();
    const defaultVerts = [
      [150, 100],
      [320, 120],
      [270, 240],
      [120, 220],
    ];
    setVerts(defaultVerts);
    setStepIndex(0);
    setHighlight({ vertices: [], edges: [], flash: false });
    updateDerivedLabels();
  }

  // 将当前图形“镜像”到矩形（示范动画）
  function morphToRectangle() {
    // 将 verts 转换为基于 v0-v1 底边并使对边平行且垂直
    const v0 = verts[0];
    const v1 = verts[1];
    const baseVec = vec.sub(v1, v0);
    const baseUnit = vec.normalize(baseVec);
    const heightDir = vec.perp(baseUnit); // 垂直方向
    const { height, baseLen } = computeBaseHeightArea(verts, 0, 1);
    const toVerts = [
      v0,
      v1,
      vec.add(v1, vec.mul(heightDir, height)),
      vec.add(v0, vec.mul(heightDir, height)),
    ];
    animateTo(toVerts, 800);
  }

  // 将顶点按网格吸附（示例）
  function snapToGrid(gridSize = 10) {
    setVerts((prev) => prev.map((p) => [Math.round(p[0] / gridSize) * gridSize, Math.round(p[1] / gridSize) * gridSize]));
  }

  /* -------------------- 标签跟随：计算标签位置 -------------------- */
  function computeLabelPositions() {
    // 底边中点、从对边作高的中点位置等
    const a = verts[0];
    const b = verts[1];
    const c = verts[2];
    // 中点
    const midBase = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

    // 高线投影点：将点 c 投影到 ab
    const ab = vec.sub(b, a);
    const t = vec.dot(vec.sub(c, a), ab) / (vec.dot(ab, ab) || 1);
    const proj = vec.add(a, vec.mul(ab, t));
    // 高线中点（c 与其投影的中点）
    const midHeight = [(c[0] + proj[0]) / 2, (c[1] + proj[1]) / 2];

    return { base: midBase, height: midHeight, area: [(a[0] + c[0]) / 2 + 10, (a[1] + c[1]) / 2] };
  }

  /* -------------------- 外抛事件/回调（供 MainCanvasArea 使用） -------------------- */
  // 用于在 Canvas 的顶点元素上绑定 pointer down
  function vertexPointerDownHandler(index) {
    return (e) => {
      // 防止默认滚动/选择
      e.preventDefault();
      const clientX = e.clientX ?? (e.touches && e.touches[0].clientX);
      const clientY = e.clientY ?? (e.touches && e.touches[0].clientY);
      onVertexPointerDown(index, clientX, clientY);
    };
  }

  // 在全局或 Canvas 上监听 pointer move（用于拖拽）
  useEffect(() => {
    function move(e) {
      if (dragIndex === -1) return;
      const clientX = e.clientX ?? (e.touches && e.touches[0].clientX);
      const clientY = e.clientY ?? (e.touches && e.touches[0].clientY);
      onPointerMove(clientX, clientY);
    }
    window.addEventListener("mousemove", move);
    window.addEventListener("touchmove", move, { passive: false });
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("touchmove", move);
    };
  }, [dragIndex, onPointerMove]);

  /* -------------------- 导出状态与回调（传给 UI 组件） -------------------- */
  const labelPositions = computeLabelPositions();
  const derived = computeBaseHeightArea(verts, 0, 1);

  /* -------------------- 渲染：只输出逻辑相关 props（不包含样式） -------------------- */
  return (
    <>
      {/* MainCanvasArea 接收顶点、标签、以及交互回调（UI 组件负责绘制与样式） */}
      <MainCanvasArea
        ref={canvasRef}
        verts={verts}
        // 提供每个顶点的 pointerdown 回调
        onVertexPointerDown={(index) => vertexPointerDownHandler(index)}
        // 也提供通用 pointer handlers
        onPointerUp={onPointerUp}
        // 高亮信息（UI 用以改变颜色或闪烁）
        highlight={highlight}
        // 标签与位置
        labels={labels}
        labelPositions={labelPositions}
        // 当需要播放一步动画（例如：突出显示某条边）时，MainCanvasArea 可使用这些 props
        isAnimating={isAnimating}
        derivationStep={stepIndex}
        // 额外导出计算数据（base, height, area），供 UI 层显示详细推导
        derivedData={{ base: derived.baseLen, height: derived.height, area: derived.area }}
      />

      {/* ToolBar 仅接收控制函数（UI 组件负责渲染按钮） */}
      <ToolBar
        onPlay={() => playAutoDerivation()}
        onPause={() => pauseAutoDerivation()}
        onStepForward={() => stepForward()}
        onStepBackward={() => stepBackward()}
        onReset={() => resetToDefault()}
        onMorphRectangle={() => morphToRectangle()}
        onSnapGrid={() => snapToGrid(10)}
        onStartFlash={() => startFlashing(400)}
        onStopFlash={() => stopFlashing()}
        isAnimating={isAnimating}
      />

      {/* HintPanel 提供逐步推导文本与当前状态（UI 负责样式） */}
      <HintPanel
        currentStepText={derivationSteps[stepIndex]}
        stepIndex={stepIndex}
        totalSteps={derivationSteps.length}
        labels={labels}
        derivedData={{ base: derived.baseLen, height: derived.height, area: derived.area }}
      />
    </>
  );
}

/* -------------------- 说明（供开发者参考） --------------------
1) 每个交互功能被实现为独立函数，方便测试与扩展：
   - onVertexPointerDown / onPointerMove / onPointerUp: 拖拽逻辑
   - animateTo / cancelAnimation: 平滑过渡动画
   - playAutoDerivation / pauseAutoDerivation / stepForward / stepBackward: 逐步推导播放
   - startFlashing / stopFlashing: 闪烁提示
   - resetToDefault / morphToRectangle / snapToGrid: 常用动作

2) 组件假设 MainCanvasArea、ToolBar、HintPanel 三个 UI 组件会按约定使用传入的 props：
   - MainCanvasArea: 负责绘制 verts 和响应具体 pointer 事件（或使用传入回调）
   - ToolBar: 负责渲染控制按钮并调用相应回调
   - HintPanel: 展示推导步骤与 labels

3) 未包含任何静态样式或教师反馈逻辑（由 TeachingFeedbackAgent 负责），纯粹是交互逻辑实现。
----------------------------------------------------------------- */