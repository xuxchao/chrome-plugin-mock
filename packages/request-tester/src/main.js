// 请求测试工具的主要逻辑

// 全局状态
let isSending = false;
let currentRequestIndex = 0;
let totalCount = 0;
let successCount = 0;
let failedCount = 0;
let intervalId = null;

// DOM 元素
const elements = {
  url: document.getElementById('url'),
  method: document.getElementById('method'),
  modeXHR: document.querySelector('input[value="xhr"]'),
  modeFetch: document.querySelector('input[value="fetch"]'),
  repeatCount: document.getElementById('repeat-count'),
  interval: document.getElementById('interval'),
  timeout: document.getElementById('timeout'),
  headers: document.getElementById('headers'),
  body: document.getElementById('body'),
  startBtn: document.getElementById('start-btn'),
  stopBtn: document.getElementById('stop-btn'),
  totalCount: document.getElementById('total-count'),
  successCount: document.getElementById('success-count'),
  failedCount: document.getElementById('failed-count'),
  resultContent: document.getElementById('result-content'),
  logContent: document.getElementById('log-content')
};

// 日志记录函数
function log(message) {
  const timestamp = new Date().toLocaleTimeString();
  elements.logContent.innerHTML += `[${timestamp}] ${message}\n`;
  elements.logContent.scrollTop = elements.logContent.scrollHeight;
}

// 清除日志
function clearLogs() {
  elements.logContent.innerHTML = '';
  elements.resultContent.innerHTML = '';
}

// 更新统计信息
function updateStats() {
  elements.totalCount.textContent = totalCount;
  elements.successCount.textContent = successCount;
  elements.failedCount.textContent = failedCount;
}

// 重置统计信息
function resetStats() {
  totalCount = 0;
  successCount = 0;
  failedCount = 0;
  updateStats();
}

// 发送 XHR 请求
function sendXHRRequest(config) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(config.method, config.url);
    
    // 设置超时
    xhr.timeout = config.timeout;
    
    // 设置请求头
    if (config.headers) {
      Object.entries(config.headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });
    }
    
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({
          status: xhr.status,
          statusText: xhr.statusText,
          response: xhr.responseText,
          headers: xhr.getAllResponseHeaders()
        });
      } else {
        reject(new Error(`XHR Error: ${xhr.status} ${xhr.statusText}`));
      }
    };
    
    xhr.onerror = () => {
      reject(new Error('XHR Network Error'));
    };
    
    xhr.ontimeout = () => {
      reject(new Error(`XHR Timeout after ${config.timeout}ms`));
    };
    
    // 发送请求
    if (config.body && (config.method === 'POST' || config.method === 'PUT')) {
      xhr.send(JSON.stringify(config.body));
    } else {
      xhr.send();
    }
  });
}

// 发送 Fetch 请求
function sendFetchRequest(config) {
  const fetchConfig = {
    method: config.method,
    headers: config.headers || {},
    timeout: config.timeout,
    body: (config.body && (config.method === 'POST' || config.method === 'PUT')) ? JSON.stringify(config.body) : undefined
  };
  
  return fetch(config.url, fetchConfig)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Fetch Error: ${response.status} ${response.statusText}`);
      }
      return response.json().then(data => ({
        status: response.status,
        statusText: response.statusText,
        response: data,
        headers: Object.fromEntries(response.headers)
      }));
    });
}

// 发送单个请求
async function sendRequest() {
  const config = {
    url: elements.url.value,
    method: elements.method.value,
    mode: elements.modeXHR.checked ? 'xhr' : 'fetch',
    timeout: parseInt(elements.timeout.value),
    headers: elements.headers.value ? JSON.parse(elements.headers.value) : {},
    body: elements.body.value ? JSON.parse(elements.body.value) : null
  };
  
  try {
    totalCount++;
    updateStats();
    
    log(`发送请求 ${totalCount}/${elements.repeatCount.value}: ${config.method} ${config.url} (${config.mode})`);
    
    let result;
    if (config.mode === 'xhr') {
      result = await sendXHRRequest(config);
    } else {
      result = await sendFetchRequest(config);
    }
    
    successCount++;
    updateStats();
    
    log(`请求成功: ${result.status} ${result.statusText}`);
    
// JSON 高亮格式化函数
function jsonHighlight(json) {
  if (typeof json === 'string') {
    try {
      json = JSON.parse(json);
    } catch (e) {
      return escapeHtml(json);
    }
  }
  
  const jsonStr = JSON.stringify(json, null, 2);
  
  let result = '';
  let inString = false;
  let currentStr = '';
  let indent = 0;
  let indentStr = '';
  
  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    
    if (inString) {
      currentStr += char;
      if (char === '"' && jsonStr[i - 1] !== '\\') {
        inString = false;
        result += `<span class="json-string">${currentStr}</span>`;
        currentStr = '';
      }
    } else {
      if (char === '"') {
        inString = true;
        currentStr = '"';
      } else if (char === ':') {
        result += `<span class="json-punctuation">${char}</span>`;
      } else if (char === '{' || char === '[') {
        result += `<span class="json-punctuation">${char}</span>`;
        indent++;
        indentStr = '  '.repeat(indent);
        result += '\n' + indentStr;
      } else if (char === '}' || char === ']') {
        indent--;
        indentStr = '  '.repeat(indent);
        result += '\n' + indentStr + char;
      } else if (char === ',') {
        result += `<span class="json-punctuation">${char}</span>`;
        result += '\n' + indentStr;
      } else if (char === ' ' || char === '\n') {
        result += char;
      } else {
        const match = jsonStr.slice(i).match(/^(true|false|null|-?\d+\.?\d*)/);
        if (match) {
          const value = match[0];
          const type = /^-?\d+\.?\d*$/.test(value) ? 'json-number' : 
                       value === 'true' || value === 'false' ? 'json-boolean' : 'json-null';
          result += `<span class="${type}">${value}</span>`;
          i += value.length - 1;
        }
      }
    }
  }
  
  return result;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 显示结果
const resultObj = {
  status: result.status,
  statusText: result.statusText,
  headers: result.headers,
  response: result.response
};
elements.resultContent.innerHTML = `<pre class="json-highlight">${jsonHighlight(resultObj)}</pre>`;
    
  } catch (error) {
    failedCount++;
    updateStats();
    
    log(`请求失败: ${error.message}`);
    elements.resultContent.innerHTML = `请求失败: ${error.message}`;
  }
}

// 开始发送请求
function startSending() {

  // fetch('https://developer.233xyx.com/developer-web/developer/apk/game/list', {
  //   method: 'POST',
  //   body: JSON.stringify({"fuzzyGameName":"","pageNum":1,"pageSize":100}),
  //     headers: {
  //       '233auth': '26fb358957c847a98360c80eb0bf0722',
  //       'Content-Type': 'application/json'
  //     }
  // }).then(data => {
  //   return data.json();
  // }).then(jsonData => {
  //   console.log('开发者 请求成功:', jsonData, Array.from(jsonData.data.dataList));
  // }).catch(error => {
  //   console.error('开发者 请求失败:', error);
  // }).finally(() => {
  //   console.log('开发者 finally')
  // })
  
  // 重置状态
  isSending = true;
  currentRequestIndex = 0;
  resetStats();
  clearLogs();
  
  // 更新按钮状态
  elements.startBtn.disabled = true;
  elements.stopBtn.disabled = false;
  
  const repeatCount = parseInt(elements.repeatCount.value);
  const interval = parseInt(elements.interval.value);
  
  // 立即发送第一个请求
  sendRequest();
  currentRequestIndex++;
  
  // 如果需要重复发送，设置定时器
  if (repeatCount > 1) {
    intervalId = setInterval(() => {
      if (currentRequestIndex < repeatCount && isSending) {
        sendRequest();
        currentRequestIndex++;
      } else {
        stopSending();
      }
    }, interval);
  } else {
    stopSending();
  }
}

// 停止发送请求
function stopSending() {
  isSending = false;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  
  // 更新按钮状态
  elements.startBtn.disabled = false;
  elements.stopBtn.disabled = true;
  
  log('请求发送已停止');
}

// 事件监听
function setupEventListeners() {
  elements.startBtn.addEventListener('click', startSending);
  elements.stopBtn.addEventListener('click', stopSending);
}

// 初始化
function init() {
  setupEventListeners();
  log('请求测试工具已初始化，准备发送请求');
}

// 启动应用
init();
