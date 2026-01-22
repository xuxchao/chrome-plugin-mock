<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';

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
  recordedData?: RecordedData;
  domains?: DomainItem[];
}

interface StorageChanges {
  mockEnabled?: chrome.storage.StorageChange;
  recordEnabled?: chrome.storage.StorageChange;
  recordedData?: chrome.storage.StorageChange;
  domains?: chrome.storage.StorageChange;
}

import { mockLogger } from './utils';

// 状态管理
const domains = ref<DomainItem[]>([]);
const newDomain = ref('');
const domainSearch = ref('');

const filteredDomains = computed(() => {
  if (!domainSearch.value) return domains.value;
  return domains.value.filter(d => 
    d.domain.toLowerCase().includes(domainSearch.value.toLowerCase()) ||
    d.paths.some(p => p.path.toLowerCase().includes(domainSearch.value.toLowerCase()))
  );
});

const recordEnabled = ref(false);
const mockEnabled = ref(false);
const recordedData = ref<RecordedData>({});
const selectedKey = ref('');
const editJson = ref('');
// 防止死循环的标志
const isLoadingSettings = ref(false);
// 路径输入框引用
const pathInputRefs = ref<Record<string, HTMLInputElement>>({});

// 加载设置
const loadSettings = () => {
  isLoadingSettings.value = true;
  chrome.storage.local.get(['domains', 'recordEnabled', 'mockEnabled', 'recordedData'], (result: StorageResult) => {
    domains.value = result.domains ? JSON.parse(result.domains as string) : [];
    recordEnabled.value = typeof result.recordEnabled === 'boolean' ? result.recordEnabled : false;
    mockEnabled.value = typeof result.mockEnabled === 'boolean' ? result.mockEnabled : false;
    recordedData.value = result.recordedData ? JSON.parse(result.recordedData as string) : {} as RecordedData;
    
    mockLogger.log('加载设置完成:', {
      domains: domains.value,
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
  chrome.storage.local.set({
    domains: JSON.stringify(domains.value),
    recordEnabled: recordEnabled.value,
    mockEnabled: mockEnabled.value,
    recordedData: JSON.stringify(recordedData.value)
  }, () => {
    // mockLogger.log('设置保存完成');
  });
};

// 域名管理
const addDomain = () => {
  mockLogger.log('=== 点击添加域名按钮 ===');
  mockLogger.log('添加域名前:', domains.value, '新域名:', newDomain.value);
  if (newDomain.value && !domains.value.some(d => d.domain === newDomain.value)) {
    domains.value.push({
      domain: newDomain.value,
      expanded: true,
      paths: []
    });
    mockLogger.log('添加域名后:', domains.value);
    newDomain.value = '';
    saveSettings();
  } else {
    mockLogger.log('添加域名条件不满足:', { newDomain: newDomain.value, isExists: domains.value.some(d => d.domain === newDomain.value) });
  }
};

const removeDomain = (domain: string) => {
  mockLogger.log('=== 点击删除域名按钮 ===');
  mockLogger.log('删除域名:', domain, '删除前:', domains.value.map(d => d.domain));
  domains.value = domains.value.filter(d => d.domain !== domain);
  mockLogger.log('删除域名后:', domains.value.map(d => d.domain));
  saveSettings();
};

const toggleDomain = (domainItem: DomainItem) => {
  domainItem.expanded = !domainItem.expanded;
  saveSettings();
};

// 路径管理（在指定域名下添加路径）
const addPath = (domainItem: DomainItem, newPathValue: string) => {
  if (newPathValue && !domainItem.paths.some(p => p.path === newPathValue)) {
    domainItem.paths.push({ path: newPathValue, recordEnabled: true, mockEnabled: true });
    saveSettings();
    return true;
  } else {
    mockLogger.log('添加路径条件不满足:', { newPath: newPathValue, isExists: domainItem.paths.some(p => p.path === newPathValue) });
    return false;
  }
};

const removePath = (domainItem: DomainItem, path: string) => {
  mockLogger.log('=== 点击删除路径按钮 ===');
  mockLogger.log('删除路径:', path, '删除前:', domainItem.paths.map(p => p.path));
  domainItem.paths = domainItem.paths.filter(p => p.path !== path);
  mockLogger.log('删除路径后:', domainItem.paths.map(p => p.path));
  saveSettings();
};

const onPathRecordEnabledChange = (path: PathItem) => {
  mockLogger.log('=== 路径数据记录开关状态变化 ===', path);
  saveSettings();
};

const onPathMockEnabledChange = (path: PathItem) => {
  saveSettings();
};

// 处理路径添加（通过回车键）
const handleAddPath = (domainItem: DomainItem, event: KeyboardEvent) => {
  const input = event.target as HTMLInputElement;
  const value = input.value.trim();
  if (addPath(domainItem, value)) {
    input.value = '';
  }
};

// 处理路径添加（通过按钮）
const handleAddPathByButton = (domainItem: DomainItem) => {
  const input = pathInputRefs.value[domainItem.domain];
  if (input) {
    const value = input.value.trim();
    if (addPath(domainItem, value)) {
      input.value = '';
    }
  }
};

// 数据管理
const selectData = (key: string) => {
  selectedKey.value = key;
  const data = recordedData.value[key];
  if (data) {
    editJson.value = JSON.stringify(data.response, null, 2);
  } else {
    mockLogger.log('未找到数据:', key);
  }
};

const formatJson = () => {
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
    chrome.storage.local.set({ recordedData: JSON.stringify(recordedData.value) }, () => {
      mockLogger.log('Mock 数据保存成功', rerecordedData.value);
      alert('保存成功');
    });
  } catch (e) {
    mockLogger.error('Mock 数据保存失败:', e);
    alert('无效的 JSON 格式');
  }
};

// 监听存储变化
chrome.storage.onChanged.addListener((changes: StorageChanges, namespace: string) => {
  // 重新加载所有设置，确保与存储保持同步
  loadSettings();
});

// 初始化
onMounted(() => {
  loadSettings();
});

// 监听开关状态变化
const onRecordEnabledChange = () => {
  saveSettings();
};

const onMockEnabledChange = () => {
  saveSettings();
};
</script>

<template>
  <div class="app-container">
    <h1 class="app-title">Mock Data Tool</h1>
    
    <!-- 功能开关 -->
    <div class="feature-card header-switches">
      <div class="switch-row">
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

    <!-- 功能区 -->
    <div class="features-grid">
      <!-- 域名管理（可折叠） -->
      <div class="feature-card">
        <div class="feature-header">
          <h2 class="feature-title">域名管理</h2>
          <input 
            v-model="domainSearch" 
            type="text" 
            placeholder="搜索域名或路径..." 
            class="search-input"
          />
        </div>
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
            v-for="domainItem in filteredDomains" 
            :key="domainItem.domain"
            class="domain-card"
          >
            <!-- 域名头部（可折叠） -->
            <div class="domain-header" @click="toggleDomain(domainItem)">
              <div class="domain-header-left">
                <span class="expand-icon" :class="{ expanded: domainItem.expanded }">▶</span>
                <span class="domain-name" :title="domainItem.domain">{{ domainItem.domain }}</span>
                <span class="path-count">({{ domainItem.paths.length }} 条路径)</span>
              </div>
              <button @click.stop="removeDomain(domainItem.domain)" class="remove-btn">删除</button>
            </div>
            
            <!-- 路径列表（展开时显示） -->
            <div v-if="domainItem.expanded" class="paths-container">
              <!-- 添加路径输入框 -->
              <div class="path-input-group">
                <input 
                  :ref="el => { if (el) pathInputRefs[domainItem.domain] = el }"
                  type="text" 
                  placeholder="输入路径 (e.g., /api/data)" 
                  class="text-input path-input"
                  @keyup.enter="handleAddPath(domainItem, $event)"
                />
                <button @click="handleAddPathByButton(domainItem)" class="add-btn small">添加</button>
              </div>
              
              <!-- 路径列表 -->
              <div class="path-list">
                <div 
                  v-for="pathItem in domainItem.paths" 
                  :key="pathItem.path"
                  class="path-item"
                >
                  <span class="path-name" :title="pathItem.path">{{ pathItem.path }}</span>
                  <div class="path-controls">
                    <label class="path-switch-label">
                      <span class="path-switch-text">记录</span>
                      <input 
                        v-model="pathItem.recordEnabled" 
                        type="checkbox" 
                        class="toggle-switch"
                        @change="onPathRecordEnabledChange(pathItem)"
                      />
                      <span class="toggle-slider small"></span>
                    </label>
                    <label class="path-switch-label">
                      <span class="path-switch-text">拦截</span>
                      <input 
                        v-model="pathItem.mockEnabled" 
                        type="checkbox" 
                        class="toggle-switch"
                        @change="onPathMockEnabledChange(pathItem)"
                      />
                      <span class="toggle-slider small"></span>
                    </label>
                    <button @click="removePath(domainItem, pathItem.path)" class="remove-btn small">删除</button>
                  </div>
                </div>
                <div v-if="domainItem.paths.length === 0" class="empty-paths">
                  暂无路径，请添加
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 数据管理 -->
    <div class="feature-card full-width">
      <h2 class="feature-title">数据管理</h2>
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
  width: 500px;
  /* height: 1200px; */
  /* margin: 5vh auto; */
  padding: 30px;
  background-color: #1a1a1a;
  color: #ffffff;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  overflow: auto;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

/* 标题样式 */
.app-title {
  margin: 0 0 25px 0;
  font-size: 28px;
  font-weight: bold;
  color: #3498db;
  text-align: center;
}

/* 顶部开关 */
.header-switches {
  margin-bottom: 25px;
  border-bottom: 2px solid #3498db;
}

.switch-row {
  display: flex;
  justify-content: space-around;
  align-items: center;
  gap: 40px;
}

.feature-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.search-input {
  width: 150px;
  padding: 6px 12px;
  background-color: #3d3d3d;
  border: 1px solid #555;
  border-radius: 20px;
  color: #ffffff;
  font-size: 12px;
}

.search-input:focus {
  outline: none;
  border-color: #3498db;
}

/* 功能卡片 */
.features-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 25px;
  margin-bottom: 25px;
}

.feature-card {
  background-color: #242424;
  border-radius: 10px;
  padding: 20px;
  border: 1px solid #333;
  transition: all 0.3s ease;
}

.feature-card:hover {
  border-color: #444;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.feature-card.full-width {
  grid-column: 1 / -1;
}

.feature-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #3498db;
}

/* 输入组 */
.input-group {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.text-input {
  flex: 1;
  padding: 12px;
  background-color: #2d2d2d;
  border: 1px solid #444;
  border-radius: 6px;
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
  padding: 10px 18px;
  border: none;
  border-radius: 6px;
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
  transform: translateY(-1px);
}

.remove-btn {
  background-color: rgba(231, 76, 60, 0.1);
  color: #e74c3c;
  border: 1px solid rgba(231, 76, 60, 0.3);
  padding: 6px 12px;
  font-size: 12px;
}

.remove-btn:hover {
  background-color: #e74c3c;
  color: white;
}

.add-btn.small, .remove-btn.small {
  padding: 6px 12px;
  font-size: 12px;
}

.control-btn {
  background-color: #444;
  color: #eee;
}

.control-btn:hover {
  background-color: #555;
}

.save-btn {
  background-color: #27ae60;
  color: white;
  margin-top: 15px;
  width: 100%;
  font-weight: 600;
  letter-spacing: 1px;
}

.save-btn:hover {
  background-color: #2ecc71;
  box-shadow: 0 4px 12px rgba(46, 204, 113, 0.3);
}

/* 列表样式 */
.domain-list {
  max-height: 450px;
  overflow-y: auto;
  padding-right: 5px;
}

.domain-card {
  background-color: #2d2d2d;
  border: 1px solid #333;
  border-radius: 8px;
  margin-bottom: 10px;
  overflow: hidden;
  transition: all 0.2s ease;
}

.domain-card:hover {
  border-color: #444;
}

.domain-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.domain-header:hover {
  background-color: #333;
}

.domain-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.expand-icon {
  font-size: 10px;
  color: #888;
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

.domain-name {
  font-size: 14px;
  font-weight: 500;
  color: #eee;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.path-count {
  font-size: 12px;
  color: #888;
  flex-shrink: 0;
}

.paths-container {
  padding: 0 15px 15px 15px;
  border-top: 1px solid #3d3d3d;
  background-color: #262626;
}

.path-input-group {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  margin-bottom: 12px;
}

.path-input {
  flex: 1;
  padding: 8px 12px;
  font-size: 13px;
}

.path-list {
  max-height: 200px;
  overflow-y: auto;
}

.path-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background-color: #2d2d2d;
  border: 1px solid #3d3d3d;
  border-radius: 6px;
  margin-bottom: 8px;
  transition: all 0.2s ease;
}

.path-item:hover {
  background-color: #333;
  border-color: #444;
}

.path-name {
  font-size: 13px;
  font-weight: 500;
  color: #ddd;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 10px;
}

.path-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.empty-paths {
  text-align: center;
  color: #666;
  font-size: 13px;
  padding: 20px;
}

.domain-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  background-color: #2d2d2d;
  border: 1px solid #333;
  border-radius: 8px;
  margin-bottom: 10px;
  transition: all 0.2s ease;
}

.domain-item:hover {
  background-color: #333;
  border-color: #444;
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
  margin: 0;
}

.switch-label {
  display: flex;
  align-items: center;
  gap: 15px;
  cursor: pointer;
}

.switch-text {
  font-size: 16px;
  font-weight: 500;
  color: #ddd;
}

.toggle-switch {
  display: none;
}

.toggle-slider {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 22px;
  background-color: #444;
  border-radius: 22px;
  transition: all 0.3s ease;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
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
  transform: translateX(22px);
}

.toggle-slider.small {
  width: 36px;
  height: 18px;
}

.toggle-slider.small:before {
  height: 12px;
  width: 12px;
  left: 3px;
  bottom: 3px;
}

.toggle-switch:checked + .toggle-slider.small:before {
  transform: translateX(18px);
}

/* 数据管理样式 */
.data-management {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 25px;
  height: 400px;
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
