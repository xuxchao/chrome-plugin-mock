const MOCK_RULES = [
  {
    id: 1002,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'data:application/json,[{"userId":1,"id":1,"title":"你好","body":"不缘"}]'
      }
    },
    condition: {
      urlFilter: 'https://jsonplaceholder.typicode.com/posts?_limit=2',
      resourceTypes: ['main_frame', 'xmlhttprequest', 'script']
    }
  }
];

const now = new Date();
const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
console.log('加载', timestamp);

function addMockRules(rules) {
  return chrome.declarativeNetRequest.updateDynamicRules({
    addRules: rules,
    removeRuleIds: rules.map(r => r.id)
  });
}

function removeMockRules(ruleIds) {
  return chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: ruleIds
  });
}

function getCurrentRules() {
  return chrome.declarativeNetRequest.getDynamicRules();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('收到消息:', message);

  switch (message.type) {
    case 'ADD_RULES':
      addMockRules(message.rules)
        .then(() => {
          console.log('规则添加成功');
          sendResponse({ success: true });
        })
        .catch((err) => {
          console.error('规则添加失败:', err);
          sendResponse({ success: false, error: err.message });
        });
      return true;

    case 'REMOVE_RULES':
      removeMockRules(message.ruleIds)
        .then(() => {
          console.log('规则删除成功');
          sendResponse({ success: true });
        })
        .catch((err) => {
          console.error('规则删除失败:', err);
          sendResponse({ success: false, error: err.message });
        });
      return true;

    case 'GET_RULES':
      getCurrentRules()
        .then((rules) => {
          console.log('当前规则:', rules);
          sendResponse({ success: true, rules });
        })
        .catch((err) => {
          console.error('获取规则失败:', err);
          sendResponse({ success: false, error: err.message });
        });
      return true;

    case 'CLEAR_ALL_RULES':
      getCurrentRules()
        .then((rules) => {
          const ruleIds = rules.map(r => r.id);
          if (ruleIds.length > 0) {
            return removeMockRules(ruleIds);
          }
        })
        .then(() => {
          console.log('所有规则已清除');
          sendResponse({ success: true });
        })
        .catch((err) => {
          console.error('清除规则失败:', err);
          sendResponse({ success: false, error: err.message });
        });
      return true;

    default:
      sendResponse({ success: false, error: '未知消息类型' });
      return false;
  }
});

addMockRules(MOCK_RULES)
  .then(() => {
    console.log('动态规则添加成功！');
  })
  .catch((err) => {
    console.error('动态规则添加失败：', err);
  });