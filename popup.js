// 基金代码与名称映射（默认值，实际会从本地存储获取）
const DEFAULT_FUND_NAMES = {
  // 纳斯达克100基金
  '161130': '易方达纳斯达克100发起式(QDII-ETF联接A)',
  '006479': '国泰纳斯达克100(QDII)',
  '000834': '广发纳斯达克100指数A(QDII)',
  '005503': '华夏纳斯达克100ETF联接A',
  '016641': '博时纳斯达克100指数A(QDII)',
  '002346': '华安纳斯达克100指数A(QDII)',
  '017520': '招商纳斯达克100指数A(QDII)',
  '002385': '华夏纳斯达克100ETF联接C',
  
  // 标普500基金
  '006075': '易方达标普500指数A(QDII-LOF)',
  '006076': '易方达标普500指数C(QDII-LOF)',
  '000763': '嘉实美国成长股票(QDII)',
  '005672': '博时标普500ETF联接A(QDII)',
  '000960': '大成标普500等权重指数(QDII)',
  '001064': '富国全球顶级消费混合(QDII)',
  '001838': '嘉实全球互联网股票(QDII)',
  '006372': '南方标普500ETF联接A(QDII)',
  '006373': '南方标普500ETF联接C(QDII)'
};

// 实际使用的基金名称映射（会从本地存储动态加载）
let FUND_NAMES = { ...DEFAULT_FUND_NAMES };

// 更新最后时间
function updateLastUpdateTime() {
  const lastUpdateEl = document.getElementById('lastUpdate');
  if (lastUpdateEl) {
    const now = new Date();
    const timeStr = now.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    lastUpdateEl.textContent = `最后更新: ${timeStr}`;
  }
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', async () => {
  await loadFundNames();
  await loadFundLimits();
  
  // 绑定按钮事件
  document.getElementById('checkNowBtn').addEventListener('click', checkNow);
  document.getElementById('openNewTabBtn').addEventListener('click', openInNewTab);
  document.getElementById('manageFundsBtn').addEventListener('click', openManagePage);
});

// 加载基金名称映射
async function loadFundNames() {
  try {
    const result = await chrome.storage.local.get('fundNames');
    const savedNames = result.fundNames || {};
    
    // 合并默认名称和保存的名称
    FUND_NAMES = { ...DEFAULT_FUND_NAMES, ...savedNames };
    
    console.log('基金名称映射已更新:', FUND_NAMES);
  } catch (error) {
    console.error('加载基金名称失败:', error);
  }
}

// 更新最后时间
function updateLastUpdateTime() {
  const lastUpdateEl = document.getElementById('lastUpdate');
  if (lastUpdateEl) {
    const now = new Date();
    const timeStr = now.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    lastUpdateEl.textContent = `最后更新: ${timeStr}`;
  }
}

// 打开基金管理页面
function openManagePage() {
  chrome.tabs.create({
    url: chrome.runtime.getURL('manage.html')
  });
}

// 在新标签页打开完整监控页面
function openInNewTab() {
  chrome.tabs.create({
    url: chrome.runtime.getURL('dashboard.html')
  });
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
        <div style="text-align: center; padding: 30px; color: #666;">
          <h3>暂无监控基金</h3>
          <p>请点击下方"基金管理"按钮添加您感兴趣的基金</p>
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
  
  Object.entries(fundData).forEach(([fundCode, data]) => {
    const fundName = FUND_NAMES[fundCode] || `基金(${fundCode})`;
    
    if (!data) {
      html += `
        <div class="fund-item">
          <div class="fund-code">${fundCode}</div>
          <div class="fund-name">${fundName}</div>
          <div class="limit-info limit-unknown">数据获取失败</div>
        </div>
      `;
      return;
    }
    
    // 处理限额信息
    let statusClass = 'limit-normal';
    let statusText = '正常申购';
    let limitAmount = '';
    
    if (data.isLimited) {
      statusClass = 'limit-restricted';
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
      <div class="fund-item">
        <div class="fund-code">${fundCode}</div>
        <div class="fund-name">
          <a href="https://fund.eastmoney.com/${fundCode}.html" target="_blank" rel="noopener">${fundName}</a>
        </div>
        <div class="limit-info ${statusClass}">${statusText}</div>
        ${limitAmount ? `<div class="limit-amount">${limitAmount}</div>` : ''}
        <div class="check-time">最后检查: ${new Date(data.checkTime).toLocaleString('zh-CN')}</div>
      </div>
    `;
  });
  
  contentEl.innerHTML = html;
  
  // 更新最后时间
  updateLastUpdateTime();
}

// 获取限额样式类
function getLimitClass(data) {
  if (!data || !data.hasLimit) {
    return 'limit-normal';
  } else if (data.hasLimit) {
    return 'limit-restricted';
  } else {
    return 'limit-unknown';
  }
}

// 格式化限额文本
function formatLimitText(data) {
  if (!data) {
    return '暂无数据';
  }
  
  if (data.limitAmount !== null) {
    if (data.limitAmount === 0) {
      return '暂停申购';
    } else if (data.limitAmount >= 10000) {
      return `每日限额: ${(data.limitAmount / 10000).toFixed(2)}万元`;
    } else {
      return `每日限额: ${data.limitAmount.toFixed(0)}元`;
    }
  } else if (data.hasLimit) {
    return data.limitText || '限额申购中';
  } else {
    return '开放申购，无限制';
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

// 立即检查限额
async function checkNow() {
  const checkBtn = document.getElementById('checkNowBtn');
  checkBtn.textContent = '检查中...';
  checkBtn.disabled = true;
  
  try {
    await chrome.runtime.sendMessage({ action: 'checkNow' });
    await loadFundLimits();
  } catch (error) {
    alert(`检查失败: ${error.message}`);
  } finally {
    checkBtn.textContent = '立即检查';
    checkBtn.disabled = false;
  }
}