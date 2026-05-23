(function() {
  // 1. Locate the script tag to read configuration attributes
  const currentScript = document.currentScript || document.querySelector('script[platform], script[plateform], script[src*="chatbot.js"]');
  const platform = currentScript 
    ? (currentScript.getAttribute('platform') || currentScript.getAttribute('plateform') || currentScript.getAttribute('data-platform'))
    : null;

  if (!platform) {
    console.error('Sagenex Chatbot: Platform attribute ("platform" or "plateform") not specified on the script tag.');
    return;
  }

  // Get current host from script src to construct API requests
  let scriptUrl;
  try {
    scriptUrl = new URL(currentScript.src);
  } catch (e) {
    scriptUrl = new URL(window.location.href);
  }
  const hostUrl = `${scriptUrl.protocol}//${scriptUrl.host}`;

  // State variables
  let chatbotConfig = null;
  let chatWidget = null;
  let chatButton = null;
  let chatBody = null;
  let isWidgetOpen = false;
  let currentFlow = null; // 'raise' or 'track'
  let flowStep = 0;
  let flowData = {};

  // Fetch chatbot config from API
  fetch(`${hostUrl}/api/chatbot/config?platform=${encodeURIComponent(platform)}`)
    .then(response => {
      if (!response.ok) throw new Error('Platform chatbot config not found or inactive');
      return response.json();
    })
    .then(result => {
      chatbotConfig = result.data;
      initChatbot();
    })
    .catch(err => {
      console.warn('Sagenex Chatbot Integration Warning:', err.message);
    });

  // Initialize UI
  function initChatbot() {
    const themeColor = chatbotConfig.themeColor || '#0f766e';
    
    // Inject styles
    injectStyles(themeColor);

    // Create floating button
    chatButton = document.createElement('div');
    chatButton.className = 'sagenex-chat-button';
    chatButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    `;
    document.body.appendChild(chatButton);

    // Create chat widget drawer
    chatWidget = document.createElement('div');
    chatWidget.className = 'sagenex-chat-widget';
    chatWidget.innerHTML = `
      <div class="sagenex-chat-header">
        <div class="sagenex-chat-header-info">
          <div class="sagenex-chat-header-dot"></div>
          <div class="sagenex-chat-header-title">${escapeHTML(chatbotConfig.title)}</div>
        </div>
        <button class="sagenex-chat-close">&times;</button>
      </div>
      <div class="sagenex-chat-body"></div>
      <div class="sagenex-chat-footer">
        <div class="sagenex-input-container" style="display: none;">
          <input type="text" class="sagenex-chat-input" placeholder="Type here...">
          <button class="sagenex-chat-send">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(chatWidget);

    chatBody = chatWidget.querySelector('.sagenex-chat-body');

    // Add event listeners
    chatButton.addEventListener('click', toggleWidget);
    chatWidget.querySelector('.sagenex-chat-close').addEventListener('click', toggleWidget);
    
    // Add enter key listener on input
    const textInput = chatWidget.querySelector('.sagenex-chat-input');
    textInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') handleSend();
    });
    chatWidget.querySelector('.sagenex-chat-send').addEventListener('click', handleSend);

    // Initial message
    resetChat();
  }

  function toggleWidget() {
    isWidgetOpen = !isWidgetOpen;
    if (isWidgetOpen) {
      chatWidget.classList.add('sagenex-open');
      chatButton.classList.add('sagenex-active');
      chatButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;
    } else {
      chatWidget.classList.remove('sagenex-open');
      chatButton.classList.remove('sagenex-active');
      chatButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      `;
    }
  }

  function addMessage(text, isUser = false, isHtml = false) {
    const msg = document.createElement('div');
    msg.className = `sagenex-message ${isUser ? 'sagenex-user' : 'sagenex-bot'}`;
    
    const bubble = document.createElement('div');
    bubble.className = 'sagenex-message-bubble';
    if (isHtml) {
      bubble.innerHTML = text;
    } else {
      bubble.innerText = text;
    }
    
    msg.appendChild(bubble);
    chatBody.appendChild(msg);
    chatBody.scrollTop = chatBody.scrollHeight;
    return msg;
  }

  function showTypingIndicator() {
    const ind = document.createElement('div');
    ind.className = 'sagenex-message sagenex-bot sagenex-typing-indicator';
    ind.innerHTML = `
      <div class="sagenex-message-bubble">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </div>
    `;
    chatBody.appendChild(ind);
    chatBody.scrollTop = chatBody.scrollHeight;
    return ind;
  }

  function removeTypingIndicator(ind) {
    if (ind && ind.parentNode) {
      ind.parentNode.removeChild(ind);
    }
  }

  function showOptions(options) {
    const container = document.createElement('div');
    container.className = 'sagenex-options-container';
    
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'sagenex-option-btn';
      btn.innerText = opt.label;
      btn.addEventListener('click', () => {
        // Remove options after choice
        container.remove();
        addMessage(opt.label, true);
        opt.action();
      });
      container.appendChild(btn);
    });
    
    chatBody.appendChild(container);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function resetChat() {
    chatBody.innerHTML = '';
    currentFlow = null;
    flowStep = 0;
    flowData = {};
    hideInput();

    addMessage(chatbotConfig.welcomeMessage);
    
    setTimeout(() => {
      showOptions([
        { label: 'Raise a Complaint', action: startRaiseComplaint },
        { label: 'Track Ticket Status', action: startTrackTicket }
      ]);
    }, 500);
  }

  function showInput(placeholder = 'Type here...') {
    const footer = chatWidget.querySelector('.sagenex-input-container');
    const input = chatWidget.querySelector('.sagenex-chat-input');
    input.value = '';
    input.placeholder = placeholder;
    footer.style.display = 'flex';
    input.focus();
  }

  function hideInput() {
    const footer = chatWidget.querySelector('.sagenex-input-container');
    footer.style.display = 'none';
  }

  // --- RAISE COMPLAINT FLOW ---
  function startRaiseComplaint() {
    currentFlow = 'raise';
    flowStep = 1;
    flowData = { platform: chatbotConfig.platform };

    const typing = showTypingIndicator();
    setTimeout(() => {
      removeTypingIndicator(typing);
      addMessage('To raise a complaint, are you registered as an SGX Platform Member?');
      showOptions([
        { 
          label: 'Yes, I am a Member', 
          action: () => {
            flowData.complainantType = 'sgx_member';
            flowData.memberConfirmed = 'yes';
            promptMemberId();
          }
        },
        { 
          label: 'No, file as Guest', 
          action: () => {
            flowData.complainantType = 'public';
            promptGuestName();
          } 
        }
      ]);
    }, 600);
  }

  function promptMemberId() {
    flowStep = 2; // Member verification step
    const typing = showTypingIndicator();
    setTimeout(() => {
      removeTypingIndicator(typing);
      addMessage('Please enter your SGX User ID:');
      showInput('Enter SGX User ID (e.g. USR12345)');
    }, 500);
  }

  function verifyMember(userId) {
    hideInput();
    const typing = showTypingIndicator();
    
    fetch(`${hostUrl}/api/chatbot/verify-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ externalUserId: userId })
    })
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(result => {
        removeTypingIndicator(typing);
        if (result.success && result.data) {
          const user = result.data;
          flowData.externalUserId = user.userId;
          flowData.name = user.fullName;
          flowData.email = user.email;
          flowData.phone = user.phone || 'N/A';
          
          addMessage(`Profile Verified!\nName: ${user.fullName}\nEmail: ${user.email}\nRank: ${user.rank || 'N/A'}`);
          
          // Proceed to title
          promptComplaintTitle();
        } else {
          addMessage('Could not verify SGX Member. Please try entering the ID again, or switch to Guest mode.');
          showOptions([
            { label: 'Enter ID Again', action: promptMemberId },
            { 
              label: 'File as Guest instead', 
              action: () => {
                flowData.complainantType = 'public';
                promptGuestName();
              } 
            }
          ]);
        }
      })
      .catch(() => {
        removeTypingIndicator(typing);
        addMessage('Verification failed or SGX Member ID is invalid. How would you like to proceed?');
        showOptions([
          { label: 'Try ID Again', action: promptMemberId },
          { 
            label: 'File as Guest instead', 
            action: () => {
              flowData.complainantType = 'public';
              promptGuestName();
            } 
          }
        ]);
      });
  }

  function promptGuestName() {
    flowStep = 3;
    const typing = showTypingIndicator();
    setTimeout(() => {
      removeTypingIndicator(typing);
      addMessage('Please enter your Full Name:');
      showInput('Your Name');
    }, 500);
  }

  function promptGuestEmail() {
    flowStep = 4;
    addMessage('Please enter your Email Address:');
    showInput('email@domain.com');
  }

  function promptGuestPhone() {
    flowStep = 5;
    addMessage('Please enter your Phone Number:');
    showInput('Phone Number');
  }

  function promptComplaintTitle() {
    flowStep = 6;
    const typing = showTypingIndicator();
    setTimeout(() => {
      removeTypingIndicator(typing);
      addMessage('What is the title or main subject of your complaint?');
      showInput('e.g. Balance not updating / Deposit error');
    }, 500);
  }

  function promptComplaintDescription() {
    flowStep = 7;
    const typing = showTypingIndicator();
    setTimeout(() => {
      removeTypingIndicator(typing);
      addMessage('Please describe your issue in detail (minimum 10 characters):');
      showInput('Detailed description...');
    }, 500);
  }

  function promptImageUpload() {
    flowStep = 7.5;
    hideInput();
    const typing = showTypingIndicator();
    setTimeout(() => {
      removeTypingIndicator(typing);
      addMessage('Would you like to attach an image or screenshot as proof?');
      showOptions([
        { label: 'Yes, upload image', action: triggerFileUpload },
        { label: 'No, skip', action: () => { delete flowData.attachment; promptConfirmSubmit(); } }
      ]);
    }, 500);
  }

  function triggerFileUpload() {
    let fileInput = document.getElementById('sagenex-chatbot-file-input');
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.id = 'sagenex-chatbot-file-input';
      fileInput.accept = 'image/*,application/pdf';
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);
    }
    
    fileInput.onchange = function(e) {
      const file = e.target.files[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          addMessage('File size exceeds the 5MB limit. Please choose a smaller file.');
          setTimeout(triggerFileUpload, 800);
          return;
        }
        flowData.attachment = file;
        addMessage(`Selected file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
        
        showOptions([
          { label: 'Continue to submit', action: promptConfirmSubmit },
          { label: 'Choose a different image', action: triggerFileUpload },
          { label: 'Remove image and continue', action: () => { delete flowData.attachment; promptConfirmSubmit(); } }
        ]);
      } else {
        promptImageUpload();
      }
    };
    
    fileInput.click();
  }

  function promptConfirmSubmit() {
    flowStep = 8;
    hideInput();
    const typing = showTypingIndicator();
    setTimeout(() => {
      removeTypingIndicator(typing);
      
      let confirmMsg = 'Great, everything is filled in.';
      if (flowData.attachment) {
        confirmMsg += `\n(Attachment: ${flowData.attachment.name})`;
      }
      confirmMsg += '\n\nPlease confirm you want to submit this complaint:';
      
      addMessage(confirmMsg);
      showOptions([
        { label: 'Submit Complaint', action: submitComplaintForm },
        { label: 'Start Over / Cancel', action: resetChat }
      ]);
    }, 500);
  }

  function submitComplaintForm() {
    const typing = showTypingIndicator();
    
    let body;
    let headers = {};
    
    if (flowData.attachment) {
      body = new FormData();
      for (const key in flowData) {
        if (key === 'attachment') {
          body.append('attachments', flowData.attachment);
        } else {
          body.append(key, flowData[key]);
        }
      }
    } else {
      body = JSON.stringify(flowData);
      headers['Content-Type'] = 'application/json';
    }
    
    fetch(`${hostUrl}/api/chatbot/complaint`, {
      method: 'POST',
      headers: headers,
      body: body
    })
      .then(res => {
        if (!res.ok) return res.json().then(e => { throw new Error(e.message); });
        return res.json();
      })
      .then(result => {
        removeTypingIndicator(typing);
        if (result.success && result.data) {
          const t = result.data;
          addMessage(`Complaint Submitted Successfully! ✅\n\nTicket ID: ${t.ticketId}\nStatus: ${t.status}\n\nWe have registered your issue. Our support team will review it shortly.`, false);
          
          setTimeout(() => {
            showOptions([{ label: 'Return to Menu', action: resetChat }]);
          }, 800);
        } else {
          throw new Error();
        }
      })
      .catch(err => {
        removeTypingIndicator(typing);
        addMessage(`Submission failed: ${err.message || 'Server error'}. Please try again.`);
        showOptions([
          { label: 'Retry Submission', action: submitComplaintForm },
          { label: 'Cancel', action: resetChat }
        ]);
      });
  }

  // --- TRACK TICKET FLOW ---
  function startTrackTicket() {
    currentFlow = 'track';
    flowStep = 1;
    flowData = {};

    const typing = showTypingIndicator();
    setTimeout(() => {
      removeTypingIndicator(typing);
      addMessage('Please enter the Sagenex Ticket ID (e.g. SGX-123456):');
      showInput('Ticket ID');
    }, 500);
  }

  function promptTrackEmail() {
    flowStep = 2;
    addMessage('Please enter the Email Address associated with the ticket:');
    showInput('Associated Email');
  }

  function fetchTicketTracking() {
    hideInput();
    const typing = showTypingIndicator();

    const url = `${hostUrl}/api/chatbot/track?ticketId=${encodeURIComponent(flowData.ticketId)}&email=${encodeURIComponent(flowData.email)}`;
    
    fetch(url)
      .then(res => {
        if (!res.ok) return res.json().then(e => { throw new Error(e.message); });
        return res.json();
      })
      .then(result => {
        removeTypingIndicator(typing);
        if (result.success && result.data) {
          const t = result.data;
          
          let statusBadge = t.status;
          if (t.status === 'Pending') statusBadge = '⏳ Pending';
          else if (t.status === 'Assigned') statusBadge = '🔧 Assigned';
          else if (t.status === 'Resolved') statusBadge = '✅ Resolved';
          else if (t.status === 'Closed') statusBadge = '🔒 Closed';
          else if (t.status === 'Reopened') statusBadge = '♻️ Reopened';

          let trackHtml = `
            <div style="font-weight:700;margin-bottom:6px;border-bottom:1px solid rgba(0,0,0,0.1);padding-bottom:4px;">
              Ticket: ${escapeHTML(t.ticketId)}
            </div>
            <div><strong>Title:</strong> ${escapeHTML(t.title)}</div>
            <div><strong>Status:</strong> ${escapeHTML(statusBadge)}</div>
            <div><strong>Priority:</strong> ${escapeHTML(t.priority)}</div>
            <div><strong>Developer:</strong> ${escapeHTML(t.assignedDeveloper)}</div>
            <div style="margin-top:8px;font-weight:700;font-size:11px;">Recent Activities:</div>
            <ul style="margin:4px 0 0;padding-left:14px;font-size:11px;max-height:100px;overflow-y:auto;text-align:left;">
          `;

          if (t.activities && t.activities.length > 0) {
            t.activities.slice(0, 3).forEach(act => {
              trackHtml += `
                <li style="margin-bottom:4px;">
                  <strong>${escapeHTML(act.actionType)}:</strong> ${escapeHTML(act.remarks || '')} 
                  <span style="color:#666;font-size:9px;">(${new Date(act.createdAt).toLocaleDateString()})</span>
                </li>
              `;
            });
          } else {
            trackHtml += `<li>No activities logged yet</li>`;
          }

          trackHtml += `</ul>`;

          addMessage(trackHtml, false, true);

          setTimeout(() => {
            showOptions([
              { label: 'Track Another Ticket', action: startTrackTicket },
              { label: 'Return to Main Menu', action: resetChat }
            ]);
          }, 800);

        } else {
          throw new Error();
        }
      })
      .catch(err => {
        removeTypingIndicator(typing);
        addMessage(`Tracking failed: ${err.message || 'Ticket not found'}. Let's try again.`);
        showOptions([
          { label: 'Retry Tracking', action: startTrackTicket },
          { label: 'Cancel', action: resetChat }
        ]);
      });
  }

  // --- FOOTER INPUT SEND HANDLER ---
  function handleSend() {
    const input = chatWidget.querySelector('.sagenex-chat-input');
    const val = input.value.trim();
    if (!val) return;

    addMessage(val, true);
    input.value = '';

    if (currentFlow === 'raise') {
      if (flowStep === 2) {
        verifyMember(val);
      } else if (flowStep === 3) {
        flowData.name = val;
        promptGuestEmail();
      } else if (flowStep === 4) {
        if (!validateEmail(val)) {
          addMessage('Please enter a valid email address.');
          showInput('email@domain.com');
          return;
        }
        flowData.email = val;
        promptGuestPhone();
      } else if (flowStep === 5) {
        flowData.phone = val;
        promptComplaintTitle();
      } else if (flowStep === 6) {
        if (val.length < 4) {
          addMessage('Title must be at least 4 characters long.');
          showInput('Title (min 4 chars)');
          return;
        }
        flowData.title = val;
        promptComplaintDescription();
      } else if (flowStep === 7) {
        if (val.length < 10) {
          addMessage('Description must be at least 10 characters long.');
          showInput('Description (min 10 chars)');
          return;
        }
        flowData.description = val;
        promptImageUpload();
      }
    } else if (currentFlow === 'track') {
      if (flowStep === 1) {
        flowData.ticketId = val;
        promptTrackEmail();
      } else if (flowStep === 2) {
        if (!validateEmail(val)) {
          addMessage('Please enter a valid email address.');
          showInput('Associated Email');
          return;
        }
        flowData.email = val;
        fetchTicketTracking();
      }
    }
  }

  // Helpers
  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  // Injected CSS Styles
  function injectStyles(themeColor) {
    const style = document.createElement('style');
    style.innerHTML = `
      .sagenex-chat-button {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: ${themeColor};
        color: #ffffff;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 999999;
        transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), background 0.3s;
      }
      .sagenex-chat-button:hover {
        transform: scale(1.08);
      }
      .sagenex-chat-button svg {
        width: 24px;
        height: 24px;
        transition: transform 0.3s;
      }
      .sagenex-chat-button.sagenex-active svg {
        transform: rotate(90deg);
      }

      .sagenex-chat-widget {
        position: fixed;
        bottom: 90px;
        right: 20px;
        width: 360px;
        height: 480px;
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.5);
        border-radius: 12px;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
        display: flex;
        flex-direction: column;
        z-index: 999998;
        overflow: hidden;
        opacity: 0;
        transform: translateY(20px) scale(0.95);
        pointer-events: none;
        transition: opacity 0.3s, transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.1);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        line-height: 1.4;
      }
      .sagenex-chat-widget.sagenex-open {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }

      .sagenex-chat-header {
        background: ${themeColor};
        color: #ffffff;
        padding: 14px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .sagenex-chat-header-info {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .sagenex-chat-header-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #10b981;
        box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.4);
      }
      .sagenex-chat-header-title {
        font-weight: 700;
        font-size: 14px;
        letter-spacing: 0.2px;
      }
      .sagenex-chat-close {
        background: none;
        border: none;
        color: #ffffff;
        font-size: 24px;
        line-height: 1;
        cursor: pointer;
        opacity: 0.8;
        padding: 0;
        transition: opacity 0.2s;
      }
      .sagenex-chat-close:hover {
        opacity: 1;
      }

      .sagenex-chat-body {
        flex: 1;
        padding: 16px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: rgba(243, 244, 246, 0.45);
      }

      .sagenex-message {
        display: flex;
        width: 100%;
      }
      .sagenex-message.sagenex-bot {
        justify-content: flex-start;
      }
      .sagenex-message.sagenex-user {
        justify-content: flex-end;
      }
      .sagenex-message-bubble {
        max-width: 85%;
        padding: 10px 14px;
        border-radius: 12px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
        word-wrap: break-word;
        white-space: pre-wrap;
      }
      .sagenex-bot .sagenex-message-bubble {
        background: #ffffff;
        color: #1f2937;
        border-bottom-left-radius: 2px;
        border: 1px solid rgba(229, 231, 235, 0.8);
      }
      .sagenex-user .sagenex-message-bubble {
        background: ${themeColor};
        color: #ffffff;
        border-bottom-right-radius: 2px;
      }

      .sagenex-options-container {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 4px 0;
        width: 85%;
        align-self: flex-start;
      }
      .sagenex-option-btn {
        background: #ffffff;
        color: ${themeColor};
        border: 1px solid ${themeColor};
        padding: 8px 12px;
        border-radius: 20px;
        cursor: pointer;
        text-align: left;
        font-size: 12px;
        font-weight: 600;
        transition: background 0.2s, color 0.2s;
      }
      .sagenex-option-btn:hover {
        background: ${themeColor};
        color: #ffffff;
      }

      .sagenex-chat-footer {
        padding: 12px;
        background: #ffffff;
        border-top: 1px solid rgba(229, 231, 235, 0.8);
      }
      .sagenex-input-container {
        display: flex;
        gap: 8px;
        width: 100%;
      }
      .sagenex-chat-input {
        flex: 1;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 13px;
        outline: none;
        transition: border-color 0.2s;
      }
      .sagenex-chat-input:focus {
        border-color: ${themeColor};
      }
      .sagenex-chat-send {
        background: ${themeColor};
        color: #ffffff;
        border: none;
        width: 36px;
        height: 36px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: opacity 0.2s;
      }
      .sagenex-chat-send:hover {
        opacity: 0.9;
      }
      .sagenex-chat-send svg {
        width: 16px;
        height: 16px;
      }

      /* Typing indicator */
      .sagenex-typing-indicator .sagenex-message-bubble {
        padding: 10px 18px;
        display: flex;
        gap: 4px;
        align-items: center;
      }
      .sagenex-typing-indicator .dot {
        width: 6px;
        height: 6px;
        background: #9ca3af;
        border-radius: 50%;
        display: inline-block;
        animation: sagenex-bounce 1.3s infinite ease-in-out;
      }
      .sagenex-typing-indicator .dot:nth-child(2) {
        animation-delay: 0.15s;
      }
      .sagenex-typing-indicator .dot:nth-child(3) {
        animation-delay: 0.3s;
      }
      @keyframes sagenex-bounce {
        0%, 80%, 100% { transform: scale(0); }
        40% { transform: scale(1.0); }
      }
    `;
    document.head.appendChild(style);
  }
})();
