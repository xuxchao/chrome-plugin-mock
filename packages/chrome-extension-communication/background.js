// background.js - 后台脚本，处理各种通讯

console.log('Background script loaded');

// 1. 监听来自 popup 或 content script 的短连接消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('收到短连接消息:', message, '来自:', sender);
  
  // 根据消息类型处理
  switch (message.type) {
    case 'popup-to-bg':
      sendResponse({ 
        status: 'success', 
        message: '收到来自 popup 的消息',
        timestamp: Date.now()
      });
      break;
    
    case 'content-to-bg':
      sendResponse({ 
        status: 'success', 
        message: '收到来自 content script 的消息',
        tabId: sender.tab?.id
      });
      break;
    
    case 'devtools-to-bg':
      sendResponse({ 
        status: 'success', 
        message: '收到来自 devtools 的消息',
        tabId: sender.tab?.id
      });
      break;
    
    default:
      sendResponse({ status: 'error', message: '未知消息类型' });
  }
  
  return true; // 保持连接，允许异步发送响应
});

// 2. 监听长连接请求
let longConnections = new Map();

chrome.runtime.onConnect.addListener((port) => {
  console.log('建立长连接:', port.name, '来自:', port.sender);
  
  // 存储连接
  const connectionId = `${port.name}-${Date.now()}`;
  longConnections.set(connectionId, port);
  
  // 监听来自长连接的消息
  port.onMessage.addListener((message) => {
    console.log('收到长连接消息:', message, '端口:', port.name);
    
    // 向所有连接发送广播（除了发送者）
    longConnections.forEach((conn, id) => {
      if (conn !== port) {
        conn.postMessage({
          type: 'broadcast',
          message: `来自 ${port.name} 的广播消息: ${message.content}`,
          timestamp: Date.now()
        });
      }
    });
    
    // 回复发送者
    port.postMessage({
      status: 'success',
      message: `已处理长连接消息: ${message.content}`,
      timestamp: Date.now()
    });
  });
  
  // 监听连接断开
  port.onDisconnect.addListener(() => {
    console.log('长连接断开:', port.name);
    longConnections.delete(connectionId);
  });
});

// 3. 监听 tabs 相关事件
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    console.log('标签页加载完成:', tabId, tab.url);
    
    // 向 content script 发送消息
    chrome.tabs.sendMessage(tabId, {
      type: 'bg-to-content',
      message: '标签页加载完成',
      url: tab.url
    }).catch(err => {
      console.log('向标签页发送消息失败:', err);
    });
  }
});

// 4. 监听存储变化
chrome.storage.onChanged.addListener((changes, areaName) => {
  console.log('存储变化:', changes, '区域:', areaName);
  
  // 向所有连接发送存储变化通知
  longConnections.forEach((port) => {
    port.postMessage({
      type: 'storage-change',
      changes: changes,
      areaName: areaName,
      timestamp: Date.now()
    });
  });
});

// 5. 向所有 content script 发送广播
function broadcastToAllTabs(message) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'broadcast',
        message: message,
        timestamp: Date.now()
      }).catch(err => {
        // 忽略无法发送的标签页（可能没有 content script）
      });
    });
  });
}

// 暴露一些方法给其他组件调用
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'broadcast-to-all') {
    broadcastToAllTabs(message.content);
    sendResponse({ status: 'success', message: '已发送广播' });
  }
});

console.log('Background script 初始化完成');
