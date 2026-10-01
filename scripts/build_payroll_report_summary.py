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
    opening_day_payrolls = data.get("openingDayPayrolls", [])
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

    payroll_means = {
        year: avg([row.get("payroll_millions") for row in group])
        for year, group in by_year.items()
        if any(row.get("payroll_millions") for row in group)
    }
    archive_by_year = defaultdict(list)
    for row in opening_day_payrolls:
        archive_by_year[row["year"]].append(row["payroll_millions"])
    for year, values in archive_by_year.items():
        payroll_means.setdefault(year, avg(values))
    payroll_by_year = [
        {"label": str(year), "value": value}
        for year, value in sorted(payroll_means.items())
    ]

    ws_rank = [
        {
            "label": f"{row['year']} {row['winner']}",
            "year": row["year"],
            "value": row["winner_payroll_rank"],
            "logo_url": row.get("winner_logo_url", ""),
        }
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
        {
            "label": f"{row['year']} {row['team_name']}",
            "value": row["payroll_millions"],
            "logo_url": row.get("logo_url", ""),
        }
        for row in payroll_rows
        if row["payroll_tier"] == "Top third" and not row["playoff_team"]
    ]

    low_payroll_success = [
        {
            "label": f"{row['year']} {row['team_name']}",
            "value": row["wins"],
            "logo_url": row.get("logo_url", ""),
        }
        for row in payroll_rows
        if row["payroll_tier"] == "Bottom third" and row["playoff_team"]
    ]

    top_spender_wins = defaultdict(list)
    for row in payroll_rows:
        if row.get("payroll_rank") != 1:
            continue
        if row["world_series_winner"]:
            result = "Won WS"
        elif row["league_champion"]:
            result = "Lost WS"
        elif row["playoff_team"]:
            result = "Playoff exit"
        else:
            result = "Missed playoffs"
        top_spender_wins[result].append(row["wins"])

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
            {"label": "Payroll archive seasons", "value": len(payroll_means)},
            {"label": "Teams/franchises in data", "value": meta["teams"]},
        ],
        "sections": [
            {
                "id": "payroll-growth",
                "title": "Payroll records now span 1985 through 2026",
                "body": "Lahman/SABR salary totals supply 1985-2016; The Baseball Cube Opening Day payrolls supply 2017-2026. The source definition changes in 2017, so within-season ranks and tiers are the strongest comparisons across that break.",
                "measure": "Average team payroll, $M",
                "chart": payroll_by_year,
            },
            {
                "id": "champion-rank",
                "title": "World Series winners did not always have the highest payroll",
                "body": f"Among World Series champions through {meta['latest_year']} with completed-season payroll coverage, {top_third_ws} of {len(payroll_ws)} came from the top third of payrolls. Payroll rank never guaranteed a title.",
                "measure": "Payroll rank",
                "chart": ws_rank,
            },
            {
                "id": "tier-playoff-rate",
                "title": "Top payroll teams reached the postseason more often",
                "body": "Payroll tier has a visible relationship with playoff odds, especially when comparing the top third of spending to the bottom third.",
                "measure": "Playoff rate",
                "chart": sorted(tier_playoff, key=lambda item: item["label"]),
            },
            {
                "id": "world-series-teams",
                "title": "A few clubs collected most payroll-era titles",
                "body": f"From 1985 through {meta['payroll_end_year']}, World Series wins clustered around a smaller group of organizations, which lets the dashboard compare sustained spending to sustained postseason success.",
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
                "chart": top(expensive_misses, n=6),
            },
            {
                "id": "low-payroll-success",
                "title": "Low-payroll playoff teams prove efficiency mattered",
                "body": "Bottom-third payroll teams still reached the postseason when player development, roster construction, and timing beat spending power.",
                "measure": "Wins",
                "chart": top(low_payroll_success, n=6),
            },
            {
                "id": "top-spender-results",
                "title": "Even elite regular seasons did not guarantee top-spender titles",
                "body": "This chart compares the average wins for each season's highest-payroll team by final postseason result. The top spender usually won plenty of regular-season games, but that success still did not reliably convert into a championship.",
                "measure": "Average wins by top spender result",
                "chart": [
                    {"label": label, "value": avg(top_spender_wins.get(label, []))}
                    for label in ["Missed playoffs", "Playoff exit", "Lost WS", "Won WS"]
                ],
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
