'use strict';

(() => {
  const $ = id => document.getElementById(id);
  let token = '';
  let session = null;
  let reviews = [];
  let selected = null;
  let selectedId = null;
  let detailSignature = '';
  let refreshing = false;
  let epoch = 0;
  let resolutionAction = null;
  let resolutionReviewId = null;
  let expirySignature = '';

  function element(tag, content, className) {
    const node = document.createElement(tag);
    if (content !== undefined) node.textContent = content;
    if (className) node.className = className;
    return node;
  }
  function announce(message) { $('announcement').textContent = message; }
  function banner(message = '') {
    $('banner').textContent = message;
    $('banner').hidden = !message;
  }
  function connection(connected, message) {
    $('connection-dot').className = 'dot' + (connected ? ' connected' : ' error');
    $('connection-label').textContent = message;
  }
  function action(review) {
    if (review.status !== 'completed') return 'NOT_VERIFIED';
    if (review.expires <= Date.now()) return 'EXPIRED';
    return review.effectiveAction;
  }
  function actionName(value) {
    return {APPROVE:'Approved', ESCALATE:'Needs review', BLOCK:'Blocked', NOT_VERIFIED:'Not verified', EXPIRED:'Expired'}[value] || 'Not verified';
  }
  function badge(value) { return element('span', actionName(value), 'pill decision-' + value); }
  function scope(review) {
    if (review.kind === 'demo') return 'SYNTHETIC DEMO';
    if (review.kind === 'report') return 'EZIO REPORT IMPORT';
    return review.scope === 'commit' ? 'COMMIT RANGE' : 'SAVED CHANGES';
  }
  async function api(route, body) {
    const response = await fetch(route, {
      method: body ? 'POST' : 'GET',
      headers: {'content-type':'application/json', authorization:'Bearer ' + token},
      ...(body ? {body:JSON.stringify(body)} : {}),
      signal: AbortSignal.timeout(15000),
      redirect: 'error'
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  }
  function renderList() {
    $('count-total').textContent = session ? reviews.length : '—';
    for (const [id, value] of [['approved','APPROVE'],['escalated','ESCALATE'],['blocked','BLOCK']]) {
      $('count-' + id).textContent = session ? reviews.filter(r => action(r) === value).length : '—';
    }
    const search = $('search').value.toLowerCase().trim();
    const filter = $('filter').value;
    const filtered = reviews.filter(r => r.context.toLowerCase().includes(search) && (filter === 'all' || action(r) === filter || filter === 'NOT_VERIFIED' && action(r) === 'EXPIRED'));
    $('review-rows').replaceChildren();
    for (const review of filtered) {
      const row = element('tr');
      if (review.id === selectedId) row.className = 'selected';
      const titleCell = element('td');
      const title = element('button', review.context, 'review-title');
      title.title = review.context;
      title.addEventListener('click', () => selectReview(review.id));
      titleCell.append(title, element('div', scope(review) + ' · ' + review.id.slice(0,8), 'review-meta'));
      const statusCell = element('td'); statusCell.append(badge(action(review)));
      const dateCell = element('td', new Date(review.created).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}), 'date-cell');
      dateCell.title = new Date(review.created).toLocaleString();
      const openCell = element('td');
      const open = element('button','↗','row-open');
      open.setAttribute('aria-label', 'Inspect ' + review.context);
      open.addEventListener('click', () => selectReview(review.id));
      openCell.append(open); row.append(titleCell,statusCell,dateCell,openCell);
      $('review-rows').append(row);
    }
    $('empty-state').hidden = filtered.length > 0;
    $('empty-state').querySelector('h3').textContent = reviews.length ? 'No matching reviews' : 'No reviews yet';
    $('empty-state').querySelector('p').textContent = reviews.length ? 'Try a different search or decision filter.' : session ? 'Import a report, try a synthetic example, or run a code check from your editor.' : 'Connect to your local service, then import a report or run a code check from your editor.';
    $('review-count').textContent = filtered.length + (filtered.length === 1 ? ' review shown' : ' reviews shown');
  }
  function renderDetail(force = false) {
    const signature = JSON.stringify([selected, selected ? action(selected) : null, session?.role]);
    if (!force && signature === detailSignature) return;
    detailSignature = signature;
    $('detail-empty').hidden = !!selected;
    $('detail-content').hidden = !selected;
    const target = $('detail-content'); target.replaceChildren();
    $('detail-scope').textContent = selected ? scope(selected) : 'NO SELECTION';
    if (!selected) return;
    const r = selected;
    const d = r.result?.decision;
    target.append(badge(action(r)), element('h3',r.context,'detail-title'));
    if (r.kind === 'demo') target.append(element('p','Synthetic fixture, not a genuine Ezio report. Cannot authorize code pushes.','small muted'));
    if (r.expires <= Date.now()) target.append(element('p','This review has expired. Create a new review before acting.','small muted'));
    else target.append(element('p',d?.nextStep || r.result?.error || (r.status === 'queued' ? 'Queued for analysis.' : 'Analyzing the evidence…'),'small muted'));
    if (d) {
      const metrics = element('div',undefined,'detail-meta');
      metrics.append(element('span','Evidence trust: ' + d.trust),element('span','Supported claims: ' + (d.score == null ? 'Not scored' : d.score + '%')));
      target.append(metrics,element('h4','Decision trail','detail-label'));
      for (const reason of d.reasons) {
        const item = element('div',undefined,'reason');
        item.append(element('code',reason.evidenceId),element('p',reason.message)); target.append(item);
      }
    }
    const evidence = r.result?.evidence;
    if (evidence?.claims?.length) {
      target.append(element('h4','Claims & sources','detail-label'));
      for (const claim of evidence.claims) {
        const item = element('details',undefined,'evidence-item');
        item.append(element('summary',claim.verdict.toUpperCase() + ' · ' + claim.text),element('blockquote',claim.quote));
        for (const source of claim.sources) item.append(element('p',source.type + ' · ' + source.title + ' · ' + source.date));
        if (!claim.sources.length) item.append(element('p','No source supplied for this claim.'));
        target.append(item);
      }
    }
    for (const note of [...(evidence?.limitations || []), r.result?.providerError].filter(Boolean)) target.append(element('p',note,'small muted'));
    if (r.snapshot) {
      const diff = element('details',undefined,'evidence-item');
      diff.append(element('summary','Inspect exact reviewed diff'),element('p','Base: ' + r.snapshot.base + ' → ' + r.snapshot.head),element('pre',r.snapshot.diff || '(No changes)','diff'));
      target.append(diff);
    }
    if (r.resolution) target.append(element('div',r.resolution.actor + ' recorded ' + r.resolution.action + ': ' + r.resolution.reason,'resolution'));
    if (action(r) === 'ESCALATE' && !r.resolution) {
      if (session.role === 'reviewer') {
        const actions = element('div',undefined,'reviewer-actions');
        for (const [value,label] of [['APPROVE','Record approval'],['BLOCK','Reject change']]) {
          const button = element('button',label,'button ' + (value === 'APPROVE' ? 'primary' : 'danger'));
          button.addEventListener('click', () => {
            resolutionAction = value;
            resolutionReviewId = r.id;
            $('resolve-title').textContent = label;
            $('resolve-form').reset(); $('resolve-error').textContent = '';
            $('resolve-dialog').showModal();
          }); actions.append(button);
        } target.append(actions);
      } else target.append(element('p','Connect with the designated reviewer token to record a decision.','small muted'));
    }
    target.append(element('p',r.provenance + '\nCreated ' + new Date(r.created).toLocaleString() + '\nExpires ' + new Date(r.expires).toLocaleString() + '\n' + r.id,'detail-time'));
  }
  async function selectReview(id) {
    selectedId = id;
    const generation = epoch;
    renderList();
    try {
      const detail = await api('/v1/reviews/' + id);
      if (generation !== epoch || selectedId !== id) return;
      selected = detail; renderDetail(); announce('Selected review: ' + actionName(action(detail)));
    } catch (error) { if (generation === epoch) banner(error.message); }
  }
  async function refresh() {
    if (!session || refreshing) return;
    refreshing = true;
    const generation = epoch;
    try {
      const data = await api('/v1/reviews');
      if (generation !== epoch) return;
      reviews = data.reviews;
      connection(true,'Local service connected');
      $('updated').textContent = 'Updated ' + new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
      renderList();
      if (selectedId) await selectReview(selectedId);
      else if (reviews.length) await selectReview(reviews[0].id);
    } catch (error) {
      if (generation !== epoch) return;
      connection(false,'Connection interrupted');
      banner(error.message + ' · Displayed reviews may be outdated.');
    } finally { refreshing = false; }
  }
  async function createReview(payload) {
    const result = await api('/v1/reviews',payload);
    selectedId = result.id;
    banner();
    await refresh();
    await selectReview(result.id);
    announce('Review submitted. Evidence analysis is running.');
  }
  async function loadDemos() {
    $('demo-strip').hidden = !session?.demoEnabled;
    $('demo-buttons').replaceChildren();
    if (!session?.demoEnabled) return;
    const generation = epoch;
    const data = await api('/v1/demo-fixtures');
    if (generation !== epoch) return;
    for (const fixture of data.fixtures) {
      const button = element('button',fixture.name.replace(' (SYNTHETIC)',''),'button');
      button.addEventListener('click',async () => {
        button.disabled = true;
        try { await createReview({kind:'demo',context:'Synthetic rehearsal: assess ' + fixture.name + ' for publication.',evidence:fixture.evidence}); }
        catch (error) { banner(error.message); }
        finally { button.disabled = false; }
      }); $('demo-buttons').append(button);
    }
  }
  function disconnect() {
    epoch++; token = ''; session = null; reviews = []; selected = null; selectedId = null;
    $('token').value = '';
    $('account-name').textContent = 'Not connected'; $('account-role').textContent = 'Connect your local service'; $('avatar').textContent = '—';
    $('new-report').disabled = true; $('refresh').disabled = true; $('disconnect').hidden = true;
    $('demo-strip').hidden = true; $('reconnect').hidden = false;
    $('harness-state').textContent = 'Not connected'; $('policy-state').textContent = 'Not connected';
    connection(false,'Not connected'); banner(); renderList(); renderDetail(true);
    announce('Disconnected. Token cleared from this tab.');
  }
  $('connect-form').addEventListener('submit',async event => {
    event.preventDefault();
    const button = event.submitter; button.disabled = true;
    token = $('token').value.trim(); $('connect-error').textContent = '';
    try {
      session = await api('/v1/session'); epoch++;
      $('token').value = '';
      $('account-name').textContent = session.actor;
      $('account-role').textContent = session.role === 'reviewer' ? 'Security reviewer' : 'Developer';
      $('avatar').textContent = session.actor.charAt(0).toUpperCase();
      $('harness-state').textContent = session.harnessConfigured ? 'Configured' : 'Not configured';
      $('policy-state').textContent = 'Ready';
      $('new-report').disabled = false; $('refresh').disabled = false; $('disconnect').hidden = false; $('reconnect').hidden = true;
      $('connect-dialog').close(); connection(true,'Local service connected'); banner();
      await refresh(); await loadDemos();
    } catch (error) {
      if (!session) { token = ''; $('connect-error').textContent = error.message; }
      else banner(error.message);
    } finally { button.disabled = false; }
  });
  $('connect-dialog').addEventListener('close',() => { $('token').value = ''; if (!session) $('reconnect').hidden = false; });
  $('browse-empty').addEventListener('click',() => $('connect-dialog').close());
  $('reconnect').addEventListener('click',() => $('connect-dialog').showModal());
  $('disconnect').addEventListener('click',disconnect);
  $('refresh').addEventListener('click',() => { banner(); refresh(); });
  $('search').addEventListener('input',renderList);
  $('filter').addEventListener('change',renderList);
  $('guide-button').addEventListener('click',() => $('guide-dialog').showModal());
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click',() => $(button.dataset.close).close()));
  $('new-report').addEventListener('click',() => {
    $('report-form').reset(); $('report-error').textContent = '';
    $('report-dialog').showModal();
  });
  $('report-file').addEventListener('change',async () => {
    const file = $('report-file').files[0]; if (!file) return;
    if (file.size > 500000) { $('report-error').textContent = 'Text file exceeds the 500 KB limit.'; $('report-file').value = ''; return; }
    try { $('report-text').value = await file.text(); $('report-error').textContent = ''; }
    catch { $('report-error').textContent = 'Could not read this file.'; }
  });
  $('report-form').addEventListener('submit',async event => {
    event.preventDefault(); const button = event.submitter; button.disabled = true;
    $('report-error').textContent = '';
    try {
      await createReview({kind:'report',context:$('context').value.trim(),reportText:$('report-text').value});
      $('report-dialog').close();
    } catch (error) { $('report-error').textContent = error.message; }
    finally { button.disabled = false; }
  });
  $('resolve-form').addEventListener('submit',async event => {
    event.preventDefault(); const button = event.submitter; button.disabled = true;
    $('resolve-error').textContent = '';
    try {
      const id = resolutionReviewId;
      await api('/v1/reviews/' + id + '/resolve',{action:resolutionAction,reason:$('resolve-reason').value.trim()});
      $('resolve-dialog').close(); await refresh();
    } catch (error) { $('resolve-error').textContent = error.message; }
    finally { button.disabled = false; }
  });
  setInterval(() => { if (!document.hidden) refresh(); },10000);
  setInterval(() => {
    if (!session || document.hidden) return;
    const signature = reviews.map(r => r.id + ':' + action(r)).join('|');
    if (signature !== expirySignature) { expirySignature = signature; renderList(); renderDetail(); }
  },1000);
  renderList(); $('connect-dialog').showModal();
})();
