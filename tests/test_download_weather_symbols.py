from __future__ import annotations

from pathlib import Path
from typing import Any

import scripts.download_weather_symbols as weather_symbols


class _FakeResponse:
    def __init__(self, payload: bytes) -> None:
        self._payload = payload

    def __enter__(self) -> "_FakeResponse":
        return self

    def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        return None

    def read(self) -> bytes:
        return self._payload


def test_download_symbol_saves_file_on_success(monkeypatch: Any, tmp_path: Path) -> None:
    monkeypatch.setattr(weather_symbols, "OUTPUT_DIR", tmp_path)

    def fake_urlopen(_request: Any, timeout: int = 15) -> _FakeResponse:
        assert timeout == 15
        return _FakeResponse(b"<svg>ok</svg>")

    monkeypatch.setattr(weather_symbols, "urlopen", fake_urlopen)

    result = weather_symbols.download_symbol("clearsky_day")

    assert result is True
    assert (tmp_path / "clearsky_day.svg").read_bytes() == b"<svg>ok</svg>"


def test_download_symbol_returns_false_on_network_error(
    monkeypatch: Any, tmp_path: Path
) -> None:
    monkeypatch.setattr(weather_symbols, "OUTPUT_DIR", tmp_path)

    def fake_urlopen(_request: Any, timeout: int = 15) -> _FakeResponse:
        raise weather_symbols.URLError("nettverksfeil")

    monkeypatch.setattr(weather_symbols, "urlopen", fake_urlopen)

    result = weather_symbols.download_symbol("clearsky_day")

    assert result is False
    assert not (tmp_path / "clearsky_day.svg").exists()
