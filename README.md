# Panoscape

> 足不出户，身临千山。基于 3D 全景的可交互式景区游览演示（个人作品集 demo）。

Pano（全景）+ Scape（山水之景）：全景 · 山水 · 一键入景。配套中文「境游」。

## 是什么

用 3D 全景与热点交互，把一个景区的概况「装进」浏览器：

- **景区选择入口**：卡片式入口页，带迷你 3D 地图预览，点击卡片进入对应景区
- **3D 全景游览**：真实地图底座上的自由缩放（滚轮）、旋转俯仰（拖拽）、平滑飞行（点击景点）
- **真实比例**：建筑高度取自 OSM 实测数据（fill-extrusion 挤出），山体高程取自开放 DEM 数据，不做夸张变形
- **地标白模**：雷峰塔、保俶塔、城隍阁、湖心亭以程序化生成的三层白模精细呈现（three.js 自定义图层），支持以 GLB 模型替换
- **图层切换**：右上角「卫星 / 标准」单按钮一键切换底图；卫星源默认 Esri，可配置为国内直连的天地图（见下）
- **景点导览**：地图编号标记 + 侧栏分组列表，点击任一景点自动飞行至最佳视角；介绍卡片带实景照片，点击照片可大图预览
- **徒步路线**：真实 GPX/实测轨迹转成的 GeoJSON 折线常显在地图上（贴地形渲染 + 方向箭头），途径点即景点，串联完整行进脉络（如武功山龙山村反穿金顶）
- **360° 实景全景**：景点卡片一键进入该位置的百度街景全景（按坐标就近取景，初始朝向与地图视角联动），全屏拖拽环视、滚轮缩放、地面箭头切换机位

## 当前状态

- [x] 3D 渲染方案选型：MapLibre GL JS + OpenFreeMap（免费、无需 API key）
- [x] 多景区工程架构（Vite + TypeScript 多页应用）
- [x] 首个景区：西湖（16 处景点，坐标经 Overpass API 逐一核对）
- [x] 第二个景区：武功山（龙山村反穿金顶徒步线：14 个途径点 + 全程实测 GPX 轨迹 20.5km，Wikimedia 实景照片）
- [x] 地标白模模型（three.js 程序化生成，支持 GLB 替换）
- [x] 底图图层切换（标准 / 卫星）
- [x] 景点 360° 实景全景（百度街景，需免费 AK，见下）
- [ ] 更多景区陆续接入

## 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 3D 渲染 | MapLibre GL JS 6.10 | 开源地图引擎：滚轮缩放、拖拽旋转俯仰、3D 地形 + 自研路径飞行引擎（高差大景区平稳飞行） |
| 地标模型 | three.js 0.186 + 自定义图层 | 程序化白模生成，支持 GLB 替换通道 |
| 底图 | OpenFreeMap（Liberty 样式） | 免费、无 API key、无请求数限制，OSM 真实数据 |
| 卫星影像 | Esri World Imagery | 免费，可配置为天地图（需免费 key） |
| 3D 建筑 | OSM `render_height` | 矢量瓦片内置真实建筑高度，按实际比例挤出 |
| 3D 地形 | AWS Open Data（Terrarium DEM） | 免费全球高程瓦片，失败时自动降级为平面 |
| 景点照片 | Wikimedia Commons | 免费图库，已下载至本地自托管 |
| 360° 全景 | 百度地图 JSAPI GL 全景组件 | 免费浏览器端 AK，按景点坐标就近匹配街景机位 |
| 构建 | Vite + TypeScript | 多页应用（MPA），产物为纯静态文件 |
| 部署 | 静态托管 | GitHub Pages / Vercel 均可（`base: './'`） |

## 运行

```bash
npm install
npm run dev        # 开发：http://localhost:5173
npm run build      # 类型检查 + 产物构建（输出 dist/）
npm run preview    # 本地预览构建产物
```

页面需联网加载地图瓦片；建议使用最新版 Chrome / Edge / Safari。

### 部署到 GitHub Pages

仓库内置 GitHub Actions 工作流（`.github/workflows/deploy-pages.yml`）：推送 `main` 分支后自动构建并将 `dist/` 发布到 Pages，线上站点 `https://panoscape.shuaiqiang.wang/`（自定义域名，在仓库 Pages 设置中绑定）。

首次启用只需一步：仓库 **Settings → Pages → Build and deployment → Source 选择「GitHub Actions」**，之后每次推送自动部署（也可在 Actions 页面手动触发 `workflow_dispatch`）。

### 卫星图层源配置

「卫星」图层默认使用 Esri World Imagery（免费无 key）。若你的网络环境无法访问 `server.arcgisonline.com`（典型现象：代理软件将该域名路由到了被拒绝的出口节点），可改用国内直连的**天地图**：

1. 在 [天地图控制台](https://console.tianditu.gov.cn) 免费注册并创建「浏览器端」类型应用，拿到 `tk` 密钥
2. 本地开发：复制 `.env.example` 为 `.env.local`，填入 `VITE_TIANDITU_KEY`，重启 dev 服务器即可
3. 线上部署：仓库 **Settings → Secrets and variables → Actions** 添加同名 Secret，构建时自动注入

天地图影像为 CGCS2000 坐标系，与 OSM 数据一致、无偏移。

### 360° 全景配置

「360° 全景」按以下优先级取内容源：

1. **百度街景**（`BAIDU_MAP_AK` 有值）：每个景点卡片显示「360° 全景」按钮，按景点坐标就近取景。申请步骤：
   - 在 [百度地图开放平台控制台](https://lbsyun.baidu.com) 注册并创建应用，类型选**浏览器端**，拿到 AK
   - 应用设置的 Referer 白名单中加入：`panoscape.shuaiqiang.wang/*` 与 `localhost:5173/*`（本地开发）
   - 配置 `VITE_BAIDU_MAP_AK`：本地写入 `.env.local`，线上配仓库 Actions Secrets（方式同天地图 key）
2. **720 云漫游**（`BAIDU_MAP_AK` 留空时的备选源）：景点卡片不显示全景按钮，底部操作区出现景区级「360° 全景」入口（iframe 嵌入景区 `meta.ts` 中 `pano720` 配置的漫游）。挑选开启嵌入权限的公开漫游，复制分享链接填入即可；景区各自配置
3. 两者皆缺省时，不展示任何全景入口

景点坐标为 OSM 的 WGS-84，模块内已做标准 WGS-84 → BD-09 转换对齐百度坐标系；个别景点若百度无街景覆盖，会提示「暂无全景覆盖」。

## 目录结构

```
panoscape/
├── index.html                  # 入口页：景区选择
├── scenic/
│   ├── westlake/
│   │   └── index.html          # 西湖游览页（薄壳，只挂 #app 与脚本）
│   └── wugongshan/
│       └── index.html          # 武功山游览页（同上）
├── scripts/
│   └── gpx-to-trail.mjs        # GPX/JSON 轨迹 → trail.ts 生成器（零依赖）
├── src/
│   ├── common/
│   │   ├── types.ts            # ScenicAreaMeta / Attraction / HikeTrail 等类型
│   │   ├── registry.ts         # 景区注册表（扩展点）
│   │   ├── config.ts           # 可配置项（天地图 key、百度地图 AK 等）
│   │   ├── scene.ts            # 地图场景工厂：底图/3D 建筑/3D 地形/天空/版权控件
│   │   ├── landmarks.ts        # 地标白模：three.js 自定义图层 + 程序化生成器 + GLB 通道
│   │   ├── trail.ts            # 徒步路线：GeoJSON 折线 + 衬边 + 方向箭头（贴地、切底图自动重挂）
│   │   ├── flight.ts           # 路径飞行引擎：高差大景区逐帧 jumpTo 直线飞行（显式平滑海拔、注视目的地朝向）
│   │   ├── tour.ts             # 游览页通用界面：标记/侧栏/飞行/卡片/灯箱/图层切换
│   │   ├── pano.ts / pano.css  # 360° 全景：百度 JSAPI GL 按需加载、坐标转换、全屏遮罩
│   │   └── base.css / tour.css
│   ├── pages/
│   │   └── home.ts / home.css  # 入口页逻辑与样式
│   ├── assets/photos/          # 景点照片：photos/<景区 id>/<景点 id>.jpg（自托管）
│   ├── scenic/
│   │   ├── westlake/
│   │   │   ├── meta.ts         # 西湖景区数据（真实坐标/简介/视角/地标/照片）
│   │   │   └── main.ts         # 页面装配（薄壳）
│   │   └── wugongshan/
│   │       ├── meta.ts         # 武功山景区数据（反穿途径点/轨迹/照片）
│   │       ├── trail.ts        # 反穿轨迹折线（由 scripts/gpx-to-trail.mjs 生成，勿手改）
│   │       └── main.ts         # 页面装配（薄壳）
│   └── vite-env.d.ts
├── package.json
├── vite.config.ts              # MPA 入口自动扫描 scenic/*/index.html
└── public/favicon.svg
```

### 景点照片资产

```
src/assets/photos/<景区 id>/<景点 id>.jpg
```

- 文件名与景点 id 一致，扁平存放于景区目录下，通过 Vite 资源导入（`meta.ts` 顶部 import）获得带哈希的打包地址，多页应用各路径下均可用
- 来源为 Wikimedia Commons 自由版权图库（总述署名见下方「数据署名」）

## 如何新增一个景区

1. 新建 `scenic/<id>/index.html`：复制 `scenic/westlake/index.html`，改 `<title>` 与 `<meta name="description">`，并把 `<script>` 指向 `../../src/scenic/<id>/main.ts`
2. 新建 `src/scenic/<id>/main.ts`：复制 `westlake/main.ts`，改为引入本景区 meta 并交给 `mountTour` 挂载
3. 新建 `src/scenic/<id>/meta.ts`：填写景区元信息与景点清单（真实经纬度、简介、可选视角参数、可选地标模型与照片）
4. 在 `src/common/registry.ts` 的 `scenicAreas` 数组中追加该 meta

入口页卡片、构建入口（`vite.config.ts` 自动扫描）都会随之生效，无需改任何构建配置。

注意事项：

- 照片放 `src/assets/photos/<景区 id>/<景点 id>.jpg`，在 meta 中以 Vite import 引入
- 开启 3D 地形时，`overview.zoom` 不要低于 14（低缩放级别 maplibre 会压平俯仰角，详见 `AGENTS.md`）；高山景区 pitch 建议 ≤ 45（高差大时 pitch 60 的相机会被地形约束推走）
- 徒步轨迹（可选）：把 GPX 交给 `node scripts/gpx-to-trail.mjs <轨迹文件> --out src/scenic/<id>/trail.ts --name "路线名" --var <景区名>Trail` 生成轨迹模块，meta 里配 `trails: [<trail>]` 即可常显；轨迹方向须与行进方向一致（不符加 `--reverse`）
- 地标白模：内置三种造型（`pagoda` / `slimTower` / `pavilion`）填坐标即用；全新造型走 `kind: 'glb'`（模型放 `public/models/`）
- 完成后 `npm run build` 须零错误，并在浏览器走查：入口页 → 景区页 → 景点飞行 → 底图切换

## 数据署名

- 地图数据 © [OpenStreetMap](https://www.openstreetmap.org/copyright) 贡献者（页面内由 MapLibre 版权控件展示）
- 底图服务 [OpenFreeMap](https://openfreemap.org/)
- 卫星影像 © Esri, Maxar, Earthstar Geographics（卫星模式，页面内展示）
- 高程数据 © AWS Open Data（Mapzen Terrarium）
- 360° 全景影像 © 百度地图（百度街景数据，经官方 JSAPI GL 全景组件调用，全景层内展示来源）；备选源 720 云全景漫游内容版权归原作品作者（`pano720` 配置处可注明）
- 景点实景照片来自自由版权图库：西湖各点为 [Wikimedia Commons](https://commons.wikimedia.org/)（CC0 / CC BY / CC BY-SA 等，各文件页内有作者与协议信息）；武功山各点为「龙山村反穿」轨迹沿线实拍（两步路轨迹附件，作者自持版权）

## AI 协作约定

项目根目录的 [`AGENTS.md`](./AGENTS.md) 面向 AI 编码助手：包含常用命令、架构约定、已知坑与自查要求。AI 协作时请先阅读并遵守。

## License

待定（个人作品集项目，倾向 MIT）。
