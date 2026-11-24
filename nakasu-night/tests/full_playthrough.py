# 全7章＋サブ3本の自動通しテスト。nakasu-night/ で `npm run serve` を起動してから実行する。
# three.js は web/lib/three/ に同梱しているので、web/index.html をそのまま開く（ネット接続不要）。
import asyncio, os
from playwright.async_api import async_playwright
JS='''(()=>{const G=__G;if(G.mode==='talk'){G.advance();G.advance();return 'talk';}
if(G.mode!=='play')return G.mode;
const h=G.hostiles();if(h.length){const e=h[0];G.P.x=e.x+1.2;G.P.z=e.z;G.P.heat=100;G.knockOut(e,0);return 'ko '+e.name;}
if(G.S.wanted>0){G.S.wanted=0;return 'unwant';}
if(G.S.goal&&G.S.goal.target){G.S.goal.hp=0;return 'van';}
if(G.S.goal){G.P.x=G.S.goal.x;G.P.z=G.S.goal.z;return 'goal';}
const s=window.__step||0;return 'idle';})()'''
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(**({'executable_path':os.environ['CHROME']} if os.environ.get('CHROME') else {}),args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    pg=await b.new_page(viewport={'width':420,'height':820})
    errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8123/web/index.html'); await pg.wait_for_function("!document.getElementById('bNew').disabled",timeout=180000)
    await pg.click('#bNew'); await pg.wait_for_timeout(500)
    # 序章（動画→会話）が終わってセーブされるまで待つ。途中で第一章を始めると、序章の最後で章番号が0に戻ってしまう
    for i in range(240):
      if await pg.evaluate("!!localStorage.getItem('nakasu_night_v1')"): break
      await pg.evaluate("(()=>{const G=__G;if(G.mode==='talk'){G.advance();}const k=document.getElementById('cutskip');if(G.mode==='cut'&&k)k.click();})()"); await pg.wait_for_timeout(250)
    shots=0
    for ch in range(7):
      for i in range(12):
        await pg.evaluate("(()=>{const G=__G;if(G.mode==='talk'){G.advance();G.advance();}})()"); await pg.wait_for_timeout(150)
      # start main mission
      r=await pg.evaluate("(()=>{const G=__G;const m=G.markers.find(m=>m.id==='main');G.P.x=m.p.x;G.P.z=m.p.z;G.useMarker(m);return G.S.ch})()")
      print('start ch',r)
      for k in range(220):
        st=await pg.evaluate(JS)
        if k%12==0: print(' ',k,st, await pg.evaluate("__G.S.ch"))
        if st=='ending': break
        if await pg.evaluate("__G.S.ch")>ch and await pg.evaluate("__G.mode")=='play': break
        if k==20 and shots<3:
          await pg.screenshot(path=f's_ch{ch}.png'); shots+=1
        await pg.wait_for_timeout(250)
    await pg.screenshot(path='s_end.png')
    # subs
    await pg.evaluate("document.getElementById('bEndOk').click()");await pg.wait_for_timeout(2500)
    for sid in ['snatch','drunk','fight']:
      await pg.evaluate(f"(()=>{{const G=__G;const m=G.markers.find(m=>m.id==='{sid}');G.P.x=m.p.x;G.P.z=m.p.z;G.useMarker(m);}})()")
      for k in range(120):
        st=await pg.evaluate(JS)
        if sid=='snatch' and st=='idle':
          await pg.evaluate("(()=>{const G=__G;const s=G.actors.find(a=>a.name==='ひったくり犯');if(s){G.P.x=s.x+1;G.P.z=s.z;}})()")
        if sid=='drunk' and st in('idle','goal'):
          await pg.evaluate("(()=>{const G=__G;const d=G.actors.find(a=>a.name==='部長');if(d){d.x=G.POS.taxi.x;d.z=G.POS.taxi.z;}})()")
        done=await pg.evaluate(f"!!__G.S.subs['{sid}']||(__G.S.money>0&&'{sid}'==='fight'&&!__G.mission&&__G.mode==='play'&&!__G.hostiles().length&&{k}>40)")
        if done: break
        await pg.wait_for_timeout(250)
      print(sid, await pg.evaluate("JSON.stringify(__G.S.subs)"), await pg.evaluate("__G.S.money"))
    await pg.screenshot(path='s_sub.png')
    print('ERR','\n'.join(errs[:20]))
    await b.close()
asyncio.run(main())
