/* ═══════════════════════════════════════════════════════════════
   Luna · 工程图谱 —— 内容层（唯一需要改文案的文件）

   主题：agent harness —— 环绕在 LLM 之外的那套基础设施。
   不是自创说法：Wikipedia 有词条，LangChain / Databricks 都在用，
   各家分解高度一致 —— 上下文 / 循环 / 工具 / 控制 / 状态。
   Luna 在这五支之外多一支「时钟」：标准 harness 只有一个入口
   （请求进来），她有两个 —— 她自己会醒。

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
      tagline: { zh: '黑盒之外的一切 · agent harness', en: 'Everything outside the black box · agent harness' },
      navTree: { zh: '结构', en: 'Structure' },
      navFlow: { zh: '时序', en: 'Sequence' },
      navStory: { zh: '开发故事 →', en: 'Dev stories →' },
      reopen: { zh: '重看扉页', en: 'Cover' },
      flip: { zh: '翻开图谱 →', en: 'Open the map →' },
      fig1no: { zh: '图一', en: 'Fig. 1' },
      fig1title: { zh: '结构 · 黑盒之外有什么', en: 'Structure · what surrounds the box' },
      fig1lede: {
        zh: '根是一对：点不开的 LLM，和被分解的 Agent system。六支从后者向下扇开，全部展开——叶子点开是构件详页。',
        en: 'The root is a pair: an LLM you cannot open, and the Agent system that gets decomposed. Six branches fan down from the latter, fully expanded — every leaf opens a component page.',
      },
      fig2no: { zh: '图二', en: 'Fig. 2' },
      fig2title: { zh: '时序 · 一条消息的一生', en: 'Sequence · the life of one message' },
      fig2lede: {
        zh: '结构图说「有哪些部件」，这张说「谁在什么时候跟谁讲话」——五条泳道，两条回边。泳道名和每个步骤同样可以点开。',
        en: 'The structure map says which parts exist; this one says who talks to whom, and when — five lanes, two return edges. Lane names and steps open too.',
      },
    },

    prologue: {
      eyebrow: { zh: '扉页', en: 'Cover' },
      heading: { zh: '黑盒之外的一切', en: 'Everything outside<br>the black box' },
      sub: {
        zh: '模型换得掉，这套东西换不掉 —— 它有个名字：agent harness',
        en: 'The model is swappable. This part is not. It has a name: the agent harness.',
      },
      lead: {
        zh: '〔占位：两三句说清主张——推理是买来的；让它变成一个能记事、会动手、有分寸的伙伴的那部分，是写出来的。〕',
        en: '[placeholder: two or three sentences — inference is bought; what turns it into a companion that remembers, acts and holds back is written.]',
      },
      cards: [
        {
          title: { zh: '怎么读', en: 'How to read it' },
          body: {
            zh: '两张图：结构与时序。图上带虚下划线的都能点开，是五页以内的构件详页（主张 / 机制 / 契约 / 代码 / 决策），页数因件而异。',
            en: 'Two figures: structure and sequence. Anything dashed-underlined opens a component page — at most five slides (claim / mechanism / contract / code / decision), fewer where there is less to say.',
          },
        },
        {
          title: { zh: '六支从哪来', en: 'Where the six come from' },
          body: {
            zh: '前五支是 agent harness 的通行分解（上下文 · 循环 · 工具 · 控制 · 状态）。第六支「时钟」是 Luna 多出来的——标准 harness 只有一个入口，她有两个。',
            en: 'Five are the common harness decomposition (context · loop · tools · control · state). The sixth, the clock, is hers — a standard harness has one entry; she has two.',
          },
        },
      ],
      tail: { zh: '〔占位：一句收尾。〕', en: '[placeholder: one closing line.]' },
    },

    footnote: {
      zh: '〔占位：脚注——数字口径 / 最后更新 / 产品端展示与开发故事的链接。〕',
      en: '[placeholder: footnote — how the numbers are counted, last updated, links.]',
    },

    root: {
      llm: { label: 'LLM', sub: { zh: '换不掉 · 改不了 · 按 token 付钱', en: 'not swappable here · not editable · billed by token' } },
      agent: { label: 'Agent system', sub: { zh: '黑盒之外的一切，全是我写的', en: 'everything outside the box — all of it written' } },
      inLabel: 'IN',
      inSub: { zh: '上下文 + 工具 schema', en: 'context + tool schemas' },
      outLabel: 'OUT',
      outSub: { zh: '文字 · 思考 · 工具调用', en: 'text · thinking · tool calls' },
      aside: { zh: '整棵树只有 LLM 点不开——那正是「黑盒」的意思。', en: 'The LLM is the one node that will not open. That is what "black box" means.' },
    },

    branches: [
      { id: 'ctx', name: { zh: '上下文', en: 'Context' }, en: 'context management',
        dim: 'CONTEXT ENGINEERING · RAG · VECTOR DB',
        gist: { zh: '决定什么进得了那扇窗', en: 'what gets through the window' },
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
        gist: { zh: '推理 → 行动 → 观察，直到不用再转', en: 'reason → act → observe, until it need not' },
        leaves: [
          { id: 'graph', label: { zh: '六节点状态图', en: 'six-node graph' } },
          { id: 'edge1', label: { zh: '回边 ①', en: 'return edge ①' } },
          { id: 'edge2', label: { zh: '回边 ②', en: 'return edge ②' } },
          { id: 'budget', label: { zh: '两个预算', en: 'two budgets' } },
          { id: 'shortcut', label: { zh: 'is_final 短路', en: 'is_final short-circuit' } },
        ] },
      { id: 'tools', name: { zh: '工具', en: 'Tools' }, en: 'tool interface',
        dim: 'TOOL USE · FUNCTION CALLING',
        gist: { zh: '她伸手够得着的世界', en: 'the world she can reach' },
        leaves: [
          { id: 'count', label: { zh: '工具总数', en: 'the tool surface' } },
          { id: 'speak', label: { zh: '说话也是工具调用', en: 'speaking is a tool call' } },
          { id: 'concur', label: { zh: '三档并发', en: 'three concurrency tiers' } },
          { id: 'stream', label: { zh: '流式吐出', en: 'streamed tool input' } },
          { id: 'result', label: { zh: '结果回填', en: 'result append' } },
        ] },
      { id: 'guard', name: { zh: '控制', en: 'Control' }, en: 'control mechanisms',
        dim: 'GUARDRAILS · OBSERVABILITY',
        gist: { zh: '可信 · 可审 · 关得住', en: 'trustworthy · auditable · contained' },
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
        gist: { zh: '她凭什么记得昨天', en: 'how she remembers yesterday' },
        leaves: [
          { id: 'realreply', label: { zh: '真回复关口', en: 'the real-reply gate' } },
          { id: 'fold', label: { zh: 'L1 折叠', en: 'L1 fold' } },
          { id: 'layers', label: { zh: 'L2 / L3 / 灵魂', en: 'L2 / L3 / soul' } },
          { id: 'dream', label: { zh: '梦', en: 'the dream' } },
          { id: 'sqlite', label: { zh: 'SQLite', en: 'SQLite' } },
        ] },
      { id: 'clock', name: { zh: '时钟', en: 'Clock' }, en: "Luna's own", star: true,
        dim: 'AUTOMATION',
        gist: { zh: '标准 harness 只有一个入口，她有两个', en: 'a standard harness has one entry; she has two' },
        leaves: [
          { id: 'beat', label: { zh: '60s 心跳', en: 'the heartbeat' } },
          { id: 'ladder', label: { zh: '沉默阶梯', en: 'the silence ladder' } },
          { id: 'outcomes', label: { zh: '三种合法结局', en: 'three legal outcomes' } },
          { id: 'lock', label: { zh: '一把锁', en: 'one lock' } },
        ] },
    ],

    /* ══ 图二 · 一条消息的一生（时序泳道）══════════════════
       五条泳道。只画一条消息的一生——主动回合是另一条消息的
       一生，塞进来只会在左上角打结。
       两条回边都回到 ②（代码里 append_results 与 finalize 都
       return 'build_request'），画成上方两道嵌套的弧，不与任何
       斜线相交。                                            */
    flow: {
      w: 1560,
      h: 680,
      laneX0: 224,
      /* 五条泳道本身也是构件——每一条都能点开详页。
         LLM 那条讲的是**边界**（我们对黑盒知道的全部），
         不是黑盒内部：图上那个盒子仍然点不开。 */
      lanes: [
        { id: 'lane-user', y: 104, name: { zh: '用户 · WS', en: 'User · WS' }, sub: 'chat.send / turn.result', deck: { zh: '泳道 · 一条 WebSocket，一份 Zod 契约', en: 'Lane · one socket, one Zod contract' } },
        { id: 'lane-harness', y: 300, name: 'Harness', sub: { zh: '我写的那套', en: 'the part I wrote' }, deck: { zh: '泳道 · 六节点状态图与两条回边', en: 'Lane · six nodes, two return edges' } },
        { id: 'lane-llm', y: 424, name: 'LLM', sub: { zh: '黑盒', en: 'black box' }, deck: { zh: '泳道 · 边界——我们对黑盒知道的全部', en: 'Lane · the boundary, all we know of it' } },
        { id: 'lane-tools', y: 516, name: { zh: '工具', en: 'Tools' }, sub: '28', deck: { zh: '泳道 · 并发策略与安全门', en: 'Lane · concurrency and the safety gate' } },
        { id: 'lane-store', y: 600, name: { zh: '存储', en: 'Store' }, sub: 'SQLite', deck: { zh: '泳道 · 一个文件装下她的全部', en: 'Lane · one file holds all of her' } },
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
      note: { x: 224, y: 644, text: { zh: '这条线只走一次；两条回边让它在中间打转，直到不用再转。', en: 'The line runs once; two return edges keep it circling in the middle until it need not.' } },
    },

    /* ══ L3 · 构件详页 ══════════════════════════════════════
       由 js/decks.js 填充（六支各一个 agent 核实代码后写成）。
       缺哪一页就不出哪一页——页数因件而异是预期行为。 */
    decks: window.LUNA_DECKS || {},
  };
})();
