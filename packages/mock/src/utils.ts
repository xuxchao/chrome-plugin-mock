export const mockLogger = {
  log: (...args: any[]) => {
    console.log('%c[MOCK] ', 'color: #3498db; font-weight: bold; font-size: 12px;', ...args);
    sendToPageConsole('log', args);
  },
  error: (...args: any[]) => {
    console.error('%c[MOCK] ', 'color: #e74c3c; font-weight: bold; font-size: 12px;', ...args);
    sendToPageConsole('error', args);
  },
  warn: (...args: any[]) => {
    console.warn('%c[MOCK] ', 'color: #f39c12; font-weight: bold; font-size: 12px;', ...args);
    sendToPageConsole('warn', args);
  }
};

function sendToPageConsole(type: 'log' | 'error' | 'warn', args: any[]) {
  try {
    chrome.runtime.sendMessage({
      type: 'LOG_TO_PAGE',
      payload: { type, args }
    });
  } catch (e) {
    // 发送失败时静默处理（可能不在扩展上下文中）
  }
}
