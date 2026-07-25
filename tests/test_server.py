import json
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

    def test_bazi_adds_one_public_calibration_item(self):
        normal = server.build_conversation_turn("hostile", False, "我们按群里的记录确认。")
        cheat = server.build_conversation_turn("hostile", True, "我们按群里的记录确认。")
        self.assertEqual(len(normal["analysis"]), 3)
        self.assertEqual(len(cheat["analysis"]), 4)

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
        ):
            with urllib.request.urlopen(request, timeout=3) as response:
                events = [json.loads(line) for line in response if line.strip()]

        event_types = [event["type"] for event in events]
        self.assertEqual(events[0], {"type": "meta", "think_seconds": 1.25})
        self.assertIn("opponent_start", event_types)
        self.assertIn("opponent_delta", event_types)
        self.assertIn("analysis_start", event_types)
        self.assertIn("analysis_item", event_types)
        self.assertIn("delta", event_types)
        self.assertEqual(events[-1]["type"], "done")
        self.assertIn("patience_delta", events[-1])
        self.assertIn("patience_reason", events[-1])
        self.assertLess(event_types.index("opponent_start"), event_types.index("analysis_start"))

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


if __name__ == "__main__":
    unittest.main()
