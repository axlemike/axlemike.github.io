(function()
{
    // site metadata is provided by site_meta.js (window.SITE_YEAR)

    function init() {
    // Mark the active sidebar or submenu link based on current filename.
    // Prefer submenu matches (e.g. projects_github.html) over the parent Projects button.
    try
    {
        var path = window.location.pathname.split('/').pop();
        if (!path) path = 'index.html';

        // Mark top-level sidebar links active when they match the current filename.
        // Do NOT mark submenu items as active to avoid highlighting them.
        var links = document.querySelectorAll('.sidebarLink');
        links.forEach(function(a){
            // support anchors (`href`) or non-link labels using `data-href`
            // but skip submenu parent labels here — they are handled later so they
            // don't become "active" simply because the parent page was visited.
            if (a.classList && a.classList.contains('sidebarLabel')) return;
            var href = a.getAttribute('href') || a.dataset.href;
            if (!href) return;
            var hrefName = href.split('/').pop();
            if (hrefName === path || (hrefName === 'index.html' && path === 'index.html')) {
                a.classList.add('active');
            } else {
                a.classList.remove('active');
            }
        });

        // Ensure submenu items never carry an active class (clear any leftover state)
        document.querySelectorAll('.submenu a.active').forEach(function(a){ a.classList.remove('active'); });
    }
    catch (e)
    {
        console.error('sidebar.js error', e);
    }
    
    // Generalized handling for submenu parents (mark parent active when a child matches)
    try {
        var submenuParents = document.querySelectorAll('.has-submenu');
        submenuParents.forEach(function(parent) {
            var parentLink = parent.querySelector('.sidebarLink');
            if (!parentLink) return;

            // remember original label so we can restore it
            if (!parentLink.dataset.orig) parentLink.dataset.orig = parentLink.textContent.trim();

            // collect submenu anchors scoped to this parent
            var submenuAnchors = Array.prototype.slice.call(parent.querySelectorAll('.submenu a'));

            // ensure submenu anchors never retain an active class
            submenuAnchors.forEach(function(sa){ sa.classList.remove('active'); });

            // find a matching child for current path
            var matchingChild = submenuAnchors.find(function(a){
                var href = a.getAttribute('href') || '';
                return href.split('/').pop() === path;
            });

            var parentHref = ((parentLink.getAttribute('href') || parentLink.dataset.href) || '').split('/').pop();

            // determine if we're on a subpage for this parent
            var onSubpage = false;
            if (matchingChild) onSubpage = true;
            // special case: projects_* filenames map to Projects parent
            if (!onSubpage && parentHref === 'projects.html' && path && path.indexOf('projects_') === 0) onSubpage = true;

            // If on a subpage, enable animated label behavior: show submenu label by default and
            // reveal the parent label on hover (left-shift effect). Otherwise restore original label.
            if (onSubpage) {
                parentLink.classList.add('has-animated');

                var currentText = null;
                if (matchingChild) currentText = matchingChild.textContent.trim();

                // projects_* filename -> derive nicer label
                if (!currentText && parentHref === 'projects.html' && path && path.indexOf('projects_') === 0) {
                    var name = path.replace(/^projects_/, '').replace(/\.html$/i, '');
                    name = name.replace(/[-_]/g, ' ');
                    currentText = name.replace(/\b\w/g, function(ch){ return ch.toUpperCase(); });
                }

                if (!currentText) currentText = parentLink.dataset.orig || '';

                // mark parent active when on the subpage
                parentLink.classList.add('active');

                // inject animated spans if missing
                if (!parentLink.querySelector('.title-current')) {
                    var def = parentLink.dataset.orig || '';
                    parentLink.innerHTML = '<span class="title-current">' + currentText + '</span>' +
                                           '<span class="title-default">' + def + '</span>';
                } else {
                    var cur = parentLink.querySelector('.title-current'); if (cur) cur.textContent = currentText;
                    var def2 = parentLink.dataset.orig || '';
                    var defEl = parentLink.querySelector('.title-default'); if (defEl) defEl.textContent = def2;
                }

                parent.addEventListener('mouseenter', function(){ parentLink.classList.add('show-default'); });
                parent.addEventListener('mouseleave', function(){ parentLink.classList.remove('show-default'); });
                // If the parent is clicked with a mouse, remove focus so it doesn't remain "stuck" in focus styles.
                parentLink.addEventListener('click', function(ev){
                    // ev.detail > 0 indicates a user mouse click; detail===0 is often keyboard-initiated click
                    if (ev.detail && ev.detail > 0) {
                        // remove any hover/animated classes that may stick after a mouse click
                        parentLink.classList.remove('show-default');
                        parentLink.classList.remove('show-projects');
                        // if it was added accidentally, remove active state — submenu logic will re-add when appropriate
                        parentLink.classList.remove('active');
                        // blur after the click completes to clear :focus/:focus-within
                        setTimeout(function(){ try { parentLink.blur(); } catch(e){} }, 0);

                        // also clear focus from any element (robust fallback) and blur submenu anchors
                        setTimeout(function(){
                            try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch(e){}
                            try { document.querySelectorAll('.submenu a').forEach(function(a){ try{ a.blur(); }catch(e){} }); } catch(e){}
                        }, 0);
                    }
                });
            } else {
                // not on subpage: restore original label and remove animated bits
                if (parentLink.querySelector('.title-current')) {
                    parentLink.textContent = parentLink.dataset.orig || parentLink.textContent;
                }
                parentLink.classList.remove('has-animated', 'show-default', 'active');
            }
        });
    } catch (e) {
        console.error('sidebar.js submenu handling error', e);
    }
}


// Load sidebar fragment, inject it, then run init()
function loadSidebarAndInit()
{
    // try to fetch sidebar.html; if it fails (file:// or network), inject a small fallback
        var fallbackHtml = `
    <div class="sidenav">
        <a href="index.html" class="sidebarLink">Home</a>
         <div class="has-submenu">
            <button class="sidebarLink sidebarLabel" data-href="about.html" type="button">About</button>
            <div class="submenu">
                <a href="bio.html">Bio</a>
                <a href="resume.html">Resume</a>
            </div>
        </div>
        <a href="blog.html" class="sidebarLink">Blog</a>
        <div class="has-submenu">
            <button class="sidebarLink sidebarLabel" data-href="projects.html" type="button">Projects</button>
            <div class="submenu">
                    <a href="gameography.html">Gameography</a>
                    <a href="github.html">GitHub</a>
                    <a href="shadertoys.html">Shadertoys</a>
            </div>
        </div>
        <div class="has-submenu">
            <button class="sidebarLink sidebarLabel" data-href="contact.html" type="button">Contact</button>
            <div class="submenu">
                    <a href="https://www.linkedin.com/in/axlemke" target="_blank" rel="noopener">LinkedIn</a>
                    <a href="https://twitter.com/axlemke" target="_blank" rel="noopener">Twitter</a>
            </div>
        </div>
    </div>
    `;

    fetch('sidebar.html').then(function(resp)
    {
            if (!resp.ok) throw new Error('no sidebar fragment');
            return resp.text();
        }).then(function(html)
        {
            try
            {
                document.querySelectorAll('.sidenav').forEach(function(el){ el.remove(); });
                var tmp = document.createElement('div');
                tmp.innerHTML = html.trim();
                var newSide = tmp.firstElementChild;
                if (newSide) document.body.insertBefore(newSide, document.body.firstChild);
            }
            catch (e)
            {
                console.warn('sidebar injection failed', e);
                // fallback to HTML string
                document.querySelectorAll('.sidenav').forEach(function(el){ el.remove(); });
                var tmp2 = document.createElement('div'); tmp2.innerHTML = fallbackHtml;
                document.body.insertBefore(tmp2.firstElementChild, document.body.firstChild);
            }
        }).catch(function()
        {
            // fetch failed, inject fallback
            try {
                document.querySelectorAll('.sidenav').forEach(function(el){ el.remove(); });
                var tmp3 = document.createElement('div'); tmp3.innerHTML = fallbackHtml;
                document.body.insertBefore(tmp3.firstElementChild, document.body.firstChild);
            } catch (e) {
                console.error('sidebar fallback injection failed', e);
            }
        }).finally(function(){
            init();
            try { injectBackgroundUI(); } catch(e){ console.warn('injectBackgroundUI failed', e); }
        });
    }

// Inject fullscreen background canvas, overlay, toggle button and load shader script
function injectBackgroundUI(){
    if (document.getElementById('bg-canvas')) return;
    try {
        var canvas = document.createElement('canvas'); canvas.id = 'bg-canvas'; canvas.setAttribute('aria-hidden','true');
        var overlay = document.createElement('div'); overlay.id = 'bg-overlay'; overlay.setAttribute('aria-hidden','true');
        var btn = document.createElement('button'); btn.id = 'bg-toggle'; btn.className = 'bg-toggle';

        // read persisted preference; default to disabled
        var enabled = localStorage.getItem('bgShaderEnabled');
        if (enabled === null) enabled = '0';
        var isEnabled = enabled === '1';
        // ensure a per-navigation seed exists to vary animations between pages
        if (localStorage.getItem('bgShaderSeed') === null) localStorage.setItem('bgShaderSeed', '0');
        btn.textContent = isEnabled ? 'Disable background' : 'Enable background';
        btn.setAttribute('aria-pressed', isEnabled ? 'true' : 'false');

        // insert canvas and overlay at top of body so they sit behind the content
        // insert canvas and overlay at top of body so they sit behind the content
        document.body.insertBefore(canvas, document.body.firstChild);
        document.body.insertBefore(overlay, document.body.firstChild);
        // set initial visibility based on preference
        canvas.style.display = isEnabled ? 'block' : 'none';
        overlay.style.display = isEnabled ? 'block' : 'none';
        // append toggle near end of body so it's on top
        document.body.appendChild(btn);
        // bump seed on internal navigation so next page shows a different animation phase
        document.addEventListener('click', function(e){
            try {
                var a = e.target.closest && e.target.closest('a');
                if (!a) return;
                var href = a.getAttribute('href') || a.dataset.href || '';
                if (!href) return;
                if (a.target && a.target === '_blank') return;
                if (href.indexOf('#') === 0) return;
                if (/^https?:\/\//i.test(href)) return;
                if (/\.html$/i.test(href)) {
                    var seed = parseInt(localStorage.getItem('bgShaderSeed')||'0', 10) || 0;
                    seed = (seed + 1) % 1000000;
                    localStorage.setItem('bgShaderSeed', seed.toString());
                }
            } catch (e) { }
        }, true);

        // dynamically load background script if not present
        if (!document.querySelector('script[src="Javascript/background_shader.js"]')){
            var s = document.createElement('script'); s.src = 'Javascript/background_shader.js';
            document.body.appendChild(s);
        }
    } catch(e) {
        console.warn('failed to inject background UI', e);
    }
}

    if (document.readyState === 'loading')
    {
        document.addEventListener('DOMContentLoaded', loadSidebarAndInit);
    }
    else
    {
        loadSidebarAndInit();
    }
})();

// Track whether the user is interacting by mouse; when true, suppress focus-based
// hover styles (so clicking a parent with mouse doesn't leave it styled via :focus-within).
document.addEventListener('mousedown', function(){ document.body.classList.add('using-mouse'); }, true);
document.addEventListener('keydown', function(){ document.body.classList.remove('using-mouse'); }, true);
