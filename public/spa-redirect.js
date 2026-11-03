(function() {
  var redirect = sessionStorage.getItem('spa_redirect');
  if (redirect) {
    sessionStorage.removeItem('spa_redirect');
    var url = new URL(redirect, location.origin);
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  var query = window.location.search;
  if (query) {
    var params = new URLSearchParams(query);
    var path = params.get('p');
    if (path) {
      history.replaceState(null, '', path);
    }
  }
})();
