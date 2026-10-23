# Vessel Lab

A local Godot research sandbox in which **GPT-6 Astra chooses each arm action** through tools, receives a real Godot camera image and instrumented state, and decides its next action. MIT source, no third-party Node packages, paid API, hosted backend, purchased assets, or hired operators.

这是一个可运行的血管吻合口缝合 **简化机器人基准原型**。它验证模型控制、反馈、失败处理和可重复验收；组织与线结模型未做医学验证。

**已实测**：2026-10-24，订阅内 Astra 在 Godot 中自主执行 59 次末端动作、获得 67 次工具/画面反馈，并通过本项目的独立验收。固定种子 42 的单次记录，不代表成功率统计。详见 [验证报告](evidence/VERIFICATION.md)。

## 运行

在这台 Mac 上双击 **`Start.command`**。也可在本目录运行：

```sh
node launch.mjs
```

需要 Godot 4、Node.js 22+、已通过 ChatGPT 登录的 Codex，以及账号可用的 `gpt-6-astra`。本次实测环境为 macOS / Apple M3 Pro、Godot 4.7.2、Node 26.5.0、Codex 0.163.0-alpha.11.2。无需 `npm install`。

启动器会寻找 `/Applications/Godot.app`、`~/Downloads/Godot.app` 或 PATH 中的 `godot` / `godot4`。其他位置可设 `GODOT_BIN`；独立 Codex 可设 `CODEX_BIN`。Windows/Linux 可用 `GODOT_BIN` 和 `node launch.mjs`，本次未验证这两个平台。

界面操作：

- **验证真实模型闭环**：模型观察场景，自主选择两次安全位移，再核对反馈。
- **GPT 自主缝合**：模型自行创建周向缝线连接、收紧、打结、到固定剪线器剪线、释放器械，最后请求验收。
- **停止模型**：终止当前模型进程，不再继续发出动作。
- **重置种子 42**：开始新的独立记录。运行模型期间禁止手动介入。
- **回放最近模型记录**：仅重新执行已记录动作，不调用模型、不消耗模型用量。没有本机记录时使用随仓库附带的真实模型动作样本。回放会替换当前场景。
- 左右臂 XYZ 按钮、夹持/松开、剪线：手动探索。每个动作最多移动 3 mm。

Godot 编辑器也可导入 `godot/project.godot`。先运行 `node server.mjs`，再按 F6/F5 启动场景。端口是 `127.0.0.1:8765`；只在本机单用户环境使用。

## 真实控制链路

```text
ChatGPT 订阅登录
  → 本机 Codex app-server，精确指定 gpt-6-astra，禁止模型回退
  → vessel.observe / step / cut / finish 动态工具
  → Node 权威状态与约束求解器（sim.mjs）
  → Godot 原生 3D 渲染及操作面板
  → Godot SubViewport 实际 JPEG + 状态 revision
  → 下一次模型决策
```

模型看到真实 Godot 渲染图像，同时获得明确公开的器械位置、接触事件、张力和闭合测量，**不是纯视觉任务**。权威力学在 Node 中运行，Godot 负责原生显示和交互；没有把 Node 物理伪称为 Godot 内置物理。等待模型推理时仿真暂停。

`step` 只执行模型指定的下一段 XYZ 位移和夹爪开合；引擎以 120 Hz 插值并解约束。没有 `suture()`、自动路径规划或“完成手术”工具。测试目录的脚本轨迹是明确标注的 **SCRIPTED 测试夹具**，不会暴露给模型。

## v0.1 的实际力学范围

- 两段管体，共 192 个粒子，周向/轴向/对角线顺应性距离约束，外端固定。
- 针尖扫过移动的环形唇口平面时检测穿刺；相邻周向位置的左右穿刺形成缝线连接。
- 缝线只受拉，松弛时不推开组织；持针和持线端相对分离会收紧连接。未固定时释放会滑脱。
- 几何线结规则检测持线端绕针的累计转角和收紧状态。它是公开的几何近似，**没有模拟真实线结自接触与摩擦拓扑**。
- 机械臂是运动学 XYZ + jaw 末端控制；弯针外观方向固定，没有完整关节 IK、力矩、器械碰撞或 6 自由度针姿态。
- 管腔由圆形支架约束保持，`lumenAreaRatio` 返回 `null`。没有独立管腔塌陷、血流、渗漏或压力负载仿真。
- 线材采用连接约束与可视折线，没有完整可碰撞绳索。损伤是重复穿刺、斜向连接和过大拉动的合成指标。

这些约束使首版可以验证闭环和自主动作，但不支持“已经掌握真实血管缝合”或扩展术式已完成的结论。

## 首版验收

`finish` 在器械操作结束后再解算 5 秒，并独立检查以下条件，任一未满足则失败：

1. 至少 95% 的 24 个周向采样点，其两侧间隙 ≤ 管半径的 10%。
2. 线结已固定。
3. 针侧缝线已到达固定剪线器并剪断。
4. 两臂均释放器械/线端。
5. 合成损伤指标 < 0.2。

这是 **无外部压力负载的保持测试**。评分代码在 `sim.mjs`，不会由模型宣布成功而改变。

```sh
npm test
node verify-evidence.mjs sessions/<运行ID>-agent.jsonl
```

测试覆盖：非法/过时动作原子拒绝、穿空不计穿刺、松弛线不撑开组织、空场景失败、未打结滑脱、未释放失败、三个固定种子的完整程序化测试及确定性重放。程序化测试不等于模型成功率。

## 费用边界

本项目只使用当前 ChatGPT 订阅登录，不读取或创建 API Key；强制 `chatgpt` 登录方式，并移除子进程的 OpenAI API 环境变量。启动前、每次工具调用前和结束后读取普通订阅用量；额度不可确认或达到 95% 时停止。记录运行前后积分余额是否变化；没有购买、充值或重置额度代码。

模型推理仍消耗现有订阅额度，受账号、模型可用性和官方限制影响。守卫是客户端保护，不是账户级付费开关，也不承诺无限运行或其他账号一定可用。手动模式、测试和录制回放不调用模型。

## 记录与复核

每次运行记录在 `sessions/`（已 gitignore）：

- `<ID>.jsonl`：种子、引擎接受/拒绝的命令、每步状态及最终验收。
- `<ID>-agent.jsonl`：实际模型会话、工具参数、前后 revision、画面哈希、订阅检查与结果。
- `<ID>-NNN.jpg`：该次工具返回给模型的真实 Godot 图像。
- `<ID>-process.log`：可见模型说明和简短工具进度。

离线校验器检查画面哈希、模型动作与实际引擎命令对应关系、确定性重放和订阅前后检查。它是本地可核验记录，不能替代第三方认证。发布前不应上传账号配置或 `.env`；运行记录只保留本项目的合成场景数据和去标识的账号类型/额度状态。

公开仓库保留去除账户状态和会话 ID 的动作样本 `examples/astra-suture-42.jsonl`、验证摘要和场景截图；原始逐步图像及账号用量记录保留在本机交付包中，不纳入 Git 提交。

参考官方接口：[Codex app-server](https://learn.chatgpt.com/docs/app-server)、[订阅 token sharing](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server)、[Godot SubViewport](https://docs.godotengine.org/en/stable/classes/class_subviewport.html)。接口可能随 Codex 版本变化。

## 后续扩展边界

其他术式应复用动作/观察协议和证据记录，新增各自的组织模型、器械行为和独立验收器。当前没有实现肿瘤切除、胆囊切除或其他术式，也不把图形演示当成物理验证。
