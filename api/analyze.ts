/**
 * Vercel Serverless Function - 多模态情绪融合分析 API
 * 端点: POST /api/analyze
 * 
 * 轻量级 TypeScript 实现，使用关键词匹配做文本情绪分析。
 * 支持 text/face/speech/ecg 四模态的 FormData 输入。
 */

// ====== 关键词库（对应 Python text_emotion.py v2.0） ======
const HIGH_AROUSAL = new Set([
  '愤怒','生气','暴怒','狂怒','怒','恼火','怒斥','暴跳',
  '激动','兴奋','激昂','亢奋','狂热','热血','兴高采烈','欣喜若狂',
  '紧张','焦虑','慌','慌张','恐慌','惊恐','恐惧','害怕','吓','怕',
  '惊喜','惊呼','大喊','尖叫',
]);

const LOW_AROUSAL = new Set([
  '平静','安静','宁静','镇定','冷静','平和','淡然','从容','淡定',
  '困','累','疲惫','疲倦','乏力','无力','没精神','无精打采',
  '麻木','漠然','冷淡','冷漠',
  '放松','轻松','松懈','松弛',
]);

const POSITIVE = new Set([
  '快乐','开心','愉快','高兴','喜悦','欢快','欣喜','幸福','乐','笑',
  '好','不错','棒','赞','优秀','出色','满意','满足','欣慰',
  '希望','期待','憧憬','向往','乐观',
  '自信','骄傲','自豪','成就感',
  '感恩','感激','感动','温暖','温馨','幸福',
  '爱','喜欢','喜爱','热爱','倾心',
]);

const NEGATIVE = new Set([
  '悲伤','难过','伤心','悲痛','哀伤','忧伤','忧愁','沮丧','低落','消沉',
  '痛苦','绝望','无助','无望','崩溃',
  '愤怒','生气','恼火','愤',
  '恐惧','害怕','担心','担忧','不安','忐忑',
  '焦虑','紧张','慌','烦恼','烦','烦躁',
  '孤独','寂寞','孤单','冷清',
  '后悔','懊悔','遗憾','内疚','自责',
  '累','疲惫','疲倦','乏味','无聊','没意思',
]);

// 抑郁关键词
const DEPRESSION = new Set([
  '抑郁','没希望','绝望','不想活','自杀','无价值','没意义',
  '不想动','懒得','无力','没兴趣','兴趣丧失','快感缺失',
  '失眠','早醒','嗜睡','没胃口','食欲不振','体重下降',
  '注意力','记不住','决定不了','犹豫',
]);

// 强度修饰
const INTENSIFIERS = new Set([
  '非常','特别','极其','极度','十分','万分','相当','格外','异常',
  '太','很','好','真','超','贼','巨','暴',
]);

const DAMPENERS = new Set([
  '有点','稍微','略微','有一点','一点点','微微','稍稍',
]);

// 情绪到 VA 映射
const EMOTION_VA: Record<string, { valence: number; arousal: number }> = {
  '快乐': { valence: 0.78, arousal: 0.62 },
  '平静': { valence: 0.55, arousal: 0.35 },
  '悲伤': { valence: 0.28, arousal: 0.38 },
  '生气': { valence: 0.22, arousal: 0.78 },
  '害怕': { valence: 0.32, arousal: 0.72 },
  '惊讶': { valence: 0.52, arousal: 0.75 },
  '厌恶': { valence: 0.18, arousal: 0.58 },
};

// ====== 文本分析 ======

function analyzeText(text: string): Record<string, unknown> {
  const clean = text.replace(/[,，.。!！?？\s\n\r]+/g, ' ').trim();
  if (!clean) {
    return {
      available: false, modality: 'text',
      emotion: null, valence: null, arousal: null,
      confidence: 0, quality: 0, evidence: [],
      warning: '请输入文本', error_code: 'empty_text',
    };
  }

  // 关键词提取 - 中文用子串扫描（不分词，直接全文匹配）
  const keywords: string[] = [];
  let posCount = 0, negCount = 0, highA = 0, lowA = 0, depCount = 0;
  let intensityMod = 0;

  function matchKeyword(kwSet: Set<string>, text: string): string[] {
    const found: string[] = [];
    for (const kw of kwSet) {
      if (text.includes(kw)) found.push(kw);
    }
    return found;
  }

  // 先找修饰词（影响全局）
  for (const kw of INTENSIFIERS) { if (clean.includes(kw)) intensityMod += 2; }
  for (const kw of DAMPENERS) { if (clean.includes(kw)) intensityMod -= 1; }

  // 正向词
  const posFound = matchKeyword(POSITIVE, clean);
  posCount = posFound.length;
  keywords.push(...posFound);

  // 负向词
  const negFound = matchKeyword(NEGATIVE, clean);
  negCount = negFound.length;
  keywords.push(...negFound);

  // 高唤醒
  const highFound = matchKeyword(HIGH_AROUSAL, clean);
  highA = highFound.length;
  // 避免重复
  for (const w of highFound) { if (!keywords.includes(w)) keywords.push(w); }

  // 低唤醒
  const lowFound = matchKeyword(LOW_AROUSAL, clean);
  lowA = lowFound.length;
  for (const w of lowFound) { if (!keywords.includes(w)) keywords.push(w); }

  // 抑郁
  const depFound = matchKeyword(DEPRESSION, clean);
  depCount = depFound.length;
  for (const w of depFound) { if (!keywords.includes(w)) keywords.push(w); }

  // 判断情绪
  let emotion = '平静';
  let sentiment = 'neutral';
  if (posCount > negCount) { emotion = '快乐'; sentiment = 'positive'; }
  else if (negCount > posCount) { 
    sentiment = 'negative';
    if (highA > lowA + 1) emotion = '生气';
    else if (highA > lowA) emotion = '害怕';
    else emotion = '悲伤';
  }

  // 计算 VA
  const baseVA = EMOTION_VA[emotion] || { valence: 0.5, arousal: 0.5 };
  const intensity = 0.5 + (intensityMod * 0.05);

  // 调整
  let valence = baseVA.valence;
  let arousal = baseVA.arousal;
  if (intensityMod > 0) {
    valence = valence + (valence > 0.5 ? 0.05 : -0.05);
    arousal = Math.min(1.0, arousal + 0.08);
  } else if (intensityMod < 0) {
    valence = valence + (valence < 0.5 ? 0.05 : -0.05);
    arousal = Math.max(0.1, arousal - 0.05);
  }

  valence = Math.max(0, Math.min(1, valence));
  arousal = Math.max(0, Math.min(1, arousal));

  const keywordCount = Math.max(1, posCount + negCount);
  const quality = Math.min(0.85, 0.55 + keywordCount * 0.05);
  const confidence = Math.min(0.80, quality * 0.9 + (keywords.length > 3 ? 0.1 : 0));

  return {
    available: true,
    modality: 'text',
    emotion,
    sentiment,
    valence: Math.round(valence * 10000) / 10000,
    arousal: Math.round(arousal * 10000) / 10000,
    confidence: Math.round(confidence * 10000) / 10000,
    quality: Math.round(quality * 10000) / 10000,
    evidence: keywords.length > 0 ? keywords.slice(0, 8) : ['关键词分析'],
    _debug: { clean, posCount, negCount, highA, lowA, depCount, intensityMod, keywordCount: keywords.length, keywords },
    warning: null,
    error_code: null,
    raw: { label: sentiment, score: confidence, mode: 'vercel_keyword' },
    intensity,
    depression_indicators: depCount,
    autism_indicators: 0,
  };
}

// ====== 简单融合 ======

function fuse(results: Record<string, unknown>[]): Record<string, unknown> {
  const available = results.filter(r => r.available === true);
  
  const modalityTable = results.map(r => ({
    modality: { text: '文本', speech: '语音', face: '人脸', ecg: 'ECG' }[r.modality as string] || r.modality,
    available: r.available,
    emotion: r.emotion || '-',
    raw_emotion: r.emotion || '-',
    valence: r.valence,
    arousal: r.arousal,
    confidence: r.confidence || 0,
    quality: r.quality || 0,
    evidence: typeof r.evidence === 'string' ? r.evidence : (r.evidence as string[])?.join('；') || '',
  }));

  const warnings: string[] = [];
  for (const r of results) {
    if (r.warning) warnings.push(`${r.modality}：${r.warning}`);
  }

  if (available.length === 0) {
    return {
      available: false,
      final_emotion: '信息不足',
      valence: null, arousal: null,
      confidence: 0,
      modality_table: modalityTable,
      explanation: '当前没有可用于融合的有效模态结果。',
      warnings,
      uncertainty_level: 'high',
      uncertainty_score: 0.8,
      suggestion: '请至少提供一种模态的数据进行分析。',
      fusion_mode: 'vercel_lite',
    };
  }

  // 加权平均
  let totalWeight = 0;
  let weightedV = 0, weightedA = 0, weightedConf = 0;
  for (const r of available) {
    const w = (r.quality as number) * (r.confidence as number) || 0.3;
    weightedV += (r.valence as number || 0.5) * w;
    weightedA += (r.arousal as number || 0.5) * w;
    weightedConf += (r.confidence as number) * w;
    totalWeight += w;
  }

  const finalV = totalWeight > 0 ? weightedV / totalWeight : 0.5;
  const finalA = totalWeight > 0 ? weightedA / totalWeight : 0.5;
  const avgConf = totalWeight > 0 ? Math.round((weightedConf / totalWeight) * 10000) / 10000 : 0.5;

  // 判断情绪
  let finalEmotion = '平静';
  if (finalV > 0.6 && finalA > 0.5) finalEmotion = '快乐';
  else if (finalV < 0.4 && finalA > 0.6) finalEmotion = '生气';
  else if (finalV < 0.4 && finalA < 0.4) finalEmotion = '悲伤';
  else if (finalV < 0.4) finalEmotion = '害怕';

  // 不确定性
  const ucScore = Math.round(((1 - avgConf) * 0.5 + (available.length === 1 ? 0.35 : 0)) * 100) / 100;
  const ucLevel = ucScore < 0.18 ? 'low' : ucScore < 0.42 ? 'medium' : 'high';

  const suggestion = available.length === 1
    ? '⚠️ 仅使用单个模态进行评估，结果仅供参考，建议补充其他模态数据。'
    : ucLevel === 'high' ? '建议结合临床观察进行人工复核。' : '';

  return {
    available: true,
    final_emotion: finalEmotion,
    valence: Math.round(finalV * 10000) / 10000,
    arousal: Math.round(finalA * 10000) / 10000,
    confidence: avgConf,
    modality_table: modalityTable,
    explanation: `综合 ${available.map(r => r.modality).join('、')} 的 ${available.length} 个模态结果，判断当前情绪为「${finalEmotion}」。`,
    warnings,
    uncertainty_level: ucLevel,
    uncertainty_score: ucScore,
    suggestion,
    fusion_mode: 'vercel_lite_v1',
  };
}

// ====== Vercel Handler ======

export async function POST(request: Request): Promise<Response> {
  try {
    const contentType = request.headers.get('content-type') || '';
    let text = '';
    const rawResults: Record<string, unknown>[] = [];

    if (contentType.includes('application/json')) {
      const body = await request.json();
      text = body.text || body.content || '';
    } else {
      // FormData
      const formData = await request.formData();
      text = (formData.get('text') as string) || '';

      // 人脸图片 (简单检测有/无)
      const faceFile = formData.get('face_file');
      if (faceFile && faceFile instanceof File && faceFile.size > 0) {
        rawResults.push({
          available: true, modality: 'face',
          emotion: '平静', valence: 0.55, arousal: 0.45,
          confidence: 0.6, quality: 0.6,
          evidence: ['人脸图片已接收(需完整后端做识别)'],
          warning: 'Vercel轻量模式不支持完整人脸识别，需连接Python后端',
        });
      }

      // 语音 (简单检测)
      const speechFile = formData.get('speech_file');
      if (speechFile && speechFile instanceof File && speechFile.size > 0) {
        rawResults.push({
          available: true, modality: 'speech',
          emotion: '平静', valence: 0.55, arousal: 0.48,
          confidence: 0.55, quality: 0.55,
          evidence: ['语音文件已接收(需完整后端做识别)'],
          warning: 'Vercel轻量模式不支持语音分析，需连接Python后端',
        });
      }

      // ECG (简单检测)
      const ecgFile = formData.get('ecg_csv_file');
      if (ecgFile && ecgFile instanceof File && ecgFile.size > 0) {
        rawResults.push({
          available: true, modality: 'ecg',
          emotion: 'normal_arousal', valence: 0.50, arousal: 0.55,
          confidence: 0.5, quality: 0.5,
          evidence: ['ECG文件已接收(需完整后端做分析)'],
          warning: 'Vercel轻量模式不支持ECG分析，需连接Python后端',
        });
      }
    }

    // 文本分析
    if (text.trim()) {
      rawResults.push(analyzeText(text.trim()));
    }

    if (rawResults.length === 0) {
      return Response.json({
        error: '请提供至少一种模态的数据',
        available: false,
      }, { status: 400 });
    }

    // 融合
    const result = fuse(rawResults);

    return Response.json(result, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    return Response.json({
      error: '服务器内部错误',
      details: err instanceof Error ? err.message : String(err),
      available: false,
    }, { status: 500 });
  }
}

// CORS 预检
export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
