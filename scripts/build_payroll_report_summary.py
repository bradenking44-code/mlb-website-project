#!/usr/bin/env python3
"""Create report summary data for the payroll vs wins project."""

from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "data" / "processed" / "mlb_team_payroll_game_results.csv"
OUT_FILE = ROOT / "data" / "processed" / "payroll_report_summary.json"


def to_int(value: str) -> int:
    return int(value) if value else 0


def to_float(value: str) -> float:
    return float(value) if value else 0.0


def top(items, limit=10):
    return sorted(items, key=lambda item: item["value"], reverse=True)[:limit]


def main() -> None:
    rows = []
    with DATA_FILE.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            rows.append(row)

    seasons = defaultdict(lambda: Counter())
    team_seasons = defaultdict(Counter)
    payroll_by_year = defaultdict(list)
    league_games = Counter()
    home_away = defaultdict(lambda: Counter())

    for row in rows:
        key = (row["year"], row["team_id"])
        team_seasons[key]["wins"] += to_int(row["win"])
        team_seasons[key]["losses"] += to_int(row["loss"])
        team_seasons[key]["runs"] += to_int(row["team_runs"])
        team_seasons[key]["runs_allowed"] += to_int(row["opponent_runs"])
        team_seasons[key]["run_differential"] += to_int(row["run_differential"])
        team_seasons[key]["payroll"] = to_int(row["season_payroll"])
        team_seasons[key]["team_name"] = row["team_name"]
        team_seasons[key]["league"] = row["league"]

        seasons[row["year"]]["games"] += 1
        seasons[row["year"]]["payroll"] += to_int(row["season_payroll"])
        seasons[row["year"]]["wins"] += to_int(row["win"])
        seasons[row["year"]]["run_differential"] += to_int(row["run_differential"])
        league_games[row["league"]] += 1
        home_away[row["home_away"]]["wins"] += to_int(row["win"])
        home_away[row["home_away"]]["games"] += 1

    for (year, _team), values in team_seasons.items():
        games = values["wins"] + values["losses"]
        values["win_pct"] = values["wins"] / games if games else 0
        values["cost_per_win"] = values["payroll"] / values["wins"] if values["wins"] else 0
        payroll_by_year[year].append(values["payroll"])

    for (year, team), values in team_seasons.items():
        ordered = sorted(payroll_by_year[year])
        payroll = values["payroll"]
        values["payroll_percentile"] = ordered.index(payroll) / (len(ordered) - 1) if len(ordered) > 1 else 0
        values["label"] = f"{values['team_name']} {year}"

    ts_values = list(team_seasons.values())
    efficient = [v for v in ts_values if v["wins"] >= 85]
    inefficient = [v for v in ts_values if v["payroll"] > 0]

    payroll_quartiles = defaultdict(lambda: Counter())
    for values in ts_values:
      quartile = min(4, int(values["payroll_percentile"] * 4) + 1)
      payroll_quartiles[f"Q{quartile}"]["wins"] += values["wins"]
      payroll_quartiles[f"Q{quartile}"]["games"] += values["wins"] + values["losses"]

    sections = [
        {
            "id": "payroll-growth",
            "title": "MLB payrolls rose sharply across the salary-data era",
            "body": "Average team payroll increased from the mid-1980s through 2016. That growth makes raw payroll a useful financial measure, but comparisons are clearest within the same season because leaguewide spending changed over time.",
            "measure": "average payroll",
            "chart": [
                {"label": year, "value": round(seasons[year]["payroll"] / max(1, seasons[year]["games"]) / 1_000_000, 2)}
                for year in sorted(seasons, key=int)
            ],
        },
        {
            "id": "high-payroll-teams",
            "title": "The largest payroll seasons were concentrated among a few big-market teams",
            "body": "The highest payroll seasons show how much some clubs outspent the league in specific years. This creates a natural question for the dashboard: did that spending convert into wins?",
            "measure": "payroll millions",
            "chart": top([{"label": v["label"], "value": round(v["payroll"] / 1_000_000, 2)} for v in ts_values]),
        },
        {
            "id": "payroll-quartiles",
            "title": "Higher-payroll quartiles won more often, but not automatically",
            "body": "Grouping team seasons by payroll percentile shows the broad relationship between spending and winning. The pattern is positive, but the gap is not large enough to make payroll destiny.",
            "measure": "winning percentage",
            "chart": [
                {"label": q, "value": round(v["wins"] / v["games"], 3)}
                for q, v in sorted(payroll_quartiles.items())
                if v["games"]
            ],
        },
        {
            "id": "best-records",
            "title": "The best records were not always the most expensive rosters",
            "body": "Top win-percentage seasons include both high-spending clubs and teams that converted less expensive rosters into excellent records.",
            "measure": "winning percentage",
            "chart": top([{"label": v["label"], "value": round(v["win_pct"], 3)} for v in ts_values]),
        },
        {
            "id": "efficient-winners",
            "title": "Some winners delivered strong records at a lower cost per win",
            "body": "Cost per win highlights efficient winning. Restricting to teams with at least 85 wins keeps the chart focused on clubs that were both successful and financially efficient.",
            "measure": "cost per win millions",
            "chart": sorted(
                [{"label": v["label"], "value": round(v["cost_per_win"] / 1_000_000, 2)} for v in efficient],
                key=lambda item: item["value"],
            )[:10],
        },
        {
            "id": "expensive-losses",
            "title": "Some expensive rosters still finished near or below .500",
            "body": "Large payrolls reduce some constraints, but they do not remove injuries, roster imbalance, underperformance, or tough divisions.",
            "measure": "payroll millions",
            "chart": top(
                [
                    {"label": v["label"], "value": round(v["payroll"] / 1_000_000, 2)}
                    for v in inefficient
                    if v["win_pct"] <= 0.5
                ]
            ),
        },
        {
            "id": "run-differential",
            "title": "Run differential separates sustainable success from lucky records",
            "body": "Payroll can be compared not only to wins, but also to run differential. Teams with strong run differentials usually had underlying performance to support their records.",
            "measure": "run differential",
            "chart": top([{"label": v["label"], "value": v["run_differential"]} for v in ts_values]),
        },
        {
            "id": "home-field",
            "title": "Home teams won more often across the game-level panel",
            "body": "Home and away status is a useful dashboard filter because game context matters. Payroll is a season-level input, but each row still records whether the result came at home or on the road.",
            "measure": "winning percentage",
            "chart": [
                {"label": key, "value": round(values["wins"] / values["games"], 3)}
                for key, values in sorted(home_away.items())
            ],
        },
    ]

    headlines = [
        {"label": "Team-game rows", "value": len(rows)},
        {"label": "Seasons", "value": len(seasons)},
        {"label": "Team seasons", "value": len(team_seasons)},
        {"label": "Teams", "value": len({team for _year, team in team_seasons})},
        {"label": "Total wins", "value": sum(v["wins"] for v in ts_values)},
        {"label": "Average payroll", "value": round(sum(v["payroll"] for v in ts_values) / len(ts_values) / 1_000_000, 2)},
    ]

    payload = {"headlines": headlines, "sections": sections}
    OUT_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {OUT_FILE}")


if __name__ == "__main__":
    main()
