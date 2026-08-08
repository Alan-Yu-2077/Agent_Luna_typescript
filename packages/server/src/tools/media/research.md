# v0.45.3 research memo — NetEase lyric / hot-comment enrichment (2026-08-08)

The build/cut gate the roadmap demanded before any code. Verdict at the bottom.

## Method

Live anonymous probes from the owner's machine (curl, browser UA, no cookies, no login,
1 request/second). Endpoints are the PLAIN `music.163.com/api/*` forms — no weapi crypto layer.

## Q1 — Lyric endpoint: anonymous? encryption?

`GET https://music.163.com/api/song/lyric?id=186016&lv=1&kv=1&tv=-1`

**Anonymous ✓, no crypto ✓.** Returns full timestamped LRC (`lrc.lyric`, `[mm:ss.xxx]` lines) plus
translated (`tlyric`) when present. Verified against 晴天 (186016): complete credits + lyric body.
Historically the simplest endpoint of the family; still true today.

## Q2 — Hot comments: is weapi mandatory?

`GET https://music.163.com/api/v1/resource/comments/R_SO_4_{songId}?limit=N`

**Anonymous ✓, no weapi ✓.** Returns `hotComments[]` with `content` + `likedCount`. Sample against
186016: top comment 823k likes, exactly the 网抑云 culture the version wants as chat fuel.
(The Python SDK reference was consulted as endpoint documentation only — no dependency taken.)

## Q3 — Song-id retrieval: the weak link, measured

`GET https://music.163.com/api/search/get?s=<title artist>&type=1&limit=10` (and
`POST /api/cloudsearch/pc` — same index, same results).

Two regimes observed:

- **Licensed catalog → clean.** 起风了/买辣椒也用券: original is hit #0. 海阔天空/Beyond: top 5
  all genuine. 孤勇者/陈奕迅: original #0, with a knockoff ("陈奕迅-"/MissG) at #2 —
  distinguishable by EXACT artist equality.
- **Delisted catalog → 100% flooded.** 晴天/周杰伦 (JVR left NetEase): the top 10 are ALL
  copyright-evading covers ("周杰伦-", "周杰伦.", "周杰伦、" + feat partners); the real 186016
  never appears. Any fuzzy scorer would "confidently" match a knockoff here.

Mitigation that closes both regimes: require **normalized-exact title AND exact artist AND
duration within ±3s** (search returns `duration` in ms; MediaRemote gives the played track's
duration). Knockoffs fail artist equality ("周杰伦-" ≠ "周杰伦"); remixes/伤感版 fail title or
duration. When nothing passes → no enrich (宁缺勿错) — which is also the honest outcome for
delisted songs the owner plays from local files.

## Cost & fragility

- One search + one lyric + one comments GET per NEW track identity, ever (SQLite cache, lyrics
  immutable). A heavy listening day ≈ a few dozen requests total; cached replays are zero.
- The upstream is unmaintained-by-design (D1) and may vanish: default OFF (`LUNA_MUSIC_ENRICH`),
  every failure silent, cache keeps already-learned songs working, new songs degrade to
  title-only. No retries beyond the single attempt per change.
- Nothing here needs credentials; any future endpoint that does is cut, not accommodated (D4).

## Verdict

**BUILD** — all three questions came back green, with the search caveat encoded as the match
discipline above. Comments stay in (no weapi needed, contrary to the pre-research worry).
