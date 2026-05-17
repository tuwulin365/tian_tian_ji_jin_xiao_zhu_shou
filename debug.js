// 调试工具：手动检查基金限额
async function debugFundLimits() {
  console.log('=== 开始调试基金限额 ===');
  
  try {
    // 直接调用background的检查函数
    const response = await chrome.runtime.sendMessage({ action: 'checkNow' });
    console.log('检查结果:', response);
    
    // 获取最新数据
    const fundData = await chrome.runtime.sendMessage({ action: 'getFundLimits' });
    console.log('当前基金数据:', fundData);
    
    // 显示每个基金的详细信息
    Object.keys(fundData).forEach(fundCode => {
      const data = fundData[fundCode];
      console.log(`\n基金 ${fundCode}:`);
      console.log('  状态:', data ? (data.hasLimit ? '限额申购' : '开放申购') : '无数据');
      console.log('  限额:', data ? data.limitText : '无数据');
      console.log('  金额:', data ? data.limitAmount : '无数据');
      console.log('  时间:', data ? data.checkTime : '无数据');
    });
    
  } catch (error) {
    console.error('调试过程中出错:', error);
  }
}

// 测试网络请求
async function testNetworkRequest() {
  console.log('=== 测试网络请求 ===');
  
  const testFundCode = '161130';
  const url = `https://fund.eastmoney.com/${testFundCode}.html`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      }
    });
    
    console.log('响应状态:', response.status);
    console.log('响应状态文本:', response.statusText);
    
    if (response.ok) {
      const html = await response.text();
      console.log('HTML长度:', html.length);
      
      // 检查是否包含限额信息
      if (html.includes('暂停申购') || html.includes('开放申购') || html.includes('限额')) {
        console.log('页面包含限额相关信息');
      } else {
        console.log('页面未找到限额相关信息');
      }
    }
  } catch (error) {
    console.error('网络请求失败:', error);
  }
}

// 检查存储数据
async function checkStorage() {
  console.log('=== 检查存储数据 ===');
  
  try {
    const result = await chrome.storage.local.get(null);
    console.log('本地存储内容:', result);
    
    // 检查基金数据
    const fundCodes = ['161130', '006479', '000834', '005503', '162411'];
    fundCodes.forEach(code => {
      if (result[code]) {
        console.log(`基金 ${code} 已存储`);
      } else {
        console.log(`基金 ${code} 未存储`);
      }
    });
  } catch (error) {
    console.error('检查存储失败:', error);
  }
}

// 运行所有调试
async function runAllDebug() {
  await checkStorage();
  await testNetworkRequest();
  await debugFundLimits();
  console.log('=== 调试完成 ===');
}

// 导出供控制台使用
window.debugFundLimits = debugFundLimits;
window.testNetworkRequest = testNetworkRequest;
window.checkStorage = checkStorage;
window.runAllDebug = runAllDebug;

console.log('调试工具已加载，请调用 runAllDebug() 开始调试');
console.log('或单独调用 debugFundLimits(), testNetworkRequest(), checkStorage()');