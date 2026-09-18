# AGENTS.md

本文件面向在本仓库中工作的 AI 编码助手：汇总项目事实、约定与已知坑。
**每次修改项目内容结束后，自查本次改动是否影响本文件所载事实（命令、目录结构、约定、部署流程等），有影响时同步更新本文件，再结束任务。**

## 项目概述

Panoscape（中文「境游」）：基于 MapLibre 3D 地图的可交互式景区游览演示（个人作品集）。
多景区架构：入口页选择景区 → 进入对应景区的 3D 全景游览页，景点卡片可进入百度街景 360° 实景全景。当前已接入：西湖。

## 常用命令

```bash
npm install        # 安装依赖
npm run dev        # 开发服务器 http://localhost:5173（需联网加载瓦片）
npm run build      # tsc 类型检查 + vite 构建，必须零错误
npm run preview    # 本地预览 dist 产物
```

- Node 通过 nvm 管理；终端中 `npm` 不可用时先 `source ~/.nvm/nvm.sh`
- 构建命令是 `tsc && vite build`，类型错误会导致构建失败

## 技术栈与关键版本

| 依赖 | 版本约束 | 原因 |
|---|---|---|
| maplibre-gl | ^6.10 | v6 起为 ESM-only：`import * as maplibregl`（无默认导出）；自定义图层 render 的 `args.defaultProjectionData.mainMatrix` 用法不变 |
| three | ^0.186 | 地标白模自定义图层 |
| vite / typescript | ^6 / ^5 | 多页应用（MPA），产物 `base: './'` |
| 百度地图 JSAPI GL | 运行时 CDN 注入（非 npm 依赖） | 360° 全景组件（`pano.ts`），需浏览器端 AK（环境变量 `VITE_BAIDU_MAP_AK`，经 `config.ts` 读取） |

## 架构约定

- **多页应用**：入口页 `index.html` + 每个景区一个 `scenic/<id>/index.html` 薄壳；`vite.config.ts` 自动扫描 `scenic/*/index.html` 作为构建入口，新增景区无需改构建配置
- **新增景区流程**（4 个文件 + 文档同步 + 验证）：
  1. `scenic/<id>/index.html`：复制现有景区薄壳，改 3 处——`<title>`、`<meta name="description">`（景区专属文案）、`<script>` 指向 `../../src/scenic/<id>/main.ts`
  2. `src/scenic/<id>/main.ts`：装配薄壳（import 本景区 meta + `mountTour` 挂 `#app`）；漏建此文件或 script 仍指旧景区时，页面加载的还是旧景区数据
  3. `src/scenic/<id>/meta.ts`：实现 `ScenicAreaMeta`（接口见 `src/common/types.ts`）；硬约束：`overview.zoom` ≥ 14（地形 pitch 压平坑，见已知坑 1）、坐标一律 WGS-84；`attractions` 顺序即地图编号；`photo`/`landmarks`/`pano720` 均可选，缺省时对应功能静默缺席不报错
  4. `src/common/registry.ts`：加 import + `scenicAreas` 数组追加；入口页卡片纯 registry 数据驱动，无需改入口页代码
  5. 文档同步：本文件「项目概述」的接入清单、README「当前状态」/「目录结构」
  6. 验证：`npm run build` 零错误 + 浏览器走查（入口页 → 景区页 → 景点飞行 → 底图切换 → 全景若已配），控制台无新告警
- **新增景区无需触碰**：vite.config.ts、部署 workflow、tsconfig、公共 CSS（无景区特定选择器）、favicon、入口页代码（预览为活的迷你 3D 地图，无需准备预览图资产）
- **密钥管理**：浏览器端密钥（天地图 `VITE_TIANDITU_KEY`、百度 `VITE_BAIDU_MAP_AK`）一律环境变量注入，经 `config.ts` 读取（`?? ''` 兜底，缺省走降级路径，构建不失败）；本地写 `.env.local`（gitignored，模板 `.env.example`），CI 用仓库 Actions Secrets（`deploy-pages.yml` Build 步骤注入）。**禁止在代码、注释、commit 中出现明文密钥**（历史曾因注释残留泄漏，已用 git-filter-repo 清除并作废旧值）
- **相机参数只在 load 事件里应用一次**（`scene.ts` 中有幂等守卫）：构造器传入的 pitch/bearing 会被丢弃，禁止把 jumpTo 移出 load
- **版权控件**：`attributionControl: false`（入口页预览）或 maplibre 默认控件（游览页），不要引入自定义版权面板组件（已试过并回退，见「已知坑」）
- **360° 全景模块**：`src/common/pano.ts` + `pano.css`，入口为 `openPanoOverlay(attraction, { heading, pano720 })` / `closePanoOverlay()` / `isPanoOverlayOpen()`；遮罩 DOM 由模块自管（懒创建挂 body，z-index 70），顶部为「说明胶囊 + 关闭钮」居中组合条。内容源优先级：百度 AK 有值 → 每个景点卡片显示全景按钮（`BMapGL.Panorama` 按需 JSONP 注入且单例缓存，坐标在模块内 WGS-84→BD-09）；AK 留空 → 景点按钮全部隐藏，底部操作区显示景区级「360° 全景」入口（iframe 嵌入景区级 `meta.pano720`，入口仅在配置了该字段时点亮）；皆缺省则无任何入口。修改关闭逻辑时必须同步隐藏 `.psc-pano-veil`（见已知坑 6）
- **调试钩子**：`window.__pscMap`（地图实例）暴露到 window（`scene.ts`），供控制台/自动化检查

## 地图与 3D 已知坑（重要）

1. **地形 pitch 压平**：开启 `setTerrain` 后，maplibre 在低缩放级别会强制把 pitch/bearing 压平为 0（防止看到 DEM 边界外虚空），且 `getPitch()` 仍返回设定值——状态与渲染不一致。**任何开启地形的场景，`overview.zoom` 必须 ≥ 14**；低 zoom 需要倾斜视角时对该场景关闭 terrain
2. **DEM maxzoom 对齐**：DEM 源 `maxzoom: 13` 与矢量瓦片层级对齐。若设为 15，矢量瓦片超采样时每个瓦片都会输出 `cannot calculate elevation` 告警
3. **POI 图标缺失告警**：OpenFreeMap 的 Liberty 样式引用了一批其 sprite 中不存在的 POI 图标，已通过 `styleimagemissing` 事件补透明占位消除（`scene.ts`）
4. **原生挤出图层**：Liberty 样式自带 `building-3d`（minzoom 14，表达式对缺失字段抛空值警告），已在 `style.load` 时隐藏，建筑渲染统一由本项目的 `panoscape-buildings-3d` 图层负责（minzoom 11，白模配色，coalesce 保护）
5. **地标模型**：`landmarks.ts` 中场景局部空间为 X 东 / Y 北 / Z 上（米制）；投影矩阵必须用 `args.defaultProjectionData.mainMatrix`（不是 `modelViewProjectionMatrix`）；材质需 `DoubleSide`（局部坐标带镜像，单面渲染会被背面剔除剔除全部三角形）；地标保护圈内的原生建筑挤出体按要素 id 排除（`querySourceFeatures` 收集 id，`within` 表达式方案不可靠已弃用）
6. **全景 veil 拦截点击**：`.psc-pano-veil` 的 `.visible` 态是 `pointer-events: auto` 的全屏层，且 Playwright/浏览器对「可见」的判定不看 opacity——关闭全景遮罩时若不移除 veil 的 `visible` 类，透明遮罩下 veil 仍会拦截整个页面的点击。`closePanoOverlay()` 中的 `showVeil('hidden')` 不可删
7. **百度坐标系**：百度 API 一律 BD-09，与 OSM 的 WGS-84 差数百米，直接传坐标会匹配到错误街景机位；转换用 `pano.ts` 内置的标准算法链（WGS-84 → GCJ-02 → BD-09），勿省略任一段
8. **setStyle 移除自定义图层**：底图切换（`switchBaseLayer` 的 `setStyle`）会把地标 three.js 自定义图层一并移除，切换后若不重挂，雷峰塔等模型永久消失（`applySceneLayers` 只负责建筑/地形/天空）。`landmarks.ts` 已通过持久 `style.load` 监听自动重挂（`attachLayer` 幂等 + `onAdd` 幂等守卫复用 renderer/scene）；改动挂载逻辑时必须保持这套幂等性，勿在 `onAdd` 里重复初始化。**行为约定**：卫星影像底图上不渲染地标白模（`attachLayer` 按样式是否含 vector 源切换图层 visibility，与建筑挤出图层「无矢量源即不挂」保持一致）
9. **maplibre v6 升级要点**（v5 → v6.10 实测）：① worker 变为独立文件且经 `import.meta.url` 相对引用，vite 打包后该引用失效，症状为「样式解析、图层齐全但瓦片永不加载且零报错」——必须 `?worker&url` 导入 + `worker.format: 'es'` + `setWorkerUrl`（见 `scene.ts` 顶部与 `vite.config.ts`），否则白屏；② `styleimagemissing` 改为仅通知，补缺失图标须用 `setMissingStyleImageResolver`（`scene.ts`）；③ 切底图时 terrain 挂载中 `setStyle` 触发的 `shaderPreludeCode` 崩溃（上游 #6824）已在 v6.9.0 官方修复，勿再打 workaround；④ Liberty 样式的 `highway-shield*` filter null 警告为第三方样式数据噪音，v6 会带图层名打印，可忽略

## 网络环境注意

- 用户本机装有 Clash 代理：**浏览器经系统代理请求，终端 curl 直连，两者结果可能相反**。排查「浏览器加载外部资源失败但 curl 正常」时先确认代理
- Esri 卫星瓦片（server.arcgisonline.com）在用户开启 Clash 时不可达，关闭代理或加直连规则即可；天地图 key 经环境变量 `VITE_TIANDITU_KEY` 配置（本地 `.env.local` / CI Actions Secrets，见 `config.ts` 注释）
- 百度全景脚本（api.map.baidu.com）国内直连稳定；AK 为空时不发起脚本请求，全景入口切换为底部景区级「360° 全景」（720 云）。AK 申请步骤见 README「360° 全景配置」
- 景点照片已下载自托管于 `src/assets/photos/`，运行时不依赖 Wikimedia

## 资产约定

- **景点照片**：`src/assets/photos/<景区 id>/<景点 id>.jpg`（每景区一层目录，文件名与景点 id 一致，扁平存放；不是每景点一个文件夹），通过 meta.ts 中的 Vite import 引入（自动获得哈希地址）；禁止在预览/卡片上直接外链 Wikimedia
- 新增照片后用浏览器或 `sips -Z 1400` 控制单图体积（>700KB 时压缩）
- 照片来源为 Wikimedia Commons；README「数据署名」只保留来源总述，不逐图登记表格（避免随景区增长累积）
- **地标白模（可选）**：内置三种程序化造型 `pagoda` / `slimTower` / `pavilion`（`landmarks.ts`），meta 的 `landmarks` 填 `kind` + `lngLat` 即用；全新造型走 `kind: 'glb'`，模型放 `public/models/`（目录需自建）
- **720 云全景（可选）**：meta 的 `pano720` 填景区级漫游 URL，仅在 `BAIDU_MAP_AK` 留空时点亮底部入口

## 部署流程

- GitHub Pages 通过 `.github/workflows/deploy-pages.yml` 自动部署：推送 `main` 分支触发构建并发布 `dist/`，线上站点 `https://panoscape.shuaiqiang.wang/`（自定义域名，仓库 Pages 设置中绑定）
- 首次启用需在仓库 Settings → Pages 将 Source 设为「GitHub Actions」（workflow 中的 `enablement: true` 通常会自动完成）
- 修改构建产物结构（如 `base`、输出目录）或工作流文件后，需同步更新本节与 README 部署说明

## 验证要求

- 改动后必须 `npm run build` 零错误
- 涉及渲染/交互的改动必须在浏览器实测（内嵌浏览器或真实浏览器）：入口页 → 景区页 → 景点飞行 → 图层切换 → 回到全景
- 控制台不应出现持续警告；如出现新告警，先定位来源（可用 `console.error` 包装捕获），修复后再结束

## 代码风格

- 遵循用户全局 `~/.zcode/AGENTS.md`：中文思考与回复；为每个函数/方法/类添加紧邻的中文注释（说明职责、参数、返回值、关键副作用）；未要求时不做额外抽象
- 修改本文件所载事实时，按文件顶部规则同步更新
