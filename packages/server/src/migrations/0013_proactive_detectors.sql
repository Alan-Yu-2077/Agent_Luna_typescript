-- Initiative 15 (v0.22.1): per-day scheduled-slot bookkeeping for the deterministic
-- proactive detectors. A 24-bit mask (bit `h` = the slot for local hour h has already
-- fired today), reset when proactive_slots_date rolls over (local date, the same clock
-- as quiet-hours/quota). Lets the scheduledWindow detector fire at most once per
-- configured slot per day without an LLM gate.
ALTER TABLE sessions ADD COLUMN proactive_slots_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN proactive_slots_date TEXT    NOT NULL DEFAULT '';
