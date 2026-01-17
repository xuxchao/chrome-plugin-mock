console.log('%c[MOCK] ', 'color: #3498db; font-weight: bold; font-size: 12px;', 'Mock Data Tool Content Script Loaded');

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'LOG_TO_PAGE') {
    const { type, args } = message.payload;
    const prefix = '%c[MOCK] ';
    const style = 'color: #3498db; font-weight: bold; font-size: 12px;';

    switch (type) {
      case 'log':
        console.log(prefix, style, ...args);
        break;
      case 'error':
        console.error(prefix, style, ...args);
        break;
      case 'warn':
        console.warn(prefix, style, ...args);
        break;
    }
  }
  return false;
});
