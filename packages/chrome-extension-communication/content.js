// content.js - 页面内容脚本，处理与其他组件的通讯

console.log('Content script loaded');

// 1. 向 background 发送短连接消息
function sendShortMessageToBackground() {
  chrome.runtime.sendMessage({
    type: 'content-to-bg',
    message: '来自 content script 的短消息',
    url: window.location.href,
    timestamp: Date.now()
  }, (response) => {
    console.log('收到 background 的回复:', response);
    logMessage(`短连接: 发送 -> ${chrome.runtime.id}`, `回复: ${JSON.stringify(response)}`);
  });
}

// 2. 与 background 建立长连接
let backgroundPort = null;

function establishLongConnection() {
  if (backgroundPort) {
    console.log('长连接已存在');
    return;
  }
  
  backgroundPort = chrome.runtime.connect({ name: 'content-port' });
  
  backgroundPort.onMessage.addListener((message) => {
    console.log('收到来自 background 的长连接消息:', message);
    logMessage(`长连接: 接收 <- ${message.type}`, JSON.stringify(message));
    
    // 如果是广播消息，转发给页面脚本
    if (message.type === 'broadcast') {
      window.postMessage({
        type: 'ext-broadcast',
        from: 'content',
        data: message
      }, '*');
    }
  });
  
  backgroundPort.onDisconnect.addListener(() => {
    console.log('与 background 的长连接断开');
    backgroundPort = null;
  });
  
  console.log('已建立与 background 的长连接');
  logMessage('长连接', '已建立与 background 的长连接');
}

// 3. 监听来自 background 的短连接消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('收到来自 background 的短连接消息:', message);
  logMessage(`短连接: 接收 <- ${chrome.runtime.id}`, JSON.stringify(message));
  
  if (message.type === 'bg-to-content') {
    sendResponse({ 
      status: 'success', 
      message: '已收到来自 background 的消息',
      url: window.location.href
    });
    
    // 转发给页面脚本
    window.postMessage({
      type: 'ext-message',
      from: 'background',
      data: message
    }, '*');
  }
  
  return true;
});

// 4. 向页面注入脚本
function injectScript() {
  console.log('注入脚本到页面');
  
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inject.js');
  script.type = 'module';
  script.onload = () => {
    console.log('脚本注入成功');
    script.remove();
  };
  
  (document.head || document.documentElement).appendChild(script);
}

// 5. 与页面脚本通信
window.addEventListener('message', (event) => {
  // 只处理来自页面脚本的消息
  if (event.source !== window) return;
  
  const message = event.data;
  
  // 验证消息格式
  if (typeof message !== 'object' || !message.type) return;
  
  console.log('收到来自页面脚本的消息:', message);
  logMessage(`页面通信: 接收 <- page`, JSON.stringify(message));
  
  // 处理不同类型的消息
  switch (message.type) {
    case 'page-to-ext':
      // 转发给 background
      chrome.runtime.sendMessage({
        type: 'content-to-bg',
        from: 'page',
        data: message.data,
        url: window.location.href
      }, (response) => {
        // 将 background 的回复返回给页面脚本
        window.postMessage({
          type: 'ext-to-page',
          from: 'content',
          data: response
        }, '*');
      });
      break;
      
    case 'page-ping':
      // 直接回复页面脚本
      window.postMessage({
        type: 'ext-pong',
        from: 'content',
        data: { timestamp: Date.now() }
      }, '*');
      break;
  }
});

// 6. 日志记录函数
function logMessage(title, content) {
  // 创建一个日志元素，显示在页面上
  const logElement = document.createElement('div');
  logElement.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #333;
    color: #fff;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 9999;
    max-width: 300px;
    word-wrap: break-word;
    opacity: 0.8;
    transition: all 0.3s ease;
  `;
  logElement.innerHTML = `<strong>${title}:</strong> ${content}`;
  
  document.body.appendChild(logElement);
  
  // 3秒后自动移除
  setTimeout(() => {
    logElement.style.opacity = '0';
    setTimeout(() => {
      if (logElement.parentNode) {
        logElement.parentNode.removeChild(logElement);
      }
    }, 300);
  }, 3000);
}

// 7. 测试函数
function testAllCommunications() {
  console.log('开始测试所有通讯方式');
  
  // 测试1: 短连接发送消息
  sendShortMessageToBackground();
  
  // 测试2: 建立长连接
  establishLongConnection();
  
  // 测试3: 向页面注入脚本
  injectScript();
  
  // 测试4: 向页面发送消息
  setTimeout(() => {
    window.postMessage({
      type: 'ext-to-page',
      from: 'content',
      data: {
        message: '来自 content script 的问候',
        timestamp: Date.now()
      }
    }, '*');
  }, 1000);
}

// 8. 添加一个测试按钮到页面
function addTestButton() {
  const button = document.createElement('button');
  button.textContent = '测试通讯';
  button.style.cssText = `
    position: fixed;
    top: 10px;
    left: 10px;
    background: #4CAF50;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    z-index: 9999;
  `;
  
  button.addEventListener('click', testAllCommunications);
  document.body.appendChild(button);
}

// 初始化
window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM 已加载');
  addTestButton();
  establishLongConnection();
  injectScript();
});

// 导出一些方法供其他脚本调用
window.__ext_communication__ = {
  sendMessageToBackground: sendShortMessageToBackground,
  establishLongConnection: establishLongConnection,
  testAll: testAllCommunications
};
