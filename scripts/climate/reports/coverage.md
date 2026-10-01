# Coverage — scoring v1.1, 2026-10-01T06:04:56.559Z

- Total destinations: 145
- With coordinates: 145
- Missing coordinates: 0
- With climate data: 143
- With tourism source: 113
- Climate-only: 31
- With official station normals (WMO 1991–2020) for at least one parameter: 95; for temperatures: 92
- On ERA5-Land only: 47
- On the NASA POWER fallback: 1 (male)
- Low-confidence: 0
- Temperatures from a grid point more than 5 km away: 30 (alula 6.08 km, abu-dhabi 5.62 km, al-wakrah 6.3 km, kuwait-city 9.22 km, salalah 9.18 km, tangier 7.75 km, amman 5.84 km, petra 9.19 km, edinburgh 5.98 km, manchester 5.19 km, venice 7.49 km, naples 8.23 km, mykonos 5.75 km, thessaloniki 7.07 km, porto 5.6 km, madeira 5.66 km, ella 6.15 km, ubud 5.29 km, xian 5.83 km, hanoi 5.72 km, da-nang 8.04 km, batumi 7.77 km, kazbegi 7.26 km, mombasa 6.69 km, cancun 7.94 km, guadalajara 5.06 km, rio-de-janeiro 9.36 km, sao-paulo 6.46 km, beirut 10.85 km, byblos 9.68 km)
- Withheld from the site (cell height too far from the town's; needs a station override): 2 (madeira: Funchal's nearest ERA5-Land land cell (5.7 km) averages 548 m — the mountainside above the town — while the town centre is near sea level, so its temperatures would read too cold. Needs a station override (Funchal observatory normals).; kazbegi: ERA5-Land cell +908 m from the town's height)
- Errors: 0

## Needs manual review

### Cell height far from the town's (more than 150 m, not accepted)

- alula: town 640 m, cell 810 m (high confidence)
- salalah: town 15 m, cell 171 m (high confidence)
- chefchaouen: town 583 m, cell 821 m (medium confidence)
- thessaloniki: town 15 m, cell 193 m (medium confidence)
- batumi: town 10 m, cell 353 m (high confidence)
- byblos: town 42 m, cell 365 m (medium confidence)

### Possible model drizzle (15+ rain days a month averaging under 6 mm per rain day)

ERA5-Land tends to count more light-rain days than rain gauges. These months are worth checking against a station before a rain-day figure is quoted.

- edinburgh: Jan 16.1 d / 87 mm, Mar 15.2 d / 72 mm, May 15.1 d / 71 mm, Jun 15.8 d / 84 mm, Jul 16.4 d / 88 mm, Aug 16.1 d / 93 mm, Oct 15.4 d / 92 mm, Nov 15.8 d / 84 mm, Dec 15.2 d / 89 mm
- manchester: Jan 16.0 d / 89 mm, Jun 15.7 d / 92 mm, Jul 17.1 d / 94 mm, Aug 16.7 d / 96 mm, Oct 15.6 d / 93 mm, Nov 15.8 d / 90 mm
- innsbruck: Jan 17.0 d / 64 mm, May 15.0 d / 64 mm, Jun 16.0 d / 74 mm, Jul 18.0 d / 80 mm, Aug 19.0 d / 97 mm, Sep 16.0 d / 79 mm, Oct 19.0 d / 91 mm, Nov 19.0 d / 86 mm, Dec 18.0 d / 64 mm
- the-hague: Oct 15.4 d / 91 mm, Nov 16.3 d / 86 mm, Dec 15.5 d / 87 mm
- ella: Jun 16.4 d / 81 mm, Jul 15.9 d / 83 mm, Aug 17.4 d / 99 mm
- bali: May 19.0 d / 87 mm, Jun 17.3 d / 64 mm, Jul 16.5 d / 56 mm, Aug 15.4 d / 43 mm, Sep 16.3 d / 58 mm, Oct 19.5 d / 79 mm
- ubud: Jun 16.4 d / 80 mm, Jul 15.5 d / 65 mm, Oct 18.4 d / 108 mm
- gabala: Apr 15.5 d / 88 mm, May 17.6 d / 95 mm
- guba: May 16.7 d / 90 mm, Jun 15.1 d / 89 mm
- nairobi: Apr 22.1 d / 117 mm, May 17.8 d / 94 mm, Nov 20.1 d / 91 mm
- mombasa: Mar 16.6 d / 64 mm, Apr 26.7 d / 134 mm, Jun 22.6 d / 92 mm, Jul 23.1 d / 74 mm, Aug 21.3 d / 60 mm, Sep 18.0 d / 53 mm, Oct 18.6 d / 85 mm, Nov 22.3 d / 83 mm, Dec 18.6 d / 64 mm
- cancun: Jul 17.2 d / 96 mm, Aug 21.2 d / 124 mm

### No tourism source (climate-only rating)

makkah, madinah, trabzon, bursa, sharjah, kuwait-city, manama, nizwa, alexandria, fes, chefchaouen, lyon, marseille, granada, cordoba, thessaloniki, salzburg, innsbruck, madeira, singapore, tokyo, kyoto, osaka, hiroshima, guangzhou, guba, tbilisi, johannesburg, durban, beirut, byblos, baalbek
