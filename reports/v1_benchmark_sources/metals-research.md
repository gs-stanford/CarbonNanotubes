# CPT v1 pure-metal benchmark research

Checked 2026-10-01. Research receipt only; no workbook/corpus modifications. Priority: Na/Ca. Values below were directly inspected in NIST-hosted reference publications, not inferred from search snippets. These are evaluated reference values, not newly inspected primary experimental reports.

## Electrical and density: matched 293 K (19.85 C)

Total electrical resistivity, not intrinsic resistivity. Conductivity is calculated as its reciprocal. Density is at 293 K independently of the electrical specimen. All are solid.

| Metal | Phase / electrical qualification | Resistivity (nOhm m) | Conductivity (MS/m), derived | Density (kg/m3) | Electrical source/table/printed page |
|---|---|---:|---:|---:|---|
| Na | BCC; 99.99+% | 47.7 | 20.96 | 971.2 | E1, Table 10, p.363 |
| Ca | alpha FCC; 99.96+% | 33.6 | 29.76 | 1550 | E2, Table 9, p.470 |
| Li | BCC; 99.98+% | 92.8 | 10.78 | 534 | E1, Table 3, p.347 |
| Mg | HCP; polycrystalline; 99.9+% | 43.9 | 22.78 | 1740 | E2, Table 6, p.459 |
| Be | HCP; provisional polycrystalline estimate from directional data; numeric purity not verified | 35.6 | 28.09 | 1850 | E2, Table 3, p.446 |
| K | BCC; 99.99+% | 72.0 | 13.89 | 871 | E1, Table 17, p.383 |

E1: T. C. Chi, Electrical resistivity of alkali elements, JPCRD 8, 339-438 (1979), DOI [10.1063/1.555598](https://doi.org/10.1063/1.555598). [Official NIST PDF, Na Table 10](https://srd.nist.gov/jpcrdreprint/1.555598.pdf#page=26). Densities: Table 1, p.342, footnote c (293 K).

E2: T. C. Chi, Electrical resistivity of alkaline earth elements, JPCRD 8, 439-497 (1979), DOI [10.1063/1.555599](https://doi.org/10.1063/1.555599). [Official NIST PDF, Ca Table 9](https://srd.nist.gov/jpcrdreprint/1.555599.pdf#page=33). Densities: Table 1, p.441, footnote c (293 K).

Both publications explicitly state that Table 1 physical constants were not critically evaluated and are not recommended values. Density purity/lot is not specified; do not inherit the electrical purity into density metadata. Ca Table 9 was also visually inspected as a rendered PDF page; other tabulations were inspected through the official PDF's extracted text. NIST web text was accessible for both; direct PDF download succeeded for E2 but returned HTTP 403 for E1 in this session. E1 is not classified as inaccessible.

## Optional thermal data: keep separate temperatures

| Metal | Thermal conductivity (W/m/K) | Temperature (K) | Source locator | Evidence qualification |
|---|---:|---:|---|---|
| Na | 142 | 298.2 | T1 p.396, recommended-values table | High-purity; numeric purity unspecified here |
| Ca | 201 | 298.2 | T1 p.316, provisional-values table | Estimated from electrical resistivity; stated accuracy +/-20%; not direct thermal measurement |
| Li | 84.8 | 298.2 | T1 p.360, recommended-values table | Well-annealed high-purity; numeric purity unspecified here |
| Mg | 156 | 298.2 | T1 p.362, recommended-values table | Well-annealed high-purity polycrystalline |
| K | 102.5 | 298.2 | T1 p.381, recommended-values table | High-purity; numeric purity unspecified here |

T1: C. Y. Ho, R. W. Powell, P. E. Liley, Thermal Conductivity of the Elements, JPCRD 1, 279 (1972), DOI [10.1063/1.3253100](https://doi.org/10.1063/1.3253100). [Official NIST PDF, calcium](https://srd.nist.gov/jpcrdreprint/1.3253100.pdf#page=39). Table units W/cm/K converted by multiplying by 100. Ca also lists 201 at 300 K; it must not be relabeled 293 K. No thermal-to-density ratios supplied because temperatures differ. Electrical purity specifications above do not apply automatically to T1.

## Derivations and integration limits

- sigma [S/m] = 1 / resistivity [Ohm m]; sigma [MS/m] = 1000 / resistivity [nOhm m].
- Density [kg/m3] = 1000 * density [g/cm3].
- At matched 293 K, sigma/density: Na = 21586 and Ca = 19201 S m2/kg (calculation digits, not measurement precision). These combine separate reference entries, not co-measured properties of one specimen.
- Example Na: 1/(47.7e-9) = 2.096436e7 S/m; divided by 971.2 kg/m3 gives 21586 S m2/kg.
- Example Ca: 1/(33.6e-9) = 2.976190e7 S/m; divided by 1550 kg/m3 gives 19201 S m2/kg.
- Preserve 293 K exactly; it is not exactly 20 C (293.15 K). Do not mix these with thermal data at 298.2 K without an explicit temperature conversion model.
- No tensile strength values proposed. No claims about commercial-grade performance, oxidation stability, safety, or structural suitability follow from these pure-metal entries.

## Unresolved, not approved as measured data

- Direct primary Ca thermal measurement not established; retain T1 as an estimate only.
- Be thermal table and exact electrical specimen purity not resolved in this receipt; no Be thermal number supplied.
- Primary electrical reports underlying the evaluations remain candidates, not directly reviewed: sodium Bradshaw and Pearson (1956), cited in E1; calcium Kayser and Soderquist (1967), characterized in E2 Table 10, p.473. Do not label either primary article inspected.
- No further metallurgy expansion is needed for the Na/Ca electrical-and-density integration above.
