'use strict';
// Real-money products. Each one grants weapons directly (no in-game currency),
// so purchases are not a prepaid payment instrument under Japan's Payment
// Services Act. Prices are in JPY, tax included. Item ids match WEAPONS in index.html.
module.exports = [
  { id: 'katana3', name: '模造刀 ×3', desc: '峰打ちでも強い。攻撃×2.4・耐久25回', name_en: 'Replica Katana ×3', desc_en: 'Hits hard, even with the blunt edge. Power ×2.4, 25 uses', price: 120, items: { katana: 3 } },
  { id: 'hammer3', name: 'ハリケーン・ハンマー ×3', desc: '攻撃×3.2の最強クラス・耐久15回', name_en: 'Hurricane Hammer ×3', desc_en: 'Top-tier power ×3.2, 15 uses', price: 250, items: { hammer: 3 } },
  { id: 'fan', name: '黄金の扇子（限定）', desc: 'ここでしか手に入らない。攻撃×2.8・耐久60回', name_en: 'Golden Fan (exclusive)', desc_en: 'Only available here. Power ×2.8, 60 uses', price: 300, items: { fan: 1 } },
  { id: 'jingi', name: '仁義フルセット', desc: '黄金の扇子×2・ハンマー×3・模造刀×3・サーフボード×3', name_en: 'Jingi Full Set', desc_en: 'Golden Fan ×2, Hammer ×3, Katana ×3, Surfboard ×3', price: 600, items: { fan: 2, hammer: 3, katana: 3, board: 3 } },
];
