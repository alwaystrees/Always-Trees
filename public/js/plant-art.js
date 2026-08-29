"use strict";

"use strict";
/* ---------- helpers ---------- */
const PPM = 100;                 // pixels per metre
let   SCENE_H = 950;             // viewBox height (recomputed per render)
let   GROUND_Y = 800;            // y of the back-layer ground line
const SOIL_H = 178;              // soil band below the back ground line
const LAYER_DY = {3:0, 2:40, 1:76, 0:96};
const LAYER_OP = {3:0.90, 2:0.96, 1:1, 0:1};
const NS = "http://www.w3.org/2000/svg";

function rng(seed){ let s = seed*9301 % 233280; return ()=>{ s = (s*9301+49297)%233280; return s/233280; }; }
function el(name, attrs, kids){
  const n = document.createElementNS(NS, name);
  for(const k in attrs){ if(attrs[k]!==undefined && attrs[k]!==null) n.setAttribute(k, attrs[k]); }
  if(kids) kids.forEach(c=>c && n.appendChild(c));
  return n;
}
function shade(hex, amt){
  const n = parseInt(hex.slice(1),16);
  let r=(n>>16)&255, g=(n>>8)&255, b=n&255;
  r=Math.max(0,Math.min(255,Math.round(r+amt)));
  g=Math.max(0,Math.min(255,Math.round(g+amt)));
  b=Math.max(0,Math.min(255,Math.round(b+amt)));
  return "#"+((r<<16)|(g<<8)|b).toString(16).padStart(6,"0");
}

/* ---------- plant drawing ---------- */
/* every generator returns SVG nodes in local space:
   origin at the ground point, y grows upward as NEGATIVE, total height = H px */

/* ---------- drawing helpers ---------- */
let BARK = "#7A6A55", BARK_D = "#5E5142", BARK_L = "#98876D";
const BARK_DEF = ["#7A6A55","#5E5142","#98876D"];
function setBark(c){
  if(c){ BARK=c; BARK_D=shade(c,-22); BARK_L=shade(c,24); }
  else { BARK=BARK_DEF[0]; BARK_D=BARK_DEF[1]; BARK_L=BARK_DEF[2]; }
}

function P(x,y){ return x.toFixed(1)+","+y.toFixed(1); }
function qpt(p0,p1,p2,t){
  const u=1-t;
  return [u*u*p0[0]+2*u*t*p1[0]+t*t*p2[0], u*u*p0[1]+2*u*t*p1[1]+t*t*p2[1]];
}
function qtan(p0,p1,p2,t){
  const u=1-t;
  const dx=2*u*(p1[0]-p0[0])+2*t*(p2[0]-p1[0]);
  const dy=2*u*(p1[1]-p0[1])+2*t*(p2[1]-p1[1]);
  const m=Math.hypot(dx,dy)||1;
  return [dx/m, dy/m];
}
/* one tapered leaf: from (x,y) toward angle a, length l, half-width w */
function leaf(x,y,l,a,w,col,bend){
  const rad=a*Math.PI/180;
  const tx=x+Math.cos(rad)*l, ty=y+Math.sin(rad)*l;
  const mx=x+Math.cos(rad)*l*0.5-Math.sin(rad)*(bend||0);
  const my=y+Math.sin(rad)*l*0.5+Math.cos(rad)*(bend||0);
  const px=-Math.sin(rad)*w, py=Math.cos(rad)*w;
  return el("path",{d:`M${P(x,y)} Q${P(mx+px,my+py)} ${P(tx,ty)} Q${P(mx-px,my-py)} ${P(x,y)}Z`, fill:col});
}
/* pinnate frond: curved rachis with leaflets down both sides */
function pinnate(out,cx,cy,len,ang,cols,r,droop,fine){
  const rad=ang*Math.PI/180;
  const p0=[cx,cy];
  const p2=[cx+Math.cos(rad)*len, cy+Math.sin(rad)*len+(droop||0)];
  const p1=[cx+Math.cos(rad)*len*0.52, cy+Math.sin(rad)*len*0.52-len*0.12];
  const n=fine||13;
  for(let i=1;i<=n;i++){
    const t=i/n;
    const p=qpt(p0,p1,p2,t), tg=qtan(p0,p1,p2,t);
    const ta=Math.atan2(tg[1],tg[0])*180/Math.PI;
    const ll=len*0.24*Math.sin(Math.PI*Math.pow(t,0.62))*(0.75+r()*0.5);
    const back=34+r()*16;
    out.push(leaf(p[0],p[1],ll,ta-back,ll*0.11,cols[1],ll*0.10));
    out.push(leaf(p[0],p[1],ll,ta+back,ll*0.11,cols[0],-ll*0.10));
  }
  out.push(el("path",{d:`M${P(p0[0],p0[1])} Q${P(p1[0],p1[1])} ${P(p2[0],p2[1])}`,
    fill:"none",stroke:cols[2],"stroke-width":Math.max(1,len*0.012),"stroke-linecap":"round"}));
}
/* rough canopy mass: dark underside, mid body, lit crown */
function mass(out,cx,cy,rx,ry,cols,r,n){
  const lobes=[];
  for(let i=0;i<n;i++){
    const a=(i/n)*Math.PI*2+r()*0.5;
    const d=0.28+r()*0.66;
    lobes.push([cx+Math.cos(a)*rx*d, cy+Math.sin(a)*ry*d, rx*(0.19+r()*0.17)]);
  }
  lobes.forEach(([x,y,rr])=>out.push(el("ellipse",{cx:x,cy:y+ry*0.10,rx:rr*1.06,ry:rr*0.86,fill:cols[0]})));
  lobes.forEach(([x,y,rr])=>out.push(el("ellipse",{cx:x,cy:y,rx:rr,ry:rr*0.80,fill:cols[1]})));
  lobes.filter(l=>l[1]<cy).forEach(([x,y,rr])=>
    out.push(el("ellipse",{cx:x-rx*0.06,cy:y-ry*0.10,rx:rr*0.62,ry:rr*0.46,fill:cols[2],opacity:.85})));
}
/* tapered trunk with a base flare and a lit edge */
function stem(out,h,topW,botW,tilt){
  const t=tilt||0;
  out.push(el("path",{d:`M${P(-botW*1.35,0)} Q${P(-botW,-h*0.10)} ${P(-topW+t,-h)} L${P(topW+t,-h)} Q${P(botW,-h*0.10)} ${P(botW*1.35,0)}Z`, fill:BARK}));
  out.push(el("path",{d:`M${P(-botW*1.35,0)} Q${P(-botW,-h*0.10)} ${P(-topW+t,-h)} L${P(-topW*0.30+t,-h)} Q${P(-botW*0.30,-h*0.10)} ${P(-botW*0.42,0)}Z`, fill:BARK_L, opacity:.55}));
  out.push(el("path",{d:`M${P(botW*0.45,0)} Q${P(botW*0.55,-h*0.10)} ${P(topW*0.45+t,-h)} L${P(topW+t,-h)} Q${P(botW,-h*0.10)} ${P(botW*1.35,0)}Z`, fill:BARK_D, opacity:.5}));
}
function pal(c){ return [shade(c,-34), c, shade(c,26)]; }

const FORMS = {
  featherPalm(H, r, c){
    const out=[], th=H*0.70, tw=H*0.020, cols=pal(c);
    stem(out, th, tw*0.80, tw*1.55);
    for(let i=1;i<7;i++){
      const y=-th*i/7;
      out.push(el("path",{d:`M${P(-tw*1.25,y)} q${(tw*2.5).toFixed(1)},2.5 ${(tw*2.5).toFixed(1)},0`,fill:"none",stroke:BARK_D,"stroke-width":1.1,opacity:.45}));
    }
    const top=-th, L=H*0.34;
    [-176,-158,-140,-118,-96,-84,-62,-40,-22,-4].forEach(a=>{
      const l=L*(0.78+r()*0.4);
      pinnate(out,0,top,l,a,cols,r,(Math.abs(a+90)>50?l*0.30:l*0.16));
    });
    out.push(el("ellipse",{cx:0,cy:top+H*0.008,rx:tw*1.4,ry:tw*0.9,fill:BARK_D}));
    return out;
  },
  clumpPalm(H, r, c){
    const out=[], n=5, cols=pal(c);
    for(let k=0;k<n;k++){
      const off=(k-(n-1)/2);
      const hh=H*(0.62+r()*0.38), th=hh*0.50, tw=H*0.010;
      const g=el("g",{transform:`translate(${(off*H*0.045).toFixed(1)},0) rotate(${(off*6).toFixed(1)})`});
      const sub=[];
      stem(sub, th, tw*0.9, tw*1.3);
      [-162,-136,-112,-88,-64,-38].forEach(a=>{
        const l=hh*0.44*(0.75+r()*0.42);
        pinnate(sub,0,-th,l,a,cols,r,l*0.34,9);
      });
      sub.forEach(nd=>g.appendChild(nd));
      out.push(g);
    }
    return out;
  },
  fanPalm(H, r, c){
    const out=[], th=H*0.55, tw=H*0.028, cols=pal(c);
    stem(out, th, tw*0.9, tw*1.3);
    const top=-th, L=H*0.42;
    for(let i=0;i<11;i++){
      const a=-178+i*17.8, l=L*(0.80+r()*0.32);
      const rad=a*Math.PI/180;
      const tx=Math.cos(rad)*l, ty=top+Math.sin(rad)*l;
      const nx=-Math.sin(rad), ny=Math.cos(rad);
      const seg=7, pts=[];
      for(let s=-seg;s<=seg;s++){
        const f=s/seg, spread=l*0.30*(1-Math.abs(f)*0.15);
        const notch=(Math.abs(s)%2===0)?0.86:1.0;
        pts.push([tx+nx*spread*f*notch, ty+ny*spread*f*notch + Math.abs(f)*l*0.10]);
      }
      const d="M"+P(0,top)+" L"+pts.map(p=>P(p[0],p[1])).join(" L")+" Z";
      out.push(el("path",{d, fill:i%2?cols[1]:cols[0]}));
      out.push(el("path",{d:`M${P(0,top)} L${P(tx,ty)}`,stroke:cols[2],"stroke-width":Math.max(1,l*0.02),opacity:.6,fill:"none"}));
    }
    return out;
  },
  traveller(H, r, c){
    const out=[], th=H*0.18, cols=pal(c);
    stem(out, th, H*0.028, H*0.045);
    for(let i=0;i<11;i++){
      const a=-172+i*14.4, l=H*0.62*(0.88+r()*0.16);
      const rad=a*Math.PI/180;
      const tx=Math.cos(rad)*l, ty=-th+Math.sin(rad)*l;
      const mx=Math.cos(rad)*l*0.5, my=-th+Math.sin(rad)*l*0.5;
      const w=l*0.085, px=-Math.sin(rad)*w, py=Math.cos(rad)*w;
      out.push(el("path",{d:`M${P(0,-th)} Q${P(mx+px,my+py)} ${P(tx,ty)} Q${P(mx-px,my-py)} ${P(0,-th)}Z`, fill:i%2?cols[1]:cols[0]}));
      // torn blade ribs
      for(let s=1;s<5;s++){
        const t=s/5, rx=mx*2*t*0.5+Math.cos(rad)*l*t*0.5, ry=-th+Math.sin(rad)*l*t;
        out.push(el("path",{d:`M${P(Math.cos(rad)*l*t, -th+Math.sin(rad)*l*t)} l${(-Math.sin(rad)*w*0.9).toFixed(1)},${(Math.cos(rad)*w*0.9).toFixed(1)}`,
          stroke:cols[0],"stroke-width":1,opacity:.5,fill:"none"}));
      }
      out.push(el("path",{d:`M${P(0,-th)} L${P(tx,ty)}`,stroke:cols[2],"stroke-width":Math.max(1,l*0.016),opacity:.55,fill:"none"}));
    }
    return out;
  },
  columnar(H, r, c){
    const out=[], w=H*0.098, cols=pal(c);
    stem(out, H*0.96, w*0.13, w*0.34);
    const envAt = t => w*Math.pow(Math.sin(Math.PI*(0.035+t*0.62)),0.55);
    // solid spire so the silhouette reads from a distance
    const L=[],R=[];
    for(let i=0;i<=18;i++){
      const t=i/18, y=-H*0.97+t*H*0.86, e=envAt(t)*0.86;
      L.push([-e,y]); R.push([e,y]);
    }
    out.push(el("path",{d:"M"+L.map(p=>P(p[0],p[1])).join(" L")+" L"+
      R.reverse().map(p=>P(p[0],p[1])).join(" L")+" Z", fill:cols[0]}));
    // drooping leaves for the edge and the light
    const N=460;
    for(let i=0;i<N;i++){
      const t=Math.pow(i/N,0.9), y=-H*0.96+t*H*0.88;
      const e=envAt(t);
      const side=(i%2?1:-1);
      const off=side*e*(0.10+Math.pow(r(),0.6)*0.95);
      const l=H*0.052*(0.55+r()*0.7)*(0.5+t*0.6);
      const a=(side>0? 60+r()*34 : 120-r()*34);
      const lit=(off<0)&&(r()<0.55);
      out.push(leaf(off, y, l, a, l*0.13, lit?cols[2]:(i%3?cols[1]:cols[0]), side*l*0.18));
    }
    return out;
  },
  roundTree(H, r, c){
    const out=[], th=H*0.36, w=H*0.42, cols=pal(c);
    stem(out, th, H*0.015, H*0.032);
    out.push(el("path",{d:`M${P(0,-th*0.78)} L${P(-w*0.44,-th*1.02)} M${P(0,-th*0.78)} L${P(w*0.44,-th*1.02)}`,
      stroke:BARK,"stroke-width":H*0.013,fill:"none","stroke-linecap":"round"}));
    mass(out, 0, -th-H*0.28, w, H*0.26, cols, r, 20);
    return out;
  },
  frangipani(H, r, c, accent){
    const out=[], th=H*0.30, cols=pal(c), tips=[];
    stem(out, th, H*0.036, H*0.062);
    function branch(x,y,ang,len,d){
      const rad=ang*Math.PI/180;
      const x2=x+Math.cos(rad)*len, y2=y+Math.sin(rad)*len;
      out.push(el("path",{d:`M${P(x,y)} L${P(x2,y2)}`,stroke:d?BARK_L:BARK,
        "stroke-width":H*0.055/(d+1.15),"stroke-linecap":"round",fill:"none"}));
      if(d<2){ branch(x2,y2,ang-26-r()*12,len*0.74,d+1); branch(x2,y2,ang+26+r()*12,len*0.74,d+1); }
      else tips.push([x2,y2]);
    }
    branch(0,-th,-90,H*0.19,0);
    tips.forEach(([x,y],i)=>{
      for(let k=0;k<7;k++){
        const a=-186+k*29+r()*12, l=H*0.13*(0.7+r()*0.5);
        out.push(leaf(x,y,l,a,l*0.19,k%2?cols[1]:cols[0],l*0.06));
      }
      if(accent&&i%2===0){
        for(let f=0;f<3;f++)
          out.push(el("circle",{cx:x+(r()-.5)*H*0.07,cy:y-H*0.02-r()*H*0.03,r:H*0.017,fill:accent,opacity:.95}));
      }
    });
    return out;
  },
  dracaena(H, r, c, accent){
    const out=[], th=H*0.58, cols=pal(c);
    stem(out, th, H*0.020, H*0.042);
    const heads=[[0,-th,1],[-H*0.11,-th*0.78,0.72],[H*0.12,-th*0.85,0.78]];
    heads.forEach(([hx,hy,sc],j)=>{
      if(j>0) out.push(el("path",{d:`M${P(0,-th*0.60)} Q${P(hx*0.6,-th*0.72)} ${P(hx,hy)}`,
        stroke:BARK,"stroke-width":H*0.026,fill:"none","stroke-linecap":"round"}));
      for(let i=0;i<15;i++){
        const a=-180+i*12.8+(r()-0.5)*8, l=H*0.26*sc*(0.72+r()*0.5);
        const col = (accent && i%4===0) ? accent : (i%2?cols[1]:cols[0]);
        out.push(leaf(hx,hy,l,a,l*0.085,col,(a<-90?1:-1)*l*0.18));
      }
      out.push(el("circle",{cx:hx,cy:hy,r:H*0.014,fill:BARK_D}));
    });
    return out;
  },
  bamboo(H, r, c){
    const out=[], n=8, cols=pal(c);
    for(let k=0;k<n;k++){
      const x=(k-(n-1)/2)*H*0.050, hh=H*(0.58+r()*0.42), lean=(k-(n-1)/2)*1.8;
      const g=el("g",{transform:`translate(${x.toFixed(1)},0) rotate(${lean.toFixed(1)})`});
      const cw=H*0.013;
      g.appendChild(el("path",{d:`M${P(-cw,0)} L${P(-cw*0.7,-hh)} L${P(cw*0.7,-hh)} L${P(cw,0)}Z`,fill:shade(c,-46)}));
      g.appendChild(el("path",{d:`M${P(-cw,0)} L${P(-cw*0.7,-hh)} L${P(-cw*0.15,-hh)} L${P(-cw*0.3,0)}Z`,fill:shade(c,-10),opacity:.7}));
      for(let s=1;s<8;s++){
        const y=-hh*s/8;
        g.appendChild(el("path",{d:`M${P(-cw*0.95,y)} L${P(cw*0.95,y)}`,stroke:shade(c,-70),"stroke-width":1.5,fill:"none"}));
        if(s>2){
          const side=(s%2?1:-1);
          const bx=side*cw*0.9;
          for(let f=0;f<6;f++){
            const a=(side>0? -70+f*11 : -110-f*11)+(r()-0.5)*8;
            const l=H*0.085*(0.62+r()*0.6);
            g.appendChild(leaf(bx,y,l,a,l*0.055,f%2?cols[1]:cols[0],side*l*0.55));
          }
          for(let f=0;f<4;f++){
            const a=(side>0? -50+f*13 : -130-f*13)+(r()-0.5)*8;
            const l=H*0.062*(0.6+r()*0.6);
            g.appendChild(leaf(-bx,y,l,a,l*0.055,cols[0],-side*l*0.5));
          }
        }
      }
      out.push(g);
    }
    return out;
  },
  hedgeBall(H, r, c){
    const out=[], th=H*0.20, rr=H*0.40, cols=pal(c);
    stem(out, th, H*0.014, H*0.026);
    mass(out, 0, -th-rr, rr*0.70, rr*0.64, cols, r, 20);
    for(let i=0;i<30;i++){
      const a=r()*Math.PI*2, d=0.75+r()*0.30;
      const x=Math.cos(a)*rr*d, y=-th-rr+Math.sin(a)*rr*0.9*d;
      out.push(leaf(x,y,rr*0.20*(0.5+r()*0.7), -90+(r()-0.5)*160, rr*0.045,
        y<-th-rr?cols[2]:cols[0], 0));
    }
    return out;
  },
  shrub(H, r, c, accent){
    const out=[], w=H*0.58, cols=pal(c);
    mass(out, 0, -H*0.48, w, H*0.46, cols, r, 16);
    for(let i=0;i<26;i++){
      const a=r()*Math.PI*2, d=Math.sqrt(r());
      const x=Math.cos(a)*w*d*0.92, y=-H*0.48+Math.sin(a)*H*0.44*d;
      out.push(leaf(x,y,H*0.12*(0.5+r()*0.6), -90+(r()-0.5)*150, H*0.022, y<-H*0.5?cols[2]:cols[0], 0));
    }
    if(accent) for(let i=0;i<8;i++){
      const a=r()*Math.PI*2, d=0.45+r()*0.55;
      out.push(el("circle",{cx:Math.cos(a)*w*d,cy:-H*0.48+Math.sin(a)*H*0.42*d,r:H*0.042,fill:accent}));
    }
    return out;
  },
  cycad(H, r, c){
    const out=[], cols=pal(c);
    out.push(el("ellipse",{cx:0,cy:-H*0.07,rx:H*0.14,ry:H*0.10,fill:BARK_D}));
    out.push(el("ellipse",{cx:-H*0.03,cy:-H*0.09,rx:H*0.10,ry:H*0.06,fill:BARK_L,opacity:.7}));
    for(let i=0;i<15;i++){
      const a=-180+i*12.8, l=H*0.90*(0.76+r()*0.3);
      pinnate(out,0,-H*0.12,l,a,cols,r,(a<-90?1:-1)*l*0.26,11);
    }
    return out;
  },
  grass(H, r, c){
    const out=[], cols=pal(c);
    for(let i=0;i<26;i++){
      const a=-152+i*4.7+(r()-0.5)*12, l=H*(0.55+r()*0.55);
      out.push(leaf((r()-0.5)*H*0.26, 0, l, a, l*0.035, i%3?cols[1]:cols[0], (a<-90?1:-1)*l*0.38));
    }
    return out;
  },
  fern(H, r, c){
    const out=[], cols=pal(c);
    for(let i=0;i<13;i++){
      const a=-160+i*10, l=H*(0.72+r()*0.32);
      out.push(leaf(0,0,l,a,l*0.13,i%2?cols[1]:cols[0],(a<-90?1:-1)*l*0.10));
      out.push(el("path",{d:`M${P(0,0)} L${P(Math.cos(a*Math.PI/180)*l*0.92, Math.sin(a*Math.PI/180)*l*0.92)}`,
        stroke:cols[2],"stroke-width":1.2,opacity:.5,fill:"none"}));
    }
    return out;
  },
  ground(H, r, c, accent){
    const out=[], w=H*1.0, cols=pal(c);
    mass(out, 0, -H*0.44, w, H*0.44, cols, r, 14);
    for(let i=0;i<20;i++){
      const a=r()*Math.PI*2, d=Math.sqrt(r());
      out.push(leaf(Math.cos(a)*w*d*0.92, -H*0.44+Math.sin(a)*H*0.42*d, H*0.20*(0.5+r()*0.6),
        -90+(r()-0.5)*150, H*0.038, i%2?cols[2]:cols[0], 0));
    }
    if(accent) for(let i=0;i<7;i++){
      const a=r()*Math.PI*2, d=0.4+r()*0.6;
      out.push(el("circle",{cx:Math.cos(a)*w*d*0.9,cy:-H*0.44+Math.sin(a)*H*0.40*d,r:H*0.075,fill:accent}));
    }
    return out;
  },
  rock(H, r, c){
    const out=[], w=H*1.22, pts=[], n=17;
    for(let i=0;i<n;i++){
      const a=Math.PI - (i/(n-1))*Math.PI;
      const rad=0.90+r()*0.13;
      pts.push([Math.cos(a)*w*rad, -Math.abs(Math.sin(a))*H*rad]);
    }
    let d="M"+P(pts[0][0],pts[0][1]);
    for(let i=1;i<n;i++){
      const a=pts[i-1], b=pts[i];
      d+=" Q"+P(a[0]+(b[0]-a[0])*0.5, Math.min(a[1],b[1])-H*0.03)+" "+P(b[0],b[1]);
    }
    d+=" Z";
    out.push(el("path",{d, fill:shade(c,-22)}));
    out.push(el("path",{d, fill:c, transform:`translate(${(-w*0.05).toFixed(1)},${(-H*0.06).toFixed(1)}) scale(0.86)`}));
    out.push(el("path",{d:`M${P(-w*0.40,-H*0.34)} q${(w*0.32).toFixed(1)},${(-H*0.36).toFixed(1)} ${(w*0.66).toFixed(1)},${(-H*0.10).toFixed(1)}`,
      fill:"none",stroke:shade(c,30),"stroke-width":H*0.10,opacity:.5,"stroke-linecap":"round"}));
    out.push(el("path",{d:`M${P(-w*0.72,-H*0.05)} q${(w*0.5).toFixed(1)},${(H*0.10).toFixed(1)} ${(w*1.42).toFixed(1)},0`,
      fill:"none",stroke:shade(c,-46),"stroke-width":H*0.07,opacity:.4}));
    return out;
  },
  flat(H, r, c){
    const out=[], w=H*2.3;
    out.push(el("ellipse",{cx:0,cy:-H*0.40,rx:w*0.5,ry:H*0.5,fill:shade(c,-22)}));
    out.push(el("ellipse",{cx:-w*0.02,cy:-H*0.50,rx:w*0.45,ry:H*0.42,fill:c}));
    out.push(el("path",{d:`M${P(-w*0.30,-H*0.66)} q${(w*0.30).toFixed(1)},${(-H*0.20).toFixed(1)} ${(w*0.56).toFixed(1)},${(-H*0.02).toFixed(1)}`,
      fill:"none",stroke:shade(c,28),"stroke-width":H*0.13,opacity:.45,"stroke-linecap":"round"}));
    return out;
  },
  standing(H, r, c){
    const out=[], w=H*0.38;
    const d=`M${P(-w*0.74,0)} L${P(-w*0.54,-H*0.66)} L${P(-w*0.10,-H)} L${P(w*0.42,-H*0.78)} L${P(w*0.76,0)}Z`;
    out.push(el("path",{d, fill:shade(c,-24)}));
    out.push(el("path",{d:`M${P(-w*0.74,0)} L${P(-w*0.54,-H*0.66)} L${P(-w*0.10,-H)} L${P(w*0.02,-H*0.90)} L${P(-w*0.12,0)}Z`, fill:shade(c,16)}));
    out.push(el("path",{d:`M${P(-w*0.34,-H*0.14)} L${P(w*0.04,-H*0.84)}`,fill:"none",stroke:shade(c,-46),"stroke-width":H*0.035,opacity:.5}));
    return out;
  }
};

/* ---------- catalogue ----------
   k คีย์ · n ชื่อไทย · s ชื่อวิทย์ · f รูปทรงที่ใช้วาด · L ชั้นเริ่มต้น
   h สูงเริ่มต้น (ม.) · min/max ช่วงที่ปรับได้ · w ความกว้างทรงพุ่มเมื่อโตเต็มที่ (ม.)
   r ระยะปลอดภัยขั้นต่ำจากอาคาร/กำแพง (ม.) · c สีใบ · a สีดอก · p ช่วงราคา · w2 ข้อควรระวัง        */

/* ---------------------------------------------------------------
   ตัวช่วยวาดต้นไม้สำหรับหน้าแคตตาล็อก
   แปลงชื่อทรง (form) ในฐานข้อมูล เป็นตัววาดในชุด FORMS
----------------------------------------------------------------*/
var FORM_ALIAS = {
  tree:"roundTree", palm:"featherPalm", clump:"clumpPalm", bamboo:"bamboo",
  hedge:"hedgeBall", shrub:"shrub", ground:"ground", grass:"grass",
  vine:"shrub", stone:"rock"
};
var ART_W = { rock:1.3, flat:2.4, ground:2.1, standing:0.5, grass:1.3, fern:1.4, hedgeBall:1.15, shrub:1.15 };

function plantArt(form, box, seed, color){
  var key = FORMS[form] ? form : (FORM_ALIAS[form] || "shrub");
  var fw  = ART_W[key] || 1;
  var H   = Math.min(box*0.86, box*0.94/fw);
  var svg = el("svg",{width:box,height:box,viewBox:(-box/2)+" "+(-box)+" "+box+" "+box,
                      role:"img","aria-hidden":"true"});
  var g = el("g",{}); setBark(null);
  FORMS[key](H, rng(seed||7), color || "#4E7E3E").forEach(function(n){ g.appendChild(n); });
  svg.appendChild(g);
  return svg;
}
window.plantArt = plantArt;
