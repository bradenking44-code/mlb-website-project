#!/usr/bin/env python3
"""Create reproducible summary data for the MLB report page."""

from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "data" / "processed" / "mlb_batting_player_seasons.csv"
OUT_FILE = ROOT / "data" / "processed" / "report_summary.json"


def to_int(value: str) -> int:
    return int(value) if value else 0


def to_float(value: str) -> float:
    return float(value) if value else 0.0


def rate(numerator: float, denominator: float) -> float:
    return round(numerator / denominator, 3) if denominator else 0.0


def top_items(counter: Counter, limit: int = 10) -> list[dict[str, int]]:
    return [{"label": label, "value": value} for label, value in counter.most_common(limit)]


def main() -> None:
    rows = []
    with DATA_FILE.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            rows.append(row)

    year_totals = defaultdict(lambda: Counter())
    league_totals = defaultdict(lambda: Counter())
    team_totals = defaultdict(lambda: Counter())
    country_totals = Counter()
    handedness_totals = Counter()
    player_totals = defaultdict(lambda: Counter())
    qualified_ops = []
    qualified_hr = []
    age_pa = defaultdict(Counter)

    for row in rows:
        year = row["year"]
        league = row["league"]
        team = row["team_name"]
        player = row["player_name"]
        country = row["birth_country"] or "Unknown"
        bats = row["bats"] or "Unknown"
        age = row["age"]

        metrics = {
            "games": to_int(row["games"]),
            "plate_appearances": to_int(row["plate_appearances"]),
            "at_bats": to_int(row["at_bats"]),
            "runs": to_int(row["runs"]),
            "hits": to_int(row["hits"]),
            "home_runs": to_int(row["home_runs"]),
            "rbi": to_int(row["rbi"]),
            "walks": to_int(row["walks"]),
            "strikeouts": to_int(row["strikeouts"]),
            "total_bases": to_int(row["total_bases"]),
        }

        for key, value in metrics.items():
            year_totals[year][key] += value
            league_totals[league][key] += value
            team_totals[team][key] += value
            player_totals[player][key] += value
            if age:
                age_pa[int(age)][key] += value

        country_totals[country] += metrics["plate_appearances"]
        handedness_totals[bats] += metrics["plate_appearances"]

        if metrics["plate_appearances"] >= 502:
            qualified_ops.append(
                {
                    "label": f"{player}, {year}",
                    "value": round(to_float(row["ops"]), 3),
                }
            )
            qualified_hr.append(
                {
                    "label": f"{player}, {year}",
                    "value": metrics["home_runs"],
                }
            )

    by_year = [
        {
            "label": year,
            "home_runs": year_totals[year]["home_runs"],
            "strikeouts": year_totals[year]["strikeouts"],
            "walks": year_totals[year]["walks"],
            "ops": rate(
                year_totals[year]["hits"]
                + year_totals[year]["walks"],
                year_totals[year]["at_bats"] + year_totals[year]["walks"],
            )
            + rate(year_totals[year]["total_bases"], year_totals[year]["at_bats"]),
        }
        for year in sorted(year_totals, key=int)
    ]

    decade_totals = defaultdict(Counter)
    for year, counts in year_totals.items():
        decade = f"{int(year) // 10 * 10}s"
        decade_totals[decade].update(counts)

    sections = [
        {
            "id": "home-run-growth",
            "title": "Home runs became a defining modern-era signal",
            "body": "The long-run batting record shows home run totals moving from a small part of offense in the early 1900s to one of the most visible measures of power. The chart tracks leaguewide home runs by season.",
            "measure": "home_runs",
            "chart": [{"label": item["label"], "value": item["home_runs"]} for item in by_year],
        },
        {
            "id": "strikeout-growth",
            "title": "Strikeouts rose even faster than walks",
            "body": "Strikeouts climbed sharply across the modern game. This gives the report a clear offensive tradeoff to explore: more power and patience, but also more empty at-bats.",
            "measure": "strikeouts",
            "chart": [{"label": item["label"], "value": item["strikeouts"]} for item in by_year],
        },
        {
            "id": "team-power",
            "title": "A small group of franchises owns a large share of recorded home runs",
            "body": "Team totals show the cumulative effect of long histories, ballparks, roster construction, and eras. This chart ranks teams by total home runs in the dataset.",
            "measure": "home_runs",
            "chart": top_items(Counter({team: c["home_runs"] for team, c in team_totals.items()})),
        },
        {
            "id": "player-power",
            "title": "Career home run leaders dominate the player rankings",
            "body": "Player-level totals identify the names that repeatedly shape baseball power discussions. These values aggregate each player's recorded team-season stints.",
            "measure": "home_runs",
            "chart": top_items(Counter({player: c["home_runs"] for player, c in player_totals.items()})),
        },
        {
            "id": "single-season-power",
            "title": "The largest single-season home run totals are extreme outliers",
            "body": "Qualified player seasons make the outlier seasons easy to see. The top values stand far above a typical full-time hitter season.",
            "measure": "home_runs",
            "chart": sorted(qualified_hr, key=lambda item: item["value"], reverse=True)[:10],
        },
        {
            "id": "single-season-ops",
            "title": "Elite OPS seasons combine reaching base and power",
            "body": "OPS combines on-base percentage and slugging percentage. The highest qualified seasons are useful for comparing different offensive eras.",
            "measure": "ops",
            "chart": sorted(qualified_ops, key=lambda item: item["value"], reverse=True)[:10],
        },
        {
            "id": "countries",
            "title": "Most plate appearances come from U.S.-born players, with a broad international base",
            "body": "Birth country is a useful categorical filter for the dashboard because it shows the international expansion of the player pool while keeping the main unit of analysis at the player-season level.",
            "measure": "plate_appearances",
            "chart": top_items(country_totals),
        },
        {
            "id": "age-curve",
            "title": "Playing time clusters around a player's mid-to-late twenties",
            "body": "Aggregating plate appearances by age shows where MLB batting opportunity concentrates. This helps connect player development and roster decisions to the offensive record.",
            "measure": "plate_appearances",
            "chart": [
                {"label": str(age), "value": counts["plate_appearances"]}
                for age, counts in sorted(age_pa.items())
                if 18 <= age <= 45
            ],
        },
    ]

    headlines = [
        {"label": "Rows", "value": len(rows)},
        {"label": "Seasons", "value": len(year_totals)},
        {"label": "Players", "value": len(player_totals)},
        {"label": "Teams", "value": len(team_totals)},
        {"label": "Total home runs", "value": sum(c["home_runs"] for c in year_totals.values())},
        {"label": "Total plate appearances", "value": sum(c["plate_appearances"] for c in year_totals.values())},
    ]

    payload = {
        "headlines": headlines,
        "leagueTotals": top_items(Counter({lg: c["plate_appearances"] for lg, c in league_totals.items()}), 5),
        "handednessTotals": top_items(handedness_totals, 5),
        "sections": sections,
    }

    OUT_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {OUT_FILE}")


if __name__ == "__main__":
    main()
