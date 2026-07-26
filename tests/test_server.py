import json
import re
import threading
import unittest
import urllib.error
import urllib.request
from functools import partial
from unittest.mock import patch

import server


class ResponseLogicTests(unittest.TestCase):
    def test_random_delay_stays_between_one_and_three_seconds(self):
        for _ in range(500):
            delay = server.random_think_delay()
            self.assertGreaterEqual(delay, 1.0)
            self.assertLessEqual(delay, 3.0)

    def test_source_decision_buffers_tokens_until_random_reveal(self):
        class Clock:
            now = 0.0

            def __call__(self):
                return self.now

            def sleep(self, duration):
                self.now += duration

        class ScheduledQueue:
            def __init__(self, clock, items):
                self.clock = clock
                self.items = list(items)

            def get_nowait(self):
                if self.items and self.items[0][0] <= self.clock.now:
                    return self.items.pop(0)[1]
                raise server.Empty

            def get(self, timeout):
                available_at, item = self.items[0]
                if available_at <= self.clock.now + timeout:
                    self.clock.now = available_at
                    self.items.pop(0)
                    return item
                self.clock.now += timeout
                raise server.Empty

        clock = Clock()
        queued = ScheduledQueue(
            clock,
            [(0.2, ("token", "A 已交付。")), (0.3, ("done", ""))],
        )

        decision = server.await_opponent_source(
            queued,
            stream_enabled=True,
            started_at=0.0,
            reveal_delay=1.5,
            clock=clock,
            sleeper=clock.sleep,
        )

        self.assertEqual(clock.now, 1.5)
        self.assertEqual(decision["source"], "deepseek-v4")
        self.assertEqual(decision["tokens"], ["A 已交付。"])

    def test_source_decision_uses_fallback_at_absolute_three_second_deadline(self):
        class Clock:
            now = 0.0

            def __call__(self):
                return self.now

            def sleep(self, duration):
                self.now += duration

        class LateQueue:
            def __init__(self, clock):
                self.clock = clock

            def get_nowait(self):
                raise server.Empty

            def get(self, timeout):
                self.clock.now += timeout
                raise server.Empty

        clock = Clock()
        decision = server.await_opponent_source(
            LateQueue(clock),
            stream_enabled=True,
            started_at=0.0,
            reveal_delay=1.25,
            source_deadline_seconds=3.0,
            clock=clock,
            sleeper=clock.sleep,
        )

        self.assertEqual(clock.now, 3.0)
        self.assertEqual(decision["source"], "demo-fallback")
        self.assertEqual(decision["tokens"], [])

    def test_whitespace_token_does_not_commit_ai_source(self):
        class Clock:
            now = 0.0

            def __call__(self):
                return self.now

            def sleep(self, duration):
                self.now += duration

        class WhitespaceQueue:
            def __init__(self, clock):
                self.clock = clock
                self.drained = False

            def get_nowait(self):
                if not self.drained:
                    self.drained = True
                    return ("token", "   ")
                raise server.Empty

            def get(self, timeout):
                self.clock.now += timeout
                raise server.Empty

        clock = Clock()
        decision = server.await_opponent_source(
            WhitespaceQueue(clock),
            stream_enabled=True,
            started_at=0.0,
            reveal_delay=1.0,
            source_deadline_seconds=3.0,
            clock=clock,
            sleeper=clock.sleep,
        )

        self.assertEqual(decision["source"], "demo-fallback")
        self.assertEqual(clock.now, 3.0)

    def test_cheat_mode_changes_the_response(self):
        normal = server.build_response("boss", False)
        cheat = server.build_response("boss", True)

        self.assertNotEqual(normal["reply"], cheat["reply"])
        self.assertGreater(len(cheat["analysis"]), len(normal["analysis"]))

    def test_unknown_scenario_falls_back_to_boss(self):
        fallback = server.build_response("unknown", False)
        boss = server.build_response("boss", False)
        self.assertEqual(fallback, boss)

    def test_real_message_changes_the_opponent_feedback(self):
        boundary = server.build_conversation_turn(
            "boss", False, "请您确认 A、B、C 的优先级，我按顺序交付。"
        )
        confrontational = server.build_conversation_turn("boss", False, "凭什么？你行你上。")
        self.assertNotEqual(boundary["opponent_reply"], confrontational["opponent_reply"])
        self.assertEqual(boundary["reaction"], "开始拍板")
        self.assertEqual(confrontational["reaction"], "态度反弹")

    def test_local_fallback_varies_wording_without_changing_scenario_facts(self):
        with patch("server.random.choice", side_effect=lambda values: values[0]):
            first = server.build_conversation_turn(
                "boss", False, "请确认 A、B、C 的优先级。"
            )
        with patch("server.random.choice", side_effect=lambda values: values[1]):
            second = server.build_conversation_turn(
                "boss", False, "请确认 A、B、C 的优先级。"
            )

        self.assertNotEqual(first["opponent_reply"], second["opponent_reply"])
        self.assertIn("先把 A 做完", first["opponent_reply"])
        self.assertIn("先把 A 做完", second["opponent_reply"])

    def test_bazi_changes_core_public_analysis_and_reply(self):
        normal = server.build_conversation_turn("hostile", False, "我们按群里的记录确认。")
        cheat = server.build_conversation_turn("hostile", True, "我们按群里的记录确认。")
        self.assertEqual(len(normal["analysis"]), 3)
        self.assertEqual(len(cheat["analysis"]), 4)
        self.assertNotEqual(normal["analysis"][2], cheat["analysis"][2])
        self.assertNotEqual(normal["reply"], cheat["reply"])
        self.assertIn("失去信息优势", " ".join(cheat["analysis"]))

    def test_ai_optimises_public_analysis_with_bazi_profile(self):
        generated = {
            "reaction_tag": "开始拍板",
            "opponent_reply": "先做 A，另外两项明早给我时间表。",
            "character_profile": {
                "observed_tendency": "保留拍板权后，会接受清晰的任务排序。",
                "current_need": "结果不失控，而且优先级由自己确认。",
                "communication_habit": "先压结果，再对可执行选项做决定。",
                "traits": ["结果优先", "保留拍板权", "接受选择题"],
            },
            "public_analysis": [
                "你的限制表达得清楚，但没有直接拒绝推进。",
                "对方保留拍板权后，开始接受任务排序。",
                "当前风险是另外两项仍缺少明确时间。",
                "外挂校准：避开公开否定，先给结论再让对方选择。",
            ],
            "suggested_next_message": "收到，今晚先交 A；B、C 明早补时间表，请按这个顺序验收。",
            "bazi_communication": "戊土日主生于午月，本轮先给结论，再保留对方拍板权。",
            "tone": "AI体面反杀",
            "satisfaction": 93,
            "work_progress": 96,
            "outcome": "你把临时加活改成了由上司确认的优先级。",
        }
        with patch("server.deepseek_is_configured", return_value=True), patch(
            "server.call_deepseek_json", return_value=generated
        ) as deepseek:
            result = server.generate_workplace_turn(
                "boss",
                True,
                "我可以接，但需要确认优先级。",
                {
                    "communication_preference": "先结论后选择",
                    "trigger": "公开否定",
                    "delight": "保留拍板权",
                },
                [
                    {"role": "opponent", "text": "今晚给我。"},
                    {"role": "me", "text": "今晚先交 A，请您确认。"},
                    {"role": "opponent", "text": "行，先交 A。"},
                ],
            )

        sent_data = deepseek.call_args.args[1]
        self.assertEqual(result["source"], "deepseek-v4")
        self.assertEqual(result["opponent_reply"], generated["opponent_reply"])
        self.assertEqual(result["analysis"], generated["public_analysis"])
        self.assertEqual(result["reply"], generated["suggested_next_message"])
        self.assertEqual(result["character_profile"]["traits"], generated["character_profile"]["traits"])
        self.assertIn("戊 · 阳土", result["professional_bazi"]["day_master"])
        self.assertNotIn("戊土日主", result["professional_bazi"]["communication_translation"])
        self.assertIn("先结论后选择", result["professional_bazi"]["communication_translation"])
        self.assertTrue(sent_data["bazi_enabled"])
        self.assertEqual(sent_data["bazi_profile"]["trigger"], "公开否定")
        self.assertEqual(sent_data["professional_bazi"]["pillars"][0]["ganzhi"], "乙丑")
        self.assertEqual(deepseek.call_args.kwargs["max_tokens"], 700)
        self.assertEqual(deepseek.call_args.kwargs["temperature"], 0.9)
        self.assertEqual(
            deepseek.call_args.kwargs["conversation_messages"],
            [
                {"role": "assistant", "content": "今晚给我。"},
                {"role": "user", "content": "今晚先交 A，请您确认。"},
                {"role": "assistant", "content": "行，先交 A。"},
                {"role": "user", "content": "我可以接，但需要确认优先级。"},
            ],
        )
        self.assertIn("承接上一轮", deepseek.call_args.args[0])
        self.assertEqual(
            sent_data["recent_messages"],
            [
                {"role": "opponent", "text": "今晚给我。"},
                {"role": "me", "text": "今晚先交 A，请您确认。"},
                {"role": "opponent", "text": "行，先交 A。"},
            ],
        )

    def test_deepseek_request_uses_role_history_and_temperature(self):
        captured = {}

        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def read(self):
                return b'{"choices":[{"message":{"content":"{\\"ok\\":true}"}}]}'

        def fake_urlopen(request, timeout):
            captured["timeout"] = timeout
            captured["body"] = json.loads(request.data.decode("utf-8"))
            return FakeResponse()

        with patch("server.get_deepseek_api_key", return_value="test-key"), patch(
            "server.urllib.request.urlopen", side_effect=fake_urlopen
        ):
            result = server.call_deepseek_json(
                "只输出 JSON。",
                {"scenario": "boss", "user_message": "继续确认 B。"},
                conversation_messages=[
                    {"role": "assistant", "content": "先交 A。"},
                    {"role": "user", "content": "A 已交付。"},
                    {"role": "assistant", "content": "继续说 B。"},
                    {"role": "user", "content": "B 明早十一点交。"},
                ],
                temperature=0.9,
                timeout=10,
            )

        body = captured["body"]
        self.assertEqual(result, {"ok": True})
        self.assertEqual(captured["timeout"], 10)
        self.assertEqual(body["temperature"], 0.9)
        self.assertEqual(
            [message["role"] for message in body["messages"]],
            ["system", "assistant", "user", "assistant", "user"],
        )
        self.assertEqual(body["messages"][1]["content"], "先交 A。")
        self.assertTrue(body["messages"][-1]["content"].startswith("B 明早十一点交。"))
        self.assertIn('"user_message": "继续确认 B。"', body["messages"][-1]["content"])

    def test_deepseek_text_stream_relays_only_sse_content_deltas(self):
        captured = {}

        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def __iter__(self):
                return iter(
                    [
                        b": keep-alive\n",
                        b"\n",
                        b'data: {"choices":[{"delta":{"content":"A \\u5df2"}}]}\n',
                        b'data: {"choices":[{"delta":{"content":"\\u4ea4\\u4ed8"}}]}\n',
                        b'data: {"choices":[]}\n',
                        b"data: [DONE]\n",
                    ]
                )

        def fake_urlopen(request, timeout):
            captured["body"] = json.loads(request.data.decode("utf-8"))
            captured["accept"] = request.headers.get("Accept")
            captured["timeout"] = timeout
            return FakeResponse()

        with patch("server.get_deepseek_api_key", return_value="test-key"), patch(
            "server.urllib.request.urlopen", side_effect=fake_urlopen
        ):
            chunks = list(
                server.iter_deepseek_text(
                    "只输出一句话。",
                    {"user_message": "继续。"},
                    timeout=8,
                    temperature=0.9,
                )
            )

        self.assertEqual(chunks, ["A 已", "交付"])
        self.assertTrue(captured["body"]["stream"])
        self.assertNotIn("response_format", captured["body"])
        self.assertEqual(captured["body"]["temperature"], 0.9)
        self.assertEqual(captured["accept"], "text/event-stream")

    def test_opponent_stream_request_includes_scene_surface_variation(self):
        captured = {}

        def fake_stream(system_prompt, user_data, **kwargs):
            captured["system_prompt"] = system_prompt
            captured["user_data"] = user_data
            captured["kwargs"] = kwargs
            return iter(["收到，A 已交付；现在确认 B 的时间点。"])

        with patch("server.iter_deepseek_text", side_effect=fake_stream):
            chunks = list(
                server.iter_workplace_opponent_reply(
                    "boss",
                    False,
                    "A 已交付，现在确认 B。",
                    recent_messages=[
                        {"role": "opponent", "text": "先交 A。"},
                        {"role": "me", "text": "A 已经交付。"},
                    ],
                )
            )

        variation = captured["user_data"]["surface_variation"]
        self.assertEqual(chunks, ["收到，A 已交付；现在确认 B 的时间点。"])
        self.assertIn(variation, server.WORKPLACE_SURFACE_VARIATIONS["boss"])
        self.assertEqual(captured["kwargs"]["temperature"], 0.9)
        self.assertNotIn("opponent_reply", captured["system_prompt"])

    def test_analysis_uses_streamed_opponent_reply_verbatim(self):
        authoritative = "A 我收到了，B 请在明早十点前给我。"
        generated = {
            "reaction_tag": "继续拍板",
            "opponent_reply": "模型不应有权改写这句话",
            "character_profile": {
                "observed_tendency": "确认完成项后继续追下一节点。",
                "current_need": "锁定 B 的交付时间。",
                "communication_habit": "按节点推进。",
                "traits": ["结果优先", "节点推进", "时间明确"],
            },
            "public_analysis": ["确认 A 已完成。", "继续追问 B。", "需要锁定截止时间。"],
            "suggested_next_message": "收到，B 明早十点前提交，若有变化我提前同步。",
            "bazi_communication": "",
            "tone": "继续推进",
            "satisfaction": 88,
            "work_progress": 90,
            "outcome": "对话已进入 B 的交付确认。",
        }
        with patch("server.deepseek_is_configured", return_value=True), patch(
            "server.call_deepseek_json", return_value=generated
        ) as deepseek:
            result = server.generate_workplace_analysis(
                "boss",
                False,
                "A 已交付，请确认 B。",
                authoritative,
                recent_messages=[
                    {"role": "opponent", "text": "先做 A。"},
                    {"role": "me", "text": "A 已经交付。"},
                ],
            )

        sent_data = deepseek.call_args.args[1]
        self.assertEqual(sent_data["authoritative_opponent_reply"], authoritative)
        self.assertEqual(result["opponent_reply"], authoritative)
        self.assertIn(authoritative, result["character_profile"]["evidence"])
        self.assertNotIn("opponent_reply 字符串", deepseek.call_args.args[0])

    def test_main_chat_bazi_uses_real_calendar_chart(self):
        normal = server.build_conversation_turn(
            "boss", False, "请您确认一个最高优先级。"
        )
        cheat = server.build_conversation_turn(
            "boss", True, "请您确认一个最高优先级。"
        )
        profile = cheat["professional_bazi"]
        self.assertIsNone(normal["professional_bazi"])
        self.assertEqual(
            [item["ganzhi"] for item in profile["pillars"]],
            ["乙丑", "壬午", "戊子", "丁巳"],
        )
        self.assertEqual(profile["day_master"], "戊 · 阳土")
        self.assertEqual(profile["month_command"], "午月令 · 火")
        self.assertIn("偏财", profile["key_ten_gods"])
        self.assertIn("《滴天髓》", profile["classic_basis"])

    def test_ai_turn_falls_back_when_model_times_out(self):
        with patch("server.deepseek_is_configured", return_value=True), patch(
            "server.call_deepseek_json", side_effect=RuntimeError("timeout")
        ):
            result = server.generate_workplace_turn(
                "friendly", True, "谢谢你，我们明确一下分工。"
            )
        self.assertEqual(result["source"], "demo-fallback")
        self.assertIn("timeout", result["warning"])
        self.assertEqual(len(result["analysis"]), 4)

    def test_fallback_continues_previous_turn_instead_of_restarting(self):
        history = [
            {"role": "opponent", "text": "这点小事为什么还没做完？今晚给我。"},
            {"role": "me", "text": "今晚我先交 A，B、C 明早再排，请您确认。"},
            {"role": "opponent", "text": "行，先把 A 做完。"},
        ]
        with patch.dict(
            "server.os.environ", {"DEEPSEEK_DISABLE_KEYCHAIN": "1"}, clear=True
        ):
            result = server.generate_workplace_turn(
                "boss",
                False,
                "延续刚才：A 已经交付。现在只剩 B 和 C，请二选一。",
                recent_messages=history,
            )

        self.assertNotIn("先把 A 做完", result["opponent_reply"])
        self.assertIn("A 已经交付", result["opponent_reply"])
        self.assertIn("第 2 轮", result["analysis"][0])

    def test_patience_change_is_scenario_style_and_cheat_aware(self):
        friendly = server.build_conversation_turn(
            "friendly", True, "谢谢你，我们一起对齐分工。"
        )
        boss = server.build_conversation_turn(
            "boss", False, "请确认优先级和截止时间。"
        )
        hostile = server.build_conversation_turn("hostile", False, "凭什么？你行你上。")

        self.assertEqual(friendly["patience_delta"], 12)
        self.assertEqual(boss["patience_delta"], -6)
        self.assertEqual(hostile["patience_delta"], -18)
        self.assertIn("外挂减损", friendly["patience_reason"])

    def test_chunk_text_round_trips_unicode(self):
        text = "把难聊的话，聊出爽感。"
        self.assertEqual("".join(server.chunk_text(text, 2)), text)

    def test_bazi_chart_uses_real_calendar_pillars(self):
        profile = {
            "name": "王总",
            "gender": "男",
            "calendar_type": "solar",
            "birth_date": "1985-06-18",
            "birth_time": "09:30",
            "time_precision": "exact",
            "birth_place": "江苏省南京市",
        }
        first = server.build_bazi_chart(profile)
        second = server.build_bazi_chart(profile)
        self.assertEqual(first, second)
        self.assertEqual(first["engine"], "lunar_python")
        self.assertEqual(
            [f"{item['stem']}{item['branch']}" for item in first["pillars"]],
            ["乙丑", "壬午", "戊子", "丁巳"],
        )
        self.assertEqual(
            [item["label"] for item in first["pillars"]], list(server.PILLAR_LABELS)
        )
        self.assertEqual(len(first["yun"]["cycles"]), 8)

    def test_vendored_bazi_skill_is_loaded_as_runtime_contract(self):
        """不能再用一个写死的 skill 名称冒充运行时接入。"""

        bundle = server.BAZI_SKILL_BUNDLE
        self.assertEqual(bundle["name"], "jinchenma94/bazi-skill")
        self.assertEqual(
            bundle["source_revision"],
            "bdd7f863d4450bf0e2fac84579ad6b45cfdfa25c",
        )
        self.assertIn("第一阶段：信息收集", bundle["skill"])
        self.assertEqual(
            bundle["contract_hash"],
            "ee9f48acda7cd237b4d04789ea2815cf37a14849cd300b4ad529739928017386",
        )
        self.assertEqual(
            set(bundle["references"]),
            {
                "wuxing-tables.md",
                "shichen-table.md",
                "dayun-rules.md",
                "classical-texts.md",
            },
        )
        self.assertTrue(
            all(len(value) == 64 for value in bundle["reference_hashes"].values())
        )

    def test_skill_structural_analysis_changes_with_month_command(self):
        """同日主但不同月令不能再得到完全相同的命理解读。"""

        base = {
            "name": "虚构对象",
            "gender": "男",
            "calendar_type": "solar",
            "birth_time": "09:30",
            "time_precision": "exact",
            "birth_place": "江苏省南京市",
            "life_status": "alive",
            "leap_month": "false",
        }
        profiles = [
            {**base, "birth_date": "1985-06-18"},
            {**base, "birth_date": "1985-08-17"},
        ]
        charts = [server.build_bazi_chart(profile) for profile in profiles]
        analyses = [
            server.build_bazi_skill_analysis(profile, chart, as_of_year=2026)
            for profile, chart in zip(profiles, charts)
        ]

        self.assertEqual(
            [chart["day_master"]["stem"] for chart in charts], ["戊", "戊"]
        )
        self.assertNotEqual(
            analyses[0]["strength_evidence"], analyses[1]["strength_evidence"]
        )
        self.assertNotEqual(analyses[0]["pattern"], analyses[1]["pattern"])

    def test_mystic_profile_exposes_real_skill_trace_and_full_contract(self):
        profile = {
            "name": "虚构对象",
            "gender": "男",
            "calendar_type": "solar",
            "birth_date": "1985-06-18",
            "birth_time": "09:30",
            "time_precision": "exact",
            "birth_place": "江苏省南京市",
            "life_status": "alive",
        }
        with patch.dict(
            "server.os.environ", {"DEEPSEEK_DISABLE_KEYCHAIN": "1"}, clear=True
        ):
            result = server.generate_mystic_profile(profile, [])

        provenance = result["provenance"]
        self.assertTrue(provenance["skill_runtime_loaded"])
        self.assertEqual(provenance["skill"], "jinchenma94/bazi-skill")
        self.assertEqual(len(provenance["references_loaded"]), 4)
        self.assertEqual(provenance["calendar_engine"], "lunar_python@1.4.8")
        for key in (
            "strength_evidence",
            "pattern_analysis",
            "current_dayun_analysis",
            "current_year_analysis",
            "historical_calibration",
        ):
            self.assertIn(key, result["analysis"])
        self.assertGreaterEqual(len(result["analysis"]["historical_calibration"]), 3)

    def test_custom_mystic_chart_can_drive_main_chat_bazi_profile(self):
        profile = {
            "name": "自定义对手",
            "gender": "女",
            "calendar_type": "solar",
            "birth_date": "1990-02-14",
            "birth_time": "20:10",
            "time_precision": "exact",
            "birth_place": "北京市朝阳区",
            "life_status": "alive",
        }
        chart = server.build_bazi_chart(profile)
        analysis = server.build_bazi_skill_analysis(profile, chart, as_of_year=2026)
        supplied = {"chart": chart, "analysis": analysis, "profile_name": profile["name"]}

        chat_profile = server.build_workplace_bazi_profile("boss", supplied)

        day_master = chart["day_master"]
        self.assertEqual(
            chat_profile["day_master"],
            f"{day_master['stem']} · {day_master['polarity']}{day_master['element']}",
        )
        self.assertEqual(chat_profile["profile_name"], "自定义对手")
        self.assertEqual(chat_profile["skill_runtime"], "已加载 4/4 参考文件")

    def test_deepseek_can_translate_but_cannot_override_skill_facts(self):
        profile = {
            "name": "虚构对象",
            "gender": "男",
            "calendar_type": "solar",
            "birth_date": "1985-06-18",
            "birth_time": "09:30",
            "time_precision": "exact",
            "birth_place": "江苏省南京市",
            "life_status": "alive",
        }
        chart = server.build_bazi_chart(profile)
        deterministic = server.build_bazi_skill_analysis(
            profile, chart, as_of_year=2026
        )
        generated = {
            "day_master_analysis": "模型试图改写日主结论",
            "strength": "模型试图改成从强",
            "pattern": "模型试图改写格局",
            "climate_analysis": "模型试图改写调候",
            "favorable_elements": ["模型喜神"],
            "unfavorable_elements": ["模型忌神"],
            "classic_reference": "模型伪造典籍",
            "summary": "AI 只负责把结构翻译成沟通摘要。",
            "personality": "沟通画像转译",
            "likes": ["明确结论", "可选路径", "及时反馈"],
            "fears": ["边界模糊", "公开否定", "临时变更"],
            "topics": ["推进节点", "验收口径", "资源安排"],
            "advice": "先给结论，再给选项。",
            "script": "我先给结论，再请您从两个路径里拍板。",
        }

        with patch("server.deepseek_is_configured", return_value=True), patch(
            "server.call_deepseek_json", return_value=generated
        ) as deepseek:
            result = server.generate_mystic_profile(profile, [])

        self.assertEqual(result["analysis"]["strength"], deterministic["strength"])
        self.assertEqual(result["analysis"]["pattern"], deterministic["pattern"])
        self.assertEqual(
            result["analysis"]["climate_analysis"],
            deterministic["climate_analysis"],
        )
        self.assertEqual(
            result["analysis"]["favorable_elements"],
            deterministic["favorable_elements"],
        )
        self.assertEqual(
            result["analysis"]["classic_reference"],
            deterministic["classic_reference"],
        )
        self.assertEqual(result["analysis"]["summary"], generated["summary"])
        sent_prompt, sent_payload = deepseek.call_args.args[:2]
        self.assertIn("bazi-skill", sent_prompt)
        self.assertEqual(
            sent_payload["skill_analysis"]["strength"], deterministic["strength"]
        )
        self.assertEqual(sent_payload["subject"], {"name": "虚构对象", "life_status": "alive"})
        self.assertNotIn("profile", sent_payload)
        self.assertNotIn("1985-06-18", json.dumps(sent_payload, ensure_ascii=False))
        self.assertNotIn("江苏省南京市", json.dumps(sent_payload, ensure_ascii=False))

    def test_deceased_profile_does_not_analyse_years_after_death(self):
        profile = {
            "name": "历史虚构样例",
            "gender": "女",
            "calendar_type": "solar",
            "birth_date": "1970-03-12",
            "birth_time": "08:20",
            "time_precision": "exact",
            "birth_place": "陕西省西安市",
            "life_status": "deceased",
            "death_year": "2010",
        }
        chart = server.build_bazi_chart(profile)

        analysis = server.build_bazi_skill_analysis(
            profile, chart, as_of_year=2026
        )

        self.assertEqual(analysis["analysis_as_of_year"], 2010)
        self.assertIn("2010", analysis["current_year_analysis"])

    def test_runtime_rules_are_parsed_from_reference_and_drive_analysis(self):
        rules = server.BAZI_SKILL_RULES
        self.assertEqual(rules["stem_elements"]["甲"], "木")
        self.assertEqual(rules["stem_polarity"]["癸"], "阴")
        self.assertEqual(rules["branch_elements"]["午"], "火")
        self.assertEqual(rules["growth_stages"]["戊"]["长生"], "寅")
        self.assertEqual(rules["growth_stages"]["戊"]["帝旺"], "午")
        self.assertEqual(rules["hidden_stem_weights"], (0.6, 0.3, 0.1))
        self.assertTrue(rules["night_zi_next_day"])
        self.assertEqual(rules["dayun_direction"][("阴", "男")], "逆排")

        profile = {
            "name": "规则使用样例", "gender": "男", "calendar_type": "solar",
            "birth_date": "1985-06-18", "birth_time": "09:30",
            "time_precision": "exact", "birth_place": "江苏省南京市",
            "life_status": "alive",
        }
        chart = server.build_bazi_chart(profile)
        with patch.dict(rules["branch_elements"], {"午": "水"}):
            analysis = server.build_bazi_skill_analysis(profile, chart, as_of_year=2026)
        self.assertIn("午月（水）", analysis["strength_evidence"][0])

        night_profile = {**profile, "birth_time": "23:30"}
        with patch.dict(rules, {"night_zi_next_day": False}):
            no_rollover = server.build_bazi_chart(night_profile)
        self.assertEqual(
            f"{no_rollover['pillars'][2]['stem']}{no_rollover['pillars'][2]['branch']}",
            "戊子",
        )
        with patch.dict(rules["dayun_direction"], {("阴", "男"): "顺排"}):
            with self.assertRaisesRegex(RuntimeError, "dayun_direction_mismatch"):
                server.build_bazi_chart(profile)

    def test_young_profile_historical_calibration_never_mentions_future_years(self):
        profile = {
            "name": "年轻样例", "gender": "女", "calendar_type": "solar",
            "birth_date": "2018-05-20", "birth_time": "08:30",
            "time_precision": "exact", "birth_place": "上海市",
            "life_status": "alive",
        }
        chart = server.build_bazi_chart(profile)
        analysis = server.build_bazi_skill_analysis(profile, chart, as_of_year=2026)

        self.assertEqual(len(analysis["historical_calibration"]), 3)
        for question in analysis["historical_calibration"]:
            years = [int(year) for year in re.findall(r"\d{4}", question)]
            self.assertTrue(years)
            self.assertLessEqual(max(years), 2026)

    def test_custom_chart_still_drives_second_round_offline_reply(self):
        transcript = [
            {"role": "me", "text": "先按上轮范围推进。"},
            {"role": "opponent", "text": "可以，把新增节点写清楚。"},
        ]
        profiles = [
            {
                "name": "土日主样例", "gender": "男", "calendar_type": "solar",
                "birth_date": "1985-06-18", "birth_time": "09:30",
                "time_precision": "exact", "birth_place": "江苏省南京市",
                "life_status": "alive",
            },
            {
                "name": "金日主样例", "gender": "女", "calendar_type": "solar",
                "birth_date": "1990-02-14", "birth_time": "20:10",
                "time_precision": "exact", "birth_place": "北京市朝阳区",
                "life_status": "alive",
            },
        ]
        turns = []
        for profile in profiles:
            chart = server.build_bazi_chart(profile)
            analysis = server.build_bazi_skill_analysis(profile, chart, as_of_year=2026)
            supplied = {"chart": chart, "analysis": analysis, "profile_name": profile["name"]}
            turn = server.build_contextual_conversation_turn(
                "boss", True, "本轮新增项下午三点交。", transcript, supplied
            )
            professional = turn["professional_bazi"]
            self.assertIn(professional["suggested_script"], turn["reply"])
            self.assertIn(professional["opponent_response_order"], turn["opponent_reply"])
            turns.append(turn)

        self.assertNotEqual(
            turns[0]["professional_bazi"]["day_master"],
            turns[1]["professional_bazi"]["day_master"],
        )
        self.assertNotEqual(turns[0]["reply"], turns[1]["reply"])
        self.assertNotEqual(turns[0]["opponent_reply"], turns[1]["opponent_reply"])

    def test_custom_chart_drives_first_offline_opponent_reply_after_opening(self):
        opening_only = [{"role": "opponent", "text": "这件事今晚给我。"}]
        profiles = [
            {
                "name": "土盘", "gender": "男", "calendar_type": "solar",
                "birth_date": "1985-06-18", "birth_time": "09:30",
                "time_precision": "exact", "birth_place": "江苏省南京市",
                "life_status": "alive",
            },
            {
                "name": "金盘", "gender": "女", "calendar_type": "solar",
                "birth_date": "1990-02-14", "birth_time": "20:10",
                "time_precision": "exact", "birth_place": "北京市朝阳区",
                "life_status": "alive",
            },
        ]
        turns = []
        with patch("server.random.choice", side_effect=lambda values: values[0]):
            for profile in profiles:
                chart = server.build_bazi_chart(profile)
                analysis = server.build_bazi_skill_analysis(profile, chart, as_of_year=2026)
                supplied = {
                    "chart": chart, "analysis": analysis,
                    "profile_name": profile["name"],
                }
                turn = server.build_contextual_conversation_turn(
                    "boss", True, "请确认优先级和截止时间。", opening_only, supplied
                )
                self.assertIn(
                    turn["professional_bazi"]["opponent_response_order"],
                    turn["opponent_reply"],
                )
                turns.append(turn)
        self.assertNotEqual(turns[0]["opponent_reply"], turns[1]["opponent_reply"])

    def test_custom_deceased_analysis_keeps_its_original_cutoff_in_main_chat(self):
        profile = {
            "name": "已故自定义样例", "gender": "女", "calendar_type": "solar",
            "birth_date": "1970-03-12", "birth_time": "08:20",
            "time_precision": "exact", "birth_place": "陕西省西安市",
            "life_status": "deceased", "death_year": "2010",
        }
        chart = server.build_bazi_chart(profile)
        analysis = server.build_bazi_skill_analysis(profile, chart, as_of_year=2026)
        supplied = {"chart": chart, "analysis": analysis, "profile_name": profile["name"]}

        chat_profile = server.build_workplace_bazi_profile("boss", supplied)

        self.assertEqual(chat_profile["analysis_as_of_year"], 2010)
        self.assertIn("2010", chat_profile["current_year_analysis"])
        all_years = [
            int(year)
            for question in chat_profile["historical_calibration"]
            for year in re.findall(r"\d{4}", question)
        ]
        self.assertTrue(all_years)
        self.assertLessEqual(max(all_years), 2010)

    def test_climate_hint_only_uses_rules_supported_by_reference(self):
        def analyse(date: str):
            profile = {
                "name": "调候样例", "gender": "男", "calendar_type": "solar",
                "birth_date": date, "birth_time": "09:30",
                "time_precision": "exact", "birth_place": "江苏省南京市",
                "life_status": "alive",
            }
            chart = server.build_bazi_chart(profile)
            return server.build_bazi_skill_analysis(profile, chart, as_of_year=2026)

        self.assertIn("夏令", analyse("1985-06-18")["climate_analysis"])
        self.assertIn("水", analyse("1985-06-18")["climate_analysis"])
        self.assertIn("冬令", analyse("1985-12-18")["climate_analysis"])
        self.assertIn("火", analyse("1985-12-18")["climate_analysis"])
        self.assertIn("日干月令复核", analyse("1985-03-18")["climate_analysis"])
        self.assertIn("日干月令复核", analyse("1990-09-20")["climate_analysis"])
        self.assertIn("典籍示例", analyse("1985-09-12")["climate_analysis"])
        geng_zi = analyse("1985-12-17")
        self.assertIn("典籍示例", geng_zi["climate_analysis"])
        self.assertIn("火", geng_zi["climate_analysis"])
        self.assertIn("木", geng_zi["climate_analysis"])

    def test_deepseek_communication_cannot_smuggle_conflicting_skill_facts(self):
        profile = {
            "name": "冲突过滤样例", "gender": "男", "calendar_type": "solar",
            "birth_date": "1985-06-18", "birth_time": "09:30",
            "time_precision": "exact", "birth_place": "江苏省南京市",
            "life_status": "alive",
        }
        chart = server.build_bazi_chart(profile)
        deterministic = server.build_bazi_skill_analysis(profile, chart, as_of_year=2026)
        generated = {
            "summary": "重新算过，这是甲木日主，从强格。",
            "personality": "原来的旺衰不对，应改成身弱。",
            "likes": ["喜火", "忌水", "甲木格局"],
            "fears": ["调候应改", "大运为假", "流年重算"],
            "topics": ["八字重排", "用神改写", "否定原命盘"],
            "advice": "按甲木日主重新决定喜忌。",
            "script": "你是甲木，所以今天必须听我的。",
        }
        with patch("server.deepseek_is_configured", return_value=True), patch(
            "server.call_deepseek_json", return_value=generated
        ):
            result = server.generate_mystic_profile(profile, [])

        for key in ("summary", "personality", "likes", "fears", "topics", "advice", "script"):
            self.assertEqual(result["analysis"][key], deterministic[key])
        self.assertTrue(
            server._model_text_conflicts_with_skill_facts(
                "你天生属木，原局偏强，应该改用火。"
            )
        )
        self.assertTrue(
            server._model_text_conflicts_with_skill_facts(
                "命格应按木来看，之前的结论不准确。"
            )
        )
        for bypass in ("你是木命。", "核心能量偏向木。", "底层属性是木。"):
            self.assertTrue(server._model_text_conflicts_with_skill_facts(bypass))

    def test_workplace_deepseek_bazi_fields_use_same_conflict_gate(self):
        generated = {
            "reaction_tag": "重新定盘",
            "opponent_reply": "你天生属木，先按这个做。",
            "character_profile": {},
            "public_analysis": [
                "甲木日主从强。", "原局偏强。", "喜火忌水。", "格局应重算。",
            ],
            "suggested_next_message": "按甲木日主喜火的方式回复。",
            "bazi_communication": "命格应按木来看，之前的结论不准确。",
            "tone": "模型改盘",
            "satisfaction": 80,
            "work_progress": 80,
            "outcome": "命盘重算完成。",
        }
        with patch("server.deepseek_is_configured", return_value=True), patch(
            "server.call_deepseek_json", return_value=generated
        ), patch("server.random.choice", side_effect=lambda values: values[0]):
            result = server.generate_workplace_turn(
                "boss", True, "请确认优先级。",
                {"communication_preference": "先结论后选择"}, [],
            )

        visible = json.dumps(result, ensure_ascii=False)
        self.assertNotIn("甲木日主", visible)
        self.assertNotIn("命格应按木", visible)
        self.assertNotIn("喜火忌水", visible)
        self.assertIn("先结论后选择", result["professional_bazi"]["communication_translation"])

    def test_live_deepseek_cannot_rewrite_deterministic_bazi_facts(self):
        profile = {
            "name": "实时冲突样例", "gender": "男", "calendar_type": "solar",
            "birth_date": "1985-06-18", "birth_time": "09:30",
            "time_precision": "exact", "birth_place": "江苏省南京市",
            "life_status": "alive",
        }
        chart = server.build_bazi_chart(profile)
        base = server.build_bazi_skill_analysis(profile, chart, as_of_year=2026)
        fallback = server.fallback_live_analysis(
            chart, base, [{"role": "opponent", "text": "今晚给我。"}]
        )
        generated = {
            "signals": ["甲木日主从强", "喜火忌水", "格局应改"],
            "deepening": "原盘错了，应重算成甲木日主和从强格。",
            "next_move": "按甲木喜火的结论推进。",
            "suggested_line": "你是甲木日主，所以必须听我的。",
        }
        with patch("server.deepseek_is_configured", return_value=True), patch(
            "server.call_deepseek_json", return_value=generated
        ):
            result = server.generate_live_analysis(
                profile, base, [{"role": "opponent", "text": "今晚给我。"}]
            )

        self.assertEqual(result["signals"], fallback["signals"])
        self.assertEqual(result["deepening"], fallback["deepening"])
        self.assertEqual(result["next_move"], fallback["next_move"])
        self.assertEqual(result["suggested_line"], fallback["suggested_line"])

    def test_night_zi_uses_next_day_pillar_per_bazi_skill(self):
        """bazi-skill 约定 23:00–24:00 为晚子时，日柱按次日计算。"""

        chart = server.build_bazi_chart(
            {
                "name": "夜子时样例",
                "gender": "男",
                "calendar_type": "solar",
                "birth_date": "1985-06-18",
                "birth_time": "23:30",
                "time_precision": "exact",
                "birth_place": "江苏省南京市",
            }
        )

        self.assertEqual(
            f"{chart['pillars'][2]['stem']}{chart['pillars'][2]['branch']}",
            "己丑",
        )

    def test_valid_lunar_date_can_be_converted_and_charted(self):
        """农历二月三十虽不是有效公历日期，仍必须能提交并完成换算。"""

        chart = server.build_bazi_chart(
            {
                "name": "农历样例",
                "gender": "女",
                "calendar_type": "lunar",
                "birth_date": "1981-02-30",
                "birth_time": "09:30",
                "time_precision": "exact",
                "birth_place": "广东省广州市",
                "leap_month": "false",
            }
        )

        self.assertTrue(chart["solar_date"].startswith("1981-04-04"))
        self.assertEqual(len(chart["pillars"]), 4)

        leap_chart = server.build_bazi_chart(
            {
                "name": "闰月样例",
                "gender": "男",
                "calendar_type": "lunar",
                "birth_date": "2020-04-01",
                "birth_time": "12:00",
                "time_precision": "exact",
                "birth_place": "四川省成都市",
                "leap_month": "true",
            }
        )
        self.assertTrue(leap_chart["solar_date"].startswith("2020-05-23"))

    def test_unknown_birth_time_marks_hour_pillar_unknown(self):
        profile = {
            "name": "小林",
            "gender": "女",
            "calendar_type": "solar",
            "birth_date": "1996-11-03",
            "birth_time": "",
            "time_precision": "unknown",
            "birth_place": "浙江省杭州市",
        }
        chart = server.build_bazi_chart(profile)
        self.assertTrue(chart["time_unknown"])
        self.assertEqual(chart["pillars"][3]["stem"], "？")
        self.assertEqual(chart["pillars"][3]["ten_god"], "时辰未知")

    def test_profile_and_transcript_are_length_limited(self):
        profile = server.sanitise_profile({"name": "王" * 100, "birth_place": "北" * 200})
        transcript = server.sanitise_transcript(
            [{"role": "opponent", "text": str(index) * 800} for index in range(30)]
        )
        self.assertEqual(len(profile["name"]), 32)
        self.assertEqual(len(profile["birth_place"]), 80)
        self.assertEqual(len(transcript), 20)
        self.assertTrue(all(len(item["text"]) <= 600 for item in transcript))

    def test_mystic_profile_has_offline_fallback(self):
        profile = {
            "name": "小林",
            "gender": "女",
            "birth_date": "1996-11-03",
            "birth_time": "15:20",
            "birth_place": "浙江省杭州市",
        }
        with patch.dict(
            "server.os.environ", {"DEEPSEEK_DISABLE_KEYCHAIN": "1"}, clear=True
        ):
            result = server.generate_mystic_profile(profile, [])
        self.assertEqual(result["source"], "demo-fallback")
        self.assertEqual(result["chart"]["engine"], "lunar_python")
        self.assertEqual(len(result["chart"]["pillars"]), 4)
        self.assertEqual(len(result["analysis"]["likes"]), 3)

    def test_live_analysis_is_grounded_in_bazi_five_elements(self):
        profile = {
            "name": "王总",
            "gender": "男",
            "calendar_type": "solar",
            "birth_date": "1985-06-18",
            "birth_time": "09:30",
            "time_precision": "exact",
            "birth_place": "江苏省南京市",
        }
        transcript = [{"role": "opponent", "text": "今晚给我，别再解释了。"}]
        with patch.dict(
            "server.os.environ", {"DEEPSEEK_DISABLE_KEYCHAIN": "1"}, clear=True
        ):
            mystic = server.generate_mystic_profile(profile, transcript)
            live = server.generate_live_analysis(profile, mystic["analysis"], transcript)

        self.assertIn("四柱 乙丑 · 壬午 · 戊子 · 丁巳", live["bazi_basis"])
        self.assertIn("日主 阳土（戊）", live["bazi_basis"])
        self.assertTrue(live["signals"][0].startswith("日主锚点｜"))
        self.assertTrue(live["signals"][1].startswith("五行流通｜"))
        self.assertTrue(live["signals"][2].startswith("喜忌×聊天｜"))
        self.assertTrue(all(len(signal) <= 140 for signal in live["signals"]))
        self.assertIn("命理锚点", live["deepening"])

    def test_live_model_receives_chart_but_not_raw_birth_details(self):
        profile = {
            "name": "隐私样例",
            "gender": "女",
            "calendar_type": "solar",
            "birth_date": "1990-02-14",
            "birth_time": "20:10",
            "time_precision": "exact",
            "birth_place": "北京市朝阳区",
            "life_status": "alive",
        }
        generated = {
            "signals": ["日主线索", "五行线索", "聊天线索"],
            "deepening": "只根据命盘事实与聊天继续校准。",
            "next_move": "先确认范围。",
            "suggested_line": "我先确认范围和节点，再继续推进。",
        }

        with patch("server.deepseek_is_configured", return_value=True), patch(
            "server.call_deepseek_json", return_value=generated
        ) as deepseek:
            server.generate_live_analysis(profile, {}, [])

        sent_payload = deepseek.call_args.args[1]
        self.assertEqual(sent_payload["subject"], {"name": "隐私样例", "life_status": "alive"})
        serialized = json.dumps(sent_payload, ensure_ascii=False)
        self.assertNotIn("birth_date", serialized)
        self.assertNotIn("1990-02-14", serialized)
        self.assertNotIn("20:10", serialized)
        self.assertNotIn("北京市朝阳区", serialized)


class StreamingApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        handler = partial(server.DemoRequestHandler, directory=str(server.ROOT))
        cls.httpd = server.QuietThreadingHTTPServer(("127.0.0.1", 0), handler)
        cls.port = cls.httpd.server_address[1]
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join(timeout=2)

    def test_stream_contains_meta_analysis_deltas_and_done(self):
        request = urllib.request.Request(
            f"http://127.0.0.1:{self.port}/api/respond",
            data=json.dumps(
                {"scenario": "hostile", "bazi_enabled": True, "message": "怎么回？"}
            ).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        with patch("server.random_think_delay", return_value=1.25), patch(
            "server.time.sleep", return_value=None
        ), patch("server.deepseek_is_configured", return_value=False):
            with urllib.request.urlopen(request, timeout=3) as response:
                events = [json.loads(line) for line in response if line.strip()]

        event_types = [event["type"] for event in events]
        self.assertEqual(events[0], {"type": "meta", "think_seconds": 1.25})
        self.assertIn("opponent_start", event_types)
        self.assertIn("opponent_delta", event_types)
        self.assertIn("analysis_start", event_types)
        self.assertIn("character_profile", event_types)
        self.assertIn("bazi_professional", event_types)
        self.assertIn("analysis_item", event_types)
        self.assertIn("delta", event_types)
        self.assertEqual(events[-1]["type"], "done")
        self.assertIn("patience_delta", events[-1])
        self.assertIn("patience_reason", events[-1])
        self.assertLess(event_types.index("opponent_start"), event_types.index("analysis_start"))
        self.assertLess(event_types.index("analysis_start"), event_types.index("character_profile"))

    def test_streamed_ai_reply_is_analysis_authority_and_analysis_starts_once(self):
        history = [
            {"role": "opponent", "text": "今晚给我。"},
            {"role": "me", "text": "我今晚先交 A。"},
            {"role": "opponent", "text": "行，先交 A。"},
        ]
        authoritative = "A 我收到了， 继续说 B 的时间点。"
        analysis_inputs = []

        def fake_opponent_stream(*_args, **_kwargs):
            yield "A 我收到了， "
            yield "继续说 B 的时间点。"

        def fake_analysis(
            scenario,
            bazi_enabled,
            message,
            authoritative_opponent_reply,
            bazi_profile,
            recent_messages,
        ):
            analysis_inputs.append(authoritative_opponent_reply)
            return {
                **server.build_contextual_conversation_turn(
                    scenario, bazi_enabled, message, recent_messages
                ),
                "opponent_reply": authoritative_opponent_reply,
                "source": "deepseek-v4",
                "analysis_source": "deepseek-v4",
                "warning": "",
            }

        request = urllib.request.Request(
            f"http://127.0.0.1:{self.port}/api/respond",
            data=json.dumps(
                {
                    "scenario": "boss",
                    "bazi_enabled": False,
                    "message": "A 已交付，现在请确认 B。",
                    "recent_messages": history,
                }
            ).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        with patch("server.random_think_delay", return_value=0), patch(
            "server.deepseek_is_configured", return_value=True
        ), patch(
            "server.iter_workplace_opponent_reply", side_effect=fake_opponent_stream
        ), patch(
            "server.generate_workplace_analysis", side_effect=fake_analysis
        ):
            with urllib.request.urlopen(request, timeout=3) as response:
                events = [json.loads(line) for line in response if line.strip()]

        opponent_start = next(event for event in events if event["type"] == "opponent_start")
        opponent_text = "".join(
            event["text"] for event in events if event["type"] == "opponent_delta"
        )
        done = events[-1]
        self.assertEqual(opponent_start["source"], "deepseek-v4")
        self.assertEqual(done["source"], "deepseek-v4")
        self.assertEqual(opponent_text, authoritative)
        self.assertEqual(analysis_inputs, [authoritative])
        self.assertEqual(
            sum(event["type"] == "analysis_start" for event in events), 1
        )

    def test_fallback_commit_never_calls_ai_analysis_or_switches_source(self):
        def whitespace_stream(*_args, **_kwargs):
            yield "   "

        request = urllib.request.Request(
            f"http://127.0.0.1:{self.port}/api/respond",
            data=json.dumps(
                {
                    "scenario": "boss",
                    "bazi_enabled": False,
                    "message": "A 已交付，请确认 B。",
                }
            ).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        with patch("server.random_think_delay", return_value=0), patch(
            "server.WORKPLACE_SOURCE_DEADLINE", 0
        ), patch("server.deepseek_is_configured", return_value=True), patch(
            "server.iter_workplace_opponent_reply", side_effect=whitespace_stream
        ), patch("server.generate_workplace_analysis") as analysis:
            with urllib.request.urlopen(request, timeout=3) as response:
                events = [json.loads(line) for line in response if line.strip()]

        self.assertFalse(analysis.called)
        source_events = [
            event["source"]
            for event in events
            if event["type"] in {"opponent_start", "character_profile", "done"}
        ]
        self.assertTrue(source_events)
        self.assertEqual(set(source_events), {"demo-fallback"})
        self.assertEqual(
            sum(event["type"] == "analysis_start" for event in events), 1
        )

    def test_partial_ai_stream_failure_keeps_displayed_reply_authoritative(self):
        partial_reply = "A 已收到，"
        analysed = []

        def failing_stream(*_args, **_kwargs):
            yield partial_reply
            raise RuntimeError("connection interrupted")

        def fake_analysis(
            scenario,
            bazi_enabled,
            message,
            authoritative_opponent_reply,
            bazi_profile,
            recent_messages,
        ):
            analysed.append(authoritative_opponent_reply)
            return {
                **server.build_contextual_conversation_turn(
                    scenario, bazi_enabled, message, recent_messages
                ),
                "opponent_reply": authoritative_opponent_reply,
                "source": "deepseek-v4",
                "analysis_source": "demo-fallback",
                "warning": "",
            }

        request = urllib.request.Request(
            f"http://127.0.0.1:{self.port}/api/respond",
            data=json.dumps(
                {
                    "scenario": "boss",
                    "bazi_enabled": False,
                    "message": "A 已交付，请确认 B。",
                }
            ).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        with patch("server.random_think_delay", return_value=0), patch(
            "server.deepseek_is_configured", return_value=True
        ), patch(
            "server.iter_workplace_opponent_reply", side_effect=failing_stream
        ), patch(
            "server.generate_workplace_analysis", side_effect=fake_analysis
        ):
            with urllib.request.urlopen(request, timeout=3) as response:
                events = [json.loads(line) for line in response if line.strip()]

        opponent_text = "".join(
            event["text"] for event in events if event["type"] == "opponent_delta"
        )
        self.assertEqual(opponent_text, partial_reply)
        self.assertEqual(analysed, [partial_reply])
        self.assertEqual(
            {
                event["source"]
                for event in events
                if event["type"] in {"opponent_start", "done"}
            },
            {"deepseek-v4"},
        )
        analysis_start = next(
            event for event in events if event["type"] == "analysis_start"
        )
        self.assertEqual(analysis_start["mode"], "基础拆招")
        character_event = next(
            event for event in events if event["type"] == "character_profile"
        )
        self.assertEqual(character_event["source"], "demo-fallback")

    def request_json(self, path, payload=None):
        data = None if payload is None else json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            f"http://127.0.0.1:{self.port}{path}",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST" if data is not None else "GET",
        )
        with urllib.request.urlopen(request, timeout=3) as response:
            return response.status, json.loads(response.read())

    def test_config_never_exposes_api_key(self):
        with patch.dict("server.os.environ", {"DEEPSEEK_API_KEY": "secret-test-value"}):
            status, payload = self.request_json("/api/config")
        self.assertEqual(status, 200)
        self.assertTrue(payload["deepseek_configured"])
        self.assertNotIn("api_key", payload)
        self.assertNotIn("secret-test-value", json.dumps(payload))

    def test_server_source_is_not_public(self):
        with self.assertRaises(urllib.error.HTTPError) as caught:
            urllib.request.urlopen(
                f"http://127.0.0.1:{self.port}/server.py", timeout=3
            )
        self.assertEqual(caught.exception.code, 404)

    def test_versioned_static_assets_disable_browser_cache(self):
        with urllib.request.urlopen(
            f"http://127.0.0.1:{self.port}/script.js?v=regression-test",
            timeout=3,
        ) as response:
            self.assertEqual(response.status, 200)
            self.assertIn("no-store", response.headers.get("Cache-Control", ""))
            self.assertEqual(response.headers.get("Pragma"), "no-cache")

    def test_roadshow_and_its_assets_are_public(self):
        expected_types = {
            "/roadshow.html": "text/html",
            "/roadshow.css": "text/css",
            "/roadshow.js": "javascript",
            "/artifacts/workplace-demo-initial.png": "image/png",
        }
        for path, expected_type in expected_types.items():
            with self.subTest(path=path), urllib.request.urlopen(
                f"http://127.0.0.1:{self.port}{path}", timeout=3
            ) as response:
                self.assertEqual(response.status, 200)
                self.assertIn(expected_type, response.headers.get_content_type())

    def test_mac_keychain_can_supply_api_key(self):
        completed = server.subprocess.CompletedProcess(
            args=["security"], returncode=0, stdout="keychain-test-value\n", stderr=""
        )
        with patch.dict("server.os.environ", {}, clear=True), patch(
            "server.sys.platform", "darwin"
        ), patch("server.subprocess.run", return_value=completed):
            self.assertEqual(server.get_deepseek_api_key(), "keychain-test-value")

    def test_mystic_and_live_endpoints_work_offline(self):
        profile = {
            "name": "老周",
            "gender": "男",
            "birth_date": "1990-02-14",
            "birth_time": "20:10",
            "birth_place": "北京市朝阳区",
        }
        transcript = [{"role": "opponent", "text": "这个不是早就说过了吗？"}]
        with patch.dict(
            "server.os.environ", {"DEEPSEEK_DISABLE_KEYCHAIN": "1"}, clear=True
        ):
            status, mystic = self.request_json(
                "/api/mystic-profile", {"profile": profile, "transcript": transcript}
            )
            live_status, live = self.request_json(
                "/api/live-analysis",
                {
                    "profile": profile,
                    "base_analysis": mystic["analysis"],
                    "transcript": transcript,
                },
            )
        self.assertEqual(status, 200)
        self.assertEqual(mystic["source"], "demo-fallback")
        self.assertEqual(live_status, 200)
        self.assertEqual(len(live["signals"]), 3)
        self.assertIn("四柱", live["bazi_basis"])
        self.assertTrue(all("｜" in signal for signal in live["signals"]))

    def test_mystic_endpoint_accepts_lunar_calendar_profile(self):
        profile = {
            "name": "农历样例",
            "gender": "女",
            "calendar_type": "lunar",
            "birth_date": "1981-02-30",
            "birth_time": "09:30",
            "time_precision": "exact",
            "birth_place": "广东省广州市",
            "leap_month": False,
        }
        with patch.dict(
            "server.os.environ", {"DEEPSEEK_DISABLE_KEYCHAIN": "1"}, clear=True
        ):
            status, payload = self.request_json(
                "/api/mystic-profile", {"profile": profile, "transcript": []}
            )

        self.assertEqual(status, 200)
        self.assertTrue(payload["chart"]["solar_date"].startswith("1981-04-04"))
        self.assertEqual(
            payload["chart"]["calculation_standard"]["skill"],
            "jinchenma94/bazi-skill",
        )


if __name__ == "__main__":
    unittest.main()
