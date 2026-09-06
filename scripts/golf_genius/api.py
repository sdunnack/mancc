"""
api.py — high-level Golf Genius API helpers used by fetch.py.

Each function maps to one Golf Genius endpoint and returns the parsed JSON.
See documentation/golfgeniusapiv2.apib for full response shapes.
"""

from . import client


def get_rounds_for_event(event_id: str) -> list:
    """
    Returns the list of rounds for a given event.
    Each item is a dict with a "round" key containing id, name, date, status, etc.
    """
    return client.get(f"events/{event_id}/rounds")


def get_tee_sheet(event_id: str, round_id: str) -> list:
    """
    Returns the tee sheet for a single round — a list of pairing groups.
    Each group contains a list of players, and each player includes:
      - name (str)
      - player_roster_id (str)
      - score_array (list of 21 values: indices 0–17 are hole scores, 18–20 are subtotals)
    """
    return client.get(f"events/{event_id}/rounds/{round_id}/tee_sheet")
