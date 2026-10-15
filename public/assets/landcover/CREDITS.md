# Sentinel imagery

Data & Viewing Products: EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016).

Layer: s2cloudless_3857. License: Creative Commons Attribution 4.0 International, https://creativecommons.org/licenses/by/4.0/.
Provider capabilities confirm the 2016 layer and license: https://tiles.maps.eox.at/wmts/1.0.0/WMTSCapabilities.xml
Documentation: https://cloudless.eox.at/documentation/usage

The 144 JPEG source tiles are bundled unchanged at zoom 13. manifest.json records their tile coordinates. The game assembles an atlas in memory, maps imagery through the same rotated and scaled geographic coordinates as its adapted DEM, changes color under game lighting, blends surface detail, removes parts beneath its fictional lake and coast, and uses a color based approximation to place forest. The displayed environment is adapted for gameplay, not an accurate geographic reconstruction or current satellite map.

No source provider API calls or credentials are used while playing. Attribution is visible in the game. Downloaded 2026-10-14.
