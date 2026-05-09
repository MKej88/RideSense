from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
from typing import Any


def _load_weather_symbols_module() -> Any:
    module_path = (
        Path(__file__).resolve().parent.parent
        / "scripts"
        / "download_weather_symbols.py"
    )
    spec = importlib.util.spec_from_file_location(
        "download_weather_symbols", module_path
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load module spec for {module_path}")

    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


weather_symbols = _load_weather_symbols_module()


class _FakeResponse:
    def __init__(self, payload: bytes) -> None:
        self._payload = payload

    def __enter__(self) -> "_FakeResponse":
        return self

    def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        return None

    def read(self) -> bytes:
        return self._payload


def test_download_symbol_saves_file_on_success(
    monkeypatch: Any, tmp_path: Path
) -> None:
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


def test_download_symbol_returns_false_on_timeout(
    monkeypatch: Any, tmp_path: Path
) -> None:
    monkeypatch.setattr(weather_symbols, "OUTPUT_DIR", tmp_path)

    def fake_urlopen(_request: Any, timeout: int = 15) -> _FakeResponse:
        raise TimeoutError("tok for lang tid")

    monkeypatch.setattr(weather_symbols, "urlopen", fake_urlopen)

    result = weather_symbols.download_symbol("clearsky_day")

    assert result is False
    assert not (tmp_path / "clearsky_day.svg").exists()


def test_download_symbol_returns_false_on_empty_response(
    monkeypatch: Any, tmp_path: Path
) -> None:
    monkeypatch.setattr(weather_symbols, "OUTPUT_DIR", tmp_path)

    def fake_urlopen(_request: Any, timeout: int = 15) -> _FakeResponse:
        assert timeout == 15
        return _FakeResponse(b"")

    monkeypatch.setattr(weather_symbols, "urlopen", fake_urlopen)

    result = weather_symbols.download_symbol("clearsky_day")

    assert result is False
    assert not (tmp_path / "clearsky_day.svg").exists()


def test_download_symbol_skips_existing_file_without_overwrite(
    monkeypatch: Any, tmp_path: Path
) -> None:
    monkeypatch.setattr(weather_symbols, "OUTPUT_DIR", tmp_path)
    file_path = tmp_path / "clearsky_day.svg"
    file_path.write_bytes(b"<svg>eksisterende</svg>")

    def fake_urlopen(_request: Any, timeout: int = 15) -> _FakeResponse:
        raise AssertionError("urlopen skal ikke kalles nar fil finnes")

    monkeypatch.setattr(weather_symbols, "urlopen", fake_urlopen)

    result = weather_symbols.download_symbol("clearsky_day")

    assert result is True
    assert file_path.read_bytes() == b"<svg>eksisterende</svg>"


def test_download_symbol_refetches_empty_cached_file(
    monkeypatch: Any, tmp_path: Path
) -> None:
    monkeypatch.setattr(weather_symbols, "OUTPUT_DIR", tmp_path)
    file_path = tmp_path / "clearsky_day.svg"
    file_path.write_bytes(b"")

    def fake_urlopen(_request: Any, timeout: int = 15) -> _FakeResponse:
        assert timeout == 15
        return _FakeResponse(b"<svg>fresh</svg>")

    monkeypatch.setattr(weather_symbols, "urlopen", fake_urlopen)

    result = weather_symbols.download_symbol("clearsky_day")

    assert result is True
    assert file_path.read_bytes() == b"<svg>fresh</svg>"


def test_download_symbol_refetches_corrupt_cached_file(
    monkeypatch: Any, tmp_path: Path
) -> None:
    monkeypatch.setattr(weather_symbols, "OUTPUT_DIR", tmp_path)
    file_path = tmp_path / "clearsky_day.svg"
    file_path.write_bytes(b"x")

    def fake_urlopen(_request: Any, timeout: int = 15) -> _FakeResponse:
        assert timeout == 15
        return _FakeResponse(b"<svg>fresh</svg>")

    monkeypatch.setattr(weather_symbols, "urlopen", fake_urlopen)

    result = weather_symbols.download_symbol("clearsky_day")

    assert result is True
    assert file_path.read_bytes() == b"<svg>fresh</svg>"


def test_download_symbol_refetches_when_path_is_directory(
    monkeypatch: Any, tmp_path: Path
) -> None:
    monkeypatch.setattr(weather_symbols, "OUTPUT_DIR", tmp_path)
    target_path = tmp_path / "clearsky_day.svg"
    target_path.mkdir()

    def fake_urlopen(_request: Any, timeout: int = 15) -> _FakeResponse:
        assert timeout == 15
        return _FakeResponse(b"<svg>fresh</svg>")

    monkeypatch.setattr(weather_symbols, "urlopen", fake_urlopen)

    result = weather_symbols.download_symbol("clearsky_day")

    assert result is True
    assert target_path.read_bytes() == b"<svg>fresh</svg>"


def test_download_symbol_creates_output_directory(
    monkeypatch: Any, tmp_path: Path
) -> None:
    nested_output_dir = tmp_path / "missing" / "weather-symbols"
    monkeypatch.setattr(weather_symbols, "OUTPUT_DIR", nested_output_dir)

    def fake_urlopen(_request: Any, timeout: int = 15) -> _FakeResponse:
        assert timeout == 15
        return _FakeResponse(b"<svg>ok</svg>")

    monkeypatch.setattr(weather_symbols, "urlopen", fake_urlopen)

    result = weather_symbols.download_symbol("clearsky_day")

    assert result is True
    assert (nested_output_dir / "clearsky_day.svg").read_bytes() == b"<svg>ok</svg>"


def test_download_symbol_uses_custom_timeout(monkeypatch: Any, tmp_path: Path) -> None:
    monkeypatch.setattr(weather_symbols, "OUTPUT_DIR", tmp_path)

    def fake_urlopen(_request: Any, timeout: int = 15) -> _FakeResponse:
        assert timeout == 42
        return _FakeResponse(b"<svg>ok</svg>")

    monkeypatch.setattr(weather_symbols, "urlopen", fake_urlopen)

    result = weather_symbols.download_symbol("clearsky_day", timeout_seconds=42)

    assert result is True
    assert (tmp_path / "clearsky_day.svg").read_bytes() == b"<svg>ok</svg>"


def test_download_all_symbols_creates_output_directory(
    monkeypatch: Any, tmp_path: Path
) -> None:
    nested_output_dir = tmp_path / "missing" / "weather-symbols"
    monkeypatch.setattr(weather_symbols, "OUTPUT_DIR", nested_output_dir)

    def fake_urlopen(_request: Any, timeout: int = 15) -> _FakeResponse:
        assert timeout == 15
        return _FakeResponse(b"<svg>ok</svg>")

    monkeypatch.setattr(weather_symbols, "urlopen", fake_urlopen)

    ok_count, fail_count = weather_symbols.download_all_symbols(
        ["clearsky_day"], workers=1
    )

    assert ok_count == 1
    assert fail_count == 0


def test_download_all_symbols_uses_minimum_one_worker(
    monkeypatch: Any, tmp_path: Path
) -> None:
    monkeypatch.setattr(weather_symbols, "OUTPUT_DIR", tmp_path)

    def fake_urlopen(_request: Any, timeout: int = 15) -> _FakeResponse:
        assert timeout == 15
        return _FakeResponse(b"<svg>ok</svg>")

    monkeypatch.setattr(weather_symbols, "urlopen", fake_urlopen)

    ok_count, fail_count = weather_symbols.download_all_symbols(
        ["clearsky_day"], workers=0
    )

    assert ok_count == 1
    assert fail_count == 0


def test_download_all_symbols_returns_failures_on_directory_creation_error(
    monkeypatch: Any, tmp_path: Path
) -> None:
    occupied_path = tmp_path / "occupied"
    occupied_path.write_text("not a directory")
    monkeypatch.setattr(weather_symbols, "OUTPUT_DIR", occupied_path)

    ok_count, fail_count = weather_symbols.download_all_symbols(
        ["clearsky_day", "fair_day"], workers=1
    )

    assert ok_count == 0
    assert fail_count == 2
