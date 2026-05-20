# Tachi Beatoraja IR
This is the [Tachi](https://github.com/TNG-dev/Tachi) Internet Ranking implementation for the LR2oraja variant of beatoraja.

## Downloads

Check the sidebar. When a new version of this is created, `.jar` files will be compiled for you and available there.

## Setup

Follow the instructions on [Bokutachi](https://boku.tachi.ac/import/lr2oraja-ir).

## Compiling

- Copy the relevant build of `beatoraja.jar` into `external/beatoraja.jar`.
- Set the TCHIR_HOME, TCHIR_NAME and TCHIR_BASE_URL environment variables to what they need to be.
- Use `./gradlew build`. This will compile it into a single transferable `buildlibs/bokutachiIR-X.X.X-all.jar`
- There is another file in here, called `BokutachiIR-X.X.X.jar`. This is not what you want, so don't use it.

## Acknowledgements

The baseline for this implementation was provided by [Seraphin-](https://github.com/Seraphin-).

## Contribution

I do not like writing Java. Any contributions to this repository are massively appreciated, as it reduces the amount of time I have to spend writing Java.

Despite this being a separate language, you should still read the [Tachi Contribution Guide](https://docs.tachi.ac/contributing/).
