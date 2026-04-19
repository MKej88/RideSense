#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

BASE_URL = (
    "https://www.yr.no/assets/images/weather-symbols/dark-mode/default/svg/{code}.svg"
)
USER_AGENT = "RideSense/1.0 ridesense@example.com"
OUTPUT_DIR = Path("public/weather-symbols")

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


def download_symbol(symbol_code: str) -> bool:
    target_path = OUTPUT_DIR / f"{symbol_code}.svg"
    request = Request(
        BASE_URL.format(code=symbol_code),
        headers={"User-Agent": USER_AGENT},
    )

    try:
        with urlopen(request, timeout=15) as response:
            svg_bytes = response.read()
    except (HTTPError, URLError):
        return False

    target_path.write_bytes(svg_bytes)
    return True


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    ok_count = 0
    fail_count = 0

    for code in SYMBOL_CODES:
        if download_symbol(code):
            ok_count += 1
            print(f"OK  {code}")
        else:
            fail_count += 1
            print(f"FEIL {code}")

    print(f"\nFerdig. Lastet ned: {ok_count}, feilet: {fail_count}")


if __name__ == "__main__":
    main()
