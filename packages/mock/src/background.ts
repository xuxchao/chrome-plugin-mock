// 日志工具函数
const mockLogger = {
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
  chrome.runtime.sendMessage({
    type: 'LOG_TO_PAGE',
    payload: { type, args }
  }).catch(() => {
    // 静默处理：接收方不存在（content script 未加载或无活动标签页）
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
    return paths as PathItem[];
  }
  return (paths as string[]).map((path: string) => ({ path, recordEnabled: true }));
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
  
  mockLogger.log('设置已加载:', settings);
  updateMockRules();
});

// 监听设置变化
chrome.storage.onChanged.addListener((changes: StorageChanges) => {
  let needUpdateRules = false;
  
  if (changes.mockEnabled) {
    settings.mockEnabled = typeof changes.mockEnabled.newValue === 'boolean' ? changes.mockEnabled.newValue : false;
    needUpdateRules = true;
  }
  if (changes.recordEnabled) {
    settings.recordEnabled = typeof changes.recordEnabled.newValue === 'boolean' ? changes.recordEnabled.newValue : false;
  }
  if (changes.recordedData) {
    settings.recordedData = typeof changes.recordedData.newValue === 'object' && changes.recordedData.newValue !== null ? changes.recordedData.newValue as RecordedData : {} as RecordedData;
    needUpdateRules = true;
  }
  if (changes.domains) {
    settings.domains = toArray<string>(changes.domains.newValue);
    needUpdateRules = true;
  }
  if (changes.paths) {
    settings.paths = parsePaths(changes.paths.newValue as PathItem[] | string[]);
    needUpdateRules = true;
  }
  
  mockLogger.log('设置已更新:', settings);
  
  if (needUpdateRules) {
    updateMockRules();
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
      if (settings.recordedData[key]) {
        const mockData = settings.recordedData[key].response;
        const urlPattern = `*://${domain}${path}*`;
        
        rules.push({
          id: ruleId++,
          priority: 1,
          action: {
            type: 'redirect' as const,
            redirect: {
              url: `data:application/json,${encodeURIComponent(JSON.stringify(mockData))}`
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

chrome.webRequest.onCompleted.addListener(
  (details: chrome.webRequest.OnResponseStartedDetails) => {
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
      fetch(details.url, {
        method: details.method,
        headers: {},
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

        mockLogger.log('数据更新', domain, path, updatedData[key]);

        chrome.storage.local.set({ recordedData: updatedData });
      })
      .catch(err => {
        mockLogger.error('Failed to record response:', err);
      });
    }
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);


// 添加一个当前时间的打印，格式需要是年月日时分秒
mockLogger.log('1当前时间:', new Date().toLocaleString());
