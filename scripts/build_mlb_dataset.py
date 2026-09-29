#!/usr/bin/env python3
"""Build a website-ready MLB batting panel from Baseball Databank CSV files."""

from __future__ import annotations

import csv
import shutil
from pathlib import Path
from urllib.request import urlretrieve


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
OUT_DIR = ROOT / "data" / "processed"
OUT_FILE = OUT_DIR / "mlb_batting_player_seasons.csv"

SOURCES = {
    "Batting.csv": "https://raw.githubusercontent.com/cbwinslow/baseballdatabank/master/core/Batting.csv",
    "People.csv": "https://raw.githubusercontent.com/cbwinslow/baseballdatabank/master/core/People.csv",
    "Teams.csv": "https://raw.githubusercontent.com/cbwinslow/baseballdatabank/master/core/Teams.csv",
}

TMP_DOWNLOADS = {
    "Batting.csv": Path("/private/tmp/Batting.csv"),
    "People.csv": Path("/private/tmp/People.csv"),
    "Teams.csv": Path("/private/tmp/Teams.csv"),
}

OUTPUT_COLUMNS = [
    "player_id",
    "player_name",
    "year",
    "stint",
    "team_id",
    "team_name",
    "league",
    "franchise_id",
    "division",
    "bats",
    "throws",
    "birth_country",
    "age",
    "games",
    "at_bats",
    "plate_appearances",
    "runs",
    "hits",
    "doubles",
    "triples",
    "home_runs",
    "rbi",
    "stolen_bases",
    "caught_stealing",
    "walks",
    "strikeouts",
    "intentional_walks",
    "hit_by_pitch",
    "sacrifice_hits",
    "sacrifice_flies",
    "grounded_into_double_plays",
    "total_bases",
    "batting_average",
    "on_base_percentage",
    "slugging_percentage",
    "ops",
    "isolated_power",
]


def ensure_raw_files() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    for filename, url in SOURCES.items():
        target = RAW_DIR / filename
        if target.exists():
            continue
        tmp_file = TMP_DOWNLOADS.get(filename)
        if tmp_file and tmp_file.exists():
            shutil.copyfile(tmp_file, target)
        else:
            urlretrieve(url, target)


def read_dict(path: Path, key_fields: tuple[str, ...]) -> dict[tuple[str, ...], dict[str, str]]:
    records = {}
    with path.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            key = tuple(row[field] for field in key_fields)
            records[key] = row
    return records


def to_int(value: str) -> int:
    return int(value) if value not in ("", None) else 0


def safe_rate(numerator: float, denominator: float) -> str:
    if denominator <= 0:
        return ""
    return f"{numerator / denominator:.3f}"


def build() -> None:
    ensure_raw_files()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    people = read_dict(RAW_DIR / "People.csv", ("playerID",))
    teams = read_dict(RAW_DIR / "Teams.csv", ("yearID", "teamID", "lgID"))

    rows_written = 0
    with (RAW_DIR / "Batting.csv").open(newline="", encoding="utf-8") as in_handle:
        reader = csv.DictReader(in_handle)
        with OUT_FILE.open("w", newline="", encoding="utf-8") as out_handle:
            writer = csv.DictWriter(out_handle, fieldnames=OUTPUT_COLUMNS)
            writer.writeheader()

            for row in reader:
                year = to_int(row["yearID"])
                league = row["lgID"]
                if year < 1901 or league not in {"AL", "NL"}:
                    continue

                person = people.get((row["playerID"],), {})
                team = teams.get((row["yearID"], row["teamID"], league), {})

                ab = to_int(row["AB"])
                hits = to_int(row["H"])
                doubles = to_int(row["2B"])
                triples = to_int(row["3B"])
                home_runs = to_int(row["HR"])
                walks = to_int(row["BB"])
                hbp = to_int(row["HBP"])
                sacrifice_flies = to_int(row["SF"])
                sacrifice_hits = to_int(row["SH"])
                plate_appearances = ab + walks + hbp + sacrifice_flies + sacrifice_hits
                total_bases = hits + doubles + 2 * triples + 3 * home_runs

                birth_year = person.get("birthYear", "")
                age = year - int(birth_year) if birth_year else ""
                first_name = person.get("nameFirst", "")
                last_name = person.get("nameLast", "")
                player_name = " ".join(part for part in (first_name, last_name) if part)

                batting_average = safe_rate(hits, ab)
                obp = safe_rate(hits + walks + hbp, ab + walks + hbp + sacrifice_flies)
                slg = safe_rate(total_bases, ab)
                ops = ""
                if obp and slg:
                    ops = f"{float(obp) + float(slg):.3f}"

                writer.writerow(
                    {
                        "player_id": row["playerID"],
                        "player_name": player_name,
                        "year": year,
                        "stint": row["stint"],
                        "team_id": row["teamID"],
                        "team_name": team.get("name", ""),
                        "league": league,
                        "franchise_id": team.get("franchID", ""),
                        "division": team.get("divID", ""),
                        "bats": person.get("bats", ""),
                        "throws": person.get("throws", ""),
                        "birth_country": person.get("birthCountry", ""),
                        "age": age,
                        "games": row["G"],
                        "at_bats": ab,
                        "plate_appearances": plate_appearances,
                        "runs": row["R"],
                        "hits": hits,
                        "doubles": doubles,
                        "triples": triples,
                        "home_runs": home_runs,
                        "rbi": row["RBI"],
                        "stolen_bases": row["SB"],
                        "caught_stealing": row["CS"],
                        "walks": walks,
                        "strikeouts": row["SO"],
                        "intentional_walks": row["IBB"],
                        "hit_by_pitch": hbp,
                        "sacrifice_hits": sacrifice_hits,
                        "sacrifice_flies": sacrifice_flies,
                        "grounded_into_double_plays": row["GIDP"],
                        "total_bases": total_bases,
                        "batting_average": batting_average,
                        "on_base_percentage": obp,
                        "slugging_percentage": slg,
                        "ops": ops,
                        "isolated_power": safe_rate(total_bases - hits, ab),
                    }
                )
                rows_written += 1

    print(f"Wrote {rows_written:,} rows to {OUT_FILE}")


if __name__ == "__main__":
    build()
