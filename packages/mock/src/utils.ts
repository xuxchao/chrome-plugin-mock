export const mockLogger = {
  log: (...args: any[]) => {
    console.log('%c[MOCK popup] ', 'color: #3498db; font-weight: bold; font-size: 12px;', ...args);
    sendToPageConsole('log', args);
  },
  error: (...args: any[]) => {
    console.error('%c[MOCK popup] ', 'color: #e74c3c; font-weight: bold; font-size: 12px;', ...args);
    sendToPageConsole('error', args);
  },
  warn: (...args: any[]) => {
    console.warn('%c[MOCK popup] ', 'color: #f39c12; font-weight: bold; font-size: 12px;', ...args);
    sendToPageConsole('warn', args);
  }
};

function sendToPageConsole(type: 'log' | 'error' | 'warn', args: any[]) {
  const message = {
    type: 'POPUP',
    payload: { type, args }
  };

  try {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      tabs.forEach((tab) => {
        if(!tab.id) {
          return ;
        }
        chrome.tabs.sendMessage(tab.id, message).then((...args) => {
          console.log('我收到了消息', args);
        }).catch(() => {
          // 静默处理：接收方不存在（content script 未加载或无活动标签页）
        });
      });
    });
  } catch (e) {
    // 发送失败时静默处理（可能不在扩展上下文中）
  }
}
