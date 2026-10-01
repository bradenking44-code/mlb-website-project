#!/usr/bin/env python3
"""Build report summary JSON from the postseason payroll dashboard data."""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "processed" / "postseason_dashboard_data.json"
OUT = ROOT / "data" / "processed" / "payroll_report_summary.json"


def avg(values):
    values = [value for value in values if value is not None]
    return round(sum(values) / max(1, len(values)), 2)


def pct(n, d):
    return round(n / max(1, d), 3)


def top(items, n=12, reverse=True):
    return sorted(items, key=lambda item: item["value"], reverse=reverse)[:n]


def main():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    rows = data["teamSeasons"]
    payroll_rows = [row for row in rows if row.get("payroll_millions")]
    ws = data["worldSeries"]
    meta = data["metadata"]

    by_year = defaultdict(list)
    by_team = defaultdict(list)
    by_tier = defaultdict(list)
    by_result = defaultdict(list)
    for row in rows:
        by_year[row["year"]].append(row)
        by_team[row["team_name"]].append(row)
        by_tier[row["payroll_tier"]].append(row)
        by_result[row["postseason_result"]].append(row)

    logo_by_team = {}
    for row in rows:
        if row.get("logo_url") and row["team_name"] not in logo_by_team:
            logo_by_team[row["team_name"]] = row["logo_url"]

    payroll_by_year = [
        {"label": str(year), "value": avg([row.get("payroll_millions") for row in group])}
        for year, group in sorted(by_year.items())
        if any(row.get("payroll_millions") for row in group)
    ]

    ws_rank = [
        {"label": str(row["year"]), "value": row["winner_payroll_rank"]}
        for row in ws
        if row.get("winner_payroll_rank")
    ]

    tier_playoff = [
        {"label": tier, "value": pct(sum(1 for row in group if row["playoff_team"]), len(group))}
        for tier, group in by_tier.items()
        if tier != "Payroll unavailable"
    ]

    team_ws = []
    for team, group in by_team.items():
        title_years = sorted(row["year"] for row in group if row["world_series_winner"] and row["year"] <= meta["payroll_end_year"])
        if not title_years:
            continue
        team_ws.append({
            "label": team,
            "value": len(title_years),
            "years": title_years,
            "logo_url": logo_by_team.get(team, ""),
        })

    team_playoff = [
        {"label": team, "value": sum(1 for row in group if row["playoff_team"]), "logo_url": logo_by_team.get(team, "")}
        for team, group in by_team.items()
    ]

    expensive_misses = [
        {"label": f"{row['year']} {row['team_name']}", "value": row["payroll_millions"]}
        for row in payroll_rows
        if row["payroll_tier"] == "Top third" and not row["playoff_team"]
    ]

    low_payroll_success = [
        {"label": f"{row['year']} {row['team_name']}", "value": row["wins"]}
        for row in payroll_rows
        if row["payroll_tier"] == "Bottom third" and row["playoff_team"]
    ]

    result_counts = [
        {"label": result, "value": len(group)}
        for result, group in by_result.items()
    ]

    roster_sizes = [
        {"label": str(year), "value": avg([row.get("roster_count") for row in group])}
        for year, group in sorted(by_year.items())
    ]

    recent_ws = [row for row in ws if row["year"] >= 2017]
    payroll_ws = [row for row in ws if row.get("winner_payroll_rank")]
    top_third_ws = sum(1 for row in payroll_ws if row["winner_payroll_rank"] <= 10)

    summary = {
        "headlines": [
            {"label": "Roster-season rows", "value": meta["full_roster_rows"]},
            {"label": "Team seasons", "value": meta["team_seasons"]},
            {"label": "Seasons covered", "value": meta["latest_year"] - meta["start_year"] + 1},
            {"label": "World Series champions tracked", "value": len(ws)},
            {"label": "Payroll seasons", "value": meta["payroll_end_year"] - meta["payroll_start_year"] + 1},
            {"label": "Teams/franchises in data", "value": meta["teams"]},
        ],
        "sections": [
            {
                "id": "payroll-growth",
                "title": "Payroll rose sharply during the salary-data era",
                "body": "Average team payroll increased heavily from 1985 to 2016, so the cleanest comparisons use payroll rank or tier inside each season.",
                "measure": "Average payroll, $M",
                "chart": payroll_by_year,
            },
            {
                "id": "champion-rank",
                "title": "World Series winners did not always have the highest payroll",
                "body": f"Among champions with salary coverage, {top_third_ws} of {len(payroll_ws)} came from the top third of payrolls. Money helped, but it did not guarantee a parade.",
                "measure": "Payroll rank",
                "chart": ws_rank,
            },
            {
                "id": "tier-playoff-rate",
                "title": "Top payroll teams reached October more often",
                "body": "Payroll tier has a visible relationship with playoff odds, especially when comparing the top third of spending to the bottom third.",
                "measure": "Playoff rate",
                "chart": sorted(tier_playoff, key=lambda item: item["label"]),
            },
            {
                "id": "world-series-teams",
                "title": "A few clubs collected most payroll-era titles",
                "body": "From 1985 through 2016, World Series wins clustered around a smaller group of organizations, which lets the dashboard compare sustained spending to sustained October success.",
                "measure": "World Series wins",
                "chart": top(team_ws),
            },
            {
                "id": "playoff-volume",
                "title": "Playoff appearances show consistency better than championships",
                "body": "Because a short postseason series can swing on a few games, playoff appearances are a more stable signal than World Series wins alone.",
                "measure": "Playoff appearances",
                "chart": top(team_playoff),
            },
            {
                "id": "expensive-misses",
                "title": "High payroll misses are the clearest counterexamples",
                "body": "Several top-third payroll teams still missed the playoffs, which shows why payroll should be treated as a predictor, not a certainty.",
                "measure": "Payroll, $M",
                "chart": top(expensive_misses),
            },
            {
                "id": "low-payroll-success",
                "title": "Low-payroll playoff teams prove efficiency mattered",
                "body": "Bottom-third payroll teams still reached October when player development, roster construction, and timing beat spending power.",
                "measure": "Wins",
                "chart": top(low_payroll_success),
            },
            {
                "id": "postseason-results",
                "title": "The dataset separates regular-season records from postseason outcomes",
                "body": "Each team-season is labeled as missed playoffs, playoff team, pennant winner, or World Series champion so filters can test different definitions of success.",
                "measure": "Team seasons",
                "chart": top(result_counts, n=8),
            },
            {
                "id": "roster-size",
                "title": "Roster records provide the player-level panel required for the project",
                "body": "The full dataset includes every player-team-season appearance, letting the site display rosters while keeping the analysis connected to team records and payroll.",
                "measure": "Average roster size",
                "chart": roster_sizes,
            },
        ],
    }
    OUT.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
