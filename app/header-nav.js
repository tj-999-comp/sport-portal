(() => {
  document.querySelectorAll('[data-page-switcher]').forEach((switcher) => {
    switcher.addEventListener('change', (event) => {
      const destination = event.currentTarget.value;
      if (destination) window.location.assign(destination);
    });
  });
})();
