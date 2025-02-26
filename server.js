const http = require('http');
const url = require('url');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// 使用环境变量中的API密钥，确保在Vercel平台上能正确获取
const API_KEY = process.env.VERCEL_API_KEY || process.env.API_KEY;
if (!API_KEY) {
    console.error('错误：未设置API密钥！请确保设置了环境变量VERCEL_API_KEY或API_KEY');
    process.exit(1);
}

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

    // Vercel会自动处理静态文件，这里只需要处理API请求

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
                    console.error('API响应错误:', {
                        status: apiResponse.status,
                        statusText: apiResponse.statusText,
                        errorText: errorText,
                        requestTime: new Date().toISOString()
                    });
                    const errorMessage = handleApiError(apiResponse.status, errorText);
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
                    throw new Error('无效的API响应格式，请检查API配置');
                }

                let generatedNames;
                try {
                    // 预处理AI返回的内容
                    let content = apiData.choices[0].message.content.trim();
                    
                    // 尝试直接解析整个内容
                    try {
                        generatedNames = JSON.parse(content);
                    } catch {
                        // 如果直接解析失败，尝试提取JSON部分
                        const startIndex = content.indexOf('{');
                        const endIndex = content.lastIndexOf('}');
                        
                        if (startIndex === -1 || endIndex === -1) {
                            console.error('API返回内容:', content);
                            throw new Error('AI返回的内容中未找到有效的JSON格式');
                        }
                        
                        content = content.substring(startIndex, endIndex + 1);
                        generatedNames = JSON.parse(content);
                    }
                    
                    // 验证数据结构
                    if (!generatedNames.names || !Array.isArray(generatedNames.names)) {
                        console.error('解析后的数据:', generatedNames);
                        throw new Error('AI返回的数据结构不符合预期');
                    }

                    // 确保每个名字对象都有必要的字段
                    generatedNames.names = generatedNames.names.filter(name => {
                        return name && name.chinese_name && name.explanation_cn && name.explanation_en;
                    });

                    if (generatedNames.names.length === 0) {
                        throw new Error('没有生成有效的名字');
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

// 优化错误处理逻辑
const handleApiError = (status, errorText) => {
    console.error('API Error:', {
        status,
        errorText,
        url: API_URL,
        requestTime: new Date().toISOString()
    });
    
    switch (status) {
        case 429:
            return '请求过于频繁，请稍后再试';
        case 401:
        case 403:
            return 'API认证失败，请检查API密钥';
        case 500:
        case 502:
        case 503:
        case 504:
            return '服务器暂时不可用，请稍后再试';
        default:
            return `生成名字时出错 (错误代码: ${status})`;
    }
};