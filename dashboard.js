// 基金代码与名称映射（默认值，实际会从本地存储获取）
// 实际使用的基金名称映射（会从本地存储动态加载）
let FUND_NAMES = {};

// 自动刷新功能已移除
const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000; // 5分钟

// 排序状态
let sortConfig = {
  type: 'default',
  ascending: true
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
  // 加载基金名称映射
  await loadFundNames();
  
  loadFundLimits();
  
  // 绑定排序控件事件
  document.getElementById('sortSelect').addEventListener('change', onSortChange);
  document.getElementById('sortAscBtn').addEventListener('click', () => setSortOrder(true));
  document.getElementById('sortDescBtn').addEventListener('click', () => setSortOrder(false));
  
  // 初始化历史记录提示框
  initHistoryTooltip();
  
  // 绑定按钮事件
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadFundLimits);
  }
  
  const checkNowBtn = document.getElementById('checkNowBtn');
  if (checkNowBtn) {
    checkNowBtn.addEventListener('click', checkNow);
  }
  
  const openPopupBtn = document.getElementById('openPopupBtn');
  if (openPopupBtn) {
    openPopupBtn.addEventListener('click', () => {
      // 打开扩展弹出窗口（实际上新标签页无法直接打开弹出窗口，这里改为打开popup.html）
      window.open('popup.html', '_blank', 'width=600,height=600');
    });
  }
  
  const manageFundsBtn = document.getElementById('manageFundsBtn');
  if (manageFundsBtn) {
    manageFundsBtn.addEventListener('click', openManagePage);
  }
  
  // 自动刷新功能已移除
});

// 排序方式改变
function onSortChange() {
  sortConfig.type = document.getElementById('sortSelect').value;
  loadFundLimits(); // 重新加载数据以应用排序
}

// 设置排序顺序
function setSortOrder(ascending) {
  sortConfig.ascending = ascending;
  // 更新按钮状态
  document.getElementById('sortAscBtn').classList.toggle('active', ascending);
  document.getElementById('sortDescBtn').classList.toggle('active', !ascending);
  loadFundLimits(); // 重新加载数据以应用排序
}

// 排序基金数据
function sortFunds(fundData) {
  const fundEntries = Object.entries(fundData);
  
  switch (sortConfig.type) {
    case 'code':
      // 按基金代码排序
      fundEntries.sort((a, b) => {
        const codeA = a[0];
        const codeB = b[0];
        return sortConfig.ascending ? codeA.localeCompare(codeB) : codeB.localeCompare(codeA);
      });
      break;
      
    case 'name':
      // 按基金名称排序
      fundEntries.sort((a, b) => {
        const nameA = FUND_NAMES[a[0]] || a[0];
        const nameB = FUND_NAMES[b[0]] || b[0];
        return sortConfig.ascending ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      });
      break;
      
    case 'status':
      // 按限购状态排序（暂停申购 > 限额申购 > 开放申购 > 无数据）
      fundEntries.sort((a, b) => {
        const dataA = a[1];
        const dataB = b[1];
        
        // 定义优先级：暂停申购(0) > 限额申购(1) > 开放申购(2) > 无数据(3)
        const getPriority = (data) => {
          if (!data) return 3;
          if (data.limitAmount === 0) return 0; // 暂停申购
          if (data.hasLimit) return 1; // 限额申购
          return 2; // 开放申购
        };
        
        const priorityA = getPriority(dataA);
        const priorityB = getPriority(dataB);
        
        if (priorityA !== priorityB) {
          return sortConfig.ascending ? priorityA - priorityB : priorityB - priorityA;
        }
        
        // 优先级相同的情况下，限额申购按金额从小到大排序，其他按代码排序
        if (priorityA === 1 && priorityB === 1) {
          // 都是限额申购，按限额金额从小到大排序
          const amountA = dataA.limitAmount || Infinity;
          const amountB = dataB.limitAmount || Infinity;
          return sortConfig.ascending ? amountA - amountB : amountB - amountA;
        }
        
        // 其他情况按基金代码排序
        const codeA = a[0];
        const codeB = b[0];
        return sortConfig.ascending ? codeA.localeCompare(codeB) : codeB.localeCompare(codeA);
      });
      break;
      
    default:
      // 默认顺序（添加时间）
      break;
  }
  
  return fundEntries;
}

// 初始化历史记录提示框
function initHistoryTooltip() {
  const tooltip = document.getElementById('historyTooltip');
  
  // 点击页面其他地方关闭提示框
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.fund-card') && !e.target.closest('.history-tooltip')) {
      tooltip.classList.remove('show');
    }
  });
  
  // 鼠标移出页面关闭提示框
  document.addEventListener('mouseleave', () => {
    tooltip.classList.remove('show');
  });
}

// 在新标签页显示历史记录
async function openHistoryInNewTab(fundCode) {
  const result = await chrome.storage.local.get([`${fundCode}_history`, fundCode]);
  const historyData = result[`${fundCode}_history`] || [];
  const currentData = result[fundCode];
  
  // 获取基金名称
  let fundName = FUND_NAMES[fundCode] || fundCode;
  
  // 构建历史记录HTML
  let historyHtml = '';
  
  if (historyData.length === 0) {
    // 如果没有历史变化记录，显示当前状态
    if (currentData) {
      const time = new Date(currentData.checkTime || Date.now()).toLocaleString('zh-CN');
      historyHtml = `
        <div class="history-section">
          <h3>当前状态</h3>
          <div class="history-item">
            <div class="history-time">${time}</div>
            <div class="history-status">${formatStatusText(currentData)}</div>
          </div>
        </div>
      `;
    } else {
      historyHtml = `
        <div class="history-section">
          <h3>暂无数据</h3>
          <p>该基金暂无历史记录或数据获取失败</p>
        </div>
      `;
    }
  } else {
    // 显示历史变化记录
    historyHtml = `
      <div class="history-section">
        <h3>限额变化历史</h3>
        <div class="history-list">
    `;
    
    historyData.forEach((entry, index) => {
      const time = new Date(entry.time).toLocaleString('zh-CN');
      
      historyHtml += `
        <div class="history-item">
          <div class="history-time">${time}</div>
          <div class="history-status">${entry.limitText}</div>
        </div>
      `;
    });
    
    historyHtml += `
        </div>
      </div>
    `;
  }
  
  // 构建完整的HTML页面
  const fullHtml = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>限额历史记录 - ${fundName}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background-color: #f5f5f5;
          margin: 0;
          padding: 20px;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          background-color: white;
          border-radius: 12px;
          padding: 30px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 1px solid #eee;
        }
        .fund-title {
          font-size: 24px;
          font-weight: 600;
          color: #333;
          margin-bottom: 8px;
        }
        .fund-code {
          font-size: 16px;
          color: #667eea;
          font-weight: 500;
        }
        .history-section {
          margin-bottom: 30px;
        }
        .history-section h3 {
          font-size: 18px;
          color: #333;
          margin-bottom: 15px;
          font-weight: 600;
        }
        .history-list {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        .history-item {
          background-color: #fafafa;
          border: 1px solid #eee;
          border-radius: 8px;
          padding: 15px;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .history-item:hover {
          background-color: #f5f5f5;
          border-color: #ddd;
        }
        .history-time {
          font-size: 14px;
          color: #999;
          font-weight: 500;
          min-width: 180px;
          flex-shrink: 0;
        }
        .history-change {
          display: flex;
          flex-direction: row;
          gap: 12px;
          align-items: center;
          flex: 1;
          justify-content: flex-start;
        }
        .history-old {
          color: #f44336;
          font-size: 16px;
          font-weight: 500;
        }
        .history-arrow {
          color: #999;
          font-size: 14px;
          font-weight: 600;
        }
        .history-new {
          color: #4caf50;
          font-size: 16px;
          font-weight: 600;
        }
        .history-status {
          color: #333;
          font-size: 16px;
          font-weight: 600;
          padding: 8px 16px;
          background-color: #e8f5e9;
          border-radius: 6px;
          flex: 1;
          text-align: left;
        }

      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="fund-title">${fundName}</div>
          <div class="fund-code">基金代码: ${fundCode}</div>
        </div>
        
        ${historyHtml}
        

    </body>
    </html>
  `;
  
  // 创建Blob URL
  const blob = new Blob([fullHtml], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  
  // 在新标签页打开
  window.open(url, '_blank', 'width=800,height=600,top=100,left=100');
  
  // 释放Blob URL
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

// 加载基金名称映射
async function loadFundNames() {
  try {
    const result = await chrome.storage.local.get('fundNames');
    const savedNames = result.fundNames || {};
    
    // 使用保存的名称，没有默认名称
    FUND_NAMES = { ...savedNames };
    
    console.log('基金名称映射已更新:', FUND_NAMES);
  } catch (error) {
    console.error('加载基金名称失败:', error);
  }
}

// 加载基金限额数据
async function loadFundLimits() {
  const contentEl = document.getElementById('content');
  contentEl.innerHTML = '<div class="loading">正在加载数据...</div>';
  
  try {
    console.log('正在从background获取数据...');
    
    // 从background获取数据
    const fundData = await chrome.runtime.sendMessage({ action: 'getFundLimits' });
    
    console.log('获取到的数据:', fundData);
    
    // 检查是否有基金
    const fundCount = Object.keys(fundData).length;
    
    if (fundCount === 0) {
      // 如果没有基金，提示用户添加
      contentEl.innerHTML = `
        <div style="text-align: center; padding: 60px; color: #666;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width: 64px; height: 64px; opacity: 0.3; margin-bottom: 20px;">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <h3>暂无监控基金</h3>
          <p>请先添加您感兴趣的基金</p>
          <button class="btn btn-primary" onclick="openManagePage()">
            ➕ 前往添加基金
          </button>
        </div>
      `;
      return;
    }
    
    // 检查数据是否为空
    const hasData = fundData && Object.keys(fundData).some(code => fundData[code]);
    
    if (!hasData) {
      console.log('暂无数据，尝试立即检查...');
      // 如果没有数据，立即触发一次检查
      await chrome.runtime.sendMessage({ action: 'checkNow' });
      // 重新获取数据
      fundData = await chrome.runtime.sendMessage({ action: 'getFundLimits' });
      console.log('检查后获取的数据:', fundData);
    }
    
    // 渲染数据前再次更新基金名称
    await loadFundNames();
    
    // 渲染数据
    renderFundData(fundData);
    
    // 更新最后时间
    updateLastUpdateTime();
  } catch (error) {
    console.error('加载数据失败:', error);
    contentEl.innerHTML = `
      <div style="text-align: center; padding: 50px; color: #c62828;">
        <h3>加载数据失败</h3>
        <p>${error.message}</p>
        <p>请检查网络连接或尝试手动刷新</p>
        <button class="btn btn-refresh" onclick="loadFundLimits()">重试</button>
        <button class="btn btn-secondary" onclick="window.runAllDebug()">调试信息</button>
      </div>
    `;
  }
}

// 打开基金管理页面
function openManagePage() {
  chrome.tabs.create({
    url: chrome.runtime.getURL('manage.html')
  });
}

// 立即检查获取最新数据
async function checkNow() {
  const contentEl = document.getElementById('content');
  
  try {
    // 显示加载状态
    contentEl.innerHTML = '<div class="loading">正在检查最新数据...</div>';
    
    // 立即检查所有基金
    await chrome.runtime.sendMessage({ action: 'checkNow' });
    
    // 获取最新数据
    const fundData = await chrome.runtime.sendMessage({ action: 'getFundLimits' });
    
    // 渲染最新数据
    renderFundData(fundData);
    
    // 更新最后时间
    updateLastUpdateTime();
    
    showMessage('已获取最新数据', 'success');
  } catch (error) {
    console.error('检查数据失败:', error);
    contentEl.innerHTML = `
      <div style="text-align: center; padding: 50px; color: #c62828;">
        <h3>检查数据失败</h3>
        <p>${error.message}</p>
        <p>请检查网络连接或稍后重试</p>
        <button class="btn btn-refresh" onclick="loadFundLimits()">返回</button>
      </div>
    `;
  }
}

// 显示消息提示
function showMessage(message, type = 'info') {
  // 创建临时消息提示
  const messageEl = document.createElement('div');
  messageEl.className = `message message-${type}`;
  messageEl.textContent = message;
  messageEl.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    background: ${type === 'success' ? '#4caf50' : '#2196f3'};
    color: white;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;
  
  document.body.appendChild(messageEl);
  
  // 3秒后自动移除
  setTimeout(() => {
    messageEl.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => {
      document.body.removeChild(messageEl);
    }, 300);
  }, 3000);
}

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);

// 渲染基金数据
function renderFundData(fundData) {
  const contentEl = document.getElementById('content');
  
  // 检查是否有数据
  const hasData = Object.values(fundData).some(data => data);
  
  if (!hasData) {
    contentEl.innerHTML = `
      <div class="error">暂无基金数据</div>
      <div class="loading">点击"立即检查"获取最新数据</div>
    `;
    return;
  }
  
  // 渲染基金列表
  let html = '';
  
  const sortedFunds = sortFunds(fundData);
  
  sortedFunds.forEach(([fundCode, data]) => {
    // 先从FUND_NAMES获取，没有则使用代码作为名称
      let fundName = FUND_NAMES[fundCode] || `基金(${fundCode})`;
      
      // 尝试从本地存储获取最新的
      chrome.storage.local.get('fundNames').then(result => {
        const savedNames = result.fundNames || {};
        const latestName = savedNames[fundCode] || `基金(${fundCode})`;
        // 如果名称有更新，更新DOM
        if (latestName !== fundName) {
          const fundCard = document.querySelector(`.fund-card[data-code="${fundCode}"] .fund-name`);
          if (fundCard) {
            fundCard.textContent = latestName;
          }
          // 更新全局映射
          FUND_NAMES[fundCode] = latestName;
        }
      });
    
    if (!data) {
      html += `
        <div class="fund-card error" data-code="${fundCode}">
          <div class="fund-code">${fundCode}</div>
          <div class="fund-name">
            <a href="https://fund.eastmoney.com/${fundCode}.html" target="_blank" rel="noopener">${fundName}</a>
          </div>
          <div class="fund-status">
            <span class="status-badge status-error">数据获取失败</span>
          </div>
        </div>
      `;
      return;
    }
    
    // 处理限额信息
    let statusClass = 'status-normal';
    let statusText = '正常申购';
    let limitAmount = '';
    let hasChanged = false;
    
    // 检查是否有历史记录和变化
    chrome.storage.local.get([`${fundCode}_history`, fundCode], (result) => {
      const historyData = result[`${fundCode}_history`];
      const currentData = result[fundCode];
      
      if (historyData && historyData.length > 0) {
        // 检查最新的历史记录是否有实际变化
        const latestHistory = historyData[0];
        if (latestHistory && latestHistory.oldLimit) {
          // 只有当有明确的旧限制时，才认为有变化
          hasChanged = true;
          // 标记有变化的基金卡片
          const fundCard = document.querySelector(`.fund-card[data-code="${fundCode}"]`);
          if (fundCard) {
            fundCard.classList.add('status-changed');
          }
        } else if (currentData && currentData.limitText !== '未找到限额信息') {
          // 如果没有旧限制，但当前状态不是未找到信息，也认为是初始状态，不标记变化
          hasChanged = false;
        }
      }
    });
    
    if (data.isLimited) {
      statusClass = 'status-limited';
      statusText = '限购';
      if (data.limitText) {
        // 提取限购金额
        const amountMatch = data.limitText.match(/([0-9,.]+元)/);
        if (amountMatch) {
          limitAmount = amountMatch[1];
        } else if (data.limitText.includes('暂停')) {
          statusText = '暂停申购';
        }
      }
    } else if (data.limitText) {
      statusText = data.limitText;
    }
    
    html += `
   <div class="fund-card ${data.isLimited ? 'limited' : 'normal'}" data-code="${fundCode}">
     <div class="fund-main-row">
       <div class="fund-info-row">
         <div class="fund-code">${fundCode}</div>
         <div class="fund-name">
           <a href="https://fund.eastmoney.com/${fundCode}.html" target="_blank" rel="noopener">${fundName}</a>
         </div>
       </div>
       <div class="fund-status-row">
         <div id="change-indicator-${fundCode}" class="change-indicator" title="限额有变化">⚠️</div>
         <div class="limit-info ${statusClass}">
           <span class="status-text">${statusText}</span>
           ${limitAmount ? `<span class="limit-amount">${limitAmount}</span>` : ''}
         </div>
         <div class="update-time">最后更新: ${new Date(data.checkTime || Date.now()).toLocaleString('zh-CN')}</div>
       </div>
     </div>
     <div id="change-info-${fundCode}" class="change-info" style="display: none;">
       <div class="change-label">限额变化:</div>
       <div class="change-content">
         <span class="change-old" id="change-old-${fundCode}"></span>
         <span class="change-arrow">→</span>
         <span class="change-new" id="change-new-${fundCode}"></span>
       </div>
     </div>
   </div>
 `;
     
     // 延迟检查变化状态（确保DOM已渲染）
     setTimeout(() => {
       chrome.storage.local.get([`${fundCode}_history`, fundCode], (result) => {
         const historyData = result[`${fundCode}_history`];
         const currentData = result[fundCode];
         const fundCard = document.querySelector(`.fund-card[data-code="${fundCode}"]`);
         
         if (historyData && historyData.length > 0) {
           // 检查是否有实际的限额变化
           let hasActualChange = false;
           let oldLimitText = '';
           let newLimitText = currentData ? currentData.limitText : '';
           
           // 检查最新的历史记录是否有实际变化
           const latestHistory = historyData[0];
           if (latestHistory && latestHistory.oldLimit) {
             // 只有当旧限制与当前限制真正不同时，才认为有变化
             if (latestHistory.oldLimit !== newLimitText) {
               hasActualChange = true;
               oldLimitText = latestHistory.oldLimit;
             }
           } else if (historyData.length > 1) {
             // 如果最新记录没有oldLimit，但有历史记录，检查前一天的状态
             const previousDayChange = historyData[1];
             if (previousDayChange && previousDayChange.limitText !== newLimitText) {
               hasActualChange = true;
               oldLimitText = previousDayChange.limitText;
             }
           }
           
           // 只有当有实际变化时才显示变化指示器和信息
           if (hasActualChange) {
             const indicator = document.getElementById(`change-indicator-${fundCode}`);
             if (indicator) {
               indicator.style.display = 'inline-block';
               indicator.className = 'change-indicator';
             }
             if (fundCard) {
               fundCard.classList.add('status-changed');
             }
             
             // 显示变化前后的对比信息
             const changeInfo = document.getElementById(`change-info-${fundCode}`);
             const changeOld = document.getElementById(`change-old-${fundCode}`);
             const changeNew = document.getElementById(`change-new-${fundCode}`);
             
             if (changeInfo && changeOld && changeNew) {
               changeOld.textContent = oldLimitText;
               changeNew.textContent = newLimitText;
               changeInfo.style.display = 'flex';
             }
           } else {
             // 没有实际变化，隐藏变化指示器
             const indicator = document.getElementById(`change-indicator-${fundCode}`);
             if (indicator) {
               indicator.style.display = 'none';
             }
             if (fundCard) {
               fundCard.classList.remove('status-changed');
             }
             
             // 隐藏变化信息
             const changeInfo = document.getElementById(`change-info-${fundCode}`);
             if (changeInfo) {
               changeInfo.style.display = 'none';
             }
           }
         }
           
         // 绑定鼠标事件：仅在限购信息上显示提示和响应点击
         if (fundCard) {
           // 找到限购信息元素
           const limitInfo = fundCard.querySelector('.limit-info');
           
           if (limitInfo) {
             // 鼠标悬停事件：只在限购信息上显示提示
             limitInfo.addEventListener('mouseenter', () => {
               limitInfo.style.cursor = 'pointer';
               limitInfo.title = '单击显示限额历史记录';
             });
             
             // 鼠标移出事件：移除提示
             limitInfo.addEventListener('mouseleave', () => {
               limitInfo.style.cursor = 'default';
               limitInfo.title = '';
             });
             
             // 点击事件：仅在限购信息上点击时显示历史记录
             limitInfo.addEventListener('click', (e) => {
               e.stopPropagation();
               openHistoryInNewTab(fundCode);
             });
           }
         }
       });
     }, 100);
  });
  
  contentEl.innerHTML = html;
  
  // 更新最后时间
  updateLastUpdateTime();
}

// 获取状态样式类
function getStatusClass(data) {
  if (!data || !data.hasLimit) {
    return 'status-normal';
  } else if (data.hasLimit) {
    return 'status-restricted';
  } else {
    return 'status-unknown';
  }
}

// 格式化状态文本
function formatStatusText(data) {
  if (!data) {
    return '暂无数据';
  }
  
  if (data.limitAmount === 0) {
    return '🚫 暂停申购';
  } else if (data.hasLimit) {
    return '⚠️ 限额申购';
  } else {
    return '✅ 开放申购';
  }
}

// 格式化金额文本
function formatAmountText(data) {
  if (!data || data.limitAmount === null || !data.hasLimit) {
    return '';
  }
  
  if (data.limitAmount === 0) {
    return '';
  } else if (data.limitAmount >= 10000) {
    return `<div class="limit-amount">${(data.limitAmount / 10000).toFixed(2)}万元</div>`;
  } else {
    return `<div class="limit-amount">${data.limitAmount.toFixed(0)}元</div>`;
  }
}

// 格式化检查时间
function formatCheckTime(timestamp) {
  if (!timestamp) return '从未检查';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) {
    return '刚刚';
  } else if (diffMins < 60) {
    return `${diffMins}分钟前`;
  } else if (diffHours < 24) {
    return `${diffHours}小时前`;
  } else if (diffDays < 7) {
    return `${diffDays}天前`;
  } else {
    return date.toLocaleDateString('zh-CN');
  }
}

// 更新最后更新时间（已移除页面显示）
function updateLastUpdateTime() {
  // 该函数已保留但不再更新页面显示
  // 因为底部的最后更新时间元素已被移除
}

// 自动刷新功能已移除

// 立即检查单个基金
async function checkFundNow(fundCode) {
  // 显示加载状态
  const cards = document.querySelectorAll('.fund-card');
  cards.forEach(card => {
    if (card.querySelector('.fund-code').textContent === fundCode) {
      card.querySelector('.limit-status').innerHTML = '<div class="loading">正在检查...</div>';
    }
  });
  
  try {
    // 发送检查命令
    await chrome.runtime.sendMessage({ action: 'checkNow' });
    
    // 重新加载数据
    await loadFundLimits();
  } catch (error) {
    alert(`检查基金 ${fundCode} 失败: ${error.message}`);
  }
}