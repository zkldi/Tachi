_beatoraja-ir-gradle TASK NAME HOME BASE_URL:
	cd java/beatoraja-ir && TCHIR_NAME={{ NAME }} TCHIR_HOME={{ HOME }} TCHIR_BASE_URL={{ BASE_URL }} ./gradlew {{ TASK }}

beatoraja-ir TASK="shadowJar": (_beatoraja-ir-gradle TASK '"Tachi LocalDev IR"' 'https://127.0.0.1:3000' 'http://127.0.0.1:8080')

beatoraja-ir-bokutachi TASK="shadowJar": (_beatoraja-ir-gradle TASK '"Bokutachi IR"' 'https://boku.tachi.ac' 'https://boku.tachi.ac')
