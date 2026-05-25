/* FYNDR · Profit Factory — interactions
   GSAP + ScrollTrigger + Lenis loaded via CDN in index.html
*/

(() => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── smooth scroll ─────────────────────────────────────── */
  let lenis;
  if (window.Lenis && !prefersReduced) {
    lenis = new Lenis({
      duration: 1.15,
      easing: t => 1 - Math.pow(1 - t, 3),
      smoothWheel: true,
      smoothTouch: false,
    });
    const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);

    if (window.gsap && window.ScrollTrigger) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }
  }

  // anchor links use lenis
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const t = $(id);
      if (!t) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(t, { offset: -40 });
      else t.scrollIntoView({ behavior:'smooth', block:'start' });
    });
  });

  /* ── nav scrolled state ────────────────────────────────── */
  const nav = $('.nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 24);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive:true });

  /* ── custom cursor ─────────────────────────────────────── */
  const cur = $('.cursor');
  if (cur && matchMedia('(hover:hover)').matches) {
    let tx=0, ty=0, cx=0, cy=0;
    document.addEventListener('mousemove', e => { tx = e.clientX; ty = e.clientY; });
    (function loop(){
      cx += (tx - cx) * .22;
      cy += (ty - cy) * .22;
      cur.style.transform = `translate(${cx}px, ${cy}px) translate(-50%,-50%)`;
      requestAnimationFrame(loop);
    })();
    document.addEventListener('mousedown', () => cur.classList.add('is-hot'));
    document.addEventListener('mouseup',   () => cur.classList.remove('is-hot'));
    $$('a, button, input, .toggle__btn').forEach(el => {
      el.addEventListener('mouseenter', () => cur.classList.add('is-hot'));
      el.addEventListener('mouseleave', () => cur.classList.remove('is-hot'));
    });
  }

  /* ── reveal on scroll ──────────────────────────────────── */
  const io = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });

  $$('[data-reveal]').forEach(el => io.observe(el));

  // word-by-word reveal
  $$('[data-reveal-words]').forEach(el => {
    const html = el.innerHTML;
    // split text nodes while keeping inline tags intact
    el.innerHTML = html.replace(/(\S+)(\s|$)/g, (_, w, sp) =>
      `<span class="w">${w}</span>${sp || ''}`
    );
    const words = $$('.w', el);
    words.forEach((w, i) => w.style.transitionDelay = `${i * 30}ms`);
    io.observe(el);
  });

  /* ── animated counters ─────────────────────────────────── */
  const countIO = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target;
      const target  = parseFloat(el.dataset.count);
      const decimals = parseInt(el.dataset.decimals || '0', 10);
      const dur = 1600;
      const start = performance.now();
      const fmt = n => decimals
        ? n.toFixed(decimals)
        : Math.round(n).toLocaleString('en-US');
      const step = now => {
        const t = Math.min(1, (now - start) / dur);
        const e = 1 - Math.pow(1 - t, 3);
        el.textContent = fmt(target * e);
        if (t < 1) requestAnimationFrame(step);
        else el.textContent = fmt(target);
      };
      requestAnimationFrame(step);
      countIO.unobserve(el);
    });
  }, { threshold: .4 });

  $$('[data-count]').forEach(el => countIO.observe(el));

  /* ── bars fill ─────────────────────────────────────────── */
  const barIO = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const fill = en.target;
      requestAnimationFrame(() => {
        fill.style.width = `${parseFloat(fill.dataset.fill)}%`;
      });
      barIO.unobserve(fill);
    });
  }, { threshold: .3 });
  $$('.bars__fill').forEach(b => barIO.observe(b));

  /* ── hero animated chart (candles + equity line) ───────── */
  (function chart(){
    const svg = $('.viz__chart');
    if (!svg) return;
    const W = 600, H = 260;
    const candles = $('#candles', svg);
    const line    = $('#equityLine', svg);
    const area    = $('#equityArea', svg);
    const glow    = $('#equityGlow', svg);
    const now     = $('#nowIndicator');
    const liveP   = $('#livePrice');
    const pnlV    = $('#pnlValue');

    const COUNT = 36;
    const STEP  = W / COUNT;
    let basePrice = 1.087;
    let pnl = 1284.40;
    let bars = [];

    // generate initial bars w/ slight uptrend
    let p = basePrice;
    for (let i=0; i<COUNT; i++){
      const drift  = (Math.random() - .42) * .0009;
      const open   = p;
      const close  = p + drift;
      const high   = Math.max(open, close) + Math.random()*.0006;
      const low    = Math.min(open, close) - Math.random()*.0006;
      bars.push({open, close, high, low});
      p = close;
    }

    const scaleY = (v, min, max) => H - ((v - min) / (max - min)) * (H - 30) - 15;

    function render(animateIntro=false){
      const all = bars.flatMap(b => [b.high, b.low]);
      const min = Math.min(...all), max = Math.max(...all);

      // candles
      candles.innerHTML = '';
      bars.forEach((b, i) => {
        const x = i * STEP + STEP/2;
        const up = b.close >= b.open;
        const color = up ? '#2bd47a' : '#ff7a59';
        const yH = scaleY(b.high, min, max);
        const yL = scaleY(b.low,  min, max);
        const yO = scaleY(b.open, min, max);
        const yC = scaleY(b.close, min, max);
        const bodyY = Math.min(yO, yC);
        const bodyH = Math.max(2, Math.abs(yC - yO));

        candles.insertAdjacentHTML('beforeend', `
          <g opacity="${animateIntro ? 0 : 1}" style="${animateIntro ? `transition:opacity .4s ${i*22}ms ease` : ''}">
            <line x1="${x}" y1="${yH}" x2="${x}" y2="${yL}" stroke="${color}" stroke-width="1" opacity=".55"/>
            <rect x="${x - STEP*0.32}" y="${bodyY}" width="${STEP*0.64}" height="${bodyH}" fill="${color}" opacity="${up ? '.85' : '.7'}" rx="1"/>
          </g>
        `);
      });

      if (animateIntro) {
        requestAnimationFrame(() => {
          $$('g[opacity="0"]', candles).forEach(g => g.setAttribute('opacity', '1'));
        });
      }

      // equity line = running close, smoothed
      let cum = 0;
      const equity = bars.map((b, i) => {
        cum += (b.close - b.open);
        return { x: i*STEP + STEP/2, eq: cum };
      });
      const eqMin = Math.min(...equity.map(e=>e.eq));
      const eqMax = Math.max(...equity.map(e=>e.eq));
      const eqRange = eqMax - eqMin || 1;
      const pts = equity.map(e => `${e.x.toFixed(1)},${(H - 30 - ((e.eq-eqMin)/eqRange)*(H-60)).toFixed(1)}`);

      const d = 'M' + pts.join(' L');
      line.setAttribute('d', d);
      glow.setAttribute('d', d);
      area.setAttribute('d', d + ` L${W},${H} L0,${H} Z`);

      // now indicator at last candle
      const last = bars[bars.length-1];
      const lastX = (bars.length-1)*STEP + STEP/2;
      const lastY = scaleY(last.close, min, max);
      now.querySelector('line').setAttribute('x1', lastX);
      now.querySelector('line').setAttribute('x2', lastX);
      now.querySelectorAll('circle').forEach(c => {
        c.setAttribute('cx', lastX);
        c.setAttribute('cy', lastY);
      });

      // price text
      liveP.textContent = last.close.toFixed(5);
      pnlV.textContent = `+$${pnl.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    }

    render(true);

    if (!prefersReduced) {
      setInterval(() => {
        const lastClose = bars[bars.length-1].close;
        const drift = (Math.random() - .42) * .0009;
        const close = lastClose + drift;
        const high  = Math.max(lastClose, close) + Math.random()*.0006;
        const low   = Math.min(lastClose, close) - Math.random()*.0006;
        bars.push({ open: lastClose, close, high, low });
        bars.shift();
        pnl += (close - lastClose) * 100000;
        if (pnl < 0) pnl = Math.abs(pnl) * .6;
        render(false);
      }, 1800);
    }
  })();

  /* ── projection calculator ─────────────────────────────── */
  (function proj(){
    const cap   = $('#capital');
    const range = $('#capitalRange');
    const rowsEl= $('#projRows');
    const btns  = $$('.toggle__btn');
    if (!cap || !rowsEl) return;

    let rate = 3.5;

    const fmt = n => '$' + Math.round(n).toLocaleString('en-US');
    const pct = n => (n*100).toLocaleString('en-US',{maximumFractionDigits:1}) + '%';

    function compute(){
      const c = Math.max(500, parseFloat(cap.value) || 0);
      const r = rate / 100;
      const years = [1,2,3,4,5];
      rowsEl.innerHTML = '';
      years.forEach((y, i) => {
        const months = y * 12;
        const balance = c * Math.pow(1 + r, months);
        const gain = balance - c;
        const ret = balance / c - 1;
        const isFinal = (i === years.length - 1);
        rowsEl.insertAdjacentHTML('beforeend', `
          <div class="proj__row ${isFinal ? 'is-final' : ''}" style="opacity:0;transform:translateY(8px);transition:opacity .5s ${i*60}ms ease,transform .5s ${i*60}ms ease">
            <span class="horizon">${y} ${y===1?'año':'años'}</span>
            <span class="balance">${fmt(balance)}</span>
            <span class="gain">+${fmt(gain)}</span>
            <span class="pct">${pct(ret)}</span>
          </div>
        `);
      });
      requestAnimationFrame(() => {
        $$('.proj__row', rowsEl).forEach(r => {
          r.style.opacity = 1; r.style.transform = 'none';
        });
      });
    }

    cap.addEventListener('input', () => { range.value = cap.value; compute(); });
    range.addEventListener('input', () => { cap.value = range.value; compute(); });
    btns.forEach(b => {
      b.addEventListener('click', () => {
        btns.forEach(x => x.classList.remove('is-active'));
        b.classList.add('is-active');
        rate = parseFloat(b.dataset.rate);
        compute();
      });
    });

    compute();
  })();

  /* ── parallax accents on hero ──────────────────────────── */
  if (window.gsap && window.ScrollTrigger && !prefersReduced) {
    gsap.utils.toArray('.hero__viz').forEach(el => {
      gsap.to(el, {
        y: -60,
        scrollTrigger: {
          trigger: el, start: 'top bottom', end: 'bottom top', scrub: 1
        }
      });
    });
    gsap.utils.toArray('.display__line').forEach((el, i) => {
      gsap.from(el, {
        yPercent: 110, duration: 1.1, ease: 'expo.out', delay: .1 + i*.1,
      });
    });
    gsap.from('.hero__meta', { opacity:0, y:10, duration:.8, ease:'power2.out', delay:.6 });

    // end mark glow
    gsap.to('.end__mark', {
      filter:'drop-shadow(0 0 60px rgba(43,212,122,.7))',
      duration:2.4, repeat:-1, yoyo:true, ease:'sine.inOut'
    });
  }

  /* ── feed cycling on chart ─────────────────────────────── */
  (function feed(){
    const ul = $('.viz__feed');
    if (!ul) return;
    const samples = [
      ['BUY','EURUSD','0.45','1.0871','+$184'],
      ['SELL','XAUUSD','0.12','2334.8','+$420'],
      ['SELL','GBPUSD','0.30','1.2719','−$62'],
      ['BUY','US500','1.20','5318.4','+$742'],
      ['BUY','USDJPY','0.80','156.41','+$310'],
      ['SELL','BTCUSD','0.05','67924','+$558'],
      ['BUY','NAS100','0.40','18642','+$214'],
      ['SELL','AUDUSD','0.60','0.6644','−$48'],
    ];
    if (prefersReduced) return;
    setInterval(() => {
      const s = samples[Math.floor(Math.random()*samples.length)];
      const up = s[0]==='BUY' || !s[4].startsWith('−');
      const cls = up ? 'up' : 'dn';
      const li = document.createElement('li');
      li.innerHTML = `<span class="tick ${cls}">${s[0]}</span> ${s[1]} ${s[2]} @ ${s[3]} → <span class="${cls}">${s[4]}</span>`;
      ul.insertBefore(li, ul.firstChild);
      while (ul.children.length > 5) ul.removeChild(ul.lastChild);
    }, 3200);
  })();

})();
