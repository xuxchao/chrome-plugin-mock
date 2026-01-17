document.addEventListener('DOMContentLoaded', function() {
  const ruleIdInput = document.getElementById('rule-id');
  const urlFilterInput = document.getElementById('url-filter');
  const redirectUrlInput = document.getElementById('redirect-url');
  const rulesContent = document.getElementById('rules-content');
  const statusDiv = document.getElementById('status');
  
  const addBtn = document.getElementById('add-btn');
  const removeBtn = document.getElementById('remove-btn');
  const clearBtn = document.getElementById('clear-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
    setTimeout(() => {
      statusDiv.className = 'status';
    }, 3000);
  }
  
  async function sendMessageToBackground(message) {
    try {
      const response = await chrome.runtime.sendMessage(message);
      return response;
    } catch (error) {
      console.error('发送消息失败:', error);
      return { success: false, error: error.message };
    }
  }
  
  async function loadCurrentRules() {
    const response = await sendMessageToBackground({ type: 'GET_RULES' });
    
    if (response.success && response.rules) {
      if (response.rules.length === 0) {
        rulesContent.textContent = '当前没有规则';
      } else {
        rulesContent.textContent = JSON.stringify(response.rules, null, 2);
      }
    } else {
      rulesContent.textContent = '获取规则失败: ' + (response.error || '未知错误');
    }
  }
  
  async function addRule() {
    const ruleId = parseInt(ruleIdInput.value);
    const urlFilter = urlFilterInput.value.trim();
    const redirectUrl = redirectUrlInput.value.trim();
    
    if (!ruleId || ruleId < 1) {
      showStatus('请输入有效的规则 ID', 'error');
      return;
    }
    
    if (!urlFilter) {
      showStatus('请输入 URL 过滤条件', 'error');
      return;
    }
    
    const rule = {
      id: ruleId,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: {
          url: redirectUrl || 'data:application/json,{}'
        }
      },
      condition: {
        urlFilter: urlFilter,
        resourceTypes: ['main_frame', 'xmlhttprequest', 'script']
      }
    };
    
    addBtn.disabled = true;
    addBtn.textContent = '添加中...';
    
    const response = await sendMessageToBackground({
      type: 'ADD_RULES',
      rules: [rule]
    });
    
    addBtn.disabled = false;
    addBtn.textContent = '添加规则';
    
    if (response.success) {
      showStatus('规则添加成功 (ID: ' + ruleId + ')', 'success');
      loadCurrentRules();
    } else {
      showStatus('规则添加失败: ' + response.error, 'error');
    }
  }
  
  async function removeRule() {
    const ruleId = parseInt(ruleIdInput.value);
    
    if (!ruleId || ruleId < 1) {
      showStatus('请输入有效的规则 ID', 'error');
      return;
    }
    
    removeBtn.disabled = true;
    removeBtn.textContent = '删除中...';
    
    const response = await sendMessageToBackground({
      type: 'REMOVE_RULES',
      ruleIds: [ruleId]
    });
    
    removeBtn.disabled = false;
    removeBtn.textContent = '删除规则';
    
    if (response.success) {
      showStatus('规则删除成功 (ID: ' + ruleId + ')', 'success');
      loadCurrentRules();
    } else {
      showStatus('规则删除失败: ' + response.error, 'error');
    }
  }
  
  async function clearAllRules() {
    if (!confirm('确定要清除所有规则吗？此操作不可撤销。')) {
      return;
    }
    
    clearBtn.disabled = true;
    clearBtn.textContent = '清除中...';
    
    const response = await sendMessageToBackground({ type: 'CLEAR_ALL_RULES' });
    
    clearBtn.disabled = false;
    clearBtn.textContent = '清除所有规则';
    
    if (response.success) {
      showStatus('所有规则已清除', 'success');
      loadCurrentRules();
    } else {
      showStatus('清除规则失败: ' + response.error, 'error');
    }
  }
  
  addBtn.addEventListener('click', addRule);
  removeBtn.addEventListener('click', removeRule);
  clearBtn.addEventListener('click', clearAllRules);
  refreshBtn.addEventListener('click', loadCurrentRules);
  
  loadCurrentRules();
});
