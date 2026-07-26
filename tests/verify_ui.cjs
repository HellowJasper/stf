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
    assert(await page.locator("#boot-screen").isVisible(), "开始加载界面没有显示");
    assert((await page.locator("#boot-stage-text").textContent()).includes("职场气压"), "开始加载界面首阶段文案不正确");
    const bootStyleSignature = () => page.evaluate(() => {
      const screen = document.querySelector("#boot-screen");
      const scene = document.querySelector(".boot-workbench__scene");
      return `${getComputedStyle(screen).backgroundColor}|${getComputedStyle(screen).backgroundImage}|${getComputedStyle(scene).backgroundColor}`;
    });
    const bootStageOneStyle = await bootStyleSignature();
    const bootProgressSeconds = await page.locator(".boot-loader__track span").evaluate((node) => Number.parseFloat(getComputedStyle(node).animationDuration));
    assert(bootProgressSeconds >= 6.5, "开始加载总时长没有延长到 7 秒附近");
    await page.screenshot({ path: path.join(artifacts, "workplace-demo-boot.png"), fullPage: false });
    await page.waitForFunction(() => document.querySelector("#boot-screen").dataset.stage === "2");
    assert((await page.locator("#boot-stage-text").textContent()).includes("三大战场"), "开始加载界面没有进入第二阶段");
    const bootStageTwoStyle = await bootStyleSignature();
    assert(bootStageTwoStyle !== bootStageOneStyle, "第二阶段背景与第一阶段没有发生变化");
    await page.screenshot({ path: path.join(artifacts, "workplace-demo-boot-stage-2.png"), fullPage: false });
    await page.waitForFunction(() => document.querySelector("#boot-screen").dataset.stage === "3");
    assert((await page.locator("#boot-stage-text").textContent()).includes("八字外挂"), "开始加载界面没有进入第三阶段");
    const bootStageThreeStyle = await bootStyleSignature();
    assert(bootStageThreeStyle !== bootStageTwoStyle, "第三阶段背景与第二阶段没有发生变化");
    await page.screenshot({ path: path.join(artifacts, "workplace-demo-boot-stage-3.png"), fullPage: false });
    await page.locator("#boot-skip").click();
    await page.locator("#boot-screen").waitFor({ state: "hidden", timeout: 2000 });
    assert(await page.locator("body").evaluate((node) => node.classList.contains("is-booted")), "开始加载界面退场后主页面没有解锁");
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

    await page.locator("#analysis-card").waitFor({ state: "visible", timeout: 18000 });
    await page.locator(".message-row--feedback").waitFor({ state: "visible", timeout: 18000 });
    assert((await page.locator(".message-row--user .chat-bubble").textContent()).trim() === sentMessage, "用户原话没有真实进入聊天区");
    const opponentFeedback = (await page.locator(".message-row--feedback .chat-bubble").textContent()).trim();
    assert(opponentFeedback.length > 15, "对方没有给出对应反馈");
    await page.locator("#copy-reply:not([disabled])").waitFor({ state: "visible", timeout: 18000 });
    const reply = (await page.locator("#streaming-reply").textContent()).trim();
    assert(reply.length > 20, "流式回复内容不完整");
    assert((await page.locator("#analysis-steps li").count()) === 4, "外挂模式分析摘要数量不正确");
    assert((await page.locator("#character-tags li").count()) === 3, "人物性格标签没有完整渲染");
    assert((await page.locator("#character-evidence").textContent()).includes(opponentFeedback.slice(0, 12)), "人物侧写没有引用本轮真实回复");
    assert(await page.locator("#chat-bazi-profile").isVisible(), "开启外挂后没有展示专业八字校准");
    assert(await page.locator("#analysis-card").evaluate((node) => node.classList.contains("is-bazi-analysis")), "外挂结果没有进入专业命盘视觉模式");
    assert((await page.locator("#chat-bazi-pillars > div").count()) === 4, "聊天区专业四柱没有完整渲染");
    assert((await page.locator("#chat-bazi-day-master").textContent()).includes("甲 · 阳木"), "聊天区日主不是历法引擎的真实结果");
    assert((await page.locator("#chat-bazi-month").textContent()).includes("戌月令"), "聊天区月令没有展示");
    assert((await page.locator("#chat-bazi-ten-gods").textContent()).trim().length > 2, "聊天区可见十神没有展示");
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

    await page.locator("#user-message").fill("今晚我先交框架，完整稿明天十一点给您，请确认验收口径。");
    await page.locator("#send-button").click();
    await page.locator("#analysis-card").waitFor({ state: "visible", timeout: 18000 });
    await page.locator("#copy-reply:not([disabled])").waitFor({ state: "visible", timeout: 18000 });
    assert((await page.locator("#analysis-steps li").count()) === 3, "普通模式公开分析不应混入八字项");
    assert((await page.locator("#character-archetype").textContent()).includes("结果控制型上司"), "普通模式没有突出上司人物性格");
    assert((await page.locator("#character-tags li").count()) === 3, "普通模式人物标签不完整");
    assert(await page.locator("#chat-bazi-profile").isHidden(), "普通模式错误展示了八字专业卡");
    await page.screenshot({ path: path.join(artifacts, "workplace-demo-character-real.png"), fullPage: true });

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
    assert(await page.locator("#birth-former-name-year").isVisible(), "曾用名缺少可选改名年份");
    await page.locator("#birth-time-precision").selectOption("unknown");
    assert(await page.locator("#birth-time").isDisabled(), "时辰不确定时仍强制输入出生时间");
    await page.locator("#birth-time-precision").selectOption("exact");
    assert(await page.locator("#birth-time").isEnabled(), "恢复准确时间后出生时间没有解锁");
    await page.locator("#birth-calendar").selectOption("lunar");
    assert(await page.locator("#leap-month-field").isVisible(), "农历模式没有提供闰月确认");
    await page.locator("#birth-calendar").selectOption("solar");
    await page.locator("#birth-name").fill("自定义对手");
    await page.locator("#birth-former-name").fill("旧称甲");
    await page.locator("#birth-former-name-year").fill("2018");
    await page.locator("#birth-date").fill("1990-02-14");
    await page.locator("#birth-time").fill("20:10");
    await page.screenshot({ path: path.join(artifacts, "mystic-lab-input.png") });

    await page.locator("#chart-button").click();
    await page.locator("#mystic-results").waitFor({ state: "visible", timeout: 60000 });
    assert((await page.locator("#chart-pillars .chart-pillar").count()) === 4, "四柱排盘摘要不完整");
    assert((await page.locator("#skill-pillar-table tbody tr").count()) === 5, "bazi-skill 专业排盘表不完整");
    assert((await page.locator("#skill-pillar-table .pillar-row--stem td").allTextContents()).join("") === "庚戊庚丙", "历法引擎没有输出自定义出生日期对应的真实天干");
    assert((await page.locator("#skill-pillar-table .day-master-cell").textContent()).includes("庚"), "日主天干没有被单独标记");
    assert((await page.locator("#skill-pillar-table .day-pillar-heading small").textContent()).trim() === "日主所在", "日柱表头没有说明日主位置");
    const dayMasterMotion = await page.locator("#skill-pillar-table .day-master-cell").evaluate((node) => getComputedStyle(node).animationName);
    assert(dayMasterMotion.includes("day-master-focus"), "日主核心格没有呼吸高亮动效");
    assert((await page.locator("#element-balance .element-meter").count()) === 5, "五行分布没有完整渲染");
    assert((await page.locator("#dayun-track .dayun-cycle").count()) === 8, "八步大运没有完整渲染");
    assert((await page.locator("#skill-day-master").textContent()).includes("阳金"), "日主诊断没有渲染自定义命盘");
    assert((await page.locator("#skill-runtime-card").getAttribute("data-state")) === "loaded", "结果页没有展示可验证的 bazi-skill 运行态");
    assert((await page.locator("#skill-runtime-status").textContent()).includes("Skill 运行时已加载"), "来源卡没有明确说明 Skill 已真实加载");
    assert((await page.locator("#skill-runtime-count").textContent()).trim() === "4/4", "bazi-skill 四份参考文件没有完整加载");
    assert((await page.locator("#skill-runtime-version").textContent()).includes("SHA"), "来源卡没有展示 Skill 契约文件指纹");
    assert((await page.locator("#skill-runtime-references li").count()) === 4, "来源卡没有逐项展示四份参考文件");
    assert((await page.locator("#skill-strength-evidence li").count()) >= 3, "旺衰证据链没有完整展示");
    assert((await page.locator("#skill-pattern-analysis").textContent()).trim().length > 20, "格局依据没有展示");
    assert((await page.locator("#skill-climate-analysis").textContent()).trim().length > 12, "调候复核没有展示");
    assert((await page.locator("#skill-current-dayun").textContent()).trim().length > 20, "当前大运分析没有展示");
    assert((await page.locator("#skill-current-year").textContent()).trim().length > 20, "流年分析没有展示");
    assert((await page.locator("#skill-historical-calibration li").count()) >= 3, "历史事件校准问题没有展示");
    assert((await page.locator("#profile-likes li").count()) === 3, "沟通偏好分析不完整");
    assert((await page.locator("#profile-fears li").count()) === 3, "雷区分析不完整");
    assert((await page.locator("[data-mystic-step]").count()) === 4, "玄学分析台应只保留四个分析步骤");
    assert((await page.locator("#mystic-lab [id*='rewind']").count()) === 0, "玄学分析台中仍残留回溯入口");
    await page.waitForFunction(() => document.querySelectorAll("#live-signals li").length === 3);
    assert((await page.locator("#live-bazi-basis").textContent()).includes("四柱"), "实时解读没有展示四柱命理依据");
    assert((await page.locator("#live-bazi-basis").textContent()).includes("日主"), "实时解读没有展示日主依据");
    const liveSignalTexts = await page.locator("#live-signals li").allTextContents();
    assert(liveSignalTexts[0].startsWith("日主锚点｜"), "第一条实时解读不是日主锚点");
    assert(liveSignalTexts[1].startsWith("五行流通｜"), "第二条实时解读不是五行流通");
    assert(liveSignalTexts[2].startsWith("喜忌×聊天｜"), "第三条实时解读没有关联喜忌与聊天");
    await page.screenshot({ path: path.join(artifacts, "mystic-lab-result.png") });

    await page.locator("#live-message").fill("这个进度你最好今天就给我一个明确答复。");
    await page.locator("#live-chat-form button").click();
    await page.waitForFunction(() => document.querySelectorAll("#live-signals li").length === 3);
    assert((await page.locator("#live-deepening").textContent()).length > 20, "实时加深分析未输出");

    await page.locator("#close-mystic-lab").click();
    await page.locator("#mystic-lab").waitFor({ state: "hidden", timeout: 3000 });

    await page.locator("#cheat-switch").click();
    await page.waitForFunction(() => document.querySelector("#cheat-switch").getAttribute("aria-checked") === "true");
    assert(await page.locator("#bazi-profile-takeover").isVisible(), "自定义命盘完成后右侧外挂没有显示接管状态");
    assert((await page.locator("#bazi-profile-takeover").textContent()).includes("专业排盘已接管外挂"), "自定义命盘接管提示不明确");
    assert((await page.locator("#bazi-profile-source").textContent()).includes("自定义对手"), "外挂缩略区没有显示自定义分析对象");
    assert((await page.locator("#pillar-grid").textContent()).includes("庚午"), "外挂缩略区仍在使用当前场景的演示四柱");
    assert((await page.locator("#element-label").textContent()).includes("庚日主"), "外挂缩略区没有显示自定义日主");
    assert((await page.locator("#compatibility-label").textContent()).includes("娱乐"), "沟通适配度没有明确娱乐属性");
    assert((await page.locator("#trigger-copy").textContent()).trim().length > 3, "外挂缩略区没有显示自定义雷点");
    assert((await page.locator("#delight-copy").textContent()).trim().length > 3, "外挂缩略区没有显示自定义偏好");
    assert((await page.locator("#strategy-copy").textContent()).trim().length > 8, "外挂缩略区没有显示自定义沟通策略");

    const customRequestPromise = page.waitForRequest((request) => (
      request.method() === "POST" && request.url().includes("/api/respond")
    ));
    await page.locator("#user-message").fill("这是一条验证自定义专业命盘接管的消息。");
    await page.locator("#send-button").click();
    const customRequest = await customRequestPromise;
    const customPayload = customRequest.postDataJSON();
    const customBaziProfile = customPayload.bazi_profile;
    assert(Object.keys(customBaziProfile).sort().join(",") === "analysis,chart,profile_name", "聊天请求没有使用最小化的安全命盘契约");
    assert(customBaziProfile.profile_name === "自定义对手", "聊天请求没有携带自定义命盘对象名");
    assert(customBaziProfile.chart.day_master.stem === "庚", "聊天请求仍在使用场景静态日主");
    assert(customBaziProfile.analysis.analysis_as_of_year === new Date().getFullYear(), "聊天请求丢失命盘分析截止年");
    assert(customBaziProfile.chart.pillars.map((pillar) => `${pillar.stem}${pillar.branch}`).join("·") !== "乙丑·壬午·戊子·丁巳", "聊天请求仍在使用王总的静态演示四柱");
    assert(!Object.hasOwn(customBaziProfile, "birth_date") && !Object.hasOwn(customBaziProfile, "birth_place"), "聊天请求泄露了原始生日或地点字段");
    assert(!JSON.stringify(customBaziProfile).includes("江苏省南京市"), "聊天命盘载荷泄露了出生地点");
    await page.getByRole("button", { name: /友善同事局/ }).click();

    assert(errors.length === 0, `浏览器错误：${errors.join(" | ")}`);
    console.log(JSON.stringify({
      ok: true,
      desktopFit,
      replyLength: reply.length,
      screenshots: [
        "artifacts/workplace-demo-boot.png",
        "artifacts/workplace-demo-boot-stage-2.png",
        "artifacts/workplace-demo-boot-stage-3.png",
        "artifacts/workplace-demo-initial.png",
        "artifacts/workplace-demo-patience-ledger.png",
        "artifacts/workplace-demo-thinking.png",
        "artifacts/workplace-demo-result.png",
        "artifacts/workplace-demo-cheat-loading.png",
        "artifacts/workplace-demo-chat-rewind.png",
        "artifacts/workplace-demo-character-real.png",
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
