# 书法与音乐匹配度实验

这是一个面向被试的静态网页实验，共 3 个固定题型、18 道固定顺序题目。网页不需要数据库或运行时后端，可直接发布到 GitHub Pages、Nginx 或任意静态文件服务器。实验进度保存在被试当前浏览器中，完成或提前结束时由被试下载 CSV 并发送给研究人员。

## 实验流程

1. 书法笔画描摹（6 题）：被试逐笔描摹，并为每一笔选择 1–3 个状态标签。
2. 书法与音乐匹配（6 题）：包括“听一个音频选一张图”和“看一张图选一个音频”。
3. 伴随音乐描摹（6 题）：点击“开始本题并播放音频”后开始描摹；音频不可暂停，完整听完后可以从头重播。

状态标签保持原规则：`加速` 与 `减速` 互斥，`间歇换气` 与 `结束` 互斥；每笔至少选一项、最多三项。网页只保存笔画序号和状态标签，不保存描摹坐标。

## 目录结构

```text
.
├─ site/                         # 唯一需要发布的静态站点
│  ├─ index.html                # 页面外壳和资源入口
│  └─ assets/
│     ├─ css/app.css            # 现有风格的响应式样式
│     ├─ images/                # 分享预览等站点图片
│     ├─ media/                 # 三类题目的图片和音频
│     └─ js/
│        ├─ config.js           # 固定题序、素材映射、标签规则和文案
│        ├─ app.js              # 整体流程与页面导航
│        ├─ trace-task.js       # 第一、三类描摹题
│        ├─ choice-task.js      # 第二类匹配题
│        ├─ canvas-tracer.js    # 仅负责当前画布输入，不持久化坐标
│        ├─ audio-controller.js # 无暂停的完整音频播放控制
│        ├─ session-store.js    # 本地会话保存与恢复
│        └─ csv-exporter.js     # 单文件 CSV 导出
├─ tests/                       # 配置、素材、会话和 CSV 自动测试
├─ prototype/original/          # 本地原始 Axure 归档，不上传公开仓库
├─ 书法图片/                    # 本地研究素材原始归档，不上传公开仓库
├─ deploy/nginx.conf            # Nginx 容器配置
├─ .github/workflows/           # GitHub Pages 自动发布
└─ Dockerfile
```

所有运行时路径均相对于 `site/`，没有绑定本机绝对路径。克隆仓库后即可运行。

## 本地预览与检查

Windows 下可直接双击项目根目录的 `本地预览.bat`。它会启动本地服务器并打开浏览器；保留服务器命令窗口，关闭该窗口即可停止预览。

也可以在项目根目录手动执行：

```bash
python scripts/serve.py
```

然后访问 `http://localhost:8080/`。不要直接双击 `index.html`。

提交前执行：

```bash
npm run check
npm test
```

测试会校验 3×6 固定题序、标签互斥规则、题库文件、第一与第三部分图片对应关系、本地会话和 CSV 字段边界。

## CSV 数据

每次新实验自动生成匿名 `session_id`，不采集姓名、联系方式或人口统计信息。数据实时写入当前浏览器的 `localStorage`，刷新后可以继续。

导出的单个 CSV 包含：

- 一条 `session` 会话记录；
- 每个已确认笔画的一条 `stroke` 记录；
- 每个已提交选择题的一条 `choice` 记录；
- 实验状态 `completed` 或 `incomplete`，以及题号、时间、选择结果等字段。

CSV 不包含画布坐标、重播次数或被试身份字段。被试提前结束时会立即下载当前未完成数据；正常完成后可在结束页下载。文件只保存在被试设备，GitHub Pages 不会自动收到数据。

## 替换或增加题目素材

所有题目映射集中在 `site/assets/js/config.js` 的 `TASKS` 中，UI、存储和导出模块不直接写死题目文件名。

后续替换或增加题目时，只需放入规范化素材并修改 `TASKS` 中对应的相对路径。修改后运行 `npm run check` 和 `npm test`；如果改变每组题量，再同步调整测试中的固定顺序断言。

## GitHub Pages 发布

项目已包含官方 GitHub Pages Actions 工作流，发布内容仅为 `site/`：

1. 将工程推送到 GitHub 仓库的 `main` 或 `master` 分支；
2. 在仓库 `Settings → Pages → Build and deployment` 中选择 `GitHub Actions`；
3. 打开 `Actions` 查看首次发布结果和网址。

之后每次推送会自动更新网页。GitHub Pages 足以支持当前“本地 CSV 下载后发送给研究人员”的收集方式。

## 服务器部署

如果未来需要被试提交后自动汇总到研究者数据库、跨设备恢复、权限管理或集中备份，再增加后端服务更合适。当前前端已经把题目配置、会话存储和 CSV 导出分开，届时可新增远端数据适配器，不需要改画布或题型组件。

容器部署命令：

```bash
docker build -t calligraphy-experiment .
docker run --rm -p 8080:80 calligraphy-experiment
```

访问 `http://localhost:8080/`，容器健康检查地址为 `/healthz`。
