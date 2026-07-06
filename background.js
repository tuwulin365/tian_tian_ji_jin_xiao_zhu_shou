// 默认基金列表
const DEFAULT_FUND_CODES = [
  // 纳斯达克100基金
  '161130', // 易方达纳斯达克100发起式(QDII-ETF联接A)
  '006479', // 国泰纳斯达克100(QDII)
  '000834', // 广发纳斯达克100指数A(QDII)
  '005503', // 华夏纳斯达克100ETF联接A
  '016641', // 博时纳斯达克100指数A(QDII)
  '002346', // 华安纳斯达克100指数A(QDII)
  '017520', // 招商纳斯达克100指数A(QDII)
  '002385', // 华夏纳斯达克100ETF联接C
  
  // 标普500基金
  '006075', // 易方达标普500指数A(QDII-LOF)
  '006076', // 易方达标普500指数C(QDII-LOF)
  '000763', // 嘉实美国成长股票(QDII)
  '005672', // 博时标普500ETF联接A(QDII)
  '000960', // 大成标普500等权重指数(QDII)
  '001064', // 富国全球顶级消费混合(QDII)
  '001838', // 嘉实全球互联网股票(QDII)
  '006372', // 南方标普500ETF联接A(QDII)
  '006373'  // 南方标普500ETF联接C(QDII)
];

// 默认基金名称映射
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

// 初始化定时任务
chrome.runtime.onInstalled.addListener(() => {
  console.log('天天基金小助手已安装');
  
  // 初始化默认基金
  initDefaultFunds();
  
  // 设置定时任务：从八点开始，每隔一小时更新一次
  setupDailyAlarms();
  
  // 立即检查一次
  checkFundLimits();
});

// 初始化默认基金
async function initDefaultFunds() {
  const result = await chrome.storage.local.get(['customFunds', 'fundNames']);
  
  // 不自动添加默认基金，让用户手动添加
  if (!result.customFunds) {
    await chrome.storage.local.set({
      customFunds: [] // 空数组，不添加默认基金
    });
    console.log('初始化空基金列表，等待用户手动添加');
  }
  
  // 如果没有基金名称映射，初始化默认映射（用于搜索时的名称显示）
  if (!result.fundNames || Object.keys(result.fundNames).length === 0) {
    await chrome.storage.local.set({
      fundNames: DEFAULT_FUND_NAMES
    });
    console.log('初始化默认基金名称映射');
  }
}

// 监听定时任务
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith('dailyCheck_')) {
    // 检查今天是否已经更新成功过
    const today = new Date().toDateString();
    const result = await chrome.storage.local.get('lastSuccessfulUpdateDate');
    const lastUpdateDate = result.lastSuccessfulUpdateDate;
    
    if (lastUpdateDate === today) {
      console.log('今天已经更新成功过，跳过本次自动更新');
      return;
    }
    
    console.log('执行自动更新任务...');
    await checkFundLimits();
  }
});

// 设置每日定时任务：从八点开始，每隔一小时更新一次
function setupDailyAlarms() {
  // 清除所有已存在的定时任务
  chrome.alarms.clearAll();
  
  // 设置从8点到20点，每隔一小时的定时任务
  for (let hour = 8; hour <= 20; hour++) {
    const alarmName = `dailyCheck_${hour}`;
    
    // 创建今天的定时任务
    const now = new Date();
    const alarmTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0);
    
    // 如果当前时间已经过了今天的这个小时，设置明天的
    if (alarmTime < now) {
      alarmTime.setDate(alarmTime.getDate() + 1);
    }
    
    const delayInMinutes = (alarmTime.getTime() - now.getTime()) / 60000;
    
    chrome.alarms.create(alarmName, {
      delayInMinutes: delayInMinutes,
      periodInMinutes: 1440 // 每天重复
    });
    
    console.log(`设置定时任务: ${alarmName}，首次执行时间: ${alarmTime.toLocaleString()}`);
  }
}

// 检查所有基金限额
async function checkFundLimits() {
  console.log('开始检查基金限额...');
  
  // 获取当前监控的基金
  const result = await chrome.storage.local.get('customFunds');
  const fundsToCheck = result.customFunds || DEFAULT_FUND_CODES;
  
  let hasSuccessfulUpdate = false;
  
  for (const fundCode of fundsToCheck) {
    try {
      const limitData = await fetchFundLimit(fundCode);
      await updateFundLimit(fundCode, limitData);
      hasSuccessfulUpdate = true;
    } catch (error) {
      console.error(`检查基金 ${fundCode} 时出错:`, error);
    }
  }
  
  // 如果有至少一个基金更新成功，记录今天的日期
  if (hasSuccessfulUpdate) {
    const today = new Date().toDateString();
    await chrome.storage.local.set({ lastSuccessfulUpdateDate: today });
    console.log('基金更新成功，记录今天的日期:', today);
  }
}

// 获取单个基金限额
async function fetchFundLimit(fundCode) {
  const url = `https://fund.eastmoney.com/${fundCode}.html`;
  
  try {
    console.log(`正在获取基金 ${fundCode} 数据...`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Referer': 'https://www.eastmoney.com/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      },
      credentials: 'omit',
      mode: 'no-cors' // 绕过CORS限制
    });
    
    console.log(`基金 ${fundCode} 响应状态: ${response.status}`);
    
    // 使用no-cors模式时，response.ok和response.status可能不可用
    if (response.type === 'opaque') {
      console.log(`基金 ${fundCode} 使用no-cors模式，无法直接访问响应内容`);
      
      // 尝试使用另一种方法：通过content script获取页面内容
      const limitInfo = await fetchFundLimitViaContentScript(fundCode);
      return limitInfo;
    }
    
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    
    const html = await response.text();
    console.log(`基金 ${fundCode} HTML长度: ${html.length}`);
    
    // 解析HTML获取限额信息
    const limitInfo = parseLimitFromHtml(html, fundCode);
    console.log(`基金 ${fundCode} 解析结果:`, limitInfo);
    return limitInfo;
  } catch (error) {
    console.error(`获取基金 ${fundCode} 数据失败:`, error);
    
    // 尝试使用content script方法
    try {
      console.log(`尝试使用content script方法获取基金 ${fundCode} 数据...`);
      const limitInfo = await fetchFundLimitViaContentScript(fundCode);
      return limitInfo;
    } catch (contentError) {
      throw new Error(`获取基金 ${fundCode} 数据失败: ${contentError.message}`);
    }
  }
}

// 通过Content Script获取基金限额
async function fetchFundLimitViaContentScript(fundCode) {
  return new Promise((resolve, reject) => {
    // 创建一个新标签页
    chrome.tabs.create({
      url: `https://fund.eastmoney.com/${fundCode}.html`,
      active: false
    }, (tab) => {
      // 等待页面加载
      setTimeout(() => {
        // 注入content script
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            // 在页面上下文中执行的函数
            const bodyText = document.body.textContent;
            
            let limitText = '';
            let limitAmount = null;
            let hasLimit = false;
            
            // 查找暂停申购/开放申购状态
            const suspendMatch = bodyText.match(/暂停申购\s*(\(单日累计购买上限(.*?)\))?/i);
            const openMatch = bodyText.match(/开放申购/i);
            
            if (suspendMatch) {
              hasLimit = true;
              if (suspendMatch[2]) {
                limitText = suspendMatch[0].trim();
                // 提取限额金额
                const amountMatch = suspendMatch[2].match(/(\d+(?:\.\d+)?)(万|元)/i);
                if (amountMatch) {
                  limitAmount = parseFloat(amountMatch[1]);
                  if (amountMatch[2] === '万') {
                    limitAmount = limitAmount * 10000;
                  }
                }
              } else {
                limitText = '暂停申购';
                limitAmount = 0;
              }
            } else if (openMatch) {
              hasLimit = false;
              limitText = '开放申购，无限制';
            } else {
              // 搜索包含限额的文本
              const limitMatch = bodyText.match(/(每日限额|限购金额|申购限额|单日累计购买上限)(.*?)(\d+(?:\.\d+)?)(万|元)/i);
              if (limitMatch) {
                hasLimit = true;
                limitText = limitMatch[0].trim();
                limitAmount = parseFloat(limitMatch[3]);
                if (limitMatch[4] === '万') {
                  limitAmount = limitAmount * 10000;
                }
              } else {
                limitText = '未找到限额信息';
              }
            }
            
            return {
              limitText,
              limitAmount,
              hasLimit: hasLimit || !!limitAmount || limitText.includes('限额') || limitText.includes('限购')
            };
          }
        }, (results) => {
          // 关闭标签页
          chrome.tabs.remove(tab.id);
          
          if (chrome.runtime.lastError) {
            reject(new Error(`Content Script执行失败: ${chrome.runtime.lastError.message}`));
            return;
          }
          
          if (results && results[0] && results[0].result) {
            const result = results[0].result;
            resolve({
              fundCode,
              limitText: result.limitText,
              limitAmount: result.limitAmount,
              checkTime: new Date().toISOString(),
              hasLimit: result.hasLimit
            });
          } else {
            reject(new Error('无法解析基金页面内容'));
          }
        });
      }, 3000); // 等待3秒让页面加载完成
    });
  });
}

// 解析HTML中的限额信息
function parseLimitFromHtml(html, fundCode) {
  // 尝试不同的选择器查找限额信息
  let limitText = '';
  let limitAmount = null;
  let hasLimit = false;
  
  // 方法1: 精确匹配交易状态格式
  // 匹配暂停申购格式: 交易状态：</span><span class="staticCell">暂停申购  (<span>单日累计购买上限 100.00 元
  const suspendStatusMatch = html.match(/交易状态：<\/span><span class="staticCell">暂停申购\s*\(<span>单日累计购买上限\s*(\d+(?:\.\d+)?)\s*元/i);
  // 匹配限大额格式: 交易状态：</span><span class="staticCell">限大额  (<span>单日累计购买上限 100.00 元
  const limitStatusMatch = html.match(/交易状态：<\/span><span class="staticCell">限大额\s*\(<span>单日累计购买上限\s*(\d+(?:\.\d+)?)\s*元/i);
  // 匹配普通暂停申购
  const suspendMatch = html.match(/暂停申购(?!\s*\(单日累计购买上限)/i);
  // 匹配开放申购
  const openMatch = html.match(/开放申购/i);
  
  // 打印匹配结果到日志
  console.log(`基金 ${fundCode} 匹配结果:`);
  console.log(`  带金额暂停申购匹配: ${suspendStatusMatch ? suspendStatusMatch[0] : '未匹配'}`);
  console.log(`  限大额匹配: ${limitStatusMatch ? limitStatusMatch[0] : '未匹配'}`);
  console.log(`  普通暂停申购匹配: ${suspendMatch ? suspendMatch[0] : '未匹配'}`);
  console.log(`  开放申购匹配: ${openMatch ? openMatch[0] : '未匹配'}`);
  
  if (suspendStatusMatch) {
    // 精确匹配到暂停申购且有具体限额
    hasLimit = true;
    const amount = parseFloat(suspendStatusMatch[1]);
    limitAmount = 0; // 设为0表示暂停申购状态
    limitText = `暂停申购（单日累计购买上限${amount.toFixed(2)}元）`;
  } else if (limitStatusMatch) {
    // 精确匹配到限大额
    hasLimit = true;
    limitAmount = parseFloat(limitStatusMatch[1]);
    limitText = `限大额（单日累计购买上限${limitAmount.toFixed(2)}元）`;
  } else if (suspendMatch) {
    // 普通暂停申购
    hasLimit = true;
    limitText = '暂停申购';
    limitAmount = 0;
  } else if (openMatch) {
    // 开放申购
    hasLimit = false;
    limitText = '开放申购，无限制';
  } else {
    // 方法2: 搜索包含限额的文本
    const limitMatch = html.match(/(每日限额|限购金额|申购限额|单日累计购买上限)(.*?)(\d+(?:\.\d+)?)(万|元)/i);
    if (limitMatch) {
      hasLimit = true;
      limitText = limitMatch[0].trim();
      limitAmount = parseFloat(limitMatch[3]);
      if (limitMatch[4] === '万') {
        limitAmount = limitAmount * 10000;
      }
    }
  }
  
  // 方法3: 查找其他可能的限额模式
  if (!limitText) {
    // 查找类似"限购1000元"这样的模式
    const simpleLimitMatch = html.match(/限购(\d+(?:\.\d+)?)(万|元)/i);
    if (simpleLimitMatch) {
      hasLimit = true;
      limitAmount = parseFloat(simpleLimitMatch[1]);
      if (simpleLimitMatch[2] === '万') {
        limitAmount = limitAmount * 10000;
      }
      limitText = `每日限额: ${limitAmount >= 10000 ? (limitAmount / 10000).toFixed(2) + '万元' : limitAmount.toFixed(0) + '元'}`;
    } else if (html.includes('暂停申购')) {
      hasLimit = true;
      limitText = '暂停申购';
      limitAmount = 0;
    } else if (html.includes('开放申购')) {
      hasLimit = false;
      limitText = '开放申购，无限制';
    }
  }
  
  limitText = limitText || '未找到限额信息';
  limitText = limitText
    .replace(/\(/g, '（')
    .replace(/\)/g, '）')
    .replace(/（\s*/g, '（')
    .replace(/\s*）/g, '）');

  return {
    fundCode,
    limitText: limitText,
    limitAmount: limitAmount,
    checkTime: new Date().toISOString(),
    hasLimit: hasLimit || !!limitAmount || limitText.includes('限额') || limitText.includes('限购')
  };
}

// 更新基金限额并检查变化
async function updateFundLimit(fundCode, newLimitData) {
  // 获取存储的旧数据
  const storedData = await chrome.storage.local.get([fundCode]);
  const oldLimitData = storedData[fundCode];
  
  // 获取历史数据用于对比
  const historyResult = await chrome.storage.local.get([`${fundCode}_history`]);
  const historyData = historyResult[`${fundCode}_history`] || [];
  
  // 检查限额是否有变化
  let limitChanged = false;
  if (oldLimitData) {
    const hasChanged = checkLimitChange(oldLimitData, newLimitData);
    if (hasChanged) {
      limitChanged = true;
      console.log(`基金 ${fundCode} 限额发生变化: ${oldLimitData.limitText} → ${newLimitData.limitText}`);
    }
  }
  
  // 保存当前数据
  const saveData = {
    [fundCode]: newLimitData
  };
  
  // 保存历史记录（无论限额是否变化，每天只保存最后一次更新的记录）
  const today = new Date().toDateString();
  const lastHistoryEntry = historyData[0];
  
  // 创建历史记录条目
  const historyEntry = {
    time: newLimitData.checkTime,
    limitText: newLimitData.limitText,
    isLimited: newLimitData.hasLimit,
    oldLimit: limitChanged ? (oldLimitData ? oldLimitData.limitText : undefined) : undefined
  };
  
  // 如果是第二天且限额没有变化，仍然保存前一天的状态
  if (oldLimitData && !limitChanged && lastHistoryEntry) {
    const lastEntryDate = new Date(lastHistoryEntry.time).toDateString();
    if (lastEntryDate !== today) {
      // 如果今天还没有记录，或者今天的记录没有oldLimit，添加前一天的状态
      if (!lastHistoryEntry.oldLimit || new Date(lastHistoryEntry.time).toDateString() === today) {
        historyEntry.oldLimit = oldLimitData.limitText;
      }
    }
  }
  
  // 替换当天的记录（如果存在），否则添加新记录
  let newHistory;
  if (lastHistoryEntry && new Date(lastHistoryEntry.time).toDateString() === today) {
    // 如果当天已有记录，替换为最新的记录
    newHistory = [historyEntry, ...historyData.slice(1)];
  } else {
    // 如果当天没有记录，添加新记录
    newHistory = [historyEntry, ...historyData];
  }
  
  saveData[`${fundCode}_history`] = newHistory;
  
  // 只有变化时才发送通知
    if (limitChanged) {
      showNotification(fundCode, oldLimitData, newLimitData);
      // 记录有变化的基金
      // 角标功能已移除，不再记录变化的基金
    }
  
  // 保存到本地存储
  await chrome.storage.local.set(saveData);
  console.log(`基金 ${fundCode} 数据已保存`);
  if (limitChanged) {
    console.log(`基金 ${fundCode} 历史记录已更新`);
  }
}

// 检查限额是否变化
function checkLimitChange(oldData, newData) {
  // 如果前一天的限购状态为空（未找到限额信息），则认为没有变化
  if (oldData && oldData.limitText === '未找到限额信息') {
    return false;
  }
  
  // 检查金额是否变化（考虑null和undefined的情况）
  const oldAmount = oldData.limitAmount;
  const newAmount = newData.limitAmount;
  if (oldAmount !== newAmount) {
    // 如果都是null或undefined，认为没有变化
    if ((oldAmount === null || oldAmount === undefined) && 
        (newAmount === null || newAmount === undefined)) {
      // 金额都为空，继续检查其他字段
    } else {
      return true;
    }
  }
  
  // 检查限额状态是否变化（从有限额到无限额，或反之）
  if (oldData.hasLimit !== newData.hasLimit) {
    return true;
  }
  
  // 检查文本描述是否变化（忽略时间戳等无关信息）
  const oldText = oldData.limitText || '';
  const newText = newData.limitText || '';
  
  // 标准化文本，去除可能的时间戳或无关信息
  const normalizeText = (text) => {
    // 移除括号内的时间戳或其他信息
    return text.replace(/\(.*?\)/g, '').trim();
  };
  
  const normalizedOldText = normalizeText(oldText);
  const normalizedNewText = normalizeText(newText);
  
  // 检查标准化后的文本是否真正不同
  if (normalizedOldText !== normalizedNewText) {
    // 进一步检查是否只是空格或标点符号的差异
    const cleanText = (text) => {
      return text.replace(/\s+/g, '').replace(/[，。；：！？,.!?]/g, '').toLowerCase();
    };
    
    const cleanedOldText = cleanText(normalizedOldText);
    const cleanedNewText = cleanText(normalizedNewText);
    
    if (cleanedOldText !== cleanedNewText) {
      return true;
    }
  }
  
  // 所有检查都通过，认为没有变化
  return false;
}

// 显示通知
function showNotification(fundCode, oldData, newData) {
  const title = `基金 ${fundCode} 限额变化`;
  let message = '';
  
  if (oldData.limitAmount !== newData.limitAmount) {
    message = `限额从 ${oldData.limitAmount || '无'} 万变为 ${newData.limitAmount || '无'} 万`;
  } else if (oldData.hasLimit !== newData.hasLimit) {
    message = newData.hasLimit ? '现在开始限额申购' : '限额已取消，可正常申购';
  } else {
    message = `限额信息更新: ${newData.limitText}`;
  }
  
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: title,
    message: message
  });
}

// 角标功能已移除

// 供popup调用的接口
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getFundLimits') {
      getFundLimits().then(data => {
        sendResponse(data);
      }).catch(error => {
        sendResponse({ error: error.message });
      });
      return true; // 表示异步响应
    } else if (request.action === 'checkNow') {
      checkFundLimits().then(() => {
        // 手动更新成功，记录今天的日期
        const today = new Date().toDateString();
        chrome.storage.local.set({ lastSuccessfulUpdateDate: today }).then(() => {
          console.log('手动更新成功，记录今天的日期:', today);
          getFundLimits().then(data => {
            sendResponse(data);
          }).catch(error => {
            sendResponse({ error: error.message });
          });
        });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // 表示异步响应
    } else if (request.action === 'getDefaultFunds') {
      // 返回默认基金列表
      sendResponse({
        defaultFunds: DEFAULT_FUND_CODES,
        defaultNames: DEFAULT_FUND_NAMES
      });
      return true;
    } else if (request.action === 'searchFundInfo') {
      searchFundInfo(request.fundCode).then(result => {
        sendResponse(result);
      }).catch(error => {
        sendResponse({ error: error.message });
      });
      return true; // 表示异步响应
    } else if (request.action === 'updateFunds') {
      // 更新基金列表后立即检查
      checkFundLimits().then(() => {
        // 基金列表更新后检查成功，记录今天的日期
        const today = new Date().toDateString();
        chrome.storage.local.set({ lastSuccessfulUpdateDate: today }).then(() => {
          console.log('基金列表更新后检查成功，记录今天的日期:', today);
          sendResponse({ success: true });
        });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // 表示异步响应
    }
  });

// 获取所有基金限额数据
async function getFundLimits() {
  const result = {};
  // 获取当前监控的基金
  const storageResult = await chrome.storage.local.get('customFunds');
  const fundsToGet = storageResult.customFunds || DEFAULT_FUND_CODES;
  
  for (const fundCode of fundsToGet) {
    const data = await chrome.storage.local.get([fundCode]);
    result[fundCode] = data[fundCode] || null;
  }
  return result;
}

// 搜索基金信息
async function searchFundInfo(fundCode) {
  try {
    console.log(`正在搜索基金 ${fundCode} 信息...`);
    
    // 方法1：直接使用Content Script方法（最可靠，绕过CORS和API限制）
    console.log(`使用Content Script方法搜索...`);
    
    return new Promise((resolve) => {
      // 创建临时标签页
      chrome.tabs.create({
        url: `https://fund.eastmoney.com/${fundCode}.html`,
        active: false
      }, (tab) => {
        // 等待页面加载完成
        setTimeout(() => {
          // 注入Content Script
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              try {
                // 方法1：从页面标题提取
                const titleMatch = document.title.match(/(.*?)_基金净值_估值_行情走势—天天基金网/);
                if (titleMatch) {
                  const fullName = titleMatch[1];
                  return fullName.replace(/\([0-9]{6}\)/, '').trim();
                }
                
                // 方法2：从页面元素提取
                const nameEl = document.querySelector('.fundDetail-tit h1');
                if (nameEl) {
                  return nameEl.textContent.trim();
                }
                
                // 方法3：从页面其他位置提取
                const metaEl = document.querySelector('meta[name="keywords"]');
                if (metaEl) {
                  const content = metaEl.getAttribute('content');
                  if (content) {
                    const parts = content.split(' ');
                    if (parts.length > 0) {
                      return parts[0].replace(/基金$/, '');
                    }
                  }
                }
                
                return null;
              } catch (e) {
                console.error('提取基金名称失败:', e);
                return null;
              }
            }
          }, (results) => {
            // 关闭临时标签页
            chrome.tabs.remove(tab.id);
            
            if (results && results[0] && results[0].result) {
              const fundName = results[0].result;
              console.log(`通过Content Script找到基金 ${fundCode}: ${fundName}`);
              resolve({ fundInfo: { name: fundName, code: fundCode } });
            } else {
              console.log(`未找到基金 ${fundCode} 的名称信息，尝试使用默认名称`);
              resolve({ fundInfo: { name: `基金(${fundCode})`, code: fundCode } });
            }
          });
        }, 2000); // 等待2秒确保页面加载完成
      });
    });
    
  } catch (error) {
    console.error(`搜索基金 ${fundCode} 信息失败:`, error);
    // 如果所有方法都失败，返回默认名称
    return { fundInfo: { name: `基金(${fundCode})`, code: fundCode } };
  }
}