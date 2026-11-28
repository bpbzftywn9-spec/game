# BGMのループ位置を探す。使い方: python3 tools/bgm_loop.py 曲1.mp3 曲2.mp3 ...（ffmpeg と numpy が必要）
# 出力の ls / le を index.html の BGM に書き、le で切って web/bgm/ に置く（AGENTS.md の「次にやること」）
import sys,subprocess,numpy as np
SR=22050;HOP=512;XF=2.5
def load(p):
  r=subprocess.run(['ffmpeg','-v','error','-i',p,'-ac','1','-ar',str(SR),'-f','f32le','-'],capture_output=True,check=True)
  return np.frombuffer(r.stdout,dtype=np.float32)
def feats(x):
  n=(len(x)-2048)//HOP;w=np.hanning(2048).astype(np.float32)
  fr=np.lib.stride_tricks.as_strided(x,shape=(n,2048),strides=(x.strides[0]*HOP,x.strides[0]))
  S=np.abs(np.fft.rfft(fr*w,axis=1))**2
  ed=np.geomspace(40,10000,33);fq=np.fft.rfftfreq(2048,1/SR)
  B=np.stack([S[:,(fq>=ed[i])&(fq<ed[i+1])].sum(1) for i in range(32)],1)
  L=np.log(B+1e-9);rms=np.sqrt((fr**2).mean(1))
  on=np.maximum(0,np.diff(L,axis=0,prepend=L[:1])).sum(1)
  return L,rms,on
for p in sys.argv[1:]:
  x=load(p);dur=len(x)/SR;L,rms,on=feats(x);fps=SR/HOP
  sm=np.convolve(rms,np.ones(int(fps))/fps,'same');med=np.median(sm)
  loud=np.where(sm>.6*med)[0];end=loud[-1]/fps  # 曲の終わり（フェードの手前）
  Z=(L-L.mean(0))/(L.std(0)+1e-6)
  W=int(6*fps)  # 6秒の窓で似ているところ
  i0,i1=int(4*fps),int(min(45,dur*.35)*fps)
  jmin=int(max(dur*.45,(i1/fps)+40)*fps);jmax=int((end-XF-1)*fps)-W
  Zi=np.stack([Z[i:i+W].ravel() for i in range(i0,i1,2)]);Zi/=np.linalg.norm(Zi,axis=1,keepdims=True)
  cand=[]
  for j in range(jmin,jmax,2):
    v=Z[j:j+W].ravel();v=v/np.linalg.norm(v);c=Zi@v
    for k in np.argsort(c)[-3:]:cand.append((c[k],i0+2*k,j))
  cand.sort(reverse=True);best=None
  for c,i,j in cand[:300]:
    for d in range(-3,4):
      ii=i+d
      r=np.corrcoef(on[ii:ii+W],on[j:j+W])[0,1]
      v1=Z[ii:ii+W].ravel();v2=Z[j:j+W].ravel();cc=v1@v2/np.linalg.norm(v1)/np.linalg.norm(v2)
      sc=cc+.5*r+.1*(j-jmin)/max(1,jmax-jmin)
      if best is None or sc>best[0]:best=(sc,ii,j,cc,r)
  _,i,j,c,r=best
  ls=i*HOP/SR;le=j*HOP/SR+XF
  print(f"{p.split('/')[-1][:-4]:16s} dur={dur:6.1f} end={end:6.1f} ls={ls:6.2f} le={le:6.2f} loop={le-ls:5.1f}s sim={c:.3f} onset_r={r:.2f}")
