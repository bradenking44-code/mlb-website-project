# MLB Batting Player-Season Dataset

This folder contains a cleaned Major League Baseball batting panel built for the FDA Data Website Project.

## Files

- `data/raw/Batting.csv` - original Baseball Databank batting table.
- `data/raw/People.csv` - original Baseball Databank player metadata table.
- `data/raw/Teams.csv` - original Baseball Databank team metadata table.
- `data/processed/mlb_batting_player_seasons.csv` - cleaned website-ready dataset.
- `scripts/build_mlb_dataset.py` - reproducible script that builds the processed CSV.

## Source

Raw data comes from the Baseball Databank/Lahman-style CSV tables preserved in the public `cbwinslow/baseballdatabank` GitHub mirror:

- `https://github.com/cbwinslow/baseballdatabank`
- `https://raw.githubusercontent.com/cbwinslow/baseballdatabank/master/core/Batting.csv`
- `https://raw.githubusercontent.com/cbwinslow/baseballdatabank/master/core/People.csv`
- `https://raw.githubusercontent.com/cbwinslow/baseballdatabank/master/core/Teams.csv`

The mirror describes the data as Baseball Databank data from the Chadwick Baseball Bureau, historically based in part on the Lahman Baseball Database. The original Chadwick Bureau repository URL was unavailable when this dataset was built, so the preserved public mirror was used.

## Grain

One row is one player-team-season stint for modern AL/NL Major League Baseball, from 1901 through 2021. Players traded mid-season can appear more than once in the same year because the source batting table records separate team stints.

## Assignment Fit

- Rows: 101,914
- Columns: 37
- Time column: `year`
- Group columns: `player_id`, `team_id`, `team_name`
- Time periods: 121 seasons
- Groups: 18,140 players and 47 team IDs
- Filterable categorical variables include `year`, `team_name`, `league`, `division`, `bats`, `throws`, and `birth_country`
- Numeric variables include `games`, `plate_appearances`, `hits`, `home_runs`, `rbi`, `walks`, `strikeouts`, `total_bases`, `batting_average`, `on_base_percentage`, `slugging_percentage`, `ops`, and `isolated_power`

## Derived Fields

- `plate_appearances` = `at_bats + walks + hit_by_pitch + sacrifice_flies + sacrifice_hits`
- `total_bases` = `hits + doubles + 2 * triples + 3 * home_runs`
- `batting_average` = `hits / at_bats`
- `on_base_percentage` = `(hits + walks + hit_by_pitch) / (at_bats + walks + hit_by_pitch + sacrifice_flies)`
- `slugging_percentage` = `total_bases / at_bats`
- `ops` = `on_base_percentage + slugging_percentage`
- `isolated_power` = `(total_bases - hits) / at_bats`
- `age` = `year - birthYear`

Blank rate values mean the denominator was zero.
