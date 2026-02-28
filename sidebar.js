(function()
{
    function init() {
    // Mark the active sidebar or submenu link based on current filename.
    // Prefer submenu matches (e.g. projects_github.html) over the parent Projects button.
    try
    {
        var path = window.location.pathname.split('/').pop();
        if (!path) path = 'index.html';

        // First try submenu links
        var submenuLinks = document.querySelectorAll('.submenu a');
        var found = false;
        submenuLinks.forEach(function(a){
            var href = a.getAttribute('href');
            if (!href) return;
            var hrefName = href.split('/').pop();
            if (hrefName === path)
            {
                a.classList.add('active');
                found = true;
            }
        });

        if (!found)
        {
            // Fallback: mark top-level sidebar links
            var links = document.querySelectorAll('.sidebarLink');
            links.forEach(function(a){
                var href = a.getAttribute('href');
                if (!href) return;
                var hrefName = href.split('/').pop();
                if (hrefName === path || (hrefName === 'index.html' && path === 'index.html'))
                {
                    a.classList.add('active');
                }
            });
        }
    }
    catch (e)
    {
        console.error('sidebar.js error', e);
    }
    
    // Animated Projects label inside the sidebar Projects button
    try
    {
        // find the .has-submenu that contains the Projects link (href ends with projects.html)
        // prefer the one that actually contains a .submenu (so hover events fire where submenu appears)
        var projectsMenu = null;
        var projectsLink = null;
        var candidates = document.querySelectorAll('.has-submenu');
        candidates.forEach(function(c){
            if (projectsMenu) return; // already found
            var a = c.querySelector('.sidebarLink');
            if (!a) return;
            var href = a.getAttribute('href') || '';
            var isProjectsHref = href.split('/').pop() === 'projects.html';
            var hasSubmenu = !!c.querySelector('.submenu');
            if (isProjectsHref && hasSubmenu)
            {
                projectsMenu = c;
                projectsLink = a;
            }
        });
        // fallback: pick a candidate whose link href is projects.html
        if (!projectsMenu)
        {
            candidates.forEach(function(c)
            {
                if (projectsMenu) return;
                var a = c.querySelector('.sidebarLink');
                if (!a) return;
                var href = a.getAttribute('href') || '';
                if (href.split('/').pop() === 'projects.html')
                {
                    projectsMenu = c;
                    projectsLink = a;
                }
            });
        }

        // final fallback to first candidate
        if (!projectsMenu && candidates.length)
        {
            projectsMenu = candidates[0];
            projectsLink = projectsMenu.querySelector('.sidebarLink');
        }

        if (projectsLink)
        {
            // mark this link as animated-capable
            projectsLink.classList.add('has-animated');

            // determine the current subpage name from an active submenu item (prefer submenu active)
            var activeSub = document.querySelector('.submenu a.active');
            var currentText = activeSub ? activeSub.textContent.trim() : null;

            // If there's no active submenu item but we're on a projects_* page, try to match by filename
            var path3 = window.location.pathname.split('/').pop();
            var onProjectSubpage = false;
            if (!currentText)
            {
                if (path3 && path3.indexOf('projects_') === 0)
                {
                    // derive a nicer label from filename e.g. projects_github.html -> GitHub
                    var name = path3.replace(/^projects_/, '').replace(/\.html$/i, '');
                    name = name.replace(/[-_]/g, ' ');
                    currentText = name.replace(/\b\w/g, function(ch){ return ch.toUpperCase(); });
                    onProjectSubpage = true;
                }
            } else {
                // if a submenu item was marked active earlier (not by us), treat as on subpage
                onProjectSubpage = true;
            }

            // default to Projects when we don't have a specific subpage
            if (!currentText) currentText = 'Projects';

            // If we're on a projects subpage, mark the Projects label active so it uses active color
            if (onProjectSubpage) {
                projectsLink.classList.add('active');
            } else {
                projectsLink.classList.remove('active');
            }

            // inject the animated spans if not already present
            if (!projectsLink.querySelector('.title-current'))
            {
                projectsLink.innerHTML = '<span class="title-current">'+currentText+'</span>' +
                                        '<span class="title-projects">Projects</span>';
            }
            else
            {
                // update existing text
                var cur = projectsLink.querySelector('.title-current');
                if (cur) cur.textContent = currentText;
            }

            // toggle the show-projects class on hover of the menu (so submenu hover shows "Projects")
            projectsMenu.addEventListener('mouseenter', function(){
                projectsLink.classList.add('show-projects');
            });
            projectsMenu.addEventListener('mouseleave', function(){
                projectsLink.classList.remove('show-projects');
            });
        }
    }
    catch (e)
    {
        console.error('sidebar.js title animation error', e);
    }
}


// Load sidebar fragment, inject it, then run init()
function loadSidebarAndInit()
{
    // try to fetch sidebar.html; if it fails (file:// or network), inject a small fallback
    var fallbackHtml = '<div class="sidenav">'
        + '<a href="index.html" class="sidebarLink">Home</a>'
        + '<a href="blog.html" class="sidebarLink">Blog</a>'
        + '<a href="about.html" class="sidebarLink">About</a>'
        + '<a href="resume.html" class="sidebarLink">Resume</a>'
        + '<div class="has-submenu">'
            + '<a href="projects.html" class="sidebarLink">Projects</a>'
            + '<div class="submenu">'
                + '<a href="projects_gameography.html">Gameography</a>'
                + '<a href="projects_github.html">GitHub</a>'
                + '<a href="projects_shadertoys.html">Shadertoys</a>'
            + '</div>'
        + '</div>'
        + '<a href="contact.html" class="sidebarLink">Contact</a>'
    + '</div>';

    fetch('sidebar.html').then(function(resp){
            if (!resp.ok) throw new Error('no sidebar fragment');
            return resp.text();
        }).then(function(html){
            try {
                document.querySelectorAll('.sidenav').forEach(function(el){ el.remove(); });
                var tmp = document.createElement('div');
                tmp.innerHTML = html.trim();
                var newSide = tmp.firstElementChild;
                if (newSide) document.body.insertBefore(newSide, document.body.firstChild);
            } catch (e) {
                console.warn('sidebar injection failed', e);
                // fallback to HTML string
                document.querySelectorAll('.sidenav').forEach(function(el){ el.remove(); });
                var tmp2 = document.createElement('div'); tmp2.innerHTML = fallbackHtml;
                document.body.insertBefore(tmp2.firstElementChild, document.body.firstChild);
            }
        }).catch(function(){
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
