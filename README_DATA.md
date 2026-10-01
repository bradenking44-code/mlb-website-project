# MLB Payroll, Rosters, and Postseason Dataset

This folder contains a cleaned Major League Baseball panel built for the FDA Data Website Project.

## Files

- `data/raw/Teams2025.csv` - Lahman/SABR team-season records through 2025.
- `data/raw/SeriesPost2025.csv` - Lahman/SABR postseason series results through 2025.
- `data/raw/Appearances2025.csv` - Lahman/SABR player appearances by team and season through 2025.
- `data/raw/People2025.csv` - Lahman/SABR player names and biographical identifiers.
- `data/raw/Salaries2025.csv` - Lahman/SABR salary table, with salary years 1985-2016.
- `data/raw/CotsPayroll2026.csv` - current Cot's cash and competitive-balance-tax payroll snapshot for all 30 clubs; each row records the date on that club's Cot's sheet.
- `data/processed/mlb_payroll_postseason_roster.csv` - full roster-season dataset.
- `data/processed/postseason_dashboard_data.json` - compact team-season, World Series, roster, and separate current Cot's payroll snapshot data for the website.
- `data/processed/payroll_report_summary.json` - report chart summary data.
- `scripts/build_postseason_payroll_dataset.py` - rebuilds the full dataset and dashboard JSON.
- `scripts/build_payroll_report_summary.py` - rebuilds the report chart summary file.

## Sources

The raw tables come from the public Lahman/SABR CSV mirror:

```text
https://github.com/cbwinslow/lahman-database-csv
```

The 2026 payroll snapshot comes from [Cot's Baseball Contracts](https://legacy.baseballprospectus.com/compensation/cots/). The published values were read from each club's Cot's sheet; the latest sheet dates range from 2026-08-25 through 2026-09-27. The supporting [30-club payroll table](https://www.feverbaseball.com/business/payroll) identifies Cot's as its source and lists the per-club sheet dates. Payroll values are recorded in dollars rounded to the nearest $100,000, matching the source table's $0.1 million display precision.

`payroll` is Cot's cash payroll. `cbt_payroll` is competitive-balance-tax payroll, which uses a different accounting basis. The build script copies this snapshot into `currentPayrollSnapshot` in `data/processed/postseason_dashboard_data.json`, and the dashboard displays it in its own table. Historical filters and charts continue to use season-matched records and payroll values because the team, roster, and postseason sources stop at 2025 and Cot's cash/CBT figures use a different definition from the Lahman player-salary sum.

The latest source tables used here include records, appearances, people, and postseason results through 2025. The salary table in Lahman remains limited to 1985-2016, so payroll analysis uses those years and newer seasons are marked as payroll unavailable.

## Grain

One row is one player on one MLB team roster in one season from 1985 through 2025. Each row includes the player's roster appearance data plus the team's record, payroll, payroll rank, playoff outcome, World Series status, and roster size for that season.

## Assignment Fit

- Rows: 54,851
- Columns: 34
- Time column: `year`
- Group columns: `team_id`, `team_name`, `player_id`, `player_name`
- Time periods: 41 seasons
- Team groups: 36 team IDs
- Filterable categorical variables include `year`, `team_name`, `league`, `division`, `payroll_tier`, and `postseason_result`
- Numeric variables include `wins`, `losses`, `win_pct`, `payroll`, `payroll_millions`, `payroll_rank`, `payroll_percentile`, `cost_per_win_millions`, `roster_count`, `games`, and `starts`

## Derived Fields

- `payroll` = sum of listed player salaries for that team-season.
- `payroll_rank` = team payroll rank within the season, where 1 is highest payroll.
- `payroll_percentile` = within-season payroll rank converted to a 0-1 scale.
- `payroll_millions` = `payroll / 1,000,000`.
- `cost_per_win_millions` = `payroll_millions / wins`.
- `win_pct` = `wins / (wins + losses)`.
- `playoff_team` = appeared in Lahman postseason series or is marked as a division, wild card, pennant, or World Series winner.
- `postseason_result` = missed playoffs, playoff team, reached wild card/division/LCS, lost World Series, or won World Series.
