/* ═══════════════════════════════════════════════════════════════
   Luna · 工程图谱 —— 内容层（唯一需要改文案的文件）

   主题：agent harness —— 调用 LLM 的那一层基础设施。
   前五支（上下文 / 循环 / 工具 / 控制 / 状态）沿用通行分解；
   第六支「时钟」是本项目特有的：除请求驱动之外，还有一个
   服务端定时器可以发起回合。

   分级展开（C4 的做法）：
     L1  一屏：黑盒 + harness + 六个支名
     L2  点开一支：这一支的真实构件 + 行业维度词
     L3  点开一个构件：五页同构详页

   布局不写死坐标 —— 树随展开重新排版，由 app.js 计算。
   ═══════════════════════════════════════════════════════════════ */

window.LUNA_MAP = (function () {
  return {
    /* 界面固定文案（data-i18n 取用） */
    ui: {
      tagline: { zh: 'agent harness · 上下文 / 循环 / 工具 / 控制 / 状态 / 时钟', en: 'agent harness · context / loop / tools / control / state / clock' },
      navTree: { zh: '结构', en: 'Structure' },
      navFlow: { zh: '时序', en: 'Sequence' },
      navStory: { zh: '开发故事 →', en: 'Dev stories →' }, /* TODO: story/ 仍是占位稿，未定稿前不要挂在顶栏 */
      reopen: { zh: '重看扉页', en: 'Cover' },
      flip: { zh: '进入图谱 →', en: 'Open the map →' },
      fig1no: { zh: '图一', en: 'Fig. 1' },
      fig1title: { zh: '结构 · 系统由哪些构件组成', en: 'Structure · what the system is made of' },
      fig1lede: {
        zh: '两个根节点：LLM 是外部服务，没有详页；Agent system 向下展开成六支。叶子是构件，点开是它的详页。',
        en: 'Two root nodes: the LLM is an external service and has no detail page; the agent system fans out into six branches. Leaves are components, and each opens its own page.',
      },
      fig2no: { zh: '图二', en: 'Fig. 2' },
      fig2title: { zh: '时序 · 一条消息的处理路径', en: 'Sequence · how one message is processed' },
      fig2lede: {
        zh: '五条泳道：一条用户消息从进入到落库的完整路径，含两条回边。泳道名和每个步骤同样可以点开。',
        en: 'Five lanes: one user message from arrival to persistence, including two return edges. Lane names and steps open too.',
      },
    },

    prologue: {
      eyebrow: { zh: '扉页', en: 'Cover' },
      heading: { zh: 'Luna · 工程图谱', en: 'Luna<br>an engineering map' },
      sub: {
        zh: 'TypeScript 单仓，5 个包，约 3.5 万行生产代码与 190 个测试文件（v0.45.18）',
        en: 'A TypeScript monorepo — 5 packages, ~35k lines of production code, 190 test files (v0.45.18).',
      },
      lead: {
        zh: '模型本身是外部服务，不在图上。图上是调用它的那一层：上下文怎么装配、工具循环怎么组织、无人值守时由什么约束它、状态存在哪里。',
        en: 'The model itself is an external service and is not on the map. What is on the map is the layer that calls it: how context is assembled, how the tool loop is organised, what constrains it when nobody is watching, and where state lives.',
      },
      cards: [
        {
          title: { zh: '怎么读', en: 'How to read it' },
          body: {
            zh: '两张图：结构（有哪些构件）与时序（一条消息经过哪些步骤）。带虚下划线的节点可以点开，每件一页，分主张 / 机制 / 契约 / 代码 / 决策五屏。',
            en: 'Two figures: structure (what the parts are) and sequence (what one message goes through). Any dashed-underlined node opens a component page of five slides: claim, mechanism, contract, code, decision.',
          },
        },
        {
          title: { zh: '六支怎么分的', en: 'How the six are divided' },
          body: {
            zh: '前五支（上下文 · 循环 · 工具 · 控制 · 状态）沿用 agent harness 的通行分解。第六支「时钟」是本项目特有的：除了请求驱动，还有一个 60 秒的服务端定时器可以发起回合。',
            en: 'Five (context · loop · tools · control · state) follow the common harness decomposition. The sixth — the clock — is specific to this project: besides request-driven turns, a 60-second server-side timer can start one.',
          },
        },
      ],
      tail: {
        zh: '每个构件页附一段来自仓库的代码，逐行核对过。',
        en: 'Every component page carries a verbatim excerpt from the repository, checked line by line.',
      },
    },

    /* 数字口径写在明面上。改图或改代码之后，这一段要跟着核。 */
    footnote: {
      zh: '计数口径：工具数 28 = packages/protocol/src/tools.ts 中 ToolName 枚举的成员数。构件详页 47 个 = 31 个结构构件 + 5 条泳道 + 11 个时序步骤（「推理」那一步没有详页，它不是本仓库的代码）。每页附一段逐字代码片段并配一张机制图，代码片段已与当前提交逐行比对。仓库：v0.45.18，5 个包。',
      en: 'How things are counted: 28 tools = members of the ToolName enum in packages/protocol/src/tools.ts. 47 component pages = 31 structural components + 5 lanes + 11 sequence steps (the inference step has no page — it is not this repository\'s code). Each page carries a verbatim code excerpt and a mechanism figure, checked line by line against the current commit. Repository: v0.45.18, 5 packages.',
    },

    root: {
      llm: { label: 'LLM', sub: { zh: '外部服务 · 内部不可见 · 按 token 计费', en: 'external service · internals not visible · billed by token' } },
      agent: { label: 'Agent system', sub: { zh: '调用模型的那一层 —— 本仓库的代码', en: 'the layer that calls it — this repository' } },
      inLabel: 'IN',
      inSub: { zh: '上下文 + 工具 schema', en: 'context + tool schemas' },
      outLabel: 'OUT',
      outSub: { zh: '文字 · 思考 · 工具调用', en: 'text · thinking · tool calls' },
      aside: { zh: '整棵树只有 LLM 没有详页：它不是本仓库的代码。', en: 'The LLM is the only node without a detail page: it is not this repository\'s code.' },
    },

    branches: [
      { id: 'ctx', name: { zh: '上下文', en: 'Context' }, en: 'context management',
        dim: 'CONTEXT ENGINEERING · RAG · VECTOR DB',
        gist: { zh: '决定每次请求发送哪些内容', en: 'what goes into each request' },
        leaves: [
          { id: 'cached', label: { zh: '缓存前缀', en: 'cached prefix' } },
          { id: 'tail', label: { zh: '未缓存尾部', en: 'uncached tail' } },
          { id: 'bp', label: { zh: 'cache_control 断点', en: 'cache_control breakpoint' } },
          { id: 'recall', label: { zh: '混合召回', en: 'hybrid recall' } },
          { id: 'perceive', label: { zh: '感知注入', en: 'perception' } },
          { id: 'burn', label: { zh: '阅后即焚', en: 'read-once-burn' } },
        ] },
      { id: 'loop', name: { zh: '循环', en: 'Loop' }, en: 'agent loop',
        dim: 'AI WORKFLOWS · AGENT',
        gist: { zh: '推理 → 工具 → 结果回灌，至多 8 轮', en: 'reason → tools → results, up to 8 rounds' },
        leaves: [
          { id: 'graph', label: { zh: '六节点状态图', en: 'six-node graph' } },
          { id: 'edge1', label: { zh: '回边 ①', en: 'return edge ①' } },
          { id: 'edge2', label: { zh: '回边 ②', en: 'return edge ②' } },
          { id: 'budget', label: { zh: '两个预算', en: 'two budgets' } },
          { id: 'shortcut', label: { zh: 'is_final 短路', en: 'is_final short-circuit' } },
        ] },
      { id: 'tools', name: { zh: '工具', en: 'Tools' }, en: 'tool interface',
        dim: 'TOOL USE · FUNCTION CALLING',
        gist: { zh: '28 个工具的定义、并发与调度', en: '28 tools: definition, concurrency, dispatch' },
        leaves: [
          { id: 'count', label: { zh: '工具总数', en: 'the tool surface' } },
          { id: 'speak', label: { zh: '说话也是工具调用', en: 'speaking is a tool call' } },
          { id: 'concur', label: { zh: '三档并发', en: 'three concurrency tiers' } },
          { id: 'stream', label: { zh: '流式吐出', en: 'streamed tool input' } },
          { id: 'result', label: { zh: '结果回填', en: 'result append' } },
        ] },
      { id: 'guard', name: { zh: '控制', en: 'Control' }, en: 'control mechanisms',
        dim: 'GUARDRAILS · OBSERVABILITY',
        gist: { zh: '能力门、安全闸、护栏与审计轨', en: 'capability gates, safety gates, guardrails, audit trail' },
        leaves: [
          { id: 'capgate', label: { zh: '能力门', en: 'capability gates' } },
          { id: 'proactgate', label: { zh: '主动安全门', en: 'proactive safety gate' } },
          { id: 'integrity', label: { zh: '完整性闸', en: 'integrity guards' } },
          { id: 'net', label: { zh: '网络护栏', en: 'network guardrails' } },
          { id: 'dangling', label: { zh: '悬空 tool_use 清理', en: 'dangling tool_use' } },
          { id: 'trace', label: { zh: '全程落 trace', en: 'the ledger' } },
        ] },
      { id: 'state', name: { zh: '状态', en: 'State' }, en: 'state persistence',
        dim: 'MEMORY · COST OPTIMIZATION',
        gist: { zh: '四层记忆，一个 SQLite 文件', en: 'four memory layers, one SQLite file' },
        leaves: [
          { id: 'realreply', label: { zh: '真回复关口', en: 'the real-reply gate' } },
          { id: 'fold', label: { zh: 'L1 折叠', en: 'L1 fold' } },
          { id: 'layers', label: { zh: 'L2 / L3 / 灵魂', en: 'L2 / L3 / soul' } },
          { id: 'dream', label: { zh: '梦', en: 'the dream' } },
          { id: 'sqlite', label: { zh: 'SQLite', en: 'SQLite' } },
        ] },
      { id: 'clock', name: { zh: '时钟', en: 'Clock' }, en: 'scheduled wakings', star: true,
        dim: 'AUTOMATION',
        gist: { zh: '服务端定时器：回合的第二个入口', en: 'a server-side timer: the second entry to a turn' },
        leaves: [
          { id: 'beat', label: { zh: '60s 心跳', en: 'the heartbeat' } },
          { id: 'ladder', label: { zh: '沉默阶梯', en: 'the silence ladder' } },
          { id: 'outcomes', label: { zh: '三种合法结局', en: 'three legal outcomes' } },
          { id: 'lock', label: { zh: '一把锁', en: 'one lock' } },
        ] },
    ],

    /* ══ 图二 · 一条消息的一生（时序泳道）══════════════════
       五条泳道，只画反应式路径。主动回合是另一条路径，画进来
       会与这一条在左上角重叠。
       两条回边都回到 ②（代码里 append_results 与 finalize 都
       return 'build_request'），画成上方两道嵌套的弧，不与任何
       斜线相交。                                            */
    flow: {
      w: 1560,
      h: 680,
      laneX0: 224,
      /* 五条泳道本身也是构件，每一条都能点开详页。
         LLM 那条讲的是接口边界（ProviderRequest / ProviderEvent），
         不是模型内部：图上那个盒子仍然没有详页。 */
      lanes: [
        { id: 'lane-user', y: 104, name: { zh: '用户 · WS', en: 'User · WS' }, sub: 'chat.send / turn.result', deck: { zh: '泳道 · WebSocket 与 Zod 契约', en: 'Lane · the socket and its Zod contract' } },
        { id: 'lane-harness', y: 300, name: 'Harness', sub: { zh: '本仓库', en: 'this repository' }, deck: { zh: '泳道 · 六节点状态图与两条回边', en: 'Lane · six nodes, two return edges' } },
        { id: 'lane-llm', y: 424, name: 'LLM', sub: { zh: '外部服务', en: 'external service' }, deck: { zh: '泳道 · provider 接口边界', en: 'Lane · the provider boundary' } },
        { id: 'lane-tools', y: 516, name: { zh: '工具', en: 'Tools' }, sub: '28', deck: { zh: '泳道 · 并发策略与安全门', en: 'Lane · concurrency and the safety gate' } },
        { id: 'lane-store', y: 600, name: { zh: '存储', en: 'Store' }, sub: 'SQLite', deck: { zh: '泳道 · SQLite：唯一的持久层', en: 'Lane · SQLite, the only persistent layer' } },
      ],
      steps: [
        { id: 'msg', x: 306, y: 104, label: { zh: '一条消息', en: 'a message' }, meta: 'chat.send' },
        { id: 'assemble', x: 330, y: 300, label: { zh: '① 装配', en: '① assemble' }, meta: { zh: '召回 · 感知 · 窗口', en: 'recall · sense · window' } },
        { id: 'schema', x: 470, y: 300, label: '② schema', meta: 'Zod → JSON' },
        { id: 'request', x: 610, y: 300, label: { zh: '③ 发请求', en: '③ request' }, meta: { zh: '缓存块 + 历史', en: 'cached block + history' } },
        { id: 'infer', x: 726, y: 424, label: { zh: '推理', en: 'inference' }, opaque: true },
        { id: 'dispatch', x: 850, y: 300, label: { zh: '④ 分发', en: '④ dispatch' }, meta: { zh: '并发 · 安全门', en: 'concurrency · safety gate' } },
        { id: 'exec', x: 950, y: 516, label: { zh: '执行', en: 'execute' }, meta: 'sessionMutex' },
        { id: 'append', x: 1040, y: 300, label: { zh: '⑤ 回填', en: '⑤ append' }, meta: { zh: '预算 · 短路', en: 'budget · short-circuit' } },
        { id: 'gate', x: 1216, y: 300, label: { zh: '⑥ 闸', en: '⑥ guards' }, meta: { zh: '空回复 · 完整性', en: 'empty reply · integrity' } },
        { id: 'reply', x: 1216, y: 104, label: { zh: '看到回复', en: 'reply lands' }, meta: 'turn.result' },
        { id: 'persist', x: 1344, y: 600, label: { zh: '⑦ 落库', en: '⑦ persist' }, meta: { zh: 'finally 里', en: 'in the finally' } },
        { id: 'after', x: 1462, y: 600, label: { zh: '折叠 · 梦', en: 'fold · dream' } },
      ],
      arrows: [
        { pts: [[310, 120], [326, 284]], label: 'chat.send', at: [246, 196] },
        { pts: [[352, 300], [452, 300]] },
        { pts: [[492, 300], [592, 300]] },
        { pts: [[628, 316], [700, 410]], label: 'chatStream', at: [614, 372] },
        { pts: [[754, 410], [834, 316]], label: 'tool_use', at: [768, 366] },
        { pts: [[864, 316], [940, 502]], label: 'dispatch', at: [872, 420] },
        { pts: [[964, 502], [1046, 316]], label: 'tool_result', at: [980, 420] },
        { pts: [[1066, 300], [1196, 300]] },
        { pts: [[1216, 284], [1216, 122]], label: 'turn.result', at: [1230, 196] },
        { pts: [[1232, 316], [1334, 584]], label: 'finally', at: [1244, 452] },
        { pts: [[1372, 600], [1442, 600]] },
      ],
      /* 两道嵌套的回边，都回到 ②；走上方空带，不碰任何斜线 */
      loops: [
        {
          pts: [[1040, 284], [1040, 218], [500, 218], [500, 284]],
          label: { zh: '还有工具要跑 → 回到 ②（至多 8 轮）', en: 'more tools to run → back to ② (≤8 rounds)' },
          at: [660, 196],
        },
        {
          pts: [[1244, 284], [1244, 162], [440, 162], [440, 284]],
          label: { zh: '闸没过（空回复 / 承诺未兑现）→ 重来一轮', en: 'a guard tripped → one more round' },
          at: [600, 140],
        },
      ],
      note: { x: 224, y: 644, text: { zh: '主路径走一次；两条回边在中段循环，受轮数与调用数上限约束。', en: 'The main path runs once; two return edges loop in the middle, bounded by the round and call caps.' } },
    },

    /* ══ L3 · 构件详页 ══════════════════════════════════════
       由 js/decks.js 填充，每一件都对着仓库代码核实后写成。
       缺哪一页就不出哪一页（目前 45/47 是满 5 页）。 */
    decks: window.LUNA_DECKS || {},
  };
})();
