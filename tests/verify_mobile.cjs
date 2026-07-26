const path = require("node:path");
const { chromium } = require("playwright");

const target = process.env.DEMO_URL || "http://127.0.0.1:4174/";
const artifacts = path.resolve(__dirname, "../artifacts");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function mobileReplyEvents() {
  return [
    { type: "meta", think_seconds: 1 },
    { type: "opponent_start", sender: "王总", reaction: "开始拍板", source: "mobile-test" },
    { type: "opponent_delta", text: "可以，先把今晚能交付的范围和明早节点发我。" },
    { type: "coach_wait", bazi_enabled: false },
    { type: "analysis_start", mode: "移动端拆招", tone: "边界清晰", satisfaction: 84, work: 89 },
    {
      type: "character_profile",
      source: "mobile-test",
      profile: {
        name: "王总",
        role: "上司",
        archetype: "结果控制型上司",
        traits: ["重结果", "要节点", "接受选择题"],
        evidence: "先把今晚能交付的范围和明早节点发我。",
        observed_tendency: "接受明确边界",
        current_need: "确认交付",
        communication_habit: "先压节点",
      },
    },
    { type: "analysis_item", text: "先确认范围，再锁定可以验收的时间点。" },
    { type: "analysis_item", text: "避免继续笼统承诺，把下一步变成可确认的选择题。" },
    { type: "reply_start" },
    { type: "delta", text: "收到，今晚先交框架，明早十点补齐；若优先级变化请您直接拍板。" },
    { type: "done", satisfaction: 84, work: 89, patience_delta: 0, patience_reason: "移动端回归", outcome: "对话继续推进" },
  ].map((event) => JSON.stringify(event)).join("\n") + "\n";
}

async function inspectMobile(browser, viewport, { capture = false, generateChart = false } = {}) {
  const context = await browser.newContext({
    viewport,
    isMobile: true,
    hasTouch: true,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  await page.route("**/api/respond", (route) => route.fulfill({
    status: 200,
    contentType: "application/x-ndjson; charset=utf-8",
    body: mobileReplyEvents(),
  }));

  try {
    await page.goto(target, { waitUntil: "networkidle" });
    const boot = await page.evaluate(() => {
      const viewportWidth = document.documentElement.clientWidth;
      const screen = document.querySelector("#boot-screen").getBoundingClientRect();
      const skip = document.querySelector("#boot-skip").getBoundingClientRect();
      const stage = document.querySelector(".boot-screen__stage").getBoundingClientRect();
      return {
        viewportWidth,
        documentWidth: document.documentElement.scrollWidth,
        screenWidth: screen.width,
        stageLeft: stage.left,
        stageRight: stage.right,
        skipLeft: skip.left,
        skipRight: skip.right,
        skipHeight: skip.height,
      };
    });
    assert(boot.documentWidth <= boot.viewportWidth + 1, `${viewport.width}px 启动页出现横向溢出`);
    assert(boot.screenWidth <= boot.viewportWidth + 1, `${viewport.width}px 启动页仍被锁定为桌面宽度`);
    assert(boot.stageLeft >= -2 && boot.stageRight <= boot.viewportWidth + 2, `${viewport.width}px 启动内容被裁切`);
    assert(boot.skipLeft >= 0 && boot.skipRight <= boot.viewportWidth, `${viewport.width}px 跳过按钮不在可视范围`);
    assert(boot.skipHeight >= 43.5, `${viewport.width}px 跳过按钮触控高度不足 44px`);
    if (capture) await page.screenshot({ path: path.join(artifacts, "mobile-boot-390.png"), fullPage: false });

    await page.locator("#boot-skip").click();
    await page.locator("#boot-screen").waitFor({ state: "hidden", timeout: 2500 });

    const main = await page.evaluate(() => {
      const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
      const scene = rect(".scene-rail");
      const buff = rect("#mobile-buff-bar");
      const stage = rect(".conversation-stage");
      const chat = rect("#chat-window");
      const sceneList = document.querySelector(".scene-list");
      const controlSelectors = [
        "#mobile-cheat-switch",
        "#mobile-open-mystic",
        ".quick-prompt",
        "#send-button",
      ];
      return {
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        sceneBottom: scene.bottom,
        buffTop: buff.top,
        buffBottom: buff.bottom,
        stageTop: stage.top,
        stageBottom: stage.bottom,
        stageHeight: stage.height,
        chatHeight: chat.height,
        cheatHidden: getComputedStyle(document.querySelector(".cheat-console")).display === "none",
        sceneListClientWidth: sceneList.clientWidth,
        sceneListScrollWidth: sceneList.scrollWidth,
        textareaFont: Number.parseFloat(getComputedStyle(document.querySelector("#user-message")).fontSize),
        controlHeights: controlSelectors.map((selector) => ({
          selector,
          height: rect(selector).height,
        })),
      };
    });
    assert(main.documentWidth <= main.viewportWidth + 1, `${viewport.width}px 主页面出现横向溢出`);
    assert(main.sceneListScrollWidth > main.sceneListClientWidth, `${viewport.width}px 场景卡没有形成横向滑动区`);
    assert(main.sceneBottom <= main.buffTop + 1, `${viewport.width}px 可选增益条没有排在场景之后`);
    assert(main.buffBottom <= main.stageTop + 1, `${viewport.width}px 聊天没有紧跟移动增益条`);
    assert(main.cheatHidden, `${viewport.width}px 未开启时仍重复展示第二套完整外挂控件`);
    assert(main.stageHeight <= Math.max(viewport.height + 1, 561), `${viewport.width}px 聊天面板高于可用移动视口`);
    assert(main.chatHeight >= 250, `${viewport.width}px 聊天记录可视区过小`);
    assert(main.textareaFont >= 16, `${viewport.width}px 聊天输入字号会触发 iOS 自动缩放`);
    main.controlHeights.forEach(({ selector, height }) => {
      assert(height >= 43.5, `${viewport.width}px ${selector} 触控高度不足 44px`);
    });

    const stageHeightBeforeReply = (await page.locator(".conversation-stage").boundingBox()).height;
    await page.locator("#user-message").fill("今晚先交框架，明早十点补齐，请您确认优先级。");
    await page.locator("#send-button").click();
    await page.waitForFunction(() => !document.querySelector("#send-button").disabled);
    const replyLayout = await page.locator("#chat-window").evaluate((node) => ({
      clientHeight: node.clientHeight,
      scrollHeight: node.scrollHeight,
      userMessages: node.querySelectorAll(".message-row--user").length,
      replies: node.querySelectorAll(".message-row--feedback").length,
    }));
    const stageHeightAfterReply = (await page.locator(".conversation-stage").boundingBox()).height;
    assert(replyLayout.userMessages === 1 && replyLayout.replies === 1, `${viewport.width}px 手机端无法完成一轮对话`);
    assert(replyLayout.scrollHeight > replyLayout.clientHeight, `${viewport.width}px 回复没有进入聊天内部滚动区`);
    assert(Math.abs(stageHeightAfterReply - stageHeightBeforeReply) <= 2, `${viewport.width}px 回复把聊天面板继续向下撑长`);

    await page.locator("#mobile-cheat-switch").click();
    await page.waitForFunction(
      () => document.querySelector("#mobile-cheat-switch").getAttribute("aria-checked") === "true",
      null,
      { timeout: 3500 },
    );
    assert(
      await page.locator("#cheat-switch").getAttribute("aria-checked") === "true",
      "移动外挂开关与完整面板状态没有同步",
    );
    const activeCheat = await page.locator(".cheat-console").evaluate((node) => {
      const rect = node.getBoundingClientRect();
      const stage = document.querySelector(".conversation-stage").getBoundingClientRect();
      return {
        visible: getComputedStyle(node).display !== "none",
        top: rect.top,
        stageBottom: stage.bottom,
        duplicateSwitchVisible: getComputedStyle(document.querySelector("#cheat-switch")).display !== "none",
        duplicateEntryVisible: getComputedStyle(document.querySelector("#open-mystic-lab")).display !== "none",
      };
    });
    assert(activeCheat.visible && activeCheat.top >= activeCheat.stageBottom, "外挂详情没有在聊天后方按需展开");
    assert(!activeCheat.duplicateSwitchVisible && !activeCheat.duplicateEntryVisible, "手机端仍显示重复的外挂控件");
    if (capture) await page.screenshot({ path: path.join(artifacts, "mobile-main-390.png"), fullPage: true });

    await page.locator("#mobile-open-mystic").click();
    await page.waitForFunction(() => document.activeElement === document.querySelector("#mystic-entry"));
    assert(await page.locator(".mystic-workbench").evaluate((node) => node.inert), "玄学入场期间工作区没有锁定");
    await page.keyboard.press("Tab");
    assert(
      await page.locator("#mystic-entry").evaluate((node) => node === document.activeElement),
      "玄学入场期间焦点逃入尚未显现的工作区",
    );
    await page.waitForFunction(
      () => document.querySelector("#mystic-lab").classList.contains("is-revealed"),
      null,
      { timeout: 7000 },
    );
    assert(await page.locator(".mystic-workbench").evaluate((node) => !node.inert), "玄学入场完成后工作区仍被锁定");
    const mystic = await page.evaluate(() => {
      const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
      const lab = rect("#mystic-lab");
      const header = rect(".mystic-header");
      const workbench = rect(".mystic-workbench");
      const form = rect(".birth-form");
      const oracle = rect(".chart-oracle");
      const close = rect("#close-mystic-lab");
      const model = rect("#model-status");
      return {
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        labWidth: lab.width,
        headerRight: header.right,
        workbenchLeft: workbench.left,
        workbenchRight: workbench.right,
        formBottom: form.bottom,
        oracleTop: oracle.top,
        closeHeight: close.height,
        modelRight: model.right,
        inputFont: Number.parseFloat(getComputedStyle(document.querySelector("#birth-name")).fontSize),
        inputHeight: rect("#birth-name").height,
      };
    });
    assert(mystic.documentWidth <= mystic.viewportWidth + 1, `${viewport.width}px 玄学空间出现页面级横向溢出`);
    assert(mystic.labWidth <= mystic.viewportWidth + 1, `${viewport.width}px 玄学空间仍被锁定为桌面宽度`);
    assert(mystic.headerRight <= mystic.viewportWidth + 1, `${viewport.width}px 玄学页头被裁切`);
    assert(mystic.workbenchLeft >= 0 && mystic.workbenchRight <= mystic.viewportWidth, `${viewport.width}px 玄学工作台被裁切`);
    assert(mystic.oracleTop >= mystic.formBottom, `${viewport.width}px 表单和命盘没有改为单列`);
    assert(mystic.closeHeight >= 43.5, `${viewport.width}px 玄学返回按钮触控高度不足 44px`);
    assert(mystic.modelRight <= mystic.viewportWidth, `${viewport.width}px 模型状态超出屏幕`);
    assert(mystic.inputFont >= 16 && mystic.inputHeight >= 43.5, `${viewport.width}px 玄学表单不适合手机输入`);
    if (capture) await page.screenshot({ path: path.join(artifacts, "mobile-mystic-input-390.png"), fullPage: false });

    if (generateChart) {
      await page.locator("#fill-current-opponent").click();
      await page.locator("#chart-button").click();
      await page.locator("#mystic-results").waitFor({ state: "visible", timeout: 20000 });
      await page.waitForFunction(() => document.querySelector(".pillar-table-wrap").scrollLeft > 0);
      const result = await page.evaluate(() => {
        const results = document.querySelector("#mystic-results").getBoundingClientRect();
        const tableWrap = document.querySelector(".pillar-table-wrap");
        const diagnostics = document.querySelector(".chart-diagnostics").getBoundingClientRect();
        const table = document.querySelector(".skill-pillar-table").getBoundingClientRect();
        const dayMaster = document.querySelector(".day-master-cell").getBoundingClientRect();
        const firstCard = document.querySelector(".insight-card").getBoundingClientRect();
        return {
          viewportWidth: document.documentElement.clientWidth,
          documentWidth: document.documentElement.scrollWidth,
          resultsLeft: results.left,
          resultsRight: results.right,
          tableWrapClientWidth: tableWrap.clientWidth,
          tableWrapScrollWidth: tableWrap.scrollWidth,
          tableWrapLeft: tableWrap.getBoundingClientRect().left,
          tableWrapRight: tableWrap.getBoundingClientRect().right,
          tableScrollLeft: tableWrap.scrollLeft,
          dayMasterLeft: dayMaster.left,
          dayMasterRight: dayMaster.right,
          diagnosticsTop: diagnostics.top,
          tableBottom: table.bottom,
          firstCardRight: firstCard.right,
        };
      });
      assert(result.documentWidth <= result.viewportWidth + 1, "排盘结果造成页面级横向溢出");
      assert(result.resultsLeft >= 0 && result.resultsRight <= result.viewportWidth, "排盘结果面板超出手机屏幕");
      assert(result.tableWrapScrollWidth > result.tableWrapClientWidth, "密集命盘表没有使用局部横向滑动");
      assert(result.tableScrollLeft > 0, "手机排盘结果没有优先定位到日主列");
      assert(
        result.dayMasterLeft >= result.tableWrapLeft && result.dayMasterRight <= result.tableWrapRight,
        "手机排盘结果中的日主列没有显示在可视区域",
      );
      assert(result.diagnosticsTop >= result.tableBottom - 1, "命盘诊断没有堆叠到表格下方");
      assert(result.firstCardRight <= result.viewportWidth, "职场分析卡片超出手机屏幕");
      if (capture) await page.screenshot({ path: path.join(artifacts, "mobile-mystic-result-390.png"), fullPage: false });
    }

    await page.locator("#close-mystic-lab").click();
    assert(await page.locator("#mystic-lab").isHidden(), "玄学空间无法在手机端关闭");
    assert(
      await page.locator("#mobile-open-mystic").evaluate((node) => node === document.activeElement),
      "关闭玄学空间后焦点没有回到移动端入口",
    );
    assert(errors.length === 0, errors.join("；"));
    return { viewport, main, mystic };
  } finally {
    await context.close();
  }
}

async function inspectTablet(browser) {
  const viewport = { width: 1024, height: 768 };
  const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await page.goto(target, { waitUntil: "networkidle" });
    const boot = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      screenWidth: document.querySelector("#boot-screen").getBoundingClientRect().width,
      skipRight: document.querySelector("#boot-skip").getBoundingClientRect().right,
    }));
    assert(boot.documentWidth <= boot.viewportWidth + 1 && boot.screenWidth <= boot.viewportWidth + 1, "1024px 平板启动页仍被锁定为 1120px");
    assert(boot.skipRight <= boot.viewportWidth, "1024px 平板启动页跳过按钮被裁切");
    await page.locator("#boot-skip").click();
    await page.locator("#boot-screen").waitFor({ state: "hidden", timeout: 2500 });
    assert(
      Number.parseFloat(await page.locator("#user-message").evaluate((node) => getComputedStyle(node).fontSize)) >= 16,
      "1024px 平板聊天输入仍会触发 iOS 自动缩放",
    );
    await page.locator("#open-mystic-lab").click();
    await page.waitForFunction(
      () => document.querySelector("#mystic-lab").classList.contains("is-revealed"),
      null,
      { timeout: 7000 },
    );
    const mystic = await page.evaluate(() => {
      const lab = document.querySelector("#mystic-lab").getBoundingClientRect();
      const workbench = document.querySelector(".mystic-workbench").getBoundingClientRect();
      const input = document.querySelector("#birth-name");
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        labWidth: lab.width,
        workbenchLeft: workbench.left,
        workbenchRight: workbench.right,
        inputFont: Number.parseFloat(getComputedStyle(input).fontSize),
        inputHeight: input.getBoundingClientRect().height,
      };
    });
    assert(mystic.documentWidth <= mystic.viewportWidth + 1 && mystic.labWidth <= mystic.viewportWidth + 1, "1024px 平板玄学空间仍被锁定为 1120px");
    assert(mystic.workbenchLeft >= 0 && mystic.workbenchRight <= mystic.viewportWidth, "1024px 平板玄学工作台被裁切");
    assert(mystic.inputFont >= 16 && mystic.inputHeight >= 43.5, "1024px 平板玄学输入控件尺寸不足");
    await page.locator("#close-mystic-lab").click();
    return { viewport };
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const results = [];
    results.push(await inspectMobile(browser, { width: 390, height: 844 }, { capture: true, generateChart: true }));
    results.push(await inspectMobile(browser, { width: 430, height: 932 }));
    results.push(await inspectMobile(browser, { width: 844, height: 390 }));
    results.push(await inspectTablet(browser));
    console.log(JSON.stringify({
      ok: true,
      viewports: results.map(({ viewport, main }) => ({
        ...viewport,
        ...(main ? { chatHeight: Math.round(main.chatHeight) } : {}),
      })),
    }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
