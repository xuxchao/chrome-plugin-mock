1. 在 packages 目录下创建新的项目目录 `chrome-extension-communication`
2. 创建 manifest.json 配置文件，包含所有必要的权限和组件
3. 实现 background.js，处理各种通讯逻辑
4. 实现 content.js，用于页面内容脚本
5. 实现 popup.html 和 popup.js，创建弹出页面演示通讯
6. 实现 devtools.html 和 devtools.js，创建开发者工具演示通讯
7. 实现 inject.js，用于页面注入脚本演示与页面脚本的通讯
8. 实现各种通讯方式的示例：

   * chrome.runtime.sendMessage / onMessage（短连接）

   * chrome.tabs.sendMessage / onMessage（短连接）

   * chrome.runtime.connect / onConnect（长连接）

   * chrome.tabs.connect / onConnect（长连接）

   * postMessage（content script 与页面脚本）

   * chrome.runtime.getBackgroundPage（popup 访问 background）

   * chrome.extension.getViews（获取其他页面实例）

   * chrome.devtools.\* API（devtools 通讯）
9. 创建简单的 UI 界面，用于演示和测试各种通讯方式
   1

