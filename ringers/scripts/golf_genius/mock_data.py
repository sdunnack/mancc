# Mock fixtures mirroring the Golf Genius tee sheet API response shape.
# Keyed by the placeholder event IDs used in fetch.py while real credentials
# are not yet available.  When USE_MOCK_DATA is False these are never called.

# Round IDs used internally by the mock layer
_R1_1 = "mock_r1_1"
_R1_2 = "mock_r1_2"
_R2_1 = "mock_r2_1"
_R2_2 = "mock_r2_2"

# ---------------------------------------------------------------------------
# Per-player scores: [event1_r1, event1_r2, event2_r1, event2_r2]
# 21 elements each: indices 0-17 are hole scores, 18-20 are None (subtotals
# filled by Golf Genius — we only use 0-17).
# PARS = [4,4,5,5,3,4,4,3,4, 4,4,3,4,5,5,4,4,3]
# ---------------------------------------------------------------------------
_N = None

_SCORES = {
    "Smith, Jane": [
        [4, 4, 5, 5, 3, 4, 4, 3, 4, 4, 4, 3, 4, 5, 5, 4, 4, 3, _N, _N, _N],
        [4, 3, 5, 5, 3, 4, 4, 3, 4, 4, 4, 3, 4, 5, 5, 4, 4, 3, _N, _N, _N],
        [4, 4, 5, 4, 3, 4, 4, 3, 4, 4, 4, 3, 4, 5, 5, 4, 3, 3, _N, _N, _N],
        [5, 4, 5, 5, 3, 4, 4, 3, 4, 5, 4, 3, 4, 5, 5, 4, 4, 3, _N, _N, _N],
    ],
    "Johnson, Bob": [
        [4, 3, 5, 5, 4, 4, 5, 3, 5, 4, 5, 3, 4, 5, 5, 4, 4, 3, _N, _N, _N],
        [5, 4, 5, 5, 3, 4, 4, 3, 4, 4, 4, 3, 5, 4, 5, 4, 4, 3, _N, _N, _N],
        [4, 4, 5, 5, 3, 5, 4, 3, 5, 4, 4, 3, 4, 5, 5, 4, 4, 3, _N, _N, _N],
        [4, 4, 6, 5, 3, 4, 4, 3, 4, 4, 4, 3, 4, 5, 5, 4, 4, 3, _N, _N, _N],
    ],
    "Williams, Mike": [
        [5, 5, 6, 5, 4, 5, 4, 3, 5, 4, 5, 3, 5, 6, 5, 5, 4, 3, _N, _N, _N],
        [4, 4, 6, 5, 3, 5, 5, 4, 5, 5, 4, 3, 5, 5, 5, 4, 5, 3, _N, _N, _N],
        [5, 5, 6, 5, 4, 5, 5, 3, 5, 5, 4, 3, 5, 5, 6, 4, 5, 3, _N, _N, _N],
        [5, 4, 6, 5, 4, 4, 5, 3, 5, 4, 5, 3, 4, 5, 5, 5, 4, 3, _N, _N, _N],
    ],
    "Brown, Sarah": [
        [5, 4, 5, 5, 3, 4, 4, 3, 5, 4, 4, 3, 4, 5, 5, 4, 5, 3, _N, _N, _N],
        [4, 4, 5, 5, 3, 4, 5, 3, 4, 5, 4, 3, 4, 5, 5, 4, 4, 3, _N, _N, _N],
        [4, 4, 5, 5, 4, 4, 4, 3, 5, 4, 4, 3, 4, 5, 5, 4, 3, 3, _N, _N, _N],
        [5, 4, 5, 5, 3, 4, 4, 3, 5, 4, 4, 3, 5, 5, 5, 4, 4, 3, _N, _N, _N],
    ],
    "Davis, Tom": [
        [4, 4, 5, 5, 2, 4, 4, 3, 4, 4, 4, 3, 4, 5, 5, 4, 4, 3, _N, _N, _N],
        [4, 3, 5, 5, 3, 4, 4, 3, 4, 4, 4, 3, 4, 5, 4, 4, 4, 3, _N, _N, _N],
        [4, 4, 5, 4, 3, 4, 4, 3, 4, 4, 4, 3, 4, 5, 5, 4, 3, 3, _N, _N, _N],
        [5, 4, 5, 5, 3, 4, 3, 3, 4, 4, 4, 3, 4, 5, 5, 4, 4, 3, _N, _N, _N],
    ],
    "Miller, Lisa": [
        [5, 5, 6, 5, 4, 5, 5, 3, 5, 4, 5, 3, 5, 6, 5, 5, 5, 3, _N, _N, _N],
        [4, 4, 6, 5, 3, 5, 5, 3, 5, 5, 4, 3, 5, 5, 6, 4, 5, 3, _N, _N, _N],
        [5, 5, 5, 6, 3, 5, 5, 3, 5, 5, 5, 3, 5, 5, 5, 4, 5, 3, _N, _N, _N],
        [5, 4, 5, 5, 3, 4, 5, 4, 5, 4, 5, 3, 5, 5, 5, 5, 4, 3, _N, _N, _N],
    ],
    "Wilson, Chris": [
        [4, 4, 5, 5, 3, 4, 4, 3, 5, 4, 4, 3, 4, 5, 5, 4, 4, 3, _N, _N, _N],
        [5, 4, 5, 5, 3, 4, 4, 3, 4, 4, 4, 3, 5, 5, 5, 4, 4, 3, _N, _N, _N],
        [4, 4, 5, 5, 3, 3, 4, 3, 4, 4, 4, 3, 4, 5, 5, 4, 4, 3, _N, _N, _N],
        [4, 4, 5, 5, 3, 4, 4, 3, 4, 4, 3, 3, 4, 5, 5, 4, 4, 3, _N, _N, _N],
    ],
    "Moore, Pat": [
        [5, 4, 6, 5, 3, 4, 4, 3, 5, 4, 4, 3, 5, 5, 5, 4, 4, 3, _N, _N, _N],
        [4, 4, 5, 5, 3, 5, 4, 3, 4, 4, 4, 3, 4, 5, 6, 4, 4, 3, _N, _N, _N],
        [5, 5, 5, 5, 3, 4, 4, 3, 5, 5, 4, 3, 4, 5, 5, 4, 5, 3, _N, _N, _N],
        [4, 4, 5, 6, 3, 4, 4, 3, 4, 4, 4, 3, 4, 5, 5, 4, 4, 3, _N, _N, _N],
    ],
}

_PLAYERS = list(_SCORES.keys())


# ---------------------------------------------------------------------------
# Helper: build a tee sheet response (list of pairing groups) from a list of
# (name, score_array) pairs.
# ---------------------------------------------------------------------------
def _build_tee_sheet(pairs):
    groups = []
    group_size = 4
    for start in range(0, len(pairs), group_size):
        chunk = pairs[start : start + group_size]
        groups.append(
            {
                "pairing_group": {
                    "id": str(1000 + start),
                    "hole": 1,
                    "tee_time": "8:00 AM",
                    "players": [
                        {
                            "name": name,
                            "player_roster_id": str(2000 + i),
                            "score_array": scores,
                        }
                        for i, (name, scores) in enumerate(chunk)
                    ],
                }
            }
        )
    return groups


# ---------------------------------------------------------------------------
# Round index → score column mapping
# Event 1 Round 1 → col 0, Event 1 Round 2 → col 1
# Event 2 Round 1 → col 2, Event 2 Round 2 → col 3
# ---------------------------------------------------------------------------
_ROUND_INDEX = {
    _R1_1: 0,
    _R1_2: 1,
    _R2_1: 2,
    _R2_2: 3,
}

# ---------------------------------------------------------------------------
# Public API used by client.py
# ---------------------------------------------------------------------------

MOCK_ROUNDS = {
    "<event_id_1>": [
        {
            "round": {
                "id": _R1_1,
                "event_id": "<event_id_1>",
                "name": "Round 1",
                "date": "2026-04-26",
                "status": "completed",
            }
        },
        {
            "round": {
                "id": _R1_2,
                "event_id": "<event_id_1>",
                "name": "Round 2",
                "date": "2026-05-10",
                "status": "completed",
            }
        },
    ],
    "<event_id_2>": [
        {
            "round": {
                "id": _R2_1,
                "event_id": "<event_id_2>",
                "name": "Round 1",
                "date": "2026-05-03",
                "status": "completed",
            }
        },
        {
            "round": {
                "id": _R2_2,
                "event_id": "<event_id_2>",
                "name": "Round 2",
                "date": "2026-05-17",
                "status": "completed",
            }
        },
    ],
}


def get_rounds(event_id: str) -> list:
    if event_id in MOCK_ROUNDS:
        return MOCK_ROUNDS[event_id]
    # Unknown event ID in mock mode — return two generic rounds so the app
    # still builds without crashing before real IDs are set.
    return MOCK_ROUNDS["<event_id_1>"]


def get_tee_sheet(event_id: str, round_id: str) -> list:
    col = _ROUND_INDEX.get(round_id, 0)
    pairs = [(_p, _SCORES[_p][col]) for _p in _PLAYERS]
    return _build_tee_sheet(pairs)
