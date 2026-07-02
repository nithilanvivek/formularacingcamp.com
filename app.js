// Mobile menu functionality
const hamburgerBtn = document.getElementById('hamburger-btn');
const mobileMenu = document.getElementById('mobile-menu');
const mobileOverlay = document.getElementById('mobile-overlay');
const mobileMenuLinks = document.querySelectorAll('.mobile-menu-link');


function toggleMenu() {
hamburgerBtn.classList.toggle('active');
mobileMenu.classList.toggle('active');
mobileOverlay.classList.toggle('active');
}


function closeMenu() {
hamburgerBtn.classList.remove('active');
mobileMenu.classList.remove('active');
mobileOverlay.classList.remove('active');
}


hamburgerBtn.addEventListener('click', toggleMenu);
mobileOverlay.addEventListener('click', closeMenu);
mobileMenuLinks.forEach(link => {
link.addEventListener('click', closeMenu);
});


// Initialize local email list
let allSubscriptions = [];


// Subscription functionality
const emailInput = document.getElementById('subscription-email');
const subscribeBtn = document.getElementById('subscribe-btn');
const messageDiv = document.getElementById('subscription-message');


subscribeBtn.addEventListener('click', async function(e) {
e.preventDefault();
const email = emailInput.value.trim();


if (!email || !email.includes('@')) {
showMessage('Please enter a valid email address', 'error');
return;
}


subscribeBtn.disabled = true;
subscribeBtn.textContent = 'Subscribing...';
subscribeBtn.style.opacity = '0.7';


// Store locally
allSubscriptions.push({ email: email, subscribed_at: new Date().toISOString() });

showMessage('✓ Thank you! We\'ll be in touch soon.', 'success');
emailInput.value = '';
setTimeout(() => {
subscribeBtn.disabled = false;
subscribeBtn.textContent = 'Subscribe';
subscribeBtn.style.opacity = '1';
messageDiv.style.display = 'none';
}, 3000);
});


function showMessage(text, type) {
messageDiv.textContent = text;
messageDiv.style.display = 'block';
if (type === 'success') {
messageDiv.style.color = '#4ade80';
} else {
messageDiv.style.color = '#ff6b6b';
}
}


emailInput.addEventListener('keypress', function(e) {
if (e.key === 'Enter') {
subscribeBtn.click();
}
});


// Contact Form Functionality
function handleContactSubmit(event) {
event.preventDefault();


const email = document.getElementById('contact-email').value.trim();
const subject = document.getElementById('contact-subject').value.trim();
const message = document.getElementById('contact-message').value.trim();
const statusDiv = document.getElementById('contact-message-status');
const submitBtn = document.getElementById('contact-submit-btn');


// Validate inputs
if (!email || !subject || !message) {
statusDiv.textContent = '❌ Please fill in all fields';
statusDiv.style.color = '#ff6b6b';
statusDiv.style.display = 'block';
return;
}


if (!email.includes('@')) {
statusDiv.textContent = '❌ Please enter a valid email address';
statusDiv.style.color = '#ff6b6b';
statusDiv.style.display = 'block';
return;
}


// Prepare the email
const mailtoLink = `mailto:nithilanvivek@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`From: ${email}\n\n${message}`)}`;


// Show loading state
submitBtn.disabled = true;
submitBtn.textContent = 'Sending...';


// Open mailto link
window.open(mailtoLink, '_blank');


// Show success message
setTimeout(() => {
statusDiv.textContent = '✓ Opening your email client...';
statusDiv.style.color = '#4ade80';
statusDiv.style.display = 'block';


// Reset form
document.getElementById('contact-form').reset();
submitBtn.disabled = false;
submitBtn.textContent = 'Send Message';


// Clear message after 3 seconds
setTimeout(() => {
statusDiv.style.display = 'none';
}, 3000);
}, 500);
}

if (window.lucide) {
  lucide.createIcons();
}
