-- v0.17.0 (Initiative 10): per-turn salience score (1–5), rated by the dream
-- cycle's LLM. NULL = not yet rated. Used by the structured compressor (salient
-- turns resist over-summarization — Generative-Agents importance anchors) and by
-- the recall ranking (β·importance, v0.17.1).
ALTER TABLE l2_turns ADD COLUMN importance INTEGER;
