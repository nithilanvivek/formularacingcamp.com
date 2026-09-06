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
let bookAnnouncementPreviousFocus;

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
bookAnnouncementPreviousFocus = document.activeElement;
document.body.classList.add('announcement-visible');
bookAnnouncement.classList.add('active');
bookAnnouncement.setAttribute('aria-hidden', 'false');
bookAnnouncementClose?.focus();
clearTimeout(bookAnnouncementTimer);
bookAnnouncementTimer = setTimeout(hideBookAnnouncement, 12000);
}


function hideBookAnnouncement() {
if (!bookAnnouncement) {
return;
}

document.body.classList.remove('announcement-visible');
bookAnnouncement.classList.remove('active');
bookAnnouncement.setAttribute('aria-hidden', 'true');
clearTimeout(bookAnnouncementTimer);
if (bookAnnouncement.contains(document.activeElement) && bookAnnouncementPreviousFocus instanceof HTMLElement) {
bookAnnouncementPreviousFocus.focus();
}
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

document.addEventListener('keydown', event => {
if (event.key === 'Escape' && bookAnnouncement?.classList.contains('active')) {
hideBookAnnouncement();
}
});

const buyBookFlips = Array.from(document.querySelectorAll('[data-buy-book-flip]'));

function setBuyBookFlipState(buyBookFlip, isFlipped) {
const buyBookButton = buyBookFlip.querySelector('[data-buy-book-toggle]');
buyBookFlip.classList.toggle('is-flipped', isFlipped);
buyBookButton?.setAttribute('aria-expanded', String(isFlipped));

const headerActions = buyBookFlip.closest('.header-actions');
headerActions?.classList.toggle('is-purchase-open', isFlipped);
}

function closeBuyBookFlips(exceptFlip) {
buyBookFlips.forEach((buyBookFlip) => {
if (buyBookFlip !== exceptFlip) {
setBuyBookFlipState(buyBookFlip, false);
}
});
}

buyBookFlips.forEach((buyBookFlip) => {
const buyBookButton = buyBookFlip.querySelector('[data-buy-book-toggle]');
if (!buyBookButton) {
return;
}

buyBookButton.addEventListener('click', () => {
const isFlipped = !buyBookFlip.classList.contains('is-flipped');
closeBuyBookFlips(buyBookFlip);
setBuyBookFlipState(buyBookFlip, isFlipped);
if (isFlipped) {
window.frcTrackAction?.('purchase_opened');
}
});
});

if (buyBookFlips.length) {
document.addEventListener('click', (event) => {
const activeFlip = buyBookFlips.find((buyBookFlip) => buyBookFlip.classList.contains('is-flipped'));
if (activeFlip && !activeFlip.contains(event.target)) {
closeBuyBookFlips();
}
});

document.addEventListener('keydown', (event) => {
if (event.key === 'Escape') {
closeBuyBookFlips();
}
});
}

// Contact Form Functionality
const contactForm = document.getElementById('contact-form');
const contactStatus = document.getElementById('contact-message-status');
const contactSubmit = document.getElementById('contact-submit-btn');
const contactVerificationLoading = document.getElementById('contact-verification-loading');
let contactTurnstileToken = '';
let contactTurnstileWidgetId;

function showContactStatus(message, color) {
if (!contactStatus) return;
contactStatus.textContent = message;
contactStatus.style.color = color;
contactStatus.style.display = 'block';
}

function setContactVerification(token) {
contactTurnstileToken = token || '';
if (contactSubmit) contactSubmit.disabled = !contactTurnstileToken;
}

function resetContactVerification() {
setContactVerification('');
if (window.turnstile && contactTurnstileWidgetId !== undefined) {
window.turnstile.reset(contactTurnstileWidgetId);
}
}

async function initializeContactVerification() {
if (!contactForm || !contactSubmit) return;

try {
const response = await fetch('/api/contact-config', { headers: { Accept: 'application/json' } });
const config = await response.json().catch(() => ({}));
if (!response.ok || !config.siteKey || !window.turnstile) {
throw new Error('Contact verification is not configured');
}

if (contactVerificationLoading) contactVerificationLoading.remove();
contactTurnstileWidgetId = window.turnstile.render('#contact-turnstile', {
sitekey: config.siteKey,
action: 'contact',
theme: 'light',
size: 'flexible',
callback: (token) => {
setContactVerification(token);
if (contactStatus?.textContent.toLowerCase().includes('verification')) contactStatus.style.display = 'none';
},
'expired-callback': () => {
setContactVerification('');
showContactStatus('Verification expired. Please verify again.', '#b45309');
},
'error-callback': () => {
setContactVerification('');
showContactStatus('Verification could not load. Please refresh the page and try again.', '#dc2626');
}
});
} catch (error) {
setContactVerification('');
if (contactVerificationLoading) {
contactVerificationLoading.textContent = 'Verification is temporarily unavailable. Please try again later.';
}
showContactStatus('The contact form is temporarily unavailable. Please try again later.', '#dc2626');
}
}

async function handleContactSubmit(event) {
event.preventDefault();

const form = event.target;
const email = document.getElementById('contact-email').value.trim();
const subject = document.getElementById('contact-subject').value.trim();
const message = document.getElementById('contact-message').value.trim();
const submitBtn = document.getElementById('contact-submit-btn');

if (!email || !subject || !message) {
showContactStatus('❌ Please fill in all fields', '#dc2626');
return;
}

if (!email.includes('@')) {
showContactStatus('❌ Please enter a valid email address', '#dc2626');
return;
}

if (!contactTurnstileToken) {
showContactStatus('Please complete the human verification before sending.', '#b45309');
return;
}

submitBtn.disabled = true;
submitBtn.textContent = 'Sending...';
showContactStatus('Sending your message...', '#0096FF');

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
message,
turnstileToken: contactTurnstileToken
})
});
const result = await response.json().catch(() => ({}));

if (!response.ok) {
const error = new Error('Contact submission failed');
error.code = result.error;
error.retryAfterSeconds = result.retryAfterSeconds;
throw error;
}

showContactStatus('✓ Message sent! Thanks for getting in touch.', '#15803d');
form.reset();

setTimeout(() => {
if (contactStatus) contactStatus.style.display = 'none';
}, 3000);
} catch (error) {
if (error.code === 'captcha_required' || error.code === 'captcha_failed') {
showContactStatus('Human verification failed or expired. Please verify again.', '#dc2626');
} else if (error.code === 'captcha_unavailable') {
showContactStatus('Verification is temporarily unavailable. Please try again in a moment.', '#dc2626');
} else if (error.code === 'rate_limited') {
const retryHours = Math.max(1, Math.ceil(Number(error.retryAfterSeconds || 0) / 3600));
showContactStatus(`Message limit reached. Please try again in about ${retryHours} hour${retryHours === 1 ? '' : 's'}.`, '#b45309');
} else if (error.code === 'rate_limit_unavailable') {
showContactStatus('Spam protection is temporarily unavailable. Please try again in a moment.', '#dc2626');
} else {
showContactStatus('Message could not be sent. Please try again in a moment.', '#dc2626');
}
} finally {
resetContactVerification();
submitBtn.textContent = 'Send Message';
}
}

initializeContactVerification();

if (window.lucide) {
  lucide.createIcons();
}
