// 基金管理页面脚本

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  loadFundList();
  
  // 绑定导入导出按钮事件
  document.getElementById('exportBtn').addEventListener('click', exportConfig);
  document.getElementById('importBtn').addEventListener('click', importConfig);
  document.getElementById('importFile').addEventListener('change', handleImportFile);
  
  // 绑定按钮事件
  document.getElementById('addFundBtn').addEventListener('click', addFund);
  document.getElementById('fundCodeInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addFund();
    }
  });
  
  // 初始化刷新和关闭按钮
  document.getElementById('refreshBtn').addEventListener('click', () => {
    location.reload();
  });
  
  document.getElementById('closeBtn').addEventListener('click', () => {
    window.close();
  });
});

// 加载当前基金列表
async function loadFundList() {
  const fundListEl = document.getElementById('fundList');
  
  try {
    // 获取当前监控的基金
    const result = await chrome.storage.local.get(['customFunds', 'fundNames']);
    const customFunds = result.customFunds || [];
    const fundNames = result.fundNames || {};
    
    // 使用自定义基金列表，无默认基金
    const funds = customFunds;
    
    // 渲染基金列表
    renderFundList(funds, fundNames);
    
  } catch (error) {
    fundListEl.innerHTML = `
      <div class="error">加载基金列表失败: ${error.message}</div>
    `;
  }
}

// 渲染基金列表
function renderFundList(funds, fundNames) {
  const fundListEl = document.getElementById('fundList');
  
  if (funds.length === 0) {
    fundListEl.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <h3>暂无监控基金</h3>
        <p>点击上方添加新基金开始监控</p>
      </div>
    `;
    return;
  }
  
  let html = '<style>.fund-item { background: #f8f9fa; border-radius: 8px; padding: 15px; display: flex; flex-direction: column; gap: 10px; transition: background-color 0.3s ease; } .fund-item:hover { background-color: #e9ecef; } .fund-actions { display: flex; gap: 8px; justify-content: flex-end; } .fund-actions .btn { flex: 1; min-width: 80px; }</style><div class="fund-list">';
  
  funds.forEach(fundCode => {
    const fundName = fundNames[fundCode] || `基金(${fundCode})`;
    
    html += `
      <div class="fund-item" data-code="${fundCode}">
        <div class="fund-info">
          <div class="fund-code">${fundCode}</div>
          <div class="fund-name">${fundName}</div>
        </div>
        <div class="fund-actions">
          <button class="btn btn-secondary edit-btn" data-code="${fundCode}" data-name="${fundName.replace(/"/g, '&quot;')}">
            ✏️ 编辑
          </button>
          <button class="btn btn-danger delete-btn" data-code="${fundCode}">
            🗑️ 删除
          </button>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  fundListEl.innerHTML = html;
  
  // 绑定事件监听器
  bindFundActions();
}

// 绑定基金操作事件
function bindFundActions() {
  // 绑定编辑按钮事件
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const fundCode = e.target.dataset.code;
      const fundName = e.target.dataset.name;
      editFundName(fundCode, fundName);
    });
  });
  
  // 绑定删除按钮事件
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const fundCode = e.target.dataset.code;
      removeFund(fundCode);
    });
  });
}

// 编辑基金名称
function editFundName(fundCode, currentName) {
  const newName = prompt('请输入新的基金名称:', currentName);
  
  if (newName === null) {
    return; // 用户取消
  }
  
  const trimmedName = newName.trim();
  
  if (!trimmedName) {
    alert('基金名称不能为空');
    return;
  }
  
  if (trimmedName === currentName) {
    return; // 名称未改变
  }
  
  // 更新基金名称
  updateFundName(fundCode, trimmedName);
}

// 更新基金名称到本地存储
async function updateFundName(fundCode, newName) {
  try {
    const result = await chrome.storage.local.get('fundNames');
    const fundNames = result.fundNames || {};
    
    fundNames[fundCode] = newName;
    
    await chrome.storage.local.set({
      fundNames: fundNames
    });
    
    // 刷新列表
    await loadFundList();
    
    showMessage(`基金名称已更新为: ${newName}`, 'success');
    
  } catch (error) {
    showMessage(`更新基金名称失败: ${error.message}`, 'error');
  }
}

// 添加新基金
async function addFund() {
  const fundCodeInput = document.getElementById('fundCodeInput');
  const fundCode = fundCodeInput.value.trim();
  const searchResultEl = document.getElementById('searchResult');
  
  if (!fundCode || fundCode.length !== 6 || isNaN(fundCode)) {
    searchResultEl.innerHTML = '<div class="error">请输入有效的6位基金代码</div>';
    return;
  }
  
  searchResultEl.innerHTML = '<div class="loading">正在搜索基金...</div>';
  
  try {
    // 搜索基金信息
    const fundInfo = await searchFundInfo(fundCode);
    
    console.log('获取到的基金信息:', fundInfo);
    
    if (fundInfo) {
      // 使用事件委托代替内联onclick，避免特殊字符问题
      searchResultEl.innerHTML = `
        <div class="success">
          <strong>找到基金:</strong> ${fundInfo.name} (${fundCode})
          <button class="btn btn-primary confirm-add-btn" data-code="${fundCode}" data-name="${fundInfo.name}" style="margin-left: 10px; padding: 6px 12px; font-size: 12px;">
            ✅ 确认添加
          </button>
        </div>
      `;
      
    } else {
      // 如果未找到，尝试直接使用代码作为名称添加
      searchResultEl.innerHTML = `
        <div class="error">
          <strong>未找到该基金</strong>，请检查基金代码是否正确
          <button class="btn btn-secondary confirm-add-code-btn" data-code="${fundCode}" style="margin-left: 10px; padding: 6px 12px; font-size: 12px;">
            📝 仅添加代码
          </button>
        </div>
      `;
    }
    
  } catch (error) {
    console.error('添加基金时发生错误:', error);
    // 如果发生异常，尝试直接使用代码作为名称添加
    searchResultEl.innerHTML = `
      <div class="error">
        <strong>搜索失败:</strong> ${error.message}
        <button class="btn btn-secondary confirm-add-code-btn" data-code="${fundCode}" style="margin-left: 10px; padding: 6px 12px; font-size: 12px;">
          📝 仅添加代码
        </button>
      </div>
    `;
  }
}

// 页面加载时绑定事件委托
document.addEventListener('DOMContentLoaded', () => {
  // 为确认添加按钮绑定事件委托
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('confirm-add-btn')) {
      const fundCode = e.target.dataset.code;
      const fundName = e.target.dataset.name;
      confirmAddFund(fundCode, fundName);
    } else if (e.target.classList.contains('confirm-add-code-btn')) {
      const fundCode = e.target.dataset.code;
      confirmAddFundWithCode(fundCode);
    }
  });
});

// 仅使用代码添加基金
async function confirmAddFundWithCode(fundCode) {
  try {
    const fundName = `基金(${fundCode})`;
    const success = await addFundToStorage(fundCode, fundName);
    
    if (success) {
      // 刷新列表
      await loadFundList();
      
      // 清空输入
      document.getElementById('fundCodeInput').value = '';
      document.getElementById('searchResult').innerHTML = '';
      
      showMessage(`成功添加基金: ${fundCode}`, 'success');
    }
    
  } catch (error) {
    showMessage(`添加基金失败: ${error.message}`, 'error');
  }
}

// 搜索基金信息
async function searchFundInfo(fundCode) {
  try {
    // 搜索基金信息
    const response = await chrome.runtime.sendMessage({ action: 'searchFundInfo', fundCode: fundCode });
    
    console.log('后台搜索响应:', response);
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    if (response.fundInfo) {
      console.log('找到基金信息:', response.fundInfo);
      return response.fundInfo;
    }
    
    return null;
  } catch (error) {
    console.error('搜索基金失败:', error);
    throw error;
  }
}

// 公共添加基金到存储函数
async function addFundToStorage(fundCode, fundName) {
  const result = await chrome.storage.local.get(['customFunds', 'fundNames']);
  const customFunds = result.customFunds || [];
  const fundNames = result.fundNames || {};

  // 检查基金是否已存在
  if (customFunds.includes(fundCode)) {
    showMessage('该基金已在监控列表中', 'error');
    return false;
  }

  // 验证基金名称
  const trimmedName = fundName.trim();
  if (!trimmedName) {
    showMessage('基金名称不能为空', 'error');
    return false;
  }

  // 添加基金信息
  customFunds.push(fundCode);
  fundNames[fundCode] = trimmedName;

  // 保存到本地存储
  await chrome.storage.local.set({
    customFunds: customFunds,
    fundNames: fundNames
  });

  // 通知后台更新基金列表
  await chrome.runtime.sendMessage({ action: 'updateFunds' });
  return true;
}

// 确认添加基金
async function confirmAddFund(fundCode, fundName) {
  console.log(`开始添加基金: ${fundCode} - ${fundName}`);
  
  try {
    const success = await addFundToStorage(fundCode, fundName);
    if (!success) return;
    
    console.log('基金已保存到本地存储');
    console.log('已通知后台更新');
    
    // 刷新列表
    await loadFundList();
    
    // 清空输入
    document.getElementById('fundCodeInput').value = '';
    document.getElementById('searchResult').innerHTML = '';
    
    showMessage(`成功添加基金: ${fundName.trim()}`, 'success');
    
  } catch (error) {
    console.error('添加基金失败:', error);
    showMessage(`添加基金失败: ${error.message}`, 'error');
  }
}

// 删除基金
async function removeFund(fundCode) {
  if (!confirm(`确定要删除基金 ${fundCode} 吗？`)) {
    return;
  }
  
  try {
    // 获取当前自定义基金
    const result = await chrome.storage.local.get(['customFunds', 'fundNames']);
    let customFunds = result.customFunds || [];
    const fundNames = result.fundNames || {};
    
    // 过滤掉要删除的基金
    customFunds = customFunds.filter(code => code !== fundCode);
    
    // 保存到本地存储
    await chrome.storage.local.set({
      customFunds: customFunds
    });
    
    // 通知后台更新
    await chrome.runtime.sendMessage({ action: 'updateFunds' });
    
    // 刷新列表
    await loadFundList();
    
    showMessage(`成功删除基金 ${fundCode}`, 'success');
    
  } catch (error) {
    showMessage(`删除基金失败: ${error.message}`, 'error');
  }
}

// 显示消息
function showMessage(message, type) {
  const searchResultEl = document.getElementById('searchResult');
  const className = type === 'success' ? 'success' : 'error';
  
  searchResultEl.innerHTML = `<div class="${className}">${message}</div>`;
  
  // 3秒后自动清除
  setTimeout(() => {
    searchResultEl.innerHTML = '';
  }, 3000);
}

// 返回主页
function backToDashboard() {
  window.location.href = 'dashboard.html';
}

// 导出配置
function exportConfig() {
  // 获取所有基金相关数据，包括历史记录
  chrome.storage.local.get(null, (result) => {
    // 获取完整的基金列表，合并所有可能的存储键
    let allFunds = [];
    
    // 收集所有不同来源的基金
    if (result.funds && Array.isArray(result.funds)) {
      allFunds = [...allFunds, ...result.funds];
    }
    if (result.customFunds && Array.isArray(result.customFunds)) {
      allFunds = [...allFunds, ...result.customFunds];
    }
    
    // 去重并保持顺序
    const uniqueFunds = [...new Set(allFunds)];
    const fundNames = result.fundNames || {};
    
    // 收集所有基金的历史记录
    const historyData = {};
    uniqueFunds.forEach(fundCode => {
      const historyKey = `${fundCode}_history`;
      if (result[historyKey]) {
        historyData[historyKey] = result[historyKey];
      }
    });
    
    // 确保导出所有用户添加的基金，包括没有自定义名称的
    const config = {
      version: '1.1', // 版本升级以包含历史记录
      timestamp: new Date().toISOString(),
      funds: uniqueFunds,
      fundNames: fundNames,
      history: historyData // 包含历史记录
    };
    
    console.log('导出的配置:', config); // 调试日志
    console.log('原始存储数据:', result); // 调试日志
    console.log('去重后的基金列表:', uniqueFunds); // 调试日志
    console.log('导出的历史记录数量:', Object.keys(historyData).length); // 调试日志
    
    const jsonString = JSON.stringify(config, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `ttjj-config-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showMessage('配置已导出，共' + uniqueFunds.length + '只基金和' + Object.keys(historyData).length + '条历史记录', 'success');
  });
}

// 导入配置
function importConfig() {
  document.getElementById('importFile').click();
}

// 处理导入文件
function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const config = JSON.parse(e.target.result);
      
      console.log('导入的配置:', config); // 调试日志
      
      // 验证配置格式
      if (!config.funds || !Array.isArray(config.funds)) {
        throw new Error('无效的配置格式');
      }
      
      // 确认覆盖
      const message = config.history && Object.keys(config.history).length > 0 
        ? '导入配置会覆盖当前所有基金设置和历史记录，确定继续吗？'
        : '导入配置会覆盖当前所有基金设置，确定继续吗？';
      
      if (!confirm(message)) {
        return;
      }
      
      // 准备要保存的数据
      const saveData = {
        funds: config.funds,
        customFunds: config.funds, // 兼容旧版本
        fundNames: config.fundNames || {}
      };
      
      // 如果有历史记录，也导入
      if (config.history && typeof config.history === 'object') {
        Object.assign(saveData, config.history);
      }
      
      // 保存配置
      chrome.storage.local.set(saveData, () => {
        const historyCount = config.history ? Object.keys(config.history).length : 0;
        const message = historyCount > 0
          ? `配置导入成功，共${config.funds.length}只基金和${historyCount}条历史记录`
          : `配置导入成功，共${config.funds.length}只基金`;
        showMessage(message, 'success');
        // 刷新基金列表
        loadFundList();
        
        // 通知background更新基金列表
        chrome.runtime.sendMessage({ 
          action: 'updateFunds', 
          funds: config.funds 
        });
      });
      
    } catch (error) {
      console.error('导入错误:', error); // 调试日志
      showMessage('导入失败：' + error.message, 'error');
    }
  };
  reader.readAsText(file);
  
  // 重置文件输入
  event.target.value = '';
}