import React, { useState } from "react";

/**
 * UIdesignAgent - 教学演示页面（UI only）
 * 说明：
 * - 使用 TailwindCSS 进行样式（请在项目中已配置 Tailwind）
 * - 只包含 UI 结构与样式，交互事件只做最小状态管理并通过回调暴露，动画逻辑由 InteractiveLogicAgent 负责接入
 *
 * 组件：
 * - HeaderNav
 * - MainCanvasArea
 * - ToolBar
 * - HintPanel
 *
 * 备注（可扩展点）：
 * - 所有控制按钮都通过 props 回调(onStart/onPause/onReset/...) 暴露
 * - MainCanvasArea 提供 containerRef 与 ARIA 标签，便于后续挂载动画或 SVG
 */

/* -------------------------
   HeaderNav
   ------------------------- */
function HeaderNav({ title, stepLabel }) {
  return (
    <header className="w-full bg-gradient-to-r from-blue-100 to-green-50 border-b border-blue-200">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-blue-800" style={{ fontSize: "18px" }}>
            {title}
          </h1>
          <p className="text-sm text-blue-600 mt-0.5" style={{ fontSize: "14px" }}>
            {stepLabel}
          </p>
        </div>

        <div className="text-sm text-blue-700">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-white shadow-sm">
            适用年级: 5～6年级
          </span>
        </div>
      </div>
    </header>
  );
}

/* -------------------------
   MainCanvasArea
   - 画布区主体，带网格背景、边框
   - 支持高对比模式（通过 prop）
   - 提供 aria-label 与 aria-live
   ------------------------- */
function MainCanvasArea({ showGrid, highContrast, children }) {
  // grid background style - subtle, suitable for educational geometry observation
  const gridColor = highContrast ? "rgba(0,0,0,0.6)" : "rgba(120,140,200,0.12)";
  const gridBg = `
    linear-gradient(0deg, ${gridColor} 1px, transparent 1px),
    linear-gradient(90deg, ${gridColor} 1px, transparent 1px)
  `;
  const gridSize = "32px";

  return (
    <main
      role="region"
      aria-label="几何动画演示区"
      aria-describedby="canvas-help"
      aria-live="polite"
      tabIndex={0}
      className={`flex-1 mx-auto max-w-5xl w-full p-4 transition-colors duration-200`}
    >
      <div
        className={`relative rounded-xl overflow-hidden border-2 ${
          highContrast ? "border-black bg-yellow-50" : "border-blue-200 bg-white"
        } shadow-md h-[56vh] md:h-[64vh] flex items-center justify-center`}
        style={{
          // center content and set grid background if showGrid
          backgroundImage: showGrid ? gridBg : undefined,
          backgroundSize: showGrid ? `${gridSize} ${gridSize}` : undefined,
          backgroundColor: highContrast ? "#fff8db" : "#fbfdff",
        }}
      >
        {/* Placeholder area where InteractiveLogicAgent can mount SVG/Canvas */}
        <div
          id="main-canvas"
          aria-label="主动画画布，后续在此挂载 SVG 或 Canvas 进行几何演示"
          className="w-full h-full flex items-center justify-center"
        >
          {/* Minimal placeholder illustration: friendly geometric card */}
          <div
            className={`pointer-events-none select-none text-center px-6 py-8 rounded-lg ${
              highContrast ? "bg-black text-white/95" : "bg-white/80"
            } border ${
              highContrast ? "border-white/60" : "border-dashed border-blue-100"
            } mx-4`}
            style={{ maxWidth: 640 }}
          >
            <div className="text-xl font-semibold mb-2" style={{ fontSize: "18px" }}>
              几何演示区
            </div>
            <div className="text-sm text-gray-600" id="canvas-help" style={{ fontSize: "14px" }}>
              在这里会显示平行四边形与三角形、梯形的动态演示。使用底部与左右控件开始/控制动画。
            </div>
          </div>
        </div>

        {/* subtle corner label */}
        <div className="absolute left-3 top-3 text-xs px-2 py-1 rounded bg-white/70 text-gray-700 border">
          网格: {showGrid ? "显示" : "隐藏"}
        </div>
      </div>
    </main>
  );
}

/* -------------------------
   ToolBar
   - 左/右 简化工具栏（这里以底部为主、左右为快捷）
   - 支持 keyboard focus（使用 native <button>）
   ------------------------- */
function ToolBar({
  isPlaying,
  isPaused,
  onStart = () => {},
  onPause = () => {},
  onReset = () => {},
  onNext = () => {},
  onPrev = () => {},
  speed,
  onSpeedChange = () => {},
  showGrid,
  onToggleGrid = () => {},
  base,
  height,
  onBaseChange = () => {},
  onHeightChange = () => {},
  teacherMode,
  onToggleTeacherMode = () => {},
  showHint,
  onToggleHint = () => {},
  onHighContrastToggle = () => {},
  highContrast,
}) {
  return (
    <div className="w-full bg-gradient-to-t from-white to-blue-50 border-t border-blue-100">
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col md:flex-row items-center gap-3">
        {/* Left group: major controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={onStart}
            aria-label="开始动画"
            className="bg-blue-500 hover:bg-blue-600 focus:ring-2 focus:ring-blue-300 text-white rounded-lg px-4 py-2 text-lg leading-5 shadow-md"
          >
            Start
          </button>

          <button
            onClick={onPause}
            aria-pressed={isPaused}
            aria-label={isPaused ? "继续动画" : "暂停动画"}
            className="bg-yellow-400 hover:bg-yellow-500 focus:ring-2 focus:ring-yellow-200 text-black rounded-lg px-4 py-2 text-lg leading-5 shadow-md"
          >
            {isPaused ? "Resume" : "Pause"}
          </button>

          <button
            onClick={onReset}
            aria-label="重置动画"
            className="bg-red-400 hover:bg-red-500 focus:ring-2 focus:ring-red-200 text-white rounded-lg px-4 py-2 text-lg leading-5 shadow-md"
          >
            Reset
          </button>

          <button
            onClick={onPrev}
            aria-label="上一步"
            className="bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-100 text-blue-700 rounded-lg px-3 py-2 text-lg leading-5 border"
          >
            Prev
          </button>

          <button
            onClick={onNext}
            aria-label="下一步"
            className="bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-100 text-blue-700 rounded-lg px-3 py-2 text-lg leading-5 border"
          >
            Next
          </button>
        </div>

        {/* Middle group: speed and toggles */}
        <div className="flex-1 flex items-center justify-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <span className="text-sm font-medium">Speed</span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={speed}
              onChange={(e) => onSpeedChange(Number(e.target.value))}
              aria-label="播放速度滑条 0.5 到 2 倍"
              className="w-48"
            />
            <span className="ml-2 text-sm font-semibold">{speed}x</span>
          </label>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleGrid}
              aria-pressed={showGrid}
              aria-label="显示或隐藏网格"
              className={`px-3 py-2 rounded-lg text-sm focus:ring-2 ${
                showGrid ? "bg-green-200 text-green-800 focus:ring-green-300" : "bg-white text-gray-700 border"
              }`}
            >
              Toggle Grid
            </button>

            <button
              onClick={onHighContrastToggle}
              aria-pressed={highContrast}
              aria-label="高对比模式切换"
              className={`px-3 py-2 rounded-lg text-sm focus:ring-2 ${
                highContrast ? "bg-black text-white" : "bg-white text-gray-700 border"
              }`}
            >
              High Contrast
            </button>
          </div>
        </div>

        {/* Right group: numeric inputs & teacher controls */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 bg-white border px-2 py-1 rounded">
            <span className="text-sm">底 b</span>
            <input
              type="number"
              min="1"
              step="1"
              value={base}
              onChange={(e) => onBaseChange(Number(e.target.value))}
              aria-label="基底 b"
              className="w-20 px-2 py-1 text-sm rounded focus:outline-none"
            />
          </label>

          <label className="flex items-center gap-2 bg-white border px-2 py-1 rounded">
            <span className="text-sm">高 h</span>
            <input
              type="number"
              min="1"
              step="1"
              value={height}
              onChange={(e) => onHeightChange(Number(e.target.value))}
              aria-label="对应高 h"
              className="w-20 px-2 py-1 text-sm rounded focus:outline-none"
            />
          </label>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleTeacherMode}
              aria-pressed={teacherMode}
              aria-label="教师模式切换"
              className={`px-3 py-2 rounded-lg text-sm focus:ring-2 ${
                teacherMode ? "bg-indigo-200 text-indigo-800" : "bg-white text-gray-700 border"
              }`}
            >
              Teacher
            </button>

            {/* Hint only actionable if teacherMode true (UI-layer only) */}
            <button
              onClick={onToggleHint}
              aria-pressed={showHint}
              aria-label="提示或示答"
              disabled={!teacherMode}
              className={`px-3 py-2 rounded-lg text-sm focus:ring-2 ${
                teacherMode
                  ? showHint
                    ? "bg-green-300 text-green-900"
                    : "bg-white text-gray-700 border"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              Hint
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------
   HintPanel
   - 右下角提示气泡区域（教师/学生提示）
   - 使用 aria-live 通知屏幕阅读器
   ------------------------- */
function HintPanel({ hintText, visible, roleLabel = "教师提示", onClose = () => {} }) {
  return (
    <div aria-live="polite" className="fixed right-6 bottom-6 z-50">
      <div
        className={`max-w-xs ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6 pointer-events-none"
        } transition-all duration-300`}
      >
        <div className="bg-white rounded-xl shadow-lg p-3 border">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-yellow-200 flex items-center justify-center text-yellow-800 font-semibold">
                T
              </div>
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-800">{roleLabel}</div>
              <div className="mt-1 text-sm text-gray-600">{hintText}</div>
            </div>

            <div className="ml-2">
              <button
                onClick={onClose}
                aria-label="关闭提示"
                className="text-gray-400 hover:text-gray-600 focus:ring-2 focus:ring-blue-100 rounded p-1"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        <div className="mt-2 text-xs text-gray-500 text-right">（仅显示当前教师/学生提示）</div>
      </div>
    </div>
  );
}

/* -------------------------
   App - 组装页面
   ------------------------- */
export default function App({
  // optional callbacks for integration with animation logic
  onStart,
  onPause,
  onReset,
  onNext,
  onPrev,
  onSpeedChange,
  onToggleGrid,
  onBaseChange,
  onHeightChange,
  onToggleTeacherMode,
  onToggleHint,
  onHighContrastToggle,
}) {
  // UI local state (minimal)
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [base, setBase] = useState(8);
  const [height, setHeight] = useState(5);
  const [teacherMode, setTeacherMode] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

  // Local handlers wrap external callbacks
  const handleStart = () => {
    setIsPlaying(true);
    setIsPaused(false);
    onStart && onStart();
  };
  const handlePause = () => {
    // toggle pause/resume
    setIsPaused((p) => {
      const newP = !p;
      if (newP) {
        // paused
      } else {
        // resumed
      }
      onPause && onPause(newP);
      return newP;
    });
  };
  const handleReset = () => {
    setIsPlaying(false);
    setIsPaused(false);
    onReset && onReset();
  };
  const handleNext = () => {
    onNext && onNext();
  };
  const handlePrev = () => {
    onPrev && onPrev();
  };
  const handleSpeedChange = (v) => {
    setSpeed(v);
    onSpeedChange && onSpeedChange(v);
  };
  const handleToggleGrid = () => {
    setShowGrid((s) => {
      const ns = !s;
      onToggleGrid && onToggleGrid(ns);
      return ns;
    });
  };
  const handleBaseChange = (v) => {
    setBase(v);
    onBaseChange && onBaseChange(v);
  };
  const handleHeightChange = (v) => {
    setHeight(v);
    onHeightChange && onHeightChange(v);
  };
  const handleToggleTeacherMode = () => {
    setTeacherMode((t) => {
      const nt = !t;
      onToggleTeacherMode && onToggleTeacherMode(nt);
      if (!nt) {
        // hide hints when leaving teacher mode
        setShowHint(false);
      }
      return nt;
    });
  };
  const handleToggleHint = () => {
    if (!teacherMode) return;
    setShowHint((s) => {
      const ns = !s;
      onToggleHint && onToggleHint(ns);
      return ns;
    });
  };
  const handleHighContrastToggle = () => {
    setHighContrast((h) => {
      const nh = !h;
      onHighContrastToggle && onHighContrastToggle(nh);
      return nh;
    });
  };

  return (
    <div className={`min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white text-slate-800`} style={{ fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial" }}>
      <HeaderNav
        title="图形与几何 — 平行四边形的面积演示"
        stepLabel="步骤 1/5：探索基底与高对面积的影响"
      />

      <MainCanvasArea showGrid={showGrid} highContrast={highContrast} >
        {/* children intentionally left for extension */}
      </MainCanvasArea>

      <ToolBar
        isPlaying={isPlaying}
        isPaused={isPaused}
        onStart={handleStart}
        onPause={handlePause}
        onReset={handleReset}
        onNext={handleNext}
        onPrev={handlePrev}
        speed={speed}
        onSpeedChange={handleSpeedChange}
        showGrid={showGrid}
        onToggleGrid={handleToggleGrid}
        base={base}
        height={height}
        onBaseChange={handleBaseChange}
        onHeightChange={handleHeightChange}
        teacherMode={teacherMode}
        onToggleTeacherMode={handleToggleTeacherMode}
        showHint={showHint}
        onToggleHint={handleToggleHint}
        onHighContrastToggle={handleHighContrastToggle}
        highContrast={highContrast}
      />

      <HintPanel
        visible={showHint}
        hintText={
          teacherMode
            ? "提示：平行四边形的面积 = 底 b × 对应高 h。尝试调整 b 与 h，观察面积变化。"
            : ""
        }
        onClose={() => setShowHint(false)}
      />
    </div>
  );
}