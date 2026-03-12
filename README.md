# dashboard-excel
dashboard

## AI Adjuster Summary

The adjuster summary panel supports live AI-generated commentary for the selected adjuster.

Create a `.env` file in the project root with:

```
VITE_OPENAI_API_KEY=your_api_key
VITE_OPENAI_MODEL=gpt-4o-mini
# Optional override (defaults to OpenAI Chat Completions endpoint)
VITE_OPENAI_API_URL=https://api.openai.com/v1/chat/completions
```

If `VITE_OPENAI_API_KEY` is not set, the app automatically falls back to a local summary so the feature still works.
