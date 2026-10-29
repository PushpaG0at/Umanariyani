/**
 * UMANARAYANI AYURVEDA — AI VAIDYA & HUMAN WHATSAPP CONSULTANT
 * Powered by Google Gemini (gemini-3.6-flash)
 * Human Helpline: +91 8641033514
 */

(function () {
  'use strict';

  const HUMAN_WHATSAPP_NUMBER = "+918641033514";
  const HUMAN_WHATSAPP_LINK_BASE = "https://wa.me/918641033514";

  // Strict HTML escape function to prevent DOM XSS
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Safe and sanitized markdown parser for Ayurvedic text (pre-escaped against XSS)
  function formatMarkdown(text) {
    if (!text) return '';
    // 1. First escape raw HTML to prevent script / image onerror injection
    const safe = escapeHtml(text);

    // 2. Apply formatting rules safely on pre-escaped text
    let html = safe
      // Headings
      .replace(/^### (.*$)/gim, '<h4>$1</h4>')
      .replace(/^## (.*$)/gim, '<h3>$1</h3>')
      .replace(/^# (.*$)/gim, '<h2>$1</h2>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Bullet list items
      .replace(/^\s*[-•*]\s+(.*$)/gim, '<li>$1</li>')
      // Numbered lists
      .replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>');

    // Wrap continuous <li> in <ul>
    html = html.replace(/(<li>[\s\S]*?<\/li>)/gm, '<ul>$1</ul>');
    // Fix duplicate consecutive <ul><ul>
    html = html.replace(/<\/ul>\s*<ul>/g, '');

    // Paragraphs (double newlines)
    html = html.split(/\n{2,}/).map(para => {
      para = para.trim();
      if (!para) return '';
      if (para.startsWith('<h') || para.startsWith('<ul') || para.startsWith('<ol')) {
        return para;
      }
      return `<p>${para.replace(/\n/g, '<br>')}</p>`;
    }).join('');

    return html;
  }

  /* ==================== 1. MAIN SANCTUARY AI CHAT ==================== */
  function initMainAiChat() {
    const chatBody = document.getElementById('aiChatBody');
    const inputField = document.getElementById('aiInputField');
    const sendBtn = document.getElementById('aiSendBtn');
    const quickChips = document.querySelectorAll('.ai-quick-chip');
    const modeTabs = document.querySelectorAll('.ai-tab-btn');
    const chatView = document.getElementById('aiChatView');
    const doshaView = document.getElementById('doshaQuizView');

    if (!chatBody || !inputField || !sendBtn) return;

    // Switch between Live Chat and Dosha Quiz
    if (modeTabs.length > 0) {
      modeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
          modeTabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');

          const mode = tab.dataset.mode;
          if (mode === 'chat') {
            if (chatView) chatView.style.display = 'flex';
            if (doshaView) doshaView.classList.remove('active');
          } else if (mode === 'dosha') {
            if (chatView) chatView.style.display = 'none';
            if (doshaView) doshaView.classList.add('active');
          }
        });
      });
    }

    // Scroll chat to bottom
    function scrollToBottom() {
      chatBody.scrollTop = chatBody.scrollHeight;
    }

    // Add message to chat body
    function appendMessage(sender, content, suggestedProducts = [], whatsappLink = '') {
      const msgDiv = document.createElement('div');
      msgDiv.className = `chat-msg ${sender}`;

      const avatar = document.createElement('div');
      avatar.className = 'msg-avatar';
      avatar.innerHTML = sender === 'bot' 
        ? '<img src="images/logo-center.png" alt="AI Vaidya" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">' 
        : '<i class="fa-solid fa-user" style="font-size:0.8rem; color:#1B4332;"></i>';

      const contentBox = document.createElement('div');
      contentBox.className = 'msg-content';

      if (sender === 'user') {
        contentBox.textContent = content;
      } else {
        contentBox.innerHTML = formatMarkdown(content);

        // Append suggested product pills if any
        if (suggestedProducts && suggestedProducts.length > 0) {
          const prodBox = document.createElement('div');
          prodBox.className = 'suggested-products-box';
          prodBox.innerHTML = `
            <div class="suggested-title"><i class="fa-solid fa-leaf"></i> Matching Ayurvedic Formulations:</div>
            <div class="suggested-items-row">
              ${suggestedProducts.map(p => `
                <a href="product.html?id=${encodeURIComponent(p.id)}" target="_blank" class="suggested-product-pill">
                  <img src="${escapeHtml(p.image) || 'images/ayurvedic_herbs_circle.jpg'}" alt="${escapeHtml(p.name)}">
                  <span>${escapeHtml(p.name)} (₹${escapeHtml(p.price)})</span>
                  <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.7rem; margin-left:2px;"></i>
                </a>
              `).join('')}
            </div>
          `;
          contentBox.appendChild(prodBox);
        }

        // Append WhatsApp herbal support banner
        const escalateBox = document.createElement('div');
        escalateBox.className = 'ai-answer-whatsapp-escalate';
        const waUrl = whatsappLink || `${HUMAN_WHATSAPP_LINK_BASE}?text=${encodeURIComponent('Hello Umanarayani! I want to consult regarding: ' + content.substring(0, 60))}`;
        escalateBox.innerHTML = `
          <span>Want 1-on-1 guidance from our Herbal Care Team?</span>
          <a href="${waUrl}" target="_blank">
            <i class="fa-brands fa-whatsapp"></i> Chat on WhatsApp
          </a>
        `;
        contentBox.appendChild(escalateBox);
      }

      msgDiv.appendChild(avatar);
      msgDiv.appendChild(contentBox);
      chatBody.appendChild(msgDiv);
      scrollToBottom();
    }

    // Show / Hide Typing Indicator
    let typingEl = null;
    function showTyping() {
      if (typingEl) return;
      typingEl = document.createElement('div');
      typingEl.className = 'chat-msg bot';
      typingEl.innerHTML = `
        <div class="msg-avatar">
          <img src="images/logo-center.png" alt="AI Vaidya" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">
        </div>
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      `;
      chatBody.appendChild(typingEl);
      scrollToBottom();
    }

    function hideTyping() {
      if (typingEl && typingEl.parentNode) {
        typingEl.parentNode.removeChild(typingEl);
      }
      typingEl = null;
    }

    // Send question to AI
    async function handleSend(text) {
      const q = text || inputField.value.trim();
      if (!q) return;

      appendMessage('user', q);
      inputField.value = '';
      sendBtn.disabled = true;
      showTyping();

      try {
        const response = await fetch('/api/ai/consult', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: q })
        });

        const data = await response.json();
        hideTyping();

        if (data.success && data.reply) {
          appendMessage('bot', data.reply, data.suggestedProducts || [], data.whatsappLink);
        } else {
          appendMessage('bot', "Namaste! 🙏 Our AI is momentarily resting. You can connect directly with our human Ayurvedic specialist on WhatsApp at **+91 8641033514**.", [], `${HUMAN_WHATSAPP_LINK_BASE}?text=Namaste!`);
        }
      } catch (err) {
        console.error("AI Consult Error:", err);
        hideTyping();
        appendMessage('bot', "Namaste! 🙏 For any immediate question or custom Ayurvedic product guidance, feel free to message our Herbal Care Team directly on WhatsApp at **+91 8641033514**.", [], `${HUMAN_WHATSAPP_LINK_BASE}?text=Namaste!`);
      } finally {
        sendBtn.disabled = false;
        inputField.focus();
      }
    }

    sendBtn.addEventListener('click', () => handleSend());
    inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    });

    quickChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const query = chip.dataset.query || chip.textContent.trim();
        handleSend(query);
      });
    });
  }

  /* ==================== 2. DOSHA DIAGNOSIS QUIZ ==================== */
  function initDoshaQuiz() {
    const quizForm = document.getElementById('doshaQuizForm');
    const resultBox = document.getElementById('doshaResultBox');
    const resultContent = document.getElementById('doshaResultContent');
    const waReviewBtn = document.getElementById('btnDoshaWaReview');

    if (!quizForm || !resultBox) return;

    // Radio selection visual feedback
    const radioLabels = quizForm.querySelectorAll('.dosha-radio-label');
    radioLabels.forEach(label => {
      const radio = label.querySelector('input[type="radio"]');
      if (radio) {
        radio.addEventListener('change', () => {
          const groupName = radio.name;
          quizForm.querySelectorAll(`input[name="${groupName}"]`).forEach(r => {
            r.closest('.dosha-radio-label').classList.remove('selected');
          });
          if (radio.checked) {
            label.classList.add('selected');
          }
        });
      }
    });

    quizForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = quizForm.querySelector('.btn-diagnose-dosha');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Consulting Ayurvedic AI...';
      submitBtn.disabled = true;

      const hairTexture = (quizForm.querySelector('input[name="hairTexture"]:checked') || {}).value || 'Normal to Dry';
      const skinType = (quizForm.querySelector('input[name="skinType"]:checked') || {}).value || 'Combination';
      const scalpTendency = (quizForm.querySelector('input[name="scalpTendency"]:checked') || {}).value || 'Occasional Flakes';
      const mainConcern = (quizForm.querySelector('input[name="mainConcern"]:checked') || {}).value || 'Hair Fall & Nourishment';

      try {
        const res = await fetch('/api/ai/diagnose-dosha', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hairTexture, skinType, scalpTendency, mainConcern })
        });
        const data = await res.json();

        resultContent.innerHTML = formatMarkdown(data.diagnosis || "Your profile has been analyzed.");
        resultBox.classList.add('active');
        resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        if (waReviewBtn) {
          const prefill = `Namaste Umanarayani! I completed the Dosha Quiz (Hair: ${hairTexture}, Skin: ${skinType}, Concern: ${mainConcern}). Please guide me on my personalized Ayurvedic regimen.`;
          waReviewBtn.href = `${HUMAN_WHATSAPP_LINK_BASE}?text=${encodeURIComponent(prefill)}`;
        }
      } catch (err) {
        console.error("Dosha error:", err);
        resultContent.innerHTML = "<p>Namaste! Unable to complete diagnostic right now. Please message our Herbal Care Team directly on WhatsApp at +91 8641033514.</p>";
        resultBox.classList.add('active');
      } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }
    });
  }

  /* ==================== 3. PRODUCT-PAGE AI ASSISTANT ==================== */
  function initProductPageAi() {
    const prodAiContainer = document.getElementById('productAiConsultant');
    if (!prodAiContainer) return;

    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id') || 'ayurvedic-hair-oil';

    const chatStream = document.getElementById('prodAiChatStream');
    const input = document.getElementById('prodAiInput');
    const sendBtn = document.getElementById('prodAiSendBtn');
    const chips = document.querySelectorAll('.prod-ai-chip');

    if (!chatStream || !input || !sendBtn) return;

    function appendProdMsg(sender, text, whatsappLink = '') {
      const msg = document.createElement('div');
      msg.className = `chat-msg ${sender}`;

      const avatar = document.createElement('div');
      avatar.className = 'msg-avatar';
      avatar.innerHTML = sender === 'bot' ? '🌿' : '<i class="fa-solid fa-user" style="font-size:0.75rem;"></i>';

      const content = document.createElement('div');
      content.className = 'msg-content';

      if (sender === 'user') {
        content.textContent = text;
      } else {
        content.innerHTML = formatMarkdown(text);

        const escalate = document.createElement('div');
        escalate.className = 'ai-answer-whatsapp-escalate';
        escalate.style.marginTop = '8px';
        const link = whatsappLink || `${HUMAN_WHATSAPP_LINK_BASE}?text=${encodeURIComponent('Hello Umanarayani! I have a question about ' + productId + ': ' + text.substring(0, 50))}`;
        escalate.innerHTML = `
          <span style="font-size:0.75rem;">Prefer 1-on-1 herbal guidance?</span>
          <a href="${link}" target="_blank" style="padding:4px 10px; font-size:0.75rem;">
            <i class="fa-brands fa-whatsapp"></i> WhatsApp +918641033514
          </a>
        `;
        content.appendChild(escalate);
      }

      msg.appendChild(avatar);
      msg.appendChild(content);
      chatStream.appendChild(msg);
      chatStream.scrollTop = chatStream.scrollHeight;
    }

    async function sendProdQuestion(qText) {
      const q = qText || input.value.trim();
      if (!q) return;

      appendProdMsg('user', q);
      input.value = '';
      sendBtn.disabled = true;

      const typingDiv = document.createElement('div');
      typingDiv.className = 'chat-msg bot';
      typingDiv.innerHTML = '<div class="msg-avatar">🌿</div><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
      chatStream.appendChild(typingDiv);
      chatStream.scrollTop = chatStream.scrollHeight;

      try {
        const res = await fetch('/api/ai/consult', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: q, productId: productId })
        });
        const data = await res.json();
        if (typingDiv.parentNode) typingDiv.parentNode.removeChild(typingDiv);

        if (data.success && data.reply) {
          appendProdMsg('bot', data.reply, data.whatsappLink);
        } else {
          appendProdMsg('bot', "Namaste! Please chat with our human Ayurvedic specialist on WhatsApp at +91 8641033514 for specific guidance on this product.");
        }
      } catch (e) {
        if (typingDiv.parentNode) typingDiv.parentNode.removeChild(typingDiv);
        appendProdMsg('bot', "Namaste! Feel free to talk directly to our human specialist on WhatsApp at +91 8641033514.");
      } finally {
        sendBtn.disabled = false;
      }
    }

    sendBtn.addEventListener('click', () => sendProdQuestion());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendProdQuestion();
      }
    });

    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        sendProdQuestion(chip.dataset.query || chip.textContent.trim());
      });
    });
  }

  /* ==================== 4. FLOATING AI QUICK BUTTON & MODAL ==================== */
  function initFloatingAiBtn() {
    const floatBtn = document.getElementById('floatingAiBtn');
    const modal = document.getElementById('aiFloatingModal');
    const closeBtn = document.getElementById('btnCloseAiModal');
    const chatBody = document.getElementById('aiFloatingChatBody');
    const input = document.getElementById('aiFloatingInput');
    const sendBtn = document.getElementById('aiFloatingSendBtn');
    const chips = document.querySelectorAll('.ai-mini-chip');

    if (!floatBtn || !modal) return;

    // Toggle Modal
    floatBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isActive = modal.classList.contains('active');
      if (isActive) {
        modal.classList.remove('active');
      } else {
        // Close WhatsApp modal if open to prevent overlap
        const waModal = document.getElementById('whatsappModal');
        if (waModal) waModal.classList.remove('active');

        modal.classList.add('active');
        if (input) setTimeout(() => input.focus(), 300);
      }
    });

    // Close button
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        modal.classList.remove('active');
      });
    }

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (modal.classList.contains('active') && !modal.contains(e.target) && e.target !== floatBtn && !floatBtn.contains(e.target)) {
        modal.classList.remove('active');
      }
    });

    // Prevent clicks inside modal from closing
    modal.addEventListener('click', (e) => e.stopPropagation());

    if (!chatBody || !input || !sendBtn) return;

    function appendModalMsg(sender, text, suggestedProducts = [], whatsappLink = '') {
      const msgDiv = document.createElement('div');
      msgDiv.className = `chat-msg ${sender}`;

      const avatar = document.createElement('div');
      avatar.className = 'msg-avatar';
      avatar.innerHTML = sender === 'bot' ? '🌿' : '<i class="fa-solid fa-user" style="font-size:0.75rem;"></i>';

      const contentBox = document.createElement('div');
      contentBox.className = 'msg-content';

      if (sender === 'user') {
        contentBox.textContent = text;
      } else {
        contentBox.innerHTML = formatMarkdown(text);

        // Suggested products if any
        if (suggestedProducts && suggestedProducts.length > 0) {
          const prodDiv = document.createElement('div');
          prodDiv.className = 'suggested-products-box';
          prodDiv.innerHTML = `
            <div class="suggested-title"><i class="fa-solid fa-leaf"></i> Matching Formulations:</div>
            <div class="suggested-items-row">
              ${suggestedProducts.map(p => `
                <a href="product.html?id=${encodeURIComponent(p.id)}" target="_blank" class="suggested-product-pill">
                  <img src="${escapeHtml(p.image) || 'images/ayurvedic_herbs_circle.jpg'}" alt="${escapeHtml(p.name)}">
                  <span>${escapeHtml(p.name)} (₹${escapeHtml(p.price)})</span>
                </a>
              `).join('')}
            </div>
          `;
          contentBox.appendChild(prodDiv);
        }

        // WhatsApp herbal support escalation
        const esc = document.createElement('div');
        esc.className = 'ai-answer-whatsapp-escalate';
        esc.style.marginTop = '8px';
        const link = whatsappLink || `${HUMAN_WHATSAPP_LINK_BASE}?text=${encodeURIComponent('Hello Umanarayani! I consulted your AI and want to talk with a human specialist about: ' + text.substring(0, 50))}`;
        esc.innerHTML = `
          <span style="font-size:0.72rem;">Want 1-on-1 herbal support?</span>
          <a href="${link}" target="_blank" style="padding:3px 10px; font-size:0.72rem;">
            <i class="fa-brands fa-whatsapp"></i> WhatsApp +918641033514
          </a>
        `;
        contentBox.appendChild(esc);
      }

      msgDiv.appendChild(avatar);
      msgDiv.appendChild(contentBox);
      chatBody.appendChild(msgDiv);
      chatBody.scrollTop = chatBody.scrollHeight;
    }

    async function sendModalMessage(qText) {
      const q = qText || input.value.trim();
      if (!q) return;

      appendModalMsg('user', q);
      input.value = '';
      sendBtn.disabled = true;

      // Typing indicator
      const typing = document.createElement('div');
      typing.className = 'chat-msg bot';
      typing.innerHTML = '<div class="msg-avatar">🌿</div><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
      chatBody.appendChild(typing);
      chatBody.scrollTop = chatBody.scrollHeight;

      // Extract current product id if on product page
      const urlParams = new URLSearchParams(window.location.search);
      const prodId = urlParams.get('id') || '';

      try {
        const res = await fetch('/api/ai/consult', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: q, productId: prodId })
        });
        const data = await res.json();
        if (typing.parentNode) typing.parentNode.removeChild(typing);

        if (data.success && data.reply) {
          appendModalMsg('bot', data.reply, data.suggestedProducts || [], data.whatsappLink);
        } else {
          appendModalMsg('bot', "Namaste! 🙏 Please chat with our human Ayurvedic specialist on WhatsApp at **+91 8641033514**.", [], `${HUMAN_WHATSAPP_LINK_BASE}?text=Namaste!`);
        }
      } catch (err) {
        if (typing.parentNode) typing.parentNode.removeChild(typing);
        appendModalMsg('bot', "Namaste! For product support and herbal routine advice, please WhatsApp us at **+91 8641033514**.", [], `${HUMAN_WHATSAPP_LINK_BASE}?text=Namaste!`);
      } finally {
        sendBtn.disabled = false;
        input.focus();
      }
    }

    sendBtn.addEventListener('click', () => sendModalMessage());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendModalMessage();
      }
    });

    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        sendModalMessage(chip.dataset.query || chip.textContent.trim());
      });
    });
  }

  // Initialize all features once DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    initMainAiChat();
    initDoshaQuiz();
    initProductPageAi();
    initFloatingAiBtn();
  });

})();
