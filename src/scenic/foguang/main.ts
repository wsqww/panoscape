import { mountTour } from '../../common/tour';
import { foguang } from './meta';

/** 佛光村游览页入口：向页面根容器挂载通用游览界面并注入佛光村景区数据 */
const root = document.getElementById('app');
if (root) mountTour(root, foguang);
