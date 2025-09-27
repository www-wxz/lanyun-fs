import React from "react";

/**
 * Circle Exploration Page
 *
 * Components:
 * - HeaderNav: top title and subtitle
 * - ToolBar: left or right toolbar with controls
 * - MainCanvasArea: central SVG canvas and right side panel (values & hints)
 * - FooterControls: bottom controls (step / params / toggles)
 * - HintPanel: bottom teacher/task hint area
 *
 * NOTE: This file contains only structural markup (JSX) and IDs/classes per the provided HTML planning.
 * No styling (CSS) or behavioral logic (JS event handlers) is added here so it's easy to extend later.
 */

/* Header: top title & subtitle */
function HeaderNav() {
  return (
    <header id="header" role="banner" aria-label="页面标题">
      <h1 id="title">探索圆的周长与面积</h1>
      <p id="subtitle">
        通过拖拽、拆分与重组，直观理解 C=2πr 与 A=πr²
      </p>
      {/* Optional metadata for teachers/students */}
      <div id="meta" aria-hidden="true" style={{ display: "none" }}>
        <span>主题：图形与几何</span>
        <span>子主题：图形 的认识与测量</span>
        <span>年级：5～6年级</span>
        <span>课标要求：探索圆的周长和面积计算公式。</span>
      </div>
    </header>
  );
}

/* ToolBar: a reusable toolbar that can be placed left or right */
/* position prop expected: "left" or "right" */
function ToolBar({ position = "right" }) {
  const id = position === "left" ? "toolBarLeft" : "toolBarRight";

  return (
    <aside id={id} className={`tool-bar tool-bar--${position}`} aria-label={`${position} 工具栏`}>
      <div className="tool-bar__group" role="toolbar" aria-orientation="vertical">
        <button id="playPause" aria-pressed="false" title="播放 / 暂停">
          播放
        </button>
        <button id="prevStep" title="上一步">
          上一步
        </button>
        <button id="nextStep" title="下一步">
          下一步
        </button>
        <button id="reset" title="重置">
          重置
        </button>
        <label htmlFor="showAngle" className="tool-bar__label">
          <input id="showAngle" type="checkbox" /> 显示角度
        </label>
      </div>
      {/* Place for additional tools (e.g., help, export) */}
      <div className="tool-bar__extras" aria-hidden="true" style={{ display: "none" }}>
        {/* extension point */}
      </div>
    </aside>
  );
}

/* MainCanvasArea: contains the SVG canvas and the sidePanel with numeric values & hints */
function MainCanvasArea() {
  // SVG initial geometry:
  // center at (320,240), initial radius 50
  const cx = 320;
  const cy = 240;
  const initialR = 50;
  const handleX = cx + initialR;
  const handleY = cy;

  return (
    <main id="main" role="main">
      <div id="canvasWrap" aria-live="polite">
        <svg
          id="svgCanvas"
          width="640"
          height="480"
          viewBox="0 0 640 480"
          role="img"
          aria-label="圆的实验画布"
          preserveAspectRatio="xMidYMid meet"
        >
          <title>圆的实验画布：可视化周长与面积</title>

          {/* Background grid */}
          <g id="grid" aria-hidden="true"></g>

          {/* Circle and radius handle */}
          <g id="circleGroup" aria-label="圆与相关要素">
            {/* main circle */}
            <circle
              id="circleMain"
              cx={cx}
              cy={cy}
              r={initialR}
              fill="none"
              stroke="currentColor"
            />
            {/* radius line from center to handle */}
            <line
              id="radiusLine"
              x1={cx}
              y1={cy}
              x2={handleX}
              y2={handleY}
              stroke="currentColor"
              strokeWidth="2"
            />
            {/* draggable radius handle (interactive element hook) */}
            <circle
              id="radiusHandle"
              cx={handleX}
              cy={handleY}
              r={8}
              className="handle"
              role="slider"
              tabIndex={0}
              aria-label="拖动以改变半径"
              aria-valuemin={20}
              aria-valuemax={140}
              aria-valuenow={initialR}
            />
            {/* center marker (non-interactive) */}
            <circle
              id="circleCenter"
              cx={cx}
              cy={cy}
              r={3}
              fill="currentColor"
              aria-hidden="true"
            />
          </g>

          {/* Unwrapped circumference demonstration group */}
          <g id="unwrapGroup" transform="translate(0,360)" aria-label="周长演示 (展开)">
            {/* placeholder path for tape or unwrapped arc */}
            <path id="tapeMeasure" d="" fill="none" stroke="currentColor" />
          </g>

          {/* Sectors for splitting the circle into slices */}
          <g id="sectorsGroup" aria-label="扇形分割"></g>

          {/* Labels and annotations */}
          <g id="labels" aria-hidden="false">
            <text id="labelR" x={10} y={20}>
              半径 r
            </text>
            <text id="labelC" x={10} y={40}>
              周长 C
            </text>
            <text id="labelA" x={10} y={60}>
              面积 A
            </text>
          </g>

          {/* Animation helper / guides */}
          <g id="helper" aria-hidden="true">
            <path id="guidePath" d="" fill="none" stroke="currentColor" />
          </g>
        </svg>
      </div>

      {/* Right side panel with numeric values & hints (as planned) */}
      <aside id="sidePanel" aria-label="数值与步骤提示面板">
        <div id="values" aria-live="polite">
          <div className="valueRow">
            半径: <span id="radiusValue">50</span> px
          </div>
          <div className="valueRow">
            周长 C: <span id="circValue">—</span>
          </div>
          <div className="valueRow">
            面积 A: <span id="areaValue">—</span>
          </div>
        </div>

        <div id="hints" aria-live="polite">
          交互提示将在此显示
        </div>
      </aside>
    </main>
  );
}

/* Footer controls as specified in the HTML planning */
function FooterControls() {
  return (
    <footer id="controls" role="contentinfo" aria-label="控制区">
      <div id="stepControls" className="control-group" aria-label="步骤控制">
        <button id="prevStep">上一步</button>
        <button id="nextStep">下一步</button>
        <button id="playPause">播放</button>
        <button id="reset">重置</button>
      </div>

      <div id="paramControls" className="control-group" aria-label="参数控制">
        <label>
          半径{" "}
          <input
            id="radiusSlider"
            type="range"
            min="20"
            max="140"
            defaultValue="50"
            aria-label="半径滑块"
          />
        </label>
        <input
          id="radiusInput"
          type="number"
          min="20"
          max="140"
          defaultValue="50"
          aria-label="半径输入框"
        />
      </div>

      <div id="toggleControls" className="control-group" aria-label="切换控制">
        <label>
          <input id="showFormula" type="checkbox" /> 显示公式提示
        </label>
        <label>
          扇形数量{" "}
          <input
            id="sectorsRange"
            type="range"
            min="4"
            max="48"
            defaultValue="12"
            aria-label="扇形数量滑块"
          />
        </label>
      </div>
    </footer>
  );
}

/* HintPanel: bottom area for teacher tips or task descriptions */
function HintPanel() {
  return (
    <section id="hintPanel" aria-label="教学提示">
      <h2>教师提示 / 任务说明</h2>
      <p>
        基本实验活动：探索圆的周长和面积计算公式。学生可以通过拖动半径端点改变半径，观察数值变化。使用扇形分割与重组来直观理解周长与面积公式的来源。
      </p>
      <ul>
        <li>让学生尝试不同半径并记录周长与面积的比例关系。</li>
        <li>通过增加扇形数量观察“展开后”的接近直线效果。</li>
        <li>提示：C = 2πr，A = πr²。</li>
      </ul>
    </section>
  );
}

/* Top-level App component composing everything together */
export default function CircleExplorationApp() {
  return (
    <div className="circle-exploration-app" lang="zh-CN">
      <HeaderNav />

      <div className="layout">
        {/* Left toolbar (optional) */}
        <ToolBar position="left" />

        {/* Central canvas area and right sidePanel live inside MainCanvasArea */}
        <MainCanvasArea />

        {/* Right toolbar for quick actions */}
        <ToolBar position="right" />
      </div>

      {/* Footer controls and hint area */}
      <FooterControls />
      <HintPanel />
    </div>
  );
}