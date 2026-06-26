# OMSO1 REG Source-Specific Remap

Date: 2026-06-26
Environment: local/UAT

## Summary

Corrected Business Central alias mapping for:

- source_system: business-central
- source_field: machine_center_no
- source_value: OMSO1 REG

Previous active alias pointed to:

- OMSO 1-OZ - Printing 22 OZ

Evidence showed the affected output row was:

- document: SPK2601/P0025
- item: CR14OZ9KKQR
- description: CUP 14 OZ KOPI KENANGAN 9G-2000 NEW QR
- quantity: 150,000

The source was remapped to:

- OMSO 1-OZ - Printing OZ < 20

## Validation

After remap:

- OK Output remained 30,512,440.0000
- Raw OK Output remained 30,512,440.0000
- Reject KG remained 4,012.2000
- Reject PCS Eq incomplete gaps improved to 16
- Reject rate remained N/A because Reject PCS Eq is still incomplete

## Observed KPI change

Target changed to 38,881,926.0000 and achievement changed to 78.47%.

This change is due to target eligibility/mapping composition, not a change in raw OK output quantity.

## Remaining high-impact gap

The largest remaining unmapped source is:

- source_field: machine_center_no
- source_value: OMSO1 OZ
- rows: 305
- OK quantity: 29,630,500.00

Do not map OMSO1 OZ globally. It has ambiguous candidates across:

- Printing 22 OZ
- Printing OZ < 20
- Printing non-OZ

This should be handled through conditional mapping by item/bucket in P0.5.
