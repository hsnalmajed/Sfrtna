# Google Play — store listing and forms (drafted 27 Oct 2026)

Copy each block into Play Console as it is. Character limits are Play's.

## App details

- App name (30): **Sfrtna | سفرتنا** (same name as the iPhone app in App Store Connect, 29 Oct)
- Default language: **Arabic (ar)**; add **English (en-US)** as a translation.
- App or game: **App** · Free or paid: **Free**
- Category: **Travel & Local**
- Contact email: info@sfrtna.com · Website: https://sfrtna.com
- Privacy policy: https://sfrtna.com/ar/privacy

## Short description (80)

ar:
> خطط رحلتك كاملة: طيران وفنادق وأفضل وقت للسفر وخطة يومية لكل مدينة.

en:
> Plan your whole trip: flights, hotels, the best time to go and a daily plan.

## Full description (4000)

ar:
> سفرتنا يجمع لك كل ما تحتاجه لرحلتك في مكان واحد، بالعربي.
>
> ✈️ الطيران: قارن أسعار رحلات الطيران الحية من شركات الطيران ومواقع الحجز، ذهاباً وعودة أو ذهاباً فقط أو بين عدة مدن، مع تصفية حسب التوقف والوقت والأمتعة وشركة الطيران.
>
> 🏨 الفنادق: ابحث باسم الفندق أو بالمدينة، وقارن السعر عند أكثر من موقع، وحدد عدد الغرف والميزانية والقرب من معلم.
>
> 🌍 اقترح لي وجهة: أدخل ميزانيتك وتواريخك، ونقترح لك وجهات تناسبها، أو مساراً بين دولتين أو ثلاث.
>
> ☀️ أفضل وقت للسفر: تقييم الطقس لكل شهر في أكثر من 360 مدينة، من سجلات المناخ لكل شهر.
>
> 🗺️ دليل المدينة: أشهر المعالم مع وصف بالعربي ووقت الزيارة المناسب واللباس المناسب، وخريطة، وصور المدينة.
>
> 📅 خطتي الذكية: خطة يومية مرتبة حسب القرب، مع مطاعم قريبة، قابلة للتحميل PDF.
>
> 🧳 رحلتي: تابع تجهيز رحلتك خطوة خطوة: الطيران، والفندق، والتأشيرة، والخدمات، والخطة.
>
> 🛂 التأشيرة والعملة: متطلبات الدخول للمسافر السعودي لكل دولة، وتحويل العملة.
>
> الحجز يتم عند شركائنا مباشرة، ولا نضيف أي رسوم على السعر. بدون إعلانات.

en:
> Sfrtna brings everything your trip needs into one place, in Arabic and English.
>
> ✈️ Flights: compare live fares from airlines and booking sites — round trip, one way or multi-city — with filters for stops, times, bags and airlines.
>
> 🏨 Hotels: search by hotel name or city, compare the price across sites, and choose rooms, budget and distance to a landmark.
>
> 🌍 Suggest a destination: enter your budget and dates and get places that fit, or a route through two or three countries.
>
> ☀️ Best time to go: a month-by-month weather rating for more than 360 cities, from climate records.
>
> 🗺️ City guide: the best-known sights with descriptions, the right time to visit and what to wear, a map and a photo tour.
>
> 📅 Smart plan: a day-by-day plan ordered by distance, with nearby restaurants, downloadable as a PDF.
>
> 🧳 My trip: get your trip ready step by step — flight, hotel, visa, services and plan.
>
> 🛂 Visa and currency: entry requirements for Saudi travellers to every country, and a currency converter.
>
> You book directly with our partners; we add no fee to the price. No ads.

## Graphics (prepared by Claude before upload)

- App icon 512×512 PNG — from public/favicon-512.png
- Feature graphic 1024×500 PNG
- Phone screenshots, 6 (1080×2400): home, flight results, hotel, city guide,
  smart plan, my trip — Arabic set; English set optional.

## Data safety form (answers from what the app really does)

Does the app collect or share user data? **Yes**
Is all data encrypted in transit? **Yes** (HTTPS only)
Can users ask for their data to be deleted? **Yes** (account page → delete account)

| Data type | Collected | Shared | Optional | Purpose |
|---|---|---|---|---|
| Personal info → Name | Yes (Google sign-in) | No | Yes | Account management |
| Personal info → Email address | Yes (sign-in, feedback reply) | No | Yes | Account management, Developer communications |
| App activity → In-app search history | Yes (saved searches for members) | No | Yes | App functionality |
| App activity → Other user-generated content | Yes (feedback notes, screenshot) | No | Yes | App functionality, Developer communications |
| App info and performance → Crash logs / Diagnostics | Yes (error events) | No | Yes (cookie consent) | Analytics |
| App activity → App interactions | Yes (page views, clicks; anonymous counts) | No | No | Analytics |
| Device or other IDs | **No** (no advertising ID; AD_ID not requested) | — | — | — |
| Location | **No** — the map's "my location" stays on the phone, never sent | — | — | — |
| Financial info | **No** — bookings happen on partner sites | — | — | — |

Ads: **No ads** (no ad SDK). Target audience: **18+** (travel booking).
Content rating questionnaire: category **Reference, News, or Educational →
no** / **Utility** ... answer "No" to every violence, sexual, drug, gambling
and user-to-user communication question (feedback goes only to us).
Government app: No. Financial features: No. Health: No.
News app: No. COVID-19 app: No.

## Release plan

1. Internal testing (owner only) — first .aab, check install.
2. Closed testing — ≥ 12 testers (Gmail addresses) for 14 days in a row.
3. Production — apply after the 14 days.
