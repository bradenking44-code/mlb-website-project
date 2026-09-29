#!/usr/bin/env python3
"""Build compact dashboard data so browser charts render quickly and reliably."""

from __future__ import annotations

import csv
import json
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "data" / "processed" / "mlb_team_payroll_game_results.csv"
OUT_FILE = ROOT / "data" / "processed" / "payroll_dashboard_data.json"


def to_int(value: str) -> int:
    return int(value) if value else 0


def to_float(value: str) -> float:
    return float(value) if value else 0.0


def main() -> None:
    games = []
    team_season = defaultdict(lambda: {
        "games": 0,
        "wins": 0,
        "losses": 0,
        "runs": 0,
        "run_differential": 0,
        "attendance": 0,
        "payroll_millions": 0.0,
        "payroll_percentile": 0.0,
        "league": "",
        "team_name": "",
        "team_id": "",
        "year": 0,
    })

    with DATA_FILE.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            game = {
                "date": row["date"],
                "year": to_int(row["year"]),
                "team_id": row["team_id"],
                "team_name": row["team_name"],
                "opponent_id": row["opponent_id"],
                "league": row["league"],
                "home_away": row["home_away"],
                "day_night": row["day_night"],
                "payroll_tier": "Top third"
                if to_float(row["payroll_percentile"]) >= 0.667
                else "Middle third"
                if to_float(row["payroll_percentile"]) >= 0.334
                else "Bottom third",
                "payroll_millions": to_float(row["payroll_millions"]),
                "payroll_rank": to_int(row["payroll_rank"]),
                "payroll_percentile": to_float(row["payroll_percentile"]),
                "team_runs": to_int(row["team_runs"]),
                "opponent_runs": to_int(row["opponent_runs"]),
                "run_differential": to_int(row["run_differential"]),
                "win": to_int(row["win"]),
                "loss": to_int(row["loss"]),
                "attendance": to_int(row["attendance"]),
                "winning_percentage_after_game": to_float(row["winning_percentage_after_game"]),
            }
            games.append(game)

            key = (game["year"], game["team_id"])
            item = team_season[key]
            item["games"] += 1
            item["wins"] += game["win"]
            item["losses"] += game["loss"]
            item["runs"] += game["team_runs"]
            item["run_differential"] += game["run_differential"]
            item["attendance"] += game["attendance"]
            item["payroll_millions"] = game["payroll_millions"]
            item["payroll_percentile"] = game["payroll_percentile"]
            item["league"] = game["league"]
            item["team_name"] = game["team_name"]
            item["team_id"] = game["team_id"]
            item["year"] = game["year"]
            item["payroll_tier"] = game["payroll_tier"]

    team_seasons = []
    for item in team_season.values():
        item["win_rate"] = round(item["wins"] / max(1, item["wins"] + item["losses"]), 3)
        item["cost_per_win"] = round(item["payroll_millions"] / max(1, item["wins"]), 3)
        team_seasons.append(item)

    payload = {
        "metadata": {
            "source_game_rows": len(games),
            "team_season_rows": len(team_seasons),
            "start_year": min(item["year"] for item in team_seasons),
            "end_year": max(item["year"] for item in team_seasons),
        },
        "teamSeasons": sorted(team_seasons, key=lambda item: (item["year"], item["team_name"])),
    }
    OUT_FILE.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {len(team_seasons):,} team seasons and {len(games):,} games to {OUT_FILE}")


if __name__ == "__main__":
    main()
