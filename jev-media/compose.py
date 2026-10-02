#!/usr/bin/env python3
"""Compose real captured Yomitan footage and editorial graphics without downloads.
No popup, score or measurement is generated unless supplied by capture evidence.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import argparse,hashlib,json,subprocess
from diagrams import PAPER,INK,MUTED,SELECTED,CONTEXT,RULE,FONT,JP,MONO
W,H,FPS=1080,1350,30
MINCHO='/System/Library/Fonts/ヒラギノ明朝 ProN.ttc'
def font(size,jp=False,serif=False,mono=False):
 p=MINCHO if serif else JP if jp else MONO if mono else FONT
 return ImageFont.truetype(p,size,index=2 if serif else 5 if p==FONT else 0)
def text(im,xy,label,size=42,color=INK,jp=False,serif=False,mono=False):
 ImageDraw.Draw(im).text(xy,label,font=font(size,jp,serif,mono),fill=color)
def lines(im,xy,labels,size=42,color=INK,spacing=55,jp=False):
 for i,t in enumerate(labels):text(im,(xy[0],xy[1]+i*spacing),t,size,color,jp)
def ease(t):return 1-(1-max(0,min(1,t)))**3

def graphics(t,kind,m):
 im=Image.new('RGB',(W,H),PAPER);d=ImageDraw.Draw(im)
 text(im,(64,54),'YOMITAN + TYPESAFE JEV',24,MUTED)
 if kind=='hook':
  text(im,(64,270),'One word.',72)
  text(im,(64,368),'Many senses.',72)
  text(im,(445,496),'かける',44,jp=True)
  glyph=Image.new('RGBA',(W,320));text(glyph,(256,25),'掛ける',180,serif=True)
  im.paste(glyph,(0,540),glyph)
  text(im,(64,992),f'{m["sense_count"]} senses in this JMdict entry.',39)
  text(im,(64,1050),'Which one fits this sentence?',39)
 elif kind=='end':
  text(im,(64,236),'Same popup.',70);text(im,(64,338),'Now sentence-aware.',70)
  d.line((64,462,480,462),fill=SELECTED,width=4)
  lines(im,(64,540),['Yomitan fork + TypeSafe JEV','An experiment in contextual lookup.'],38,spacing=58)
  lines(im,(64,862),['Built on Yomitan.','Dictionary order is preserved.','Scores are model estimates,','not measured accuracy.'],31,MUTED,spacing=45)
  text(im,(64,1100),'JMdict © EDRDG · CC BY-SA 4.0',25,MUTED)
 elif kind=='how':
  text(im,(64,108),'The popup never waits.',50)
  source=Path(m.get('flow_diagram',Path(__file__).parent/'sense-flow.png'))
  if not source.exists():raise FileNotFoundError('Supply flow_diagram pointing to the real rendered diagram PNG.')
  full=Image.open(source).convert('RGB').crop((0,180,1080,1280)).resize((952,970),Image.Resampling.LANCZOS)
  # Ordered progressive reveal preserves the actual parallel topology.
  for i,(top,bottom) in enumerate([(0,180),(180,410),(410,580),(580,790),(790,970)]):
   amount=ease((t-i*.8)/.35)
   if amount<=0:continue
   band=full.crop((0,top,952,bottom)).convert('RGBA')
   band.putalpha(int(255*amount));im.paste(band,(64,184+top),band)
  text(im,(64,1158),'Only the sentence and senses are sent.',26,MUTED)
 return im

def decoder(clip,duration):
 crop=clip.get('crop');filters=[]
 if crop:filters.append('crop='+':'.join(str(n) for n in [crop[2],crop[3],crop[0],crop[1]]))
 filters+=['scale=952:740:force_original_aspect_ratio=decrease','pad=952:740:(ow-iw)/2:(oh-ih)/2:color=0xF5F2EA',f'fps={FPS}',f'tpad=stop_mode=clone:stop_duration={duration}']
 input_duration=min(duration,clip.get('end',clip.get('start',0)+duration)-clip.get('start',0))
 cmd=['ffmpeg','-v','error','-ss',str(clip.get('start',0)),'-t',str(input_duration),'-i',clip['path'],'-vf',','.join(filters),'-t',str(duration),'-f','rawvideo','-pix_fmt','rgb24','pipe:1']
 return subprocess.Popen(cmd,stdout=subprocess.PIPE)

def footage_frames(kind,clip,duration,m):
 p=decoder(clip,duration);framebytes=952*740*3;last=None
 try:
  for n in range(round(duration*FPS)):
   raw=p.stdout.read(framebytes)
   if len(raw)==framebytes:last=Image.frombytes('RGB',(952,740),raw)
   if last is None:raise RuntimeError(f'Cannot decode captured footage: {clip["path"]}')
   im=Image.new('RGB',(W,H),PAPER);t=n/FPS
   label='YOMITAN · FEATURE OFF' if kind=='before' else 'YOMITAN · ENABLING JEV' if kind=='after' and t<.35 else 'YOMITAN + JEV · FEATURE ON'
   text(im,(64,48),label,24,MUTED)
   sentence=clip['sentence'];jpfont=font(56,jp=True)
   while ImageDraw.Draw(im).textlength(sentence,font=jpfont)>952:jpfont=font(jpfont.size-1,jp=True)
   ImageDraw.Draw(im).text((64,112),sentence,font=jpfont,fill=INK)
   im.paste(last,(64,218))
   if kind=='before':
    lines(im,(64,1010),['The dictionary gives you the senses.','You still have to choose.'],43,spacing=60)
   elif kind=='after':
    lines(im,(64,1010),['Same popup. Same order.','A contextual highlight arrives.' if t<2 else 'Sense #4: “to make (a call)”.'],43,spacing=60)
   elif kind=='glasses':
    lines(im,(64,1010),['Different sentence. Different sense.','Sense #3: “to put on (glasses, etc.)”.'],40,spacing=60)
   elif kind=='ambiguity':
    # The captured result decides the caption, including an overconfident miss.
    lines(im,(64,1010),clip['caption'],40,spacing=58)
   text(im,(64,1154),'Real browser footage · 1× playback' if kind=='before' else 'Model estimates, not measured accuracy · 1× playback',24,MUTED)
   yield im
 finally:
  p.stdout.close();p.wait(timeout=30)

def main():
 ap=argparse.ArgumentParser();ap.add_argument('manifest');ap.add_argument('output');args=ap.parse_args()
 m=json.loads(Path(args.manifest).read_text())
 before=m['clips']['before'];after=m['clips']['after']
 if before['path']==after['path'] and after['start']>before['start']:
  before['end']=min(before.get('end',after['start']),after['start']-1/FPS)
 out=Path(args.output);out.parent.mkdir(parents=True,exist_ok=True)
 assert isinstance(m['sense_count'],int) and m['sense_count']>0
 scenes=[('hook',5),('before',7),('after',9),('glasses',8),('ambiguity',7),('how',8),('end',5)]
 scenes=[(kind,m.get('clips',{}).get(kind,{}).get('duration',dur)) for kind,dur in scenes]
 if not 35<=sum(dur for _,dur in scenes)<=55:raise ValueError('Social cut must be 35–55 seconds.')
 for kind,_ in scenes:
  if kind in ['hook','how','end']:continue
  clip=m['clips'][kind]
  if not Path(clip['path']).is_file():raise FileNotFoundError(clip['path'])
  if 'highlight_at' in clip and clip['highlight_at']-clip.get('start',0)>=dict(scenes)[kind]:raise ValueError('Scene would cut off the observed highlight.')
  if kind=='ambiguity' and not clip.get('caption'):raise ValueError('Ambiguity caption must describe the actual returned result.')
 cmd=['ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','pipe:0','-an','-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',str(out)]
 encoder=subprocess.Popen(cmd,stdin=subprocess.PIPE)
 preview=out.parent/'video-review';preview.mkdir(exist_ok=True);time=0;receipts=[]
 try:
  for kind,dur in scenes:
   print(f'Rendering {kind}: {time}s–{time+dur}s',flush=True)
   frames=(graphics(n/FPS,kind,m) for n in range(round(dur*FPS))) if kind in ['hook','how','end'] else footage_frames(kind,m['clips'][kind],dur,m)
   for i,im in enumerate(frames):
    if i in [0,int(dur*FPS*.55)]:im.save(preview/f'{time+i/FPS:05.1f}-{kind}.png')
    encoder.stdin.write(im.tobytes())
   source=m.get('clips',{}).get(kind,{}).get('path')
   digest=None
   if source:
    with Path(source).open('rb') as handle:digest=hashlib.file_digest(handle,'sha256').hexdigest()
   receipts.append({'scene':kind,'start':time,'duration':dur,'source':source,'source_sha256':digest,'source_start':m.get('clips',{}).get(kind,{}).get('start'),'source_end':m.get('clips',{}).get(kind,{}).get('end'),'speed':1});time+=dur
 finally:encoder.stdin.close()
 code=encoder.wait(timeout=60)
 if code:raise RuntimeError(f'FFmpeg failed: {code}')
 (out.parent/'video-edit-receipt.json').write_text(json.dumps({'duration_seconds':time,'fps':FPS,'resolution':[W,H],'audio':'none','scenes':receipts,'manifest':str(Path(args.manifest).resolve()),'manifest_sha256':hashlib.sha256(Path(args.manifest).read_bytes()).hexdigest(),'sense_count':m['sense_count'],'claims':'No latency or accuracy claims; model probability shown only in original capture.'},indent=2))
 print(out)
if __name__=='__main__':main()
