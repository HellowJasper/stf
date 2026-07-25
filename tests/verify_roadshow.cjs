const { chromium } = require("playwright");

const target = process.env.ROADSHOW_URL || "http://127.0.0.1:4174/roadshow.html";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));

  try {
    const response = await page.goto(target, { waitUntil: "networkidle" });
    assert(response.status() === 200, "路演页面没有正常返回");
    assert((await page.locator("[data-slide]").count()) === 8, "路演不是 8 页");
    const totalSeconds = await page.locator("[data-slide]").evaluateAll((slides) => (
      slides.reduce((total, slide) => total + Number(slide.dataset.duration), 0)
    ));
    assert(totalSeconds === 300, `路演时长不是严格 5 分钟：${totalSeconds} 秒`);
    assert(await page.locator("#pitch-start").isVisible(), "路演准备页没有显示");

    await page.locator("#pitch-start-button").click();
    await page.locator("#pitch-start").waitFor({ state: "hidden", timeout: 2000 });
    assert((await page.locator("#pitch-current").textContent()).trim() === "01", "路演没有从第一页开始");

    for (let index = 1; index <= 3; index += 1) {
      await page.locator("#pitch-next").click();
      await page.waitForTimeout(420);
    }
    assert((await page.locator("#pitch-current").textContent()).trim() === "04", "无法进入现场演示页");
    await page.waitForTimeout(4100);
    assert((await page.locator("#roadshow-stream").textContent()).length > 20, "现场演示没有流式输出话术");

    await page.locator("#pitch-notes").click();
    assert(await page.locator(".pitch-slide.is-active .speaker-notes").isVisible(), "演讲提示无法打开");
    await page.keyboard.press("n");
    assert(await page.locator(".pitch-slide.is-active .speaker-notes").isHidden(), "演讲提示快捷键无法关闭");

    const viewport = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }));
    assert(viewport.scrollWidth === viewport.clientWidth, "路演页面出现横向滚动");
    assert(viewport.scrollHeight === viewport.clientHeight, "路演页面出现纵向滚动");
    assert(errors.length === 0, `路演页面出现浏览器错误：${errors.join(" | ")}`);

    console.log(JSON.stringify({ ok: true, totalSeconds, viewport }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
