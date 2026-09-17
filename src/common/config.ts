/** 全局可配置项（按需填写后刷新页面生效） */

/**
 * 天地图开发者密钥。
 * 在 https://console.tianditu.gov.cn 注册后即可免费申请（个人开发者，实名认证后创建应用选择「浏览器端」类型）。
 * 填入后「卫星」图层将改用天地图影像（国内直连稳定，坐标与 OSM 一致）；
 * 留空则使用 Esri World Imagery（部分网络环境/代理下可能无法访问）。
 */
export const TIANDITU_KEY = 'REMOVED-TIANDITU-KEY';

/**
 * 百度地图开放平台密钥（浏览器端类型），用于「360° 全景」功能加载 JSAPI GL 全景组件。
 * 在 https://lbsyun.baidu.com 控制台创建应用（个人开发者，「浏览器端」类型）即可免费申请；
 * 应用需配置 Referer 白名单：白名单外域名调用会被拒绝。
 * 留空时卡片上的全景按钮仍显示，点击后提示「敬请期待」（面向访客，不暴露配置细节）。
 */
// REMOVED-BAIDU-AK
export const BAIDU_MAP_AK = '';
