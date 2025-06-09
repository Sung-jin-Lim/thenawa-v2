# TheNawa Development Context

## Project Overview

TheNawa (더나와) is a Korean secondhand marketplace aggregator that searches across:

- **Danggeun Market** (당근마켓) - Using selectors like `a[data-gtm="search_article"]`
- **Bunjang** (번개장터) - Using selectors like `a[data-pid]`
- **Junggonara** (중고나라) - Using selectors like `a[href*="/product/"]`

## Tech Stack

- **Framework**: Next.js 15.3.3
- **Scraping**: Puppeteer + Cheerio
- **AI**: OpenRouter API (DeepSeek/Llama models)
- **Styling**: Tailwind CSS
- **Deployment**: Configured for Vercel

## Key Features Implemented

### 1. Product Search (`/search`)

- Real-time scraping across 3 platforms
- AI-powered product recommendations
- Price filtering and sorting
- Location-based search (default: 마장동-56)

### 2. Product Comparison (`/compare`)

- **URL Format**: `/compare?products=encodedJSON` (NOT the old `?ids=` format)
- **Flow**: Search → Select 2+ products → Click "상품 비교하기" → AI analysis
- **Components**:
  - `SearchPageContent.tsx` - `goCompare()` function
  - `ComparisonPageContent.tsx` - URL parsing and display
  - `/api/compare` - Product detail scraping + AI analysis

### 3. AI Analysis

- Multi-criteria comparison in Korean
- Scoring system (0-10 for price, condition, overall value)
- Pros/cons analysis
- Best value recommendations

## Critical Issues Solved

### Issue 1: "비교할 제품 정보가 없습니다"

**Problem**: Comparison page couldn't find product data
**Solution**: Changed from `/compare?ids=...` to `/compare?products=...` with full JSON data

### Issue 2: Bunjang Wrong Data

**Problem**: Scraped "번개장터" instead of actual product names
**Solution**: Updated selectors to modern ones:

- `h1[data-testid="pdp-product-name"]` for titles
- `[data-testid="pdp-product-price"]` for prices

### Issue 3: Images Not Loading

**Problem**: Empty `src=""` attributes
**Solution**: Added fallback logic with "📱 이미지 없음" placeholder

### Issue 4: Browser Caching

**Problem**: Changes not reflecting in browser
**Solution**: Hard refresh (Cmd+Shift+R) and file touching

## Project Structure

```
app/
├── api/
│   ├── search/route.ts        # Multi-platform search
│   ├── compare/route.ts       # Product comparison + AI
│   └── ai-recommend/route.ts  # AI recommendations
├── search/
│   └── SearchPageContent.tsx  # Main search interface
└── compare/
    └── ComparisonPageContent.tsx # Comparison interface

lib/
├── browser-manager.ts         # Puppeteer management
└── scrapers/
    ├── danggeun-scraper.ts    # 당근마켓 scraping
    ├── bunjang-scraper.ts     # 번개장터 scraping
    ├── junggonara-scraper.ts  # 중고나라 scraping
    └── product-detail-scraper.ts # Detailed product info
```

## Environment Variables

```env
OPENROUTER_API_KEY=your_openrouter_api_key
```

## Deployment Ready

- **Vercel**: Configured with `@sparticuz/chromium-min`
- **Function Timeouts**: 30s (search), 60s (compare)
- **Alternative**: Railway for longer timeouts

## Development Commands

```bash
npm run dev     # Runs on http://localhost:3000
npm run build   # Production build
npm run start   # Production server
```

## Debugging Tips

1. Check browser console for detailed logs
2. Server logs show scraping progress
3. Hard refresh if changes don't appear
4. AI analysis logs show in terminal
5. URL format is critical for comparison feature

## Next Steps for Fork

1. Update `OPENROUTER_API_KEY` in new environment
2. Test comparison feature end-to-end
3. Deploy to Vercel/Railway
4. Consider adding more platforms or features

---

_This context was generated from extensive development and debugging session_
