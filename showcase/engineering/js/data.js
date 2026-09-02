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
    prologue: {
      eyebrow: '扉页',
      heading: '黑盒之外的一切',
      sub: '模型换得掉，这套东西换不掉 —— 它有个名字：agent harness',
      lead: '〔占位：两三句说清主张——推理本身是买来的；让它变成一个能记事、会动手、有分寸的伙伴的那部分，是写出来的。〕',
      cards: [
        {
          title: '怎么读',
          body: '一屏先看六个支名；想看哪支点哪支，它就地展开；再点开一个构件，是五页固定同构的详页（主张 / 机制 / 接口与契约 / 代码证据 / 决策与代价）。',
        },
        {
          title: '六支从哪来',
          body: '前五支是 agent harness 的通行分解（上下文管理 · 智能体循环 · 工具接口 · 控制机制 · 状态持久化）。第六支「时钟」是 Luna 多出来的——标准 harness 只有一个入口，她有两个。',
        },
      ],
      tail: '〔占位：一句收尾。〕',
    },

    footnote: '〔占位：脚注——数字口径 / 最后更新 / 产品端展示与开发故事的链接。〕',

    /* 根是一对：LLM（不可展开的黑盒）与 Agent system（被分解的那个）。
       IN / OUT 是它们之间仅有的两条边——harness 喂进去，再把吐出来的收走。 */
    root: {
      llm: { label: 'LLM', sub: '换不掉 · 改不了 · 按 token 付钱' },
      agent: { label: 'Agent system', sub: '黑盒之外的一切，全是我写的' },
      inLabel: 'IN',
      inSub: '上下文 + 工具 schema',
      outLabel: 'OUT',
      outSub: '文字 · 思考 · 工具调用',
      aside: '整棵树只有 LLM 点不开——那正是「黑盒」的意思。',
    },

    branches: [
      {
        id: 'ctx',
        name: '上下文',
        en: 'context management',
        dim: 'CONTEXT ENGINEERING · RAG · VECTOR DB',
        gist: '决定什么进得了那扇窗',
        leaves: [
          { id: 'cached', label: '缓存前缀', meta: '人格 · 灵魂 · 技能货架 · L3 核心；memoryEpoch 记忆化' },
          { id: 'tail', label: '未缓存尾部', meta: '时间 · 天气 · 在放的歌 · 召回块 · 他刚说的这一句' },
          { id: 'bp', label: 'cache_control 断点', meta: '左边一个字节都不能变——这条约束反过来决定了记忆怎么存' },
          { id: 'recall', label: '混合召回', meta: '向量 + 词法 + 时近；缺 sqlite-vec 时纯 TS 兜底' },
          { id: 'perceive', label: '感知注入', meta: '同步读后台快照——热路径零网络' },
          { id: 'burn', label: '阅后即焚', meta: '整首歌词只给一次；回合回滚时把额度还回去' },
        ],
      },
      {
        id: 'loop',
        name: '循环',
        en: 'agent loop',
        dim: 'AI WORKFLOWS · AGENT',
        gist: '推理 → 行动 → 观察，直到不用再转',
        leaves: [
          { id: 'graph', label: '六节点状态图', meta: 'parse_input → … → finalize · graph.ts' },
          { id: 'edge1', label: '回边 ①', meta: '还有工具要跑 → 回到 build_request' },
          { id: 'edge2', label: '回边 ②', meta: '闸没过（空回复 / 承诺未兑现）→ 重来一轮' },
          { id: 'budget', label: '两个预算', meta: '8 轮管轮数；主动周期另有 8 次调用的上限' },
          { id: 'shortcut', label: 'is_final 短路', meta: '她说完了，就别再花一个往返去确认' },
        ],
      },
      {
        id: 'tools',
        name: '工具',
        en: 'tool interface',
        dim: 'TOOL USE · FUNCTION CALLING',
        gist: '她伸手够得着的世界',
        leaves: [
          { id: 'count', label: '28 个工具', meta: 'ToolName 枚举 · Zod schema → JSON Schema' },
          { id: 'speak', label: '说话也是工具调用', meta: 'message——唯一的发声通道，没有它就是沉默' },
          { id: 'concur', label: '三档并发', meta: 'safe-parallel / session-serial / global-serial' },
          { id: 'stream', label: '流式吐出', meta: 'tool_input_delta 边生成边播，不缓冲到轮尾' },
          { id: 'result', label: '结果回填', meta: 'tool_result 按原顺序拼回，再进黑盒' },
        ],
      },
      {
        id: 'guard',
        name: '控制',
        en: 'control mechanisms',
        dim: 'GUARDRAILS · OBSERVABILITY',
        gist: '可信 · 可审 · 关得住',
        leaves: [
          { id: 'capgate', label: '能力门', meta: '关掉的那组，连 schema 都不进提示词' },
          { id: 'proactgate', label: '主动安全门', meta: 'fail-closed——不显式标 safe 的一律当 surface' },
          { id: 'integrity', label: '完整性闸', meta: '承诺未兑现 / 有意图无行动 → 有界重试一次' },
          { id: 'net', label: '网络护栏', meta: 'SSRF + DNS 钉 · shell 拒绝表 · 写不了评判自己的文件' },
          { id: 'dangling', label: '悬空 tool_use 清理', meta: '截断的一轮，不许把历史毒化成永久不可用' },
          { id: 'trace', label: '全程落 trace', meta: 'node / tool / outbound + 决策回放，挂在每次跃迁上' },
        ],
      },
      {
        id: 'state',
        name: '状态',
        en: 'state persistence',
        dim: 'MEMORY · COST OPTIMIZATION',
        gist: '她凭什么记得昨天',
        leaves: [
          { id: 'realreply', label: '真回复关口', meta: '没说出话的轮整轮回滚——空行不许进记忆' },
          { id: 'fold', label: 'L1 折叠', meta: '异步 + CAS 提交，回复发走之后才跑' },
          { id: 'layers', label: 'L2 / L3 / 灵魂', meta: '耐久回合 · 长期事实 · 她自己写的那半' },
          { id: 'dream', label: '梦', meta: '第二台 runGraph，独立 key——不跟实时回复抢额度' },
          { id: 'sqlite', label: 'SQLite', meta: '一个文件；两条路径都读它' },
        ],
      },
      {
        id: 'clock',
        name: '时钟',
        en: "Luna's own",
        star: true,
        dim: 'AUTOMATION',
        gist: '标准 harness 只有一个入口，她有两个',
        leaves: [
          { id: 'beat', label: '60s 心跳', meta: 'setInterval + .unref()——没人停它，它随进程死' },
          { id: 'ladder', label: '沉默阶梯', meta: '四相位，唯一的唤醒决策' },
          { id: 'outcomes', label: '三种合法结局', meta: '说话 / 安静地干活 / 真的休息——都留痕，所以沉默可测量' },
          { id: 'lock', label: '一把锁', meta: '反应 / 主动 / 梦三者互斥——她一次只做一件事' },
        ],
      },
    ],

    /* ══ 图二 · 一条消息的一生（时序泳道）══════════════════
       五条泳道。只画一条消息的一生——主动回合是另一条消息的
       一生，塞进来只会在左上角打结。
       两条回边都回到 ②（代码里 append_results 与 finalize 都
       return 'build_request'），画成上方两道嵌套的弧，不与任何
       斜线相交。                                            */
    flow: {
      w: 1500,
      h: 680,
      laneX0: 224,
      /* 五条泳道本身也是构件——每一条都能点开详页。
         LLM 那条讲的是**边界**（我们对黑盒知道的全部），
         不是黑盒内部：图上那个盒子仍然点不开。 */
      lanes: [
        { id: 'lane-user', y: 104, name: '用户 · WS', sub: 'chat.send / turn.result', deck: '泳道 · 一条 WebSocket，一份 Zod 契约' },
        { id: 'lane-harness', y: 300, name: 'Harness', sub: '我写的那套', deck: '泳道 · 六节点状态图与两条回边' },
        { id: 'lane-llm', y: 424, name: 'LLM', sub: '黑盒', deck: '泳道 · 边界——我们对黑盒知道的全部' },
        { id: 'lane-tools', y: 516, name: '工具', sub: '28 个', deck: '泳道 · 并发策略与安全门' },
        { id: 'lane-store', y: 600, name: '存储', sub: 'SQLite', deck: '泳道 · 一个文件装下她的全部' },
      ],
      steps: [
        { id: 'msg', x: 306, y: 104, label: '一条消息', meta: 'chat.send' },
        { id: 'assemble', x: 330, y: 300, label: '① 装配', meta: '召回 · 感知 · 窗口' },
        { id: 'schema', x: 470, y: 300, label: '② schema', meta: 'Zod → JSON' },
        { id: 'request', x: 610, y: 300, label: '③ 发请求', meta: '缓存块 + 历史' },
        { id: 'infer', x: 726, y: 424, label: '推理', opaque: true },
        { id: 'dispatch', x: 850, y: 300, label: '④ 分发', meta: '并发 · 安全门' },
        { id: 'exec', x: 950, y: 516, label: '执行', meta: 'sessionMutex' },
        { id: 'append', x: 1060, y: 300, label: '⑤ 回填', meta: '预算 · 短路' },
        { id: 'gate', x: 1190, y: 300, label: '⑥ 闸', meta: '空回复 · 完整性' },
        { id: 'reply', x: 1190, y: 104, label: '看到回复', meta: 'turn.result' },
        { id: 'persist', x: 1310, y: 600, label: '⑦ 落库', meta: 'finally 里' },
        { id: 'after', x: 1420, y: 600, label: '折叠 · 梦' },
      ],
      arrows: [
        { pts: [[310, 120], [326, 284]], label: 'chat.send', at: [246, 196] },
        { pts: [[352, 300], [452, 300]] },
        { pts: [[492, 300], [592, 300]] },
        { pts: [[628, 316], [700, 410]], label: 'chatStream', at: [614, 372] },
        { pts: [[754, 410], [834, 316]], label: 'tool_use', at: [768, 366] },
        { pts: [[864, 316], [940, 502]], label: 'dispatch', at: [872, 420] },
        { pts: [[964, 502], [1046, 316]], label: 'tool_result', at: [980, 420] },
        { pts: [[1084, 300], [1172, 300]] },
        { pts: [[1190, 284], [1190, 122]], label: 'turn.result', at: [1204, 196] },
        { pts: [[1204, 316], [1300, 584]], label: 'finally', at: [1214, 452] },
        { pts: [[1338, 600], [1400, 600]] },
      ],
      /* 两道嵌套的回边，都回到 ②；走上方空带，不碰任何斜线 */
      loops: [
        {
          pts: [[1060, 284], [1060, 218], [500, 218], [500, 284]],
          label: '还有工具要跑 → 回到 ②（至多 8 轮）',
          at: [660, 196],
        },
        {
          pts: [[1216, 284], [1216, 162], [440, 162], [440, 284]],
          label: '闸没过（空回复 / 承诺未兑现）→ 重来一轮',
          at: [600, 140],
        },
      ],
      note: { x: 224, y: 644, text: '这条线只走一次；两条回边让它在中间打转，直到不用再转。' },
    },

    deckPages: [
      { title: '主张', html: '<p>〔没有它会怎样——一到两句，不解释它是什么。〕</p>' },
      { title: '机制', html: '<div class="figure">〔机制图 · 手绘 SVG〕</div>' },
      {
        title: '契约',
        html: '<p class="kv"><span>暴露</span>〔一行〕</p><p class="kv"><span>依赖</span>〔一行〕</p><p class="kv"><span>边界</span>〔一行〕</p><p class="kv"><span>不变量</span>〔测试钉死的那一条〕</p>',
      },
      {
        title: '代码',
        html: '<pre class="code"><span class="cm">// packages/server/src/….ts:00-00</span>\n〔≤12 行，选读完就知道不是摆设的那段〕</pre>',
      },
      {
        title: '决策',
        html: '<ul><li>被拒绝的方案，以及为什么</li><li>赔掉了什么</li><li>什么条件下会失效</li></ul>',
      },
    ],
  };
})();
