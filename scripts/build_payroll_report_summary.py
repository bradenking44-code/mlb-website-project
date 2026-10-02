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
    team_by_season = {(row["year"], row["team_id"]): row for row in rows}
    payroll_ws = [
        item for item in ws
        if item.get("winner_payroll_rank") and (item["year"], item["winner_id"]) in team_by_season
    ]
    top_third_ws = sum(
        1 for item in payroll_ws
        if team_by_season[(item["year"], item["winner_id"])].get("payroll_tier") == "Top third"
    )

    top_payroll_start, top_payroll_latest = payroll_by_year[0], payroll_by_year[-1]
    tier_rates = {item["label"]: item["value"] for item in tier_playoff}
    ws_leaders = sorted(team_ws, key=lambda item: item["value"], reverse=True)
    playoff_leaders = sorted(team_playoff, key=lambda item: item["value"], reverse=True)
    highest_payroll_miss = top(expensive_misses, n=1)[0]
    best_low_payroll_success = top(low_payroll_success, n=1)[0]
    top_spender_averages = {
        label: avg(top_spender_wins.get(label, []))
        for label in ["Missed playoffs", "Playoff exit", "Lost WS", "Won WS"]
    }
    roster_first, roster_latest = roster_sizes[0], roster_sizes[-1]

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
                "body": f"Average team payroll rose from ${top_payroll_start['value']:.2f} million in {top_payroll_start['label']} to ${top_payroll_latest['value']:.2f} million in {top_payroll_latest['label']}, in source-year dollars. Lahman/SABR listed salary totals supply 1985-2016; The Baseball Cube Opening Day payrolls supply 2017-2026, so payroll definitions change in 2017 and within-season ranks and tiers are the strongest comparisons across that break.",
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
                "body": f"{tier_rates['Top third']:.1%} of top-third payroll teams reached the postseason, compared with {tier_rates['Bottom third']:.1%} of bottom-third teams. These pooled team-season rates describe an association; they do not show that payroll caused the results.",
                "measure": "Playoff rate",
                "chart": sorted(tier_playoff, key=lambda item: item["label"]),
            },
            {
                "id": "world-series-teams",
                "title": "A few clubs collected most payroll-era titles",
                "body": f"From 1985 through {meta['payroll_end_year']}, the Yankees led with {ws_leaders[0]['value']} titles; the next-highest total was {ws_leaders[1]['value']} each for {ws_leaders[1]['label']} and {ws_leaders[2]['label']}. The chart shows the teams with the most titles in the period.",
                "measure": "World Series wins",
                "chart": top(team_ws),
            },
            {
                "id": "playoff-volume",
                "title": "Playoff appearances show consistency better than championships",
                "body": f"The Yankees made the postseason {playoff_leaders[0]['value']} times from 1985 through {meta['latest_year']}, the highest total in the chart. Because a short series can swing on a few games, playoff appearances show season-to-season consistency better than titles alone.",
                "measure": "Playoff appearances",
                "chart": top(team_playoff),
            },
            {
                "id": "expensive-misses",
                "title": "High payroll misses are the clearest counterexamples",
                "body": f"The chart lists the six highest-payroll teams that missed the postseason. The largest was the {highest_payroll_miss['label']} at ${highest_payroll_miss['value']:.2f} million, illustrating why payroll is not a guarantee of success.",
                "measure": "Payroll, $M",
                "chart": top(expensive_misses, n=6),
            },
            {
                "id": "low-payroll-success",
                "title": "Bottom-third payroll teams still reached the postseason",
                "body": f"The chart highlights six bottom-third teams that reached the postseason. The highest win total among them was {best_low_payroll_success['value']} wins by the {best_low_payroll_success['label']}, showing that lower payroll did not prevent a strong season.",
                "measure": "Wins",
                "chart": top(low_payroll_success, n=6),
            },
            {
                "id": "top-spender-results",
                "title": "Even elite regular seasons did not guarantee top-spender titles",
                "body": f"This chart compares mean regular-season wins for each season's highest-payroll team by postseason result. Top spenders averaged {top_spender_averages['Missed playoffs']:.1f} wins when they missed the postseason and {top_spender_averages['Won WS']:.1f} wins when they won the World Series; a strong regular season still did not assure a title.",
                "measure": "Average wins by top spender result",
                "chart": [
                    {"label": label, "value": top_spender_averages[label]}
                    for label in ["Missed playoffs", "Playoff exit", "Lost WS", "Won WS"]
                ],
            },
            {
                "id": "roster-size",
                "title": f"Average roster size rose from {roster_first['value']:.1f} to {roster_latest['value']:.1f} players",
                "body": f"The chart averages team roster sizes by season. The mean was {roster_first['value']:.1f} players per team in {roster_first['label']} and {roster_latest['value']:.1f} in {roster_latest['label']}. The underlying panel retains individual player-team-season appearances so rosters can be inspected.",
                "measure": "Average roster size",
                "chart": roster_sizes,
            },
        ],
    }
    OUT.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
