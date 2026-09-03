/* ═══════════════════════════════════════════════════════════════
   L3 · 构件详页内容。按 leafId 索引。

   每件可有以下键，缺哪个就不出哪一页（页数因件而异是预期行为）：
     claim      答"没有它会怎样"，1–2 句
     mechanism  真机制
     contract   { exposes, depends, boundary, invariant }
     code       { file, lines, snippet, note } —— snippet 逐字来自仓库
     decision   { why, rejected, cost }

   可显示的串一律 { zh, en }。
   全部 code.snippet 已用脚本逐行比对过仓库，31/31 逐字命中。
   ═══════════════════════════════════════════════════════════════ */
window.LUNA_DECKS = {

  /* ── 上下文 / context management ─────────────────────────── */
  "cached": {
    "figure": {
      "w": 620,
      "h": 210,
      "boxes": [
        {
          "x": 14,
          "y": 26,
          "w": 142,
          "h": 40,
          "title": {
            "zh": "人格 · 灵魂",
            "en": "persona · soul"
          }
        },
        {
          "x": 14,
          "y": 82,
          "w": 142,
          "h": 40,
          "title": {
            "zh": "技能货架",
            "en": "skill shelf"
          }
        },
        {
          "x": 14,
          "y": 138,
          "w": 142,
          "h": 40,
          "title": {
            "zh": "L3 事实核心",
            "en": "L3 core facts"
          }
        },
        {
          "x": 268,
          "y": 82,
          "w": 168,
          "h": 44,
          "title": {
            "zh": "一个 block",
            "en": "a single block"
          },
          "sub": "buildSystemPrompt"
        },
        {
          "x": 486,
          "y": 82,
          "w": 120,
          "h": 44,
          "title": {
            "zh": "被记忆化",
            "en": "memoized"
          },
          "sub": "memoryEpoch"
        }
      ],
      "edges": [
        {
          "pts": [
            [
              160,
              46
            ],
            [
              264,
              96
            ]
          ]
        },
        {
          "pts": [
            [
              160,
              102
            ],
            [
              264,
              104
            ]
          ]
        },
        {
          "pts": [
            [
              160,
              158
            ],
            [
              264,
              114
            ]
          ]
        },
        {
          "pts": [
            [
              440,
              104
            ],
            [
              482,
              104
            ]
          ]
        }
      ],
      "labels": [
        {
          "x": 268,
          "y": 140,
          "w": 340,
          "text": {
            "zh": "记忆没写过，就不重建——同一段字节直接再用一次",
            "en": "no memory write, no rebuild — the same bytes are reused"
          },
          "tone": "edge"
        }
      ]
    },
    "claim": {
      "zh": "没有它，人格、灵魂、长期事实、日记摘要、技能货架这一整套会在每一回合、每一次工具迭代里被重新计费——而这套东西一个字都不随回合变。它是系统提示里唯一那个带 cache_control 断点的文本块：所有跨回合稳定的自我描述先拼成一整块，再由 memoryEpoch 在回合内记忆化。",
      "en": "Without it, the persona, the soul, the long-term facts, the diary digest and the skill shelf would be re-billed on every turn and every tool iteration — none of which changes from turn to turn. It is the one text block in the system prompt that carries the cache_control breakpoint: everything stable about who she is is joined into a single block, then memoized within the turn against memoryEpoch."
    },
    "mechanism": {
      "zh": "buildSystemPrompt 最多推入十段内容，顺序固定：基础指令、message-mode 指令、L1 思维契约、web 不可信内容规则、灵魂(固定核心 + 她自己演化的部分)、具身块、humanity 块、L3 长期事实、日记摘要、技能货架。十段 join 成一个 text block,整个进程只有这一处断点。一个回合最多跑 8 轮工具迭代，但前缀不会重建八次:open_stream 每轮先读 memoryEpoch,只有 epoch 变了(这一回合真的写了记忆、改了灵魂、存了技能)才重渲染一次。",
      "en": "buildSystemPrompt pushes at most ten sections in a fixed order: base directives, the message-mode directive, the L1 thinking contract, the untrusted-web rule, the soul (fixed core plus the part she evolves), the embodiment block, the humanity block, the L3 long-term facts, the diary digest, and the skill shelf. All ten are joined into one text block, and that is the only breakpoint in the process. A turn runs up to 8 tool iterations, but the prefix is not rebuilt eight times: open_stream reads memoryEpoch first and re-renders only when the epoch actually moved (a real memory write, soul edit or skill save mid-turn)."
    },
    "contract": {
      "exposes": {
        "zh": "buildSystemPrompt(...) 返回 Anthropic.TextBlockParam[],长度恒为 1。",
        "en": "buildSystemPrompt(...) returns an Anthropic.TextBlockParam[] whose length is always 1."
      },
      "depends": {
        "zh": "renderSoulBlock / renderCoreBlock / renderDiaryDigest / renderSkillShelf / renderL1Contract / renderHumanityBlock,以及 memoryEpoch 这个单调计数器。",
        "en": "renderSoulBlock, renderCoreBlock, renderDiaryDigest, renderSkillShelf, renderL1Contract, renderHumanityBlock — plus the monotonic memoryEpoch counter."
      },
      "boundary": {
        "zh": "任何随回合变化的事实(时间、天气、在放的歌、这一句话召回到的记忆)都不进这里。",
        "en": "Nothing that varies per turn — time, weather, the current track, this query’s recall hits — is allowed in."
      },
      "invariant": {
        "zh": "没有记忆写入时，连续两回合的 system 序列化结果必须完全相等；写入之后必须不同。两条都被 l3.test.ts 钉死。",
        "en": "With no memory write, two consecutive turns must serialize to an identical system param; after a write it must differ. Both are pinned by l3.test.ts."
      }
    },
    "code": {
      "file": "packages/server/src/turn/runTurn.ts",
      "lines": "399-412",
      "snippet": "    // A1: reuse the memoized system block unless memory changed since it was built.\n    const epoch = memoryEpoch();\n    if (!s.systemBlock || s.systemBlockEpoch !== epoch) {\n      s.systemBlock = buildSystemPrompt(\n        s.session,\n        isMessageMode(s.registry),\n        isWebSearchMode(s.registry),\n        isWebFetchMode(s.registry),\n        isCodeWriteMode(s.registry),\n        isShellMode(s.registry),\n        isRepoMapMode(s.registry),\n        isSkillsMode(s.registry),\n      );\n      s.systemBlockEpoch = epoch;\n    }",
      "note": {
        "zh": "一次整数比较就决定了要不要重建整个人格前缀——记忆化的判据不是内容 diff,是一个计数器。",
        "en": "One integer comparison decides whether the whole persona prefix is rebuilt — the memoization key is a counter, not a content diff."
      }
    },
    "decision": {
      "why": {
        "zh": "一整块、一个断点，失效判定就退化成一个整数；分成多块再逐块判断，省下的字节远不如复杂度贵。",
        "en": "One block and one breakpoint collapse invalidation into a single integer. Splitting it into several blocks with per-block invalidation buys fewer bytes than it costs in complexity."
      },
      "cost": {
        "zh": "粒度换简单：任何一次 remember、改灵魂、存技能，都让整块前缀作废重算，而不是只失效变动的那一段。",
        "en": "Granularity traded for simplicity: any remember, soul edit or skill save invalidates the entire prefix rather than just the section that moved."
      }
    }
  },
  "tail": {
    "figure": {
      "w": 620,
      "h": 200,
      "boxes": [
        {
          "x": 12,
          "y": 22,
          "w": 128,
          "h": 38,
          "title": {
            "zh": "时间",
            "en": "time"
          }
        },
        {
          "x": 12,
          "y": 70,
          "w": 128,
          "h": 38,
          "title": {
            "zh": "天气 · 歌",
            "en": "weather · music"
          }
        },
        {
          "x": 12,
          "y": 118,
          "w": 128,
          "h": 38,
          "title": {
            "zh": "召回块",
            "en": "recall block"
          }
        },
        {
          "x": 288,
          "y": 62,
          "w": 150,
          "h": 54,
          "title": {
            "zh": "user 消息",
            "en": "the user message"
          },
          "sub": {
            "zh": "断点右边",
            "en": "right of the breakpoint"
          }
        },
        {
          "x": 486,
          "y": 62,
          "w": 120,
          "h": 54,
          "kind": "blackbox",
          "title": "LLM"
        }
      ],
      "edges": [
        {
          "pts": [
            [
              144,
              41
            ],
            [
              284,
              78
            ]
          ]
        },
        {
          "pts": [
            [
              144,
              89
            ],
            [
              284,
              89
            ]
          ]
        },
        {
          "pts": [
            [
              144,
              137
            ],
            [
              284,
              100
            ]
          ]
        },
        {
          "pts": [
            [
              442,
              89
            ],
            [
              482,
              89
            ]
          ]
        }
      ],
      "labels": [
        {
          "x": 288,
          "y": 132,
          "w": 320,
          "text": {
            "zh": "易变的东西一律走消息层——它们进系统提示就会天天作废缓存",
            "en": "volatile things ride the message layer; in the prompt they would void the cache daily"
          },
          "tone": "edge"
        }
      ]
    },
    "claim": {
      "zh": "没有它，这一回合的时间、天气、在放的歌、刚召回到的记忆就无处安放——要么塞进缓存前缀把断点炸掉，要么干脆不给她。它是 parse_input 把本回合所有易变内容和用户原话拼成的那一条 user 消息：最多七个 text block,一次性 push 进 history。",
      "en": "Without it, this turn’s time, weather, current track and freshly recalled memories have nowhere to live — either they go into the cached prefix and blow the breakpoint, or she never gets them. It is the single user message parse_input assembles: up to seven text blocks, pushed into history in one go."
    },
    "mechanism": {
      "zh": "顺序是固定的：醒来场景(只在开机后第一条真实用户回合)、召回块、时间块、天气块、音乐块、整首歌词块，最后才是用户原话。每一块都可以缺席，缺席就是零残留——没有占位符、没有空标签。整条消息按发出去的样子进 history 并持久化，所以下一回合她读到的历史，和当时真正发给模型的字节是同一份。",
      "en": "The order is fixed: wake scene (only on the first real user turn after boot), recall block, time block, weather block, music block, full-lyrics block, and only then the user’s own words. Any block may be absent, and absence leaves zero residue — no placeholder, no empty tag. The message is stored in history exactly as sent, so the history she reads next turn is byte-for-byte what the model actually received."
    },
    "contract": {
      "exposes": {
        "zh": "一条 role 为 user 的消息,content 是 1 到 7 个 text block。",
        "en": "One message with role user, whose content is between 1 and 7 text blocks."
      },
      "depends": {
        "zh": "retrieve + renderRecallBlock、buildTimeBlock、buildWeatherBlock、musicBlockFor、lyricsBurstFor,全部是同步或已 await 的纯格式化。",
        "en": "retrieve + renderRecallBlock, buildTimeBlock, buildWeatherBlock, musicBlockFor, lyricsBurstFor — all synchronous or already-awaited pure formatting."
      },
      "boundary": {
        "zh": "整条消息位于缓存断点右侧，不带任何 cache_control。",
        "en": "The whole message sits to the right of the breakpoint and carries no cache_control of its own."
      },
      "invariant": {
        "zh": "用户原话永远是最后一块；所有感知块永远排在它前面。",
        "en": "The user’s own words are always the last block; every perception block precedes them."
      }
    },
    "code": {
      "file": "packages/server/src/turn/temporalContext.test.ts",
      "lines": "240-248",
      "snippet": "    const sys = (r: number): string => JSON.stringify(provider.requests[r]?.system);\n    // cached prefix is byte-identical across turns (per-turn time facts are NOT in it)\n    expect(sys(0)).toBe(sys(1));\n    expect(sys(0)).not.toContain('Current time (you are handed this');\n\n    // the per-turn time facts ride the latest user message\n    const userMsg = provider.requests[0]?.messages.at(-1);\n    const blocks = userMsg?.content as Anthropic.TextBlockParam[];\n    expect(blocks.some((b) => b.text.includes('Current time (you are handed this'))).toBe(true);",
      "note": {
        "zh": "同一个测试同时钉两头：系统块里不许有这句，最新那条用户消息里必须有——分工是被断言锁死的，不是靠约定。",
        "en": "One test pins both ends: the string must be absent from the system block and present on the latest user message. The split is asserted, not merely agreed."
      }
    },
    "decision": {
      "cost": {
        "zh": "这些块每回合重新发送，不享受任何缓存折扣；时间、天气、音乐三块加起来的成本是逐回合全额的。",
        "en": "These blocks are re-sent every turn with no cache discount; time, weather and music are paid in full, turn after turn."
      }
    }
  },
  "bp": {
    "figure": {
      "w": 620,
      "h": 190,
      "boxes": [
        {
          "x": 20,
          "y": 46,
          "w": 250,
          "h": 78,
          "title": {
            "zh": "缓存前缀",
            "en": "cached prefix"
          },
          "sub": {
            "zh": "人格 · 灵魂 · 技能货架 · L3",
            "en": "persona · soul · skills · L3"
          }
        },
        {
          "x": 350,
          "y": 46,
          "w": 250,
          "h": 78,
          "title": {
            "zh": "未缓存尾部",
            "en": "uncached tail"
          },
          "sub": {
            "zh": "时间 · 天气 · 召回 · 这一句",
            "en": "time · weather · recall · the message"
          }
        }
      ],
      "edges": [
        {
          "pts": [
            [
              310,
              30
            ],
            [
              310,
              152
            ]
          ],
          "head": false,
          "style": "breakpoint"
        }
      ],
      "labels": [
        {
          "x": 232,
          "y": 6,
          "w": 170,
          "text": "cache_control",
          "tone": "red"
        },
        {
          "x": 20,
          "y": 140,
          "w": 260,
          "text": {
            "zh": "一个字节都不能变",
            "en": "not one byte may change"
          },
          "tone": "edge"
        },
        {
          "x": 350,
          "y": 140,
          "w": 260,
          "text": {
            "zh": "每回合都在变",
            "en": "changes every turn"
          },
          "tone": "edge"
        }
      ]
    },
    "claim": {
      "zh": "没有这条约束，缓存命中就变成随机事件：任何一个悄悄溜进系统提示的时间戳、温度、歌名，都会让整块前缀每回合失效。它是整个上下文装配唯一的硬边界——buildSystemPrompt 返回的那一个 block 上，那一处 cache_control。",
      "en": "Without this constraint, cache hits become a coin flip: one timestamp, temperature or song title that slips into the system prompt invalidates the whole prefix every turn. It is the single hard boundary of the entire assembly — the one cache_control on the one block buildSystemPrompt returns."
    },
    "mechanism": {
      "zh": "断点是位置性的：命中要求断点左边的字节序列与上次完全一致。所以这不是一条建议，而是一条反向约束所有渲染器的全局不变量。三个具体后果:renderCoreBlock 在注释里明文禁止插入时间戳;renderSkillShelf 按名字排序、不带日期不带计数；开机醒来场景本该是系统级设定，却被推进了用户消息里，只为了不让开机这个状态变化改动前缀的一个字节。",
      "en": "The breakpoint is positional: a hit requires the byte sequence to its left to be identical to last time. So this is not a guideline but a global invariant that constrains every renderer in reverse. Three concrete consequences: renderCoreBlock forbids interpolating timestamps in so many words; renderSkillShelf is name-ordered, dateless and countless; and the wake scene, which reads like a system-level stage direction, was pushed down into the user message purely so that booting cannot change one byte of the prefix."
    },
    "contract": {
      "exposes": {
        "zh": "一处 cache_control: { type: \"ephemeral\" } —— 全仓库生产代码里仅此一处。",
        "en": "A single cache_control: { type: \"ephemeral\" } — the only one in production code anywhere in the repo."
      },
      "depends": {
        "zh": "provider 的 promptCache 能力位。OpenAI 协议路径上,systemToOpenAI 只把各 block 的 .text join 起来，断点被直接丢弃。",
        "en": "The provider’s promptCache capability bit. On the OpenAI-protocol path, systemToOpenAI merely joins each block’s .text and the breakpoint is dropped outright."
      },
      "boundary": {
        "zh": "断点左边只允许放跨回合稳定的字节，右边(消息层)什么都可以放。",
        "en": "Only cross-turn-stable bytes may sit left of the breakpoint; anything is allowed to its right, at message level."
      },
      "invariant": {
        "zh": "无记忆写入则两回合 system 字节相同，有写入则必须不同——两条断言都在 l3.test.ts 的同一个用例里。",
        "en": "No memory write means two turns share identical system bytes; a write must change them. Both assertions live in the same l3.test.ts case."
      }
    },
    "code": {
      "file": "packages/server/src/turn/runTurn.ts",
      "lines": "292-299",
      "snippet": "    // Wake scene rides the first user turn after boot — message level, never\n    // system, so the cached system core stays byte-stable across the boot\n    // transition. Persisted as-sent into history like every other block.\n    // A proactive turn is not the user's first contact, so it never consumes it.\n    if (Bun.env['LUNA_PERSONA'] !== '0' && s.session.wakePending && !s.proactiveTurn) {\n      blocks.push({ type: 'text', text: WAKE_SCENE_BLOCK });\n      s.session.wakePending = false;\n    }",
      "note": {
        "zh": "这是断点约束最贵的一笔账：一段语义上属于系统提示的开场设定，为了保住字节稳定被降级成了用户消息里的一块。",
        "en": "This is the breakpoint’s most expensive bill: a stage direction that semantically belongs in the system prompt was demoted to a block inside the user message, purely to keep the bytes stable."
      }
    },
    "decision": {
      "why": {
        "zh": "只留一个断点、一整块前缀，失效判定就退化成一次整数比较(memoryEpoch),而不是逐块 diff。",
        "en": "One breakpoint and one whole prefix reduce invalidation to an integer comparison (memoryEpoch) instead of a per-block diff."
      },
      "rejected": {
        "zh": "把感知块也放进系统提示、再用第二个断点把易变部分隔在后面。没有采用——生产路径至今只有一个断点，感知一律走消息层。",
        "en": "Putting the perception blocks in the system prompt too, with a second breakpoint fencing off the volatile tail. Not taken — production still has exactly one breakpoint, and perception always goes to message level."
      },
      "cost": {
        "zh": "没有分层缓存：一次 remember 就让整块前缀作废。而且这份收益是 provider 相关的——切到 OpenAI 协议路径，断点被 systemToOpenAI 丢掉，显式缓存控制归零。",
        "en": "No layered cache: one remember voids the entire prefix. And the payoff is provider-specific — on the OpenAI-protocol path systemToOpenAI discards the breakpoint and explicit cache control goes to zero."
      }
    }
  },
  "recall": {
    "figure": {
      "w": 620,
      "h": 250,
      "boxes": [
        {
          "x": 14,
          "y": 96,
          "w": 116,
          "h": 56,
          "title": {
            "zh": "候选",
            "en": "candidates"
          },
          "sub": "L2 · L3 · diary · skills"
        },
        {
          "x": 196,
          "y": 26,
          "w": 130,
          "h": 48,
          "title": {
            "zh": "纯余弦",
            "en": "cosine only"
          }
        },
        {
          "x": 196,
          "y": 118,
          "w": 130,
          "h": 48,
          "title": {
            "zh": "混合分",
            "en": "blended"
          },
          "sub": "cos + lex + recency"
        },
        {
          "x": 396,
          "y": 72,
          "w": 130,
          "h": 56,
          "title": {
            "zh": "合并",
            "en": "merge"
          },
          "sub": {
            "zh": "地板在前",
            "en": "floor first"
          }
        }
      ],
      "edges": [
        {
          "pts": [
            [
              134,
              112
            ],
            [
              192,
              56
            ]
          ]
        },
        {
          "pts": [
            [
              134,
              132
            ],
            [
              192,
              142
            ]
          ]
        },
        {
          "pts": [
            [
              330,
              50
            ],
            [
              392,
              88
            ]
          ],
          "label": {
            "zh": "取前 N，且 ≥ 阈值",
            "en": "top N, ≥ threshold"
          },
          "at": [
            246,
            78
          ]
        },
        {
          "pts": [
            [
              330,
              142
            ],
            [
              392,
              116
            ]
          ],
          "label": {
            "zh": "其余按分数填满 k",
            "en": "rest fill k by score"
          },
          "at": [
            246,
            172
          ]
        },
        {
          "pts": [
            [
              530,
              100
            ],
            [
              590,
              100
            ]
          ]
        }
      ],
      "labels": [
        {
          "x": 396,
          "y": 140,
          "w": 210,
          "text": {
            "zh": "一条决定性相关的旧记忆，不会被时近度埋掉",
            "en": "a decisively relevant old memory cannot be buried by recency"
          },
          "tone": "edge"
        },
        {
          "x": 540,
          "y": 80,
          "w": 80,
          "text": "top-k",
          "tone": "red"
        }
      ]
    },
    "claim": {
      "zh": "没有它，她只有最近约 100 轮的逐字窗口，窗口之外的一切等于不存在——三周前那句话既检索不到，也不会自己浮现。它是每个用户回合开头那一步：按这句话的措辞给四类候选打分，选出至多 18 条，拼成一个 <memory> 块塞进未缓存尾部。",
      "en": "Without it she has only the verbatim window of roughly the last 100 turns; anything outside it may as well not exist — a sentence from three weeks ago is neither retrievable nor spontaneously surfaced. It is the first step of every user turn: score four kinds of candidate against the wording of this message, take at most 18, and render them as one <memory> block on the uncached tail."
    },
    "mechanism": {
      "zh": "候选来自四个源:L2 最近 500 轮对话、全部 L3 事实、最近 30 篇日记、至多 500 条技能。每条算三项:recency = 1/(1+天数);importance(未评分 0.4、日记 0.7、技能 0.75);relevance = 0.7×余弦 + 0.3×词法重叠。三项按权重(默认各为 1)取平均。词法侧对中文用滑动 bigram 切词，不依赖任何分词器依赖。技能是特例:recency 项被清零，而且必须有真实信号(词法重叠大于 0,或余弦不低于 0.5)才有资格进榜，否则一次存技能的爆发就会把整个 k 位淹掉。",
      "en": "Candidates come from four sources: the most recent 500 L2 turns, every L3 fact, the last 30 diaries, and up to 500 skills. Each gets three terms: recency = 1/(1+days); importance (0.4 unrated, 0.7 diary, 0.75 skill); relevance = 0.7×cosine + 0.3×lexical overlap. The three are averaged under weights that default to 1 each. On the lexical side, Chinese is tokenized as sliding bigrams, so no segmenter dependency is needed. Skills are the exception: their recency term is zeroed and they need real signal (lexical overlap above 0, or cosine of at least 0.5) to be eligible at all — otherwise one burst of skill saves floods every slot."
    },
    "contract": {
      "exposes": {
        "zh": "retrieve(sessionId, query, opts) 返回 Hit[];renderRecallBlock(hits) 返回 <memory> 块或 null。",
        "en": "retrieve(sessionId, query, opts) returns Hit[]; renderRecallBlock(hits) returns a <memory> block or null."
      },
      "depends": {
        "zh": "embeddings_cache 表，加一个 OpenAI 兼容的 /v1/embeddings 端点。两者缺一，余弦全为 null,整条打分降级成纯词法。",
        "en": "The embeddings_cache table plus an OpenAI-compatible /v1/embeddings endpoint. Missing either makes every cosine null and degrades the whole ranking to lexical-only."
      },
      "boundary": {
        "zh": "主动回合不召回——它的用户文本是内部舞台指示，不是查询；核心记忆仍由系统块注入。",
        "en": "Proactive turns do not recall — their user text is an internal stage direction, not a query; core memory still arrives via the system block."
      },
      "invariant": {
        "zh": "召回结果只进消息层。recall.test.ts 断言：两个完全不同的查询之间，系统块必须字节相同。",
        "en": "Recall output stays at message level. recall.test.ts asserts that two entirely different queries must produce byte-identical system blocks."
      }
    },
    "code": {
      "file": "packages/server/src/memory/recall/recall.ts",
      "lines": "282-294",
      "snippet": "  // Relevance floor: the top floorN by pure cosine (≥ floorMinCos) are guaranteed ahead of the\n  // recency-blended fill, so a decisively-relevant old memory isn't dropped below k. All-null cosine\n  // (embedding off / budget timeout) → empty floor → byScore only (byte-identical to the prior path).\n  const floorN = Number(Bun.env['LUNA_RECALL_FLOOR_N'] ?? 3);\n  const floorMinCos = Number(Bun.env['LUNA_RECALL_FLOOR_MIN_COS'] ?? 0.35);\n  const floor: Hit[] =\n    floorN > 0\n      ? eligible\n          .filter((x): x is { h: Hit; cos: number } => typeof x.cos === 'number' && x.cos >= floorMinCos)\n          .sort((a, b) => b.cos - a.cos)\n          .slice(0, floorN)\n          .map((x) => x.h)\n      : [];",
      "note": {
        "zh": "相关性地板：先按纯余弦挑出至多 3 条(余弦不低于 0.35)插到混合排序最前面，再用混合分填满 18 位。这是唯一一处让相关性直接压过时近的地方。",
        "en": "The relevance floor: up to 3 candidates picked by pure cosine (at least 0.35) are spliced ahead of the blended ranking, and the blended scores then fill the remaining slots up to 18. It is the one place where relevance is allowed to beat recency outright."
      }
    },
    "decision": {
      "why": {
        "zh": "Generative-Agents 那套 α·recency + β·importance + γ·relevance 里，时近项会碾压一切:8 天前的记忆 recency 只有 1/9 约等于 0.11,新鲜的接近 1.0,一个中等的余弦优势根本翻不了盘。地板就是给确实相关但很旧的记忆留三个保底位；查询正常时最相关的本来就是最近的，地板自动是个空操作。",
        "en": "In the Generative-Agents formula α·recency + β·importance + γ·relevance, recency steamrolls everything: an eight-day-old memory scores 1/9 ≈ 0.11 against a fresh candidate near 1.0, and a modest cosine edge cannot close that. The floor reserves three slots for memories that are genuinely relevant but old; on an ordinary query the top-cosine candidates are already the recent ones, so the floor is a no-op."
      },
      "rejected": {
        "zh": "sqlite-vec 的 vec0 向量索引。依赖至今留在 package.json,main.ts 开机还会挂自定义 SQLite,但 v0.16.2 删掉了唯一那条 vec0 写入路径，而加载扩展的 tryLoadVec 在整个仓库里没有任何调用者。真实检索是纯 TypeScript 的余弦全扫描——所谓兜底其实是唯一路径。",
        "en": "A vec0 vector index from sqlite-vec. The dependency is still in package.json and main.ts still points Bun at a custom SQLite at boot, but v0.16.2 deleted the one vec0 write path, and tryLoadVec — the function that loads the extension — has no caller anywhere in the repo. Retrieval is, and stays, a plain TypeScript cosine full scan; the supposed fallback is in fact the only path."
      },
      "cost": {
        "zh": "全扫描的代价随候选数线性增长，单回合最多现场嵌入 64 条冷候选。仓库 .env 里 LUNA_RECALL_ASYNC=1,所以嵌入被 200 毫秒预算掐着——超时这一回合退成纯词法，余弦全为 null,相关性地板也同时失效。",
        "en": "The full scan costs linearly in candidate count, and a single turn embeds at most 64 cold candidates inline. The repo’s .env sets LUNA_RECALL_ASYNC=1, so embedding runs under a 200 ms budget — past it the turn falls back to lexical-only, every cosine is null, and the relevance floor silently disappears with it."
      }
    }
  },
  "perceive": {
    "figure": {
      "w": 620,
      "h": 210,
      "boxes": [
        {
          "x": 12,
          "y": 26,
          "w": 158,
          "h": 44,
          "title": {
            "zh": "后台刷新器",
            "en": "background refresher"
          },
          "sub": ".unref() · TTL"
        },
        {
          "x": 12,
          "y": 118,
          "w": 158,
          "h": 44,
          "title": {
            "zh": "常驻订阅",
            "en": "resident subscription"
          },
          "sub": "'track'"
        },
        {
          "x": 246,
          "y": 72,
          "w": 150,
          "h": 48,
          "title": {
            "zh": "内存快照",
            "en": "in-memory snapshot"
          }
        },
        {
          "x": 448,
          "y": 72,
          "w": 158,
          "h": 48,
          "title": {
            "zh": "同步读",
            "en": "read synchronously"
          },
          "sub": "parse_input"
        }
      ],
      "edges": [
        {
          "pts": [
            [
              174,
              52
            ],
            [
              242,
              84
            ]
          ]
        },
        {
          "pts": [
            [
              174,
              138
            ],
            [
              242,
              110
            ]
          ]
        },
        {
          "pts": [
            [
              400,
              96
            ],
            [
              444,
              96
            ]
          ]
        }
      ],
      "labels": [
        {
          "x": 246,
          "y": 138,
          "w": 350,
          "text": {
            "zh": "热路径零网络：她只是读一眼别人早就放好的东西",
            "en": "zero network on the hot path — she only reads what was already put there"
          },
          "tone": "red"
        }
      ]
    },
    "claim": {
      "zh": "没有它，她要知道现在几点、外面下不下雨、他在听什么，只能烧一次工具调用去查，而实际上往往根本不查。它是每个用户回合开头同步读三份内存快照、在 TS 里格式化成一句人话、推进未缓存尾部的那三个块。",
      "en": "Without it, knowing the time, the weather or what he is listening to costs her a tool call — and in practice she mostly just does not ask. It is the three blocks that, at the top of every user turn, read three in-memory snapshots synchronously, format them into finished sentences in TypeScript, and ride the uncached tail."
    },
    "mechanism": {
      "zh": "三块共享同一条契约：反应路径上绝不发起网络请求。天气由一个 unref 过的后台定时器(默认 30 分钟)刷进内存快照,parse_input 只做一次同步读，快照超过 4 倍 TTL(默认 2 小时)判冷、直接省略这一块。音乐由常驻 provider 的推流写进内存。时间纯 TS 计算。任何一块的构造抛异常都只是 warn 一句、丢掉这一块，绝不掀翻这一回合。音乐块还额外有一道类型层防火墙:builder 的入参类型只有标量字段，几十 KB 的 base64 封面在类型层面就没有门可以进 prompt。",
      "en": "All three share one contract: never touch the network on the reactive path. Weather is refreshed into an in-memory snapshot by an unref’d background timer (30 minutes by default); parse_input only reads it synchronously, and a snapshot older than 4× the TTL (2 hours by default) counts as cold and the block is simply omitted. Music is pushed into memory by the resident provider’s stream. Time is computed purely in TypeScript. If any builder throws, it warns and drops that one block — never the turn. The music block adds a type-level firewall: the builder’s input type has scalar fields only, so tens of kilobytes of base64 artwork have no door into the prompt at all."
    },
    "contract": {
      "exposes": {
        "zh": "buildTimeBlock / buildWeatherBlock / musicBlockFor —— 三个纯粹的同步 formatter,输入是已经取好的事实。",
        "en": "buildTimeBlock, buildWeatherBlock, musicBlockFor — three purely synchronous formatters over already-fetched facts."
      },
      "depends": {
        "zh": "getSnapshot()(后台定时器维护)、getNowPlaying()(常驻 provider)、resolveTz() 与 resolveLocation()。",
        "en": "getSnapshot() (kept warm by the background timer), getNowPlaying() (the resident provider), resolveTz() and resolveLocation()."
      },
      "boundary": {
        "zh": "天气在没配 LUNA_LAT_LON 之前整个休眠：不出 L1 clause,也不出块。",
        "en": "Weather stays entirely dormant until LUNA_LAT_LON is configured — no L1 clause, no block."
      },
      "invariant": {
        "zh": "三块一律进未缓存尾部。三个独立测试分别断言：快照或曲目变化前后，系统块字节相同，且不含任何快照数值、不含歌名。",
        "en": "All three ride the uncached tail. Three separate tests assert that across a snapshot or track change the system block is byte-identical and leaks no snapshot value and no song title."
      }
    },
    "code": {
      "file": "packages/server/src/turn/runTurn.ts",
      "lines": "339-350",
      "snippet": "    // Initiative 14 (v0.21.1): hand her the current weather the same way — a\n    // TS-formatted snapshot read SYNCHRONOUSLY from the background cache, pushed\n    // into the UNCACHED user message (the snapshot is volatile → never the cached\n    // system block). No network call on the reactive path; a cold/stale cache omits it.\n    if (weatherAmbientEnabled()) {\n      try {\n        const snap = getSnapshot();\n        if (snap) blocks.push({ type: 'text', text: buildWeatherBlock(snap) });\n      } catch (e) {\n        console.warn('[weather] buildWeatherBlock failed — omitting the weather block:', e);\n      }\n    }",
      "note": {
        "zh": "同步读 + try/catch 只 warn:感知层被设计成可以整块消失，而不是让这一回合失败。",
        "en": "A synchronous read wrapped in a warn-only try/catch: the perception layer is designed to vanish block by block rather than fail the turn."
      }
    },
    "decision": {
      "why": {
        "zh": "快照是易变的，放进缓存前缀等于每回合炸断点；而且她需要的是一句已经成型的事实，不是让模型去解释原始气象代码。稳定的那一半留在缓存里:L1 契约里有一条不含任何数值的天气 clause,只告诉她能看到用户那边的天气，数值全在尾部。",
        "en": "Snapshots are volatile: putting them in the cached prefix would blow the breakpoint every turn. And what she needs is a finished, labelled fact, not raw weather codes to interpret. The stable half stays cached: the L1 contract carries a data-free weather clause that only tells her she is handed the user’s weather, while every number lives on the tail."
      },
      "cost": {
        "zh": "冷或过期的快照直接省略这一块——她会不知道天气，而不是知道一个两小时前的天气。这是刻意选的失败方向。",
        "en": "A cold or stale snapshot omits the block entirely — she does not know the weather, rather than confidently knowing two-hour-old weather. That failure direction was chosen deliberately."
      }
    }
  },
  "burn": {
    "figure": {
      "w": 620,
      "h": 230,
      "boxes": [
        {
          "x": 12,
          "y": 86,
          "w": 130,
          "h": 50,
          "title": {
            "zh": "换歌",
            "en": "track changes"
          }
        },
        {
          "x": 196,
          "y": 86,
          "w": 150,
          "h": 50,
          "title": {
            "zh": "整首歌词",
            "en": "the whole lyric"
          },
          "sub": {
            "zh": "这一回合给一次",
            "en": "given once, this turn"
          }
        },
        {
          "x": 402,
          "y": 20,
          "w": 206,
          "h": 48,
          "title": {
            "zh": "之后不再出现",
            "en": "never again"
          },
          "sub": {
            "zh": "她从读过里引用",
            "en": "she quotes from having read"
          }
        },
        {
          "x": 402,
          "y": 152,
          "w": 206,
          "h": 48,
          "title": {
            "zh": "额度还回去",
            "en": "the delivery is returned"
          },
          "sub": "unmarkLyricsDelivered"
        }
      ],
      "edges": [
        {
          "pts": [
            [
              146,
              111
            ],
            [
              192,
              111
            ]
          ]
        },
        {
          "pts": [
            [
              350,
              100
            ],
            [
              398,
              50
            ]
          ],
          "label": {
            "zh": "回合落库",
            "en": "turn persisted"
          },
          "at": [
            318,
            62
          ]
        },
        {
          "pts": [
            [
              350,
              122
            ],
            [
              398,
              172
            ]
          ],
          "label": {
            "zh": "回合整轮回滚",
            "en": "turn rolled back"
          },
          "at": [
            300,
            186
          ]
        }
      ],
      "labels": [
        {
          "x": 196,
          "y": 148,
          "w": 190,
          "text": {
            "zh": "块跟着历史走，标记也必须跟着走",
            "en": "the mark must travel with the block"
          },
          "tone": "red"
        }
      ]
    },
    "claim": {
      "zh": "没有它，要么整首歌词每一回合重发，同一首歌重复计费几十回合；要么她根本读不到完整的词，只能靠切当前行假装同步。它是：换歌之后的第一个回合把整首词给一次(至多 60 行 / 2000 字),给完立刻打上 delivered 标记，之后的回合一个字都不再出现。",
      "en": "Without it, either the full lyric is re-sent every turn — the same song billed dozens of times — or she never reads the whole thing and has to fake sync by slicing a current line. It is this: the first turn after a track change carries the entire lyric once (at most 60 lines / 2000 characters), marks it delivered on the spot, and no later turn carries a single word of it."
    },
    "mechanism": {
      "zh": "标记是内存里 enrichment 对象上的一个布尔，随曲目变化重置。真正的难点在回滚:runTurn 只在这一回合确实产出了回复时才落库，否则把 history 长度直接截回回合开始的位置——歌词块跟着一起没了。但标记如果留在那儿，结果就是这首歌的词既不在 prompt 里也不在历史里，而系统仍认为她读过。v0.45.17 让回滚变对称:parse_input 记下这一回合烧掉的是哪一个 trackId,回滚分支调 unmarkLyricsDelivered 把额度还回去，而且只在 trackId 仍然匹配时才还。",
      "en": "The mark is a boolean on the in-memory enrichment object, reset on every track change. The hard part is rollback: runTurn persists only when the turn actually produced a reply, and otherwise truncates history back to where the turn began — taking the lyrics block with it. If the mark survived that, the words would be in neither the prompt nor the past while the system still believed she had read them. v0.45.17 made the rollback symmetric: parse_input records which trackId this turn burned, and the rollback branch calls unmarkLyricsDelivered to hand it back — and only when the trackId still matches."
    },
    "contract": {
      "exposes": {
        "zh": "lyricsBurstFor() 返回块或 null。它带副作用：一旦成功组装，当场就 burn。",
        "en": "lyricsBurstFor() returns a block or null. It is effectful: the moment a block is composed, the delivery is burned."
      },
      "depends": {
        "zh": "TurnState.lyricsBurnedFor —— 把烧掉的是哪一首带到 finally 里的回滚分支。",
        "en": "TurnState.lyricsBurnedFor — it carries which track was burned all the way to the rollback branch in finally."
      },
      "boundary": {
        "zh": "只还同一个 trackId 的额度。回滚发生在换歌之后，不会误伤新曲目那份还没用掉的投递。",
        "en": "Only the same trackId is refunded. A rollback that lands after a track change cannot spend the new track’s untouched delivery."
      },
      "invariant": {
        "zh": "一次播放，整首词最多进 prompt 一次；这一回合被回滚，则一次都不算。lyricsBurst.test.ts 用一个开局就抛的 provider 钉死了后半句。",
        "en": "Per play, the full lyric enters the prompt at most once — and if the turn rolls back, not even once. lyricsBurst.test.ts pins the second half with a provider that throws before the first token."
      }
    },
    "code": {
      "file": "packages/server/src/turn/runTurn.ts",
      "lines": "1070-1075",
      "snippet": "      } else {\n        opts.session.history.length = historyStart;\n        // v0.45.17: the lyrics block just went with it — hand the delivery back so the next\n        // turn can carry the words she never actually received.\n        if (state.lyricsBurnedFor !== null) unmarkLyricsDelivered(state.lyricsBurnedFor);\n      }",
      "note": {
        "zh": "一行截断就撤销了整个回合的历史，所以任何跟着历史走的一次性状态都必须在这里显式归还——这是那类 bug 的全部形状。",
        "en": "One assignment truncates the turn’s entire history, so any one-shot state that rode along with it has to be handed back explicitly right here — that is the whole shape of this class of bug."
      }
    },
    "decision": {
      "why": {
        "zh": "词一旦进过对话历史就已经在上下文里了，重复注入是纯浪费。",
        "en": "Once the lyric has been through the conversation history it is already in context; re-injecting it is pure waste."
      },
      "rejected": {
        "zh": "每回合注入当前那一行、做歌词同步。被否掉的理由是假精度：一个回合本身就有几十秒延迟，切出来的当前行到达时早就不当前了。",
        "en": "Injecting the current line each turn as a lyric-sync feature. Rejected as fake precision: a turn already carries tens of seconds of latency, so the sliced current line is stale by the time it lands."
      },
      "cost": {
        "zh": "她之后引用歌词，靠的是这条历史还在窗口里。一旦被折叠进滚动摘要或被硬裁掉，整首词就真的消失了，没有第二次投递。",
        "en": "Every later quotation depends on that history message still being in the window. Once it is folded into the rolling summary or hard-trimmed away, the lyric is genuinely gone — there is no second delivery."
      }
    }
  },

  /* ── 循环 / agent loop ─────────────────────────── */
  "graph": {
    "figure": {
      "w": 620,
      "h": 220,
      "boxes": [
        {
          "x": 232,
          "y": 88,
          "w": 156,
          "h": 52,
          "title": "runGraph",
          "sub": {
            "zh": "通用编排器",
            "en": "one runner"
          }
        },
        {
          "x": 20,
          "y": 18,
          "w": 160,
          "h": 48,
          "title": {
            "zh": "对话图",
            "en": "turn graph"
          },
          "sub": {
            "zh": "6 节点",
            "en": "6 nodes"
          }
        },
        {
          "x": 20,
          "y": 156,
          "w": 160,
          "h": 48,
          "title": {
            "zh": "梦的图",
            "en": "dream graph"
          },
          "sub": {
            "zh": "8 步",
            "en": "8 steps"
          }
        },
        {
          "x": 440,
          "y": 88,
          "w": 160,
          "h": 52,
          "title": {
            "zh": "每次跃迁",
            "en": "every transition"
          },
          "sub": "onTransition → trace"
        }
      ],
      "edges": [
        {
          "pts": [
            [
              184,
              46
            ],
            [
              228,
              100
            ]
          ]
        },
        {
          "pts": [
            [
              184,
              176
            ],
            [
              228,
              128
            ]
          ]
        },
        {
          "pts": [
            [
              392,
              114
            ],
            [
              436,
              114
            ]
          ]
        }
      ],
      "labels": [
        {
          "x": 20,
          "y": 96,
          "w": 200,
          "text": {
            "zh": "同一台状态机跑两张图——所以观测只有一个接缝",
            "en": "one machine, two graphs — so observability needs only one seam"
          },
          "tone": "edge"
        }
      ]
    },
    "claim": {
      "zh": "没有这一层，一次回合的控制流就是一坨嵌套的 while 与 if：加一条回边等于改流程骨架，梦的八步还得再写一份同样的调度。它是十五行的通用 runGraph——节点自己返回下一个节点名，循环只负责走和记账。",
      "en": "Without this layer a turn's control flow is a nest of whiles and ifs: adding one back-edge means rewriting the skeleton, and the dream cycle's eight steps need a second copy of the same scheduler. It is a fifteen-line generic runGraph — each node returns the name of the next node, and the loop only walks and only keeps the books."
    },
    "mechanism": {
      "zh": "类型参数把状态 S 和节点名集合 N 都放开，所以同一个 runGraph 跑两张图：回合图六个节点（parse_input、build_request、open_stream、dispatch_tools、append_results、finalize），梦图八个节点（rate_salience 到 rag_refresh）。两张图的形状不一样——回合图有回边，下一步由节点现算；梦图没有回边，nextNode 按一个固定的 ORDER 数组取下一位，某一步失败也照样往前走。runGraph 本身只多做一件事：每次转移调一次 onTransition。回合把它接到 trace 上，于是 node_from / node_to 是一条不用额外埋点的执行轨迹；梦不传这个钩子，自己在 runStep 里记。",
      "en": "The type parameters leave both the state S and the node-name union N open, so one runGraph drives two graphs: the turn graph with six nodes (parse_input, build_request, open_stream, dispatch_tools, append_results, finalize) and the dream graph with eight (rate_salience through rag_refresh). Their shapes differ — the turn graph has back-edges and computes the next step at runtime; the dream graph has none, nextNode just steps through a fixed ORDER array, and a failed step still advances. runGraph itself does exactly one extra thing: it calls onTransition on every transition. The turn wires that into trace, so node_from / node_to is an execution trail nobody had to instrument; the dream passes no hook and records inside runStep instead."
    },
    "contract": {
      "exposes": {
        "zh": "runGraph(graph, start, state, onTransition?)，加上 NodeFn / Graph / TransitionHook 三个类型和 TurnNode 联合类型。",
        "en": "runGraph(graph, start, state, onTransition?), plus the NodeFn / Graph / TransitionHook types and the TurnNode union."
      },
      "depends": {
        "zh": "只依赖节点函数本身。graph.ts 没有任何 import，不知道 provider、不知道 session、不知道数据库。",
        "en": "Only on the node functions. graph.ts has no imports at all — it knows nothing of the provider, the session, or the database."
      },
      "boundary": {
        "zh": "不管重试、不管预算、不管超时、不管并发。这些全是节点自己的事。",
        "en": "It does not handle retries, budgets, timeouts, or concurrency. Every one of those belongs to the nodes."
      },
      "invariant": {
        "zh": "循环只在某个节点返回 end 时退出；节点抛错就让整个 runGraph 抛出去，由 runTurn 在外面兜住并转成 finishReason error。",
        "en": "The loop exits only when a node returns end; a node that throws throws out of runGraph entirely, and runTurn catches it outside and turns it into finishReason 'error'."
      }
    },
    "code": {
      "file": "packages/server/src/turn/graph.ts",
      "lines": "20-28",
      "snippet": "  let current: N | 'end' = start;\n  onTransition?.('_', current, state);\n  while (current !== 'end') {\n    const from: N = current;\n    const next: N | 'end' = await graph[from](state);\n    onTransition?.(from, next, state);\n    current = next;\n  }\n}",
      "note": {
        "zh": "整个编排器就是这九行：下一步由节点算出来，循环只负责走，并把每一次转移交给 onTransition。",
        "en": "The whole orchestrator is these nine lines: the node computes the next step, the loop only walks, and it hands every transition to onTransition."
      }
    },
    "decision": {
      "why": {
        "zh": "一个编排器两张图，回合和梦共享同一条观测缝（node_from / node_to），追踪代码只写一遍；换图不换循环。",
        "en": "One orchestrator, two graphs: the turn and the dream share one observation seam (node_from / node_to), so the tracing is written once; swap the graph, keep the loop."
      },
      "cost": {
        "zh": "图的形状散在各节点的 return 里，没有一处能一眼读全的边表——两条回边只能靠读 append_results 和 finalize 的返回值找出来。",
        "en": "The graph's shape is scattered across each node's return statements; there is no single edge table to read. The two back-edges can only be found by reading what append_results and finalize return."
      }
    }
  },
  "edge1": {
    "figure": {
      "w": 620,
      "h": 190,
      "boxes": [
        {
          "x": 40,
          "y": 66,
          "w": 156,
          "h": 52,
          "title": "append_results"
        },
        {
          "x": 384,
          "y": 20,
          "w": 196,
          "h": 46,
          "title": {
            "zh": "回到 ②",
            "en": "back to ②"
          },
          "sub": {
            "zh": "还有工具要跑",
            "en": "more tools to run"
          }
        },
        {
          "x": 384,
          "y": 116,
          "w": 196,
          "h": 46,
          "title": "finalize",
          "sub": {
            "zh": "预算用完 / 短路",
            "en": "budget spent, or short-circuit"
          }
        }
      ],
      "edges": [
        {
          "pts": [
            [
              200,
              82
            ],
            [
              380,
              44
            ]
          ]
        },
        {
          "pts": [
            [
              200,
              102
            ],
            [
              380,
              138
            ]
          ]
        }
      ],
      "labels": [
        {
          "x": 40,
          "y": 130,
          "w": 300,
          "text": {
            "zh": "这条边就是「循环」——没有它，agent 只是一次调用",
            "en": "this edge is the loop; without it an agent is just one call"
          },
          "tone": "red"
        }
      ]
    },
    "claim": {
      "zh": "没有这条回边，工具结果就永远送不回模型：她能调 web_search，却拿不到搜索结果再开口。它是 append_results 的默认出口——把这一轮的工具结果按原调用顺序拼成一条 user 消息压进 history，然后回到 build_request 开下一轮。",
      "en": "Without this back-edge, tool results never return to the model: she can call web_search but never gets to speak with what it found. It is append_results’ default exit — this round’s results, reordered to match the calls, pushed into history as one user message, then back to build_request for another round."
    },
    "mechanism": {
      "zh": "这条边是无条件的默认出口，写在函数最后一行；函数体里的三个 return finalize 才是例外——轮数上限、主动回合的调用数上限、以及 is_final 短路。结果块按 pendingToolUses 的顺序重排，不是按完成顺序，因为 API 要求每个 tool_use 对上一个 tool_result；找不到结果的调用被 filter 掉而不是补空。s.iteration 只在这里自增一次，是全文件唯一的自增点——所以「一轮」的定义就是「工具结果回灌了一次」，而不是「模型被调用了一次」。",
      "en": "This edge is the unconditional default, written on the function’s last line; the three return-finalize statements in the body are the exceptions — the round cap, the proactive call cap, and the is_final short-circuit. Result blocks are reordered to follow pendingToolUses, not completion order, because the API requires each tool_use to be matched by a tool_result; a call with no result is filtered out rather than padded. s.iteration is incremented here and nowhere else in the file — so one round means one feed-back of tool results, not one model call."
    },
    "contract": {
      "exposes": {
        "zh": "返回 build_request（默认）或 finalize（三个提前出口）。",
        "en": "Returns 'build_request' (the default) or 'finalize' (three early exits)."
      },
      "depends": {
        "zh": "pendingToolUses（本轮的 tool_use）、toolResultBlocks（dispatch_tools 填好的）、maxToolIterations()、maxProactiveActions()。",
        "en": "pendingToolUses (this round’s tool_use blocks), toolResultBlocks (filled by dispatch_tools), maxToolIterations(), maxProactiveActions()."
      },
      "boundary": {
        "zh": "不判断结果对不对、有没有用，只负责把它们按顺序还回去；err 结果照样回灌。",
        "en": "It does not judge whether results are correct or useful, only that they go back in the right order; error results are fed back just the same."
      },
      "invariant": {
        "zh": "每经过一次 append_results，s.iteration 恰好加一，且回灌的 tool_result 数不超过本轮 tool_use 数。",
        "en": "Every pass through append_results increments s.iteration by exactly one, and never feeds back more tool_results than there were tool_uses."
      }
    },
    "code": {
      "file": "packages/server/src/turn/runTurn.ts",
      "lines": "626-637",
      "snippet": "    s.session.history.push({ role: 'user', content: ordered });\n    s.iteration += 1;\n    if (s.iteration >= maxToolIterations()) {\n      s.finishReason = 'max_iterations';\n      return 'finalize';\n    }\n    // Proactive action budget (v0.10.1): a runaway-loop backstop on top of the\n    // round cap, only for autonomous proactive cycles.\n    if (s.proactiveTurn && s.toolNamesThisTurn.length >= maxProactiveActions()) {\n      s.finishReason = 'max_iterations';\n      return 'finalize';\n    }",
      "note": {
        "zh": "两个提前出口写的是同一个 finishReason（max_iterations），而回边本身是函数末尾第 679 行那一句 return build_request——默认不写条件，例外才写。",
        "en": "Both early exits set the same finishReason ('max_iterations'), while the back-edge itself is the bare return 'build_request' on line 679 — the default carries no condition, only the exceptions do."
      }
    },
    "decision": {
      "why": {
        "zh": "结果回灌是默认路径，提前收尾才是需要理由的那一侧，所以每个例外都写成显式的 return，读代码时能一眼数清有几个出口。",
        "en": "Feeding results back is the default path and stopping early is the side that needs a reason, so each exception is an explicit return — you can count the exits at a glance."
      },
      "cost": {
        "zh": "这条边不看内容：一轮里全是失败结果也照样回灌一整轮，止损完全交给上面两个计数上限。",
        "en": "The edge is content-blind: a round of nothing but failures is fed back in full, and the only brake is the two counters above it."
      }
    }
  },
  "edge2": {
    "figure": {
      "w": 620,
      "h": 200,
      "boxes": [
        {
          "x": 34,
          "y": 74,
          "w": 140,
          "h": 52,
          "title": "finalize"
        },
        {
          "x": 262,
          "y": 16,
          "w": 168,
          "h": 44,
          "title": {
            "zh": "空回复闸",
            "en": "empty-reply guard"
          }
        },
        {
          "x": 262,
          "y": 82,
          "w": 168,
          "h": 44,
          "title": {
            "zh": "完整性闸",
            "en": "integrity guard"
          }
        },
        {
          "x": 464,
          "y": 48,
          "w": 142,
          "h": 46,
          "title": {
            "zh": "回到 ②",
            "en": "back to ②"
          },
          "sub": {
            "zh": "每种原因一次",
            "en": "once per reason"
          }
        }
      ],
      "edges": [
        {
          "pts": [
            [
              178,
              88
            ],
            [
              258,
              42
            ]
          ]
        },
        {
          "pts": [
            [
              178,
              104
            ],
            [
              258,
              102
            ]
          ]
        },
        {
          "pts": [
            [
              434,
              40
            ],
            [
              460,
              60
            ]
          ]
        },
        {
          "pts": [
            [
              434,
              100
            ],
            [
              460,
              82
            ]
          ]
        }
      ],
      "labels": [
        {
          "x": 262,
          "y": 142,
          "w": 340,
          "text": {
            "zh": "两道闸各有各的水位线，纠过一次就不再纠——不会打转",
            "en": "each guard has its own watermark; corrected once, never again — no spinning"
          },
          "tone": "edge"
        }
      ]
    },
    "claim": {
      "zh": "没有这两道闸，一个回合可以合法地一句话不说就结束，或者说了「我去查一下」然后什么也没查——她在对话上已经赖了账，系统却认为回合正常收尾。它们是 finalize 里的两个纠正出口：各自把一条 user 角色的舞台指示压进 history，然后回到 build_request，再给她一次机会。",
      "en": "Without these two gates a turn may legally end without saying anything, or say I will go look that up and never look anything up — she has broken her word in the conversation while the system considers the turn cleanly finished. They are finalize’s two corrective exits: each pushes a user-role stage direction into history and returns to build_request, giving her one more chance."
    },
    "mechanism": {
      "zh": "第一道是空回复闸：message 模式下，一个反应式回合、finishReason 是 end_turn、却一条 message 都没发出，就补一条 SILENT_TURN_DIRECTIVE 回去。主动回合豁免这道闸，因为沉默是主动回合的合法结果。第二道是行动完整性闸：她确实说了话且干净收尾，但 detectDefection 判出赖账——结构性的（最后一条标了 is_final:false 却停了），或者文本性的（气泡里出现承诺去做的措辞，而整个回合没有任何非 message 工具落地）。两道闸的终点都是 build_request；防死循环靠 correctionUsed 这个只有三格的 Set：empty、promise、intent 各只纠正一次，同一个原因第二次触发就只记一条 degraded 决策然后放行。第三类 thinking_intent 因为思考是摘要过的、置信度低，只进审计，永远不驱动纠正。",
      "en": "The first gate is the empty-reply guard: in message mode, a reactive turn that ends with finishReason end_turn having delivered no message gets one SILENT_TURN_DIRECTIVE pushed back. Proactive turns are exempt — silence is a legitimate outcome there. The second is the action-integrity guard: she did speak and did end cleanly, but detectDefection found a defection — structural (the last message was marked is_final:false and then she stopped) or textual (a delivered bubble promised an act while no non-message tool fired all turn). Both gates land on build_request; the anti-loop bound is correctionUsed, a Set with exactly three slots — empty, promise, intent each correct at most once, and a second hit on the same reason only records a degraded decision and lets the turn through. The third kind, thinking_intent, is audit-only and never drives a retry, because summarized thinking is low-confidence by construction."
    },
    "contract": {
      "exposes": {
        "zh": "返回 build_request（纠正）或 end（收尾，并发出 turn.result）。",
        "en": "Returns 'build_request' (correct) or 'end' (settle and emit turn.result)."
      },
      "depends": {
        "zh": "detectDefection（纯函数，零 LLM 调用，与审计用的是同一份实现）、correctionUsed / correctionWatermark、pushDirective。",
        "en": "detectDefection (pure, zero LLM calls, the same implementation the audit uses), correctionUsed / correctionWatermark, pushDirective."
      },
      "boundary": {
        "zh": "两道闸都只在 finishReason 是 end_turn 时判。撞了预算上限（max_iterations）或中途报错的回合，两道闸一道都不跑。",
        "en": "Both gates only apply when finishReason is end_turn. A turn that hit a budget cap (max_iterations) or errored out runs neither of them."
      },
      "invariant": {
        "zh": "一个回合最多三条纠正回边（每个原因一条），所以 finalize 这一侧的回边数有硬上界，与轮数上限无关。",
        "en": "A turn produces at most three corrective back-edges (one per reason), so this side of the loop has a hard bound of its own, independent of the round cap."
      }
    },
    "code": {
      "file": "packages/server/src/turn/runTurn.ts",
      "lines": "735-748",
      "snippet": "        if (d.defected && d.kind !== 'thinking_intent') {\n          const reason = d.kind === 'is_final_promise' ? 'promise' : 'intent';\n          if (!s.correctionUsed.has(reason)) {\n            s.correctionUsed.add(reason);\n            s.correctionWatermark = s.messageTexts.length;\n            emitGuardDecision(s, 'corrected', d.kind, d.matched);\n            pushDirective(\n              s,\n              d.kind === 'is_final_promise' ? PROMISE_BROKEN_DIRECTIVE : INTENT_NO_ACT_DIRECTIVE,\n            );\n            return 'build_request';\n          }\n          // already corrected this reason once → degrade, don't loop\n          emitGuardDecision(s, 'degraded', d.kind, d.matched);",
      "note": {
        "zh": "correctionUsed 是上界，correctionWatermark 是切片起点：纠正之后只审「这次纠正以后新发的气泡」，所以那句已经被纠正过的话不会被反复判成新的赖账。最后一行的 degraded 就是不再纠正、如实记账的出口。",
        "en": "correctionUsed is the bound and correctionWatermark is the slice point: after a correction only bubbles delivered since then are judged, so the already-corrected line is never re-flagged as a fresh defection. The degraded call on the last line is the exit that stops correcting and records the truth instead."
      }
    },
    "decision": {
      "why": {
        "zh": "纠正写成 user 角色的舞台指示，不是 system（v0.27.1 的 hoisting 教训）。而且气泡在 finalize 之前就已经流式送达了——重试只能接着往下说，不能撤回，所以指示词写的是继续，不是更正。",
        "en": "Corrections are user-role stage directions, never system (the v0.27.1 hoisting lesson). And bubbles have already streamed out before finalize runs — a retry can only continue, never retract — so the directive says carry on, not take it back."
      },
      "rejected": {
        "zh": "硬阻断被否掉了：intent 的指示词给的是双出口（能做就现在做，真做不到就自然继续），因为意图检测是一组模糊正则，假阳性的代价只能是一次温和的再提示，不能是一次错判的封杀。让她口头收回也被否掉——v0.27.6 发现气泡早已送达，再补一条走回头路的气泡读起来像在对自己道歉。",
        "en": "A hard block was rejected: the intent directive offers a double exit (follow through if you can, otherwise simply carry on), because intent detection is a set of fuzzy regexes and a false positive must cost one gentle re-prompt, never a wrong block. Making her verbally walk it back was rejected too — v0.27.6 found the bubble was already delivered, and a second contradicting bubble read as apologizing to herself."
      },
      "cost": {
        "zh": "每一次纠正都是一次完整的模型往返；而 correctionUsed 只有三格，同一个原因第二次犯就只能降级放行——保证终止，代价是不保证纠正成功。",
        "en": "Every correction costs a full model round-trip, and correctionUsed has only three slots — a second offense of the same kind can only be degraded through. Termination is guaranteed; success is not."
      }
    }
  },
  "budget": {
    "figure": {
      "w": 620,
      "h": 190,
      "boxes": [
        {
          "x": 30,
          "y": 40,
          "w": 240,
          "h": 50,
          "title": "MAX_TOOL_ITERATIONS",
          "sub": {
            "zh": "管轮数 · 8",
            "en": "counts rounds · 8"
          }
        },
        {
          "x": 30,
          "y": 116,
          "w": 240,
          "h": 50,
          "title": "PROACTIVE_MAX_ACTIONS",
          "sub": {
            "zh": "管调用数 · 8",
            "en": "counts calls · 8"
          }
        },
        {
          "x": 372,
          "y": 78,
          "w": 210,
          "h": 50,
          "title": {
            "zh": "两把不同的尺",
            "en": "two different rulers"
          },
          "sub": {
            "zh": "同一个数字，不同单位",
            "en": "same number, different unit"
          }
        }
      ],
      "edges": [
        {
          "pts": [
            [
              274,
              62
            ],
            [
              368,
              92
            ]
          ]
        },
        {
          "pts": [
            [
              274,
              138
            ],
            [
              368,
              114
            ]
          ]
        }
      ],
      "labels": [
        {
          "x": 30,
          "y": 4,
          "w": 400,
          "text": {
            "zh": "一轮里可以有很多次调用——所以两个预算不是一回事",
            "en": "one round may hold many calls — so the two budgets are not the same thing"
          },
          "tone": "edge"
        }
      ]
    },
    "claim": {
      "zh": "没有它们，一次工具循环可以一直转到把上下文烧穿为止，而账单是唯一的警报——39 万 token 那次事故就是这么来的。两个上限默认都是 8，但管的不是同一件事：一个数轮，一个数调用次数。",
      "en": "Without them a tool loop can spin until it burns through the context window, with the bill as the only alarm — that is exactly how the 390K-token incident happened. Both default to 8, but they do not govern the same thing: one counts rounds, the other counts calls."
    },
    "mechanism": {
      "zh": "MAX_TOOL_ITERATIONS 数的是轮：工具结果每回灌一次加一，到 8 就收尾，反应式和主动回合一视同仁，可用 LUNA_MAX_TOOL_ITERATIONS 覆盖（NaN 或小于等于 0 落回默认）。maxProactiveActions() 数的是调用次数：toolNamesThisTurn 的长度，只在主动回合生效，读 LUNA_PROACTIVE_MAX_ACTIONS，默认 8。之所以要两个，是因为一轮可以并发调好几个工具：主动漫游那条链（搜 1 次 + fetch 2 到 3 次 + remember 1 到 2 次）常常轮数还早，调用数先贴脸。两处检查都在 append_results，都发生在这一轮工具已经跑完之后，所以本轮内可以先超一点再停；两处都写成 finishReason 是 max_iterations，从外面看不出是哪个先响。",
      "en": "MAX_TOOL_ITERATIONS counts rounds: plus one each time tool results are fed back, stop at 8, applied to reactive and proactive turns alike, overridable via LUNA_MAX_TOOL_ITERATIONS (NaN or <= 0 falls back to the default). maxProactiveActions() counts calls: the length of toolNamesThisTurn, applied only on a proactive turn, read from LUNA_PROACTIVE_MAX_ACTIONS, default 8. Two are needed because one round can dispatch several tools at once: a quiet-wander chain (1 search + 2-3 fetches + 1-2 remembers) tends to press the call ceiling long before the round ceiling. Both checks sit in append_results, both run after that round’s tools have already executed, so a round can overshoot slightly before stopping; and both set finishReason to max_iterations, so from outside you cannot tell which one fired."
    },
    "contract": {
      "exposes": {
        "zh": "常量 MAX_TOOL_ITERATIONS（值为 8）、maxToolIterations()、maxProactiveActions()。",
        "en": "The constant MAX_TOOL_ITERATIONS (8), maxToolIterations(), maxProactiveActions()."
      },
      "depends": {
        "zh": "Bun.env，每次调用现读，不是启动时快照——调 env 不用改代码。",
        "en": "Bun.env, read at call time rather than snapshotted at boot — tuning needs no code change."
      },
      "boundary": {
        "zh": "只封「一个回合能转多久」。她一天能主动漫游几次是另一层（quietWork 的日额度），这两个数管不着。",
        "en": "They bound only how long one turn may spin. How many times a day she may wander at all is a different layer (quietWork’s daily budget), which these two numbers do not touch."
      },
      "invariant": {
        "zh": "计入调用数的只有真正派发出去的调用（message 也算）；被主动安全闸挡下的那次显式不计数，名字校验失败的那次也不计。",
        "en": "Only actually dispatched calls count toward the call budget (message included); a call blocked by the proactive safety gate is explicitly not counted, and neither is one whose tool name failed validation."
      }
    },
    "code": {
      "file": "packages/server/src/turn/runTurn.ts",
      "lines": "52-60",
      "snippet": "export const MAX_TOOL_ITERATIONS = 8;\n// v0.45.12 (C5): the round cap, overridable — quiet-agency wander chains (search→open→read→\n// remember) run close to 8; the owner can widen without a code change. NaN/≤0 → the default.\n// NB the PROACTIVE budget is a different knob: LUNA_PROACTIVE_MAX_ACTIONS caps total tool\n// CALLS in a proactive cycle (safetyGate) — rounds here, calls there.\nexport function maxToolIterations(): number {\n  const v = Number(Bun.env['LUNA_MAX_TOOL_ITERATIONS']);\n  return Number.isFinite(v) && v > 0 ? v : MAX_TOOL_ITERATIONS;\n}",
      "note": {
        "zh": "注释里那句 rounds here, calls there 就是两者的分工；NaN 或小于等于 0 落回默认 8，所以一个手滑的 env 值不会把上限变成 0。",
        "en": "The comment’s rounds here, calls there is the whole division of labour; NaN or <= 0 falls back to 8, so a fat-fingered env value cannot set the ceiling to zero."
      }
    },
    "decision": {
      "why": {
        "zh": "轮上限管的是「循环不收敛」，调用上限管的是「一轮里铺得太开」，一个数管不了两件事。v0.45.12 只把轮上限做成可调，v0.45.13 才认账：主动漫游的真约束是调用数，把它从 6 提到 8。",
        "en": "The round cap governs a loop that will not converge; the call cap governs a single round that fans out too wide. One number cannot do both. v0.45.12 made only the round cap tunable; v0.45.13 admitted the real constraint on a wander is the call count and raised it from 6 to 8."
      },
      "cost": {
        "zh": "两个上限共用 max_iterations 这一个 finishReason，trace 里分不出是谁触发的；而且检查在派发之后，所以这两个数是「不早于」而不是「不超过」。",
        "en": "Both caps share the single finishReason max_iterations, so a trace cannot tell them apart; and because the check runs after dispatch, the numbers mean not sooner than rather than never more than."
      }
    }
  },
  "shortcut": {
    "figure": {
      "w": 620,
      "h": 200,
      "boxes": [
        {
          "x": 14,
          "y": 74,
          "w": 168,
          "h": 52,
          "title": "is_final: true",
          "sub": {
            "zh": "这一轮全是 message",
            "en": "message-only round"
          }
        },
        {
          "x": 274,
          "y": 16,
          "w": 172,
          "h": 46,
          "title": {
            "zh": "直接收束",
            "en": "straight to finalize"
          },
          "sub": {
            "zh": "省一个往返",
            "en": "one round-trip saved"
          }
        },
        {
          "x": 274,
          "y": 122,
          "w": 172,
          "h": 46,
          "title": {
            "zh": "照常再跑一轮",
            "en": "take the extra round"
          },
          "sub": {
            "zh": "意图还没兑现",
            "en": "an intent still unmet"
          }
        }
      ],
      "edges": [
        {
          "pts": [
            [
              186,
              90
            ],
            [
              270,
              44
            ]
          ]
        },
        {
          "pts": [
            [
              186,
              110
            ],
            [
              270,
              142
            ]
          ],
          "style": "dashed"
        }
      ],
      "labels": [
        {
          "x": 274,
          "y": 74,
          "w": 330,
          "text": {
            "zh": "例外：她刚说了「我去查一下」——那一轮正是要去查的那轮，不能省",
            "en": "the exception: she just promised to look something up, and that round is the looking"
          },
          "tone": "red"
        }
      ]
    },
    "claim": {
      "zh": "没有它，她说完最后一句之后还要再花一次完整的模型往返去确认「我说完了」；这段时间 activeTurn 还锁着，用户此刻发的消息会被 turn_in_progress 弹回来，而屏幕上她的回复看起来早就说完了。它把这次纯确认的往返省掉：这一轮只调了 message、且最后一条标了 is_final:true，就直接去 finalize。",
      "en": "Without it, after her last sentence she still spends a full model round-trip confirming that she is done; during that window activeTurn stays locked, so a message the user sends right then bounces with turn_in_progress while her reply already looks finished on screen. It removes that purely confirmatory round-trip: if this round called only message and the last one was marked is_final:true, go straight to finalize."
    },
    "mechanism": {
      "zh": "触发要同时满足四条：不是主动回合、registry 里挂着 message 工具、最后一条消息的 is_final 是 true、本轮 pendingToolUses 非空且每一个都叫 message。要求 message-only 是因为真动作工具（比如同一轮里的 web_search）的结果必须回灌给她，那一轮省不掉。省掉的只是往返本身：短路把 finishReason 定成 end_turn，finalize 的三道判定照常跑，所以真赖账仍然会被打回 build_request。例外只有一个——如果现在就去 finalize 会立刻触发一次全新的 intent 纠正，就不短路。这个例外的条件是三条同时成立：LUNA_INTEGRITY_GUARD 不等于 0；这个回合还没用掉 intent 那一格纠正；detectDefection 在「上次纠正之后新发的气泡」上判出 message_intent，也就是气泡里有承诺去做的措辞，而整个回合到此为止没有落地任何非 message 工具。理由是：被省掉的那一轮，恰恰是她本来会去兑现承诺的那一轮（说了我去查一下 + is_final:true）；短路掉，就会把一次本来能自然兑现的机会，变成一次不必要的纠正。",
      "en": "Four conditions must hold together: not a proactive turn; the message tool is mounted in the registry; the last message’s is_final is true; and pendingToolUses is non-empty with every entry named message. Message-only is required because a real action tool in the same round (web_search, say) has a result that must be fed back — that round cannot be skipped. Only the round-trip is skipped: the short-circuit sets finishReason to end_turn, so finalize’s three checks run as usual and a genuine defection still loops back to build_request. There is exactly one exception — do not short-circuit if finalizing right now would trip a fresh intent correction. That exception requires three things at once: LUNA_INTEGRITY_GUARD is not 0; the intent slot has not been spent this turn; and detectDefection, over the bubbles delivered since the last correction, returns message_intent — a bubble that promised an act while no non-message tool has fired all turn. The reason: the round being skipped is precisely the one where she would have made good on that promise; skipping it would convert a chance to follow through naturally into an unnecessary correction."
    },
    "contract": {
      "exposes": {
        "zh": "返回 finalize（短路）或 build_request（不短路，含例外分支）。",
        "en": "Returns 'finalize' (short-circuited) or 'build_request' (not, including the exception branch)."
      },
      "depends": {
        "zh": "lastMessageIsFinal（dispatch_tools 在投递 message 时记下的）、isMessageMode、detectDefection、correctionUsed / correctionWatermark。",
        "en": "lastMessageIsFinal (recorded by dispatch_tools when a message is delivered), isMessageMode, detectDefection, correctionUsed / correctionWatermark."
      },
      "boundary": {
        "zh": "只省一次模型往返，不改任何已送达的内容——气泡在 finalize 之前就已经流式发出去了。",
        "en": "It saves one model round-trip and changes nothing already delivered — bubbles have streamed out before finalize ever runs."
      },
      "invariant": {
        "zh": "短路把 finishReason 定成 end_turn，所以 finalize 的三道判定（empty、promise、intent）在短路后一道不少。",
        "en": "The short-circuit sets finishReason to end_turn, so all three finalize checks (empty, promise, intent) still apply afterwards."
      }
    },
    "code": {
      "file": "packages/server/src/turn/runTurn.ts",
      "lines": "661-673",
      "snippet": "      const freshIntentRetry =\n        Bun.env['LUNA_INTEGRITY_GUARD'] !== '0' &&\n        !s.correctionUsed.has('intent') &&\n        (() => {\n          const d = detectDefection({\n            messageTexts: s.messageTexts.slice(s.correctionWatermark),\n            lastIsFinal: s.lastMessageIsFinal,\n            thinking: s.thinking,\n            calledToolNames: s.toolNamesThisTurn,\n            finishReason: 'end_turn',\n          });\n          return d.defected && d.kind === 'message_intent';\n        })();",
      "note": {
        "zh": "例外判的不是「有没有承诺」，而是「现在收尾会不会立刻触发一次还没用过的 intent 纠正」——所以同一个回合里第二次就不再避让，免得短路和纠正互相推。",
        "en": "The exception does not ask whether a promise was made but whether finalizing now would immediately trip an intent correction that has not been spent yet — so the second time in a turn it stops yielding, and short-circuit and correction cannot push each other around."
      }
    },
    "decision": {
      "why": {
        "zh": "这是延迟修复，不是行为修复：干净的收尾（常见情况，一句普通的道别）白省一轮；不干净的收尾一步不省。",
        "en": "This is a latency fix, not a behavior fix: a clean sign-off (the common case, a plain conversational goodbye) saves a round for free, and an unclean one saves nothing."
      },
      "rejected": {
        "zh": "「只要 is_final:true 就无条件短路」被否掉，原因就是承诺去查却还没查的那一类回合：省掉尾轮等于取消她兑现承诺的窗口。",
        "en": "Short-circuiting unconditionally on is_final:true was rejected, precisely because of the turn that promised a lookup and has not done it: skipping the trailing round cancels her window to follow through."
      },
      "cost": {
        "zh": "被省掉的那一轮里，她本来还有机会自己想起来做点什么。现在这个机会只在 detectDefection 判出承诺时才保留——那组正则判不出的承诺，机会就没了。",
        "en": "In the round that is skipped she might have thought of something to do on her own. That opening is now preserved only when detectDefection sees a promise — a promise those regexes miss loses it."
      }
    }
  },

  /* ── 工具 / tool interface ─────────────────────────── */
  "count": {
    "figure": {
      "w": 620,
      "h": 190,
      "boxes": [
        {
          "x": 16,
          "y": 66,
          "w": 150,
          "h": 52,
          "title": {
            "zh": "Zod schema",
            "en": "Zod schema"
          },
          "sub": {
            "zh": "唯一的真相",
            "en": "the single truth"
          }
        },
        {
          "x": 244,
          "y": 14,
          "w": 156,
          "h": 46,
          "title": "TS 类型",
          "sub": {
            "zh": "编译期",
            "en": "compile time"
          }
        },
        {
          "x": 244,
          "y": 78,
          "w": 156,
          "h": 46,
          "title": "JSON Schema",
          "sub": {
            "zh": "给模型看",
            "en": "for the model"
          }
        },
        {
          "x": 244,
          "y": 128,
          "w": 156,
          "h": 44,
          "title": {
            "zh": "运行时校验",
            "en": "runtime check"
          },
          "sub": {
            "zh": "入口拦截",
            "en": "at the boundary"
          }
        },
        {
          "x": 452,
          "y": 78,
          "w": 154,
          "h": 46,
          "title": {
            "zh": "28 个工具",
            "en": "28 tools"
          }
        }
      ],
      "edges": [
        {
          "pts": [
            [
              170,
              82
            ],
            [
              240,
              38
            ]
          ]
        },
        {
          "pts": [
            [
              170,
              92
            ],
            [
              240,
              100
            ]
          ]
        },
        {
          "pts": [
            [
              170,
              104
            ],
            [
              240,
              148
            ]
          ]
        },
        {
          "pts": [
            [
              404,
              101
            ],
            [
              448,
              101
            ]
          ]
        }
      ],
      "labels": []
    },
    "claim": {
      "zh": "没有一份收敛的工具清单，模型对世界的意图就只能停留在自然语言里 —— 没有可校验的动作面，也没有地方声明一次调用要花多久、能不能并发、主动轮里能不能静悄悄地跑。Luna 的动作面是 protocol 包里一个 28 条的 ToolName 枚举，每个工具用 Zod 定义入参，发给模型前逐个转成 JSON Schema。",
      "en": "Without a closed list of tools, the model can only phrase its intent toward the world in prose — no verifiable action surface, and nowhere to declare how long a call may take, whether it can run concurrently, or whether it may run silently in a proactive turn. Luna's action surface is a 28-entry ToolName enum in the protocol package; each tool declares its input in Zod, and every input is converted to JSON Schema before it reaches the model."
    },
    "mechanism": {
      "zh": "ToolName 是 protocol 里的 z.enum,共 28 条。运行时的注册表是 Partial<Record<ToolName, Tool>>,启动时由 9 个 with* 组合器按开关一层层套出来:8 个工具无条件在 builtinRegistry 里，其余按 LUNA_CODE_WRITE / LUNA_SHELL / LUNA_REPO_MAP / LUNA_SKILLS / LUNA_SELF_EDIT / LUNA_WEB_SEARCH / LUNA_WEB_FETCH / LUNA_WEATHER / LUNA_MUSIC 决定挂不挂。所以枚举是上限，注册表才是本次会话真正存在的工具。每轮请求前,toolsToAnthropicFormat 遍历注册表，把每个工具的 Zod 入参跑 zodToJsonSchema。",
      "en": "ToolName is a z.enum in the protocol package with 28 entries. The runtime registry is a Partial<Record<ToolName, Tool>>, composed at boot by nine with* combinators: eight tools sit unconditionally in builtinRegistry, and the rest mount or not according to LUNA_CODE_WRITE / LUNA_SHELL / LUNA_REPO_MAP / LUNA_SKILLS / LUNA_SELF_EDIT / LUNA_WEB_SEARCH / LUNA_WEB_FETCH / LUNA_WEATHER / LUNA_MUSIC. The enum is therefore the ceiling; the registry is what actually exists this session. Before each round, toolsToAnthropicFormat walks the registry and runs each tool's Zod input through zodToJsonSchema."
    },
    "contract": {
      "exposes": {
        "zh": "ToolName 枚举(28 条)+ toolsToAnthropicFormat(registry) → Anthropic.Tool[]。",
        "en": "The ToolName enum (28 entries) plus toolsToAnthropicFormat(registry) → Anthropic.Tool[]."
      },
      "depends": {
        "zh": "zod-to-json-schema ^3.25;每个工具的 input 必须是对象形状的 Zod schema(转换后被强制标成 type: object)。",
        "en": "zod-to-json-schema ^3.25; every tool input must be an object-shaped Zod schema (the result is forced to type: object)."
      },
      "boundary": {
        "zh": "只有 input 会被转成 JSON Schema 发给模型;output schema 从不上线，它只在服务端用 safeParse 校验工具自己的返回。",
        "en": "Only input is converted to JSON Schema and sent to the model; the output schema never goes on the wire — it is used server-side only, to safeParse what the tool returned."
      },
      "invariant": {
        "zh": "「某个工具是否可用」一律从注册表读(isMessageMode / isShellMode / isWebSearchMode …),永不在轮内读环境变量 —— 挂载在启动那一刻就冻结了。",
        "en": "Whether a tool is available is always derived from the registry (isMessageMode / isShellMode / isWebSearchMode and friends), never from an env read inside the turn loop — mounting is frozen at boot."
      }
    },
    "code": {
      "file": "packages/server/src/turn/runTurn.ts",
      "lines": "277-287",
      "snippet": "export function toolsToAnthropicFormat(registry: ToolRegistry): Anthropic.Tool[] {\n  return Object.values(registry).map((tool) => {\n    const raw = zodToJsonSchema(tool.input, { $refStrategy: 'none' });\n    const { $schema: _discard, ...schema } = raw as Record<string, unknown>;\n    return {\n      name: tool.name,\n      description: tool.description,\n      input_schema: { ...schema, type: 'object' as const },\n    };\n  });\n}",
      "note": {
        "zh": "两个不起眼的动作是全部的重点:$refStrategy 设成 none,以及把 $schema 键解构丢弃 —— 剩下的才是一棵能直接当 input_schema 用的自包含 schema。",
        "en": "Two unremarkable moves are the entire point: $refStrategy set to none, and destructuring the $schema key away — what is left is a self-contained tree usable directly as input_schema."
      }
    },
    "decision": {
      "why": {
        "zh": "一个工具的入参 schema 必须是自包含的一棵树：内联展开，产物里不出现 $ref 或 $defs,不需要任何解引用步骤就能读完。$schema 是元数据不是结构，所以在同一行里被显式丢掉。",
        "en": "A tool input schema must be one self-contained tree: everything inlined, no $ref or $defs in the output, readable without any dereferencing step. $schema is metadata rather than structure, so it is explicitly discarded on the same line."
      },
      "rejected": {
        "zh": "库的默认 $refStrategy —— 它会把重复出现的子 schema 提成 $ref 引用，体积更小但产物不再自包含。",
        "en": "The library default $refStrategy, which hoists repeated sub-schemas into $ref references — smaller, but no longer self-contained."
      },
      "cost": {
        "zh": "内联的代价是字节：复用的子结构不能靠引用省 token,每次出现都完整展开一遍，而 tools 块每一轮都要重发。",
        "en": "Inlining costs bytes: reused sub-structures cannot be shared by reference, each occurrence expands in full, and the tools block is re-sent every round."
      }
    }
  },
  "speak": {
    "figure": {
      "w": 620,
      "h": 230,
      "boxes": [
        {
          "x": 12,
          "y": 88,
          "w": 132,
          "h": 52,
          "kind": "blackbox",
          "title": {
            "zh": "模型输出",
            "en": "model output"
          }
        },
        {
          "x": 246,
          "y": 20,
          "w": 168,
          "h": 48,
          "title": "message",
          "sub": {
            "zh": "工具调用",
            "en": "a tool call"
          }
        },
        {
          "x": 246,
          "y": 150,
          "w": 168,
          "h": 48,
          "title": {
            "zh": "顶层文字",
            "en": "top-level text"
          },
          "sub": {
            "zh": "自言自语",
            "en": "narration"
          }
        },
        {
          "x": 462,
          "y": 20,
          "w": 146,
          "h": 48,
          "title": {
            "zh": "气泡 + 声音",
            "en": "bubble + voice"
          }
        },
        {
          "x": 462,
          "y": 150,
          "w": 146,
          "h": 48,
          "title": {
            "zh": "丢弃",
            "en": "discarded"
          },
          "sub": {
            "zh": "只留在 trace 里",
            "en": "kept only in traces"
          }
        }
      ],
      "edges": [
        {
          "pts": [
            [
              148,
              104
            ],
            [
              242,
              46
            ]
          ]
        },
        {
          "pts": [
            [
              148,
              124
            ],
            [
              242,
              172
            ]
          ]
        },
        {
          "pts": [
            [
              418,
              44
            ],
            [
              458,
              44
            ]
          ]
        },
        {
          "pts": [
            [
              418,
              174
            ],
            [
              458,
              174
            ]
          ],
          "style": "dashed"
        }
      ],
      "labels": [
        {
          "x": 246,
          "y": 92,
          "w": 350,
          "text": {
            "zh": "没有 message 就是沉默——不做文本兜底，浏览器兜底音也在 v0.43.14 撤掉了",
            "en": "no message means silence — there is no text fallback"
          },
          "tone": "red"
        }
      ]
    },
    "claim": {
      "zh": "如果自由文本就是回复，那就没有任何一处可以对一句话施加结构：表情、情绪强度、分句节奏、长度上限全都无处安放，只能靠提示词求模型自觉。message 是 Luna 唯一的发声通道 —— 调用它就是在说话，一次调用等于一个气泡。",
      "en": "If free-form text were the reply, there would be nowhere to impose structure on an utterance: expression, emotional intensity, sentence pacing and length caps would all have nowhere to live, surviving only as pleading in the prompt. message is Luna's only channel for speech — calling it IS speaking, and one call is one bubble."
    },
    "mechanism": {
      "zh": "在 message 模式下,open_stream 收到 text_delta 时不再向前端发 reply.token —— 自由文本被当成她在心里想，不是聊天气泡。人性硬上限直接写在 Zod 里:280 字符、5 句、单个从句 150 字符，后两条用 superRefine 实现，超限是一个 recoverable 的 validation_failed,模型自己换个说法重发。工具本身只做一件事：按标点把 text 切成段，每段算一个 delay_ms(28ms 每字符，钳在 120 到 900 之间)当元数据发出去 —— 服务端从不 sleep,节奏交给前端播。",
      "en": "In message mode, open_stream stops emitting reply.token on text_delta — free text is treated as her thinking out loud, not a chat bubble. The humanity caps live in Zod itself: 280 characters, 5 sentences, 150 characters per clause, the latter two via superRefine. A violation is a recoverable validation_failed and the model simply re-says it. The tool itself does one thing: split text into segments on punctuation and attach a delay_ms per segment (28ms per character, clamped to 120–900) as metadata — the server never sleeps, the client owns the pacing."
    },
    "contract": {
      "exposes": {
        "zh": "message 工具，输出 MessageDelivery:text、segments[]、可选 expression / emotion / voice_params,以及 is_final。",
        "en": "The message tool, returning a MessageDelivery: text, segments[], optional expression / emotion / voice_params, and is_final."
      },
      "depends": {
        "zh": "persona/humanity.ts 的三个常量与 splitSentences / longestClauseLength —— 提示词里那段 HARD LIMITS 和 Zod 校验读的是同一组数字。",
        "en": "The three constants in persona/humanity.ts plus splitSentences / longestClauseLength — the HARD LIMITS paragraph in the prompt and the Zod validation read the same numbers."
      },
      "boundary": {
        "zh": "concurrency 是 session-serial(气泡必须按顺序到),proactiveRisk 是 safe(主动轮里她可以直接开口),timeoutMs 只有 1000 —— 它不碰网络，不该慢。",
        "en": "concurrency is session-serial (bubbles must arrive in order), proactiveRisk is safe (she may speak in a proactive turn without asking), and timeoutMs is just 1000 — it touches no network and has no excuse to be slow."
      },
      "invariant": {
        "zh": "sentences 不是模型字段:text 是唯一真相，分段永远在服务端派生 —— 模型无法自己指定断句。",
        "en": "sentences is deliberately not a model field: text is the single source of truth and segments are always derived server-side — the model cannot dictate its own breaks."
      }
    },
    "code": {
      "file": "packages/server/src/tools/builtin/message.ts",
      "lines": "76-87",
      "snippet": "export const messageTool = defineTool({\n  name: 'message',\n  description:\n    'Speak to the user. Calling this tool IS speaking — it is your only voice. Each call is one ' +\n    'chat bubble; prefer several short calls over one long one. Set is_final=true on the last ' +\n    'message of your turn.',\n  input: Input,\n  output: MessageDelivery,\n  concurrency: 'session-serial',\n  proactiveRisk: 'safe',\n  timeoutMs: 1000,\n  summarize: (out) => out.text.slice(0, 30),",
      "note": {
        "zh": "这条 description 是写给模型看的，不是写给人看的注释 —— 「调用它就是在说话」这句话本身就是契约的一部分。",
        "en": "This description is addressed to the model, not to a human reader — the sentence stating that calling the tool IS speaking is itself part of the contract."
      }
    },
    "decision": {
      "why": {
        "zh": "一次校验失败的发声是内部重试机制，不是事故。前端在 tool.finished 带 err 时，把已经流出来的半截气泡静默丢掉(web/src/controller.ts 168-174),模型换个更短的说法再说一遍；用户看到的只是她顿了一下。这是 L1 的「机器留在后台」规则。",
        "en": "A rejected utterance is retry machinery, not an incident. On a tool.finished carrying err, the frontend silently discards the half-streamed bubble (web/src/controller.ts 168-174) and the model re-says it shorter; the user sees only a pause. This is the L1 rule about keeping the machinery backstage."
      },
      "rejected": {
        "zh": "把 ZodError 当错误提示渲染出来 —— 那会把她的自我审查过程摊在用户脸上。",
        "en": "Rendering the ZodError as a user-facing error, which would spill her own self-editing onto the screen."
      },
      "cost": {
        "zh": "一次超限要多跑一整轮模型，首字延迟变长；而且用户已经看见的半句话会凭空消失，前端必须有对应的丢弃路径，否则就是幽灵气泡。",
        "en": "A cap violation costs a full extra model round, lengthening time-to-first-word; and a half-sentence the user already saw vanishes, so the frontend must carry a matching discard path or it leaves ghost bubbles."
      }
    }
  },
  "concur": {
    "figure": {
      "w": 620,
      "h": 230,
      "boxes": [
        {
          "x": 16,
          "y": 88,
          "w": 130,
          "h": 54,
          "title": {
            "zh": "分发器",
            "en": "dispatcher"
          },
          "sub": "dispatchToolCalls"
        },
        {
          "x": 292,
          "y": 12,
          "w": 310,
          "h": 44,
          "title": "safe-parallel",
          "sub": {
            "zh": "可并行 · 不得改共享状态",
            "en": "parallel · must not mutate shared state"
          }
        },
        {
          "x": 292,
          "y": 88,
          "w": 310,
          "h": 44,
          "title": "session-serial",
          "sub": {
            "zh": "本会话内排队 · sessionMutex",
            "en": "queued per session"
          }
        },
        {
          "x": 292,
          "y": 164,
          "w": 310,
          "h": 44,
          "title": "global-serial",
          "sub": {
            "zh": "全局一次一个",
            "en": "one at a time, globally"
          }
        }
      ],
      "edges": [
        {
          "pts": [
            [
              150,
              104
            ],
            [
              288,
              34
            ]
          ]
        },
        {
          "pts": [
            [
              150,
              115
            ],
            [
              288,
              110
            ]
          ]
        },
        {
          "pts": [
            [
              150,
              126
            ],
            [
              288,
              186
            ]
          ]
        }
      ],
      "labels": [
        {
          "x": 16,
          "y": 156,
          "w": 250,
          "text": {
            "zh": "策略由工具自己声明，调度是它的后果",
            "en": "each tool declares its own policy; scheduling is the consequence"
          },
          "tone": "edge"
        }
      ]
    },
    "claim": {
      "zh": "没有并发声明，只剩两个都错的选项：全串行，一次 read_file 就把整轮卡住；或者全并行，两个 edit 同时写同一个文件。三档策略让每个工具自己声明它能不能和别人同时跑，分发器据此把一批调用拆成三条流。",
      "en": "Without a concurrency declaration there are only two options and both are wrong: everything serial, so one read_file stalls the whole round; or everything parallel, so two edit calls write the same file at once. The three-tier policy lets each tool declare whether it may run alongside others, and the dispatcher splits a batch into three streams accordingly."
    },
    "mechanism": {
      "zh": "dispatchToolCalls 先砍掉超过 8 个的部分 —— 多出来的调用当场回一个 recoverable 的 err(模型下一轮可以重发),不是排队。剩下的按 tool.concurrency 分三个桶:safe-parallel 每个调用起一条独立流;session-serial 整组排进会话自己的 mutex,组内按数组顺序逐个过;global-serial 排进 dispatcher 模块里的那个进程级单例 mutex。三条流交给 mergeAsync 竞速合并，谁先产出事件谁先 yield —— 所以串行是组内的，组与组之间照样并发。",
      "en": "dispatchToolCalls first trims anything past 8 — the overflow calls get an immediate recoverable err (the model can simply re-issue them next round) rather than a queue slot. The rest are bucketed by tool.concurrency: safe-parallel gets one independent stream per call; session-serial goes as a group behind the session's own mutex, running in array order; global-serial goes behind the single process-wide mutex held in the dispatcher module. The three streams are raced together by mergeAsync — whichever produces an event first is yielded first — so serialization is within a group, while the groups still overlap."
    },
    "contract": {
      "exposes": {
        "zh": "ConcurrencyPolicy = safe-parallel | session-serial | global-serial,以及每个工具在 defineTool 里必填的 concurrency 字段。",
        "en": "ConcurrencyPolicy = safe-parallel | session-serial | global-serial, and the mandatory concurrency field every tool sets in defineTool."
      },
      "depends": {
        "zh": "每个会话一把 Mutex(session.mutex,由调用方传进 DispatchContext);globalMutex 是 dispatcher.ts 里的模块级单例。Mutex 自己带 AbortSignal 支持：排队中的等待者可以被中止并从队列里摘掉。",
        "en": "One Mutex per session (session.mutex, handed in via DispatchContext); globalMutex is a module-level singleton in dispatcher.ts. The Mutex supports AbortSignal: a queued waiter can be aborted and spliced out of the queue."
      },
      "boundary": {
        "zh": "一批最多 8 个(MAX_CONCURRENT_TOOLS_PER_SESSION = 8),超出的部分直接退回。超时由每个工具自己的 timeoutMs 决定，到点用 AbortController 中止，并给生成器的 finally 留 100ms 收尾窗口。",
        "en": "At most 8 per batch (MAX_CONCURRENT_TOOLS_PER_SESSION = 8); the overflow is returned, not queued. Timeouts come from each tool's own timeoutMs, enforced by an AbortController, with a 100ms grace window for the generator's finally block to clean up."
      },
      "invariant": {
        "zh": "标了 safe-parallel 的工具内部不得有共享可变状态 —— 这条没有编译器把关(tools/README.md 明写，开发 skill 把它列为「load-bearing for correctness」),一个偷偷改共享状态的 safe-parallel 工具就是一个竞态。",
        "en": "A tool marked safe-parallel must hold no shared mutable state — nothing in the type system enforces this (tools/README.md states it, and the dev skill lists it as load-bearing for correctness); a safe-parallel tool that secretly mutates shared state is a race condition."
      }
    },
    "code": {
      "file": "packages/server/src/tools/dispatcher.ts",
      "lines": "52-63",
      "snippet": "  const streams: AsyncIterable<ToolEvent>[] = [];\n  for (const call of safeParallel) {\n    streams.push(runOne(call, ctx, registry));\n  }\n  if (sessionSerial.length > 0) {\n    streams.push(runSerial(sessionSerial, ctx.sessionMutex, ctx, registry));\n  }\n  if (globalSerial.length > 0) {\n    streams.push(runSerial(globalSerial, globalMutex, ctx, registry));\n  }\n\n  yield* mergeAsync(streams);",
      "note": {
        "zh": "三档不是三个分支，是三种「怎么变成一条 AsyncIterable」—— 变完之后统统丢进同一个 mergeAsync,调度这件事就没有第二个地方了。",
        "en": "The three tiers are not three branches but three ways of becoming an AsyncIterable — after which they all go into the same mergeAsync, so scheduling lives in exactly one place."
      }
    },
    "decision": {
      "why": {
        "zh": "三态，不做按资源加锁 —— 这是 v0.2 设计评审 Open Q #5 的结论,README 里写明「revisit only if 后续记忆工作要求更细的粒度」。三个名字就能覆盖真实的分组：只读的、动会话状态的(remember 是范本)、动跨会话外部世界的(music_control 是范本，它去控外部播放器)。",
        "en": "Three states, no per-resource locks — the resolution of Open Q #5 at the v0.2 design review, with the README noting it should be revisited only if later memory work demands finer granularity. Three names cover the real groupings: read-only; mutates session-keyed state (remember is the canonical case); mutates cross-session or outside-world state (music_control is the canonical case, driving an external player)."
      },
      "rejected": {
        "zh": "更细的按资源加锁(每个文件、每个 DB 表一把锁)。",
        "en": "Finer-grained per-resource locking (a lock per file, per DB table)."
      },
      "cost": {
        "zh": "session-serial 是一把大锁：一次 remember 和一次 typecheck 明明不碰同一份状态，也得互相等 —— 粗粒度换来的是「哪一档能配哪个工具」永远一眼看得出来。",
        "en": "session-serial is a coarse lock: a remember and a typecheck touch entirely different state yet still wait on each other — the coarseness buys the ability to tell at a glance which tier a tool belongs in."
      }
    }
  },
  "stream": {
    "figure": {
      "w": 620,
      "h": 220,
      "boxes": [
        {
          "x": 12,
          "y": 84,
          "w": 128,
          "h": 52,
          "title": "input_json_delta",
          "sub": {
            "zh": "半截 JSON",
            "en": "partial JSON"
          }
        },
        {
          "x": 186,
          "y": 84,
          "w": 148,
          "h": 52,
          "title": "JsonTextStream",
          "sub": {
            "zh": "只抽 text 字段",
            "en": "extracts the text field"
          }
        },
        {
          "x": 380,
          "y": 84,
          "w": 128,
          "h": 52,
          "title": "tool.progress",
          "sub": "text_delta"
        },
        {
          "x": 548,
          "y": 84,
          "w": 60,
          "h": 52,
          "title": {
            "zh": "气泡",
            "en": "bubble"
          }
        }
      ],
      "edges": [
        {
          "pts": [
            [
              144,
              110
            ],
            [
              182,
              110
            ]
          ]
        },
        {
          "pts": [
            [
              338,
              110
            ],
            [
              376,
              110
            ]
          ]
        },
        {
          "pts": [
            [
              512,
              110
            ],
            [
              544,
              110
            ]
          ]
        },
        {
          "pts": [
            [
              76,
              78
            ],
            [
              76,
              34
            ],
            [
              444,
              34
            ],
            [
              444,
              78
            ]
          ],
          "style": "dashed",
          "label": {
            "zh": "不缓冲到轮尾",
            "en": "never buffered to the end of the round"
          },
          "at": [
            200,
            8
          ]
        }
      ],
      "labels": [
        {
          "x": 186,
          "y": 152,
          "w": 380,
          "text": {
            "zh": "转义、\\uXXXX、嵌套括号都要在半截 JSON 上正确处理——这是那个提取器唯一的活",
            "en": "escapes, \\uXXXX and nesting all have to survive half-finished JSON"
          },
          "tone": "edge"
        }
      ]
    },
    "claim": {
      "zh": "不做增量提取的话，一次 message 要等模型把整个 JSON 入参吐完、工具跑完、结果回来，那句话才第一次出现在屏幕上 —— 一句话的等待等于一整个工具轮的延迟。增量提取让 text 字段边生成边播：用户看到的是她在打字，不是一个转圈的圈。",
      "en": "Without incremental extraction, a message would appear on screen only after the model finished emitting the whole JSON input, the tool ran, and the result came back — the wait for one sentence equals a full tool round. Incremental extraction plays the text field as it is generated: the user sees her typing rather than a spinner."
    },
    "mechanism": {
      "zh": "provider 把 Anthropic 的 input_json_delta 转成 tool_input_delta 事件，靠 content block 的 index 归属到具体的 call id(一个 Map 在 content_block_start 时建立)。open_stream 只关心 name 是 message 的 delta:每个 call id 配一个 JsonTextStream —— 一台手写状态机，在任意切碎的 partial JSON 上只认深度为 1 的 text 键，顺手解转义(包含 \\uXXXX 四位十六进制),嵌套对象比如 voice_params 整块跳过。有增量就发一个 tool.progress 带 text_delta。",
      "en": "The provider turns Anthropic's input_json_delta into a tool_input_delta event, attributing it to a call id by the content block index (a Map built at content_block_start). open_stream cares only about deltas whose name is message: each call id gets a JsonTextStream — a hand-written state machine that, over arbitrarily chopped partial JSON, recognizes only the depth-1 text key, unescapes as it goes (including four-hex-digit \\uXXXX), and skips nested objects such as voice_params wholesale. Any new text is emitted as a tool.progress carrying text_delta."
    },
    "contract": {
      "exposes": {
        "zh": "ServerEvent tool.progress { call_id, tool_name: message, payload: { text_delta } } —— 逐字的实时预览。",
        "en": "The ServerEvent tool.progress { call_id, tool_name: message, payload: { text_delta } } — a character-by-character live preview."
      },
      "depends": {
        "zh": "provider 保证同一个 id 的 tool_use_start 先于它的 tool_input_delta 到达；以及 message 的 text 一定是个深度 1 的字符串字段(不是，状态机就退回结构扫描，不乱猜)。",
        "en": "The provider guarantees tool_use_start for an id arrives before its tool_input_delta; and message's text is always a depth-1 string field (if it is not, the state machine falls back to structural scanning rather than guessing)."
      },
      "boundary": {
        "zh": "只提 message 的 text,只在 depth 为 1 —— 别的工具的入参完全不做增量提取，它们的进度靠工具自己 yield 的 progress 事件。",
        "en": "Only message's text, only at depth 1 — no other tool's input is extracted incrementally; their progress comes from progress events the tool itself yields."
      },
      "invariant": {
        "zh": "预览不是交付。真正的交付是稍后 dispatch 出来的 tool.finished 带 ok 的 MessageDelivery;预览失败(校验没过)时前端把它丢掉，两条路径必须对称。",
        "en": "A preview is not a delivery. The real delivery is the later tool.finished carrying an ok MessageDelivery; when the preview fails validation the frontend discards it, and the two paths must stay symmetric."
      }
    },
    "code": {
      "file": "packages/server/src/turn/runTurn.ts",
      "lines": "451-461",
      "snippet": "          const delta = stream.push(ev.partial_json);\n          if (delta.length > 0) {\n            if (s.firstTokenMs === null) s.firstTokenMs = Date.now() - s.startedMs;\n            s.tokenCount += 1;\n            s.emit({\n              type: 'tool.progress',\n              call_id: ev.id,\n              tool_name: 'message',\n              payload: { text_delta: delta },\n            });\n          }",
      "note": {
        "zh": "firstTokenMs 在这条分支里也会被认领 —— message 模式下第一个字来自工具入参而不是自由文本，所以「首字延迟」的定义必须跟着搬过来，否则这个指标会一直偏大。",
        "en": "firstTokenMs is claimed on this branch too — in message mode the first character comes from a tool input rather than free text, so the definition of time-to-first-token has to move with it, or the metric reads permanently too high."
      }
    },
    "decision": {
      "why": {
        "zh": "绝不把工具调用缓冲到轮尾再发。这是从 Python 版搬来的教训，写进了开发 skill 的注意事项：一旦缓冲，工具轮就重新变回那种「整轮发呆」的手感。",
        "en": "Never buffer tool calls and emit them at the end of the round. This is a lesson carried over from the Python version and written into the dev skill's caution list: the moment you buffer, a tool turn goes back to feeling like a blocking stall."
      },
      "rejected": {
        "zh": "等 JSON 完整再 JSON.parse 一次拿 text —— 简单得多，但那正好就是缓冲。",
        "en": "Waiting for complete JSON and doing a single JSON.parse to get text — far simpler, and exactly the buffering being avoided."
      },
      "cost": {
        "zh": "一台手写的 JSON 状态机要自己处理转义、Unicode、任意切点(注释里列了实测被切成 mid-key / mid-string / mid-escape 的形状);而且它会渲染出可能永远不被交付的文字，前端因此必须承担丢弃逻辑。",
        "en": "A hand-written JSON state machine has to handle escapes, Unicode, and arbitrary split points itself (the header lists spike-verified shapes split mid-key, mid-string, mid-escape); and it renders text that may never be delivered, which forces discard logic onto the frontend."
      }
    }
  },
  "result": {
    "figure": {
      "w": 620,
      "h": 200,
      "boxes": [
        {
          "x": 12,
          "y": 26,
          "w": 130,
          "h": 40,
          "title": {
            "zh": "结果 B",
            "en": "result B"
          }
        },
        {
          "x": 12,
          "y": 78,
          "w": 130,
          "h": 40,
          "title": {
            "zh": "结果 A",
            "en": "result A"
          }
        },
        {
          "x": 12,
          "y": 130,
          "w": 130,
          "h": 40,
          "title": {
            "zh": "结果 C",
            "en": "result C"
          }
        },
        {
          "x": 282,
          "y": 62,
          "w": 172,
          "h": 72,
          "title": {
            "zh": "按请求顺序重排",
            "en": "reordered to the request"
          },
          "sub": "A → B → C"
        },
        {
          "x": 500,
          "y": 62,
          "w": 106,
          "h": 72,
          "title": {
            "zh": "回填历史",
            "en": "into history"
          }
        }
      ],
      "edges": [
        {
          "pts": [
            [
              146,
              46
            ],
            [
              278,
              84
            ]
          ]
        },
        {
          "pts": [
            [
              146,
              98
            ],
            [
              278,
              98
            ]
          ]
        },
        {
          "pts": [
            [
              146,
              150
            ],
            [
              278,
              112
            ]
          ]
        },
        {
          "pts": [
            [
              458,
              98
            ],
            [
              496,
              98
            ]
          ]
        }
      ],
      "labels": [
        {
          "x": 282,
          "y": 146,
          "w": 330,
          "text": {
            "zh": "并发跑完的顺序不算数——tool_result 必须按 tool_use 的原序回去",
            "en": "the order they finished does not count; results go back in the order they were asked"
          },
          "tone": "edge"
        }
      ]
    },
    "claim": {
      "zh": "没有结果回填，工具轮就是单向的：模型发出调用，永远看不到自己做了什么。而且回填必须成对且同序 —— 一个 tool_use 块对一个 tool_result 块，顺序跟着 assistant 消息里的顺序走，否则这段历史会永久坏掉。",
      "en": "Without result append-back a tool round is one-way: the model issues calls and never sees what it did. And the append-back must be paired and in order — one tool_result block per tool_use block, following the order in the assistant message — or that stretch of history is permanently broken."
    },
    "mechanism": {
      "zh": "事件是从 mergeAsync 按完成先后出来的，所以 toolResultBlocks 是完成顺序 —— 一个 300ms 的 read_file 会排在一个 3s 的 shell 前面，哪怕模型先发的是 shell。append_results 拿 pendingToolUses(模型发出的顺序)逐个去 find 对应 tool_use_id 的结果块，重排成同序，再作为一条 user 消息压进 history。没被派发的调用也各自压过结果块：名字不在枚举里的是 tool_not_found,被主动安全门拦下的是那句 SURFACE_FIRST_MESSAGE —— 都是 is_error 为 true 的 tool_result,所以照样配得上对。",
      "en": "Events come out of mergeAsync in completion order, so toolResultBlocks is in completion order — a 300ms read_file lands ahead of a 3s shell even when the model issued shell first. append_results walks pendingToolUses (the order the model issued) and finds the block matching each tool_use_id, reordering to match, then pushes them as a single user message into history. Calls that were never dispatched pushed result blocks too: an unknown name gets tool_not_found, one stopped by the proactive safety gate gets SURFACE_FIRST_MESSAGE — both tool_result blocks with is_error true, so they still pair up."
    },
    "contract": {
      "exposes": {
        "zh": "紧跟 assistant 消息的一条 user 消息,content 是 tool_result 块数组，顺序与 assistant 里的 tool_use 块一致。",
        "en": "A single user message immediately after the assistant message, whose content is an array of tool_result blocks in the same order as the assistant message's tool_use blocks."
      },
      "depends": {
        "zh": "dispatcher 保证每个被派发的 call_id 恰好产出一个 final 事件 —— 超时、抛异常、生成器提前结束，统统被转成 final 里的 err,没有一条路径会静默什么都不产。",
        "en": "The dispatcher guarantees every dispatched call_id produces exactly one final event — timeout, thrown exception, or a generator ending early all become an err inside a final; no path silently produces nothing."
      },
      "boundary": {
        "zh": "回填之后 iteration 加一，达到 maxToolIterations()(MAX_TOOL_ITERATIONS 默认 8,LUNA_MAX_TOOL_ITERATIONS 可覆盖)就强制 finalize;主动轮另有一个按调用数计的预算。",
        "en": "After append-back, iteration increments; on reaching maxToolIterations() (MAX_TOOL_ITERATIONS defaults to 8, overridable via LUNA_MAX_TOOL_ITERATIONS) the turn is forced to finalize. A proactive cycle carries a separate budget counted in calls, not rounds."
      },
      "invariant": {
        "zh": "持久历史里绝不允许出现没有配对 tool_result 的 tool_use 块。这一条不是靠这里的 filter 守住的 —— filter 只是丢掉找不到结果的占位，而 tool_use 块早在 message_stop 时就已经进了 history。",
        "en": "Durable history must never contain a tool_use block without a paired tool_result. That invariant is not held by the filter here — the filter merely drops missing-result placeholders, while the tool_use blocks entered history back at message_stop."
      }
    },
    "code": {
      "file": "packages/server/src/turn/runTurn.ts",
      "lines": "622-626",
      "snippet": "  async append_results(s) {\n    const ordered = s.pendingToolUses\n      .map((use) => s.toolResultBlocks.find((b) => b.tool_use_id === use.id))\n      .filter((b): b is Anthropic.ToolResultBlockParam => b !== undefined);\n    s.session.history.push({ role: 'user', content: ordered });",
      "note": {
        "zh": "三行做的是一次重排，不是一次收集：事件按完成先后到，历史必须按模型发出的先后排 —— 遍历的是 pendingToolUses 而不是 toolResultBlocks,这个方向就是全部的含义。",
        "en": "These three lines are a reorder, not a collection: events arrive in completion order, history must be in issue order — the iteration runs over pendingToolUses rather than toolResultBlocks, and that direction is the whole meaning."
      }
    },
    "decision": {
      "why": {
        "zh": "配对是硬约束，而且违反的代价极高。v0.45.15 的 P0 就是这么来的：一轮因为 max_tokens 或 refusal 停下，但那之前已经吐出了一个完整的 tool_use 块 —— 没人跑它，也就没有结果块，这个不配对的块直接写进了持久历史，之后每次请求都 400,而且发生在回滚边界之前,fold、trim、重启全都够不着，只能改数据库才救回来。修法在 open_stream 的出口:dropUndispatchedToolUse 把这些块从 assistant 消息里剥掉(整条只剩它就整条弹出),在线上给每个 call 补发一个 tool.finished 的 err 让前端收掉半截气泡，并打一行 warn。",
        "en": "Pairing is a hard constraint and violating it is expensive. The v0.45.15 P0 came from exactly this: a round stopped for max_tokens or refusal after already emitting a complete tool_use block — nobody ran it, so no result block existed, and the unpaired block went into durable history, after which every request 400s. It happened before the rollback boundary, so fold, trim and restart all missed it and only DB surgery recovered it. The fix sits at open_stream's exit: dropUndispatchedToolUse strips those blocks out of the assistant message (popping the whole message if nothing else remains), emits a tool.finished err per call so the client drops its half-streamed bubble, and logs one warning."
      },
      "cost": {
        "zh": "这里的 filter 会静默吞掉找不到结果的调用 —— 它假设不配对已经在上游被处理干净了。一旦上游漏掉一种新的截断形态，这里不会报警，只会安静地少一个块。",
        "en": "The filter here silently swallows calls with no matching result — it assumes unpaired blocks were already handled upstream. If upstream ever misses a new truncation shape, nothing alarms here; a block just quietly goes missing."
      }
    }
  },

  /* ── 控制 / control mechanisms ─────────────────────────── */
  "capgate": {
    "figure": {
      "w": 620,
      "h": 200,
      "boxes": [
        {
          "x": 20,
          "y": 76,
          "w": 132,
          "h": 48,
          "title": {
            "zh": "一个开关",
            "en": "one flag"
          },
          "sub": "LUNA_*"
        },
        {
          "x": 248,
          "y": 20,
          "w": 168,
          "h": 44,
          "title": {
            "zh": "整组挂上",
            "en": "group mounted"
          }
        },
        {
          "x": 248,
          "y": 122,
          "w": 168,
          "h": 44,
          "title": {
            "zh": "整组卸掉",
            "en": "group unmounted"
          }
        },
        {
          "x": 456,
          "y": 122,
          "w": 150,
          "h": 44,
          "title": {
            "zh": "提示词里没有",
            "en": "not in the prompt"
          },
          "sub": {
            "zh": "连 schema 都不进",
            "en": "not even the schema"
          }
        }
      ],
      "edges": [
        {
          "pts": [
            [
              156,
              92
            ],
            [
              244,
              46
            ]
          ]
        },
        {
          "pts": [
            [
              156,
              108
            ],
            [
              244,
              140
            ]
          ]
        },
        {
          "pts": [
            [
              420,
              144
            ],
            [
              452,
              144
            ]
          ]
        }
      ],
      "labels": [
        {
          "x": 248,
          "y": 76,
          "w": 340,
          "text": {
            "zh": "关掉不是「调用会被拒」，是「她根本不知道有这个工具」",
            "en": "off does not mean the call is refused — she never learns the tool exists"
          },
          "tone": "red"
        }
      ]
    },
    "claim": {
      "zh": "没有它，「关掉 shell」只能是提示词里的一句请求 —— 工具 schema 照样发出去，模型照样会调，只能靠事后拒绝兜底。能力门把开关做在注册表上：关掉的一组根本不进注册表，于是既不进提示词，也不进分发器。",
      "en": "Without it, \"turn shell off\" is only a sentence in the prompt — the schema still ships, the model still calls it, and refusal is the only backstop. The capability gate moves the switch into the registry: a disabled group is never in the registry, so it reaches neither the prompt nor the dispatcher."
    },
    "mechanism": {
      "zh": "九个 with*(base) 组合器在 main.ts 里一次性套成一个 registry,boot 时冻结;turn loop 全程不再读能力相关的 env。发给模型的 tools 参数由 toolsToAnthropicFormat(registry) 直接映射注册表的值，所以未挂载的组连 JSON schema 都生成不出来。L1 契约里的对应条款同样由 isCodeWriteMode / isShellMode / isRepoMapMode / isSkillsMode 这些「从注册表反推」的判断决定渲不渲染，而不是读 env —— 于是不会出现契约让她去用一个没挂上的工具。真被调到时，分发器返回 tool_not_found。",
      "en": "Nine with*(base) composers wrap one registry in main.ts, frozen at boot; the turn loop never reads a capability env again. The tools array handed to the model is mapped straight off the registry by toolsToAnthropicFormat, so an unmounted group cannot even produce a JSON schema. The matching L1-contract clauses are likewise gated on registry-derived checks — isCodeWriteMode / isShellMode / isRepoMapMode / isSkillsMode — not on env reads, so the contract never tells her to call a tool that is not there. If one is called anyway, the dispatcher answers tool_not_found."
    },
    "contract": {
      "exposes": {
        "zh": "九个 with*(base) 组合器，以及与之配对的 isXxxMode(registry) 反查。",
        "en": "Nine with*(base) composers, plus the matching isXxxMode(registry) lookups."
      },
      "depends": {
        "zh": "只依赖 Bun.env 里的 LUNA_* 键，而且只在 boot 时读一次。",
        "en": "Only the LUNA_* keys in Bun.env, and only read once at boot."
      },
      "boundary": {
        "zh": "门决定挂不挂，不决定挂上之后能干什么 —— 后者归 workspace 黑名单、shellDeny、主动安全门管。",
        "en": "The gate decides whether a tool mounts, never what a mounted tool may do — that belongs to the workspace blocklist, shellDeny, and the proactive gate."
      },
      "invariant": {
        "zh": "注册表是唯一真相;turn loop 里没有任何一处读能力相关的 env。",
        "en": "The registry is the single source of truth; nowhere in the turn loop reads a capability env var."
      }
    },
    "code": {
      "file": "packages/server/src/tools/registry.ts",
      "lines": "106-118",
      "snippet": "export function shellSupported(platform: NodeJS.Platform = process.platform): boolean {\n  return platform !== 'win32';\n}\n\n// Compose a base registry with the shell + verify tools iff the flag is on.\nexport function withShell(base: ToolRegistry, platform: NodeJS.Platform = process.platform): ToolRegistry {\n  if (!shellEnabled()) return { ...base };\n  if (!shellSupported(platform)) {\n    console.warn('[luna-server] shell tool unmounted on win32 (spawner is /bin/zsh); verify tools stay');\n    return { ...base, ...verifyTools };\n  }\n  return { ...base, ...shellTools };\n}",
      "note": {
        "zh": "一个门可以只卸一半:shell 的 spawner 硬编码 /bin/zsh,win32 上单独卸掉它，而 argv 形式的 typecheck / run_tests / lint 留下。",
        "en": "A gate can unmount half of itself: shell hardcodes a /bin/zsh spawner, so win32 drops shell alone while the argv-form typecheck / run_tests / lint stay."
      }
    },
    "decision": {
      "why": {
        "zh": "默认全开。门是给出事时快速止血用的，不是给日常配置用的 —— 每个 =0 都是一只止血阀，而不是一个开关。",
        "en": "Default on, everywhere. The gates exist to stop bleeding fast, not to configure day-to-day behavior — each =0 is a shutoff valve, not a feature toggle."
      },
      "rejected": {
        "zh": "计划里 repo_map 原本要「默认 0 直到验证通过」;owner 决策 #4 推翻它，改成默认 ON,=0 才是关。",
        "en": "The plan had repo_map default to 0 until verified; owner decision #4 overrode it to default ON, with =0 as the off switch."
      },
      "cost": {
        "zh": "九个门有三种极性，读代码必须逐个确认：八个是 !== 0(默认开),其中 web_search 和 weather 还会在缺 key / 缺坐标时自动不挂(优雅降级),只有 music 是 === 1(默认关且限 darwin)。极性不统一的代价是注释会撒谎 —— web_fetch 那条注释说了二十个版本的「默认关」，而门从 v0.18.3 起就一直是默认开,v0.45.17 才把这条谎话写进注释里承认。",
        "en": "Three polarities across nine gates, each of which must be read individually: eight are !== 0 (default on), of which web_search and weather additionally degrade to unmounted with no key / no coordinates, and music alone is === 1 (default off, darwin only). The price of that inconsistency is lying comments — the web_fetch comment claimed default-off for twenty versions while the gate had read default-on since v0.18.3; v0.45.17 finally wrote the correction into the comment itself."
      }
    }
  },
  "proactgate": {
    "figure": {
      "w": 620,
      "h": 220,
      "boxes": [
        {
          "x": 16,
          "y": 82,
          "w": 150,
          "h": 54,
          "title": {
            "zh": "一次主动调用",
            "en": "a proactive call"
          }
        },
        {
          "x": 262,
          "y": 14,
          "w": 160,
          "h": 46,
          "title": "'safe'",
          "sub": {
            "zh": "显式标过 · 静默执行",
            "en": "marked · runs silently"
          }
        },
        {
          "x": 262,
          "y": 112,
          "w": 160,
          "h": 46,
          "title": "'surface'",
          "sub": {
            "zh": "默认 · 先开口再动手",
            "en": "default · speak first"
          }
        },
        {
          "x": 464,
          "y": 112,
          "w": 140,
          "h": 46,
          "title": {
            "zh": "挡下",
            "en": "blocked"
          },
          "sub": {
            "zh": "不计入预算",
            "en": "not counted"
          }
        }
      ],
      "edges": [
        {
          "pts": [
            [
              170,
              98
            ],
            [
              258,
              40
            ]
          ],
          "label": {
            "zh": "显式标记",
            "en": "explicitly marked"
          },
          "at": [
            166,
            62
          ]
        },
        {
          "pts": [
            [
              170,
              120
            ],
            [
              258,
              132
            ]
          ],
          "label": {
            "zh": "没标 = 当危险",
            "en": "unmarked = risky"
          },
          "at": [
            150,
            160
          ]
        },
        {
          "pts": [
            [
              426,
              135
            ],
            [
              460,
              135
            ]
          ]
        }
      ],
      "labels": [
        {
          "x": 262,
          "y": 176,
          "w": 340,
          "text": {
            "zh": "这一轮她还没开过口，就不给跑——announce-then-act",
            "en": "if she has not spoken this cycle, it does not run — announce, then act"
          },
          "tone": "edge"
        }
      ]
    },
    "claim": {
      "zh": "没有它，一次没人看着的主动唤醒里，新加的工具默认就能静默执行 —— 忘了标风险等同于默认放行。主动安全门反过来定方向：只有显式写了 safe 的工具才能在主动回合里悄悄跑，没标的一律当 surface,必须先开口再动手。",
      "en": "Without it, a tool added later runs silently by default during an unsupervised proactive wake — forgetting to label its risk would mean permission. The proactive gate reverses the direction: only a tool that explicitly opted into safe may run quietly; anything unlabeled counts as surface and must speak before it acts."
    },
    "mechanism": {
      "zh": "proactiveRiskOf 只认一个正向条件 —— proactiveRisk === safe,其余全部落到 surface,包括 undefined(工具压根不在注册表里)。dispatch_tools 里 surfacedBefore 取的是 messageTexts.length > 0,而本轮的 message 调用要等本轮 dispatch 才写进去，所以「先说后做」被强制跨轮：第一轮只能说，第二轮才能动。被挡下的调用拿到一条 recoverable 的错误(SURFACE_FIRST_MESSAGE,把规则原样讲给模型听),并且不进 toolNamesThisTurn —— 于是它不消耗每轮 8 次的主动动作预算。",
      "en": "proactiveRiskOf recognizes exactly one positive condition — proactiveRisk === safe — and everything else falls to surface, undefined included (a tool that is not even in the registry). In dispatch_tools, surfacedBefore reads messageTexts.length > 0, and this round’s own message calls are not written there until this round dispatches, so announce-then-act is forced across rounds: round one may only speak, round two may act. A blocked call gets a recoverable error (SURFACE_FIRST_MESSAGE, which states the rule to the model verbatim) and is never pushed into toolNamesThisTurn — so it does not spend any of the cycle’s 8-action budget."
    },
    "contract": {
      "exposes": {
        "zh": "proactiveRiskOf(tool)、isProactiveActionAllowed(risk, surfacedThisCycle)、maxProactiveActions()。",
        "en": "proactiveRiskOf(tool), isProactiveActionAllowed(risk, surfacedThisCycle), maxProactiveActions()."
      },
      "depends": {
        "zh": "工具定义上的可选字段 proactiveRisk,以及这一轮的 proactiveTurn 标记。",
        "en": "The optional proactiveRisk field on a tool definition, plus the turn’s proactiveTurn flag."
      },
      "boundary": {
        "zh": "只管主动回合。用户在场的反应式回合完全不过这道门 —— 人就在那儿，当场就能拦。",
        "en": "Proactive turns only. A reactive turn with the user present never passes through this gate — he is right there and can stop it himself."
      },
      "invariant": {
        "zh": "新工具的默认是 surface。忘记标注只会让系统更保守，不会更危险。",
        "en": "A new tool defaults to surface. Forgetting the label can only make the system more cautious, never less safe."
      }
    },
    "code": {
      "file": "packages/server/src/proactive/safetyGate.ts",
      "lines": "21-25",
      "snippet": "// Fail-closed: a tool counts as 'safe' (silently runnable in a proactive turn)\n// ONLY if it explicitly opted in. Anything unmarked → 'surface'.\nexport function proactiveRiskOf(tool: Tool | undefined): 'safe' | 'surface' {\n  return tool?.proactiveRisk === 'safe' ? 'safe' : 'surface';\n}",
      "note": {
        "zh": "整个 fail-closed 就是这一次三元表达式的方向选择 —— 写成 !== surface 就会全盘反过来，而且反过来之后测试之外看不出任何差别。",
        "en": "The whole fail-closed posture is one ternary’s direction — written as !== surface it inverts completely, and outside the tests nothing would look any different."
      }
    },
    "decision": {
      "why": {
        "zh": "message 自己是 safe,所以她在主动回合里永远能开口 —— 门只挡「动手」，从不挡「说话」。同一个分类器还被复用成审计信号：一轮里既读了不可信的网页内容、又开火了 surface 级工具，就记一条 web_to_action 的观察 trace(只观察，不阻断)。",
        "en": "message itself is safe, so she can always speak in a proactive turn — the gate blocks acting, never speaking. The same classifier is reused as an audit signal: a turn that both read untrusted web content and fired a surface-risk tool records a web_to_action observation trace (observed, not blocked)."
      },
      "rejected": {
        "zh": "把 music_control 标成 safe。music.ts 里那个字段是刻意留空的，旁边写了一行注释，直说不要用「标成 safe」的方式来修它 —— 换首歌也要先说一声。",
        "en": "Marking music_control safe. The field is deliberately absent in music.ts, with a comment saying in so many words: do not fix this by marking it safe — even changing the track gets announced first."
      },
      "cost": {
        "zh": "啰嗦。一次真的只想按下暂停的主动回合，也得先发一条消息，再等下一轮。",
        "en": "Verbosity. A proactive cycle that genuinely only wants to hit pause still has to send a message first and wait for the next round."
      }
    }
  },
  "integrity": {
    "figure": {
      "w": 620,
      "h": 220,
      "boxes": [
        {
          "x": 12,
          "y": 84,
          "w": 140,
          "h": 52,
          "title": {
            "zh": "她说完了",
            "en": "she finished"
          },
          "sub": "finalize"
        },
        {
          "x": 206,
          "y": 84,
          "w": 150,
          "h": 52,
          "title": {
            "zh": "零 LLM 检测",
            "en": "zero-LLM detect"
          },
          "sub": "detectDefection"
        },
        {
          "x": 410,
          "y": 18,
          "w": 196,
          "h": 48,
          "title": {
            "zh": "回到 ② 重来一轮",
            "en": "back to ②, one more round"
          },
          "sub": {
            "zh": "每种原因只一次",
            "en": "once per reason"
          }
        },
        {
          "x": 410,
          "y": 148,
          "w": 196,
          "h": 48,
          "title": {
            "zh": "降级放行",
            "en": "degrade"
          },
          "sub": {
            "zh": "记一条决策 trace",
            "en": "a decision trace"
          }
        }
      ],
      "edges": [
        {
          "pts": [
            [
              156,
              110
            ],
            [
              202,
              110
            ]
          ]
        },
        {
          "pts": [
            [
              360,
              100
            ],
            [
              406,
              54
            ]
          ],
          "label": {
            "zh": "承诺未兑现 / 有意图无行动",
            "en": "promise or intent unmet"
          },
          "at": [
            246,
            58
          ]
        },
        {
          "pts": [
            [
              360,
              122
            ],
            [
              406,
              168
            ]
          ],
          "label": {
            "zh": "这条已经纠过一次",
            "en": "already corrected once"
          },
          "at": [
            252,
            182
          ]
        }
      ],
      "labels": []
    },
    "claim": {
      "zh": "没有它，「我这就去查」之后什么都不发生，是一次完全合法的收尾 —— 用户看到的是一句承诺，系统记下的是一次干净结束。完整性闸在收尾前把这一轮重放一遍：承诺了却没动手，就退回去再跑一轮。",
      "en": "Without it, \"let me go look that up\" followed by nothing at all is a perfectly legal way to end a turn — the user sees a promise, the system records a clean finish. The integrity gate replays the turn before it closes: a promise with no action sends it back for one more round."
    },
    "mechanism": {
      "zh": "detectDefection 是纯函数、零 LLM,按置信度排三档并返回第一个命中:is_final_promise 是结构性的 —— 最后一条消息标了 is_final:false(还有下文)却以 end_turn 收场，机械确定，不需要词典;message_intent 只对「实际发出去的消息文本」逐字匹配承诺句式，而且要求这一轮除 message 外没调过任何工具;thinking_intent 匹配的是 thinking,只审计不重试(thinking 是 summarized 的，置信度天生低)。finalize 里的闸只对前两档动手:correctionUsed 这个 Set 保证每个原因至多纠正一次，第二次落到 degraded —— 只补一条 trace,不再循环;correctionWatermark 记住上次纠正时已发的气泡数，下一轮只审这之后的新气泡，同一句话不会被反复判定。",
      "en": "detectDefection is pure and LLM-free, ordered by confidence and returning the first hit: is_final_promise is structural — the last delivered message was marked is_final:false (more coming) yet the turn ended with end_turn, mechanically certain, no dictionary needed; message_intent matches promise phrasings verbatim against the text actually delivered, and only when no tool other than message fired this turn; thinking_intent matches the thinking summary and is audit-only, never a retry (summarized thinking is low-confidence by construction). The gate in finalize acts on the first two only: the correctionUsed set bounds each reason to a single correction, the second occurrence degrading to one trace instead of a loop, while correctionWatermark records how many bubbles had been delivered at the last correction so the next pass judges only the new ones."
    },
    "contract": {
      "exposes": {
        "zh": "detectDefection(纯函数)与 runDefectionAudit(记 decision trace,永不向 turn 抛异常)。",
        "en": "detectDefection (pure) and runDefectionAudit (records a decision trace, never throws into the turn)."
      },
      "depends": {
        "zh": "本轮已交付的消息文本、lastIsFinal、thinking、调用过的工具名、finishReason —— 全部是这一轮自己产出的东西，不查外部状态。",
        "en": "The messages this turn delivered, lastIsFinal, the thinking, the tool names called, and finishReason — all produced by the turn itself, no external state consulted."
      },
      "boundary": {
        "zh": "它判「说了没做」，不判「做得对不对」;thinking_intent 这一档永远不驱动重试。",
        "en": "It judges said-but-did-not-do, never did-it-well; the thinking_intent tier never drives a retry."
      },
      "invariant": {
        "zh": "每个原因至多纠正一次，所以这道闸不可能让一轮无限循环。",
        "en": "At most one correction per reason, so the gate can never spin a turn forever."
      }
    },
    "code": {
      "file": "packages/server/src/turn/runTurn.ts",
      "lines": "735-746",
      "snippet": "        if (d.defected && d.kind !== 'thinking_intent') {\n          const reason = d.kind === 'is_final_promise' ? 'promise' : 'intent';\n          if (!s.correctionUsed.has(reason)) {\n            s.correctionUsed.add(reason);\n            s.correctionWatermark = s.messageTexts.length;\n            emitGuardDecision(s, 'corrected', d.kind, d.matched);\n            pushDirective(\n              s,\n              d.kind === 'is_final_promise' ? PROMISE_BROKEN_DIRECTIVE : INTENT_NO_ACT_DIRECTIVE,\n            );\n            return 'build_request';\n          }",
      "note": {
        "zh": "三件事挤在同一个 if 里：越过审计专用的 thinking_intent、每个原因只纠正一次、并把水位线推到当前已交付的气泡数。",
        "en": "Three things live in one if: skip the audit-only thinking_intent tier, correct each reason exactly once, and push the watermark to the count of bubbles already delivered."
      }
    },
    "decision": {
      "why": {
        "zh": "纠正下发的是一条 user 角色的舞台提示，不是 system —— Python v0.27.1 的 hoisting 教训。而且给的是双出口：能做就现在去做，做不到就自然接着说，别宣布走回头路。这一条是 v0.27.6 改的：气泡在 finalize 之前就已经流给用户了，重试撤不回，原来那版逼她补一句「我做不到」，结果她像在跟自己道歉。",
        "en": "The correction is pushed as a user-role stage direction, never system — the v0.27.1 hoisting lesson from the Python original. And it offers a double exit: follow through now if you can, otherwise just continue naturally, do not announce a walk-back. That second half is a v0.27.6 fix: bubbles stream before finalize runs, so a retry cannot retract, and the earlier wording made her send a second, contradicting bubble that read as apologizing to herself."
      },
      "rejected": {
        "zh": "用一次 LLM 调用去判断有没有失约。整条检测链是同步的纯函数，一次模型往返都不花。",
        "en": "Using an LLM call to judge whether a promise was broken. The whole detection chain is synchronous and pure — not one model round-trip."
      },
      "cost": {
        "zh": "正则式的承诺词典必然误报。所以第二档配了两层否定过滤(动词后接 不到/没… 是老实的推辞；句中带 能/会/可以 是提议不是承诺),而且误报的代价被刻意设计成「一次温柔的重问」，永远不是一次错误的阻断。v0.18.x 还砍掉过一次：泛用的 查一下 / 查询 曾被算作 web 意图，结果把老老实实用 recall 的回合判成失约，反过来污染了这个审计要收的数据。",
        "en": "A regex promise dictionary will produce false positives. Hence two negation filters on tier two (a verb followed by cannot / did-not is an honest decline; a capability modal in the match is an offer, not a promise), and hence the deliberate design that a false positive costs one gentle re-prompt and never a wrong block. One narrowing was already made in v0.18.x: generic lookup verbs used to count as web intent, which flagged honest turns that discharged the intent via recall and poisoned the very dataset the audit collects."
      }
    }
  },
  "net": {
    "figure": {
      "w": 620,
      "h": 230,
      "boxes": [
        {
          "x": 12,
          "y": 90,
          "w": 124,
          "h": 50,
          "title": "URL"
        },
        {
          "x": 172,
          "y": 90,
          "w": 138,
          "h": 50,
          "title": {
            "zh": "解析 + 校验",
            "en": "resolve + check"
          },
          "sub": {
            "zh": "每个 IP 过黑名单",
            "en": "every IP deny-listed"
          }
        },
        {
          "x": 346,
          "y": 90,
          "w": 124,
          "h": 50,
          "title": {
            "zh": "钉住那个 IP",
            "en": "pin that IP"
          },
          "sub": "custom lookup"
        },
        {
          "x": 506,
          "y": 90,
          "w": 100,
          "h": 50,
          "title": {
            "zh": "连接",
            "en": "connect"
          }
        }
      ],
      "edges": [
        {
          "pts": [
            [
              140,
              115
            ],
            [
              168,
              115
            ]
          ]
        },
        {
          "pts": [
            [
              314,
              115
            ],
            [
              342,
              115
            ]
          ]
        },
        {
          "pts": [
            [
              474,
              115
            ],
            [
              502,
              115
            ]
          ]
        },
        {
          "pts": [
            [
              241,
              84
            ],
            [
              241,
              44
            ],
            [
              408,
              44
            ],
            [
              408,
              84
            ]
          ],
          "style": "dashed",
          "label": {
            "zh": "中间不给 DNS 换人的机会",
            "en": "no window for DNS to swap the answer"
          },
          "at": [
            214,
            18
          ]
        }
      ],
      "labels": [
        {
          "x": 172,
          "y": 156,
          "w": 340,
          "text": {
            "zh": "校验与连接之间若各查一次 DNS，就有 TOCTOU；钉住之后没有那个缝",
            "en": "check and connect resolving separately is a TOCTOU; pinning removes the gap"
          },
          "tone": "edge"
        }
      ]
    },
    "claim": {
      "zh": "没有它，一次 web_fetch 就是一条从模型直通内网的路(169.254.169.254 那类地址近在咫尺),一条 shell 命令就能 rm -rf 或者把 ~/.ssh 读出来，而且她可以直接改掉判她的那些文件。护栏钉死三件事：出网前先验解析出的 IP、并把 socket 钉在这个 IP 上；危险命令在到达 spawner 之前就拒；评判她的代码，她读得了、写不了。",
      "en": "Without it, one web_fetch is a straight road from the model into the internal network (169.254.169.254 is one hostname away), one shell command can rm -rf or read ~/.ssh, and she can edit the very files that judge her. The guardrails pin three things: validate the resolved IP before leaving the machine and pin the socket to that IP; refuse dangerous commands before they reach a spawner; and make the code that judges her readable but never writable."
    },
    "mechanism": {
      "zh": "safeFetch 的顺序是:canonicalize URL → 解析 → 把解析出的每一个地址过 deny 列表 → 然后把 node:http(s) 的 lookup 换成一个恒返回该地址的函数。TOCTOU 是关掉的而不是变窄的 —— 连上的就是刚验过的那一个地址，而 TLS SNI 与证书仍按 URL 主机名校验，所以 HTTPS 依然正确；重定向不自动跟随，每一跳回到循环顶端重新验一遍，上限 5 跳。shellDeny 是 17 条拒绝正则加 16 个交互式命令(无 TTY 会挂死),匹配前先把空引号拼接折叠掉，免得用引号切词绕过。workspace 分两层:SECRETS 层读写执行全拒,EVALUATOR FIREWALL 层只拒写和执行、放行读 —— 路径先 canonicalize(存在就 realpath,不存在就 realpath 最近的祖先再拼回去),所以指进敏感目录的符号链接一样被抓到;macOS 与 Windows 上所有比较都折叠大小写，否则 .ENV 或 ID_RSA 能整个绕过两层。",
      "en": "safeFetch runs in order: canonicalize the URL, resolve it, run every resolved address through the deny list, then swap node:http(s)’s lookup for a function that always returns that address. The TOCTOU is closed rather than narrowed — the socket connects to the very address just validated, while TLS SNI and certificate validation still key off the URL hostname so HTTPS stays correct; redirects are never auto-followed, each hop re-entering the loop for revalidation, capped at 5. shellDeny is 17 deny regexes plus 16 interactive commands (which would hang with no TTY), with empty-quote splices collapsed before matching so quote-splitting cannot hide a denied token. workspace has two tiers: SECRETS rejects read, write and execute alike; the EVALUATOR FIREWALL rejects only write and execute and permits read — and every path is canonicalized first (realpath if it exists, else realpath the nearest existing ancestor and rejoin), so a symlink pointing into a sensitive directory is caught too, with all comparisons case-folded on macOS and Windows or else .ENV and ID_RSA would slip past both tiers entirely."
    },
    "contract": {
      "exposes": {
        "zh": "assertPublicUrl / safeFetch / makePinnedLookup;classifyShellCommand;resolveInWorkspace(path, read|write|execute) 与 isSecretTailPath。",
        "en": "assertPublicUrl / safeFetch / makePinnedLookup; classifyShellCommand; resolveInWorkspace(path, read|write|execute) and isSecretTailPath."
      },
      "depends": {
        "zh": "node:dns 的解析、node:http(s) 允许注入自定义 lookup 这一点、以及文件系统的 realpath。",
        "en": "node:dns resolution, the fact that node:http(s) accepts an injected lookup, and filesystem realpath."
      },
      "boundary": {
        "zh": "全是静态与连接期的判断。拒绝表看的是命令文本，看不穿运行时展开 —— 先下载存盘再执行这一类，源文件注释里自己承认盖不住。",
        "en": "Everything is static or connect-time. The deny list reads command text and cannot see through runtime expansion — fetch-to-file-then-run is a shape the source comment itself admits it cannot cover."
      },
      "invariant": {
        "zh": "验过的地址就是连上的地址；评判 Luna 的那批文件，对她永远只读。",
        "en": "The address validated is the address connected to; the files that judge Luna are permanently read-only to her."
      }
    },
    "code": {
      "file": "packages/server/src/tools/web/safeFetch.ts",
      "lines": "261-268",
      "snippet": "export function makePinnedLookup(pinIp: string): LookupFunction {\n  const fam = isIP(pinIp) === 6 ? 6 : 4;\n  const lookup = (_host: string, options: { all?: boolean } | undefined, cb: (...a: unknown[]) => void): void => {\n    if (options && options.all) cb(null, [{ address: pinIp, family: fam }]);\n    else cb(null, pinIp, fam);\n  };\n  return lookup as unknown as LookupFunction;\n}",
      "note": {
        "zh": "node 会用 all:true(数组形态)或 all:false(单值形态)两种方式回调，两条分支都必须只返回这个钉住的地址 —— 漏掉一条就悄悄把 SSRF 放回来了。它被单独导出，唯一目的就是让单测能把这两种形态都钉住。",
        "en": "node may call it with all:true (array form) or all:false (single value), and both branches must return only the pinned address — missing one silently reopens SSRF. It is exported for one reason only: so a unit test can pin both shapes."
      }
    },
    "decision": {
      "why": {
        "zh": "不做 root jail。owner 决策推翻了原计划的根目录监狱:read/write/execute 可以碰机器上任何路径，黑名单是唯一护栏 —— 所以黑名单必须写全并被穷举测试。SECRETS 层挡的是凭据与密钥(13 个 home 相对目录、3 个具名文件，加上 .env / .env.* / *.pem / *.key / id_rsa* 的 basename 模式);EVALUATOR FIREWALL 挡的是判她、关她、给她划线的那批文件：这个沙箱自己、shellDeny.ts、shell.ts、shellCore.ts、safeFetch.ts、safetyGate.ts、l1Contract.ts、humanity.ts、run_tests.ts(save_skill 的绿灯判据),外加按 basename 匹配的 *.test.ts、tsconfig*.json、prettier / eslint 配置。放行读是有意的：她要能理解自己被什么约束着 —— 自省、解释、提改动建议都得先读得到 —— 但不能自己解开。propose_self_edit 走的是同一道 write 检查，所以「提案自改」永远提不到护栏本身。isBlockedIp 对任何解析不出来的地址返回 true,同样是 fail-closed。",
        "en": "No root jail. An owner decision overrode the planned root confinement: read/write/execute may touch any path on the machine, and the blocklist is the only guardrail — so it has to be comprehensive and exhaustively tested. The SECRETS tier covers credentials and key material (13 home-relative directories, 3 named files, plus basename patterns for .env / .env.* / *.pem / *.key / id_rsa*); the EVALUATOR FIREWALL covers the files that judge, sandbox and gate her: the sandbox itself, shellDeny.ts, shell.ts, shellCore.ts, safeFetch.ts, safetyGate.ts, l1Contract.ts, humanity.ts, run_tests.ts (save_skill’s green/red oracle), plus basename-matched *.test.ts, tsconfig*.json, and the prettier / eslint configs. Allowing reads is deliberate: she must be able to understand what constrains her — introspection, explanation, and proposing changes all require reading it — without being able to undo it. propose_self_edit passes the same write check, so a self-edit proposal can never reach the guardrails themselves. isBlockedIp returns true for any address it cannot parse, fail-closed for the same reason."
      },
      "rejected": {
        "zh": "封 198.18.0.0/15。它在 RFC 2544 里是基准测试段，按常识该封；但它同时是 Clash / Surge 这类代理的默认 fake-IP 池 —— 封了等于在代理环境下每个域名都被判成内网,web_fetch 全线报废。代码里留了整段注释解释为什么这一条故意不加，内网访问仍由 IP 字面量检查加 RFC1918 / loopback / link-local / metadata 那几条守住。",
        "en": "Blocking 198.18.0.0/15. It is the RFC 2544 benchmarking range and by convention should be denied — but it is also the default fake-IP pool for Clash/Surge-style proxies, so blocking it means every domain resolves into a \"private\" address on a proxied host and web_fetch dies completely. A full comment explains why this one range is deliberately left out; internal access stays closed via the IP-literal check plus the RFC1918 / loopback / link-local / metadata rules."
      },
      "cost": {
        "zh": "黑名单模型天生有洞：没有 jail,一个不在名单上的敏感目录就是敞开的。shell 那一侧同样承认自己的极限 —— 拒绝表是对已知破坏形状的尽力而为，不是对一切形变的覆盖；而 v0.15.2 那一版明确没有做每会话的 WS 审批弹窗，那是往后推的一层。",
        "en": "A blocklist model leaks by construction: with no jail, any sensitive directory not on the list is wide open. The shell side admits its own ceiling too — the deny list is best-effort over known destructive shapes, not coverage of every conceivable one; and v0.15.2 explicitly did not build the per-session approval prompt, deferring that layer."
      }
    }
  },
  "dangling": {
    "figure": {
      "w": 620,
      "h": 210,
      "boxes": [
        {
          "x": 14,
          "y": 30,
          "w": 150,
          "h": 52,
          "title": {
            "zh": "模型吐出",
            "en": "model emits"
          },
          "sub": "tool_use"
        },
        {
          "x": 14,
          "y": 118,
          "w": 150,
          "h": 52,
          "title": {
            "zh": "但停在",
            "en": "but stops on"
          },
          "sub": "max_tokens / refusal"
        },
        {
          "x": 236,
          "y": 74,
          "w": 150,
          "h": 52,
          "title": {
            "zh": "进历史",
            "en": "into history"
          },
          "sub": {
            "zh": "没有配对结果",
            "en": "no tool_result"
          }
        },
        {
          "x": 452,
          "y": 74,
          "w": 150,
          "h": 52,
          "kind": "blackbox",
          "title": "API",
          "sub": {
            "zh": "此后每次都拒",
            "en": "rejects forever"
          }
        }
      ],
      "edges": [
        {
          "pts": [
            [
              168,
              56
            ],
            [
              232,
              88
            ]
          ]
        },
        {
          "pts": [
            [
              168,
              144
            ],
            [
              232,
              112
            ]
          ]
        },
        {
          "pts": [
            [
              390,
              100
            ],
            [
              448,
              100
            ]
          ]
        }
      ],
      "labels": [
        {
          "x": 236,
          "y": 140,
          "w": 360,
          "text": {
            "zh": "毒药落在回合回滚线之前——重启、折叠、裁窗都救不回来",
            "en": "the poison lands before the rollback point — restart, fold and trim cannot undo it"
          },
          "tone": "red"
        }
      ]
    },
    "claim": {
      "zh": "没有它，一轮被截断的输出能把整个 session 永久打死：模型已经吐完了一个完整的 tool_use 块，但 stopReason 不是 tool_use(max_tokens 截断，或者 refusal),分发从来没发生过 —— 这个没有配对 tool_result 的块留在历史里，之后每一次请求都被 API 400。清理把这种从未运行过的调用摘掉，因为它根本不算历史。",
      "en": "Without it, one truncated round can brick a session permanently: the model emitted a complete tool_use block but stopped for some other reason (max_tokens mid-stream, or a refusal), so dispatch never happened — and that block, with no matching tool_result, rides into history and 400s every request from then on. The cleanup drops a call that never ran, because a call that never ran is not history."
    },
    "mechanism": {
      "zh": "要命的是毒块的位置：它落在这一轮 rollback 边界之前，所以按轮回滚、L1 折叠、窗口裁剪、乃至整个进程重启，全都够不着它 —— 线上唯一救回来的办法是手改数据库。修法是在流关闭后、判定 finishReason 之前无条件调一次 dropUndispatchedToolUse:只有 stopReason 为 tool_use 且确有 pendingToolUses 时才走分发，其余一律进清理。partitionToolUse 把最后一条 assistant 消息拆成 kept 与 dropped,她流出来的文字保留；整条消息只剩下这个调用，就把整条弹掉。每个被丢掉的调用还要在 wire 上补一条 tool.finished{err, recoverable} —— 客户端对以 err 收尾的消息预览的处理就是丢弃，而一个从未送达的半截气泡本来就该消失。",
      "en": "What makes it lethal is where the poison sits: before this turn’s rollback boundary, so the per-turn rollback, the L1 fold, the window trim and a full restart all leave it in place — in production only hand-editing the DB recovered the session. The fix calls dropUndispatchedToolUse unconditionally after the stream closes and before finishReason is decided: only stopReason tool_use with actual pendingToolUses goes to dispatch, everything else goes to cleanup. partitionToolUse splits the last assistant message into kept and dropped, preserving the text she streamed; if the call was all the message contained, the whole message is popped. Each dropped call is then closed on the wire with tool.finished{err, recoverable} — the client discards a message preview that ends in an err, which is exactly what a truncated, never-delivered bubble should do."
    },
    "contract": {
      "exposes": {
        "zh": "partitionToolUse(纯函数)与 dropUndispatchedToolUse(改会话历史并发事件)。",
        "en": "partitionToolUse (pure) and dropUndispatchedToolUse (mutates session history and emits events)."
      },
      "depends": {
        "zh": "会话历史的最后一条 assistant 消息、stopReason、pendingToolUses。",
        "en": "The last assistant message in session history, stopReason, and pendingToolUses."
      },
      "boundary": {
        "zh": "只处理「没派发就没了」的调用。已经派发过的调用一定有 tool_result,不归它管。",
        "en": "Only calls that vanished before dispatch. A call that did dispatch always has a tool_result and is none of its business."
      },
      "invariant": {
        "zh": "历史里不存在没有配对 tool_result 的 tool_use 块 —— 无论这一轮怎么结束。",
        "en": "No tool_use block without a matching tool_result ever exists in history, however the turn ended."
      }
    },
    "code": {
      "file": "packages/server/src/turn/runTurn.ts",
      "lines": "846-853",
      "snippet": "function dropUndispatchedToolUse(s: TurnState): void {\n  const last = s.session.history[s.session.history.length - 1];\n  if (last === undefined || last.role !== 'assistant' || typeof last.content === 'string') return;\n  const { kept, dropped } = partitionToolUse(last.content);\n  if (dropped.length === 0) return;\n  // An assistant message that was ONLY the undispatched call has nothing left to say.\n  if (kept.length === 0) s.session.history.pop();\n  else last.content = kept;",
      "note": {
        "zh": "整条 pop 与只保留 kept 的分岔，就是「她说过的话留下、跑不了的调用消失」这条规则的全部实现。",
        "en": "That one fork — pop the whole message versus keep only kept — is the entire implementation of the rule: her words survive, the unrunnable call disappears."
      }
    },
    "decision": {
      "why": {
        "zh": "这是 v0.45.15 从审计里被提级的 P0。回归测试是反着写的：审计先写了一个必然失败的复现脚本，修完之后同一个脚本原地变成钉子 —— danglingToolUse.test.ts 里那组用例覆盖 max_tokens 截断、refusal、残留文本必须保留、wire 上必须补 err、以及单轮截断整个干净蒸发(既不入库，历史也回到起点)。",
        "en": "This was the P0 promoted out of an audit in v0.45.15. The regression test was written backwards: the audit first wrote a repro that was guaranteed to fail, and once fixed the same script became the pin — danglingToolUse.test.ts covers max_tokens truncation, refusal, surviving text being kept, the err that must close the call on the wire, and a single truncated round evaporating cleanly (nothing durable, history back to where it started)."
      },
      "cost": {
        "zh": "被丢掉的调用不会被重试 —— 这一轮她想做的事就是没做成。选的是宁可这一轮白跑，也不要 session 永久变砖。",
        "en": "A dropped call is never retried — whatever she meant to do that round simply did not happen. The trade chosen: lose the round rather than brick the session."
      }
    }
  },
  "trace": {
    "figure": {
      "w": 620,
      "h": 200,
      "boxes": [
        {
          "x": 12,
          "y": 24,
          "w": 128,
          "h": 40,
          "title": {
            "zh": "节点跃迁",
            "en": "node transition"
          }
        },
        {
          "x": 12,
          "y": 78,
          "w": 128,
          "h": 40,
          "title": {
            "zh": "工具事件",
            "en": "tool event"
          }
        },
        {
          "x": 12,
          "y": 132,
          "w": 128,
          "h": 40,
          "title": {
            "zh": "出站事件",
            "en": "outbound"
          }
        },
        {
          "x": 268,
          "y": 72,
          "w": 150,
          "h": 52,
          "title": {
            "zh": "一次性落库",
            "en": "one flush"
          },
          "sub": {
            "zh": "回合结束时",
            "en": "at turn end"
          }
        },
        {
          "x": 466,
          "y": 72,
          "w": 140,
          "h": 52,
          "title": "/_trace",
          "sub": {
            "zh": "回放这一轮",
            "en": "replay the turn"
          }
        }
      ],
      "edges": [
        {
          "pts": [
            [
              144,
              44
            ],
            [
              264,
              84
            ]
          ]
        },
        {
          "pts": [
            [
              144,
              98
            ],
            [
              264,
              98
            ]
          ]
        },
        {
          "pts": [
            [
              144,
              152
            ],
            [
              264,
              112
            ]
          ]
        },
        {
          "pts": [
            [
              422,
              98
            ],
            [
              462,
              98
            ]
          ]
        }
      ],
      "labels": [
        {
          "x": 268,
          "y": 140,
          "w": 340,
          "text": {
            "zh": "挂在状态图的跃迁上——所以对话和梦共用同一个接缝",
            "en": "hooked to graph transitions, so the turn and the dream share one seam"
          },
          "tone": "edge"
        }
      ]
    },
    "claim": {
      "zh": "没有它，前面五道闸每一次开合都是不可见的 —— 被挡下的主动动作、被纠正的失约、被丢掉的悬空调用，全部只留在 stdout 里，重启就没了。trace 把它们变成一本账：每次状态跃迁一行、每个工具事件一行、每条出站事件一行，再加上闸自己写的 decision 行，按 turn 落进 SQLite。",
      "en": "Without it, every opening and closing of the five gates above is invisible — a blocked proactive action, a corrected broken promise, a dropped dangling call, all of it living in stdout and gone on restart. The trace turns them into a ledger: one row per graph transition, one per tool event, one per outbound event, plus the decision rows the gates write themselves, landed in SQLite per turn."
    },
    "mechanism": {
      "zh": "trace(event) 是唯一入口:store 没设或 LUNA_TRACE=0 时它是 no-op,所以调用点全部可以是无条件的,turn loop 里不用到处撒 if。事件按 turn_id 在内存里攒着，在 turn 的 finally 里一次事务写完 —— 而且完整性审计被刻意排在 flushTrace 之前，好让它那条 decision 和本轮其它事件原子地落在一起。图的 onTransition 钩子负责 node 行，其中 open_stream 那一跳额外带上 token 数、首 token 延迟和 thinking 摘要。",
      "en": "trace(event) is the single entry point: a no-op when no store is set or LUNA_TRACE=0, which is why every call site can be unconditional and the turn loop is not littered with guards. Events accumulate in memory per turn_id and flush in one transaction from the turn’s finally — and the integrity audit is deliberately ordered before flushTrace so its decision row lands atomically with the rest of the turn. The graph’s onTransition hook writes the node rows, with the open_stream transition additionally carrying token count, first-token latency, and the thinking summary."
    },
    "contract": {
      "exposes": {
        "zh": "trace() / flushTrace() / setTraceStore(),以及 /_trace 这个只读视图(turn 列表 + 单 turn 的事件流)。",
        "en": "trace() / flushTrace() / setTraceStore(), plus the read-only /_trace view (a turn list and one turn’s event stream)."
      },
      "depends": {
        "zh": "一个 bun:sqlite 连接，以及 LUNA_TRACE(默认开,=0 关)。",
        "en": "One bun:sqlite connection and LUNA_TRACE (default on, =0 off)."
      },
      "boundary": {
        "zh": "纯观测层。flushTrace 自己吞异常 —— 一次 SQLITE_BUSY 或磁盘写满，绝不能让被观测的那件事失败。",
        "en": "Pure observation. flushTrace swallows its own exceptions — a SQLITE_BUSY or a full disk must never fail the thing being instrumented."
      },
      "invariant": {
        "zh": "一个 turn 的事件要么整批落库要么不落；超限也不会静默，会补一条 overflow 行写清丢了多少。",
        "en": "A turn’s events land as a batch or not at all; overflow is never silent — a single overflow row records how many were dropped."
      }
    },
    "code": {
      "file": "packages/server/src/trace/store.ts",
      "lines": "28-37",
      "snippet": "// Truncates an over-large payload into a structured, still-parseable wrapper.\n// Never byte-slices the serialized JSON (Q4 resolution).\nfunction clampPayload(json: string): string {\n  if (json.length <= MAX_PAYLOAD_BYTES) return json;\n  return JSON.stringify({\n    truncated: true,\n    original_bytes: json.length,\n    preview: json.slice(0, MAX_PAYLOAD_BYTES),\n  });\n}",
      "note": {
        "zh": "超过 4096 字节的 payload 不是把序列化后的 JSON 切一刀 —— 那会切出一个再也解析不了的串。它被重新包成 {truncated, original_bytes, preview}:观测数据必须永远可解析，哪怕内容是残的。",
        "en": "A payload over 4096 bytes is not sliced out of the serialized JSON — that would leave a string nothing can parse. It is re-wrapped as {truncated, original_bytes, preview}: observation data must stay parseable even when its content is partial."
      }
    },
    "decision": {
      "why": {
        "zh": "所有 trace 调用都留在拥有 turn 上下文的那一层边界(runTurn),下层的 dispatcher.ts 和 outbound.ts 一行都不改。上限是硬的：每 turn 500 事件；保留最近 1000 个 turn,而且不是每次 flush 都剪 —— 每 200 次 flush 剪一次，让保留策略在每一轮上的成本接近零。trace_id 直接等于 turn_id,因此跨重启不冲突，也不需要单独的 id 分配器。",
        "en": "Every trace call stays at the one boundary that owns turn context (runTurn); dispatcher.ts and outbound.ts are untouched. The caps are hard: 500 events per turn, retention of the most recent 1000 turns, and the prune runs once every 200 flushes rather than every flush so retention costs roughly nothing per turn. trace_id is simply turn_id, which is collision-free across restarts and needs no separate id allocator."
      },
      "cost": {
        "zh": "三个视角对同一时刻是冗余的：一条 tool 的 final 和一条 outbound 的 tool.finished 说的是同一件事。这是故意的 —— 一个是执行视角，一个是线上视角，排查时两者对不上本身就是信号。",
        "en": "The three lenses are redundant at the same instant: a tool final row and an outbound tool.finished row describe one moment twice. That is intentional — execution view versus wire view, and a disagreement between them is itself the signal."
      }
    }
  },

  /* ── 状态 / state persistence ─────────────────────────── */
  "realreply": {
    "figure": {
      "w": 620,
      "h": 220,
      "boxes": [
        {
          "x": 14,
          "y": 84,
          "w": 140,
          "h": 56,
          "title": {
            "zh": "回合结束",
            "en": "turn ends"
          },
          "sub": "finally"
        },
        {
          "x": 250,
          "y": 18,
          "w": 150,
          "h": 52,
          "title": {
            "zh": "落库",
            "en": "persist"
          },
          "sub": "appendL2"
        },
        {
          "x": 250,
          "y": 146,
          "w": 150,
          "h": 52,
          "title": {
            "zh": "整轮回滚",
            "en": "roll the turn back"
          },
          "sub": "history.length = historyStart"
        },
        {
          "x": 452,
          "y": 18,
          "w": 150,
          "h": 52,
          "title": {
            "zh": "标记活动",
            "en": "mark activity"
          },
          "sub": {
            "zh": "沉默计时器",
            "en": "silence timer"
          }
        }
      ],
      "edges": [
        {
          "pts": [
            [
              158,
              100
            ],
            [
              246,
              50
            ]
          ],
          "label": {
            "zh": "有真回复",
            "en": "a real reply"
          },
          "at": [
            148,
            60
          ]
        },
        {
          "pts": [
            [
              158,
              124
            ],
            [
              246,
              168
            ]
          ],
          "label": {
            "zh": "什么都没说出来",
            "en": "nothing was said"
          },
          "at": [
            140,
            186
          ]
        },
        {
          "pts": [
            [
              404,
              44
            ],
            [
              448,
              44
            ]
          ]
        }
      ],
      "labels": [
        {
          "x": 250,
          "y": 92,
          "w": 350,
          "text": {
            "zh": "空行不许进记忆：一条空的助手行会毒化召回与重建的窗口",
            "en": "an empty row never enters memory — it would poison recall and the rebuilt window"
          },
          "tone": "edge"
        }
      ]
    },
    "claim": {
      "zh": "没有这道关口，一个什么都没说出口的回合照样在记忆里留下一条空记录：重建出来的窗口读起来是「你说了 X，我什么都没回」，而且自 v0.16.2 起 L2 才是真相源，这条空白会挺过每一次重启——一次 401 断供就足以让她看起来像失忆。realReply 关口只放真的说出话的回合落库，其余整轮回滚。",
      "en": "Without this gate a turn that said nothing still leaves a row: the rebuilt window reads \"you said X, I said nothing\", and since v0.16.2 made L2 the source of truth that blank survives every reload — one 401 outage was enough to make her look amnesiac. The realReply gate lets only turns that actually spoke become durable; everything else is rolled back whole."
    },
    "mechanism": {
      "zh": "realReply 在 message 模式下是 message 工具吐出的文本拼接，text 模式下是流式累积的 state.text，都 trim 过。非空才进 appendL2，写之前先 stripThinking，再 stripCorrectiveDirectives（把回合内为纠正而临时塞进去的 user 角色舞台指示删掉，免得下一轮把伪造的用户训话当真）。为空则执行 opts.session.history.length = historyStart，把这一整轮追加的消息从内存窗口截掉——长度回到回合开始时抄下的快照点，那条悬空的 user 消息一起消失，重试时不会顶两遍。落库的 assistantText 用的是 realReply 而不是 state.text：message 模式下 state.text 装的是模型在 message 工具外面漏出来的旁白，出错回合的 finalize 从没跑过，存 state.text 就会把那句旁白当成她的正式回复。整段包在 try/catch 里，SQLite 抛错只打日志加发一个 persistence_failed 事件，绝不让 runTurn 的 promise reject，也绝不跳过后面的 trace flush 和 fold。",
      "en": "realReply is the joined message-tool text in message mode, the streamed state.text in text mode, both trimmed. Non-empty goes to appendL2, but only after stripThinking and stripCorrectiveDirectives (dropping the user-role stage directions the in-turn retry pushed, so no later window re-reads a fabricated scolding). Empty runs opts.session.history.length = historyStart, truncating everything this turn appended back to the snapshot taken at turn start — the dangling user message goes with it, so a retry cannot double it up. The stored assistantText is realReply, not state.text: in message mode state.text holds the model narrating outside the message tool, and on an errored turn finalize never ran to overwrite it, so storing it persisted the leak as the visible reply. The whole block is wrapped in try/catch — a SQLite throw is logged plus a persistence_failed event, never rejecting runTurn's promise and never skipping the trace flush or the fold below."
    },
    "contract": {
      "exposes": {
        "zh": "一个回合唯一的持久化出口：L2 的一行 + persistSession 的 turn_seq。",
        "en": "A turn's only durability exit: one L2 row plus persistSession's turn_seq."
      },
      "depends": {
        "zh": "state.messageTexts / state.text、isMessageMode、historyStart 快照、cleanHistory 的两个 strip。",
        "en": "state.messageTexts / state.text, isMessageMode, the historyStart snapshot, and cleanHistory's two strippers."
      },
      "boundary": {
        "zh": "只判断有没有说出话，不判断说得对不对。说完之后才报错的回合照样保留——那些字用户已经看见了。",
        "en": "It judges whether words were delivered, never whether they were right. A turn that errors after delivering is still kept — the user already saw them."
      },
      "invariant": {
        "zh": "L2 里不存在 assistant_text 为空的行；内存 history 要么增长，要么退回 historyStart，不会停在半路。",
        "en": "No L2 row has an empty assistant_text; in-memory history either grows or returns to historyStart, never stops halfway."
      }
    },
    "code": {
      "file": "packages/server/src/turn/runTurn.ts",
      "lines": "1066-1075",
      "snippet": "          // realReply is always the message-tool text (message mode) / streamed text.\n          assistantText: realReply,\n          rawContent: opts.session.history.slice(historyStart),\n        });\n      } else {\n        opts.session.history.length = historyStart;\n        // v0.45.17: the lyrics block just went with it — hand the delivery back so the next\n        // turn can carry the words she never actually received.\n        if (state.lyricsBurnedFor !== null) unmarkLyricsDelivered(state.lyricsBurnedFor);\n      }",
      "note": {
        "zh": "写入和撤销并排放在同一个 if/else 的两边——一次 appendL2，或者一行 history.length = historyStart。",
        "en": "The write and the undo sit on the two sides of one if/else — one appendL2, or one history.length = historyStart."
      }
    },
    "decision": {
      "why": {
        "zh": "空行污染三个面：recall 的候选集、loadSession 重建出来的窗口、以及用户看的聊天记录。三处都得靠这一个关口拦住。",
        "en": "A blank row poisons three surfaces: the recall candidate set, the window loadSession rebuilds, and the chat log the user reads. One gate has to stop all three."
      },
      "rejected": {
        "zh": "存一条带 error 标记的占位行，读的时候再过滤——被否掉，因为读点有很多个（recall、loadSession、历史面板），漏掉一个就复发。",
        "en": "Storing an error-flagged placeholder and filtering at read time — rejected: there are many read points (recall, loadSession, the history panel), and missing one brings the bug back."
      },
      "cost": {
        "zh": "回滚是整轮的：这一回合烧掉的工具调用、拿回来的网页、已经花掉的 token，全部随着 history 一起消失，没有部分保留。",
        "en": "The rollback is whole-turn: the tool calls this turn burned, the pages it fetched, the tokens already spent all vanish with the history — nothing is partially kept."
      }
    }
  },
  "fold": {
    "figure": {
      "w": 620,
      "h": 210,
      "boxes": [
        {
          "x": 16,
          "y": 66,
          "w": 190,
          "h": 54,
          "title": {
            "zh": "旧的 L2 回合",
            "en": "older L2 turns"
          },
          "sub": {
            "zh": "折成一段摘要",
            "en": "folded into a digest"
          }
        },
        {
          "x": 300,
          "y": 66,
          "w": 190,
          "h": 54,
          "title": {
            "zh": "逐字尾巴",
            "en": "verbatim tail"
          },
          "sub": {
            "zh": "最近约 100 回合",
            "en": "the recent ~100 turns"
          }
        }
      ],
      "edges": [
        {
          "pts": [
            [
              210,
              93
            ],
            [
              296,
              93
            ]
          ],
          "head": false
        },
        {
          "pts": [
            [
              253,
              30
            ],
            [
              253,
              156
            ]
          ],
          "head": false,
          "style": "breakpoint"
        },
        {
          "pts": [
            [
              110,
              132
            ],
            [
              110,
              178
            ]
          ],
          "label": {
            "zh": "异步 · CAS 提交",
            "en": "async · CAS commit"
          },
          "at": [
            130,
            176
          ]
        }
      ],
      "labels": [
        {
          "x": 190,
          "y": 6,
          "w": 200,
          "text": "window_low_water",
          "tone": "red"
        },
        {
          "x": 300,
          "y": 132,
          "w": 260,
          "text": {
            "zh": "回复已经发走之后才跑——它不在首 token 的路上",
            "en": "runs after the reply is out — never on the first-token path"
          },
          "tone": "edge"
        }
      ]
    },
    "claim": {
      "zh": "没有折叠，逐字窗口只会一直长，每一轮把整段历史重新发一遍——那次 390K token 的单轮就是这么来的（普通聊天约 1 美元一轮）。折叠把最老的一批回合换成一份结构化摘要，把窗口拉回 100 轮。",
      "en": "Without the fold the verbatim window only grows, resending the whole history every turn — that is the 390K-token turn (~$1 a turn on plain chat). The fold swaps the oldest batch of turns for a structured digest and pulls the window back to 100 turns."
    },
    "mechanism": {
      "zh": "决策单位是回合（一条 L2 行）不是消息：未折叠回合数超过 keep + batch（默认 100 + 10）才动手，一次折掉 unfolded - keep 条，边界永远落在回合起点，绝不劈开 tool_use 与 tool_result 的配对。压缩器拿到的是当前摘要加上新回合的逐字原文，重新推导出整份摘要而不是往后追加，所以反复折叠不会把摘要撑大；importance ≥ 4 的回合打上 [salient] 标记，要求近乎原样保留。提交是 CAS：maybeFold 在调 LLM 之前把 session.windowLowWater 抄进 expected，commitFold 的 UPDATE 带 WHERE window_low_water = expected，changes 不等于 1 就是输掉竞争——摘要整份丢弃，内存里的 rollingSummary 和 windowLowWater 一个字都不改，下一次 fold 从头再来。空摘要（模型只出了思考、或撞上 max_tokens）同样直接返回 false，绝不用空串覆盖并推进水位，那会悄悄缩小活动上下文。另有一道与折叠无关的硬网：hardTrimTail 在每次组装上下文时按 300 条消息和 120000 字符两个上限剪尾，切在同时满足两个预算的最早回合起点；一旦触发就说明折叠已经落后了，日志会喊 hard trim engaged。",
      "en": "The unit of decision is a turn (one L2 row), not a message: the fold fires only when unfolded turns exceed keep + batch (100 + 10 by default), folds unfolded - keep of them, and always lands the boundary on a turn start so a tool_use / tool_result pair is never split. The compressor receives the current digest plus the new turns verbatim and re-derives the whole digest rather than appending, so repeated folds never grow it; turns with importance >= 4 are marked [salient] and their specifics must survive near-verbatim. The commit is a CAS: maybeFold snapshots session.windowLowWater into expected before the LLM call, commitFold's UPDATE carries WHERE window_low_water = expected, and changes !== 1 means the race was lost — the digest is discarded whole, neither rollingSummary nor windowLowWater is touched in memory, and the next fold starts over. An empty digest (thinking only, or max_tokens) likewise returns false: overwriting rolling_summary with an empty string while advancing the low-water mark would silently shrink the active context. A separate hard net runs on every context assembly: hardTrimTail bounds the tail at 300 messages and 120000 characters, cutting at the earliest turn start that fits both budgets, and logs \"hard trim engaged\" — which means folding is lagging."
    },
    "contract": {
      "exposes": {
        "zh": "buildActiveContext —— 发给模型的那份有界视图：可选的摘要消息加上逐字尾巴。",
        "en": "buildActiveContext — the bounded view sent to the model: an optional digest message plus the verbatim tail."
      },
      "depends": {
        "zh": "L2 的逐字列（planFold 只读 L2，从不把自己上一轮的摘要当输入原文）、provider.complete、session.windowLowWater。",
        "en": "L2's verbatim columns (planFold reads only L2, never feeds a prior digest back in as source), provider.complete, and session.windowLowWater."
      },
      "boundary": {
        "zh": "session.history 本身永远不截断，它是 L2 的内存镜像；折叠只改发出去的那一份。",
        "en": "session.history is never truncated — it mirrors L2; the fold only changes what gets sent."
      },
      "invariant": {
        "zh": "折叠边界永远落在回合起点；水位只前进，且只在 CAS 成功时前进。",
        "en": "The fold boundary always lands on a turn start; the low-water mark only moves forward, and only on a successful CAS."
      }
    },
    "code": {
      "file": "packages/server/src/memory/l1Window.ts",
      "lines": "209-222",
      "snippet": "  let digest = result.text.trim();\n  // An empty digest (complete() returned only thinking / hit max_tokens / a\n  // transient blip) must NOT overwrite rolling_summary with '' and advance the\n  // low-water mark — that silently shrinks active context. Skip; retry next fold.\n  if (!digest) return false;\n  const cap = summaryMaxChars();\n  if (digest.length > cap) digest = digest.slice(0, cap);\n\n  const landed = commitFold(session.id, digest, plan.newLowWater, expected);\n  if (landed && session.windowLowWater === expected) {\n    session.rollingSummary = digest;\n    session.windowLowWater = plan.newLowWater;\n  }\n  return landed;",
      "note": {
        "zh": "expected 是 LLM 调用之前抄下的水位；提交没落地时，内存状态一个字段都不动——失败是彻底的，不留半步。",
        "en": "expected is the low-water mark snapshotted before the LLM call; when the commit does not land, not one in-memory field moves — failure is total, never half-applied."
      }
    },
    "decision": {
      "why": {
        "zh": "折叠要跑一次 LLM（maxTokens 1024），放进回合里就是给每次回复加一段等待。所以它在 finally 里以 void maybeFold(...) 起飞，回复早已发走，失败被 .catch 吞掉。",
        "en": "The fold costs an LLM call (maxTokens 1024); inside the turn that is latency on every reply. So it is launched as void maybeFold(...) in the finally, after the reply has already gone out, with failures swallowed by .catch."
      },
      "rejected": {
        "zh": "旧的 append-only rolling_summary（摘要自己会无界增长，换成每次重新推导加 3000 字硬顶），以及旧的「水位对不上就 bail」守卫——一次性的计数漂移会让折叠永久停摆，现在改成对齐到刚跨过的行边界并打警告。",
        "en": "The old append-only rolling_summary (it grew unboundedly; replaced by a re-derived digest under a 3000-character cap), and the old bail-on-mismatched-watermark guard — a one-off count drift stalled the fold permanently, so it now heals to the row boundary just crossed and warns."
      },
      "cost": {
        "zh": "折叠是尽力而为，连续失败时只剩 hardTrimTail 兜底；被硬剪掉的前段消息在这一轮上下文里既不在摘要也不在尾巴——它们仍在 L2 可被 recall 捞回，但那一轮模型看不到。",
        "en": "The fold is best-effort; when it keeps failing only hardTrimTail is left. Messages it cuts are in neither the digest nor the tail for that turn — still in L2 and reachable by recall, but invisible to the model right then."
      }
    }
  },
  "layers": {
    "figure": {
      "w": 620,
      "h": 220,
      "boxes": [
        {
          "x": 20,
          "y": 26,
          "w": 172,
          "h": 46,
          "title": "L1",
          "sub": {
            "zh": "活跃窗口",
            "en": "the live window"
          }
        },
        {
          "x": 20,
          "y": 92,
          "w": 172,
          "h": 46,
          "title": "L2",
          "sub": {
            "zh": "耐久回合",
            "en": "durable turns"
          }
        },
        {
          "x": 20,
          "y": 158,
          "w": 172,
          "h": 46,
          "title": "L3",
          "sub": {
            "zh": "长期事实",
            "en": "long-lived facts"
          }
        },
        {
          "x": 306,
          "y": 60,
          "w": 168,
          "h": 46,
          "title": {
            "zh": "灵魂 · 固定核心",
            "en": "soul · fixed core"
          },
          "sub": {
            "zh": "主人写的",
            "en": "his to edit"
          }
        },
        {
          "x": 306,
          "y": 128,
          "w": 168,
          "h": 46,
          "title": {
            "zh": "灵魂 · 演化段",
            "en": "soul · evolving"
          },
          "sub": {
            "zh": "她自己写的",
            "en": "hers to write"
          }
        }
      ],
      "edges": [
        {
          "pts": [
            [
              196,
              49
            ],
            [
              196,
              92
            ]
          ],
          "head": false
        },
        {
          "pts": [
            [
              196,
              115
            ],
            [
              196,
              158
            ]
          ],
          "head": false
        },
        {
          "pts": [
            [
              478,
              83
            ],
            [
              560,
              83
            ]
          ]
        },
        {
          "pts": [
            [
              478,
              151
            ],
            [
              560,
              151
            ]
          ]
        }
      ],
      "labels": [
        {
          "x": 20,
          "y": 4,
          "w": 260,
          "text": {
            "zh": "越往下越久，也越少",
            "en": "the further down, the longer-lived and the fewer"
          },
          "tone": "edge"
        },
        {
          "x": 540,
          "y": 96,
          "w": 76,
          "text": {
            "zh": "每回合注入",
            "en": "injected every turn"
          },
          "tone": "edge"
        }
      ]
    },
    "claim": {
      "zh": "不分层的话，记忆就只有一条逐字长河：要么全带上（贵，而且迟早超窗），要么截断（她就是忘了）。分成 L1 有界窗口 / L2 追加式回合时间线 / L3 结构化事实 / 灵魂四层之后，每层有自己的有界方式和自己的写者。",
      "en": "Unlayered, memory is one verbatim river: carry all of it (expensive, and eventually over the window) or truncate it (she simply forgot). Split into L1 bounded window, L2 append-only turn timeline, L3 structured facts, and the soul, each layer gets its own bound and its own writer."
    },
    "mechanism": {
      "zh": "L2 是唯一的真相源：每条 raw_json 正好是那一轮往 history 追加的消息，按 t_ms 顺序拼起来就重建出完整历史，所以每轮持久化是 O(1)——sessions.history_json 现在只写一个常量 [] 占位，不再每轮重新序列化整段历史。L3 是五类结构化事实：core_facts、preferences、key_moments、active_threads、project_context；进系统提示时按类封顶（15 / 10 / 12 / 6 / 8），存储本身不封顶，靠梦里的 refine_semantic 修剪，active_threads 默认 14 天过期。forget 是软删除：只写 deleted_ms，行永远留着；listFacts 把 created_ms <= at、deleted_ms 为空或大于 at、expires_ms 为空或大于 at 三个条件合起来查，asOf 一给就是一句「那个时刻她记得什么」的回看。灵魂是一张单行表，分两半：fixed_text 是主人的（首次启动从 git 的 default.md 播种一次，之后只有工作区编辑器能改），evolving_self 与 evolving_bond 是她自己长的那半，梦的 persona_update 每次改都先往 soul_audit 写一条前值，restoreEvolving 靠这条审计回退。renderSoulBlock 把固定核心放最前，她的两段带小标题接在下面。",
      "en": "L2 is the single source of truth: each raw_json is exactly the messages that turn appended, so concatenating them in t_ms order reconstitutes the whole history — which makes per-turn persistence O(1), with sessions.history_json now written as a constant [] placeholder instead of re-serializing the growing history. L3 holds five fact categories — core_facts, preferences, key_moments, active_threads, project_context — capped per category at render time (15 / 10 / 12 / 6 / 8) while storage stays unbounded and the dream's refine_semantic prunes; active_threads expire after 14 days by default. forget is a soft delete: it writes deleted_ms and never removes the row, and listFacts combines created_ms <= at with deleted_ms null-or-later and expires_ms null-or-later, so passing asOf is a query for what she knew at that moment. The soul is a single row in two halves: fixed_text belongs to the owner (seeded once at first boot from git's default.md, afterwards editable only through the workspace editor), while evolving_self and evolving_bond are the half she grows — the dream's persona_update writes the previous values to soul_audit before every change, which is what restoreEvolving rewinds. renderSoulBlock puts the fixed core first and her two sections, each under its own heading, beneath it."
    },
    "contract": {
      "exposes": {
        "zh": "renderCoreBlock（L3 那段，现在只渲染事实清单）、renderSoulBlock（灵魂那段）、addFact / forgetFact / listFacts。",
        "en": "renderCoreBlock (the L3 section, now facts only), renderSoulBlock (the soul section), and addFact / forgetFact / listFacts."
      },
      "depends": {
        "zh": "同一个 SQLite 连接（getMemoryDb）、bumpMemoryEpoch——任何真实写入都要顶一次 epoch，缓存的 system block 才会重渲染。",
        "en": "One SQLite connection (getMemoryDb) and bumpMemoryEpoch — every real write bumps the epoch so the cached system block re-renders."
      },
      "boundary": {
        "zh": "梦够不到 soul.fixed_text：从 persona_update 到 fixed_text 没有任何代码路径，updateFixedCore 只被工作区的主人编辑器调用。这道防火墙有测试钉住。",
        "en": "The dream cannot reach soul.fixed_text: there is no code path from persona_update to it, and updateFixedCore is called only by the owner's workspace editor. The firewall is test-pinned."
      },
      "invariant": {
        "zh": "这两段渲染必须逐字节稳定，除非记忆真的变了；里面不许插时间戳——它们坐在唯一那个带缓存断点的 system block 里，一个字节的差异就打掉整段前缀缓存。",
        "en": "Both renders must be byte-identical across turns unless memory actually changed, and must never interpolate a timestamp — they sit inside the one cached system block, where a single differing byte invalidates the whole prefix cache."
      }
    },
    "code": {
      "file": "packages/server/src/memory/l3Store.ts",
      "lines": "59-68",
      "snippet": "// Soft delete: sets deleted_ms, never removes the row. \"This was once true\"\n// stays queryable via asOf — the deliberate divergence from Python's hard-delete.\nexport function forgetFact(id: string): ForgetResult | null {\n  const db = getMemoryDb();\n  if (!db) return null;\n  const result = db\n    .prepare('UPDATE l3_facts SET deleted_ms = ? WHERE id = ? AND deleted_ms IS NULL')\n    .run(Date.now(), id);\n  if (result.changes === 1) bumpMemoryEpoch(); // A1: re-render the cached system block\n  return { status: result.changes === 1 ? 'forgotten' : 'not_found', id };",
      "note": {
        "zh": "忘记从不删行，只盖一个时间戳——配上 listFacts 的 asOf，遗忘本身也是可回看的历史。",
        "en": "Forgetting never deletes a row, it stamps one — and with listFacts's asOf, the forgetting itself stays inspectable history."
      }
    },
    "decision": {
      "why": {
        "zh": "软删除是相对 Python 原版硬删除的一次故意分叉：一个自主的写者（梦）能删记忆，那删除就必须可回看、可解释。",
        "en": "The soft delete is a deliberate divergence from the Python original's hard delete: if an autonomous writer (the dream) can remove memories, removal has to stay inspectable."
      },
      "cost": {
        "zh": "l3_facts 只增不减，删过的行永远躺在库里；而且去重只在未删除的行之间查（WHERE deleted_ms IS NULL），所以同一句话删掉之后可以再加一次，库里会留下两条历史行。",
        "en": "l3_facts only grows — deleted rows stay forever — and dedup checks only live rows (WHERE deleted_ms IS NULL), so the same sentence can be re-added after a forget, leaving two historical rows."
      }
    }
  },
  "dream": {
    "figure": {
      "w": 620,
      "h": 250,
      "boxes": [
        {
          "x": 12,
          "y": 30,
          "w": 132,
          "h": 40,
          "title": "rate_salience"
        },
        {
          "x": 164,
          "y": 30,
          "w": 140,
          "h": 40,
          "title": "refine_semantic"
        },
        {
          "x": 324,
          "y": 30,
          "w": 132,
          "h": 40,
          "title": "refine_layer1"
        },
        {
          "x": 476,
          "y": 30,
          "w": 130,
          "h": 40,
          "title": "memory_audit"
        },
        {
          "x": 12,
          "y": 128,
          "w": 132,
          "h": 40,
          "title": "persona_update"
        },
        {
          "x": 164,
          "y": 128,
          "w": 140,
          "h": 40,
          "title": "run_diaries"
        },
        {
          "x": 324,
          "y": 128,
          "w": 132,
          "h": 40,
          "title": "distill_skills"
        },
        {
          "x": 476,
          "y": 128,
          "w": 130,
          "h": 40,
          "title": "rag_refresh"
        }
      ],
      "edges": [
        {
          "pts": [
            [
              148,
              50
            ],
            [
              160,
              50
            ]
          ]
        },
        {
          "pts": [
            [
              308,
              50
            ],
            [
              320,
              50
            ]
          ]
        },
        {
          "pts": [
            [
              460,
              50
            ],
            [
              472,
              50
            ]
          ]
        },
        {
          "pts": [
            [
              541,
              74
            ],
            [
              541,
              96
            ],
            [
              78,
              96
            ],
            [
              78,
              124
            ]
          ]
        },
        {
          "pts": [
            [
              148,
              148
            ],
            [
              160,
              148
            ]
          ]
        },
        {
          "pts": [
            [
              308,
              148
            ],
            [
              320,
              148
            ]
          ]
        },
        {
          "pts": [
            [
              460,
              148
            ],
            [
              472,
              148
            ]
          ]
        }
      ],
      "labels": [
        {
          "x": 324,
          "y": 178,
          "w": 290,
          "text": {
            "zh": "蒸馏排在预热之前——当夜学到的技能，当夜就进索引",
            "en": "distillation precedes the warm-up, so a skill learned tonight is embedded tonight"
          },
          "tone": "red"
        },
        {
          "x": 12,
          "y": 200,
          "w": 280,
          "text": {
            "zh": "summarizer key 先跑，主 key 只兜底——夜里的活不跟实时回复抢额度",
            "en": "summarizer key first, main key only as fallback — night work never competes with the live reply"
          },
          "tone": "edge"
        }
      ]
    },
    "claim": {
      "zh": "没有梦，整理只能发生在回合里：她一边回话一边给回合打分、修记忆、写日记，用户在等。梦把这些搬到第二台状态机上——八步固定顺序、优先走独立的 summarizer key、跑完停在 finished_idle 等唤醒。",
      "en": "Without the dream, consolidation happens inside turns: rating, memory repair, and diary writing while the user waits. The dream moves all of it onto a second state machine — eight fixed steps, running first on a separate summarizer key, parking at finished_idle when done."
    },
    "mechanism": {
      "zh": "梦复用回合那台 runGraph（一个编排形状、一条 trace 缝），只是把节点集换成 DreamNode 的八个，顺序写死在 ORDER 里：rate_salience、refine_semantic、refine_layer1、memory_audit、persona_update、run_diaries、distill_skills、rag_refresh。顺序不是随便排的：rate_salience 必须在 refine_layer1 之前，因为折叠要用 importance 给重要回合打 [salient] 锚，防止它们被过度概括；distill_skills 排在 run_diaries 之后、rag_refresh 之前，是为了让本轮新蒸馏出的技能在同一轮里被 rag_refresh 预热成向量，否则要等到下一次梦才可检索。每步被 runStep 包住：抛错记成 failed 但不中断整轮，发一条 dream.step 事件，并且每步都单独 flushTrace 一次——中途崩了，已完成的步不丢。LLM 走 dreamCall 的两跳级联：LUNA_SUMMARIZER_API_KEY 那个 provider 优先，空文本或异常才落回主 provider，失败被分类成 rate_limited、content_filter、auth、empty_text、exception。trigger 有三种来源写进 dream_reports：shutdown（退出路径）、manual（菜单 dream.enter）、self（她自己的 enter_dream）——在 v0.45.12 之前这三条路径在报告里完全分不出来。",
      "en": "The dream reuses the turn loop's runGraph — one orchestration shape, one trace seam — swapping in eight DreamNodes whose order is pinned in ORDER: rate_salience, refine_semantic, refine_layer1, memory_audit, persona_update, run_diaries, distill_skills, rag_refresh. The order is load-bearing: rate_salience must precede refine_layer1 because the fold uses importance to anchor salient turns as [salient] against over-summarization, and distill_skills sits after run_diaries but before rag_refresh so a freshly distilled skill is embedded in the SAME cycle rather than waiting for the next dream to become retrievable. Each step is wrapped by runStep: a throw is recorded as failed without aborting the cycle, a dream.step event is emitted, and traces are flushed per step so a mid-cycle crash keeps the completed ones. The LLM path is dreamCall's two-attempt cascade: the LUNA_SUMMARIZER_API_KEY provider first, falling back to the main provider on empty text or an exception, with failures classified as rate_limited, content_filter, auth, empty_text, or exception. Three triggers are recorded in dream_reports: shutdown (the exit path), manual (the dream.enter menu), self (her own enter_dream) — before v0.45.12 the three were indistinguishable in the reports."
    },
    "contract": {
      "exposes": {
        "zh": "dream_reports 的一行（started_ms / ended_ms / report_json 里的 steps 与 trigger），以及 dream.step 与 dream.status 两类事件。",
        "en": "One dream_reports row (started_ms / ended_ms / the steps and trigger inside report_json) plus dream.step and dream.status events."
      },
      "depends": {
        "zh": "runGraph、DreamLLM 的 primary 加 fallback、L2 时间线、l3Store、soulStore、skillStore、embeddings_cache。",
        "en": "runGraph, DreamLLM's primary plus fallback, the L2 timeline, l3Store, soulStore, skillStore, and embeddings_cache."
      },
      "boundary": {
        "zh": "梦只写灵魂的 evolving 那半，碰不到 fixed_text；蒸馏出的技能只走审计过的 saveSkill / deprecateSkill（source 标 dream），而且梦不许复活已废弃的技能——那是清醒路径或主人的权限。",
        "en": "The dream writes only the soul's evolving half, never fixed_text; distilled skills go solely through the audited saveSkill / deprecateSkill (source dream), and the dream may never revive a deprecated skill — that is the awake path's or the owner's call."
      },
      "invariant": {
        "zh": "状态是模块内存加 SQLite 写穿；崩在梦里会留下 is_dreaming = 1，bootReconcile 启动时把那一轮标成 aborted 并停回清醒，否则聊天会被永久挡住。",
        "en": "State is module memory with a SQLite write-through; a crash mid-dream leaves is_dreaming = 1, and bootReconcile marks that cycle aborted and parks awake at startup — otherwise chat stays gated forever."
      }
    },
    "code": {
      "file": "packages/server/src/dream/cycle.ts",
      "lines": "87-98",
      "snippet": "const ORDER: DreamNode[] = [\n  'rate_salience',\n  'refine_semantic',\n  'refine_layer1',\n  'memory_audit',\n  'persona_update',\n  'run_diaries',\n  // v0.32.2: distillation sits between the diaries and the embed pre-warm so a\n  // freshly distilled skill is embedded in the SAME cycle (rag_refresh reads it).\n  'distill_skills',\n  'rag_refresh',\n];",
      "note": {
        "zh": "顺序本身就是约束——注释直接写明 distill_skills 为什么必须挤在日记和向量预热之间。",
        "en": "The order is itself the constraint — the comment says outright why distill_skills has to sit between the diaries and the embed pre-warm."
      }
    },
    "decision": {
      "why": {
        "zh": "shutdown 触发的梦被两道闸限住：最小间隔（LUNA_SHUTDOWN_DREAM_MIN_GAP_MS，默认 6 小时；否则桌面每次关窗都做一次完整的梦），和夜间窗口（默认 21-6，本地时钟）。她自己的 enter_dream 也查窗口，只有菜单里的手动 dream.enter 不查。",
        "en": "Shutdown dreams are held behind two gates: a minimum gap (LUNA_SHUTDOWN_DREAM_MIN_GAP_MS, 6h by default — otherwise every desktop window close ran a full cycle) and a night window (21-6 local by default). Her own enter_dream checks the window too; only the manual dream.enter menu path skips it."
      },
      "rejected": {
        "zh": "在完成时才盖时间戳——被否掉：一次中止的梦从不盖章，戳会冻在上一次完成的梦上，于是每次退出都永远「该做梦了」（8 月 8 日 40 分钟里做了四次，全部中止）。现在改成一进梦就盖。",
        "en": "Stamping the timestamp on completion — rejected: an aborted dream never stamped, so the mark froze at the last completed dream and every exit was perpetually due (four dreams in 40 minutes on 8/8, all aborted). It now stamps on entry."
      },
      "cost": {
        "zh": "跑完之后 is_dreaming 仍然是 1，必须显式 wake() 才恢复聊天（照搬 Python v0.56.0 的语义）——代价是「梦完了但还没醒」是一个真实存在、会卡住聊天的状态。",
        "en": "After the cycle is_dreaming stays 1 and only an explicit wake() resumes chat (Python v0.56.0 semantics) — the cost being that \"finished dreaming but not yet awake\" is a real state that gates chat."
      }
    }
  },
  "sqlite": {
    "figure": {
      "w": 620,
      "h": 200,
      "boxes": [
        {
          "x": 34,
          "y": 66,
          "w": 168,
          "h": 60,
          "title": "luna.sqlite",
          "sub": {
            "zh": "一个文件",
            "en": "one file"
          }
        },
        {
          "x": 288,
          "y": 18,
          "w": 148,
          "h": 42,
          "title": {
            "zh": "回合与事实",
            "en": "turns and facts"
          }
        },
        {
          "x": 288,
          "y": 76,
          "w": 148,
          "h": 42,
          "title": {
            "zh": "日记 · 技能 · 灵魂",
            "en": "diaries · skills · soul"
          }
        },
        {
          "x": 288,
          "y": 134,
          "w": 148,
          "h": 42,
          "title": {
            "zh": "追踪 · 设置",
            "en": "traces · settings"
          }
        },
        {
          "x": 470,
          "y": 76,
          "w": 136,
          "h": 42,
          "title": {
            "zh": "可备份 · 可回看",
            "en": "copyable · replayable"
          }
        }
      ],
      "edges": [
        {
          "pts": [
            [
              206,
              84
            ],
            [
              284,
              40
            ]
          ]
        },
        {
          "pts": [
            [
              206,
              96
            ],
            [
              284,
              96
            ]
          ]
        },
        {
          "pts": [
            [
              206,
              110
            ],
            [
              284,
              154
            ]
          ]
        },
        {
          "pts": [
            [
              440,
              97
            ],
            [
              466,
              97
            ]
          ]
        }
      ],
      "labels": [
        {
          "x": 34,
          "y": 140,
          "w": 240,
          "text": {
            "zh": "她的全部，可以拷进 U 盘",
            "en": "all of her fits on a thumb drive"
          },
          "tone": "red"
        }
      ]
    },
    "claim": {
      "zh": "没有它，上面每一层都得自己挑存储、自己处理并发和崩溃恢复。Luna 的全部状态就是仓库根上的一个文件 luna.sqlite：22 个迁移、18 张活着的表，WAL 模式。删掉这个文件等于让她彻底重生。",
      "en": "Without it every layer above would pick its own storage and handle concurrency and crash recovery alone. All of Luna's state is one file at the repo root, luna.sqlite: 22 migrations, 18 live tables, in WAL mode. Deleting that file is a full rebirth."
    },
    "mechanism": {
      "zh": "openDb 打开时固定三条 pragma：journal_mode = WAL、foreign_keys = ON、busy_timeout = 5000。migrate 读 migrations 目录下的 NNNN_*.sql，排序后跳过编号不大于当前 user_version 的，剩下的每个文件在一个事务里执行，并在同一个事务里把 user_version 顶到该编号——所以一个迁移要么整体生效要么整体不生效，不会留下半张表。真正跑之前还有一道守卫：同一个编号出现两次直接抛错，因为第二个文件本来会被静悄悄跳过。22 个文件里有 20 条 CREATE TABLE，0017 把 core_memory 与 core_memory_audit 两张退休表 DROP 掉，所以迁移跑完 user_version = 22、活着的表是 18 张。DB 路径钉死在仓库根（从 import.meta.dir 上溯三层），从子目录启动也不会另开一个空库；LUNA_DB_PATH 与 LUNA_MIGRATIONS_DIR 是给编译版 sidecar 的逃生口（bun build --compile 出来的二进制里 import.meta.dir 是虚的）。",
      "en": "openDb pins three pragmas: journal_mode = WAL, foreign_keys = ON, busy_timeout = 5000. migrate reads migrations/NNNN_*.sql, sorts them, skips any number at or below the DB's user_version, and runs each remaining file inside a transaction that also bumps user_version to that number — so a migration either lands whole or not at all, never leaving half a table. Before running anything there is a guard: a duplicate number throws, because the second file would otherwise be silently skipped. The 22 files hold 20 CREATE TABLE statements, and 0017 drops the two retired ones (core_memory, core_memory_audit) — so a fully migrated DB reports user_version = 22 and 18 live tables. The path is pinned to the repo root (three levels up from import.meta.dir) so launching from a subdirectory cannot quietly create a second empty database; LUNA_DB_PATH and LUNA_MIGRATIONS_DIR are the escape hatches for the compiled sidecar, whose bun build --compile binary has a virtual import.meta.dir."
    },
    "contract": {
      "exposes": {
        "zh": "一个 Database 句柄，经 setMemoryDb 分发给所有 store；以及 user_version 这一个版本号。",
        "en": "One Database handle, handed to every store via setMemoryDb, and one version number: user_version."
      },
      "depends": {
        "zh": "bun:sqlite；扩展加载能力靠 initCustomSqlite 在任何 Database 构造之前把 Bun 指向一个允许加载扩展的 libsqlite3（macOS 系统自带那个把扩展加载编译掉了）。",
        "en": "bun:sqlite, plus initCustomSqlite pointing Bun at an extension-capable libsqlite3 before any Database is constructed (macOS's system SQLite compiles extension loading out)."
      },
      "boundary": {
        "zh": "LUNA_PERSIST=0 时不调 setMemoryDb——所有 store 的 getMemoryDb 拿到 null，每个写函数第一行就 return，整个进程变成纯内存态。",
        "en": "With LUNA_PERSIST=0 setMemoryDb is never called — every store's getMemoryDb returns null and each write function returns on its first line, leaving the process purely in-memory."
      },
      "invariant": {
        "zh": "user_version 等于已应用的最大迁移编号；迁移编号不重复，且只向前加，永不改写已发布的文件。",
        "en": "user_version equals the highest applied migration number; numbers never repeat, only ever get appended, and a shipped file is never rewritten."
      }
    },
    "code": {
      "file": "packages/server/src/sql.ts",
      "lines": "38-51",
      "snippet": "  let current = userVersion(db);\n  for (const file of files) {\n    const match = file.match(/^(\\d+)_/);\n    if (!match || !match[1]) continue;\n    const version = Number(match[1]);\n    if (version <= current) continue;\n\n    const sql = readFileSync(join(migrationsDir, file), 'utf8');\n    db.transaction(() => {\n      db.exec(sql);\n      db.exec(`PRAGMA user_version = ${version}`);\n    })();\n    current = version;\n  }",
      "note": {
        "zh": "exec 和 PRAGMA user_version 在同一个事务里——迁移的原子性就是这三行。",
        "en": "The exec and the PRAGMA user_version bump share one transaction — those three lines are the whole atomicity story."
      }
    },
    "decision": {
      "why": {
        "zh": "一个文件、一个进程、一个连接：没有服务、没有连接池，WAL 加 5 秒 busy_timeout 足够承担唯一的写者。",
        "en": "One file, one process, one connection: no service, no pool — WAL plus a 5-second busy_timeout is enough for a single writer."
      },
      "rejected": {
        "zh": "sqlite-vec 的 vec0 向量检索。v0.16.2 删掉了那张只写不查的虚拟表，检索是（并且至今仍是）TS 里的 cosine。所以扩展探测失败今天什么也不影响：resolveSqliteLib 找不到候选库就返回 null，initCustomSqlite 返回 false，进程照常用 Bun 自带的 SQLite 跑下去；而真正把扩展加载到连接上的 tryLoadVec，在整个仓库里目前一个调用者都没有。",
        "en": "sqlite-vec's vec0 KNN. v0.16.2 removed the write-only virtual table, and retrieval is — and still is — the TS cosine. So a failed extension probe changes nothing today: resolveSqliteLib returns null when no candidate library exists, initCustomSqlite returns false, and the process runs on Bun's bundled SQLite; while tryLoadVec, the function that would actually load the extension onto a connection, has no caller anywhere in the repo."
      },
      "cost": {
        "zh": "留着一个没人调用的加载器、一条 sqlite-vec 依赖、以及一份跨平台的库路径探测清单——换的是等语料真的大到需要 KNN 时不必重新加回来。",
        "en": "An uncalled loader, a sqlite-vec dependency, and a cross-platform library-probe list are kept — the price of not having to re-add them when the corpus finally grows into needing KNN."
      }
    }
  },

  /* ── 时钟 / Luna’s own ─────────────────────────── */
  "beat": {
    "figure": {
      "w": 620,
      "h": 190,
      "boxes": [
        {
          "x": 26,
          "y": 70,
          "w": 148,
          "h": 52,
          "title": {
            "zh": "每 60 秒",
            "en": "every 60s"
          },
          "sub": "setInterval"
        },
        {
          "x": 262,
          "y": 70,
          "w": 156,
          "h": 52,
          "title": {
            "zh": "一次判断",
            "en": "one decision"
          },
          "sub": "tickOnce"
        },
        {
          "x": 470,
          "y": 70,
          "w": 136,
          "h": 52,
          "title": {
            "zh": "随进程死",
            "en": "dies with the process"
          },
          "sub": ".unref()"
        }
      ],
      "edges": [
        {
          "pts": [
            [
              178,
              96
            ],
            [
              258,
              96
            ]
          ]
        },
        {
          "pts": [
            [
              422,
              96
            ],
            [
              466,
              96
            ]
          ]
        }
      ],
      "labels": [
        {
          "x": 26,
          "y": 136,
          "w": 400,
          "text": {
            "zh": "没有任何代码停它——要停心跳，只能停进程",
            "en": "nothing ever stops it; to stop the heartbeat you stop the process"
          },
          "tone": "red"
        }
      ]
    },
    "claim": {
      "zh": "没有它，Luna 只在被叫醒时存在——所有自主行为都塌回成对请求的回应，第二个入口根本不存在。它是一个服务端的 60 秒 setInterval：每跳一次，就替每个活跃会话问一遍「现在要不要醒」。",
      "en": "Without it Luna only exists when spoken to — every autonomous behavior collapses back into a response to a request, and the second entrance simply is not there. It is one server-side 60-second setInterval: on each beat it asks, once per active session, whether she should wake."
    },
    "mechanism": {
      "zh": "tick 间隔读 LUNA_PROACTIVE_TICK_SECONDS，默认 60 秒，被 Math.max(5, …) 夹住下限。定时器建好后立刻 .unref()：它不再计入事件循环的存活引用，进程该退就退。全仓没有任何一处对这个定时器调用 clearInterval——v0.45.14 删掉了那个从未被调用过的 stopScheduler——所以它的完整生命周期就是：启动一次，随进程一起死，这正是设计意图。另有一个模块级 ticking 布尔把 tick 串起来，因为一次 tick 里的主动回合完全可能比 tick 间隔还长。",
      "en": "The tick interval comes from LUNA_PROACTIVE_TICK_SECONDS, defaulting to 60 seconds, with a floor clamped by Math.max(5, …). The timer is .unref()d the moment it is created: it no longer counts as a liveness reference on the event loop, so the process exits when it should. Nothing anywhere in the repo calls clearInterval on this timer — v0.45.14 deleted the never-called stopScheduler — so its whole lifecycle is: started once, dies with the process, which is exactly the intent. A module-level `ticking` boolean serializes the beats, because a proactive turn started by one tick can easily outlast the tick interval."
    },
    "contract": {
      "exposes": {
        "zh": "startScheduler(deps) 与 runTick(deps)——后者导出给测试直接驱动，不碰真定时器。",
        "en": "startScheduler(deps) and runTick(deps) — the latter is exported so tests drive a beat directly, with no real timer."
      },
      "depends": {
        "zh": "proactiveEnabled()、isDreaming()、activeSessionIds()，以及唯一的漏斗 maybeFireProactive。",
        "en": "proactiveEnabled(), isDreaming(), activeSessionIds(), and the single funnel maybeFireProactive."
      },
      "boundary": {
        "zh": "心跳只决定「何时问一次」，从不决定「要不要开口」——那是沉默阶梯的事。纯后端，不依赖任何 UI 存活（Python v0.45.0 的教训）。",
        "en": "The heartbeat decides only when to ask, never whether to speak — that belongs to the silence ladder. Pure backend, with no dependency on UI liveness (the Python v0.45.0 lesson)."
      },
      "invariant": {
        "zh": "同一时刻最多一个 tick 在跑；这个定时器永远不阻止进程退出。",
        "en": "At most one tick runs at a time; this timer never keeps the process alive."
      }
    },
    "code": {
      "file": "packages/server/src/proactive/scheduler.ts",
      "lines": "28-38",
      "snippet": "export function startScheduler(deps: SchedulerDeps): void {\n  if (timer) return;\n  const tickMs = Math.max(5, Number(Bun.env['LUNA_PROACTIVE_TICK_SECONDS'] ?? 60)) * 1000;\n  timer = setInterval(() => {\n    void runTick(deps).catch(logSwallowed('scheduler-tick'));\n  }, tickMs);\n  // don't keep the process alive just for the heartbeat. Nothing ever stops this timer\n  // explicitly (v0.45.14 removed the never-called stopScheduler) — the unref means it\n  // simply dies with the process, which is the entire intended lifecycle.\n  (timer as { unref?: () => void }).unref?.();\n}",
      "note": {
        "zh": "整支自主性的全部启动代码就这 11 行；注释里那句「nothing ever stops this timer」是仓库自己写下的、可被 grep 验证的事实。",
        "en": "These 11 lines are the entire bootstrap of the autonomous branch; the comment \"nothing ever stops this timer\" is a fact the repo states about itself and one you can verify with grep."
      }
    },
    "decision": {
      "why": {
        "zh": "主动性不能挂在前端存活上，所以心跳是纯服务端定时器：没人开着窗口，她照样在跳。",
        "en": "Autonomy must not hang off the front end being alive, so the heartbeat is a pure server-side timer: with nobody watching the window, she still beats."
      },
      "rejected": {
        "zh": "一个显式的停止函数。stopScheduler 曾经存在，但从来没有被调用过，v0.45.14 把它删了——.unref() 已经把生命周期说清楚了。",
        "en": "An explicit stop function. stopScheduler did exist, was never once called, and v0.45.14 deleted it — .unref() already states the lifecycle completely."
      },
      "cost": {
        "zh": "没有优雅停止的钩子：要停心跳，只能停进程。再加上 60 秒的粒度——一个「此刻正好」的时机最晚要等一整跳才被看见，所以另开了事件钩子（fireProactiveForActiveSessions）走同一条漏斗、同一把锁，在自然的那一瞬间补上。",
        "en": "No graceful-stop hook: to stop the heartbeat you stop the process. Plus the 60-second granularity — a moment that is right *now* may not be seen for a full beat — which is why an event hook (fireProactiveForActiveSessions) exists, running through the same funnel and the same lock to catch those at their natural instant."
      }
    }
  },
  "ladder": {
    "figure": {
      "w": 620,
      "h": 210,
      "boxes": [
        {
          "x": 8,
          "y": 82,
          "w": 122,
          "h": 46,
          "title": "engaged"
        },
        {
          "x": 158,
          "y": 82,
          "w": 122,
          "h": 46,
          "title": "idle_watch"
        },
        {
          "x": 308,
          "y": 82,
          "w": 122,
          "h": 46,
          "title": "nudged"
        },
        {
          "x": 458,
          "y": 82,
          "w": 74,
          "h": 46,
          "title": "dormant"
        },
        {
          "x": 546,
          "y": 82,
          "w": 66,
          "h": 46,
          "title": "sleeping"
        }
      ],
      "edges": [
        {
          "pts": [
            [
              134,
              105
            ],
            [
              154,
              105
            ]
          ]
        },
        {
          "pts": [
            [
              284,
              105
            ],
            [
              304,
              105
            ]
          ]
        },
        {
          "pts": [
            [
              434,
              105
            ],
            [
              454,
              105
            ]
          ]
        },
        {
          "pts": [
            [
              536,
              105
            ],
            [
              542,
              105
            ]
          ]
        },
        {
          "pts": [
            [
              500,
              74
            ],
            [
              500,
              34
            ],
            [
              69,
              34
            ],
            [
              69,
              78
            ]
          ],
          "label": {
            "zh": "他一开口，直接回到 engaged",
            "en": "he speaks → straight back to engaged"
          },
          "at": [
            176,
            8
          ]
        }
      ],
      "labels": [
        {
          "x": 8,
          "y": 150,
          "w": 400,
          "text": {
            "zh": "沉默越长走得越远；每一格决定她能不能开口、以及开口算哪一种",
            "en": "the longer the silence, the further it walks"
          },
          "tone": "edge"
        }
      ]
    },
    "claim": {
      "zh": "没有它，心跳每 60 秒就得投机地问模型一次「现在该说话吗」——一次 LLM 调用换一次沉默，而且判断毫无记忆、无法升级也无法退让。它是唤醒决策本身：一个纯函数，只看沉默了多久，返回该用哪一种场景开口，或者干脆什么都不返回。",
      "en": "Without it the heartbeat would have to speculatively ask the model every 60 seconds whether now is the time to speak — one LLM call bought per silence — and the judgment would have no memory, no way to escalate and no way to back off. It is the wake decision itself: a pure function that looks only at how long it has been quiet and returns which scenario to open with, or nothing at all."
    },
    "mechanism": {
      "zh": "一个信号驱动全部：effective_gap = min(距离频道里最后一次有人说话, 距离她上一次主动开口)。取 min 是为了让她刚打破的沉默不算沉默——v0.29.0 之前这个 gap 只数用户与她的主动外联，她普通的回复推不动它，于是她会在回答完几秒后就插进一场活着的对话。相位机有 5 个相位：engaged / idle_watch / nudged / dormant / sleeping；产出 4 种场景框架：ambient / idle_nudge / renudge / leave_message。engaged 下 gap 过 10 分钟升 idle_watch；不到则以 6% 概率、且 gap ≥ 5 分钟时丢一句无重量的 ambient。nudged 里 renudge 按 [1.0, 2.4, 6.0] 的倍率退避，最多 3 次，之后落 leave_message → dormant；dormant 静默满 1 小时自动回 engaged；gap 超 18 小时进 sleeping，她等他回来，不往里推。函数是纯的：它把这一 tick 算出的相位迁移 return 出去，由 fire.ts 在每一条路径上落盘——包括「这一 tick 什么都没发生」那一条。丢掉它，dormant→engaged 的自动恢复就会被扔掉，她被永久锁死在 dormant。",
      "en": "One signal drives everything: effective_gap = min(time since anyone last spoke in the channel, time since her own last proactive opening). The min exists so a silence she just broke does not count as silence — before v0.29.0 the gap counted only the user plus her proactive outreach, her ordinary replies advanced nothing, and she would cut into a live conversation seconds after answering it. The phase machine has 5 phases: engaged / idle_watch / nudged / dormant / sleeping; it produces 4 scenario framings: ambient / idle_nudge / renudge / leave_message. In engaged, a gap past 10 minutes climbs to idle_watch; short of that she may drop a weightless ambient musing at 6% probability and only once the gap is at least 5 minutes. In nudged, re-nudges space out on a [1.0, 2.4, 6.0] backoff, at most 3 of them, then it falls to leave_message → dormant; dormant auto-recovers to engaged after a full hour of genuine silence; a gap past 18 hours enters sleeping, where she waits for him to come back rather than nudging into it. The function is pure: it returns the phase transition it computed this tick, and fire.ts persists it on every path — including the path where nothing fired. Discard it and the dormant→engaged recovery is thrown away, locking her in dormant forever."
    },
    "contract": {
      "exposes": {
        "zh": "evaluateLadder(ctx, rng) → { scenario, phase, nudgesSent }：这一 tick 要不要开口，加上算出来的相位迁移。",
        "en": "evaluateLadder(ctx, rng) → { scenario, phase, nudgesSent }: whether to open this tick, plus the phase transition it computed."
      },
      "depends": {
        "zh": "session.lastActivityMs（单一活动计时器）、cadence 的 phase/nudgesSent/lastProactiveMs、effectiveCadence() 给的概率与间隔。",
        "en": "session.lastActivityMs (the single activity idle-timer), the cadence phase/nudgesSent/lastProactiveMs, and the probabilities and spacings from effectiveCadence()."
      },
      "boundary": {
        "zh": "阶梯不重新把关安静时段、空闲下限、基础冷却与日配额——那是 passesAntiSpam 这条机械轨的事，先跑；阶梯只在轨之上叠相位逻辑（renudge 的退避是另一层更长的间距，不是重复的冷却）。",
        "en": "The ladder does not re-gate quiet hours, the idle floor, the base cooldown or the daily quota — that is the mechanical rail, passesAntiSpam, which runs first; the ladder layers only phase logic on top (the re-nudge backoff is a separate, longer spacing, not a duplicated cooldown)."
      },
      "invariant": {
        "zh": "纯函数：时钟与随机数都从参数注入。返回的相位迁移必须在每条路径上被持久化；而「什么都没发生」那条路绝不能碰 lastProactiveMs，否则恢复时钟每 tick 重新上弦、永不到期。",
        "en": "Pure: both the clock and the RNG are injected. The returned phase transition must be persisted on every path; and the nothing-happened path must never touch lastProactiveMs, or the recovery clock re-arms every tick and never elapses."
      }
    },
    "code": {
      "file": "packages/server/src/proactive/ladder.ts",
      "lines": "81-87",
      "snippet": "  // v0.29.0/.1: silence = time since the last thing said in the channel (the single activity\n  // idle-timer; the old user-only anchor + its flag were retired in v0.29.1).\n  const silenceGap = session.lastActivityMs > 0 ? nowMs - session.lastActivityMs : Infinity;\n  const sinceProactive = cadence.lastProactiveMs > 0 ? nowMs - cadence.lastProactiveMs : Infinity;\n  // effective_gap (proactive.py:277-281): min'd with her own outreach so a recent proactive\n  // still spaces the next one even if the activity timer was bumped by that same outreach.\n  const effectiveGap = Math.min(silenceGap, sinceProactive);",
      "note": {
        "zh": "整台相位机只吃这一个数；Math.min 那一行就是「她不许挤进自己刚打破的沉默」这条规矩的全部实现。",
        "en": "The entire phase machine eats this one number; that Math.min line is the whole implementation of the rule that she may not crowd into a silence she just broke herself."
      }
    },
    "decision": {
      "why": {
        "zh": "把 Python runtime/proactive.py evaluate() 的原始设计恢复成决策层：唤醒是时间的函数，不是模型的一次自由发挥。机械决策可以被单测钉死、可以在几毫秒内说不，且不花一分钱。",
        "en": "Restoring the original design of Python's runtime/proactive.py evaluate() as the decision layer: waking is a function of time, not a free-form judgment by the model. A mechanical decision can be pinned down by unit tests, can say no in a few milliseconds, and costs nothing."
      },
      "rejected": {
        "zh": "探测器注册表加每键去抖加定时槽（v0.24.1 整套删除），以及挂在心跳上的投机式 LLM 唤醒判断（v0.22.3 删除）。两者都是「先花一次调用再决定要不要花一次调用」。",
        "en": "The detector registry with its per-key debounce and scheduled-slot machinery (deleted wholesale in v0.24.1), and the speculative LLM wake-gate hanging off the heartbeat (deleted in v0.22.3). Both amounted to spending a call in order to decide whether to spend a call."
      },
      "cost": {
        "zh": "唤醒的时机完全机械——她无法因为「这件事值得说」而提前开口，只能因为「已经安静够久了」。内容上的判断被整体推迟到模型看见场景框架之后；换来的是沉默默认成立，而不是默认要被说服。",
        "en": "The timing of a waking is entirely mechanical — she cannot open early because something is worth saying, only because it has been quiet long enough. All judgment about content is deferred to after the model sees the scenario framing; what this buys is that silence is the default rather than something that has to be argued for."
      }
    }
  },
  "outcomes": {
    "figure": {
      "w": 620,
      "h": 210,
      "boxes": [
        {
          "x": 22,
          "y": 78,
          "w": 140,
          "h": 52,
          "title": {
            "zh": "一次醒来",
            "en": "one waking"
          }
        },
        {
          "x": 268,
          "y": 14,
          "w": 156,
          "h": 44,
          "title": {
            "zh": "说话",
            "en": "she speaks"
          }
        },
        {
          "x": 268,
          "y": 80,
          "w": 156,
          "h": 44,
          "title": {
            "zh": "安静地干活",
            "en": "quiet work"
          }
        },
        {
          "x": 268,
          "y": 146,
          "w": 156,
          "h": 44,
          "title": {
            "zh": "真的休息",
            "en": "genuine rest"
          }
        },
        {
          "x": 460,
          "y": 80,
          "w": 146,
          "h": 44,
          "title": {
            "zh": "都留痕",
            "en": "all recorded"
          },
          "sub": "proactive_outcomes"
        }
      ],
      "edges": [
        {
          "pts": [
            [
              166,
              92
            ],
            [
              264,
              40
            ]
          ]
        },
        {
          "pts": [
            [
              166,
              104
            ],
            [
              264,
              102
            ]
          ]
        },
        {
          "pts": [
            [
              166,
              116
            ],
            [
              264,
              166
            ]
          ]
        },
        {
          "pts": [
            [
              428,
              102
            ],
            [
              456,
              102
            ]
          ]
        }
      ],
      "labels": [
        {
          "x": 22,
          "y": 150,
          "w": 220,
          "text": {
            "zh": "三种都合法——所以「沉默」是可以量的，不是看不见的",
            "en": "all three are legal, so silence becomes measurable rather than invisible"
          },
          "tone": "edge"
        }
      ]
    },
    "claim": {
      "zh": "没有它，「她今天醒了 21 次、开口 5 次」这句话没有任何东西能验证——沉默率是不可见的，于是一次行为上的修复就只是氛围。它把每一次主动醒来落成一行账：说话 / 安静地干活 / 什么也没做。",
      "en": "Without it, a sentence like \"she woke 21 times today and spoke 5 of them\" has nothing behind it — the silent rate is invisible, and a behavioral fix is a vibe rather than a result. It writes every proactive waking down as one row: spoke / quiet work / nothing."
    },
    "mechanism": {
      "zh": "分类只看两件事：这一回合有没有发出消息，以及调过哪些工具名。发了消息 = spoke；没发消息但调过 message 之外的任何工具 = quiet；两样都没有 = nothing。这就是「安静地干活」得以成为一种合法结局的全部判据——工具调用本身就是行动。quiet 会被 compressNote 压成一行人话（同一个动词按次数合并，硬截到 140 字），这一行同时是账本里的 note、和前端那片叶子逐字显示的文案（proactive.finished 事件上的可选 quiet_note 字段）。用了 web_search 或 web_fetch 的算一次 wander，按本地午夜起算日配额（默认 4 次），而剩余配额又被写回下一次唤醒的提示词里——账本因此不只是记录，它还闭了一个小环。写库整段包在 try/catch 里：账本永远不许弄坏这一回合。",
      "en": "Classification looks at exactly two things: whether the turn delivered a message, and which tool names it called. Message delivered = spoke; no message but any tool other than `message` = quiet; neither = nothing. That is the entire criterion by which quiet work becomes a legitimate outcome — calling a tool is itself acting. A quiet turn gets compressed by compressNote into one human line (same verb collapsed with a count, hard-capped at 140 characters), and that line is at once the ledger note and, verbatim, the copy the front end renders as a leaf (the optional quiet_note field on the proactive.finished event). A turn that used web_search or web_fetch is marked a wander, counted against a daily budget from local midnight (4 by default), and the remaining budget is written back into the next waking prompt — so the ledger is not only a record, it closes a small loop. The whole write sits inside a try/catch: the ledger must never break the turn."
    },
    "contract": {
      "exposes": {
        "zh": "classifyOutcome / compressNote / recordOutcome / wandersUsedToday；对外则是 proactive.finished 事件上的可选 quiet_note。",
        "en": "classifyOutcome / compressNote / recordOutcome / wandersUsedToday; outward, the optional quiet_note on the proactive.finished event."
      },
      "depends": {
        "zh": "proactive_outcomes 表（migration 0022），以及回合结束时 runTurn 交回的 toolNamesThisTurn 与 messageTexts。",
        "en": "The proactive_outcomes table (migration 0022), plus the toolNamesThisTurn and messageTexts that runTurn hands back when the turn ends."
      },
      "boundary": {
        "zh": "它只记结局，不做任何唤醒判断；对系统唯一的反向影响是 wander 的日配额。记账不区分场景（ambient 与 leave_message 在表里长得一样），也不存这一回合说了什么。",
        "en": "It records outcomes only and makes no wake decisions; its single feedback into the system is the daily wander budget. The ledger does not distinguish scenarios (an ambient and a leave_message look identical in the table) and does not store what was said."
      },
      "invariant": {
        "zh": "LUNA_QUIET_WORK=0 时一行都不写，行为逐字退回 v0.45.10 之前；写库抛错被吞掉，回合照常结束。",
        "en": "With LUNA_QUIET_WORK=0 not a single row is written and behavior reverts byte-for-byte to pre-v0.45.10; a throw from the insert is swallowed and the turn ends normally."
      }
    },
    "code": {
      "file": "packages/server/src/proactive/quietWork.ts",
      "lines": "24-30",
      "snippet": "export type OutcomeKind = 'spoke' | 'quiet' | 'nothing';\n\n// Message delivery already decides 'spoke'; any OTHER tool activity without a word is 'quiet'.\nexport function classifyOutcome(spoke: boolean, toolNames: string[]): OutcomeKind {\n  if (spoke) return 'spoke';\n  return toolNames.some((n) => n !== 'message') ? 'quiet' : 'nothing';\n}",
      "note": {
        "zh": "三种合法结局在类型层面就是并列的三个字面量——「不说话」不是失败分支，它和 spoke 一样是一个正常取值。",
        "en": "The three legitimate outcomes are three peer literals at the type level — not speaking is not a failure branch, it is as ordinary a value as spoke."
      }
    },
    "decision": {
      "why": {
        "zh": "v0.45.10 的调查把「全是沉默」归因归对了：不是懒，是服从。当时每一条主动提示词都以 do nothing at all (call no tool, send no message) 收尾，收尾的祈使句撤销了正文刚给出的行动邀请。三岔路的提示词是修法，这本账是让修法可被审计的东西。",
        "en": "The v0.45.10 investigation attributed the all-silence result correctly: it was obedience, not laziness. Every proactive framing at the time ended with \"do nothing at all (call no tool, send no message)\", and that closing imperative revoked the invitation to act the body had just issued. The three-way ground rule is the fix; this ledger is what makes the fix auditable."
      },
      "rejected": {
        "zh": "直接改写收尾句、不留回滚位。原来的收尾被逐字保留为 LEGACY_GROUND_RULE，LUNA_QUIET_WORK=0 一键退回原字节——提示词层的改动同样要有回滚开关。",
        "en": "Rewriting the closing line with no rollback pin. The original closing is kept byte-identical as LEGACY_GROUND_RULE, and LUNA_QUIET_WORK=0 restores those exact bytes — a prompt-layer change deserves a kill switch as much as a code one does."
      },
      "cost": {
        "zh": "账本目前只有写入，加上一个 wander 计数查询；没有任何面板或接口在读它。沉默变得可测量了，但要真去量还得自己开库查表。",
        "en": "The ledger currently has only writes plus a single wander-count query; no panel and no endpoint reads it. Silence became measurable, but actually measuring it still means opening the database yourself."
      }
    }
  },
  "lock": {
    "figure": {
      "w": 620,
      "h": 230,
      "boxes": [
        {
          "x": 40,
          "y": 22,
          "w": 150,
          "h": 50,
          "title": {
            "zh": "反应回合",
            "en": "reactive turn"
          },
          "sub": "chat.send"
        },
        {
          "x": 236,
          "y": 22,
          "w": 150,
          "h": 50,
          "title": {
            "zh": "主动回合",
            "en": "proactive turn"
          },
          "sub": {
            "zh": "心跳",
            "en": "heartbeat"
          }
        },
        {
          "x": 432,
          "y": 22,
          "w": 150,
          "h": 50,
          "title": {
            "zh": "梦",
            "en": "the dream"
          },
          "sub": "runDreamCycle"
        },
        {
          "x": 236,
          "y": 138,
          "w": 150,
          "h": 56,
          "kind": "blackbox",
          "title": {
            "zh": "她",
            "en": "her"
          },
          "sub": {
            "zh": "一次只做一件事",
            "en": "one thing at a time"
          }
        }
      ],
      "edges": [
        {
          "pts": [
            [
              115,
              76
            ],
            [
              270,
              134
            ]
          ]
        },
        {
          "pts": [
            [
              311,
              76
            ],
            [
              311,
              134
            ]
          ]
        },
        {
          "pts": [
            [
              507,
              76
            ],
            [
              352,
              134
            ]
          ]
        }
      ],
      "labels": [
        {
          "x": 20,
          "y": 196,
          "w": 260,
          "text": {
            "zh": "activeTurn ≠ null → turn_in_progress",
            "en": "activeTurn ≠ null → turn_in_progress"
          },
          "tone": "edge"
        },
        {
          "x": 352,
          "y": 196,
          "w": 260,
          "text": {
            "zh": "isDreaming() → dreaming，要显式叫醒",
            "en": "isDreaming() → dreaming, wake her explicitly"
          },
          "tone": "red"
        }
      ]
    },
    "claim": {
      "zh": "没有它，三个入口会在同一个会话上互相踩：用户发来的消息、心跳自己醒来、以及一场梦，可能同时在跑各自的回合，共享同一段历史和同一个模型连接。它保证她一次只做一件事。",
      "en": "Without it three entrances trample each other on one session: a message from the user, a waking of her own from the heartbeat, and a dream — each could be running its own turn at once, over the same history and the same model connection. It guarantees she does one thing at a time."
    },
    "mechanism": {
      "zh": "互斥不是一把锁，是三个状态被多处守卫共同读出来的。session.activeTurn（runTurn 在自己第一个 await 之前同步置上、finally 里清掉）被 4 处读；is_dreaming（dreamState 的模块级标志，写穿到 SQLite，所以重启后仍然成立）在互斥路径上被 5 处读；再加 fire.ts 里那个只属于主动路径的 inFlight 集合，和 enterDream 自己的 already_dreaming 自查——一共 11 处守卫，分布在 4 个文件。withProactiveLock 是其中最密的一处：四道检查一次做完，并且在任何 await 之前同步 add，所以四个赛跑的调用者（心跳 tick、天气事件钩子、continuation、开发者强制触发）不可能有两个同时通过。两道闸给用户的回执是不同的：撞上回合冲突回 turn_in_progress，消息是 turn <id> is still running，等一会儿重发即可；撞上做梦回 dreaming，消息是 Luna is dreaming — send dream.wake to wake her——它不是「稍后重试」，它要求你显式把她叫醒，而且 wake() 还会拒绝叫醒一场没跑到 finished_idle 的梦。",
      "en": "The exclusion is not one lock; it is three pieces of state read by guards in many places. session.activeTurn (set synchronously by runTurn before its own first await, cleared in a finally) is read at 4 sites; is_dreaming (a module-level flag in dreamState, written through to SQLite so it survives a restart) is read at 5 sites on the exclusion path; add the inFlight set in fire.ts that belongs to the proactive path alone, and enterDream checking already_dreaming on itself — 11 guard sites in total, across 4 files. withProactiveLock is the densest of them: four checks in one place, and the add happens synchronously before any await, so of the four racing callers (heartbeat tick, weather event hook, continuation, developer force-fire) no two can both get through. The two gates give the user different receipts: a turn collision returns turn_in_progress with the message \"turn <id> is still running\", and you simply resend a moment later; a dream returns dreaming with the message \"Luna is dreaming — send dream.wake to wake her\" — which is not \"retry later\", it asks you to wake her explicitly, and wake() will itself refuse a dream that has not yet parked at finished_idle."
    },
    "contract": {
      "exposes": {
        "zh": "withProactiveLock(session, fn)：所有主动路径共用的那一条轨，通过就跑 fn，不通过返回 null 且不跑。",
        "en": "withProactiveLock(session, fn): the one rail every proactive path shares — pass and fn runs, fail and it returns null without running."
      },
      "depends": {
        "zh": "session.activeTurn、dreamState.isDreaming()、模块级 inFlight 集合、proactiveEnabled() 这个总开关。",
        "en": "session.activeTurn, dreamState.isDreaming(), the module-level inFlight set, and the proactiveEnabled() kill switch."
      },
      "boundary": {
        "zh": "锁是每会话的（键是 session.id），梦却是全局的（一个进程一个 is_dreaming）——所以一场梦挡住所有会话，一个进行中的回合只挡住它自己那个会话。",
        "en": "The lock is per session (keyed by session.id) while the dream is global (one is_dreaming per process) — so a dream blocks every session, whereas an in-flight turn blocks only its own."
      },
      "invariant": {
        "zh": "检查与 inFlight.add 之间没有任何 await；无论 fn 抛不抛，finally 都会释放。",
        "en": "There is no await between the checks and inFlight.add; the finally releases whether fn throws or not."
      }
    },
    "code": {
      "file": "packages/server/src/proactive/fire.ts",
      "lines": "50-58",
      "snippet": "export async function withProactiveLock<T>(\n  session: Session,\n  fn: () => Promise<T>,\n): Promise<T | null> {\n  if (inFlight.has(session.id)) return null;\n  if (session.activeTurn !== null) return null;\n  if (isDreaming()) return null;\n  if (!proactiveEnabled()) return null;\n  inFlight.add(session.id);",
      "note": {
        "zh": "四道检查加一次 add，中间一个 await 都没有——同步性就是这段代码的全部正确性，改成 async 检查它立刻失效。",
        "en": "Four checks and one add, with not a single await between them — that synchrony is the whole of this code’s correctness, and it evaporates the moment any check becomes async."
      }
    },
    "decision": {
      "why": {
        "zh": "v0.22.2 把所有主动路径收进同一个入口、同一把锁：心跳、事件钩子、continuation、开发者强制触发走的是同一条漏斗，于是「tick 和钩子同时开火」这件事在结构上不可能，而不是靠时序侥幸不发生。",
        "en": "v0.22.2 pulled every proactive path into one entry point behind one lock: heartbeat, event hook, continuation and developer force-fire all run the same funnel, so a tick and a hook firing together is structurally impossible rather than merely unlikely by timing."
      },
      "cost": {
        "zh": "守卫散在 4 个文件里，没有一个地方能一眼看全——审计只能靠把 activeTurn 与 isDreaming 的读点数一遍。而且 dream.enter 在 ws 层只检查 activeTurn、不检查 isDreaming：重复进梦是靠 enterDream() 返回 already_dreaming 兜底的，是二次防御，不是前置守卫。",
        "en": "The guards are spread across 4 files with no single place that shows them all — auditing means counting the read sites of activeTurn and isDreaming by hand. And dream.enter checks only activeTurn at the ws layer, not isDreaming: a double entry into dreaming is caught by enterDream() returning already_dreaming, which is defense in depth rather than a guard up front."
      }
    }
  },

  /* ── 五条泳道 ───────────────────────────── */
  "lane-user": {
    "claim": {
      "zh": "一条消息的一生只经过一个客户端接口：一条 WebSocket。用户这一侧能说的话是 8 种 ClientEvent，她能回的话是 14 种 ServerEvent —— 两个联合写在 packages/protocol 的同一份 Zod 文件里，被服务端和网页端 import 同一份源码。",
      "en": "A message's whole life passes through exactly one client-facing interface: one WebSocket. This side can say 8 kinds of ClientEvent; she can answer with 14 kinds of ServerEvent — both unions live in a single Zod file under packages/protocol, and the server and the web page import that same source."
    },
    "mechanism": {
      "zh": "这一刻的帧要过四道校验，两端各两道：网页端 send 只做类型约束，不做运行时校验；服务端 handleMessage 对每一帧 ClientEvent.safeParse，不合就回一条 error 事件而不是断连；服务端每一条出站帧都经 outbound 的 ServerEvent.parse（严格 parse，会抛 —— 所以 ws 那侧把 emit 包成 safeEmit，socket 没了就吞掉，回合照跑）；网页端每一条入站帧 ServerEvent.safeParse，不成功就不进 onEvent。断线之后：网页端指数退避重连，间隔是 1500ms × 2^n 封顶 15 秒再加 0–250ms 抖动，而且连上之后要稳稳撑满 5 秒才把退避计数清零 —— 一个 accept 完立刻 close 的服务端仍然会被逐步退避，而不是被以基础间隔猛敲。断线期间要发的帧进 outbox（上限 100 条，满了从队头丢最老的），重连后一次性 flush。历史不是浏览器里缓着的：连接一建立，handleOpen 就从 SQLite 的 L2 时间线拉最多 2000 行，滤掉两侧都空的行，取最后 300 行，作为一条 history 事件推过去，紧跟着再推一条 settings.state。所以刷新之后看到的对话是从库里重放出来的。",
      "en": "A frame at this moment passes four checks, two on each end. The web client's send is type-constrained only, with no runtime validation. The server's handleMessage runs ClientEvent.safeParse on every frame and answers a malformed one with an error event rather than closing the socket. Every outbound frame goes through outbound's ServerEvent.parse — the strict parse, which throws, which is why the ws layer wraps emit as safeEmit: if the socket is gone the throw is swallowed and the turn keeps running. On the web side every inbound frame is ServerEvent.safeParse'd, and a frame that fails never reaches onEvent. After a drop: the client reconnects on exponential backoff, 1500ms × 2^n capped at 15 seconds plus 0–250ms of jitter, and it only resets the backoff counter after the socket has stayed open for a full 5 seconds — so a server that accepts and immediately closes still escalates instead of being hammered at the base interval. Frames written while the socket is down go into an outbox (capped at 100; past that the oldest is dropped) and are flushed on reopen. The history is not cached in the browser: the moment a connection opens, handleOpen pulls up to 2000 rows from the L2 timeline in SQLite, filters out rows empty on both sides, keeps the last 300, and pushes them as one history event, immediately followed by a settings.state. What you see after a refresh is replayed from the database."
    },
    "contract": {
      "exposes": {
        "zh": "8 种入站 ClientEvent（ping / chat.send / dream.enter / dream.wake / proactive.fire / client.geo / settings.set / dev.dispatch_tool），14 种出站 ServerEvent。其中只有 pong 是应答；history 与 settings.state 是连接时的无请求推送 —— 刻意没有 settings.get 这种事件。",
        "en": "Eight inbound ClientEvent kinds (ping, chat.send, dream.enter, dream.wake, proactive.fire, client.geo, settings.set, dev.dispatch_tool) and fourteen outbound ServerEvent kinds. Only pong is a reply; history and settings.state are pushed on connect with nothing having asked — there is deliberately no settings.get event."
      },
      "depends": {
        "zh": "@luna/protocol（workspace:* 依赖，main 指向 src/index.ts，即两端吃的是同一份 TypeScript 源码）、L2 时间线（历史重放）、settings 注册表。",
        "en": "@luna/protocol (a workspace:* dependency whose main points at src/index.ts, so both ends consume the same TypeScript source), the L2 timeline (for the history replay), and the settings registry."
      },
      "boundary": {
        "zh": "升级之前先过 Origin 闸：浏览器 Origin 必须是 loopback（任意端口），没有 Origin 的原生客户端放行，字面量 \"null\"（file:// 或沙箱页）拒绝。帧上限 1MB，chat.send 的正文上限 8000 字。",
        "en": "Before the upgrade there is an Origin gate: a browser Origin must be loopback (any port), a client sending no Origin at all is let through, and the literal \"null\" (a file:// or sandboxed page) is refused. Frames are capped at 1MB and a chat.send body at 8000 characters."
      },
      "invariant": {
        "zh": "每一条出站帧都被 ServerEvent.parse 过一遍才上线；两端编译自同一份 schema 源码，网页端对 ServerEvent 做穷尽 switch，最后一支是 assertNever。",
        "en": "Every outbound frame is validated by ServerEvent.parse before it goes on the wire; both ends compile against the same schema source, and the web controller switches exhaustively over ServerEvent with assertNever as its last arm."
      }
    },
    "code": {
      "file": "packages/server/src/ws.ts",
      "lines": "97-101",
      "snippet": "  const turns = listL2(ws.data.sessionId, { limit: 2000 })\n    .map((r) => ({ user_text: r.user_text, assistant_text: r.assistant_text, t_ms: r.t_ms }))\n    .filter((t) => t.user_text !== '' || t.assistant_text !== '')\n    .slice(-300);\n  if (turns.length > 0) outbound(ws, { type: 'history', turns });",
      "note": {
        "zh": "重连时回来的到底是什么：不是这个浏览器上次的 DOM，是 L2 里每一轮的 user_text / assistant_text / t_ms 三元组 —— 时间戳是那一轮真实发生的时间，所以刷新之后时间线是诚实的。主动回合的 user_text 是空串（她自己醒来时没有用户消息），所以那一条渲染成一个没有用户气泡的回合。",
        "en": "What actually comes back on a reconnect: not this browser's last DOM, but a user_text / assistant_text / t_ms triple per turn out of L2 — and t_ms is the turn's real time, so the timeline after a refresh is honest. A proactive turn has an empty user_text (she woke on her own; there was no user message), so it renders as a turn with no user bubble."
      }
    },
    "decision": {
      "why": {
        "zh": "一份 schema，两端 import 源码。所以「改一端不改另一端」在 tsc 就炸：往 ServerEvent 里加一种而网页端不处理，controller 末尾的 assertNever 会是一个编译错误，不是一个运行时惊喜。真正还能漂移的只剩一种情形 —— 网页产物是旧的（没重新打包）。那种情形下客户端 safeParse 失败直接丢帧：不会误处理，但也不会告诉你。",
        "en": "One schema, imported as source by both ends. So \"change one end and forget the other\" fails at tsc: add a ServerEvent kind and leave the web unhandled, and the assertNever at the bottom of the controller is a compile error, not a runtime surprise. Only one drift remains possible — a stale web bundle. In that case the client's safeParse simply drops the frame: never mishandled, but never reported either."
      },
      "rejected": {
        "zh": "断线期间直接丢掉待发的帧。气泡已经渲染出来了，丢一帧等于「用户看到自己发过一句话，服务端从没收到」—— 所以有了 outbox。",
        "en": "Silently dropping frames written while the socket is down. The bubble has already been rendered, so a dropped frame means a message the user watched themselves send and the server never received — hence the outbox."
      },
      "cost": {
        "zh": "outbox 上限 100 条，超出从队头丢最老的一条；足够长的断线里，最早那几句会无声消失。",
        "en": "The outbox holds 100 frames and drops the oldest past that; in a long enough outage the earliest messages disappear without a sound."
      }
    }
  },
  "lane-harness": {
    "claim": {
      "zh": "五条泳道里只有这一条同时持有状态与模型调用权。其余四方都是无状态的被调用者：模型每一轮拿到的是全量重发的上下文，工具只拿到一次调用的入参和一个 abort 信号，存储只认写进去的行，用户那条线只认帧。所以「一条消息的一生」这句话有主语，主语是它。",
      "en": "Of the five lanes only this one both holds state and owns the call to the model. The other four are stateless callees: the model gets the whole context resent every round, a tool gets one call's input and an abort signal, the store knows only the rows written to it, and the user lane knows only frames. So \"the life of a message\" has a subject, and this is it."
    },
    "mechanism": {
      "zh": "这一刻的时间边界是两行赋值：进图之前同步写下 session.activeTurn = turnId，finally 里再清成 null。这两行之间的整段时间里，chat.send、dream.enter、proactive.fire 三个入口都会被顶回一条 turn_in_progress 的 error —— 不是排队，是拒绝。同一处还记下 historyStart（进图前 history 的长度），它是整段回合唯一的回滚锚点。整张图跑在一个 try 里：任何节点抛出，finishReason 变成 error、发一条 turn_failure 出去，然后照样落进 finally —— 「回合失败」在这里不是进程事件，只是一次状态转移。finally 按固定顺序做四件事：清 activeTurn、turnSeq 自增、持久化（自己再套一层 try，SQLite 抛了只记日志加一条 persistence_failed，不致命也不跳过后面）、决策审计与 flushTrace，最后 fire-and-forget 一次折叠。它还刻意不认识 socket：emit 是注入进来的一个函数，反应式回合传的是 ws 那侧包好的 safeEmit，主动回合和梦传的是 broadcast —— 一个没有任何监听者的主动回合照样跑完、照样落库。",
      "en": "The time boundary of this moment is two assignments: session.activeTurn = turnId written synchronously before entering the graph, and cleared back to null in the finally. For everything between those two lines, all three entrances — chat.send, dream.enter, proactive.fire — are turned away with a turn_in_progress error. Not queued: refused. The same place records historyStart, the length of history before the graph runs, which is the turn's single rollback anchor. The whole graph runs inside one try: any node that throws sets finishReason to error, emits a turn_failure, and still lands in the finally — a \"failed turn\" here is not a process event, only a state transition. The finally then does four things in fixed order: clear activeTurn, increment turnSeq, persist (inside its own try, so a SQLite throw is logged and surfaced as persistence_failed but is neither fatal nor allowed to skip what follows), run the decision audit and flushTrace, and finally fire off a fold. It also deliberately does not know what a socket is: emit is injected. A reactive turn is handed the safeEmit the ws layer wrapped; a proactive turn and a dream are handed broadcast — and a proactive turn with no listener at all still runs to the end and still persists."
    },
    "contract": {
      "exposes": {
        "zh": "runTurn(RunTurnOptions) → Promise<TurnState>。入参八项：session、turnId、userText、provider、registry、emit，以及可选的 onTransition / proactiveTurn / signal。对外可观测的一切都在 emit 出去的 ServerEvent 上。",
        "en": "runTurn(RunTurnOptions) → Promise<TurnState>. Eight fields in: session, turnId, userText, provider, registry, emit, plus optional onTransition, proactiveTurn and signal. Everything observable from outside rides the ServerEvents it emits."
      },
      "depends": {
        "zh": "Provider（全进程唯一的模型调用点）、ToolRegistry（boot 时冻结，turn loop 全程不再读能力相关的环境变量）、Session（history、mutex、activeTurn）、sessionStore。",
        "en": "The Provider (the process's only call site to a model), the ToolRegistry (frozen at boot — the turn loop never reads a capability env var again), the Session (history, mutex, activeTurn), and sessionStore."
      },
      "boundary": {
        "zh": "它不持有 socket、不持有数据库句柄之外的 IO、不决定工具怎么并发（那是分发器）、不决定上游长什么样（那是 provider 缝）。它决定的只有顺序、轮数、和什么时候停。",
        "en": "It holds no socket, no IO beyond the database handle, no say in how tools run concurrently (that is the dispatcher's) and none in what upstream looks like (that is the provider seam's). What it decides is order, how many rounds, and when to stop."
      },
      "invariant": {
        "zh": "一个会话同一时刻至多一个 activeTurn；轮数只在 append_results 里自增一次 —— 所以「一轮」的定义是「工具结果回灌了一次」，不是「模型被调用了一次」。",
        "en": "At most one activeTurn per session at any instant; the round counter is incremented in exactly one place, append_results — so \"a round\" means \"tool results were fed back once\", not \"the model was called once\"."
      }
    },
    "code": {
      "file": "packages/server/src/turn/runTurn.ts",
      "lines": "1007-1017",
      "snippet": "  opts.session.activeTurn = opts.turnId;\n  const historyStart = opts.session.history.length;\n  try {\n    await runGraph(graph, 'parse_input', state, onTransition);\n  } catch (e) {\n    const message = e instanceof Error ? e.message : String(e);\n    state.finishReason = 'error';\n    state.emit({ type: 'error', code: 'turn_failure', message });\n  } finally {\n    opts.session.activeTurn = null;\n    opts.session.turnSeq += 1;",
      "note": {
        "zh": "十一行里装着这条泳道的全部形状：一个占用标记、一个回滚锚点、一张图、一个不会漏的出口。六个节点（parse_input / build_request / open_stream / dispatch_tools / append_results / finalize）与两条回边都在 graph 这个对象里，这里只负责起跑和收尾。",
        "en": "Eleven lines carry this lane's whole shape: an occupancy flag, a rollback anchor, a graph, and an exit nothing escapes. The six nodes (parse_input, build_request, open_stream, dispatch_tools, append_results, finalize) and both return edges live inside the graph object; this code only starts it and closes it out."
      }
    },
    "decision": {
      "why": {
        "zh": "状态留在 harness，不往下推。模型无状态（每轮重发全量 messages），工具拿不到 session 对象、只拿到 {sessionId, callId, abortSignal}，存储只被写行。于是「她现在在做什么」这个问题在全仓只有一个地方能回答。",
        "en": "State stays in the harness rather than being pushed down. The model is stateless (the whole message list is resent each round), a tool never sees the session object — only {sessionId, callId, abortSignal} — and the store is only ever written rows. So \"what is she doing right now\" has exactly one place in the repo that can answer it."
      },
      "cost": {
        "zh": "无状态上游的代价是每一轮把整段上下文重新发一遍；这就是为什么折叠、缓存断点和那个按轮触发的成本告警都长在这条泳道上。",
        "en": "A stateless upstream costs a full context resend every round; that is why the fold, the cache breakpoint, and the per-round cost tripwire all grow on this lane."
      }
    }
  },
  "lane-llm": {
    "claim": {
      "zh": "这一刻是整条线上唯一一次跨出进程的调用，也是唯一一段我们不控制的时间。我们对这个黑盒的全部知识写在两个类型里：送进去的 ProviderRequest 四个字段，收回来的 ProviderEvent 五种。图上那个盒子点不开，是因为里面确实没有我们的代码。",
      "en": "This moment is the only call on the whole line that leaves the process, and the only stretch of time we do not control. Everything we know about the black box fits in two types: four fields going in as a ProviderRequest, five event kinds coming back as ProviderEvent. The box in the diagram does not open because there is genuinely none of our code inside it."
    },
    "mechanism": {
      "zh": "送什么：system（一个字符串，或带 cache_control 断点的 TextBlockParam[]）、messages（全量重发）、tools（由注册表直接映射，没挂载的组连 JSON schema 都生成不出来）、一个可选的 signal。就这四项 —— 没有 session、没有 turn_id、没有除工具结果之外的任何服务端状态。收什么：text_delta、thinking_delta、tool_use_start、tool_input_delta、message_stop 五种。最后那种里的 assistantContent 刻意用 ContentBlockParam[]（入参类型）而不是响应类型，好让非 Anthropic 的 provider 能自己合成一段可回放的 assistant 轮，而不必伪造只在响应里存在的字段。不假设什么：stopReason 的类型是 string，不是枚举 —— 我们不假设黑盒只会说我们见过的那几个词，open_stream 只认 tool_use / max_tokens / refusal 三个已知值，其余一律落到 end_turn。也不假设它给的入参是干净的：有些网关会把自己没能映射的工具入参包成 {\"_noargs\": \"<原始文本>\"}，unwrapGatewayInput 在 message_stop 之前试着拆开；拆不出来就原样放过，交给分发器的 Zod 校验回一条 recoverable 的错，让模型下一轮自己改。缝抹平了什么：走 OpenAI 协议时，systemToOpenAI 把 cache_control 断点直接不读（那边没有显式缓存控制），thinking 块在回放时丢掉，一条带 tool_result 的 user 轮拆成多条 tool 消息，SSE 分片里 id 为空时按 index 合成一个稳定 id —— 否则下一轮请求会因为空的 tool_call_id 直接 400。",
      "en": "What goes in: system (a string, or TextBlockParams carrying a cache_control breakpoint), messages (resent in full), tools (mapped straight off the registry — an unmounted group cannot even produce a JSON schema), and an optional signal. Those four and nothing else: no session, no turn_id, no server-side state beyond tool results. What comes back: text_delta, thinking_delta, tool_use_start, tool_input_delta, message_stop. The assistantContent on that last one is deliberately typed as ContentBlockParam[] — the input type, not the response type — so a non-Anthropic provider can synthesize a replayable assistant turn without forging fields that exist only on responses. What we do not assume: stopReason is typed string, not an enum. We do not assume the box only says words we have seen; open_stream recognizes tool_use, max_tokens and refusal, and everything else falls through to end_turn. Nor do we assume the arguments it hands back are clean: some gateways wrap tool input they failed to map as {\"_noargs\": \"<raw text>\"}, so unwrapGatewayInput tries to unwrap it before message_stop and, failing that, passes it through untouched for the dispatcher's Zod validation to reject as a recoverable error the model can act on next round. What the seam absorbs: on the OpenAI protocol, systemToOpenAI simply does not read the cache_control breakpoint (there is no explicit cache control over there), thinking blocks are dropped on replay, one user turn carrying tool_results expands into several tool messages, and when an SSE fragment arrives with an empty id a stable one is synthesized from its index — otherwise the next request 400s on an empty tool_call_id."
    },
    "contract": {
      "exposes": {
        "zh": "Provider 接口三件：只读的 capabilities、chatStream(req) → AsyncIterable<ProviderEvent>、complete(req) → Promise<CompleteResult>（后者给摘要与梦里的补丁调用用，那条路刻意不开思考 —— 思考也算进 max_tokens，会把真正的输出饿死）。",
        "en": "Three things on the Provider interface: a readonly capabilities, chatStream(req) → AsyncIterable<ProviderEvent>, and complete(req) → Promise<CompleteResult>. The last backs summarization and the dream's patch calls, and deliberately runs without thinking — thinking counts against max_tokens and can starve the actual output."
      },
      "depends": {
        "zh": "只有网络和一把 key。构造点唯一：providerFor() 按 LUNA_MODEL 查模型注册表定协议，LUNA_PROVIDER 可以强制覆盖但只接受 anthropic / openai，别的值当场抛。",
        "en": "Only the network and a key. There is one construction point: providerFor() resolves LUNA_MODEL through the model registry to pick a protocol, and LUNA_PROVIDER may override it but accepts only anthropic or openai — anything else throws on the spot."
      },
      "boundary": {
        "zh": "上游的形状差异一律吃在 provider 内部，不越过 ProviderEvent 这道门。harness 只见五种事件，一次也没有按 model id 分支过。",
        "en": "Every difference in upstream shape is absorbed inside the provider and never crosses the ProviderEvent door. The harness sees five event kinds and has never once branched on a model id."
      },
      "invariant": {
        "zh": "每次 chatStream 恰好产出一个 message_stop；usage 的两个数从那里累加，turn.result 上报的就是它。",
        "en": "Each chatStream yields exactly one message_stop; both usage numbers accumulate from there, and that is what turn.result reports."
      }
    },
    "code": {
      "file": "packages/server/src/provider/capabilities.ts",
      "lines": "5-12",
      "snippet": "export type ProviderCapabilities = {\n  thinking: boolean; // adaptive/extended thinking or reasoning content\n  promptCache: boolean; // honors explicit cache_control breakpoints (else they're stripped)\n  interleavedToolStreaming: boolean; // tool-use streams mid-reply (not buffered to the end)\n  toolUse: boolean; // function/tool calling\n  systemRole: boolean; // a dedicated system message/param (vs folding into the first user turn)\n  maxOutputTokens: number;\n};",
      "note": {
        "zh": "六项能力，每个 Provider 自报，而不是拿 model id 正则去猜。要如实说清今天谁在读它：只有两处 —— provider 自己（OpenAI 那侧用 thinking 决定要不要发 reasoning_effort、用 toolUse 决定要不要带 tools）和启动日志里的 describeCapabilities。turn loop 一处也不读，因为它拿到的已经是一个把差异吃干净了的 provider。这张表的价值是给这道缝一套词汇，不是当运行时开关用。",
        "en": "Six capabilities, each Provider declaring its own rather than being guessed at by a model-id regex. To be exact about who reads it today: two places only — the provider itself (the OpenAI side uses thinking to decide whether to send reasoning_effort, and toolUse to decide whether to send tools) and describeCapabilities in the startup log. The turn loop reads it nowhere, because what it holds is already a provider with the differences absorbed. This table's value is giving the seam a vocabulary, not acting as a runtime switch."
      }
    },
    "decision": {
      "why": {
        "zh": "显式声明而不是假设。Anthropic 那侧六项全 true；OpenAI 那侧逐项由模型注册表算出来（thinking 看 entry.reasoning、promptCache 恒 false、交错流式看 LUNA_OPENAI_STREAM）。换模型是注册表里加一条，甚至可以用 LUNA_MODELS_JSON 从环境注入，不用改任何调用点。",
        "en": "Declare explicitly instead of assuming. The Anthropic side declares all six true; the OpenAI side derives each from the model registry (thinking from entry.reasoning, promptCache always false, interleaved streaming from LUNA_OPENAI_STREAM). Adding a model is one registry entry, injectable from the environment via LUNA_MODELS_JSON, with no call site touched."
      },
      "rejected": {
        "zh": "在调用点写 model-id 正则。注册表文件里把这条写成了明令：模型 id 的匹配只发生在注册表这一个地方。",
        "en": "Model-id regexes at the call sites. The registry file states the rule outright: model ids are matched in the registry and nowhere else."
      },
      "cost": {
        "zh": "能力表目前没有消费者在 turn loop 里，所以一项声明写错了不会在回合里暴露；它挡住的是差异，不是错误。",
        "en": "The capability table has no consumer in the turn loop, so a wrong declaration will not surface during a turn; what it holds back is difference, not error."
      }
    }
  },
  "lane-tools": {
    "claim": {
      "zh": "这一刻是整条线上唯一一次真正的并发。模型一轮可以发出多个 tool_use，分发器在这里把它们摊成三条流同时跑 —— 而这一方怎么被调度，完全由工具自己在定义处声明的三个属性决定：concurrency、timeoutMs、proactiveRisk。调度器不认识任何一个具体工具。",
      "en": "This moment is the only genuine concurrency on the line. The model can emit several tool_uses in one round, and the dispatcher fans them into three streams that run at once — and how this party gets scheduled is decided entirely by three properties each tool declares at its own definition site: concurrency, timeoutMs, proactiveRisk. The scheduler knows no individual tool."
    },
    "mechanism": {
      "zh": "先砍：一批里超过 8 个的调用当场回一条 recoverable 的 err，不排队 —— 模型下一轮可以自己重发。再分桶：28 个工具每一个都声明了档位，15 个 safe-parallel、12 个 session-serial、1 个 global-serial（music_control，因为播放器是跨会话共享的那一个外部世界）。safe-parallel 每个调用起一条独立流；session-serial 整组排进这个会话自己的 mutex，组内按数组顺序逐个过；global-serial 排进 dispatcher 模块里的那个进程级单例。三条流交给 mergeAsync 竞速合并 —— 所以「串行」只发生在组内，组与组之间照样并发。锁在这里争：Mutex 是 acquire/release 两段，等待者排 FIFO 队列；持锁期间的执行包在 try/finally 里，工具抛异常也一定 release。超时：每次调用起一个自己的 AbortController，setTimeout(tool.timeoutMs) 到点 abort。这个跨度很大 —— message 和 enter_dream 是 1 000 毫秒，shell 和 save_skill 是 1 800 000 毫秒（30 分钟）。abort 与 iter.next() 竞速：abort 赢了就回一条 timeout 的 err 然后 return，finally 里给生成器的 iter.return() 最多 100 毫秒收尾，收不完就不等了。中断要说准一件事：客户端断开触发的那个 AbortController 不在这里。ws.handleClose 在最后一个监听者消失时 abort 的是 session.activeTurnAbort，它经 runTurn 的 signal 送进 provider.chatStream —— 断的是上游那条流。dispatchToolCalls 的上下文只有 { sessionId, sessionMutex }，没有 signal：这一刻已经开跑的工具，只会被它自己的 timeoutMs 停下来。",
      "en": "First it cuts: anything past the eighth call in a batch gets a recoverable err immediately instead of a queue slot — the model can simply re-issue it next round. Then it sorts: all 28 tools declare a policy — 15 safe-parallel, 12 session-serial, 1 global-serial (music_control, because the player is the one piece of outside world shared across sessions). Each safe-parallel call gets its own stream; the session-serial group queues on this session's own mutex and goes through one at a time in array order; the global-serial group queues on the process-wide singleton inside the dispatcher module. The three streams are merged by mergeAsync as they produce — so \"serial\" happens only inside a group, and the groups still run against each other. The lock is contended right here: the Mutex is acquire/release with a FIFO queue of waiters, and the execution it guards sits in a try/finally, so a tool that throws still releases. Timeouts: every call gets its own AbortController with a setTimeout(tool.timeoutMs). The span is wide — message and enter_dream are 1,000ms; shell and save_skill are 1,800,000ms (thirty minutes). The abort races iter.next(); if the abort wins, a timeout err is yielded and the generator gets at most 100ms in the finally to close itself down before we stop waiting. One thing to state precisely about interruption: the AbortController that a client disconnect fires is not this one. What ws.handleClose aborts when the last listener disappears is session.activeTurnAbort, which travels through runTurn's signal into provider.chatStream — it cuts the upstream stream. The dispatcher's context is only { sessionId, sessionMutex }; there is no signal in it, so a tool already running at this moment will only ever be stopped by its own timeoutMs."
    },
    "contract": {
      "exposes": {
        "zh": "dispatchToolCalls(calls, ctx, registry) → 一条 ToolEvent 的异步流：started / progress / final。progress 是让 message 这类工具边跑边把字吐给前端用的。",
        "en": "dispatchToolCalls(calls, ctx, registry) → an async stream of ToolEvents: started, progress, final. The progress kind is what lets a tool like message push characters to the frontend while it is still running."
      },
      "depends": {
        "zh": "注册表（boot 时冻结，关掉的一组根本不在里面，于是既不进提示词也不进分发）、会话 mutex、以及 dispatcher 模块里那个进程级 mutex 单例。",
        "en": "The registry (frozen at boot; a switched-off group is simply not in it, so it reaches neither the prompt nor the dispatcher), the session mutex, and the process-wide mutex singleton inside the dispatcher module."
      },
      "boundary": {
        "zh": "两侧都不信：入参过 tool.input.safeParse，出参过 tool.output.safeParse。入参校验失败回 recoverable=true（模型能改），出参校验失败回 recoverable=false（模型改不了）。工具拿到的上下文只有 sessionId / callId / abortSignal —— 它看不见 session，也看不见历史。",
        "en": "Neither side is trusted: input goes through tool.input.safeParse, output through tool.output.safeParse. A failed input is recoverable=true (the model can fix it); a failed output is recoverable=false (the model cannot). A tool's context is only sessionId, callId and abortSignal — it can see neither the session nor the history."
      },
      "invariant": {
        "zh": "每个 call_id 恰好产出一个 final 事件。生成器一个 final 都没给就结束，也会被补一条 execution_exception 的 err —— 因为上游要求每个 tool_use 必须配一个 tool_result，缺一个这段历史就永久坏掉。",
        "en": "Exactly one final event per call_id. A generator that ends without producing one still gets an execution_exception err synthesized for it — upstream requires every tool_use to be paired with a tool_result, and one missing pair poisons that history forever."
      }
    },
    "code": {
      "file": "packages/server/src/tools/dispatcher.ts",
      "lines": "112-119",
      "snippet": "  const abortController = new AbortController();\n  const timeoutId = setTimeout(() => abortController.abort('timeout'), tool.timeoutMs);\n\n  const iter = tool.execute(inputParse.data, {\n    sessionId: ctx.sessionId,\n    callId: call.call_id,\n    abortSignal: abortController.signal,\n  });",
      "note": {
        "zh": "这就是工具能被打断的全部机制：一个只由超时触发的 AbortController，一个工具（如果它愿意读 abortSignal）唯一能听见的信号。八行里没有 ctx.signal —— 分发上下文里根本没有这个字段。",
        "en": "This is the entirety of how a tool can be interrupted: one AbortController, fired by a timeout and nothing else, carrying the only signal a tool can hear (if it bothers to read abortSignal). There is no ctx.signal in these eight lines — the dispatch context has no such field."
      }
    },
    "decision": {
      "why": {
        "zh": "超出并发上限的调用当场回一条可恢复的错误，而不是排队。排队会让一轮的时长被最长的那一批拖住，而模型本来就有下一轮 —— 让它自己重发，比在这里攒一个隐形队列诚实。",
        "en": "Calls past the concurrency cap get a recoverable error on the spot instead of a queue slot. A queue would tie a round's duration to its longest batch, and the model already has a next round — letting it re-issue is more honest than accumulating an invisible queue here."
      },
      "rejected": {
        "zh": "把超出的调用排到下一批执行。",
        "en": "Holding the overflow calls back and running them in a following batch."
      },
      "cost": {
        "zh": "模型一轮发了 9 个调用，第 9 个这一轮不会跑；它得自己注意到并重发。",
        "en": "If the model emits nine calls in one round, the ninth does not run that round; it has to notice and re-issue."
      }
    }
  },
  "lane-store": {
    "claim": {
      "zh": "前面四方都是易失的：socket 会断，harness 的 session 活在进程里，模型不记得上一轮，工具跑完就忘。存储是唯一跨进程活着的一方，也是反应式路径与主动/梦路径之间唯一的持久交接面 —— 两条路径从不互相持有对象，它们只在这里碰面。",
      "en": "The other four parties are all volatile: the socket drops, the harness's session lives inside a process, the model does not remember last round, and a tool forgets the moment it finishes. The store is the only party that survives the process, and the only durable handoff surface between the reactive path and the proactive/dream path — the two never hold each other's objects; they meet only here."
    },
    "mechanism": {
      "zh": "谁在写：L2 时间线只有一个写者。appendL2 全仓只有一处调用点，在 runTurn 的 finally 里，而且只有 realReply 非空才写；否则 history 整段回滚到 historyStart，一个字都不落 —— 一条空的助手行会同时毒化召回和重建出来的窗口。主动回合走的是同一个 runTurn，所以它也从这一处落库，只是 user_text 存空串。谁在读：读者是散开的 —— 连接时的历史重放（最近 300 轮）、进程重启后的会话重建、L1 折叠（按绝对偏移索引，所以这一处必须不带 limit 地读整条时间线）、召回的候选集（最近 500 行）、主动路径的「上一次用户回合是什么时候」锚点、梦里四处读。全仓有 21 个非测试模块直接持有 db 句柄，但往 l2_turns 写的只有那一处。交接的形状：进程重启后内存里的 session 全没了，loadSession 不读 sessions.history_json（那一列自 v0.16.2 起只写一个常量 [] 占位），而是把 l2_turns 每行的 raw_json 按时间顺序 flatMap 起来 —— 每一行正好是那一轮往 history 追加的消息，拼起来就是完整历史。降级路径要说实话：boot 时 initCustomSqlite() 在任何 Database 构造之前跑一次，按 LUNA_SQLITE_LIB 再加 6 个 Unix 候选路径找一个能加载扩展的 libsqlite3；win32 的候选列表是空的（系统 winsqlite3.dll 编译时就关掉了扩展加载），只认那个覆盖变量。找不到就返回 false，不抛。但今天这条降级路径没有可降的东西 —— tryLoadVec 在生产代码里没有任何调用点，vec0 / vec_cache 虚拟表在 v0.16.2 已经随「只写不读」的死路径一起删掉，检索本来就是 recall.ts 里的 TS 余弦。扩展加载器和 sqlite-vec 依赖是被有意留着的空位，不是正在工作的快路径。",
      "en": "Who writes: the L2 timeline has exactly one writer. appendL2 has a single call site in the whole repo, inside runTurn's finally, and it only fires when realReply is non-empty; otherwise history is rolled all the way back to historyStart and not a word lands — an empty assistant row would poison both recall and the rebuilt window. A proactive turn runs through the same runTurn, so it persists from that same place, just with an empty user_text. Who reads: the readers are scattered — the history replay on connect (the last 300 turns), session rehydration after a restart, the L1 fold (which indexes by absolute offset, so that one caller must read the whole timeline with no limit), recall's candidate set (the most recent 500 rows), the proactive path's \"when was the last user turn\" anchor, and four reads inside the dream. Twenty-one non-test modules hold a database handle directly, but only one of them writes to l2_turns. The shape of the handoff: after a restart the in-memory sessions are gone, and loadSession does not read sessions.history_json (that column has held nothing but a constant [] placeholder since v0.16.2) — it flatMaps the raw_json of each l2_turns row in time order, because each row is exactly the messages that turn appended, so concatenating them reconstitutes the full history. About the degradation path, honestly: at boot initCustomSqlite() runs once before any Database is constructed, looking for an extension-capable libsqlite3 via LUNA_SQLITE_LIB plus six Unix candidate paths; on win32 the candidate list is empty (the system winsqlite3.dll has extension loading compiled out) and only the override counts. Finding none, it returns false rather than throwing. But there is nothing left for that path to degrade from today — tryLoadVec has no production call site, the vec0 / vec_cache virtual table was deleted at v0.16.2 along with the write-only dead path that fed it, and retrieval has always been the TypeScript cosine in recall.ts. The extension loader and the sqlite-vec dependency are a deliberately reserved seat, not a fast path in service."
    },
    "contract": {
      "exposes": {
        "zh": "仓库根上的一个文件 luna.sqlite：22 个迁移之后 18 张活着的表（20 条 CREATE TABLE，0017 把 core_memory 与它的审计表一起退役）。",
        "en": "One file at the repo root, luna.sqlite: eighteen live tables after twenty-two migrations (twenty CREATE TABLEs, with 0017 retiring core_memory and its audit table together)."
      },
      "depends": {
        "zh": "bun:sqlite。持久化整体可以关掉 —— LUNA_PERSIST=0 时 setMemoryDb 不被调用，于是 sessionStore 的每个函数都变成 no-op，会话纯内存。",
        "en": "bun:sqlite. Persistence as a whole can be switched off — with LUNA_PERSIST=0 setMemoryDb is never called, every sessionStore function becomes a no-op, and sessions stay purely in memory."
      },
      "boundary": {
        "zh": "它不回调任何人。没有触发器、没有监听、没有通知 —— 上面每一层要知道发生了什么，都得自己来读。这也是为什么它能当交接面：交接是靠读，不是靠推。",
        "en": "It calls nobody back. No triggers, no listeners, no notifications — every layer above it has to come and read. That is exactly what makes it usable as a handoff surface: the handoff happens by reading, not by pushing."
      },
      "invariant": {
        "zh": "L2 是历史的真相源。每行 raw_json 恰好是那一轮往 history 追加的消息，按 t_ms 升序拼接可重建完整历史 —— 所以每轮的持久化是 O(1)，不是把整段历史重新序列化一遍。",
        "en": "L2 is the source of truth for history. Each row's raw_json is exactly what that turn appended, and concatenating them in ascending t_ms order rebuilds the whole history — which is why per-turn persistence is O(1) rather than a full re-serialization."
      }
    },
    "code": {
      "file": "packages/server/src/memory/sessionStore.ts",
      "lines": "29-42",
      "snippet": "export function loadSession(id: string): PersistedSession | null {\n  if (!db) return null;\n  const row = db\n    .prepare('SELECT turn_seq, rolling_summary, window_low_water FROM sessions WHERE id = ?')\n    .get(id) as { turn_seq: number; rolling_summary: string; window_low_water: number } | null;\n  const history = listL2(id).flatMap((r) => JSON.parse(r.raw_json) as Anthropic.MessageParam[]);\n  if (!row && history.length === 0) return null;\n  return {\n    history,\n    turnSeq: row?.turn_seq ?? 0,\n    rollingSummary: row?.rolling_summary ?? '',\n    windowLowWater: row?.window_low_water ?? 0,\n  };\n}",
      "note": {
        "zh": "交接真正发生的那一行是 flatMap 那一行：进程死过一次之后，一段完整的对话历史从一张追加式的表里长回来。旁边三个字段（turn_seq / rolling_summary / window_low_water）是折叠的账，是唯一还从 sessions 表读的东西。",
        "en": "The line where the handoff actually happens is the flatMap: after the process has died once, a complete conversation history grows back out of an append-only table. The three fields beside it (turn_seq, rolling_summary, window_low_water) are the fold's bookkeeping, and the only things still read out of the sessions table."
      }
    },
    "decision": {
      "why": {
        "zh": "历史从追加式的 L2 重建，而不是每一轮把整段 history 重新序列化进一个 blob —— 后者是这个仓库里最后一处 O(N²) 的写。",
        "en": "History is rebuilt from the append-only L2 rather than re-serialized into a blob every turn — the latter was the last O(N²) write left in this repo."
      },
      "rejected": {
        "zh": "把 sessions.history_json 当真相源。那一列还在，但现在只写一个常量占位，留着是为了不动表结构。",
        "en": "Treating sessions.history_json as the source of truth. The column is still there, now written only as a constant placeholder, kept so the schema need not change."
      },
      "cost": {
        "zh": "每次重建都要把整条时间线读出来并逐行 JSON.parse；boot 和每次折叠各付一次这个钱。",
        "en": "Every rebuild reads the whole timeline and JSON.parses each row; that cost is paid once at boot and once per fold."
      }
    }
  },

  /* ── 时序 · 前五步 ───────────────────────────── */
  "msg": {
    "claim": {
      "zh": "「一条消息」不是从模型那里开始的，是从一个 WebSocket 帧开始的。这一帧要连过五道闸——JSON 能不能解析、schema 认不认（正文上限 8000 字符）、她是不是在做梦、provider 配没配、这个会话是不是已经有一轮在跑——五道全过，服务端才在这一刻打上两个时间戳、new 一个 AbortController，然后把回合甩出去（void runTurn），处理函数当场返回。",
      "en": "A message does not begin at the model; it begins as a WebSocket frame. That frame passes five gates in a row — does the JSON parse, does the schema accept it (the body caps at 8000 characters), is she dreaming, is a provider configured at all, is a turn already running in this session — and only when all five pass does the server stamp two timestamps, create an AbortController and fire the turn off with void runTurn, returning from the handler immediately."
    },
    "mechanism": {
      "zh": "五道闸的顺序是有意义的。前两道住在 protocol 包里：JSON.parse 失败回 invalid_event、文案「invalid JSON」；Zod 不过也回 invalid_event，但文案是 Zod 自己的报错串。8000 字符的上限就钉在这一层——z.string().min(1).max(CHAT_SEND_MAX_CHARS)——外面还罩着一层 1 MiB 的帧上限。后三道住在 ws.ts：中间那道是 runtime_not_configured（provider 压根没配，文案「no provider configured; chat.send unavailable」），另外两道则是两种截然不同的拒绝——做梦时回 dreaming，文案「Luna is dreaming — send dream.wake to wake her」，与其说是错误不如说是指路牌，直接告诉客户端该改发哪个事件；正忙时回 turn_in_progress，文案是模板串 `turn ${session.activeTurn} is still running`，把正在跑的那一轮的 id 原样念回去。两者都不排队。五道全过之后，lastUserMs 和 markActivity 分头拨两个时钟（前者是升级阶梯的复位锚，后者是沉默计时器），turn_id 允许客户端自己起名，不起就落到「会话 id:turn:序号」。",
      "en": "The order of the five gates matters. The first two live in the protocol package: a failed JSON.parse returns invalid_event with the message \"invalid JSON\"; a failed Zod parse also returns invalid_event, but carries Zod's own error text. The 8000-character cap is pinned at that layer — z.string().min(1).max(CHAT_SEND_MAX_CHARS) — with a 1 MiB frame cap outside it. The last three live in ws.ts: the middle one is runtime_not_configured (no provider configured at all, message \"no provider configured; chat.send unavailable\"), and the other two are two entirely different refusals — while dreaming the reply is code dreaming, message \"Luna is dreaming — send dream.wake to wake her\", less an error than a signpost telling the client which event to send instead; while busy it is turn_in_progress, whose message is the template `turn ${session.activeTurn} is still running`, reading the running turn's id back verbatim. Neither queues anything. Past all five, lastUserMs and markActivity move two separate clocks (the first is the escalation-reset anchor, the second the silence timer), and turn_id may be named by the client, falling back to \"session id:turn:sequence\"."
    },
    "contract": {
      "exposes": {
        "zh": "成功不回执。客户端收到的第一个信号是 turn.started，而那要等 ①装配 整个跑完才发得出来；失败则立刻回一条 error{code, message}。",
        "en": "Success sends no acknowledgement. The first signal a client sees is turn.started, and that cannot fire until ① assemble has run to completion; a failure returns one error{code, message} immediately."
      },
      "depends": {
        "zh": "isDreaming()（进程级的做梦状态）、runtime（provider 与工具注册表是否已配好）、session.activeTurn。",
        "en": "isDreaming() (the process-level dream state), runtime (whether a provider and tool registry are configured at all), and session.activeTurn."
      },
      "boundary": {
        "zh": "内容校验全在 protocol 包，ws.ts 一个字符都不看——它只问状态。",
        "en": "Content validation lives entirely in the protocol package; ws.ts inspects not one character of the text — it only asks about state."
      },
      "invariant": {
        "zh": "一个会话同一时刻最多一轮。activeTurn 由 runTurn 在 try 之前置位、在 finally 里清空，所以哪怕回合抛异常，闸也一定会重新打开。",
        "en": "At most one turn per session at a time. runTurn sets activeTurn before its try and clears it in the finally, so the gate reopens even when the turn throws."
      }
    },
    "code": {
      "file": "packages/server/src/ws.ts",
      "lines": "226-239",
      "snippet": "      const session = getSession(ws.data.sessionId);\n      if (session.activeTurn !== null) {\n        outbound(ws, {\n          type: 'error',\n          code: 'turn_in_progress',\n          message: `turn ${session.activeTurn} is still running`,\n        });\n        return;\n      }\n      const userNowMs = Date.now();\n      session.lastUserMs = userNowMs; // the escalation-reset anchor (user reply → engaged)\n      markActivity(session, userNowMs); // a user message is conversation activity → bump the silence timer\n      const { provider, registry } = runtime; // narrowed by the guard above\n      const turnId = event.turn_id ?? `${session.id}:turn:${session.turnSeq}`;",
      "note": {
        "zh": "这十四行是第五道闸和它之后的全部。先看先后：闸排在两个时间戳前面，所以一条被弹回的消息不会污染沉默计时器。再看那句模板串——它把正在跑的那一轮的 id 原样念回给客户端。",
        "en": "These fourteen lines are the fifth gate and everything after it. Read the order first: the gate precedes both timestamps, so a bounced message never pollutes the silence timer. Then read the template string — it reads the running turn's id back to the client verbatim."
      }
    },
    "decision": {
      "cost": {
        "zh": "这道闸的副作用被代码自己记在案：v0.32.4 的注释写着，回合末尾那次多余的模型往返期间 activeTurn 仍然锁着，用户此刻发出的消息会被弹回 turn_in_progress，而她已经送达的回复在屏幕上看起来明明已经说完了。修法不是撤掉闸，是缩短那个窗口。",
        "en": "The gate's side effect is recorded in the code itself: the v0.32.4 comment notes that activeTurn stays locked through the redundant trailing model round-trip, so a message sent in that window bounces with turn_in_progress while her already-delivered reply sits on screen looking finished. The fix was to shorten the window, not to remove the gate."
      }
    }
  },
  "assemble": {
    "claim": {
      "zh": "整轮里只有这一刻会装感知。parse_input 是图的入口节点，后面每一次工具迭代都从 ②schema 重新进入——所以这条最多七块的 user 消息一整轮只装一次：她在第 8 轮读到的时间、天气、在放的歌，还是第 1 轮那一份。",
      "en": "Perception is assembled at this moment and at no other. parse_input is the graph's entry node, and every later tool round re-enters at ② schema — so this user message of at most seven blocks is built exactly once per turn: the time, weather and current track she reads in round 8 are still the ones from round 1."
    },
    "mechanism": {
      "zh": "这一刻的先后里只有一处需要等：召回。await retrieve(...) 要算这句话的向量、跟四个源打分；其余每一块都是同步地读一份后台早就热好的缓存（天气快照、常驻音乐 provider 的内存），反应路径上不发一个网络请求。还有两件事在这一刻被「烧掉」：开机后第一条真实用户回合消费掉醒来场景（wakePending 置 false），换歌后第一轮消费掉整首歌词，并把是哪一首记在 lyricsBurnedFor 上——万一这一轮被回滚，这一口还能还回去。每个可选块各自包在 try/catch 里，任何一块的构造函数抛了，只丢那一块、warn 一行、回合继续。最后才 push 用户原话，整条消息进 history，turn.started 到这时候才发出去。",
      "en": "Only one step in this moment waits: recall. await retrieve(...) has to embed the wording and score it against four sources; every other block is a synchronous read of a cache a background job already warmed (the weather snapshot, the resident music provider's memory), so the reactive path makes no network call. Two things are also burned here: the first real user turn after boot consumes the wake scene (wakePending goes false), and the first turn after a track change consumes the whole lyric and records which track it was in lyricsBurnedFor — so a rolled-back turn can give the sip back. Each optional block sits in its own try/catch: if a builder throws, that one block is dropped, one line is warned, and the turn continues. The user's own words are pushed last, the whole message goes into history, and only then does turn.started go out."
    },
    "contract": {
      "exposes": {
        "zh": "一条 role 为 user 的消息被 push 进 session.history，节点随后返回 build_request。",
        "en": "One message with role user is pushed into session.history, and the node then returns build_request."
      },
      "depends": {
        "zh": "retrieve + renderRecallBlock（整步唯一的 await）、buildTimeBlock、getSnapshot + buildWeatherBlock、musicBlockFor、lyricsBurstFor。",
        "en": "retrieve + renderRecallBlock (the only await in the whole step), buildTimeBlock, getSnapshot + buildWeatherBlock, musicBlockFor, lyricsBurstFor."
      },
      "boundary": {
        "zh": "主动回合在这一刻少三样：不召回（它的「用户文本」是内部舞台指示，不是查询）、不吃醒来场景、不发 turn.started。",
        "en": "A proactive turn does three fewer things here: no recall (its \"user text\" is an internal stage direction, not a query), no wake scene, no turn.started."
      },
      "invariant": {
        "zh": "缺席即零残留——没有占位符、没有空标签；一块抛异常只丢一块，从不让整轮失败。",
        "en": "Absence leaves zero residue — no placeholder, no empty tag; a throwing block costs that block only, never the turn."
      }
    },
    "code": {
      "file": "packages/server/src/turn/runTurn.ts",
      "lines": "363-376",
      "snippet": "      try {\n        const burst = lyricsBurstFor();\n        if (burst) {\n          blocks.push({ type: 'text', text: burst });\n          // v0.45.17: remember WHICH track's burn this turn spent, so a rolled-back turn can\n          // give it back (the block goes with the history; the mark must too).\n          s.lyricsBurnedFor = getNowPlaying()?.track?.id ?? null;\n        }\n      } catch (e) {\n        console.warn('[music] lyricsBurstFor failed — omitting the lyrics block:', e);\n      }\n    }\n    blocks.push({ type: 'text', text: s.userText });\n    s.session.history.push({ role: 'user', content: blocks });",
      "note": {
        "zh": "一个 try 里包着三件事：拿歌词、推进块、记下这一口烧在了哪首歌上——三件必须同生共死，所以它们在同一个 try 里。紧接的两行就是用户原话和 history。",
        "en": "One try wraps three things: fetch the lyric, push the block, record which track the sip was spent on — all three must live or die together, which is why they share a try. The two lines that follow are the user's own words and history."
      }
    },
    "decision": {
      "why": {
        "zh": "每个感知块单独 try/catch 是刻意的降级设计：天气、时间、音乐都是锦上添花，没有一件值得让一整轮对话失败。三处 catch 的措辞是同一个模式——「omitting the … block」，而不是让回合出错。",
        "en": "Giving each perception block its own try/catch is a deliberate degradation design: weather, time and music are all garnish, and not one of them is worth failing a conversation over. All three catches are worded the same way — \"omitting the … block\" — rather than failing the turn."
      },
      "cost": {
        "zh": "装一次的代价是会过时。一轮跑到第 8 次迭代时，她手上的时间仍然停在回合开始的那一刻；想要更新的，她得自己去调 time_now 或 weather 工具。",
        "en": "Assembling once means going stale. By the eighth iteration of a turn the time in her hands is still the moment the turn began; if she wants a fresher one she has to call the time_now or weather tool herself."
      }
    }
  },
  "schema": {
    "claim": {
      "zh": "六行，一个 if，一次赋值。这个节点只做一件事：把注册表里每个工具的 Zod schema 转成模型读得懂的 JSON Schema——而且一整轮只做一次。守卫是 length === 0，结果缓存在这一轮的 state 上。",
      "en": "Six lines, one if, one assignment. This node does exactly one thing: turn every tool's Zod schema in the registry into JSON Schema the model can read — once per turn. The guard is length === 0 and the result is cached on this turn's state."
    },
    "mechanism": {
      "zh": "它之所以是一个独立节点、而不是 open_stream 开头的两行，有两个可查的后果。其一是可观测：图的每一次节点转移都由 onTransition 记一条 kind 为 node 的 trace，于是 parse_input → build_request → open_stream 之间，「装配完了、还没发请求」这个瞬间有了一根带时间戳的界桩。其二是重入：append_results 跑完返回的是 build_request 而不是 open_stream，所以一轮里这个节点最多被进 8 次，但 zodToJsonSchema 只在第一次真的跑。缓存挂在 TurnState 而不是模块级，是因为 registry 是按回合传进来的——换一套工具集，自然就重算。",
      "en": "Being its own node rather than two lines at the top of open_stream has two checkable consequences. One is observability: every node transition is traced by onTransition as a kind: node record, so between parse_input → build_request → open_stream the instant of \"assembly done, request not yet sent\" gets a timestamped boundary marker. The other is re-entry: append_results returns build_request, not open_stream, so this node is entered up to 8 times in a turn while zodToJsonSchema actually runs only on the first. The cache lives on TurnState rather than at module level because the registry is handed in per turn — a different tool set simply recomputes."
    },
    "contract": {
      "exposes": {
        "zh": "只写 s.anthropicTools，返回 open_stream。",
        "en": "It writes s.anthropicTools and returns open_stream."
      },
      "depends": {
        "zh": "toolsToAnthropicFormat，内部是 zodToJsonSchema(tool.input, { $refStrategy: 'none' })。",
        "en": "toolsToAnthropicFormat, which internally is zodToJsonSchema(tool.input, { $refStrategy: 'none' })."
      },
      "boundary": {
        "zh": "不碰 history、不碰 provider、不发任何事件。",
        "en": "It touches no history, no provider, and emits no event."
      },
      "invariant": {
        "zh": "一轮之内工具表恒定——模型在第 8 轮看到的和第 1 轮是同一个数组对象。",
        "en": "The tool table is constant within a turn — what the model sees in round 8 is the very same array object it saw in round 1."
      }
    },
    "code": {
      "file": "packages/server/src/turn/runTurn.ts",
      "lines": "386-391",
      "snippet": "  async build_request(s) {\n    if (s.anthropicTools.length === 0) {\n      s.anthropicTools = toolsToAnthropicFormat(s.registry);\n    }\n    return 'open_stream';\n  },",
      "note": {
        "zh": "整个节点就是这六行。最要紧的是那个守卫：判据是数组长度，不是 registry 的内容——因为在一轮之内 registry 根本不会变。",
        "en": "The whole node is these six lines. The load-bearing part is the guard: it tests the array's length, not the registry's content — because within a turn the registry cannot change."
      }
    },
    "decision": {
      "why": {
        "zh": "拆成独立节点的收益是可观测：trace 里看得见「装配结束、请求未发」这条边；折进 open_stream，这条边就不存在了。",
        "en": "Splitting it out buys observability: the trace carries an edge for \"assembly finished, request not yet sent\". Folded into open_stream, that edge would simply not exist."
      }
    }
  },
  "request": {
    "claim": {
      "zh": "到这一刻才有字节离开进程。真正发出去的请求只有四个字段，而这四个字段来自四种不同的寿命：system 是跨轮记忆化的，messages 是每一轮现算的，tools 是上一步建好之后整轮不动的，signal 是 chat.send 那一刻就 new 出来的。",
      "en": "Only at this moment do bytes leave the process. The request that actually goes out has four fields, and those four come from four different lifetimes: system is memoized across rounds, messages is recomputed every round, tools was built one step ago and never moves again, and signal was created back at chat.send."
    },
    "mechanism": {
      "zh": "system 在这一刻先读一次 memoryEpoch()：epoch 没动就直接复用上一轮那份人格前缀，动了就在这里重建——所以「上一轮她刚 remember 了一件事」这件事，是在这一刻、赶在下一次请求发出之前生效的，不必等到下一回合。messages 恰好相反，每一轮都从 session.history 重走一遍 buildActiveContext：按低水位切尾 → 若切点落在一对 tool_use/tool_result 中间就往后挪到下一个回合起点 → 折叠旧的工具结果 → 用 300 条 / 120 000 字符的硬上限从尾部往前裁 → 有摘要就在最前面拼一条 <conversation_summary>。所有裁剪只落在回合起点上：从别处切会把 tool_result 和它的 tool_use 拆散，请求当场被 API 打回。signal 则是一路从 WebSocket 传到这里的那一个——最后一个监听者断开时，这条流就在这里被掐断。",
      "en": "system reads memoryEpoch() once here: if the epoch has not moved, last round's persona prefix is reused as is; if it has, the prefix is rebuilt right here — so the fact that \"she called remember last round\" takes effect at this moment, ahead of the next request, rather than waiting for the next turn. messages is the opposite: every round walks session.history through buildActiveContext again — slice at the low-water mark, then if that cut lands inside a tool_use/tool_result pair advance it to the next turn start, collapse the older tool results, trim backwards from the tail against a hard budget of 300 messages / 120,000 characters, and prepend a <conversation_summary> when there is a digest. Every cut lands on a turn start: cutting anywhere else orphans a tool_result from its tool_use and the API rejects the request outright. signal is the very controller carried down from the WebSocket — when the last listener disconnects, this is the stream that gets cut."
    },
    "contract": {
      "exposes": {
        "zh": "一个 provider.chatStream(...) 的异步迭代；这一刻之后，事件才开始往回流。",
        "en": "An async iteration over provider.chatStream(...); only after this moment do events start flowing back."
      },
      "depends": {
        "zh": "memoryEpoch()、buildSystemPrompt、buildActiveContext，以及 provider 适配层。",
        "en": "memoryEpoch(), buildSystemPrompt, buildActiveContext, and the provider adapter layer."
      },
      "boundary": {
        "zh": "整个请求里缓存断点只有一个，就打在 system 那一块上（cache_control: { type: 'ephemeral' }）；messages 里一个断点都没有。",
        "en": "The whole request carries exactly one cache breakpoint, on the system block (cache_control: { type: 'ephemeral' }); messages carries none at all."
      },
      "invariant": {
        "zh": "送出去的 messages，第一条永远是一个回合起点（或那条摘要），永不从一对工具消息的中间切开。",
        "en": "The first entry of the messages that go out is always a turn start (or the summary), never a cut through the middle of a tool pair."
      }
    },
    "code": {
      "file": "packages/server/src/turn/runTurn.ts",
      "lines": "414-419",
      "snippet": "    for await (const ev of s.provider.chatStream({\n      system: s.systemBlock,\n      messages: buildActiveContext(s.session),\n      tools: s.anthropicTools,\n      signal: s.signal,\n    })) {",
      "note": {
        "zh": "四行，四种寿命。并排放进一个对象字面量之后最容易忽略的是第三行——buildActiveContext 是一次函数调用，每一轮都会重跑；它上面那个 s.systemBlock 不是。",
        "en": "Four lines, four lifetimes. Side by side in one object literal, the easy line to miss is the third — buildActiveContext is a call, re-run every round; the s.systemBlock above it is not."
      }
    },
    "decision": {
      "cost": {
        "zh": "messages 每轮重算不是免费的：硬上限那一步要从尾部逐条 JSON.stringify 每条消息的 content，直到撞上 300 条或 120 000 字符的预算为止；一轮跑满 8 次迭代就走 8 遍。",
        "en": "Recomputing messages every round is not free: the hard-cap step JSON.stringifies each message's content walking backwards from the tail until it hits the 300-message or 120,000-character budget — eight times over in a turn that runs its full eight iterations."
      }
    }
  },
  "dispatch": {
    "claim": {
      "zh": "并发在这一刻才真的发生，而它前面还有一段完全串行的判定。dispatch_tools 先用一个纯判定的循环把这一批调用逐个过一遍——名字认不认、主动回合的安全门放不放——过关的攒成一个数组，然后整批一次性交给 dispatcher，锁在那里争。",
      "en": "Concurrency actually happens at this moment, and a fully serial pass comes first. dispatch_tools walks the batch with a pure decision loop — is the name known, does the proactive safety gate allow it — collects the survivors into one array, and only then hands the whole batch to the dispatcher, where the locks are contended."
    },
    "mechanism": {
      "zh": "判定循环开始之前，surfacedBefore 就已经取好快照了（messageTexts.length > 0），而这一轮自己的 message 调用要等下面真的 dispatch 完才写得进 messageTexts——所以「先说后做」被强制跨轮：同一轮里的一次 message，解锁不了它旁边那个动作。被门挡下的调用走 continue：它既不进 calls（不执行），也不进 toolNamesThisTurn（不计入预算——主动回合的动作预算在 append_results 里读的正是 toolNamesThisTurn.length），但它仍然必须拿到一条 tool_result 回填，否则下一轮请求里就会留下一个没有结果的 tool_use。第二段把整批交出去时才出现真正的并发：会话 mutex 是从这个 session 上取的（所以两个会话互不阻塞），全局 mutex 在 dispatcher 模块里，几条流被 mergeAsync 竞速合并，事件按到达顺序 yield 回来。",
      "en": "surfacedBefore is snapshotted before the decision loop starts (messageTexts.length > 0), and this round's own message calls do not land in messageTexts until the dispatch below actually completes — so announce-then-act is forced across rounds: a message in this round cannot unlock the action sitting next to it. A blocked call takes the continue: it never enters calls (so it does not run) and never enters toolNamesThisTurn (so it does not count — the proactive action budget in append_results reads exactly toolNamesThisTurn.length), yet it must still be handed a tool_result, or the next request would carry a tool_use with no result. Real concurrency appears only in the second half, when the batch is handed over: the session mutex is taken from this session (so two sessions never block each other), the global mutex lives in the dispatcher module, and the streams are raced together by mergeAsync, yielding events in arrival order."
    },
    "contract": {
      "exposes": {
        "zh": "每个调用至少一条 tool.finished（被拦的、名字不认识的也有）；结果按到达顺序累进 toolResultBlocks。",
        "en": "At least one tool.finished per call — blocked ones and unknown names included; results accumulate into toolResultBlocks in arrival order."
      },
      "depends": {
        "zh": "dispatchToolCalls、session.mutex、proactiveRiskOf / isProactiveActionAllowed。",
        "en": "dispatchToolCalls, session.mutex, proactiveRiskOf / isProactiveActionAllowed."
      },
      "boundary": {
        "zh": "被门挡下的和名字不认识的从不进 dispatcher——它们的 err 是 runTurn 在这个循环里自己造的，dispatcher 根本不知道它们存在过。",
        "en": "Gated calls and unknown names never reach the dispatcher — their err is constructed by runTurn inside this loop, and the dispatcher never learns they existed."
      },
      "invariant": {
        "zh": "每一个 tool_use 都恰好配一个 tool_result，无论它有没有真的跑过。",
        "en": "Every tool_use is matched by exactly one tool_result, whether or not it ever ran."
      }
    },
    "code": {
      "file": "packages/server/src/turn/runTurn.ts",
      "lines": "535-548",
      "snippet": "          continue; // not dispatched, not counted toward the action budget\n        }\n      }\n\n      calls.push({ call_id: use.id, tool_name: name, input: use.input });\n      s.toolNamesThisTurn.push(name);\n    }\n\n    if (calls.length > 0) {\n      for await (const evt of dispatchToolCalls(\n        calls,\n        { sessionId: s.session.id, sessionMutex: s.session.mutex },\n        s.registry,\n      )) {",
      "note": {
        "zh": "判定和执行的交界正好落在这十四行的中间：上面两行决定这次调用算不算数（calls 决定跑不跑，toolNamesThisTurn 决定算不算预算），下面五行就是整批出手，会话锁在这里被交进 dispatcher。",
        "en": "The seam between deciding and executing falls in the middle of these fourteen lines: the two lines above settle whether a call counts (calls decides whether it runs, toolNamesThisTurn whether it is billed), and the five below are the whole batch going out, with the session lock handed into the dispatcher."
      }
    },
    "decision": {
      "why": {
        "zh": "两段式——先整批判定，再整批出手——让并发策略只有 dispatcher 一处知道，安全门只有这个循环一处知道；没有第三个地方需要同时懂这两件事。",
        "en": "The two-phase shape — decide the whole batch, then release the whole batch — keeps the concurrency policy known only to the dispatcher and the safety gate known only to this loop; no third place has to understand both."
      },
      "cost": {
        "zh": "快照式的 surfacedBefore 意味着「同一轮里说了再做」不算数。一次真的只想改个音量的主动回合，也要多花一整次模型往返：这一轮说，下一轮才动。",
        "en": "A snapshotted surfacedBefore means speaking and acting inside one round does not count. A proactive cycle that genuinely only wants to change the volume still spends an entire extra model round-trip: speak this round, act the next."
      }
    }
  },

  /* ── 时序 · 后六步 ───────────────────────────── */
  "exec": {
    "claim": {
      "zh": "这一刻，模型写下的一句 tool_use 才第一次变成真在跑的东西。四件事同时开始：一轮最多 8 个调用被切成三桶，后两桶各排在一把互斥锁后面；每个调用带上自己的 AbortController 和倒计时；工具自己 yield 的进度从这里流回前端。",
      "en": "This is the moment a tool_use the model merely wrote becomes something actually running. Four things start at once: at most 8 calls per round are sorted into three buckets, two of which queue behind a mutex; every call carries its own AbortController and countdown; and whatever progress a tool yields flows back to the frontend from here."
    },
    "mechanism": {
      "zh": "时机上有一件事容易搞反:message 的字并不是在这一刻才出去的。它在 ③ 的流里就靠 tool_input_delta 一路流成气泡了——所以执行这一刻不是「开始说话」,而是「这句话被承认」:Zod 校验过了才有 tool.started 与 tool.finished。校验没过的那种(比如一句话切出的从句超长)根本不发 tool.started,前端就把那个已经半流出去的气泡静默丢掉，用户看到的是它自己消失。\n\n争抢发生在两处。超出 8 个的调用在跑之前就被判成可恢复的 execution_exception,模型下一轮再发一遍即可；剩下的按工具声明的并发档分桶:safe-parallel 各自开一条流,session-serial 排会话锁,global-serial 排进程锁。三类流由 mergeAsync 交错，所以事件到达顺序是「谁先出谁先到」,不是模型写下的顺序——把顺序拼回去是下一步 ⑤ 的活。\n\n锁按单个调用持有，而且因为 runOne 是异步生成器,yield* 会一直持锁到这个工具的最后一个事件被上游消费完：上游处理得慢，锁就多握一会儿。倒计时是一场赛跑——setTimeout 触发 abort,与生成器的下一个事件 race,abort 赢了就落成不可恢复的 timeout;之后清理生成器最多只等 100 毫秒就走人。",
      "en": "One thing about the timing is easy to get backwards: a message bubble does not leave here. It already streamed out during ③, delta by delta through tool_input_delta — so execution is not the moment she starts speaking, it is the moment the sentence is acknowledged: only a Zod-validated call gets a tool.started and a tool.finished. A call that fails validation (an over-long clause, say) never emits tool.started at all, and the frontend silently discards the half-streamed bubble; from the outside it simply vanishes.\n\nContention happens in two places. Calls beyond the eighth are answered with a recoverable execution_exception before anything runs — the model can just re-issue them next round. The rest are bucketed by the concurrency tier each tool declares: safe-parallel calls each open their own stream, session-serial ones queue on the session mutex, global-serial ones on the process-wide mutex. The three kinds are interleaved by mergeAsync, so events arrive in finishing order, not in the order the model wrote them — putting the order back is ⑤ job.\n\nThe lock is held per call, and because runOne is an async generator, yield* keeps holding it until the tool last event has been consumed upstream: a slow consumer means a longer-held lock. The countdown is a race — a setTimeout fires abort, which races the generator next event; if abort wins the call ends as a non-recoverable timeout, and cleanup of the generator then waits at most 100 ms before moving on."
    },
    "contract": {
      "exposes": {
        "zh": "每个被接受的调用一串事件:tool.started(带校验后的输入)→ 若干 tool.progress → 恰好一个 final。",
        "en": "One event stream per accepted call: tool.started (with the validated input), any number of tool.progress, and exactly one final."
      },
      "depends": {
        "zh": "registry 里那件工具声明的 concurrency 与 timeoutMs;session.mutex;模块级的 globalMutex。",
        "en": "The concurrency and timeoutMs each tool declares in the registry; session.mutex; the module-level globalMutex."
      },
      "boundary": {
        "zh": "分发不知道工具在做什么。它只认 Zod 的 input/output 两个 schema,和 progress / ok / err 三种内部事件。",
        "en": "The dispatcher knows nothing about what a tool does. It knows two Zod schemas — input and output — and three internal event kinds: progress, ok, err."
      },
      "invariant": {
        "zh": "一个调用恰好产出一个 final:正常结果、工具自报的 err、超时，或「生成器结束了却没给 final」这条兜底。没有静默消失的调用。",
        "en": "Every call yields exactly one final: a result, a tool-reported err, a timeout, or the fallback for a generator that ended without one. No call disappears quietly."
      }
    },
    "code": {
      "file": "packages/server/src/tools/dispatcher.ts",
      "lines": "72–85",
      "snippet": "  for (const call of calls) {\n    let release: () => void;\n    try {\n      release = await mutex.acquire();\n    } catch {\n      yield finalErr(call, 'aborted', 'lock acquisition aborted', false);\n      continue;\n    }\n    try {\n      yield* runOne(call, ctx, registry);\n    } finally {\n      release();\n    }\n  }",
      "note": {
        "zh": "锁就在这一行争。注意 yield* ——锁不是「调用期间」持有，是「这个调用的事件流被消费完」才放；而 release 在 finally 里，所以工具抛错、超时、上游提前不要了，锁都还得回来。",
        "en": "This is the line where the lock is contended. Note the yield*: the lock is not held for the duration of the call but until the call event stream has been fully consumed. release() sits in a finally, so a throwing tool, a timeout, or an upstream early exit all still give the lock back."
      }
    }
  },
  "append": {
    "claim": {
      "zh": "结果按模型发起的顺序拼回一条 user 消息——不是按完成顺序。拼完的这一刻决定还转不转：两个预算各自能把回合停下，再加一条 is_final 短路，能直接跳过一整次模型往返。",
      "en": "The results are stitched back into a single user message in the order the model issued them — not the order they finished. The instant that is done, this node decides whether to go round again: two budgets can each end the turn, and an is_final short-circuit can skip a whole model round-trip."
    },
    "mechanism": {
      "zh": "顺序是用请求去索引结果的：拿 pendingToolUses 逐个去 toolResultBlocks 里找自己的那块，所以跑得快的工具不会插到前面。对不上的丢掉——这一步是防御性的，正常情况下每个 tool_use 都有块：名字不认识的、被主动安全门拦下的、超出并发上限的，在 ④ 里都已经推了一块错误结果进去。\n\n然后是三道判断，顺序固定。第一道:iteration 加一，到 8 轮(默认值,LUNA_MAX_TOOL_ITERATIONS 可调)就把 finishReason 写成 max_iterations 进 finalize——它数的是轮。第二道只对主动回合：这一轮累计的工具调用数到 8(默认)也停——它数的是调用，不是轮，两把闸管的是两件事。第三道就是短路。\n\n短路要同时满足四件事：不是主动回合、跑在 message 模式、最后一次 message 带 is_final:true、并且这一轮的 tool_use 全是 message(混进一次 web_search 就不行，那个结果必须喂回去)。满足了就直接 finalize——省下的那次往返本来只是让模型再确认一遍「我说完了」,而在那次往返里 activeTurn 还锁着，用户这时发的消息会被 turn_in_progress 弹回，屏幕上却已经是一条看起来说完了的回复。",
      "en": "Order comes from indexing results by request: each pendingToolUse looks up its own block in toolResultBlocks, so a fast tool cannot jump the queue. Anything that fails to match is dropped — a defensive step, since in practice every tool_use has a block: unknown names, calls stopped by the proactive safety gate, and calls past the concurrency cap all had an error block pushed for them back in ④.\n\nThen three checks, in a fixed order. First: iteration goes up by one, and at 8 rounds (the default; LUNA_MAX_TOOL_ITERATIONS overrides it) finishReason becomes max_iterations and the turn goes to finalize — that budget counts rounds. Second, for proactive turns only: once the tool calls accumulated across the turn reach 8 (the default), stop as well — that budget counts calls, not rounds; the two gates guard two different failure modes. Third is the short-circuit.\n\nThe short-circuit needs four things at once: not a proactive turn, message mode, the last message carrying is_final:true, and every tool_use this round being a message (one web_search in the mix disqualifies it — that result has to be fed back). When they hold, the turn goes straight to finalize. The round being skipped would only have had the model re-confirm that it was done — and during it activeTurn is still held, so a message the user sends in that window bounces with turn_in_progress while her already-delivered reply sits on screen looking finished."
    },
    "contract": {
      "exposes": {
        "zh": "往 history 推一条 user 消息(按请求顺序排好的 tool_result 数组),并把下一站定成 build_request(②)或 finalize(⑥)。",
        "en": "Pushes one user message onto history — the tool_result blocks in request order — and picks the next stop: build_request (②) or finalize (⑥)."
      },
      "depends": {
        "zh": "pendingToolUses(顺序的唯一真相)、toolResultBlocks(④ 的产物)、lastMessageIsFinal 与 messageTexts(也来自 ④)。",
        "en": "pendingToolUses (the only source of order), toolResultBlocks (④ output), plus lastMessageIsFinal and messageTexts (also from ④)."
      },
      "boundary": {
        "zh": "它只往 history 里推，从不删。两个预算也不抛错——它们把 finishReason 写成 max_iterations,让 ⑥ 照常收尾。",
        "en": "It only appends to history, never removes. Neither budget throws — they write finishReason = max_iterations and let ⑥ close the turn normally."
      },
      "invariant": {
        "zh": "出这一步只有两条边：回 ② 再来一轮，或进 finalize。没有第三种走法。",
        "en": "Exactly two edges leave this node: back to ② for another round, or on to finalize. There is no third way out."
      }
    },
    "code": {
      "file": "packages/server/src/turn/runTurn.ts",
      "lines": "661–673",
      "snippet": "          const freshIntentRetry =\n            Bun.env['LUNA_INTEGRITY_GUARD'] !== '0' &&\n            !s.correctionUsed.has('intent') &&\n            (() => {\n              const d = detectDefection({\n                messageTexts: s.messageTexts.slice(s.correctionWatermark),\n                lastIsFinal: s.lastMessageIsFinal,\n                thinking: s.thinking,\n                calledToolNames: s.toolNamesThisTurn,\n                finishReason: 'end_turn',\n              });\n              return d.defected && d.kind === 'message_intent';\n            })();",
      "note": {
        "zh": "这就是短路的例外。它先替 ⑥ 把闸预演一遍：如果现在收尾会当场触发一次「说了要做却没做」的全新纠正，就不短路——因为被省掉的恰恰是她本该动手的那一轮，而闸的防误判逻辑要看着那个动作落地。承诺是干净的(绝大多数寒暄式的收尾),就纯赚一次往返。",
        "en": "This is the exception to the short-circuit. It rehearses ⑥ guard: if finalizing right now would trip a fresh said-it-would-act-and-did-not correction, the short-circuit is skipped — because the round being saved is exactly the one where she would have acted, and the guard false-positive protection depends on seeing that action land. When the promise is clean (the common conversational sign-off), the round is pure latency saved."
      }
    },
    "decision": {
      "why": {
        "zh": "她已经说了 is_final:true,那是一句承诺：我说完了。再花一次模型往返去复核这句承诺，买到的只有延迟和一段用户发不出话的窗口。",
        "en": "She already said is_final:true — that is a promise that she is done. Spending a model round-trip to double-check the promise buys only latency and a window in which the user cannot get a word in."
      },
      "rejected": {
        "zh": "无条件相信 is_final。那会让「我去查一下」+ is_final:true 这类刚刚成形的失约永远失去被纠正的机会——纠正本来就发生在被省掉的那一轮里。",
        "en": "Trusting is_final unconditionally. That would let a just-formed defection — I will go look that up, plus is_final:true — escape correction forever, since the correction happens precisely in the round being skipped."
      },
      "cost": {
        "zh": "例外命中时短路失效，那一轮的延迟原样付出。而且例外只看「意图」这一档：承诺档(is_final:false)在这里根本不可能触发，因为进这条分支的前提就是 is_final 为 true。",
        "en": "When the exception fires, the short-circuit is off and that round latency is paid in full. And the exception only watches the intent kind: the promise kind (is_final:false) cannot fire here at all, since reaching this branch requires is_final to be true."
      }
    }
  },
  "gate": {
    "claim": {
      "zh": "轮转全部结束，才轮到闸。两道闸依次问两个问题：她开口了吗；开了口的话，有没有食言。任何一道拦下，都不是抛错——是往 history 里塞一条 user 角色的舞台提示，然后 return build_request:回 ②,再走一遍。",
      "en": "Only when the rounds are over does it become the guards turn. Two of them ask two questions in order: did she speak at all; and if she did, did she break a promise. Neither stops the turn by throwing — each pushes a user-role stage direction into history and returns build_request: back to ②, one more pass."
    },
    "mechanism": {
      "zh": "为什么在这里而不是更早：两道闸判的都是「整轮结束时」才成立的事实——messageTexts 是不是还空着、finishReason 是不是干净的 end_turn。中间任何一轮，她都还可能再开口、再动手，提前判必然误伤。\n\n顺序也是有意的。空回复闸先：她一个字都没说，那就给一条最直白的提示——「你没说话，现在调 message 工具」。主动回合跳过这一道，沉默是它的合法结局。完整性闸后：她说了话且干净地结束了,detectDefection 才去判她有没有食言。它有三档，只有前两档能驱动重来——结构档(最后一条气泡标了 is_final:false,却把回合停了，这是机械确定的，不查词典)和文本档(气泡里承诺了要做某事，而这一轮除了 message 没调过任何工具)。第三档只从 thinking 里读，是被总结过的低置信内容，永远只进审计、绝不重来。\n\n每一种原因一生只用一次:correctionUsed 里各占一个键('empty'、'promise'、'intent')。同一个原因第二次成立，不再回，而是降级并留一条 degraded 的 trace——闸宁可放过，也不打转。\n\n回的是 ②,不是 ③,这一点值得说清：回 ② 走的是 build_request,它只在工具 schema 还没转过时转一次，然后进 open_stream;真正被重算的是 open_stream 里的 buildActiveContext——刚推进去的那条舞台提示，正是靠这一步进入下一次请求。它不回 ①:召回、感知、窗口都不重建，用户那条消息也不重新解析。所以一次纠正的账单就是一整次模型往返，仅此而已。\n\n还有一条约束定了提示词的写法：气泡在 ③ 就流出去了。纠正只能「接着说」,不能撤回——所以两条提示都写成继续或跟上，而不是改口。意图那一条更给了双出口(能做就现在做；真做不到就自然地继续),因为意图检测本来就是启发式，一次假阳性只该值一次温和的再提示，而不是一次强行的自我否定。",
      "en": "Why here and not earlier: both guards judge facts that only hold once the rounds are done — whether messageTexts is still empty, whether finishReason is a clean end_turn. In any intermediate round she might still speak or still act, so judging early would mean judging wrong.\n\nThe order is deliberate too. The empty-reply guard comes first: she said nothing, so it hands her the bluntest possible direction — you ended without speaking, call the message tool now. Proactive turns skip this one; silence is a legitimate outcome for them. The integrity guard comes second: only once she has spoken and ended cleanly does detectDefection ask whether she broke a promise. It has three tiers, and only the first two can drive a retry — the structural one (the last bubble was marked is_final:false and yet the turn stopped: mechanically certain, no dictionary needed) and the message-text one (a delivered bubble promised an act, and no tool other than message ran this turn). The third reads only her thinking, which is summarized and therefore low-confidence: counted in the audit, never a retry.\n\nEach reason is spent once per turn: correctionUsed holds one key each — empty, promise, intent. A second occurrence of the same reason does not loop back; it degrades and leaves a degraded trace instead. The guard would rather let one through than spin.\n\nThat it returns to ② rather than ③ is worth being exact about: ② is build_request, which converts the tool schemas only if they have not been converted yet and then goes on to open_stream. What actually gets recomputed is buildActiveContext inside open_stream — and that is precisely how the stage direction just pushed enters the next request. It does not go back to ①: recall, perception and the window are not rebuilt, and the user message is not re-parsed. So one correction costs exactly one model round-trip, and nothing else.\n\nOne more constraint shapes the wording of the directives: the bubbles left during ③. A correction can only continue, never retract — so both directives are written as follow through or carry on, never as take it back. The intent one even offers a double exit (act now if you can; if you genuinely cannot, simply continue), because intent detection is a heuristic and a false positive should cost one gentle re-prompt, not a forced walk-back."
    },
    "contract": {
      "exposes": {
        "zh": "两条回边，都指向 build_request(②);正常放行时发出 turn.result 并结束。",
        "en": "Two return edges, both pointing at build_request (②); when everything passes it emits turn.result and ends."
      },
      "depends": {
        "zh": "detectDefection(纯函数，与旁路审计共用同一份实现)、correctionUsed(每种原因一次)、correctionWatermark(只判纠正之后新说的那些气泡)。",
        "en": "detectDefection (a pure function, the same implementation the side-channel audit uses), correctionUsed (once per reason), correctionWatermark (judge only the bubbles delivered since the last correction)."
      },
      "boundary": {
        "zh": "thinking 那一档只进审计，永远不驱动重试；主动回合的沉默从不算失败。",
        "en": "The thinking tier is audit-only and never drives a retry; a silent proactive turn is never counted as a failure."
      },
      "invariant": {
        "zh": "每种原因至多纠正一次；第二次成立就降级。所以一个回合最多多跑三次往返，不会因为闸而不终止。",
        "en": "At most one correction per reason; a second occurrence degrades. A turn therefore costs at most three extra round-trips, and the guards can never make it non-terminating."
      }
    },
    "code": {
      "file": "packages/server/src/turn/runTurn.ts",
      "lines": "706–715",
      "snippet": "      if (\n        !s.proactiveTurn &&\n        s.messageTexts.length === 0 &&\n        s.finishReason === 'end_turn' &&\n        !s.correctionUsed.has('empty')\n      ) {\n        s.correctionUsed.add('empty');\n        pushDirective(s, SILENT_TURN_DIRECTIVE);\n        return 'build_request';\n      }",
      "note": {
        "zh": "四个条件全是「整轮」的事实——这正是它必须等到这一刻的原因。最后一行是那条回边:return build_request,不是 open_stream,更不是 parse_input。",
        "en": "All four conditions are whole-turn facts — which is exactly why this has to wait until now. The last line is the return edge itself: build_request, not open_stream, and certainly not parse_input."
      }
    },
    "decision": {
      "why": {
        "zh": "把「她这一轮没说话」变成一次可恢复的重来，而不是一个空回复。用户看到的应该是慢了一拍的一句话，不是一片沉默。",
        "en": "Turn she did not speak this turn into a recoverable retry instead of an empty reply. What the user should see is a sentence a beat late, not silence."
      },
      "rejected": {
        "zh": "把纠正写成 system 角色。代码里点名了这条：纠正必须是 user 角色的舞台提示(Python v0.27.1 的 hoisting 教训),绝不进系统块。",
        "en": "Writing the correction as a system-role message. The code names this explicitly: a correction is a user-role stage direction, never system (the Python v0.27.1 hoisting lesson)."
      },
      "cost": {
        "zh": "每次纠正都是一整次模型往返；而且这些舞台提示是以 user 身份进 history 的——它们必须在落库前被摘掉，否则以后每一轮的窗口都会重读一段用户从没说过的训话。摘除逻辑在 ⑦。",
        "en": "Every correction is a full model round-trip; and these stage directions enter history wearing the user role — so they have to be removed before the turn becomes durable, or every later turn window would re-read a scolding the user never wrote. That removal happens in ⑦."
      }
    }
  },
  "reply": {
    "claim": {
      "zh": "turn.result 发出的这一刻，用户其实早就把这句话看完了——气泡在 ③ 的流里就一个字一个字出去了。这条事件不是交付，是收尾：文本的权威版本、这一轮用过的网页来源、以及「回合结束」这个信号本身。",
      "en": "By the time turn.result goes out, the user has long since finished reading the reply — the bubbles streamed out character by character back in ③. This event is not delivery; it is closure: the canonical text, the web sources used this turn, and the end-of-turn signal itself."
    },
    "mechanism": {
      "zh": "text 从哪来，是这一步最容易看错的地方。事件里写的是 s.text,但 finalize 在发出前刚刚把 s.text 整个覆盖掉了:message 模式下它等于 messageTexts.join('\\n')——一行一个气泡，来源是 message 工具真正投递过的那些字。流式过程中累积进 s.text 的顶层文本(模型在工具外面自言自语的那部分)到这一刻被丢弃，只留在 history 和 trace 里当作泄漏信号。唯一的例外是双次沉默的降级路径:messageTexts 是空的，那段泄漏文本原样成为回复，并被记一条 empty_turn,让这次失败是可数的。\n\n引用是在 ④ 顺手收的:web_search 结果里的 url、web_fetch 的 final_url,在工具的 final 事件里就被收进 citations,这里去重挂上；一条来源都没有时整个字段不出现，而不是发一个空数组。\n\n前端拿到它做三件事：把来源渲染成可点的 chip(url 走 href,不拼进标签文字);只有 text 模式才用它 finalize 那个合成气泡——message 模式的气泡在各自的 tool.finished 时就已经定稿了；然后清空回合状态、打字点收起、Live2D 回 neutral。\n\n还有一条不对称：主动回合根本不发 turn.result。它走 proactive.finished,所以前端必须在那条分支里再清一次状态，否则她主动说完话之后打字点会永远悬着。",
      "en": "Where the text comes from is the easiest thing here to get wrong. The event field reads s.text — but finalize has just overwritten s.text wholesale: in message mode it is messageTexts.join(newline), one line per bubble, sourced from what the message tool actually delivered. The top-level text accumulated into s.text during streaming — the model narrating outside the tool — is discarded at this moment and survives only in history and traces, as the observable leak signal. The one exception is the double-silent degraded path: messageTexts is empty, so the leaked text becomes the reply as-is and an empty_turn trace is written, which is what makes that failure countable.\n\nCitations were gathered back in ④: web_search result urls and the web_fetch final_url are collected off the tool final event, then deduped and attached here. With no sources at all the field is omitted entirely rather than sent as an empty array.\n\nThe frontend does three things with it: renders the sources as clickable chips (the url rides as an href, never baked into the label text); finalizes the synthetic bubble only in text mode — message-mode bubbles were each finalized at their own tool.finished; then clears turn state, drops the typing dots and returns Live2D to neutral.\n\nOne asymmetry: a proactive turn emits no turn.result at all. It ends with proactive.finished, so the frontend has to clear state on that branch too — otherwise the typing dots would hang forever after she speaks unprompted."
    },
    "contract": {
      "exposes": {
        "zh": "turn.result { turn_id, text, finish_reason, usage, citations? } —— 一个反应式回合恰好一条。",
        "en": "turn.result { turn_id, text, finish_reason, usage, citations? } — exactly one per reactive turn."
      },
      "depends": {
        "zh": "messageTexts 与 citations(都在 ④ 收集)、finishReason(由 ⑤ 或 ⑥ 写定)。",
        "en": "messageTexts and citations (both gathered in ④), and finishReason (written by ⑤ or ⑥)."
      },
      "boundary": {
        "zh": "它不负责把话送到用户面前——那件事在 tool.progress / tool.finished 就做完了。它是这一轮的权威记录，以及前端收拾状态的触发器。",
        "en": "It is not what puts the words in front of the user — tool.progress and tool.finished already did that. It is the authoritative record of the turn, and the trigger for the frontend to tidy up."
      },
      "invariant": {
        "zh": "反应式回合一条，主动回合零条。前端两条路径都必须能收干净状态。",
        "en": "One per reactive turn, zero per proactive turn — so the frontend has to be able to clean up on both paths."
      }
    },
    "code": {
      "file": "packages/server/src/turn/runTurn.ts",
      "lines": "752–757",
      "snippet": "      // The turn's text is what was actually delivered through the message\n      // tool (one line per bubble). Stray top-level text stays in history and\n      // traces — the observable leak signal — but never becomes the reply\n      // unless the degraded fallback below fires.\n      if (s.messageTexts.length > 0) {\n        s.text = s.messageTexts.join('\\n');",
      "note": {
        "zh": "这六行就是「turn.result 的 text 不是流式文本」的全部原因。发出去的字段确实叫 s.text,但它在这一刻已经被 message 工具投递过的内容整个换掉了。",
        "en": "These six lines are the whole reason turn.result text is not the streamed text. The field emitted really is s.text — but by this moment it has been replaced wholesale by what the message tool delivered."
      }
    }
  },
  "persist": {
    "claim": {
      "zh": "这一步不在状态图上——它在 finally 里。不管前面是干净收尾、抛了错、还是被客户端断线 abort 掉，它都会走一遍。而它做的第一件事是问一个问题：这一轮到底说出话了没有。答案是「没有」,这一轮就整个不存在。",
      "en": "This step is not in the graph — it lives in the finally. It runs whether the turn ended cleanly, threw, or was aborted by a client disconnect. And the first thing it does is ask one question: did this turn actually say anything. If the answer is no, the turn ceases to have happened at all."
    },
    "mechanism": {
      "zh": "finally 里的顺序是固定的：先放开 activeTurn、turnSeq 加一，再进真回复关口 → 剥 thinking → 摘纠正指令 → appendL2 → persistSession → 旁路审计 → flushTrace → 最后把折叠踢出去(不等)。\n\n真回复关口就是那一行 realReply:message 模式下取 messageTexts.join('\\n').trim(),text 模式下取 state.text.trim()。非空，这一轮才配落库。\n\n非空那一支还顺手做了一件不显眼的事:markActivity。这是每一种会说话的回合——反应、续说、主动——都必经的唯一一个点，所以沉默计时是从她最后一句话开始算的，不是从用户那条消息。空回合走另一支，不打这个点：它什么都没说。\n\n落库前有两次清洗。剥 thinking 只对这一轮(historyStart 之后)做，而且只能在回合结束后做——在飞的签名 thinking 被改会直接 400。摘纠正指令是另一回事:⑥ 推进去的那些 user 角色舞台提示按引用记在 directiveMessages 里，这里从 history 里删掉，再把因此相邻的同角色消息合并回合法的交替。这一步跟 LUNA_CLEAN_HISTORY 无关——它是正确性，不是省 token。\n\nappendL2 里有两处替换。主动回合的 user_text 存空字符串：它的「用户消息」其实是内部舞台提示，原样存进去会在聊天记录里长出一个幽灵用户气泡。assistant_text 存 realReply 而不是 state.text——因为一个出错或短路的回合上 finalize 根本没跑过，那时 state.text 里还是那段顶层泄漏。\n\n空回合那一支只有两行，却是整个回滚:session.history.length = historyStart,内存历史整段砍回回合开始之前，连那条用户消息一起——不然一次重试会让它在窗口里出现两遍。然后把这一轮烧掉的整首歌词额度还回去。\n\n整个持久化块包在自己的 try 里:SQLite 抛错(锁死、只读、磁盘满)只记日志加发一条 persistence_failed,绝不吃掉后面的审计、trace flush 和折叠。\n\n这条关口历史上修过三件事，都写在代码注释里：一，空 assistant 行会毒化召回和重建出来的窗口(「你说了 X,我什么都没说」),而且 A3 之后它每次重载都还在——这就是 401 断供期间她看起来失忆的原因。二，错误或短路的回合上 state.text 里那段顶层泄漏被当成可见回复存了下去。三,v0.45.17:回滚把歌词块带走了，但「已送达」的标记还留着——那首歌的词既不在提示里也不在过去里，而「她读过这首歌」是假的；回滚现在是对称的。",
      "en": "The order inside the finally is fixed: release activeTurn and bump turnSeq, then the real-reply gate, strip thinking, strip the corrective directives, appendL2, persistSession, the side-channel audit, flushTrace, and finally kick the fold off without waiting for it.\n\nThe real-reply gate is that one realReply line: messageTexts.join(newline).trim() in message mode, state.text.trim() in text mode. Only a non-empty value earns durability.\n\nThe non-empty branch also does something quiet: markActivity. This is the single choke point every reply-producing turn passes — reactive, continuation, proactive — so the silence clock counts from her last word, not from the user earlier message. An empty turn falls to the other branch and does not mark activity: it said nothing.\n\nTwo cleanups happen before the write. Stripping thinking touches only this turn (everything after historyStart) and can only happen once the turn is over — editing in-flight signed thinking is a straight 400. Stripping the corrective directives is a different job: the user-role stage directions pushed in ⑥ are tracked by reference in directiveMessages, removed from history here, and the same-role messages left adjacent are coalesced back into valid alternation. This one is independent of LUNA_CLEAN_HISTORY — it is correctness, not the token diet.\n\nappendL2 makes two substitutions. A proactive turn stores an empty user_text: its user message is really an internal stage direction, and storing it verbatim grew a phantom user bubble in the chat log. And assistant_text stores realReply rather than state.text — because on an errored or short-circuited turn finalize never ran, and state.text still holds the top-level leak.\n\nThe empty branch is two lines and a whole rollback: session.history.length = historyStart cuts the in-memory history back to before the turn began, the user message included — otherwise a retry would double it up in the window. Then the one-shot lyrics delivery this turn burned is handed back.\n\nThe whole persistence block sits in its own try: a SQLite throw (locked, readonly, disk full) is logged and surfaced as persistence_failed, and never swallows the audit, the trace flush or the fold that follow.\n\nThree fixes are recorded in the comments around this gate. One: an empty assistant row poisons recall and the rebuilt window (you said X, I said nothing), and post-A3 it survives every reload — this is what made Luna look amnesiac through a 401 outage. Two: on errored or short-circuited turns the top-level leak in state.text was being persisted as the visible reply. Three, v0.45.17: the rollback took the lyrics block with it but left the delivered mark set — the words were in neither the prompt nor the past, and she read this song was simply false. The rollback is symmetric now."
    },
    "contract": {
      "exposes": {
        "zh": "成功时:l2_turns 一行(user_text / assistant_text / raw_json / 内容哈希)加一次会话快照。失败时：一条 persistence_failed 事件。",
        "en": "On success: one l2_turns row (user_text, assistant_text, raw_json, content hash) plus a session snapshot. On failure: one persistence_failed event."
      },
      "depends": {
        "zh": "historyStart(进 try 之前记下的历史长度)、directiveMessages、lyricsBurnedFor —— 三件都是回合开始时就备好的回滚凭据。",
        "en": "historyStart (the history length recorded before the try), directiveMessages, and lyricsBurnedFor — three pieces of rollback bookkeeping set up when the turn began."
      },
      "boundary": {
        "zh": "它只看 realReply,不看 finishReason。一个以 error 收尾但已经说过话的回合照样留下——那些字用户已经看见了。",
        "en": "It looks at realReply, not at finishReason. A turn that errored after delivering messages is still kept — the user already saw those words."
      },
      "invariant": {
        "zh": "说过话 ⇔ 有一行 L2;没说过话 ⇔ 内存历史与歌词额度都回到回合开始之前。没有中间态。",
        "en": "Spoke if and only if there is an L2 row; said nothing if and only if both the in-memory history and the lyrics quota are back to where the turn started. No middle state."
      }
    },
    "code": {
      "file": "packages/server/src/turn/runTurn.ts",
      "lines": "1070–1075",
      "snippet": "      } else {\n        opts.session.history.length = historyStart;\n        // v0.45.17: the lyrics block just went with it — hand the delivery back so the next\n        // turn can carry the words she never actually received.\n        if (state.lyricsBurnedFor !== null) unmarkLyricsDelivered(state.lyricsBurnedFor);\n      }",
      "note": {
        "zh": "一整轮回滚就这两条语句。第一条抹掉这一轮所有的内存历史(含用户那条消息);第二条把这一轮消耗掉的一次性歌词投递还回去——因为承载它的那段历史刚刚被抹了，标记不还,「她读过这首歌」就成了假话。",
        "en": "A whole-turn rollback in two statements. The first erases every message this turn added to the in-memory history, the user message included; the second returns the one-shot lyrics delivery it consumed — because the history that carried it has just been erased, and leaving the mark set would make she read this song a lie."
      }
    },
    "decision": {
      "why": {
        "zh": "宁可丢掉一整轮，也不留一行空的。一行空 assistant 会同时污染两处：召回排序，和从 L2 重建出来的窗口——而且它会一直在。",
        "en": "Better to lose a whole turn than to leave one empty row. An empty assistant row poisons two things at once — recall ranking, and the window rebuilt from L2 — and it stays."
      },
      "rejected": {
        "zh": "为了时间线连续而存一行空 assistant。那正是断供期间「她好像失忆了」的成因：每次重载都把那段空白重新读回来。",
        "en": "Storing an empty assistant row to keep the timeline contiguous. That is exactly what produced the she seems amnesiac behavior during an outage: every reload read the blank back in."
      },
      "cost": {
        "zh": "回滚是内存与 L2 的，不是屏幕上的。用户可能已经看见过一段半流出的预览——前端在 error 分支里会把那些气泡 discard 掉，但它确实短暂存在过。",
        "en": "The rollback covers memory and L2, not the screen. The user may have seen a half-streamed preview — the frontend discards those bubbles on its error branch, but they did briefly exist."
      }
    }
  },
  "after": {
    "claim": {
      "zh": "落库不是终点。同一个 finally 的最后一行把 L1 折叠踢出去就不再管它——那是一整次模型调用，不该挂在这条线上。梦更不是这条线的下一步：它是另一台状态机、另一把 key、另一个触发器。",
      "en": "Persisting is not the end. The last line of the same finally kicks the L1 fold out and stops caring — it is a whole model call, and it does not belong on this line. The dream is not the next step on this line at all: another state machine, another key, another trigger."
    },
    "mechanism": {
      "zh": "那个 void 不是装饰。它是「我知道这是个 Promise,而且我故意不等它」的显式记号——去掉它，这一行就变成一个没人管的 Promise,读代码的人分不清是忘了 await 还是有意为之。后面挂的 .catch 干的是另一件事：让它被拒绝时不成为未处理的拒绝。两个记号各管一头，缺一不可。\n\n为什么必须是不等：折叠本身是一整次模型往返(压缩器 prompt,maxTokens 1024)。反应式路径上 ws.ts 用的是 void runTurn(...),本来就没人等；但主动路径是 await runTurn(...),而且整个主动回合跑在主动锁里面——真去 await 折叠，那把锁就要多握住一次压缩往返。\n\n折叠这一刻在算什么:planFold 按 L2 的整轮切，只有「未折叠轮数 > 保留轮数 + 一批」才动手(默认保留 100 轮、一批 10 轮),边界永远落在轮起点，绝不切开 tool_use / tool_result 对。压缩器拿到「当前摘要 + 这批旧对话」重新推导一份带硬上限的摘要(默认 3000 字符),重要度 ≥ 4 的轮被标成 [salient],细节要原样保住。空摘要不写——那会悄悄缩掉活动上下文，留到下次再折。提交是带期望值的：低水位还是折叠开始时那个值才落，所以两条路径撞上也不会互相盖掉。\n\n梦怎么开始：三个触发器——shutdown(退出路径)、manual(菜单里的 dream.enter)、self(她自己在主动回合里调 enter_dream 之后的交接)。enterDream() 是同步的门，在第一个 await 之前就设好，所以并发的调用者不会重叠成两场梦。\n\n梦跑的是同一套 runGraph,八个节点按固定顺序:rate_salience → refine_semantic → refine_layer1 → memory_audit → persona_update → run_diaries → distill_skills → rag_refresh。每一步自己 try/catch,失败只留一条 dream.step,不打断后面的步；每步跑完立刻 flushTrace,中途崩了也不丢已完成的那些。\n\n另一把 key 在 dreamCall 里：两次尝试的级联，先走 summarizer key 那个 provider(梦的活不跟主回复抢配额),空文本或异常才落回默认 provider。而 refine_layer1 调的就是同一个 maybeFold——同一段折叠逻辑，两个入口：回合的尾巴，和梦的第三步。",
      "en": "That void is not decoration. It is the explicit marker for I know this is a Promise and I am deliberately not awaiting it — without it the line is just an unattended Promise, and a reader cannot tell a missing await from an intentional one. The .catch after it does a different job: it keeps a rejection from becoming an unhandled rejection. Two markers, one each, and neither is redundant.\n\nWhy it has to be un-awaited: the fold is itself a full model round-trip (a compressor prompt, maxTokens 1024). On the reactive path ws.ts already calls void runTurn(...), so nobody is waiting; but the proactive path does await runTurn(...), and the whole proactive turn runs inside the proactive lock — awaiting the fold there would hold that lock across an extra compression round-trip.\n\nWhat the fold is computing at that moment: planFold cuts on whole L2 turns and only acts when unfolded turns exceed the kept window by a batch (100 turns kept, 10 per batch, by default), with the boundary always landing on a turn start so a tool_use / tool_result pair is never split. The compressor gets the current digest plus the batch of older exchanges and re-derives a hard-capped digest (3000 characters by default), with turns rated 4 or above marked [salient] so their specifics survive. An empty digest is never written — that would silently shrink the active context; it waits for the next fold. The commit is compare-and-set: it lands only if the low-water mark is still what it was when the fold began, so the two entry points cannot overwrite each other.\n\nHow the dream starts: three triggers — shutdown (the exit path), manual (dream.enter from the menu), and self (the handoff after she calls enter_dream inside a proactive turn). enterDream() is a synchronous gate set before the first await, so concurrent callers cannot overlap into two dreams.\n\nThe dream runs the same runGraph with eight nodes in a fixed order: rate_salience, refine_semantic, refine_layer1, memory_audit, persona_update, run_diaries, distill_skills, rag_refresh. Each step try/catches itself — a failure leaves one dream.step and does not stop the ones after it — and flushes traces the moment it ends, so a crash mid-cycle does not lose the completed steps.\n\nThe other key lives in dreamCall: a two-attempt cascade that tries the summarizer-key provider first, so dream work never competes with the main reply key quota, and falls back to the default provider only on empty text or an exception. And refine_layer1 calls the very same maybeFold — one fold implementation, two entry points: the tail of a turn, and the third step of a dream."
    },
    "contract": {
      "exposes": {
        "zh": "对这条时间线什么都不返回。折叠的成果落在 rolling_summary 与 window_low_water 上，梦的成果落在 L2 的重要度、L3 事实、灵魂的演化段、日记、技能货架和向量缓存上。",
        "en": "Nothing at all is returned to this timeline. The fold result lands in rolling_summary and window_low_water; the dream results land in L2 importance, L3 facts, the evolving half of the soul, the diaries, the skill shelf and the embedding cache."
      },
      "depends": {
        "zh": "折叠依赖 session 与 provider,以及 L2 的逐字列；梦依赖它自己那对 provider 和 embed 客户端。",
        "en": "The fold depends on the session, a provider, and the verbatim L2 columns; the dream depends on its own provider pair and an embed client."
      },
      "boundary": {
        "zh": "折叠只读 L2 的逐字内容，从不拿上一版摘要当输入源；梦只写灵魂的演化段——没有任何代码路径通向那份固定核心。",
        "en": "The fold reads only verbatim L2 content and never takes a prior summary as its source; the dream writes only the evolving section of the soul — there is no code path from it to the fixed core."
      },
      "invariant": {
        "zh": "折叠失败，逐字历史原样留着；摘要为空就不提交。梦的每一步失败都被隔离，不影响后面的步。",
        "en": "A failed fold leaves the verbatim history intact, and an empty digest is never committed. Each dream step failure is isolated and does not affect the steps after it."
      }
    },
    "code": {
      "file": "packages/server/src/turn/runTurn.ts",
      "lines": "1118–1120",
      "snippet": "    void maybeFold(opts.session, opts.provider).catch(() => {\n      /* fold is best-effort; a failed fold leaves verbatim history intact */\n    });",
      "note": {
        "zh": "finally 的最后一行，也是整条时间线的最后一行。void 说明「不等」,.catch 说明「拒绝了也不炸」——一个回合到此为止，而折叠自己往下跑。",
        "en": "The last line of the finally, and the last line of the whole timeline. void says it is not awaited, .catch says a rejection will not blow up — the turn ends here, and the fold runs on by itself."
      }
    },
    "decision": {
      "why": {
        "zh": "把一次模型调用挪出热路径。折叠不影响这一轮的任何观感——回复早就发了、库也已经落了——所以它没有理由让任何人等。",
        "en": "Move a model call off the hot path. The fold changes nothing about how this turn reads — the reply went out long ago and the row is already written — so there is no reason for anyone to wait on it."
      },
      "rejected": {
        "zh": "在回合里同步折叠。那会把一次压缩往返记在回合的账上，并且在主动路径上多握一次主动锁。",
        "en": "Folding synchronously inside the turn. That would bill a compression round-trip to the turn, and on the proactive path hold the proactive lock across it."
      },
      "cost": {
        "zh": "折叠可能滞后。所以窗口另有一道硬剪兜底(默认 300 条消息 / 12 万字符，只在轮起点下刀，并且会打日志说「折叠滞后了」)——那是安全网，不是计划。",
        "en": "The fold can fall behind. So the window carries a hard trim as a backstop — 300 messages and 120,000 characters by default, cutting only at turn starts and logging that folding is lagging. That is a safety net, not the plan."
      }
    }
  },
};
