import { CustomScrollbar } from "#components/layout/CustomScrollbar";
import { LocalDevMissingSeedsBanner } from "#components/layout/LocalDevMissingSeedsBanner";
import { LoadingScreen } from "#components/layout/screens/LoadingScreen";
import { AllYourUGStatsContextProvider } from "#context/AllYourUGStatsContext";
import { BannedContextProvider } from "#context/BannedContext";
import { NotificationsContextProvider } from "#context/NotificationsContext";
import { SubheaderContextProvider } from "#context/SubheaderContext";
import { UserContextProvider } from "#context/UserContext";
import { UserSettingsContextProvider } from "#context/UserSettingsContext";
import { WindowContextProvider } from "#context/WindowContext";
import React from "react";
import { Toaster } from "react-hot-toast";
import { QueryClient, QueryClientProvider } from "react-query";
import { BrowserRouter } from "react-router-dom";

import { Routes } from "./routes/AppRoutes";

const queryClient = new QueryClient({
	defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: false } },
});

export default function App({ basename }: { basename: string }) {
	return (
		<React.StrictMode>
			<WindowContextProvider>
				<CustomScrollbar />
				<QueryClientProvider client={queryClient}>
					<BannedContextProvider>
						<UserContextProvider>
							<LoadingScreen>
								<NotificationsContextProvider>
									<UserSettingsContextProvider>
										<AllYourUGStatsContextProvider>
											<BrowserRouter basename={basename}>
												<Toaster />
												<LocalDevMissingSeedsBanner />
												<SubheaderContextProvider>
													<Routes />
												</SubheaderContextProvider>
											</BrowserRouter>
										</AllYourUGStatsContextProvider>
									</UserSettingsContextProvider>
								</NotificationsContextProvider>
							</LoadingScreen>
						</UserContextProvider>
					</BannedContextProvider>
				</QueryClientProvider>
			</WindowContextProvider>
		</React.StrictMode>
	);
}
