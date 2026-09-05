try {
  if (localStorage.getItem('mrfc-theme') === 'light') document.documentElement.classList.add('theme-light');
} catch {
  // El tema predeterminado permanece disponible si el almacenamiento está bloqueado.
}
