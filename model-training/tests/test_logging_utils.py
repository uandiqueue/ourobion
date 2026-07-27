import io
import json
import logging
import unittest

from ourobion_model_lab.logging_utils import get_logger


class TestGetLogger(unittest.TestCase):
    def test_emits_valid_json_lines(self):
        logger = get_logger("test.jsonline.logger")
        stream = io.StringIO()
        # Swap in a stream we can inspect, keeping the same JSON formatter.
        for handler in logger.handlers:
            handler.stream = stream
        logger.info("hello %s", "world")
        for handler in logger.handlers:
            handler.flush()
        line = stream.getvalue().strip().splitlines()[-1]
        payload = json.loads(line)
        self.assertEqual(payload["message"], "hello world")
        self.assertEqual(payload["level"], "INFO")
        self.assertEqual(payload["logger"], "test.jsonline.logger")

    def test_does_not_duplicate_handlers_on_repeat_calls(self):
        logger_a = get_logger("test.jsonline.singleton")
        logger_b = get_logger("test.jsonline.singleton")
        self.assertIs(logger_a, logger_b)
        stream_handlers = [h for h in logger_a.handlers if isinstance(h, logging.StreamHandler)]
        self.assertEqual(len(stream_handlers), 1)


if __name__ == "__main__":
    unittest.main()
