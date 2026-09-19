/** 景点视角参数：允许部分缺省，缺省字段由通用游览逻辑回退补齐 */
export interface AttractionView {
  zoom: number;
  pitch: number;
  bearing: number;
}

/** 景点：游览页内可点击飞行的兴趣点 */
export interface Attraction {
  /** 唯一标识（景区内不重复） */
  id: string;
  /** 中文名称 */
  name: string;
  /** 侧栏分组名（如「西湖十景」），决定列表归组 */
  group: string;
  /** OSM 真实经纬度 [lng, lat] */
  lngLat: [number, number];
  /** 一句话介绍，展示在景点卡片 */
  summary: string;
  /** 游览小贴士，展示在景点卡片（可选） */
  tip?: string;
  /** 实景照片地址（Vite 资源导入，可选；缺失时卡片不显示图片） */
  photo?: string;
  /** 点击飞行的目标视角；bearing 缺省时自动朝向景区中心 */
  view?: Partial<AttractionView>;
}

/** 地标 3D 模型规格：在指定坐标渲染程序化白模或外部 GLB 模型 */
export interface LandmarkModel {
  /** 模型种类：pagoda=多层塔，slimTower=细瘦古塔，pavilion=多层楼阁，glb=外部 GLB 文件 */
  kind: 'pagoda' | 'slimTower' | 'pavilion' | 'glb';
  /** 模型底部中心锚点 [lng, lat] */
  lngLat: [number, number];
  /** 朝向旋转角（度，绕竖直轴），默认 0 */
  rotation?: number;
  /** 整体缩放倍率，默认 1 */
  scale?: number;
  /** kind 为 glb 时的模型文件地址（建议放 public/models/ 下） */
  url?: string;
}

/** 徒步路线轨迹：地图上常显的真实轨迹折线（坐标来自 GPX 等实测数据简化） */
export interface HikeTrail {
  /** 路线名称（如「龙山村反穿金顶」），当前版本仅作数据标识 */
  name: string;
  /** 轨迹折线坐标序列 [lng, lat][]（WGS-84，顺序即行进方向，方向箭头按此渲染） */
  coordinates: [number, number][];
}

/** 720 云全景漫游条目：全景遮罩内可切换的单一漫游 */
export interface Pano720Item {
  /** 切换按钮文案（如「徒步实拍」「金顶景区」） */
  name: string;
  /** 720 云分享或嵌入链接（/t/ 或 /vr/ 形式均可） */
  url: string;
}

/** 景区元信息：入口页展示与游览页初始化所需的全部数据 */
export interface ScenicAreaMeta {
  /** 唯一标识，同时决定访问路径 /scenic/<id>/ */
  id: string;
  /** 景区名（如「西湖」） */
  name: string;
  /** 副标题（如「杭州 · 人间天堂」） */
  subtitle: string;
  /** 入口页卡片上的简介文案 */
  description: string;
  /** 景区地理中心 [lng, lat]：预览取景与景点飞行朝向的参照点 */
  center: [number, number];
  /** 全景视角：进入景区与「回到全景」使用的初始相机 */
  overview: AttractionView;
  /** 最小缩放级别（可选，默认 13）：全景俯瞰全景区时可按需调低 */
  minZoom?: number;
  /** 入口页缩略图相对全景的缩放偏移（可选，默认 -0.8）：长条形路线/景区可调小以完整入画 */
  previewZoomDelta?: number;
  /** 两段式飞行（可选）：高差大的场景先高位推近目标区域再降到取景参数，
   *  避免低空飞行路径被地形约束推离目标 */
  twoPhaseFlight?: boolean;
  /** 景点清单，顺序即地图编号（01 起） */
  attractions: Attraction[];
  /** 徒步路线清单（可选）：在游览页地图上常显的轨迹折线 */
  trails?: HikeTrail[];
  /** 精细地标模型（可选）：以白模风格渲染于 3D 建筑之上 */
  landmarks?: LandmarkModel[];
  /**
   * 720 云全景漫游（可选，景区级备选内容源）：单个嵌入地址，或多个漫游条目
   * （遮罩顶栏自动出现切换按钮，条目含 name 切换文案与 url 嵌入地址，也支持裸链接数组）。
   * BAIDU_MAP_AK 留空时：景点卡片不显示全景按钮，改为在底部操作区显示
   * 景区级「360° 全景」入口（iframe 嵌入该漫游）。AK 有值时景点按钮接管，此字段停用。
   */
  pano720?: string | Pano720Item[];
}
