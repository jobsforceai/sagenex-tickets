document.addEventListener('click', (event) => {
  const row = event.target.closest('tr[data-href]');
  if (row) window.location.href = row.dataset.href;
});

function setGuestMode(isGuest, isConfirmed = false) {
  const type = document.getElementById('complainantType');
  const confirmed = document.getElementById('memberConfirmed');
  if (!type || !confirmed) return;
  type.value = isGuest ? 'public' : 'sgx_member';
  confirmed.value = isGuest || !isConfirmed ? 'no' : 'yes';
  document.querySelectorAll('.sgx-flow-field').forEach((field) => {
    field.style.display = isGuest ? 'none' : '';
  });
  document.querySelectorAll('.guest-field').forEach((field) => {
    field.style.display = isGuest ? '' : 'none';
  });
  document.querySelectorAll('.guest-section').forEach((field) => {
    field.style.display = isGuest ? '' : 'none';
  });
  const externalUserId = document.getElementById('externalUserId');
  if (externalUserId) externalUserId.required = !isGuest;
  ['guestName', 'guestEmail', 'guestPhone'].forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.required = isGuest;
  });
}

function setButtonLoading(button, isLoading, loadingText) {
  if (!button) return;
  if (!button.dataset.idleText) {
    button.dataset.idleText = button.querySelector('.btn-label')?.textContent || button.textContent.trim();
  }
  button.classList.toggle('is-loading', isLoading);
  button.disabled = isLoading;
  const label = button.querySelector('.btn-label');
  const text = isLoading ? loadingText : button.dataset.idleText;
  if (label) label.textContent = text;
  else button.textContent = text;
}

function setComplaintLoader(isVisible, title, text) {
  const loader = document.getElementById('complaintLoader');
  if (!loader) return;
  const titleEl = document.getElementById('loaderTitle');
  const textEl = document.getElementById('loaderText');
  if (titleEl && title) titleEl.textContent = title;
  if (textEl && text) textEl.textContent = text;
  loader.hidden = !isVisible;
}

function setMessageState(element, message, state = 'info') {
  if (!element) return;
  element.textContent = message;
  element.classList.remove('message-error', 'message-success', 'message-info');
  element.classList.add(`message-${state}`);
}

function fillGuestContactFromUser(user) {
  const fields = {
    guestName: user.fullName || user.name || '',
    guestEmail: user.email || user.emailAddress || '',
    guestPhone: user.phone || user.mobile || user.phoneNumber || ''
  };
  Object.entries(fields).forEach(([id, value]) => {
    const input = document.getElementById(id);
    if (input) input.value = value;
  });
}

function drawCaptcha(question) {
  const canvas = document.getElementById('captchaCanvas');
  if (!canvas || !question) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#cbd5e1';
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  for (let i = 0; i < 16; i += 1) {
    ctx.fillStyle = `rgba(${80 + i * 6}, ${105 + i * 3}, ${130 + i * 2}, .18)`;
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 1.2 + Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(18, 29);
  ctx.rotate((Math.random() - 0.5) * 0.08);
  ctx.font = '700 22px Arial, Helvetica, sans-serif';
  ctx.fillStyle = '#17202a';
  ctx.fillText(`${question} = ?`, 0, 0);
  ctx.restore();

  ctx.strokeStyle = 'rgba(15, 118, 110, .45)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(8, 31 + Math.random() * 3);
  ctx.bezierCurveTo(42, 16, 92, 42, 142, 18);
  ctx.stroke();
}

function updateCaptchaFromPayload(payload) {
  if (!payload?.captcha?.question) return;
  const canvas = document.getElementById('captchaCanvas');
  const answer = document.getElementById('captchaAnswer');
  if (canvas) {
    canvas.dataset.question = payload.captcha.question;
    drawCaptcha(payload.captcha.question);
  }
  if (answer) {
    answer.value = '';
    answer.focus();
  }
}

async function readJsonResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text || 'Request failed. Please try again.' };
  }
}

async function verifySgxUser() {
  const input = document.getElementById('externalUserId');
  const message = document.getElementById('verifyMessage');
  const card = document.getElementById('verifiedCard');
  const confirmButton = document.getElementById('confirmMember');
  if (!input || !message || !card) return;
  const externalUserId = input.value.trim();
  if (!externalUserId) {
    setMessageState(message, 'Please enter SGX User ID first.', 'error');
    return;
  }
  const verifyButton = document.getElementById('verifySgxUser');
  setMessageState(message, 'Verifying SGX member...', 'info');
  card.hidden = true;
  card.classList.remove('is-selected');
  if (confirmButton) {
    confirmButton.textContent = 'Use This Verified Member';
    confirmButton.disabled = false;
  }
  setGuestMode(false);
  setButtonLoading(verifyButton, true, 'Verifying...');
  try {
    const response = await fetch('/complaint/verify-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ externalUserId })
    });
    const payload = await readJsonResponse(response);
    if (!response.ok || !payload.success) throw new Error(payload.message || 'Verification failed');
    document.getElementById('verifiedName').textContent = payload.data.fullName || payload.data.userId;
    document.getElementById('verifiedMeta').textContent = `${payload.data.userId} | ${payload.data.rank || 'Member'} | ${payload.data.status}`;
    document.getElementById('verifiedContact').textContent = `${payload.data.email || ''} ${payload.data.phone || ''}`;
    fillGuestContactFromUser(payload.data);
    setMessageState(message, 'Member found. Contact details filled automatically. Please confirm before submitting.', 'success');
    card.hidden = false;
  } catch (error) {
    setMessageState(message, `${error.message}. Continue as guest and enter email/phone.`, 'error');
    setGuestMode(true);
  } finally {
    setButtonLoading(verifyButton, false);
  }
}

document.getElementById('verifySgxUser')?.addEventListener('click', verifySgxUser);
document.getElementById('confirmMember')?.addEventListener('click', () => {
  setGuestMode(false, true);
  document.getElementById('verifiedCard')?.classList.add('is-selected');
  const button = document.getElementById('confirmMember');
  if (button) {
    button.textContent = 'Verified Member Selected';
    button.disabled = true;
  }
  setSubmitMessage('Verified SGX profile selected.', 'success');
});

function chooseComplaintMode(mode) {
  const modal = document.getElementById('complaintChoiceModal');
  const selected = document.getElementById('complaintModeSelected');
  if (selected) selected.value = 'yes';
  if (modal) modal.hidden = true;
  const card = document.getElementById('verifiedCard');
  if (card) {
    card.hidden = true;
    card.classList.remove('is-selected');
  }
  const confirmButton = document.getElementById('confirmMember');
  if (confirmButton) {
    confirmButton.textContent = 'Use This Verified Member';
    confirmButton.disabled = false;
  }
  setGuestMode(mode === 'guest');
  setSubmitMessage(mode === 'guest' ? 'Guest mode selected. Enter contact details.' : 'SGX user mode selected. Verify SGX User ID before submitting.', 'info');
}

document.getElementById('continueGuest')?.addEventListener('click', () => chooseComplaintMode('guest'));
document.getElementById('switchGuest')?.addEventListener('click', () => chooseComplaintMode('guest'));
document.getElementById('chooseSgxUser')?.addEventListener('click', () => chooseComplaintMode('sgx'));
document.getElementById('chooseGuest')?.addEventListener('click', () => chooseComplaintMode('guest'));
if (document.getElementById('complaintForm')) {
  const captchaCanvas = document.getElementById('captchaCanvas');
  if (captchaCanvas?.dataset.question) drawCaptcha(captchaCanvas.dataset.question);
  setGuestMode(true);
  document.querySelectorAll('.guest-field').forEach((field) => {
    field.style.display = 'none';
  });
  document.querySelectorAll('.guest-section').forEach((field) => {
    field.style.display = 'none';
  });
}

const attachmentInput = document.getElementById('attachments');
const addMoreInput = document.getElementById('addMoreAttachments');
const addMoreButton = document.getElementById('addMoreButton');
const previewGrid = document.getElementById('previewGrid');
const dropzone = document.getElementById('uploadDropzone');
const form = document.getElementById('complaintForm');
const clearAttachments = document.getElementById('clearAttachments');
let selectedAttachments = [];

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function setSubmitMessage(message, state = 'info') {
  const target = document.getElementById('submitMessage');
  setMessageState(target, message, state);
}

function validateFiles(files) {
  const list = Array.from(files || []);
  if (list.length > 3) return 'Upload maximum 3 files.';
  const tooLarge = list.find((file) => file.size > 5 * 1024 * 1024);
  if (tooLarge) return `${tooLarge.name} is larger than 5 MB.`;
  return '';
}

function syncAttachmentInput() {
  if (!attachmentInput) return;
  const transfer = new DataTransfer();
  selectedAttachments.forEach((file) => transfer.items.add(file));
  attachmentInput.files = transfer.files;
}

function addSelectedFiles(files) {
  const incoming = Array.from(files || []);
  const next = [...selectedAttachments];
  incoming.forEach((file) => {
    const duplicate = next.some((existing) => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified);
    if (!duplicate && next.length < 3) next.push(file);
  });
  const error = validateFiles(next);
  if (error) {
    setSubmitMessage(error, 'error');
    return;
  }
  selectedAttachments = next;
  syncAttachmentInput();
  renderPreviews();
}

function renderPreviews() {
  if (!attachmentInput || !previewGrid) return;
  const files = selectedAttachments;
  const error = validateFiles(files);
  previewGrid.innerHTML = '';
  if (error) {
    attachmentInput.value = '';
    selectedAttachments = [];
    if (clearAttachments) clearAttachments.hidden = true;
    if (addMoreButton) addMoreButton.hidden = true;
    setSubmitMessage(error, 'error');
    return;
  }
  if (clearAttachments) clearAttachments.hidden = files.length === 0;
  if (addMoreButton) addMoreButton.hidden = files.length === 0 || files.length >= 3;
  files.forEach((file) => {
    const item = document.createElement('div');
    item.className = 'preview-item';
    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.alt = file.name;
      img.src = URL.createObjectURL(file);
      img.onload = () => URL.revokeObjectURL(img.src);
      item.appendChild(img);
    } else {
      const icon = document.createElement('div');
      icon.className = 'file-icon';
      icon.textContent = file.name.split('.').pop().toUpperCase();
      item.appendChild(icon);
    }
    const meta = document.createElement('span');
    meta.textContent = `${file.name} (${formatBytes(file.size)})`;
    item.appendChild(meta);
    previewGrid.appendChild(item);
  });
  if (files.length) setSubmitMessage(`${files.length} file${files.length > 1 ? 's' : ''} ready for upload.`, 'success');
}

attachmentInput?.addEventListener('change', () => {
  selectedAttachments = [];
  addSelectedFiles(attachmentInput.files);
});
addMoreButton?.addEventListener('click', () => addMoreInput?.click());
addMoreInput?.addEventListener('change', () => {
  addSelectedFiles(addMoreInput.files);
  addMoreInput.value = '';
});
clearAttachments?.addEventListener('click', () => {
  if (!attachmentInput || !previewGrid) return;
  attachmentInput.value = '';
  selectedAttachments = [];
  previewGrid.innerHTML = '';
  clearAttachments.hidden = true;
  if (addMoreButton) addMoreButton.hidden = true;
  setSubmitMessage('Attachments removed.');
});

['dragenter', 'dragover'].forEach((eventName) => {
  dropzone?.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add('dragging');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  dropzone?.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove('dragging');
  });
});

dropzone?.addEventListener('drop', (event) => {
  if (!attachmentInput || !event.dataTransfer?.files?.length) return;
  addSelectedFiles(event.dataTransfer.files);
});

form?.addEventListener('submit', (event) => {
  if (!form.classList.contains('upload-progress-form')) return;
  event.preventDefault();
  const selectedMode = document.getElementById('complaintModeSelected');
  if (selectedMode && selectedMode.value !== 'yes') {
    setSubmitMessage('Please choose SGX User or Guest first.', 'error');
    document.getElementById('complaintChoiceModal')?.removeAttribute('hidden');
    return;
  }
  const type = document.getElementById('complainantType');
  const confirmed = document.getElementById('memberConfirmed');
  if (type?.value === 'sgx_member' && confirmed?.value !== 'yes') {
    setSubmitMessage('Please verify and confirm the SGX user profile before submitting.', 'error');
    return;
  }
  const filesError = validateFiles(attachmentInput?.files);
  if (filesError) {
    setSubmitMessage(filesError, 'error');
    return;
  }
  if (!form.reportValidity()) return;

  const submitButton = document.getElementById('submitComplaint');
  const progressPanel = document.getElementById('progressPanel');
  const progressBar = document.getElementById('progressBar');
  const progressPercent = document.getElementById('progressPercent');
  const progressText = document.getElementById('progressText');
  const xhr = new XMLHttpRequest();
  const formData = new FormData(form);

  setButtonLoading(submitButton, true, 'Submitting...');
  if (progressPanel) progressPanel.hidden = false;
  setComplaintLoader(true, 'Submitting complaint', 'Uploading attachments and creating your support ticket.');
  setSubmitMessage('Uploading complaint. Please keep this page open.', 'info');

  xhr.upload.addEventListener('progress', (progress) => {
    if (!progress.lengthComputable) return;
    const percent = Math.round((progress.loaded / progress.total) * 100);
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (progressPercent) progressPercent.textContent = `${percent}%`;
    if (progressText) progressText.textContent = percent < 100 ? 'Uploading...' : 'Processing ticket...';
  });

  xhr.addEventListener('load', () => {
    try {
      const payload = JSON.parse(xhr.responseText || '{}');
      if (xhr.status >= 200 && xhr.status < 300 && payload.redirectUrl) {
        setSubmitMessage(`Ticket ${payload.ticketId} created. Redirecting...`, 'success');
        setComplaintLoader(true, 'Ticket created', 'Redirecting you to ticket tracking.');
        window.location.href = payload.redirectUrl;
        return;
      }
      updateCaptchaFromPayload(payload);
      throw new Error(payload.message || 'Submission failed.');
    } catch (error) {
      const fallbackMessage = xhr.responseText && !xhr.responseText.trim().startsWith('{') ? xhr.responseText : error.message;
      setSubmitMessage(fallbackMessage, 'error');
      setButtonLoading(submitButton, false);
      setComplaintLoader(false);
    }
  });

  xhr.addEventListener('error', () => {
    setSubmitMessage('Network error during upload. Please try again.', 'error');
    setButtonLoading(submitButton, false);
    setComplaintLoader(false);
  });

  xhr.open('POST', form.action);
  xhr.setRequestHeader('Accept', 'application/json');
  xhr.send(formData);
});

document.querySelectorAll('.transition-btn').forEach((button) => {
  button.addEventListener('click', () => {
    const statusInput = document.getElementById('workflowStatus');
    const selected = document.getElementById('selectedTransition');
    document.querySelectorAll('.transition-btn').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    if (statusInput) statusInput.value = button.dataset.status || '';
    if (selected) selected.textContent = button.dataset.status ? `Selected: ${button.dataset.status}` : 'Selected: No status change';
  });
});

function initCharts() {
  if (!window.Chart) return;
  const palette = ['#2563eb', '#0f766e', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#65a30d', '#db2777'];
  document.querySelectorAll('canvas[data-chart-labels]').forEach((canvas) => {
    const labels = JSON.parse(canvas.dataset.chartLabels || '[]');
    const values = JSON.parse(canvas.dataset.chartValues || '[]');
    if (!labels.length || canvas.dataset.ready === 'true') return;
    canvas.dataset.ready = 'true';
    new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: labels.map((_, index) => palette[index % palette.length]),
          borderColor: '#ffffff',
          borderWidth: 3,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            position: window.matchMedia('(max-width: 760px)').matches ? 'bottom' : 'right',
            labels: {
              boxWidth: window.matchMedia('(max-width: 760px)').matches ? 7 : 10,
              boxHeight: window.matchMedia('(max-width: 760px)').matches ? 7 : 10,
              usePointStyle: true,
              pointStyle: 'circle',
              color: '#17202a',
              font: { size: window.matchMedia('(max-width: 760px)').matches ? 9 : 12, weight: '600' },
              padding: window.matchMedia('(max-width: 760px)').matches ? 6 : 12
            }
          },
          tooltip: {
            callbacks: {
              label(context) {
                const total = context.dataset.data.reduce((sum, value) => sum + value, 0);
                const value = context.parsed || 0;
                const percent = total ? Math.round((value / total) * 100) : 0;
                return ` ${context.label}: ${value} (${percent}%)`;
              }
            }
          }
        }
      }
    });
  });
}

initCharts();

const menuToggle = document.getElementById('menuToggle');
const drawerClose = document.getElementById('drawerClose');
const navBackdrop = document.getElementById('navBackdrop');
const topnav = document.querySelector('.topnav');

function setDrawer(open) {
  if (!topnav || !menuToggle || !navBackdrop) return;
  topnav.classList.toggle('open', open);
  navBackdrop.classList.toggle('open', open);
  document.body.classList.toggle('drawer-open', open);
  menuToggle.setAttribute('aria-expanded', String(open));
}

menuToggle?.addEventListener('click', () => setDrawer(true));
drawerClose?.addEventListener('click', () => setDrawer(false));
navBackdrop?.addEventListener('click', () => setDrawer(false));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setDrawer(false);
});
topnav?.querySelectorAll('a, button[type="submit"]').forEach((item) => {
  item.addEventListener('click', () => {
    if (window.matchMedia('(max-width: 760px)').matches) setDrawer(false);
  });
});
