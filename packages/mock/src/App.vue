<script setup lang="ts">
import { ref, onMounted } from 'vue';

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

interface StorageResult {
  mockEnabled?: boolean;
  recordEnabled?: boolean;
  recordedData?: RecordedData;
  domains?: string[];
  paths?: string[];
}

interface StorageChanges {
  mockEnabled?: chrome.storage.StorageChange;
  recordEnabled?: chrome.storage.StorageChange;
  recordedData?: chrome.storage.StorageChange;
  domains?: chrome.storage.StorageChange;
  paths?: chrome.storage.StorageChange;
}

import { mockLogger } from './utils';

// 状态管理
const domains = ref<string[]>([]);
const newDomain = ref('');
interface PathItem {
  path: string;
  recordEnabled: boolean;
}
const paths = ref<PathItem[]>([]);
const newPath = ref('');
const recordEnabled = ref(false);
const mockEnabled = ref(false);
const recordedData = ref<RecordedData>({});
const selectedKey = ref('');
const editJson = ref('');
// 防止死循环的标志
const isLoadingSettings = ref(false);

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

// 加载设置
const loadSettings = () => {
  isLoadingSettings.value = true;
  mockLogger.log('开始加载设置...');
  chrome.storage.local.get(['domains', 'paths', 'recordEnabled', 'mockEnabled', 'recordedData'], (result: StorageResult) => {
    mockLogger.log('从存储加载的数据:', result);

    
    const parsedDomains = toArray<string>(result.domains);
    
    let parsedPaths: PathItem[] = toArray(result.paths);
    
    domains.value = parsedDomains;
    paths.value = parsedPaths;
    recordEnabled.value = typeof result.recordEnabled === 'boolean' ? result.recordEnabled : false;
    mockEnabled.value = typeof result.mockEnabled === 'boolean' ? result.mockEnabled : false;
    recordedData.value = typeof result.recordedData === 'object' && result.recordedData !== null ? result.recordedData as RecordedData : {} as RecordedData;
    
    mockLogger.log('加载设置完成:', {
      domains: domains.value,
      paths: paths.value.map(p => p.path),
      recordEnabled: recordEnabled.value,
      mockEnabled: mockEnabled.value,
      recordedData: Object.keys(recordedData.value)
    });
    isLoadingSettings.value = false;
  });
};

// 保存设置
const saveSettings = () => {
  if (isLoadingSettings.value) {
    mockLogger.log('正在加载设置，跳过保存操作');
    return;
  }
  mockLogger.log('开始保存设置:', {
    domains: domains.value,
    paths: paths.value,
    recordEnabled: recordEnabled.value,
    mockEnabled: mockEnabled.value,
    recordedData: recordedData.value
  });
  chrome.storage.local.set({
    domains: domains.value,
    paths: paths.value,
    recordEnabled: recordEnabled.value,
    mockEnabled: mockEnabled.value,
    recordedData: recordedData.value
  }, () => {
    mockLogger.log('设置保存完成');
  });
};

// 域名管理
const addDomain = () => {
  mockLogger.log('=== 点击添加域名按钮 ===');
  mockLogger.log('添加域名前:', domains.value, '新域名:', newDomain.value);
  if (newDomain.value && !domains.value.includes(newDomain.value)) {
    domains.value.push(newDomain.value);
    mockLogger.log('添加域名后:', domains.value);
    newDomain.value = '';
    saveSettings();
  } else {
    mockLogger.log('添加域名条件不满足:', { newDomain: newDomain.value, isExists: domains.value.includes(newDomain.value) });
  }
};

const removeDomain = (domain: string) => {
  mockLogger.log('=== 点击删除域名按钮 ===');
  mockLogger.log('删除域名:', domain, '删除前:', domains.value);
  domains.value = domains.value.filter(d => d !== domain);
  mockLogger.log('删除域名后:', domains.value);
  saveSettings();
};

// 路径管理
const addPath = () => {
  mockLogger.log('=== 点击添加路径按钮 ===');
  mockLogger.log('添加路径前:', paths.value.map(p => p.path), '新路径:', newPath.value);
  if (newPath.value && !paths.value.some(p => p.path === newPath.value)) {
    paths.value.push({ path: newPath.value, recordEnabled: true });
    mockLogger.log('添加路径后:', paths.value.map(p => p.path));
    newPath.value = '';
    saveSettings();
  } else {
    mockLogger.log('添加路径条件不满足:', { newPath: newPath.value, isExists: paths.value.some(p => p.path === newPath.value) });
  }
};

const removePath = (path: string) => {
  mockLogger.log('=== 点击删除路径按钮 ===');
  mockLogger.log('删除路径:', path, '删除前:', paths.value.map(p => p.path));
  paths.value = paths.value.filter(p => p.path !== path);
  mockLogger.log('删除路径后:', paths.value.map(p => p.path));
  saveSettings();
};

const onPathRecordEnabledChange = (path: PathItem) => {
  mockLogger.log('=== 路径数据记录开关状态变化 ===', path);
  saveSettings();
};

// 数据管理
const selectData = (key: string) => {
  mockLogger.log('=== 点击选择数据按钮 ===');
  mockLogger.log('选择数据:', key);
  selectedKey.value = key;
  const data = recordedData.value[key];
  if (data) {
    editJson.value = JSON.stringify(data.response, null, 2);
    mockLogger.log('数据加载到编辑器:', data.url);
  } else {
    mockLogger.log('未找到数据:', key);
  }
};

const formatJson = () => {
  mockLogger.log('=== 点击格式化按钮 ===');
  mockLogger.log('格式化前 JSON:', editJson.value);
  try {
    const parsed = JSON.parse(editJson.value);
    editJson.value = JSON.stringify(parsed, null, 2);
    mockLogger.log('格式化成功');
  } catch (e) {
    mockLogger.error('格式化失败:', e);
    alert('无效的 JSON 格式');
  }
};

const saveMockData = () => {
  mockLogger.log('=== 点击保存按钮 ===');
  if (!selectedKey.value || !recordedData.value[selectedKey.value]) {
    mockLogger.log('保存条件不满足:', { selectedKey: selectedKey.value, hasData: !!recordedData.value[selectedKey.value] });
    return;
  }
  
  try {
    const parsed = JSON.parse(editJson.value);
    mockLogger.log('保存的数据:', parsed);
    const record = recordedData.value[selectedKey.value] as NonNullable<typeof recordedData.value[string]>;
    record.response = parsed;
    chrome.storage.local.set({ recordedData: recordedData.value }, () => {
      mockLogger.log('Mock 数据保存成功');
      alert('保存成功');
    });
  } catch (e) {
    mockLogger.error('Mock 数据保存失败:', e);
    alert('无效的 JSON 格式');
  }
};

// 监听存储变化
chrome.storage.onChanged.addListener((changes: StorageChanges, namespace: string) => {
  mockLogger.log('=== 存储变化事件 ===', { changes, namespace });
  // 重新加载所有设置，确保与存储保持同步
  loadSettings();
});

// 初始化
onMounted(() => {
  mockLogger.log('=== 插件初始化 ===');
  loadSettings();
});

// 监听开关状态变化
const onRecordEnabledChange = () => {
  mockLogger.log('=== 数据记录开关状态变化 ===', { newState: recordEnabled.value });
  saveSettings();
};

const onMockEnabledChange = () => {
  mockLogger.log('=== 接口模拟开关状态变化 ===', { newState: mockEnabled.value });
  saveSettings();
};
</script>

<template>
  <div class="app-container">
    <h1 class="app-title">Mock Data Tool</h1>
    
    <!-- 功能区 -->
    <div class="features-grid">
      <!-- 域名管理 -->
      <div class="feature-card">
        <h2 class="feature-title">域名管理</h2>
        <div class="input-group">
          <input 
            v-model="newDomain" 
            type="text" 
            placeholder="输入域名 (e.g., example.com)" 
            class="text-input"
            @keyup.enter="addDomain"
          />
          <button @click="addDomain" class="add-btn">添加</button>
        </div>
        <div class="domain-list">
          <div 
            v-for="domain in domains" 
            :key="domain"
            class="domain-item"
          >
            <span class="domain-name">{{ domain }}</span>
            <button @click="removeDomain(domain)" class="remove-btn">删除</button>
          </div>
        </div>
      </div>

      <!-- 路径管理 -->
      <div class="feature-card">
        <h2 class="feature-title">路径管理</h2>
        <div class="input-group">
          <input 
            v-model="newPath" 
            type="text" 
            placeholder="输入路径 (e.g., /api/data)" 
            class="text-input"
            @keyup.enter="addPath"
          />
          <button @click="addPath" class="add-btn">添加</button>
        </div>
        <div class="path-list">
          <div 
            v-for="pathItem in paths" 
            :key="pathItem.path"
            class="path-item"
          >
            <div class="path-info">
              <span class="path-name">{{ pathItem.path }}</span>
              <label class="path-switch-label">
                <span class="path-switch-text">记录</span>
                <input 
                  v-model="pathItem.recordEnabled" 
                  type="checkbox" 
                  class="toggle-switch"
                  @change="onPathRecordEnabledChange(pathItem)"
                />
                <span class="toggle-slider"></span>
              </label>
            </div>
            <button @click="removePath(pathItem.path)" class="remove-btn">删除</button>
          </div>
        </div>
      </div>

      <!-- 开关控制 -->
      <div class="feature-card">
        <h2 class="feature-title">功能开关</h2>
        <div class="switch-group">
          <label class="switch-label">
            <span class="switch-text">数据记录</span>
            <input 
              v-model="recordEnabled" 
              type="checkbox" 
              class="toggle-switch"
              @change="onRecordEnabledChange"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="switch-group">
          <label class="switch-label">
            <span class="switch-text">接口模拟</span>
            <input 
              v-model="mockEnabled" 
              type="checkbox" 
              class="toggle-switch"
              @change="onMockEnabledChange"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>

    <!-- 数据管理 -->
    <div class="feature-card full-width">
      <h2 class="feature-title">数据管理</h2>
      <div v-if="!recordEnabled" class="record-disabled-notice">
        <span class="notice-icon">⚠️</span>
        <span>数据记录已关闭，新请求将不会被记录</span>
      </div>
      <div class="data-management">
        <div class="recorded-list">
          <h3 class="section-title">已记录的数据</h3>
          <div class="recorded-items">
            <div 
              v-for="(data, key) in recordedData" 
              :key="key"
              class="recorded-item"
              :class="{ active: selectedKey === key }"
              @click="selectData(String(key))"
            >
              <span class="recorded-url">{{ data.url }}</span>
              <span class="recorded-method">{{ data.method }}</span>
            </div>
          </div>
        </div>
        
        <div class="json-editor">
          <h3 class="section-title">编辑 Mock 数据</h3>
          <div class="editor-controls">
            <button @click="formatJson" class="control-btn">格式化</button>
          </div>
          <textarea 
            v-model="editJson" 
            class="json-textarea"
            placeholder="选择一条记录来编辑..."
            spellcheck="false"
          ></textarea>
          <button @click="saveMockData" class="save-btn">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 全局样式 */
.app-container {
  width: 600px;
  height: 600px;
  padding: 20px;
  background-color: #1a1a1a;
  color: #ffffff;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  overflow: auto;
}

/* 标题样式 */
.app-title {
  margin: 0 0 20px 0;
  font-size: 24px;
  font-weight: bold;
  color: #3498db;
  text-align: center;
}

/* 功能卡片 */
.features-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.feature-card {
  background-color: #2d2d2d;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.feature-card.full-width {
  grid-column: 1 / -1;
}

.feature-title {
  margin: 0 0 15px 0;
  font-size: 18px;
  font-weight: 600;
  color: #3498db;
}

/* 输入组 */
.input-group {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.text-input {
  flex: 1;
  padding: 10px;
  background-color: #3d3d3d;
  border: 1px solid #555;
  border-radius: 4px;
  color: #ffffff;
  font-size: 14px;
}

.text-input:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

/* 按钮样式 */
.add-btn, .remove-btn, .control-btn, .save-btn {
  padding: 10px 15px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.add-btn {
  background-color: #3498db;
  color: white;
}

.add-btn:hover {
  background-color: #2980b9;
}

.remove-btn {
  background-color: #e74c3c;
  color: white;
  padding: 5px 10px;
  font-size: 12px;
}

.remove-btn:hover {
  background-color: #c0392b;
}

.control-btn {
  background-color: #95a5a6;
  color: white;
  margin-right: 10px;
}

.control-btn:hover {
  background-color: #7f8c8d;
}

.save-btn {
  background-color: #2ecc71;
  color: white;
  margin-top: 10px;
  width: 100%;
}

.save-btn:hover {
  background-color: #27ae60;
}

/* 列表样式 */
.domain-list, .path-list {
  max-height: 150px;
  overflow-y: auto;
}

.domain-item, .path-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background-color: #3d3d3d;
  border-radius: 4px;
  margin-bottom: 8px;
}

.path-item {
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}

.path-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.path-name {
  font-size: 14px;
  word-break: break-all;
}

.path-switch-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.path-switch-text {
  font-size: 12px;
  color: #999;
}

/* 开关样式 */
.switch-group {
  margin-bottom: 15px;
}

.switch-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}

.switch-text {
  font-size: 16px;
  font-weight: 500;
}

.toggle-switch {
  display: none;
}

.toggle-slider {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 24px;
  background-color: #555;
  border-radius: 24px;
  transition: all 0.3s ease;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.toggle-switch:checked + .toggle-slider {
  background-color: #3498db;
}

.toggle-switch:checked + .toggle-slider:before {
  transform: translateX(26px);
}

/* 数据管理样式 */
.data-management {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  height: 300px;
}

.section-title {
  margin: 0 0 15px 0;
  font-size: 16px;
  font-weight: 600;
  color: #bdc3c7;
}

.recorded-list {
  background-color: #3d3d3d;
  border-radius: 4px;
  padding: 15px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.recorded-items {
  flex: 1;
  overflow-y: auto;
}

.recorded-item {
  padding: 12px;
  background-color: #2d2d2d;
  border-radius: 4px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.recorded-item:hover {
  background-color: #34495e;
}

.recorded-item.active {
  background-color: #3498db;
  color: white;
}

.recorded-url {
  font-size: 14px;
  word-break: break-all;
}

.recorded-method {
  font-size: 12px;
  padding: 2px 6px;
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  display: inline-block;
  align-self: flex-start;
}

/* JSON 编辑器 */
.json-editor {
  background-color: #3d3d3d;
  border-radius: 4px;
  padding: 15px;
  display: flex;
  flex-direction: column;
}

.editor-controls {
  margin-bottom: 10px;
  display: flex;
  justify-content: flex-end;
}

.json-textarea {
  flex: 1;
  padding: 12px;
  background-color: #2d2d2d;
  border: 1px solid #555;
  border-radius: 4px;
  color: #ffffff;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  overflow: auto;
  white-space: pre;
}

.json-textarea:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #2d2d2d;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #777;
}

/* 记录关闭提示 */
.record-disabled-notice {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 15px;
  background-color: rgba(231, 76, 60, 0.15);
  border: 1px solid #e74c3c;
  border-radius: 6px;
  margin-bottom: 15px;
  color: #e74c3c;
  font-size: 14px;
}

.notice-icon {
  font-size: 16px;
}
</style>
