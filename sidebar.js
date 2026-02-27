(function(){
    // Mark the active sidebar or submenu link based on current filename.
    // Prefer submenu matches (e.g. projects_github.html) over the parent Projects button.
    try {
        var path = window.location.pathname.split('/').pop();
        if (!path) path = 'index.html';

        // First try submenu links
        var submenuLinks = document.querySelectorAll('.submenu a');
        var found = false;
        submenuLinks.forEach(function(a){
            var href = a.getAttribute('href');
            if (!href) return;
            var hrefName = href.split('/').pop();
            if (hrefName === path) {
                a.classList.add('active');
                found = true;
            }
        });

        if (!found) {
            // Fallback: mark top-level sidebar links
            var links = document.querySelectorAll('.sidebarLink');
            links.forEach(function(a){
                var href = a.getAttribute('href');
                if (!href) return;
                var hrefName = href.split('/').pop();
                if (hrefName === path || (hrefName === 'index.html' && path === 'index.html')) {
                    a.classList.add('active');
                }
            });
        }
    } catch (e) {
        console.error('sidebar.js error', e);
    }
})();
