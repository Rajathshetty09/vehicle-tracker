document.getElementById('send-whatsapp-btn').addEventListener('click', () => {
  const phoneInput = document.getElementById('target-phone-input').value.trim();
  
  if (!phoneInput) {
    alert("Please enter a phone number.");
    return;
  }

  // Clean the phone number (remove spaces, pluses, dashes)
  const cleanPhone = phoneInput.replace(/[^0-9]/g, '');

  // CRITICAL FIX: Use your deployed Render URL instead of localhost!
  const liveHost = "https://vehicle-tracker-app-ysdj.onrender.com";
  
  const trackingUrl = `${liveHost}/driver.html?phone=${cleanPhone}`;
  
  const message = `Hello! Please click this link to enable live location tracking:\n${trackingUrl}`;
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

  window.open(whatsappUrl, '_blank');
});