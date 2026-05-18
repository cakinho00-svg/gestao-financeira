// Etapa 6 — PWA e menu mobile
let deferredInstallPrompt = null;

window.toggleMobileMenu = function(){
  document.getElementById('sidebarMenu')?.classList.toggle('open');
  document.getElementById('mobileOverlay')?.classList.toggle('show');
};

window.fecharMobileMenu = function(){
  document.getElementById('sidebarMenu')?.classList.remove('open');
  document.getElementById('mobileOverlay')?.classList.remove('show');
};

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  const installCard = document.getElementById('installCard');
  if (installCard) installCard.classList.add('show');
});

window.instalarApp = async function(){
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  document.getElementById('installCard')?.classList.remove('show');
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((error) => {
      console.warn('Service Worker não registrado:', error);
    });
  });
}
