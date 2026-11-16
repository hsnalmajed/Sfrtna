# Reply to App Review (4.3(a), 4.3(b), 4.2.6) — 16 Nov 2026 (owner's version)

Owner 16 Nov 18:23: the app keeps the same look as the site and Android;
the iPhone gets its own better way to use features we already have («احفظ
على جوالي» offline + prayer alerts + trip reminders, and «أضف الخطة إلى
تقويم جوالي»). Paste in App Store Connect, App Review, the message thread of
build 1.0 (27), with the new build. Then request a phone call (App Review
contact form, «Request a call») and submit. Honest note: no guarantee.

---

Hello, and thank you for the review.

We would like to explain what Sfrtna is, and what we changed for the iPhone since build 27. Sfrtna is a planning service for Arabic-speaking families; the iPhone app now adds things the website and our Android app do not have: the trip plan kept on the phone and usable with no internet, prayer alerts in the visited city's own time zone, trip reminders as notifications, the plan's stops added to the iPhone calendar with their times and places, and Sign in with Apple. Answers to your questions:

**1. What does the app do?**
Sfrtna plans a whole trip in Arabic for families from Saudi Arabia and the Gulf. It starts from the traveller's budget: it suggests destinations that fit the budget and the season, then shows visa rules for Saudi passport holders, currency, the best time to travel, a city guide for 365 cities written in Arabic, and a day-by-day trip plan. The plan is built around the five prayers in the destination's own time, Friday prayer, halal meals and travelling with children, and it can move across several cities of a country with the road time between them. The traveller can save the plan, download it as a PDF, receive it by e-mail, and get reminders before the trip. Flight and hotel prices come from partner companies, and bookings are made on the companies' own sites.

**2. Who are the users?**
Arabic-speaking families from Saudi Arabia and the Gulf who travel abroad (Turkey, Malaysia, Sri Lanka, Europe…) and need to plan around prayer, halal food and children. The app is Arabic-first, with English too.

**3. What need does it meet that other apps do not?**
Travel apps sell flights and hotels and leave the planning to the traveller; their content is translated and does not consider prayer or halal food. Sfrtna is the planning step before booking: budget first, then destination, visa, season, and a day plan that respects prayer times in the destination's time zone, Friday prayer and halal meals. The city guide and the plans come from our own engine and our own Arabic guide data, not from a template or a partner's white-label content.

**4. Beta testing and feedback.**
Friends and family who used the app and the site this month, our own tests on iPhones through TestFlight, and the Android test track. Examples of feedback and what we changed:
- The top of the screen was hidden under the Dynamic Island → we fixed the safe area on every page.
- Prayer-time boxes overflowed on small phones → we redesigned the day layout.
- The trip plan was too thin for a long trip (empty days in a small city) → the plan now spreads a long trip across a country's cities, with the days each city needs and the road time between them.
- "Download PDF" opened the print screen and the plan e-mail did not arrive → the PDF now opens the iPhone share sheet (Files, WhatsApp) and the e-mail was fixed.
- Arabic letters were clipped in the route banner → we fixed the text rendering.

**5. Can the app work on its own?**
Yes. Destination ideas, visa rules, seasons, the city guide and the trip plan all work inside the app. On iPhone, a kept plan opens fully offline, its alerts work without a connection, and its stops live in the iPhone calendar. Only the final booking is done on the partner company's own site.

**What is only in the iPhone app (please try it):** open a trip plan (for example Istanbul, four days), tap "Keep on my phone", switch on the prayer alerts and reminders, tap "Add the plan to my calendar", then turn on Airplane Mode and open the plan again.

**6. Could it be an in-app purchase or feature of another app?**
No. It is our only app and our own product.

**7. Does it share code with other apps you made?**
No. This is our only app on the account.

**8. Does it share code, SDKs or content with third-party apps?**
The app uses the open-source Capacitor runtime to show our own pages, plus our own Swift code for the iPhone-only parts: offline plans, local notifications in the city's time zone, the calendar events (EventKit), the share sheet and the safe area. The guide, the trip plans and the budget tools are our own code and data. Flight prices are shown through a partner's search, and the booking happens on the partner's site.

**9. Was it made for a client or with an app-generation service?**
No. We, the owner of this developer account, write and run Sfrtna ourselves. It was not made from a template or an app builder.

We would welcome a short call to show how a family plans a trip with Sfrtna.

Thank you,
Sfrtna team
