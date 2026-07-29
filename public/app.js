// Add event listener once the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const whatsappBtn = document.getElementById('send-whatsapp-btn') || document.querySelector('button[onclick="sendWhatsAppLink()"]');
  const phoneInput = document.getElementById('whatsappPhone') || document.getElementById('target-phone-input');

  if (whatsappBtn) {
    whatsappBtn.addEventListener('click', (e) => {
      e.preventDefault();

      const rawPhone = phoneInput ? phoneInput.value.trim() : '';

      if (!rawPhone) {
        alert("Please enter a valid phone number.");
        return;
      }

      // Remove non-numeric characters (+, -, spaces)
      const cleanPhone = rawPhone.replace(/[^0-9]/g, '');

      if (cleanPhone.length < 10) {
        alert("Please enter a full phone number including country code (e.g., 919876543210).");
        return;
      }

      // Deployed Render domain
      const liveHost = "https://vehicle-tracker-app-ysdj.onrender.com";
      const trackingUrl = `${liveHost}/driver.html?phone=${cleanPhone}`;

      const message = `Hello! Please click this link to enable live location tracking:\n${trackingUrl}`;
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

      window.open(whatsappUrl, '_blank');
    });
  }
});