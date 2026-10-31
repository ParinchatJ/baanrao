// Pixel icons for บ้านเรา (generated)
const PAL = {"K": "#1A1A1A", "W": "#FFFFFF", "Y": "#FFEC89", "O": "#FFAD33", "R": "#CC1400", "G": "#6BAA75", "P": "#F6B7C3", "B": "#6698CC", "U": "#967CC7", "N": "#8B5A2B", "L": "#BFDDF0", "M": "#A8D5C2"};
const G = {
"house": "......KK......\n.....KRRK.....\n....KRRRRK....\n...KRRRRRRK...\n..KRRRRRRRRK..\n.KKKKKKKKKKKK.\n..KWWWWWWWWK..\n..KWLLWWKKWK..\n..KWLLWWKOWK..\n..KWWWWWKOWK..\n..KWWWWWKOWK..\n..KKKKKKKKKK..",
"sofa": "..KKKKKKKKKK..\n..KUUUUUUUUK..\n.KKUUUUUUUUKK.\nKUUKUUUUUUKUUK\nKUUKKKKKKKKUUK\nKUUUUUUUUUUUUK\nKUUUUUUUUUUUUK\nKKKKKKKKKKKKKK\n.KK........KK.",
"bed": "KK............\nKWK...........\nKWKKKKK.......\nKWKWWWK.......\nKWKKKKKKKKKKKK\nKWKBBBBBBBBBBK\nKKKKKKKKKKKKKK\nKBBBBBBBBBBBBK\nKKKKKKKKKKKKKK\nKK..........KK",
"tree": "....KKKK....\n..KKGGGGKK..\n.KGGGGGGGGK.\nKGGGWGGGGGGK\nKGGGGGGGGGGK\nKGGGGGGGWGGK\n.KGGGGGGGGK.\n..KKKGGKKK..\n....KNNK....\n....KNNK....\n...KKKKKK...",
"cat": "K..........K\nKK........KK\nKOK......KOK\nKOOKKKKKKOOK\nKOOOOOOOOOOK\nKOOKKOOKKOOK\nKOOKWOOKWOOK\nKOOOOPPOOOOK\nKWOOOOOOOOWK\n.KOOOOOOOOK.\n..KKKKKKKK..",
"bell": "....KKK....\n...KYYYK...\n..KYYYYYK..\n..KYWYYYK..\n..KYWYYYK..\n.KYYYYYYYK.\n.KYYYYYYYK.\nKYYYYYYYYYK\nKKKKKKKKKKK\n....KOK....\n.....K.....",
"coin": "...KKKKKK...\n..KOOOOOOK..\n.KOOWOOOOOK.\nKOOOKKKKOOOK\nKOOOKOOOOOOK\nKOOOKKKKOOOK\nKOOOOOOKOOOK\nKOOOKKKKOOOK\n.KOOOOOOOOK.\n..KOOOOOOK..\n...KKKKKK...",
"shield": "KKKKKKKKKKK\nKGGGGGGGGGK\nKGGGGWGGGGK\nKGGGGWGGGGK\nKGGWWWWWGGK\nKGGGGWGGGGK\nKGGGGWGGGGK\n.KGGGGGGGK.\n..KGGGGGK..\n...KGGGK...\n....KKK....",
"wrench": "........KKK.\n.......KBBK.\n......KBBK..\n...K.KBBBK.K\n....KBBBBBKK\n...KBBBBBBK.\n..KBBBKKKK..\n.KBBBK......\nKBBBK.......\nKBBK........\n.KK.........",
"piggy": "..K.......K..\n.KPK.....KPK.\n.KPPKKKKKPPK.\nKPPPPPPPPPPPK\nKPPKPPPPKPPPK\nKPPPPPPPPPKKK\nKPPPPPPPPPKPK\nKPPPPPPPPPKKK\n.KPPPPPPPPPK.\n..KK.KK.KK...",
"cal": ".K..K..K..K.\nKKKKKKKKKKKK\nKRRRRRRRRRRK\nKKKKKKKKKKKK\nKWWWWWWWWWWK\nKWKKWWKKWWWK\nKWKKWWKKWWWK\nKWWWWWWWWWWK\nKWKKWWWWWWWK\nKWKKWWWWWWWK\nKKKKKKKKKKKK",
"note": "KKKKKKKK..\nKWWWWWWKK.\nKWKKKKWKWK\nKWWWWWWKKK\nKWKKKKKWWK\nKWWWWWWWWK\nKWKKKKKWWK\nKWWWWWWWWK\nKKKKKKKKKK",
"bath": "KK..........\nKWK.........\nKWK.........\nKKKKKKKKKKKK\nKLLLLLLLLLLK\nKLWLLLLLLLLK\n.KLLLLLLLLK.\n..KKKKKKKK..\n..K......K..",
"plus": "...KKK...\n...KWK...\n...KWK...\nKKKKWKKKK\nKWWWWWWWK\nKKKKWKKKK\n...KWK...\n...KWK...\n...KKK...",
"back": "...K......\n..KK......\n.KWKKKKKKK\nKWWWWWWWWK\n.KWKKKKKKK\n..KK......\n...K......",
"syringe": "..........KK\n.........KWK\n........KWK.\n...KKKKKKK..\n..KBBBBWK...\n.KBBBBBK....\nKKBBBBK.....\n.KKBBK......\nK.KKK.......",
"fish": ".....KKKK...K\n...KKBBBBK.KK\n..KBBBBBBBKBK\n.KBWBBBBBBBBK\n.KBBBBBBBBKBK\n..KBBBBBBK.KK\n...KKBBBBK..K\n.....KKKK....",
"pin": "..KKKK..\n.KRRRRK.\nKRRWWRRK\nKRRWWRRK\n.KRRRRK.\n..KRRK..\n...KK...",
"snow": ".....K.....\n..K..K..K..\n...K.K.K...\n....KKK....\nKKKKKWKKKKK\n....KKK....\n...K.K.K...\n..K..K..K..\n.....K.....",
"trash": "...KKKK...\nKKKKKKKKKK\nKWWWWWWWWK\nKKKKKKKKKK\n.KGGGGGGK.\n.KGKGGKGK.\n.KGKGGKGK.\n.KGKGGKGK.\n.KGGGGGGK.\n..KKKKKK..",
"sun": "...K..K...\n.K.KKKK.K.\n..KYYYYK..\nKKYYYYYYKK\n.KYYYYYYK.\n.KYYYYYYK.\nKKYYYYYYKK\n..KYYYYK..\n.K.KKKK.K.\n...K..K...",
"cloud": "....KKKK......\n...KWWWWK.....\n.KKWWWWWWKKK..\nKWWWWWWWWWWWK.\nKWWWWWWWWWWWWK\n.KKKKKKKKKKKK.",
"pot": "....KKKK....\n...K....K...\nKKKKKKKKKKKK\n.KRRRRRRRRK.\nKKRWRRRRRRKK\n.KRRRRRRRRK.\n.KRRRRRRRRK.\n..KKKKKKKK.."
};
export function px(name, cell = 3, label = '') {
  const rows = (G[name] || G.note).split('\n');
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  let rects = '';
  rows.forEach((r, y) => {
    let x = 0;
    while (x < r.length) {
      const c = r[x];
      if (c === '.') { x++; continue; }
      let x2 = x;
      while (x2 < r.length && r[x2] === c) x2++;
      rects += `<rect x="${x}" y="${y}" width="${x2 - x}" height="1" fill="${PAL[c]}"/>`;
      x = x2;
    }
  });
  const aria = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="pxi" width="${w * cell}" height="${h * cell}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" ${aria}>${rects}</svg>`;
}
export const ICON_NAMES = Object.keys(G);
