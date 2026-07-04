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


if (hamburgerBtn && mobileMenu && mobileOverlay) {
hamburgerBtn.addEventListener('click', toggleMenu);
mobileOverlay.addEventListener('click', closeMenu);
}
mobileMenuLinks.forEach(link => {
link.addEventListener('click', closeMenu);
});


const bookAnnouncement = document.getElementById('book-announcement');
const bookAnnouncementClose = document.getElementById('book-announcement-close');
let bookAnnouncementTimer;

function getRgbChannels(color) {
const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
if (!match || match[4] === '0') {
return null;
}

return {
red: Number(match[1]),
green: Number(match[2]),
blue: Number(match[3])
};
}


function isLightAnnouncementBackground() {
const wrapper = document.getElementById('app-wrapper');
const sampledColor = wrapper ? getComputedStyle(wrapper).backgroundColor : getComputedStyle(document.body).backgroundColor;
const rgb = getRgbChannels(sampledColor);

if (!rgb) {
return !window.matchMedia('(prefers-color-scheme: dark)').matches;
}

const luminance = (0.2126 * rgb.red + 0.7152 * rgb.green + 0.0722 * rgb.blue) / 255;
return luminance > 0.55;
}


function updateAnnouncementPalette() {
const isLight = isLightAnnouncementBackground();
document.body.classList.toggle('announcement-background-light', isLight);
document.body.classList.toggle('announcement-background-dark', !isLight);
}


function showBookAnnouncement() {
if (!bookAnnouncement) {
return;
}

updateAnnouncementPalette();
document.body.classList.add('announcement-visible');
bookAnnouncement.classList.add('active');
bookAnnouncement.setAttribute('aria-hidden', 'false');
clearTimeout(bookAnnouncementTimer);
bookAnnouncementTimer = setTimeout(hideBookAnnouncement, 3750);
}


function hideBookAnnouncement() {
if (!bookAnnouncement) {
return;
}

document.body.classList.remove('announcement-visible');
bookAnnouncement.classList.remove('active');
bookAnnouncement.setAttribute('aria-hidden', 'true');
clearTimeout(bookAnnouncementTimer);
}


window.addEventListener('load', () => {
setTimeout(showBookAnnouncement, 1000);
});

if (bookAnnouncementClose) {
bookAnnouncementClose.addEventListener('click', hideBookAnnouncement);
}


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
