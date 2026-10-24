'use strict';

const $ = id => document.getElementById(id);
let theme = 'brand';
let uri = '';
let svgText = '';
let revision = 0;
let logoData = '';
const logoReady = fetch('/assets/site/f1-camp-logo-transparent.webp')
  .then(response => {
    if (!response.ok) throw new Error('Logo unavailable');
    return response.blob();
  })
  .then(blob => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { logoData = reader.result; resolve(); };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  }))
  .catch(() => {});

function paymentURI(name, vpa, amount, note) {
  const entries = [['pa', vpa], ['pn', name]];
  if (amount) entries.push(['am', Number(amount).toFixed(2)]);
  entries.push(['cu', 'INR']);
  if (note) entries.push(['tn', note]);
  return 'upi://pay?' + entries.map(([key, value]) => key + '=' + encodeURIComponent(value)).join('&');
}

function makeSVG(value, withLogo, color) {
  const qr = qrcode(0, 'H');
  qr.addData(value);
  qr.make();
  const n = qr.getModuleCount(), size = n + 8;
  let path = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (qr.isDark(y, x)) path += `M${x + 4},${y + 4}h1v1h-1z`;
    }
  }
  const l = Math.floor(n * .14), a = (size - l) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 ${size} ${size}" role="img" aria-label="UPI payment QR code"><defs><linearGradient id="ink" x2="1" y2="1"><stop stop-color="#10265d"/><stop offset=".6" stop-color="#182765"/><stop offset="1" stop-color="#87172d"/></linearGradient></defs><rect width="${size}" height="${size}" fill="white"/><path d="${path}" fill="${color === 'black' ? '#111111' : 'url(#ink)'}"/>${withLogo ? `<rect x="${a - .6}" y="${a - .6}" width="${l + 1.2}" height="${l + 1.2}" rx=".5" fill="white"/><image href="${logoData}" x="${a}" y="${a}" width="${l}" height="${l}"/>` : ''}</svg>`;
}

function invalidate() {
  revision++;
  uri = '';
  svgText = '';
  ['png', 'svg', 'copy'].forEach(id => { $(id).disabled = true; });
  $('status').textContent = 'DETAILS CHANGED';
  $('feedback').textContent = 'Generate a new QR to apply your changes.';
  $('qr').innerHTML = '<div class="empty"><strong>Ready for a new QR</strong><span>Generate to preview your latest details.</span></div>';
  $('payee').textContent = 'Your payment preview';
  $('payid').textContent = '';
  $('payamount').textContent = 'Scan. Pay. Let’s go.';
  $('paynote').textContent = 'Scan with any UPI-enabled app';
}

$('form').addEventListener('input', invalidate);
document.querySelectorAll('.style').forEach(button => {
  button.onclick = () => {
    theme = button.dataset.color;
    document.querySelectorAll('.style').forEach(other => {
      other.classList.toggle('active', other === button);
      other.setAttribute('aria-pressed', other === button ? 'true' : 'false');
    });
    invalidate();
  };
});

$('form').onsubmit = async event => {
  event.preventDefault();
  invalidate();
  const currentRevision = revision;
  $('error').textContent = '';
  ['name', 'vpa', 'amount'].forEach(id => $(id).removeAttribute('aria-invalid'));
  const name = $('name').value.trim(), vpa = $('vpa').value.trim();
  const amount = $('amount').value.trim(), note = $('note').value.trim();
  const withLogo = $('logo').checked, color = theme;
  let bad = '';
  if (!name) {
    bad = 'name';
    $('error').textContent = 'Enter the payee name.';
  } else if (!/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$/.test(vpa)) {
    bad = 'vpa';
    $('error').textContent = 'Enter a valid UPI ID, such as yourname@bank.';
  } else if (amount && (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 || Number(amount) > 999999999)) {
    bad = 'amount';
    $('error').textContent = 'Enter a positive INR amount with up to 2 decimal places.';
  }
  if (bad) {
    $(bad).setAttribute('aria-invalid', 'true');
    $(bad).focus();
    return;
  }
  try {
    if (withLogo) {
      await logoReady;
      if (currentRevision !== revision) return;
      if (!logoData) throw new Error('Logo unavailable');
    }
    uri = paymentURI(name, vpa, amount, note);
    svgText = makeSVG(uri, withLogo, color);
    $('qr').innerHTML = svgText;
    $('payee').textContent = name;
    $('payid').textContent = vpa;
    $('payamount').textContent = amount
      ? '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : 'Enter amount in your UPI app';
    $('paynote').textContent = note || 'Scan with any UPI-enabled app';
    $('status').textContent = 'READY TO SCAN';
    ['png', 'svg', 'copy'].forEach(id => { $(id).disabled = false; });
    $('feedback').textContent = 'QR generated. Verify the recipient in your UPI app.';
  } catch {
    invalidate();
    $('error').textContent = 'Unable to generate this QR. Try again, or turn off the logo.';
  }
};

function download(blob, extension) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'camp-upi-qr.' + extension;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

$('svg').onclick = () => download(new Blob([svgText], { type: 'image/svg+xml' }), 'svg');
$('png').onclick = async () => {
  const source = svgText, currentRevision = revision;
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      // data: images work with the site's existing CSP and keep exported logos embedded.
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
    });
    if (currentRevision !== revision) return;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1200;
    const context = canvas.getContext('2d');
    context.fillStyle = 'white';
    context.fillRect(0, 0, 1200, 1200);
    context.drawImage(img, 0, 0, 1200, 1200);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG unavailable');
    if (currentRevision !== revision) return;
    download(blob, 'png');
    $('feedback').textContent = 'PNG downloaded.';
  } catch {
    if (currentRevision === revision) $('feedback').textContent = 'PNG export failed. Please try SVG instead.';
  }
};

$('copy').onclick = async () => {
  const currentRevision = revision;
  try {
    await navigator.clipboard.writeText(uri);
    if (currentRevision === revision) $('feedback').textContent = 'Payment link copied.';
  } catch {
    if (currentRevision === revision) $('feedback').textContent = 'Clipboard unavailable. Download the QR instead.';
  }
};
