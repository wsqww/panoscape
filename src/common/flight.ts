import type { Map as MlMap } from 'maplibre-gl';

/**
 * 手动路径飞行引擎：逐帧 jumpTo 驱动相机沿直线航迹飞往目标视角，专为高差大的山地景区设计。
 *
 * 为什么不用原生 flyTo/easeTo：maplibre 对每帧相机更新都执行 _elevateCameraIfInsideTerrain
 * 钳制——相机位置的已加载 DEM 高程 > 相机海拔时抬 pitch/压 zoom。原生动画期间高程瓦片陆续
 * 到货会使该比较中途翻转，动画路径被打歪，落地状态 ≠ 请求状态（详见 AGENTS.md 已知坑 10）。
 * 本引擎逐帧下发完整相机状态，且巡航/进近参数保证相机海拔恒高于区域内最高地面约 700m
 * （zoom ≥ 13.2 且 pitch ≤ 62 的组合在武功山最大高差下可证明不触发钳制），渲染路径 ≡ 请求路径，
 * 落地帧即精确目标视角，无需任何落地修正。
 *
 * 为什么相机海拔要显式插值：渲染循环每帧都会把中心点高程重钉到「中心处的 DEM 值」
 * （centerClampedToGround 默认 true），直飞航线跨山脊时地面高程起伏数百米，相机海拔随之
 * 1:1 上下颠簸，且 DEM 瓦片 LOD 切换时还会跳变。飞行期间临时设 centerClampedToGround(false)
 * 并显式传入平滑插值的 elevation，落地后恢复贴地并按目标点真实高程落位。
 */

/** 相机状态快照：引擎每帧插值与落位的目标量纲 */
export interface FlightCamera {
  /** 屏幕中心经纬度 [lng, lat] */
  center: [number, number];
  /** 缩放级别 */
  zoom: number;
  /** 俯仰角（度） */
  pitch: number;
  /** 方位角（度，0=北） */
  bearing: number;
  /** 屏幕中心处的地面海拔（米）。缺省时起飞/落点各自查询一次地形 */
  elevation?: number;
}

/** 路径飞行配置：航迹为 from.center → to.center 的直线 */
export interface PathFlightOptions {
  /** 目标地图实例 */
  map: MlMap;
  /** 起始相机状态，缺省取地图当前相机 */
  from?: FlightCamera;
  /** 终点相机状态：飞行结束帧精确等于该状态（center 必须为目标点） */
  to: FlightCamera;
  /** 飞行总时长（毫秒） */
  durationMs: number;
  /** 巡航段俯仰角（度），默认 60 */
  cruisePitch?: number;
  /** 巡航段缩放级别，缺省按航迹长度自动估算 */
  cruiseZoom?: number;
  /** 每帧调用：返回 true 即中止飞行（序号失效/用户已交互），不再写相机 */
  shouldCancel?: () => boolean;
  /** 飞行结束回调：arrived=true 表示完整抵达目标相机，false 表示被中止 */
  onSettle?: (arrived: boolean) => void;
}

/** Web 墨卡托赤道周长（米），米/像素换算基准（maplibre 512px 瓦片约定：世界在 z0 为 512px） */
const EQUATOR_METERS = 40075016.686;

/** 相机朝向转速上限（度/秒）：注视目标的跟踪与终段转向都不得快于该值，保证观感平稳 */
const BEARING_TURN_RATE = 100;

/** 当前持有「中心贴地关闭」状态的在飞实例：并发（快速切景点）时仅最后一个持有者恢复 */
const activeFlights = new Set<object>();

/** 平面近似两点间距（米）：等距圆柱投影，仅用于航迹长度等粗略量测 */
export function distanceMeters(a: [number, number], b: [number, number]): number {
  const midLat = ((a[1] + b[1]) / 2) * (Math.PI / 180);
  const dx = (b[0] - a[0]) * Math.cos(midLat) * 111320;
  const dy = (b[1] - a[1]) * 111320;
  return Math.hypot(dx, dy);
}

/** 计算从 from 指向 to 的罗盘方位角：北为 0、东为 90，返回 [0,360) 度数 */
export function bearingBetween(from: [number, number], to: [number, number]): number {
  const midLat = ((from[1] + to[1]) / 2) * (Math.PI / 180);
  const dx = (to[0] - from[0]) * Math.cos(midLat);
  const dy = to[1] - from[1];
  if (dx === 0 && dy === 0) return 0;
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

/** smoothstep 缓动：t 截断到 [0,1]，两端点处速度为 0，中段近似匀速 */
function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/** 线性插值 */
function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

/** 方位角插值：走最短弧（处理 359°↔1° 跨越），返回 [0,360) */
function lerpBearing(a: number, b: number, k: number): number {
  const d = ((b - a) % 360 + 540) % 360 - 180;
  return (((a + d * k) % 360) + 360) % 360;
}

/** 方位角最短角差：返回 (to - from) 归一到 [-180, 180) 的增量 */
function shortestDelta(from: number, to: number): number {
  return ((to - from) % 360 + 540) % 360 - 180;
}

/** 读取地图当前相机状态（含中心点地面海拔） */
function currentCamera(map: MlMap): FlightCamera {
  const c = map.getCenter();
  return {
    center: [c.lng, c.lat],
    zoom: map.getZoom(),
    pitch: map.getPitch(),
    bearing: map.getBearing(),
    elevation: map.getCenterElevation(),
  };
}

/**
 * 按航迹长度估算巡航缩放级别：目标地面分辨率 = max(全长/1200, 3.6) 米/像素
 * （约一屏航迹的追山视角；3.6 下限保证相机海拔余量——地形钳制免疫），
 * 再收敛到 [13.2, 目标缩放-0.3]：避免短途飞行大幅拉远、进近段没有「降落感」。
 */
function autoCruiseZoom(to: FlightCamera, totalM: number): number {
  const mpp = Math.max(totalM / 1200, 3.6);
  const byLen = Math.log2(EQUATOR_METERS * Math.cos((to.center[1] * Math.PI) / 180) / 512 / mpp);
  return Math.max(13.2, Math.min(byLen, to.zoom - 0.3));
}

/**
 * 执行一次直线飞行：每帧经 requestAnimationFrame 计算相机状态并 jumpTo 落位。
 * 地面中心沿直线推进；相机海拔为起终点地面高程的显式平滑插值（不受逐帧 DEM 重钉影响，
 * 全程无上下颠簸）；朝向采用「注视目的地」策略——始终看向目标景点（视角稳定），
 * 后半程平滑过渡到目标配置的取景朝向，且全程限速转动；缩放/俯仰在「起步融入段→
 * 巡航段→终端进近段」三段间 smoothstep 过渡，落点帧精确写入目标相机。结束后自验
 * 目标点居中情况，异常偏移时做一次 550ms 的平滑二次进近并告警留痕。
 */
export function flyPathFlight(options: PathFlightOptions): void {
  const { map, to, durationMs } = options;
  const from = options.from ?? currentCamera(map);
  const cruisePitch = options.cruisePitch ?? 60;
  const total = distanceMeters(from.center, to.center);
  if (total < 1) {
    map.jumpTo({ center: to.center, zoom: to.zoom, pitch: to.pitch, bearing: to.bearing });
    options.onSettle?.(true);
    return;
  }
  const cruiseZoom = options.cruiseZoom ?? autoCruiseZoom(to, total);
  /* 起步/进近段按航迹占比划段：约 1.2km / 2km 封顶，短航迹也有可感知的过渡 */
  const inFrac = Math.min(0.22, 1200 / total);
  const outFrac = Math.min(0.3, 2000 / total);
  /* 起终点地面海拔：终点 DEM 就绪（景点交互门前首帧 idle 已加载全域）时即真实值；
     高程瓦片失败已降级平面时为 0，与平面渲染一致 */
  const startElev = from.elevation ?? map.queryTerrainElevation(from.center) ?? 0;
  const endElev = to.elevation ?? map.queryTerrainElevation(to.center) ?? 0;
  const userEvents = ['mousedown', 'wheel', 'touchstart'] as const;
  /** 看门狗定时器句柄：rAF 因页面隐藏等原因停摆时强制释放贴地接管 */
  let watchdog = 0;
  /** 结束本实例对「中心贴地」的接管：清理交互监听与看门狗、释放在飞持有，
   *  并仅在无其他在飞实例（快速切景点时后起飞者已接管）时把贴地交还给 maplibre。
   *  幂等：可被落地帧、取消帧、用户交互监听、看门狗多路触发 */
  function releaseGroundClamp(): void {
    if (watchdog) { clearTimeout(watchdog); watchdog = 0; }
    userEvents.forEach((ev) => map.off(ev, releaseGroundClamp));
    activeFlights.delete(self);
    if (activeFlights.size === 0) map.setCenterClampedToGround(true);
  }
  /* 用户交互即时释放：rAF 可能因页面隐藏暂停而令逐帧检查失效，
     交互事件（与 tour.ts 的 interacted 取消标记同源）直接触发释放 */
  userEvents.forEach((ev) => map.once(ev, releaseGroundClamp));
  const self = {};
  activeFlights.add(self);
  /* 看门狗：飞行应有时长内跑完；超时（rAF 停摆等异常）后强制释放，恢复后落地帧会幂等重入 */
  watchdog = window.setTimeout(() => releaseGroundClamp(), durationMs + 5000);
  /** 把相机从当前状态 550ms 平滑融到 to：落点自验失败时的兜底二次进近 */
  function blendToTarget(): void {
    const t0 = performance.now();
    const step = (): void => {
      if (options.shouldCancel?.()) { options.onSettle?.(false); return; }
      const w = smoothstep(Math.min(1, (performance.now() - t0) / 550));
      if (w >= 1) {
        map.jumpTo({ center: to.center, zoom: to.zoom, pitch: to.pitch, bearing: to.bearing });
        options.onSettle?.(true);
        return;
      }
      const c = map.getCenter();
      map.jumpTo({
        center: [lerp(c.lng, to.center[0], w), lerp(c.lat, to.center[1], w)],
        zoom: lerp(map.getZoom(), to.zoom, w),
        pitch: lerp(map.getPitch(), to.pitch, w),
        bearing: lerpBearing(map.getBearing(), to.bearing, w),
      });
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  /** 落点自验：结束后两帧检查目标是否居中（center 即目标点，理论上恒为 0 偏移） */
  function verifyLanding(): void {
    requestAnimationFrame(() => {
      if (options.shouldCancel?.()) { options.onSettle?.(false); return; }
      const p = map.project(to.center);
      const canvas = map.getCanvas();
      const off = Math.hypot(p.x - canvas.clientWidth / 2, p.y - canvas.clientHeight / 2);
      if (off > 40) {
        console.warn(`[panoscape] 飞行落点偏移 ${Math.round(off)}px，执行平滑二次进近`);
        blendToTarget();
        return;
      }
      options.onSettle?.(true);
    });
  }
  /* 朝向状态机：从起始朝向出发，以限速增量追踪「期望朝向」，绝不突变。
     期望朝向 = 注视目标点（后半程按比例混入目标取景朝向）；
     ±180° 恰好对跖时最短弧方向不定，沿用上一帧的转向侧避免原地抖动 */
  let bearingCur = from.bearing;
  let lastDeltaSign = 0;
  /** 逐帧推进：t 为时间进度，k 为 smoothstep 缓动后的里程进度 */
  let startT = 0;
  let lastNow = 0;
  const frame = (now: number): void => {
    if (!startT) startT = now;
    const dt = lastNow ? Math.min(64, Math.max(8, now - lastNow)) : 16.7;
    lastNow = now;
    const t = Math.min(1, (now - startT) / durationMs);
    if (options.shouldCancel?.()) {
      releaseGroundClamp();
      options.onSettle?.(false);
      return;
    }
    const k = smoothstep(t);
    if (k >= 1) {
      releaseGroundClamp();
      map.jumpTo({ center: to.center, zoom: to.zoom, pitch: to.pitch, bearing: to.bearing });
      verifyLanding();
      return;
    }
    const center: [number, number] = [
      lerp(from.center[0], to.center[0], k),
      lerp(from.center[1], to.center[1], k),
    ];
    /* 期望朝向：注视目标；后半程 wTurn 渐增，把终点朝向差摊到整个后半程缓转完成 */
    const lookAt = bearingBetween(center, to.center);
    const wTurn = k > 0.5 ? smoothstep((k - 0.5) / 0.5) : 0;
    const desired = lerpBearing(lookAt, to.bearing, wTurn);
    let delta = shortestDelta(bearingCur, desired);
    if (Math.abs(delta) > 175 && Math.abs(lastDeltaSign - Math.sign(delta)) > 1) {
      delta = -Math.sign(delta) * (360 - Math.abs(delta));
    }
    if (delta) lastDeltaSign = Math.sign(delta);
    const maxStep = (BEARING_TURN_RATE * dt) / 1000;
    bearingCur += Math.min(maxStep, Math.max(-maxStep, delta));
    /* 缩放/俯仰：起步融入段并入巡航值，终端进近段收敛到目标相机；海拔显式平滑插值 */
    let zoom: number;
    let pitch: number;
    if (k < inFrac) {
      const w = smoothstep(k / inFrac);
      zoom = lerp(from.zoom, cruiseZoom, w);
      pitch = lerp(from.pitch, cruisePitch, w);
    } else if (k > 1 - outFrac) {
      const w = smoothstep((k - (1 - outFrac)) / outFrac);
      zoom = lerp(cruiseZoom, to.zoom, w);
      pitch = lerp(cruisePitch, to.pitch, w);
    } else {
      zoom = cruiseZoom;
      pitch = cruisePitch;
    }
    map.jumpTo({
      center,
      zoom,
      pitch,
      bearing: ((bearingCur % 360) + 360) % 360,
      elevation: lerp(startElev, endElev, k),
    });
    requestAnimationFrame(frame);
  };
  map.setCenterClampedToGround(false);
  requestAnimationFrame(frame);
}
