#!/usr/bin/env python3
"""Build a team-game payroll and winning dataset for the website project."""

from __future__ import annotations

import csv
import io
import shutil
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from urllib.request import urlretrieve


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
RETRO_DIR = RAW_DIR / "retrosheet"
OUT_DIR = ROOT / "data" / "processed"
OUT_FILE = OUT_DIR / "mlb_team_payroll_game_results.csv"

START_YEAR = 1985
END_YEAR = 2016

SALARY_URL = "https://raw.githubusercontent.com/cbwinslow/baseballdatabank/master/contrib/Salaries.csv"
SALARY_FILE = RAW_DIR / "Salaries.csv"
TMP_SALARY = Path("/private/tmp/Salaries.csv")

OUTPUT_COLUMNS = [
    "game_id",
    "date",
    "year",
    "team_id",
    "opponent_id",
    "home_away",
    "league",
    "team_name",
    "games_played_to_date",
    "team_runs",
    "opponent_runs",
    "run_differential",
    "win",
    "loss",
    "tie",
    "winning_percentage_after_game",
    "season_payroll",
    "payroll_rank",
    "payroll_percentile",
    "payroll_millions",
    "cost_per_win_to_date",
    "attendance",
    "day_night",
    "time_of_game_minutes",
    "hits",
    "home_runs",
    "walks",
    "strikeouts",
    "errors",
]


def ensure_salary_file() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    if SALARY_FILE.exists():
        return
    if TMP_SALARY.exists():
        shutil.copyfile(TMP_SALARY, SALARY_FILE)
    else:
        urlretrieve(SALARY_URL, SALARY_FILE)


def ensure_retrosheet_zip(year: int) -> Path:
    RETRO_DIR.mkdir(parents=True, exist_ok=True)
    target = RETRO_DIR / f"{year}csvs.zip"
    if target.exists():
        return target
    tmp = Path(f"/private/tmp/{year}csvs.zip")
    if tmp.exists():
        shutil.copyfile(tmp, target)
        return target
    url = f"https://www.retrosheet.org/downloads/{year}/{year}csvs.zip"
    urlretrieve(url, target)
    return target


def to_int(value: str) -> int:
    return int(value) if value not in ("", None) else 0


def to_float(value: str) -> float:
    return float(value) if value not in ("", None) else 0.0


def salary_team_code(year: int, team: str) -> str:
    if team == "MIL" and year <= 1997:
        return "ML4"
    if team == "ANA" and year >= 2005:
        return "LAA"
    return team


def load_payrolls() -> tuple[dict[tuple[int, str], int], dict[int, dict[str, int]], dict[tuple[int, str], str]]:
    ensure_salary_file()
    payrolls: dict[tuple[int, str], int] = defaultdict(int)
    leagues: dict[tuple[int, str], str] = {}
    with SALARY_FILE.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            year = int(row["yearID"])
            if START_YEAR <= year <= END_YEAR:
                team = row["teamID"]
                payrolls[(year, team)] += int(row["salary"])
                leagues[(year, team)] = row["lgID"]

    ranks_by_year: dict[int, dict[str, int]] = {}
    for year in range(START_YEAR, END_YEAR + 1):
        teams = sorted(
            [(team, payroll) for (payroll_year, team), payroll in payrolls.items() if payroll_year == year],
            key=lambda item: item[1],
            reverse=True,
        )
        ranks_by_year[year] = {team: rank for rank, (team, _) in enumerate(teams, start=1)}

    return dict(payrolls), ranks_by_year, leagues


def load_team_names() -> dict[tuple[int, str], str]:
    teams_file = RAW_DIR / "Teams.csv"
    names = {}
    if not teams_file.exists():
        return names
    with teams_file.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            names[(int(row["yearID"]), row["teamID"])] = row["name"]
    return names


def load_gameinfo(zf: zipfile.ZipFile, year: int) -> dict[str, dict[str, str]]:
    with zf.open(f"{year}gameinfo.csv") as handle:
        reader = csv.DictReader(io.TextIOWrapper(handle, encoding="utf-8"))
        return {row["gid"]: row for row in reader}


def process_year(
    year: int,
    payrolls: dict[tuple[int, str], int],
    ranks_by_year: dict[int, dict[str, int]],
    leagues: dict[tuple[int, str], str],
    team_names: dict[tuple[int, str], str],
) -> tuple[list[dict[str, object]], Counter]:
    rows = []
    unmatched = Counter()
    records_by_game: dict[str, list[dict[str, str]]] = defaultdict(list)

    zip_path = ensure_retrosheet_zip(year)
    with zipfile.ZipFile(zip_path) as zf:
        gameinfo = load_gameinfo(zf, year)
        with zf.open(f"{year}teamstats.csv") as handle:
            reader = csv.DictReader(io.TextIOWrapper(handle, encoding="utf-8"))
            for row in reader:
                if row.get("stattype") == "value":
                    records_by_game[row["gid"]].append(row)

    running_record: dict[str, Counter] = defaultdict(Counter)
    year_team_count = max(1, len(ranks_by_year.get(year, {})))

    for game_id, game_rows in sorted(records_by_game.items()):
        if len(game_rows) != 2:
            continue

        runs_by_team = {row["team"]: to_int(row["b_r"]) for row in game_rows}
        info = gameinfo.get(game_id, {})
        attendance = to_int(info.get("attendance", ""))
        day_night = info.get("daynight", "")
        time_of_game = to_int(info.get("timeofgame", ""))

        for row in game_rows:
            team = row["team"]
            opponent = row["opp"]
            salary_team = salary_team_code(year, team)
            payroll = payrolls.get((year, salary_team))
            if payroll is None:
                unmatched[(year, team)] += 1
                continue

            team_runs = runs_by_team.get(team, to_int(row["b_r"]))
            opponent_runs = runs_by_team.get(opponent, 0)
            win = 1 if row.get("win") == "true" else 0
            loss = 1 if row.get("loss") == "true" else 0
            tie = 1 if row.get("tie") == "true" else 0

            running_record[team]["games"] += 1
            running_record[team]["wins"] += win
            running_record[team]["losses"] += loss
            running_record[team]["ties"] += tie

            games_to_date = running_record[team]["games"]
            wins_to_date = running_record[team]["wins"]
            losses_to_date = running_record[team]["losses"]
            win_pct_denominator = wins_to_date + losses_to_date
            win_pct = wins_to_date / win_pct_denominator if win_pct_denominator else 0
            rank = ranks_by_year[year][salary_team]
            percentile = 1 - ((rank - 1) / max(1, year_team_count - 1))

            rows.append(
                {
                    "game_id": game_id,
                    "date": f"{row['date'][:4]}-{row['date'][4:6]}-{row['date'][6:]}",
                    "year": year,
                    "team_id": team,
                    "opponent_id": opponent,
                    "home_away": "Home" if row["vishome"] == "home" else "Away",
                    "league": leagues.get((year, salary_team), ""),
                    "team_name": team_names.get((year, team), team),
                    "games_played_to_date": games_to_date,
                    "team_runs": team_runs,
                    "opponent_runs": opponent_runs,
                    "run_differential": team_runs - opponent_runs,
                    "win": win,
                    "loss": loss,
                    "tie": tie,
                    "winning_percentage_after_game": f"{win_pct:.3f}",
                    "season_payroll": payroll,
                    "payroll_rank": rank,
                    "payroll_percentile": f"{percentile:.3f}",
                    "payroll_millions": f"{payroll / 1_000_000:.3f}",
                    "cost_per_win_to_date": f"{payroll / wins_to_date:.2f}" if wins_to_date else "",
                    "attendance": attendance,
                    "day_night": day_night.title() if day_night else "",
                    "time_of_game_minutes": time_of_game,
                    "hits": to_int(row["b_h"]),
                    "home_runs": to_int(row["b_hr"]),
                    "walks": to_int(row["b_w"]),
                    "strikeouts": to_int(row["b_k"]),
                    "errors": to_int(row["d_e"]),
                }
            )

    return rows, unmatched


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    payrolls, ranks_by_year, leagues = load_payrolls()
    team_names = load_team_names()

    all_rows = []
    unmatched = Counter()
    for year in range(START_YEAR, END_YEAR + 1):
        rows, missing = process_year(year, payrolls, ranks_by_year, leagues, team_names)
        all_rows.extend(rows)
        unmatched.update(missing)
        print(f"{year}: {len(rows):,} team-game rows")

    with OUT_FILE.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"Wrote {len(all_rows):,} rows to {OUT_FILE}")
    if unmatched:
        print("Skipped unmatched payroll team codes:")
        for (year, team), count in unmatched.most_common(20):
            print(f"  {year} {team}: {count}")


if __name__ == "__main__":
    main()
