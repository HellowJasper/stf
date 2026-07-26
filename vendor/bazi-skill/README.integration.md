# bazi-skill 运行时集成说明

本目录固化了 [`jinchenma94/bazi-skill`](https://github.com/jinchenma94/bazi-skill) 的运行时规则，来源提交：

```text
bdd7f863d4450bf0e2fac84579ad6b45cfdfa25c
```

`SKILL.md`、`LICENSE` 与 `references/` 下四份规则文件保持上游原文；`manifest.json` 记录来源、版本、必须加载的文件及固定 SHA-256（Secure Hash Algorithm 256-bit，256 位安全哈希）。服务启动时会读取并逐份核验：任何运行文件缺失或内容与固定版本不符，服务都会拒绝启动。API 同时返回实际加载状态，避免再用静态字符串冒充 Skill 接入。

职责划分：

- `lunar_python`：确定性的公历/农历转换、四柱、十神、藏干与大运计算。
- `bazi-skill`：旺衰证据、月令格局、喜忌、经典依据、大运/流年和历史校准的分析契约。
- DeepSeek：基于已经确定的结构结果，把内容翻译成职场沟通语言；不能覆盖程序生成的命盘事实和 Skill 结论。

更新上游版本时必须：

1. 同步 `SKILL.md`、`LICENSE` 和四份 reference 文件。
2. 更新 `manifest.json` 的 `source_revision`。
3. 运行 `python3 -m unittest discover -s tests -p 'test_*.py' -v`。
4. 检查 API `provenance.references_loaded` 是否仍为 4/4。

本目录遵循上游仓库附带的 MIT License。
