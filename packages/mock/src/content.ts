
console.log('%c[MOCK CONTENT] ', 'color: #3498db; font-weight: bold; font-size: 12px;', new Date().toLocaleString());

chrome.runtime.onMessage.addListener((message, send, sendMessage) => {
    const { type, args } = message.payload;
    const prefix = `%c[MOCK ${message.type}] `;
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
    // sendMessage({ type: 'POPUP', payload: { message: "CONTENT" } });
  return false;
});
