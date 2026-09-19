/**
 * 360° 全景模块：封装百度地图 JSAPI GL 全景组件的按需加载、
 * WGS-84 → BD-09 坐标转换与全屏遮罩的生命周期，供游览页景点卡片调用。
 */
import { BAIDU_MAP_AK } from './config';
import type { Pano720Item } from './types';
import './pano.css';

/** 百度 JSAPI GL 脚本地址（ak 与 callback 参数由 loadBaiduGL 动态拼接） */
const BAIDU_GL_URL = 'https://api.map.baidu.com/api/gl?v=1.0&type=webgl';

/** 全景宿主容器固定 id：BMapGL.Panorama 构造时以 id 字符串定位容器 */
const PANO_HOST_ID = 'psc-pano-host';

/** 脚本加载单例：多次打开全景复用同一次脚本注入 */
let baiduGLPromise: Promise<any> | null = null;

/** 当前百度全景实例；关闭遮罩时销毁以释放 WebGL 资源 */
let panoInstance: any = null;

/** PanoramaService 覆盖预检服务单例（轻量对象，随脚本缓存） */
let panoService: any = null;

/** 遮罩及内部关键 DOM（懒创建后缓存复用） */
let overlayEl: HTMLElement | null = null;
let veilEl: HTMLElement | null = null;
let captionEl: HTMLElement | null = null;
let switchEl: HTMLElement | null = null;

/** 当前打开的 720 云漫游条目清单与激活下标（单链接时长度为 1，隐藏切换组） */
let pano720Items: Pano720Item[] = [];

/** GCJ-02 偏移计算所用克拉索夫斯基椭球长半轴（米） */
const ELLIPSOID_A = 6378245;

/** GCJ-02 偏移计算所用椭球第一偏心率平方 */
const ELLIPSOID_EE = 0.00669342162296594323;

/** 判断坐标是否落在中国范围外：境外无 GCJ-02 偏移，直接原样返回 */
function outOfChina(lng: number, lat: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

/** GCJ-02 纬度偏移多项式（公开通用近似算法） */
function transformLat(x: number, y: number): number {
  let ret = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
  ret += (20 * Math.sin(y * Math.PI) + 40 * Math.sin(y / 3 * Math.PI)) * 2 / 3;
  ret += (160 * Math.sin(y / 12 * Math.PI) + 320 * Math.sin(y * Math.PI / 30)) * 2 / 3;
  return ret;
}

/** GCJ-02 经度偏移多项式（公开通用近似算法） */
function transformLng(x: number, y: number): number {
  let ret = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
  ret += (20 * Math.sin(x * Math.PI) + 40 * Math.sin(x / 3 * Math.PI)) * 2 / 3;
  ret += (150 * Math.sin(x / 12 * Math.PI) + 300 * Math.sin(x / 30 * Math.PI)) * 2 / 3;
  return ret;
}

/** WGS-84 → GCJ-02 火星坐标：标准椭球偏移近似，误差约 1-2 米 */
function wgs84ToGcj02(lng: number, lat: number): [number, number] {
  let dLat = transformLat(lng - 105, lat - 35);
  let dLng = transformLng(lng - 105, lat - 35);
  const radLat = (lat / 180) * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - ELLIPSOID_EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180) / ((ELLIPSOID_A * (1 - ELLIPSOID_EE)) / (magic * sqrtMagic) * Math.PI);
  dLng = (dLng * 180) / (ELLIPSOID_A / sqrtMagic * Math.cos(radLat) * Math.PI);
  return [lng + dLng, lat + dLat];
}

/** GCJ-02 → BD-09 百度坐标：公开通用算法 */
function gcj02ToBd09(lng: number, lat: number): [number, number] {
  const z = Math.sqrt(lng * lng + lat * lat) + 0.00002 * Math.sin(lat * Math.PI * 3000 / 180);
  const theta = Math.atan2(lat, lng) + 0.000003 * Math.cos(lng * Math.PI * 3000 / 180);
  return [z * Math.cos(theta) + 0.0065, z * Math.sin(theta) + 0.006];
}

/** WGS-84 → BD-09 组合转换：把 OSM 景点坐标换算为百度 API 所需坐标，避免数百米偏移导致匹配错位 */
function wgs84ToBd09(lngLat: [number, number]): [number, number] {
  const [lng, lat] = lngLat;
  if (outOfChina(lng, lat)) return [lng, lat];
  const [gcjLng, gcjLat] = wgs84ToGcj02(lng, lat);
  return gcj02ToBd09(gcjLng, gcjLat);
}

/**
 * 按需注入百度 JSAPI GL 脚本并等待全局 BMapGL 就绪。
 * 返回 BMapGL 命名空间；AK 未配置或脚本失败时以特定 message reject 供调用方区分提示。
 */
function loadBaiduGL(): Promise<any> {
  if (baiduGLPromise) return baiduGLPromise;
  const promise = new Promise<any>((resolve, reject) => {
    if (!BAIDU_MAP_AK) {
      reject(new Error('PANO_NO_AK'));
      return;
    }
    const existing = (window as any).BMapGL;
    if (existing) {
      resolve(existing);
      return;
    }
    /* JSONP 式 callback：由百度脚本加载完成后显式回调，比 onload 时机更可靠 */
    const callbackName = '__pscBaiduGLReady';
    (window as any)[callbackName] = (): void => {
      delete (window as any)[callbackName];
      const gl = (window as any).BMapGL;
      if (gl) {
        resolve(gl);
      } else {
        reject(new Error('PANO_SCRIPT_ERROR'));
      }
    };
    const script = document.createElement('script');
    script.src = `${BAIDU_GL_URL}&ak=${encodeURIComponent(BAIDU_MAP_AK)}&callback=${callbackName}`;
    script.onerror = (): void => {
      script.remove();
      reject(new Error('PANO_SCRIPT_ERROR'));
    };
    document.head.appendChild(script);
    /* 弱网/白名单拒绝时的兜底超时，避免永久停留在加载态 */
    window.setTimeout(() => {
      if ((window as any).BMapGL) return;
      script.remove();
      reject(new Error('PANO_SCRIPT_TIMEOUT'));
    }, 15000);
  });
  /* 失败后清空单例，让下次点击可以重试 */
  promise.catch(() => {
    baiduGLPromise = null;
  });
  baiduGLPromise = promise;
  return promise;
}

/** 创建并缓存全景遮罩 DOM（懒创建，直接挂载到 body，与游览页容器解耦） */
function ensureOverlay(): HTMLElement {
  if (overlayEl) return overlayEl;
  const el = document.createElement('div');
  el.className = 'psc-pano';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', '360 度全景');
  el.innerHTML = `
    <div class="psc-pano-host" id="${PANO_HOST_ID}"></div>
    <div class="psc-pano-veil">
      <div class="psc-pano-ring"></div>
      <p class="psc-pano-msg"></p>
    </div>
    <div class="psc-pano-top">
      <div class="psc-pano-caption"></div>
      <div class="psc-pano-switch"></div>
      <button type="button" class="psc-pano-close" aria-label="关闭全景">✕</button>
    </div>
  `;
  el.querySelector('.psc-pano-close')!.addEventListener('click', () => closePanoOverlay());
  veilEl = el.querySelector('.psc-pano-veil')!;
  captionEl = el.querySelector('.psc-pano-caption')!;
  switchEl = el.querySelector('.psc-pano-switch')!;
  document.body.appendChild(el);
  overlayEl = el;
  return el;
}

/** 控制遮罩覆盖层状态：loading=加载圈、info=纯文字提示、hidden=隐藏露出全景 */
function showVeil(mode: 'loading' | 'info' | 'hidden', text = ''): void {
  if (!veilEl) return;
  if (mode === 'hidden') {
    veilEl.classList.remove('visible');
    return;
  }
  veilEl.querySelector<HTMLElement>('.psc-pano-msg')!.textContent = text;
  veilEl.querySelector<HTMLElement>('.psc-pano-ring')!.style.display = mode === 'loading' ? '' : 'none';
  veilEl.classList.add('visible');
}

/**
 * 按坐标预检百度全景覆盖。
 * 返回 pid（有覆盖）、null（确认无覆盖）或 undefined（服务异常/超时，未知，交由 setPosition 兜底展示）。
 */
function probePanorama(gl: any, point: any): Promise<string | null | undefined> {
  return new Promise((resolve) => {
    try {
      if (!gl.PanoramaService) {
        resolve(undefined);
        return;
      }
      if (!panoService) panoService = new gl.PanoramaService();
      /* 预检超时视为「未知」而非失败，不阻塞主流程 */
      const timer = window.setTimeout(() => resolve(undefined), 6000);
      panoService.getPanoramaByLocation(point, (res: any) => {
        window.clearTimeout(timer);
        const pid = res?.id ?? res?.pid ?? null;
        resolve(pid || null);
      });
    } catch {
      resolve(undefined);
    }
  });
}

/** 在全景宿主中嵌入 720 云漫游 iframe；加载完成或超时后撤掉加载覆盖层 */
function showPanoIframe(host: HTMLElement, url: string): void {
  showVeil('loading', '正在加载全景…');
  const iframe = document.createElement('iframe');
  iframe.src = url;
  iframe.className = 'psc-pano-iframe';
  iframe.title = '720 云全景漫游';
  iframe.allowFullscreen = true;
  iframe.addEventListener('load', () => showVeil('hidden'), { once: true });
  host.replaceChildren(iframe);
  /* 跨域页面的 load 事件偶发不可靠，12 秒兜底撤掉加载态 */
  window.setTimeout(() => {
    if (host.contains(iframe)) showVeil('hidden');
  }, 12000);
}

/** 归一化 720 云配置：单链接、裸链接数组与命名条目数组统一为条目数组 */
function normalizePano720(config: string | (string | Pano720Item)[]): Pano720Item[] {
  const list = Array.isArray(config) ? config : [config];
  return list.map((item, index) =>
    typeof item === 'string' ? { name: `全景 ${index + 1}`, url: item } : item,
  );
}

/** 渲染 720 云漫游切换按钮组：仅一条时隐藏；点击换装 iframe 内容并同步高亮 */
function renderPanoSwitch(): void {
  if (!switchEl) return;
  if (pano720Items.length <= 1) {
    switchEl.style.display = 'none';
    return;
  }
  switchEl.style.display = '';
  switchEl.replaceChildren(
    ...pano720Items.map((item, index) => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'psc-pano-pill' + (index === 0 ? ' active' : '');
      pill.textContent = item.name;
      pill.addEventListener('click', () => {
        switchEl!.querySelectorAll('.psc-pano-pill').forEach((p, i) => p.classList.toggle('active', i === index));
        showPanoIframe(document.getElementById(PANO_HOST_ID)!, item.url);
      });
      return pill;
    }),
  );
}

/**
 * 打开某景点的 360° 全景遮罩。
 * 参数 attraction：含 name（展示）与 lngLat（WGS-84，OSM 坐标）的景点对象；
 * 参数 opts.heading：初始朝向（度，北为 0 顺时针），通常传地图当前 bearing 实现视角联动；
 * 参数 opts.pano720：720 云漫游嵌入地址（景区级配置的备选内容源），仅在百度 AK 留空时启用。
 * 副作用：向 body 插入遮罩、按需注入百度脚本、创建/复用 BMapGL.Panorama 实例。
 */
export async function openPanoOverlay(
  attraction: { name: string; lngLat: [number, number] },
  opts: { heading?: number; pano720?: string | Pano720Item[] } = {},
): Promise<void> {
  const el = ensureOverlay();
  el.classList.add('open');
  if (switchEl) switchEl.style.display = 'none';
  /* AK 未配置时启用 720 云备选源；两者皆缺省则提示敬请期待 */
  if (!BAIDU_MAP_AK && opts.pano720) {
    pano720Items = normalizePano720(opts.pano720);
    /* 空数组配置视为未配置：走「未上线」提示，避免下方取 [0] 崩溃 */
    if (pano720Items.length === 0) {
      if (captionEl) captionEl.textContent = attraction.name;
      showVeil('info', '360° 全景功能即将上线，敬请期待');
      return;
    }
    if (captionEl) captionEl.textContent = `${attraction.name} · 全景来源：720云`;
    renderPanoSwitch();
    showPanoIframe(document.getElementById(PANO_HOST_ID)!, pano720Items[0].url);
    return;
  }
  if (captionEl) captionEl.textContent = `${attraction.name} · 全景来源：百度地图`;
  showVeil('loading', '正在加载全景…');
  try {
    const gl = await loadBaiduGL();
    const [lng, lat] = wgs84ToBd09(attraction.lngLat);
    const point = new gl.Point(lng, lat);
    const pid = await probePanorama(gl, point);
    if (pid === null) {
      showVeil('info', '该景点暂无百度全景覆盖，换个景点试试');
      return;
    }
    if (!panoInstance) {
      /* 官方示例以工厂形式调用（不带 new），这里做两种调用方式的兼容处理 */
      const ctor = gl.Panorama as any;
      try {
        panoInstance = new ctor(PANO_HOST_ID);
      } catch {
        panoInstance = ctor(PANO_HOST_ID);
      }
    }
    /* 有 pid 时按 id 精确定位机位；预检未知时退化为按坐标就近取景 */
    if (pid !== undefined) {
      panoInstance.setId(pid);
    } else {
      panoInstance.setPosition(point);
    }
    panoInstance.setPov({ heading: opts.heading ?? 0, pitch: 0 });
    showVeil('hidden');
  } catch (error) {
    const code = (error as Error)?.message;
    const tips: Record<string, string> = {
      /* AK 未配置视为「功能未上线」，面向访客展示，不暴露配置细节 */
      PANO_NO_AK: '360° 全景功能即将上线，敬请期待',
      PANO_SCRIPT_ERROR: '百度全景脚本加载失败：请检查网络，或确认 AK 的 Referer 白名单包含当前域名',
      PANO_SCRIPT_TIMEOUT: '百度全景脚本加载超时：请检查网络后重试',
    };
    if (captionEl && code === 'PANO_NO_AK') {
      /* 未上线态不显示数据来源署名（尚无实际内容） */
      captionEl.textContent = attraction.name;
    }
    showVeil('info', tips[code] ?? '全景加载失败，请稍后重试');
  }
}

/** 关闭全景遮罩并销毁实例释放资源；脚本与预检服务保留以复用 */
export function closePanoOverlay(): void {
  if (!overlayEl || !overlayEl.classList.contains('open')) return;
  overlayEl.classList.remove('open');
  /* 覆盖层必须同步隐藏：否则透明遮罩下 veil 仍以 pointer-events:auto 拦截页面点击 */
  showVeil('hidden');
  if (panoInstance) {
    try {
      /* 类参考未列明销毁方法，防御式调用，再清空宿主兜底移除内部 canvas */
      panoInstance.destroy?.();
    } catch {
      /* 忽略销毁阶段的异常 */
    }
    panoInstance = null;
  }
  const host = document.getElementById(PANO_HOST_ID);
  if (host) host.innerHTML = '';
}

/** 查询全景遮罩是否处于打开状态（供全局 ESC 关闭链路判定优先级） */
export function isPanoOverlayOpen(): boolean {
  return !!overlayEl?.classList.contains('open');
}
