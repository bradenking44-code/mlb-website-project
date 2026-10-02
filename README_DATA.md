# MLB Payroll, Rosters, and Postseason Dataset

This folder contains a cleaned Major League Baseball panel built for the FDA Data Website Project.

## Files

- `data/raw/Teams2025.csv` - Lahman/SABR team-season records through 2025.
- `data/raw/SeriesPost2025.csv` - Lahman/SABR postseason series results through 2025.
- `data/raw/Appearances2025.csv` - Lahman/SABR player appearances by team and season through 2025.
- `data/raw/People2025.csv` - Lahman/SABR player names and biographical identifiers.
- `data/raw/Salaries2025.csv` - Lahman/SABR salary table, with salary years 1985-2016.
- `data/raw/ExternalPayrolls.csv` - The Baseball Cube Opening Day payrolls for all 30 clubs, 2017-2026 (300 team-season rows).
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

The 2017-2026 Opening Day team payroll archive comes from [The Baseball Cube payroll history](https://www.thebaseballcube.com/content/payroll/) and its [2026 team table](https://www.thebaseballcube.com/content/payroll_year/2026/). Each year page lists all 30 clubs. The Baseball Cube states these figures include players under contract on Opening Day and omit later callups or players added through midseason trades. Values are stored in dollars at source precision, with a year-specific source URL.

The separate 2026 payroll snapshot comes from [Cot's Baseball Contracts](https://legacy.baseballprospectus.com/compensation/cots/). Values were read from each club's Cot's sheet; dates range from 2026-08-25 through 2026-09-27. The supporting [30-club payroll table](https://www.feverbaseball.com/business/payroll) identifies Cot's as its source and lists the per-club sheet dates. Values are rounded to the nearest $100,000, matching the source table's $0.1 million display precision.

`payroll` in `CotsPayroll2026.csv` is Cot's cash payroll. `cbt_payroll` is competitive-balance-tax payroll, which uses a different accounting basis. The build script copies this snapshot into `currentPayrollSnapshot` in `data/processed/postseason_dashboard_data.json`.

`payroll` in `ExternalPayrolls.csv` is The Baseball Cube Opening Day team payroll. Rows for 2017-2025 join the completed team-season data and drive payroll ranks, tiers, charts, and roster-season rows. The 2026 rows appear in a separate year-selectable archive table because the current completed-outcomes dataset ends at 2025. Lahman salary totals and Opening Day payroll use different definitions; the website labels the 2017 source change.

The latest source tables used here include records, appearances, people, and postseason results through 2025. Payroll-backed team seasons run through 2025; the separate Opening Day payroll archive and Cot's cash/CBT snapshot both include 2026.

## Grain

One row is one player on one MLB team roster in one season from 1985 through 2025. Each row includes the player's roster appearance data plus the team's record, payroll, payroll rank, playoff outcome, World Series status, and roster size for that season.

## Included Rows and Exclusions

The raw appearances source has 128,512 rows. The panel keeps 54,851 appearances that match an AL or NL team-season between 1985 and 2025 by year and team ID. The other 73,661 appearance rows fall outside the selected season range. Every in-range appearance matches an included team-season. Team records outside the selected leagues or years are excluded, as are salary entries that do not map to an included team-season. The 2026 Opening Day payroll rows are kept in their own archive because completed team outcomes stop at 2025. Cot's cash and CBT figures are also separate because their accounting basis differs from the historical payroll series.

## Assignment Fit

- Rows: 54,851
- Columns: 37
- Time column: `year`
- Group columns: `team_id`, `team_name`, `player_id`, `player_name`
- Time periods: 41 seasons
- Team groups: 36 team IDs
- Filterable categorical variables include `year`, `team_name`, `league`, `division`, `payroll_tier`, and `postseason_result`
- Numeric variables include `wins`, `losses`, `win_pct`, `payroll`, `payroll_millions`, `payroll_rank`, `payroll_percentile`, `cost_per_win_millions`, `roster_count`, `games`, and `starts`

## Derived Fields

- `payroll` = Lahman/SABR listed-salary sum through 2016; The Baseball Cube Opening Day team payroll for 2017-2025.
- `payroll_rank` = teams ranked from highest payroll (1) to lowest within each season; equal payrolls receive a stable team-key or team-name tie-breaker.
- `payroll_percentile` = `1 - (rank - 1) / max(1, team_count - 1)`, a within-season 0-1 scale where 1 is highest payroll.
- `payroll_tier` = Top third for ranks `<= team_count / 3`, Middle third for ranks `<= 2 * team_count / 3`, and Bottom third for remaining ranked teams. Integer rank boundaries can make tier sizes differ by one; tiers are assigned within each season before pooling.
- `payroll_millions` = `payroll / 1,000,000`.
- `cost_per_win_millions` = `payroll_millions / wins`.
- `win_pct` = `wins / (wins + losses)`.
- `playoff_team` = appeared in Lahman postseason series or is marked as a division, wild card, pennant, or World Series winner.
- `postseason_result` = missed playoffs, playoff team, reached wild card/division/LCS, lost World Series, or won World Series.

## Report and Dashboard Calculations

- Average payroll by year = arithmetic mean of available team-season payrolls in that year, expressed in source-year millions. The 2026 value is the mean of the 30 Opening Day archive rows.
- Playoff rate by payroll tier and the outcome ladder = number of team-seasons reaching the named stage divided by all team-seasons in that tier.
- The champion top-third share = World Series winners whose team-season payroll tier is `Top third` divided by winners with payroll data.
- Dashboard title rate by payroll tier = filtered World Series winner team-seasons in the tier divided by all filtered team-seasons in the tier.
- Average wins by top-spender result = arithmetic mean of regular-season wins for teams ranked first in payroll, grouped by postseason result.
- Average roster size by year = arithmetic mean of team-season roster counts for that year; a roster count is the number of player appearance rows for that team-season.
- Dashboard win rate = total wins divided by total wins plus total losses among filtered team-seasons. Average payroll is the arithmetic mean of filtered team-seasons with payroll values.
- World Series winner payroll versus league average = winner payroll minus the mean payroll of all clubs with payroll data in the same season.
- Headline values, team title totals, playoff appearance totals, and sample counts are direct counts of the matching rows or outcomes.
