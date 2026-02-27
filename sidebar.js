(function(){
    // Mark the active sidebar link based on current filename
    try {
        var path = window.location.pathname.split('/').pop();
        if (!path) path = 'index.html';

        var links = document.querySelectorAll('.sidebarLink');
        links.forEach(function(a){
            var href = a.getAttribute('href');
            if (!href) return;
            // normalize
            var hrefName = href.split('/').pop();
            if (hrefName === path || (hrefName === 'index.html' && path === 'index.html')) {
                a.classList.add('active');
            }
        });
    } catch (e) {
        console.error('sidebar.js error', e);
    }
})();
