const { chromium } = require("playwright");

const target = process.env.DEMO_URL || "http://127.0.0.1:4173";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function turnEvents(index) {
  const opponentReply = index === 1
    ? "先把今晚能交付的范围发我，我来确认优先级。"
    : "可以，按刚才的上下文继续，把第二项的时间也定下来。";
  return [
    { type: "meta", think_seconds: 1 },
    { type: "opponent_start", sender: "王总", reaction: "开始拍板", source: "test-double" },
    { type: "opponent_delta", text: opponentReply },
    { type: "coach_wait", bazi_enabled: false },
    { type: "analysis_start", mode: "职场拆招", tone: "边界清晰", satisfaction: 82, work: 88 },
    {
      type: "character_profile",
      source: "test-double",
      profile: {
        name: "王总",
        role: "上司",
        archetype: "结果控制型上司",
        traits: ["重结果", "要节点", "接受选择题"],
        evidence: opponentReply,
        observed_tendency: "接受明确边界",
        current_need: "确认交付",
        communication_habit: "先压节点",
      },
    },
    { type: "analysis_item", text: "保留上下文继续推进。" },
    { type: "reply_start" },
    { type: "delta", text: `第${index}轮建议：确认范围、优先级和截止时间。` },
    {
      type: "done",
      satisfaction: 82,
      work: 88,
      patience_delta: 0,
      patience_reason: "回归测试",
      outcome: "对话继续推进",
    },
  ].map((event) => JSON.stringify(event)).join("\n") + "\n";
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const requests = [];
  const failures = [];
  let turn = 0;

  await page.route("**/api/respond", async (route) => {
    requests.push(JSON.parse(route.request().postData() || "{}"));
    turn += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/x-ndjson; charset=utf-8",
      body: turnEvents(turn),
    });
  });

  try {
    await page.goto(target, { waitUntil: "networkidle" });
    await page.locator("#boot-skip").click();

    const mysticEntry = page.locator("#open-mystic-lab");
    const conversationHeightBefore = (await page.locator(".conversation-stage").boundingBox()).height;
    const mysticEntryBox = await mysticEntry.boundingBox();
    const mysticEntryText = await mysticEntry.textContent();
    assert(
      mysticEntryBox && mysticEntryBox.width >= 250 && mysticEntryBox.height >= 90,
      "可选增益仍是难以发现的小型入口",
    );
    assert(
      mysticEntryText.includes("进入玄学分析图") && mysticEntryText.includes("点击进入"),
      "可选增益入口没有明确说明可以进入独立分析界面",
    );

    await page.evaluate(() => {
      const calendar = document.querySelector("#birth-calendar");
      calendar.value = "lunar";
      calendar.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const lunarInputType = await page.locator("#birth-date").getAttribute("type");
    if (lunarInputType !== "text") {
      failures.push("农历模式仍使用公历 date 控件，农历二月三十等合法日期无法输入");
      await page.locator("#birth-date").evaluate((node) => { node.type = "text"; });
    }
    await page.locator("#birth-date").evaluate((node) => { node.value = "1981-02-30"; });
    assert(
      await page.locator("#birth-date").inputValue() === "1981-02-30",
      "合法农历日期未被完整保留",
    );

    const firstMessage = "今晚我先交框架，请您确认最高优先级。";
    const secondMessage = "收到，那第二项我明天上午十一点交，可以吗？";
    await page.locator("#user-message").fill(firstMessage);
    await page.locator("#send-button").click();
    await page.waitForFunction(() => !document.querySelector("#send-button").disabled);
    await page.locator("#user-message").fill(secondMessage);
    await page.locator("#send-button").click();
    await page.waitForFunction(() => !document.querySelector("#send-button").disabled);

    if (await page.locator(".message-row--user").count() !== 2) failures.push("第二轮发送后第一轮用户消息被清空");
    if (await page.locator(".message-row--feedback").count() !== 2) failures.push("第二轮发送后第一轮对方回复被清空");
    const conversationHeightAfter = (await page.locator(".conversation-stage").boundingBox()).height;
    assert(
      Math.abs(conversationHeightAfter - conversationHeightBefore) <= 2,
      "多轮消息仍把整个聊天面板不断向下撑长",
    );
    const scrollMetrics = await page.locator("#chat-window").evaluate((node) => ({
      clientHeight: node.clientHeight,
      scrollHeight: node.scrollHeight,
    }));
    assert(
      scrollMetrics.scrollHeight > scrollMetrics.clientHeight,
      "聊天记录没有形成内部上下滚动区域",
    );
    await page.locator("#chat-window").evaluate((node) => { node.scrollTop = 0; });
    await page.waitForFunction(() => !document.querySelector("#chat-jump-latest").hidden);
    await page.locator("#chat-jump-latest").click();
    await page.waitForFunction(() => {
      const node = document.querySelector("#chat-window");
      return node.scrollHeight - node.scrollTop - node.clientHeight <= 20;
    });
    await page.locator("#chat-window").focus();
    await page.keyboard.press("Home");
    await page.waitForFunction(() => document.querySelector("#chat-window").scrollTop <= 4);
    await page.evaluate(() => {
      window.handleStreamEvent({ type: "opponent_delta", text: "（流式补充）" });
    });
    await page.waitForTimeout(120);
    assert(
      await page.locator("#chat-window").evaluate((node) => node.scrollTop <= 4),
      "用户用键盘上滑查看历史时，流式回复仍把聊天框强制拉回底部",
    );
    const visibleConversation = await page.locator("#chat-window").textContent();
    if (!visibleConversation.includes(firstMessage)) failures.push("聊天窗口没有保留第一轮原话");
    assert(visibleConversation.includes(secondMessage), "聊天窗口没有显示第二轮原话");
    assert(requests.length === 2, "两轮聊天没有各自发出请求");
    if (requests[0].recent_messages.length !== 1) failures.push("首轮请求混入了伪造的种子对话");
    assert(
      requests[1].recent_messages.some((item) => item.text === firstMessage),
      "第二轮请求没有携带第一轮上下文",
    );

    const analysisBeforeCheat = await page.locator("#analysis-card").innerText();
    const modeBeforeCheat = await page.locator("#analysis-mode").textContent();
    await page.locator("#cheat-switch").click();
    await page.waitForFunction(
      () => document.querySelector("#cheat-switch").getAttribute("aria-checked") === "true",
      null,
      { timeout: 4000 },
    );
    assert(
      await page.locator("#analysis-card").innerText() === analysisBeforeCheat,
      "开启八字外挂后，上一轮公开分析摘要被延迟篡改",
    );
    assert(
      await page.locator("#analysis-mode").textContent() === modeBeforeCheat,
      "开启八字外挂后，上一轮分析标签被提前改成八字结果",
    );
    assert(
      (await page.locator("#composer-status").textContent()).includes("下一条"),
      "外挂开启后没有明确提示仅作用于下一轮",
    );

    assert(failures.length === 0, failures.join("；"));

    console.log(JSON.stringify({ ok: true, turns: requests.length }, null, 2));
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
