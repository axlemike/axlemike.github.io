(function()
{
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
            var href = a.getAttribute('href');
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

            // if any submenu anchor matches current path, mark the parent active
            var matchingChild = submenuAnchors.find(function(a){
                var href = a.getAttribute('href') || '';
                return href.split('/').pop() === path;
            });

            var parentHref = (parentLink.getAttribute('href') || '').split('/').pop();

            // For non-Projects parents, show the matching child's label in the parent when on that subpage
            if (parentHref !== 'projects.html') {
                if (matchingChild) {
                    parentLink.textContent = matchingChild.textContent.trim();
                    parentLink.classList.add('active');
                } else {
                    parentLink.textContent = parentLink.dataset.orig;
                    parentLink.classList.remove('active');
                }
            }

            // Special behavior for Projects parent: animated title and projects_* filename mapping
            if (parentHref === 'projects.html') {
                parentLink.classList.add('has-animated');

                var currentText = null;
                if (matchingChild) currentText = matchingChild.textContent.trim();

                var onProjectSubpage = false;
                if (!currentText) {
                    if (path && path.indexOf('projects_') === 0) {
                        var name = path.replace(/^projects_/, '').replace(/\.html$/i, '');
                        name = name.replace(/[-_]/g, ' ');
                        currentText = name.replace(/\b\w/g, function(ch){ return ch.toUpperCase(); });
                        onProjectSubpage = true;
                    }
                } else {
                    onProjectSubpage = true;
                }

                if (!currentText) currentText = 'Projects';

                if (onProjectSubpage) parentLink.classList.add('active');
                else parentLink.classList.remove('active');

                if (!parentLink.querySelector('.title-current')) {
                    parentLink.innerHTML = '<span class="title-current">' + currentText + '</span>' +
                                           '<span class="title-projects">Projects</span>';
                } else {
                    var cur = parentLink.querySelector('.title-current'); if (cur) cur.textContent = currentText;
                }

                parent.addEventListener('mouseenter', function(){ parentLink.classList.add('show-projects'); });
                parent.addEventListener('mouseleave', function(){ parentLink.classList.remove('show-projects'); });
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
        <a href="about.html" class="sidebarLink">About</a>
        <div class="submenu">
            <a href="bio.html">Bio</a>
            <a href="resume.html">Resume</a>
        </div>
    </div>
    <a href="blog.html" class="sidebarLink">Blog</a>
    <div class="has-submenu">
        <a href="projects.html" class="sidebarLink">Projects</a>
        <div class="submenu">
            <a href="projects_gameography.html">Gameography</a>
            <a href="projects_github.html">GitHub</a>
            <a href="projects_shadertoys.html">Shadertoys</a>
        </div>
    </div>
    <a href="contact.html" class="sidebarLink">Contact</a>
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
        });
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
