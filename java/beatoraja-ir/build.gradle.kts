plugins {
    id("java")
    id("com.gradleup.shadow") version "9.3.1"
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

group = "xyz.zkldi.bokutachiIR"
version = "3.1.2"

repositories {
    mavenCentral()
}

dependencies {
    implementation("com.squareup.okhttp3:mockwebserver:4.9.0")
    implementation("com.fasterxml.jackson.core:jackson-databind:2.10.0")
    compileOnly(files("external/beatoraja.jar"))
}

tasks.processResources {
    val env = mapOf(
        "TCHIR_VERSION" to "v$version",
        "TCHIR_NAME" to (providers.environmentVariable("TCHIR_NAME").orNull ?: "Tachi LocalDev IR"),
        "TCHIR_HOME" to (providers.environmentVariable("TCHIR_HOME").orNull ?: "https://127.0.0.1:3000"),
        "TCHIR_BASE_URL" to (providers.environmentVariable("TCHIR_BASE_URL").orNull ?: "https://127.0.0.1:3000"),
    )
    // ensure rerun if env changes
    env.forEach { (key, value) -> inputs.property(key, value) }

    filesMatching("tachi.properties") {
        expand(env)
    }
}

tasks.shadowJar {
    minimize()
}
