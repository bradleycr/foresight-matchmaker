# Recoding Medicine — applicant schemas

Field list for Foresight Matchmaking listings around Recoding Medicine.

Four listing types. Please mark any field that is wrong, missing, or should not be collected.

---

## Shared (all four)

| Field | Required | Notes |
| --- | --- | --- |
| Organisation name | yes | For an individual, this is the person’s name |
| Organisation type | yes | university, research institute, hospital, biobank/registry, company, startup, incubator, individual, other. When Other is chosen, a free-text definition is required. |
| Country of HQ | yes | ISO 3166-1 alpha-2 of HQ or residence. Eligibility (EU, EFTA, UK, Israel) is derived from this. |
| One-liner | yes | ≤ 140 characters |
| Summary | yes | ≤ 600 characters |
| Website | no | |
| Working languages | no | en, de, fr, nl, es, it, pl, sv, da, he, fi, pt, el, cs, hu, ro, other |
| Looking for | no | dataset access, AI partner, clinical partner, data-governance support, compute, join an existing team, individual expert, not looking, other (please define) |
| Application status | yes | undecided, looking for a partner to apply with, applying with a partner, team complete, not applying |
| Challenge events attending | no | Berlin 2 Sep, Paris 9 Sep, Stockholm 17 Sep, remote only |
| Intended public contribution | no | optional free text |
| Funding mainly needed for | no | optional free text (compute, personnel, …) |
| Best publicly available dataset | no | optional free text |
| Open to introductions | yes | |
| Contact name | yes | private |
| Contact email | yes | private |
| Contact role | no | private |

Collaboration-only flag: HQ outside the eligible region may list as a partner (cannot lead).

---

## 1. Data holder

Brings one or more datasets. At least one dataset is required.

### Dataset

| Field | Required | Values |
| --- | --- | --- |
| Name | yes | |
| Modality | ≥1 | MRI, CT, X-ray, histopathology, other imaging, genomics, transcriptomics, proteomics, metabolomics, epigenomics, microbiome, spatial omics, multi-omics, structured EHR, clinical notes, registry, longitudinal cohort, waveform (ECG/EEG), wearable/sensor, claims, biospecimens, patient-reported outcomes, voice data, other |
| Disease area | ≥1 | oncology, cardiovascular, neurology, psychiatry, rare disease, infectious, metabolic/endocrine, respiratory, musculoskeletal, women’s health, paediatrics, geriatrics, immunology, dermatology, ophthalmology, critical care, dentistry, multi-domain, other |
| N subjects | yes | &lt;1k, 1k–10k, 10k–100k, 100k–1m, &gt;1m |
| Volume | yes | &lt;100GB, 100GB–1TB, 1–10TB, 10–100TB, &gt;100TB |
| Time span (years) | no | |
| Longitudinal | yes | yes / no |
| Annotation | yes | none, partial, expert-labelled, outcome-linked |
| Linkage | ≥1 | outcomes, mortality, genomics, imaging, medication, none |
| Standards | ≥1 | DICOM, FHIR, OMOP CDM, BIDS, VCF, HL7v2, SNOMED, proprietary, none |
| Readiness | yes | raw, partially curated, AI-ready, benchmark-ready |
| Consent basis | yes | broad consent, study-specific consent, public task Art. 6(1)(e), research Art. 9(2)(j), fully anonymised, pseudonymised, unclear |
| Access model | yes | open download, registered access, DUA required, secure processing environment only, federated (no movement), synthetic derivative only, undecided |
| Data can leave the institution | yes | yes / no / unsure |
| Ethics approval | yes | approved, in progress, not started, not required |
| Available from | no | date |
| Publicly describable | yes | if no: used for matching, not shown in the directory |
| Governance notes | no | private |

---

## 2. AI team

Brings methods. Describes what data they need.

| Field | Required | Values |
| --- | --- | --- |
| Methods | no | foundation models, computer vision, clinical NLP, multimodal, graph/knowledge, causal inference, survival/longitudinal, synthetic data, federated learning, privacy tech, classical ML/biostat |
| Application target | no | biomarker discovery, diagnostics, clinical decision support, drug repurposing, prognosis/risk, triage/workflow, trial design, other |
| Domain expertise | no | same list as dataset disease area |
| Clinical partner | yes | have / need / not needed |
| Regulatory experience | no | MDR, IVDR, CE marking, GDPR DPIA, none |
| Compute | yes | own cluster, cloud budget, need compute, unsure |
| Compute scale | no | free text |
| Privacy capability | no | can work in a TRE, federated-capable, differential privacy, on-prem only, requires data export, synthetic only |
| Team size | yes | 1, 2–5, 6–15, &gt;15 |
| Track record | no | up to 5 URLs |
| Data needs | yes | modality, disease area, minimum n subjects, annotation required, linkage required, standards preferred (same vocabularies as the dataset) |

---

## 3. Consortium

Already has **both**: at least one dataset (same schema as data holder) **and** the AI-team fields above.

Plus:

| Field | Required | Notes |
| --- | --- | --- |
| Still seeking | no | same options as “looking for”. Empty means the team is complete (listed, not matched). |

---

## 4. Individual

An independent AI expert, not yet on a team. Same capability fields as an AI team. Organisation type is locked to individual. Team size is typically 1.

Plus:

| Field | Required | Notes |
| --- | --- | --- |
| Affiliation | no | Current lab, university, company — or blank if independent |
