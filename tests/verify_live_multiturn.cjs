const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const target = process.env.DEMO_URL || "http://127.0.0.1:4174/";
const artifacts = path.resolve(__dirname, "../artifacts");
fs.mkdirSync(artifacts, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/132.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  const requests = [];
  const errors = [];

  page.on("request", (request) => {
    if (request.url().includes("/api/respond")) {
      requests.push(JSON.parse(request.postData() || "{}"));
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  async function sendTurn(text, expectedRound) {
    await page.locator("#user-message").fill(text);
    await page.locator("#send-button").click();
    await page.waitForFunction(
      (round) => !document.querySelector("#send-button").disabled
        && document.querySelectorAll(".message-row--feedback").length === round,
      expectedRound,
      { timeout: 35000 },
    );
    return (await page.locator(".message-row--feedback .chat-bubble").nth(expectedRound - 1).textContent()).trim();
  }

  try {
    await page.goto(`${target}${target.includes("?") ? "&" : "?"}live-multiturn=${Date.now()}`, {
      waitUntil: "networkidle",
    });
    await page.locator("#boot-skip").click();

    const first = "今晚我先交 A，B、C 明早再排，请您确认这个顺序。";
    const second = "延续刚才：A 已经交付。现在只剩 B 和 C，请二选一，明早先要哪个？";
    const third = "收到，按你刚才的选择继续。另一个我下午三点给，不再改 A。";

    const replyOne = await sendTurn(first, 1);
    const replyTwo = await sendTurn(second, 2);
    const replyThree = await sendTurn(third, 3);

    const analysisBeforeToggle = await page.locator("#analysis-card").innerText();
    const modeBeforeToggle = await page.locator("#analysis-mode").textContent();
    await page.locator("#cheat-switch").click();
    await page.waitForFunction(
      () => document.querySelector("#cheat-switch").getAttribute("aria-checked") === "true",
      null,
      { timeout: 4000 },
    );
    assert(
      (await page.locator("#analysis-card").innerText()) === analysisBeforeToggle,
      "开启八字外挂时篡改了上一轮公开分析摘要",
    );
    assert(
      (await page.locator("#analysis-mode").textContent()) === modeBeforeToggle,
      "开启八字外挂时提前把上一轮结果标记成了八字分析",
    );

    const fourth = "承接前文：B 已确认，C 下午三点交。请告诉我是否还要调整。";
    const replyFour = await sendTurn(fourth, 4);

    assert(requests.length === 4, `预期 4 次请求，实际 ${requests.length} 次`);
    assert(requests[0].recent_messages.length === 1, "首轮请求不应带伪造历史");
    assert(
      requests[0].recent_messages[0].role === "opponent"
        && requests[0].recent_messages[0].text !== first,
      "首轮 recent_messages 错把当前输入重复当成历史",
    );
    assert(requests[1].recent_messages.length === 3, "第二轮请求没有带上第一轮完整往返");
    assert(requests[2].recent_messages.length === 5, "第三轮请求没有带上前两轮完整往返");
    assert(requests[3].recent_messages.length === 7, "第四轮请求没有带上前三轮完整往返");
    assert(requests[3].bazi_enabled === true, "八字外挂没有只作用于开启后的下一轮");
    assert(
      /B|C/.test(replyTwo) && !replyTwo.includes("今晚给我一个能看的版本"),
      `第二轮没有承接“A 已交付、只剩 B/C”：${replyTwo}`,
    );
    assert(
      /下午|三点|15|另一个|B|C/.test(replyThree)
        && replyThree !== replyTwo
        && !replyThree.includes("今晚给我一个能看的版本"),
      `第三轮没有承接第二轮选择：${replyThree}`,
    );
    assert(
      /B|C|下午|三点|调整|继续/.test(replyFour),
      `第四轮没有承接前三轮：${replyFour}`,
    );
    assert(
      /八字外挂/.test((await page.locator("#analysis-mode").textContent()) || ""),
      "开启外挂后的新一轮没有生成八字公开分析",
    );
    assert(await page.locator(".message-row--user").count() === 4, "页面没有保留四轮用户消息");
    assert(await page.locator(".message-row--feedback").count() === 4, "页面没有保留四轮对方回复");
    assert(errors.length === 0, `浏览器错误：${errors.join(" | ")}`);

    await page.locator(".conversation-stage").screenshot({
      path: path.join(artifacts, "live-multiturn-four-rounds.png"),
      type: "png",
    });

    console.log(JSON.stringify({
      ok: true,
      historyLengths: requests.map((request) => request.recent_messages.length),
      replies: [replyOne, replyTwo, replyThree, replyFour],
    }, null, 2));
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
