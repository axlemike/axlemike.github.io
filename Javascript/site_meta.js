// Central site metadata. Update the year here.
window.SITE_YEAR = 2026;

// Set copyright year in all .copyright-year spans
document.addEventListener('DOMContentLoaded', function() {
  var spans = document.querySelectorAll('.copyright-year');
  for (var i = 0; i < spans.length; i++) {
    spans[i].textContent = window.SITE_YEAR;
  }
});
