// 日志工具函数
const mockLogger = {
  log: (...args: any[]) => {
    // console.log('%c[MOCK background] ', 'color: #3498db; font-weight: bold; font-size: 12px;', ...args);
    sendToPageConsole('log', args);
  },
  error: (...args: any[]) => {
    // console.error('%c[MOCK background] ', 'color: #e74c3c; font-weight: bold; font-size: 12px;', ...args);
    sendToPageConsole('error', args);
  },
  warn: (...args: any[]) => {
    // console.warn('%c[MOCK background] ', 'color: #f39c12; font-weight: bold; font-size: 12px;', ...args);
    sendToPageConsole('warn', args);
  }
};

function sendToPageConsole(type: 'log' | 'error' | 'warn', args: any[]) {
  const message = {
    type: 'BACKGROUND',
    payload: { type, args }
  };
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    tabs.forEach((tab) => {
      if(!tab.id) return;
      chrome.tabs.sendMessage(tab.id, message).catch(() => {
        // 静默处理：接收方不存在（content script 未加载或无活动标签页）
      });
    });
  });
}

interface RequestBody {
  [key: string]: any;
}

interface ResponseData {
  [key: string]: any;
}

interface RecordedData {
  [key: string]: {
    url: string;
    method: string;
    request: RequestBody;
    response: ResponseData;
    timestamp: number;
  };
}

interface PathItem {
  path: string;
  recordEnabled: boolean;
  mockEnabled: boolean;
}

interface DomainItem {
  domain: string;
  expanded: boolean;
  paths: PathItem[];
}

interface StorageResult {
  mockEnabled?: boolean;
  recordEnabled?: boolean;
  recordedData?: string;
  domains?: DomainItem[];
}

interface StorageChanges {
  mockEnabled?: chrome.storage.StorageChange;
  recordEnabled?: chrome.storage.StorageChange;
  recordedData?: chrome.storage.StorageChange;
  domains?: chrome.storage.StorageChange;
}

// 预加载设置
let settings = {
  mockEnabled: false,
  recordEnabled: false,
  recordedData: {} as RecordedData,
  domains: [] as DomainItem[]
};

// 请求体存储
const requestBodyMap = new Map<string, string>();

// 拦截计数器和Badge管理
let blockedCount = 0;

function updateBadge(count: number) {
  const text = count > 0 ? count.toString() : '';
  const color = count > 0 ? '#ff4444' : undefined;
  chrome.action.setBadgeText({ text });
  if (color) {
    chrome.action.setBadgeBackgroundColor({ color });
  }
}

function incrementBlockedCount() {
  blockedCount++;
  updateBadge(blockedCount);
}

function clearBlockedCount() {
  blockedCount = 0;
  updateBadge(0);
}

// 监听 popup 打开，清除 badge
chrome.action.onClicked.addListener(() => {
  clearBlockedCount();
});

// 加载设置
chrome.storage.local.get(['mockEnabled', 'recordEnabled', 'recordedData', 'domains'], (result: StorageResult) => {
  settings = {
    mockEnabled: typeof result.mockEnabled === 'boolean' ? result.mockEnabled : false,
    recordEnabled: typeof result.recordEnabled === 'boolean' ? result.recordEnabled : false,
    recordedData: result.recordedData ? JSON.parse(result.recordedData as string) : {},
    domains: result.domains ? JSON.parse(result.domains as unknown as string) : [] as DomainItem[]
  };

  updateMockRules();
});

// 监听设置变化
chrome.storage.onChanged.addListener((changes: StorageChanges) => {

  if (changes.mockEnabled) {
    mockLogger.log('MOCK 拦截发生变化', changes.mockEnabled.newValue);
    settings.mockEnabled = typeof changes.mockEnabled.newValue === 'boolean' ? changes.mockEnabled.newValue : false;
    updateMockRules();
  }
  if (changes.recordEnabled) {
    mockLogger.log('RECORD 拦截发生变化', changes.recordEnabled.newValue);
    settings.recordEnabled = typeof changes.recordEnabled.newValue === 'boolean' ? changes.recordEnabled.newValue : false;
  }
  if (changes.recordedData) {
    mockLogger.log('RECORD 数据发生变化');
    settings.recordedData = typeof changes.recordedData.newValue === 'object' && changes.recordedData.newValue !== null ? changes.recordedData.newValue as RecordedData : {} as RecordedData;
  }
  if (changes.domains) {
    mockLogger.log('DOMAIN 发生变化', changes.domains.newValue);
    settings.domains = (changes.domains.newValue as DomainItem[]) || [];
    updateMockRules();
  }
});

// 生成 mock 规则
function generateMockRules(): chrome.declarativeNetRequest.Rule[] {
  const rules: chrome.declarativeNetRequest.Rule[] = [];

  if (!settings.mockEnabled) {
    mockLogger.log('当前拦截已关闭')
    return rules;
  }

  let ruleId = 1;

  for (const domainItem of settings.domains) {
    const domain = domainItem.domain;
    for (const pathItem of domainItem.paths) {
      const path = pathItem.path;
      const key = `${domain}${path}`;
      mockLogger.log('当前路径', key)
      if (pathItem.mockEnabled && settings.recordedData[key]) {
        const mockData = settings.recordedData[key].response;
        const urlPattern = `*://${domain}${path}*`;

        rules.push({
          id: ruleId++,
          priority: 1,
          action: {
            // type: 'redirect' as const,
            type: 'redirect',
            redirect: {
              url: `data:application/json,${encodeURIComponent(JSON.stringify(mockData))}`,
            }
          },
          condition: {
            urlFilter: urlPattern,
            resourceTypes: ['main_frame', 'xmlhttprequest', 'script'] as chrome.declarativeNetRequest.ResourceType[]
          }
        });
      }
    }
  }

  return rules;
}

// 更新 mock 规则
function updateMockRules() {
  const rules = generateMockRules();

  mockLogger.log('更新 mock 规则', rules);

  return chrome.declarativeNetRequest.getDynamicRules()
    .then((existingRules) => {
      const existingRuleIds = existingRules.map(r => r.id);
      return chrome.declarativeNetRequest.updateDynamicRules({
        addRules: rules,
        removeRuleIds: existingRuleIds.length > 0 ? existingRuleIds : undefined
      });
    })
    .then(() => {
      mockLogger.log('Mock 规则已更新，规则数量:', rules.length, rules);
    })
    .catch((err) => {
      mockLogger.error('更新 mock 规则失败:', err);
    });
}
// 监听规则匹配（用于记录被拦截的请求）
// chrome.declarativeNetRequest.onRuleMatchedDebug?.addListener((info) => {
//   const request = info.request;
//   const rule = info.rule;

//   const blockedLog = {
//     url: request.url,
//     type: request.type,
//     method: request.method || 'GET',
//     initiator: request.initiator || '',
//     ruleId: rule.ruleId,
//     timestamp: Date.now()
//   };

//   mockLogger.log('请求被拦截:', blockedLog);
// });

// chrome.webRequest.onBeforeRequest.addListener((details) => {
//   return undefined;
// }, { urls: ['<all_urls>'] },
// )


chrome.webRequest.onBeforeRedirect.addListener((details) => {
  if(details.redirectUrl.startsWith('data:application/json')){
    mockLogger.warn('当前请求被拦截:', details.url);
    incrementBlockedCount();
  }
  return undefined;
}, { urls: ['<all_urls>']},
)

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details: chrome.webRequest.OnBeforeSendHeadersDetails) => {

    const initiator = details.initiator || '';
    if (initiator.startsWith('chrome-extension://')) {
      return;
    }
    const url = new URL(details.url);
    const domain = url.hostname;
    const path = url.pathname;

    const recordEnabled = settings.recordEnabled;
    const recordedData = settings.recordedData;

    // mockLogger.log('当前数据', domain, path)

    // 在新结构中查找匹配的域名和路径
    const domainItem = settings.domains.find(d => d.domain === domain);
    const pathItem = domainItem?.paths.find(p => p.path === path);
    // if (!domainItem) {
    //   mockLogger.log('未找到匹配的域名');
    //   return;
    // }
    // if(!pathItem) {
    //   mockLogger.log('未找到匹配的路径');
    //   return;
    // }
    if (!recordEnabled || !pathItem || !pathItem.recordEnabled) {
      // mockLogger.log('当前请求未启用记录', recordEnabled, pathItem, domainItem);
      return;
    }

    const requestHeadersObj: Record<string, string> = {};
    if (details.requestHeaders) {
      details.requestHeaders.forEach(header => {
        if (header.name && header.value) {
          requestHeadersObj[header.name] = header.value;
        }
      });
    }

    fetch(details.url, {
      method: details.method,
      
      headers: requestHeadersObj,
      body: details.documentId ? requestBodyMap.get(details.documentId): undefined,
    })
      .then(response => response.json())
      .then(data => {
        const key = `${domain}${path}`;
        const updatedData = {
          ...recordedData,
          [key]: {
            url: details.url,
            method: details.method,
            request: {},
            response: data,
            timestamp: Date.now()
          }
        };

        chrome.storage.local.set({ recordedData: JSON.stringify(updatedData) });

        mockLogger.log(`${url}: 记录成功`)
      })
      .catch(err => {
        mockLogger.error('Failed to record response:', err);
      }).finally(() => {
        if(details.documentId) {
          requestBodyMap.delete(details.documentId);
        }

      })
    
    return undefined
  },
  { urls: ['<all_urls>'] },
  ['requestHeaders']
);

// background.js
chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    const url = new URL(details.url);
    const domain = url.hostname;
    const path = url.pathname;

    const recordEnabled = settings.recordEnabled;

    // 在新结构中查找匹配的域名和路径
    const domainItem = settings.domains.find(d => d.domain === domain);
    if (!domainItem) {
      return undefined;
    }
    const pathItem = domainItem.paths.find(p => p.path === path);

    if (!recordEnabled || !pathItem || !pathItem.recordEnabled) {
      return undefined;
    }

    if (details.requestBody) {
      if (details.requestBody.raw) {
        const chunks: string[] = [];
        details.requestBody.raw.forEach(item => {
          const decoder = new TextDecoder('utf-8');
          const bodyString = decoder.decode(item.bytes);
          chunks.push(bodyString);
        });
        if(details.documentId) {
          requestBodyMap.set(details.documentId, chunks.join(''));
          // mockLogger.log('Request Body:', chunks.join(''));
        }
      }
      if (details.requestBody.formData) {
        if(details.documentId) {
          // mockLogger.log('Form Data:', details.requestBody.formData);
          requestBodyMap.set(details.documentId, JSON.stringify(details.requestBody.formData));
        }
      }
    }
    
    return undefined
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

// chrome.webRequest.onCompleted.addListener(
//   (details: chrome.webRequest.OnResponseStartedDetails) => {
//     // mockLogger.log('onCompleted', details.url, details)
    
//   },
//   { urls: ['<all_urls>'] },
//   ['responseHeaders']
// );


