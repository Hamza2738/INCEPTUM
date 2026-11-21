# Sample lab reports (for testing the extractor)

Put 10 to 12 photos or PDFs of soil and water lab reports here (Tunisian reports in French or
Arabic, Japanese reports in Japanese). Do not use real farmers' reports without consent: make
templates or anonymise them.

Then measure the extractor: for each file write the true values in `expected.json`
(`{"file.jpg": {"ec": 4.2, "ph": 7.9, "n_ppm": 18}}`) and run `python scripts/eval_extraction.py`.
Report "extraction accuracy X/N" honestly in your pitch.
