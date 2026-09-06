# plan.md: Custom Tee Time Sign-Up System for Manchester Country Club

## Overview
Develop a lightweight, high-performance, edge-hosted web application to replace MCC's legacy weekend sign-up sheet (`reg.mancc.com`). The application allows members to submit weekend tee time requests, manage group rosters (including guests), specify time preferences, and self-service edit their entries.

The application will run on serverless edge infrastructure (Cloudflare) independently of GolfNow, integrated into MCC's GolfNow site via Cloudflare DNS routing, a custom subdomain (`signups.mancc.com`), or a responsive iframe block.

---

## Technical Stack & Edge Infrastructure

* **Edge Compute:** Cloudflare Workers (TypeScript) / Cloudflare Pages.
* **Database:** Cloudflare D1 (Serverless SQLite at the Edge).
* **Key-Value Store:** Cloudflare KV (For storing 10-minute OTP codes and rate-limiting counters).
* **Frontend UI:** Lightweight React/Vite app hosted on Cloudflare Pages or SSR Workers (Tailwind CSS).
* **Transactional Email:** Resend or SendGrid API called directly via Worker `fetch`.
* **Deployment:** Decoupled from GolfNow's CMS; fully portable across future web platforms.

---

## Database Schemas (`schema.sql`)

```sql
-- Registrations Table
CREATE TABLE IF NOT EXISTS registrations (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    time_block TEXT NOT NULL,
    target_time TEXT,

    -- Player 1 (Primary / Host)
    player_1_is_guest INTEGER DEFAULT 0,
    player_1_member_id TEXT,
    player_1_name TEXT NOT NULL,
    player_1_email TEXT NOT NULL,

    -- Player 2
    player_2_is_guest INTEGER DEFAULT 0,
    player_2_member_id TEXT,
    player_2_name TEXT,
    player_2_email TEXT,

    -- Player 3
    player_3_is_guest INTEGER DEFAULT 0,
    player_3_member_id TEXT,
    player_3_name TEXT,
    player_3_email TEXT,

    -- Player 4
    player_4_is_guest INTEGER DEFAULT 0,
    player_4_member_id TEXT,
    player_4_name TEXT,
    player_4_email TEXT,

    notes TEXT,
    is_open_group INTEGER DEFAULT 0
);

-- Indexing for fast email lookups during edit verification
CREATE INDEX IF NOT EXISTS idx_p1_email ON registrations(player_1_email);
CREATE INDEX IF NOT EXISTS idx_p2_email ON registrations(player_2_email);
CREATE INDEX IF NOT EXISTS idx_p3_email ON registrations(player_3_email);
CREATE INDEX IF NOT EXISTS idx_p4_email ON registrations(player_4_email);
```

## Core Security & Authentication Architecture

1. No Data in GET Parameters
    * Prohibit exposing registration records or member details via plain URL query tokens (e.g., ?token=XYZ).

2. Email Gateway + 6-Digit OTP Flow

   * Step 1: Member clicks "Manage Registration" and inputs their email address.
   * Step 2: The backend queries D1 for an active record where the input matches player_1_email through player_4_email.
   * Step 3: If matched, the Worker generates a cryptographically secure 6-digit One-Time Passcode (OTP) and writes it to Cloudflare KV:
` KEY: otp:<email> -> VALUE: {"code": "123456", "registration_id": "..."} with a 600-second (10-min) TTL.`
   * Step 4: Transactional email delivers the code to the requested address.
   * Step 5: Member enters the 6-digit code. Upon validation, the Worker issues a signed JWT stored in a HttpOnly, Secure, SameSite=Strict cookie bound to that registration_id.

3. Edge Rate Limiting

   * Enforce Worker rate-limiting bindings on /api/request-otp (maximum 5 verification requests per IP per 15 minutes) to prevent brute-force code entry or email enumeration.

## Functional Requirements & User Experience

1. Roster Entry (Members & Guests)

   * Searchable Member Dropdown: Slots 1–4 feature an autocomplete dropdown pre-loaded with MCC member names (Last, First).
   * Auto-Populate Email: Selecting a member automatically binds their stored email address to that player slot behind the scenes.
   * Guest Toggle Switch: Each slot includes an "Is Guest?" toggle. Checking it transforms the dropdown into free-text fields for First Name, Last Name, and Guest Email Address.

2. Time Window & Preferences

   * Primary Time Block: Radio selector (7:30 AM – 9:30 AM, 9:30 AM – 11:30 AM, 11:30 AM+).
   * Structured Target Time: Secondary dropdown with smaller intervals (8:00-8:30 AM, 8:30-9:00 AM, etc.) or relative rules (As early as possible in block, Middle of block, As late as possible in block).
   * Open Group Option: Toggle allowing groups with 1–3 players to mark their submission as "Open for others to join".

3. Group-Wide Broadcast Notifications

   * Multi-Recipient Dispatch: Upon submission or modification, the backend collects all non-null email addresses across Players 1–4.
   * Email Broadcast: Sends initial confirmation receipts and edit instructions to every valid email address in the group roster.
   * Edit Updates: Any roster or target time changes automatically trigger an updated confirmation broadcast to all active group members.

4. Smart Group Join Workflow

   * "Join Existing Group" Mode: Option on the landing page allowing individual/pair members to search for open groups by Host Name.
   * Automatic Slot Assignment: Appends joining players into the first available slot (player_2, player_3, or player_4) of the target registrations record without creating duplicate entries.

5. Pro Shop Dashboard & Data Export

   * Live Admin Grid: Password-protected table sorting entries by original created_at timestamp and time block.
   * One-Click CSV Export: Downloads a structured spreadsheet ready for pro shop staff to populate the live tee sheet:
` Queue # | Original Timestamp | Time Block | Target Time | Player 1 | Player 2 | Player 3 | Player 4 | Notes`

## Implementation Steps for Claude

1. Database & Worker Setup: Instantiate D1 SQLite schema and setup Cloudflare Worker route handlers for /api/register, /api/request-otp, /api/verify-otp, and /api/update.
2. Frontend & Roster Logic: Build the React/Tailwind form component featuring Member Autocomplete, Guest Toggles, and dynamic Player 1–4 slot controls.
3. Auth & Security Layer: Build the Email Gateway modal, OTP generation via KV, and JWT HttpOnly session state management.
4. Notifications & Admin Export: Wire Resend/SendGrid API calls for multi-recipient broadcasting and implement the password-protected /admin CSV export route.
