import BarbatosPage from "app/pages/dashboard/import/BarbatosPage";
import MikadoPage from "app/pages/dashboard/import/MikadoPage";
import BatchManualPage from "app/pages/dashboard/import/BatchManualPage";
import LR2orajaDBPage from "app/pages/dashboard/import/LR2orajaDBPage";
import BeatorajaIRPage from "app/pages/dashboard/import/BeatorajaIRPage";
import ChunitachiPage from "app/pages/dashboard/import/ChunitachiPage";
import FervidexPage from "app/pages/dashboard/import/FervidexPage";
import IIDXCGSiteImportPage from "app/pages/dashboard/import/IIDXCGSiteImportPage";
import IIDXEamCSVPage from "app/pages/dashboard/import/IIDXEamCSVPage";
import ImportPage from "app/pages/dashboard/import/ImportPage";
import KsHookPage from "app/pages/dashboard/import/KsHookPage";
import LR2DBPage from "app/pages/dashboard/import/LR2DBPage";
import LR2HookPage from "app/pages/dashboard/import/LR2HookPage";
import SDVXEamCSVPage from "app/pages/dashboard/import/SDVXEamCSVPage";
import SilentHookPage from "app/pages/dashboard/import/SilentHookPage";
import SSSXMLPage from "app/pages/dashboard/import/SSSXMLPage";
import USCDBPage from "app/pages/dashboard/import/USCDBPage";
import USCIRPage from "app/pages/dashboard/import/USCIRPage";
import WACCAMyPageScraperPage from "app/pages/dashboard/import/WACCAMyPageScraperPage";
import KAIIntegrationPage from "components/imports/KAIIntegrationPage";
import Divider from "components/util/Divider";
import { UserContext } from "context/UserContext";
import { TachiConfig } from "lib/config";
import React, { useContext } from "react";
import { Link, Redirect, Route, Switch } from "react-router-dom";
import CGIntegrationPage from "components/imports/CGIntegrationPage";
import ITGHookPage from "app/pages/dashboard/import/ITGHookPage";
import MaimaiDXSiteImportPage from "app/pages/dashboard/import/MaimaiDXSiteImportPage";
import ChunithmSiteImportPage from "app/pages/dashboard/import/ChunithmSiteImportPage";
import SaekawaPage from "app/pages/dashboard/import/SaekawaPage";
import AquaArtemisExport from "app/pages/dashboard/import/AquaArtemisExportPage";
import ChunithmMYTExport from "app/pages/dashboard/import/ChunithmMYTExportPage";
import OngekiArtemisExportPage from "app/pages/dashboard/import/OngekiArtemisExportPage";
import MytIntegrationPage from "components/imports/MYTIntegrationPage";
import OngekiInoharaPage from "app/pages/dashboard/import/OngekiInoharaPage";

export default function ImportRoutes() {
	const { user } = useContext(UserContext);

	if (!user) {
		return <Redirect to="/login" />;
	}

	return (
		<Switch>
			<Route exact path="/import">
				<ImportPage user={user} />
			</Route>
			<Switch>
				<Route path="/import/*">
					<div>
						<Link to="/import">Go back to all import methods.</Link>
						<Divider />
					</div>

					<Route exact path="/import/batch-manual">
						<BatchManualPage />
					</Route>

					{TachiConfig.TYPE !== "kamai" && (
						<>
							<Route exact path="/import/lr2oraja-ir">
								<BeatorajaIRPage game="bms" />
							</Route>
							<Route exact path="/import/beatoraja-ir-pms">
								<BeatorajaIRPage game="pms" />
							</Route>
							<Route exact path="/import/lr2hook">
								<LR2HookPage />
							</Route>
							<Route exact path="/import/itghook">
								<ITGHookPage />
							</Route>
							<Route exact path="/import/usc-ir">
								<USCIRPage />
							</Route>
							<Route exact path="/import/usc-db">
								<USCDBPage />
							</Route>
							<Route exact path="/import/lr2-db">
								<LR2DBPage />
							</Route>
							<Route exact path="/import/lr2oraja-db">
								<LR2orajaDBPage />
							</Route>
						</>
					)}

					{TachiConfig.TYPE !== "boku" && (
						<>
							<Route exact path="/import/iidx-eam-csv">
								<IIDXEamCSVPage
									name="IIDX e-amusement CSV"
									importType="file/eamusement-iidx-csv"
								/>
							</Route>
							<Route exact path="/import/iidx-pli-csv">
								<IIDXEamCSVPage
									name="IIDX PLI CSV"
									importType="file/pli-iidx-csv"
								/>
							</Route>
							<Route exact path="/import/sdvx-eam-csv">
								<SDVXEamCSVPage
									name="SDVX e-amusement CSV"
									importType="file/eamusement-sdvx-csv"
								/>
							</Route>
							<Route exact path="/import/sss-xml">
								<SSSXMLPage />
							</Route>

							<Route exact path="/import/fervidex">
								<FervidexPage />
							</Route>
							<Route exact path="/import/barbatos">
								<BarbatosPage />
							</Route>
							<Route exact path="/import/kshook">
								<KsHookPage />
							</Route>
							<Route exact path="/import/silent-hook">
								<SilentHookPage />
							</Route>
							<Route exact path="/import/mikado">
								<MikadoPage />
							</Route>

							<Route exact path="/import/chunitachi">
								<ChunitachiPage />
							</Route>

							<Route exact path="/import/kt-chunithm-site-importer">
								<ChunithmSiteImportPage />
							</Route>

							<Route exact path="/import/saekawa">
								<SaekawaPage />
							</Route>

							<Route exact path="/import/aqua-artemis-exporter">
								<AquaArtemisExport />
							</Route>

							<Route exact path="/import/chunithm-myt-exporter">
								<ChunithmMYTExport />
							</Route>

							<Route exact path="/import/iidx-flo">
								<KAIIntegrationPage
									hash="6f64b82107cea90aa4c51a33705cd57c1883c8cdc22a634730ca461a431744b3"
									clientID={process.env.VITE_FLO_CLIENT_ID ?? ""}
									redirectUri={`${window.location.origin}/oauth2-callback/flo`}
									kaiType="FLO"
									game="iidx"
								/>
							</Route>
							<Route exact path="/import/iidx-eag">
								<KAIIntegrationPage
									hash="0451a33ffc7f8b0c089450d842efb8b7099e22a2df2251ae4e6d9ec1b3cb4a5f"
									clientID={process.env.VITE_EAG_CLIENT_ID ?? ""}
									redirectUri={`${window.location.origin}/oauth2-callback/eag`}
									kaiType="EAG"
									game="iidx"
								/>
							</Route>
							<Route exact path="/import/sdvx-min">
								<KAIIntegrationPage
									hash="5885d4123b6db3f0127111a587ea6549f533a178dc2e198d31f98bed4ffd0cad"
									clientID={process.env.VITE_MIN_CLIENT_ID ?? ""}
									redirectUri={`${window.location.origin}/oauth2-callback/min`}
									kaiType="MIN"
									game="sdvx"
								/>
							</Route>
							<Route exact path="/import/sdvx-flo">
								<KAIIntegrationPage
									hash="6f64b82107cea90aa4c51a33705cd57c1883c8cdc22a634730ca461a431744b3"
									clientID={process.env.VITE_FLO_CLIENT_ID ?? ""}
									redirectUri={`${window.location.origin}/oauth2-callback/flo`}
									kaiType="FLO"
									game="sdvx"
								/>
							</Route>
							<Route exact path="/import/sdvx-eag">
								<KAIIntegrationPage
									hash="0451a33ffc7f8b0c089450d842efb8b7099e22a2df2251ae4e6d9ec1b3cb4a5f"
									clientID={process.env.VITE_EAG_CLIENT_ID ?? ""}
									redirectUri={`${window.location.origin}/oauth2-callback/eag`}
									kaiType="EAG"
									game="sdvx"
								/>
							</Route>
							<Route exact path="/import/cg-dev-sdvx">
								<CGIntegrationPage cgType="dev" game="sdvx" />
							</Route>
							<Route exact path="/import/cg-dev-popn">
								<CGIntegrationPage cgType="dev" game="popn" />
							</Route>
							<Route exact path="/import/cg-dev-museca">
								<CGIntegrationPage cgType="dev" game="museca" />
							</Route>
							<Route exact path="/import/cg-dev-jubeat">
								<CGIntegrationPage cgType="dev" game="jubeat" />
							</Route>

							<Route exact path="/import/cg-nag-sdvx">
								<CGIntegrationPage cgType="nag" game="sdvx" />
							</Route>
							<Route exact path="/import/cg-nag-popn">
								<CGIntegrationPage cgType="nag" game="popn" />
							</Route>
							<Route exact path="/import/cg-nag-museca">
								<CGIntegrationPage cgType="nag" game="museca" />
							</Route>
							<Route exact path="/import/cg-nag-jubeat">
								<CGIntegrationPage cgType="nag" game="jubeat" />
							</Route>

							<Route exact path="/import/cg-gan-sdvx">
								<CGIntegrationPage cgType="gan" game="sdvx" />
							</Route>
							<Route exact path="/import/cg-gan-popn">
								<CGIntegrationPage cgType="gan" game="popn" />
							</Route>
							<Route exact path="/import/cg-gan-museca">
								<CGIntegrationPage cgType="gan" game="museca" />
							</Route>
							<Route exact path="/import/cg-gan-jubeat">
								<CGIntegrationPage cgType="gan" game="jubeat" />
							</Route>

							<Route exact path="/import/kt-cg-iidx-importer">
								<IIDXCGSiteImportPage />
							</Route>

							<Route exact path="/import/myt-chunithm">
								<MytIntegrationPage game="chunithm" />
							</Route>
							<Route exact path="/import/myt-maimaidx">
								<MytIntegrationPage game="maimaidx" />
							</Route>
							<Route exact path="/import/myt-ongeki">
								<MytIntegrationPage game="ongeki" />
							</Route>
							<Route exact path="/import/myt-wacca">
								<MytIntegrationPage game="wacca" />
							</Route>

							<Route exact path="/import/wacca-mypage-scraper">
								<WACCAMyPageScraperPage />
							</Route>

							<Route exact path="/import/kt-maimaidx-site-importer">
								<MaimaiDXSiteImportPage />
							</Route>

							<Route exact path="/import/ongeki-artemis-exporter">
								<OngekiArtemisExportPage />
							</Route>

							<Route exact path="/import/inohara">
								<OngekiInoharaPage />
							</Route>
						</>
					)}
				</Route>
			</Switch>
		</Switch>
	);
}
