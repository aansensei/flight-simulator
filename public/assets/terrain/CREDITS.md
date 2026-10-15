# Alps terrain data

Terrain Tiles accessed on 2026-10-14 from https://registry.opendata.aws/terrain-tiles/.
Source tile: https://s3.amazonaws.com/elevation-tiles-prod/skadi/N46/N46E007.hgt.gz
Data rights and attribution: https://github.com/tilezen/joerd/blob/master/docs/attribution.md

Produced using Copernicus data and information funded by the European Union, EU-DEM layers.
Global GMTED2010 and SRTM terrain data courtesy of the U.S. Geological Survey.
Mapzen, a Linux Foundation project.

The source is a 3601 × 3601 grid of signed 16-bit elevations. alps.dem is bilinearly resampled to 1025 × 1025, signed 16-bit little endian, row major, north to south, west to east. No header. Missing values, if any, are filled from valid neighboring samples.

The game rotates and rescales coordinates, subtracts an elevation offset, compresses relief vertically by 0.65, carves a playable valley and lake, flattens the airport and approach corridors, and blends into a fictional coast. This is an adapted scenic environment, not an accurate geographic reconstruction. These modifications are not approved or endorsed by the source organizations.
