# Local observability stack (see docker-compose-dev.yml: tachi-grafana, tachi-alloy).

grafana:
	python3 -c "import webbrowser; webbrowser.open('http://localhost:3005')"

alloy:
	python3 -c "import webbrowser; webbrowser.open('http://localhost:12345')"

# Reload all Grafana provisioning (datasources + dashboards) and verify health.
grafana-reset:
	./observability/setup-datasources.sh
