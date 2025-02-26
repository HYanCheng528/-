document.addEventListener('DOMContentLoaded', () => {
    const englishNameInput = document.getElementById('englishName');
    const generateBtn = document.getElementById('generateBtn');
    const loadingDiv = document.getElementById('loading');
    const errorMessageDiv = document.getElementById('errorMessage');
    const resultSection = document.getElementById('resultSection');

    englishNameInput.addEventListener('input', () => {
        generateBtn.disabled = !englishNameInput.value.trim();
    });
});

const generateNames = async () => {
    const englishNameInput = document.getElementById('englishName');
    const generateBtn = document.getElementById('generateBtn');
    const loadingDiv = document.getElementById('loading');
    const errorMessageDiv = document.getElementById('errorMessage');
    const resultSection = document.getElementById('resultSection');

    const englishName = englishNameInput.value.trim();
    if (!englishName) return;

    // 显示加载状态
    loadingDiv.style.display = 'block';
    errorMessageDiv.style.display = 'none';
    resultSection.style.display = 'none';
    generateBtn.disabled = true;

    try {
        const prompt = `作为一个专业的中文名字起名专家，请为一个英文名为 "${englishName}" 的外国人生成3个有趣且富有文化内涵的中文名。

要求：
1. 理解英文名的含义和特点
2. 每个中文名都要体现中国文化特色
3. 可以适当加入一些幽默元素或有趣的梗
4. 为每个名字提供详细的中英文解释，包括：
   - 名字的字面含义
   - 文化背景
   - 与英文名的关联
   - 幽默或梗的解释（如果有）

请用JSON格式返回结果，格式如下：
{
    "names": [
        {
            "chinese_name": "中文名",
            "explanation_cn": "中文解释",
            "explanation_en": "英文解释"
        }
    ]
}`;

        const response = await fetch('http://localhost:3001/generate-name', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ englishName, prompt })
        });

        if (!response.ok) {
            throw new Error('服务器响应错误');
        }

        const data = await response.json();
        
        // 显示结果
        resultSection.innerHTML = '';
        data.names.forEach(name => {
            const nameCard = document.createElement('div');
            nameCard.className = 'name-card';
            nameCard.innerHTML = `
                <h3>${name.chinese_name}</h3>
                <p><strong>中文解释：</strong>${name.explanation_cn}</p>
                <p><strong>English Explanation：</strong>${name.explanation_en}</p>
            `;
            resultSection.appendChild(nameCard);
        });

        resultSection.style.display = 'block';
    } catch (error) {
        errorMessageDiv.textContent = '生成名字时出错，请稍后重试';
        errorMessageDiv.style.display = 'block';
        console.error('Error:', error);
    } finally {
        loadingDiv.style.display = 'none';
        generateBtn.disabled = false;
    }
};