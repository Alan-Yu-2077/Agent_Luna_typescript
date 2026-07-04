-- v0.30.3 (Initiative 22, 4/4): retire core_memory. The prose core memory (self_state +
-- relationship_status) now lives as the soul's evolving section (migrated at v0.30.0 boot, rendered
-- since v0.30.1, dream-authored since v0.30.2). This migration drops the retired tables.
--
-- SAFETY RE-MIGRATE: if a DB somehow reached here with the soul never seeded (evolving_* still empty)
-- but a core_memory row present, copy it over BEFORE the drop so no self-authored prose is lost. On
-- the live DB the soul is already populated, so this UPDATE matches nothing and is a no-op. The soul
-- row may not exist yet on a fresh install (seedSoulOnBoot runs after migrate); UPDATE then affects 0
-- rows, which is correct (a fresh DB has no core prose to preserve).
UPDATE soul
   SET evolving_self = (SELECT self_state FROM core_memory WHERE id = 1),
       evolving_bond = (SELECT relationship_status FROM core_memory WHERE id = 1),
       updated_ms    = strftime('%s', 'now') * 1000
 WHERE id = 1
   AND evolving_self = ''
   AND evolving_bond = ''
   AND EXISTS (SELECT 1 FROM core_memory WHERE id = 1);

DROP TABLE IF EXISTS core_memory_audit;
DROP TABLE IF EXISTS core_memory;
