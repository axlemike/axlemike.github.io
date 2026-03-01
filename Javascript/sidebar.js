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
                if (newSide) {
                    document.body.insertBefore(newSide, document.body.firstChild);
                    // Ensure the sidebar retains fixed left positioning even if external CSS
                    // was accidentally removed or overridden on the live site.
                    try {
                        enforceSidebarStyles(newSide);
                    } catch(e) { console.warn('enforceSidebarStyles failed', e); }
                }
            }
            catch (e)
            {
                console.warn('sidebar injection failed', e);
                // fallback to HTML string
                document.querySelectorAll('.sidenav').forEach(function(el){ el.remove(); });
                var tmp2 = document.createElement('div'); tmp2.innerHTML = fallbackHtml;
                var injected = tmp2.firstElementChild;
                document.body.insertBefore(injected, document.body.firstChild);
                try { enforceSidebarStyles(injected); } catch(e) { console.warn('enforceSidebarStyles failed', e); }
            }
        }).catch(function()
        {
            // fetch failed, inject fallback
            try {
                document.querySelectorAll('.sidenav').forEach(function(el){ el.remove(); });
                var tmp3 = document.createElement('div'); tmp3.innerHTML = fallbackHtml;
                var injected2 = tmp3.firstElementChild;
                document.body.insertBefore(injected2, document.body.firstChild);
                try { enforceSidebarStyles(injected2); } catch(e) { console.warn('enforceSidebarStyles failed', e); }
            } catch (e) {
                console.error('sidebar fallback injection failed', e);
            }
        }).finally(function(){
            init();
        });
    }

    // Ensure sidebar element and body margin are correctly set even when CSS is missing
    function enforceSidebarStyles(sideEl) {
        if (!sideEl) return;
        // read CSS variables for widths, fall back to sensible defaults
        var root = window.getComputedStyle(document.documentElement);
        var w = root.getPropertyValue('--sidebar-width') || '220px';
        var g = root.getPropertyValue('--sidebar-gutter') || '18px';
        w = w.trim(); g = g.trim();
        // apply inline styles to keep sidebar fixed on the left
        sideEl.style.position = 'fixed';
        sideEl.style.left = '0';
        sideEl.style.top = '0';
        sideEl.style.width = w;
        sideEl.style.zIndex = '1000';
        sideEl.style.backgroundColor = sideEl.style.backgroundColor || 'var(--sidebar-bg)';
        // compute numeric margin-left for body if possible
        function parsePx(v){ var m = (v||'').match(/(-?\d+(?:\.\d+)?)px/); return m ? parseFloat(m[1]) : NaN; }
        var wpx = parsePx(w); var gpx = parsePx(g);
        if (!isNaN(wpx) && !isNaN(gpx)) {
            document.body.style.marginLeft = (wpx + gpx) + 'px';
        } else {
            // fallback to CSS calc using variables
            document.body.style.marginLeft = 'calc(' + w + ' + ' + g + ')';
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
