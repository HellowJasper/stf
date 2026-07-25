# 工位开挂局 Demo

一个把“职场综艺闯关”和“八字外挂”结合起来的桌面端可交互原型。用户先选择对话场景，再让 AI 生成公开分析摘要与可直接发送的回复；点击右侧“可选增益”还能进入全屏玄学分析台，体验流转排盘、沟通说明书与实时聊天加深。

## 三个场景

1. 上司高压局：催进度、临时加活、要求回怼但仍要推进工作。
2. 友善同事局：接住善意、明确分工、不把帮助当作理所当然。
3. 阴阳同事局：不接情绪、固定事实、通过公开记录降低甩锅空间。

## 本地运行

项目使用 Python 3，并通过 `lunar_python` 完成真实的公历 / 农历转换、节气四柱、十神、藏干和大运计算。第一次运行先安装依赖：

```bash
cd /Users/jasper/Desktop/stf
python3 -m pip install -r requirements.txt
python3 server.py
```

然后打开：

```text
http://127.0.0.1:4173
```

不要使用 `python3 -m http.server`：它只能提供静态文件，无法运行随机等待和流式接口。

## 5 分钟 HTML 路演

服务启动后打开 `http://127.0.0.1:4173/roadshow.html`。路演共 8 页，每页建议时长之和严格为 300 秒；点击“开始计时”后会显示全局倒计时。

- `←` / `→` 或空格：切换页面。
- `N`：显示或隐藏逐页演讲提示。
- `F`：进入或退出浏览器全屏。
- `A`：开启或关闭按建议时长自动翻页。
- `R`：返回第一页并重新开始 5 分钟计时。

路演页面为 `roadshow.html`，视觉与交互分别位于 `roadshow.css` 和 `roadshow.js`。第 4 页包含无需模型联网的稳定流式演示，最后一页可直接进入产品 Demo。

## 接入 DeepSeek V4

项目默认可离线演示。服务端按“环境变量 → macOS 钥匙串”的顺序读取密钥，密钥不会进入浏览器代码或 `/api/config` 响应。当前 Mac 已配置钥匙串项 `stf-deepseek-api-key`，直接启动即可：

```bash
cd /Users/jasper/Desktop/stf
python3 server.py
```

如需临时覆盖钥匙串中的配置，可使用环境变量：

```bash
export DEEPSEEK_API_KEY="替换为新 Key"
export DEEPSEEK_MODEL="deepseek-v4-pro"
python3 server.py
```

如需在另一台 Mac 上安全写入钥匙串：

```bash
security add-generic-password -U -a "stf-demo" -s "stf-deepseek-api-key" -w "替换为新 Key"
```

API Key 是 **Application Programming Interface Key（应用程序接口密钥）**：服务端用它向 DeepSeek 证明调用身份。它只能保存在服务端环境变量或 macOS 钥匙串，不能写进 `script.js`、`index.html` 或提交到 GitHub。本仓库已忽略 `.env` 和 `.env.*` 文件。

当前调用地址为 `https://api.deepseek.com/chat/completions`，默认模型为 `deepseek-v4-pro`。玄学档案与实时聊天加深使用 JSON Output，即让模型按固定 JSON（JavaScript Object Notation，JavaScript 对象表示法）结构返回内容，便于前端稳定渲染。模型失败时自动切换到本地演示引擎，保证现场流程不断。

## 交互逻辑

1. 用户在聊天框里输入一条准备真实发送给对方的话，浏览器把场景、原话和外挂状态发送给 `POST /api/respond`。
2. Python 使用 `random.uniform(1.0, 3.0)` 生成 1–3 秒的随机思考时间。
3. 前端在这段时间展示“对方正在输入”和轮换的真实职场状态。
4. 等待结束后，Python 根据用户原话、对方身份和场景，先流式发送对方反馈。
5. 对方反馈结束后，再输出公开分析摘要和下一句建议，并展示爽感与工作推进分数。

八字外挂不会在场景之间继承：每次进入新场景都恢复关闭。用户手动开启时，会先经过 1–2 秒“沟通命盘校准”，加载完成后才影响下一轮对方反馈。

“今日耐心余额”不是静态百分比：当天首次进入为 68 点，每轮对话由服务端根据场景、表达方式和外挂状态返回可解释的增减值。友善协作会回血，高压或阴阳沟通会消耗，清晰边界与八字外挂会减少损耗，成功回溯会返还 4 点“后悔税”。余额和最多 20 条流水保存在浏览器 `localStorage`（Local Storage，本地存储）中，刷新页面仍保留，日期变化后自动重置；点击顶部余额卡可以查看或手动重置当天明细。

玄学分析台的附加流程：

1. 按 [`jinchenma94/bazi-skill`](https://github.com/jinchenma94/bazi-skill) 的输入规范确认姓名 / 曾用名、历法、生日、时间精度、性别、出生地和在世状态；也可以一键填入当前对手的虚构演示资料。
2. `lunar_python` 按节气完成双历转换，生成四柱、十神、藏干、五行表层分布与大运顺逆；页面圆盘流转约 3 秒后，结果落入专业排盘表。
3. DeepSeek V4-Pro 依据已经计算好的命盘结构生成日主旺衰、格局观察、喜忌说明，并翻译为性格底色、沟通信号和可发送话术。模型不可用时会使用克制的本地说明，但不会伪造历法数据。
4. 新增一条聊天后，`POST /api/live-analysis` 会结合完整对话重新分析，档案随聊天证据逐步加深。

这里的“四柱”是年柱、月柱、日柱、时柱四组干支；“十神”是其他干支相对日干的生克关系名称；“藏干”是每个地支内部所含的天干；“大运”是传统命理中按十年分段的运程序列。它们来自传统术数体系，不是科学人格测量。

“回溯”不属于玄学分析台：它位于主聊天输入区，仅在八字外挂开启后解锁。完成一轮聊天后，用户可以回到刚才发送前，系统会清除本轮演示消息，并把 AI 建议的重写版本放回输入框。它不撤回任何真实聊天软件中的消息。

这里的 NDJSON 是 **Newline Delimited JSON（按行分隔的 JSON）**：服务端每生成一小段内容就写出一行 JSON，浏览器不必等待整段回答完成即可展示。

“公开分析摘要”指可验证、适合向用户解释的语气识别、目标和风险提示；它不是模型内部隐藏的思维链。

## 文件结构

- `index.html`：三场景、聊天区、思考状态和八字外挂的语义结构。
- `styles.css`：高饱和职场综艺视觉、桌面布局和减少动态效果支持。
- `script.js`：场景切换、外挂开关、NDJSON 读取、玄学分析台、实时加深和回溯。
- `server.py`：静态文件服务、真实历法排盘、1–3 秒随机等待、流式回复及 DeepSeek V4-Pro 服务端代理。
- `requirements.txt`：锁定 `lunar_python` 历法依赖版本。
- `tests/test_server.py`：随机范围、场景逻辑、输入约束、模型降级与 API 接口测试。
- `tests/verify_ui.cjs`：在 1440×900 Chromium 中完成主流程与玄学分析台的浏览器验收。
- `prompts/workplace-opponent-system-prompt.md`：可直接接入大模型的职场对手反馈与拆招系统提示词。
- `assets/xuanshu-product-gateway-concept-v1.png`：上一版命理入口概念图，仅作历史参考，新界面不再使用。

## 重要边界

- 主对话使用会读取用户原话的本地场景规则，以严格保留 Python 随机 1–3 秒后开始流式输出的演示节奏；玄学档案与实时聊天加深接入 DeepSeek V4-Pro。要把主对话替换为模型生成，可使用 `prompts/workplace-opponent-system-prompt.md` 的 JSON 输出协议。
- 当前交付与验收目标是 1440×900 及以上的桌面浏览器；窄窗口样式仅用于避免布局崩坏，不属于移动端设计交付。
- 八字信息是娱乐化的角色设定，不用于真实人格判断、招聘、绩效或人事决策。
- 出生资料和聊天内容会被发送给所配置的模型服务。真实使用前需要取得必要授权，避免输入公司秘密、身份证号、联系方式等敏感信息。
- “回怼”被设计成明确边界、锁定事实和推动工作，不生成侮辱、威胁或职场霸凌内容。
- 页面支持键盘操作和 `prefers-reduced-motion`。后者是浏览器读取用户“减少动态效果”系统偏好的方式。

## 运行测试

```bash
python3 -m unittest discover -s tests -v
```

## Ubuntu 服务器部署

生产演示部署使用 Nginx + systemd：Nginx 是入口反向代理，负责把 `/stf/` 请求转发到只监听本机的 Python 服务；systemd 负责开机启动、异常重启和统一日志。仓库提供：

- `deploy/stf.service`：后台服务定义，默认从 `/srv/stf` 启动。
- `deploy/nginx-stf-location.conf`：Nginx 的 `/stf/` 路由片段。

服务端环境文件位于 `/etc/stf/stf.env`，权限应为 `600`，至少包含：

```text
STF_HOST=127.0.0.1
STF_PORT=4173
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_API_KEY=由服务器安全注入，禁止提交到 GitHub
```

部署后可通过以下命令验证：

```bash
systemctl status stf.service
curl http://127.0.0.1:4173/api/health
curl http://127.0.0.1/stf/api/health
```
