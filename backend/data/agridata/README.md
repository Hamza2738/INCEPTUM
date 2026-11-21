# Where to put official statistics

Drop a CSV named `yields_prices.csv` in this folder. When present, it overrides the built-in
ASSUMPTION values of `crops.json` in the profitability simulator.

Columns (UTF-8, comma separated, header required):

```
region,crop,yield_kg_ha,price_per_kg,var_cost_per_ha,year,source
TN,date_palm,8200,6.4,6100,2024,agridata.tn (dataset name, download date)
JP,tea,8800,520,2450000,2023,MAFF statistics (table name)
```

* `region` is `TN` or `JP`, `crop` is a crop id from `crops.json`.
* Prices and costs are in the region currency (TND or JPY).
* Keep the original downloaded files in a subfolder `raw/` with the download date and URL in
  a `SOURCES.txt` file, so every number can be traced.
* The file `yields_prices.sample.csv` shows the format. It contains no real data.
