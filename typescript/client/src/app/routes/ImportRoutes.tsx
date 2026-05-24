import AquaArtemisExport from "#app/pages/dashboard/import/AquaArtemisExportPage";
import ArcaeaST3Page from "#app/pages/dashboard/import/ArcaeaST3Page";
import BarbatosPage from "#app/pages/dashboard/import/BarbatosPage";
import BatchManualPage from "#app/pages/dashboard/import/BatchManualPage";
import BeatorajaIRPage from "#app/pages/dashboard/import/BeatorajaIRPage";
import ChunitachiPage from "#app/pages/dashboard/import/ChunitachiPage";
import ChunithmMYTExport from "#app/pages/dashboard/import/ChunithmMYTExportPage";
import ChunithmSiteImportPage from "#app/pages/dashboard/import/ChunithmSiteImportPage";
import FervidexPage from "#app/pages/dashboard/import/FervidexPage";
import IIDXCGSiteImportPage from "#app/pages/dashboard/import/IIDXCGSiteImportPage";
import IIDXEamCSVPage from "#app/pages/dashboard/import/IIDXEamCSVPage";
import ImportClassPage from "#app/pages/dashboard/import/ImportClassPage";
import ImportPage from "#app/pages/dashboard/import/ImportPage";
import ITGHookPage from "#app/pages/dashboard/import/ITGHookPage";
import KsHookPage from "#app/pages/dashboard/import/KsHookPage";
import LR2DBPage from "#app/pages/dashboard/import/LR2DBPage";
import LR2HookPage from "#app/pages/dashboard/import/LR2HookPage";
import LR2orajaDBPage from "#app/pages/dashboard/import/LR2orajaDBPage";
import MaimaiDXSiteImportPage from "#app/pages/dashboard/import/MaimaiDXSiteImportPage";
import MikadoPage from "#app/pages/dashboard/import/MikadoPage";
import OngekiArtemisExportPage from "#app/pages/dashboard/import/OngekiArtemisExportPage";
import OngekiInoharaPage from "#app/pages/dashboard/import/OngekiInoharaPage";
import OngekiSiteImportPage from "#app/pages/dashboard/import/OngekiSiteImportPage";
import RizuPage from "#app/pages/dashboard/import/RizuPage";
import SaekawaPage from "#app/pages/dashboard/import/SaekawaPage";
import SDVXEamCSVPage from "#app/pages/dashboard/import/SDVXEamCSVPage";
import SilentHookPage from "#app/pages/dashboard/import/SilentHookPage";
import SSSXMLPage from "#app/pages/dashboard/import/SSSXMLPage";
import USCDBPage from "#app/pages/dashboard/import/USCDBPage";
import USCIRPage from "#app/pages/dashboard/import/USCIRPage";
import WACCAMyPageScraperPage from "#app/pages/dashboard/import/WACCAMyPageScraperPage";
import CGIntegrationPage from "#components/imports/CGIntegrationPage";
import KAIIntegrationPage from "#components/imports/KAIIntegrationPage";
import MytIntegrationPage from "#components/imports/MYTIntegrationPage";
import Divider from "#components/util/Divider";
import { UserContext } from "#context/UserContext";
import { TachiConfig } from "#lib/config";
import React, { useContext } from "react";
import { Link, Redirect, Route, Switch } from "react-router-dom";

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
			<Route exact path="/import/orphan-scores">
				<Redirect to={`/u/${user.username}/orphans`} />
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
					<Route exact path="/import/class">
						<ImportClassPage />
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
									importType="file/eamusement-iidx-csv"
									name="IIDX e-amusement CSV"
								/>
							</Route>
							<Route exact path="/import/iidx-pli-csv">
								<IIDXEamCSVPage
									importType="file/pli-iidx-csv"
									name="IIDX PLI CSV"
								/>
							</Route>
							<Route exact path="/import/sdvx-eam-csv">
								<SDVXEamCSVPage
									importType="file/eamusement-sdvx-csv"
									name="SDVX e-amusement CSV"
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
									clientID={import.meta.env.VITE_FLO_CLIENT_ID ?? ""}
									game="iidx"
									hash="6f64b82107cea90aa4c51a33705cd57c1883c8cdc22a634730ca461a431744b3"
									kaiType="FLO"
									redirectUri={`${window.location.origin}/oauth2-callback/flo`}
								/>
							</Route>
							<Route exact path="/import/iidx-eag">
								<KAIIntegrationPage
									clientID={import.meta.env.VITE_EAG_CLIENT_ID ?? ""}
									game="iidx"
									hash="0451a33ffc7f8b0c089450d842efb8b7099e22a2df2251ae4e6d9ec1b3cb4a5f"
									kaiType="EAG"
									redirectUri={`${window.location.origin}/oauth2-callback/eag`}
								/>
							</Route>
							<Route exact path="/import/sdvx-min">
								<KAIIntegrationPage
									clientID={import.meta.env.VITE_MIN_CLIENT_ID ?? ""}
									game="sdvx"
									hash="5885d4123b6db3f0127111a587ea6549f533a178dc2e198d31f98bed4ffd0cad"
									kaiType="MIN"
									redirectUri={`${window.location.origin}/oauth2-callback/min`}
								/>
							</Route>
							<Route exact path="/import/sdvx-flo">
								<KAIIntegrationPage
									clientID={import.meta.env.VITE_FLO_CLIENT_ID ?? ""}
									game="sdvx"
									hash="6f64b82107cea90aa4c51a33705cd57c1883c8cdc22a634730ca461a431744b3"
									kaiType="FLO"
									redirectUri={`${window.location.origin}/oauth2-callback/flo`}
								/>
							</Route>
							<Route exact path="/import/sdvx-eag">
								<KAIIntegrationPage
									clientID={import.meta.env.VITE_EAG_CLIENT_ID ?? ""}
									game="sdvx"
									hash="0451a33ffc7f8b0c089450d842efb8b7099e22a2df2251ae4e6d9ec1b3cb4a5f"
									kaiType="EAG"
									redirectUri={`${window.location.origin}/oauth2-callback/eag`}
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

							<Route exact path="/import/rizu">
								<RizuPage />
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

							<Route exact path="/import/kt-ongeki-site-importer">
								<OngekiSiteImportPage />
							</Route>

							<Route exact path="/import/arcaea-st3">
								<ArcaeaST3Page />
							</Route>
						</>
					)}
				</Route>
			</Switch>
		</Switch>
	);
}
