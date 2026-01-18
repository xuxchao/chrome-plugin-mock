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

interface StorageResult {
  mockEnabled?: boolean;
  recordEnabled?: boolean;
  recordedData?: RecordedData;
  domains?: string[];
  paths?: PathItem[] | string[];
}

interface StorageChanges {
  mockEnabled?: chrome.storage.StorageChange;
  recordEnabled?: chrome.storage.StorageChange;
  recordedData?: chrome.storage.StorageChange;
  domains?: chrome.storage.StorageChange;
  paths?: chrome.storage.StorageChange;
}

// 预加载设置
let settings = {
  mockEnabled: false,
  recordEnabled: false,
  recordedData: {} as RecordedData,
  domains: [] as string[],
  paths: [] as PathItem[]
};

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

// 辅助函数：将值转换为数组
const toArray = <T>(value: any): T[] => {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (typeof value === 'object' && value !== null) {
    if ('length' in value && typeof value.length === 'number') {
      const arr: T[] = [];
      for (let i = 0; i < value.length; i++) {
        if (i in value) {
          arr.push(value[i]);
        }
      }
      return arr;
    }
    return Object.values(value) as T[];
  }
  return [];
};

// 辅助函数：解析 paths（兼容旧数据）
const parsePaths = (paths: PathItem[] | string[] | undefined): PathItem[] => {
  if (!paths || !Array.isArray(paths)) {
    return [];
  }
  if (paths.length > 0 && typeof paths[0] === 'object' && 'path' in paths[0]) {
    return (paths as PathItem[]).map(p => ({
      ...p,
      mockEnabled: typeof p.mockEnabled === 'boolean' ? p.mockEnabled : true
    }));
  }
  return (paths as string[]).map((path: string) => ({ path, recordEnabled: true, mockEnabled: true }));
};

// 加载设置
chrome.storage.local.get(['mockEnabled', 'recordEnabled', 'recordedData', 'domains', 'paths'], (result: StorageResult) => {
  settings = {
    mockEnabled: typeof result.mockEnabled === 'boolean' ? result.mockEnabled : false,
    recordEnabled: typeof result.recordEnabled === 'boolean' ? result.recordEnabled : false,
    recordedData: typeof result.recordedData === 'object' && result.recordedData !== null ? result.recordedData as RecordedData : {} as RecordedData,
    domains: toArray<string>(result.domains),
    paths: parsePaths(toArray<PathItem>(result.paths))
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
    settings.domains = toArray<string>(changes.domains.newValue);
    updateMockRules();
  }
  if (changes.paths) {
    mockLogger.log('PATH 发生变化', changes.paths.newValue);
    updateMockRules();
    settings.paths = parsePaths(toArray<PathItem>(changes.paths.newValue as PathItem[] | string[]));
  }
});

// 生成 mock 规则
function generateMockRules(): chrome.declarativeNetRequest.Rule[] {
  const rules: chrome.declarativeNetRequest.Rule[] = [];

  if (!settings.mockEnabled) {
    return rules;
  }

  let ruleId = 1;

  for (const domain of settings.domains) {
    for (const pathItem of settings.paths) {
      const path = pathItem.path;
      const key = `${domain}${path}`;
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

  return chrome.declarativeNetRequest.getDynamicRules()
    .then((existingRules) => {
      const existingRuleIds = existingRules.map(r => r.id);
      return chrome.declarativeNetRequest.updateDynamicRules({
        addRules: rules,
        removeRuleIds: existingRuleIds.length > 0 ? existingRuleIds : undefined
      });
    })
    .then(() => {
      mockLogger.log('Mock 规则已更新，规则数量:', rules.length);
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
    const currentDomains = settings.domains;
    const currentPathItems = settings.paths;
    const recordedData = settings.recordedData;

    const isDomainMatched = currentDomains.includes(domain);
    const pathItem = currentPathItems.find(p => p.path === path);
    const isPathMatched = !!pathItem;

    if (recordEnabled && isDomainMatched && isPathMatched && pathItem?.recordEnabled) {

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

          chrome.storage.local.set({ recordedData: updatedData });
        })
        .catch(err => {
          mockLogger.error('Failed to record response:', err);
        });
    }
    
    return undefined
  },
  { urls: ['<all_urls>'] },
  ['requestHeaders']
);

// chrome.webRequest.onCompleted.addListener(
//   (details: chrome.webRequest.OnResponseStartedDetails) => {
//     // mockLogger.log('onCompleted', details.url, details)
    
//   },
//   { urls: ['<all_urls>'] },
//   ['responseHeaders']
// );


