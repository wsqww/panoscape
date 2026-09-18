import { mountTour } from '../../common/tour';
import { wugongshan } from './meta';

/** 武功山游览页入口：向页面根容器挂载通用游览界面并注入武功山景区数据 */
const root = document.getElementById('app');
if (root) mountTour(root, wugongshan);
