const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const target = process.env.DEMO_URL || "http://127.0.0.1:4173";
const artifacts = path.resolve(__dirname, "../artifacts");
fs.mkdirSync(artifacts, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));

  try {
    await page.goto(target, { waitUntil: "networkidle" });
    assert((await page.title()).includes("工位开挂局"), "页面标题不正确");
    assert((await page.locator(".scene-card").count()) === 3, "三种场景没有完整渲染");
    assert(await page.locator("#send-button").isVisible(), "主操作按钮首屏不可见");
    assert(await page.locator("#cheat-switch").isVisible(), "八字外挂开关首屏不可见");
    assert(await page.locator("#chat-rewind-bar").isHidden(), "外挂未开启时不应展示聊天回溯");
    assert((await page.locator("#patience-balance").textContent()).trim() === "68%", "今日耐心余额没有按默认值初始化");
    await page.locator("#patience-meter").click();
    assert(await page.locator("#patience-ledger").isVisible(), "点击耐心余额后没有打开流水");
    assert(await page.locator("#patience-ledger-empty").isVisible(), "首次进入时没有展示空流水状态");
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(artifacts, "workplace-demo-patience-ledger.png"), fullPage: true });
    await page.locator("#close-patience-ledger").click();
    assert(await page.locator("#patience-ledger").isHidden(), "耐心流水无法关闭");

    const desktopFit = await page.evaluate(() => {
      const button = document.querySelector("#send-button").getBoundingClientRect();
      const cheat = document.querySelector("#cheat-switch").getBoundingClientRect();
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        sendButtonBottom: Math.round(button.bottom),
        cheatBottom: Math.round(cheat.bottom),
        viewportHeight: window.innerHeight,
      };
    });
    assert(desktopFit.scrollWidth <= desktopFit.clientWidth, "桌面端出现横向滚动");
    assert(desktopFit.sendButtonBottom <= desktopFit.viewportHeight, "主操作按钮未进入首屏");
    await page.screenshot({ path: path.join(artifacts, "workplace-demo-initial.png"), fullPage: true });

    await page.getByRole("button", { name: /友善同事局/ }).click();
    assert((await page.locator("#conversation-title").textContent()).includes("小林"), "友善同事场景切换失败");
    const cheatLoadStarted = Date.now();
    await page.locator("#cheat-switch").click();
    assert(await page.locator(".cheat-console").evaluate((node) => node.classList.contains("is-loading")), "外挂加载态未出现");
    assert((await page.locator("#cheat-switch").getAttribute("aria-checked")) === "false", "外挂加载时不应提前开启");
    await page.screenshot({ path: path.join(artifacts, "workplace-demo-cheat-loading.png"), fullPage: true });
    await page.waitForFunction(() => document.querySelector("#cheat-switch").getAttribute("aria-checked") === "true");
    const cheatLoadMs = Date.now() - cheatLoadStarted;
    assert(cheatLoadMs >= 900 && cheatLoadMs <= 2300, `外挂加载时长不在 1–2 秒附近：${cheatLoadMs}ms`);
    assert((await page.locator("#cheat-switch").getAttribute("aria-checked")) === "true", "八字外挂未开启");
    assert((await page.locator("#compatibility-score").textContent()) === "87%", "外挂资料未随场景更新");
    assert(await page.locator("#chat-rewind-bar").isVisible(), "外挂开启后没有解锁聊天回溯");
    assert(await page.locator("#chat-rewind-button").isDisabled(), "尚未完成聊天时回溯按钮不应可用");

    const sentMessage = "谢谢你，咱们十分钟对齐，我来收口，你帮我补盲点。";
    await page.locator("#user-message").fill(sentMessage);
    await page.locator("#send-button").click();
    await page.locator("#thinking-card").waitFor({ state: "visible", timeout: 1500 });
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(artifacts, "workplace-demo-thinking.png"), fullPage: true });

    await page.locator("#analysis-card").waitFor({ state: "visible", timeout: 7000 });
    await page.locator(".message-row--feedback").waitFor({ state: "visible", timeout: 7000 });
    assert((await page.locator(".message-row--user .chat-bubble").textContent()).trim() === sentMessage, "用户原话没有真实进入聊天区");
    const opponentFeedback = (await page.locator(".message-row--feedback .chat-bubble").textContent()).trim();
    assert(opponentFeedback.length > 15, "对方没有给出对应反馈");
    await page.locator("#copy-reply:not([disabled])").waitFor({ state: "visible", timeout: 7000 });
    const reply = (await page.locator("#streaming-reply").textContent()).trim();
    assert(reply.length > 20, "流式回复内容不完整");
    assert((await page.locator("#analysis-steps li").count()) === 4, "外挂模式分析摘要数量不正确");
    assert(await page.locator("#chat-rewind-button").isEnabled(), "完成聊天后回溯按钮没有解锁");
    assert((await page.locator("#patience-balance").textContent()).trim() === "80%", "友善协作完成后耐心余额没有回血 12 点");
    const storedPatience = await page.evaluate(() => JSON.parse(localStorage.getItem("stf-daily-patience-v1")));
    assert(storedPatience.balance === 80 && storedPatience.transactions.length === 1, "耐心余额没有按当天持久化");
    await page.screenshot({ path: path.join(artifacts, "workplace-demo-result.png"), fullPage: true });

    await page.locator("#chat-rewind-button").click();
    await page.waitForFunction(() => document.querySelector(".conversation-stage").classList.contains("is-rewinding"));
    await page.screenshot({ path: path.join(artifacts, "workplace-demo-chat-rewind.png"), fullPage: true });
    await page.waitForFunction(() => !document.querySelector(".conversation-stage").classList.contains("is-rewinding"));
    assert((await page.locator("#user-message").inputValue()).length > 20, "聊天回溯后没有放入改写话术");
    assert((await page.locator("#composer-status").textContent()).includes("回溯完成"), "聊天回溯完成状态未展示");
    assert((await page.locator("#cheat-switch").getAttribute("aria-checked")) === "true", "聊天回溯不应自动关闭外挂");
    assert((await page.locator("#patience-balance").textContent()).trim() === "84%", "聊天回溯没有返还 4 点后悔税");
    await page.locator("#patience-meter").click();
    assert((await page.locator("#patience-ledger-list li").count()) === 2, "耐心流水没有记录对话与回溯");
    await page.locator("#close-patience-ledger").click();

    await page.getByRole("button", { name: /阴阳同事局/ }).click();
    assert((await page.locator("#cheat-switch").getAttribute("aria-checked")) === "false", "切换新场景后外挂没有默认关闭");
    assert(await page.locator("#bazi-profile").getAttribute("aria-hidden") === "true", "切换新场景后外挂资料仍在展示");
    await page.locator("#cheat-switch").click();
    assert(await page.locator(".cheat-console").evaluate((node) => node.classList.contains("is-loading")), "第二次外挂加载态未出现");
    await page.getByRole("button", { name: /上司高压局/ }).click();
    await page.waitForTimeout(2100);
    assert((await page.locator("#cheat-switch").getAttribute("aria-checked")) === "false", "场景切换后旧外挂加载仍然生效");

    await page.getByRole("button", { name: /阴阳同事局/ }).click();
    await page.locator("#user-message").fill("切场景中止测试");
    await page.locator("#send-button").click();
    await page.locator("#thinking-card").waitFor({ state: "visible", timeout: 1500 });
    await page.getByRole("button", { name: /上司高压局/ }).click();
    assert(await page.locator("#send-button").isEnabled(), "切换场景后发送按钮没有恢复");
    assert(await page.locator("#thinking-card").isHidden(), "切换场景后思考状态没有清理");

    await page.locator("#open-mystic-lab").click();
    await page.locator("#mystic-lab").waitFor({ state: "visible" });
    assert(await page.locator("#mystic-lab").evaluate((node) => node.classList.contains("is-entering")), "进入玄学空间时没有启动过场");
    assert(await page.locator("#mystic-entry").isVisible(), "进入玄学空间时命盘过场不可见");
    assert((await page.locator(".mystic-entry__glyph").count()) === 22, "入口命盘的天干地支没有完整渲染");
    await page.waitForTimeout(850);
    await page.screenshot({ path: path.join(artifacts, "mystic-entry-freeze.png") });
    const entryGlyphTilt = await page.locator(".mystic-entry__glyph").evaluateAll((nodes) => Math.max(...nodes.map((node) => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform);
      return Math.abs(Math.atan2(matrix.b, matrix.a) * 180 / Math.PI);
    })));
    assert(entryGlyphTilt < 0.1, `入口命盘文字存在倾斜：${entryGlyphTilt}°`);
    const rotorTransformBefore = await page.locator(".mystic-entry__rotor--outer").evaluate((node) => getComputedStyle(node).transform);
    await page.waitForTimeout(1250);
    const rotorTransformAfter = await page.locator(".mystic-entry__rotor--outer").evaluate((node) => getComputedStyle(node).transform);
    assert(rotorTransformBefore !== rotorTransformAfter, "入口命盘没有缓慢转动");
    await page.screenshot({ path: path.join(artifacts, "mystic-entry-compass.png") });
    await page.waitForFunction(() => document.querySelector("#mystic-lab").classList.contains("is-revealed"), null, { timeout: 6500 });
    assert(await page.locator("#mystic-entry").isHidden(), "入口命盘完成后没有淡出隐去");
    assert((await page.locator("#mystic-title").textContent()).trim() === "玄学分析图", "页面仍被命名为对手玄学分析台");
    assert((await page.locator("#birth-name").inputValue()) === "王总", "没有带入当前对手演示资料");
    assert((await page.locator("#analysis-object-name").textContent()).trim() === "王总", "当前分析对象没有同步");
    assert((await page.locator("#mystic-ambience .mystic-star").count()) === 220, "多层星空没有完整生成");
    assert((await page.locator("#mystic-ambience .mystic-star--river").count()) === 70, "斜向星河没有完整生成");
    assert((await page.locator(".mystic-constellation-group").count()) === 3, "大型星座没有完整生成");
    await page.mouse.move(260, 250);
    await page.waitForTimeout(180);
    assert((await page.locator(".mystic-constellation-group.is-lit").count()) === 1, "鼠标靠近时没有单独点亮对应星座");
    await page.screenshot({ path: path.join(artifacts, "mystic-lab-constellation-hover.png") });
    await page.mouse.move(720, 500);
    await page.waitForTimeout(180);
    assert((await page.locator(".mystic-constellation-group.is-lit").count()) === 0, "鼠标离开星座后光晕没有收回");
    assert((await page.locator("#mystic-ambience .mystic-particle").count()) === 30, "玄学环境粒子没有完整生成");
    assert((await page.locator(".oracle-glyph").count()) === 22, "天干地支流转环没有完整渲染");
    const ringMotion = await page.locator(".oracle-ring--outer").evaluate((node) => getComputedStyle(node, "::before").animationName);
    assert(ringMotion.includes("oracle-rotor-spin"), "命盘等待阶段没有持续流转动效");
    const maxGlyphTilt = await page.locator(".oracle-glyph").evaluateAll((nodes) => Math.max(...nodes.map((node) => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform);
      return Math.abs(Math.atan2(matrix.b, matrix.a) * 180 / Math.PI);
    })));
    assert(maxGlyphTilt < 0.1, `天干地支文字仍有倾斜：${maxGlyphTilt}°`);
    assert(await page.locator("#birth-former-name").isVisible(), "bazi-skill 要求的曾用名字段没有嵌入");
    await page.locator("#birth-time-precision").selectOption("unknown");
    assert(await page.locator("#birth-time").isDisabled(), "时辰不确定时仍强制输入出生时间");
    await page.locator("#birth-time-precision").selectOption("exact");
    assert(await page.locator("#birth-time").isEnabled(), "恢复准确时间后出生时间没有解锁");
    await page.locator("#birth-calendar").selectOption("lunar");
    assert(await page.locator("#leap-month-field").isVisible(), "农历模式没有提供闰月确认");
    await page.locator("#birth-calendar").selectOption("solar");
    await page.screenshot({ path: path.join(artifacts, "mystic-lab-input.png") });

    await page.locator("#chart-button").click();
    await page.locator("#mystic-results").waitFor({ state: "visible", timeout: 60000 });
    assert((await page.locator("#chart-pillars .chart-pillar").count()) === 4, "四柱排盘摘要不完整");
    assert((await page.locator("#skill-pillar-table tbody tr").count()) === 5, "bazi-skill 专业排盘表不完整");
    assert((await page.locator("#skill-pillar-table .pillar-row--stem td").allTextContents()).join("") === "乙壬戊丁", "历法引擎没有输出预期的真实天干");
    assert((await page.locator("#element-balance .element-meter").count()) === 5, "五行分布没有完整渲染");
    assert((await page.locator("#dayun-track .dayun-cycle").count()) === 8, "八步大运没有完整渲染");
    assert((await page.locator("#skill-day-master").textContent()).includes("阳土"), "日主诊断没有渲染");
    assert((await page.locator("#profile-likes li").count()) === 3, "沟通偏好分析不完整");
    assert((await page.locator("#profile-fears li").count()) === 3, "雷区分析不完整");
    assert((await page.locator("[data-mystic-step]").count()) === 4, "玄学分析台应只保留四个分析步骤");
    assert((await page.locator("#mystic-lab [id*='rewind']").count()) === 0, "玄学分析台中仍残留回溯入口");
    await page.waitForFunction(() => document.querySelectorAll("#live-signals li").length === 3);
    await page.screenshot({ path: path.join(artifacts, "mystic-lab-result.png") });

    await page.locator("#live-message").fill("这个进度你最好今天就给我一个明确答复。");
    await page.locator("#live-chat-form button").click();
    await page.waitForFunction(() => document.querySelectorAll("#live-signals li").length === 3);
    assert((await page.locator("#live-deepening").textContent()).length > 20, "实时加深分析未输出");

    await page.locator("#close-mystic-lab").click();
    await page.locator("#mystic-lab").waitFor({ state: "hidden", timeout: 3000 });

    assert(errors.length === 0, `浏览器错误：${errors.join(" | ")}`);
    console.log(JSON.stringify({
      ok: true,
      desktopFit,
      replyLength: reply.length,
      screenshots: [
        "artifacts/workplace-demo-initial.png",
        "artifacts/workplace-demo-patience-ledger.png",
        "artifacts/workplace-demo-thinking.png",
        "artifacts/workplace-demo-result.png",
        "artifacts/workplace-demo-cheat-loading.png",
        "artifacts/workplace-demo-chat-rewind.png",
        "artifacts/mystic-entry-freeze.png",
        "artifacts/mystic-entry-compass.png",
        "artifacts/mystic-lab-constellation-hover.png",
        "artifacts/mystic-lab-input.png",
        "artifacts/mystic-lab-result.png",
      ],
    }, null, 2));
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
