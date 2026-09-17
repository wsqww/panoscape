# AGENTS.md

本文件面向在本仓库中工作的 AI 编码助手：汇总项目事实、约定与已知坑。
**每次修改项目内容结束后，自查本次改动是否影响本文件所载事实（命令、目录结构、约定、部署流程等），有影响时同步更新本文件，再结束任务。**

## 项目概述

Panoscape（中文「境游」）：基于 MapLibre 3D 地图的可交互式景区游览演示（个人作品集）。
多景区架构：入口页选择景区 → 进入对应景区的 3D 全景游览页。当前已接入：西湖。

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
| maplibre-gl | ^5.24 | v5.24 的 render 第二参数为 `CustomRenderMethodInput`，取 `args.defaultProjectionData.mainMatrix` 作为墨卡托 MVP |
| three | ^0.186 | 地标白模自定义图层 |
| vite / typescript | ^6 / ^5 | 多页应用（MPA），产物 `base: './'` |

## 架构约定

- **多页应用**：入口页 `index.html` + 每个景区一个 `scenic/<id>/index.html` 薄壳；`vite.config.ts` 自动扫描 `scenic/*/index.html` 作为构建入口，新增景区无需改构建配置
- **新增景区三步**：
  1. 新建 `scenic/<id>/index.html`（复制现有景区薄壳，改标题）
  2. 新建 `src/scenic/<id>/meta.ts`（实现 `ScenicAreaMeta`：中心/全景视角/景点清单/可选 `landmarks`）
  3. 在 `src/common/registry.ts` 的 `scenicAreas` 数组追加该 meta
- **相机参数只在 load 事件里应用一次**（`scene.ts` 中有幂等守卫）：构造器传入的 pitch/bearing 会被丢弃，禁止把 jumpTo 移出 load
- **版权控件**：`attributionControl: false`（入口页预览）或 maplibre 默认控件（游览页），不要引入自定义版权面板组件（已试过并回退，见「已知坑」）
- **调试钩子**：`window.__pscMap`（地图实例）与 `window.__pscLandmarks`（three.js 场景，见 `landmarks.ts`）暴露到 window，供控制台/自动化检查

## 地图与 3D 已知坑（重要）

1. **地形 pitch 压平**：开启 `setTerrain` 后，maplibre 在低缩放级别会强制把 pitch/bearing 压平为 0（防止看到 DEM 边界外虚空），且 `getPitch()` 仍返回设定值——状态与渲染不一致。**任何开启地形的场景，`overview.zoom` 必须 ≥ 14**；低 zoom 需要倾斜视角时对该场景关闭 terrain
2. **DEM maxzoom 对齐**：DEM 源 `maxzoom: 13` 与矢量瓦片层级对齐。若设为 15，矢量瓦片超采样时每个瓦片都会输出 `cannot calculate elevation` 告警
3. **POI 图标缺失告警**：OpenFreeMap 的 Liberty 样式引用了一批其 sprite 中不存在的 POI 图标，已通过 `styleimagemissing` 事件补透明占位消除（`scene.ts`）
4. **原生挤出图层**：Liberty 样式自带 `building-3d`（minzoom 14，表达式对缺失字段抛空值警告），已在 `style.load` 时隐藏，建筑渲染统一由本项目的 `panoscape-buildings-3d` 图层负责（minzoom 11，白模配色，coalesce 保护）
5. **地标模型**：`landmarks.ts` 中场景局部空间为 X 东 / Y 北 / Z 上（米制）；投影矩阵必须用 `args.defaultProjectionData.mainMatrix`（不是 `modelViewProjectionMatrix`）；材质需 `DoubleSide`（局部坐标带镜像，单面渲染会被背面剔除剔除全部三角形）；地标保护圈内的原生建筑挤出体按要素 id 排除（`querySourceFeatures` 收集 id，`within` 表达式方案不可靠已弃用）

## 网络环境注意

- 用户本机装有 Clash 代理：**浏览器经系统代理请求，终端 curl 直连，两者结果可能相反**。排查「浏览器加载外部资源失败但 curl 正常」时先确认代理
- Esri 卫星瓦片（server.arcgisonline.com）在用户开启 Clash 时不可达，关闭代理或加直连规则即可；天地图 key 配置见 `src/common/config.ts`
- 景点照片已下载自托管于 `src/assets/photos/`，运行时不依赖 Wikimedia

## 资产约定

- **景点照片**：`src/assets/photos/<景点 id>/photo.jpg`，通过 meta.ts 中的 Vite import 引入（自动获得哈希地址）；禁止在预览/卡片上直接外链 Wikimedia
- 新增照片后用浏览器或 `sips -Z 1400` 控制单图体积（>700KB 时压缩）
- 照片来源为 Wikimedia Commons，须在 README「数据署名」表格中逐图登记文件名

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
