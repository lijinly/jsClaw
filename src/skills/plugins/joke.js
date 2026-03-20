// 示例插件：joke（随机讲一个笑话）
// 这是从 ClaWHub 腾讯云镜像安装的插件格式示例
import { registerSkill } from '../../skillRegistry.js';

registerSkill({
  name: 'joke',
  description: '随机讲一个笑话或冷笑话',
  parameters: {
    type: 'object',
    properties: {
      category: { type: 'string', enum: ['cold', 'tech', 'any'], description: '笑话类别（cold: 冷笑话, tech: 程序员笑话, any: 随机）' },
    },
  },
  async execute({ category = 'any' } = {}) {
    const jokes = {
      cold: [
        '为什么程序员总是分不清万圣节和圣诞节？因为 Oct 31 = Dec 25。',
        '一个字节走进酒吧，跟调酒师说：给我来一杯，我现在只有 8 位心情。',
      ],
      tech: [
        '世界上有10种人：懂二进制的和不懂二进制的。',
        '程序员去买面包，老婆说"去买一个面包，如果有鸡蛋就买两个"。结果他买了两个面包。',
      ],
    };
    const all = [...jokes.cold, ...jokes.tech];
    const pool = category === 'cold' ? jokes.cold : category === 'tech' ? jokes.tech : all;
    return pool[Math.floor(Math.random() * pool.length)];
  },
});
