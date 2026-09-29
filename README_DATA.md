# MLB Payroll and Team Success Dataset

This folder contains a cleaned Major League Baseball team-game panel built for the FDA Data Website Project.

## Files

- `data/raw/Salaries.csv` - Baseball Databank player salary table.
- `data/raw/Teams.csv` - Baseball Databank team metadata table.
- `data/raw/retrosheet/*.zip` - Retrosheet season CSV downloads used locally by the build script; these are not committed because of size.
- `data/processed/mlb_team_payroll_game_results.csv` - cleaned website-ready payroll and game-result dataset.
- `data/processed/payroll_report_summary.json` - reproducible summary data for report charts.
- `data/processed/payroll_dashboard_data.json` - compact team-season dashboard data derived from the full CSV.
- `scripts/build_payroll_dataset.py` - rebuilds the processed team-game dataset.
- `scripts/build_payroll_report_summary.py` - rebuilds the report chart summary file.
- `scripts/build_dashboard_data.py` - rebuilds the compact dashboard JSON.

## Sources

Payroll comes from the Baseball Databank/Lahman salary table preserved in the public `cbwinslow/baseballdatabank` GitHub mirror.

Game-level results come from Retrosheet season CSV downloads, especially `gameinfo.csv` and `teamstats.csv`.

## Grain

One row is one team in one regular-season game from 1985 through 2016. Each row includes that team's season payroll, game result, running winning percentage after the game, game context, and team box-score measures.

## Assignment Fit

- Rows: 148,592
- Columns: 29
- Time columns: `date`, `year`
- Group columns: `team_id`, `team_name`
- Time periods: 32 seasons
- Groups: 33 team IDs
- Filterable categorical variables include `year`, `team_name`, `league`, `home_away`, `day_night`, and `payroll_tier`
- Numeric variables include `season_payroll`, `payroll_millions`, `payroll_rank`, `winning_percentage_after_game`, `win`, `loss`, `team_runs`, `opponent_runs`, `run_differential`, `attendance`, and `cost_per_win_to_date`

## Derived Fields

- `season_payroll` = sum of listed player salaries for that team-season.
- `payroll_rank` = team payroll rank within the season, where 1 is highest payroll.
- `payroll_percentile` = within-season payroll rank converted to a 0-1 scale.
- `payroll_millions` = `season_payroll / 1,000,000`.
- `run_differential` = `team_runs - opponent_runs`.
- `winning_percentage_after_game` = wins to date divided by completed decisions to date.
- `cost_per_win_to_date` = `season_payroll / wins_to_date`; blank before a team's first win.
