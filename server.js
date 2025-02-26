const http = require('http');
const url = require('url');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const API_KEY = process.env.API_KEY || 'c0e0a23f-15bb-4f6c-80c1-ca560a13a727';
const API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

// 添加请求头配置
const API_HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': 'application/json',
    'Connection': 'keep-alive',
    'User-Agent': 'ChineseNameGenerator/1.0',
    'Cache-Control': 'no-cache',
    'Accept-Encoding': 'gzip, deflate, br'
};

const server = http.createServer(async (req, res) => {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 处理预检请求
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // 处理静态文件
    if (req.method === 'GET') {
        const parsedUrl = url.parse(req.url);
        const path = parsedUrl.pathname;

        if (path === '/') {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            require('fs').readFile('index.html', (err, data) => {
                if (err) {
                    res.writeHead(500);
                    res.end('Error loading index.html');
                    return;
                }
                res.end(data);
            });
            return;
        }

        if (path === '/client.js') {
            res.writeHead(200, { 'Content-Type': 'application/javascript' });
            require('fs').readFile('client.js', (err, data) => {
                if (err) {
                    res.writeHead(500);
                    res.end('Error loading client.js');
                    return;
                }
                res.end(data);
            });
            return;
        }
    }

    // 处理API请求
    if (req.method === 'POST' && req.url === '/generate-name') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const { englishName, prompt } = JSON.parse(body);
                const requestStartTime = Date.now();

                // 调用火山引擎API
                // 添加请求超时处理
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 120000); // 延长超时时间到120秒

                const apiResponse = await fetch(API_URL, {
                    method: 'POST',
                    headers: API_HEADERS,
                    body: JSON.stringify({
                        model: 'deepseek-r1-250120',
                        messages: [
                            { role: 'system', content: '你是一个专业的中文名字起名专家。' },
                            { role: 'user', content: prompt }
                        ],
                        temperature: 0.7,
                        max_tokens: 2000,
                        stream: false
                    }),
                    signal: controller.signal
                });

                // 详细的错误处理
                if (!apiResponse.ok) {
                    const errorText = await apiResponse.text();
                    console.error('API Error:', {
                        status: apiResponse.status,
                        statusText: apiResponse.statusText,
                        errorText,
                        url: API_URL,
                        requestTime: new Date().toISOString()
                    });
                    
                    // 根据不同的错误状态码返回相应的错误信息
                    let errorMessage = '生成名字时出错';
                    if (apiResponse.status === 429) {
                        errorMessage = '请求过于频繁，请稍后再试';
                    } else if (apiResponse.status === 401 || apiResponse.status === 403) {
                        errorMessage = 'API认证失败，请检查API密钥';
                    } else if (apiResponse.status >= 500) {
                        errorMessage = '服务器暂时不可用，请稍后再试';
                    }
                    
                    throw new Error(errorMessage);
                }

                // 添加响应时间日志
                const responseTime = Date.now() - requestStartTime;
                console.log('API响应时间:', responseTime, 'ms');

                // 如果响应时间过长，记录警告
                if (responseTime > 10000) {
                    console.warn('API响应时间过长，建议优化');
                }

                const apiData = await apiResponse.json();
                clearTimeout(timeout);
                if (!apiData || !apiData.choices || !apiData.choices[0] || !apiData.choices[0].message) {
                    throw new Error('Invalid API response format');
                }

                let generatedNames;
                try {
                    // 预处理AI返回的内容，移除可能导致JSON解析错误的字符
                    let content = apiData.choices[0].message.content;
                    // 尝试找到JSON对象的开始和结束位置
                    const startIndex = content.indexOf('{');
                    const endIndex = content.lastIndexOf('}');
                    
                    if (startIndex === -1 || endIndex === -1) {
                        throw new Error('AI返回的内容中未找到有效的JSON格式');
                    }
                    
                    // 提取JSON部分
                    content = content.substring(startIndex, endIndex + 1);
                    
                    // 解析JSON
                    generatedNames = JSON.parse(content);
                    
                    if (!generatedNames.names || !Array.isArray(generatedNames.names)) {
                        throw new Error('AI返回的数据格式不符合预期结构');
                    }
                } catch (parseError) {
                    console.error('Parse error:', parseError);
                    throw new Error(`解析AI返回的数据时出错: ${parseError.message}`);
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(generatedNames));
            } catch (error) {
                console.error('Error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '生成名字时出错' }));
            }
        });
        return;
    }

    // 处理未知请求
    res.writeHead(404);
    res.end('Not Found');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});