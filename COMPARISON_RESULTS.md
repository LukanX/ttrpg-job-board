# LLM Provider Comparison Results

## Summary

Successfully tested both OpenAI and Gemini APIs with your credentials. Here are the findings:

### Gemini API ✅ WORKING
- **Status**: Successfully generating content
- **Model**: `gemini-2.5-flash`
- **API Version**: v1beta
- **Success Rate**: 5/5 requests succeeded
- **Average Latency**: ~3.7 seconds per request
- **Token Usage**: ~600-650 total tokens per request
- **Cost**: FREE (with free tier quota)

### OpenAI API ❌ QUOTA EXCEEDED
- **Status**: All requests failed with HTTP 429
- **Error**: "insufficient_quota" - account has exceeded quota
- **Action Required**: Enable billing or add credits to OpenAI account

## Technical Fixes Applied

### Issue: Gemini API was returning 404 errors

**Root Cause**: The adapter was using outdated API endpoints and request structure.

**Solution**: Updated to current Gemini v1beta API specification:

1. **Endpoint Change**:
   - Old: `https://generativelanguage.googleapis.com/v1/models/{model}:generate`
   - New: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`

2. **Request Body Structure**:
   ```javascript
   // Old (incorrect)
   {
     prompt: { text: "..." },
     temperature: 0.7,
     maxOutputTokens: 512
   }
   
   // New (correct)
   {
     contents: [{
       parts: [{ text: "..." }]
     }],
     generationConfig: {
       temperature: 0.7,
       maxOutputTokens: 512
     }
   }
   ```

3. **Response Parsing**:
   ```javascript
   // Modern Gemini response structure
   {
     candidates: [{
       content: {
         parts: [{ text: "generated text here" }],
         role: "model"
       },
       finishReason: "STOP"
     }]
   }
   ```

## Sample Gemini Outputs

All 5 test requests successfully generated Starfinder 2E job posting content:

1. **"The Void's Echo"** - Mining outpost distress signal with unnatural whispers
2. **"The Whispering Void"** - Research outpost on edge of space
3. (Content truncated due to MAX_TOKENS)
4. **"The Kalo's Lament"** - Missing botanist in perilous jungles
5. (Content truncated due to MAX_TOKENS)

**Note**: Some responses hit the `MAX_TOKENS` limit (512 tokens), resulting in truncated output. For production use, increase `maxTokens` to 1000-2000 for complete job postings.

## Recommendations

### For MVP Development

**Use Gemini (gemini-2.5-flash)** because:

✅ **Working immediately** - Free tier credentials already functional
✅ **Good performance** - 3-4 second latency is acceptable for job generation
✅ **Generous free quota** - Google provides substantial free tier
✅ **Latest model** - Gemini 2.5 Flash is a current, capable model
✅ **Cost effective** - Remains free within quota limits

### Configuration

Your `.env` is already configured correctly:
```
GOOGLE_API_KEY=AIza... (working)
```

Default model in `lib/llm/gemini.ts`:
```typescript
const DEFAULT_MODEL = 'gemini-2.5-flash'
```

### Suggested Improvements

1. **Increase token limit** for complete outputs:
   ```typescript
   const result = await generateJob('gemini', prompt, {
     maxTokens: 1500,  // Up from 512
     temperature: 0.7
   })
   ```

2. **Add JSON parsing** to extract structured data:
   ```typescript
   const text = result.text.replace(/```json\n?|\n?```/g, '').trim()
   const jobData = JSON.parse(text)
   ```

3. **Handle rate limits** with retry logic (Google free tier has generous limits but they exist)

4. **Cache results** to reduce API calls during development

### OpenAI Alternative

If you want to enable OpenAI for comparison:
- Add billing/credits to your OpenAI account
- Or use a different API key with available quota
- OpenAI's `gpt-4o-mini` would be comparable to `gemini-2.5-flash` in cost/performance

## Files Modified

- ✅ `lib/llm/gemini.ts` - Updated to v1beta API with correct endpoint and structure
- ✅ `scripts/llm_compare_node.js` - Updated Gemini integration
- ✅ `scripts/test_gemini_direct.js` - Added diagnostic script (helped identify the fix)

## Next Steps

1. **Wire the adapter into your Next.js API route**:
   ```typescript
   // app/api/jobs/generate/route.ts
   import { generateJob } from '@/lib/llm/provider'
   
   export async function POST(req: Request) {
     const { prompt } = await req.json()
     const result = await generateJob('gemini', prompt, {
       maxTokens: 1500,
       temperature: 0.7
     })
     return Response.json({ job: result.text })
   }
   ```

2. **Add structured output parsing** to ensure valid JSON

3. **Implement error handling** and retry logic

4. **Add streaming support** for better UX (Gemini API supports streaming)

## Cost Analysis

### Gemini Free Tier (Current)
- **Cost**: $0
- **Quota**: Generous daily limits (specific to your project)
- **Suitable for**: MVP development, prototyping, low-medium traffic

### If Scaling Beyond Free Tier

**Gemini 2.5 Flash** (when paid):
- Input: ~$0.075 per 1M tokens
- Output: ~$0.30 per 1M tokens
- Estimate: 100 job generations/day = ~$0.02-0.05/day

**OpenAI gpt-4o-mini** (when quota enabled):
- Input: ~$0.15 per 1M tokens
- Output: ~$0.60 per 1M tokens
- Estimate: 100 job generations/day = ~$0.05-0.10/day

**Conclusion**: Gemini is 40-50% cheaper at scale, and you're already set up with working credentials.
