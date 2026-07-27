"""Structured (JSON-lines) logging setup.

Stdlib only (logging, json). Never configure a handler that logs a raw
environment-variable *value* -- only the name/presence captured in
environment.py is safe to log. See PART 5 of the orchestrator prompt: tests
must use dummy values and must never print credential contents.
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone


class JsonLineFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, sort_keys=True)


def get_logger(name: str, *, level: int = logging.INFO) -> logging.Logger:
    logger = logging.getLogger(name)
    if not any(isinstance(h, logging.StreamHandler) for h in logger.handlers):
        handler = logging.StreamHandler(stream=sys.stderr)
        handler.setFormatter(JsonLineFormatter())
        logger.addHandler(handler)
    logger.setLevel(level)
    logger.propagate = False
    return logger
