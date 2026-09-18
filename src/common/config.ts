/** 全局可配置项（密钥一律经环境变量注入，禁止写入代码或注释） */

/**
 * 天地图开发者密钥。
 * 在 https://console.tianditu.gov.cn 注册后即可免费申请（个人开发者，实名认证后创建应用选择「浏览器端」类型）。
 * 填入后「卫星」图层将改用天地图影像（国内直连稳定，坐标与 OSM 一致）；
 * 留空则使用 Esri World Imagery（部分网络环境/代理下可能无法访问）。
 * 配置方式：本地开发写入 `.env.local` 的 `VITE_TIANDITU_KEY`（模板见 `.env.example`）；
 * 线上构建经仓库 Settings → Secrets → Actions 的同名 Secret 注入（见 `deploy-pages.yml`）。
 */
export const TIANDITU_KEY: string = import.meta.env.VITE_TIANDITU_KEY ?? '';

/**
 * 百度地图开放平台密钥（浏览器端类型），用于「360° 全景」功能加载 JSAPI GL 全景组件。
 * 在 https://lbsyun.baidu.com 控制台创建应用（个人开发者，「浏览器端」类型）即可免费申请；
 * 应用需配置 Referer 白名单：白名单外域名调用会被拒绝。
 * 留空时景点卡片不显示全景按钮，底部操作区显示景区级「360° 全景」入口（720 云，见 README）。
 * 配置方式：同 `TIANDITU_KEY`，环境变量名为 `VITE_BAIDU_MAP_AK`。
 */
export const BAIDU_MAP_AK: string = import.meta.env.VITE_BAIDU_MAP_AK ?? '';
