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
};
