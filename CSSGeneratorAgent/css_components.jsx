@tailwind base;
@tailwind components;
@tailwind utilities;

:root{
  --brand-blue: #2E9AFE;
  --brand-green: #2ECC71;
  --brand-yellow: #F7CA18;
  --bg: #F6FBFF;
  --card: #FFFFFF;
  --muted: #8AAED9;
  --shadow: 0 6px 18px rgba(46,154,254,0.12);
  --radius: 12px;
  --font-main: "Noto Sans", "Microsoft YaHei", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue";
}

@layer base{
  html{font-size:16px;}
  body{
    font-family: var(--font-main);
    background: linear-gradient(180deg, var(--bg) 0%, #FFFFFF 100%);
    color: #0F172A;
    -webkit-font-smoothing:antialiased;
    -moz-osx-font-smoothing:grayscale;
    line-height:1.35;
    font-size:1rem;
  }
  h1,h2,h3{font-weight:700}
}

/* layout components */
@layer components{
  .app-topbar{
    @apply fixed left-0 right-0 top-0 z-40 flex items-center justify-between px-4 md:px-6;
    height:64px;
    background: linear-gradient(90deg, rgba(46,154,254,0.08), rgba(46,154,254,0.03));
    backdrop-filter: blur(6px);
    box-shadow: 0 2px 8px rgba(12,34,78,0.06);
    border-bottom: 1px solid rgba(46,154,254,0.06);
  }

  .app-topbar .title{
    @apply text-lg md:text-xl font-semibold;
    color: var(--brand-blue);
  }

  .app-main{
    @apply pt-20 pb-24 md:pb-8 px-4 md:px-8 grid gap-4;
    grid-template-columns: 1fr 340px;
    max-width:1200px;
    margin-inline:auto;
    align-items:start;
  }

  .canvas-area{
    @apply relative rounded-2xl p-4;
    background: linear-gradient(180deg, rgba(255,255,255,0.9), rgba(246,251,255,0.8));
    border: 3px dashed rgba(46,154,254,0.12);
    box-shadow: var(--shadow);
    min-height:420px;
    overflow:hidden;
  }

  .svg-canvas{
    width:100%;
    height:100%;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:12px;
    border-radius: 10px;
    background: repeating-linear-gradient(135deg, rgba(46,154,254,0.02) 0 20px, transparent 20px 40px);
  }

  .side-panel{
    @apply bg-white rounded-xl p-4 shadow-md;
    border: 1px solid rgba(11,66,120,0.04);
    min-height:320px;
    position:relative;
  }

  .side-panel .panel-title{
    @apply text-sm font-semibold text-gray-700 mb-3;
  }

  .bottom-bar{
    @apply fixed left-0 right-0 bottom-0 z-50 flex items-center gap-3 px-3 py-3 md:py-4;
    background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(250,250,250,0.98));
    box-shadow: 0 -6px 18px rgba(12,34,78,0.06);
    border-top: 1px solid rgba(46,154,254,0.04);
    flex-wrap:wrap;
  }

  .control-btn{
    @apply inline-flex items-center justify-center font-medium text-sm rounded-md;
    padding:10px 14px;
    border-radius:8px;
    background: linear-gradient(180deg, var(--brand-blue), #1c7fd9);
    color:white;
    box-shadow: 0 6px 12px rgba(46,154,254,0.18);
    transition: transform .12s ease, box-shadow .12s ease, filter .12s ease;
  }

  .control-btn:active{ transform: translateY(1px) scale(.998); }
  .control-btn:hover{ filter:brightness(1.05); box-shadow: 0 10px 22px rgba(46,154,254,0.20); }

  .btn-secondary{
    @apply inline-flex items-center justify-center text-sm font-medium rounded-md;
    padding:10px 12px;
    background: white;
    color: var(--brand-blue);
    border: 1px solid rgba(46,154,254,0.10);
    box-shadow: 0 6px 12px rgba(11,66,120,0.04);
    transition: transform .12s ease, box-shadow .12s ease;
  }
  .btn-secondary:hover{ transform:translateY(-2px); box-shadow: 0 10px 20px rgba(11,66,120,0.06); }

  .control-group{
    display:flex;
    gap:8px;
    align-items:center;
  }

  .value-input{
    @apply w-24 text-center rounded-md;
    padding:8px 10px;
    border-radius:8px;
    border:1px solid rgba(11,66,120,0.08);
    background:#fff;
    box-shadow: 0 4px 10px rgba(11,66,120,0.03);
    font-weight:600;
    transition: box-shadow .16s ease, transform .12s ease;
  }
  .value-input:focus{ outline:none; box-shadow: 0 8px 20px rgba(46,154,254,0.12); transform: translateY(-1px); }

  .slider{
    width:160px;
    display:flex;
    align-items:center;
    gap:8px;
  }

  input[type="range"].slider-range{
    -webkit-appearance:none;
    appearance:none;
    height:6px;
    background: linear-gradient(90deg, rgba(46,154,254,0.14), rgba(46,154,254,0.06));
    border-radius:999px;
    outline:none;
    padding:0;
  }
  input[type="range"].slider-range::-webkit-slider-thumb{
    -webkit-appearance:none;
    appearance:none;
    width:20px;
    height:20px;
    border-radius:50%;
    background: linear-gradient(180deg,var(--brand-yellow), #f4b91a);
    box-shadow: 0 6px 14px rgba(247,202,24,0.24), 0 2px 6px rgba(0,0,0,0.08);
    border: 3px solid rgba(255,255,255,0.8);
    transition: transform .12s ease, box-shadow .12s ease;
  }
  input[type="range"].slider-range::-moz-range-thumb{
    width:20px; height:20px; border-radius:50%;
    background: linear-gradient(180deg,var(--brand-yellow), #f4b91a);
    border: 3px solid rgba(255,255,255,0.8);
  }

  .slider-handle{
    width:20px; height:20px; border-radius:50%;
    background: var(--brand-blue);
    box-shadow: 0 6px 18px rgba(46,154,254,0.16);
    transition: transform .12s ease, box-shadow .12s ease;
  }

  .svg-canvas svg .circle{
    fill: rgba(46,154,254,0.08);
    stroke: var(--brand-blue);
    stroke-width:2;
    transition: transform .18s ease, filter .18s ease, stroke .12s ease;
  }

  .svg-canvas svg .sector1{
    fill: rgba(46,154,254,0.12);
    stroke: rgba(46,154,254,0.28);
    stroke-width:1.2;
  }

  .svg-canvas svg .sector2{
    fill: rgba(46,154,254,0.06);
    stroke: rgba(11,66,120,0.08);
    stroke-width:1;
  }

  #radiusHandle{
    @apply cursor-grab;
    width:18px; height:18px; border-radius:50%;
    background: var(--brand-green);
    box-shadow: 0 8px 18px rgba(46,154,254,0.12);
    border: 3px solid #fff;
    transition: transform .12s cubic-bezier(.2,.9,.2,1), box-shadow .12s ease;
    transform-origin:center;
  }

  #radiusHandle:active{ cursor:grabbing; }

  .dragging #radiusHandle, .dragging .slider-handle, .dragging .control-btn{
    transform: scale(1.08);
    box-shadow: 0 12px 30px rgba(46,154,254,0.22);
  }

  .pulse{
    animation: pulseGlow 1200ms infinite ease-in-out;
    transform-origin:center;
  }

  .highlight{
    animation: elementPulse 900ms ease-in-out infinite;
  }

  .value-change{
    display:inline-block;
    transition: transform .4s cubic-bezier(.2,.9,.2,1), opacity .28s ease, color .18s ease;
    will-change:transform,opacity;
  }

  .tooltip{
    @apply absolute bg-white text-sm rounded-md px-3 py-2 shadow-lg;
    border:1px solid rgba(11,66,120,0.06);
    transform-origin: bottom center;
    opacity:0;
    pointer-events:none;
  }

  .tooltip.show{
    animation: tooltipIn .32s cubic-bezier(.2,.9,.2,1) forwards;
  }

  .svg-caption{
    @apply text-sm font-semibold text-gray-700;
    background: rgba(255,255,255,0.6);
    padding:6px 8px;
    border-radius:8px;
    backdrop-filter: blur(4px);
  }

  .badge{
    @apply inline-flex items-center justify-center rounded-full text-xs font-semibold;
    padding:6px 8px;
    background: rgba(14,165,233,0.12);
    color: var(--brand-blue);
  }
}

/* animations */
@keyframes pulseGlow{
  0%{ transform: scale(1); opacity:1; filter:drop-shadow(0 0 0 rgba(46,154,254,0.0)); }
  50%{ transform: scale(1.06); opacity:.9; filter:drop-shadow(0 10px 26px rgba(46,154,254,0.12)); }
  100%{ transform: scale(1); opacity:1; filter:drop-shadow(0 0 0 rgba(46,154,254,0.0)); }
}

@keyframes elementPulse{
  0%{ transform: scale(1); opacity:1; }
  60%{ transform: scale(1.08); opacity:0.92; }
  100%{ transform: scale(1); opacity:1; }
}

@keyframes tooltipIn{
  from{ transform: translateY(6px) scale(.98); opacity:0; }
  to{ transform: translateY(0) scale(1); opacity:1; }
}

@keyframes handleScale{
  from{ transform: scale(1); box-shadow: 0 6px 18px rgba(46,154,254,0.12); }
  to{ transform: scale(1.2); box-shadow: 0 18px 34px rgba(46,154,254,0.22); }
}

/* value transition helper for numeric updates */
.value-change.enter{
  transform: translateY(-6px) scale(1.02);
  opacity:0;
}
.value-change.enter-active{
  transform: translateY(0) scale(1);
  opacity:1;
  transition: transform .36s cubic-bezier(.2,.9,.2,1), opacity .36s ease;
}

/* SVG element interactive states */
.svg-canvas svg .circle:hover,
.svg-canvas svg .sector1:hover,
.svg-canvas svg .sector2:hover{
  filter: drop-shadow(0 12px 20px rgba(46,154,254,0.08));
  transform: translateY(-4px);
}

/* handle special highlight for dragging */
#radiusHandle.drag-highlight{
  animation: handleScale .18s ease forwards;
  transform-origin:center;
}

/* tooltip arrow */
.tooltip::after{
  content: "";
  position: absolute;
  left:50%;
  transform: translateX(-50%);
  bottom:-6px;
  border-width:6px 6px 0 6px;
  border-style:solid;
  border-color: #fff transparent transparent transparent;
  filter: drop-shadow(0 2px 6px rgba(11,66,120,0.06));
}

/* responsive */
@media (max-width: 900px){
  .app-main{ grid-template-columns: 1fr; padding:12px; gap:12px; }
  .side-panel{ order:2; }
  .canvas-area{ order:1; min-height:360px; }
  .bottom-bar{ gap:10px; padding:12px; }
  .slider{ width:100%; }
}

@media (max-width:640px){
  .app-topbar{ height:56px; padding-left:10px; padding-right:10px; }
  .control-btn{ padding:12px 16px; border-radius:10px; }
  .btn-secondary{ padding:12px 14px; }
  .value-input{ width:36%; min-width:72px; }
  .side-panel{ position:relative; transform:translateY(0); transition: height .18s ease; }
  .side-panel.collapsed{ max-height:0; overflow:hidden; padding:0 12px; border:0; box-shadow:none; }
}

/* focus & accessibility */
.control-btn:focus, .btn-secondary:focus, .value-input:focus, input[type="range"].slider-range:focus{
  outline: 3px solid rgba(46,154,254,0.12);
  outline-offset:3px;
}

/* small visual helpers */
.kpi{
  @apply inline-flex items-baseline gap-2 text-base;
}
.kpi .num{
  font-weight:800;
  color: var(--brand-blue);
  font-size:1.125rem;
}
.kpi .label{
  font-size:0.875rem;
  color: #475569;
}