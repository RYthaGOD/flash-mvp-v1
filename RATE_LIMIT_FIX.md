# Rate Limit Fix - ZEC Price API

## Problem
Getting 429 (Too Many Requests) errors when fetching ZEC price from CoinGecko API.

## Solution Implemented

### 1. Backend Caching ✅
- Added 5-minute cache for ZEC price
- Prevents excessive API calls
- Returns cached price even if API fails

**File:** `backend/src/services/zcash.js`
- Added `priceCache` object with TTL
- Cache checked before API call
- Cache updated on successful fetch
- Falls back to cached price on 429 errors

### 2. Error Handling ✅
- Specific handling for 429 errors
- Graceful fallback to cached price
- Fallback to default price if no cache

**Features:**
- Detects 429 status code
- Uses expired cache if available
- Returns $30 fallback if no cache

### 3. Frontend Improvements ✅
- Reduced polling frequency (5 minutes)
- Better error display
- Shows cached status
- Graceful error handling

**File:** `frontend/src/components/tabs/ZcashTab.js`
- Price refresh interval: 5 minutes (matches cache TTL)
- Error messages for rate limits
- Displays cached badge
- Keeps previous price on error

## How It Works

### Backend Flow:
```
1. Request comes in for /api/zcash/price
2. Check cache (5 min TTL)
   ├─ If valid: Return cached price ✅
   └─ If expired: Fetch from API
      ├─ Success: Update cache, return price ✅
      └─ 429 Error: Return cached (even if expired) or fallback ✅
```

### Frontend Flow:
```
1. Component mounts: Fetch price once
2. Set interval: Refresh every 5 minutes
3. On error:
   ├─ If previous price exists: Keep displaying it
   └─ If no price: Show error message
```

## Configuration

**Cache TTL:** 5 minutes (300,000 ms)
- Can be adjusted in `zcash.js` constructor
- Change `this.priceCache.ttl` value

**Fallback Price:** $30 USD
- Used when API fails and no cache exists
- Can be adjusted in `getZecPrice()` method

## Testing

### Test Cache:
1. Call `/api/zcash/price` - Should fetch from API
2. Call again immediately - Should return cached price
3. Wait 5+ minutes - Should fetch fresh price

### Test Rate Limit:
1. Make many rapid requests
2. Should get cached price after first request
3. 429 errors should be handled gracefully

## CoinGecko API Limits

**Free Tier:**
- 10-50 calls/minute (varies)
- 429 error when exceeded

**Our Solution:**
- Cache for 5 minutes = max 12 calls/hour
- Well within free tier limits
- No API key required

## Future Improvements

1. **Alternative Price Sources:**
   - Add backup APIs (CoinMarketCap, CryptoCompare)
   - Rotate between sources
   - Fallback chain

2. **Better Caching:**
   - Redis for distributed caching
   - Shared cache across instances
   - Cache invalidation strategies

3. **API Key:**
   - Get CoinGecko API key for higher limits
   - Use Pro tier for production

4. **Price Oracle:**
   - Use Chainlink/Pyth for on-chain prices
   - More reliable for production
   - Decentralized

## Status

✅ **Fixed** - Rate limit errors should no longer occur
✅ **Cached** - Price cached for 5 minutes
✅ **Resilient** - Handles errors gracefully
✅ **User-friendly** - Clear error messages

