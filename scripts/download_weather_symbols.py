#!/usr/bin/env python3
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from functools import partial
from pathlib import Path
from socket import timeout as SocketTimeout
from tempfile import NamedTemporaryFile
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from xml.etree import ElementTree

BASE_URL = (
    "https://raw.githubusercontent.com/metno/weathericons/main/weather/svg/{code}.svg"
)
USER_AGENT = "RideSense/1.0 ridesense@example.com"
OUTPUT_DIR = Path("public/weather-symbols")
DEFAULT_WORKERS = 8

SYMBOL_CODES = [
    "clearsky_day",
    "clearsky_night",
    "clearsky_polartwilight",
    "fair_day",
    "fair_night",
    "fair_polartwilight",
    "partlycloudy_day",
    "partlycloudy_night",
    "partlycloudy_polartwilight",
    "cloudy",
    "rainshowers_day",
    "rainshowers_night",
    "rainshowers_polartwilight",
    "rainshowersandthunder_day",
    "rainshowersandthunder_night",
    "rainshowersandthunder_polartwilight",
    "sleetshowers_day",
    "sleetshowers_night",
    "sleetshowers_polartwilight",
    "snowshowers_day",
    "snowshowers_night",
    "snowshowers_polartwilight",
    "rain",
    "heavyrain",
    "heavyrainandthunder",
    "sleet",
    "snow",
    "snowandthunder",
    "fog",
    "sleetshowersandthunder_day",
    "sleetshowersandthunder_night",
    "sleetshowersandthunder_polartwilight",
    "snowshowersandthunder_day",
    "snowshowersandthunder_night",
    "snowshowersandthunder_polartwilight",
    "rainandthunder",
    "sleetandthunder",
    "lightrainshowersandthunder_day",
    "lightrainshowersandthunder_night",
    "lightrainshowersandthunder_polartwilight",
    "heavyrainshowersandthunder_day",
    "heavyrainshowersandthunder_night",
    "heavyrainshowersandthunder_polartwilight",
    "lightssleetshowersandthunder_day",
    "lightssleetshowersandthunder_night",
    "lightssleetshowersandthunder_polartwilight",
    "heavysleetshowersandthunder_day",
    "heavysleetshowersandthunder_night",
    "heavysleetshowersandthunder_polartwilight",
    "lightssnowshowersandthunder_day",
    "lightssnowshowersandthunder_night",
    "lightssnowshowersandthunder_polartwilight",
    "heavysnowshowersandthunder_day",
    "heavysnowshowersandthunder_night",
    "heavysnowshowersandthunder_polartwilight",
    "lightrainandthunder",
    "heavyrainshowers_day",
    "heavyrainshowers_night",
    "heavyrainshowers_polartwilight",
    "lightsleet",
    "heavysleet",
    "lightsnow",
    "heavysnow",
    "lightrainshowers_day",
    "lightrainshowers_night",
    "lightrainshowers_polartwilight",
    "heavysleetshowers_day",
    "heavysleetshowers_night",
    "heavysleetshowers_polartwilight",
    "lightsleetshowers_day",
    "lightsleetshowers_night",
    "lightsleetshowers_polartwilight",
    "lightssnowshowers_day",
    "lightssnowshowers_night",
    "lightssnowshowers_polartwilight",
    "heavysnowshowers_day",
    "heavysnowshowers_night",
    "heavysnowshowers_polartwilight",
]


def _fetch_svg_bytes(symbol_code: str, timeout_seconds: int = 15) -> bytes | None:
    request = Request(
        BASE_URL.format(code=symbol_code),
        headers={"User-Agent": USER_AGENT},
    )

    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            svg_bytes = response.read()
    except (HTTPError, URLError, TimeoutError, SocketTimeout):
        return None

    if not _is_valid_svg_bytes(svg_bytes):
        return None

    return svg_bytes


def _is_valid_svg_bytes(svg_bytes: bytes) -> bool:
    if not svg_bytes.strip():
        return False

    try:
        root = ElementTree.fromstring(svg_bytes)
    except ElementTree.ParseError:
        return False

    return isinstance(root.tag, str) and root.tag.rsplit("}", 1)[-1] == "svg"


def _is_valid_cached_svg(target_path: Path) -> bool:
    try:
        if not target_path.is_file() or target_path.stat().st_size <= 0:
            return False

        svg_bytes = target_path.read_bytes()
    except OSError:
        return False

    return _is_valid_svg_bytes(svg_bytes)


def download_symbol(symbol_code: str, overwrite: bool = False) -> bool:
    target_path = OUTPUT_DIR / f"{symbol_code}.svg"

    try:
        target_path.parent.mkdir(parents=True, exist_ok=True)
    except OSError:
        return False

    if not overwrite and target_path.exists() and _is_valid_cached_svg(target_path):
        return True

    svg_bytes = _fetch_svg_bytes(symbol_code)
    if svg_bytes is None:
        return False

    temporary_path: Path | None = None
    try:
        with NamedTemporaryFile(
            dir=target_path.parent,
            prefix=f".{target_path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary_file:
            temporary_file.write(svg_bytes)
            temporary_path = Path(temporary_file.name)

        if target_path.is_dir():
            target_path.rmdir()

        temporary_path.replace(target_path)
    except OSError:
        return False
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)

    return True


def _download_and_report(symbol_code: str, overwrite: bool = False) -> bool:
    success = download_symbol(symbol_code, overwrite=overwrite)
    if success:
        print(f"OK  {symbol_code}")
    else:
        print(f"FEIL {symbol_code}")
    return success


def download_all_symbols(
    symbol_codes: list[str] | tuple[str, ...],
    workers: int = DEFAULT_WORKERS,
    overwrite: bool = False,
) -> tuple[int, int]:
    try:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    except OSError:
        return 0, len(symbol_codes)

    worker_count = max(1, workers)
    ok_count = 0

    with ThreadPoolExecutor(max_workers=worker_count) as executor:
        download_fn = partial(_download_and_report, overwrite=overwrite)
        for was_ok in executor.map(download_fn, symbol_codes):
            if was_ok:
                ok_count += 1

    fail_count = len(symbol_codes) - ok_count
    return ok_count, fail_count


def main() -> None:
    ok_count, fail_count = download_all_symbols(SYMBOL_CODES)
    print(f"\nFerdig. Lastet ned: {ok_count}, feilet: {fail_count}")


if __name__ == "__main__":
    main()
