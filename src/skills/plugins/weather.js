import { registerSkill } from '../../skillRegistry.js';
registerSkill({
  name: 'weather',
  description: '查询指定城市的天气预报',
  parameters: {
    type: 'object',
    properties: { city: { type: 'string', description: '城市名称，例如 "北京"' } },
    required: ['city'],
  },
  async execute({ city }) {
    // 实际使用时可接入真实天气 API
    const conditions = ['晴', '多云', '小雨', '阴'];
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    const temp = Math.floor(Math.random() * 20) + 10;
    return `${city} 今天${condition}，气温 ${temp}°C，空气质量良好。`;
  },
});