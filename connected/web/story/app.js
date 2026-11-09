(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const siteRoot = new URL('../', document.baseURI);
  const apiUrl = path => new URL(`api/${path}`, siteRoot);
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = false;
  let animationContext;
  let entranceHasPlayed = false;
  const hasGsap = Boolean(window.gsap && window.ScrollTrigger);
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  function setupMotion() {
    document.documentElement.classList.toggle('motion-reduced', reduced);
    document.documentElement.classList.toggle('motion-enabled', !reduced);
    animationContext?.revert();
    if (!hasGsap) return;
    animationContext = gsap.context(() => {
      if (reduced) return;
      if (!entranceHasPlayed) {
        gsap.from('.opening-title .line>span', { yPercent: 110, rotate: 2, duration: 1.3, stagger: .15, ease: 'power4.out', delay: .2 });
        gsap.from('.opening-meta,.opening-title>p,.opening-bottom,.site-header', { y: 12, opacity: 0, duration: 1, stagger: .1, delay: .2 });
        entranceHasPlayed = true;
      }
      gsap.to('.opening-title', { y: -45, opacity: .1, ease: 'none', scrollTrigger: { trigger: '.photo-overture', start: '30% top', end: 'bottom top', scrub: 1 } });
      $$('.reveal').forEach(element => gsap.from(element, { opacity: 0, y: 35, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: element, start: 'top 93%', once: true } }));
      $$('.photo-motion').forEach(element => gsap.from(element, { opacity: .15, y: 65, scale: .97, duration: 1.4, ease: 'power3.out', scrollTrigger: { trigger: element, start: 'top 95%', once: true } }));
      gsap.from('.floating-note', { rotation: -7, y: 40, ease: 'none', scrollTrigger: { trigger: '.mischief-pair', start: 'top bottom', end: 'bottom top', scrub: 1 } });
      gsap.from('.question-heart', { scale: .55, opacity: 0, y: 18, duration: 1.3, ease: 'back.out(1.3)', scrollTrigger: { trigger: '#question', start: 'top 75%', once: true } });
    });
    requestAnimationFrame(() => ScrollTrigger.refresh());
  }
  setupMotion();
  window.addEventListener('load', () => { if (hasGsap) ScrollTrigger.refresh(); }, { once: true });
  document.fonts?.ready.then(() => { if (hasGsap) ScrollTrigger.refresh(); });

  // Scroll feedback works independently of the animation library.
  let scrollQueued = false;
  function updateScroll() {
    scrollQueued = false;
    const scrollable = document.documentElement.scrollHeight - innerHeight;
    $('.reading-progress div').style.transform = `scaleX(${scrollable > 0 ? scrollY / scrollable : 0})`;
    let chapter = '01';
    $$('.chapter').forEach(section => { if (section.getBoundingClientRect().top < innerHeight * .55) chapter = section.dataset.chapter; });
    $('#chapter-current').textContent = chapter;
  }
  addEventListener('scroll', () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(updateScroll); } }, { passive: true });
  addEventListener('resize', updateScroll);
  updateScroll();

  // A precise dot and a softer ring: only enabled for a mouse with motion allowed.
  const dot = $('.cursor-dot');
  const ring = $('.cursor-ring');
  let targetX = -100, targetY = -100, ringX = -100, ringY = -100, cursorRaf = 0, cursorEnabled = false;
  let hasPointer = false;
  function renderCursor() {
    cursorRaf = 0;
    if (!cursorEnabled || document.hidden || !hasPointer) return;
    ringX += (targetX - ringX) * .17;
    ringY += (targetY - ringY) * .17;
    ring.style.transform = `translate3d(${ringX}px,${ringY}px,0)`;
    if (Math.abs(targetX - ringX) + Math.abs(targetY - ringY) > .12) cursorRaf = requestAnimationFrame(renderCursor);
  }
  function syncCursor() {
    cursorEnabled = finePointer.matches && !reduced;
    document.body.classList.toggle('has-cursor', cursorEnabled && hasPointer);
    if (!cursorEnabled) { cancelAnimationFrame(cursorRaf); cursorRaf = 0; }
  }
  syncCursor();
  finePointer.addEventListener('change', syncCursor);
  document.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || !cursorEnabled) return;
    hasPointer = true;
    document.body.classList.add('has-cursor');
    document.body.classList.remove('cursor-hidden');
    targetX = event.clientX; targetY = event.clientY;
    if (ringX < 0) { ringX = targetX; ringY = targetY; }
    dot.style.transform = `translate3d(${targetX}px,${targetY}px,0)`;
    if (!cursorRaf) cursorRaf = requestAnimationFrame(renderCursor);
    const target = event.target.closest('a,button,label,[data-cursor]');
    const label = target?.dataset.cursor;
    ring.classList.toggle('hover', Boolean(label));
    ring.classList.toggle('link', Boolean(target) && !label);
    ring.firstElementChild.textContent = label || '';
  }, { passive: true });
  document.addEventListener('pointerdown', () => ring.classList.add('down'));
  document.addEventListener('pointerup', () => ring.classList.remove('down'));
  document.addEventListener('pointerleave', () => document.body.classList.add('cursor-hidden'));
  document.addEventListener('keydown', event => { if (event.key === 'Tab') { document.body.classList.remove('has-cursor'); document.body.classList.add('cursor-hidden'); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(cursorRaf); cursorRaf = 0; } });

  $$('.magnetic').forEach(button => {
    button.addEventListener('pointermove', event => {
      if (reduced || !finePointer.matches || !hasGsap) return;
      const box = button.getBoundingClientRect();
      gsap.to(button, { x: (event.clientX - box.left - box.width / 2) * .12, y: (event.clientY - box.top - box.height / 2) * .2, duration: .35, overwrite: true });
    });
    button.addEventListener('pointerleave', () => { if (hasGsap) gsap.to(button, { x: 0, y: 0, duration: .6, ease: 'elastic.out(1,.5)', overwrite: true }); });
  });

  // Small CSS lights only: the answer stage never starts another WebGL effect.
  const questionStage = $('#question');
  const moteContainer = $('.question-motes');
  for (let index = 0; index < 18; index++) {
    const mote = document.createElement('span');
    mote.style.setProperty('--mote-x', `${5 + (index * 37 % 90)}%`);
    mote.style.setProperty('--mote-y', `${12 + (index * 23 % 75)}%`);
    mote.style.setProperty('--mote-delay', `${-index * .83}s`);
    mote.style.setProperty('--mote-duration', `${7 + index % 5}s`);
    moteContainer.append(mote);
  }
  const questionVisibility = new IntersectionObserver(entries => {
    questionStage.classList.toggle('is-lit', entries.some(entry => entry.isIntersecting));
  }, { threshold: .05 });
  questionVisibility.observe(questionStage);
  $$('.answer-choice').forEach(button => {
    let glowFrame = 0, glowX = 0, glowY = 0;
    button.addEventListener('pointermove', event => {
      if (reduced || event.pointerType !== 'mouse') return;
      const box = button.getBoundingClientRect();
      glowX = event.clientX - box.left; glowY = event.clientY - box.top;
      if (!glowFrame) glowFrame = requestAnimationFrame(() => {
        button.style.setProperty('--button-x', `${glowX}px`);
        button.style.setProperty('--button-y', `${glowY}px`);
        glowFrame = 0;
      });
    }, { passive: true });
    button.addEventListener('pointerenter', () => questionStage.classList.add('answer-hovered'));
    button.addEventListener('pointerleave', () => {
      questionStage.classList.remove('answer-hovered');
      cancelAnimationFrame(glowFrame); glowFrame = 0;
    });
    button.addEventListener('focus', () => questionStage.classList.add('answer-focused'));
    button.addEventListener('blur', () => questionStage.classList.remove('answer-focused'));
  });

  // Native dialogs supply keyboard focus trapping and Escape behavior.
  const dialogTriggers = new WeakMap();
  function openDialog(dialog, trigger = document.activeElement) {
    dialogTriggers.set(dialog, trigger);
    dialog.showModal();
    document.body.classList.add('dialog-open');
  }
  $$('dialog').forEach(dialog => {
    $$('[data-close]', dialog).forEach(button => button.addEventListener('click', () => dialog.close()));
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => {
      document.body.classList.remove('dialog-open');
      const trigger = dialogTriggers.get(dialog);
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    });
  });

  const responseDialog = $('#response-dialog');
  let shareText = '';
  const responses = {
    time: ['Take all the time you need.', 'There’s no rush, Teddy. Thank you for reading this. Whatever you decide, I appreciate you.'],
    friends: ['Our friendship matters.', 'Thank you for being honest. You never have to feel differently for my sake. I’m glad to have you in my life.'],
    later: ['Another day is lovely, too.', 'No rush and no expectations. The little idea can wait. Thank you for being here, and for being you.']
  };
  function showResponse(kind) {
    $('#response-title').textContent = responses[kind][0];
    $('#response-message').textContent = responses[kind][1];
    $('#share-plan').hidden = true;
    $('#share-status').textContent = '';
    openDialog(responseDialog);
  }
  $$('[data-response]').forEach(button => button.addEventListener('click', () => showResponse(button.dataset.response)));

  function celebrate() {
    if (!hasGsap || reduced) return;
    const container = $('.celebration');
    for (let i = 0; i < 24; i++) {
      const heart = document.createElement('i'); heart.className = 'bi bi-heart-fill confetti-heart';
      heart.style.left = `${8 + Math.random() * 84}%`;
      heart.style.fontSize = `${8 + Math.random() * 14}px`;
      container.append(heart);
      gsap.fromTo(heart, { y: -30, rotation: Math.random() * 50 - 25, opacity: .85 }, { y: innerHeight + 60, x: Math.random() * 170 - 85, rotation: Math.random() * 300 - 150, opacity: 0, duration: 2.8 + Math.random(), delay: Math.random() * .65, ease: 'power1.in', onComplete: () => heart.remove() });
    }
  }
  $('#yes-button').addEventListener('click', () => {
    const date = $('#date');
    const wasHidden = date.hidden;
    date.hidden = false;
    if (wasHidden) celebrate();
    if (hasGsap) ScrollTrigger.refresh();
    date.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' });
    $('#date-heading').focus({ preventScroll: true });
    updateScroll();
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const firstMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const shownMonth = new Date(firstMonth);
  const monthIndex = date => date.getFullYear() * 12 + date.getMonth();
  const maxMonth = monthIndex(firstMonth) + 12;
  const fullDateFormat = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const compactDateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long' });
  const monthFormat = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' });
  let chosenDate = null, chosenActivity = '';
  function isSameDay(a, b) { return a && b && a.getTime() === b.getTime(); }
  function updatePlan() {
    const activity = chosenActivity || 'Something lovely';
    $('#plan-summary').textContent = `${activity}${chosenDate ? `, ${compactDateFormat.format(chosenDate)}` : ', whenever you’re ready'}.`;
    $('#date-feedback').classList.remove('error');
    $('#date-feedback').textContent = 'Confirming shares your yes and chosen day with Rizwan. Nothing is booked.';
  }
  function renderCalendar(focusDay) {
    $('#calendar-month').textContent = monthFormat.format(shownMonth);
    $('#month-prev').disabled = monthIndex(shownMonth) <= monthIndex(firstMonth);
    $('#month-next').disabled = monthIndex(shownMonth) >= maxMonth;
    const grid = $('#calendar-days'); grid.replaceChildren();
    const offset = new Date(shownMonth.getFullYear(), shownMonth.getMonth(), 1).getDay();
    for (let pad = 0; pad < offset; pad++) { const span = document.createElement('span'); span.setAttribute('aria-hidden', 'true'); grid.append(span); }
    const last = new Date(shownMonth.getFullYear(), shownMonth.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= last; day++) {
      const date = new Date(shownMonth.getFullYear(), shownMonth.getMonth(), day);
      const button = document.createElement('button'); button.type = 'button'; button.textContent = day; button.dataset.day = day;
      button.setAttribute('aria-label', fullDateFormat.format(date));
      button.setAttribute('aria-pressed', String(Boolean(isSameDay(date, chosenDate))));
      button.disabled = date < today;
      if (isSameDay(date, today)) { button.classList.add('today'); button.setAttribute('aria-current', 'date'); }
      button.addEventListener('click', () => {
        chosenDate = date;
        $('#selected-day').textContent = fullDateFormat.format(date);
        renderCalendar(day); updatePlan();
      });
      grid.append(button);
    }
    if (focusDay) $(`[data-day="${focusDay}"]`, grid)?.focus({ preventScroll: true });
  }
  $('#month-prev').addEventListener('click', () => { shownMonth.setMonth(shownMonth.getMonth() - 1); renderCalendar(); });
  $('#month-next').addEventListener('click', () => { shownMonth.setMonth(shownMonth.getMonth() + 1); renderCalendar(); });
  $$('[data-activity]').forEach(button => button.addEventListener('click', () => {
    chosenActivity = button.dataset.activity;
    $$('[data-activity]').forEach(option => option.setAttribute('aria-pressed', String(option === button)));
    updatePlan();
  }));
  let sendingPlan = false;
  const journeyDialog = $('#journey-dialog');
  let journeyTimer = 0, journeyPaused = false, journeyRemaining = 10000, journeyLastTick = 0;
  function syncJourneyPause() {
    journeyDialog.classList.toggle('journey-paused', journeyPaused || document.hidden);
    journeyLastTick = performance.now();
  }
  function returnToBeginning() {
    clearInterval(journeyTimer);
    location.replace(new URL('?journey=beginning', siteRoot));
  }
  function beginJourney(activity, date) {
    $('#journey-plan').textContent = `${activity}, together. ${compactDateFormat.format(date)}.`;
    journeyRemaining = 10000; journeyPaused = false; journeyLastTick = performance.now();
    $('#journey-countdown').textContent = '10';
    $('.journey-return').hidden = false;
    $('#journey-pause').textContent = 'Stay a little longer';
    $('#journey-pause').setAttribute('aria-pressed', 'false');
    if (!$('.journey-sparks').children.length) {
      for (let i = 0; i < 30; i++) {
        const spark = document.createElement('i');
        spark.style.setProperty('--left', `${i * 37 % 100}%`);
        spark.style.setProperty('--color', ['#b47390', '#d7b17c', '#e9c5b0'][i % 3]);
        spark.style.setProperty('--duration', `${5 + i % 4}s`);
        spark.style.setProperty('--delay', `${-i * .37}s`);
        $('.journey-sparks').append(spark);
      }
    }
    openDialog(journeyDialog);
    syncJourneyPause();
    clearInterval(journeyTimer);
    journeyTimer = setInterval(() => {
      const now = performance.now();
      if (!journeyPaused && !document.hidden) journeyRemaining -= now - journeyLastTick;
      journeyLastTick = now;
      $('#journey-countdown').textContent = String(Math.max(0, Math.ceil(journeyRemaining / 1000)));
      if (journeyRemaining <= 0) returnToBeginning();
    }, 200);
  }
  $('#journey-pause').addEventListener('click', () => {
    journeyPaused = !journeyPaused;
    $('#journey-pause').setAttribute('aria-pressed', String(journeyPaused));
    $('#journey-pause').textContent = journeyPaused ? 'Continue to our beginning' : 'Stay a little longer';
    $('.journey-return').hidden = journeyPaused;
    syncJourneyPause();
  });
  journeyDialog.addEventListener('cancel', event => { event.preventDefault(); returnToBeginning(); });
  journeyDialog.addEventListener('close', () => clearInterval(journeyTimer));
  document.addEventListener('visibilitychange', syncJourneyPause);
  addEventListener('pagehide', () => clearInterval(journeyTimer));
  $('#date-confirm').addEventListener('click', async () => {
    if (sendingPlan) return;
    if (!chosenActivity || !chosenDate) {
      $('#date-feedback').textContent = !chosenActivity && !chosenDate ? 'Choose an activity and a day, or leave it for another time.' : !chosenActivity ? 'Choose an activity you’d enjoy.' : 'Pick an upcoming day from the calendar.';
      $('#date-feedback').classList.add('error');
      return;
    }
    sendingPlan = true;
    const submittedDate = new Date(chosenDate), submittedActivity = chosenActivity;
    const controls = $$('#date button').map(button => [button, button.disabled]);
    controls.forEach(([button]) => { button.disabled = true; });
    $('#date-feedback').textContent = 'Saving our little plan…';
    try {
      const session = await fetch(apiUrl('session'));
      if (!session.ok) throw new Error('Could not connect. Please try again.');
      const { csrf } = await session.json();
      const day = `${submittedDate.getFullYear()}-${String(submittedDate.getMonth()+1).padStart(2,'0')}-${String(submittedDate.getDate()).padStart(2,'0')}`;
      const response = await fetch(apiUrl('accept'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify({ accepted: true, activity: submittedActivity, day }) });
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Could not save our little plan right now. Please try again.');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save your plan. Please try again.');
    } catch (error) {
      $('#date-feedback').textContent = error.message || 'Connection lost. Please try again.';
      $('#date-feedback').classList.add('error');
      return;
    } finally { sendingPlan = false; controls.forEach(([button, disabled]) => { button.disabled = disabled; }); }
    $('#date-feedback').textContent = 'Your little plan has been shared with Rizwan.';
    beginJourney(submittedActivity, submittedDate);
  });
  $('#share-plan').addEventListener('click', async () => {
    if (!shareText) return;
    if (navigator.share) {
      try { await navigator.share({ title: 'A little plan for two', text: shareText }); $('#share-status').textContent = 'Your little plan is shared.'; return; }
      catch (error) { if (error.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(shareText); $('#share-status').textContent = 'Copied. Paste it into a message whenever you like.'; }
    catch { $('#share-status').textContent = shareText; }
  });
  renderCalendar();
})();
