# Coverage — scoring v1.0, 2026-10-01T05:33:18.458Z

- Total destinations: 145
- With coordinates: 145
- Missing coordinates: 0
- With climate data: 141
- With tourism source: 113
- Climate-only: 30
- With official station override: 0
- Low-confidence: 0
- Grid point more than 5 km away: 67 (jeddah 6.12 km, alula 6.08 km, antalya 8.75 km, cappadocia 5.84 km, trabzon 10.94 km, izmir 14.34 km, bursa 14.36 km, dubai 7.24 km, abu-dhabi 5.62 km, sharjah 5.55 km, ras-al-khaimah 6.84 km, al-wakrah 6.3 km, kuwait-city 9.22 km, manama 8.61 km, salalah 9.18 km, cairo 6.02 km, alexandria 9.97 km, casablanca 7.43 km, tangier 7.75 km, amman 5.84 km, petra 9.19 km, aqaba 8.19 km, edinburgh 5.98 km, manchester 5.19 km, oxford 6.07 km, paris 6.27 km, nice 5.5 km, lyon 5.31 km, barcelona 6.71 km, venice 7.49 km, naples 8.23 km, mykonos 5.75 km, thessaloniki 7.07 km, interlaken 12.2 km, lucerne 5.34 km, hamburg 5.54 km, porto 5.6 km, madeira 5.66 km, colombo 6.65 km, galle 10.09 km, ella 6.15 km, ubud 5.29 km, bangkok 5.33 km, pattaya 12.96 km, kuala-lumpur 5.41 km, malacca 5.74 km, singapore 5.88 km, xian 5.83 km, guangzhou 5.28 km, hanoi 5.72 km, da-nang 8.04 km, mumbai 5.96 km, los-angeles 6.48 km, las-vegas 5.66 km, tbilisi 13.23 km, batumi 7.77 km, kazbegi 7.26 km, cape-town 8.07 km, mombasa 6.69 km, mexico-city 5.03 km, cancun 7.94 km, guadalajara 5.06 km, rio-de-janeiro 9.36 km, sao-paulo 6.46 km, salvador 12.7 km, beirut 10.85 km, byblos 9.68 km)
- Withheld from the site (cell height too far from the town's; needs a station override): 3 (innsbruck: ERA5-Land cell +721 m from the town's height; madeira: Funchal's nearest ERA5-Land land cell (5.7 km) averages 548 m — the mountainside above the town — while the town centre is near sea level, so its temperatures would read too cold. Needs a station override (Funchal observatory normals).; kazbegi: ERA5-Land cell +908 m from the town's height)
- Errors: 1
  - male: no climate normals (no ERA5-Land land cell within search radius)

## Needs manual review

### Cell height far from the town's (more than 150 m, not accepted)

- alula: town 640 m, cell 810 m (high confidence)
- trabzon: town 44 m, cell 342 m (medium confidence)
- salalah: town 15 m, cell 171 m (high confidence)
- chefchaouen: town 583 m, cell 821 m (medium confidence)
- aqaba: town 46 m, cell 258 m (medium confidence)
- thessaloniki: town 15 m, cell 193 m (medium confidence)
- interlaken: town 566 m, cell 839 m (high confidence)
- jeju: town 65 m, cell 270 m (high confidence)
- batumi: town 10 m, cell 353 m (high confidence)
- byblos: town 42 m, cell 365 m (medium confidence)

### Possible model drizzle (15+ rain days a month averaging under 6 mm per rain day)

ERA5-Land tends to count more light-rain days than rain gauges. These months are worth checking against a station before a rain-day figure is quoted.

- abha: May 20.9 d / 118 mm
- edinburgh: Jan 16.1 d / 87 mm, Mar 15.2 d / 72 mm, May 15.1 d / 71 mm, Jun 15.8 d / 84 mm, Jul 16.4 d / 88 mm, Aug 16.1 d / 93 mm, Oct 15.4 d / 92 mm, Nov 15.8 d / 84 mm, Dec 15.2 d / 89 mm
- manchester: Jan 16.0 d / 89 mm, Jun 15.7 d / 92 mm, Jul 17.1 d / 94 mm, Aug 16.7 d / 96 mm, Oct 15.6 d / 93 mm, Nov 15.8 d / 90 mm
- amsterdam: Nov 15.0 d / 73 mm
- the-hague: Oct 15.4 d / 91 mm, Nov 16.3 d / 86 mm, Dec 15.5 d / 87 mm
- colombo: Mar 20.2 d / 117 mm
- kandy: May 25.4 d / 142 mm, Jun 25.0 d / 107 mm, Jul 25.3 d / 112 mm, Aug 24.9 d / 106 mm, Sep 22.3 d / 124 mm
- galle: Jan 16.5 d / 94 mm, Mar 19.1 d / 93 mm
- ella: Jun 16.4 d / 81 mm, Jul 15.9 d / 83 mm, Aug 17.4 d / 99 mm
- bali: May 19.0 d / 87 mm, Jun 17.3 d / 64 mm, Jul 16.5 d / 56 mm, Aug 15.4 d / 43 mm, Sep 16.3 d / 58 mm, Oct 19.5 d / 79 mm
- ubud: Jun 16.4 d / 80 mm, Jul 15.5 d / 65 mm, Oct 18.4 d / 108 mm
- jakarta: May 23.1 d / 123 mm, Jun 17.3 d / 90 mm
- pattaya: Jun 23.4 d / 134 mm, Jul 24.6 d / 142 mm, Aug 24.4 d / 142 mm
- penang: Jan 19.7 d / 113 mm, Feb 18.6 d / 99 mm
- miami: Jul 22.1 d / 116 mm
- gabala: Apr 15.5 d / 88 mm, May 17.6 d / 95 mm
- guba: May 16.7 d / 90 mm, Jun 15.1 d / 89 mm
- nairobi: Apr 22.1 d / 117 mm, May 17.8 d / 94 mm, Nov 20.1 d / 91 mm
- mombasa: Mar 16.6 d / 64 mm, Apr 26.7 d / 134 mm, Jun 22.6 d / 92 mm, Jul 23.1 d / 74 mm, Aug 21.3 d / 60 mm, Sep 18.0 d / 53 mm, Oct 18.6 d / 85 mm, Nov 22.3 d / 83 mm, Dec 18.6 d / 64 mm
- cancun: Jul 17.2 d / 96 mm, Aug 21.2 d / 124 mm
- salvador: Jan 17.0 d / 69 mm, Feb 17.9 d / 71 mm, Mar 21.7 d / 100 mm, Jun 25.6 d / 151 mm, Jul 25.1 d / 121 mm, Aug 23.6 d / 89 mm, Sep 18.1 d / 72 mm

### No tourism source (climate-only rating)

makkah, madinah, trabzon, bursa, sharjah, kuwait-city, manama, nizwa, alexandria, fes, chefchaouen, lyon, marseille, granada, cordoba, thessaloniki, salzburg, innsbruck, madeira, singapore, tokyo, kyoto, osaka, hiroshima, guangzhou, guba, tbilisi, johannesburg, durban, beirut, byblos, baalbek
