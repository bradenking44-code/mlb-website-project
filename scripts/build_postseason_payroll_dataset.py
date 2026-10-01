#!/usr/bin/env python3
"""Build roster-season and dashboard data for MLB payroll/postseason analysis."""

from __future__ import annotations

import csv
import json
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"

TEAMS = RAW / "Teams2025.csv"
SERIES = RAW / "SeriesPost2025.csv"
APPEARANCES = RAW / "Appearances2025.csv"
PEOPLE = RAW / "People2025.csv"
SALARIES = RAW / "Salaries2025.csv"
if not SALARIES.exists():
    SALARIES = RAW / "Salaries.csv"
EXTERNAL_PAYROLLS = RAW / "ExternalPayrolls.csv"
COTS_PAYROLL_2026 = RAW / "CotsPayroll2026.csv"

FULL_CSV = OUT / "mlb_payroll_postseason_roster.csv"
DASHBOARD_JSON = OUT / "postseason_dashboard_data.json"

START_YEAR = 1985
LATEST_YEAR = 2025
LOGO_VERSION = "500"

ESPN_LOGOS = {
    "ARI": "ari",
    "ANA": "laa",
    "ATH": "oak",
    "ATL": "atl",
    "BAL": "bal",
    "BOS": "bos",
    "CAL": "laa",
    "CHA": "chw",
    "CHN": "chc",
    "CIN": "cin",
    "CLE": "cle",
    "COL": "col",
    "DET": "det",
    "HOU": "hou",
    "KCA": "kc",
    "LAA": "laa",
    "LAN": "lad",
    "MIA": "mia",
    "FLO": "mia",
    "MIL": "mil",
    "ML4": "mil",
    "MIN": "min",
    "NYA": "nyy",
    "NYN": "nym",
    "OAK": "oak",
    "PHI": "phi",
    "PIT": "pit",
    "SDN": "sd",
    "SEA": "sea",
    "SFN": "sf",
    "SLN": "stl",
    "TBA": "tb",
    "TEX": "tex",
    "TOR": "tor",
    "WAS": "wsh",
    "MON": "wsh",
}


def read_csv(path: Path):
    with path.open(newline="", encoding="utf-8-sig") as handle:
        yield from csv.DictReader(handle)


def safe_int(value, default=0):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def safe_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def clean_money(value):
    return safe_int(str(value or "").replace("$", "").replace(",", "").strip())


def normalize_name(value):
    return " ".join(str(value or "").lower().replace("&", "and").split())


def yn(value):
    return str(value).upper() == "Y"


def payroll_tier(rank, count):
    if not rank or not count:
        return "Payroll unavailable"
    top_cut = count / 3
    bottom_cut = (count * 2) / 3
    if rank <= top_cut:
        return "Top third"
    if rank <= bottom_cut:
        return "Middle third"
    return "Bottom third"


def logo_url(team_id):
    code = ESPN_LOGOS.get(team_id)
    if not code:
        return ""
    return f"https://a.espncdn.com/i/teamlogos/mlb/{LOGO_VERSION}/{code}.png"


def load_cots_payroll_snapshot():
    if not COTS_PAYROLL_2026.exists():
        return None

    teams = []
    for row in read_csv(COTS_PAYROLL_2026):
        team_id = row.get("team_id", "").strip()
        payroll = safe_int(row.get("payroll"))
        if not team_id or not payroll:
            continue
        teams.append({
            "team_id": team_id,
            "team_name": row.get("team_name", "").strip(),
            "cots_abbreviation": row.get("cots_abbreviation", "").strip(),
            "payroll_millions": round(payroll / 1_000_000, 1),
            "cbt_payroll_millions": round(safe_int(row.get("cbt_payroll")) / 1_000_000, 1),
            "cots_sheet_as_of": row.get("cots_sheet_as_of", "").strip(),
            "logo_url": logo_url(team_id),
        })

    if not teams:
        return None

    return {
        "year": 2026,
        "earliest_sheet_as_of": min(row["cots_sheet_as_of"] for row in teams),
        "latest_sheet_as_of": max(row["cots_sheet_as_of"] for row in teams),
        "value_precision": "$0.1 million",
        "source_url": "https://legacy.baseballprospectus.com/compensation/cots/",
        "reference_url": "https://www.feverbaseball.com/business/payroll",
        "teams": sorted(teams, key=lambda row: (-row["payroll_millions"], row["team_name"])),
    }


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    people = {}
    for row in read_csv(PEOPLE):
        first = row.get("nameFirst", "").strip()
        last = row.get("nameLast", "").strip()
        people[row["playerID"]] = " ".join(part for part in [first, last] if part).strip() or row["playerID"]

    payrolls = defaultdict(int)
    payroll_player_counts = defaultdict(int)
    salary_years = []
    for row in read_csv(SALARIES):
        year = safe_int(row.get("yearID"))
        if START_YEAR <= year <= LATEST_YEAR:
            key = (year, row.get("teamID", ""))
            payrolls[key] += safe_int(row.get("salary"))
            payroll_player_counts[key] += 1
            salary_years.append(year)

    team_seasons = {}
    for row in read_csv(TEAMS):
        year = safe_int(row.get("yearID"))
        if year < START_YEAR or year > LATEST_YEAR or row.get("lgID") not in {"AL", "NL"}:
            continue
        team_id = row.get("teamID", "")
        wins = safe_int(row.get("W"))
        losses = safe_int(row.get("L"))
        games = safe_int(row.get("G"), wins + losses)
        team_seasons[(year, team_id)] = {
            "year": year,
            "team_id": team_id,
            "team_name": row.get("name", team_id),
            "league": row.get("lgID", ""),
            "division": row.get("divID", "") or "None",
            "wins": wins,
            "losses": losses,
            "games": games,
            "win_pct": round(wins / max(1, wins + losses), 3),
            "runs": safe_int(row.get("R")),
            "runs_allowed": safe_int(row.get("RA")),
            "run_diff": safe_int(row.get("R")) - safe_int(row.get("RA")),
            "attendance": safe_int(row.get("attendance")),
            "division_winner": yn(row.get("DivWin")),
            "wild_card_winner": yn(row.get("WCWin")),
            "league_champion": yn(row.get("LgWin")),
            "world_series_winner": yn(row.get("WSWin")),
            "payroll": payrolls.get((year, team_id), 0),
            "salary_players": payroll_player_counts.get((year, team_id), 0),
            "logo_url": logo_url(team_id),
        }

    external_payroll_years = []
    if EXTERNAL_PAYROLLS.exists():
        name_index = {
            (season["year"], normalize_name(season["team_name"])): key
            for key, season in team_seasons.items()
        }
        for row in read_csv(EXTERNAL_PAYROLLS):
            year = safe_int(row.get("year") or row.get("yearID"))
            team_id = (row.get("team_id") or row.get("teamID") or "").strip()
            team_name = row.get("team") or row.get("team_name") or row.get("name") or ""
            payroll = clean_money(row.get("payroll") or row.get("team payroll") or row.get("team_payroll"))
            key = (year, team_id) if team_id else name_index.get((year, normalize_name(team_name)))
            if key in team_seasons and payroll:
                team_seasons[key]["payroll"] = payroll
                team_seasons[key]["salary_players"] = safe_int(row.get("player_count") or row.get("roster"), 0)
                payrolls[key] = payroll
                external_payroll_years.append(year)
                salary_years.append(year)

    ranks_by_year = defaultdict(list)
    for key, row in team_seasons.items():
        if row["payroll"]:
            ranks_by_year[row["year"]].append((row["payroll"], key))
    for year, entries in ranks_by_year.items():
        entries.sort(reverse=True)
        count = len(entries)
        for index, (_, key) in enumerate(entries, start=1):
            row = team_seasons[key]
            row["payroll_rank"] = index
            row["payroll_percentile"] = round(1 - ((index - 1) / max(1, count - 1)), 3)
            row["payroll_tier"] = payroll_tier(index, count)

    for row in team_seasons.values():
        row.setdefault("payroll_rank", None)
        row.setdefault("payroll_percentile", None)
        row.setdefault("payroll_tier", "Payroll unavailable")
        row["payroll_millions"] = round(row["payroll"] / 1_000_000, 2) if row["payroll"] else None
        row["cost_per_win_millions"] = round(row["payroll"] / max(1, row["wins"]) / 1_000_000, 2) if row["payroll"] else None
        row["playoff_team"] = bool(row["division_winner"] or row["wild_card_winner"] or row["league_champion"] or row["world_series_winner"])
        row["postseason_rounds"] = []

    ws_by_year = {}
    for row in read_csv(SERIES):
        year = safe_int(row.get("yearID"))
        if year < START_YEAR or year > LATEST_YEAR:
            continue
        winner = (year, row.get("teamIDwinner", ""))
        loser = (year, row.get("teamIDloser", ""))
        round_name = row.get("round", "")
        if winner in team_seasons:
            team_seasons[winner]["playoff_team"] = True
            team_seasons[winner]["postseason_rounds"].append(round_name)
        if loser in team_seasons:
            team_seasons[loser]["playoff_team"] = True
            team_seasons[loser]["postseason_rounds"].append(round_name)
        if round_name == "WS":
            ws_by_year[year] = {"winner": row.get("teamIDwinner", ""), "loser": row.get("teamIDloser", "")}

    for (year, team_id), row in team_seasons.items():
        if row["world_series_winner"]:
            result = "Won World Series"
        elif row["league_champion"]:
            result = "Lost World Series"
        elif row["playoff_team"]:
            rounds = set(row["postseason_rounds"])
            if "LCS" in rounds or "CS" in rounds:
                result = "Reached LCS"
            elif "LDS" in rounds or "DS" in rounds:
                result = "Reached Division Series"
            elif "WC" in rounds or "WC1" in rounds or "WC2" in rounds:
                result = "Reached Wild Card"
            else:
                result = "Playoff team"
        else:
            result = "Missed playoffs"
        row["postseason_result"] = result
        row["ws_opponent_id"] = ""
        if year in ws_by_year:
            if ws_by_year[year]["winner"] == team_id:
                row["ws_opponent_id"] = ws_by_year[year]["loser"]
            elif ws_by_year[year]["loser"] == team_id:
                row["ws_opponent_id"] = ws_by_year[year]["winner"]

    rosters = defaultdict(list)
    full_rows = []
    for row in read_csv(APPEARANCES):
        year = safe_int(row.get("yearID"))
        team_id = row.get("teamID", "")
        key = (year, team_id)
        if key not in team_seasons:
            continue
        player_id = row.get("playerID", "")
        player = {
            "player_id": player_id,
            "player_name": people.get(player_id, player_id),
            "games": safe_int(row.get("G_all")),
            "starts": safe_int(row.get("GS")),
            "games_p": safe_int(row.get("G_p")),
            "games_c": safe_int(row.get("G_c")),
            "games_infield": sum(safe_int(row.get(pos)) for pos in ["G_1b", "G_2b", "G_3b", "G_ss"]),
            "games_outfield": safe_int(row.get("G_of")),
            "games_dh": safe_int(row.get("G_dh")),
        }
        rosters[key].append(player)

    for key, players in rosters.items():
        players.sort(key=lambda item: (-item["games"], item["player_name"]))
        if key in team_seasons:
            team_seasons[key]["roster_count"] = len(players)

    for key, season in sorted(team_seasons.items()):
        for player in rosters.get(key, []):
            full_rows.append({
                **{k: season[k] for k in [
                    "year", "team_id", "team_name", "league", "division", "wins", "losses", "games", "win_pct",
                    "runs", "runs_allowed", "run_diff", "attendance", "payroll", "payroll_millions",
                    "payroll_rank", "payroll_percentile", "payroll_tier", "cost_per_win_millions",
                    "playoff_team", "postseason_result", "world_series_winner", "league_champion",
                    "division_winner", "wild_card_winner", "roster_count"
                ]},
                **player,
            })

    fieldnames = list(full_rows[0].keys())
    with FULL_CSV.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(full_rows)

    team_rows = []
    for key, row in sorted(team_seasons.items()):
        team_rows.append({**row, "postseason_rounds": sorted(set(row["postseason_rounds"]))})

    world_series = []
    for year in sorted(ws_by_year):
        winner = team_seasons.get((year, ws_by_year[year]["winner"]))
        loser = team_seasons.get((year, ws_by_year[year]["loser"]))
        if not winner:
            continue
        peers = [row for row in team_seasons.values() if row["year"] == year and row["payroll"]]
        avg_payroll = round(sum(row["payroll"] for row in peers) / max(1, len(peers)) / 1_000_000, 2) if peers else None
        world_series.append({
            "year": year,
            "winner_id": winner["team_id"],
            "winner": winner["team_name"],
            "winner_logo_url": winner["logo_url"],
            "winner_payroll_millions": winner["payroll_millions"],
            "winner_payroll_rank": winner["payroll_rank"],
            "league_avg_payroll_millions": avg_payroll,
            "loser_id": loser["team_id"] if loser else "",
            "loser": loser["team_name"] if loser else "",
            "loser_payroll_millions": loser["payroll_millions"] if loser else None,
            "record": f"{winner['wins']}-{winner['losses']}",
        })

    compact_rosters = {
        f"{year}-{team_id}": players[:45]
        for (year, team_id), players in sorted(rosters.items())
        if (year, team_id) in team_seasons and START_YEAR <= year <= LATEST_YEAR
    }

    metadata = {
        "full_roster_rows": len(full_rows),
        "team_seasons": len(team_rows),
        "start_year": START_YEAR,
        "latest_year": LATEST_YEAR,
        "payroll_start_year": min(salary_years) if salary_years else None,
        "payroll_end_year": max(salary_years) if salary_years else None,
        "external_payroll_years": sorted(set(external_payroll_years)),
        "teams": len({row["team_id"] for row in team_rows}),
        "current_payroll_snapshot_year": 2026 if COTS_PAYROLL_2026.exists() else None,
        "note": "Records, postseason results, and rosters run through 2025. Lahman salary data covers 1985-2016. The separate Cot's 2026 club payroll snapshot is available on the dashboard; it is not used in historical charts. Add verified season-matched rows to data/raw/ExternalPayrolls.csv to extend payroll-backed analysis after 2016.",
    }

    DASHBOARD_JSON.write_text(json.dumps({
        "metadata": metadata,
        "teamSeasons": team_rows,
        "worldSeries": world_series,
        "rosters": compact_rosters,
        "currentPayrollSnapshot": load_cots_payroll_snapshot(),
    }, separators=(",", ":")), encoding="utf-8")

    print(f"Wrote {FULL_CSV} ({len(full_rows):,} rows)")
    print(f"Wrote {DASHBOARD_JSON} ({len(team_rows):,} team seasons)")
    print(metadata)


if __name__ == "__main__":
    main()
