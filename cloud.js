// SOCCERSPOT COMPTE SECURITE v4 - corrige navigation Compte/Administration
/* SoccerSpot v2 — comptes, avis publics, photos modérées et administration.
   Le contrôle d'accès véritable est dans supabase-setup.sql (RLS). */
(function () {
  'use strict';
  const config = window.SOCCERSPOT_CONFIG || {};
  const active = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(config.url || '') &&
    (config.anonKey || '').length > 18 && !/(service_role|sb_secret_)/i.test(config.anonKey);
  const state = {
    active, db: null, user: null, admin: false, edits: {}, reviews: [], fieldPhotos: [], photoURLs: {}, suggestions: [],
    status: active ? 'Connexion en cours…' : 'Base en ligne non configurée',
    error: '', syncing: false
  };
  window.soccerCloud = state;
  const oldHeader = header, oldBottom = bottomNav, oldDetail = pDetail;
  const oldPlaceholder = placeholder, oldRender = render, oldRoute = route, oldContribute = contributePage, oldCard=card;
  const possible = (k) => Boolean(state.db && state.active);
  const own = row => Boolean(state.user && row.user_id === state.user.id);
  const text = value => escapeHTML(value == null ? '' : String(value));
  const urlSafe = value => /^https:\/\//i.test(String(value || '')) ? escapeHTML(value) : '#';
  const button = (action, label, id='', more='') => `<button type="button" class="outline-btn" data-cloud-action="${action}" data-id="${text(id)}" ${more}>${label}</button>`;
  const message = err => String(err?.message || err || 'Une erreur est survenue.').slice(0,200);
  const requireUser = () => {
    if (!possible()) { toast('Configure Supabase pour activer les comptes et les avis publics.'); location.hash='compte'; return false; }
    if (!state.user) { toast('Connecte-toi pour participer.'); location.hash='compte'; return false; }
    return true;
  };

  function visiblePhotos(fieldId) {
    return state.fieldPhotos.filter(p => p.field_id === fieldId && (p.approved || own(p) || state.admin));
  }
  function coverPhoto(p) {
    const approved = visiblePhotos(p.id).filter(r => r.approved && state.photoURLs[r.id]);
    const chosen = approved.find(r => r.id === state.edits[p.id]?.cover_photo_id) || approved[0];
    return chosen ? state.photoURLs[chosen.id] : null;
  }
  placeholder = function (p, full = false) {
    const photo = coverPhoto(p);
    if (!photo) return oldPlaceholder(p, full);
    return `<div class="photo-placeholder ${full ? 'dialog-image' : ''}"><img class="photo-local" src="${text(photo)}" alt="Photo du terrain ${text(p.name)} approuvée"><span class="local-badge">${I('camera','sm')} Photo approuvée</span></div>`;
  };

  card = function(p){
    const c=oldCard(p);
    if(!active)return c;
    const list=state.reviews.filter(x=>x.field_id===p.id);
    if(!list.length)return c;
    const avg=(list.reduce((sum,x)=>sum+x.stars,0)/list.length).toFixed(1).replace('.',',');
    return c.replace('<div class="card-foot">',`<p class="cloud-rating" aria-label="Moyenne des avis : ${avg} sur 5, ${list.length} avis">★ ${avg}/5 · ${list.length} avis</p><div class="card-foot">`);
  };
  // Navigation : Compte toujours visible et Administration supplémentaire pour les admins.
  header = function () {
    const accountLink = `<a class="header-link ${S.page==='compte'?'active':''}" href="#compte">${I('user','sm')} ${state.user?'Mon compte':'Connexion'}</a>`;
    const adminLink = state.admin ? `<a class="header-link ${S.page==='admin'?'active':''}" href="#admin">${I('shield','sm')} Administration</a>` : '';
    return oldHeader().replace('</nav></header>', accountLink + adminLink + '</nav></header>');
  };
  bottomNav = function () {
    const accountLink = `<a href="#compte" class="nav-item ${S.page==='compte'?'active':''}" style="text-decoration:none">${I('user')}<span>Compte</span></a>`;
    const adminLink = state.admin ? `<a href="#admin" class="nav-item ${S.page==='admin'?'active':''}" style="text-decoration:none">${I('shield')}<span>Admin</span></a>` : '';
    return oldBottom().replace('</nav>', accountLink + adminLink + '</nav>');
  };

  function cloudNotice() {
    if (!active) return `<div class="notice warning"><b>À connecter :</b> cette version est prête pour les comptes, mais il faut créer un projet Supabase et compléter <code>config.js</code>. Aucun avis en ligne n'est actif pour le moment.</div>`;
    if (!state.db) return `<div class="notice warning">Connexion au serveur…</div>`;
    if (state.error) return `<div class="notice warning"><b>Problème de connexion :</b> ${text(state.error)} ${button('refresh','Réessayer')}</div>`;
    return '';
  }
  function accountPage() {
    if (!state.user) {
      const mode = S.accountMode || 'login';
      return `<section class="page-head"><div><span class="page-eyebrow">Communauté SoccerSpot</span><h1>Mon compte</h1><p>Connecte-toi pour publier un avis ou proposer une photo.</p></div>${I('user','lg')}</section>
        ${cloudNotice()}<div class="form-card cloud-width">
          <div class="cloud-tabs">${[['login','Connexion'],['signup','Inscription'],['reset','Mot de passe oublié']].map(([m,l])=>`<button type="button" data-cloud-action="mode" data-value="${m}" class="small-btn ${m===mode?'cloud-selected':''}">${l}</button>`).join('')}</div>
          <form id="cloud-auth-form"><div class="form-row"><label for="auth-email">Courriel</label><input class="input" id="auth-email" type="email" name="email" autocomplete="email" required maxlength="254" placeholder="toncourriel@exemple.com"></div>
          ${mode!=='reset'?`<div class="form-row"><label for="auth-pass">Mot de passe (minimum 8 caractères)</label><input class="input" id="auth-pass" type="password" name="password" minlength="8" autocomplete="${mode==='login'?'current-password':'new-password'}" required></div>`:''}
          <button class="primary-btn" type="submit" ${!active?'disabled':''}>${mode==='signup'?'Créer mon compte':mode==='reset'?'Envoyer le lien de réinitialisation':'Ouvrir ma session'}</button></form>
          <p class="form-help">Une confirmation par courriel peut être nécessaire. Tes avis publics seront associés à ton compte, sans afficher ton adresse courriel.</p></div>`;
    }
    if(S.accountMode==='recovery') return `<section class="page-head"><div><h1>Nouveau mot de passe</h1><p>Choisis un nouveau mot de passe pour ton compte.</p></div></section><div class="form-card cloud-width"><form id="cloud-reset-password-form"><div class="form-row"><label>Nouveau mot de passe (8 caractères minimum)</label><input class="input" name="password" type="password" minlength="8" required autocomplete="new-password"></div><button class="primary-btn" type="submit">Changer mon mot de passe</button></form></div>`;
    return `<section class="page-head"><div><span class="page-eyebrow">Session active</span><h1>Mon compte</h1><p>${text(state.user.email)}</p></div>${I('user','lg')}</section>
      <div class="form-card cloud-width"><div class="notice">${state.admin?'🛡️ Tu es administrateur de SoccerSpot.':'✅ Ton compte est connecté. Tu peux publier des avis et envoyer des photos.'}</div>
      ${state.admin?`<a class="primary-btn" href="#admin" style="text-decoration:none">Ouvrir l'administration</a>`:''}
      <div class="form-row" style="margin-top:20px"><h2 style="font-size:19px;margin-bottom:8px">Sécurité du compte</h2><p class="form-help">Modifie ton mot de passe ou ferme ta session sur cet appareil.</p></div>
      <form id="cloud-change-password-form" autocomplete="off" style="margin-top:16px">
      <div class="form-row"><label for="cloud-current-password">Mot de passe actuel</label><input id="cloud-current-password" name="current" type="password" class="input" required autocomplete="current-password"></div>
      <div class="form-row"><label for="cloud-new-password">Nouveau mot de passe (8 caractères minimum)</label><input id="cloud-new-password" name="password" type="password" class="input" minlength="8" required autocomplete="new-password"></div>
      <div class="form-row"><label for="cloud-confirm-password">Confirmer le nouveau mot de passe</label><input id="cloud-confirm-password" name="confirm" type="password" class="input" minlength="8" required autocomplete="new-password"></div>
      <button class="primary-btn" type="submit">Changer mon mot de passe</button></form>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:24px">${button('refresh','Actualiser')} ${button('logout','Fermer ma session')}</div>
      <div class="notice warning" style="margin-top:24px"><h3 style="margin:0 0 8px">Supprimer mon compte</h3><p style="margin:0 0 12px">La suppression définitive comprend ton compte, tes avis et tes photos. Cette opération est irréversible et exige un service sécurisé qui n'est pas encore activé.</p>
      <button class="outline-btn" type="button" disabled aria-disabled="true" title="Fonction non activée">Supprimer mon compte (à activer)</button>
      <p class="form-help">Pour demander la suppression avant son activation, contacte l'administrateur de SoccerSpot. Ne publie pas de renseignements personnels dans les avis.</p></div>
      </div>${cloudNotice()}`;
  }

  function reviewSection(p) {
    if (!active) return `<h3 class="section-title">Avis publics</h3>${cloudNotice()}<p class="form-help">Tes évaluations de la V1 demeurent sauvegardées localement, mais ne sont pas partagées.</p>`;
    const rows = state.reviews.filter(r=>r.field_id===p.id);
    const avg = rows.length ? (rows.reduce((sum,r)=>sum+r.stars,0)/rows.length).toFixed(1).replace('.',',') : null;
    const mine = rows.find(own);
    return `<h3 class="section-title">Notes et avis ${avg ? `${text(avg)}/5 (${rows.length})` : '(aucun avis)'}</h3>
      <p class="form-help">Avis publiés par des comptes enregistrés. Les avis ne sont pas des vérifications officielles.</p>
      ${rows.length?`<div class="review-list">${rows.map(r=>`<div class="review"><strong>${own(r)?'Ton avis':'Membre SoccerSpot'}</strong> <small>${'★'.repeat(r.stars)}${'☆'.repeat(5-r.stars)}</small><p>${text(r.comment)}</p>${(own(r)||state.admin)?button('delete-review','Supprimer l’avis',r.id):''}</div>`).join('')}</div>`:''}
      ${state.user ? `<form id="cloud-review-form" data-id="${text(p.id)}"><div class="form-row"><label>Ta note</label><div class="stars" role="group">${[1,2,3,4,5].map(n=>`<button type="button" data-cloud-action="star" data-value="${n}" class="star-btn ${n<=S.reviewStars?'selected':''}" aria-label="${n} étoiles" aria-pressed="${n===S.reviewStars}">★</button>`).join('')}</div></div>
          <div class="form-row"><label for="cloud-review-text">Ton avis</label><textarea class="textarea" id="cloud-review-text" name="comment" required minlength="3" maxlength="800" placeholder="Qualité du terrain, installations, expérience…">${mine?text(mine.comment):''}</textarea></div><button class="primary-btn" type="submit">${mine?'Modifier mon avis':'Publier mon avis'}</button></form>`:
          `<p class="notice">Pour ajouter un avis, <a href="#compte">ouvre une session avec ton courriel</a>.</p>`}`;
  }
  function photoSection(p) {
    if (!active) return `<h3 class="section-title">Photos communautaires</h3>${cloudNotice()}`;
    const rows=visiblePhotos(p.id);
    return `<h3 class="section-title">Photos du terrain</h3><p class="form-help">Les photos envoyées sont vérifiées par l'administrateur avant de devenir publiques. Ne partage que des images dont tu possèdes les droits.</p>
      ${rows.length?`<div class="cloud-gallery">${rows.map(r=>`<div class="cloud-photo">
        ${state.photoURLs[r.id]?`<img src="${text(state.photoURLs[r.id])}" loading="lazy" alt="Photo de ${text(p.name)}">`:'<div class="cloud-photo-missing">Chargement photo</div>'}
        <small>${r.approved?'Photo approuvée':'En attente de validation'}${r.caption?' · '+text(r.caption):''}</small>
        <div class="cloud-actions">${state.admin&&!r.approved?button('approve-photo','Approuver',r.id):''}${state.admin&&r.approved?button('make-cover',state.edits[p.id]?.cover_photo_id===r.id?'Photo principale ✓':'Choisir en couverture',r.id):''}
        ${(own(r)||state.admin)?button('delete-cloud-photo','Supprimer',r.id):''}</div></div>`).join('')}</div>`:''}
      ${state.user?`<form id="cloud-photo-form" data-id="${text(p.id)}" class="cloud-upload"><div class="form-row"><label for="cloud-file-${text(p.id)}">Ajouter une photo (JPG, PNG, WebP, maximum 5 Mo)</label><input class="input" id="cloud-file-${text(p.id)}" type="file" accept="image/jpeg,image/png,image/webp" name="file" required></div>
        <div class="form-row"><label>Légende facultative</label><input class="input" name="caption" maxlength="240" placeholder="Ex. : terrain principal"></div>
        <label class="form-help"><input type="checkbox" required name="rights"> Je détiens les droits de diffusion et cette photo montre réellement ce terrain.</label><div style="margin-top:12px"><button class="primary-btn" type="submit">Envoyer la photo pour approbation</button></div></form>`:
        `<p class="notice"><a href="#compte">Connecte-toi</a> pour envoyer des photos.</p>`}`;
  }
  pDetail = function(p) {
    if (!active) return oldDetail(p);
    const original = oldDetail(p);
    const point = original.indexOf('<h3 class="section-title">Photos de ce terrain</h3>');
    if (point < 0) return original;
    const pre=original.slice(0,point);
    const adm=state.admin?`<div class="cloud-adm-shortcut">${button('edit-field','🛡️ Modifier la fiche du terrain',p.id)}</div>`:'';
    return pre + adm + photoSection(p) + reviewSection(p) + '</div></div></div>';
  };

  function adminChoice(label,name,options,value) {
    return `<div class="form-row"><label>${label}</label><select class="select-control" name="${name}">${options.map(([v,l])=>`<option value="${text(v)}" ${String(value??'')===String(v)?'selected':''}>${text(l)}</option>`).join('')}</select></div>`;
  }
  const yesNo=[['','Non confirmé'],['true','Oui'],['false','Non']];
  function adminPage(){
    if(!state.user||!state.admin) return `<section class="page-head"><div><h1>Administration</h1></div></section><div class="notice warning">Accès réservé à l'administrateur. <a href="#compte">Ouvrir une session</a>.</div>`;
    const p=places.find(x=>x.id===(S.adminFieldId||places[0].id))||places[0];
    const pending=state.fieldPhotos.filter(x=>!x.approved);
    return `<section class="page-head"><div><span class="page-eyebrow">🛡️ Administration</span><h1>Gérer les terrains</h1><p>Modifie les caractéristiques et approuve les photos envoyées par les membres.</p></div>${I('shield','lg')}</section>
      ${cloudNotice()}<div class="form-card cloud-wide"><div class="form-row"><label>Terrain à modifier</label><select class="select-control" data-cloud-admin-select="1">${places.map(f=>`<option value="${text(f.id)}" ${f.id===p.id?'selected':''}>${text(f.name)} · ${text(f.city)}</option>`).join('')}</select></div>
      <form id="cloud-admin-form" data-id="${text(p.id)}">
      <div class="cloud-edit-grid"><div class="form-row"><label>Nom</label><input name="name" required maxlength="120" class="input" value="${text(p.name)}"></div>
      <div class="form-row"><label>Ville</label><input name="city" required maxlength="100" class="input" value="${text(p.city)}"></div>
      <div class="form-row"><label>Adresse complète</label><input name="address" required maxlength="240" class="input" value="${text(p.address)}"></div>
      ${adminChoice('Intérieur / extérieur','kind',[['','À confirmer'],['intérieur','Intérieur'],['extérieur','Extérieur']],p.kind)}
      <div class="form-row"><label>Surface (séparée par une virgule : naturel, synthétique)</label><input name="surface" class="input" value="${text(p.surface.join(', '))}"></div>
      <div class="form-row"><label>Formats (4, 7, 11)</label><input name="formats" class="input" value="${text(p.formats.join(', '))}"></div>
      ${adminChoice('Tarif','price',[['','À confirmer'],['gratuit','Gratuit'],['payant','Payant']],p.price)}
      ${adminChoice('Accès pour pratiquer','access',[['','À confirmer'],['plages','Seulement aux périodes annoncées'],['non','Entraînement individuel interdit']],p.access)}
      ${adminChoice('Éclairage','lighting',yesNo,p.lighting)}
      ${adminChoice('Buts installés','goals',yesNo,p.goals)}
      ${adminChoice('Toilettes','restrooms',yesNo,p.restrooms)}
      ${adminChoice('Stationnement','parking',yesNo,p.parking)}
      <div class="form-row"><label>Horaires annoncés</label><textarea class="textarea" name="hours" maxlength="1500">${text(p.hours||'')}</textarea></div>
      <div class="form-row"><label>Notes / détails</label><textarea class="textarea" name="notes" maxlength="2000">${text(p.notes||'')}</textarea></div>
      <div class="form-row"><label>Source des renseignements (URL https)</label><input name="source" type="url" required class="input" value="${text(p.source)}"></div>
      <div class="form-row"><label>Organisme / source</label><input name="sourceName" class="input" maxlength="120" value="${text(p.sourceName)}"></div></div>
      <label class="cloud-confirm"><input type="checkbox" name="verified"> Je confirme que les caractéristiques que je modifie sont vérifiées par la source officielle indiquée.</label>
      <p class="form-help">Sans confirmation, les champs modifiés seront marqués « Non confirmé ». Les données inchangées conservent leur statut.</p>
      <button class="primary-btn" type="submit">Enregistrer les modifications</button>
      </form></div>
      <div class="form-card cloud-wide"><h2>Photos en attente (${pending.length})</h2>${pending.length?`<div class="cloud-gallery">${pending.map(x=>`<div class="cloud-photo">${state.photoURLs[x.id]?`<img src="${text(state.photoURLs[x.id])}" alt="Photo proposée">`:''}<small>${text(places.find(p=>p.id===x.field_id)?.name||x.field_id)}</small>${button('approve-photo','Approuver',x.id)}${button('delete-cloud-photo','Refuser / Supprimer',x.id)}</div>`).join('')}</div>`:'<p>Aucune photo en attente.</p>'}</div>
      <div class="form-card cloud-wide"><h2>Suggestions reçues (${state.suggestions.length})</h2>${state.suggestions.length?state.suggestions.map(s=>`<div class="review"><strong>${text(s.type)} · ${text(s.field_name)}, ${text(s.city)}</strong><p>${text(s.details)}</p>${button('delete-suggestion','Archiver',s.id)}</div>`).join(''):'<p>Aucune suggestion pour le moment.</p>'}</div>`;
  }

  contributePage = function(){
    if (!active) return oldContribute();
    if(!state.user)return `<section class="page-head"><div><h1>Contribuer</h1><p>La communauté aide à enrichir le répertoire du Québec.</p></div>${I('plus','lg')}</section><div class="notice">Pour proposer une correction, <a href="#compte">connecte-toi à ton compte</a>.</div>`;
    return `<section class="page-head"><div><h1>Contribuer</h1><p>Propose une mise à jour qui sera envoyée à l'administrateur pour validation.</p></div>${I('plus','lg')}</section>
      <div class="form-card cloud-width"><form id="cloud-suggestion-form"><div class="form-row"><label>Type</label><select name="type" class="select-control"><option>Nouveau terrain</option><option>Correction</option><option>Accès libre</option></select></div>
      <div class="form-row"><label>Terrain ou parc</label><input class="input" name="field_name" required minlength="2" maxlength="120"></div>
      <div class="form-row"><label>Ville</label><input class="input" name="city" required minlength="2" maxlength="100"></div>
      <div class="form-row"><label>Informations</label><textarea class="textarea" name="details" required minlength="3" maxlength="2000"></textarea></div>
      <button class="primary-btn">Envoyer à l'administrateur</button></form></div>`;
  };
  render = function () {
    if(S.map){try{S.map.remove();}catch{}S.map=null;}
    if(S.page==='compte'||S.page==='admin'){
      document.title=(S.page==='admin'?'Administration':'Mon compte')+' · SOCCERSPOT';
      node.innerHTML=header()+`<main class="shell">${S.page==='admin'?adminPage():accountPage()}${footer()}</main>`+bottomNav();
      document.body.style.overflow='';
      return;
    }
    oldRender();
  };
  route = function(){
    const h=decodeURIComponent(location.hash.slice(1)||'explorer');
    if(h==='compte'||h==='admin'){
      S.page=h; S.dialogId=null;S.filtersOpen=false;window.scrollTo(0,0);render();
    }else oldRoute();
  };
  // La V1 avait inscrit oldRoute dans hashchange avant le chargement de cloud.js.
  // Réaffecter route seul ne remplace pas ce gestionnaire: il faut le désinscrire.
  window.removeEventListener('hashchange', oldRoute);
  window.addEventListener('hashchange', route);

  const changed=(a,b)=>JSON.stringify(a)!==JSON.stringify(b);
  async function signedPhotos(){
    state.photoURLs={};
    const results=await Promise.all(state.fieldPhotos.map(async p=>{
      const {data,error}=await state.db.storage.from('soccer-photos').createSignedUrl(p.storage_path,3600);
      if(error||!data?.signedUrl)return null;
      return [p.id,data.signedUrl];
    }));
    for(const row of results)if(row)state.photoURLs[row[0]]=row[1];
  }
  async function loadCloud(){
    if (!state.db||state.syncing)return;
    state.syncing=true;
    try{
      const {data:{session},error:authError}=await state.db.auth.getSession();
      if(authError)throw authError;
      state.user=session?.user||null;
      const calls=[state.db.from('soccer_field_edits').select('*'),state.db.from('soccer_reviews').select('*').order('created_at',{ascending:false}),state.db.from('soccer_photos').select('*').order('created_at',{ascending:false})];
      if(state.user)calls.push(state.db.from('soccer_admins').select('user_id').eq('user_id',state.user.id));
      const values=await Promise.all(calls);
      const err=values.find(x=>x.error)?.error;
      if(err)throw err;
      state.admin=Boolean(state.user&&values[3]?.data?.some(x=>x.user_id===state.user.id));
      state.edits=Object.fromEntries((values[0].data||[]).map(x=>[x.field_id,x]));
      places=seedPlaces.map(seed=>{
        const d=state.edits[seed.id];
        if(!d)return seed;
        return {...seed,...(d.edits||{}),verified:Array.isArray(d.verified_keys)?d.verified_keys:seed.verified};
      });
      cities=[...new Set(places.map(p=>p.city))].sort((a,b)=>a.localeCompare(b,'fr-CA'));
      state.reviews=values[1].data||[];
      state.fieldPhotos=values[2].data||[];
      await signedPhotos();
      if(state.admin){const res=await state.db.from('soccer_suggestions').select('*').order('created_at',{ascending:false}).limit(100);state.suggestions=res.error?[]:res.data||[];}else state.suggestions=[];
      state.error='';state.status='Synchronisé';
    } catch(e){state.error=message(e);console.warn('SoccerSpot Cloud',e);}
    finally {state.syncing=false;render();}
  }
  async function start(){
    if (!active){render();return;}
    try{
      if(!window.supabase)await new Promise((resolve,reject)=>{
        const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';s.onload=resolve;s.onerror=()=>reject(new Error('Bibliothèque Supabase inaccessible sans Internet.'));document.head.appendChild(s);
      });
      state.db=window.supabase.createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      state.db.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY'){S.accountMode='recovery';location.hash='compte';}setTimeout(loadCloud,0);});
      await loadCloud();
    }catch(e){state.error=message(e);state.status='Erreur de connexion';render();}
  }

  async function login(e){
    e.preventDefault();if(!state.db){toast('La connexion Supabase est à configurer.');return;}
    const f=new FormData(e.target),email=String(f.get('email')||'').trim(), password=String(f.get('password')||'');
    const mode=S.accountMode||'login';
    let res;
    if(mode==='signup')res=await state.db.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname+'#compte'}});
    else if(mode==='reset')res=await state.db.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname+'#compte'});
    else res=await state.db.auth.signInWithPassword({email,password});
    if(res.error){toast('Connexion : '+message(res.error));return;}
    toast(mode==='signup'?'Vérifie ton courriel pour confirmer ton compte.':mode==='reset'?'Si le compte existe, un courriel a été envoyé.':'Connexion réussie!');
    if(mode==='login'){await loadCloud();location.hash='compte';}
  }
  async function saveReview(e){
    e.preventDefault();if(!requireUser())return;
    const id=e.target.dataset.id,txt=String(new FormData(e.target).get('comment')||'').trim();
    if(!S.reviewStars){toast('Choisis une note de 1 à 5 étoiles.');return;}
    if(txt.length<3||txt.length>800){toast('Ton commentaire doit contenir entre 3 et 800 caractères.');return;}
    const {error}=await state.db.from('soccer_reviews').upsert({field_id:id,user_id:state.user.id,stars:S.reviewStars,comment:txt},{onConflict:'field_id,user_id'});
    if(error){toast(message(error));return;}
    toast('Ton avis est maintenant public.');S.reviewStars=0;await loadCloud();
  }
  async function uploadPhoto(e){
    e.preventDefault();if(!requireUser())return;
    const f=new FormData(e.target),file=f.get('file'),id=e.target.dataset.id;
    const types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
    if(!(file instanceof File)||!types[file.type]||file.size>5*1024*1024||file.size===0){toast('Photo JPG, PNG ou WebP de 5 Mo maximum.');return;}
    const count=state.fieldPhotos.filter(p=>p.field_id===id&&own(p)).length;
    if(count>=8){toast('Maximum 8 photos par membre et par terrain.');return;}
    const path=state.user.id+'/'+id+'/'+crypto.randomUUID()+'.'+types[file.type];
    toast('Téléversement en cours…');
    const put=await state.db.storage.from('soccer-photos').upload(path,file,{contentType:file.type,upsert:false});
    if(put.error){toast(message(put.error));return;}
    const res=await state.db.from('soccer_photos').insert({field_id:id,user_id:state.user.id,storage_path:path,caption:String(f.get('caption')||'').trim().slice(0,240)});
    if(res.error){await state.db.storage.from('soccer-photos').remove([path]);toast('Photo non enregistrée : '+message(res.error));return;}
    toast('Photo reçue! En attente de ton administrateur.');await loadCloud();
  }
  async function submitSuggestion(e){
    e.preventDefault();if(!requireUser())return;
    const form=new FormData(e.target);
    const data={user_id:state.user.id,type:String(form.get('type')),field_name:String(form.get('field_name')).trim(),city:String(form.get('city')).trim(),details:String(form.get('details')).trim()};
    const {error}=await state.db.from('soccer_suggestions').insert(data);
    if(error){toast(message(error));return;}toast('Suggestion envoyée à l’administrateur.');e.target.reset();if(state.admin)await loadCloud();
  }
  async function saveField(e){
    e.preventDefault();if(!state.admin)return;
    const id=e.target.dataset.id,p=places.find(x=>x.id===id),previous=state.edits[id];if(!p)return;
    const f=new FormData(e.target),raw=Object.fromEntries(f.entries());
    const values={
      name:String(raw.name||'').trim(),city:String(raw.city||'').trim(),address:String(raw.address||'').trim(),
      kind:raw.kind||null,price:raw.price||null,access:raw.access||null,
      surface:String(raw.surface||'').split(',').map(s=>s.trim().toLowerCase()).filter(s=>['naturel','synthétique'].includes(s)),
      formats:String(raw.formats||'').split(',').map(s=>s.trim()).filter(s=>['4','7','11'].includes(s)),
      lighting:raw.lighting===''?null:raw.lighting==='true',goals:raw.goals===''?null:raw.goals==='true',
      restrooms:raw.restrooms===''?null:raw.restrooms==='true',parking:raw.parking===''?null:raw.parking==='true',
      hours:String(raw.hours||'').trim()||null,notes:String(raw.notes||'').trim(),
      source:String(raw.source||'').trim(),sourceName:String(raw.sourceName||'').trim()
    };
    if(!/^https:\/\//i.test(values.source)){toast('La source doit commencer par https://');return;}
    if(!values.name||!values.city||!values.address){toast('Remplis le nom, la ville et l’adresse.');return;}
    const diffs={};for(const [k,v] of Object.entries(values))if(changed(v,p[k]))diffs[k]=v;
    const newVerified=(p.verified||[]).filter(k=>!(k in diffs));
    if(f.has('verified'))for(const k of Object.keys(diffs))if(!newVerified.includes(k))newVerified.push(k);
    if(Object.keys(diffs).length===0){toast('Aucun changement détecté.');return;}
    const row={field_id:id,edits:{...(previous?.edits||{}),...diffs},verified_keys:newVerified,
      cover_photo_id:previous?.cover_photo_id||null,edited_by:state.user.id};
    const {error}=await state.db.from('soccer_field_edits').upsert(row,{onConflict:'field_id'});
    if(error){toast(message(error));return;}
    toast('Fiche modifiée et synchronisée!');await loadCloud();
  }
  async function setCover(photoId){
    if(!state.admin)return;
    const p=state.fieldPhotos.find(x=>x.id===photoId&&x.approved);if(!p){toast('Approuve cette photo avant de la sélectionner.');return;}
    const ed=state.edits[p.field_id];
    const row={field_id:p.field_id,edits:ed?.edits||{},verified_keys:ed?.verified_keys||places.find(x=>x.id===p.field_id)?.verified||[],cover_photo_id:p.id,edited_by:state.user.id};
    const {error}=await state.db.from('soccer_field_edits').upsert(row,{onConflict:'field_id'});
    if(error){toast(message(error));return;}toast('Photo principale modifiée!');await loadCloud();
  }
  async function handleAction(t) {
    const a=t.dataset.cloudAction,id=t.dataset.id;
    try{
      if(a==='mode'){S.accountMode=t.dataset.value;render();}
      else if(a==='refresh')await loadCloud();
      else if(a==='logout'){await state.db.auth.signOut();state.user=null;state.admin=false;location.hash='compte';await loadCloud();}
      else if(a==='star'){S.reviewStars=Number(t.dataset.value);const input=document.querySelector('#cloud-review-text');const val=input?.value;render();if(val){const n=document.querySelector('#cloud-review-text');if(n)n.value=val;}}
      else if(a==='edit-field'){S.adminFieldId=id;location.hash='admin';}
      else if(a==='delete-review'){
        if(!requireUser()||!confirm('Supprimer cet avis?'))return;
        const {error}=await state.db.from('soccer_reviews').delete().eq('id',id);
        if(error)throw error;toast('Avis supprimé');await loadCloud();
      } else if(a==='approve-photo'){
        if(!state.admin)return;const {error}=await state.db.from('soccer_photos').update({approved:true}).eq('id',id);
        if(error)throw error;toast('Photo approuvée');await loadCloud();
      }else if(a==='make-cover')await setCover(id);
      else if(a==='delete-cloud-photo'){
        const p=state.fieldPhotos.find(x=>x.id===id);if(!p||!(own(p)||state.admin)||!confirm('Supprimer cette photo définitivement?'))return;
        const remove=await state.db.storage.from('soccer-photos').remove([p.storage_path]);
        if(remove.error)throw remove.error;
        const record=await state.db.from('soccer_photos').delete().eq('id',id);
        if(record.error)throw record.error;
        if(state.admin && state.edits[p.field_id]?.cover_photo_id===id){
          const row=state.edits[p.field_id];await state.db.from('soccer_field_edits').update({cover_photo_id:null,edited_by:state.user.id}).eq('field_id',p.field_id);
        }
        toast('Photo supprimée');await loadCloud();
      }else if(a==='delete-suggestion'){
        if(!state.admin||!confirm('Archiver cette suggestion?'))return;
        const {error}=await state.db.from('soccer_suggestions').delete().eq('id',id);
        if(error)throw error;toast('Suggestion archivée');await loadCloud();
      }
    }catch(e){toast(message(e));}
  }
  document.body.addEventListener('click',e=>{
    const t=e.target.closest('[data-cloud-action]');if(!t)return;e.preventDefault();e.stopPropagation();handleAction(t);
  });
  document.body.addEventListener('change',e=>{if(e.target.dataset.cloudAdminSelect){S.adminFieldId=e.target.value;render();}});
  document.body.addEventListener('submit',async e=>{
    try{
      if(e.target.id==='cloud-auth-form'){e.preventDefault();await login(e);}
      else if(e.target.id==='cloud-reset-password-form'){e.preventDefault();if(!requireUser())return;const password=String(new FormData(e.target).get('password')||'');const result=await state.db.auth.updateUser({password});if(result.error)throw result.error;S.accountMode='login';toast('Mot de passe mis à jour!');render();}
      else if(e.target.id==='cloud-change-password-form'){
        e.preventDefault();if(!requireUser())return;
        const form=e.target, f=new FormData(form), current=String(f.get('current')||''), next=String(f.get('password')||''), confirmPass=String(f.get('confirm')||'');
        if(next.length<8){toast('Le nouveau mot de passe doit avoir au moins 8 caractères.');return;}
        if(next!==confirmPass){toast('Les deux nouveaux mots de passe ne correspondent pas.');return;}
        if(current===next){toast('Choisis un nouveau mot de passe différent.');return;}
        const verify=await state.db.auth.signInWithPassword({email:state.user.email,password:current});
        if(verify.error){toast('Mot de passe actuel incorrect.');return;}
        const changed=await state.db.auth.updateUser({password:next});
        if(changed.error){toast('Impossible de changer le mot de passe : '+message(changed.error));return;}
        form.reset();toast('Ton mot de passe a été modifié!');await loadCloud();
      }
      else if(e.target.id==='cloud-review-form'){e.preventDefault();await saveReview(e);}
      else if(e.target.id==='cloud-photo-form'){e.preventDefault();await uploadPhoto(e);}
      else if(e.target.id==='cloud-suggestion-form'){e.preventDefault();await submitSuggestion(e);}
      else if(e.target.id==='cloud-admin-form'){e.preventDefault();await saveField(e);}
    }catch(err){toast(message(err));}
  });
  // Redessin immédiat pour le bouton « Compte », puis synchronisation en ligne.
  window.removeEventListener('hashchange', oldRoute);
  window.addEventListener('hashchange', route);
  route();start();
})();
