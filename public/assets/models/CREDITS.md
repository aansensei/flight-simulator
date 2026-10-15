# Supplied 3D assets

These models were supplied by AanSensei in `flight-simulator-upgraded.zip` and `glb-models-pack.zip`. The source pack's `CREDITS.md` declares the models and embedded procedural textures original creations released under CC0 1.0 Universal. The source pack does not identify a separate named artist. These assets contain no aircraft manufacturer logos.

License declared by the supplied pack: https://creativecommons.org/publicdomain/zero/1.0/

## Sightseeing aircraft

`sightseeing-aircraft.glb` is used for the fictional Ranger 260 STOL. It contains 6,096 triangles, a 12.10 m wingspan, an approximately 8.30 m length and six metallic/roughness materials. Embedded 2K JPEG maps provide albedo, OpenGL normal and metallic/roughness data. The eight named pivots are Propeller, AileronLeft, AileronRight, FlapLeft, FlapRight, Elevator, Rudder and NoseWheel.

The runtime raises the visual model by 0.07 m to align the main tires with the simulation's wheel contact height. It supplies live instrument faces and animated yokes in the cabin.

## Karst island clusters

`islands/karst-island-01.glb` through `karst-island-06.glb` contain separate limestone and canopy meshes in LOD0, LOD1 and LOD2. Their measured cliff summit elevations range from 135 m to 292 m; canopy geometry extends about 1.59 m above those summits. Each LOD0 contains 6,048 or 9,072 triangles. Each LOD1 contains 2,016 or 3,024 triangles. Each LOD2 contains 672 or 1,008 triangles. All six files embed the same limestone albedo, OpenGL normal and canopy albedo images. The runtime shares identical decoded textures.

The preview PNGs and generated replacement terrain maps from the source archive are not shipped. Existing photographic terrain materials and their attribution remain in `../materials/CREDITS.md`.
