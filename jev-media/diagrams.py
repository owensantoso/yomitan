#!/usr/bin/env python3
"""Deterministic editorial SVG + PNG diagrams, sharing one geometry source."""
from pathlib import Path
import html, math
from PIL import Image, ImageDraw, ImageFont
PAPER='#F5F2EA';INK='#1B1A17';MUTED='#7D776C';SELECTED='#C2412D';CONTEXT='#2E4766';RULE='#CFC9BD'
FONT='/System/Library/Fonts/Avenir Next.ttc'
JP='/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc'
MONO='/System/Library/Fonts/Menlo.ttc'
class Canvas:
 def __init__(self,w,h,slug,title,desc):
  self.w=w;self.h=h;self.slug=slug;self.im=Image.new('RGB',(w,h),PAPER);self.d=ImageDraw.Draw(self.im)
  self.s=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-labelledby="{slug}-title {slug}-desc"><title id="{slug}-title">{html.escape(title)}</title><desc id="{slug}-desc">{html.escape(desc)}</desc><rect width="{w}" height="{h}" fill="{PAPER}"/>']
 def text(self,x,y,t,size=30,color=INK,family='sans',anchor='start'):
  path=JP if any(ord(ch)>3000 for ch in t) else (MONO if family=='mono' else FONT)
  font=ImageFont.truetype(path,size,index=5 if path==FONT else 0);width=self.d.textlength(t,font=font)
  xx=x-width/2 if anchor=='middle' else x-width if anchor=='end' else x
  self.d.text((xx,y),t,font=font,fill=color)
  f='Menlo, monospace' if family=='mono' else 'Avenir Next, Hiragino Kaku Gothic ProN, sans-serif'
  self.s.append(f'<text x="{x}" y="{y+size}" font-size="{size}" fill="{color}" font-family="{f}" font-weight="500" text-anchor="{anchor}">{html.escape(t)}</text>')
 def rect(self,x,y,w,h,color=RULE,fill=PAPER,r=12,width=2):
  self.d.rounded_rectangle((x,y,x+w,y+h),radius=r,fill=fill,outline=color,width=width)
  self.s.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{color}" stroke-width="{width}"/>')
 def line(self,points,color=MUTED,width=3,dashed=False,arrow=False):
  # Smooth right-angle corners using short quadratic Bezier equivalents.
  coords=[];path=f'M {points[0][0]} {points[0][1]}';coords.append(points[0])
  for i in range(1,len(points)-1):
   p,a,b=points[i],points[i-1],points[i+1];r=min(8,math.dist(a,p)/2,math.dist(p,b)/2)
   u=(p[0]+(a[0]-p[0])*r/math.dist(a,p),p[1]+(a[1]-p[1])*r/math.dist(a,p));v=(p[0]+(b[0]-p[0])*r/math.dist(b,p),p[1]+(b[1]-p[1])*r/math.dist(b,p))
   path+=f' L {u[0]} {u[1]} Q {p[0]} {p[1]} {v[0]} {v[1]}'
   coords.append(u)
   for n in range(1,9):
    t=n/8;coords.append(((1-t)**2*u[0]+2*(1-t)*t*p[0]+t*t*v[0],(1-t)**2*u[1]+2*(1-t)*t*p[1]+t*t*v[1]))
  coords.append(points[-1]);path+=f' L {points[-1][0]} {points[-1][1]}'
  if dashed:
   for a,b in zip(coords,coords[1:]):
    length=math.dist(a,b)
    for s in range(0,int(length),16):
     e=min(s+8,length);self.d.line([(a[0]+(b[0]-a[0])*s/length,a[1]+(b[1]-a[1])*s/length),(a[0]+(b[0]-a[0])*e/length,a[1]+(b[1]-a[1])*e/length)],fill=color,width=width)
  else:self.d.line(coords,fill=color,width=width,joint='curve')
  dash=' stroke-dasharray="8 8"' if dashed else ''
  self.s.append(f'<path d="{path}" fill="none" stroke="{color}" stroke-width="{width}"{dash}/>')
  if arrow:
   a,b=points[-2:];angle=math.atan2(b[1]-a[1],b[0]-a[0]);c=[b,(b[0]-14*math.cos(angle-.4),b[1]-14*math.sin(angle-.4)),(b[0]-14*math.cos(angle+.4),b[1]-14*math.sin(angle+.4))]
   self.d.polygon(c,fill=color);self.s.append(f'<polygon points="'+ ' '.join(f'{x},{y}' for x,y in c)+f'" fill="{color}"/>')
 def node(self,x,y,w,h,n,title,sub,selected=False):
  self.rect(x,y,w,h,SELECTED if selected else RULE,width=3 if selected else 2)
  self.text(x+24,y+20,n,24,SELECTED if selected else MUTED,'mono')
  for i,line in enumerate(title):self.text(x+24,y+60+i*40,line,32)
  for i,line in enumerate(sub):self.text(x+24,y+104+i*28,line,24,MUTED)
 def save(self,out):
  out=Path(out);out.mkdir(parents=True,exist_ok=True);self.im.save(out/(self.slug+'.png'))
  (out/(self.slug+'.svg')).write_text(''.join(self.s)+'</svg>')

def flow(out):
 c=Canvas(1080,1350,'sense-flow','How the sense gets picked','A sentence and installed dictionary senses follow an asynchronous model path while Yomitan renders its popup immediately; validated results highlight a sense in place.')
 c.text(64,48,'How the sense gets picked',49)
 c.text(64,116,'Yomitan + TypeSafe JEV',28,MUTED)
 # Arrows precede nodes; distinct attach positions and no crossings.
 c.line([(540,336),(540,388)],arrow=True)
 c.line([(400,576),(400,620),(288,620),(288,672)],arrow=True)
 c.line([(680,576),(680,620),(792,620),(792,672)],dashed=True,arrow=True)
 c.line([(792,828),(792,896)],arrow=True)
 c.line([(568,980),(512,980)],arrow=True)
 c.line([(288,1064),(288,1088),(384,1088),(384,1120)],color=SELECTED,arrow=True)
 c.node(160,192,760,144,'01',['Shift-hover a word'],['母に電話を掛けた。'])
 c.node(160,388,760,188,'02',['Extract sentence; deinflect; lookup'],['掛けた → 掛ける  ·  installed dictionaries','Sentence + exact occurrence + all sense text'])
 c.node(64,672,448,156,'03',['Popup opens immediately'],['Original dictionary order'])
 c.node(568,672,448,156,'04',['Local bridge'],['127.0.0.1:4183  ·  key stays here'])
 c.node(568,896,448,168,'05',['TypeSafe JEV'],['Remote model: senses + unclear','→ choice + distribution'])
 c.node(64,896,448,168,'06',['Validate the mapping'],['Known IDs; valid probabilities','Current popup; stale replies ignored'])
 c.node(160,1120,760,144,'07',['Highlight the matching sense in place'],['Unclear / failed / stale response: no highlight'],True)
 c.text(64,1300,'Sent: sentence + word + senses. Whole page is excluded.',23,MUTED)
 c.save(out)

def sequence(out):
 c=Canvas(1600,1200,'sense-sequence','From hover to highlight','Five actors exchange dictionary and model data; the popup is rendered before the model answer and no highlight is added for invalid, stale, unclear or failed results.')
 c.text(64,36,'From hover to highlight',52)
 c.text(64,104,'Time flows down. The popup never waits for the model.',28,MUTED)
 xs=[160,480,800,1120,1440];actors=['Reader / page','Yomitan','Popup','Local bridge','TypeSafe JEV']
 for x in xs:c.line([(x,248),(x,1104)],color=RULE,width=2,dashed=True)
 for x,name in zip(xs,actors):c.rect(x-120,184,240,64);c.text(x,196,name,26,anchor='middle')
 def msg(a,b,y,label,color=MUTED,dashed=False):
  c.line([(xs[a],y),(xs[b],y)],color,width=3,dashed=dashed,arrow=True)
  xx=(xs[a]+xs[b])/2
  # Text sits above the horizontal stroke; paper mask avoids lifeline interference.
  width=c.d.textlength(label,font=ImageFont.truetype(FONT,24))+28
  c.rect(xx-width/2,y-44,width,34,color=PAPER,r=0,width=0);c.text(xx,y-43,label,24,color,anchor='middle')
 msg(0,1,332,'Shift-hover + sentence + occurrence')
 c.rect(368,376,224,84);c.text(384,384,'Deinflect + lookup',23);c.text(384,420,'Installed dictionary',21,MUTED)
 msg(1,2,520,'Render all senses now')
 msg(1,3,628,'Sentence / target / reading / surface / offset / candidates',CONTEXT)
 msg(3,4,724,'Constrained choices: every sense + unclear')
 msg(4,3,808,'Choice + distribution',dashed=True)
 msg(3,1,892,'Validate IDs + probabilities; return mapping',dashed=True)
 c.rect(360,936,560,156,r=4)
 c.text(380,948,'ONLY IF',21,MUTED,'mono');c.text(380,982,'Valid, current lookup; chosen sense ≠ unclear',22)
 msg(1,2,1072,'Highlight in original order',SELECTED)
 c.text(64,1136,'Unavailable, invalid, unclear or stale: keep the ordinary usable popup.',26,MUTED)
 c.save(out)

if __name__=='__main__':
 import sys
 out=sys.argv[1] if len(sys.argv)>1 else '.';flow(out);sequence(out)
