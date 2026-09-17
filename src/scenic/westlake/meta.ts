import type { ScenicAreaMeta } from '../../common/types';
import photoSuCauseway from '../../assets/photos/westlake/su-causeway.jpg';
import photoBreweryLotus from '../../assets/photos/westlake/brewery-lotus.jpg';
import photoAutumnMoon from '../../assets/photos/westlake/autumn-moon.jpg';
import photoBrokenBridge from '../../assets/photos/westlake/broken-bridge.jpg';
import photoOriolesSinging from '../../assets/photos/westlake/orioles-singing.jpg';
import photoFishWatching from '../../assets/photos/westlake/fish-watching.jpg';
import photoLeifengPagoda from '../../assets/photos/westlake/leifeng-pagoda.jpg';
import photoThreePools from '../../assets/photos/westlake/three-pools.jpg';
import photoEveningBell from '../../assets/photos/westlake/evening-bell.jpg';
import photoTwinPeaks from '../../assets/photos/westlake/twin-peaks.jpg';
import photoMidLakePavilion from '../../assets/photos/westlake/mid-lake-pavilion.jpg';
import photoBaochuPagoda from '../../assets/photos/westlake/baochu-pagoda.jpg';
import photoChenghuangPavilion from '../../assets/photos/westlake/chenghuang-pavilion.jpg';
import photoFountain from '../../assets/photos/westlake/fountain.jpg';
import photoYueFeiTemple from '../../assets/photos/westlake/yue-fei-temple.jpg';
import photoLouwailou from '../../assets/photos/westlake/louwailou.jpg';

/**
 * 西湖景区元信息。
 * 全部景点坐标取自 OpenStreetMap（2026-09 通过 Overpass API 逐一核对），
 * 仅取用要素的真实锚点，飞行视角按各景点形态单独调校。
 */
export const westlake: ScenicAreaMeta = {
  id: 'westlake',
  name: '西湖',
  subtitle: '杭州 · 人间天堂',
  description:
    '三面云山一面城。苏白两堤如绸带系湖，十景错落其间——以真实比例的 3D 建筑与山形，俯瞰这座千年的湖泊。',
  center: [120.1445, 30.2455],
  // 注意：开启 3D 地形后 maplibre 会在低缩放级别强制压平俯仰角，
  // 全景视角的 zoom 必须保持在 14 以上才能看到透视与旋转效果
  overview: { zoom: 14, pitch: 55, bearing: -20 },
  // 精细地标模型：程序化白模（坐标与对应景点锚点一致）
  landmarks: [
    // 雷峰塔 OSM 实测高 72m，放大 1.3 倍使程序化模型与真实体量一致
    { kind: 'pagoda', lngLat: [120.14501, 30.23388], scale: 1.3 },
    { kind: 'slimTower', lngLat: [120.14337, 30.26334], scale: 1.2 },
    { kind: 'pavilion', lngLat: [120.15993, 30.23889], rotation: 20, scale: 1.15 },
    { kind: 'pavilion', lngLat: [120.13972, 30.24857], scale: 0.32 },
  ],
  attractions: [
    {
      id: 'su-causeway',
      name: '苏堤春晓',
      group: '西湖十景',
      lngLat: [120.13321, 30.24616],
      photo: photoSuCauseway,
      summary: '苏东坡疏浚西湖以葑泥筑成长堤，横亘南北、六桥烟雨。春日拂晓桃红柳绿，居十景之首。',
      tip: '清晨入堤人少景幽，漫步与骑行皆宜。',
      view: { zoom: 15.4 },
    },
    {
      id: 'brewery-lotus',
      name: '曲院风荷',
      group: '西湖十景',
      lngLat: [120.12891, 30.2517],
      photo: photoBreweryLotus,
      summary: '南宋时此处设麯院酿官酒，荷香混着酒香而得名；夏日接天莲叶，是西湖赏荷第一去处。',
      view: { zoom: 15.9 },
    },
    {
      id: 'autumn-moon',
      name: '平湖秋月',
      group: '西湖十景',
      lngLat: [120.14147, 30.2547],
      photo: photoAutumnMoon,
      summary: '孤山东南麓的临湖赏月胜地，湖天一碧、皓月当空，正所谓「一色湖光万顷秋」。',
      view: { zoom: 16.6 },
    },
    {
      id: 'broken-bridge',
      name: '断桥残雪',
      group: '西湖十景',
      lngLat: [120.14737, 30.26153],
      photo: photoBrokenBridge,
      summary: '白堤东端，《白蛇传》中许仙与白娘子相会之处。雪后向阳桥面积雪先融，远望桥若断若连。',
      tip: '雪后初晴的清晨最易得见「断桥」意趣。',
      view: { zoom: 16.8 },
    },
    {
      id: 'orioles-singing',
      name: '柳浪闻莺',
      group: '西湖十景',
      lngLat: [120.15108, 30.2419],
      photo: photoOriolesSinging,
      summary: '南宋聚景园故址，沿湖广植柳树，风摆柳丝如浪，莺啼婉转其间，距湖滨闹市仅一步之遥。',
      view: { zoom: 16.2 },
    },
    {
      id: 'fish-watching',
      name: '花港观鱼',
      group: '西湖十景',
      lngLat: [120.13739, 30.23439],
      photo: photoFishWatching,
      summary: '苏堤南段西侧的临湖园林，红鱼池中锦鲤千尾，牡丹园亭台错落，是亲子游客最爱的投喂点。',
      view: { zoom: 16.2 },
    },
    {
      id: 'leifeng-pagoda',
      name: '雷峰夕照',
      group: '西湖十景',
      lngLat: [120.14501, 30.23388],
      photo: photoLeifengPagoda,
      summary: '夕照山巅的雷峰塔，因白娘子传说家喻户晓。夕阳斜照时宝塔镀金、湖面生辉，与保俶塔隔湖相望。',
      tip: '傍晚登塔，可同时收获西湖全景与落日。',
      view: { zoom: 17 },
    },
    {
      id: 'three-pools',
      name: '三潭印月',
      group: '西湖十景',
      lngLat: [120.14049, 30.24085],
      photo: photoThreePools,
      summary: '湖中最大岛屿，岛南水面立三座石塔——正是一元纸币背面的图案。中秋塔中燃烛，天月水月真假难分。',
      view: { zoom: 15.8 },
    },
    {
      id: 'evening-bell',
      name: '南屏晚钟',
      group: '西湖十景',
      lngLat: [120.14434, 30.23113],
      photo: photoEveningBell,
      summary: '净慈寺的傍晚钟声，穿林渡湖、回荡南屏山间，「南屏晚钟」遂成十景之一。',
      view: { zoom: 16.5 },
    },
    {
      id: 'twin-peaks',
      name: '双峰插云',
      group: '西湖十景',
      lngLat: [120.1181, 30.24993],
      photo: photoTwinPeaks,
      summary: '南高峰与北高峰遥相对峙，雨雾天双峰若隐若现直插云表；观景碑亭立于洪春桥畔。',
      view: { zoom: 15.2 },
    },
    {
      id: 'mid-lake-pavilion',
      name: '湖心亭',
      group: '湖中胜景',
      lngLat: [120.13972, 30.24857],
      photo: photoMidLakePavilion,
      summary: '湖中人工岛上的四方亭，「湖心平眺」可览全湖，张岱《湖心亭看雪》写的正是此处。',
      view: { zoom: 16 },
    },
    {
      id: 'baochu-pagoda',
      name: '保俶塔',
      group: '环湖地标',
      lngLat: [120.14337, 30.26334],
      photo: photoBaochuPagoda,
      summary: '宝石山巅的吴越古塔，纤瘦秀挺。谚云「雷峰如老衲，保俶如美人」，一湖南北两相望。',
      view: { zoom: 17 },
    },
    {
      id: 'chenghuang-pavilion',
      name: '城隍阁',
      group: '环湖地标',
      lngLat: [120.15993, 30.23889],
      photo: photoChenghuangPavilion,
      summary: '吴山之巅的江南名楼，登阁北望西湖如镜、东瞰杭城繁华，是俯瞰全城的最佳视角之一。',
      view: { zoom: 16.8 },
    },
    {
      id: 'fountain',
      name: '音乐喷泉',
      group: '环湖地标',
      lngLat: [120.15574, 30.25609],
      photo: photoFountain,
      summary: '湖滨三公园前的湖上喷泉，夜幕下随乐起舞、灯光变幻，是杭城夜游的名片。',
      tip: '通常晚间有固定场次，节假日需提早占位。',
      view: { zoom: 16.4 },
    },
    {
      id: 'yue-fei-temple',
      name: '岳王庙',
      group: '环湖地标',
      lngLat: [120.12977, 30.25474],
      photo: photoYueFeiTemple,
      summary: '栖霞岭南麓纪念岳飞的祠墓，殿内「还我河山」力透壁背，精忠报国千古流芳。',
      view: { zoom: 16.4 },
    },
    {
      id: 'louwailou',
      name: '楼外楼',
      group: '环湖地标',
      lngLat: [120.13607, 30.25265],
      photo: photoLouwailou,
      summary: '孤山南麓的百年名楼，凭窗即见全湖；西湖醋鱼、龙井虾仁皆发源于此。',
      view: { zoom: 16.8 },
    },
  ],
};
