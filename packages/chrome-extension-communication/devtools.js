// devtools.js - 开发者工具脚本，处理与其他组件的通讯

console.log('DevTools script loaded');

// 当前检查的标签页ID
let currentTabId = -1;

// 与background的连接
let backgroundPort = null;

// 工具函数：日志记录
function logToContainer(containerId, message, type = 'info') {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const logItem = document.createElement('div');
  logItem.className = `log-item ${type}`;
  logItem.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  
  container.appendChild(logItem);
  container.scrollTop = container.scrollHeight;
}

// 工具函数：更新状态
function updateStatus(elementId, connected, message) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  element.className = `status ${connected ? 'connected' : 'disconnected'}`;
  element.textContent = message;
}

// 1. 初始化
function init() {
  // 获取当前标签页信息
  chrome.devtools.inspectedWindow.eval(
    'window.location.href',
    (result, isException) => {
      if (!isException) {
        currentTabId = chrome.devtools.inspectedWindow.tabId;
        document.getElementById('tab-info').textContent = `当前标签页: ${result}`;
        logToContainer('debug-log', `已连接到标签页 ${currentTabId}`, 'success');
      }
    }
  );
  
  // 初始化各个功能模块
  setupBackgroundCommunication();
  setupContentCommunication();
  setupPageCommunication();
  setupDebugTools();
  
  logToContainer('debug-log', 'DevTools 初始化完成', 'success');
}

// 2. 与 Background 通讯
function setupBackgroundCommunication() {
  // 建立与 background 的长连接
  backgroundPort = chrome.runtime.connect({ name: 'devtools-port' });
  
  backgroundPort.onMessage.addListener((message) => {
    logToContainer('bg-log', `收到来自 background 的消息: ${JSON.stringify(message)}`, 'success');
  });
  
  backgroundPort.onDisconnect.addListener(() => {
    logToContainer('bg-log', '与 background 的连接已断开', 'error');
    updateStatus('bg-status', false, '未连接');
    backgroundPort = null;
  });
  
  updateStatus('bg-status', true, '已连接');
  logToContainer('bg-log', '已建立与 background 的连接', 'success');
  
  // 发送消息到 background
  document.getElementById('send-to-bg').addEventListener('click', () => {
    if (!backgroundPort) {
      logToContainer('bg-log', '未连接到 background', 'error');
      return;
    }
    
    const message = {
      type: 'devtools-to-bg',
      tabId: currentTabId,
      message: '来自 DevTools 的消息',
      timestamp: Date.now()
    };
    
    backgroundPort.postMessage(message);
    logToContainer('bg-log', `发送消息到 background: ${JSON.stringify(message)}`, 'info');
  });
  
  // 获取 background 页面
  document.getElementById('get-bg-page').addEventListener('click', () => {
    chrome.runtime.getBackgroundPage((bgPage) => {
      if (chrome.runtime.lastError) {
        logToContainer('bg-log', `获取 background 页面失败: ${chrome.runtime.lastError.message}`, 'error');
        return;
      }
      
      logToContainer('bg-log', `成功获取 background 页面: ${bgPage.location.href}`, 'success');
      
      // 向 background 页面发送消息
      bgPage.postMessage({
        type: 'devtools-message',
        message: '来自 DevTools 的直接消息',
        tabId: currentTabId
      }, '*');
    });
  });
}

// 3. 与 Content Script 通讯
function setupContentCommunication() {
  // 发送消息到 content script
  document.getElementById('send-to-content').addEventListener('click', () => {
    if (currentTabId === -1) {
      logToContainer('content-log', '未获取到标签页 ID', 'error');
      return;
    }
    
    const message = {
      type: 'devtools-to-content',
      message: '来自 DevTools 的消息',
      timestamp: Date.now()
    };
    
    chrome.tabs.sendMessage(currentTabId, message, (response) => {
      if (chrome.runtime.lastError) {
        logToContainer('content-log', `发送消息失败: ${chrome.runtime.lastError.message}`, 'error');
        updateStatus('content-status', false, '未连接');
        return;
      }
      
      logToContainer('content-log', `收到 content script 的回复: ${JSON.stringify(response)}`, 'success');
      updateStatus('content-status', true, '已连接');
    });
  });
  
  // 注入脚本到页面
  document.getElementById('inject-script').addEventListener('click', () => {
    if (currentTabId === -1) {
      logToContainer('content-log', '未获取到标签页 ID', 'error');
      return;
    }
    
    // 检查当前页面 URL 是否为 chrome://
    chrome.tabs.get(currentTabId, (tab) => {
      if (chrome.runtime.lastError) {
        logToContainer('content-log', `获取标签页信息失败: ${chrome.runtime.lastError.message}`, 'error');
        return;
      }
      
      if (tab.url.startsWith('chrome://')) {
        logToContainer('content-log', '无法在 chrome:// 页面注入脚本', 'error');
        return;
      }
      
      // 注入脚本
      chrome.scripting.executeScript({
        target: { tabId: currentTabId },
        function: () => {
          console.log('从 DevTools 注入的脚本');
          return { message: '脚本注入成功', url: window.location.href };
        }
      }).then((results) => {
        if (results && results[0]) {
          logToContainer('content-log', `脚本注入成功: ${JSON.stringify(results[0].result)}`, 'success');
        }
      }).catch((error) => {
        logToContainer('content-log', `脚本注入失败: ${error.message}`, 'error');
      });
    });
  });
  
  // 监听来自 content script 的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.tab && sender.tab.id === currentTabId) {
      logToContainer('content-log', `收到来自 content script 的消息: ${JSON.stringify(message)}`, 'success');
      sendResponse({ received: true, from: 'devtools' });
    }
    return true;
  });
}

// 4. 与页面直接通讯
function setupPageCommunication() {
  // 在页面执行脚本
  document.getElementById('eval-in-page').addEventListener('click', () => {
    const script = `
      (function() {
        console.log('在页面执行的脚本');
        return {
          url: window.location.href,
          title: document.title,
          timestamp: Date.now()
        };
      })();
    `;
    
    chrome.devtools.inspectedWindow.eval(
      script,
      (result, isException) => {
        if (isException) {
          logToContainer('page-log', `执行脚本失败: ${JSON.stringify(result)}`, 'error');
        } else {
          logToContainer('page-log', `脚本执行结果: ${JSON.stringify(result)}`, 'success');
        }
      }
    );
  });
  
  // 重载页面
  document.getElementById('reload-page').addEventListener('click', () => {
    chrome.devtools.inspectedWindow.reload();
    logToContainer('page-log', '已重载页面', 'info');
  });
  
  // 监听页面 DOM 变化
  chrome.devtools.inspectedWindow.onResourceAdded.addListener((resource) => {
    logToContainer('page-log', `资源加载: ${resource.url}`, 'info');
  });
  
  chrome.devtools.inspectedWindow.onResourceContentCommitted.addListener((resource, content) => {
    logToContainer('page-log', `资源更新: ${resource.url}`, 'info');
  });
}

// 5. 调试工具
function setupDebugTools() {
  // 清空所有日志
  document.getElementById('clear-all-logs').addEventListener('click', () => {
    const logContainers = document.querySelectorAll('.log-container');
    logContainers.forEach((container) => {
      container.innerHTML = '';
    });
    logToContainer('debug-log', '所有日志已清空', 'info');
  });
  
  // 检查扩展
  document.getElementById('inspect-extension').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    logToContainer('debug-log', '已打开扩展选项页面', 'info');
  });
  
  // 获取当前页面的 cookie
  chrome.devtools.inspectedWindow.eval(
    'document.cookie',
    (result, isException) => {
      if (!isException) {
        logToContainer('debug-log', `当前页面 Cookie: ${result}`, 'info');
      }
    }
  );
}

// 6. 监听 DevTools 窗口关闭
window.addEventListener('beforeunload', () => {
  if (backgroundPort) {
    backgroundPort.disconnect();
    backgroundPort = null;
  }
  console.log('DevTools 窗口已关闭');
});

// 7. 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', init);
