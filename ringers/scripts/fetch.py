"""
fetch.py — main entry point for data collection.

This script is run by the GitHub Actions workflow on a schedule. It calls the
Golf Genius API for each configured event, extracts hole-by-hole scores for
every tracked player, and writes docs/scores.json. The static site (docs/index.html)
reads that file to render the Ringers and Birdies views.

If GOLF_GENIUS_API_KEY is not set, the script automatically falls back to
mock data so the full UI can be developed and previewed without real credentials.

To run locally:
    python scripts/fetch.py
"""

import json
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

# Make sub-packages (golf_genius/) importable when running this file directly.
sys.path.insert(0, str(Path(__file__).parent))

from golf_genius import api
from golf_genius.client import USE_MOCK_DATA

# ---------------------------------------------------------------------------
# Configuration — edit these when real credentials become available
# ---------------------------------------------------------------------------

# The two Golf Genius event IDs for the league. These never change season to
# season — swap in the real IDs once you have API credentials.
EVENT_IDS = ["<event_id_1>", "<event_id_2>"]

# Par values for holes 1–18 at the course.
PARS = [4, 4, 5, 5, 3, 4, 4, 3, 4, 4, 4, 3, 4, 5, 5, 4, 4, 3]

# Names of players to track, exactly as they appear in Golf Genius ("Last, First").
# Leave empty to include everyone in the tee sheet — handy while developing
# against mock data. Fill this in once the league roster is confirmed.
PLAYERS = []

# ---------------------------------------------------------------------------

# Output path — inside docs/ so GitHub Pages serves it alongside index.html.
OUTPUT_PATH = Path(__file__).parent.parent / "docs" / "scores.json"


def main():
    if USE_MOCK_DATA:
        print("No GOLF_GENIUS_API_KEY found — using mock data.")

    # Accumulate rounds per player across both events.
    # Structure: player_name → [{ date, scores, birdies }, ...]
    players: dict[str, list] = defaultdict(list)

    for event_id in EVENT_IDS:
        rounds = api.get_rounds_for_event(event_id)
        for round_entry in rounds:
            round_info = round_entry["round"]
            round_id = str(round_info["id"])
            date_str = round_info.get("date", "")

            # Golf Genius returns dates as YYYY-MM-DD; reformat for display.
            try:
                dt = datetime.strptime(date_str, "%Y-%m-%d")
                date_label = dt.strftime("%m/%d/%Y")
            except ValueError:
                date_label = date_str

            # The tee sheet response bundles players into pairing groups.
            # We flatten it to individual player records.
            tee_sheet = api.get_tee_sheet(event_id, round_id)
            for group_entry in tee_sheet:
                for player in group_entry["pairing_group"]["players"]:
                    name = player["name"]

                    # Skip anyone not in the tracked roster (when roster is set).
                    if PLAYERS and name not in PLAYERS:
                        continue

                    # score_array has 21 elements; only the first 18 are
                    # hole-by-hole scores. Indices 18–20 are subtotals that
                    # Golf Genius fills in — we don't need them.
                    scores = player["score_array"][:18]

                    # Pre-compute which holes were birdied (or eagled) so the
                    # JSON is easy to read and the browser doesn't have to
                    # re-derive it from scores every time.
                    birdies = [
                        i + 1  # 1-indexed hole number
                        for i, score in enumerate(scores)
                        if score is not None and score <= PARS[i] - 1
                    ]

                    players[name].append(
                        {
                            "date": date_label,
                            "scores": scores,
                            "birdies": birdies,
                        }
                    )

    if not players:
        print("Warning: no players collected. Check PLAYERS list and event IDs.")

    output = {
        "lastUpdated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "pars": PARS,
        "players": {name: {"rounds": rounds} for name, rounds in players.items()},
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(f"Wrote {OUTPUT_PATH} ({len(players)} players)")


if __name__ == "__main__":
    main()
