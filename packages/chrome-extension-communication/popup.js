// popup.js - 弹出页面脚本，处理与其他组件的通讯

console.log('Popup script loaded');

// 工具函数：日志记录
function logToContainer(containerId, message, type = 'info') {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const logItem = document.createElement('div');
  logItem.className = `log-item ${type}`;
  logItem.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  
  container.appendChild(logItem);
  container.scrollTop = container.scrollHeight;
  
  // 同时记录到主日志
  if (containerId !== 'main-log') {
    logToContainer('main-log', `${containerId.split('-')[0].toUpperCase()}: ${message}`, type);
  }
}

// 清空日志
function clearLog(containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = '';
  }
}

// 标签页切换
function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;
      
      // 更新按钮状态
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // 更新内容显示
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === tabName) {
          content.classList.add('active');
        }
      });
    });
  });
}

// 1. 短连接通讯
function setupShortConnection() {
  // 发送消息到 background
  document.getElementById('send-to-bg').addEventListener('click', () => {
    logToContainer('short-log', '发送短消息到 background...');
    
    chrome.runtime.sendMessage({
      type: 'popup-to-bg',
      message: '来自 popup 的短消息',
      timestamp: Date.now()
    }, (response) => {
      if (chrome.runtime.lastError) {
        logToContainer('short-log', `发送失败: ${chrome.runtime.lastError.message}`, 'error');
        return;
      }
      logToContainer('short-log', `收到回复: ${JSON.stringify(response)}`, 'success');
    });
  });
  
  // 发送消息到 content script
  document.getElementById('send-to-content').addEventListener('click', () => {
    logToContainer('short-log', '发送短消息到 content script...');
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        logToContainer('short-log', '没有找到活跃标签页', 'error');
        return;
      }
      
      const activeTab = tabs[0];
      chrome.tabs.sendMessage(activeTab.id, {
        type: 'popup-to-content',
        message: '来自 popup 的短消息',
        timestamp: Date.now()
      }, (response) => {
        if (chrome.runtime.lastError) {
          logToContainer('short-log', `发送失败: ${chrome.runtime.lastError.message}`, 'error');
          return;
        }
        logToContainer('short-log', `收到回复: ${JSON.stringify(response)}`, 'success');
      });
    });
  });
  
  // 获取当前标签页信息
  document.getElementById('get-active-tab').addEventListener('click', () => {
    logToContainer('short-log', '获取当前标签页信息...');
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        logToContainer('short-log', '没有找到活跃标签页', 'error');
        return;
      }
      
      const activeTab = tabs[0];
      logToContainer('short-log', `当前标签页: ${activeTab.title || '无标题'} - ${activeTab.url}`, 'success');
    });
  });
}

// 2. 长连接通讯
let backgroundPort = null;

function setupLongConnection() {
  const statusElement = document.getElementById('long-status');
  
  // 建立长连接
  document.getElementById('connect').addEventListener('click', () => {
    if (backgroundPort) {
      logToContainer('long-log', '长连接已存在', 'warn');
      return;
    }
    
    backgroundPort = chrome.runtime.connect({ name: 'popup-port' });
    
    backgroundPort.onMessage.addListener((message) => {
      logToContainer('long-log', `收到长连接消息: ${JSON.stringify(message)}`, 'success');
    });
    
    backgroundPort.onDisconnect.addListener(() => {
      logToContainer('long-log', '长连接已断开', 'warn');
      backgroundPort = null;
      statusElement.className = 'status disconnected';
      statusElement.textContent = '未连接';
    });
    
    statusElement.className = 'status connected';
    statusElement.textContent = '已连接';
    logToContainer('long-log', '已建立长连接', 'success');
  });
  
  // 断开长连接
  document.getElementById('disconnect').addEventListener('click', () => {
    if (backgroundPort) {
      backgroundPort.disconnect();
      backgroundPort = null;
      statusElement.className = 'status disconnected';
      statusElement.textContent = '未连接';
      logToContainer('long-log', '已断开长连接', 'success');
    } else {
      logToContainer('long-log', '没有活跃的长连接', 'warn');
    }
  });
  
  // 发送长连接消息
  document.getElementById('send-long-message').addEventListener('click', () => {
    if (!backgroundPort) {
      logToContainer('long-log', '请先建立长连接', 'error');
      return;
    }
    
    const message = {
      type: 'popup-long-message',
      content: '这是一条来自 popup 的长连接消息',
      timestamp: Date.now()
    };
    
    backgroundPort.postMessage(message);
    logToContainer('long-log', `发送长连接消息: ${JSON.stringify(message)}`, 'info');
  });
}

// 3. 广播通讯
function setupBroadcast() {
  document.getElementById('broadcast-all').addEventListener('click', () => {
    const message = document.getElementById('broadcast-message').value;
    if (!message.trim()) {
      logToContainer('broadcast-log', '请输入广播消息', 'error');
      return;
    }
    
    chrome.runtime.sendMessage({
      type: 'broadcast-to-all',
      content: message,
      timestamp: Date.now()
    }, (response) => {
      if (chrome.runtime.lastError) {
        logToContainer('broadcast-log', `广播失败: ${chrome.runtime.lastError.message}`, 'error');
        return;
      }
      logToContainer('broadcast-log', `广播成功: ${message}`, 'success');
    });
  });
}

// 4. 存储通讯
function setupStorage() {
  // 设置存储
  document.getElementById('set-storage').addEventListener('click', () => {
    const testData = {
      message: '这是一条测试存储数据',
      timestamp: Date.now(),
      from: 'popup'
    };
    
    chrome.storage.local.set({ 'test-data': testData }, () => {
      if (chrome.runtime.lastError) {
        logToContainer('storage-log', `存储失败: ${chrome.runtime.lastError.message}`, 'error');
        return;
      }
      logToContainer('storage-log', `存储成功: ${JSON.stringify(testData)}`, 'success');
    });
  });
  
  // 获取存储
  document.getElementById('get-storage').addEventListener('click', () => {
    chrome.storage.local.get('test-data', (result) => {
      if (chrome.runtime.lastError) {
        logToContainer('storage-log', `获取存储失败: ${chrome.runtime.lastError.message}`, 'error');
        return;
      }
      
      if (result['test-data']) {
        logToContainer('storage-log', `获取存储: ${JSON.stringify(result['test-data'])}`, 'success');
      } else {
        logToContainer('storage-log', '没有找到存储数据', 'warn');
      }
    });
  });
  
  // 清除存储
  document.getElementById('clear-storage').addEventListener('click', () => {
    chrome.storage.local.remove('test-data', () => {
      if (chrome.runtime.lastError) {
        logToContainer('storage-log', `清除存储失败: ${chrome.runtime.lastError.message}`, 'error');
        return;
      }
      logToContainer('storage-log', '清除存储成功', 'success');
    });
  });
  
  // 监听存储变化
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      for (const [key, change] of Object.entries(changes)) {
        logToContainer('storage-log', `${areaName}.${key}: ${JSON.stringify(change.oldValue)} -> ${JSON.stringify(change.newValue)}`, 'info');
      }
    }
  });
}

// 5. 监听来自 background 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logToContainer('main-log', `收到来自 ${sender.id} 的消息: ${JSON.stringify(message)}`, 'success');
  sendResponse({ received: true, timestamp: Date.now() });
  return true;
});

// 6. 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', () => {
  logToContainer('main-log', 'Popup 页面加载完成', 'success');
  
  // 设置标签页
  setupTabs();
  
  // 设置各功能模块
  setupShortConnection();
  setupLongConnection();
  setupBroadcast();
  setupStorage();
  
  // 清空日志功能
  document.getElementById('clear-log').addEventListener('click', () => {
    clearLog('main-log');
    logToContainer('main-log', '日志已清空', 'info');
  });
  
  // 测试所有功能
  logToContainer('main-log', '所有功能模块已初始化完成', 'success');
});

// 7. 页面卸载时清理
window.addEventListener('beforeunload', () => {
  if (backgroundPort) {
    backgroundPort.disconnect();
    backgroundPort = null;
  }
  console.log('Popup 页面已卸载');
});
