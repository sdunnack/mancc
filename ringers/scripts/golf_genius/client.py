"""
client.py — low-level HTTP wrapper for the Golf Genius API.

The Golf Genius read API authenticates via the API key embedded directly in
the URL path: GET /api_v2/{api_key}/{endpoint}

If GOLF_GENIUS_API_KEY is not set, USE_MOCK_DATA is True and all requests
are routed to mock_data.py instead of hitting the network. This lets the
rest of the codebase work identically whether it's using real or mock data.

Only call this module through api.py — don't use get() directly elsewhere.
"""

import os
import re

import requests

from . import mock_data

API_KEY = os.environ.get("GOLF_GENIUS_API_KEY", "")
USE_MOCK_DATA = not API_KEY
_BASE_URL = "https://www.golfgenius.com"


def get(path: str):
    """Make a GET request to /api_v2/{api_key}/{path}, or route to mock data."""
    if USE_MOCK_DATA:
        return _mock_get(path)

    url = f"{_BASE_URL}/api_v2/{API_KEY}/{path}"
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    return response.json()


def _mock_get(path: str):
    """Route a path string to the appropriate mock_data function."""
    m = re.match(r"events/([^/]+)/rounds$", path)
    if m:
        return mock_data.get_rounds(m.group(1))

    m = re.match(r"events/([^/]+)/rounds/([^/]+)/tee_sheet", path)
    if m:
        return mock_data.get_tee_sheet(m.group(1), m.group(2))

    raise ValueError(f"Unknown mock path: {path}")
