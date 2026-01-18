// inject.js - 注入到页面的脚本，用于与 content script 和页面脚本通讯

console.log('Inject script loaded');

// 1. 与 content script 通信
function sendMessageToContent() {
  window.postMessage({
    type: 'page-to-ext',
    from: 'inject',
    data: {
      message: '来自注入脚本的消息',
      timestamp: Date.now(),
      info: '这是一条从注入脚本发送到 content script 的消息'
    }
  }, '*');
}

// 2. 监听来自 content script 的消息
window.addEventListener('message', (event) => {
  // 只处理来自 content script 的消息
  if (event.source !== window) return;
  
  const message = event.data;
  
  // 验证消息格式
  if (typeof message !== 'object' || !message.type) return;
  
  console.log('注入脚本收到消息:', message);
  
  // 处理不同类型的消息
  switch (message.type) {
    case 'ext-to-page':
      console.log('收到来自 content script 的消息:', message.data);
      showMessage(`注入脚本: 接收 <- content`, JSON.stringify(message.data));
      break;
      
    case 'ext-broadcast':
      console.log('收到来自 extension 的广播:', message.data);
      showMessage(`注入脚本: 广播 <- extension`, message.data.message);
      break;
      
    case 'ext-pong':
      console.log('收到 pong 回复:', message.data);
      showMessage(`注入脚本: Pong`, `延迟: ${Date.now() - message.data.timestamp}ms`);
      break;
  }
});

// 3. 向页面发送消息（供页面脚本使用）
function sendMessageToPage() {
  window.dispatchEvent(new CustomEvent('inject-message', {
    detail: {
      message: '来自注入脚本的自定义事件',
      timestamp: Date.now()
    }
  }));
}

// 4. 在页面上显示消息
function showMessage(title, content) {
  const messageElement = document.createElement('div');
  messageElement.style.cssText = `
    position: fixed;
    top: 50px;
    left: 10px;
    background: #2196F3;
    color: white;
    padding: 10px 15px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 9999;
    max-width: 300px;
    word-wrap: break-word;
    opacity: 0.9;
    transition: all 0.3s ease;
  `;
  messageElement.innerHTML = `<strong>${title}:</strong> ${content}`;
  
  document.body.appendChild(messageElement);
  
  // 3秒后自动移除
  setTimeout(() => {
    messageElement.style.opacity = '0';
    setTimeout(() => {
      if (messageElement.parentNode) {
        messageElement.parentNode.removeChild(messageElement);
      }
    }, 300);
  }, 3000);
}

// 5. 暴露一些方法给页面脚本调用
window.__inject_communication__ = {
  sendMessageToContent: sendMessageToContent,
  sendMessageToPage: sendMessageToPage
};

// 6. 测试函数
function testInjectCommunication() {
  console.log('开始测试注入脚本通讯');
  
  // 发送 ping 消息
  window.postMessage({
    type: 'page-ping',
    from: 'inject',
    data: { timestamp: Date.now() }
  }, '*');
  
  // 发送消息给 content script
  setTimeout(() => {
    sendMessageToContent();
  }, 500);
  
  // 发送自定义事件给页面
  setTimeout(() => {
    sendMessageToPage();
  }, 1000);
}

// 7. 添加测试按钮
function addTestButton() {
  const button = document.createElement('button');
  button.textContent = '测试注入通讯';
  button.style.cssText = `
    position: fixed;
    top: 50px;
    left: 10px;
    background: #2196F3;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    z-index: 9999;
  `;
  
  button.addEventListener('click', testInjectCommunication);
  document.body.appendChild(button);
}

// 初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addTestButton);
} else {
  addTestButton();
}

console.log('注入脚本初始化完成');
