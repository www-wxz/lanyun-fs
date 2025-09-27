import React from "react";

/**
 * Course metadata (from provided JSON)
 */
const courseInfo = {
  primaryTopic: "图形与几何",
  secondaryTopic: "图形 的认识与测量",
  grade: "5～6年级",
  standard: "探索圆的周长和面积计算公式。",
  activity: "探索圆的周长和面积计算公式"
};

/**
 * HeaderNav
 * Top title/description area. Keeps id/class names consistent with planning.
 */
function HeaderNav() {
  return (
    <header id="titleBar" className="bar" role="banner" aria-label="课程标题栏">
      <div className="title-wrap">
        <h1>
          {courseInfo.primaryTopic} — {courseInfo.secondaryTopic}
        </h1>
        <p className="meta">
          年级：{courseInfo.grade} | 课标要求：{courseInfo.standard}
        </p>
        <p className="activity">基本实验活动：{courseInfo.activity}</p>
      </div>
    </header>
  );
}

/**
 * MainCanvasArea
 * Left area containing the SVG demo canvas and an inline hint box.
 * SVG contains suggested child elements with the exact ids from the planning.
 *
 * Note: No animation/interaction logic is included here. This component
 * provides the semantic structure and ids/classes for later hooking.
 */
function MainCanvasArea() {
  // Default geometry values are only for initial layout/visualization.
  const svgWidth = 800;
  const svgHeight = 500;
  const centerX = 400;
  const centerY = 250;
  const defaultRadius = 80;

  return (
    <section id="canvasArea" className="left" aria-label="演示画布区域">
      <svg
        id="demoSVG"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-labelledby="svgTitle svgDesc"
      >
        <title id="svgTitle">圆的周长与面积演示画布</title>
        <desc id="svgDesc">
          包含圆形、半径线、扇形分割组、展开的周长组合和标签文本，用于后续挂载交互动画。
        </desc>

        {/* Main circle */}
        <circle
          id="circleShape"
          cx={centerX}
          cy={centerY}
          r={defaultRadius}
          fill="none"
          stroke="#333"
        />

        {/* Radius line from center to circumference */}
        <line
          id="radiusLine"
          x1={centerX}
          y1={centerY}
          x2={centerX + defaultRadius}
          y2={centerY}
          stroke="#ff6b6b"
          strokeWidth="2"
        />

        {/* Draggable handle at radius end (visual only; interaction to be added later) */}
        <circle
          id="radiusHandle"
          cx={centerX + defaultRadius}
          cy={centerY}
          r={8}
          fill="#ff6b6b"
          stroke="#fff"
          strokeWidth="1"
        />

        {/* Group for sectors/segments (for area demonstration) */}
        <g id="sectorsGroup" transform={`translate(${centerX - 220}, ${centerY - 120})`}>
          {/* Placeholder: sectors will be rendered here dynamically */}
        </g>

        {/* Group for unwrapped circumference / rolled-out line demonstration */}
        <g id="unwrappedLineGroup" transform={`translate(${centerX + 120}, ${centerY + 120})`}>
          {/* Placeholder: unwrapped arc segments or rolled-out line */}
        </g>

        {/* Area designated for rearrangement of sectors (visual bounding rect) */}
        <rect
          id="rearrangeArea"
          x={centerX - 160}
          y={centerY + 120}
          width={320}
          height={120}
          fill="none"
          stroke="#999"
          strokeDasharray="4 4"
        />

        {/* Informational labels (text elements present for dynamic updates) */}
        <text id="labelRadius" x={20} y={20} fontSize="14" fill="#111">
          半径: --
        </text>
        <text id="labelDiameter" x={20} y={40} fontSize="14" fill="#111">
          直径: --
        </text>
        <text id="labelCircumference" x={20} y={60} fontSize="14" fill="#111">
          周长: --
        </text>
        <text id="labelArea" x={20} y={80} fontSize="14" fill="#111">
          面积: --
        </text>
      </svg>

      <div id="hintBox" className="hint" role="region" aria-live="polite">
        提示与引导文本：在此将展示分步提示与教师引导（例如：拖动半径观察周长变化；切割扇形并排列近似矩形）。
      </div>
    </section>
  );
}

/**
 * ToolBar
 * Right-side control area containing mathPanel and all interactive controls listed.
 * All control elements use the ids specified in the planning to ensure later
 * scripts/CSS can hook directly.
 *
 * No event handlers are attached here — this component lays out controls only.
 */
function ToolBar() {
  return (
    <aside id="controlArea" className="right" aria-label="交互控件与数学展示">
      <div id="mathPanel" aria-live="polite">
        <h2>实时数值与公式展示</h2>
        <div className="math-values">
          <p>
            <strong>半径：</strong>
            <span id="displayRadius">--</span>
          </p>
          <p>
            <strong>直径：</strong>
            <span id="displayDiameter">--</span>
          </p>
          <p>
            <strong>周长：</strong>
            <span id="displayCircumference">--</span>
          </p>
          <p>
            <strong>面积：</strong>
            <span id="displayArea">--</span>
          </p>
        </div>

        <div id="formulaArea" aria-hidden="true">
          {/* Formula rendering will be injected here (e.g., LaTeX or HTML) */}
        </div>
      </div>

      <div id="toolPanel" aria-label="工具面板">
        <h3>交互控件</h3>

        <div className="control-row">
          <button id="btnStart" type="button">开始</button>
          <button id="btnPause" type="button">暂停</button>
          <button id="btnReset" type="button">重置</button>
        </div>

        <div className="control-row">
          <button id="btnPrev" type="button">上一步</button>
          <button id="btnNext" type="button">下一步</button>
        </div>

        <div className="control-row">
          <button id="btnShowFormula" type="button">显示/隐藏公式</button>
        </div>

        <fieldset className="control-group" aria-label="参数调节">
          <legend>参数</legend>

          <label htmlFor="radiusSlider">
            半径：
            <input
              id="radiusSlider"
              type="range"
              min="20"
              max="150"
              defaultValue="80"
              aria-valuemin={20}
              aria-valuemax={150}
            />
          </label>

          <label htmlFor="sectorsSlider">
            扇形数：
            <input
              id="sectorsSlider"
              type="range"
              min="2"
              max="40"
              defaultValue="8"
              aria-valuemin={2}
              aria-valuemax={40}
            />
          </label>

          <label className="checkbox-label">
            <input id="toggleDrag" type="checkbox" />
            可拖拽半径
          </label>
        </fieldset>

        <div className="control-row">
          <button id="measureTool" type="button">测量周长（卷尺模拟）</button>
        </div>

        <div className="notes">
          <small>提示：使用“可拖拽半径”可直接在画布上交互（需后续挂载事件）。</small>
        </div>
      </div>
    </aside>
  );
}

/**
 * HintPanel
 * Bottom area for step controls, progress and teacher tips.
 * Keeps footer id/class per planning. This area is primarily informational;
 * actual control buttons are placed in the ToolBar above to maintain unique ids.
 */
function HintPanel() {
  return (
    <footer id="stepControls" className="bar" role="contentinfo" aria-label="步骤控制与提示">
      <div className="step-area">
        <div className="step-status">
          <strong>当前步骤：</strong>
          <span id="currentStep">1</span> / <span id="totalSteps">5</span>
        </div>

        <div className="step-progress" aria-hidden="false">
          {/* Progress UI placeholder — can be hooked to a slider/visual later */}
          <label htmlFor="stepProgress">进度：</label>
          <input id="stepProgress" type="range" min="1" max="5" defaultValue="1" />
        </div>

        <div className="teacher-hint" aria-live="polite">
          <strong>教师提示：</strong>
          <span id="teacherHint">请引导学生通过切割与排列扇形来观察面积的近似矩形化过程。</span>
        </div>
      </div>
    </footer>
  );
}

/**
 * Top-level App component composing the layout
 */
export default function CircleLessonApp() {
  return (
    <div className="lesson-app">
      <HeaderNav />

      <main id="mainArea" className="container" role="main" aria-label="主内容区">
        <MainCanvasArea />
        <ToolBar />
      </main>

      <HintPanel />
    </div>
  );
}
```