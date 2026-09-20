import type { ScenicAreaMeta } from '../../common/types';
import { wugongshanTrail } from './trail';
import photoLongshanVillage from '../../assets/photos/wugongshan/longshan-village.jpg';
import photoYangjiaoJian from '../../assets/photos/wugongshan/yangjiao-jian.jpg';
import photoMumaAo from '../../assets/photos/wugongshan/muma-ao.jpg';
import photoFayunjie from '../../assets/photos/wugongshan/fayunjie.jpg';
import photoFengchekou from '../../assets/photos/wugongshan/fengchekou.jpg';
import photoQianzhangYan from '../../assets/photos/wugongshan/qianzhang-yan.jpg';
import photoHaohanPo from '../../assets/photos/wugongshan/haohan-po.jpg';
import photoChijiaoAo from '../../assets/photos/wugongshan/chijiao-ao.jpg';
import photoJuewangPo from '../../assets/photos/wugongshan/juewang-po.jpg';
import photoGuanyinDang from '../../assets/photos/wugongshan/guanyin-dang.jpg';
import photoDiaomaZhuang from '../../assets/photos/wugongshan/diaoma-zhuang.jpg';
import photoJinding from '../../assets/photos/wugongshan/jinding.jpg';
import photoZhonganSuodao from '../../assets/photos/wugongshan/zhongan-suodao.jpg';
import photoJingquZhengmen from '../../assets/photos/wugongshan/jingqu-zhengmen.jpg';

/**
 * 武功山景区元数据：龙山村反穿金顶徒步线（含索道下山段）。
 * 景点即反穿途径点，顺序与 trail.ts 轨迹行进方向一致（01 龙山村起 → 14 景区正门终）；
 * lngLat 取自 OSM 权威节点（村庄/山峰/垭口/设施），按真实地理位置标记，不要求与轨迹线重合。
 */
export const wugongshan: ScenicAreaMeta = {
  id: 'wugongshan',
  name: '武功山',
  subtitle: '萍乡 · 云中草原',
  description:
    '十万亩高山草甸铺展云端，龙山村反穿线串起发云界、绝望坡与金顶——华东最经典的高山徒步长廊。',
  // 景区中心取全程轨迹中点：预览缩略图与「回到全景」均能容纳完整反穿线
  center: [114.17432, 27.49938],
  // 全景俯瞰整条反穿线（zoom 12.5 为 720p 视口下全线恰好入画的实测值；
  // 俯瞰视角用 pitch 0——低缩放下带俯仰会被 maplibre 压平，见 AGENTS.md 已知坑 1）；
  // bearing 105 把南北走向的路线横过来铺满宽屏；minZoom 12 实测无 DEM 告警
  overview: { zoom: 12.5, pitch: 0, bearing: 105 },
  minZoom: 12,
  // 高差大（600m→1918m）：原生 flyTo 会被地形钳制打歪（落地偏移），启用手动路径飞行引擎
  manualFlight: true,
  // 缩略图额外缩小（默认 -0.8）：南北 9km 的长路线在宽扁卡片里需更大偏移才完整入画
  previewZoomDelta: -2.2,
  // 龙山村反穿金顶实测轨迹（详见 trail.ts 生成说明）
  trails: [wugongshanTrail],
  // 720 云景区级漫游（遮罩顶栏可切换，均免费）：
  // 徒步实拍=美浪VR 沿反穿路线的两天一夜全景分享；金顶星空=风水师-葛耀的多场景漫游
  // （游客中心→大门→缆车→观景台→日落→云海→玻璃栈桥→帐篷节→金顶 1918→下山）
  pano720: [
    { name: '徒步实拍', url: 'https://www.720yun.com/vr/e652daruwla' },
    { name: '金顶星空', url: 'https://www.720yun.com/t/189jussatm2?scene_id=23590165' },
  ],
  attractions: [
    {
      id: 'longshan-village',
      name: '龙山村',
      group: '龙山村反穿',
      lngLat: [114.15988, 27.53466],
      photo: photoLongshanVillage,
      summary: '反穿起点。萍乡芦溪县的山间小村，海拔约 560 米，村后登山口起步一路爬升至万亩草甸。',
      tip: '从萍乡市区包车约 1.5 小时到达，建议清晨起步——第一天爬升约 1100 米。',
      view: { zoom: 15.3 },
    },
    {
      id: 'yangjiao-jian',
      name: '羊角尖',
      group: '龙山村反穿',
      lngLat: [114.19086, 27.54355],
      photo: photoYangjiaoJian,
      summary: '龙山村东北的第一座山头，登山口起步的必经高地，登顶回望峡谷已沉入脚下。',
      tip: '山腰有云雾餐馆等补给点，是第一天爬升途中休整的好地方。',
      view: { zoom: 15.2 },
    },
    {
      id: 'muma-ao',
      name: '木马坳',
      group: '龙山村反穿',
      lngLat: [114.19895, 27.53612],
      photo: photoMumaAo,
      summary: '羊角尖东侧的垭口，稍作休整后视野渐开，草甸在脚下连绵铺展。',
      view: { zoom: 15.2 },
    },
    {
      id: 'fayunjie',
      name: '发云界',
      group: '龙山村反穿',
      lngLat: [114.19116, 27.52704],
      photo: photoFayunjie,
      summary: '海拔 1628 米，十万亩高山草甸的核心地带，客栈与营地集中，反穿首日常在此住宿。',
      tip: '傍晚常有云海漫过草甸，沿途客栈可提前联系食宿。',
      view: { zoom: 15 },
    },
    {
      id: 'fengchekou',
      name: '风车口',
      group: '龙山村反穿',
      lngLat: [114.1948, 27.51754],
      photo: photoFengchekou,
      summary: '发云界南段的垭口，因穿堂风大得名。翻过这里，千丈岩的崖壁已在眼前。',
      view: { zoom: 15.2 },
    },
    {
      id: 'qianzhang-yan',
      name: '千丈岩',
      group: '龙山村反穿',
      lngLat: [114.19362, 27.50965],
      photo: photoQianzhangYan,
      summary: '海拔约 1720 米的崖顶观景处，脚下即是百丈绝壁，草甸山脊在这里初见险峻。',
      view: { zoom: 15.2 },
    },
    {
      id: 'haohan-po',
      name: '好汉坡',
      group: '龙山村反穿',
      lngLat: [114.19874, 27.49828],
      photo: photoHaohanPo,
      summary: '千丈岩与赤脚坳之间的陡坡，海拔约 1690 米，坡陡路滑，好汉方能称雄。',
      view: { zoom: 15.2 },
    },
    {
      id: 'chijiao-ao',
      name: '赤脚坳',
      group: '龙山村反穿',
      lngLat: [114.194, 27.48873],
      photo: photoChijiaoAo,
      summary: '好汉坡与绝望坡之间的深坳口，海拔约 1400 米，反穿途中重要的休整点。',
      tip: '过了这里就是全程最陡的绝望坡爬升，建议在此补给、系紧鞋带。',
      view: { zoom: 15.2 },
    },
    {
      id: 'juewang-po',
      name: '绝望坡',
      group: '龙山村反穿',
      lngLat: [114.19308, 27.48642],
      photo: photoJuewangPo,
      summary: '反穿线最出名的一段陡坡，从坳口海拔约 1360 米直拔至 1710 米，碎石坡一望不到头。',
      tip: '慢走多歇，回头即是草甸云海——「绝望」的尽头风景最好。',
      view: { zoom: 15.2 },
    },
    {
      id: 'guanyin-dang',
      name: '观音宕',
      group: '龙山村反穿',
      lngLat: [114.18034, 27.47482],
      photo: photoGuanyinDang,
      summary: '海拔约 1600 米的高山草甸营地，「草甸星空」帐篷节举办地，反穿最后一夜的常选营地。',
      tip: '旺季帐篷密集，拍星空记得避开营地灯光。',
      view: { zoom: 15.2 },
    },
    {
      id: 'diaoma-zhuang',
      name: '吊马桩',
      group: '龙山村反穿',
      lngLat: [114.17599, 27.46635],
      photo: photoDiaomaZhuang,
      summary: '金顶北麓的游线交汇点，在此接入景区玻璃栈道，人流渐多，金顶已近在眼前。',
      view: { zoom: 15.3 },
    },
    {
      id: 'jinding',
      name: '金顶·白鹤峰',
      group: '龙山村反穿',
      lngLat: [114.1733, 27.4552],
      photo: photoJinding,
      summary: '海拔 1918.3 米，武功山最高峰。白鹤峰道观立于峰顶，是反穿的终点与全程最高点。',
      tip: '可乘金顶索道下山至景区大门，或原路反穿返回龙山村。',
      view: { zoom: 15.8 },
    },
    {
      id: 'zhongan-suodao',
      name: '中庵索道',
      group: '索道下山',
      lngLat: [114.16657, 27.46151],
      photo: photoZhonganSuodao,
      summary: '金顶索道中庵上站，海拔约 1350 米。反穿登顶后的省力下山选择：乘索道直达山门。',
      view: { zoom: 15.3 },
    },
    {
      id: 'jingqu-zhengmen',
      name: '景区正门',
      group: '索道下山',
      lngLat: [114.1492, 27.46956],
      photo: photoJingquZhengmen,
      summary: '石鼓寺游客服务中心，海拔约 600 米，全程 20 余公里反穿线的正式终点。',
      tip: '正门有返程班车与包车点回萍乡市区。',
      view: { zoom: 15.5 },
    },
  ],
};
