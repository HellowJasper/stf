const scenarios = {
  boss: {
    title: "领导 · 王总",
    sender: "王总",
    avatar: "王",
    description: "临下班突然加活，还顺手压缩你的解释空间。",
    mood: "正在施压",
    incoming: "这点小事为什么还没做完？今晚给我。",
    defaultPrompt: "收到，我可以推进。A、B、C 请您确认一个真正的最高优先级，我按您拍板的顺序交付。",
    quickPrompts: ["请确认真·最高优先级", "今晚先给框架，明早交完整稿", "先对齐范围，再承诺时间"],
    birth: { name: "王总", gender: "男", date: "1985-06-18", time: "09:30", place: "江苏省南京市" },
    rewind: {
      outcome: "你下意识把三个最高优先级全接了下来。",
      rewrite: "收到，我可以推进。A、B、C 请您确认一个真正的最高优先级，我按您拍板的顺序交付。",
    },
    bazi: {
      pillars: [
        ["年柱", "甲寅"],
        ["月柱", "丙午"],
        ["日柱", "庚戌"],
        ["时柱", "戊辰"],
      ],
      element: "火旺 · 行动力强",
      compatibility: 58,
      trigger: "公开否定他的判断",
      delight: "先给结论，再给他选择题",
      strategy: "给面子、定边界、锁优先级",
    },
  },
  friendly: {
    title: "同事 · 小林",
    sender: "小林",
    avatar: "林",
    description: "对方是真心来帮忙，重点是接住善意，也说清分工。",
    mood: "善意靠近",
    incoming: "我怕你最近太忙了，这块我可以先帮你顶一下，要不要一起过一遍？",
    defaultPrompt: "谢谢你，真的救到我了。我们十分钟对齐，我负责收口、你帮我补盲点。",
    quickPrompts: ["谢谢，咱们十分钟对齐", "我收口，你帮我补盲点", "这次你救我，下次我接你"],
    birth: { name: "小林", gender: "女", date: "1996-11-03", time: "15:20", place: "浙江省杭州市" },
    rewind: {
      outcome: "你太客气，差点把真心帮忙挡了回去。",
      rewrite: "谢谢你，真的救到我了。我们十分钟对齐，我负责收口、你帮我补盲点。",
    },
    bazi: {
      pillars: [
        ["年柱", "乙卯"],
        ["月柱", "癸未"],
        ["日柱", "丁亥"],
        ["时柱", "辛丑"],
      ],
      element: "水木 · 重视感受",
      compatibility: 87,
      trigger: "好意被当作理所当然",
      delight: "明确感谢，再给出互助承诺",
      strategy: "接住善意、分清任务、记住人情",
    },
  },
  hostile: {
    title: "同事 · 老周",
    sender: "老周",
    avatar: "周",
    description: "对方话里带刺，重点是不接情绪，只接事实。",
    mood: "阴阳蓄力",
    incoming: "这个不是早就说过了吗？你不会又没记吧？",
    defaultPrompt: "我们不用靠记忆抽奖。我把结论、责任人和截止时间发群里，大家按记录确认。",
    quickPrompts: ["我们按群里的记录确认", "请把责任人和时间补全", "不聊记忆，直接核对事实"],
    birth: { name: "老周", gender: "男", date: "1990-02-14", time: "20:10", place: "北京市朝阳区" },
    rewind: {
      outcome: "你被带进了自证记忆力的陷阱。",
      rewrite: "我们不用靠记忆抽奖。我把结论、责任人和截止时间发群里，大家按记录确认。",
    },
    bazi: {
      pillars: [
        ["年柱", "庚申"],
        ["月柱", "戊戌"],
        ["日柱", "辛酉"],
        ["时柱", "己丑"],
      ],
      element: "金土 · 强调掌控",
      compatibility: 41,
      trigger: "失去信息优势和话语权",
      delight: "给台阶，但把记录留全",
      strategy: "不接讽刺、固定事实、公开确认",
    },
  },
};

const thinkingLines = [
  "消息已读，办公室空气突然安静……",
  "对方正在判断要不要继续施压……",
  "正在模拟一句真实、不会突然圣母化的反馈……",
  "对方正在组织那句熟悉的职场话术……",
  "AI 在旁边偷偷记下这句里的潜台词……",
];

const heavenlyStems = [..."甲乙丙丁戊己庚辛壬癸"];
const earthlyBranches = [..."子丑寅卯辰巳午未申酉戌亥"];
const conversationHistory = {
  boss: [{ id: "boss-seed", user: "好的，我尽量今晚做完。", outcome: scenarios.boss.rewind.outcome, rewrite: scenarios.boss.rewind.rewrite, reply: "", cheat: false }],
  friendly: [{ id: "friendly-seed", user: "不用不用，我自己来就好。", outcome: scenarios.friendly.rewind.outcome, rewrite: scenarios.friendly.rewind.rewrite, reply: "", cheat: false }],
  hostile: [{ id: "hostile-seed", user: "我记得啊，可能是你没说清楚吧。", outcome: scenarios.hostile.rewind.outcome, rewrite: scenarios.hostile.rewind.rewrite, reply: "", cheat: false }],
};
const liveExtras = { boss: [], friendly: [], hostile: [] };

const sceneButtons = [...document.querySelectorAll(".scene-card")];
const opponentAvatar = document.querySelector("#opponent-avatar");
const conversationTitle = document.querySelector("#conversation-title");
const scenarioDescription = document.querySelector("#scenario-description");
const moodTag = document.querySelector("#mood-tag");
const messageSender = document.querySelector("#message-sender");
const opponentMessage = document.querySelector("#opponent-message");
const conversationStage = document.querySelector(".conversation-stage");
const chatWindow = document.querySelector("#chat-window");
const quickPrompts = document.querySelector("#quick-prompts");
const composer = document.querySelector("#composer");
const userMessage = document.querySelector("#user-message");
const sendButton = document.querySelector("#send-button");
const composerStatus = document.querySelector("#composer-status");
const chatRewindBar = document.querySelector("#chat-rewind-bar");
const chatRewindCopy = document.querySelector("#chat-rewind-copy");
const chatRewindButton = document.querySelector("#chat-rewind-button");
const thinkingCard = document.querySelector("#thinking-card");
const thinkingSeconds = document.querySelector("#thinking-seconds");
const thinkingLine = document.querySelector("#thinking-line");
const analysisCard = document.querySelector("#analysis-card");
const analysisMode = document.querySelector("#analysis-mode");
const analysisSteps = document.querySelector("#analysis-steps");
const replyTone = document.querySelector("#reply-tone");
const streamingReply = document.querySelector("#streaming-reply");
const streamingCaret = document.querySelector("#streaming-caret");
const copyReply = document.querySelector("#copy-reply");
const satisfactionMeter = document.querySelector("#satisfaction-meter");
const workMeter = document.querySelector("#work-meter");
const satisfactionScore = document.querySelector("#satisfaction-score");
const workScore = document.querySelector("#work-score");
const patienceMeter = document.querySelector("#patience-meter");
const patienceBalance = document.querySelector("#patience-balance");
const patienceTrack = document.querySelector(".patience-meter__track");
const patienceFill = document.querySelector("#patience-fill");
const patienceStatus = document.querySelector("#patience-status");
const patienceLedger = document.querySelector("#patience-ledger");
const closePatienceLedgerButton = document.querySelector("#close-patience-ledger");
const patienceLedgerBalance = document.querySelector("#patience-ledger-balance");
const patienceLedgerDate = document.querySelector("#patience-ledger-date");
const patienceLedgerList = document.querySelector("#patience-ledger-list");
const patienceLedgerEmpty = document.querySelector("#patience-ledger-empty");
const resetPatienceButton = document.querySelector("#reset-patience");
const patienceToast = document.querySelector("#patience-toast");
const cheatConsole = document.querySelector(".cheat-console");
const cheatSwitch = document.querySelector("#cheat-switch");
const baziLockTitle = document.querySelector("#bazi-lock-title");
const baziLockCopy = document.querySelector("#bazi-lock-copy");
const baziProfile = document.querySelector("#bazi-profile");
const pillarGrid = document.querySelector("#pillar-grid");
const elementLabel = document.querySelector("#element-label");
const compatibilityScore = document.querySelector("#compatibility-score");
const compatibilityBar = document.querySelector("#compatibility-bar");
const triggerCopy = document.querySelector("#trigger-copy");
const delightCopy = document.querySelector("#delight-copy");
const strategyCopy = document.querySelector("#strategy-copy");
const openMysticLabButton = document.querySelector("#open-mystic-lab");
const mysticLab = document.querySelector("#mystic-lab");
const mysticAmbience = document.querySelector("#mystic-ambience");
const mysticConstellationGroups = [...document.querySelectorAll(".mystic-constellation-group")];
const mysticEntry = document.querySelector("#mystic-entry");
const entryBranches = document.querySelector("#entry-branches");
const entryStems = document.querySelector("#entry-stems");
const closeMysticLabButton = document.querySelector("#close-mystic-lab");
const modelStatus = document.querySelector("#model-status");
const mysticStepNodes = [...document.querySelectorAll("[data-mystic-step]")];
const birthForm = document.querySelector("#birth-form");
const birthName = document.querySelector("#birth-name");
const birthFormerName = document.querySelector("#birth-former-name");
const birthCalendar = document.querySelector("#birth-calendar");
const birthDateLabel = document.querySelector("#birth-date-label");
const birthGender = document.querySelector("#birth-gender");
const birthDate = document.querySelector("#birth-date");
const birthTimePrecision = document.querySelector("#birth-time-precision");
const birthTime = document.querySelector("#birth-time");
const birthPlace = document.querySelector("#birth-place");
const birthLifeStatus = document.querySelector("#birth-life-status");
const birthDeathYear = document.querySelector("#birth-death-year");
const deathYearField = document.querySelector("#death-year-field");
const birthLeapMonth = document.querySelector("#birth-leap-month");
const leapMonthField = document.querySelector("#leap-month-field");
const fillCurrentOpponentButton = document.querySelector("#fill-current-opponent");
const chartButton = document.querySelector("#chart-button");
const oracleStage = document.querySelector("#oracle-stage");
const oracleMessage = document.querySelector("#oracle-message");
const chartPillars = document.querySelector("#chart-pillars");
const chartProgress = document.querySelector("#chart-progress");
const chartStatus = document.querySelector("#chart-status");
const analysisObjectName = document.querySelector("#analysis-object-name");
const mysticResults = document.querySelector("#mystic-results");
const skillChartName = document.querySelector("#skill-chart-name");
const skillSolarDate = document.querySelector("#skill-solar-date");
const skillLunarDate = document.querySelector("#skill-lunar-date");
const skillPillarTable = document.querySelector("#skill-pillar-table");
const skillDayMaster = document.querySelector("#skill-day-master");
const skillStrength = document.querySelector("#skill-strength");
const skillPattern = document.querySelector("#skill-pattern");
const skillYunDirection = document.querySelector("#skill-yun-direction");
const skillYunStart = document.querySelector("#skill-yun-start");
const elementBalance = document.querySelector("#element-balance");
const dayunTrack = document.querySelector("#dayun-track");
const skillDayMasterAnalysis = document.querySelector("#skill-day-master-analysis");
const skillFavorable = document.querySelector("#skill-favorable");
const skillUnfavorable = document.querySelector("#skill-unfavorable");
const skillClassicReference = document.querySelector("#skill-classic-reference");
const profileName = document.querySelector("#profile-name");
const profileSummary = document.querySelector("#profile-summary");
const profilePersonality = document.querySelector("#profile-personality");
const profileLikes = document.querySelector("#profile-likes");
const profileFears = document.querySelector("#profile-fears");
const profileTopics = document.querySelector("#profile-topics");
const profileAdvice = document.querySelector("#profile-advice");
const profileScript = document.querySelector("#profile-script");
const refreshLiveAnalysisButton = document.querySelector("#refresh-live-analysis");
const liveTranscript = document.querySelector("#live-transcript");
const liveChatForm = document.querySelector("#live-chat-form");
const liveMessage = document.querySelector("#live-message");
const liveAnalysisStatus = document.querySelector("#live-analysis-status");
const liveBaziBasis = document.querySelector("#live-bazi-basis");
const liveSignals = document.querySelector("#live-signals");
const liveDeepening = document.querySelector("#live-deepening");
const liveSuggestedLine = document.querySelector("#live-suggested-line");
const bootScreen = document.querySelector("#boot-screen");
const bootSkipButton = document.querySelector("#boot-skip");
const bootStageIndex = document.querySelector("#boot-stage-index");
const bootStageText = document.querySelector("#boot-stage-text");
const bootProgressValue = document.querySelector("#boot-progress-value");
const bootStepNodes = [...document.querySelectorAll("[data-boot-step]")];

let activeScenario = "boss";
let cheatEnabled = false;
let isProcessing = false;
let requestController = null;
let thinkingTimer = 0;
let cheatLoadingTimer = 0;
let cheatLoading = false;
let activeFeedbackBubble = null;
let pendingTurn = null;
const latestTurnByScenario = { boss: null, friendly: null, hostile: null };
let previousFocus = null;
let mysticResultByScenario = {};
let mysticProfileByScenario = {};
let liveAnalysisInFlight = false;
let mysticPointerFrame = 0;
let patienceToastTimer = 0;
let mysticEntryRevealTimer = 0;
let mysticEntryFinishTimer = 0;

const MYSTIC_ENTRY_REVEAL_MS = 3550;
const MYSTIC_ENTRY_FINISH_MS = 4550;
const BOOT_SEQUENCE_MS = 7200;

let bootFinished = false;
let bootProgressFrame = 0;
let bootTimers = [];

const PATIENCE_STORAGE_KEY = "stf-daily-patience-v1";
const INITIAL_PATIENCE_BALANCE = 68;

function setBootStage(index, label) {
  bootScreen.dataset.stage = String(index + 1);
  bootStageIndex.textContent = `${String(index + 1).padStart(2, "0")} / 03`;
  bootStageText.textContent = label;
  bootStepNodes.forEach((step, stepIndex) => {
    step.classList.toggle("is-active", stepIndex === index);
    step.classList.toggle("is-complete", stepIndex < index);
  });
}

function clearBootSequence() {
  bootTimers.forEach((timer) => window.clearTimeout(timer));
  bootTimers = [];
  window.cancelAnimationFrame(bootProgressFrame);
}

function finishBootSequence({ immediate = false } = {}) {
  if (bootFinished) return;
  bootFinished = true;
  clearBootSequence();
  bootStepNodes.forEach((step) => {
    step.classList.remove("is-active");
    step.classList.add("is-complete");
  });
  bootStageIndex.textContent = "READY";
  bootStageText.textContent = "状态在线，准备开局";
  bootProgressValue.textContent = `${patienceState.balance}%`;
  document.body.classList.remove("is-booting");
  document.body.classList.add("is-booted");

  if (immediate) {
    bootScreen.hidden = true;
    bootScreen.setAttribute("aria-hidden", "true");
    return;
  }

  bootScreen.classList.add("is-exiting");
  window.setTimeout(() => {
    bootScreen.hidden = true;
    bootScreen.setAttribute("aria-hidden", "true");
  }, 820);
}

function startBootSequence() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    finishBootSequence({ immediate: true });
    return;
  }

  const startedAt = performance.now();
  const updateProgress = (now) => {
    const ratio = Math.min(1, (now - startedAt) / (BOOT_SEQUENCE_MS - 250));
    const easedRatio = 1 - ((1 - ratio) ** 3);
    bootProgressValue.textContent = `${Math.round(patienceState.balance * easedRatio)}%`;
    if (!bootFinished && ratio < 1) bootProgressFrame = window.requestAnimationFrame(updateProgress);
  };
  bootProgressFrame = window.requestAnimationFrame(updateProgress);

  bootTimers.push(
    window.setTimeout(() => setBootStage(1, "三大战场正在切换就位"), 2350),
    window.setTimeout(() => setBootStage(2, "八字外挂已装载，默认关闭"), 4700),
    window.setTimeout(() => {
      bootStageIndex.textContent = "READY";
      bootStageText.textContent = "状态在线，准备开局";
    }, 6550),
    window.setTimeout(() => finishBootSequence(), BOOT_SEQUENCE_MS),
  );
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function newPatienceState() {
  return { date: localDateKey(), balance: INITIAL_PATIENCE_BALANCE, transactions: [] };
}

function loadPatienceState() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(PATIENCE_STORAGE_KEY) || "null");
    if (
      stored?.date === localDateKey()
      && Number.isFinite(stored.balance)
      && Array.isArray(stored.transactions)
    ) {
      return {
        date: stored.date,
        balance: Math.max(0, Math.min(100, Math.round(stored.balance))),
        transactions: stored.transactions.slice(0, 20),
      };
    }
  } catch {
    // 无痕模式或存储受限时仍可在当前页面内运行。
  }
  return newPatienceState();
}

let patienceState = loadPatienceState();

function persistPatienceState() {
  try {
    window.localStorage.setItem(PATIENCE_STORAGE_KEY, JSON.stringify(patienceState));
  } catch {
    // 本地存储不可用时降级为本次页面会话状态。
  }
}

function patienceStatusCopy(balance) {
  if (balance >= 80) return "耐心富翁，今天可以多说两句";
  if (balance >= 60) return "状态尚可，今天还能体面输出";
  if (balance >= 40) return "进入省电模式，只聊结论";
  if (balance >= 20) return "低电量预警，建议立刻锁边界";
  return "濒临关机：别忍，先把话说清楚";
}

function renderPatienceState({ animate = false } = {}) {
  const balance = patienceState.balance;
  patienceBalance.textContent = `${balance}%`;
  patienceLedgerBalance.textContent = String(balance);
  patienceFill.style.width = `${balance}%`;
  patienceStatus.textContent = patienceStatusCopy(balance);
  patienceTrack.setAttribute("aria-valuenow", String(balance));
  patienceMeter.setAttribute("aria-label", `今日耐心余额百分之${balance}，点击查看收支明细`);
  patienceMeter.classList.toggle("is-critical", balance < 20);
  patienceMeter.classList.toggle("is-low", balance >= 20 && balance < 45);
  patienceMeter.classList.toggle("is-healthy", balance >= 75);
  patienceLedgerDate.textContent = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date());

  const fragment = document.createDocumentFragment();
  patienceState.transactions.forEach((transaction) => {
    const item = document.createElement("li");
    const time = document.createElement("time");
    time.dateTime = new Date(transaction.timestamp).toISOString();
    time.textContent = new Date(transaction.timestamp).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const reason = document.createElement("span");
    reason.textContent = transaction.reason;
    const delta = document.createElement("strong");
    delta.textContent = `${transaction.delta > 0 ? "+" : ""}${transaction.delta}`;
    delta.classList.toggle("is-cost", transaction.delta < 0);
    item.append(time, reason, delta);
    fragment.append(item);
  });
  patienceLedgerList.replaceChildren(fragment);
  patienceLedgerEmpty.hidden = patienceState.transactions.length > 0;

  if (animate) {
    patienceMeter.classList.remove("is-changing");
    void patienceMeter.offsetWidth;
    patienceMeter.classList.add("is-changing");
    window.setTimeout(() => patienceMeter.classList.remove("is-changing"), 560);
  }
}

function showPatienceToast(delta, reason) {
  window.clearTimeout(patienceToastTimer);
  patienceToast.textContent = `耐心余额 ${delta > 0 ? "+" : ""}${delta} · ${reason}`;
  patienceToast.classList.toggle("is-cost", delta < 0);
  patienceToast.hidden = false;
  patienceToastTimer = window.setTimeout(() => {
    patienceToast.hidden = true;
  }, 2800);
}

function applyPatienceChange(delta, reason) {
  if (patienceState.date !== localDateKey()) patienceState = newPatienceState();
  const requestedDelta = Number.isFinite(Number(delta)) ? Math.round(Number(delta)) : 0;
  const previous = patienceState.balance;
  const next = Math.max(0, Math.min(100, previous + requestedDelta));
  const appliedDelta = next - previous;
  patienceState.balance = next;
  patienceState.transactions.unshift({
    timestamp: Date.now(),
    delta: appliedDelta,
    reason: String(reason || "完成一轮职场沟通"),
  });
  patienceState.transactions = patienceState.transactions.slice(0, 20);
  persistPatienceState();
  renderPatienceState({ animate: true });
  showPatienceToast(appliedDelta, reason || "完成一轮职场沟通");
}

function setPatienceLedgerOpen(open) {
  patienceLedger.hidden = !open;
  patienceMeter.setAttribute("aria-expanded", String(open));
  if (open) closePatienceLedgerButton.focus();
}

function resetPatienceState() {
  if (!window.confirm("重置今天的耐心余额和全部流水？")) return;
  patienceState = newPatienceState();
  persistPatienceState();
  renderPatienceState({ animate: true });
  showPatienceToast(0, "今日耐心账户已重置");
}

function scrollChatToBottom() {
  requestAnimationFrame(() => {
    chatWindow.scrollTo({ top: chatWindow.scrollHeight, behavior: "smooth" });
  });
}

function createQuickPrompts(items) {
  const fragment = document.createDocumentFragment();

  items.forEach((text) => {
    const button = document.createElement("button");
    button.className = "quick-prompt";
    button.type = "button";
    button.textContent = text;
    button.addEventListener("click", () => {
      userMessage.value = text;
      userMessage.focus();
    });
    fragment.append(button);
  });

  quickPrompts.replaceChildren(fragment);
}

function renderBaziProfile() {
  const profile = scenarios[activeScenario].bazi;
  const fragment = document.createDocumentFragment();

  profile.pillars.forEach(([label, value]) => {
    const tile = document.createElement("div");
    tile.className = "pillar-tile";
    tile.innerHTML = `<small>${label}</small><strong>${value}</strong>`;
    fragment.append(tile);
  });

  pillarGrid.replaceChildren(fragment);
  elementLabel.textContent = profile.element;
  compatibilityScore.textContent = `${profile.compatibility}%`;
  triggerCopy.textContent = profile.trigger;
  delightCopy.textContent = profile.delight;
  strategyCopy.textContent = profile.strategy;
  compatibilityBar.style.width = cheatEnabled ? `${profile.compatibility}%` : "0%";
}

function clearGeneratedConversation() {
  document.querySelectorAll(".message-row--user, .message-row--feedback").forEach((node) => node.remove());
  activeFeedbackBubble = null;
  thinkingCard.hidden = true;
  thinkingCard.classList.remove("is-counting");
  analysisCard.hidden = true;
  analysisSteps.replaceChildren();
  streamingReply.textContent = "";
  streamingCaret.hidden = true;
  copyReply.disabled = true;
  satisfactionMeter.style.width = "0%";
  workMeter.style.width = "0%";
  composerStatus.textContent = "";
}

function renderScenario(key) {
  if (!scenarios[key]) return;

  const scenarioChanged = key !== activeScenario;
  requestController?.abort();
  stopThinkingLoop();
  if (scenarioChanged) {
    cancelCheatLoading();
    setCheatEnabled(false, { silent: true });
  }
  isProcessing = false;
  sendButton.disabled = false;
  sendButton.querySelector("span").textContent = "发送给对方";
  activeScenario = key;
  const scenario = scenarios[key];

  sceneButtons.forEach((button) => {
    const active = button.dataset.scenario === key;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  opponentAvatar.textContent = scenario.avatar;
  conversationTitle.textContent = scenario.title;
  scenarioDescription.textContent = scenario.description;
  moodTag.lastChild.textContent = ` ${scenario.mood}`;
  messageSender.textContent = scenario.sender;
  opponentMessage.textContent = scenario.incoming;
  userMessage.value = scenario.defaultPrompt;
  createQuickPrompts(scenario.quickPrompts);
  renderBaziProfile();
  clearGeneratedConversation();
  updateChatRewindUI();
  if (scenarioChanged) {
    composerStatus.textContent = "已进入新场景：八字外挂默认关闭，需要时请手动开启。";
  }
  if (!mysticLab.hidden) {
    fillCurrentOpponent();
    renderLiveTranscript();
  }

  opponentMessage.closest(".message-row").animate(
    [
      { opacity: 0, transform: "translateY(10px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    { duration: 320, easing: "cubic-bezier(.2,.9,.22,1.18)" },
  );
}

function resetCheatLoadingCopy() {
  baziLockTitle.textContent = "点击开启今日外挂";
  baziLockCopy.textContent = "开启后，对方反馈会多一层角色校准";
}

function cancelCheatLoading() {
  window.clearTimeout(cheatLoadingTimer);
  cheatLoadingTimer = 0;
  cheatLoading = false;
  cheatConsole.classList.remove("is-loading");
  cheatSwitch.disabled = false;
  cheatSwitch.removeAttribute("aria-busy");
  resetCheatLoadingCopy();
}

function setCheatEnabled(nextEnabled, { silent = false } = {}) {
  if (!nextEnabled) cancelCheatLoading();
  cheatEnabled = Boolean(nextEnabled);
  cheatConsole.classList.toggle("is-active", cheatEnabled);
  cheatSwitch.setAttribute("aria-checked", String(cheatEnabled));
  cheatSwitch.querySelector("strong").textContent = cheatEnabled ? "已开启" : "未开启";
  baziProfile.setAttribute("aria-hidden", String(!cheatEnabled));
  analysisMode.textContent = cheatEnabled ? "八字外挂已叠加" : "基础拆招";
  renderBaziProfile();
  updateChatRewindUI();

  if (silent) return;
  if (cheatEnabled) {
    composerStatus.textContent = "校准完成：下一条对方反馈会叠加雷点与相处策略。";
    window.setTimeout(() => {
      compatibilityBar.style.width = `${scenarios[activeScenario].bazi.compatibility}%`;
    }, 50);
  } else {
    composerStatus.textContent = "外挂已关闭：只做基础沟通拆招。";
  }
}

function toggleCheat() {
  if (cheatLoading) return;
  if (cheatEnabled) {
    setCheatEnabled(false);
    return;
  }

  cheatLoading = true;
  const loadingScenario = activeScenario;
  const delay = Math.round(1000 + Math.random() * 1000);
  cheatConsole.style.setProperty("--cheat-load-duration", `${delay}ms`);
  cheatConsole.classList.add("is-loading");
  cheatSwitch.disabled = true;
  cheatSwitch.setAttribute("aria-busy", "true");
  cheatSwitch.querySelector("strong").textContent = "校准中";
  baziLockTitle.textContent = `正在校准${scenarios[activeScenario].sender}的沟通命盘`;
  baziLockCopy.textContent = `预计 ${(delay / 1000).toFixed(1)} 秒 · 正在匹配雷点与顺毛开关`;
  composerStatus.textContent = "八字外挂加载中，当前消息暂不会自动带上外挂。";

  cheatLoadingTimer = window.setTimeout(() => {
    cheatLoadingTimer = 0;
    cheatLoading = false;
    cheatConsole.classList.remove("is-loading");
    cheatSwitch.disabled = false;
    cheatSwitch.removeAttribute("aria-busy");
    resetCheatLoadingCopy();
    if (activeScenario !== loadingScenario) return;
    setCheatEnabled(true);
  }, delay);
}

function updateChatRewindUI() {
  const latestTurn = latestTurnByScenario[activeScenario];
  chatRewindBar.hidden = !cheatEnabled;
  chatRewindButton.disabled = !latestTurn || isProcessing;

  if (!latestTurn) {
    chatRewindCopy.textContent = "完成一轮聊天后，可回到刚才发送前。";
    return;
  }

  const preview = latestTurn.user.length > 28 ? `${latestTurn.user.slice(0, 28)}…` : latestTurn.user;
  chatRewindCopy.textContent = isProcessing
    ? "本轮对话进行中，结束后才能回溯。"
    : `可回溯刚才发送的：“${preview}”`;
}

async function startChatRewind() {
  const node = latestTurnByScenario[activeScenario];
  if (!cheatEnabled || !node || isProcessing || conversationStage.classList.contains("is-rewinding")) return;

  conversationStage.classList.add("is-rewinding");
  chatRewindButton.disabled = true;
  await wait(900);

  const history = conversationHistory[activeScenario];
  const nodeIndex = history.findIndex((item) => item.id === node.id);
  if (nodeIndex >= 0) history.splice(nodeIndex, 1);
  latestTurnByScenario[activeScenario] = [...history]
    .reverse()
    .find((item) => !item.id.endsWith("-seed")) || null;

  clearGeneratedConversation();
  userMessage.value = node.rewrite || node.user;
  conversationStage.classList.remove("is-rewinding");
  updateChatRewindUI();
  composerStatus.textContent = "回溯完成：已回到发送前，输入框里是 AI 建议的重写版本。";
  applyPatienceChange(4, "回溯成功，少交一笔后悔税");
  userMessage.focus();
}

function addUserMessage(text) {
  const row = document.createElement("div");
  row.className = "message-row message-row--user";
  const now = new Date();
  const time = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });

  row.innerHTML = `
    <div class="bubble-meta"><span>我</span><time>${time}</time></div>
    <div class="chat-bubble chat-bubble--user"></div>
  `;
  row.querySelector(".chat-bubble").textContent = text;

  chatWindow.insertBefore(row, thinkingCard);
}

function beginOpponentFeedback(sender, reaction) {
  stopThinkingLoop();
  thinkingCard.hidden = true;

  const row = document.createElement("div");
  row.className = "message-row message-row--opponent message-row--feedback";
  row.dataset.reaction = reaction || "对方反馈";
  const now = new Date();
  const time = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });

  row.innerHTML = `
    <div class="bubble-meta"><span></span><time>${time}</time></div>
    <div class="chat-bubble chat-bubble--opponent"></div>
  `;
  row.querySelector(".bubble-meta span").textContent = `${sender} · 已接招`;
  activeFeedbackBubble = row.querySelector(".chat-bubble");
  chatWindow.insertBefore(row, thinkingCard);
  scrollChatToBottom();
}

function startThinkingLoop() {
  let lineIndex = 0;
  thinkingLine.textContent = thinkingLines[lineIndex];
  window.clearInterval(thinkingTimer);
  thinkingTimer = window.setInterval(() => {
    lineIndex = (lineIndex + 1) % thinkingLines.length;
    thinkingLine.textContent = thinkingLines[lineIndex];
  }, 520);
}

function stopThinkingLoop() {
  window.clearInterval(thinkingTimer);
  thinkingTimer = 0;
}

function showThinking(seconds) {
  thinkingSeconds.textContent = `约 ${Number(seconds).toFixed(1)} 秒`;
  thinkingCard.style.setProperty("--think-duration", `${seconds}s`);
  thinkingCard.classList.remove("is-counting");
  void thinkingCard.offsetWidth;
  thinkingCard.classList.add("is-counting");
}

function beginAnalysis(event) {
  stopThinkingLoop();
  thinkingCard.hidden = true;
  analysisCard.hidden = false;
  analysisMode.textContent = event.mode;
  replyTone.textContent = event.tone;
  satisfactionScore.textContent = event.satisfaction;
  workScore.textContent = event.work;
  analysisSteps.replaceChildren();
  streamingReply.textContent = "";
  streamingCaret.hidden = false;
  scrollChatToBottom();
}

function appendAnalysisStep(text) {
  const item = document.createElement("li");
  item.textContent = text;
  analysisSteps.append(item);
  scrollChatToBottom();
}

function handleStreamEvent(event) {
  switch (event.type) {
    case "meta":
      showThinking(event.think_seconds);
      break;
    case "opponent_start":
      beginOpponentFeedback(event.sender, event.reaction);
      break;
    case "opponent_delta":
      if (activeFeedbackBubble) activeFeedbackBubble.textContent += event.text;
      scrollChatToBottom();
      break;
    case "analysis_start":
      beginAnalysis(event);
      break;
    case "analysis_item":
      appendAnalysisStep(event.text);
      break;
    case "reply_start":
      streamingCaret.hidden = false;
      scrollChatToBottom();
      break;
    case "delta":
      streamingReply.textContent += event.text;
      scrollChatToBottom();
      break;
    case "done":
      streamingCaret.hidden = true;
      copyReply.disabled = false;
      satisfactionMeter.style.width = `${event.satisfaction}%`;
      workMeter.style.width = `${event.work}%`;
      composerStatus.textContent = "拆招完成。可以复制，也可以换个场景继续爽。";
      if (pendingTurn) {
        applyPatienceChange(
          event.patience_delta,
          event.patience_reason || "完成一轮职场沟通",
        );
        const turnNode = {
          id: `${pendingTurn.scenario}-${Date.now()}`,
          user: pendingTurn.message,
          reply: activeFeedbackBubble?.textContent.trim() || "",
          outcome: event.outcome || "对方已经回应，你可以回到发送前重写这句话。",
          rewrite: streamingReply.textContent.trim() || pendingTurn.message,
          cheat: pendingTurn.cheat,
        };
        conversationHistory[pendingTurn.scenario].push(turnNode);
        latestTurnByScenario[pendingTurn.scenario] = turnNode;
        pendingTurn = null;
        updateChatRewindUI();
        if (!mysticLab.hidden) {
          renderLiveTranscript();
          if (mysticResultByScenario[activeScenario]) runLiveAnalysis();
        }
      }
      break;
    default:
      break;
  }
}

async function readNdjsonStream(response) {
  if (!response.body) throw new Error("浏览器不支持流式响应");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    lines.filter(Boolean).forEach((line) => handleStreamEvent(JSON.parse(line)));
  }

  if (buffer.trim()) handleStreamEvent(JSON.parse(buffer));
}

async function submitMessage(event) {
  event.preventDefault();
  if (isProcessing) return;

  const text = userMessage.value.trim() || scenarios[activeScenario].defaultPrompt;
  userMessage.value = text;
  clearGeneratedConversation();
  addUserMessage(text);

  isProcessing = true;
  updateChatRewindUI();
  requestController = new AbortController();
  pendingTurn = { scenario: activeScenario, cheat: cheatEnabled, message: text };
  sendButton.disabled = true;
  sendButton.querySelector("span").textContent = "消息已发送";
  composerStatus.textContent = "Python 正在抽取 1–3 秒，对方读完后会给出反馈……";
  thinkingSeconds.textContent = "正在抽取";
  thinkingCard.hidden = false;
  startThinkingLoop();
  scrollChatToBottom();

  try {
    const response = await fetch("./api/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenario: activeScenario,
        bazi_enabled: cheatEnabled,
        message: text,
      }),
      signal: requestController.signal,
    });

    if (!response.ok) {
      throw new Error(`服务响应异常（${response.status}）`);
    }

    await readNdjsonStream(response);
  } catch (error) {
    if (error.name !== "AbortError") {
      stopThinkingLoop();
      thinkingCard.hidden = true;
      composerStatus.textContent = `${error.message}。请确认已使用“python3 server.py”启动 Demo。`;
    }
    pendingTurn = null;
  } finally {
    isProcessing = false;
    sendButton.disabled = false;
    sendButton.querySelector("span").textContent = "再发一句";
    updateChatRewindUI();
  }
}

async function copyCurrentReply() {
  const text = streamingReply.textContent.trim();
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(streamingReply);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  const original = copyReply.textContent;
  copyReply.textContent = "已复制，去发吧";
  window.setTimeout(() => {
    copyReply.textContent = original;
  }, 1400);
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `服务响应异常（${response.status}）`);
  }
  return payload;
}

function serviceErrorMessage(error) {
  const message = error?.message || "";
  if (/Failed to fetch|NetworkError/i.test(message)) {
    return "服务未连接：请在项目目录运行 python3 server.py，再刷新页面。";
  }
  if (message === "calendar_engine_unavailable") {
    return "缺少历法引擎：请先运行 python3 -m pip install -r requirements.txt。";
  }
  if (message === "invalid_birth_datetime") {
    return "出生日期或时间格式无法识别，请检查后重试。";
  }
  if (message === "calendar_conversion_failed") {
    return "历法换算失败：请检查日期，以及农历闰月是否选择正确。";
  }
  if (message === "incomplete_profile") {
    return "排盘资料不完整，请补齐带星号的项目。";
  }
  return message || "未知服务异常";
}

function buildOracleRing(type, glyphs) {
  const ring = document.querySelector(`[data-oracle-ring="${type}"]`);
  const fragment = document.createDocumentFragment();
  glyphs.forEach((glyph, index) => {
    const span = document.createElement("span");
    span.className = "oracle-glyph";
    span.textContent = glyph;
    span.style.setProperty("--angle", `${(360 / glyphs.length) * index}deg`);
    fragment.append(span);
  });
  ring.replaceChildren(fragment);
}

function buildEntryRing(target, glyphs) {
  const fragment = document.createDocumentFragment();
  glyphs.forEach((glyph, index) => {
    const span = document.createElement("span");
    span.className = "mystic-entry__glyph";
    span.textContent = glyph;
    span.style.setProperty("--entry-angle", `${(360 / glyphs.length) * index}deg`);
    fragment.append(span);
  });
  target.replaceChildren(fragment);
}

function buildMysticAmbience() {
  const fragment = document.createDocumentFragment();
  const runes = [..."甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥"];
  const generalStarCount = 150;
  const riverStarCount = 70;
  let starSeed = 0x5f3759df;
  const nextStarRandom = () => {
    starSeed = (starSeed * 1664525 + 1013904223) >>> 0;
    return starSeed / 4294967296;
  };
  for (let index = 0; index < generalStarCount + riverStarCount; index += 1) {
    const star = document.createElement("b");
    const isRiverStar = index >= generalStarCount;
    const depthRoll = nextStarRandom();
    const depth = depthRoll > 0.93 ? "near" : depthRoll > 0.58 ? "mid" : "far";
    const starX = nextStarRandom() * 100;
    const freeY = nextStarRandom() * 100;
    const riverY = Math.max(2, Math.min(96, 9 + starX * 0.6 + (freeY - 50) * 0.36));
    const isWarmStar = nextStarRandom() > 0.78;
    star.className = [
      "mystic-star",
      `mystic-star--${depth}`,
      isRiverStar ? "mystic-star--river" : "",
      isWarmStar ? "mystic-star--warm" : "",
    ].filter(Boolean).join(" ");
    star.style.setProperty("--star-x", `${starX.toFixed(2)}%`);
    star.style.setProperty("--star-y", `${(isRiverStar ? riverY : freeY).toFixed(2)}%`);
    star.style.setProperty("--star-size", `${depth === "near" ? 3.2 : depth === "mid" ? 2 : 1.15}px`);
    star.style.setProperty("--star-glow", `${depth === "near" ? 18 : depth === "mid" ? 10 : 5}px`);
    const opacityFloor = depth === "near" ? 0.7 : depth === "mid" ? 0.46 : 0.24;
    const opacityRange = depth === "near" ? 0.26 : depth === "mid" ? 0.34 : 0.38;
    star.style.setProperty("--star-opacity", `${(opacityFloor + nextStarRandom() * opacityRange).toFixed(2)}`);
    star.style.setProperty("--star-duration", `${(2.8 + nextStarRandom() * 4.2).toFixed(2)}s`);
    star.style.setProperty("--star-delay", `${(-nextStarRandom() * 6.4).toFixed(2)}s`);
    fragment.append(star);
  }
  for (let index = 0; index < 30; index += 1) {
    const particle = document.createElement("span");
    const isRune = index % 6 === 0;
    particle.className = isRune ? "mystic-particle mystic-particle--rune" : "mystic-particle";
    if (isRune) particle.textContent = runes[index % runes.length];
    particle.style.setProperty("--particle-x", `${4 + ((index * 31) % 92)}%`);
    particle.style.setProperty("--particle-y", `${5 + ((index * 47) % 88)}%`);
    particle.style.setProperty("--particle-size", `${isRune ? 10 : 2 + (index % 3)}px`);
    particle.style.setProperty("--particle-delay", `${-(index % 12) * 1.7}s`);
    particle.style.setProperty("--particle-duration", `${14 + (index % 9) * 2}s`);
    particle.style.setProperty("--particle-drift", `${18 + (index % 5) * 9}px`);
    fragment.append(particle);
  }
  mysticAmbience.append(fragment);
}

function syncAnalysisObjectName() {
  analysisObjectName.textContent = birthName.value.trim() || "等待录入";
}

function updateMysticParallax(event) {
  window.cancelAnimationFrame(mysticPointerFrame);
  mysticPointerFrame = window.requestAnimationFrame(() => {
    const rect = mysticLab.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      mysticLab.style.setProperty("--pointer-x", `${x.toFixed(1)}%`);
      mysticLab.style.setProperty("--pointer-y", `${y.toFixed(1)}%`);
    }

    let closestGroup = null;
    let closestDistance = Number.POSITIVE_INFINITY;
    mysticConstellationGroups.forEach((group) => {
      const deltaX = (x - Number(group.dataset.centerX)) / 18;
      const deltaY = (y - Number(group.dataset.centerY)) / 21;
      const distance = Math.hypot(deltaX, deltaY);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestGroup = group;
      }
    });
    mysticConstellationGroups.forEach((group) => {
      group.classList.toggle("is-lit", group === closestGroup && closestDistance < 1);
    });
  });
}

function clearMysticConstellationHover() {
  mysticConstellationGroups.forEach((group) => group.classList.remove("is-lit"));
}

function fillCurrentOpponent() {
  const profile = scenarios[activeScenario].birth;
  birthName.value = profile.name;
  birthFormerName.value = "";
  birthCalendar.value = "solar";
  birthGender.value = profile.gender;
  birthDate.value = profile.date;
  birthTimePrecision.value = "exact";
  birthTime.value = profile.time;
  birthPlace.value = profile.place;
  birthLifeStatus.value = "alive";
  birthDeathYear.value = "";
  birthLeapMonth.checked = false;
  syncBirthFormState();
  syncAnalysisObjectName();
}

function syncBirthFormState() {
  const isLunar = birthCalendar.value === "lunar";
  birthDateLabel.textContent = isLunar ? "农历生日 *" : "阳历生日 *";
  leapMonthField.hidden = !isLunar;
  if (!isLunar) birthLeapMonth.checked = false;

  const timeUnknown = birthTimePrecision.value === "unknown";
  birthTime.disabled = timeUnknown;
  birthTime.required = !timeUnknown;
  birthTime.closest("label").classList.toggle("is-disabled", timeUnknown);

  const isDeceased = birthLifeStatus.value === "deceased";
  deathYearField.hidden = !isDeceased;
  birthDeathYear.required = isDeceased;
  if (!isDeceased) birthDeathYear.value = "";
}

function collectTranscript() {
  const scenario = scenarios[activeScenario];
  const transcript = [{ role: "opponent", text: scenario.incoming }];
  conversationHistory[activeScenario].forEach((node) => {
    transcript.push({ role: "me", text: node.user });
    if (node.reply) transcript.push({ role: "opponent", text: node.reply });
  });
  liveExtras[activeScenario].forEach((text) => transcript.push({ role: "opponent", text }));
  return transcript.slice(-20);
}

function setMysticStep(step) {
  const order = ["input", "chart", "analysis", "live"];
  const activeIndex = order.indexOf(step);
  mysticStepNodes.forEach((node) => {
    const index = order.indexOf(node.dataset.mysticStep);
    node.classList.toggle("is-current", index === activeIndex);
    node.classList.toggle("is-complete", index < activeIndex);
  });
}

function setModelStatus(configured, source = "") {
  const strong = modelStatus.querySelector("strong");
  const isDeepSeek = configured && source !== "demo-fallback";
  modelStatus.classList.toggle("is-fallback", !isDeepSeek);
  if (isDeepSeek) {
    strong.textContent = "DeepSeek V4-Pro · 已连接";
  } else if (configured) {
    strong.textContent = "DeepSeek 暂不可用 · 已降级";
  } else {
    strong.textContent = "本地演示引擎 · 未设置 Key";
  }
}

async function refreshModelStatus() {
  try {
    const config = await fetchJson("./api/config");
    setModelStatus(config.deepseek_configured, config.deepseek_configured ? "ready" : "demo-fallback");
  } catch {
    setModelStatus(false, "demo-fallback");
  }
}

function renderLiveTranscript() {
  const fragment = document.createDocumentFragment();
  collectTranscript().slice(-7).forEach((message) => {
    const chip = document.createElement("div");
    chip.className = "transcript-chip";
    const speaker = document.createElement("strong");
    speaker.textContent = message.role === "me" ? "我" : scenarios[activeScenario].sender;
    const copy = document.createElement("span");
    copy.textContent = message.text;
    chip.append(speaker, copy);
    fragment.append(chip);
  });
  liveTranscript.replaceChildren(fragment);
}

function clearMysticEntryTimers() {
  window.clearTimeout(mysticEntryRevealTimer);
  window.clearTimeout(mysticEntryFinishTimer);
  mysticEntryRevealTimer = 0;
  mysticEntryFinishTimer = 0;
}

function playMysticEntry() {
  clearMysticEntryTimers();
  mysticLab.classList.remove("is-awake", "is-entering", "is-revealing", "is-revealed");

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    mysticEntry.hidden = true;
    mysticLab.classList.add("is-awake", "is-revealed");
    window.setTimeout(() => closeMysticLabButton.focus(), 30);
    return;
  }

  mysticEntry.hidden = false;
  void mysticEntry.offsetWidth;
  mysticLab.classList.add("is-entering");
  mysticEntryRevealTimer = window.setTimeout(() => {
    mysticLab.classList.add("is-revealing", "is-awake");
  }, MYSTIC_ENTRY_REVEAL_MS);
  mysticEntryFinishTimer = window.setTimeout(() => {
    mysticLab.classList.remove("is-entering", "is-revealing");
    mysticLab.classList.add("is-revealed");
    mysticEntry.hidden = true;
    closeMysticLabButton.focus();
  }, MYSTIC_ENTRY_FINISH_MS);
}

function openMysticLab() {
  previousFocus = document.activeElement;
  mysticLab.hidden = false;
  mysticLab.inert = false;
  mysticLab.setAttribute("aria-hidden", "false");
  document.body.classList.add("mystic-is-open");
  mysticLab.scrollTop = 0;
  fillCurrentOpponent();
  renderLiveTranscript();
  setMysticStep(mysticResultByScenario[activeScenario] ? "analysis" : "input");
  refreshModelStatus();
  playMysticEntry();
}

function closeMysticLab() {
  clearMysticEntryTimers();
  mysticLab.hidden = true;
  mysticLab.inert = true;
  mysticLab.setAttribute("aria-hidden", "true");
  document.body.classList.remove("mystic-is-open");
  mysticEntry.hidden = true;
  mysticLab.classList.remove("is-awake", "is-entering", "is-revealing", "is-revealed");
  previousFocus?.focus?.();
}

function profileFromForm() {
  return {
    name: birthName.value.trim(),
    former_name: birthFormerName.value.trim(),
    calendar_type: birthCalendar.value,
    gender: birthGender.value,
    birth_date: birthDate.value,
    birth_time: birthTimePrecision.value === "unknown" ? "" : birthTime.value,
    time_precision: birthTimePrecision.value,
    birth_place: birthPlace.value.trim(),
    life_status: birthLifeStatus.value,
    death_year: birthDeathYear.value.trim(),
    leap_month: birthLeapMonth.checked,
  };
}

function renderList(target, items) {
  const fragment = document.createDocumentFragment();
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    fragment.append(li);
  });
  target.replaceChildren(fragment);
}

function renderChart(chart) {
  const pillars = chart.pillars;
  const fragment = document.createDocumentFragment();
  pillars.forEach((pillar, index) => {
    const tile = document.createElement("div");
    tile.className = "chart-pillar";
    tile.style.animationDelay = `${index * 100}ms`;
    const label = document.createElement("small");
    label.textContent = pillar.label;
    const stem = document.createElement("strong");
    stem.textContent = pillar.stem;
    const branch = document.createElement("strong");
    branch.textContent = pillar.branch;
    tile.append(label, stem, branch);
    fragment.append(tile);
  });
  chartPillars.replaceChildren(fragment);
  const dayPillar = pillars[2];
  oracleStage.querySelector(".oracle-core span").textContent = `${dayPillar.stem}${dayPillar.branch}`;
}

function appendTableRow(label, values, className = "") {
  const row = document.createElement("tr");
  if (className) row.className = className;
  const header = document.createElement("th");
  header.scope = "row";
  header.textContent = label;
  row.append(header);
  values.forEach((value, index) => {
    const cell = document.createElement("td");
    if (index === 2) cell.classList.add("day-pillar-cell");
    if (index === 2 && className.includes("pillar-row--stem")) {
      cell.classList.add("day-master-cell");
      cell.setAttribute("aria-label", `日主天干：${value}`);
    }
    if (value instanceof Node) cell.append(value);
    else cell.textContent = value;
    row.append(cell);
  });
  return row;
}

function renderProfessionalChart(result) {
  const { chart, analysis, profile } = result;
  const pillars = chart.pillars;
  skillChartName.textContent = profile.former_name
    ? `${profile.name}（曾用名：${profile.former_name}）`
    : profile.name;
  skillSolarDate.textContent = `阳历：${chart.solar_date}`;
  skillLunarDate.textContent = `农历：${chart.lunar_date}`;

  const caption = document.createElement("caption");
  caption.textContent = "四柱、十神与藏干";
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["命盘", ...pillars.map((pillar) => pillar.label)].forEach((label, index) => {
    const cell = document.createElement("th");
    cell.scope = index === 0 ? "col" : "col";
    cell.textContent = label;
    if (index === 3) {
      cell.classList.add("day-pillar-heading");
      const coreLabel = document.createElement("small");
      coreLabel.textContent = "日主所在";
      cell.append(coreLabel);
    }
    headRow.append(cell);
  });
  head.append(headRow);

  const body = document.createElement("tbody");
  body.append(
    appendTableRow("天干", pillars.map((pillar) => pillar.stem), "pillar-row pillar-row--stem"),
    appendTableRow("地支", pillars.map((pillar) => pillar.branch), "pillar-row pillar-row--branch"),
    appendTableRow("十神", pillars.map((pillar) => pillar.ten_god)),
    appendTableRow("藏干", pillars.map((pillar) => {
      const stack = document.createElement("span");
      stack.className = "hidden-stem-stack";
      const items = pillar.hidden_stems.length
        ? pillar.hidden_stems.map((item) => `${item.stem}·${item.ten_god}`)
        : [pillar.ten_god];
      items.forEach((item) => {
        const small = document.createElement("small");
        small.textContent = item;
        stack.append(small);
      });
      return stack;
    })),
    appendTableRow("五行", pillars.map((pillar) => `${pillar.stem_element} / ${pillar.branch_element}`)),
  );
  skillPillarTable.replaceChildren(caption, head, body);

  skillDayMaster.textContent = `${chart.day_master.polarity}${chart.day_master.element} · ${chart.day_master.stem}`;
  skillStrength.textContent = analysis.strength;
  skillPattern.textContent = analysis.pattern;
  skillYunDirection.textContent = chart.yun.direction;
  skillYunStart.textContent = chart.yun.start;

  const elementFragment = document.createDocumentFragment();
  Object.entries(chart.element_distribution).forEach(([element, percentage]) => {
    const item = document.createElement("div");
    item.className = "element-meter";
    item.dataset.element = element;
    const label = document.createElement("span");
    label.textContent = element;
    const track = document.createElement("i");
    const fill = document.createElement("b");
    fill.style.width = `${percentage}%`;
    track.append(fill);
    const value = document.createElement("strong");
    value.textContent = `${percentage}%`;
    item.append(label, track, value);
    elementFragment.append(item);
  });
  elementBalance.replaceChildren(elementFragment);

  const currentYear = new Date().getFullYear();
  const dayunFragment = document.createDocumentFragment();
  chart.yun.cycles.forEach((cycle) => {
    const years = cycle.years.match(/\d{4}/g)?.map(Number) || [];
    const item = document.createElement("div");
    item.className = "dayun-cycle";
    if (years.length === 2 && currentYear >= years[0] && currentYear <= years[1]) {
      item.classList.add("is-current");
    }
    const index = document.createElement("small");
    index.textContent = `第 ${cycle.index} 运`;
    const ganzhi = document.createElement("strong");
    ganzhi.textContent = cycle.ganzhi;
    const ages = document.createElement("span");
    ages.textContent = cycle.ages;
    const cycleYears = document.createElement("i");
    cycleYears.textContent = cycle.years;
    item.append(index, ganzhi, ages, cycleYears);
    dayunFragment.append(item);
  });
  dayunTrack.replaceChildren(dayunFragment);

  skillDayMasterAnalysis.textContent = analysis.day_master_analysis;
  renderList(skillFavorable, analysis.favorable_elements);
  renderList(skillUnfavorable, analysis.unfavorable_elements);
  skillClassicReference.textContent = analysis.classic_reference;
}

function renderMysticResult(result) {
  const analysis = result.analysis;
  renderProfessionalChart(result);
  profileName.textContent = result.profile.name;
  profileSummary.textContent = analysis.summary;
  profilePersonality.textContent = analysis.personality;
  renderList(profileLikes, analysis.likes);
  renderList(profileFears, analysis.fears);
  renderList(profileTopics, analysis.topics);
  profileAdvice.textContent = analysis.advice;
  profileScript.textContent = analysis.script;
  mysticResults.hidden = false;
  setModelStatus(result.source === "deepseek-v4" || Boolean(result.warning), result.source);
}

async function generateMysticProfile(event) {
  event.preventDefault();
  if (!birthForm.reportValidity()) return;

  const profile = profileFromForm();
  mysticProfileByScenario[activeScenario] = profile;
  chartButton.disabled = true;
  chartButton.querySelector("span").textContent = "命盘正在流转";
  mysticResults.hidden = true;
  chartPillars.replaceChildren();
  chartProgress.style.width = "12%";
  oracleStage.classList.remove("is-settling");
  oracleStage.classList.add("is-spinning");
  oracleMessage.textContent = "正在校验时间、地点与四柱线索……";
  chartStatus.textContent = "命盘高速流转中 · 请稍候";
  setMysticStep("chart");

  const messages = [
    "正在校验时间、地点与四柱线索……",
    "正在按节气换算四柱与十神……",
    "正在寻找对方最在意的沟通开关……",
    "正在把玄学翻译成办公室能发的话……",
  ];
  let messageIndex = 0;
  const messageTimer = window.setInterval(() => {
    messageIndex = (messageIndex + 1) % messages.length;
    oracleMessage.textContent = messages[messageIndex];
    chartProgress.style.width = `${Math.min(82, 24 + messageIndex * 18)}%`;
  }, 680);

  try {
    const [result] = await Promise.all([
      fetchJson("./api/mystic-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, transcript: collectTranscript() }),
      }),
      wait(2900),
    ]);
    window.clearInterval(messageTimer);
    oracleStage.classList.remove("is-spinning");
    oracleStage.classList.add("is-settling");
    oracleMessage.textContent = "流转渐停，命盘落位。";
    chartProgress.style.width = "100%";
    chartStatus.textContent = "专业命盘已落位 · 正在生成沟通说明书";
    renderChart(result.chart);
    await wait(1150);
    window.setTimeout(() => oracleStage.classList.remove("is-settling"), 360);
    mysticResultByScenario[activeScenario] = result;
    renderMysticResult(result);
    renderLiveTranscript();
    setMysticStep("analysis");
    chartStatus.textContent = result.source === "deepseek-v4"
      ? "lunar_python 排盘 · DeepSeek V4-Pro 解读完成"
      : "lunar_python 排盘 · 本地解读完成";
    mysticResults.scrollIntoView({ behavior: "smooth", block: "start" });
    runLiveAnalysis();
  } catch (error) {
    window.clearInterval(messageTimer);
    oracleStage.classList.remove("is-spinning", "is-settling");
    oracleMessage.textContent = "命盘暂时卡住了，请检查本地服务。";
    chartStatus.textContent = `分析失败：${serviceErrorMessage(error)}`;
    chartProgress.style.width = "0%";
  } finally {
    chartButton.disabled = false;
    chartButton.querySelector("span").textContent = "重新流转排盘";
  }
}

function renderLiveAnalysis(result) {
  liveBaziBasis.textContent = result.bazi_basis || "当前命理依据暂未返回，请重新流转排盘。";
  renderList(liveSignals, result.signals);
  liveDeepening.textContent = `${result.deepening} 下一步：${result.next_move}`;
  liveSuggestedLine.textContent = result.suggested_line;
  liveAnalysisStatus.textContent = result.source === "deepseek-v4"
    ? "DeepSeek V4-Pro 已按日主、五行喜忌与当前聊天综合解读"
    : "本地演示引擎已按四柱五行生成基础解读";
  setModelStatus(result.source === "deepseek-v4" || Boolean(result.warning), result.source);
  setMysticStep("live");
}

async function runLiveAnalysis() {
  const mysticResult = mysticResultByScenario[activeScenario];
  if (!mysticResult || liveAnalysisInFlight) return;
  liveAnalysisInFlight = true;
  const conclusion = liveAnalysisStatus.closest(".live-conclusion");
  conclusion.classList.add("is-loading");
  liveAnalysisStatus.textContent = "正在按日主、五行流通与喜忌复核聊天信号……";
  refreshLiveAnalysisButton.disabled = true;
  try {
    const result = await fetchJson("./api/live-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile: mysticProfileByScenario[activeScenario] || mysticResult.profile,
        base_analysis: mysticResult.analysis,
        transcript: collectTranscript(),
      }),
    });
    renderLiveAnalysis(result);
  } catch (error) {
    liveAnalysisStatus.textContent = `实时分析失败：${serviceErrorMessage(error)}`;
  } finally {
    liveAnalysisInFlight = false;
    conclusion.classList.remove("is-loading");
    refreshLiveAnalysisButton.disabled = false;
  }
}

async function addLiveMessage(event) {
  event.preventDefault();
  const text = liveMessage.value.trim();
  if (!text) {
    liveMessage.focus();
    return;
  }
  liveExtras[activeScenario].push(text);
  liveMessage.value = "";
  renderLiveTranscript();
  await runLiveAnalysis();
}

sceneButtons.forEach((button) => {
  button.addEventListener("click", () => renderScenario(button.dataset.scenario));
});

bootSkipButton.addEventListener("click", () => finishBootSequence());
cheatSwitch.addEventListener("click", toggleCheat);
composer.addEventListener("submit", submitMessage);
copyReply.addEventListener("click", copyCurrentReply);
chatRewindButton.addEventListener("click", startChatRewind);
patienceMeter.addEventListener("click", () => setPatienceLedgerOpen(patienceLedger.hidden));
closePatienceLedgerButton.addEventListener("click", () => setPatienceLedgerOpen(false));
resetPatienceButton.addEventListener("click", resetPatienceState);
openMysticLabButton.addEventListener("click", openMysticLab);
closeMysticLabButton.addEventListener("click", closeMysticLab);
fillCurrentOpponentButton.addEventListener("click", fillCurrentOpponent);
birthName.addEventListener("input", syncAnalysisObjectName);
birthCalendar.addEventListener("change", syncBirthFormState);
birthTimePrecision.addEventListener("change", syncBirthFormState);
birthLifeStatus.addEventListener("change", syncBirthFormState);
birthForm.addEventListener("submit", generateMysticProfile);
refreshLiveAnalysisButton.addEventListener("click", runLiveAnalysis);
liveChatForm.addEventListener("submit", addLiveMessage);
mysticLab.addEventListener("pointermove", updateMysticParallax, { passive: true });
mysticLab.addEventListener("pointerleave", () => {
  mysticLab.style.setProperty("--pointer-x", "72%");
  mysticLab.style.setProperty("--pointer-y", "34%");
  clearMysticConstellationHover();
});
document.addEventListener("keydown", (event) => {
  if (!bootScreen.hidden && ["Escape", "Enter", " "].includes(event.key)) {
    event.preventDefault();
    finishBootSequence();
    return;
  }
  if (event.key === "Escape" && !patienceLedger.hidden) {
    setPatienceLedgerOpen(false);
    patienceMeter.focus();
    return;
  }
  if (event.key === "Escape" && !mysticLab.hidden) closeMysticLab();
});
document.addEventListener("click", (event) => {
  if (
    !patienceLedger.hidden
    && !patienceLedger.contains(event.target)
    && !patienceMeter.contains(event.target)
  ) {
    setPatienceLedgerOpen(false);
  }
});

buildOracleRing("branches", earthlyBranches);
buildOracleRing("stems", heavenlyStems);
buildEntryRing(entryBranches, earthlyBranches);
buildEntryRing(entryStems, heavenlyStems);
buildMysticAmbience();
syncBirthFormState();
syncAnalysisObjectName();
persistPatienceState();
renderPatienceState();
renderScenario(activeScenario);
startBootSequence();
