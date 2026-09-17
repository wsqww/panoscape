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
- **360° 实景全景**：景点卡片一键进入该位置的百度街景全景（按坐标就近取景，初始朝向与地图视角联动），全屏拖拽环视、滚轮缩放、地面箭头切换机位

## 当前状态

- [x] 3D 渲染方案选型：MapLibre GL JS + OpenFreeMap（免费、无需 API key）
- [x] 多景区工程架构（Vite + TypeScript 多页应用）
- [x] 首个景区：西湖（16 处景点，坐标经 Overpass API 逐一核对）
- [x] 地标白模模型（three.js 程序化生成，支持 GLB 替换）
- [x] 底图图层切换（标准 / 卫星）
- [x] 景点 360° 实景全景（百度街景，需免费 AK，见下）
- [ ] 更多景区陆续接入

## 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 3D 渲染 | MapLibre GL JS 5.24 | 开源地图引擎：滚轮缩放、拖拽旋转俯仰、flyTo 飞行动画、3D 地形 |
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
2. 填入 `src/common/config.ts` 的 `TIANDITU_KEY`，刷新页面即可

天地图影像为 CGCS2000 坐标系，与 OSM 数据一致、无偏移。

### 360° 全景配置

「360° 全景」按以下优先级取内容源：

1. **百度街景**（`BAIDU_MAP_AK` 有值）：每个景点卡片显示「360° 全景」按钮，按景点坐标就近取景。申请步骤：
   - 在 [百度地图开放平台控制台](https://lbsyun.baidu.com) 注册并创建应用，类型选**浏览器端**，拿到 AK
   - 应用设置的 Referer 白名单中加入：`panoscape.shuaiqiang.wang/*` 与 `localhost:5173/*`（本地开发）
   - 填入 `src/common/config.ts` 的 `BAIDU_MAP_AK`，刷新页面即可
2. **720 云漫游**（`BAIDU_MAP_AK` 留空时的备选源）：景点卡片不显示全景按钮，底部操作区出现景区级「360° 全景」入口（iframe 嵌入景区 `meta.ts` 中 `pano720` 配置的漫游）。挑选开启嵌入权限的公开漫游，复制分享链接填入即可；景区各自配置
3. 两者皆缺省时，不展示任何全景入口

景点坐标为 OSM 的 WGS-84，模块内已做标准 WGS-84 → BD-09 转换对齐百度坐标系；个别景点若百度无街景覆盖，会提示「暂无全景覆盖」。

## 目录结构

```
panoscape/
├── index.html                  # 入口页：景区选择
├── scenic/
│   └── westlake/
│       └── index.html          # 西湖游览页（薄壳，只挂 #app 与脚本）
├── src/
│   ├── common/
│   │   ├── types.ts            # ScenicAreaMeta / Attraction / LandmarkModel 类型
│   │   ├── registry.ts         # 景区注册表（扩展点）
│   │   ├── config.ts           # 可配置项（天地图 key、百度地图 AK 等）
│   │   ├── scene.ts            # 地图场景工厂：底图/3D 建筑/3D 地形/天空/版权控件
│   │   ├── landmarks.ts        # 地标白模：three.js 自定义图层 + 程序化生成器 + GLB 通道
│   │   ├── tour.ts             # 游览页通用界面：标记/侧栏/飞行/卡片/灯箱/图层切换
│   │   ├── pano.ts / pano.css  # 360° 全景：百度 JSAPI GL 按需加载、坐标转换、全屏遮罩
│   │   └── base.css / tour.css
│   ├── pages/
│   │   └── home.ts / home.css  # 入口页逻辑与样式
│   ├── assets/photos/          # 景点照片：photos/<景区 id>/<景点 id>.jpg（自托管）
│   ├── scenic/
│   │   └── westlake/
│   │       ├── meta.ts         # 西湖景区数据（真实坐标/简介/视角/地标/照片）
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

- 每个景点一个独立文件夹，便于日后为同一景点补充多张照片
- 通过 Vite 资源导入（`meta.ts` 顶部 import）获得带哈希的打包地址，多页应用各路径下均可用
- 来源为 Wikimedia Commons 自由版权图库（逐图署名见下方「数据署名」）

## 如何新增一个景区

1. 新建 `scenic/<id>/index.html`（复制 `scenic/westlake/index.html`，改标题即可）
2. 新建 `src/scenic/<id>/meta.ts`：填写景区元信息与景点清单（真实经纬度、简介、可选视角参数、可选地标模型与照片）
3. 在 `src/common/registry.ts` 的 `scenicAreas` 数组中追加该 meta

入口页卡片、构建入口（`vite.config.ts` 自动扫描）都会随之生效，无需改任何配置。

注意事项：

- 照片放 `src/assets/photos/<景区 id>/<景点 id>.jpg`，在 meta 中以 Vite import 引入
- 开启 3D 地形时，`overview.zoom` 不要低于 14（低缩放级别 maplibre 会压平俯仰角，详见 `AGENTS.md`）

## 数据署名

- 地图数据 © [OpenStreetMap](https://www.openstreetmap.org/copyright) 贡献者（页面内由 MapLibre 版权控件展示）
- 底图服务 [OpenFreeMap](https://openfreemap.org/)
- 卫星影像 © Esri, Maxar, Earthstar Geographics（卫星模式，页面内展示）
- 高程数据 © AWS Open Data（Mapzen Terrarium）
- 360° 全景影像 © 百度地图（百度街景数据，经官方 JSAPI GL 全景组件调用，全景层内展示来源）；备选源 720 云全景漫游内容版权归原作品作者（`pano720` 配置处可注明）
- 景点实景照片来自 [Wikimedia Commons](https://commons.wikimedia.org/)，各照片来源：

  | 景点 | Commons 文件 |
  |---|---|
  | 苏堤春晓 | [West Lake 02](https://commons.wikimedia.org/wiki/File:West_Lake_02.jpg) |
  | 曲院风荷 | [西湖的荷花](https://commons.wikimedia.org/wiki/File:西湖的荷花_-_panoramio.jpg) |
  | 平湖秋月 | [Huanglong & Broken Bridge…w Bai Causeway](https://commons.wikimedia.org/wiki/File:Huanglong_&_Broken_Bridge_-_Hangzhou_City_&_West_Lake_w_Bai_Causeway_w_North_Inner_West_Lake.jpg) |
  | 断桥残雪 | [Huanglong & Broken Bridge…near Broken Bridge](https://commons.wikimedia.org/wiki/File:Huanglong_&_Broken_Bridge_-_Hangzhou_City_&_West_Lake_near_Broken_Bridge.jpg) |
  | 柳浪闻莺 | [Listining Orioles Singing in the Willows](https://commons.wikimedia.org/wiki/File:Listining_Orioles_Singing_in_the_Willows-chinese.jpg) |
  | 花港观鱼 | [杭州西湖魏庐](https://commons.wikimedia.org/wiki/File:杭州西湖魏庐,_2011-01-31.jpg) |
  | 雷峰夕照 | [Leifeng Pagoda 雷峰塔](https://commons.wikimedia.org/wiki/File:Leifeng_Pagoda_雷峰塔_-_panoramio.jpg) |
  | 三潭印月 | [Three Pools Mirroring the Moon-pool](https://commons.wikimedia.org/wiki/File:Three_Pools_Mirroring_the_Moon-pool.JPG) |
  | 南屏晚钟 | [净慈寺](https://commons.wikimedia.org/wiki/File:净慈寺.jpg) |
  | 双峰插云 | [登北高峰](https://commons.wikimedia.org/wiki/File:登北高峰_-_panoramio.jpg) |
  | 湖心亭 | [West Lake IMG 8759](https://commons.wikimedia.org/wiki/File:West_Lake_IMG_8759_huxin_pavillion_island.jpg) |
  | 保俶塔 | [20260425 Baochu Pagoda 04](https://commons.wikimedia.org/wiki/File:20260425_Baochu_Pagoda_04.jpg) |
  | 城隍阁 | [吴山城隍阁](https://commons.wikimedia.org/wiki/File:吴山城隍阁.jpg) |
  | 音乐喷泉 | [Musical Fountain Show Xihu Hangzhou](https://commons.wikimedia.org/wiki/File:2014.11.21.193209_Musical_Fountain_Show_Xihu_Hangzhou.jpg) |
  | 岳王庙 | [Yue Fei Temple, 2015-03-22 26](https://commons.wikimedia.org/wiki/File:Yue_Fei_Temple,_2015-03-22_26.jpg) |
  | 楼外楼 | [Lou Wai Lou Restaurant, Hangzhou](https://commons.wikimedia.org/wiki/File:Lou_Wai_Lou_Restaurant,_Hangzhou.jpg) |

  各文件页内有作者与具体协议信息（CC0 / CC BY / CC BY-SA 等）。

## AI 协作约定

项目根目录的 [`AGENTS.md`](./AGENTS.md) 面向 AI 编码助手：包含常用命令、架构约定、已知坑与自查要求。AI 协作时请先阅读并遵守。

## License

待定（个人作品集项目，倾向 MIT）。
