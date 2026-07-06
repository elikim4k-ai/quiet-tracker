// Registry of AI providers. Everything except Gemini uses the OpenAI-compatible
// chat/completions protocol, so adding a provider is just a new entry here.
export const PROVIDERS = {
  openai: {
    label: 'OpenAI',
    keyField: 'openaiApiKey',
    modelField: 'openaiModel',
    defaultModel: 'gpt-4o-mini',
    url: 'https://api.openai.com/v1/chat/completions',
    placeholder: 'sk-…',
    env: ['OPENAI_API_KEY'],
  },
  gemini: {
    label: 'Google Gemini',
    kind: 'gemini',
    keyField: 'geminiApiKey',
    modelField: 'geminiModel',
    defaultModel: 'gemini-flash-latest',
    placeholder: 'AIza…',
    env: ['GEMINI_API_KEY'],
  },
  grok: {
    label: 'xAI Grok',
    keyField: 'grokApiKey',
    modelField: 'grokModel',
    defaultModel: 'grok-4-fast',
    url: 'https://api.x.ai/v1/chat/completions',
    placeholder: 'xai-…',
    env: ['GROK_API_KEY', 'XAI_API_KEY'],
  },
  deepseek: {
    label: 'DeepSeek',
    keyField: 'deepseekApiKey',
    modelField: 'deepseekModel',
    defaultModel: 'deepseek-chat',
    url: 'https://api.deepseek.com/chat/completions',
    placeholder: 'sk-…',
    env: ['DEEPSEEK_API_KEY'],
  },
  qwen: {
    label: 'Alibaba Qwen',
    keyField: 'qwenApiKey',
    modelField: 'qwenModel',
    defaultModel: 'qwen-plus',
    url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
    placeholder: 'sk-…',
    env: ['QWEN_API_KEY', 'DASHSCOPE_API_KEY'],
  },
  glm: {
    label: 'Zhipu GLM',
    keyField: 'glmApiKey',
    modelField: 'glmModel',
    defaultModel: 'glm-4.5-air',
    url: 'https://api.z.ai/api/paas/v4/chat/completions',
    placeholder: 'key from z.ai / bigmodel.cn',
    env: ['GLM_API_KEY', 'ZHIPU_API_KEY'],
  },
  custom: {
    label: 'Custom (OpenAI-compatible)',
    keyField: 'customApiKey',
    modelField: 'customModel',
    urlField: 'customBaseUrl',
    defaultModel: '',
    placeholder: 'API key',
    env: [],
  },
};

export function providerFor(settings) {
  return PROVIDERS[settings.aiProvider] || PROVIDERS.openai;
}

export function resolveModel(settings) {
  const p = providerFor(settings);
  return settings[p.modelField] || p.defaultModel;
}

export function resolveKey(settings) {
  const p = providerFor(settings);
  return settings[p.keyField] || '';
}

// For the custom provider: accept a base URL with or without the /chat/completions suffix.
export function resolveUrl(settings) {
  const p = providerFor(settings);
  if (!p.urlField) return p.url;
  let base = (settings[p.urlField] || '').trim().replace(/\/+$/, '');
  if (!base) return '';
  if (!/\/chat\/completions$/.test(base)) base += '/chat/completions';
  return base;
}
