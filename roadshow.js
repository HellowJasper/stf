const slides = [...document.querySelectorAll("[data-slide]")];
const pitchDeck = document.querySelector("#pitch-deck");
const pitchStage = document.querySelector("#pitch-stage");
const pitchProgress = document.querySelector("#pitch-progress");
const pitchClock = document.querySelector("#pitch-clock");
const pitchTime = document.querySelector("#pitch-time");
const pitchCurrent = document.querySelector("#pitch-current");
const pitchTotal = document.querySelector("#pitch-total");
const previousButton = document.querySelector("#pitch-prev");
const nextButton = document.querySelector("#pitch-next");
const notesButton = document.querySelector("#pitch-notes");
const autoButton = document.querySelector("#pitch-auto");
const fullscreenButton = document.querySelector("#pitch-fullscreen");
const startGate = document.querySelector("#pitch-start");
const startButton = document.querySelector("#pitch-start-button");
const demoThinking = document.querySelector("#roadshow-thinking");
const demoFeedback = document.querySelector("#roadshow-feedback");
const demoStream = document.querySelector("#roadshow-stream");

const TOTAL_SECONDS = slides.reduce((total, slide) => total + Number(slide.dataset.duration || 0), 0);
const DEMO_REPLY = "可以推进。请确认 A、B、C 中真正的最高优先级，我按您拍板的顺序交付。";

let activeIndex = 0;
let started = false;
let startedAt = 0;
let clockFrame = 0;
let autoMode = false;
let autoTimer = 0;
let transitioning = false;
let demoTimers = [];

pitchStage.setAttribute("aria-live", "polite");
pitchTotal.textContent = String(slides.length).padStart(2, "0");

function formatClock(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(Math.abs(milliseconds) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${String(minutes).padStart(2, "0")}:${seconds}`;
}

function updateClock(now) {
  if (!started) return;
  const elapsed = now - startedAt;
  const totalMs = TOTAL_SECONDS * 1000;
  const remaining = totalMs - elapsed;
  const ratio = Math.min(1, Math.max(0, elapsed / totalMs));
  pitchProgress.style.width = `${ratio * 100}%`;

  pitchClock.classList.toggle("is-warning", remaining > 0 && remaining <= 30000);
  pitchClock.classList.toggle("is-overtime", remaining <= 0);
  pitchClock.querySelector("span").textContent = remaining <= 0 ? "已经超时" : "剩余时间";
  pitchTime.textContent = remaining <= 0 ? `+${formatClock(remaining)}` : formatClock(remaining);
  clockFrame = window.requestAnimationFrame(updateClock);
}

function clearDemoSequence() {
  demoTimers.forEach((timer) => {
    window.clearTimeout(timer);
    window.clearInterval(timer);
  });
  demoTimers = [];
}

function runDemoSequence() {
  clearDemoSequence();
  demoThinking.classList.remove("is-done");
  demoFeedback.classList.remove("is-visible");
  demoStream.textContent = "";

  demoTimers.push(window.setTimeout(() => {
    demoThinking.classList.add("is-done");
    demoFeedback.classList.add("is-visible");
  }, 1800));

  demoTimers.push(window.setTimeout(() => {
    let characterIndex = 0;
    const streamTimer = window.setInterval(() => {
      characterIndex += 1;
      demoStream.textContent = DEMO_REPLY.slice(0, characterIndex);
      if (characterIndex >= DEMO_REPLY.length) window.clearInterval(streamTimer);
    }, 42);
    demoTimers.push(streamTimer);
  }, 2450));
}

function scheduleAutoAdvance() {
  window.clearTimeout(autoTimer);
  if (!autoMode || !started || activeIndex >= slides.length - 1) return;
  const seconds = Number(slides[activeIndex].dataset.duration || 30);
  autoTimer = window.setTimeout(() => goToSlide(activeIndex + 1), seconds * 1000);
}

function syncControls() {
  pitchCurrent.textContent = String(activeIndex + 1).padStart(2, "0");
  previousButton.disabled = activeIndex === 0;
  nextButton.disabled = activeIndex === slides.length - 1;
  nextButton.setAttribute("aria-label", activeIndex === slides.length - 1 ? "已经是最后一页" : "下一页");
  document.title = `工位开挂局｜${activeIndex + 1}/${slides.length} · 5 分钟产品路演`;
}

function goToSlide(nextIndex) {
  const boundedIndex = Math.max(0, Math.min(slides.length - 1, nextIndex));
  if (boundedIndex === activeIndex || transitioning) return;
  transitioning = true;
  window.clearTimeout(autoTimer);
  clearDemoSequence();

  const previousIndex = activeIndex;
  const previousSlide = slides[previousIndex];
  const nextSlide = slides[boundedIndex];
  const forward = boundedIndex > previousIndex;

  previousSlide.classList.remove("is-active", "is-entering");
  previousSlide.classList.add(forward ? "is-leaving-forward" : "is-leaving-backward");
  previousSlide.setAttribute("aria-hidden", "true");

  nextSlide.hidden = false;
  nextSlide.setAttribute("aria-hidden", "false");
  nextSlide.classList.remove("is-leaving-forward", "is-leaving-backward");
  nextSlide.classList.add("is-active", "is-entering");
  activeIndex = boundedIndex;
  syncControls();

  window.setTimeout(() => {
    previousSlide.hidden = true;
    previousSlide.classList.remove("is-leaving-forward", "is-leaving-backward");
    nextSlide.classList.remove("is-entering");
    transitioning = false;
  }, 360);

  if (activeIndex === 3) runDemoSequence();
  scheduleAutoAdvance();
}

function setNotesOpen(open) {
  pitchDeck.classList.toggle("notes-open", open);
  notesButton.setAttribute("aria-pressed", String(open));
  notesButton.textContent = open ? "隐藏提示 N" : "演讲提示 N";
}

function setAutoMode(enabled) {
  autoMode = enabled;
  autoButton.setAttribute("aria-pressed", String(enabled));
  autoButton.textContent = enabled ? "自动演示中 A" : "自动演示 A";
  scheduleAutoAdvance();
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch {
    fullscreenButton.textContent = "浏览器未允许全屏";
  }
}

function startPitch() {
  if (started) return;
  started = true;
  startedAt = performance.now();
  startGate.classList.add("is-closing");
  window.setTimeout(() => {
    startGate.hidden = true;
    startGate.setAttribute("aria-hidden", "true");
  }, 580);
  clockFrame = window.requestAnimationFrame(updateClock);
  scheduleAutoAdvance();
}

function restartPitch() {
  window.cancelAnimationFrame(clockFrame);
  window.clearTimeout(autoTimer);
  started = true;
  startedAt = performance.now();
  pitchClock.classList.remove("is-warning", "is-overtime");
  pitchClock.querySelector("span").textContent = "剩余时间";
  pitchTime.textContent = "05:00";
  pitchProgress.style.width = "0%";
  if (activeIndex !== 0) {
    transitioning = false;
    slides.forEach((slide, index) => {
      slide.hidden = index !== 0;
      slide.classList.toggle("is-active", index === 0);
      slide.classList.remove("is-entering", "is-leaving-forward", "is-leaving-backward");
      slide.setAttribute("aria-hidden", String(index !== 0));
    });
    activeIndex = 0;
    syncControls();
  }
  clockFrame = window.requestAnimationFrame(updateClock);
  scheduleAutoAdvance();
}

previousButton.addEventListener("click", () => goToSlide(activeIndex - 1));
nextButton.addEventListener("click", () => goToSlide(activeIndex + 1));
notesButton.addEventListener("click", () => setNotesOpen(!pitchDeck.classList.contains("notes-open")));
autoButton.addEventListener("click", () => setAutoMode(!autoMode));
fullscreenButton.addEventListener("click", toggleFullscreen);
startButton.addEventListener("click", startPitch);

document.addEventListener("fullscreenchange", () => {
  fullscreenButton.textContent = document.fullscreenElement ? "退出全屏 F" : "全屏 F";
});

document.addEventListener("keydown", (event) => {
  if (!startGate.hidden && ["Enter", " "].includes(event.key)) {
    event.preventDefault();
    startPitch();
    return;
  }

  if (["ArrowRight", "PageDown", " "].includes(event.key)) {
    event.preventDefault();
    goToSlide(activeIndex + 1);
    return;
  }
  if (["ArrowLeft", "PageUp"].includes(event.key)) {
    event.preventDefault();
    goToSlide(activeIndex - 1);
    return;
  }
  if (event.key.toLowerCase() === "n") {
    event.preventDefault();
    setNotesOpen(!pitchDeck.classList.contains("notes-open"));
    return;
  }
  if (event.key.toLowerCase() === "a") {
    event.preventDefault();
    setAutoMode(!autoMode);
    return;
  }
  if (event.key.toLowerCase() === "f") {
    event.preventDefault();
    toggleFullscreen();
    return;
  }
  if (event.key.toLowerCase() === "r") {
    event.preventDefault();
    restartPitch();
  }
});

slides.forEach((slide, index) => {
  slide.setAttribute("aria-hidden", String(index !== 0));
});
syncControls();
