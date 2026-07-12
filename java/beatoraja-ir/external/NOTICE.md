# external/beatoraja.jar

This directory vendors `beatoraja.jar` from the **LR2oraja** project so the
Tachi Beatoraja IR can be compiled (and CI can produce shadow jars) without
any out-of-band download.

- **Upstream**: https://github.com/wcko87/lr2oraja
- **Release**: `build11611350155` ("LR2oraja Build 11611350155 (beatoraja 0.8.8)")
- **Source release artifact**: `LR2oraja.zip`
- **`LR2oraja.zip` SHA-256**: `3cdbe4ecabd7937003fc721cd2eb53af88e52881fc4920480526df6d70b9932b`
- **Original project**: https://github.com/exch-bms2/beatoraja (LR2oraja is a
  judge/gauge fork that ships only a replacement `beatoraja.jar`).

## Licensing

`beatoraja.jar` is licensed under the **GNU General Public License v3**
(see [`LICENSE.beatoraja`](LICENSE.beatoraja)). It is consumed by
`java/beatoraja-ir/` as a `compileOnly` Gradle dependency (see
[`../build.gradle.kts`](../build.gradle.kts)); the IR shadow jar that we
ship does **not** embed any beatoraja class files. Source for the bundled
binary is available at the upstream repositories above.

## Bumping

To update to a newer LR2oraja release:

1. Pick a release from https://github.com/wcko87/lr2oraja/releases.
2. Download its `LR2oraja.zip`, verify the SHA-256, extract `beatoraja.jar`.
3. Replace `beatoraja.jar` in this folder and update the release tag,
   archive SHA-256, and any version notes above.
