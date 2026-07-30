// Mobile menu functionality
const hamburgerBtn = document.getElementById('hamburger-btn');
const mobileMenu = document.getElementById('mobile-menu');
const mobileOverlay = document.getElementById('mobile-overlay');
const mobileMenuLinks = document.querySelectorAll('.mobile-menu-link');


function toggleMenu() {
const isOpen = mobileMenu.classList.toggle('active');
hamburgerBtn.classList.toggle('active', isOpen);
mobileOverlay.classList.toggle('active', isOpen);
hamburgerBtn.setAttribute('aria-expanded', String(isOpen));
hamburgerBtn.setAttribute('aria-label', isOpen ? 'Close sections menu' : 'Open sections menu');
mobileMenu.setAttribute('aria-hidden', String(!isOpen));
}


function closeMenu() {
hamburgerBtn.classList.remove('active');
mobileMenu.classList.remove('active');
mobileOverlay.classList.remove('active');
hamburgerBtn.setAttribute('aria-expanded', 'false');
hamburgerBtn.setAttribute('aria-label', 'Open sections menu');
mobileMenu.setAttribute('aria-hidden', 'true');
}


if (hamburgerBtn && mobileMenu && mobileOverlay) {
hamburgerBtn.addEventListener('click', toggleMenu);
mobileOverlay.addEventListener('click', closeMenu);
}
mobileMenuLinks.forEach(link => {
link.addEventListener('click', closeMenu);
});
document.addEventListener('keydown', event => {
if (event.key === 'Escape' && mobileMenu.classList.contains('active')) {
closeMenu();
hamburgerBtn.focus();
}
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
bookAnnouncementTimer = setTimeout(hideBookAnnouncement, 6800);
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


function scheduleBookAnnouncement() {
setTimeout(showBookAnnouncement, 1000);
}


if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', scheduleBookAnnouncement, { once: true });
} else {
scheduleBookAnnouncement();
}

if (bookAnnouncementClose) {
bookAnnouncementClose.addEventListener('click', hideBookAnnouncement);
}

const buyBookFlip = document.querySelector('[data-buy-book-flip]');
const buyBookButton = document.getElementById('cta-button');

function closeBuyBookFlip() {
if (!buyBookFlip || !buyBookButton) {
return;
}

buyBookFlip.classList.remove('is-flipped');
buyBookButton.setAttribute('aria-expanded', 'false');
}

if (buyBookFlip && buyBookButton) {
buyBookButton.addEventListener('click', () => {
const isFlipped = buyBookFlip.classList.toggle('is-flipped');
buyBookButton.setAttribute('aria-expanded', String(isFlipped));
});

document.addEventListener('click', (event) => {
if (!buyBookFlip.classList.contains('is-flipped') || buyBookFlip.contains(event.target)) {
return;
}

closeBuyBookFlip();
});

document.addEventListener('keydown', (event) => {
if (event.key === 'Escape') {
closeBuyBookFlip();
}
});
}


// Contact Form Functionality
async function handleContactSubmit(event) {
event.preventDefault();


const form = event.target;
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


// Show loading state
submitBtn.disabled = true;
submitBtn.textContent = 'Sending...';
statusDiv.style.display = 'block';
statusDiv.textContent = 'Sending your message...';
statusDiv.style.color = '#0096FF';

try {
const response = await fetch(form.action, {
method: 'POST',
headers: {
 'Content-Type': 'application/json',
Accept: 'application/json'
},
body: JSON.stringify({
email,
subject,
message
})
});

if (!response.ok) {
throw new Error('Contact submission failed');
}

statusDiv.textContent = '✓ Message sent! Thanks for getting in touch.';
statusDiv.style.color = '#22c55e';

// Reset form
form.reset();

// Clear message after 3 seconds
setTimeout(() => {
statusDiv.style.display = 'none';
}, 3000);
} catch (error) {
statusDiv.textContent = 'Message could not be sent. Please try again in a moment.';
statusDiv.style.color = '#ff6b6b';
} finally {
submitBtn.disabled = false;
submitBtn.textContent = 'Send Message';
}
}

if (window.lucide) {
  lucide.createIcons();
}
