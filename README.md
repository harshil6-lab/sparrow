# Chiri — India's home environment teacher (working name)

Environmental Hacks (AWS x Bharat Builds Tour) · Track 03: Waste and Energy · Team Aveniq

A household-centred coach. A sparrow mascot teaches right vs wrong habits, measures real
impact (kWh, CO2, rupees) bill-to-bill, and generates a rooftop-solar application packet.
Works in 9 Indian languages + English.

## Rules we hold ourselves to
1. Every number shown has a source. No source -> not shown.
2. Facts come from `data/facts.json` (curated, cited). The model only phrases them.
3. Demo/sample data is always labelled "SAMPLE".
4. Native-speaker review before any language is marked `reviewed: true` in `i18n/languages.json`.

## Layout
- frontend/  React PWA (design from Stitch)
- backend/   Python Lambda handlers + impact engine
- infra/     AWS SAM template
- data/      facts.json (right-vs-wrong cards), config.json (constants to verify)
- i18n/      locale files, one per language

## Day-0 checklist
- [ ] AWS account + Builder Center student verification (required to compete)
- [ ] `sam build && sam deploy --guided` with the hello endpoint
- [ ] Test A: roof area from open footprints for 3 Ahmedabad addresses
- [ ] Test B: bill reading for 3 real bills (units, slab, month)
- [ ] Fill `data/config.json` constants from cited sources
